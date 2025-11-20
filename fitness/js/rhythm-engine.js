// === Rhythm Boxer — DOM-based 3-lane engine (2025-11-20) ===
'use strict';

// เวลาโน้ตไหลจากบนสุดถึงเส้นเป้า (วินาที)
const APPROACH_TIME = 1.1;

// hit window (วินาที)
const HIT_WINDOW_PERFECT = 0.12;
const HIT_WINDOW_GOOD    = 0.28;
const HIT_WINDOW_MISS    = 0.40;

// track config ตัวอย่าง (ใช้ร่วมกับ rhythm-boxer.html ปัจจุบัน)
const TRACKS = {
  warmup: {
    id: 'warmup',
    name: 'Track 1 — Warm-up Mix (วอร์มอัพเบา ๆ)',
    duration: 60,              // วินาที
    bpm: 96,
    densityEasy:   [0.55, 0.35, 0.45],
    densityNormal: [0.75, 0.45, 0.60],
    densityHard:   [0.90, 0.65, 0.85]
  }
};

let state = null;
let rafId = null;

// ------------ helpers ------------
function $(sel) { return document.querySelector(sel); }

function playAudio(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    void el.play();
  } catch (e) {}
}

function stopAudio(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try { el.pause(); } catch(e) {}
}

function setView(viewMenu, viewPlay, viewResult, target) {
  viewMenu.classList.toggle('hidden', target !== 'menu');
  viewPlay.classList.toggle('hidden', target !== 'play');
  viewResult.classList.toggle('hidden', target !== 'result');
}

// ---------- note density ----------

function pickDensity(track, diff) {
  if (diff === 'easy')   return track.densityEasy;
  if (diff === 'hard')   return track.densityHard;
  return track.densityNormal;
}

// *** ฟังก์ชันนี้คือจุดที่ปรับ ไม่ให้โน้ตมา 3 เลนพร้อมกันตลอด ***
function generateNotesForTrack(track, diff) {
  const notes = [];
  const beat = 60 / track.bpm;
  const densities = pickDensity(track, diff);

  const startOffset = 2.0;
  const endTime = track.duration - 1.0;

  const maxSimul =
    diff === 'easy'   ? 1 :
    diff === 'normal' ? 2 :
                        3;   // hard อนุญาต 3 เลน

  const chordBias =
    diff === 'easy'   ? 0.05 :
    diff === 'normal' ? 0.25 :
                        0.5; // hard มีโอกาส chord มากสุด

  let t = startOffset;

  while (t < endTime) {
    const candidates = [];

    // ดูว่าแต่ละเลนอยากออกโน้ตมั้ย
    for (let lane = 0; lane < 3; lane++) {
      if (Math.random() < densities[lane]) {
        candidates.push(lane);
      }
    }

    if (candidates.length > 0) {
      let lanesToUse = [...candidates];

      // จำกัดไม่ให้เกิน maxSimul
      while (lanesToUse.length > maxSimul) {
        const idx = Math.floor(Math.random() * lanesToUse.length);
        lanesToUse.splice(idx, 1);
      }

      // easy / normal → ลดโอกาส chord อีกชั้น
      if (lanesToUse.length > 1 && Math.random() > chordBias && diff !== 'hard') {
        const onlyOne = lanesToUse[Math.floor(Math.random() * lanesToUse.length)];
        lanesToUse = [onlyOne];
      }

      // สร้างโน้ตจริง
      for (const lane of lanesToUse) {
        notes.push({
          id: notes.length,
          lane,
          time: t,
          spawned: false,
          hit: false,
          el: null
        });
      }
    }

    t += beat;
  }

  notes.sort((a, b) => a.time - b.time);
  return notes;
}

// ---------- create DOM note ----------

function createNoteElement(note) {
  const el = document.createElement('div');
  el.className = 'rb-note lane-' + note.lane;
  el.innerHTML = `
    <div class="rb-note-glow"></div>
    <div class="rb-note-core">🎵</div>
  `;
  return el;
}

// ---------- core game control ----------

function startGame(options) {
  const {
    mode,
    diff,
    trackId,
    participantId,
    participantGroup
  } = options;

  const track = TRACKS[trackId] || TRACKS.warmup;
  const notes = generateNotesForTrack(track, diff);

  const viewPlay = $('#view-play');
  const playArea = $('#play-area');
  const judgeLine = $('#judge-line');

  const playRect = playArea.getBoundingClientRect();
  const judgeRect = judgeLine.getBoundingClientRect();

  const laneXs = [
    playRect.width * 0.2,
    playRect.width * 0.5,
    playRect.width * 0.8
  ];

  const judgeY = judgeRect.top - playRect.top;
  const spawnY = -40;

  state = {
    mode,
    diff,
    track,
    participantId,
    participantGroup,

    startTime: null,
    elapsed: 0,
    songTime: 0,

    notes,
    activeNotes: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    miss: 0,
    totalHits: 0,

    bloom: 0,
    bloomAccum: 0,
    bloomSamples: 0,

    finished: false,
    playArea,
    laneXs,
    judgeY,
    spawnY,
    lastFrameTime: 0
  };

  // reset play area DOM
  state.playArea.innerHTML = `
    <div class="rb-lane-bg lane-0"></div>
    <div class="rb-lane-bg lane-1"></div>
    <div class="rb-lane-bg lane-2"></div>
    <div class="rb-judge-line" id="judge-line">
      <div class="rb-judge-dot left"></div>
      <div class="rb-judge-dot center"></div>
      <div class="rb-judge-dot right"></div>
    </div>
  `;

  $('#stat-mode').textContent = mode === 'research' ? 'วิจัย' : 'ปกติ';
  $('#stat-diff').textContent = diff;
  $('#stat-track').textContent = track.name;
  $('#stat-score').textContent = '0';
  $('#stat-combo').textContent = '0';
  $('#stat-perfect').textContent = '0';
  $('#stat-miss').textContent = '0';
  $('#stat-time').textContent = track.duration.toFixed(1) + 's';

  $('#bloom-fill').style.transform = 'scaleX(0)';
  $('#bloom-phase').textContent = 'WARM UP';
  $('#coach-text').textContent =
    'เริ่มวอร์มอัพก่อน ฟังจังหวะเบา ๆ แล้วค่อยเก็บคอมโบ 🎧';

  // เริ่มเพลง
  stopAudio('bgm-warmup');
  if (trackId === 'warmup') {
    playAudio('bgm-warmup');
  }

  const start = performance.now();
  state.startTime = start;
  state.lastFrameTime = start;

  if (rafId) cancelAnimationFrame(rafId);
  const loop = (t) => {
    rafId = requestAnimationFrame(loop);
    updateGame(t);
  };
  rafId = requestAnimationFrame(loop);
}

function endGame(reason = 'timeup') {
  if (!state || state.finished) return;
  state.finished = true;

  cancelAnimationFrame(rafId);
  rafId = null;
  stopAudio('bgm-warmup');

  const elapsed = state.songTime;
  const avgBloom = state.bloomSamples > 0
    ? (state.bloomAccum / state.bloomSamples)
    : 0;

  $('#res-mode').textContent = state.mode === 'research' ? 'วิจัย' : 'ปกติ';
  $('#res-diff').textContent = state.diff;
  $('#res-track').textContent = state.track.name;
  $('#res-score').textContent = state.score.toString();
  $('#res-maxcombo').textContent = state.maxCombo.toString();
  $('#res-perfect').textContent = state.perfect.toString();
  $('#res-miss').textContent = state.miss.toString();
  $('#res-bloom').textContent = (avgBloom * 100).toFixed(1) + '%';
  $('#res-time').textContent = elapsed.toFixed(1) + 's';
  $('#res-participant').textContent = state.participantId || '-';
  $('#res-group').textContent = state.participantGroup || '-';

  if (elapsed > 5) playAudio('sfx-clear');

  setView($('#view-menu'), $('#view-play'), $('#view-result'), 'result');
}

function updateGame(tNow) {
  if (!state || state.finished) return;

  if (!state.startTime) {
    state.startTime = tNow;
  }

  const dt = (tNow - state.lastFrameTime) / 1000;
  state.lastFrameTime = tNow;

  state.elapsed = (tNow - state.startTime) / 1000;
  state.songTime = state.elapsed;

  const track = state.track;
  const songTime = state.songTime;

  if (songTime >= track.duration + 0.5) {
    return endGame('timeup');
  }

  const { notes, playArea, laneXs, spawnY } = state;
  const judgeLine = $('#judge-line');
  const areaRect = playArea.getBoundingClientRect();
  const judgeRect = judgeLine.getBoundingClientRect();
  const judgeY = judgeRect.top - areaRect.top;
  state.judgeY = judgeY;

  // spawn
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.spawned) continue;
    if (songTime >= n.time - APPROACH_TIME) {
      n.spawned = true;
      const el = createNoteElement(n);
      n.el = el;
      el.style.left = laneXs[n.lane] + 'px';
      el.style.top = spawnY + 'px';
      playArea.appendChild(el);
    } else {
      break;
    }
  }

  // update position + auto miss
  const active = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.spawned || n.hit || !n.el) continue;

    const progress = (songTime - (n.time - APPROACH_TIME)) / APPROACH_TIME;
    const y = spawnY + progress * (judgeY - spawnY);
    n.el.style.top = y + 'px';

    if (songTime > n.time + HIT_WINDOW_MISS) {
      handleMiss(n);
      continue;
    }
    active.push(n);
  }
  state.activeNotes = active;

  $('#stat-score').textContent = state.score.toString();
  $('#stat-combo').textContent = state.combo.toString();
  $('#stat-perfect').textContent = state.perfect.toString();
  $('#stat-miss').textContent = state.miss.toString();
  $('#stat-time').textContent = (track.duration - songTime).toFixed(1) + 's';

  state.bloomAccum += state.bloom;
  state.bloomSamples++;

  if (songTime > 10 && songTime < 30) {
    $('#coach-text').textContent = 'ลองเก็บคอมโบให้ต่อเนื่อง แล้วดู Bloom bar ขยับขึ้น 🔥';
  } else if (songTime >= 30) {
    $('#coach-text').textContent = 'ช่วงท้ายลองเร่งจังหวะอีกนิด แต่พยายามไม่พลาดนะ 💪';
  }
}

// ---------- hit / miss ----------

function laneFromKey(evt) {
  const k = evt.key.toLowerCase();
  if (k === 'w') return 0;   // เลนบน
  if (k === 's') return 1;   // เลนกลาง
  if (k === 'x') return 2;   // เลนล่าง
  return null;
}

function handleHit(lane) {
  if (!state || state.finished) return;
  const songTime = state.songTime;
  let best = null;
  let bestDelta = Infinity;

  for (const n of state.activeNotes) {
    if (n.lane !== lane || n.hit || !n.el) continue;
    const delta = Math.abs(songTime - n.time);
    if (delta < bestDelta) {
      best = n;
      bestDelta = delta;
    }
  }

  if (!best || bestDelta > HIT_WINDOW_MISS) {
    return;
  }

  if (bestDelta <= HIT_WINDOW_PERFECT) {
    registerHit(best, 'perfect');
  } else if (bestDelta <= HIT_WINDOW_GOOD) {
    registerHit(best, 'good');
  } else {
    registerHit(best, 'late');
  }
}

function registerHit(note, kind) {
  note.hit = true;
  if (note.el && note.el.parentNode) {
    note.el.parentNode.removeChild(note.el);
  }

  state.totalHits++;

  let scoreAdd = 0;
  if (kind === 'perfect') {
    scoreAdd = 100;
    state.perfect++;
    state.combo++;
    playAudio('sfx-perfect');
    state.bloom += 0.06;
  } else if (kind === 'good') {
    scoreAdd = 60;
    state.combo++;
    playAudio('sfx-hit');
    state.bloom += 0.035;
  } else {
    scoreAdd = 30;
    state.combo = Math.max(0, state.combo - 1);
    playAudio('sfx-hit');
    state.bloom += 0.02;
  }

  if (state.combo > state.maxCombo) {
    state.maxCombo = state.combo;
    if (state.combo > 10) {
      playAudio('sfx-combo');
    }
  }

  state.score += scoreAdd;
  updateBloomHUD();
}

function handleMiss(note) {
  if (note.hit) return;
  note.hit = true;
  if (note.el && note.el.parentNode) {
    note.el.parentNode.removeChild(note.el);
  }
  state.miss++;
  state.combo = 0;
  state.bloom -= 0.08;
  if (state.bloom < 0) state.bloom = 0;
  playAudio('sfx-miss');
  updateBloomHUD();
}

function updateBloomHUD() {
  if (!state) return;
  const bloom = Math.max(0, Math.min(1, state.bloom));
  state.bloom = bloom;
  const fill = $('#bloom-fill');
  fill.style.transform = `scaleX(${bloom})`;

  const phaseEl = $('#bloom-phase');
  if (bloom < 0.3) {
    phaseEl.textContent = 'WARM UP';
  } else if (bloom < 0.7) {
    phaseEl.textContent = 'DANCE';
  } else {
    phaseEl.textContent = 'FEVER';
  }
}

// ---------- export init ----------

export function initRhythmEngine() {
  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  if (!viewMenu || !viewPlay || !viewResult) return;

  let currentMode = 'research';

  $('#btn-mode-research').addEventListener('click', () => {
    currentMode = 'research';
    $('#btn-mode-research').classList.add('primary');
    $('#btn-mode-normal').classList.remove('primary');
  });

  $('#btn-mode-normal').addEventListener('click', () => {
    currentMode = 'normal';
    $('#btn-mode-normal').classList.add('primary');
    $('#btn-mode-research').classList.remove('primary');
  });

  $('#btn-start').addEventListener('click', () => {
    const diff = $('#difficulty').value || 'normal';
    const trackId = $('#track-select').value || 'warmup';
    const participantId = $('#participant-id').value.trim();
    const participantGroup = $('#participant-group').value.trim();

    setView(viewMenu, viewPlay, viewResult, 'play');
    startGame({
      mode: currentMode,
      diff,
      trackId,
      participantId,
      participantGroup
    });
  });

  $('#btn-stop-early').addEventListener('click', () => {
    if (!state) return;
    endGame('manual');
  });

  $('#btn-play-again').addEventListener('click', () => {
    setView(viewMenu, viewPlay, viewResult, 'menu');
  });

  $('#btn-back-menu').addEventListener('click', () => {
    setView(viewMenu, viewPlay, viewResult, 'menu');
  });

  // keyboard control: W / S / X
  window.addEventListener('keydown', (evt) => {
    if (!state || state.finished) return;
    const lane = laneFromKey(evt);
    if (lane == null) return;
    evt.preventDefault();
    handleHit(lane);
  });

  // tap / click control
  $('#play-area').addEventListener('pointerdown', (evt) => {
    if (!state || state.finished) return;
    const rect = state.playArea.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const laneWidth = rect.width / 3;
    const lane = Math.min(2, Math.max(0, Math.floor(x / laneWidth)));
    handleHit(lane);
  });

  setView(viewMenu, viewPlay, viewResult, 'menu');
}
