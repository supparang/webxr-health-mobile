// === /fitness/js/rhythm-engine.js ===
// core rhythm engine: 3 lanes, bloom bar, fever, note falling

'use strict';

export function initRhythmEngine(hooks = {}) {
  const laneHost = document.getElementById('lane-host');
  const judgeLine = document.getElementById('judge-line');
  const bloomFill = document.getElementById('bloom-fill');
  const coachText = document.getElementById('coach-text');

  const bgmWarm  = document.getElementById('bgm-warmup');
  const bgmDance = document.getElementById('bgm-dance');
  const bgmCool  = document.getElementById('bgm-cool');

  if (laneHost) {
    laneHost.innerHTML = '';
    laneHost.style.position = 'relative';
    laneHost.style.overflow = 'hidden';
  }

  const LANES = ['low', 'mid', 'high'];
  const KEY_TO_LANE = {
    // PC
    's': 'low',
    'w': 'mid',
    'x': 'high',
    ' ': 'mid',
    'ArrowDown': 'low',
    'ArrowUp': 'high'
  };

  const TRACKS = {
    t1: { id:'t1', label:'Track 1 — Warm-up Mix',   duration: 60, bgm:'warm' },
    t2: { id:'t2', label:'Track 2 — Dance Burst',    duration: 70, bgm:'dance'},
    t3: { id:'t3', label:'Track 3 — Cool-down Flow', duration: 50, bgm:'cool' }
  };

  const SPAWN_INTERVAL = {
    easy:   800,
    normal: 550,
    hard:   380
  };

  const JUDGE_WINDOW = {
    perfect: 120,  // ms
    good:    220
  };

  const state = {
    running: false,
    track: TRACKS.t1,
    diff: 'easy',
    mode: 'normal',
    modeLabel: '',
    diffLabel: '',
    trackLabel: '',
    participantId: '',
    spawnTimer: null,
    rafId: null,
    startTime: 0,
    endTime: 0,
    elapsed: 0,
    notes: [],
    nextNoteId: 1,
    stats: {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      miss: 0,
      total: 0,
      accuracy: 0,
      remaining: 0
    },
    bloom: 0,  // 0..1
    fever: false
  };

  function resetNotes() {
    state.notes.length = 0;
    if (!laneHost) return;
    laneHost.innerHTML = '';
  }

  function stopAllBgm() {
    [bgmWarm, bgmDance, bgmCool].forEach(a => {
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    });
  }

  function playBgm(kind) {
    stopAllBgm();
    let a = null;
    if (kind === 'warm') a = bgmWarm;
    else if (kind === 'dance') a = bgmDance;
    else if (kind === 'cool') a = bgmCool;
    if (a) {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(()=>{});
    }
  }

  function updateBloom(delta) {
    state.bloom = Math.max(0, Math.min(1, state.bloom + delta));
    if (bloomFill) {
      bloomFill.style.transform = `scaleX(${state.bloom})`;
    }
  }

  function setCoach(text) {
    if (coachText) coachText.textContent = text;
  }

  function spawnNote() {
    if (!laneHost || !state.running) return;
    const rect = laneHost.getBoundingClientRect();
    const laneIndex = Math.floor(Math.random()*3); // 0..2
    const lane = LANES[laneIndex];

    const el = document.createElement('div');
    el.className = `rb-note rb-note-${lane}`;
    el.textContent = '●';

    const size = 32;
    el.style.position = 'absolute';
    el.style.width  = size+'px';
    el.style.height = size+'px';

    const laneWidth = rect.width / 3;
    const cx = laneWidth * (laneIndex + 0.5);
    const startY = -40;
    el.style.left = (cx - size/2)+'px';
    el.style.top  = startY+'px';

    const n = {
      id: state.nextNoteId++,
      lane,
      y: startY,
      speed: rect.height / 1.5,   // px/second
      hit: false,
      dom: el,
      bornAt: performance.now()
    };
    state.notes.push(n);
    laneHost.appendChild(el);
  }

  function despawnNote(i, missed) {
    const n = state.notes[i];
    if (!n) return;
    if (n.dom && n.dom.parentNode) {
      n.dom.parentNode.removeChild(n.dom);
    }
    state.notes.splice(i,1);
    if (missed) {
      state.stats.miss++;
      state.stats.combo = 0;
      updateBloom(-0.12);
    }
  }

  function loop(ts) {
    if (!state.running) return;
    if (!state.startTime) state.startTime = ts;
    state.elapsed = (ts - state.startTime) / 1000;

    const dur = state.track.duration;
    const remaining = Math.max(0, dur - state.elapsed);
    state.stats.remaining = remaining;

    const rect = laneHost ? laneHost.getBoundingClientRect() : { height: 480 };
    const judgeY = judgeLine
      ? (judgeLine.getBoundingClientRect().top - rect.top)
      : (rect.height - 80);

    const dt = 16 / 1000; // approx

    for (let i = state.notes.length - 1; i >= 0; i--) {
      const n = state.notes[i];
      if (!n) continue;
      n.y += n.speed * dt;
      if (n.dom) {
        n.dom.style.transform = `translateY(${n.y}px)`;
      }
      if (n.y > rect.height + 60) {
        // miss
        despawnNote(i, true);
      }
    }

    // call UI hook
    if (hooks.onTick) hooks.onTick({
      ...state.stats,
      remaining
    });

    if (remaining <= 0) {
      stopInternal('TIME_UP');
      return;
    }

    state.rafId = requestAnimationFrame(loop);
  }

  function handleHit(lane) {
    if (!state.running) return;
    const now = performance.now();

    const rect = laneHost ? laneHost.getBoundingClientRect() : { height: 480 };
    const judgeY = judgeLine
      ? (judgeLine.getBoundingClientRect().top - rect.top)
      : (rect.height - 80);

    // หา note ใน lane นี้ที่อยู่ใกล้เส้น judge ที่สุด
    let bestIdx = -1;
    let bestDist = 1e9;
    for (let i = 0; i < state.notes.length; i++) {
      const n = state.notes[i];
      if (n.lane !== lane) continue;
      const d = Math.abs(n.y - judgeY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) {
      // ตีลม
      updateBloom(-0.08);
      state.stats.combo = 0;
      return;
    }

    const note = state.notes[bestIdx];
    const ageMs = now - note.bornAt;
    const rectH = rect.height;
    const fallTime = (rectH + 80) / note.speed * 1000; // ms โดยประมาณ
    const hitOffset = Math.abs(ageMs - fallTime);

    let grade = 'miss';
    if (hitOffset <= JUDGE_WINDOW.perfect) grade = 'perfect';
    else if (hitOffset <= JUDGE_WINDOW.good) grade = 'good';

    if (grade === 'miss') {
      state.stats.miss++;
      state.stats.combo = 0;
      updateBloom(-0.1);
    } else {
      state.stats.total++;
      state.stats.combo++;
      if (state.stats.combo > state.stats.maxCombo) {
        state.stats.maxCombo = state.stats.combo;
      }
      if (grade === 'perfect') {
        state.stats.perfect++;
        state.stats.score += 3;
        updateBloom(+0.08);
      } else {
        state.stats.score += 2;
        updateBloom(+0.05);
      }
    }

    // acc %
    const hitCount = state.stats.perfect + (state.stats.total - state.stats.perfect);
    if (hitCount > 0) {
      state.stats.accuracy = (state.stats.perfect * 100) / hitCount;
    }

    despawnNote(bestIdx, false);
  }

  function attachInput() {
    window.addEventListener('keydown', onKeyDown);
    if (laneHost) {
      laneHost.addEventListener('pointerdown', onPointerDown);
    }
  }

  function detachInput() {
    window.removeEventListener('keydown', onKeyDown);
    if (laneHost) {
      laneHost.removeEventListener('pointerdown', onPointerDown);
    }
  }

  function onKeyDown(ev) {
    const lane = KEY_TO_LANE[ev.key];
    if (!lane) return;
    ev.preventDefault();
    handleHit(lane);
  }

  function onPointerDown(ev) {
    if (!laneHost) return;
    const rect = laneHost.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const laneWidth = rect.width / 3;
    const idx = Math.max(0, Math.min(2, Math.floor(x / laneWidth)));
    handleHit(LANES[idx]);
  }

  function stopInternal(reason) {
    if (!state.running) return;
    state.running = false;
    clearInterval(state.spawnTimer);
    state.spawnTimer = null;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;

    stopAllBgm();
    detachInput();

    state.endTime = performance.now();
    const playTime = (state.endTime - state.startTime)/1000;

    const payload = {
      ...state.stats,
      mode: state.mode,
      diff: state.diff,
      trackId: state.track.id,
      modeLabel: state.modeLabel,
      diffLabel: state.diffLabel,
      trackLabel: state.trackLabel,
      participantId: state.participantId,
      playTime,
      accuracy: state.stats.accuracy || 0,
      reason
    };

    if (hooks.onEnd) hooks.onEnd(payload);

    // reset visual
    resetNotes();
    updateBloom( -1 ); // กลับไป 0
    setCoach('ฟังจังหวะให้ชัด แล้วค่อยเริ่มเล่นอีกครั้ง 🎧');
  }

  // ---------- public API ----------
  function start(opts = {}) {
    if (!laneHost) return;

    // reset state
    resetNotes();
    state.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      miss: 0,
      total: 0,
      accuracy: 0,
      remaining: 0
    };
    state.bloom = 0;
    updateBloom(0);

    state.mode = opts.mode || 'normal';
    state.diff = opts.diff || 'easy';
    state.track = TRACKS[opts.track] || TRACKS.t1;
    state.modeLabel  = opts.modeLabel  || (state.mode === 'research' ? 'วิจัย' : 'ปกติ');
    state.diffLabel  = opts.diffLabel  || state.diff;
    state.trackLabel = opts.trackLabel || state.track.label;
    state.participantId = opts.participantId || '';

    state.startTime = performance.now();
    state.endTime   = 0;
    state.elapsed   = 0;
    state.running   = true;

    const interval = SPAWN_INTERVAL[state.diff] || 700;
    state.spawnTimer = setInterval(spawnNote, interval);
    state.rafId = requestAnimationFrame(loop);

    attachInput();

    // BGM ตาม track
    playBgm(state.track.bgm);

    if (state.track.bgm === 'warm') {
      setCoach('โค้ชจังหวะ: วอร์มอัพเบา ๆ ตามจังหวะก่อนนะ 🎧');
    } else if (state.track.bgm === 'dance') {
      setCoach('โค้ชจังหวะ: มาเต้นให้สุดเหวี่ยงกันเลย! 💃');
    } else {
      setCoach('โค้ชจังหวะ: ช่วง cool down หายใจยาว ๆ ให้จังหวะช้าลง 😊');
    }
  }

  function stop(reason) {
    stopInternal(reason || 'STOP');
  }

  return { start, stop };
}
