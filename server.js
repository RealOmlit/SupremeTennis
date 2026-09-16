import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { pingInterval: 10000, pingTimeout: 20000 });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const W = 1000, H = 600, PADDLE_W = 24, PADDLE_H = 118, BALL_R = 13, WIN = 7;
const rooms = new Map();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const serve = (g, toward = Math.random() < .5 ? -1 : 1) => {
  g.ball = { x: W / 2, y: H / 2, vx: 410 * toward, vy: (Math.random() * 250 - 125), trail: [] };
  g.serveAt = Date.now() + 1150;
};
function createGame() {
  const game = {
    players: [null, null], inputs: [{ up:false, down:false }, { up:false, down:false }],
    paddles: [{ y: H/2-PADDLE_H/2 }, { y: H/2-PADDLE_H/2 }],
    score: [0, 0], winner: null, lastScorer: 0, serveAt: Date.now() + 1200
  };
  serve(game, 1); return game;
}
function publicGame(g) {
  return { w:W, h:H, paddleH:PADDLE_H, paddleW:PADDLE_W, ballR:BALL_R, paddles:g.paddles,
    ball:g.ball, score:g.score, winner:g.winner, serving: Math.max(0, g.serveAt-Date.now()) };
}
function resetRoom(room) {
  room.game = createGame();
  room.playerBySocket.clear();
}
function join(socket, { roomCode, name }) {
  const code = String(roomCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (code.length < 3) return socket.emit("errorMessage", "Room codes need at least 3 letters or numbers.");
  let room = rooms.get(code);
  if (!room) { room = { game:createGame(), playerBySocket:new Map(), expires:null }; rooms.set(code, room); }
  if (room.playerBySocket.has(socket.id)) return;
  const slot = room.game.players.findIndex(p => p === null);
  if (slot < 0) return socket.emit("errorMessage", "This court is full. Ask for a new room code.");
  if (room.expires) clearTimeout(room.expires);
  room.game.players[slot] = { id:socket.id, name:String(name || "Player").trim().slice(0, 14) || "Player" };
  room.playerBySocket.set(socket.id, slot);
  socket.join(code); socket.data.roomCode = code;
  socket.emit("joined", { code, side:slot, game:publicGame(room.game) });
  io.to(code).emit("roster", room.game.players.map((p, i) => p ? { name:p.name, side:i } : null));
  if (room.game.players.every(Boolean)) io.to(code).emit("matchReady");
}
io.on("connection", socket => {
  socket.on("joinRoom", payload => join(socket, payload || {}));
  socket.on("input", value => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room) return;
    const side = room.playerBySocket.get(socket.id);
    if (side === undefined || !value || typeof value !== "object") return;
    room.game.inputs[side] = { up:!!value.up, down:!!value.down };
  });
  socket.on("restart", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.playerBySocket.has(socket.id)) return;
    if (room.game.players.every(Boolean)) { const players = [...room.game.players]; resetRoom(room); room.game.players = players;
      players.forEach((p,i) => room.playerBySocket.set(p.id,i)); io.to(socket.data.roomCode).emit("matchReady"); }
  });
  socket.on("disconnect", () => {
    const code = socket.data.roomCode, room = rooms.get(code); if (!room) return;
    const side = room.playerBySocket.get(socket.id);
    if (side !== undefined) { room.game.players[side] = null; room.playerBySocket.delete(socket.id); room.game.inputs[side] = {up:false,down:false};
      io.to(code).emit("roster", room.game.players.map((p,i) => p ? {name:p.name,side:i} : null));
      room.expires = setTimeout(() => rooms.delete(code), 10 * 60 * 1000); }
  });
});
setInterval(() => {
  for (const [code, room] of rooms) {
    const g = room.game;
    for (let i=0;i<2;i++) {
      const dir = (g.inputs[i].down ? 1 : 0) - (g.inputs[i].up ? 1 : 0);
      g.paddles[i].y = clamp(g.paddles[i].y + dir * 8.4, 18, H-PADDLE_H-18);
    }
    if (!g.players.every(Boolean) || g.winner || Date.now() < g.serveAt) { io.to(code).volatile.emit("state", publicGame(g)); continue; }
    const b = g.ball; b.x += b.vx/60; b.y += b.vy/60;
    if (b.y-BALL_R < 0 || b.y+BALL_R > H) { b.vy *= -1; b.y = clamp(b.y, BALL_R, H-BALL_R); }
    const side = b.vx < 0 ? 0 : 1, px = side === 0 ? 46 : W-46-PADDLE_W, p = g.paddles[side];
    if ((side===0 ? b.x-BALL_R<=px+PADDLE_W && b.x>px : b.x+BALL_R>=px && b.x<px+PADDLE_W) && b.y+BALL_R>p.y && b.y-BALL_R<p.y+PADDLE_H) {
      const impact = clamp((b.y-(p.y+PADDLE_H/2))/(PADDLE_H/2), -1, 1);
      b.vx = Math.abs(b.vx) * (side===0 ? 1 : -1) * 1.055; b.vx = clamp(b.vx, -850, 850);
      b.vy = impact * 430 + (g.inputs[side].down ? 70 : g.inputs[side].up ? -70 : 0);
      b.x = side===0 ? px+PADDLE_W+BALL_R : px-BALL_R;
    }
    if (b.x < -35 || b.x > W+35) { const scorer = b.x < 0 ? 1 : 0; g.score[scorer]++; g.lastScorer=scorer;
      if (g.score[scorer] >= WIN) g.winner=scorer; else serve(g, scorer===0 ? -1 : 1); }
    b.trail = [...b.trail.slice(-7), {x:b.x,y:b.y}];
    io.to(code).volatile.emit("state", publicGame(g));
  }
}, 1000/60);
const port = process.env.PORT || 3000;
httpServer.listen(port, () => console.log(`Supreme Tennis listening on ${port}`));