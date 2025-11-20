// === Rhythm Boxer — rhythm-engine.js (Neon Bloom, 3 lanes) ===

/*
  Concept:
  - 3 lanes (0=top,1=mid,2=bot)
  - notes spawn procedurally based on BPM & difficulty
  - Bloom gauge -> Fever mode (score x1.5 + glowing notes)
  - Color burst effect when hit
  - Input:
      PC: W / UpArrow = lane 0, S / Space = lane 1, X / DownArrow = lane 2
      Touch: tap lane (note handled by click on note)
*/

const LANES = [0, 1, 2];

const DIFF_CONFIG = {
  easy: {
    label: 'ง่าย',
    bpm: 90,
    spawnPerBeat: 0.75,
    lenSeconds: 60,
    perfectWindow: 0.11,
    goodWindow: 0.20
  },
  normal: {
    label: 'ปกติ',
    bpm: 110,
    spawnPerBeat: 1.0,
    lenSeconds: 70,
    perfectWindow: 0.08,
    goodWindow: 0.16
  },
  hard: {
    label: 'ยาก',
    bpm: 130,
    spawnPerBeat: 1.4,
    lenSeconds: 80,
    perfectWindow: 0.07,
    goodWindow: 0.13
  }
};

const TRACK_CONFIG = {
  warmup:  { label: 'Track 1 — Warm-up Mix', bgmId: 'bgm-warmup' },
  dance:   { label: 'Track 2 — Dance Groove', bgmId: 'bgm-dance'  },
  cooldown:{ label: 'Track 3 — Cool Down',    bgmId: 'bgm-cool'   }
};

export function initRhythmEngine(config, handlers) {
  const mode   = config.mode || 'normal';
  const diffId = config.diff || 'normal';
  const trackId = config.track || 'warmup';

  const diff   = DIFF_CONFIG[diffId] || DIFF_CONFIG.normal;
  const track  = TRACK_CONFIG[trackId] || TRACK_CONFIG.warmup;

  // DOM
  const playfield  = document.getElementById('playfield');
  const noteLayer  = document.getElementById('note-layer');
  const bloomWrap  = document.querySelector('.bloom-wrap');
  const bloomFill  = document.getElementById('bloom-fill');
  const bloomGlow  = document.getElementById('bloom-glow');
  const bloomStatus = document.getElementById('bloom-status');

  const statMode   = document.getElementById('stat-mode');
  const statDiff   = document.getElementById('stat-diff');
  const statTrack  = document.getElementById('stat-track');
  const statScore  = document.getElementById('stat-score');
  const statCombo  = document.getElementById('stat-combo');
  const statPerfect= document.getElementById('stat-perfect');
  const statMiss   = document.getElementById('stat-miss');
  const statTime   = document.getElementById('stat-time');

  const coachRole  = document.getElementById('coach-role');
  const coachText  = document.getElementById('coach-text');
  const chkPause   = document.getElementById('chk-pause');

  const bgm = document.getElementById(track.bgmId);
  const sfxHit     = document.getElementById('sfx-hit');
  const sfxPerfect = document.getElementById('sfx-perfect');
  const sfxMiss    = document.getElementById('sfx-miss');
  const sfxFever   = document.getElementById('sfx-fever');
  const sfxCombo   = document.getElementById('sfx-combo');

  // ---- Game state ----
  let notes = []; // {id, lane, time, createdAt, hit, dom}
  let nextNoteId = 1;
  let startTime = null;
  let lastTime  = 0;
  let rafId = 0;
  let running = true;
  let finished = false;

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfectCount = 0;
  let missCount = 0;

  let bloom = 0; // 0..100
  let fever = false;
  let feverStart = 0;
  let feverTotal = 0; // accumulated seconds in fever

  // spawn control
  const beatSec = 60 / diff.bpm;
  const totalLen = diff.lenSeconds;
  let spawnCursor = 0; // seconds
  let rngPhase = Math.random() * 1000;

  // stats panel
  statMode.textContent  = (mode === 'research') ? 'วิจัย' : 'ปกติ';
  statDiff.textContent  = diff.label;
  statTrack.textContent = track.label;

  coachRole.textContent = 'โค้ชจังหวะ';
  coachText.textContent = 'ฟังจังหวะให้เข้าใจก่อน แล้วค่อยเริ่มเก็บคอมโบ 🎧';

  // ---- helpers ----

  function playOne(audio) {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play();
    } catch {}
  }

  function laneToClass(lane) {
    if (lane === 0) return 'note-top';
    if (lane === 1) return 'note-mid';
    return 'note-bot';
  }

  function spawnNote(atTime) {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const id = nextNoteId++;

    const laneEls = playfield.querySelectorAll('.lane');
    const laneEl = laneEls[lane];
    const laneRect = laneEl.getBoundingClientRect();
    const pfRect   = playfield.getBoundingClientRect();

    const x = pfRect.width / 2; // center horizontally
    const yStart = pfRect.height * -0.08; // spawn above view
    const yHit   = laneEl.offsetTop + laneEl.offsetHeight - 16; // near hit-line

    const note = {
      id,
      lane,
      time: atTime,
      yStart,
      yHit,
      createdAt: atTime - 1.2, // 1.2s travel time
      hit: false,
      dom: null
    };

    const el = document.createElement('div');
    el.className = `note ${laneToClass(lane)}`;
    el.dataset.id = id;
    el.style.left = (x) + 'px';
    el.style.top  = yStart + 'px';
    el.textContent = lane === 0 ? '⬆' : (lane === 1 ? '⬤' : '⬇');

    // touch/click hit
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      handleHitAttempt(lane, nowSeconds());
    });

    noteLayer.appendChild(el);
    note.dom = el;
    notes.push(note);
  }

  function removeNote(note) {
    if (!note) return;
    if (note.dom && note.dom.parentNode) note.dom.parentNode.removeChild(note.dom);
    note.dom = null;
  }

  function gradeHit(delta) {
    const ad = Math.abs(delta);
    if (ad <= diff.perfectWindow) return 'perfect';
    if (ad <= diff.goodWindow)    return 'good';
    return 'miss';
  }

  function addBloom(amount) {
    bloom = Math.max(0, Math.min(100, bloom + amount));
    bloomFill.style.width = bloom + '%';

    if (!fever && bloom >= 100) {
      fever = true;
      feverStart = nowSeconds();
      bloomStatus.textContent = 'FEVER!';
      bloomWrap.classList.add('fever');
      playOne(sfxFever);
      coachText.textContent = 'เข้าสู่ FEVER! เก็บคอมโบให้สุดเลย 🔥';
    } else if (!fever) {
      if (bloom < 30) bloomStatus.textContent = 'WARM UP';
      else if (bloom < 70) bloomStatus.textContent = 'GROOVE ON';
      else bloomStatus.textContent = 'ALMOST FEVER';
    }
  }

  function endFever() {
    if (!fever) return;
    const now = nowSeconds();
    feverTotal += (now - feverStart);
    fever = false;
    bloom = 70; // เหลือไว้หน่อย
    bloomFill.style.width = bloom + '%';
    bloomWrap.classList.remove('fever');
    bloomStatus.textContent = 'GROOVE';
    coachText.textContent = 'หาย FEVER แล้ว แต่ยังต่อคอมโบได้นะ ✨';
  }

  function spawnBurst(x, y) {
    const b = document.createElement('div');
    b.className = 'note-hit-burst';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    noteLayer.appendChild(b);
    setTimeout(() => {
      if (b.parentNode) b.parentNode.removeChild(b);
    }, 340);
  }

  // ---- input ----

  function handleHitAttempt(lane, t) {
    if (!running) return;

    // หาโน้ต lane เดียวกันที่ยังไม่โดน และใกล้ t ที่สุด
    let best = null;
    let bestDelta = Infinity;
    for (const n of notes) {
      if (n.hit || n.lane !== lane) continue;
      const d = t - n.time;
      const ad = Math.abs(d);
      if (ad < bestDelta) {
        bestDelta = ad;
        best = n;
      }
    }
    if (!best) {
      // miss อากาศ
      missCount++;
      combo = 0;
      addBloom(-8);
      playOne(sfxMiss);
      updateStats(t);
      return;
    }

    const g = gradeHit(t - best.time);
    const nodeRect = best.dom.getBoundingClientRect();
    const pfRect   = playfield.getBoundingClientRect();
    const hitX = nodeRect.left + nodeRect.width/2 - pfRect.left;
    const hitY = nodeRect.top  + nodeRect.height/2 - pfRect.top;

    best.hit = true;
    removeNote(best);

    if (g === 'miss') {
      missCount++;
      combo = 0;
      addBloom(-10);
      playOne(sfxMiss);
    } else {
      if (g === 'perfect') {
        perfectCount++;
        score += fever ? 200 : 150;
        addBloom(8);
        playOne(sfxPerfect);
      } else {
        score += fever ? 120 : 80;
        addBloom(4);
        playOne(sfxHit);
      }
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      if (combo > 0 && combo % 20 === 0) {
        playOne(sfxCombo);
        coachText.textContent = `คอมโบ ${combo} แล้ว! รักษาจังหวะไว้ 💫`;
      }
    }

    spawnBurst(hitX, hitY);
    updateStats(t);
  }

  function keyHandler(ev) {
    const t = nowSeconds();
    let lane = null;
    switch (ev.code) {
      case 'KeyW':
      case 'ArrowUp':
        lane = 0; break;
      case 'KeyS':
      case 'Space':
        lane = 1; break;
      case 'KeyX':
      case 'ArrowDown':
        lane = 2; break;
      default:
        return;
    }
    ev.preventDefault();
    handleHitAttempt(lane, t);
  }

  document.addEventListener('keydown', keyHandler);

  // lane tap for mobile
  playfield.querySelectorAll('.lane').forEach(laneEl => {
    laneEl.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const lane = parseInt(laneEl.dataset.lane, 10);
      handleHitAttempt(lane, nowSeconds());
    });
  });

  // ---- loop ----

  function nowSeconds() {
    if (!startTime) return 0;
    return (performance.now() - startTime) / 1000;
  }

  function updateStats(t) {
    statScore.textContent   = score;
    statCombo.textContent   = combo;
    statPerfect.textContent = perfectCount;
    statMiss.textContent    = missCount;
    statTime.textContent    = t.toFixed(1) + 's';
  }

  function step(ts) {
    if (!startTime) startTime = ts;
    if (!running) {
      rafId = requestAnimationFrame(step);
      return;
    }

    const t = (ts - startTime) / 1000;
    lastTime = t;

    // spawn new notes
    while (spawnCursor < t + 2 && spawnCursor < totalLen) {
      const chance = diff.spawnPerBeat;
      if (Math.random() + (Math.sin(spawnCursor * 0.7 + rngPhase)*0.15) < chance) {
        spawnNote(spawnCursor);
      }
      spawnCursor += beatSec;
    }

    // move notes
    const pfRect = playfield.getBoundingClientRect();
    for (const n of notes) {
      if (!n.dom) continue;
      const travel = 1.2; // seconds
      const prog = (t - n.createdAt) / travel; // 0..1
      const y = n.yStart + (n.yHit - n.yStart) * prog;
      n.dom.style.top = y + 'px';

      // Fever glow
      if (fever) n.dom.classList.add('fever');
      else n.dom.classList.remove('fever');

      // auto-miss (ตกเลยจาก line)
      if (!n.hit && t - n.time > diff.goodWindow * 1.2) {
        n.hit = true;
        missCount++;
        combo = 0;
        addBloom(-10);
        playOne(sfxMiss);
        removeNote(n);
      }
    }

    // clean notes list
    notes = notes.filter(n => n.dom || !n.hit);

    // Fever decay
    if (fever) {
      addBloom(-0.12); // decay เล็กน้อยใน FEVER
      if (bloom <= 40) endFever();
    } else {
      // slow decay
      addBloom(-0.04);
    }

    updateStats(t);

    // end song
    if (t >= totalLen + 2 && !finished) {
      finished = true;
      running = false;
      if (fever) endFever();
      endGame();
    }

    rafId = requestAnimationFrame(step);
  }

  function endGame() {
    try { if (bgm) bgm.pause(); } catch {}
    document.removeEventListener('keydown', keyHandler);

    const totalTime = Math.max(totalLen, lastTime);
    const feverPercent = totalTime > 0 ? (feverTotal / totalTime) * 100 : 0;

    if (handlers && typeof handlers.onFinished === 'function') {
      handlers.onFinished({
        mode,
        modeLabel: (mode === 'research') ? 'วิจัย' : 'ปกติ',
        diff: diffId,
        diffLabel: diff.label,
        track: trackId,
        trackLabel: track.label,
        score,
        maxCombo,
        perfect: perfectCount,
        miss: missCount,
        feverPercent
      });
    }
  }

  // pause checkbox
  if (chkPause) {
    chkPause.checked = false;
    chkPause.addEventListener('change', () => {
      running = !chkPause.checked;
      if (running) {
        coachText.textContent = 'กลับเข้าจังหวะต่อได้เลย 🎶';
        try { if (bgm && bgm.paused) bgm.play(); } catch {}
      } else {
        coachText.textContent = 'พักหายใจก่อน แล้วค่อยเล่นต่อ 😌';
        try { if (bgm && !bgm.paused) bgm.pause(); } catch {}
      }
    });
  }

  // start bgm
  try {
    if (bgm) {
      bgm.currentTime = 0;
      bgm.play();
    }
  } catch {}

  // main loop
  rafId = requestAnimationFrame(step);

  // dispose
  function dispose() {
    cancelAnimationFrame(rafId);
    document.removeEventListener('keydown', keyHandler);
    notes.forEach(removeNote);
    notes = [];
    try { if (bgm) bgm.pause(); } catch {}
  }

  return { dispose };
}
