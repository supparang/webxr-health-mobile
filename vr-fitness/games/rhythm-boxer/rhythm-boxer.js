// === VR Fitness — Rhythm Boxer (Research Production v1.0.0) ===
// - Research-ready, bilingual, play-only layout
// - Local logging + CSV export
// - Phase-aware (pre/train/post)
// - Group code field for experimental groups
// - Music & Cloud system "พร้อมเปิดใช้" แต่ปิดค่าไว้เป็นค่า default

const GAME_ID = 'rhythm-boxer';
const GAME_VERSION = '1.0.0-research';

const STORAGE_KEY = 'RhythmBoxerResearch_v3';
const META_KEY = 'RhythmBoxerMeta_v2';

// ---- CONFIG ----

// URL Google Apps Script (ถ้าใช้ Cloud log ให้ใส่จริง)
// ค่า default ว่าง = ไม่ส่ง cloud
const GOOGLE_SCRIPT_URL = '';

// เพลง generic 120–140 BPM (ถ้ามีไฟล์จริงให้เปลี่ยน path และเปิด ENABLE_MUSIC)
const MUSIC_SRC = './assets/music-basic-120bpm.mp3';

// ค่า default สำหรับ PRODUCTION ตอนนี้ (ยังไม่มีไฟล์เพลง / Apps Script จริง)
const ENABLE_MUSIC = false;       // มีไฟล์เพลงค่อยเปลี่ยนเป็น true
const ENABLE_CLOUD_LOG = false;   // ตั้ง Apps Script แล้วค่อยเปลี่ยนเป็น true
const ENABLE_FX = true;

// ---- DOM helpers ----
const qs = (s) => document.querySelector(s);

const gameArea = qs('#gameArea');
const feedbackEl = qs('#feedback');
const startBtn = qs('#startBtn');
const langButtons = document.querySelectorAll('.lang-toggle button');

const metaInputs = {
  studentId: qs('#studentId'),
  schoolName: qs('#schoolName'),
  classRoom: qs('#classRoom'),
  groupCode: qs('#groupCode'),
  deviceType: qs('#deviceType'),
  note: qs('#note'),
};

const hud = {
  timeVal: qs('#timeVal'),
  scoreVal: qs('#scoreVal'),
  hitVal: qs('#hitVal'),
  missVal: qs('#missVal'),
  comboVal: qs('#comboVal'),
  coachLine: qs('#coachLine'),
};

const overlay = qs('#resultOverlay');
const r = {
  score: qs('#rScore'),
  hit: qs('#rHit'),
  perfect: qs('#rPerfect'),
  good: qs('#rGood'),
  miss: qs('#rMiss'),
  acc: qs('#rAcc'),
  combo: qs('#rCombo'),
  timeUsed: qs('#rTimeUsed'),
};

const playAgainBtn = qs('#playAgainBtn');
const backHubBtn = qs('#backHubBtn');
const downloadCsvBtn = qs('#downloadCsvBtn');

// ---- i18n ----
const i18n = {
  th: {
    metaTitle: 'ข้อมูลสำหรับงานวิจัย',
    metaHint:
      'กรอกเพียงครั้งเดียวก่อนเริ่ม ระบบจะบันทึกทุกครั้งที่เล่นเป็น 1 รอบการทดลอง.',
    startLabel: 'เริ่มเล่น',
    coachReady: 'โค้ชพุ่ง: ฟังดนตรี แล้วต่อยเป้าให้ทันนะ! 🎵👊',
    coachGood: 'สุดยอด! จังหวะกำลังมา รักษาคอมโบไว้เลย! ✨',
    coachMiss: 'พลาดนิดเดียว ลองฟังจังหวะแล้วลองใหม่อีกทีนะ 🎧',
    tagGoal: 'เป้าหมาย: ต่อยให้ตรงเลน และตรงจังหวะให้มากที่สุด',
    lblTime: 'เวลา',
    lblScore: 'คะแนน',
    lblHit: 'โดนเป้า',
    lblMiss: 'พลาด',
    lblCombo: 'คอมโบ',
    resultTitle: '🏁 สรุปผล Rhythm Boxer',
    rScore: 'คะแนนรวม',
    rHit: 'จำนวนครั้งที่โดนเป้า',
    rPerfect: 'Perfect (ตรงจังหวะมาก)',
    rGood: 'Good (เกือบตรงจังหวะ)',
    rMiss: 'Miss (พลาด)',
    rAcc: 'ความแม่นยำ',
    rCombo: 'คอมโบสูงสุด',
    rTimeUsed: 'เวลาเล่นต่อรอบ',
    playAgain: 'เล่นอีกครั้ง',
    backHub: 'กลับเมนูหลัก',
    downloadCsv: 'ดาวน์โหลด CSV ข้อมูลวิจัย (ทุก session)',
    laneLeft: 'ซ้าย',
    laneRight: 'ขวา',
    laneBody: 'ลำตัว',
    alertMeta: 'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
  },
  en: {
    metaTitle: 'Research meta (per session)',
    metaHint:
      'Fill this once. Each Rhythm Boxer run will be logged as a separate session.',
    startLabel: 'Start',
    coachReady:
      'Coach Pung: Listen to the beat and punch the targets in time! 🎵🥊',
    coachGood: 'Great! Combo is growing, keep the rhythm! ✨',
    coachMiss: 'Missed a bit, listen again and try once more 🎧',
    tagGoal: 'Goal: Punch in the correct lane and on time',
    lblTime: 'TIME',
    lblScore: 'SCORE',
    lblHit: 'HIT',
    lblMiss: 'MISS',
    lblCombo: 'COMBO',
    resultTitle: '🏁 Rhythm Boxer Result',
    rScore: 'Total Score',
    rHit: 'Hits (Perfect+Good)',
    rPerfect: 'Perfect',
    rGood: 'Good',
    rMiss: 'Miss',
    rAcc: 'Accuracy',
    rCombo: 'Best Combo',
    rTimeUsed: 'Played Time',
    playAgain: 'Play again',
    backHub: 'Back to Hub',
    downloadCsv: 'Download research CSV (all sessions)',
    laneLeft: 'Left',
    laneRight: 'Right',
    laneBody: 'Body',
    alertMeta: 'Please fill at least the Student ID before starting.',
  },
};

let lang = 'th';

// ---- Phase (Pre / Train / Post) ----
function getPhaseFromQuery() {
  const p = new URLSearchParams(location.search).get('phase') || 'train';
  const norm = p.toLowerCase();
  if (norm === 'pre' || norm === 'post' || norm === 'train') return norm;
  return 'train';
}

// ---- Song / Chart Config ----
// time = ms from start; lane = 'L' / 'B' / 'R'
const chart = [
  // intro
  { time: 1000, lane: 'L' },
  { time: 1400, lane: 'R' },
  { time: 1800, lane: 'B' },

  { time: 2400, lane: 'L' },
  { time: 2800, lane: 'R' },
  { time: 3200, lane: 'B' },

  // pattern 1
  { time: 4000, lane: 'L' },
  { time: 4400, lane: 'L' },
  { time: 4800, lane: 'B' },
  { time: 5200, lane: 'R' },
  { time: 5600, lane: 'R' },
  { time: 6000, lane: 'B' },

  { time: 6800, lane: 'L' },
  { time: 7200, lane: 'B' },
  { time: 7600, lane: 'R' },

  // pattern 2
  { time: 8400, lane: 'L' },
  { time: 8800, lane: 'B' },
  { time: 9200, lane: 'R' },
  { time: 9600, lane: 'B' },

  { time: 10400, lane: 'L' },
  { time: 10800, lane: 'L' },
  { time: 11200, lane: 'R' },
  { time: 11600, lane: 'R' },
  { time: 12000, lane: 'B' },

  // pattern 3
  { time: 13000, lane: 'L' },
  { time: 13400, lane: 'B' },
  { time: 13800, lane: 'L' },
  { time: 14200, lane: 'B' },
  { time: 14800, lane: 'R' },
  { time: 15200, lane: 'B' },

  // last phrases
  { time: 16400, lane: 'L' },
  { time: 17000, lane: 'R' },
  { time: 17600, lane: 'B' },
  { time: 18400, lane: 'R' },
  { time: 19200, lane: 'L' },
  { time: 20000, lane: 'B' },
];

// เวลาโน้ตเคลื่อนจากบนลง hit line
const TRAVEL_TIME = 900; // ms
const PERFECT_WINDOW = 120; // ±120ms
const GOOD_WINDOW = 220; // ±220ms;

// ---- Audio ----
let music = null;

function initAudio() {
  if (!ENABLE_MUSIC) return;
  try {
    music = new Audio();
    music.src = MUSIC_SRC;
    music.preload = 'auto';
    music.volume = 0.85;

    music.addEventListener('canplaythrough', () => {
      console.log('[RhythmBoxer] Music ready:', MUSIC_SRC);
    });

    music.addEventListener('error', () => {
      console.error('[RhythmBoxer] Music error:', music && music.error);
      if (hud?.coachLine) {
        hud.coachLine.textContent =
          '⚠️ โหลดเพลงไม่สำเร็จ ตรวจไฟล์เพลงในโฟลเดอร์ assets';
      }
    });
  } catch (e) {
    console.warn('[RhythmBoxer] initAudio failed:', e);
  }
}

function playMusic() {
  if (!ENABLE_MUSIC || !music) return;
  try {
    music.currentTime = 0;
    const p = music.play();
    if (p && p.catch) {
      p.catch((err) => {
        console.warn('[RhythmBoxer] music.play blocked:', err);
        if (hud?.coachLine) {
          hud.coachLine.textContent =
            '⚠️ เบราว์เซอร์บล็อกเสียง ลองกดเริ่มเล่นอีกครั้ง';
        }
      });
    }
  } catch (e) {
    console.warn('[RhythmBoxer] Music play failed:', e);
  }
}

function stopMusic() {
  if (!ENABLE_MUSIC || !music) return;
  try {
    music.pause();
  } catch (_) {}
}

// ---- Game State ----
const state = {
  running: false,
  started: false,
  startTime: 0,
  elapsed: 0,
  score: 0,
  hit: 0,
  perfect: 0,
  good: 0,
  miss: 0,
  combo: 0,
  maxCombo: 0,
  songDuration: 0,
  notes: [],
  lastFrame: 0,
  sessionMeta: null,
  phase: getPhaseFromQuery(),
};

// ---- Meta persistence ----
function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    const meta = JSON.parse(raw);
    Object.entries(metaInputs).forEach(([k, el]) => {
      if (meta[k] && el) el.value = meta[k];
    });
  } catch (_) {}
}

function saveMetaDraft() {
  const meta = {};
  Object.entries(metaInputs).forEach(([k, el]) => {
    meta[k] = el.value.trim();
  });
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (_) {}
}

// ---- i18n apply ----
function applyLang() {
  const t = i18n[lang];
  qs('#metaTitle').textContent = t.metaTitle;
  qs('#metaHint').textContent = t.metaHint;
  qs('#startLabel').textContent = t.startLabel;
  hud.coachLine.textContent = t.coachReady;
  qs('#tagGoal').textContent = t.tagGoal;

  qs('#lblTime').textContent = t.lblTime.toUpperCase();
  qs('#lblScore').textContent = t.lblScore.toUpperCase();
  qs('#lblHit').textContent = t.lblHit.toUpperCase();
  qs('#lblMiss').textContent = t.lblMiss.toUpperCase();
  qs('#lblCombo').textContent = t.lblCombo.toUpperCase();

  qs('#resultTitle').textContent = t.resultTitle;
  qs('#rScoreLabel').textContent = t.rScore;
  qs('#rHitLabel').textContent = t.rHit;
  qs('#rPerfectLabel').textContent = t.rPerfect;
  qs('#rGoodLabel').textContent = t.rGood;
  qs('#rMissLabel').textContent = t.rMiss;
  qs('#rAccLabel').textContent = t.rAcc;
  qs('#rComboLabel').textContent = t.rCombo;
  qs('#rTimeUsedLabel').textContent = t.rTimeUsed;

  qs('#playAgainLabel').textContent = t.playAgain;
  qs('#backHubLabel').textContent = t.backHub;
  qs('#downloadCsvLabel').textContent = t.downloadCsv;

  qs('#laneLeftLabel').textContent = t.laneLeft;
  qs('#laneRightLabel').textContent = t.laneRight;
  qs('#laneBodyLabel').textContent = t.laneBody;
}

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    langButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    lang = btn.dataset.lang || 'th';
    applyLang();
  });
});

function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vr';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---- HUD & FX ----
function resetStats() {
  state.score = 0;
  state.hit = 0;
  state.perfect = 0;
  state.good = 0;
  state.miss = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.elapsed = 0;
  state.lastFrame = 0;

  hud.scoreVal.textContent = '0';
  hud.hitVal.textContent = '0';
  hud.missVal.textContent = '0';
  hud.comboVal.textContent = 'x0';
  feedbackEl.style.display = 'none';

  gameArea.querySelectorAll('.note').forEach((n) => n.remove());
}

function updateHUD() {
  hud.scoreVal.textContent = state.score;
  hud.hitVal.textContent = state.hit;
  hud.missVal.textContent = state.miss;
  hud.comboVal.textContent = 'x' + state.combo;
}

function showFeedback(type) {
  let txt = '';
  if (lang === 'th') {
    if (type === 'perfect') txt = 'สุดยอด! 💥';
    else if (type === 'good') txt = 'ดีมาก! ✨';
    else txt = 'พลาดนิดเดียว!';
  } else {
    if (type === 'perfect') txt = 'PERFECT!';
    else if (type === 'good') txt = 'GOOD!';
    else txt = 'MISS';
  }

  feedbackEl.textContent = txt;
  feedbackEl.className = 'feedback ' + type;
  feedbackEl.style.display = 'block';
  setTimeout(() => {
    feedbackEl.style.display = 'none';
  }, 420);
}

function fxHit() {
  if (!ENABLE_FX || !gameArea || !gameArea.animate) return;
  gameArea.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 0 0 rgba(34,197,94,0.0)' },
      { transform: 'scale(1.02)', boxShadow: '0 0 24px rgba(34,197,94,0.8)' },
      { transform: 'scale(1)', boxShadow: '0 0 0 rgba(34,197,94,0.0)' },
    ],
    { duration: 140, easing: 'ease-out' }
  );
}

function fxMiss() {
  if (!ENABLE_FX || !gameArea || !gameArea.animate) return;
  gameArea.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 160, easing: 'ease-out' }
  );
}

// ---- Notes runtime ----
function prepareChart() {
  state.notes = chart.map((n) => ({
    time: n.time,
    lane: n.lane,
    spawned: false,
    judged: false,
    hit: false,
    el: null,
  }));
  const last = state.notes[state.notes.length - 1];
  state.songDuration = last.time + 2200;
  hud.timeVal.textContent = Math.round(state.songDuration / 1000);
}

function spawnNote(note) {
  const laneEl = gameArea.querySelector(`.lane[data-lane="${note.lane}"]`);
  if (!laneEl) return;
  const el = document.createElement('div');
  el.className = 'note ' + note.lane;
  el.dataset.time = String(note.time);
  el.dataset.lane = note.lane;

  if (note.lane === 'L') el.textContent = '👊';
  else if (note.lane === 'R') el.textContent = '✊';
  else el.textContent = '💥';

  laneEl.appendChild(el);
  note.el = el;
  note.spawned = true;
}

function positionNotes(now) {
  const elapsed = now - state.startTime;
  const areaRect = gameArea.getBoundingClientRect();
  const h = areaRect.height || 400;
  const startY = -40;
  const hitY = h * 0.82;

  for (const note of state.notes) {
    if (!note.spawned || !note.el) continue;
    const t0 = note.time - TRAVEL_TIME;
    const posT = elapsed - t0;
    const prog = posT / (TRAVEL_TIME * 2);

    if (prog < 0 || prog > 1.2) {
      if (!note.judged) {
        note.judged = true;
        note.hit = false;
        state.miss++;
        state.combo = 0;
        updateHUD();
        showFeedback('miss');
        fxMiss();
        hud.coachLine.textContent = i18n[lang].coachMiss;
      }
      if (note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el);
      continue;
    }

    const y = startY + (hitY - startY) * prog;
    note.el.style.top = y + 'px';
  }
}

// ---- Judging ----
function judgeHit(lane) {
  if (!state.running) return;
  const now = performance.now();
  const tSong = now - state.startTime;

  let best = null;
  let bestDiff = Infinity;

  for (const note of state.notes) {
    if (note.lane !== lane) continue;
    if (!note.spawned || !note.el) continue;
    if (note.judged) continue;
    const diff = tSong - note.time;
    const ad = Math.abs(diff);
    if (ad < bestDiff) {
      bestDiff = ad;
      best = note;
    }
  }

  if (!best || bestDiff > GOOD_WINDOW) {
    state.miss++;
    state.combo = 0;
    updateHUD();
    showFeedback('miss');
    fxMiss();
    hud.coachLine.textContent = i18n[lang].coachMiss;
    return;
  }

  let quality = 'good';
  let base = 80;
  if (bestDiff <= PERFECT_WINDOW) {
    quality = 'perfect';
    base = 120;
  }

  best.judged = true;
  best.hit = true;
  if (best.el) {
    best.el.classList.add('hit');
    setTimeout(() => {
      if (best.el && best.el.parentNode) best.el.parentNode.removeChild(best.el);
    }, 110);
  }

  state.hit++;
  if (quality === 'perfect') state.perfect++;
  else state.good++;

  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  const comboBonus = Math.min(state.combo * 5, 60);
  state.score += base + comboBonus;

  updateHUD();
  showFeedback(quality);
  fxHit();
  hud.coachLine.textContent = i18n[lang].coachGood;
}

// ---- Loop & Timer ----
function mainLoop(now) {
  if (!state.running) return;
  if (!state.lastFrame) state.lastFrame = now;
  state.elapsed = now - state.startTime;

  for (const note of state.notes) {
    if (note.spawned) continue;
    const spawnAt = note.time - TRAVEL_TIME;
    if (state.elapsed >= spawnAt) spawnNote(note);
  }

  positionNotes(now);

  hud.timeVal.textContent = Math.max(
    0,
    Math.round((state.songDuration - state.elapsed) / 1000)
  );

  const allJudged = state.notes.every((n) => n.judged);
  if (allJudged || state.elapsed >= state.songDuration + 1000) {
    endGame();
    return;
  }

  requestAnimationFrame(mainLoop);
}

// ---- Research Log & Cloud ----
function logResearchRecordLocal(rec) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('Failed to store research record locally:', err);
  }
}

async function logResearchRecordCloud(rec) {
  if (!ENABLE_CLOUD_LOG) return;
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.indexOf('http') !== 0) return;
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
      mode: 'no-cors',
    });
  } catch (err) {
    console.warn('Cloud log failed:', err);
  }
}

function downloadCsv() {
  let rows = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert('ยังไม่มีข้อมูล session ที่บันทึกไว้');
      return;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      alert('ยังไม่มีข้อมูล session ที่บันทึกไว้');
      return;
    }

    const header = [
      'studentId',
      'schoolName',
      'classRoom',
      'groupCode',
      'deviceType',
      'language',
      'note',
      'phase',
      'gameId',
      'gameVersion',
      'sessionId',
      'songId',
      'timeSec',
      'score',
      'hits',
      'perfect',
      'good',
      'miss',
      'accuracy',
      'maxCombo',
      'timeUsedSec',
      'createdAt',
    ];
    rows.push(header.join(','));

    for (const rec of arr) {
      const line = header
        .map((key) => {
          const v = rec[key] !== undefined ? String(rec[key]) : '';
          const safe = v.replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(',');
      rows.push(line);
    }
  } catch (err) {
    console.error(err);
    alert('ไม่สามารถสร้าง CSV ได้');
    return;
  }

  const csv = rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'RhythmBoxerResearch.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function endGame() {
  if (!state.running) return;
  state.running = false;
  stopMusic();

  const played = Math.round(state.elapsed / 1000);
  const totalNotes = state.notes.length;
  const totalHit = state.perfect + state.good;
  const acc = totalNotes > 0 ? Math.round((totalHit / totalNotes) * 100) : 0;

  const record = {
    gameId: GAME_ID,
    gameVersion: GAME_VERSION,
    sessionId: Date.now().toString(),
    songId: 'basic-1',
    phase: state.phase, // pre / train / post
    studentId: state.sessionMeta?.studentId || '',
    schoolName: state.sessionMeta?.schoolName || '',
    classRoom: state.sessionMeta?.classRoom || '',
    groupCode: state.sessionMeta?.groupCode || '',
    deviceType: state.sessionMeta?.deviceType || detectDevice(),
    language: state.sessionMeta?.language || lang,
    note: state.sessionMeta?.note || '',
    timeSec: Math.round(state.songDuration / 1000),
    score: state.score,
    hits: totalHit,
    perfect: state.perfect,
    good: state.good,
    miss: state.miss,
    accuracy: acc,
    maxCombo: state.maxCombo,
    timeUsedSec: played,
    createdAt: new Date().toISOString(),
  };

  // local + cloud
  logResearchRecordLocal(record);
  logResearchRecordCloud(record);

  r.score.textContent = state.score;
  r.hit.textContent = totalHit;
  r.perfect.textContent = state.perfect;
  r.good.textContent = state.good;
  r.miss.textContent = state.miss;
  r.acc.textContent = acc + '%';
  r.combo.textContent = 'x' + state.maxCombo;
  r.timeUsed.textContent = played + 's';

  overlay.classList.remove('hidden');
}

// ---- Start Game ----
function startGame() {
  if (state.running) return;

  const studentId = metaInputs.studentId.value.trim();
  if (!studentId) {
    alert(i18n[lang].alertMeta);
    return;
  }

  const meta = {
    studentId,
    schoolName: metaInputs.schoolName.value.trim(),
    classRoom: metaInputs.classRoom.value.trim(),
    groupCode: metaInputs.groupCode.value.trim(),
    deviceType:
      metaInputs.deviceType.value === 'auto'
        ? detectDevice()
        : metaInputs.deviceType.value,
    note: metaInputs.note.value.trim(),
    language: lang,
  };
  state.sessionMeta = meta;
  saveMetaDraft();

  document.body.classList.add('play-only');

  resetStats();
  prepareChart();

  state.running = true;
  state.started = true;
  startBtn.disabled = true;
  startBtn.style.opacity = 0.7;

  hud.coachLine.textContent = i18n[lang].coachReady;

  setTimeout(() => {
    state.startTime = performance.now();
    state.lastFrame = 0;
    playMusic();
    requestAnimationFrame(mainLoop);
  }, 700);
}

// ---- Controls ----
window.addEventListener('keydown', (ev) => {
  if (!state.running) return;
  const key = ev.key.toLowerCase();
  if (key === 'a') judgeHit('L');
  else if (key === 's') judgeHit('B');
  else if (key === 'd') judgeHit('R');
});

gameArea.addEventListener('click', (ev) => {
  if (!state.running) return;
  const laneEl = ev.target.closest('.lane');
  if (!laneEl) return;
  const lane = laneEl.getAttribute('data-lane');
  if (!lane) return;
  judgeHit(lane);
});

// ---- Buttons ----
startBtn.addEventListener('click', startGame);

playAgainBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  startBtn.disabled = false;
  startBtn.style.opacity = 1;
  startGame();
});

backHubBtn.addEventListener('click', () => {
  location.href = '../../index.html';
});

downloadCsvBtn.addEventListener('click', downloadCsv);

Object.values(metaInputs).forEach((el) => {
  el.addEventListener('change', saveMetaDraft);
  el.addEventListener('blur', saveMetaDraft);
});

// ---- Init ----
loadMeta();
applyLang();
prepareChart();
initAudio();