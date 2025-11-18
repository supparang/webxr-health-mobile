// === shadow-breaker.js — Emoji Targets + Boss Face + FEVER ===
'use strict';

(function () {
  const arena = document.getElementById('gameArena');
  if (!arena) return;

  const startBtn = document.getElementById('startBtn');

  const timeEl = document.getElementById('timeVal');
  const scoreEl = document.getElementById('scoreVal');
  const hitEl = document.getElementById('hitVal');
  const missEl = document.getElementById('missVal');
  const comboEl = document.getElementById('comboVal');

  const bossFaceEl = document.getElementById('bossFace');
  const bossIndexEl = document.getElementById('bossIndexVal');
  const bossHpBarEl = document.getElementById('bossHpBar');
  const coachLine = document.getElementById('coachLine');
  const flashMsg = document.getElementById('flashMsg');

  const overlay = document.getElementById('resultOverlay');
  const rScore = document.getElementById('rScore');
  const rTimeUsed = document.getElementById('rTimeUsed');
  const rMaxCombo = document.getElementById('rMaxCombo');
  const rBossCleared = document.getElementById('rBossCleared');

  const playAgainBtn = document.getElementById('playAgainBtn');
  const backBtn = document.getElementById('backBtn');

  // ---------- inject extra CSS (shake + score float + shards) ----------
  function injectCSS () {
    if (document.getElementById('sbExtraCSS')) return;
    const st = document.createElement('style');
    st.id = 'sbExtraCSS';
    st.textContent = `
      .sb-shake {
        animation: sb-shake 0.18s ease-in-out;
      }
      @keyframes sb-shake {
        0%   { transform: translate3d(0, 0, 0); }
        25%  { transform: translate3d(-3px, 2px, 0); }
        50%  { transform: translate3d(3px, -2px, 0); }
        75%  { transform: translate3d(-2px, 1px, 0); }
        100% { transform: translate3d(0, 0, 0); }
      }

      .sb-score-float {
        position:absolute;
        font-size:0.9rem;
        font-weight:700;
        color:#facc15;
        pointer-events:none;
        text-shadow:0 0 6px rgba(15,23,42,.9);
        animation: sb-score 0.6s ease-out forwards;
      }
      .sb-score-float.cold {
        color:#38bdf8;
      }
      @keyframes sb-score {
        0%   { opacity:0; transform:translate(-50%,0) scale(0.7); }
        20%  { opacity:1; transform:translate(-50%,-6px) scale(1); }
        100% { opacity:0; transform:translate(-50%,-24px) scale(0.9); }
      }

      .sb-shard {
        position:absolute;
        width:6px;height:6px;
        border-radius:999px;
        background:radial-gradient(circle,#facc15,#f97316);
        pointer-events:none;
        opacity:0.9;
        animation: sb-shard-burst 0.45s ease-out forwards;
      }
      .sb-shard.cold {
        background:radial-gradient(circle,#bae6fd,#38bdf8);
      }
      @keyframes sb-shard-burst {
        0%   { transform:translate(0,0) scale(1); opacity:0.9; }
        100% { transform:translate(var(--dx),var(--dy)) scale(0.5); opacity:0; }
      }
    `;
    document.head.appendChild(st);
  }
  injectCSS();

  // ---------- config ----------
  const bosses = [
    { nameTh: 'บอสการ์ดฟ้า',   emoji: '🟦', face: '😼' },
    { nameTh: 'บอสประกายไฟ',  emoji: '✨', face: '😎' },
    { nameTh: 'บอสสายฟ้า',    emoji: '🌩️', face: '😈' },
    { nameTh: 'บอสเงาโหด',    emoji: '🌙', face: '👾' }
  ];

  const normalEmojis = ['👊','🥊','⭐','⚡','🎯','🔥','💥'];

  const url = new URL(window.location.href);
  const mode = url.searchParams.get('mode') || 'timed';
  const diff = url.searchParams.get('diff') || 'normal';
  const timeLimit = parseInt(url.searchParams.get('time') || '90', 10);

  const diffConfig = {
    easy:   { spawn: 850, lifetime: 1200, bossHp: 40 },
    normal: { spawn: 650, lifetime: 1000, bossHp: 55 },
    hard:   { spawn: 520, lifetime: 850,  bossHp: 70 }
  };
  const cfg = diffConfig[diff] || diffConfig.normal;

  // ---------- state ----------
  let running = false;
  let timeLeft = timeLimit;
  let score = 0;
  let hits = 0;
  let misses = 0;
  let combo = 0;
  let maxCombo = 0;

  let bossIndex = 0;   // 0..3
  let bossHp = cfg.bossHp;
  let bossHpMax = cfg.bossHp;

  let spawnTimer = null;
  let countdownTimer = null;

  let fever = false;
  let feverTimeout = null;

  const activeTargets = new Set();

  // ---------- helpers ----------
  function pick (list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function updateHUD () {
    if (timeEl) timeEl.textContent = String(timeLeft);
    if (scoreEl) scoreEl.textContent = String(score);
    if (hitEl) hitEl.textContent = String(hits);
    if (missEl) missEl.textContent = String(misses);
    if (comboEl) comboEl.textContent = 'x' + combo;
  }

  function updateBossHUD () {
    const info = bosses[bossIndex] || bosses[bosses.length - 1];
    if (bossFaceEl) bossFaceEl.textContent = info.emoji;
    if (bossIndexEl) bossIndexEl.textContent = (bossIndex + 1) + '/4';
    if (bossHpBarEl) {
      const ratio = Math.max(0, Math.min(1, bossHp / bossHpMax));
      bossHpBarEl.style.transform = 'scaleX(' + ratio + ')';
    }
  }

  function setCoach (text) {
    if (coachLine) coachLine.textContent = text;
  }

  function flash (text, color) {
    if (!flashMsg) return;
    flashMsg.textContent = text;
    flashMsg.style.color = color || '#facc15';
    flashMsg.classList.remove('flash-show');
    void flashMsg.offsetWidth;
    flashMsg.classList.add('flash-show');
  }

  function screenShake (intensity) {
    const panel = arena.closest('.game-panel') || arena;
    if (!panel) return;
    panel.classList.remove('sb-shake');
    void panel.offsetWidth;
    panel.classList.add('sb-shake');
    panel.style.animationDuration = (intensity && intensity > 1 ? 0.12 + 0.05 * intensity : 0.18) + 's';
  }

  function floatScore (x, y, delta, isFever) {
    const el = document.createElement('div');
    el.className = 'sb-score-float' + (isFever ? '' : ' cold');
    el.textContent = '+' + delta;

    const rect = arena.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;
    el.style.left = localX + 'px';
    el.style.top = localY + 'px';

    arena.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function burstAt (x, y, isFever) {
    const rect = arena.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;
    const shards = 10;
    for (let i = 0; i < shards; i++) {
      const s = document.createElement('div');
      s.className = 'sb-shard' + (isFever ? '' : ' cold');
      const angle = (Math.PI * 2 * i) / shards;
      const dist = 26 + Math.random() * 18;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--dx', dx + 'px');
      s.style.setProperty('--dy', dy + 'px');
      arena.appendChild(s);
      setTimeout(() => s.remove(), 500);
    }
  }

  function startFever () {
    if (feverTimeout) clearTimeout(feverTimeout);
    fever = true;
    flash('FEVER!!', '#facc15');
    setCoach('โค้ชพุ่ง: โหมด FEVER แล้ว! ต่อเนื่องให้สุด! 🔥');
    arena.style.boxShadow = '0 0 28px rgba(250,204,21,.55)';
    feverTimeout = setTimeout(() => {
      fever = false;
      arena.style.boxShadow = '';
      setCoach('โค้ชพุ่ง: เยี่ยม! เก็บไฟลุกไปเตรียมล้มบอสตัวต่อไป! ✨');
    }, 6000);
  }

  // ---------- game lifecycle ----------
  function resetState () {
    running = false;
    timeLeft = timeLimit;
    score = 0;
    hits = 0;
    misses = 0;
    combo = 0;
    maxCombo = 0;

    bossIndex = 0;
    bossHpMax = cfg.bossHp;
    bossHp = bossHpMax;

    fever = false;
    if (feverTimeout) clearTimeout(feverTimeout);
    feverTimeout = null;
    arena.style.boxShadow = '';

    activeTargets.forEach(t => t.remove());
    activeTargets.clear();

    if (spawnTimer) clearInterval(spawnTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    spawnTimer = countdownTimer = null;

    updateHUD();
    updateBossHUD();
  }

  function startGame () {
    resetState();
    running = true;
    if (overlay) overlay.classList.remove('show');

    setCoach('โค้ชพุ่ง: แตะเป้าที่โผล่มาให้ทัน อย่าให้หลุดนะ! 💥');

    if (mode === 'timed') {
      countdownTimer = setInterval(() => {
        if (!running) return;
        timeLeft -= 1;
        if (timeLeft <= 0) {
          timeLeft = 0;
          updateHUD();
          endGame();
        } else {
          updateHUD();
        }
      }, 1000);
    } else {
      timeLeft = 0;
      updateHUD();
    }

    spawnTimer = setInterval(spawnTarget, cfg.spawn);
  }

  function endGame () {
    if (!running) return;
    running = false;

    if (spawnTimer) clearInterval(spawnTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    spawnTimer = countdownTimer = null;

    activeTargets.forEach(t => t.remove());
    activeTargets.clear();

    if (feverTimeout) clearTimeout(feverTimeout);
    feverTimeout = null;
    arena.style.boxShadow = '';

    if (rScore) rScore.textContent = String(score);

    const used = mode === 'timed' ? (timeLimit - timeLeft) : timeLeft;
    if (rTimeUsed) rTimeUsed.textContent = used + 's';
    if (rMaxCombo) rMaxCombo.textContent = 'x' + maxCombo;

    const cleared = bossIndex + (bossHp <= 0 ? 1 : 0);
    if (rBossCleared) rBossCleared.textContent = cleared + '/4';

    if (overlay) overlay.classList.add('show');

    setCoach(
      'โค้ชพุ่ง: รอบนี้ทำได้ ' +
      score +
      ' แต้ม ล้มบอสได้ ' +
      cleared +
      '/4 ตัว ลองรอบใหม่ให้โหดกว่าเดิม! 🏁'
    );
  }

  // ---------- spawn ----------
  function spawnTarget () {
    if (!running) return;

    const w = arena.clientWidth;
    const h = arena.clientHeight;
    if (!w || !h) return;

    const padding = 20;
    let size = Math.max(40, Math.min(80, w * 0.12));

    const bossPhaseThreshold = Math.max(8, Math.round(bossHpMax * 0.25));
    const isBossPhase = bossHp <= bossPhaseThreshold && bossHp > 0;
    const spawnBossFace = isBossPhase && Math.random() < 0.45;

    const x = padding + Math.random() * (w - padding * 2 - size);
    const y = padding + Math.random() * (h * 0.5);

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.alive = '1';

    let emoji;
    if (spawnBossFace) {
      size *= 1.4;
      el.dataset.type = 'boss';
      const info = bosses[bossIndex] || bosses[bosses.length - 1];
      emoji = info.face;
      el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #7c2d12)';
      el.style.border = '2px solid rgba(250,204,21,.9)';
      el.style.boxShadow = '0 0 24px rgba(250,204,21,.7)';
    } else {
      el.dataset.type = 'normal';
      emoji = pick(normalEmojis);
      el.style.background = 'radial-gradient(circle at 30% 20%, #38bdf8, #0f172a)';
      el.style.border = '2px solid rgba(148,163,184,.7)';
      el.style.boxShadow = '0 0 16px rgba(15,23,42,.9)';
    }

    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.7)';

    const inner = document.createElement('span');
    inner.textContent = emoji;
    inner.style.fontSize = (size * 0.6) + 'px';
    inner.style.pointerEvents = 'none';
    el.appendChild(inner);

    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    });

    arena.appendChild(el);
    activeTargets.add(el);

    const life = cfg.lifetime * (spawnBossFace ? 1.2 : 1);
    const missTimeout = setTimeout(() => {
      if (el.dataset.alive !== '1') return;
      el.dataset.alive = '0';
      activeTargets.delete(el);
      el.style.opacity = '0';
      el.style.transform = 'scale(0.6)';
      setTimeout(() => el.remove(), 150);

      misses += 1;
      combo = 0;
      updateHUD();
      setCoach('โค้ชพุ่ง: หลุดไปหนึ่งเป้า ลองโฟกัสให้มากขึ้น! 🎯');
    }, life);
    el.dataset.missTimeout = String(missTimeout);
  }

  // ---------- hit handling ----------
  function handleHit (target, clientX, clientY) {
    if (!running) return;
    if (target.dataset.alive !== '1') return;
    target.dataset.alive = '0';

    const missTimeout = target.dataset.missTimeout;
    if (missTimeout) clearTimeout(Number(missTimeout));

    activeTargets.delete(target);

    target.style.opacity = '0';
    target.style.transform = 'scale(0.6)';
    setTimeout(() => target.remove(), 120);

    const isBossTarget = target.dataset.type === 'boss';

    hits += 1;
    combo += 1;
    if (combo > maxCombo) maxCombo = combo;

    if (!fever && combo >= 5) {
      startFever();
    }

    let base = isBossTarget ? 250 : 100;
    base += combo * (isBossTarget ? 8 : 5);
    if (fever) base = Math.round(base * 1.7);

    score += base;

    const isFever = fever || combo >= 10;
    burstAt(clientX, clientY, isFever);
    floatScore(clientX, clientY, base, isFever);
    screenShake(isBossTarget ? 2.0 : (isFever ? 1.6 : 1.0));

    if (isBossTarget) {
      flash('บอสโดนหนัก!!', '#f97316');
      setCoach('โค้ชพุ่ง: ต่อยโดนบอสเต็ม ๆ ไปเลย! 💣');
    } else if (fever) {
      setCoach('โค้ชพุ่ง: FEVER! คอมโบ x' + combo + ' ไปต่อเลย! 🔥');
    } else if (combo % 5 === 0 && combo > 0) {
      flash('COMBO x' + combo, '#38bdf8');
      setCoach('โค้ชพุ่ง: คอมโบ x' + combo + ' สุดยอด! ✨');
    }

    let hpDamage = isBossTarget ? 3 : 1;
    bossHp -= hpDamage;
    if (bossHp <= 0) {
      bossHp = 0;
      updateBossHUD();
      flash('BOSS DOWN!', '#f97316');
      screenShake(2.4);

      bossIndex += 1;
      if (bossIndex >= bosses.length) {
        endGame();
        updateHUD();
        return;
      } else {
        setTimeout(() => {
          bossHpMax = cfg.bossHp + bossIndex * 10;
          bossHp = bossHpMax;
          updateBossHUD();
          const info = bosses[bossIndex];
          setCoach(
            'โค้ชพุ่ง: บอสตัวที่ ' +
            (bossIndex + 1) +
            ' ' +
            info.nameTh +
            ' โผล่มาแล้ว! ระวังให้ดี! 💥'
          );
        }, 350);
      }
    } else {
      updateBossHUD();
    }

    updateHUD();
  }

  function onArenaClick (ev) {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const host = target.closest('.sb-target');
    if (!host) return;
    handleHit(host, ev.clientX, ev.clientY);
  }

  arena.addEventListener('click', onArenaClick);

  // ---------- buttons ----------
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      if (!running) startGame();
    });
  }

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', function () {
      startGame();
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.location.href = 'index.html';
    });
  }

  // ---------- init ----------
  resetState();
})();
```0