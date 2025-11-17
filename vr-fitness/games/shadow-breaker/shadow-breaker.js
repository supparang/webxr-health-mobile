// === VR Fitness — Shadow Breaker (Production v2) ===
// - Timed / Endless จาก query string
// - 4 Boss (HP ขึ้นตามระดับ easy/normal/hard)
// - Combo + Critical + FEVER!! (จอเขย่าแรงขึ้น)
// - รองรับ PC / Mobile / VR (click / tap / pointer)
// - ใช้คู่กับ play.html เวอร์ชันล่าสุด

(function () {
  // ---- DOM refs ----
  const arena = document.getElementById('gameArena');
  const coachLine = document.getElementById('coachLine');
  const timeVal = document.getElementById('timeVal');
  const scoreVal = document.getElementById('scoreVal');
  const comboVal = document.getElementById('comboVal');
  const bossIndexVal = document.getElementById('bossIndexVal');
  const bossFaceEl = document.getElementById('bossFace');
  const bossHpBar = document.getElementById('bossHpBar');
  const flashMsg = document.getElementById('flashMsg');
  const startBtn = document.getElementById('startBtn');

  const resultOverlay = document.getElementById('resultOverlay');
  const rScore = document.getElementById('rScore');
  const rTimeUsed = document.getElementById('rTimeUsed');
  const rMaxCombo = document.getElementById('rMaxCombo');
  const rBossCleared = document.getElementById('rBossCleared');
  const backBtn = document.getElementById('backBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  const gameShell = document.querySelector('.game-shell');

  if (!arena) {
    console.warn('[ShadowBreaker] #gameArena not found');
    return;
  }

  // ---- Config from URL ----
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'timed'; // 'timed' | 'endless'
  const diff = params.get('diff') || 'normal'; // easy | normal | hard
  const timeLimitSec = (() => {
    if (mode === 'endless') return 0; // 0 = no strict limit (มี cap ภายใน)
    const t = parseInt(params.get('time') || '90', 10);
    return isNaN(t) || t <= 0 ? 90 : t;
  })();

  // ---- Boss config ----
  const BOSS_EMOJIS = ['🟦', '🟧', '🟥', '🟣'];
  const bossHpSets = {
    easy:   [10, 14, 18, 22],
    normal: [14, 18, 24, 30],
    hard:   [18, 24, 32, 40],
  };
  const hpList = bossHpSets[diff] || bossHpSets.normal;

  // ---- Spawn config ----
  const spawnConfig = {
    easy:   { intervalMs: 900, lifetimeMs: 1300 },
    normal: { intervalMs: 750, lifetimeMs: 1150 },
    hard:   { intervalMs: 620, lifetimeMs: 1000 },
  };
  const spawnCfg = spawnConfig[diff] || spawnConfig.normal;

  // Endless cap กันเกมวิ่งไม่หยุด (นับเป็น "รันยาว")
  const ENDLESS_CAP_SEC = 300;

  // ---- State ----
  const state = {
    running: false,
    started: false,
    startTs: 0,
    elapsedSec: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    bossesCleared: 0,
    bossIndex: 0, // 0..3
    bossHp: 0,
    bossHpMax: 0,
    targets: [],
    nextId: 1,
    spawnTimer: null,
    lastFrame: 0,
    fever: false,
    feverUntil: 0,
    hitsDuringFever: 0,
  };

  // ---- Helpers ----
  function updateHUD() {
    scoreVal.textContent = state.score;
    comboVal.textContent = 'x' + state.combo;
    bossIndexVal.textContent = (state.bossIndex + 1) + '/4';
  }

  function setCoach(text) {
    if (!coachLine) return;
    coachLine.textContent = text;
  }

  function flash(text, color) {
    if (!flashMsg) return;
    flashMsg.textContent = text;
    flashMsg.style.color = color || '#facc15';
    flashMsg.classList.remove('flash-show');
    // force reflow
    void flashMsg.offsetWidth;
    flashMsg.classList.add('flash-show');
  }

  function shake(intensity) {
    if (!gameShell || !gameShell.animate) return;
    const px = intensity || 6;
    gameShell.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${px}px,0)` },
        { transform: `translate(-${px}px,0)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 120, easing: 'ease-out' }
    );
  }

  function updateBossUI() {
    if (!bossHpBar || !bossFaceEl) return;
    bossFaceEl.textContent = BOSS_EMOJIS[state.bossIndex] || '🟦';
    const ratio = state.bossHpMax > 0 ? state.bossHp / state.bossHpMax : 0;
    bossHpBar.style.transform = 'scaleX(' + Math.max(0, ratio) + ')';
  }

  function setBoss(index) {
    state.bossIndex = Math.min(Math.max(index, 0), 3);
    state.bossHpMax = hpList[state.bossIndex];
    state.bossHp = state.bossHpMax;
    updateBossUI();
    updateHUD();
  }

  function nextBoss() {
    state.bossesCleared++;
    if (state.bossIndex < 3) {
      setBoss(state.bossIndex + 1);
      flash('BOSS ' + (state.bossIndex + 1), '#f97316');
      setCoach('โค้ชพุ่ง: บอสตัวต่อไปโหดขึ้นอีก ระวังจังหวะให้ดี! 🔥');
    } else {
      // เคลียร์ครบ 4 ตัวแล้ว
      state.bossHp = 0;
      state.bossHpMax = hpList[3];
      updateBossUI();
      flash('ALL BOSS DOWN!', '#22c55e');
      setCoach('โค้ชพุ่ง: เคลียร์บอสครบทั้ง 4 ตัวแล้ว เก็บคะแนนต่อให้สุด! 🏆');
    }
  }

  function enterFever(durationMs) {
    const now = performance.now();
    state.fever = true;
    state.feverUntil = now + durationMs;
    state.hitsDuringFever = 0;
    flash('FEVER!!', '#facc15');
    if (coachLine) {
      coachLine.textContent = 'โค้ชพุ่ง: FEVER โหมด! ต่อให้ติดคอมโบยาว ๆ เลย!! ✨';
    }
    shake(10);
  }

  function checkFever(now) {
    if (state.fever && now > state.feverUntil) {
      state.fever = false;
      setCoach('โค้ชพุ่ง: จบ FEVER แล้ว ลองปั้นคอมโบใหม่อีกรอบ! 💪');
    }
  }

  // ---- Target logic ----
  function spawnTarget() {
    if (!state.running) return;
    const rect = arena.getBoundingClientRect();
    const sizeBase = rect.width < 480 ? 54 : 64;
    const size = sizeBase + (Math.random() * 18 - 9); // random +-9

    const margin = size + 10;
    const x = margin + Math.random() * Math.max(10, rect.width - margin * 2);
    const y = margin + Math.random() * Math.max(10, rect.height - margin * 2);

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(state.nextId);
    el.style.position = 'absolute';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x - size / 2 + 'px';
    el.style.top = y - size / 2 + 'px';
    el.style.borderRadius = '50%';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 0 16px rgba(15,23,42,.9)';
    el.style.userSelect = 'none';

    let bg, emoji, border;
    const r = Math.random();
    if (state.fever) {
      // FEVER target
      bg = 'radial-gradient(circle at 30% 20%,#facc15,#f97316)';
      border = '1px solid rgba(250,204,21,.9)';
      emoji = '⚡';
    } else if (r < 0.4) {
      bg = 'radial-gradient(circle at 30% 20%,#38bdf8,#0ea5e9)';
      border = '1px solid rgba(56,189,248,.9)';
      emoji = '🎯';
    } else if (r < 0.8) {
      bg = 'radial-gradient(circle at 30% 20%,#4ade80,#22c55e)';
      border = '1px solid rgba(34,197,94,.9)';
      emoji = '💥';
    } else {
      // rare critical-looking target
      bg = 'radial-gradient(circle at 30% 20%,#facc15,#f97316)';
      border = '1px solid rgba(249,115,22,.9)';
      emoji = '⭐';
    }

    el.style.background = bg;
    el.style.border = border;
    el.style.fontSize = size * 0.55 + 'px';
    el.textContent = emoji;

    arena.appendChild(el);

    const now = performance.now();
    state.targets.push({
      id: state.nextId,
      el,
      born: now,
      lifetime: spawnCfg.lifetimeMs,
      hit: false,
    });
    state.nextId++;
  }

  function cleanupTargets(now) {
    const still = [];
    for (const t of state.targets) {
      if (t.hit) {
        if (t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
        continue;
      }
      if (now - t.born > t.lifetime) {
        // miss
        if (t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
        onMiss();
        continue;
      }
      still.push(t);
    }
    state.targets = still;
  }

  function onHit(target, isCritical) {
    target.hit = true;
    if (target.el) {
      target.el.style.transform = 'scale(1.18)';
      target.el.style.opacity = '0';
      target.el.style.transition = 'transform 120ms ease-out, opacity 120ms ease-out';
      setTimeout(() => {
        if (target.el && target.el.parentNode) {
          target.el.parentNode.removeChild(target.el);
        }
      }, 130);
    }

    // combo & score
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // base score
    let add = 100;
    let text = '+100';
    let color = '#e5e7eb';

    if (state.fever || isCritical) {
      add += 80;
      text = 'CRITICAL!';
      color = '#facc15';
      shake(10);
    } else if (state.combo >= 8) {
      add += 40;
      text = 'COMBO x' + state.combo;
      color = '#22c55e';
      shake(7);
    } else if (state.combo >= 3) {
      add += 20;
      text = '+120';
      color = '#38bdf8';
      shake(6);
    } else {
      shake(4);
    }

    state.score += add;

    // FEVER logic: combo ≥ 5 → guarantee fever
    const now = performance.now();
    if (!state.fever && state.combo >= 5) {
      enterFever(5000); // 5s fever
    } else if (state.fever) {
      state.hitsDuringFever++;
    }

    // Random critical outside fever for high combo
    if (!state.fever && !isCritical && state.combo >= 7 && Math.random() < 0.2) {
      flash('CRITICAL!', '#facc15');
    } else {
      flash(text, color);
    }

    // Boss damage
    if (state.bossHp > 0) {
      const dmg = state.fever ? 2 : 1;
      state.bossHp = Math.max(0, state.bossHp - dmg);
      updateBossUI();
      if (state.bossHp === 0) {
        nextBoss();
      }
    }

    updateHUD();
    setCoach('โค้ชพุ่ง: เยี่ยมเลย รักษาคอมโบให้ได้ยาว ๆ! ✨');
  }

  function onMiss() {
    if (state.combo > 0) {
      flash('MISS', '#f87171');
      shake(6);
    }
    state.combo = 0;
    updateHUD();
    setCoach('โค้ชพุ่ง: พลาดนิดเดียว ลองโฟกัสที่เป้าถัดไปนะ 👀');
  }

  function tryHitAt(x, y) {
    if (!state.running) return;
    // หาเป้าที่อยู่ใกล้จุดคลิกที่สุด
    let best = null;
    let bestDist2 = Infinity;

    for (const t of state.targets) {
      if (t.hit || !t.el) continue;
      const rect = t.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        best = t;
      }
    }

    const HIT_RADIUS2 = 1400; // ~37px radius
    if (!best || bestDist2 > HIT_RADIUS2) {
      onMiss();
      return;
    }

    // เป็น critical ไหม (ถ้าไม่ได้อยู่ใน FEVER)
    const isCritical =
      state.fever ||
      (state.combo >= 3 && Math.random() < 0.25); // 25% ตอนคอมโบสูง

    onHit(best, isCritical);
  }

  // ---- Main Loop ----
  function loop(ts) {
    if (!state.running) return;
    if (!state.startTs) state.startTs = ts;
    const now = ts;
    state.elapsedSec = (now - state.startTs) / 1000;
    checkFever(now);

    // time HUD
    if (timeLimitSec > 0 && mode === 'timed') {
      const remain = Math.max(0, Math.ceil(timeLimitSec - state.elapsedSec));
      timeVal.textContent = remain;
      if (remain <= 0) {
        endGame();
        return;
      }
    } else {
      // endless: นับขึ้น
      const used = Math.floor(state.elapsedSec);
      timeVal.textContent = used;
      if (used >= ENDLESS_CAP_SEC) {
        endGame();
        return;
      }
    }

    cleanupTargets(performance.now());
    state.lastFrame = ts;
    requestAnimationFrame(loop);
  }

  // ---- Start / End ----
  function resetScene() {
    state.targets.forEach((t) => {
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    });
    state.targets = [];
    state.nextId = 1;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.bossesCleared = 0;
    state.elapsedSec = 0;
    state.fever = false;
    state.feverUntil = 0;
    state.hitsDuringFever = 0;
    state.startTs = 0;

    if (state.spawnTimer) {
      clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }

    updateHUD();
    setCoach('โค้ชพุ่ง: แตะเป้าให้ทัน แล้วเราจะไปล้มบอสด้วยกัน! 💥');
  }

  function startGame() {
    if (state.running) return;
    resetScene();
    state.running = true;
    resultOverlay.classList.add('hidden');
    startBtn.disabled = true;
    startBtn.style.opacity = 0.7;

    setBoss(0);
    const firstMsg =
      mode === 'timed'
        ? 'โค้ชพุ่ง: โหมดจับเวลา ' + timeLimitSec + ' วินาที พร้อมล่าบอส 4 ตัว! 🕒'
        : 'โค้ชพุ่ง: โหมดไม่กำหนดเวลา อยู่รอดให้นานที่สุด แล้วมาดูคะแนนกัน! ♾️';
    setCoach(firstMsg);

    state.spawnTimer = setInterval(spawnTarget, spawnCfg.intervalMs);
    requestAnimationFrame(loop);
  }

  function endGame() {
    if (!state.running) return;
    state.running = false;
    if (state.spawnTimer) {
      clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }
    const used = Math.floor(state.elapsedSec);
    rScore.textContent = state.score;
    rTimeUsed.textContent = used + 's';
    rMaxCombo.textContent = 'x' + state.maxCombo;
    rBossCleared.textContent = state.bossesCleared + '/4';
    resultOverlay.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.style.opacity = 1;
    setCoach('โค้ชพุ่ง: รอบนี้ทำได้ ' + state.score + ' แต้ม ลองอีกรอบให้ดีกว่าเดิม! 🏁');
  }

  // ---- Events ----
  arena.addEventListener('click', (ev) => {
    const x = ev.clientX;
    const y = ev.clientY;
    tryHitAt(x, y);
  });

  // รองรับ pointer (VR controller / stylus)
  arena.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return; // mouse ใช้ click ปกติแล้ว
    tryHitAt(ev.clientX, ev.clientY);
  });

  startBtn.addEventListener('click', startGame);

  playAgainBtn.addEventListener('click', () => {
    resultOverlay.classList.add('hidden');
    startGame();
  });

  backBtn.addEventListener('click', () => {
    // กลับไปหน้า index ของ Shadow Breaker
    location.href = './index.html';
  });

  // ป้องกันหลุดโฟกัสแล้วเกมค้างนานเกินไป
  window.addEventListener('blur', () => {
    if (!state.running) return;
    // ไม่หยุดเกม แต่หยุด spawn ชั่วคราว
    if (state.spawnTimer) {
      clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }
    setCoach('โค้ชพุ่ง: หน้าจอหลุดโฟกัส แนะนำกลับมาโฟกัสที่เกมก่อนนะ 👀');
  });

  window.addEventListener('focus', () => {
    if (!state.running) return;
    if (!state.spawnTimer) {
      state.spawnTimer = setInterval(spawnTarget, spawnCfg.intervalMs);
    }
  });

  // ---- Init first HUD ----
  resetScene();
})();