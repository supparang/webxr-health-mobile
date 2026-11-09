// Phase 3.0 — High-Octane Multi-Grade Dodge Engine
// Features: Near-Miss Adrenaline Bonus (⚡ เฉียดฉิว!), Power-up Capsules (🛡️ Shield, 🧲 Magnet, ❄️ Slow-Mo),
// Multi-type Obstacles (Meteors, Diagonal Comets, Zig-Zag Drones, Splitting Asteroids & Laser Locks), Wave Progression & Particles!
import { sound } from "./sound.js";

export function mountDodge(canvas, game, onStatus = () => {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas is not supported");
  const W = 720, H = 400;
  canvas.width = W; canvas.height = H;

  const age = game.ageLevel || "p4";
  const timeLimit = Number(game.rules?.timeLimit) || 0;
  const winCondition = game.rules?.winCondition || "score";

  const state = {
    x: W / 2 - 18,
    tilt: 0,
    lives: game.player.lives,
    score: 0,
    wave: 1,
    phase: "playing",
    obstacles: [],
    stars: [],
    powerUps: [],
    keys: new Set(),
    touch: new Set(),
    elapsed: 0,
    spawn: 0,
    invincible: 0,
    timeLeft: timeLimit,
    shield: age === "p1" ? 1 : 0,
    magnetTimer: 0,
    slowTimer: 0,
    combo: 0
  };

  const target = game.rules.targetScore;
  const totalWaves = Math.max(1, game.rules.levels || 1);
  const baseSpeed = (2.6 + game.rules.difficulty * 0.52) * (Number(game.rules?.enemySpeedMultiplier) || 1.0);
  const playerSpeed = Number(game.rules?.playerSpeed) || (age === "p1" ? 5.2 : 5.6);
  let raf = 0, last = 0, sequence = 0, confetti = [], particles = [], popups = [];
  const pressed = k => state.keys.has(k) || state.touch.has(k);

  const isHardP1 = age === "p1" && game.rules.difficulty >= 3;
  const isBossP1 = age === "p1" && game.rules.difficulty >= 4;

  const gradeBanner = isBossP1
    ? "👑 โหมดยากพิเศษ ป.1–ป.3 (โดรนซิกแซก 🛸 + ดาวหางเฉียง ☄️ + หลบเฉียดฉิว ⚡)"
    : isHardP1
    ? "🔥 โหมดท้าทาย ป.1–ป.3 (ดาวหางพุ่งเฉียง ☄️ + ซูเปอร์สตาร์ 🌟 + พลังพิเศษ)"
    : {
        p1: "🌟 โหมดนักบินจิ๋ว (มีสัญญาณเตือน ⚠️ + เกราะเริ่มต้น 🛡️ + เก็บดาวโบนัส ⭐)",
        p4: "🚀 โหมดตะลุยอวกาศ (ดาวหางเฉียง ☄️ + แคปซูลพลังพิเศษ 🛡️/🧲/❄️)",
        m1: "⚡ โหมดอะดรีนาลีน (หลบเฉียดฉิวได้แต้มโบนัส ⚡ + โดรนซิกแซก 🛸)",
        m4: "🔥 โหมดนรกอุกกาบาต (อุกกาบาตแตกตัว 💥 + มิสไซล์ล็อกเป้า 🎯 + คอมโบ)"
      }[age] || "";

  function addPopup(x, y, text, color = "#ffdd59") {
    popups.push({ x, y, text, color, life: 45, maxLife: 45 });
  }

  function addParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        size: 2 + Math.random() * 3.5,
        color,
        life: 18 + Math.floor(Math.random() * 14)
      });
    }
  }

  function createConfetti() {
    confetti = Array.from({ length: 65 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H / 2,
      vx: (Math.random() - 0.5) * 9,
      vy: -4 - Math.random() * 6,
      color: ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#e67e22"][Math.floor(Math.random() * 6)],
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    }));
  }

  function restart() {
    state.x = W / 2 - 18;
    state.tilt = 0;
    state.lives = game.player.lives;
    state.score = 0;
    state.wave = 1;
    state.phase = "playing";
    state.obstacles = [];
    state.stars = [];
    state.powerUps = [];
    state.elapsed = 0;
    state.spawn = 0;
    state.invincible = 0;
    state.timeLeft = timeLimit;
    state.shield = age === "p1" ? 1 : 0;
    state.magnetTimer = 0;
    state.slowTimer = 0;
    state.combo = 0;
    confetti = [];
    particles = [];
    popups = [];
    last = 0;
    sequence = 0;
    onStatus("เริ่มเกมหลบสิ่งกีดขวาง");
  }

  function step() {
    if (state.phase !== "playing") return;

    const movingLeft = pressed("left");
    const movingRight = pressed("right");
    if (movingLeft) {
      state.x -= playerSpeed;
      state.tilt = Math.max(-0.28, state.tilt - 0.05);
    } else if (movingRight) {
      state.x += playerSpeed;
      state.tilt = Math.min(0.28, state.tilt + 0.05);
    } else {
      state.tilt *= 0.8;
    }
    state.x = Math.max(8, Math.min(W - 44, state.x));

    if (state.invincible > 0) state.invincible--;
    if (state.magnetTimer > 0) state.magnetTimer--;
    if (state.slowTimer > 0) state.slowTimer--;
    state.elapsed++;

    // Wave progression based on score
    const expectedWave = Math.min(totalWaves, Math.floor((state.score / Math.max(1, target)) * totalWaves) + 1);
    if (expectedWave > state.wave) {
      state.wave = expectedWave;
      sound.playPortal();
      addPopup(W / 2, H / 2 - 40, `🌊 WAVE ${state.wave}/${totalWaves} — ความท้าทายเพิ่มขึ้น!`, "#48dbfb");
    }

    // Timer countdown
    if (timeLimit > 0 && state.elapsed % 60 === 0 && state.timeLeft > 0) {
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        if (winCondition === "survival") {
          state.phase = "won";
          createConfetti();
          sound.playWin();
          onStatus("ชนะแล้ว! เอาชีวิตรอดสำเร็จ");
          return;
        }
        state.phase = "lost";
        sound.playLose();
        onStatus("แพ้แล้ว — เวลาหมด!");
        return;
      }
    }

    // Spawn logic
    state.spawn--;
    if (state.spawn <= 0) {
      const x = 28 + ((sequence * 137 + game.rules.difficulty * 53) % (W - 76));
      const isStar = (sequence % 4 === 0);
      const isPowerUp = (sequence > 0 && sequence % 11 === 0);
      sequence++;

      if (isPowerUp) {
        const types = ["shield", "magnet", "slow"];
        state.powerUps.push({
          x,
          y: -28,
          w: 26,
          h: 26,
          kind: types[sequence % types.length]
        });
      } else if (isStar) {
        state.stars.push({
          x,
          y: -28,
          w: 24,
          h: 24,
          superStar: (sequence % 8 === 0) && (age !== "p1" || isHardP1)
        });
      } else {
        // Choose obstacle behavior based on grade level & challenge tier
        let kind = "meteor";
        let vx = 0;
        const diff = game.rules.difficulty;
        if ((age === "p4" || isHardP1) && diff < 4 && sequence % 3 === 0) {
          kind = isBossP1 && sequence % 2 === 0 ? "zigzag" : "comet";
          vx = (x < W / 2 ? 1.2 : -1.2);
        } else if (age === "m1" || (age === "p4" && diff === 4)) {
          if (sequence % 3 === 0) kind = "zigzag";
          else if (sequence % 4 === 0 && diff >= 4) kind = "seeker";
          else if (sequence % 5 === 0) { kind = "comet"; vx = (x < W / 2 ? 1.5 : -1.5); }
        } else if (age === "m4" || diff >= 5) {
          if (sequence % 4 === 0) kind = "splitter";
          else if (sequence % 3 === 0) kind = "seeker";
          else if (sequence % 2 === 0) kind = "zigzag";
        }

        state.obstacles.push({
          x,
          y: -32,
          vx,
          vy: baseSpeed * (1 + (state.wave - 1) * 0.08),
          w: kind === "splitter" ? 32 : 26,
          h: kind === "splitter" ? 32 : 26,
          kind,
          phase: sequence * 0.9,
          nearMissed: false,
          splitDone: false
        });
      }
      const waveFactor = Math.min(10, (state.wave - 1) * 3);
      state.spawn = Math.max(15, 46 - game.rules.difficulty * 5 - waveFactor);
    }

    const slowFactor = state.slowTimer > 0 ? 0.52 : 1.0;

    // Update Power-ups
    for (const pu of state.powerUps) {
      pu.y += baseSpeed * 0.78;
      if (
        pu.x < state.x + 36 &&
        pu.x + pu.w > state.x &&
        pu.y < 362 &&
        pu.y + pu.h > 318
      ) {
        pu.taken = true;
        sound.playPowerUp();
        addParticles(pu.x + 13, pu.y + 13, "#48dbfb", 15);
        if (pu.kind === "shield") {
          state.shield = Math.min(2, state.shield + 1);
          addPopup(pu.x, pu.y, "🛡️ เกราะพลังงาน!", "#48dbfb");
        } else if (pu.kind === "magnet") {
          state.magnetTimer = 360;
          addPopup(pu.x, pu.y, "🧲 แม่เหล็กดูดดาว!", "#feca57");
        } else if (pu.kind === "slow") {
          state.slowTimer = 300;
          addPopup(pu.x, pu.y, "❄️ หยุดเวลาช้าลง!", "#a29bfe");
        }
      } else if (pu.y > H) {
        pu.taken = true;
      }
    }
    state.powerUps = state.powerUps.filter(p => !p.taken);

    // Update Stars (with Magnet pull)
    const magnetRadius = state.magnetTimer > 0 ? 185 : age === "p1" ? 70 : 0;
    for (const star of state.stars) {
      star.y += baseSpeed * 0.88;
      if (magnetRadius > 0) {
        const dx = (state.x + 18) - (star.x + star.w / 2);
        const dy = 338 - (star.y + star.h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < magnetRadius && dist > 4) {
          star.x += (dx / dist) * (state.magnetTimer > 0 ? 5.2 : 2.4);
          star.y += (dy / dist) * (state.magnetTimer > 0 ? 3.0 : 1.2);
        }
      }

      if (
        star.x < state.x + 36 &&
        star.x + star.w > state.x &&
        star.y < 362 &&
        star.y + star.h > 318
      ) {
        star.taken = true;
        const pts = star.superStar ? 3 : 2;
        state.score += pts;
        state.combo++;
        sound.playCombo(state.combo);
        addParticles(star.x + 12, star.y + 12, "#ffdd59", 12);
        addPopup(star.x, star.y, star.superStar ? "🌟 ซูเปอร์สตาร์ +3!" : `⭐ +${pts}`, "#ffdd59");
      } else if (star.y > H) {
        star.taken = true;
      }
    }
    state.stars = state.stars.filter(s => !s.taken);

    // Update Obstacles
    const spawnedShards = [];
    for (const obstacle of state.obstacles) {
      obstacle.y += obstacle.vy * slowFactor;

      if (obstacle.kind === "comet") {
        obstacle.x += obstacle.vx * slowFactor;
        if (obstacle.x < 10 || obstacle.x > W - 36) obstacle.vx *= -1;
      } else if (obstacle.kind === "zigzag") {
        obstacle.x += Math.sin(state.elapsed * 0.09 + obstacle.phase) * 2.8 * slowFactor;
        obstacle.x = Math.max(10, Math.min(W - 36, obstacle.x));
      } else if (obstacle.kind === "seeker") {
        // Gently steers toward player while above y=230
        if (obstacle.y < 230) {
          const diff = (state.x + 18) - (obstacle.x + obstacle.w / 2);
          obstacle.x += Math.sign(diff) * Math.min(1.65, Math.abs(diff) * 0.04) * slowFactor;
        }
      } else if (obstacle.kind === "splitter" && !obstacle.splitDone && obstacle.y > 145) {
        obstacle.splitDone = true;
        addParticles(obstacle.x + 16, obstacle.y + 16, "#ff6b6b", 10);
        spawnedShards.push(
          { x: obstacle.x - 8, y: obstacle.y, vx: -1.8, vy: obstacle.vy * 1.05, w: 20, h: 20, kind: "comet", phase: 0, nearMissed: false },
          { x: obstacle.x + 8, y: obstacle.y, vx: 1.8, vy: obstacle.vy * 1.05, w: 20, h: 20, kind: "comet", phase: 1, nearMissed: false }
        );
        obstacle.missed = true;
        continue;
      }

      if (obstacle.y > H) {
        obstacle.missed = true;
        state.score++;
      } else if (
        state.invincible === 0 &&
        obstacle.x < state.x + 34 &&
        obstacle.x + obstacle.w > state.x + 2 &&
        obstacle.y < 358 &&
        obstacle.y + obstacle.h > 322
      ) {
        obstacle.missed = true;
        if (state.shield > 0) {
          state.shield--;
          state.invincible = 45;
          sound.playPowerUp();
          addParticles(state.x + 18, 336, "#48dbfb", 16);
          addPopup(state.x + 18, 310, "🛡️ เกราะป้องกันชน!", "#48dbfb");
        } else {
          state.lives--;
          state.combo = 0;
          sound.playHit();
          addParticles(state.x + 18, 336, "#ff4757", 16);
          addPopup(state.x + 18, 310, "💥 ชนอุกกาบาต! -1", "#ff6b6b");
          state.invincible = 65;
        }
      } else if (
        (age === "m1" || age === "m4" || isHardP1 || game.rules.difficulty >= 4) &&
        !obstacle.nearMissed &&
        state.invincible === 0 &&
        obstacle.y > 315 &&
        obstacle.y < 362 &&
        Math.abs((obstacle.x + obstacle.w / 2) - (state.x + 18)) < 44
      ) {
        // Near-miss bonus!
        obstacle.nearMissed = true;
        state.score++;
        state.combo++;
        sound.playNearMiss();
        addParticles(state.x + 18, 330, "#00d2d3", 8);
        addPopup(state.x + 18, 305, "⚡ เฉียดฉิว! +1", "#00d2d3");
      }
    }
    if (spawnedShards.length) state.obstacles.push(...spawnedShards);
    state.obstacles = state.obstacles.filter(o => !o.missed);

    // Update particles & popups
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);

    for (const pop of popups) {
      pop.y -= 0.7;
      pop.life--;
    }
    popups = popups.filter(pop => pop.life > 0);

    if (state.lives <= 0) {
      state.phase = "lost";
      sound.playLose();
      onStatus("เกมจบ — ชีวิตหมด");
    } else if (state.score >= target && winCondition !== "survival") {
      state.phase = "won";
      createConfetti();
      sound.playWin();
      onStatus("ชนะแล้ว! หลบสิ่งกีดขวางสำเร็จ");
    }
  }

  function draw() {
    // Dynamic themed space/sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (state.slowTimer > 0) {
      sky.addColorStop(0, "#1e1b4b");
      sky.addColorStop(1, "#312e81");
    } else if (game.theme === "ocean") {
      sky.addColorStop(0, "#0a3d62");
      sky.addColorStop(1, "#1e5f74");
    } else {
      sky.addColorStop(0, "#0b172a");
      sky.addColorStop(1, "#1b3358");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Scrolling parallax starfield
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 28; i++) {
      const sx = (i * 97 + 19) % W;
      const sy = (i * 53 + state.elapsed * (1 + (i % 3))) % 360;
      ctx.fillRect(sx, sy, (i % 2) + 1.5, (i % 2) + 1.5);
    }

    // Ground deck
    ctx.fillStyle = "#243b55";
    ctx.fillRect(0, 360, W, 40);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(0, 360, W, 3);

    // Warning indicators at top for incoming high obstacles (especially helpful for P1 & M4 seekers)
    for (const obs of state.obstacles) {
      if (obs.y < 45) {
        ctx.fillStyle = obs.kind === "seeker" ? "rgba(255, 71, 87, 0.85)" : "rgba(255, 165, 2, 0.75)";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(obs.kind === "seeker" ? "🎯" : "⚠️", obs.x + obs.w / 2, 48);
        if (obs.kind === "seeker") {
          ctx.strokeStyle = "rgba(255, 71, 87, 0.25)";
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.w / 2, obs.y + obs.h);
          ctx.lineTo(obs.x + obs.w / 2, 360);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    ctx.textAlign = "left";

    // Draw Power-Up Capsules
    for (const pu of state.powerUps) {
      ctx.save();
      ctx.translate(pu.x + pu.w / 2, pu.y + pu.h / 2);
      ctx.fillStyle = pu.kind === "shield" ? "rgba(72,219,251,0.3)" : pu.kind === "magnet" ? "rgba(254,202,87,0.3)" : "rgba(162,155,254,0.3)";
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pu.kind === "shield" ? "🛡️" : pu.kind === "magnet" ? "🧲" : "❄️", 0, 0);
      ctx.restore();
    }

    // Draw Collectible Bonus Stars ⭐
    for (const star of state.stars) {
      ctx.save();
      ctx.translate(star.x + star.w / 2, star.y + star.h / 2);
      ctx.rotate(state.elapsed * 0.05);
      ctx.fillStyle = star.superStar ? "#00d2d3" : "#ffdd59";
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = star.superStar ? 13 : 10;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = star.superStar ? "#ffffff" : "#ffa801";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    // Draw Obstacles (Meteors, Comets, Zig-Zag Drones, Seekers, Splitters)
    for (const obstacle of state.obstacles) {
      const cx = obstacle.x + obstacle.w / 2;
      const cy = obstacle.y + obstacle.h / 2;
      ctx.save();
      ctx.translate(cx, cy);

      if (obstacle.kind === "zigzag") {
        // Alien saucer drone 🛸
        ctx.fillStyle = "#a55eea";
        ctx.beginPath();
        ctx.ellipse(0, 2, 15, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#48dbfb";
        ctx.beginPath();
        ctx.arc(0, -2, 7, Math.PI, 0);
        ctx.fill();
      } else if (obstacle.kind === "seeker") {
        // Homing plasma missile 🎯
        ctx.fillStyle = "#ff4757";
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(-9, -10);
        ctx.lineTo(9, -10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffa502";
        ctx.beginPath();
        ctx.arc(0, -12, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fire Meteor / Splitter / Comet
        ctx.fillStyle = obstacle.kind === "splitter" ? "#eb3b5a" : obstacle.kind === "comet" ? "#38bdf8" : "#ff9b54";
        ctx.beginPath();
        ctx.arc(0, 0, obstacle.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = obstacle.kind === "comet" ? "#bae6fd" : "#d35400";
        ctx.beginPath();
        ctx.arc(-3, -2, 3.5, 0, Math.PI * 2);
        ctx.arc(4, 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Sleek Player Ship
    if (state.invincible % 8 < 4) {
      ctx.save();
      ctx.translate(state.x + 18, 340);
      ctx.rotate(state.tilt);

      // Thruster flame
      const flameH = 8 + (state.elapsed % 4) * 2;
      ctx.fillStyle = "#ff4757";
      ctx.beginPath();
      ctx.moveTo(-7, 18);
      ctx.lineTo(0, 18 + flameH);
      ctx.lineTo(7, 18);
      ctx.closePath();
      ctx.fill();

      // Wings
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-19, 16);
      ctx.lineTo(19, 16);
      ctx.closePath();
      ctx.fill();

      // Main fuselage
      ctx.fillStyle = "#5dd4ff";
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-11, 18);
      ctx.lineTo(11, 18);
      ctx.closePath();
      ctx.fill();

      // Cockpit glass
      ctx.fillStyle = "#e0f2fe";
      ctx.beginPath();
      ctx.ellipse(0, -2, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shield bubble
      if (state.shield > 0) {
        ctx.strokeStyle = "rgba(72, 219, 251, 0.9)";
        ctx.fillStyle = "rgba(72, 219, 251, 0.18)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

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
      ctx.fillStyle = "#0b172a";
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // Top HUD
    ctx.fillStyle = "rgba(10, 22, 42, 0.76)";
    ctx.fillRect(8, 5, W - 16, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const livesStr = age === "p1" ? "❤️".repeat(Math.max(0, state.lives)) : "❤️x" + state.lives;
    let hud = `คะแนน: ${state.score}/${target}   ${livesStr}   Wave: ${state.wave}/${totalWaves}`;
    if (state.shield > 0) hud += `   🛡️x${state.shield}`;
    if (state.combo >= 2) hud += `   🔥x${state.combo}`;
    if (timeLimit > 0) hud += `   ⏱️ ${state.timeLeft}s`;
    ctx.fillText(hud, 18, 21);

    // Grade mode bottom banner
    if (gradeBanner) {
      ctx.fillStyle = "rgba(10, 22, 42, 0.68)";
      ctx.fillRect(8, H - 22, W - 16, 18);
      ctx.fillStyle = "#bae6fd";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(gradeBanner, W / 2, H - 13);
      ctx.textAlign = "left";
    }

    // Confetti on win
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
      ctx.fillStyle = "rgba(0,0,0,.76)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px system-ui";
      ctx.fillText(state.phase === "won" ? "ชนะแล้ว! 🎉" : "เกมจบ", W / 2, H / 2 - 10);
      ctx.font = "18px system-ui";
      ctx.fillText(`ทำได้ ${state.score}/${target} คะแนน — กดเริ่มใหม่เพื่อเล่นอีกครั้ง`, W / 2, H / 2 + 34);
      ctx.textAlign = "left";
    }
  }

  function loop(t) {
    if (!last) last = t;
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  const map = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  // ไม่แย่งแป้นพิมพ์: ถ้ากำลังพิมพ์ในช่องข้อความ (หรือกด Ctrl/Cmd/Alt) ให้ปล่อยตามปกติ
  // หมายเหตุ: e.code คือ "ตำแหน่งปุ่มจริง" — บนคีย์บอร์ดไทย KeyW/A/S/D = ไ ฟ ห ก
  const isTypingContext = e => {
    const t = e.target;
    return e.ctrlKey || e.metaKey || e.altKey ||
      (!!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"));
  };
  function down(e) { const k = map[e.code]; if (k && !isTypingContext(e)) { e.preventDefault(); state.keys.add(k); } }
  function up(e) { const k = map[e.code]; if (k) { state.keys.delete(k); if (!isTypingContext(e)) e.preventDefault(); } }
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);

  function setTouch(k, active) {
    if (active) state.touch.add(k);
    else state.touch.delete(k);
  }

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    state.keys.clear();
    state.touch.clear();
  }

  restart();
  raf = requestAnimationFrame(loop);
  return { restart, setTouch, destroy };
}
