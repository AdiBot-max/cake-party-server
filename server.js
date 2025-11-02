// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ✅ CORS setup for both Express & Socket.io
const allowedOrigins = [
  "https://tranquil-capybara-ae8915.netlify.app", // your Netlify site
  "http://localhost:3000"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"]
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ===== GAME LOGIC =====
const gravity = 2000;
const moveSpeed = 300;
const jumpVel = -650;
const WORLD = { width: 1200, height: 700, groundY: 520 };
const platforms = [
  { x: 0, y: WORLD.groundY + 10, w: WORLD.width, h: 200 },
  { x: 300, y: WORLD.groundY - 60, w: 160, h: 20 },
  { x: 520, y: WORLD.groundY - 140, w: 140, h: 20 },
  { x: 720, y: WORLD.groundY - 220, w: 160, h: 20 },
  { x: 980, y: WORLD.groundY - 120, w: 140, h: 20 }
];

const players = {};

function spawn() {
  return { x: 60 + Math.random() * 40, y: WORLD.groundY - 40 };
}

io.on("connection", socket => {
  console.log("🎂 Cupcake joined:", socket.id);
  
  const pos = spawn();
  players[socket.id] = {
    id: socket.id,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    w: 34,
    h: 44,
    color: `hsl(${Math.random() * 360},70%,55%)`,
    onGround: false,
    inputs: { left: false, right: false, jumpPressed: false }
  };

  socket.emit("init", { id: socket.id, world: WORLD, platforms });
  io.emit("players", players);

  socket.on("input", data => {
    const p = players[socket.id];
    if (!p) return;
    p.inputs = { ...p.inputs, ...data };
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

function collide(p) {
  for (const plat of platforms) {
    const b = { x: plat.x, y: plat.y, w: plat.w, h: plat.h };
    if (
      p.x + p.w > b.x &&
      p.x < b.x + b.w &&
      p.y + p.h > b.y &&
      p.y < b.y + b.h
    ) {
      if (p.vy >= 0 && p.y + p.h - b.y < 40) {
        p.y = b.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }
}

setInterval(() => {
  for (const id in players) {
    const p = players[id];
    p.vx = (p.inputs.right - p.inputs.left) * moveSpeed;
    if (p.inputs.jumpPressed && p.onGround) {
      p.vy = jumpVel;
      p.onGround = false;
      p.inputs.jumpPressed = false;
    }
    p.vy += gravity / 60;
    p.x += p.vx / 60;
    p.y += p.vy / 60;
    if (p.y + p.h > WORLD.height) {
      p.y = WORLD.height - p.h;
      p.vy = 0;
      p.onGround = true;
    }
    collide(p);
  }
  io.emit("state", Object.values(players));
}, 1000 / 60);
