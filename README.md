# Supreme Tennis

A real-time, two-player arcade tennis game. The server is authoritative: the browser sends only paddle input, while scoring, collisions, ball physics, and player slots run on the Node server.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser windows. Enter the same court code in both windows. Player 1 uses **W / S**, player 2 uses **Up / Down**. First to 7 wins.

## Deploy online

GitHub Pages cannot host persistent WebSocket servers, so this repo includes a ready-to-use [Render Blueprint](https://render.com/docs/blueprint-spec).

1. Open your Render dashboard and select **New → Blueprint**.
2. Connect this repository.
3. Render detects `render.yaml`; create the service.
4. Open the deployed HTTPS URL in two devices/tabs and use the same court code.

Set a paid plan for production traffic so the room server does not sleep. The game needs no database: active courts live in memory and are cleaned up ten minutes after the final player leaves.

## Architecture

- **Express** serves the game.
- **Socket.IO** synchronizes rooms and broadcasts 60fps game state.
- **Node server** validates inputs and owns the game simulation.
- **Canvas** renders the court, animated ball trail, paddles, and score.

## Security / fairness

The client never submits a score, ball position, player slot, or collision result. The server ignores inputs from spectators and invalid room payloads, keeping matches fair even if a browser is modified.