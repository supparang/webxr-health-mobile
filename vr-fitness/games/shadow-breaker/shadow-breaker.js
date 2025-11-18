// === VR Fitness — Shadow Breaker (Research Production v1.0.0) ===
// - Research-ready (meta form + CSV log)
// - Timed mode (time from ?time=60, default 60s)
// - Difficulty (?diff=easy/normal/hard) → spawn rate + boss HP
// - Combo + FEVER (combo ≥ 5 → FEVER, critical gold target + จอสั่นแรง)
// - รองรับ 2 ภาษา TH/EN (ใช้ .lang-toggle button เหมือน Rhythm Boxer)

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.0.0-research';

const SB_STORAGE_KEY = 'ShadowBreakerResearch_v1';
const SB_META_KEY = 'ShadowBreakerMeta_v1';

// ---- CONFIG ----
// URL Apps Script (ถ้าจะส่งขึ้น Cloud ให้ใส่จริง แล้วตั้ง ENABLE_CLOUD_LOG = true)
const SB_GOOGLE_SCRIPT_URL = '';

const SB_ENABLE_MUSIC = false;       // เปิดเมื่อมีไฟล์เพลงจริง + ใส่ SB_MUSIC_SRC
const SB_ENABLE_CLOUD_LOG = false;   // เปิดเมื่อมี Apps Script URL
const SB_ENABLE_FX = true;

// ถ้ามีเพลงจริงค่อยใส่ path แล้วเปิด SB_ENABLE_MUSIC
const SB_MUSIC_SRC = './assets/sb-bgm.mp3';

// ---- Query params (phase, time, diff) ----
function sbGetPhase() {
  const p = new URLSearchParams(location.search).get('phase') || 'train';
  const n = p.toLowerCase();
  if (['pre', 'train', 'post'].includes(n)) return n;
  return 'train';
}
function sbGetTimeSec() {
  const t = parseInt(new URLSearchParams(location.search).get('time'), 10);
  if (Number.isFinite(t) && t >= 20 && t <= 300) return t;
  return 60; // default 60s
}
function sbGetDiff() {
  const d = (new URLSearchParams(location.search).get('diff') || 'normal').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'normal';
}

const sbPhase = sbGetPhase();
const sbTimeSec = sbGetTimeSec();
const sbDiff = sbGetDiff();

// ---- DOM helpers ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sbGameArea = $('#gameArea');
const sbFeedbackEl = $('#feedback');
const sbStartBtn = $('#startBtn');
const sbLangButtons = $$('.lang-toggle button');

const sbMetaInputs = {
  studentId: $('#studentId'),
  schoolName: $('#schoolName'),
  classRoom: $('#classRoom'),
  groupCode: $('#groupCode'),
  deviceType: $('#deviceType'),
  note: $('#note'),
};

const sbHUD = {
  timeVal: $('#timeVal'),
  scoreVal: $('#scoreVal'),
  hitVal: $('#hitVal'),
  missVal: $('#missVal'),
  comboVal: $('#comboVal'),
  coachLine: $('#coachLine'),
};

const sbOverlay = $('#resultOverlay');
const sbR = {
  score: $('#rScore'),
  hit: $('#rHit'),
  perfect: $('#rPerfect'),
  good: $('#rGood'),
  miss: $('#rMiss'),
  acc: $('#rAcc'),
  combo: $('#rCombo'),
  timeUsed: $('#rTimeUsed'),
};

const sbPlayAgainBtn = $('#playAgainBtn');
const sbBackHubBtn = $('#backHubBtn');
const sbDownloadCsvBtn = $('#downloadCsvBtn');

// ---- i18n ----
const sbI18n = {
  th: {
    metaTitle: 'ข้อมูลสำหรับงานวิจัย',
    metaHint:
      'กรอกเพียงครั้งเดียวก่อนเริ่ม ระบบจะบันทึกทุกครั้งที่เล่นเป็น 1 รอบการทดลอง.',
    startLabel: 'เริ่มเล่น',
    coachReady: 'โค้ชพุ่ง: เล็งให้ไว แล้วต่อยให้โดนเป้า! 👊',
    coachGood: 'สวยมาก! ต่อคอมโบให้ยาว ๆ เลย! ✨',
    coachMiss: 'พลาดนิดเดียว ไม่เป็นไร ลองใหม่! 💪',
    coachFever: 'FEVER!! ทุบให้สุดแรงเลย!! 🔥',
    tagGoal:
      'เป้าหมาย: ต่อยเป้าให้ทันเวลา เน้นความแม่นยำและคอมโบต่อเนื่อง (มีบอสโผล่มาเป็นระยะ)',
    lblTime: 'เวลา',
    lblScore: 'คะแนน',
    lblHit: 'โดนเป้า',
    lblMiss: 'พลาด',
    lblCombo: 'คอมโบ',
    resultTitle: '🏁 สรุปผล Shadow Breaker',
    rScore: 'คะแนนรวม',
    rHit: 'จำนวนครั้งที่โดนเป้า',
    rPerfect: 'Perfect (โดนเต็ม ๆ)',
    rGood: 'Good (โดนนิดหน่อย)',
    rMiss: 'Miss (พลาด)',
    rAcc: 'ความแม่นยำ',
    rCombo: 'คอมโบสูงสุด',
    rTimeUsed: 'เวลาเล่นต่อรอบ',
    playAgain: 'เล่นอีกครั้ง',
    backHub: 'กลับเมนูหลัก',
    downloadCsv: 'ดาวน์โหลด CSV ข้อมูลวิจัย (ทุก session)',
    alertMeta: 'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
    feverLabel: 'FEVER!!',
  },
  en: {
    metaTitle: 'Research meta (per session)',
    metaHint:
      'Fill this once. Each Shadow Breaker run will be logged as a separate session.',
    startLabel: 'Start',
    coachReady: 'Coach Pung: Aim fast and smash the targets! 👊',
    coachGood: 'Nice! Keep the combo going! ✨',
    coachMiss: 'Missed a bit. Try again! 💪',
    coachFever: 'FEVER!! Smash everything!! 🔥',
    tagGoal:
      'Goal: Break as many targets as possible within the time limit. Watch the combo and mini-bosses.',
    lblTime: 'TIME',
    lblScore: 'SCORE',
    lblHit: 'HIT',
    lblMiss: 'MISS',
    lblCombo: 'COMBO',
    resultTitle: '🏁 Shadow Breaker Result',
    rScore: 'Total Score',
    rHit: 'Hits',
    rPerfect: 'Perfect',
    rGood: 'Good',
    rMiss: 'Miss',
    rAcc: 'Accuracy',
    rCombo: 'Best Combo',
    rTimeUsed: 'Played Time',
    playAgain: 'Play again',
    backHub: 'Back to Hub',
    downloadCsv: 'Download research CSV (all sessions)',
    alertMeta: 'Please fill at least the Student ID before starting.',
    feverLabel: 'FEVER!!',
  },
};

let sbLang = 'th';

// ---- Phase / diff label (optional: set somewhere in UI if needed) ----
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vr';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---- Audio ----
let sbMusic = null;
function sbInitAudio() {
  if (!SB_ENABLE_MUSIC) return;
  try {
    sbMusic = new Audio();
    sbMusic.src = SB_MUSIC_SRC;
    sbMusic.preload = 'auto';
    sbMusic.volume = 0.85;
    sbMusic.addEventListener('error', () => {
      console.warn('[ShadowBreaker] Music error:', sbMusic && sbMusic.error);
    });
  } catch (e) {
    console.warn('[ShadowBreaker] initAudio failed:', e);
  }
}
function sbPlayMusic() {
  if (!SB_ENABLE_MUSIC || !sbMusic) return;
  try {
    const p = sbMusic.play();
    if (p && p.catch) {
      p.catch((err) => console.warn('[ShadowBreaker] play blocked:', err));
    }
  } catch (e) {
    console.warn('[ShadowBreaker] playMusic failed:', e);
  }
}
function sbStopMusic() {
  if (!SB_ENABLE_MUSIC || !sbMusic) return;
  try {
    sbMusic.pause();
  } catch (_) {}
}

// ---- Game state ----
const sbState = {
  running: false,
  startTime: 0,
  elapsedMs: 0,
  durationMs: sbTimeSec * 1000,
  spawnTimer: null,
  targets: [],
  score: 0,
  hit: 0,
  perfect: 0,
  good: 0,
  miss: 0,
  combo: 0,
  maxCombo: 0,
  fever: false,
  feverUntil: 0,
  sessionMeta: null,
  phase: sbPhase,
  diff: sbDiff,
};

// diff config → spawn interval, bossHP
const sbDiffCfg = {
  easy: { spawnMs: 900, bossHp: 5 },
  normal: { spawnMs: 700, bossHp: 8 },
  hard: { spawnMs: 520, bossHp: 12 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// ---- Meta persistence ----
function sbLoadMeta() {
  try {
    const raw = localStorage.getItem(SB_META_KEY);
    if (!raw) return;
    const meta = JSON.parse(raw);
    Object.entries(sbMetaInputs).forEach(([k, el]) => {
      if (meta[k] && el) el.value = meta[k];
    });
  } catch (_) {}
}
function sbSaveMetaDraft() {
  const meta = {};
  Object.entries(sbMetaInputs).forEach(([k, el]) => {
    meta[k] = el.value.trim();
  });
  try {
    localStorage.setItem(SB_META_KEY, JSON.stringify(meta));
  } catch (_) {}
}

// ---- i18n apply ----
function sbApplyLang() {
  const t = sbI18n[sbLang];
  $('#metaTitle') && ($('#metaTitle').textContent = t.metaTitle);
  $('#metaHint') && ($('#metaHint').textContent = t.metaHint);
  $('#startLabel') && ($('#startLabel').textContent = t.startLabel);
  sbHUD.coachLine.textContent = t.coachReady;
  $('#tagGoal') && ($('#tagGoal').textContent = t.tagGoal);

  $('#lblTime') && ($('#lblTime').textContent = t.lblTime.toUpperCase());
  $('#lblScore') && ($('#lblScore').textContent = t.lblScore.toUpperCase());
  $('#lblHit') && ($('#lblHit').textContent = t.lblHit.toUpperCase());
  $('#lblMiss') && ($('#lblMiss').textContent = t.lblMiss.toUpperCase());
  $('#lblCombo') && ($('#lblCombo').textContent = t.lblCombo.toUpperCase());

  $('#resultTitle') && ($('#resultTitle').textContent = t.resultTitle);
  $('#rScoreLabel') && ($('#rScoreLabel').textContent = t.rScore);
  $('#rHitLabel') && ($('#rHitLabel').textContent = t.rHit);
  $('#rPerfectLabel') && ($('#rPerfectLabel').textContent = t.rPerfect);
  $('#rGoodLabel') && ($('#rGoodLabel').textContent = t.rGood);
  $('#rMissLabel') && ($('#rMissLabel').textContent = t.rMiss);
  $('#rAccLabel') && ($('#rAccLabel').textContent = t.rAcc);
  $('#rComboLabel') && ($('#rComboLabel').textContent = t.rCombo);
  $('#rTimeUsedLabel') && ($('#rTimeUsedLabel').textContent = t.rTimeUsed);

  $('#playAgainLabel') && ($('#playAgainLabel').textContent = t.playAgain);
  $('#backHubLabel') && ($('#backHubLabel').textContent = t.backHub);
  $('#downloadCsvLabel') && ($('#downloadCsvLabel').textContent = t.downloadCsv);

  const pdpaEl = $('#metaPDPA');
  if (pdpaEl) {
    pdpaEl.textContent =
      sbLang === 'th'
        ? '* ข้อมูลนี้ใช้เพื่อการวิจัยด้านการออกกำลังกายเท่านั้น และจะไม่เปิดเผยตัวตนรายบุคคล'
        : '* Collected data (e.g., Student ID, group, score) is used only for exercise research and will not reveal individual identities.';
  }
}
sbLangButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    sbLangButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    sbLang = btn.dataset.lang || 'th';
    sbApplyLang();
  });
});

// ---- HUD / FX ----
function sbResetStats() {
  sbState.score = 0;
  sbState.hit = 0;
  sbState.perfect = 0;
  sbState.good = 0;
  sbState.miss = 0;
  sbState.combo = 0;
  sbState.maxCombo = 0;
  sbState.elapsedMs = 0;
  sbState.fever = false;
  sbState.feverUntil = 0;
  sbState.targets = [];

  sbHUD.scoreVal.textContent = '0';
  sbHUD.hitVal.textContent = '0';
  sbHUD.missVal.textContent = '0';
  sbHUD.comboVal.textContent = 'x0';
  sbFeedbackEl.style.display = 'none';

  if (sbGameArea) {
    sbGameArea.querySelectorAll('.sb-target').forEach((t) => t.remove());
  }
  sbHUD.timeVal.textContent = Math.round(sbState.durationMs / 1000);
}

function sbUpdateHUD() {
  sbHUD.scoreVal.textContent = sbState.score;
  sbHUD.hitVal.textContent = sbState.hit;
  sbHUD.missVal.textContent = sbState.miss;
  sbHUD.comboVal.textContent = 'x' + sbState.combo;
}

function sbFxScreenHit(intense) {
  if (!SB_ENABLE_FX || !sbGameArea || !sbGameArea.animate) return;
  const power = intense ? 4 : 2;
  sbGameArea.animate(
    [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${-power}px,0) scale(1.01)` },
      { transform: `translate(${power}px,0) scale(1.02)` },
      { transform: 'translate(0,0) scale(1)' },
    ],
    { duration: intense ? 220 : 140, easing: 'ease-out' }
  );
}

function sbShowFeedback(type) {
  const t = sbI18n[sbLang];
  let txt = '';
  if (type === 'fever') txt = t.feverLabel || 'FEVER!!';
  else if (type === 'perfect')
    txt = sbLang === 'th' ? 'Perfect! 💥' : 'PERFECT!';
  else if (type === 'good')
    txt = sbLang === 'th' ? 'ดีมาก! ✨' : 'GOOD!';
  else txt = sbLang === 'th' ? 'พลาด!' : 'MISS';

  sbFeedbackEl.textContent = txt;
  sbFeedbackEl.className = 'feedback ' + type;
  sbFeedbackEl.style.display = 'block';
  setTimeout(() => {
    sbFeedbackEl.style.display = 'none';
  }, type === 'fever' ? 800 : 420);
}

// ---- Target spawn ----
let sbTargetIdCounter = 1;

function sbSpawnTarget(isBoss = false) {
  if (!sbGameArea) return;
  const rect = sbGameArea.getBoundingClientRect();

  const sizeBase = isBoss ? 90 : 56;
  const hpBase = isBoss ? sbCfg.bossHp : 1;
  const tObj = {
    id: sbTargetIdCounter++,
    boss: isBoss,
    hp: hpBase,
    createdAt: performance.now(),
    el: null,
    alive: true,
  };

  const el = document.createElement('div');
  el.className = 'sb-target';
  el.dataset.id = String(tObj.id);
  el.dataset.hp = String(tObj.hp);
  el.style.position = 'absolute';
  el.style.width = sizeBase + 'px';
  el.style.height = sizeBase + 'px';
  el.style.borderRadius = '999px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontSize = isBoss ? '2rem' : '1.6rem';
  el.style.cursor = 'pointer';
  el.style.boxShadow =
    '0 18px 40px rgba(15,23,42,0.9), 0 0 0 1px rgba(148,163,184,0.9)';

  if (isBoss) {
    el.style.background =
      'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
    el.textContent = '💣';
  } else {
    if (sbState.fever) {
      el.style.background =
        'radial-gradient(circle at 30% 20%, #facc15, #eab308)';
      el.textContent = '⭐';
    } else {
      el.style.background =
        'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
      el.textContent = '🎯';
    }
  }

  const padding = 20;
  const maxX = rect.width - sizeBase - padding;
  const maxY = rect.height - sizeBase - padding;
  const x = padding + Math.random() * maxX;
  const y = padding + Math.random() * maxY;
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  el.addEventListener('click', () => sbHitTarget(tObj, false));

  sbGameArea.appendChild(el);
  tObj.el = el;
  sbState.targets.push(tObj);

  if (isBoss) {
    el.animate(
      [
        { transform: 'scale(0.7)', opacity: 0 },
        { transform: 'scale(1.05)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 260, easing: 'ease-out' }
    );
  } else if (sbState.fever) {
    el.animate(
      [
        { transform: 'scale(0.6)', opacity: 0 },
        { transform: 'scale(1.1)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 220, easing: 'ease-out' }
    );
  } else {
    el.animate(
      [
        { transform: 'scale(0.7)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 160, easing: 'ease-out' }
    );
  }

  const lifeMs = isBoss ? 5000 : 2000;
  setTimeout(() => {
    if (!tObj.alive) return;
    tObj.alive = false;
    if (tObj.el && tObj.el.parentNode) {
      tObj.el.parentNode.removeChild(tObj.el);
    }
    // ถ้าหลุดโดยไม่โดน → นับ Miss
    sbState.miss++;
    sbState.combo = 0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    sbFxScreenHit(false);
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;
  }, lifeMs);
}

function sbMaybeSpawnBoss(elapsedMs) {
  // 4 boss ช่วง 10%, 30%, 60%, 85% ของเวลา
  const ms = sbState.durationMs;
  const checkpoints = [0.1, 0.3, 0.6, 0.85].map((r) => Math.round(ms * r));
  checkpoints.forEach((point, idx) => {
    const key = 'boss' + idx;
    if (!sbState[key] && elapsedMs >= point) {
      sbState[key] = true;
      sbSpawnTarget(true);
    }
  });
}

// ---- Hit logic ----
function sbEnterFever() {
  const t = sbI18n[sbLang];
  sbState.fever = true;
  sbState.feverUntil = performance.now() + 3500;
  sbHUD.coachLine.textContent = t.coachFever;
  sbShowFeedback('fever');
  sbFxScreenHit(true);

  if (sbGameArea && SB_ENABLE_FX && sbGameArea.animate) {
    sbGameArea.animate(
      [
        { boxShadow: '0 0 0 0 rgba(249,115,22,0.0)' },
        { boxShadow: '0 0 32px 4px rgba(249,115,22,0.9)' },
        { boxShadow: '0 0 0 0 rgba(249,115,22,0.0)' },
      ],
      { duration: 900, easing: 'ease-out' }
    );
  }
}
function sbCheckFeverTick(now) {
  if (sbState.fever && now >= sbState.feverUntil) {
    sbState.fever = false;
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
  }
}

function sbHitTarget(tObj, isFromKey) {
  if (!sbState.running || !tObj.alive) return;

  tObj.hp -= 1;
  if (tObj.hp > 0) {
    if (tObj.el) {
      tObj.el.dataset.hp = String(tObj.hp);
      tObj.el.animate(
        [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.08)', filter: 'brightness(1.4)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 120, easing: 'ease-out' }
      );
    }
    sbState.hit++;
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);
    const base = tObj.boss ? 80 : 50;
    const comboBonus = Math.min(sbState.combo * 5, 60);
    sbState.score += base + comboBonus;
    sbUpdateHUD();
    sbShowFeedback('good');
    sbFxScreenHit(false);
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;
    return;
  }

  tObj.alive = false;
  if (tObj.el && tObj.el.parentNode) {
    tObj.el.classList.add('hit');
    setTimeout(() => {
      if (tObj.el && tObj.el.parentNode) tObj.el.parentNode.removeChild(tObj.el);
    }, 120);
  }

  sbState.hit++;
  sbState.perfect++;
  sbState.combo++;
  sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

  const base = tObj.boss ? 200 : 80;
  const comboBonus = Math.min(sbState.combo * 8, 100);
  const feverBonus = sbState.fever ? 80 : 0;
  sbState.score += base + comboBonus + feverBonus;

  if (sbState.combo >= 5 && !sbState.fever) {
    sbEnterFever();
  } else {
    sbShowFeedback('perfect');
    sbFxScreenHit(false);
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;
  }

  sbUpdateHUD();
}

// keyboard: space → หา target ใกล้กลางจอสุด (สำหรับ PC)
window.addEventListener('keydown', (ev) => {
  if (!sbState.running) return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let best = null;
    let bestDist = Infinity;
    for (const tObj of sbState.targets) {
      if (!tObj.alive || !tObj.el) continue;
      const r = tObj.el.getBoundingClientRect();
      const tx = r.left + r.width / 2;
      const ty = r.top + r.height / 2;
      const dx = tx - cx;
      const dy = ty - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = tObj;
      }
    }
    if (best) sbHitTarget(best, true);
  }
});

// ---- Loop ----
function sbMainLoop(now) {
  if (!sbState.running) return;
  if (!sbState.startTime) sbState.startTime = now;
  sbState.elapsedMs = now - sbState.startTime;

  const remain = Math.max(
    0,
    Math.round((sbState.durationMs - sbState.elapsedMs) / 1000)
  );
  sbHUD.timeVal.textContent = remain;

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss(sbState.elapsedMs);

  if (sbState.elapsedMs >= sbState.durationMs) {
    sbEndGame();
    return;
  }

  requestAnimationFrame(sbMainLoop);
}

// ---- Spawn timer ----
function sbStartSpawnLoop() {
  if (sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = setInterval(() => {
    if (!sbState.running) return;
    const roll = Math.random();
    const bossChance = sbState.fever ? 0.05 : 0.02;
    if (roll < bossChance) sbSpawnTarget(true);
    else sbSpawnTarget(false);
  }, sbCfg.spawnMs);
}
function sbStopSpawnLoop() {
  if (sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = null;
}

// ---- Logging ----
function sbLogLocal(rec) {
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('[ShadowBreaker] local log failed:', err);
  }
}
async function sbLogCloud(rec) {
  if (!SB_ENABLE_CLOUD_LOG) return;
  if (!SB_GOOGLE_SCRIPT_URL || SB_GOOGLE_SCRIPT_URL.indexOf('http') !== 0)
    return;
  try {
    await fetch(SB_GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
      mode: 'no-cors',
    });
  } catch (err) {
    console.warn('[ShadowBreaker] cloud log failed:', err);
  }
}

function sbDownloadCsv() {
  let rows = [];
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    if (!raw) {
      alert('ยังไม่มีข้อมูล session ของ Shadow Breaker');
      return;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      alert('ยังไม่มีข้อมูล session ของ Shadow Breaker');
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
      'diff',
      'gameId',
      'gameVersion',
      'sessionId',
      'timeSec',
      'score',
      'hits',
      'perfect',
      'good',
      'miss',
      'accuracy',
      'maxCombo',
      'fever',
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

// ---- End game ----
function sbEndGame() {
  if (!sbState.running) return;
  sbState.running = false;
  sbStopSpawnLoop();
  sbStopMusic();

  const playedSec = Math.round(sbState.elapsedMs / 1000);
  const totalHit = sbState.hit;
  const totalMiss = sbState.miss;
  const totalAttempts = totalHit + totalMiss;
  const acc = totalAttempts > 0 ? Math.round((totalHit / totalAttempts) * 100) : 0;

  const rec = {
    studentId: sbState.sessionMeta?.studentId || '',
    schoolName: sbState.sessionMeta?.schoolName || '',
    classRoom: sbState.sessionMeta?.classRoom || '',
    groupCode: sbState.sessionMeta?.groupCode || '',
    deviceType: sbState.sessionMeta?.deviceType || sbDetectDevice(),
    language: sbState.sessionMeta?.language || sbLang,
    note: sbState.sessionMeta?.note || '',
    phase: sbState.phase,
    diff: sbState.diff,
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    sessionId: Date.now().toString(),
    timeSec: Math.round(sbState.durationMs / 1000),
    score: sbState.score,
    hits: totalHit,
    perfect: sbState.perfect,
    good: sbState.good,
    miss: sbState.miss,
    accuracy: acc,
    maxCombo: sbState.maxCombo,
    fever: sbState.fever ? 1 : 0,
    timeUsedSec: playedSec,
    createdAt: new Date().toISOString(),
  };

  sbLogLocal(rec);
  sbLogCloud(rec);

  sbR.score.textContent = sbState.score;
  sbR.hit.textContent = totalHit;
  sbR.perfect.textContent = sbState.perfect;
  sbR.good.textContent = sbState.good;
  sbR.miss.textContent = sbState.miss;
  sbR.acc.textContent = acc + '%';
  sbR.combo.textContent = 'x' + sbState.maxCombo;
  sbR.timeUsed.textContent = playedSec + 's';

  sbOverlay.classList.remove('hidden');
}

// ---- Start game ----
function sbStartGame() {
  if (sbState.running) return;

  const t = sbI18n[sbLang];
  const studentId = sbMetaInputs.studentId.value.trim();
  if (!studentId) {
    alert(t.alertMeta);
    return;
  }

  const meta = {
    studentId,
    schoolName: sbMetaInputs.schoolName.value.trim(),
    classRoom: sbMetaInputs.classRoom.value.trim(),
    groupCode: sbMetaInputs.groupCode.value.trim(),
    deviceType:
      sbMetaInputs.deviceType.value === 'auto'
        ? sbDetectDevice()
        : sbMetaInputs.deviceType.value,
    note: sbMetaInputs.note.value.trim(),
    language: sbLang,
  };
  sbState.sessionMeta = meta;
  sbSaveMetaDraft();

  document.body.classList.add('play-only');

  sbResetStats();
  sbState.running = true;
  sbState.startTime = 0;

  sbStartBtn.disabled = true;
  sbStartBtn.style.opacity = 0.7;

  sbHUD.coachLine.textContent = t.coachReady;

  setTimeout(() => {
    sbPlayMusic();
    requestAnimationFrame(sbMainLoop);
    sbStartSpawnLoop();
  }, 600);
}

// ---- Events ----
sbStartBtn && sbStartBtn.addEventListener('click', sbStartGame);

sbPlayAgainBtn &&
  sbPlayAgainBtn.addEventListener('click', () => {
    sbOverlay.classList.add('hidden');
    sbStartBtn.disabled = false;
    sbStartBtn.style.opacity = 1;
    sbStartGame();
  });

sbBackHubBtn &&
  sbBackHubBtn.addEventListener('click', () => {
    location.href = '../index.html';
  });

sbDownloadCsvBtn &&
  sbDownloadCsvBtn.addEventListener('click', sbDownloadCsv);

Object.values(sbMetaInputs).forEach((el) => {
  if (!el) return;
  el.addEventListener('change', sbSaveMetaDraft);
  el.addEventListener('blur', sbSaveMetaDraft);
});

// ---- Init ----
sbLoadMeta();
sbApplyLang();
sbInitAudio();
sbHUD.timeVal.textContent = sbTimeSec.toString();