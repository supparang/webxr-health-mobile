// === Rhythm Boxer — DOM-based 3-lane engine ===
'use strict';

const APPROACH_TIME = 1.1;     // เวลา (วินาที) ที่โน้ตใช้ไหลจากบนสุดถึงเส้นเป้า
const HIT_WINDOW_PERFECT = 0.12;
const HIT_WINDOW_GOOD = 0.28;
const HIT_WINDOW_MISS = 0.40;

// Track config ตัวอย่าง (1 track)
const TRACKS = {
  warmup: {
    id: 'warmup',
    name: 'Track 1 — Warm-up Mix (วอร์มอัพเบา ๆ)',
    duration: 60,              // วินาที
    bpm: 96,
    densityEasy:   [0.55, 0.35, 0.45],
    densityNormal: [0.75, 0.45, 0.6],
    densityHard:   [0.9,  0.65, 0.85]
  }
};

// state หลักของ engine
let state = null;
let rafId = null;

// ---------- Utility ----------

function $(sel) { return document.querySelector(sel); }

function playAudio(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    void el.play();
  } catch (e) {
    // เงียบไว้ ถ้า browser บล็อก auto-play
  }
}

function stopAudio(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try { el.pause(); } catch(e) {}
}

// ---------- Note generation ----------

function pickDensity(track, diff) {
  if (diff === 'easy') return track.densityEasy;
  if (diff === 'hard') return track.densityHard;
  return track.densityNormal;
}

function generateNotesForTrack(track, diff) {
  const notes = [];
  const beat = 60 / track.bpm;          // 1 beat = กี่วินาที
  const densities = pickDensity(track, diff);

  const startOffset = 2.0;              // เวลาว่างก่อนโน้ตแรก
  const endTime = track.duration - 1.0; // buffer ท้ายเพลง

  let t = startOffset;

  while (t < endTime) {
    for (let lane = 0; lane < 3; lane++) {
      if (Math.random() < densities[lane]) {
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
    t += beat; // ขยับทีละ 1 beat (อยากถี่กว่านี้ใช้ beat * 0.5)
  }

  // เรียงตามเวลา (กันกรณีสุ่มแปลก ๆ)
  notes.sort((a,b) => a.time - b.time);
  return notes;
}

// ---------- DOM helpers ----------

function createNoteElement(note) {
  const el = document.createElement('div');
  el.className = 'rb-note lane-' + note.lane;
  el.innerHTML = `
    <div class="rb-note-glow"></div>
    <div class="rb-note-core">🎵</div>
  `;
  return el;
}

function setView(viewMenu, viewPlay, viewResult, target) {
  viewMenu.classList.toggle('hidden', target !== 'menu');
  viewPlay.classList.toggle('hidden', target !== 'play');
  viewResult.classList.toggle('hidden', target !== 'result');
}

// ---------- Engine core ----------

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
  const spawnY = -40; // px จากบนสุดของ playArea

  // state เริ่มต้น
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

  // reset DOM
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

  // อัพเดต stat header
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

  // เริ่มเล่นเพลง
  stopAudio('bgm-warmup');
  if (trackId === 'warmup') {
    playAudio('bgm-warmup');
  }

  // timestamp เริ่ม
  const start = performance.now();
  state.startTime = start;
  state.lastFrameTime = start;

  // เริ่ม loop
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

  // เติมผลลง result view
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

  // เล่นเสียง clear เล็กน้อยเฉพาะถ้าเล่นเกิน 5s
  if (elapsed > 5) playAudio('sfx-clear');

  // สลับไปหน้า result
  setView($('#view-menu'), $('#view-play'), $('#view-result'), 'result');
}

// update per-frame
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

  // หมดเวลา → end
  if (songTime >= track.duration + 0.5) {
    return endGame('timeup');
  }

  // spawn โน้ต
  const { notes, playArea, laneXs, spawnY, judgeY } = state;

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.spawned) continue;
    if (songTime >= n.time - APPROACH_TIME) {
      n.spawned = true;
      const el = createNoteElement(n);
      n.el = el;
      // ตั้งตำแหน่งเริ่ม (ด้านบน)
      el.style.left = laneXs[n.lane] + 'px';
      el.style.top = spawnY + 'px';
      playArea.appendChild(el);
    }
  }

  // อัพเดตตำแหน่งโน้ต + ตรวจ miss
  const active = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.spawned || n.hit || !n.el) continue;

    const progress = (songTime - (n.time - APPROACH_TIME)) / APPROACH_TIME;
    const y = spawnY + progress * (judgeY - spawnY);
    n.el.style.top = y + 'px';

    // ถ้าเลยหน้าต่าง miss แล้ว → นับ miss
    if (songTime > n.time + HIT_WINDOW_MISS) {
      handleMiss(n);
      continue;
    }
    active.push(n);
  }

  state.activeNotes = active;

  // อัพเดต HUD
  $('#stat-score').textContent = state.score.toString();
  $('#stat-combo').textContent = state.combo.toString();
  $('#stat-perfect').textContent = state.perfect.toString();
  $('#stat-miss').textContent = state.miss.toString();
  $('#stat-time').textContent = (track.duration - songTime).toFixed(1) + 's';

  // bloom sample
  state.bloomAccum += state.bloom;
  state.bloomSamples++;

  // coach text เล็ก ๆ
  if (songTime > 10 && songTime < 30) {
    $('#coach-text').textContent = 'ลองเก็บคอมโบให้ต่อเนื่อง แล้วดู Bloom bar ขยับขึ้น 🔥';
  } else if (songTime >= 30) {
    $('#coach-text').textContent = 'ช่วงท้ายลองเร่งจังหวะอีกนิด แต่พยายามไม่พลาดนะ 💪';
  }
}

// ---------- Hit/Miss ----------

function laneFromKey(evt) {
  const k = evt.key.toLowerCase();
  if (k === 'w') return 0;
  if (k === 's') return 1;
  if (k === 'x') return 2;
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
    // ถ้าตีตอนที่ไม่มีโน้ตใกล้ ๆ ไม่ต้องถือว่า miss
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

// ---------- Public init ----------

export function initRhythmEngine() {
  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  if (!viewMenu || !viewPlay || !viewResult) return;

  // ปุ่มเลือกโหมด
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

  // ปุ่มเริ่ม
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

  // ปุ่มหยุดก่อนเวลา
  $('#btn-stop-early').addEventListener('click', () => {
    if (!state) return;
    endGame('manual');
  });

  // ปุ่มเล่นอีกครั้ง
  $('#btn-play-again').addEventListener('click', () => {
    setView(viewMenu, viewPlay, viewResult, 'menu');
  });

  // ปุ่มกลับเมนู
  $('#btn-back-menu').addEventListener('click', () => {
    setView(viewMenu, viewPlay, viewResult, 'menu');
  });

  // keyboard control
  window.addEventListener('keydown', (evt) => {
    if (!state || state.finished) return;
    const lane = laneFromKey(evt);
    if (lane == null) return;
    evt.preventDefault();
    handleHit(lane);
  });

  // tap / click control (เดาเลนจากตำแหน่ง X)
  $('#play-area').addEventListener('pointerdown', (evt) => {
    if (!state || state.finished) return;
    const rect = state.playArea.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const laneWidth = rect.width / 3;
    const lane = Math.min(2, Math.max(0, Math.floor(x / laneWidth)));
    handleHit(lane);
  });

  // เริ่มต้นอยู่หน้าเมนู
  setView(viewMenu, viewPlay, viewResult, 'menu');
}
