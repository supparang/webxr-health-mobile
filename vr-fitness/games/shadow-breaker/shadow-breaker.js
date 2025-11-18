// === VR Fitness — Shadow Breaker (Research Production v1.2.0) ===
// - Emoji targets + 4 themed bosses
// - Boss sequence (4 bosses per run, easy → hard)
// - Boss HP HUD: แสดงเฉพาะตอนใกล้ตายแต่ละตัว
// - Boss banner warnings + clear message
// - FEVER mode: glow + screen shake + high score
// - Target shatter FX + floating "+score"
// - Research logging + CSV (localStorage)

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.2.0-research';

const SB_STORAGE_KEY = 'ShadowBreakerResearch_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';

// ---- CONFIG ----
const SB_GOOGLE_SCRIPT_URL = '';   // ใส่ Apps Script URL ถ้าจะใช้ Cloud
const SB_ENABLE_MUSIC      = false;
const SB_ENABLE_CLOUD_LOG  = false;
const SB_ENABLE_FX         = true;

// เพลง (ถ้ามีไฟล์จริงค่อยเปิด SB_ENABLE_MUSIC)
const SB_MUSIC_SRC = './assets/sb-bgm.mp3';

// ---- Query helpers: phase / time / diff ----
function sbGetPhase() {
  const p = new URLSearchParams(location.search).get('phase') || 'train';
  const n = p.toLowerCase();
  return ['pre','train','post'].includes(n) ? n : 'train';
}
function sbGetTimeSec() {
  const t = parseInt(new URLSearchParams(location.search).get('time'), 10);
  if (Number.isFinite(t) && t >= 20 && t <= 300) return t;
  return 60;
}
function sbGetDiff() {
  const d = (new URLSearchParams(location.search).get('diff') || 'normal').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'normal';
}

const sbPhase   = sbGetPhase();
const sbTimeSec = sbGetTimeSec();
const sbDiff    = sbGetDiff();

// ---- DOM helpers ----
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sbGameArea    = $('#gameArea');
const sbFeedbackEl  = $('#feedback');
const sbStartBtn    = $('#startBtn');
const sbLangButtons = $$('.lang-toggle button');

const sbMetaInputs = {
  studentId:  $('#studentId'),
  schoolName: $('#schoolName'),
  classRoom:  $('#classRoom'),
  groupCode:  $('#groupCode'),
  deviceType: $('#deviceType'),
  note:       $('#note'),
};

const sbHUD = {
  timeVal:   $('#timeVal'),
  scoreVal:  $('#scoreVal'),
  hitVal:    $('#hitVal'),
  missVal:   $('#missVal'),
  comboVal:  $('#comboVal'),
  coachLine: $('#coachLine'),
};

const sbOverlay = $('#resultOverlay');
const sbR = {
  score:    $('#rScore'),
  hit:      $('#rHit'),
  perfect:  $('#rPerfect'),
  good:     $('#rGood'),
  miss:     $('#rMiss'),
  acc:      $('#rAcc'),
  combo:    $('#rCombo'),
  timeUsed: $('#rTimeUsed'),
};

const sbPlayAgainBtn   = $('#playAgainBtn');
const sbBackHubBtn     = $('#backHubBtn');
const sbDownloadCsvBtn = $('#downloadCsvBtn');

// ---- Boss & emoji config ----
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];

const SB_BOSSES = [
  {
    id: 1,
    emoji: '⛈️',
    nameTh: 'บอสเมฆสายฟ้า',
    nameEn: 'Thunder Cloud',
    hpBonus: 0,
  },
  {
    id: 2,
    emoji: '🥊',
    nameTh: 'บอสกำปั้นเหล็ก',
    nameEn: 'Iron Fist',
    hpBonus: 2,
  },
  {
    id: 3,
    emoji: '🐙',
    nameTh: 'บอสหมึกเทอร์โบ',
    nameEn: 'Turbo Octopus',
    hpBonus: 4,
  },
  {
    id: 4,
    emoji: '🐲',
    nameTh: 'บอสมังกรจังหวะทอง',
    nameEn: 'Golden Rhythm Dragon',
    hpBonus: 6,
  },
];

// ความยาก
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6 },
  normal: { spawnMs: 700, bossHp: 9 },
  hard:   { spawnMs: 520, bossHp: 12 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// ---- i18n ----
const sbI18n = {
  th: {
    metaTitle: 'ข้อมูลสำหรับงานวิจัย',
    metaHint:
      'กรอกเพียงครั้งเดียวก่อนเริ่ม ระบบจะบันทึกทุกครั้งที่เล่นเป็น 1 รอบการทดลอง.',
    startLabel: 'เริ่มเล่น',
    coachReady: 'โค้ชพุ่ง: เล็งให้ไว แล้วต่อยให้โดนเป้า! 👊',
    coachGood:  'สวยมาก! ต่อคอมโบให้ยาว ๆ เลย! ✨',
    coachMiss:  'พลาดนิดเดียว ไม่เป็นไร ลองใหม่! 💪',
    coachFever: 'FEVER!! ทุบให้สุดแรงเลย!! 🔥',
    tagGoal:
      'เป้าหมาย: ต่อยเป้า emoji ให้ทันเวลา เน้นความแม่นยำและคอมโบต่อเนื่อง (มีบอส 4 ตัวโผล่มาเป็นระยะ).',
    lblTime:  'เวลา',
    lblScore: 'คะแนน',
    lblHit:   'โดนเป้า',
    lblMiss:  'พลาด',
    lblCombo: 'คอมโบ',
    resultTitle:   '🏁 สรุปผล Shadow Breaker',
    rScore:        'คะแนนรวม',
    rHit:          'จำนวนครั้งที่โดนเป้า',
    rPerfect:      'Perfect (โดนเต็ม ๆ)',
    rGood:         'Good (โดนนิดหน่อย)',
    rMiss:         'Miss (พลาด)',
    rAcc:          'ความแม่นยำ',
    rCombo:        'คอมโบสูงสุด',
    rTimeUsed:     'เวลาเล่นต่อรอบ',
    playAgain:     'เล่นอีกครั้ง',
    backHub:       'กลับเมนูหลัก',
    downloadCsv:   'ดาวน์โหลด CSV ข้อมูลวิจัย (ทุก session)',
    alertMeta:     'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
    feverLabel:    'FEVER!!',
    bossNear:      (name) => `ใกล้จะล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
    bossClear:     (name) => `พิชิต ${name} แล้ว! เตรียมรับมือบอสถัดไป! 🔥`,
  },
  en: {
    metaTitle: 'Research meta (per session)',
    metaHint:
      'Fill this once. Each Shadow Breaker run will be logged as a separate session.',
    startLabel: 'Start',
    coachReady: 'Coach Pung: Aim fast and smash the emoji targets! 👊',
    coachGood:  'Nice! Keep the combo going! ✨',
    coachMiss:  'Missed a bit. Try again! 💪',
    coachFever: 'FEVER!! Smash everything!! 🔥',
    tagGoal:
      'Goal: Break as many emoji targets as possible. Keep combo and defeat 4 bosses!',
    lblTime:  'TIME',
    lblScore: 'SCORE',
    lblHit:   'HIT',
    lblMiss:  'MISS',
    lblCombo: 'COMBO',
    resultTitle:   '🏁 Shadow Breaker Result',
    rScore:        'Total Score',
    rHit:          'Hits',
    rPerfect:      'Perfect',
    rGood:         'Good',
    rMiss:         'Miss',
    rAcc:          'Accuracy',
    rCombo:        'Best Combo',
    rTimeUsed:     'Played Time',
    playAgain:     'Play again',
    backHub:       'Back to Hub',
    downloadCsv:   'Download research CSV (all sessions)',
    alertMeta:     'Please fill at least the Student ID before starting.',
    feverLabel:    'FEVER!!',
    bossNear:      (name) => `Almost defeat ${name}! Finish it! ⚡`,
    bossClear:     (name) => `You beat ${name}! Next boss incoming! 🔥`,
  },
};

let sbLang = 'th';

// ---- Device detect ----
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
  } catch (e) {
    console.warn('[ShadowBreaker] initAudio failed:', e);
  }
}
function sbPlayMusic() {
  if (!SB_ENABLE_MUSIC || !sbMusic) return;
  try {
    const p = sbMusic.play();
    if (p && p.catch) p.catch(()=>{});
  } catch (e) {
    console.warn('[ShadowBreaker] playMusic failed:', e);
  }
}
function sbStopMusic() {
  if (!SB_ENABLE_MUSIC || !sbMusic) return;
  try { sbMusic.pause(); } catch(_) {}
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
  bossQueue: [],          // [{bossIndex, spawnAtMs}]
  bossActive: false,
  bossWarned: false,
  activeBossId: null,
  activeBossInfo: null,
};

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
  try { localStorage.setItem(SB_META_KEY, JSON.stringify(meta)); } catch(_) {}
}

// ---- i18n apply ----
function sbApplyLang() {
  const t = sbI18n[sbLang];
  $('#metaTitle')   && ($('#metaTitle').textContent   = t.metaTitle);
  $('#metaHint')    && ($('#metaHint').textContent    = t.metaHint);
  $('#startLabel')  && ($('#startLabel').textContent  = t.startLabel);
  sbHUD.coachLine && (sbHUD.coachLine.textContent = t.coachReady);
  $('#tagGoal')     && ($('#tagGoal').textContent     = t.tagGoal);

  $('#lblTime')  && ($('#lblTime').textContent  = t.lblTime.toUpperCase());
  $('#lblScore') && ($('#lblScore').textContent = t.lblScore.toUpperCase());
  $('#lblHit')   && ($('#lblHit').textContent   = t.lblHit.toUpperCase());
  $('#lblMiss')  && ($('#lblMiss').textContent  = t.lblMiss.toUpperCase());
  $('#lblCombo') && ($('#lblCombo').textContent = t.lblCombo.toUpperCase());

  $('#resultTitle')     && ($('#resultTitle').textContent     = t.resultTitle);
  $('#rScoreLabel')     && ($('#rScoreLabel').textContent     = t.rScore);
  $('#rHitLabel')       && ($('#rHitLabel').textContent       = t.rHit);
  $('#rPerfectLabel')   && ($('#rPerfectLabel').textContent   = t.rPerfect);
  $('#rGoodLabel')      && ($('#rGoodLabel').textContent      = t.rGood);
  $('#rMissLabel')      && ($('#rMissLabel').textContent      = t.rMiss);
  $('#rAccLabel')       && ($('#rAccLabel').textContent       = t.rAcc);
  $('#rComboLabel')     && ($('#rComboLabel').textContent     = t.rCombo);
  $('#rTimeUsedLabel')  && ($('#rTimeUsedLabel').textContent  = t.rTimeUsed);

  $('#playAgainLabel')   && ($('#playAgainLabel').textContent   = t.playAgain);
  $('#backHubLabel')     && ($('#backHubLabel').textContent     = t.backHub);
  $('#downloadCsvLabel') && ($('#downloadCsvLabel').textContent = t.downloadCsv);

  const pdpaEl = $('#metaPDPA');
  if (pdpaEl) {
    pdpaEl.textContent =
      sbLang === 'th'
        ? '* ข้อมูลนี้ใช้เพื่อการวิจัยด้านการออกกำลังกายเท่านั้น และจะไม่เปิดเผยตัวตนรายบุคคล'
        : '* Collected data (e.g., Student ID, group, score) is used only for exercise research and will not reveal individual identities.';
  }
}

sbLangButtons.forEach((btn)=>{
  btn.addEventListener('click',()=>{
    sbLangButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sbLang = btn.dataset.lang || 'th';
    sbApplyLang();
  });
});

// ---- Boss banner (ข้อความเตือนด้านบน) ----
let sbBossBanner = null;
function sbInitBossBanner() {
  if (sbBossBanner) return;
  sbBossBanner = document.createElement('div');
  sbBossBanner.id = 'sbBossBanner';
  sbBossBanner.style.position = 'fixed';
  sbBossBanner.style.left = '50%';
  sbBossBanner.style.top = '12px';
  sbBossBanner.style.transform = 'translateX(-50%)';
  sbBossBanner.style.padding = '6px 14px';
  sbBossBanner.style.borderRadius = '999px';
  sbBossBanner.style.background = 'rgba(15,23,42,0.92)';
  sbBossBanner.style.border = '1px solid rgba(248,250,252,0.3)';
  sbBossBanner.style.color = '#e5e7eb';
  sbBossBanner.style.fontFamily = 'system-ui, sans-serif';
  sbBossBanner.style.fontSize = '0.85rem';
  sbBossBanner.style.display = 'none';
  sbBossBanner.style.zIndex = '40';
  document.body.appendChild(sbBossBanner);
}
function sbShowBossBanner(text, emoji) {
  if (!sbBossBanner) return;
  sbBossBanner.innerHTML =
    `<span style="font-size:1.1rem;margin-right:6px;">${emoji||'💣'}</span>${text}`;
  sbBossBanner.style.display = 'inline-flex';
  sbBossBanner.style.alignItems = 'center';
  sbBossBanner.animate(
    [{ transform:'translateX(-50%) translateY(-8px)', opacity:0 },
     { transform:'translateX(-50%) translateY(0)',   opacity:1 }],
    { duration:220, easing:'ease-out' }
  );
  setTimeout(()=>{
    sbBossBanner.animate(
      [{ opacity:1 }, { opacity:0 }],
      { duration:300, easing:'ease-in' }
    ).onfinish = ()=>{ sbBossBanner.style.display='none'; };
  },1200);
}

// ---- Boss HP HUD (มุมบนซ้ายใน gameArea) ----
let sbBossHUDBox = null;
let sbBossFaceEl = null;
let sbBossNameEl = null;
let sbBossHpFill = null;

function sbInitBossHUD(){
  if (sbBossHUDBox || !sbGameArea) return;
  const box = document.createElement('div');
  box.className = 'boss-barbox';
  box.id = 'sbBossHUD';
  box.innerHTML = `
    <div class="boss-face" id="sbBossFace">⛈️</div>
    <div>
      <div id="sbBossName" class="boss-name">Boss</div>
      <div class="boss-bar">
        <div class="boss-bar-fill" id="sbBossHp"></div>
      </div>
    </div>`;
  sbGameArea.appendChild(box);
  sbBossHUDBox = box;
  sbBossFaceEl = $('#sbBossFace');
  sbBossNameEl = $('#sbBossName');
  sbBossHpFill = $('#sbBossHp');
  sbBossHUDBox.style.display = 'none';
}

function sbShowBossHUD(bossInfo, maxHp){
  if (!sbBossHUDBox) sbInitBossHUD();
  if (!sbBossHUDBox) return;
  const name = sbLang === 'th' ? bossInfo.nameTh : bossInfo.nameEn;
  if (sbBossFaceEl) sbBossFaceEl.textContent = bossInfo.emoji || '💣';
  if (sbBossNameEl) sbBossNameEl.textContent = name;
  if (sbBossHpFill) sbBossHpFill.style.transform = 'scaleX(1)';
  sbBossHUDBox.style.display = 'flex';
}

function sbUpdateBossHUD(currentHp, maxHp){
  if (!sbBossHpFill || !maxHp) return;
  const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
  sbBossHpFill.style.transform = `scaleX(${ratio})`;
}

function sbHideBossHUD(){
  if (sbBossHUDBox) sbBossHUDBox.style.display = 'none';
}

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
  sbState.bossQueue = [];
  sbState.bossActive = false;
  sbState.bossWarned = false;
  sbState.activeBossId = null;
  sbState.activeBossInfo = null;

  sbHUD.scoreVal.textContent = '0';
  sbHUD.hitVal.textContent   = '0';
  sbHUD.missVal.textContent  = '0';
  sbHUD.comboVal.textContent = 'x0';
  sbFeedbackEl.style.opacity = 0;

  if (sbGameArea) {
    sbGameArea.querySelectorAll('.sb-target').forEach(t=>t.remove());
    sbGameArea.classList.remove('fever');
  }
  sbHUD.timeVal.textContent = Math.round(sbState.durationMs / 1000);
  sbHideBossHUD();
}

function sbUpdateHUD() {
  sbHUD.scoreVal.textContent = sbState.score;
  sbHUD.hitVal.textContent   = sbState.hit;
  sbHUD.missVal.textContent  = sbState.miss;
  sbHUD.comboVal.textContent = 'x' + sbState.combo;
}

function sbFxScreenShake(intense) {
  if (!SB_ENABLE_FX || !sbGameArea || !sbGameArea.animate) return;
  const p = intense ? 6 : 3;
  sbGameArea.animate(
    [
      { transform:'translate(0,0) scale(1)' },
      { transform:`translate(${-p}px,0) scale(1.01)` },
      { transform:`translate(${p}px,0) scale(1.02)` },
      { transform:'translate(0,0) scale(1)' },
    ],
    { duration:intense?260:150, easing:'ease-out' }
  );
}

// เศษเป้าแตกกระจาย
function sbBurstShards(targetEl, isBoss){
  if (!SB_ENABLE_FX || !targetEl || !targetEl.getBoundingClientRect) return;
  const rect = targetEl.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  const count = isBoss ? 16 : 10;
  for (let i=0;i<count;i++){
    const p = document.createElement('div');
    p.className = 'hit-particle' + (isBoss?' boss':'');
    p.style.left = cx + 'px';
    p.style.top  = cy + 'px';
    document.body.appendChild(p);
    const ang = Math.random()*Math.PI*2;
    const dist = (isBoss?90:60) + Math.random()*25;
    const dx = Math.cos(ang)*dist;
    const dy = Math.sin(ang)*dist;
    const scaleEnd = 0.3 + Math.random()*0.4;
    p.animate(
      [
        { transform:'translate(-50%,-50%) scale(1)',   opacity:1 },
        { transform:`translate(calc(-50%+${dx}px),calc(-50%+${dy}px)) scale(${scaleEnd})`,
          opacity:0 },
      ],
      { duration:650, easing:'ease-out' }
    ).onfinish = ()=>p.remove();
  }
}

function sbShowFeedback(type) {
  const t = sbI18n[sbLang];
  let txt = '';
  if (type === 'fever')        txt = t.feverLabel || 'FEVER!!';
  else if (type === 'perfect') txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!');
  else if (type === 'good')    txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!');
  else                         txt = (sbLang==='th'?'พลาด!':'MISS');

  sbFeedbackEl.textContent = txt;
  sbFeedbackEl.className = 'feedback feedback-' + type;
  sbFeedbackEl.style.opacity = 1;
  sbFeedbackEl.animate(
    [
      { opacity:0, transform:'translate(-50%,-50%) scale(0.6)' },
      { opacity:1, transform:'translate(-50%,-50%) scale(1.1)' },
      { opacity:0, transform:'translate(-50%,-50%) scale(1)'   },
    ],
    { duration: type==='fever' ? 900 : 430, easing:'ease-out' }
  ).onfinish = () => {
    sbFeedbackEl.style.opacity = 0;
  };
}

// score FX ลอยขึ้นจากเป้า
function sbScoreFx(targetEl, gained) {
  if (!targetEl || !SB_ENABLE_FX) return;
  const rect = targetEl.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.textContent = '+' + gained;
  fx.className = 'score-fx';
  fx.style.left = rect.left + rect.width/2 + 'px';
  fx.style.top  = rect.top + 'px';
  document.body.appendChild(fx);
  fx.animate(
    [
      { transform:'translate(-50%,0) scale(0.9)', opacity:1 },
      { transform:'translate(-50%,-32px) scale(1.1)', opacity:0 },
    ],
    { duration:650, easing:'ease-out' }
  ).onfinish = ()=>fx.remove();
}

// ---- Boss queue ----
function sbPrepareBossQueue() {
  const ms = sbState.durationMs;
  const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((boss,idx)=>({
    bossIndex: idx,
    spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15)),
  }));
}

// ---- Target spawn ----
let sbTargetIdCounter = 1;

function sbSpawnTarget(isBoss = false, bossInfo = null) {
  if (!sbGameArea) return;
  const rect = sbGameArea.getBoundingClientRect();

  const sizeBase = isBoss ? 90 : 56;
  const baseHp   = isBoss ? sbCfg.bossHp + (bossInfo?.hpBonus || 0) : 1;

  const tObj = {
    id: sbTargetIdCounter++,
    boss: isBoss,
    bossInfo: bossInfo || null,
    hp: baseHp,
    maxHp: baseHp,
    createdAt: performance.now(),
    el: null,
    alive: true,
  };

  const el = document.createElement('div');
  el.className = 'sb-target';
  el.dataset.id = String(tObj.id);
  el.dataset.hp = String(tObj.hp);
  el.style.width = sizeBase + 'px';
  el.style.height = sizeBase + 'px';

  if (isBoss && bossInfo) {
    el.style.background =
      'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
    el.textContent = bossInfo.emoji;
  } else {
    const emo = SB_NORMAL_EMOJIS[Math.floor(Math.random()*SB_NORMAL_EMOJIS.length)];
    el.textContent = emo;
  }

  const padding = 24;
  const maxX = rect.width - sizeBase - padding;
  const maxY = rect.height - sizeBase - padding;
  const x = padding + Math.random() * maxX;
  const y = padding + Math.random() * maxY;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  el.addEventListener('click', () => sbHitTarget(tObj));

  sbGameArea.appendChild(el);
  tObj.el = el;
  sbState.targets.push(tObj);

  if (isBoss && bossInfo) {
    sbState.bossActive = true;
    sbState.bossWarned = false;
    sbState.activeBossId = tObj.id;
    sbState.activeBossInfo = bossInfo;
    el.animate(
      [
        { transform:'scale(0.6)', opacity:0 },
        { transform:'scale(1.08)', opacity:1 },
        { transform:'scale(1)',   opacity:1 },
      ],
      { duration:260, easing:'ease-out' }
    );
    const name = sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn;
    sbShowBossBanner(name + ' ปรากฏตัวแล้ว!', bossInfo.emoji);
    // HUD ยังไม่ขึ้น จนกว่าจะใกล้หมด HP
  } else {
    el.animate(
      [
        { transform:'scale(0.7)', opacity:0 },
        { transform:'scale(1)',   opacity:1 },
      ],
      { duration:160, easing:'ease-out' }
    );
  }

  const lifeMs = isBoss ? 6000 : 2200;
  setTimeout(()=>{
    if (!tObj.alive) return;
    tObj.alive = false;
    if (tObj.el && tObj.el.parentNode) tObj.el.parentNode.removeChild(tObj.el);
    // miss
    sbState.miss++;
    sbState.combo = 0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    sbFxScreenShake(false);
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;
  },lifeMs);
}

function sbMaybeSpawnBoss() {
  if (!sbState.running || sbState.bossActive) return;
  if (!sbState.bossQueue.length) return;
  const elapsed = sbState.elapsedMs;
  const next = sbState.bossQueue[0];
  if (elapsed >= next.spawnAtMs) {
    sbState.bossQueue.shift();
    const bossInfo = SB_BOSSES[next.bossIndex];
    sbSpawnTarget(true, bossInfo);
  }
}

function sbSpawnNextBossImmediate() {
  if (!sbState.bossQueue.length) return;
  const next = sbState.bossQueue.shift();
  const bossInfo = SB_BOSSES[next.bossIndex];
  sbSpawnTarget(true, bossInfo);
}

// ---- Fever ----
function sbEnterFever() {
  const t = sbI18n[sbLang];
  sbState.fever = true;
  sbState.feverUntil = performance.now() + 3500;
  sbHUD.coachLine.textContent = t.coachFever;
  sbShowFeedback('fever');
  sbFxScreenShake(true);
  if (sbGameArea) sbGameArea.classList.add('fever');
}
function sbCheckFeverTick(now) {
  if (sbState.fever && now >= sbState.feverUntil) {
    sbState.fever = false;
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
    if (sbGameArea) sbGameArea.classList.remove('fever');
  }
}

// ---- Hit logic ----
function sbHitTarget(tObj) {
  if (!sbState.running || !tObj.alive) return;

  tObj.hp -= 1;
  const isBoss   = tObj.boss;
  const bossInfo = tObj.bossInfo;

  if (tObj.hp > 0) {
    // ยังไม่ตาย (บอสโดนหลายที)
    if (tObj.el) {
      tObj.el.dataset.hp = String(tObj.hp);
      tObj.el.animate(
        [
          { transform:'scale(1)',   filter:'brightness(1)' },
          { transform:'scale(1.1)', filter:'brightness(1.4)' },
          { transform:'scale(1)',   filter:'brightness(1)' },
        ],
        { duration:140, easing:'ease-out' }
      );
    }
    sbState.hit++;
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base       = isBoss ? 70 : 50;
    const comboBonus = Math.min(sbState.combo * 5, 60);
    const feverBonus = sbState.fever ? 30 : 0;
    const gained     = base + comboBonus + feverBonus;
    sbState.score   += gained;

    sbUpdateHUD();
    sbShowFeedback('good');
    sbFxScreenShake(false);
    sbScoreFx(tObj.el, gained);
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;

    if (isBoss) {
      // ถ้า HUD แสดงอยู่แล้ว → update bar
      if (sbBossHUDBox && sbBossHUDBox.style.display !== 'none') {
        sbUpdateBossHUD(tObj.hp, tObj.maxHp);
      }
      // ใกล้หมด HP → แสดงหน้า + HP bar และขยายเป้า
      if (!sbState.bossWarned && tObj.hp <= 2 && bossInfo) {
        sbState.bossWarned = true;
        sbShowBossHUD(bossInfo, tObj.maxHp);
        sbUpdateBossHUD(tObj.hp, tObj.maxHp);
        if (tObj.el) tObj.el.classList.add('boss-final');
        const name = sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn;
        sbShowBossBanner(sbI18n[sbLang].bossNear(name), bossInfo.emoji);
      }
    }
    return;
  }

  // ตายแล้ว
  tObj.alive = false;
  if (tObj.el && tObj.el.parentNode) {
    tObj.el.classList.add('hit');
    tObj.el.animate(
      [
        { transform:'scale(1)',   opacity:1 },
        { transform:'scale(0.1)', opacity:0 },
      ],
      { duration:140, easing:'ease-in' }
    ).onfinish = ()=>{
      if (tObj.el && tObj.el.parentNode) tObj.el.parentNode.removeChild(tObj.el);
    };
  }

  sbState.hit++;
  sbState.perfect++;
  sbState.combo++;
  sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

  const base       = isBoss ? 200 : 80;
  const comboBonus = Math.min(sbState.combo * 8, 100);
  const feverBonus = sbState.fever ? 80 : 0;
  const gained     = base + comboBonus + feverBonus;
  sbState.score   += gained;

  sbUpdateHUD();
  sbScoreFx(tObj.el, gained);
  sbBurstShards(tObj.el, isBoss);

  if (sbState.combo >= 5 && !sbState.fever) {
    sbEnterFever();
  } else {
    sbShowFeedback('perfect');
    sbFxScreenShake(isBoss);
    sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;
  }

  if (isBoss && bossInfo) {
    // เคลียร์บอสตัวนี้
    sbUpdateBossHUD(0, tObj.maxHp);
    sbState.bossActive   = false;
    sbState.activeBossId = null;
    sbState.activeBossInfo = null;
    const name = sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn;
    sbShowBossBanner(sbI18n[sbLang].bossClear(name), bossInfo.emoji);
    sbHideBossHUD();
    // เรียกบอสตัวถัดไป (ถ้ามี)
    sbSpawnNextBossImmediate();
  }
}

// keyboard: space → ตีเป้าใกล้กลางจอ (สำหรับ PC)
window.addEventListener('keydown',(ev)=>{
  if (!sbState.running) return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top  + rect.height/2;
    let best = null;
    let bestDist = Infinity;
    for (const tObj of sbState.targets) {
      if (!tObj.alive || !tObj.el) continue;
      const r = tObj.el.getBoundingClientRect();
      const tx = r.left + r.width/2;
      const ty = r.top  + r.height/2;
      const dx = tx - cx;
      const dy = ty - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist) { bestDist = d2; best = tObj; }
    }
    if (best) sbHitTarget(best);
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
  sbMaybeSpawnBoss();

  if (sbState.elapsedMs >= sbState.durationMs) {
    sbEndGame();
    return;
  }
  requestAnimationFrame(sbMainLoop);
}

// ---- Spawn loop (เป้าธรรมดา) ----
function sbStartSpawnLoop() {
  if (sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = setInterval(()=>{
    if (!sbState.running) return;
    // โอกาสเล็กน้อยที่จะไม่ spawn เพื่อหายใจหายคอ
    if (Math.random() < 0.1) return;
    sbSpawnTarget(false, null);
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
  if (!SB_GOOGLE_SCRIPT_URL || SB_GOOGLE_SCRIPT_URL.indexOf('http') !== 0) return;
  try {
    await fetch(SB_GOOGLE_SCRIPT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(rec),
      mode:'no-cors',
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
    if (!Array.isArray(arr) || arr.length===0) {
      alert('ยังไม่มีข้อมูล session ของ Shadow Breaker');
      return;
    }
    const header = [
      'studentId','schoolName','classRoom','groupCode','deviceType',
      'language','note','phase','diff',
      'gameId','gameVersion','sessionId',
      'timeSec','score','hits','perfect','good','miss',
      'accuracy','maxCombo','fever','timeUsedSec','createdAt',
    ];
    rows.push(header.join(','));
    for (const rec of arr) {
      const line = header.map(k=>{
        const v = rec[k] !== undefined ? String(rec[k]) : '';
        const safe = v.replace(/"/g,'""');
        return `"${safe}"`;
      }).join(',');
      rows.push(line);
    }
  } catch (err) {
    console.error(err);
    alert('ไม่สามารถสร้าง CSV ได้');
    return;
  }

  const csv = rows.join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
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
  if (sbGameArea) sbGameArea.classList.remove('fever');

  const playedSec = Math.round(sbState.elapsedMs / 1000);
  const totalHit   = sbState.hit;
  const totalMiss  = sbState.miss;
  const totalAttempts = totalHit + totalMiss;
  const acc = totalAttempts > 0 ? Math.round((totalHit/totalAttempts)*100) : 0;

  const rec = {
    studentId:  sbState.sessionMeta?.studentId  || '',
    schoolName: sbState.sessionMeta?.schoolName|| '',
    classRoom:  sbState.sessionMeta?.classRoom || '',
    groupCode:  sbState.sessionMeta?.groupCode || '',
    deviceType: sbState.sessionMeta?.deviceType|| sbDetectDevice(),
    language:   sbState.sessionMeta?.language  || sbLang,
    note:       sbState.sessionMeta?.note      || '',
    phase:      sbState.phase,
    diff:       sbState.diff,
    gameId:     SB_GAME_ID,
    gameVersion:SB_GAME_VERSION,
    sessionId:  Date.now().toString(),
    timeSec:    Math.round(sbState.durationMs/1000),
    score:      sbState.score,
    hits:       totalHit,
    perfect:    sbState.perfect,
    good:       sbState.good,
    miss:       sbState.miss,
    accuracy:   acc,
    maxCombo:   sbState.maxCombo,
    fever:      sbState.fever ? 1 : 0,
    timeUsedSec:playedSec,
    createdAt:  new Date().toISOString(),
  };

  sbLogLocal(rec);
  sbLogCloud(rec);

  sbR.score.textContent    = sbState.score;
  sbR.hit.textContent      = totalHit;
  sbR.perfect.textContent  = sbState.perfect;
  sbR.good.textContent     = sbState.good;
  sbR.miss.textContent     = sbState.miss;
  sbR.acc.textContent      = acc + '%';
  sbR.combo.textContent    = 'x'+sbState.maxCombo;
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
    classRoom:  sbMetaInputs.classRoom.value.trim(),
    groupCode:  sbMetaInputs.groupCode.value.trim(),
    deviceType:
      sbMetaInputs.deviceType.value === 'auto'
        ? sbDetectDevice()
        : sbMetaInputs.deviceType.value,
    note:       sbMetaInputs.note.value.trim(),
    language:   sbLang,
  };
  sbState.sessionMeta = meta;
  sbSaveMetaDraft();

  // หลังกรอกข้อมูล → โชว์หน้าเล่นเต็ม ๆ
  document.body.classList.add('play-only');

  sbResetStats();
  sbPrepareBossQueue();
  sbState.running = true;
  sbState.startTime = 0;

  sbStartBtn.disabled = true;
  sbStartBtn.style.opacity = 0.7;

  sbHUD.coachLine.textContent = t.coachReady;

  setTimeout(()=>{
    sbPlayMusic();
    requestAnimationFrame(sbMainLoop);
    sbStartSpawnLoop();
  },600);
}

// ---- Events ----
sbStartBtn && sbStartBtn.addEventListener('click', sbStartGame);

sbPlayAgainBtn && sbPlayAgainBtn.addEventListener('click',()=>{
  sbOverlay.classList.add('hidden');
  sbStartBtn.disabled = false;
  sbStartBtn.style.opacity = 1;
  sbStartGame();
});

sbBackHubBtn && sbBackHubBtn.addEventListener('click',()=>{
  // จาก /webxr-health-mobile/vr-fitness/games/shadow-breaker/play.html
  // กลับ /webxr-health-mobile/vr-fitness/index.html
  location.href = '../../index.html';
});

sbDownloadCsvBtn && sbDownloadCsvBtn.addEventListener('click', sbDownloadCsv);

Object.values(sbMetaInputs).forEach(el=>{
  if (!el) return;
  el.addEventListener('change', sbSaveMetaDraft);
  el.addEventListener('blur',   sbSaveMetaDraft);
});

// ---- Init ----
sbLoadMeta();
sbApplyLang();
sbInitBossBanner();
sbInitBossHUD();
sbInitAudio();
sbHUD.timeVal.textContent = sbTimeSec.toString();
