// Phase 3.0: Thrilling Multi-Grade Maze Engine
// Features: Keys & Locked Gates (🔑/🔒), Teleport Portals (🌀), Patrolling Guardians (👻/👾),
// Treasure Gems (💎), Radar Scan / Atmospheric Fog (M4), Smooth Avatar Interpolation & Particles!
import { sound } from "./sound.js";

export function mountMaze(canvas, game, onStatus = () => {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  const W = 720, H = 400;
  canvas.width = W; canvas.height = H;

  const age = game.ageLevel || "p4";
  const isHardP1 = age === "p1" && game.rules.difficulty >= 3;
  const isBossP1 = age === "p1" && game.rules.difficulty >= 4;
  const isHardP4 = age === "p4" && game.rules.difficulty >= 4;
  const isBossP4 = age === "p4" && game.rules.difficulty >= 5;
  const isBossM1 = age === "m1" && game.rules.difficulty >= 5;
  const isNightmareM4 = age === "m4" && game.rules.difficulty >= 5;
  const hasFog = age === "m4" || isBossP4 || isBossM1;
  const sizes = {
    p1: isHardP1 ? [9, 7] : [7, 5],
    p4: isHardP4 ? [13, 9] : [11, 7],
    m1: isBossM1 ? [15, 9] : [13, 9],
    m4: [15, 9]
  };
  const [cols, rows] = sizes[age] || sizes.p4;
  const cell = Math.min(36, Math.floor(315 / rows), Math.floor(640 / cols));
  const ox = Math.floor((W - cols * cell) / 2);
  const oy = Math.floor((H - rows * cell) / 2) + 8;

  const keys = new Set(), touch = new Set();
  const timeLimit = Number(game.rules?.timeLimit) || 0;

  let grid, player, renderPos, phase, level, raf = 0, moveAt = 0, frame = 0, timeLeft = timeLimit;
  let lives = game.player?.lives || 3;
  let score = 0, stepsCount = 0, invulnerable = 0, radarTimer = 0, freezeTimer = 0;
  let visitedPath = new Set(), solutionPath = [];
  let keyItem = null, hasKey = true, portals = [], gems = [], powerOrbs = [], guards = [];
  let confetti = [], particles = [], popups = [];

  const charEmojiMap = { "กระต่าย": "🐰", "แมว": "🐱", "หมี": "🐻", "หุ่นยนต์": "🤖" };
  const playerAvatar = charEmojiMap[game.player?.name] || "🧙";

  const gradeModeDesc = isBossP1
    ? "👑 โหมดยากพิเศษ ป.1–ป.3 (เก็บกุญแจ 🔑 + วาร์ป 🌀 + หลบผู้พิทักษ์ 👻!)"
    : isHardP1
    ? "🔥 โหมดท้าทาย ป.1–ป.3 (เขาวงกตใหญ่ขึ้น + หากุญแจวิเศษ 🔑 + ประตูวาร์ป 🌀)"
    : {
        p1: "🌟 โหมดล่าดาวนำทาง (เดินตามดาวเรืองแสงไปหาถ้วยรางวัล)",
        p4: "🔑 โหมดกุญแจวิเศษ & ประตูวาร์ป (เก็บกุญแจ 🔑 เพื่อไขประตูสู่ถ้วยรางวัล)",
        m1: "👻 โหมดผู้พิทักษ์เขาวงกต (เก็บกุญแจ 🔑 หลบผู้พิทักษ์ และใช้วาร์ป 🌀)",
        m4: "📡 โหมดหมอกปริศนา & เรดาร์ (ค้นหากุญแจ 🔑 เก็บเรดาร์ 📡 เปิดแผนที่)"
      }[age] || "";

  const index = (x, y) => y * cols + x;

  function addPopup(gx, gy, text, color = "#ffdd59") {
    popups.push({
      x: ox + (gx + 0.5) * cell,
      y: oy + gy * cell,
      text,
      color,
      life: 45,
      maxLife: 45
    });
  }

  function addParticles(gx, gy, color, count = 10) {
    const px = ox + (gx + 0.5) * cell;
    const py = oy + (gy + 0.5) * cell;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        size: 2.5 + Math.random() * 3,
        color,
        life: 18 + Math.floor(Math.random() * 14)
      });
    }
  }

  function createConfetti() {
    confetti = Array.from({ length: 60 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 180,
      y: H / 2,
      vx: (Math.random() - 0.5) * 9,
      vy: -4 - Math.random() * 5,
      color: ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"][Math.floor(Math.random() * 5)],
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    }));
  }

  function generate(stage) {
    const cells = Array.from({ length: cols * rows }, () => ({ walls: [1, 1, 1, 1], visited: false }));
    const stack = [[0, 0]];
    cells[0].visited = true;
    let seed = (stage * 65537 + game.rules.difficulty * 7919) >>> 0;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const options = [
        [x, y - 1, 0, 2],
        [x + 1, y, 1, 3],
        [x, y + 1, 2, 0],
        [x - 1, y, 3, 1]
      ].filter(([nx, ny]) => nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cells[index(nx, ny)].visited);
      if (!options.length) {
        stack.pop();
        continue;
      }
      const [nx, ny, side, opposite] = options[Math.floor(random() * options.length)];
      cells[index(x, y)].walls[side] = 0;
      cells[index(nx, ny)].walls[opposite] = 0;
      cells[index(nx, ny)].visited = true;
      stack.push([nx, ny]);
    }

    // For M1/M4, open a few extra loops so players can juke patrolling guardians!
    if (age === "m1" || age === "m4") {
      const extraLoops = age === "m4" ? 6 : 4;
      for (let i = 0; i < extraLoops; i++) {
        const rx = 1 + Math.floor(random() * (cols - 2));
        const ry = 1 + Math.floor(random() * (rows - 2));
        const dir = Math.floor(random() * 2); // 0=top, 1=right
        if (dir === 0 && ry > 0) {
          cells[index(rx, ry)].walls[0] = 0;
          cells[index(rx, ry - 1)].walls[2] = 0;
        } else if (dir === 1 && rx < cols - 1) {
          cells[index(rx, ry)].walls[1] = 0;
          cells[index(rx + 1, ry)].walls[3] = 0;
        }
      }
    }

    return cells;
  }

  function solveShortestPath() {
    const q = [[[0, 0]]];
    const seen = new Set(["0,0"]);
    const dirs = [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]];
    while (q.length) {
      const path = q.shift();
      const [cx, cy] = path[path.length - 1];
      if (cx === cols - 1 && cy === rows - 1) return path;
      const w = grid[index(cx, cy)].walls;
      for (const [dx, dy, wallIdx] of dirs) {
        if (w[wallIdx] === 0) {
          const nx = cx + dx, ny = cy + dy;
          const k = `${nx},${ny}`;
          if (!seen.has(k)) {
            seen.add(k);
            q.push([...path, [nx, ny]]);
          }
        }
      }
    }
    return [[0, 0], [cols - 1, rows - 1]];
  }

  function startStage() {
    grid = generate(level);
    solutionPath = solveShortestPath();
    player = { x: 0, y: 0 };
    renderPos = { x: 0, y: 0 };
    visitedPath = new Set(["0,0"]);
    phase = "playing";
    invulnerable = 45;
    radarTimer = age === "m4" ? 120 : 0; // Give M4 a brief initial radar glimpse!
    freezeTimer = 0;

    // Populate Gems / Stars along the path
    gems = [];
    const gemCount = age === "p1" ? 3 : 4;
    for (let i = 1; i <= gemCount; i++) {
      const idx = Math.min(solutionPath.length - 2, Math.max(1, Math.floor((solutionPath.length * i) / (gemCount + 1))));
      const [gx, gy] = solutionPath[idx];
      if ((gx !== 0 || gy !== 0) && (gx !== cols - 1 || gy !== rows - 1)) {
        gems.push({ x: gx, y: gy, taken: false });
      }
    }

    // Key & Locked Gate for P4, M1, M4 (and P1 Hard Mode!)
    if (age === "p1" && !isHardP1) {
      hasKey = true;
      keyItem = null;
    } else {
      hasKey = false;
      // Place key in a corner or mid-branch away from start/goal
      const kx = Math.max(1, Math.min(cols - 2, Math.floor(cols * 0.35)));
      const ky = Math.max(1, Math.min(rows - 2, rows - 1 - Math.floor(rows * 0.25)));
      keyItem = { x: kx, y: ky, taken: false };
    }

    // Teleport Portals (🌀) for P4, M1, M4 (and P1 Hard Mode!)
    portals = [];
    if ((age !== "p1" || isHardP1) && cols >= 9) {
      portals = [
        { x: 1, y: rows - 1, targetX: cols - 2, targetY: 1, cooldown: 0 },
        { x: cols - 2, y: 1, targetX: 1, targetY: rows - 1, cooldown: 0 }
      ];
    }

    // Special Orbs (❄️ Freeze / 📡 Radar / ⏱️ Time Bonus)
    powerOrbs = [];
    if (age === "m1" || isBossP1 || isHardP4) {
      powerOrbs.push({ x: Math.floor(cols / 2), y: Math.floor(rows / 2), kind: "freeze", taken: false });
    }
    if (hasFog) {
      powerOrbs.push({ x: Math.max(1, Math.floor(cols / 3)), y: Math.floor(rows / 2), kind: "radar", taken: false });
      powerOrbs.push({ x: cols - 3, y: Math.floor(rows / 2), kind: "time", taken: false });
    }

    // Patrolling Guardians for M1, M4 (and P1 Boss / P4 Hard Mode!)
    guards = [];
    if (age === "m1" || age === "m4" || isBossP1 || isHardP4) {
      const guardCount = isNightmareM4
        ? Math.min(4, 2 + level)
        : age === "m4" || isBossM1
        ? Math.min(3, 1 + level)
        : isBossP1 || isHardP4
        ? Math.min(2, level)
        : Math.min(2, level);
      for (let i = 0; i < guardCount; i++) {
        const gx = Math.min(cols - 2, Math.max(3, Math.floor(((i + 1) * cols) / (guardCount + 1))));
        const gy = Math.min(rows - 2, Math.max(1, (i % 2 === 0) ? Math.floor(rows / 2) : rows - 2));
        guards.push({
          x: gx,
          y: gy,
          rx: gx,
          ry: gy,
          lastDir: -1,
          stepTick: 0
        });
      }
    }

    onStatus("เขาวงกตด่าน " + level);
  }

  function restart() {
    level = 1;
    frame = 0;
    score = 0;
    stepsCount = 0;
    lives = game.player?.lives || 3;
    timeLeft = timeLimit;
    confetti = [];
    particles = [];
    popups = [];
    startStage();
  }

  function stepGuardians() {
    if (phase !== "playing" || freezeTimer > 0) return;
    const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    for (const g of guards) {
      const w = grid[index(g.x, g.y)].walls;
      const open = dirs.filter(([, , wallIdx]) => w[wallIdx] === 0);
      if (!open.length) continue;
      // Prefer not immediately reversing unless dead end
      const forward = open.filter(([, , wallIdx, opp]) => opp !== g.lastDir);
      const pool = forward.length > 0 ? forward : open;
      const choice = pool[(frame + g.x * 7 + g.y * 13) % pool.length];
      g.x += choice[0];
      g.y += choice[1];
      g.lastDir = choice[2];
    }
    checkGuardCollision();
  }

  function checkGuardCollision() {
    if (invulnerable > 0 || freezeTimer > 0) return;
    for (const g of guards) {
      if (g.x === player.x && g.y === player.y) {
        lives--;
        sound.playHit();
        addParticles(player.x, player.y, "#ff4757", 14);
        addPopup(player.x, player.y, "👻 ชนผู้พิทักษ์! -1 ชีวิต", "#ff6b6b");
        invulnerable = 75;
        player.x = 0;
        player.y = 0;
        if (lives <= 0) {
          phase = "lost";
          sound.playLose();
          onStatus("แพ้แล้ว — ชีวิตหมด!");
        }
        return;
      }
    }
  }

  function move(direction) {
    if (phase !== "playing") return;
    const directions = { up: [0, -1, 0], right: [1, 0, 1], down: [0, 1, 2], left: [-1, 0, 3] };
    const d = directions[direction];
    if (!d) return;
    const [dx, dy, wall] = d;
    if (grid[index(player.x, player.y)].walls[wall]) return;

    player.x += dx;
    player.y += dy;
    stepsCount++;
    visitedPath.add(`${player.x},${player.y}`);
    sound.playClick();

    // Check Gems
    for (const gem of gems) {
      if (!gem.taken && gem.x === player.x && gem.y === player.y) {
        gem.taken = true;
        score += 2;
        sound.playCollect();
        addParticles(player.x, player.y, "#ffdd59", 10);
        addPopup(player.x, player.y, age === "p1" ? "⭐ เยี่ยมมาก! +2" : "💎 โบนัส +2", "#ffdd59");
      }
    }

    // Check Key
    if (keyItem && !keyItem.taken && keyItem.x === player.x && keyItem.y === player.y) {
      keyItem.taken = true;
      hasKey = true;
      score += 3;
      sound.playPowerUp();
      addParticles(player.x, player.y, "#feca57", 16);
      addPopup(player.x, player.y, "🔑 ได้กุญแจแล้ว! ประตูเปิด!", "#feca57");
    }

    // Check Power Orbs
    for (const orb of powerOrbs) {
      if (!orb.taken && orb.x === player.x && orb.y === player.y) {
        orb.taken = true;
        sound.playPowerUp();
        addParticles(player.x, player.y, "#48dbfb", 14);
        if (orb.kind === "freeze") {
          freezeTimer = 240; // 4 seconds
          addPopup(player.x, player.y, "❄️ หยุดผู้พิทักษ์ 4 วินาที!", "#48dbfb");
        } else if (orb.kind === "radar") {
          radarTimer = 360; // 6 seconds
          addPopup(player.x, player.y, "📡 เรดาร์เปิดแผนที่!", "#1dd1a1");
        } else if (orb.kind === "time") {
          timeLeft += 8;
          addPopup(player.x, player.y, "⏱️ เพิ่มเวลา +8 วินาที!", "#feca57");
        }
      }
    }

    // Check Warp Portals
    for (const p of portals) {
      if (p.cooldown === 0 && p.x === player.x && p.y === player.y) {
        player.x = p.targetX;
        player.y = p.targetY;
        visitedPath.add(`${player.x},${player.y}`);
        for (const pt of portals) pt.cooldown = 30;
        sound.playPortal();
        addParticles(player.x, player.y, "#a55eea", 14);
        addPopup(player.x, player.y, "🌀 วาร์ปข้ามมิติ!", "#d2a8ff");
        break;
      }
    }

    checkGuardCollision();

    // Check Goal Exit
    if (player.x === cols - 1 && player.y === rows - 1) {
      if (!hasKey) {
        sound.playHit();
        addPopup(player.x, player.y, "🔒 ต้องเก็บกุญแจ 🔑 ก่อนนะ!", "#ff9f43");
        return;
      }
      score += 5;
      if (level >= game.rules.levels) {
        phase = "won";
        createConfetti();
        sound.playWin();
        onStatus("ชนะแล้ว! ผ่านเขาวงกตครบทุกด่าน");
      } else {
        sound.playPortal();
        addPopup(player.x, player.y, `🎉 ผ่านด่าน ${level}!`, "#2ecc71");
        level++;
        startStage();
      }
    }
  }

  function draw() {
    frame++;
    if (invulnerable > 0) invulnerable--;
    if (radarTimer > 0) radarTimer--;
    if (freezeTimer > 0) freezeTimer--;
    for (const pt of portals) if (pt.cooldown > 0) pt.cooldown--;

    // Smooth interpolation for player and guards
    renderPos.x += (player.x - renderPos.x) * 0.35;
    renderPos.y += (player.y - renderPos.y) * 0.35;
    for (const g of guards) {
      g.rx += (g.x - g.rx) * 0.25;
      g.ry += (g.y - g.ry) * 0.25;
    }

    // Step guardians periodically in M1/M4
    const guardInterval = age === "m4" ? 32 : 44;
    if (guards.length > 0 && frame % guardInterval === 0) {
      stepGuardians();
    }

    if (timeLimit > 0 && frame % 60 === 0 && timeLeft > 0) {
      timeLeft--;
      if (timeLeft <= 0 && phase === "playing") {
        phase = "lost";
        sound.playLose();
        onStatus("แพ้แล้ว — เวลาหมด!");
      }
    }

    // Theme background
    const bgColors = {
      forest: "#eafaf1",
      space: "#0b132b",
      castle: "#f4f1ea",
      ocean: "#e8f8f5"
    };
    const isDark = game.theme === "space" || age === "m4";
    ctx.fillStyle = age === "m4" ? "#0f172a" : (bgColors[game.theme] || "#f4f8ff");
    ctx.fillRect(0, 0, W, H);

    // HUD Header bar
    ctx.fillStyle = isDark ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.88)";
    ctx.fillRect(8, 5, W - 16, 30);
    ctx.fillStyle = isDark ? "#74c0fc" : "#1e3a5f";
    ctx.font = "bold 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let hud = `🧩 ด่าน ${level}/${game.rules.levels}   ⭐ ${score} แต้ม`;
    if (age !== "p1") hud += `   ${hasKey ? "🔑 เปิดแล้ว" : "🔒 หากุญแจ"}`;
    if (age === "m1" || age === "m4") hud += `   ❤️x${lives}`;
    if (timeLimit > 0) hud += `   ⏱️ ${timeLeft}s`;
    ctx.fillText(hud, 18, 20);

    // P1 Hint path dots
    if (age === "p1") {
      for (let i = 1; i < solutionPath.length - 1; i += 2) {
        const [sx, sy] = solutionPath[i];
        const px = ox + (sx + 0.5) * cell;
        const py = oy + (sy + 0.5) * cell;
        ctx.fillStyle = "rgba(241, 196, 15, 0.28)";
        ctx.beginPath();
        ctx.arc(px, py, 4 + Math.sin(frame * 0.08 + i) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Maze floor & visited footprint breadcrumbs
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = ox + x * cell, py = oy + y * cell;
        if (visitedPath.has(`${x},${y}`)) {
          ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.16)" : "rgba(52, 88, 219, 0.09)";
          ctx.fillRect(px, py, cell, cell);
          ctx.fillStyle = isDark ? "#38bdf8" : "#74c0fc";
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Maze walls
    ctx.strokeStyle = isDark ? "#476b9e" : "#2e496a";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const w = grid[index(x, y)].walls, px = ox + x * cell, py = oy + y * cell;
        if (w[0]) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py); }
        if (w[3]) { ctx.moveTo(px, py); ctx.lineTo(px, py + cell); }
        if (y === rows - 1 && w[2]) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); }
        if (x === cols - 1 && w[1]) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); }
      }
    }
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const itemFont = `${Math.round(cell * 0.56)}px system-ui`;

    // Portals (🌀)
    for (const p of portals) {
      const px = ox + (p.x + 0.5) * cell;
      const py = oy + (p.y + 0.5) * cell;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(frame * 0.06);
      ctx.font = itemFont;
      ctx.fillText("🌀", 0, 0);
      ctx.restore();
    }

    // Gems / Stars
    ctx.font = itemFont;
    for (const gem of gems) {
      if (gem.taken) continue;
      const gx = ox + (gem.x + 0.5) * cell;
      const gy = oy + (gem.y + 0.5) * cell + Math.sin(frame * 0.1 + gem.x) * 2;
      ctx.fillText(age === "p1" ? "⭐" : "💎", gx, gy);
    }

    // Power Orbs
    for (const orb of powerOrbs) {
      if (orb.taken) continue;
      const oxp = ox + (orb.x + 0.5) * cell;
      const oyp = oy + (orb.y + 0.5) * cell + Math.sin(frame * 0.12) * 2;
      ctx.fillText(orb.kind === "freeze" ? "❄️" : orb.kind === "radar" ? "📡" : "⏱️", oxp, oyp);
    }

    // Key Item (🔑)
    if (keyItem && !keyItem.taken) {
      const kx = ox + (keyItem.x + 0.5) * cell;
      const ky = oy + (keyItem.y + 0.5) * cell;
      ctx.save();
      ctx.strokeStyle = "rgba(254, 202, 87, 0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(kx, ky, cell * 0.38 + Math.sin(frame * 0.12) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `${Math.round(cell * 0.62)}px system-ui`;
      ctx.fillText("🔑", kx, ky);
      ctx.restore();
    }

    // Exit Trophy 🏆 (with Lock 🔒 if key not yet collected)
    const goalX = ox + (cols - 1) * cell + cell / 2;
    const goalY = oy + (rows - 1) * cell + cell / 2;
    ctx.font = `${Math.round(cell * 0.65)}px system-ui`;
    ctx.fillText(hasKey ? "🏆" : "🔒", goalX, goalY);

    // Patrolling Guardians (👻 / 👾)
    for (const g of guards) {
      const gx = ox + (g.rx + 0.5) * cell;
      const gy = oy + (g.ry + 0.5) * cell;
      ctx.font = `${Math.round(cell * 0.64)}px system-ui`;
      ctx.fillText(freezeTimer > 0 ? "🥶" : age === "m4" ? "👾" : "👻", gx, gy);
    }

    // Atmospheric Fog of War (dim distant tiles unless Radar is active)
    if (hasFog && radarTimer === 0 && phase === "playing") {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dist = Math.hypot(x - renderPos.x, y - renderPos.y);
          const isGoal = (x === cols - 1 && y === rows - 1);
          const isKey = (keyItem && !keyItem.taken && x === keyItem.x && y === keyItem.y);
          if (dist > 3.3 && !isGoal && !isKey) {
            const px = ox + x * cell, py = oy + y * cell;
            ctx.fillStyle = dist > 4.6 ? "rgba(10, 18, 36, 0.82)" : "rgba(10, 18, 36, 0.48)";
            ctx.fillRect(px, py, cell, cell);
          }
        }
      }
    }

    // Player Avatar 🐰 / 🐱 / 🤖
    if (invulnerable % 6 < 4) {
      const playerX = ox + (renderPos.x + 0.5) * cell;
      const playerY = oy + (renderPos.y + 0.5) * cell;
      ctx.font = `${Math.round(cell * 0.72)}px system-ui`;
      ctx.fillText(playerAvatar, playerX, playerY);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const pop = popups[i];
      pop.y -= 0.6;
      pop.life--;
      if (pop.life <= 0) {
        popups.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      ctx.font = "bold 13px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#0b132b";
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // Footer Grade Mode Banner
    if (gradeModeDesc) {
      ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.78)" : "rgba(25, 45, 75, 0.72)";
      ctx.fillRect(8, H - 23, W - 16, 19);
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(gradeModeDesc, W / 2, H - 13);
      ctx.textAlign = "left";
    }

    // Confetti on win
    if (phase === "won" && confetti.length > 0) {
      for (const p of confetti) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.rot += p.vRot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    if (phase === "won" && canvas.dataset.completionUi !== "external") {
      ctx.fillStyle = "rgba(20,35,60,.82)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "white";
      ctx.font = "bold 34px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("ชนะแล้ว! พิชิตเขาวงกตสำเร็จ 🎉", W / 2, H / 2 - 14);
      ctx.font = "18px system-ui";
      ctx.fillText(`คะแนนรวม: ${score} แต้ม (เดิน ${stepsCount} ก้าว) — กดเริ่มใหม่เพื่อเล่นอีกครั้ง`, W / 2, H / 2 + 28);
      ctx.textAlign = "left";
    } else if (phase === "lost" && canvas.dataset.completionUi !== "external") {
      ctx.fillStyle = "rgba(20,35,60,.82)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "white";
      ctx.font = "bold 34px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(lives <= 0 ? "ผู้พิทักษ์จับได้แล้ว! 👻" : "เวลาหมด! ⌛", W / 2, H / 2 - 10);
      ctx.font = "18px system-ui";
      ctx.fillText("กดเริ่มใหม่เพื่อลองอีกครั้ง", W / 2, H / 2 + 30);
      ctx.textAlign = "left";
    }
  }

  const mapping = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };
  function down(e) {
    const k = mapping[e.code];
    if (k) {
      e.preventDefault();
      if (!e.repeat) move(k);
      keys.add(k);
    }
  }
  function up(e) {
    const k = mapping[e.code];
    if (k) {
      e.preventDefault();
      keys.delete(k);
    }
  }

  function loop(time) {
    if (time - moveAt > 125) {
      for (const key of touch) { move(key); break; }
      for (const key of keys) { move(key); break; }
      moveAt = time;
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function setTouch(key, active) {
    if (active) {
      touch.add(key);
      move(key);
    } else {
      touch.delete(key);
    }
  }

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    touch.clear();
    keys.clear();
  }

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  restart();
  raf = requestAnimationFrame(loop);
  return { restart, setTouch, destroy };
}
