const socket = io();
const $ = id => document.getElementById(id);
const canvas = $("court"), ctx = canvas.getContext("2d");
let me = -1, state, input = {up:false, down:false}, lastSent = "", raf;
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function updateInput(){const v=JSON.stringify(input);if(v!==lastSent){socket.emit("input",input);lastSent=v}}
function key(e,on){const k=e.key.toLowerCase();if(["w","arrowup"].includes(k)){input.up=on;e.preventDefault()}if(["s","arrowdown"].includes(k)){input.down=on;e.preventDefault()}updateInput()}
addEventListener("keydown",e=>key(e,true));addEventListener("keyup",e=>key(e,false));
$("joinForm").addEventListener("submit",e=>{e.preventDefault();const code=$("room").value.trim()||Math.random().toString(36).slice(2,8);socket.emit("joinRoom",{roomCode:code,name:$("name").value});});
$("restart").onclick=()=>socket.emit("restart");
socket.on("connect",()=>{$("status").textContent="ONLINE"});
socket.on("disconnect",()=>{$("status").textContent="RECONNECTING"});
socket.on("errorMessage",toast);
socket.on("joined",({code,side,game})=>{me=side;state=game;$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("code").textContent="COURT "+code;history.replaceState({}, "", "#"+code);draw();});
socket.on("roster",players=>{for(let i=0;i<2;i++)$("p"+i).textContent=players[i]?.name||"WAITING";});
socket.on("matchReady",()=>{ $("overlay").classList.add("hidden");$("restart").classList.add("hidden");toast("MATCH POINT — PLAY");});
socket.on("state",s=>{state=s;if(s.winner!==null){$("overlay").classList.remove("hidden");$("overlay").innerHTML=(s.winner===me?"YOU WIN":"MATCH OVER")+"<div>"+(s.winner===me?"A supreme performance.":"Reset the court for another set.")+"</div>";$("restart").classList.remove("hidden")}else if(s.serving>0 && state) { $("overlay").classList.remove("hidden");$("overlay").innerHTML="READY?<div>Serve in "+Math.ceil(s.serving/1000)+"</div>"; } else $("overlay").classList.add("hidden");});
function draw(){
 if(state){const {w,h,paddleH,paddleW,ballR,paddles,ball}=state;ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#0b6040";ctx.fillRect(0,0,w,h);ctx.strokeStyle="rgba(241,255,232,.58)";ctx.lineWidth=5;ctx.strokeRect(17,17,w-34,h-34);ctx.beginPath();ctx.moveTo(w/2,17);ctx.lineTo(w/2,h-17);ctx.setLineDash([16,14]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(17,h*.23);ctx.lineTo(w-17,h*.23);ctx.moveTo(17,h*.77);ctx.lineTo(w-17,h*.77);ctx.stroke();
  ctx.strokeStyle="#d5ff50";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(w/2,h*.23);ctx.lineTo(w/2,h*.77);ctx.stroke();
  paddles.forEach((p,i)=>{const x=i? w-46-paddleW:46;ctx.fillStyle=i===me?"#d5ff50":"#eff5e5";ctx.fillRect(x,p.y,paddleW,paddleH);ctx.fillStyle=i===me?"#9ab941":"#a3b4a2";ctx.fillRect(x,p.y+paddleH*.48,paddleW,paddleH*.04)});
  (ball.trail||[]).forEach((t,i)=>{ctx.beginPath();ctx.fillStyle="rgba(213,255,80,"+(i/16)+")";ctx.arc(t.x,t.y,ballR*(i/12),0,7);ctx.fill()});ctx.beginPath();ctx.fillStyle="#f4ffbc";ctx.shadowColor="#d5ff50";ctx.shadowBlur=20;ctx.arc(ball.x,ball.y,ballR,0,7);ctx.fill();ctx.shadowBlur=0;
  $("s0").textContent=state.score[0];$("s1").textContent=state.score[1];
 } raf=requestAnimationFrame(draw)
} 
const hash=location.hash.slice(1);if(hash){$("room").value=hash;toast("Enter a name to rejoin "+hash)}