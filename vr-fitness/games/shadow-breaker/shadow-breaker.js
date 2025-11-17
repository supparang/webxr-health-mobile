// === VR Fitness — Shadow Breaker (Research + Demo, bilingual, play-only layout, 4 bosses by difficulty) ===

const STORAGE_KEY = 'ShadowBreakerResearch_v1';
const META_KEY = 'ShadowBreakerMeta_v1';

const qs = (s) => document.querySelector(s);
const gameArea = qs('#gameArea');
let feverBadge = qs('#feverBadge');
const startBtn = qs('#startBtn');
const langButtons = document.querySelectorAll('.lang-toggle button');

const metaInputs = {
  studentId: qs('#studentId'),
  schoolName: qs('#schoolName'),
  classRoom: qs('#classRoom'),
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

// Result overlay
const overlay = qs('#resultOverlay');
const r = {
  score: qs('#rScore'),
  hit: qs('#rHit'),
  miss: qs('#rMiss'),
  acc: qs('#rAcc'),
  combo: qs('#rCombo'),
  fever: qs('#rFever'),
  boss: qs('#rBoss'),
  timeUsed: qs('#rTimeUsed'),
};

const playAgainBtn = qs('#playAgainBtn');
const backHubBtn = qs('#backHubBtn');
const downloadCsvBtn = qs('#downloadCsvBtn');

// --- i18n ---

const i18n = {
  th: {
    metaTitle: 'ข้อมูลสำหรับงานวิจัย',
    metaHint: 'กรอกเพียงครั้งเดียวก่อนเริ่ม แต่ละรอบจะถูกบันทึกเป็น 1 session.',
    startLabel: 'เริ่มเล่น',
    coachReady: 'โค้ชพุ่ง: แตะเป้าที่โผล่มาให้ไวที่สุด! 🔥',
    coachFever: 'โค้ชพุ่ง: FEVER!! แตะรัว ๆ คะแนนพุ่งสุด! ✨',
    coachBoss: 'โค้ชพุ่ง: บอสมาแล้ว! โฟกัสให้สุดแล้วแตะให้แตก 💥',
    tagGoal: 'เป้าหมาย: ทดสอบความไว + ความแม่น',
    lblTime: 'เวลา',
    lblScore: 'คะแนน',
    lblHit: 'โดนเป้า',
    lblMiss: 'พลาด',
    lblCombo: 'คอมโบ',
    resultTitle: '🏁 สรุปผลการเล่น',
    rScore: 'Score',
    rHit: 'Hits',
    rMiss: 'Miss',
    rAcc: 'ความแม่นยำ',
    rCombo: 'Best Combo',
    rFever: 'FEVER ครั้ง',
    rBoss: 'Boss cleared',
    rTimeUsed: 'เวลาเล่น',
    playAgain: 'เล่นอีกครั้ง',
    backHub: 'กลับเมนู',
    downloadCsv: 'ดาวน์โหลด CSV วิจัย (ทุก session)',
    alertMeta: 'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
  },
  en: {
    metaTitle: 'Research meta (per session)',
    metaHint: 'Fill this once. Each run will be logged as one session record.',
    startLabel: 'Start',
    coachReady: 'Coach Pung: Tap the targets as fast as you can! 🔥',
    coachFever: 'Coach Pung: FEVER!! Keep smashing for max score! ✨',
    coachBoss: 'Coach Pung: Boss incoming! Focus and smash it 💥',
    tagGoal: 'Goal: Reaction speed + accuracy test',
    lblTime: 'TIME',
    lblScore: 'SCORE',
    lblHit: 'HIT',
    lblMiss: 'MISS',
    lblCombo: 'COMBO',
    resultTitle: '🏁 Result Summary',
    rScore: 'Score',
    rHit: 'Hits',
    rMiss: 'Miss',
    rAcc: 'Accuracy',
    rCombo: 'Best Combo',
    rFever: 'FEVER count',
    rBoss: 'Boss cleared',
    rTimeUsed: 'Played',
    playAgain: 'Play again',
    backHub: 'Back to Hub',
    downloadCsv: 'Download CSV (all sessions)',
    alertMeta: 'Please fill at least the Student ID before starting.',
  },
};

let lang = 'th';

// --- Boss config (4 ตัว ไล่จากง่าย → ยาก) ---

const BOSS_CONFIG = [
  { emoji: '😺', baseHp: 4 },  // Boss 1: ง่ายสุด
  { emoji: '🐯', baseHp: 6 },  // Boss 2: กลาง
  { emoji: '🐲', baseHp: 8 },  // Boss 3: ยาก
  { emoji: '👑', baseHp: 10 }, // Boss 4: ยากสุด
];

function computeBossHp(index, difficulty) {
  const cfg = BOSS_CONFIG[index % BOSS_CONFIG.length];
  let hp = cfg.baseHp;
  switch (difficulty) {
    case 'easy':
      hp = Math.round(hp * 0.7);
      break;
    case 'hard':
      hp = Math.round(hp * 1.2);
      break;
    case 'extreme':
      hp = Math.round(hp * 1.5);
      break;
    // normal = base
  }
  if (hp < 2) hp = 2;
  return hp;
}

// --- Game state ---

const state = {
  running: false,
  time: 90,
  elapsed: 0,
  timerId: null,
  spawnId: null,
  score: 0,
  hit: 0,
  miss: 0,
  combo: 0,
  maxCombo: 0,
  fever: false,
  feverCount: 0,
  bossCleared: 0,
  bossEvery: 22, // seconds
  lastBossAt: 0,
  bossIndex: 0, // 0..3 วนตาม BOSS_CONFIG
  difficulty: 'normal',
  sessionMeta: null,
};

function readConfigFromQuery() {
  const params = new URLSearchParams(location.search);
  const t = parseInt(params.get('time'), 10);
  if (!Number.isNaN(t) && t > 10 && t <= 300) {
    state.time = t;
  }
  const diff = (params.get('diff') || 'normal').toLowerCase();
  if (['easy', 'normal', 'hard', 'extreme'].includes(diff)) {
    state.difficulty = diff;
  } else {
    state.difficulty = 'normal';
  }
  hud.timeVal.textContent = state.time;
}

function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vr';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// --- Meta persistence ---

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
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) {}
}

// --- i18n apply ---

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
  qs('#rMissLabel').textContent = t.rMiss;
  qs('#rAccLabel').textContent = t.rAcc;
  qs('#rComboLabel').textContent = t.rCombo;
  qs('#rFeverLabel').textContent = t.rFever;
  qs('#rBossLabel').textContent = t.rBoss;
  qs('#rTimeUsedLabel').textContent = t.rTimeUsed;

  qs('#playAgainLabel').textContent = t.playAgain;
  qs('#backHubLabel').textContent = t.backHub;
  qs('#downloadCsvLabel').textContent = t.downloadCsv;
}

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    langButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    lang = btn.dataset.lang || 'th';
    applyLang();
  });
});

// --- Game helpers ---

function resetStats() {
  state.elapsed = 0;
  state.score = 0;
  state.hit = 0;
  state.miss = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.fever = false;
  state.feverCount = 0;
  state.bossCleared = 0;
  state.lastBossAt = 0;
  state.bossIndex = 0; // เริ่มจาก Boss ตัวแรกทุกเกม
  hud.timeVal.textContent = state.time;
  hud.scoreVal.textContent = '0';
  hud.hitVal.textContent = '0';
  hud.missVal.textContent = '0';
  hud.comboVal.textContent = 'x0';
  gameArea.querySelectorAll('.target').forEach((t) => t.remove());
  if (!feverBadge || !feverBadge.parentNode) {
    feverBadge = qs('#feverBadge');
  }
  if (feverBadge) feverBadge.style.display = 'none';
  gameArea.classList.remove('shake');
}

function updateHUD() {
  hud.scoreVal.textContent = state.score;
  hud.hitVal.textContent = state.hit;
  hud.missVal.textContent = state.miss;
  hud.comboVal.textContent = 'x' + state.combo;
}

function setCoachMood(mode) {
  const t = i18n[lang];
  if (mode === 'fever') {
    hud.coachLine.textContent = t.coachFever;
  } else if (mode === 'boss') {
    hud.coachLine.textContent = t.coachBoss;
  } else {
    hud.coachLine.textContent = t.coachReady;
  }
}

function spawnTarget(kind = 'normal') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'target ' + kind;

  if (kind === 'boss') {
    const idx = state.bossIndex % BOSS_CONFIG.length;
    const cfg = BOSS_CONFIG[idx];
    const hp = computeBossHp(idx, state.difficulty);
    el.dataset.hp = String(hp);
    el.dataset.bossIndex = String(idx);
    el.textContent = cfg.emoji;
  } else if (kind === 'fever') {
    el.textContent = '⭐';
  } else {
    const icons = ['💥', '✨', '🌟', '🔥', '⚡'];
    el.textContent = icons[Math.floor(Math.random() * icons.length)];
  }

  const padding = 18;
  const rect = gameArea.getBoundingClientRect();
  const w = rect.width - padding * 2 - 76;
  const h = rect.height - padding * 2 - 76;

  const x = padding + Math.random() * (w > 0 ? w : 0);
  const y = padding + Math.random() * (h > 0 ? h : 0);

  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const life = kind === 'boss' ? 4000 : 1300;
  const bornAt = performance.now();

  const onExpire = () => {
    if (!gameArea.contains(el)) return;
    gameArea.removeChild(el);
    if (kind !== 'boss') {
      state.miss++;
      state.combo = 0;
      updateHUD();
    }
  };

  requestAnimationFrame(function check(ts) {
    if (!state.running) return;
    if (ts - bornAt >= life) {
      onExpire();
    } else if (gameArea.contains(el)) {
      requestAnimationFrame(check);
    }
  });

  el.addEventListener('click', () => {
    if (!state.running) return;
    if (!gameArea.contains(el)) return;

    el.classList.add('hit');
    setTimeout(() => gameArea.contains(el) && gameArea.removeChild(el), 90);

    let base = 10;
    if (kind === 'boss') {
      let hp = parseInt(el.dataset.hp || '1', 10) - 1;
      if (hp <= 0) {
        state.score += 200;
        state.hit++;
        state.combo++;
        state.bossCleared++;
        state.bossIndex++; // ขยับไปบอสตัวถัดไป
        gameArea.classList.add('shake');
        setTimeout(() => gameArea.classList.remove('shake'), 220);
      } else {
        el.dataset.hp = String(hp);
        state.score += 25;
        state.hit++;
        state.combo++;
      }
    } else {
      if (kind === 'fever') {
        base = 40;
        state.feverCount++;
      }
      const multiplier = state.fever ? 2 : 1;
      state.score += base * multiplier;
      state.hit++;
      state.combo++;
    }

    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // combo ≥ 5 → guaranteed fever
    if (state.combo >= 5 && !state.fever) {
      state.fever = true;
      if (!feverBadge || !feverBadge.parentNode) {
        feverBadge = qs('#feverBadge');
      }
      if (feverBadge) feverBadge.style.display = 'block';
      setCoachMood('fever');
      setTimeout(() => {
        state.fever = false;
        if (feverBadge) feverBadge.style.display = 'none';
        setCoachMood('normal');
      }, 2500);
    }

    if (kind === 'boss') {
      setCoachMood('boss');
      setTimeout(() => setCoachMood('normal'), 1800);
    }

    gameArea.classList.add('shake');
    setTimeout(() => gameArea.classList.remove('shake'), 140);
    updateHUD();
  });

  gameArea.appendChild(el);
}

function spawnLoop() {
  if (!state.running) return;

  const nowSec = state.elapsed;
  // Boss เป็นระยะ ๆ
  if (nowSec > 5 && nowSec - state.lastBossAt >= state.bossEvery) {
    state.lastBossAt = nowSec;
    spawnTarget('boss');
  }

  const feverChance = state.fever ? 0.4 : 0.14;
  const rnd = Math.random();
  if (rnd < feverChance) {
    spawnTarget('fever');
  } else {
    spawnTarget('normal');
  }

  const next = state.fever ? 420 + Math.random() * 180 : 650 + Math.random() * 300;
  state.spawnId = setTimeout(spawnLoop, next);
}

function tickTimer() {
  if (!state.running) return;
  state.elapsed += 1;
  const remain = Math.max(state.time - state.elapsed, 0);
  hud.timeVal.textContent = remain;

  if (remain <= 0) {
    endGame();
  }
}

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
    deviceType:
      metaInputs.deviceType.value === 'auto'
        ? detectDevice()
        : metaInputs.deviceType.value,
    note: metaInputs.note.value.trim(),
    language: lang,
  };
  state.sessionMeta = meta;
  saveMetaDraft();

  // ---- โหมดเล่นอย่างเดียว: ซ่อนฟอร์ม + ขยายจอเกม + เลื่อนไปโฟกัส ----
  document.body.classList.add('play-only');
  setTimeout(() => {
    const area = document.querySelector('#gameArea');
    if (area) area.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);

  resetStats();
  state.running = true;
  startBtn.disabled = true;
  startBtn.style.opacity = 0.7;

  setCoachMood('normal');

  if (state.timerId) clearInterval(state.timerId);
  if (state.spawnId) clearTimeout(state.spawnId);

  state.timerId = setInterval(tickTimer, 1000);
  state.spawnId = setTimeout(spawnLoop, 600);
}

function stopLoops() {
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.spawnId) {
    clearTimeout(state.spawnId);
    state.spawnId = null;
  }
}

function endGame() {
  if (!state.running) return;
  stopLoops();

  const played = Math.min(state.elapsed, state.time);
  const total = state.hit + state.miss;
  const acc = total > 0 ? Math.round((state.hit / total) * 100) : 0;

  logResearchRecord({
    gameId: 'shadow-breaker',
    sessionId: Date.now().toString(),
    studentId: state.sessionMeta?.studentId || '',
    schoolName: state.sessionMeta?.schoolName || '',
    classRoom: state.sessionMeta?.classRoom || '',
    deviceType: state.sessionMeta?.deviceType || detectDevice(),
    language: state.sessionMeta?.language || lang,
    note: state.sessionMeta?.note || '',
    mode: 'timed',
    difficulty: state.difficulty || 'normal',
    timeSec: state.time,
    score: state.score,
    hits: state.hit,
    miss: state.miss,
    accuracy: acc,
    maxCombo: state.maxCombo,
    feverCount: state.feverCount,
    bossCleared: state.bossCleared,
    timeUsedSec: played,
    createdAt: new Date().toISOString(),
  });

  r.score.textContent = state.score;
  r.hit.textContent = state.hit;
  r.miss.textContent = state.miss;
  r.acc.textContent = acc + '%';
  r.combo.textContent = 'x' + state.maxCombo;
  r.fever.textContent = state.feverCount;
  r.boss.textContent = state.bossCleared;
  r.timeUsed.textContent = played + 's';

  overlay.classList.remove('hidden');
}

function logResearchRecord(rec) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('Failed to store research record:', err);
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
      'deviceType',
      'language',
      'note',
      'gameId',
      'sessionId',
      'mode',
      'difficulty',
      'timeSec',
      'score',
      'hits',
      'miss',
      'accuracy',
      'maxCombo',
      'feverCount',
      'bossCleared',
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
  a.download = 'ShadowBreakerResearch.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Event wiring ---

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

// --- Init ---

readConfigFromQuery();
loadMeta();
applyLang();