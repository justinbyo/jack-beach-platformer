const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
ctx.imageSmoothingEnabled = false;

const WORLD_WIDTH = 4600;
const GRAVITY = 0.42;
const MAX_FALL = 12;
const POWER_DURATION = 600;
const FLOOR_Y = 490;
const keys = Object.create(null);

const level = {
  platforms: [
    { x: 0, y: FLOOR_Y, w: 650, h: 60 },
    { x: 685, y: FLOOR_Y, w: 485, h: 60 },
    { x: 1220, y: FLOOR_Y, w: 750, h: 60 },
    { x: 2015, y: FLOOR_Y, w: 505, h: 60 },
    { x: 2560, y: FLOOR_Y, w: 460, h: 60 },
    { x: 3045, y: FLOOR_Y, w: 755, h: 60 },
    { x: 3860, y: FLOOR_Y, w: 740, h: 60 },
    { x: 320, y: 418, w: 130, h: 24 },
    { x: 880, y: 410, w: 150, h: 24 },
    { x: 1540, y: 406, w: 160, h: 24 },
    { x: 2310, y: 400, w: 140, h: 24 },
    { x: 2780, y: 406, w: 170, h: 24 },
    { x: 3360, y: 402, w: 150, h: 24 },
  ],
  mysteryBoxes: [
    { x: 360, y: 386, w: 22, h: 22, destroyed: false },
    { x: 930, y: 378, w: 22, h: 22, destroyed: false },
    { x: 1606, y: 374, w: 22, h: 22, destroyed: false },
    { x: 2350, y: 368, w: 22, h: 22, destroyed: false },
    { x: 2844, y: 374, w: 22, h: 22, destroyed: false },
    { x: 3390, y: 370, w: 22, h: 22, destroyed: false },
  ],
  palms: [
    { x: 220, y: 490, h: 90 },
    { x: 990, y: 490, h: 95 },
    { x: 1880, y: 490, h: 100 },
    { x: 2750, y: 490, h: 88 },
    { x: 3630, y: 490, h: 102 },
  ],
  finishX: 4460,
};

const player = {
  x: 90,
  y: 430,
  w: 24,
  h: 34,
  vx: 0,
  vy: 0,
  baseSpeed: 2.6,
  speed: 2.6,
  baseJump: -8.6,
  jump: -8.6,
  baseShootDelay: 14,
  shootDelay: 14,
  onGround: false,
  facing: 1,
  shootCooldown: 0,
  invuln: 0,
  lives: 3,
  alive: true,
  activePower: "None",
  powerTimer: 0,
};

const enemies = [
  { x: 790, y: 454, w: 24, h: 30, vx: 0.8, minX: 730, maxX: 1130, alive: true },
  { x: 1470, y: 454, w: 24, h: 30, vx: 0.7, minX: 1290, maxX: 1920, alive: true },
  { x: 1595, y: 376, w: 24, h: 30, vx: 0.6, minX: 1545, maxX: 1665, alive: true },
  { x: 2140, y: 454, w: 24, h: 30, vx: 0.75, minX: 2080, maxX: 2480, alive: true },
  { x: 2830, y: 376, w: 24, h: 30, vx: 0.8, minX: 2790, maxX: 2920, alive: true },
  { x: 3190, y: 454, w: 24, h: 30, vx: 0.9, minX: 3090, maxX: 3760, alive: true },
  { x: 3430, y: 372, w: 24, h: 30, vx: 0.8, minX: 3370, maxX: 3490, alive: true },
  { x: 4010, y: 454, w: 24, h: 30, vx: 0.85, minX: 3960, maxX: 4540, alive: true },
];

const lasers = [];
const powerPopups = [];
const netTraps = [];
let cameraX = 0;
let gameWon = false;
let gameOver = false;
let netSpawnCooldown = 140;

function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function moveAndCollide(entity, axis) {
  for (const p of level.platforms) {
    if (!overlaps(entity, p)) continue;
    if (axis === "x") {
      if (entity.vx > 0) entity.x = p.x - entity.w;
      else if (entity.vx < 0) entity.x = p.x + p.w;
      entity.vx = 0;
    } else {
      if (entity.vy > 0) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        if (entity === player) player.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = p.y + p.h;
        entity.vy = 0;
      }
    }
  }

  for (const box of level.mysteryBoxes) {
    if (box.destroyed || !overlaps(entity, box)) continue;
    if (axis === "x") {
      if (entity.vx > 0) entity.x = box.x - entity.w;
      else if (entity.vx < 0) entity.x = box.x + box.w;
      entity.vx = 0;
    } else {
      if (entity.vy > 0) {
        entity.y = box.y - entity.h;
        entity.vy = 0;
        if (entity === player) player.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = box.y + box.h;
        entity.vy = 0;
        if (entity === player) destroyMysteryBox(box);
      }
    }
  }
}

function setPower(powerName, duration = POWER_DURATION) {
  player.speed = player.baseSpeed;
  player.jump = player.baseJump;
  player.shootDelay = player.baseShootDelay;
  player.activePower = powerName;
  player.powerTimer = duration;

  if (powerName === "Speed Burst") player.speed = 3.9;
  else if (powerName === "Super Jump") player.jump = -10.6;
  else if (powerName === "Rapid Laser") player.shootDelay = 6;
  else if (powerName === "Shield") player.invuln = Math.max(player.invuln, 40);
}

function clearPower() {
  player.activePower = "None";
  player.powerTimer = 0;
  player.speed = player.baseSpeed;
  player.jump = player.baseJump;
  player.shootDelay = player.baseShootDelay;
}

function grantMysteryPower(x, y) {
  const mysteryPowers = ["Speed Burst", "Super Jump", "Rapid Laser", "Shield"];
  const selected = mysteryPowers[Math.floor(Math.random() * mysteryPowers.length)];
  setPower(selected);
  powerPopups.push({
    text: `${selected}!`,
    x,
    y,
    ttl: 95,
  });
}

function destroyMysteryBox(box) {
  if (box.destroyed) return;
  box.destroyed = true;
  grantMysteryPower(box.x - 10, box.y - 10);
}

function respawnPlayer() {
  player.x = 90;
  player.y = 430;
  player.vx = 0;
  player.vy = 0;
  player.invuln = 80;
}

function updatePlayer() {
  if (!player.alive || gameWon) return;
  const left = keys.ArrowLeft || keys.KeyA;
  const right = keys.ArrowRight || keys.KeyD;
  const jump = keys.ArrowUp || keys.KeyW || keys.Space;
  const shoot = keys.KeyF || keys.KeyJ;

  player.vx = 0;
  if (left) {
    player.vx = -player.speed;
    player.facing = -1;
  }
  if (right) {
    player.vx = player.speed;
    player.facing = 1;
  }

  if (jump && player.onGround) {
    player.vy = player.jump;
    player.onGround = false;
  }

  if (shoot && player.shootCooldown <= 0) {
    lasers.push({
      x: player.x + (player.facing > 0 ? player.w : -8),
      y: player.y + 14,
      w: 8,
      h: 4,
      vx: player.facing * 7.5,
      ttl: 90,
    });
    player.shootCooldown = player.shootDelay;
  }

  player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
  player.x += player.vx;
  moveAndCollide(player, "x");

  player.y += player.vy;
  player.onGround = false;
  moveAndCollide(player, "y");

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > WORLD_WIDTH) player.x = WORLD_WIDTH - player.w;

  if (player.y > canvas.height + 120) {
    player.lives -= 1;
    if (player.lives <= 0) {
      gameOver = true;
      player.alive = false;
    } else {
      respawnPlayer();
    }
  }

  player.shootCooldown -= 1;
  player.invuln -= 1;
  if (player.powerTimer > 0) {
    player.powerTimer -= 1;
    if (player.powerTimer <= 0) clearPower();
  }
}

function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i -= 1) {
    const l = lasers[i];
    l.x += l.vx;
    l.ttl -= 1;
    if (l.x > WORLD_WIDTH || l.x + l.w < 0 || l.ttl <= 0) {
      lasers.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const box of level.mysteryBoxes) {
      if (box.destroyed) continue;
      const laserHitBox = {
        x: box.x,
        y: box.y - 14,
        w: box.w,
        h: box.h + 28,
      };
      if (overlaps(l, laserHitBox)) {
        destroyMysteryBox(box);
        hit = true;
        break;
      }
    }
    if (hit) {
      lasers.splice(i, 1);
      continue;
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      if (overlaps(l, e)) {
        e.alive = false;
        hit = true;
        break;
      }
    }
    if (hit) lasers.splice(i, 1);
  }
}

function hurtPlayer(enemyX) {
  if (player.activePower === "Shield" && player.powerTimer > 0) return;
  if (player.invuln > 0 || gameOver || gameWon) return;
  player.lives -= 1;
  player.invuln = 80;
  player.vx = player.x < enemyX ? -4.5 : 4.5;
  player.vy = -5.2;
  if (player.lives <= 0) {
    gameOver = true;
    player.alive = false;
  }
}

function updateEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx;
    if (e.x <= e.minX || e.x + e.w >= e.maxX) e.vx *= -1;

    if (!player.alive || gameOver || gameWon) continue;
    if (overlaps(player, e)) {
      const stompWindow = player.y + player.h - e.y;
      if (player.vy > 1 && stompWindow < 13) {
        e.alive = false;
        player.vy = -7.2;
      } else {
        hurtPlayer(e.x);
      }
    }
  }
}

function updateNetTraps() {
  if (!gameOver && !gameWon) {
    netSpawnCooldown -= 1;
    if (netSpawnCooldown <= 0 && netTraps.length < 3) {
      const sourcePalm = level.palms[Math.floor(Math.random() * level.palms.length)];
      netTraps.push({
        x: sourcePalm.x - 16,
        y: sourcePalm.y - sourcePalm.h - 8,
        w: 34,
        h: 42,
        vy: 1.1,
        ttl: 520,
      });
      netSpawnCooldown = 120 + Math.floor(Math.random() * 140);
    }
  }

  for (let i = netTraps.length - 1; i >= 0; i -= 1) {
    const trap = netTraps[i];
    trap.y += trap.vy;
    trap.ttl -= 1;

    if (!gameOver && !gameWon && player.alive && overlaps(player, trap)) {
      hurtPlayer(trap.x + trap.w / 2);
      trap.ttl = 0;
    }

    if (trap.y > FLOOR_Y + 40 || trap.ttl <= 0) netTraps.splice(i, 1);
  }
}

function updateCamera() {
  cameraX = player.x - canvas.width / 2 + player.w / 2;
  cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - canvas.width));
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#7dd3fc");
  grad.addColorStop(0.55, "#bae6fd");
  grad.addColorStop(0.56, "#38bdf8");
  grad.addColorStop(1, "#0369a1");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fef08a";
  ctx.fillRect(740, 48, 72, 72);
  ctx.fillStyle = "#fde047";
  ctx.fillRect(748, 56, 56, 56);

  ctx.fillStyle = "#ffffff88";
  ctx.fillRect(110, 70, 120, 20);
  ctx.fillRect(260, 60, 90, 18);
  ctx.fillRect(530, 82, 130, 18);
  ctx.fillRect(680, 68, 110, 20);
}

function drawWorld() {
  ctx.save();
  ctx.translate(-cameraX, 0);

  for (const p of level.platforms) {
    const topColor = p.y > 430 ? "#fef3c7" : "#fcd34d";
    const sandColor = p.y > 430 ? "#fde68a" : "#f59e0b";
    ctx.fillStyle = topColor;
    ctx.fillRect(p.x, p.y, p.w, 8);
    ctx.fillStyle = sandColor;
    ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);
    ctx.fillStyle = "#eab308";
    for (let i = 0; i < p.w; i += 16) ctx.fillRect(p.x + i, p.y + 8, 2, p.h - 8);
  }

  for (const palm of level.palms) {
    const trunkTop = palm.y - palm.h;
    ctx.fillStyle = "#92400e";
    ctx.fillRect(palm.x, trunkTop, 16, palm.h);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(palm.x - 28, trunkTop - 10, 74, 10);
    ctx.fillRect(palm.x - 16, trunkTop - 20, 60, 8);
    ctx.fillRect(palm.x - 6, trunkTop - 30, 42, 8);
  }

  for (const box of level.mysteryBoxes) {
    if (box.destroyed) continue;
    drawMysteryBox(box);
  }

  for (const trap of netTraps) {
    drawNetTrap(trap);
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    drawYellowPlumber(e);
  }

  for (const l of lasers) {
    ctx.fillStyle = "#a5f3fc";
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.fillStyle = "#06b6d4";
    ctx.fillRect(l.x + 2, l.y + 1, l.w - 4, l.h - 2);
  }

  drawJack(player);

  drawFinishFlag();

  ctx.restore();
}

function drawJack(p) {
  const blink = p.invuln > 0 && Math.floor(p.invuln / 6) % 2 === 0;
  if (blink && !gameOver) return;

  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x + 5, y + 6, 14, 6);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x + 7, y, 10, 7);
  ctx.fillRect(x + (p.facing > 0 ? 15 : 3), y + 2, 4, 4);

  ctx.fillStyle = "#fecba1";
  ctx.fillRect(x + 6, y + 8, 12, 8);

  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x + 4, y + 16, 16, 11);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x + 6, y + 17, 12, 9);
  ctx.fillStyle = "#14532d";
  ctx.fillRect(x + 9, y + 17, 2, 9);
  ctx.fillRect(x + 13, y + 17, 2, 9);

  ctx.fillStyle = "#475569";
  ctx.fillRect(x + 2, y + 18, 4, 8);
  ctx.fillRect(x + 18, y + 18, 4, 8);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(x + 6, y + 27, 12, 4);
  ctx.fillStyle = "#111827";
  ctx.fillRect(x + 5, y + 31, 5, 3);
  ctx.fillRect(x + 14, y + 31, 5, 3);
}

function drawYellowPlumber(e) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x + 5, y + 1, 14, 6);
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(x + 6, y + 8, 12, 7);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x + 4, y + 15, 16, 10);
  ctx.fillStyle = "#ca8a04";
  ctx.fillRect(x + 9, y + 15, 2, 10);
  ctx.fillRect(x + 13, y + 15, 2, 10);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x + 4, y + 26, 6, 4);
  ctx.fillRect(x + 14, y + 26, 6, 4);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(x + (e.vx > 0 ? 20 : 0), y + 18, 4, 3);
}

function drawMysteryBox(box) {
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
  ctx.fillStyle = "#fde047";
  ctx.fillRect(box.x + 8, box.y + 6, 6, 3);
  ctx.fillRect(box.x + 10, box.y + 9, 3, 6);
  ctx.fillRect(box.x + 10, box.y + 16, 3, 3);
}

function drawNetTrap(trap) {
  ctx.fillStyle = "#93c5fd";
  ctx.fillRect(trap.x, trap.y, trap.w, trap.h);
  ctx.fillStyle = "#1e3a8a";
  for (let x = trap.x + 4; x < trap.x + trap.w; x += 8) {
    ctx.fillRect(x, trap.y, 2, trap.h);
  }
  for (let y = trap.y + 4; y < trap.y + trap.h; y += 8) {
    ctx.fillRect(trap.x, y, trap.w, 2);
  }
}

function drawFinishFlag() {
  const x = level.finishX;
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x, 310, 8, 180);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x + 8, 320, 40, 24);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 16, 328, 8, 8);
}

function drawOverlay() {
  ctx.fillStyle = "#0f172acc";
  ctx.fillRect(12, 12, 240, 88);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 14px monospace";
  const remaining = enemies.filter((e) => e.alive).length;
  ctx.fillText(`Lives: ${player.lives}`, 22, 34);
  ctx.fillText(`Plumbers left: ${remaining}`, 22, 54);
  ctx.fillText(`Power: ${player.activePower}`, 22, 74);
  ctx.fillText(`Goal: Reach the flag`, 22, 94);

  for (let i = powerPopups.length - 1; i >= 0; i -= 1) {
    const popup = powerPopups[i];
    popup.y -= 0.4;
    popup.ttl -= 1;
    if (popup.ttl <= 0) {
      powerPopups.splice(i, 1);
      continue;
    }
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 14px monospace";
    ctx.fillText(popup.text, popup.x - cameraX, popup.y);
  }

  if (gameWon || gameOver) {
    ctx.fillStyle = "#00000099";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.font = "bold 38px monospace";
    ctx.fillText(gameWon ? "BEACH CLEARED!" : "JACK WAS DEFEATED", canvas.width / 2, 220);
    ctx.font = "bold 18px monospace";
    ctx.fillText("Press R to restart", canvas.width / 2, 270);
    ctx.textAlign = "left";
  }
}

function updateStatusText() {
  const seconds = player.powerTimer > 0 ? ` (${Math.ceil(player.powerTimer / 60)}s)` : "";
  statusEl.textContent = `Lives: ${player.lives} | Lasers: Unlimited | Power: ${player.activePower}${seconds}`;
}

function resetGame() {
  player.x = 90;
  player.y = 430;
  player.vx = 0;
  player.vy = 0;
  player.lives = 3;
  player.onGround = false;
  player.facing = 1;
  player.shootCooldown = 0;
  player.invuln = 0;
  player.alive = true;
  clearPower();
  lasers.length = 0;
  powerPopups.length = 0;
  enemies.forEach((e) => {
    e.alive = true;
  });
  level.mysteryBoxes.forEach((box) => {
    box.destroyed = false;
  });
  netTraps.length = 0;
  netSpawnCooldown = 140;
  cameraX = 0;
  gameOver = false;
  gameWon = false;
}

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyR" || e.key === "r" || e.key === "R") {
    resetGame();
    keys.KeyR = false;
  }
});
document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function tick() {
  updatePlayer();
  updateLasers();
  updateEnemies();
  updateNetTraps();
  updateCamera();

  if (!gameWon && player.x + player.w >= level.finishX + 18) {
    gameWon = true;
    player.vx = 0;
  }

  drawBackground();
  drawWorld();
  drawOverlay();
  updateStatusText();

  requestAnimationFrame(tick);
}

tick();
