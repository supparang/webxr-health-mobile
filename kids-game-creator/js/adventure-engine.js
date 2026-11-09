// Phase 3.0 — Action-packed Multi-Grade Canvas Adventure Engine
// Features: Floating & moving platforms, bouncy mushrooms, double-jump, power-ups (Shield/Magnet/Speed),
// grade-scaled enemies (Ground patrollers, Jumping slimes, Swooping flyers, Boss enemy), combo multipliers & particles!
import { sound } from "./sound.js";

export function mountAdventure(canvas, game, onStatus = () => {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas is not supported");
  const W = 720, H = 400, ground = 350;
  canvas.width = W; canvas.height = H;

  const age = game.ageLevel || "p4";
  const timeLimit = Number(game.rules?.timeLimit) || 0;
  const winCondition = game.rules?.winCondition || "score";

  const state = {
    x: 55,
    y: ground - 38,
    vx: 0,
    vy: 0,
    score: 0,
    lives: game.player.lives,
    level: 1,
    phase: "playing",
    invulnerable: 0,
    keys: new Set(),
    touch: new Set(),
    frame: 0,
    timeLeft: timeLimit,
    jumpsLeft: 2,
    jumpLatch: false,
    combo: 0,
    comboTimer: 0,
    shield: age === "p1" ? 1 : 0,
    magnetTimer: 0,
    speedTimer: 0,
    portalOpen: false
  };

  const goal = game.rules.targetScore;
  const theme = ["forest", "space", "castle", "ocean"].includes(game.theme) ? game.theme : "forest";
  const character = ["กระต่าย", "แมว", "หมี", "หุ่นยนต์"].includes(game.player.name) ? game.player.name : "กระต่าย";
  canvas.dataset.theme = theme;
  canvas.dataset.character = character;

  let raf = 0, previous = 0, accumulator = 0;
  const levelTarget = level => Math.ceil(goal * level / game.rules.levels);
  let coins = [], enemies = [], platforms = [], springs = [], powerUps = [], hazards = [];
  let confetti = [], particles = [], popups = [];

  // Physics customization from game.rules
  const baseSpeed = Number(game.rules?.playerSpeed) || (2.9 + game.rules.difficulty * 0.32);
  const jumpImpulse = Number(game.rules?.jumpPower) || (age === "p1" ? -11.2 : -10.5);
  const gravityVal = Number(game.rules?.gravity) || 0.50;
  const enemyMultiplier = Number(game.rules?.enemySpeedMultiplier) || 1.0;
  const itemType = game.rules?.itemType || "carrot";
  const maxJumps = age === "p1" ? 2 : 2; // Double jump enabled for exciting platforming

  const isHardP1 = age === "p1" && game.rules.difficulty >= 3;
  const isBossP1 = age === "p1" && game.rules.difficulty >= 4;
  const isHardP4 = age === "p4" && game.rules.difficulty >= 4;
  const isBossP4 = age === "p4" && game.rules.difficulty >= 5;
  const isBossM1 = age === "m1" && game.rules.difficulty >= 4;
  const isNightmareM4 = age === "m4" && game.rules.difficulty >= 5;

  const gradeBadge = isNightmareM4
    ? "💀 โหมดฝันร้าย ม.4–ม.6 (ฟิสิกส์ขั้นสูง + ศัตรูความเร็วสูง + บอสคู่!)"
    : isBossM1
    ? "👑 โหมดบอส ม.1–ม.3 (แท่นเคลื่อนที่ + ศัตรูบิน + บอสประจำด่าน!)"
    : isBossP4
    ? "👑 โหมดยากพิเศษ ป.4–ป.6 (ศัตรูบิน + กับดัก + บอสประจำด่าน!)"
    : isHardP4
    ? "🔥 โหมดท้าทาย ป.4–ป.6 (แท่นเคลื่อนที่เร็ว + ศัตรูบินโฉบ!)"
    : isBossP1
    ? "👑 โหมดยากพิเศษ ป.1–ป.3 (แท่นเคลื่อนที่ + ศัตรูบิน + บอสจิ๋ว!)"
    : isHardP1
    ? "🔥 โหมดท้าทาย ป.1–ป.3 (แท่นเคลื่อนที่ + ดาวทองโบนัส + ศัตรูกระโดด!)"
    : {
        p1: "🌱 โหมดสำรวจสนุก (มีเห็ดเด้งดึ๋ง + แม่เหล็กช่วยเก็บ)",
        p4: "⚡ โหมดฮีโร่ผจญภัย (กระโดด 2 จังหวะ + พลังพิเศษ)",
        m1: "🔥 โหมดภารกิจท้าทาย (แท่นเคลื่อนที่ + ศัตรูบิน + คอมโบ)",
        m4: "👑 โหมดปรมาจารย์ (ฟิสิกส์เต็มรูปแบบ + บอสประจำด่าน)"
      }[age] || "";

  function addPopup(x, y, text, color = "#fff200") {
    popups.push({ x, y, text, color, life: 45, maxLife: 45 });
  }

  function addParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -1 - Math.random() * 4,
        size: 2.5 + Math.random() * 3.5,
        color,
        life: 20 + Math.floor(Math.random() * 15)
      });
    }
  }

  function createConfetti() {
    confetti = Array.from({ length: 70 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 220,
      y: H / 2 - 30,
      vx: (Math.random() - 0.5) * 10,
      vy: -4 - Math.random() * 6,
      color: ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#e67e22"][Math.floor(Math.random() * 6)],
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    }));
  }

  function populate() {
    const lvl = state.level;
    state.portalOpen = false;

    // 1. Platforms tailored to grade and level
    platforms = [
      { x: 130, y: 268, w: age === "p1" ? 130 : 105, h: 14, vx: 0, minX: 110, maxX: 260 },
      { x: 315, y: 208, w: age === "p1" ? 135 : 110, h: 14, vx: (age === "m1" || age === "m4" || isHardP1 || lvl >= 2) ? 1.1 : 0, minX: 250, maxX: 460 },
      { x: 515, y: 258, w: age === "p1" ? 130 : 105, h: 14, vx: (age === "m4" || isBossP1) ? -0.9 : 0, minX: 470, maxX: 600 }
    ];
    if (age === "m1" || age === "m4" || isHardP1) {
      platforms.push({ x: 185, y: 145, w: 95, h: 12, vx: 0.8, minX: 130, maxX: 350 });
    }

    // 2. Bouncy Spring Pads (🍄 เห็ดเด้งดึ๋ง)
    springs = [
      { x: 105, y: ground - 14, w: 28, h: 14, bounce: -13.8, anim: 0 }
    ];
    if (age !== "p1" || isHardP1 || lvl >= 2) {
      springs.push({ x: 475, y: ground - 14, w: 28, h: 14, bounce: -14.2, anim: 0 });
    }

    // 3. Collectible Items across ground and platforms
    const needed = Math.min(14, Math.max(4, levelTarget(lvl) - state.score + 2));
    coins = Array.from({ length: needed }, (_, i) => {
      const tier = i % 3;
      const py = tier === 0 ? ground - 28 : tier === 1 ? 236 : 174;
      const px = 125 + ((i * 52 + lvl * 29) % 545);
      const isGolden = (i === needed - 1) && (age !== "p1" || isHardP1);
      return {
        x: px,
        y: py,
        baseY: py,
        phase: i * 0.7,
        taken: false,
        value: isGolden ? 2 : 1,
        golden: isGolden
      };
    });

    // 4. Special Power-Up Orb in stage
    powerUps = [];
    const powerTypes = (age === "p1" && !isHardP1) ? ["magnet", "shield"] : ["shield", "magnet", "speed"];
    const pType = powerTypes[(lvl - 1) % powerTypes.length];
    powerUps.push({
      x: 355,
      y: 172,
      type: pType,
      taken: false
    });

    // 5. Hazards for M1/M4 (and P4 Boss Mode)
    hazards = [];
    if (age === "m1" || age === "m4" || isBossP4) {
      const spikeCount = (age === "m4" || isBossM1) ? 2 : 1;
      for (let i = 0; i < spikeCount; i++) {
        hazards.push({ x: 280 + i * 190, y: ground - 12, w: 28, h: 12 });
      }
    }

    // 6. Enemies scaled by grade and level
    const rawCount = (age === "p1" && !isHardP1)
      ? Math.min(2, game.rules.enemyCount)
      : Math.min(8, game.rules.enemyCount + Math.floor((lvl - 1) / 2));
    enemies = Array.from({ length: rawCount }, (_, i) => {
      let kind = "walker";
      if ((age === "m1" || age === "m4" || isBossP1 || isHardP4) && i % 2 === 1) kind = "flyer";
      else if ((age === "p4" || isHardP1) && i === 1) kind = "jumper";
      const hasBoss = age === "m4" || isBossP1 || isBossP4 || isBossM1;
      if (hasBoss && i === rawCount - 1 && lvl === game.rules.levels) kind = "boss";
      if (isNightmareM4 && i === rawCount - 2 && lvl === game.rules.levels) kind = "boss";

      const startY = kind === "flyer" ? 165 + (i % 2) * 45 : ground - 30;
      return {
        x: 230 + i * 95,
        y: startY,
        baseY: startY,
        vy: 0,
        dir: i % 2 ? 1 : -1,
        kind,
        phase: i * 1.3
      };
    });

    state.x = 55;
    state.y = ground - 38;
    state.vy = 0;
    state.jumpsLeft = maxJumps;
  }

  const pressed = k => state.keys.has(k) || state.touch.has(k);

  function step() {
    if (state.phase !== "playing") return;
    state.frame++;
    if (state.invulnerable > 0) state.invulnerable--;
    if (state.comboTimer > 0) {
      state.comboTimer--;
      if (state.comboTimer === 0) state.combo = 0;
    }
    if (state.magnetTimer > 0) state.magnetTimer--;
    if (state.speedTimer > 0) state.speedTimer--;

    // Timer countdown
    if (timeLimit > 0 && state.frame % 60 === 0 && state.timeLeft > 0) {
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        if (winCondition === "survival") {
          state.phase = "won";
          createConfetti();
          sound.playWin();
          onStatus("ชนะแล้ว! เอาชีวิตรอดจนหมดเวลาสำเร็จ");
          return;
        }
        state.phase = "lost";
        sound.playLose();
        onStatus("แพ้แล้ว — เวลาหมด!");
        return;
      }
    }

    // Update moving platforms
    for (const p of platforms) {
      if (p.vx !== 0) {
        p.x += p.vx;
        if (p.x < p.minX || p.x + p.w > p.maxX) p.vx *= -1;
      }
    }

    // Horizontal movement
    const activeSpeed = baseSpeed * (state.speedTimer > 0 ? 1.38 : 1.0);
    if (pressed("left")) {
      state.x -= activeSpeed;
      if (state.frame % 5 === 0 && state.speedTimer > 0) addParticles(state.x + 24, state.y + 30, "#00d2d3", 1);
    }
    if (pressed("right")) {
      state.x += activeSpeed;
      if (state.frame % 5 === 0 && state.speedTimer > 0) addParticles(state.x, state.y + 30, "#00d2d3", 1);
    }

    // Jump & Double Jump
    const wantJump = pressed("jump");
    if (wantJump && !state.jumpLatch && state.jumpsLeft > 0) {
      const isDouble = state.jumpsLeft < maxJumps && state.y < ground - 40;
      state.vy = isDouble ? jumpImpulse * 0.9 : jumpImpulse;
      state.jumpsLeft--;
      state.jumpLatch = true;
      sound.playJump();
      addParticles(state.x + 16, state.y + 34, isDouble ? "#ffdd59" : "#ffffff", isDouble ? 10 : 5);
      if (isDouble) addPopup(state.x + 16, state.y, "Double Jump! 💨", "#74c0fc");
    }
    if (!wantJump) state.jumpLatch = false;

    const prevBottom = state.y + 38;
    state.vy += gravityVal;
    state.y += state.vy;

    // Platform collisions (one-way from above)
    if (state.vy >= 0) {
      for (const p of platforms) {
        if (
          state.x + 26 > p.x &&
          state.x + 6 < p.x + p.w &&
          prevBottom <= p.y + 8 &&
          state.y + 38 >= p.y &&
          state.y + 38 <= p.y + 18
        ) {
          state.y = p.y - 38;
          state.vy = 0;
          state.jumpsLeft = maxJumps;
          state.x += p.vx;
        }
      }
    }

    // Ground collision
    if (state.y >= ground - 38) {
      state.y = ground - 38;
      state.vy = 0;
      state.jumpsLeft = maxJumps;
    }
    state.x = Math.max(0, Math.min(W - 32, state.x));

    // Spring Pads (🍄)
    for (const s of springs) {
      if (s.anim > 0) s.anim--;
      if (
        state.vy >= 0 &&
        state.x + 28 > s.x &&
        state.x + 4 < s.x + s.w &&
        state.y + 38 >= s.y - 4 &&
        state.y + 38 <= s.y + s.h + 6
      ) {
        state.vy = s.bounce;
        state.jumpsLeft = maxJumps;
        s.anim = 12;
        sound.playJump();
        addParticles(s.x + s.w / 2, s.y, "#ff6b81", 10);
        addPopup(s.x + 14, s.y - 12, "🍄 เด้งดึ๋ง!", "#ff6b81");
      }
    }

    // Collect Power-ups
    for (const pu of powerUps) {
      if (!pu.taken && Math.abs(state.x + 16 - pu.x) < 26 && Math.abs(state.y + 18 - pu.y) < 28) {
        pu.taken = true;
        sound.playPowerUp();
        addParticles(pu.x, pu.y, "#48dbfb", 14);
        if (pu.type === "shield") {
          state.shield = Math.min(2, state.shield + 1);
          addPopup(pu.x, pu.y - 10, "🛡️ เกราะคุ้มกัน!", "#48dbfb");
        } else if (pu.type === "magnet") {
          state.magnetTimer = 360;
          addPopup(pu.x, pu.y - 10, "🧲 แม่เหล็กดูดของ!", "#feca57");
        } else if (pu.type === "speed") {
          state.speedTimer = 300;
          addPopup(pu.x, pu.y - 10, "⚡ วิ่งความเร็วแสง!", "#1dd1a1");
        }
      }
    }

    // Collect Coins / Items (with Magnet effect for P1 or active magnet power-up)
    const magnetRange = state.magnetTimer > 0 ? 150 : age === "p1" ? 55 : 0;
    for (const c of coins) {
      if (c.taken) continue;
      c.y = c.baseY + Math.sin(state.frame * 0.08 + c.phase) * 4;
      const dx = (state.x + 16) - c.x;
      const dy = (state.y + 18) - c.y;
      const dist = Math.hypot(dx, dy);
      if (magnetRange > 0 && dist < magnetRange && dist > 5) {
        c.x += (dx / dist) * (state.magnetTimer > 0 ? 4.5 : 2.0);
        c.baseY += (dy / dist) * (state.magnetTimer > 0 ? 4.5 : 2.0);
      }

      if (Math.abs(state.x + 16 - c.x) < 25 && Math.abs(state.y + 18 - c.y) < 30) {
        c.taken = true;
        state.combo++;
        state.comboTimer = 135; // 2.25 sec window to keep combo alive
        const bonus = state.combo >= 3 ? 1 : 0;
        const pts = c.value + bonus;
        state.score = Math.min(goal, state.score + pts);
        if (state.combo >= 2) {
          sound.playCombo(state.combo);
          addPopup(c.x, c.y - 10, `🔥 COMBO x${state.combo}! (+${pts})`, "#ff9f43");
        } else {
          sound.playCollect();
          addPopup(c.x, c.y - 8, c.golden ? "🌟 โบนัส +2!" : `+${pts}`, c.golden ? "#feca57" : "#2ecc71");
        }
        addParticles(c.x, c.y, c.golden ? "#feca57" : "#ff9f43", 9);
      }
    }

    // Hazard spikes check
    for (const hz of hazards) {
      if (
        state.invulnerable === 0 &&
        state.x + 24 > hz.x &&
        state.x + 8 < hz.x + hz.w &&
        state.y + 38 > hz.y + 2
      ) {
        triggerPlayerHit(hz.x, hz.y);
      }
    }

    // Enemies update & collision
    for (const e of enemies) {
      const spd = (0.68 + game.rules.difficulty * 0.18 + (state.level - 1) * 0.12) * enemyMultiplier * (e.kind === "boss" ? 1.25 : 1);
      e.x += e.dir * spd;
      if (e.x < 165 || e.x > W - 38) e.dir *= -1;

      if (e.kind === "flyer") {
        e.y = e.baseY + Math.sin(state.frame * 0.06 + e.phase) * 32;
      } else if (e.kind === "jumper" || e.kind === "boss") {
        if (e.y >= ground - 30 && (state.frame + Math.floor(e.phase * 20)) % 95 === 0) {
          e.vy = e.kind === "boss" ? -8.5 : -7.2;
        }
        e.vy = (e.vy || 0) + 0.38;
        e.y = Math.min(ground - 30, e.y + e.vy);
      }

      const hitRadiusX = e.kind === "boss" ? 34 : 26;
      const hitRadiusY = e.kind === "boss" ? 36 : 30;

      if (state.invulnerable === 0 && Math.abs(state.x - e.x) < hitRadiusX && Math.abs(state.y - e.y) < hitRadiusY) {
        // Stomp check: if player is falling from above onto enemy's head!
        if (state.vy > 1.2 && state.y + 22 < e.y) {
          state.vy = -8.5;
          state.score = Math.min(goal, state.score + 1);
          sound.playCombo(3);
          addParticles(e.x + 14, e.y + 10, "#ff6b6b", 12);
          addPopup(e.x, e.y - 12, "💥 เหยียบศัตรู! +1", "#ffdd59");
          e.x = e.dir > 0 ? W - 45 : 175;
          e.dir *= -1;
        } else {
          triggerPlayerHit(e.x, e.y);
        }
      }
    }

    // Update particles & popups
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);

    for (const pop of popups) {
      pop.y -= 0.7;
      pop.life--;
    }
    popups = popups.filter(pop => pop.life > 0);

    // Check level completion
    if (state.score >= levelTarget(state.level)) {
      if (state.level >= game.rules.levels) {
        state.phase = "won";
        createConfetti();
        sound.playWin();
        onStatus("ชนะแล้ว!");
      } else {
        sound.playPortal();
        state.level++;
        addPopup(W / 2, H / 2 - 30, `🎉 ผ่านด่าน ${state.level - 1}! ลุยด่าน ${state.level} ต่อเลย!`, "#feca57");
        populate();
        onStatus("ผ่านด่าน " + (state.level - 1));
      }
    } else if (coins.every(c => c.taken)) {
      populate();
    }
  }

  function triggerPlayerHit(hx, hy) {
    if (state.shield > 0) {
      state.shield--;
      state.invulnerable = 65;
      state.vy = -6;
      sound.playPowerUp();
      addParticles(state.x + 16, state.y + 16, "#48dbfb", 14);
      addPopup(state.x + 16, state.y - 10, "🛡️ เกราะป้องกันทำงาน!", "#48dbfb");
      return;
    }
    state.lives--;
    state.combo = 0;
    sound.playHit();
    addParticles(hx, hy, "#e74c3c", 14);
    addPopup(state.x + 16, state.y - 10, "💔 -1 ชีวิต!", "#ff6b6b");
    state.invulnerable = 75;
    state.x = 55;
    state.y = ground - 38;
    state.vy = 0;
    if (state.lives <= 0) {
      state.phase = "lost";
      sound.playLose();
      onStatus("แพ้แล้ว — ลองอีกครั้ง");
    }
  }

  function cloud(x, y, scale = 1) {
    ctx.fillStyle = "rgba(255,255,255,.88)";
    for (const [dx, dy, r] of [[0,0,18],[19,-8,23],[41,0,17]]) {
      ctx.beginPath();
      ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tree(x, y, scale = 1) {
    ctx.fillStyle = "#93613f";
    ctx.fillRect(x - 7 * scale, y - 68 * scale, 14 * scale, 74 * scale);
    for (const [dx, dy, r, color] of [[0,-91,31,"#368b55"],[-20,-72,24,"#48a968"],[22,-72,25,"#3e9b60"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawItemGraphic(x, y, golden = false) {
    ctx.save();
    ctx.translate(x, y);
    if (golden) {
      ctx.shadowColor = "#feca57";
      ctx.shadowBlur = 10;
    }
    if (itemType === "star" || golden) {
      ctx.fillStyle = golden ? "#ffdd59" : "#ffcc00";
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = golden ? 13 : 11;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e6a100";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (itemType === "coin") {
      ctx.fillStyle = "#f5b041";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f9e79f";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b9770e";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", 0, 0);
    } else if (itemType === "apple") {
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.arc(-4, 0, 8, 0, Math.PI * 2);
      ctx.arc(4, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#27ae60";
      ctx.beginPath();
      ctx.ellipse(2, -9, 4, 2, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (itemType === "gem") {
      ctx.fillStyle = "#3498db";
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(9, -2);
      ctx.lineTo(0, 11);
      ctx.lineTo(-9, -2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#85c1e9";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Default carrot
      ctx.fillStyle = "#3b9950";
      ctx.beginPath();
      ctx.ellipse(-4, -10, 4, 9, -0.5, 0, Math.PI * 2);
      ctx.ellipse(4, -10, 4, 9, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fa902e";
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.quadraticCurveTo(0, -12, 10, -5);
      ctx.lineTo(0, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#cf6420";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function rabbit(x, y, frame) {
    const hop = Math.sin(frame * 0.18) * 1.2;
    ctx.save();
    ctx.translate(x + 16, y + hop);
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.ellipse(-7, -11, 6, 17, -0.13, 0, Math.PI * 2);
    ctx.ellipse(7, -11, 6, 17, 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6b5c6";
    ctx.beginPath();
    ctx.ellipse(-7, -12, 2.5, 11, -0.13, 0, Math.PI * 2);
    ctx.ellipse(7, -12, 2.5, 11, 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.ellipse(0, 19, 15, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 9, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#343b55";
    ctx.beginPath();
    ctx.arc(-5, 8, 1.8, 0, Math.PI * 2);
    ctx.arc(5, 8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e68aa2";
    ctx.beginPath();
    ctx.arc(0, 13, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.ellipse(-9, 34, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(9, 34, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function playerArtwork(x, y, frame) {
    if (character === "กระต่าย") {
      rabbit(x, y, frame);
    } else {
      ctx.save();
      ctx.translate(x + 16, y + 19 + Math.sin(frame * 0.18) * 1.2);
      const robot = character === "หุ่นยนต์", bear = character === "หมี";
      ctx.fillStyle = robot ? "#b9d7e7" : bear ? "#a9744c" : "#f4b9a1";
      ctx.beginPath();
      ctx.ellipse(0, 13, 14, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      if (robot) {
        ctx.fillRect(-14, -15, 28, 27);
        ctx.fillRect(-3, -23, 6, 8);
      } else {
        ctx.beginPath();
        if (bear) {
          ctx.arc(-12, -12, 7, 0, Math.PI * 2);
          ctx.arc(12, -12, 7, 0, Math.PI * 2);
        } else {
          ctx.moveTo(-13, -8);
          ctx.lineTo(-11, -29);
          ctx.lineTo(-1, -15);
          ctx.lineTo(1, -15);
          ctx.lineTo(11, -29);
          ctx.lineTo(13, -8);
        }
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -7, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#25344d";
      ctx.beginPath();
      ctx.arc(-5, -9, 2.2, 0, Math.PI * 2);
      ctx.arc(5, -9, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = robot ? "#367fbb" : "#7a4b4c";
      ctx.beginPath();
      ctx.arc(0, -2, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Active Shield Aura
    if (state.shield > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(72, 219, 251, 0.85)";
      ctx.fillStyle = "rgba(72, 219, 251, 0.18)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x + 16, y + 18, 25 + Math.sin(frame * 0.15) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Active Magnet Aura
    if (state.magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(254, 202, 87, 0.7)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 16, y + 18, 30, frame * 0.08, frame * 0.08 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function scenery() {
    const palette = {
      forest: ["#a7ddf9", "#e6f9ff", "#7bc67c", "#42965a"],
      space: ["#101c49", "#5268a5", "#5a6287", "#929bc2"],
      castle: ["#a6d4f4", "#e6eafa", "#9ba5ae", "#737e91"],
      ocean: ["#8ad8ee", "#d4f7ff", "#e4c88f", "#b29b6e"]
    }[theme];

    const sky = ctx.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, palette[0]);
    sky.addColorStop(1, palette[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (theme === "forest") {
      cloud(75, 67, 1); cloud(380, 84, 0.7); cloud(575, 55, 0.85);
      ctx.fillStyle = "#b7dfb2";
      ctx.beginPath();
      ctx.ellipse(155, ground + 34, 225, 112, 0, 0, Math.PI * 2);
      ctx.ellipse(525, ground + 40, 265, 124, 0, 0, Math.PI * 2);
      ctx.fill();
      tree(75, ground, 0.72); tree(670, ground, 0.85); tree(455, ground, 0.55);
    } else if (theme === "space") {
      ctx.fillStyle = "#fff7bf";
      for (let i = 0; i < 28; i++) {
        ctx.beginPath();
        ctx.arc((i * 97 + 23) % W, (i * 53 + 17) % 270, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e8b97e";
      ctx.beginPath();
      ctx.arc(565, 95, 49, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d8a36b";
      ctx.beginPath();
      ctx.arc(552, 84, 11, 0, Math.PI * 2);
      ctx.arc(583, 110, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === "castle") {
      cloud(85, 70, 0.7); cloud(510, 85, 0.8);
      ctx.fillStyle = "#71849b";
      ctx.fillRect(255, 158, 210, 192);
      ctx.fillRect(227, 126, 53, 224);
      ctx.fillRect(443, 126, 53, 224);
      ctx.fillStyle = "#dce5f1";
      for (const x of [237, 265, 453, 481]) ctx.fillRect(x, 112, 12, 21);
      ctx.fillStyle = "#3c526e";
      ctx.fillRect(343, 252, 35, 98);
    } else {
      cloud(90, 68, 0.8); cloud(530, 76, 0.7);
      ctx.fillStyle = "#3baec7";
      ctx.fillRect(0, 195, W, 155);
      ctx.strokeStyle = "#b0f3f4";
      ctx.lineWidth = 3;
      for (let y = 218; y < 320; y += 32) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) {
          const wave = y + Math.sin(x * 0.024 + y) * 5;
          x === 0 ? ctx.moveTo(x, wave) : ctx.lineTo(x, wave);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#fff2ce";
      ctx.beginPath();
      ctx.ellipse(570, 316, 130, 43, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = palette[2];
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = palette[3];
    ctx.fillRect(0, ground, W, 5);
    for (let i = 0; i < 15; i++) {
      const x = 22 + i * 51;
      ctx.fillStyle = palette[3];
      ctx.beginPath();
      ctx.ellipse(x, ground + 19, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlatformsAndProps() {
    // Platforms
    for (const p of platforms) {
      ctx.save();
      ctx.fillStyle = theme === "space" ? "#3b4d7a" : theme === "castle" ? "#6c7a89" : "#8b5a2b";
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.fillStyle = theme === "space" ? "#74c0fc" : theme === "castle" ? "#bdc3c7" : "#55b56a";
      ctx.fillRect(p.x + 2, p.y, p.w - 4, 4);
      ctx.restore();
    }

    // Spring Mushroom Pads (🍄)
    for (const s of springs) {
      ctx.save();
      const squash = s.anim > 0 ? 4 : 0;
      ctx.fillStyle = "#f5e6ca";
      ctx.fillRect(s.x + 8, s.y + 5 + squash / 2, 12, 9 - squash / 2);
      ctx.fillStyle = "#ff4757";
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + 6 + squash, s.w / 2 + 2, 8, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x + 9, s.y + 3 + squash, 2.2, 0, Math.PI * 2);
      ctx.arc(s.x + 19, s.y + 3 + squash, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Hazards (⚠️ Spikes)
    for (const hz of hazards) {
      ctx.save();
      ctx.fillStyle = "#e74c3c";
      for (let i = 0; i < 3; i++) {
        const sx = hz.x + i * 9;
        ctx.beginPath();
        ctx.moveTo(sx, ground);
        ctx.lineTo(sx + 4.5, ground - 12);
        ctx.lineTo(sx + 9, ground);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Power-up Orbs
    for (const pu of powerUps) {
      if (pu.taken) continue;
      const py = pu.y + Math.sin(state.frame * 0.1) * 5;
      ctx.save();
      ctx.translate(pu.x, py);
      ctx.fillStyle = pu.type === "shield" ? "rgba(72,219,251,0.3)" : pu.type === "magnet" ? "rgba(254,202,87,0.3)" : "rgba(29,209,161,0.3)";
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pu.type === "shield" ? "🛡️" : pu.type === "magnet" ? "🧲" : "⚡", 0, 0);
      ctx.restore();
    }
  }

  function drawEnemy(e) {
    ctx.save();
    const scale = e.kind === "boss" ? 1.38 : 1;
    ctx.translate(e.x + 14, e.y);
    ctx.scale(scale, scale);

    if (e.kind === "flyer") {
      // Flying bat / space drone
      const wing = Math.sin(state.frame * 0.35) * 6;
      ctx.fillStyle = theme === "space" ? "#9b59b6" : "#574b90";
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(-18, 2 + wing);
      ctx.lineTo(-10, 16);
      ctx.lineTo(10, 16);
      ctx.lineTo(18, 2 + wing);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff4757";
      ctx.beginPath();
      ctx.arc(-4, 10, 2, 0, Math.PI * 2);
      ctx.arc(4, 10, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Fox / Boss Fox
    ctx.fillStyle = e.kind === "boss" ? "#c0392b" : e.kind === "jumper" ? "#8e44ad" : "#d96e42";
    ctx.beginPath();
    ctx.moveTo(-13, 13);
    ctx.lineTo(-11, -4);
    ctx.lineTo(-3, 4);
    ctx.lineTo(3, 4);
    ctx.lineTo(11, -4);
    ctx.lineTo(13, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = e.kind === "boss" ? "#e74c3c" : e.kind === "jumper" ? "#9b59b6" : "#e88a4b";
    ctx.beginPath();
    ctx.ellipse(0, 19, 14, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1d9";
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(0, 27);
    ctx.lineTo(10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#342f36";
    ctx.beginPath();
    ctx.arc(-5, 12, 2, 0, Math.PI * 2);
    ctx.arc(5, 12, 2, 0, Math.PI * 2);
    ctx.arc(0, 21, 2, 0, Math.PI * 2);
    ctx.fill();
    if (e.kind === "boss") {
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("👑", 0, -6);
    }
    ctx.restore();
  }

  function draw() {
    scenery();
    drawPlatformsAndProps();
    for (const c of coins) if (!c.taken) drawItemGraphic(c.x, c.y, c.golden);
    for (const e of enemies) drawEnemy(e);
    if (state.invulnerable % 8 < 4) playerArtwork(state.x, state.y, state.frame);

    // Particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating Popups
    for (const pop of popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#101c49";
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // Multi-grade HUD
    ctx.fillStyle = "rgba(10, 25, 45, 0.72)";
    ctx.fillRect(8, 6, W - 16, 34);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const livesStr = age === "p1" ? "❤️".repeat(Math.max(0, state.lives)) : "❤️x" + state.lives;
    let hudText = `คะแนน: ${state.score}/${goal}   ${livesStr}   ด่าน: ${state.level}/${game.rules.levels}`;
    if (state.shield > 0) hudText += `   🛡️x${state.shield}`;
    if (state.combo >= 2) hudText += `   🔥x${state.combo}`;
    if (timeLimit > 0) hudText += `   ⏱️ ${state.timeLeft}s`;
    ctx.fillText(hudText, 18, 23);

    // Grade hint footer pill
    if (gradeBadge) {
      ctx.fillStyle = "rgba(10, 25, 45, 0.55)";
      ctx.fillRect(8, H - 24, W - 16, 20);
      ctx.fillStyle = "#e2eeff";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${gradeBadge}  |  💡 เหยียบหัวศัตรูได้แต้มโบนัส!`, W / 2, H - 14);
      ctx.textAlign = "left";
    }

    // Confetti particles on win
    if (state.phase === "won" && confetti.length > 0) {
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

    if (state.phase !== "playing" && canvas.dataset.completionUi !== "external") {
      ctx.fillStyle = "rgba(10,25,45,.78)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "bold 36px system-ui";
      ctx.fillText(state.phase === "won" ? "ชนะแล้ว! 🎉" : "เกมจบ", W / 2, H / 2 - 10);
      ctx.font = "18px system-ui";
      ctx.fillText(`คะแนนที่ทำได้: ${state.score}/${goal} แต้ม — กด เริ่มใหม่ เพื่อเล่นอีกครั้ง`, W / 2, H / 2 + 34);
      ctx.textAlign = "left";
    }
  }

  function loop(timestamp) {
    if (!previous) previous = timestamp;
    accumulator += Math.min(50, timestamp - previous);
    previous = timestamp;
    while (accumulator >= 1000 / 60) {
      step();
      accumulator -= 1000 / 60;
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  const keyMap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "jump", ArrowUp: "jump", KeyW: "jump" };
  // ไม่แย่งแป้นพิมพ์: ถ้ากำลังพิมพ์ในช่องข้อความ (หรือกด Ctrl/Cmd/Alt) ให้ปล่อยตามปกติ
  // หมายเหตุ: e.code คือ "ตำแหน่งปุ่มจริง" — บนคีย์บอร์ดไทย KeyW/A/S/D = ไ ฟ ห ก
  const isTypingContext = e => {
    const t = e.target;
    return e.ctrlKey || e.metaKey || e.altKey ||
      (!!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"));
  };
  function down(e) { const k = keyMap[e.code]; if (k && !isTypingContext(e)) { e.preventDefault(); state.keys.add(k); } }
  function up(e) { const k = keyMap[e.code]; if (k) { state.keys.delete(k); if (!isTypingContext(e)) e.preventDefault(); } }
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);

  function restart() {
    state.score = 0;
    state.lives = game.player.lives;
    state.level = 1;
    state.phase = "playing";
    state.invulnerable = 0;
    state.keys.clear();
    state.touch.clear();
    state.frame = 0;
    state.timeLeft = timeLimit;
    state.combo = 0;
    state.comboTimer = 0;
    state.shield = age === "p1" ? 1 : 0;
    state.magnetTimer = 0;
    state.speedTimer = 0;
    confetti = [];
    particles = [];
    popups = [];
    previous = 0;
    accumulator = 0;
    populate();
    onStatus("เริ่มเกมแล้ว");
  }

  function setTouch(key, active) {
    if (active) state.touch.add(key);
    else state.touch.delete(key);
  }

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    state.keys.clear();
    state.touch.clear();
  }

  populate();
  raf = requestAnimationFrame(loop);
  return { restart, setTouch, destroy };
}
