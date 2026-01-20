// === VR Fitness — Shadow Breaker (Research + Boss v1.2.1) ===
// ✅ split CSS ok (index/play)
// ✅ feedback class matches CSS (.feedback perfect/good/miss/fever + .show)
// ✅ play mode auto: body.mode-play -> no StudentID required, hide research/CSV
// ✅ safe: no miss after end, clear targets on end
// ✅ fix: remove duplicate sbCfg declaration

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.2.1-prod';

const SB_STORAGE_KEY = 'ShadowBreakerResearch_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';

// --- toggles ---
const SB_ENABLE_MUSIC      = false;
const SB_ENABLE_FX         = true;
const SB_MUSIC_SRC         = './assets/sb-bgm.mp3';

// ---------- Query params ----------
function sbQS(k, d=null){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function sbGetPhase() {
  const p = sbQS('phase','train');
  const n = String(p||'').toLowerCase();
  return ['pre','train','post'].includes(n) ? n : 'train';
}
function sbGetTimeSec() {
  const t = parseInt(sbQS('time',''), 10);
  if (Number.isFinite(t) && t >= 20 && t <= 300) return t;
  return 60;
}
function sbGetDiff() {
  const d = String(sbQS('diff','normal')||'normal').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'normal';
}
function sbGetMode(){
  const m = String(sbQS('mode','timed')||'timed').toLowerCase();
  return (m==='endless') ? 'endless' : 'timed';
}

const sbPhase   = sbGetPhase();
const sbTimeSec = sbGetTimeSec();
const sbDiff    = sbGetDiff();
const sbMode    = sbGetMode();

// ---------- DOM helpers ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

const sbStartBtn =
  $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');

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
  timeVal:   $('#timeVal')   || $('#hudTime'),
  scoreVal:  $('#scoreVal')  || $('#hudScore'),
  hitVal:    $('#hitVal')    || $('#hudHit'),
  missVal:   $('#missVal')   || $('#hudMiss'),
  comboVal:  $('#comboVal')  || $('#hudCombo'),
  coachLine: $('#coachLine') || $('#hudCoach'),
};

const sbOverlay =
  $('#resultOverlay') || $('#resultCard') || $('#resultPanel') || null;

const sbR = {
  score:    $('#rScore')    || $('#resScore'),
  hit:      $('#rHit')      || $('#resHit'),
  perfect:  $('#rPerfect')  || $('#resPerfect'),
  good:     $('#rGood')     || $('#resGood'),
  miss:     $('#rMiss')     || $('#resMiss'),
  acc:      $('#rAcc')      || $('#resAcc'),
  combo:    $('#rCombo')    || $('#resCombo'),
  timeUsed: $('#rTimeUsed') || $('#resTimeUsed'),
};

const sbPlayAgainBtn =
  $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
const sbBackHubBtn =
  $('#backHubBtn') || $('#resBackHubBtn') || $('#resMenuBtn');
const sbDownloadCsvBtn =
  $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

// ---------- Boss & emoji config ----------
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];

const SB_BOSSES = [
  { id:1, emoji:'💧', nameTh:'Bubble Glove', nameEn:'Bubble Glove', hpBonus:0 },
  { id:2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
  { id:3, emoji:'🥊', nameTh:'Iron Fist', nameEn:'Iron Fist', hpBonus:4 },
  { id:4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
];

// difficulty
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6 },
  normal: { spawnMs: 700, bossHp: 9 },
  hard:   { spawnMs: 520, bossHp: 12 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// ---------- i18n ----------
const sbI18n = {
  th: {
    metaTitle: 'ข้อมูลสำหรับงานวิจัย',
    metaHint: 'กรอกเพียงครั้งเดียวก่อนเริ่ม ระบบจะบันทึกทุกครั้งที่เล่นเป็น 1 รอบการทดลอง.',
    startLabel: 'เริ่มเล่น',
    coachReady: 'โค้ชพุ่ง: แตะ/ชก emoji ให้ทันเวลา ระวังบอสโผล่มา! 👊',
    coachGood:  'สวยมาก! ต่อคอมโบให้ยาว ๆ เลย! ✨',
    coachMiss:  'พลาดนิดเดียว ไม่เป็นไร ลองใหม่! 💪',
    coachFever: 'FEVER!! ทุบให้สุดแรงเลย!! 🔥',
    tagGoal: 'เป้าหมาย: ต่อยเป้า emoji ให้ทันเวลา รักษาคอมโบ และพิชิตบอสทั้ง 4 ตัว.',
    lblTime:'เวลา', lblScore:'คะแนน', lblHit:'โดนเป้า', lblMiss:'พลาด', lblCombo:'คอมโบ',
    resultTitle:'🏁 สรุปผล Shadow Breaker',
    rScore:'คะแนนรวม', rHit:'จำนวนครั้งที่โดนเป้า', rPerfect:'Perfect (โดนเต็ม ๆ)',
    rGood:'Good (โดนนิดหน่อย)', rMiss:'Miss (พลาด)', rAcc:'ความแม่นยำ',
    rCombo:'คอมโบสูงสุด', rTimeUsed:'เวลาเล่นต่อรอบ',
    playAgain:'เล่นอีกครั้ง', backHub:'กลับ Hub', downloadCsv:'ดาวน์โหลด CSV ข้อมูลวิจัย',
    alertMeta:'โหมดวิจัย: กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`ใกล้จะล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
    bossClear:(name)=>`พิชิต ${name} แล้ว! เตรียมรับมือบอสถัดไป! 🔥`,
  },
  en: {
    metaTitle:'Research meta (per session)',
    metaHint:'Fill this once. Each Shadow Breaker run will be logged as a separate session.',
    startLabel:'Start',
    coachReady:'Coach Pung: Tap the emoji targets and watch out for bosses! 👊',
    coachGood:'Nice! Keep the combo going! ✨',
    coachMiss:'Missed a bit. Try again! 💪',
    coachFever:'FEVER!! Smash everything!! 🔥',
    tagGoal:'Goal: Hit emoji targets quickly, maintain combo, and defeat all 4 bosses.',
    lblTime:'TIME', lblScore:'SCORE', lblHit:'HIT', lblMiss:'MISS', lblCombo:'COMBO',
    resultTitle:'🏁 Shadow Breaker Result',
    rScore:'Total Score', rHit:'Hits', rPerfect:'Perfect', rGood:'Good', rMiss:'Miss',
    rAcc:'Accuracy', rCombo:'Best Combo', rTimeUsed:'Played Time',
    playAgain:'Play again', backHub:'Back to Hub', downloadCsv:'Download research CSV',
    alertMeta:'Research mode: please fill at least Student ID before starting.',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`Almost defeat ${name}! Finish it! ⚡`,
    bossClear:(name)=>`You beat ${name}! Next boss incoming! 🔥`,
  },
};

let sbLang = 'th';

// ---------- Device detect ----------
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vr';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---------- Audio ----------
let sbMusic = null;
function sbInitAudio() {
  if (!SB_ENABLE_MUSIC) return;
  try {
    sbMusic = new Audio();
    sbMusic.src = SB_MUSIC_SRC;
    sbMusic.preload = 'auto';
    sbMusic.volume = 0.85;
  } catch (e) {}
}
function sbPlayMusic() {
  if (!SB_ENABLE_MUSIC || !sbMusic) return;
  try { const p = sbMusic.play(); if (p && p.catch) p.catch(()=>{}); } catch(_) {}
}
function sbStopMusic() {
  if (!SB_ENABLE_MUSIC || !sbMusic) return;
  try { sbMusic.pause(); } catch(_) {}
}

// ---------- Game state ----------
const sbState = {
  running: false,
  startTime: 0,
  elapsedMs: 0,
  durationMs: sbMode === 'endless' ? Infinity : (sbTimeSec * 1000),
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
  mode: sbMode,
  bossQueue: [],
  bossActive: false,
  bossWarned: false,
  activeBossId: null,
  activeBossInfo: null,
};

// ---------- Meta persistence ----------
function sbLoadMeta() {
  try {
    const raw = localStorage.getItem(SB_META_KEY);
    if (!raw) return;
    const meta = JSON.parse(raw);
    Object.entries(sbMetaInputs).forEach(([k, el])=>{
      if (el && meta && meta[k]) el.value = meta[k];
    });
  } catch (_) {}
}
function sbSaveMetaDraft() {
  const meta = {};
  Object.entries(sbMetaInputs).forEach(([k, el])=>{
    meta[k] = el ? el.value.trim() : '';
  });
  try { localStorage.setItem(SB_META_KEY, JSON.stringify(meta)); } catch(_) {}
}

// ---------- i18n apply ----------
function sbApplyLang() {
  const t = sbI18n[sbLang];
  const mt = $('#metaTitle');  if (mt) mt.textContent = t.metaTitle;
  const mh = $('#metaHint');   if (mh) mh.textContent = t.metaHint;
  const sl = $('#startLabel'); if (sl) sl.textContent = t.startLabel;
  if (sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
  const tg = $('#tagGoal');    if (tg) tg.textContent = t.tagGoal;

  const lblTime  = $('#lblTime');  if (lblTime)  lblTime.textContent  = t.lblTime.toUpperCase();
  const lblScore = $('#lblScore'); if (lblScore) lblScore.textContent = t.lblScore.toUpperCase();
  const lblHit   = $('#lblHit');   if (lblHit)   lblHit.textContent   = t.lblHit.toUpperCase();
  const lblMiss  = $('#lblMiss');  if (lblMiss)  lblMiss.textContent  = t.lblMiss.toUpperCase();
  const lblCombo = $('#lblCombo'); if (lblCombo) lblCombo.textContent = t.lblCombo.toUpperCase();

  const rt = $('#resultTitle'); if (rt) rt.textContent = t.resultTitle;
  const lScore   = $('#rScoreLabel');    if (lScore)   lScore.textContent   = t.rScore;
  const lHit     = $('#rHitLabel');      if (lHit)     lHit.textContent     = t.rHit;
  const lPerf    = $('#rPerfectLabel');  if (lPerf)    lPerf.textContent    = t.rPerfect;
  const lGood    = $('#rGoodLabel');     if (lGood)    lGood.textContent    = t.rGood;
  const lMiss    = $('#rMissLabel');     if (lMiss)    lMiss.textContent    = t.rMiss;
  const lAcc     = $('#rAccLabel');      if (lAcc)     lAcc.textContent     = t.rAcc;
  const lCombo   = $('#rComboLabel');    if (lCombo)   lCombo.textContent   = t.rCombo;
  const lTimeUse = $('#rTimeUsedLabel'); if (lTimeUse) lTimeUse.textContent = t.rTimeUsed;

  const pAgain = $('#playAgainLabel');   if (pAgain) pAgain.textContent = t.playAgain;
  const bHub   = $('#backHubLabel');     if (bHub)   bHub.textContent   = t.backHub;
  const dCsv   = $('#downloadCsvLabel'); if (dCsv)   dCsv.textContent   = t.downloadCsv;

  const pdpa = $('#metaPDPA');
  if (pdpa) {
    pdpa.textContent =
      sbLang === 'th'
        ? '* ข้อมูลนี้ใช้เพื่อการวิจัยด้านการออกกำลังกายเท่านั้น และจะไม่เปิดเผยตัวตนรายบุคคล'
        : '* Collected data is used only for exercise research and will not reveal individual identities.';
  }
}

sbLangButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{
    sbLangButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sbLang = btn.dataset.lang || 'th';
    sbApplyLang();
  });
});

// ---------- Boss banner ----------
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
  sbBossBanner.style.background = 'rgba(15,23,42,0.96)';
  sbBossBanner.style.border = '1px solid rgba(248,250,252,0.35)';
  sbBossBanner.style.color = '#e5e7eb';
  sbBossBanner.style.fontFamily = 'system-ui, sans-serif';
  sbBossBanner.style.fontSize = '0.85rem';
  sbBossBanner.style.display = 'none';
  sbBossBanner.style.zIndex = '45';
  document.body.appendChild(sbBossBanner);
}
function sbShowBossBanner(text, emoji) {
  if (!sbBossBanner) return;
  sbBossBanner.innerHTML =
    `<span style="font-size:1.15rem;margin-right:6px;">${emoji || '💣'}</span>${text}`;
  sbBossBanner.style.display = 'inline-flex';
  sbBossBanner.style.alignItems = 'center';
  sbBossBanner.animate(
    [{ transform:'translate(-50%,-8px)', opacity:0 },
     { transform:'translate(-50%,0)',    opacity:1 }],
    { duration:220, easing:'ease-out' }
  );
  setTimeout(()=>{
    sbBossBanner.animate([{ opacity:1 }, { opacity:0 }], { duration:280, easing:'ease-in' })
      .onfinish = ()=>{ sbBossBanner.style.display='none'; };
  }, 1200);
}

// ---------- HUD / FX ----------
function sbClearTargets(){
  if (!sbGameArea) return;
  sbGameArea.querySelectorAll('.sb-target').forEach(t=>t.remove());
  sbState.targets = [];
}
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

  sbState.bossQueue = [];
  sbState.bossActive = false;
  sbState.bossWarned = false;
  sbState.activeBossId = null;
  sbState.activeBossInfo = null;

  if (sbHUD.scoreVal) sbHUD.scoreVal.textContent = '0';
  if (sbHUD.hitVal)   sbHUD.hitVal.textContent   = '0';
  if (sbHUD.missVal)  sbHUD.missVal.textContent  = '0';
  if (sbHUD.comboVal) sbHUD.comboVal.textContent = 'x0';

  if (sbFeedbackEl){ sbFeedbackEl.style.display='none'; sbFeedbackEl.className='feedback'; }

  sbClearTargets();

  if (sbHUD.timeVal) {
    sbHUD.timeVal.textContent =
      (sbState.durationMs===Infinity) ? '∞' : String(Math.round(sbState.durationMs / 1000));
  }
}
function sbUpdateHUD() {
  if (sbHUD.scoreVal) sbHUD.scoreVal.textContent = String(sbState.score);
  if (sbHUD.hitVal)   sbHUD.hitVal.textContent   = String(sbState.hit);
  if (sbHUD.missVal)  sbHUD.missVal.textContent  = String(sbState.miss);
  if (sbHUD.comboVal) sbHUD.comboVal.textContent = 'x' + sbState.combo;
}
function sbFxScreenShake(intense) {
  if (!SB_ENABLE_FX || !sbGameArea || !sbGameArea.animate) return;
  const p = intense ? 5 : 3;
  sbGameArea.animate(
    [
      { transform:'translate(0,0) scale(1)' },
      { transform:`translate(${-p}px,0) scale(1.01)` },
      { transform:`translate(${p}px,0) scale(1.02)` },
      { transform:'translate(0,0) scale(1)' },
    ],
    { duration:intense ? 220 : 140, easing:'ease-out' }
  );
}
function sbShowFeedback(type) {
  if (!sbFeedbackEl) return;
  const t = sbI18n[sbLang];
  let txt = '';
  if (type === 'fever') txt = t.feverLabel || 'FEVER!!';
  else if (type === 'perfect') txt = (sbLang==='th') ? 'Perfect! 💥' : 'PERFECT!';
  else if (type === 'good')    txt = (sbLang==='th') ? 'ดีมาก! ✨'  : 'GOOD!';
  else txt = (sbLang==='th') ? 'พลาด!' : 'MISS';

  sbFeedbackEl.textContent = txt;
  sbFeedbackEl.className = 'feedback ' + type;
  sbFeedbackEl.style.display = 'block';
  sbFeedbackEl.classList.add('show');

  setTimeout(()=>{
    if(!sbFeedbackEl) return;
    sbFeedbackEl.classList.remove('show');
    setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 120);
  }, type==='fever'?800:420);
}
function sbScoreFx(targetEl, gained) {
  if (!SB_ENABLE_FX || !targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.textContent = '+'+gained;
  fx.className = 'score-fx';
  fx.style.left = (rect.left + rect.width/2) + 'px';
  fx.style.top  = (rect.top) + 'px';
  document.body.appendChild(fx);
  fx.animate(
    [{ transform:'translate(-50%,0)', opacity:1 },
     { transform:'translate(-50%,-26px)', opacity:0 }],
    { duration:600, easing:'ease-out' }
  ).onfinish = ()=>fx.remove();
}

// ---------- Boss queue ----------
function sbPrepareBossQueue() {
  if (sbMode==='endless') {
    // endless: spawn bosses cyclic every ~18s
    sbState.bossQueue = [];
    let t = 12000;
    for (let i=0;i<20;i++){
      sbState.bossQueue.push({ bossIndex: i%SB_BOSSES.length, spawnAtMs: t });
      t += 18000;
    }
    return;
  }
  const ms = sbState.durationMs;
  const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
    bossIndex: idx,
    spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15)),
  }));
}

// ---------- Spawn target ----------
let sbTargetIdCounter = 1;

function sbSpawnTarget(isBoss = false, bossInfo = null) {
  if (!sbGameArea || !sbState.running) return;

  const rect = sbGameArea.getBoundingClientRect();
  const sizeBase = isBoss ? 90 : 56;
  const baseHp   = isBoss ? sbCfg.bossHp + (bossInfo?.hpBonus || 0) : 1;

  const tObj = {
    id: sbTargetIdCounter++,
    boss: isBoss,
    bossInfo: bossInfo || null,
    hp: baseHp,
    createdAt: performance.now(),
    el: null,
    alive: true,
  };

  const el = document.createElement('div');
  el.className = 'sb-target';
  el.dataset.id = String(tObj.id);
  el.dataset.hp = String(tObj.hp);
  el.style.width  = sizeBase + 'px';
  el.style.height = sizeBase + 'px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontSize = isBoss ? '2.1rem' : '1.7rem';
  el.style.cursor   = 'pointer';
  el.style.borderRadius = '999px';

  if (isBoss && bossInfo) {
    el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
    el.textContent = bossInfo.emoji;
  } else {
    const emo = SB_NORMAL_EMOJIS[Math.floor(Math.random()*SB_NORMAL_EMOJIS.length)];
    el.style.background = sbState.fever
      ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
      : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
    el.textContent = emo;
  }

  const padding = 20;
  const maxX = Math.max(0, rect.width  - sizeBase - padding);
  const maxY = Math.max(0, rect.height - sizeBase - padding);
  const x = padding + Math.random()*maxX;
  const y = padding + Math.random()*maxY;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  el.addEventListener('click', ()=>sbHitTarget(tObj));

  sbGameArea.appendChild(el);
  tObj.el = el;
  sbState.targets.push(tObj);

  if (isBoss) {
    sbState.bossActive = true;
    sbState.bossWarned = false;
    sbState.activeBossId = tObj.id;
    sbState.activeBossInfo = bossInfo;
    el.animate(
      [{ transform:'scale(0.6)', opacity:0 },
       { transform:'scale(1.08)', opacity:1 },
       { transform:'scale(1)',   opacity:1 }],
      { duration:260, easing:'ease-out' }
    );
    const name = sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn;
    sbShowBossBanner(name + ' ปรากฏตัวแล้ว!', bossInfo.emoji);
  } else {
    el.animate([{ transform:'scale(0.7)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
      { duration:160, easing:'ease-out' }
    );
  }

  const lifeMs = isBoss ? 6000 : 2200;
  setTimeout(()=>{
    if (!tObj.alive) return;
    if (!sbState.running) { // ✅ กัน miss หลังจบเกม
      tObj.alive = false;
      if (tObj.el && tObj.el.parentNode) tObj.el.parentNode.removeChild(tObj.el);
      return;
    }
    tObj.alive = false;
    if (tObj.el && tObj.el.parentNode) tObj.el.parentNode.removeChild(tObj.el);
    sbState.miss++;
    sbState.combo = 0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    sbFxScreenShake(false);
    if (sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;
  }, lifeMs);
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
  if (!sbState.bossQueue.length || !sbState.running) return;
  const next = sbState.bossQueue.shift();
  const bossInfo = SB_BOSSES[next.bossIndex];
  sbSpawnTarget(true, bossInfo);
}

// ---------- Fever ----------
function sbEnterFever() {
  const t = sbI18n[sbLang];
  sbState.fever = true;
  sbState.feverUntil = performance.now() + 3500;
  if (sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachFever;
  if (sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbFxScreenShake(true);
}
function sbCheckFeverTick(now) {
  if (sbState.fever && now >= sbState.feverUntil) {
    sbState.fever = false;
    if (sbGameArea) sbGameArea.classList.remove('fever');
    if (sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
  }
}

// ---------- Hit logic ----------
function sbHitTarget(tObj) {
  if (!sbState.running || !tObj.alive) return;

  tObj.hp -= 1;
  const isBoss = tObj.boss;
  const bossInfo = tObj.bossInfo;

  if (tObj.hp > 0) {
    if (tObj.el) {
      tObj.el.dataset.hp = String(tObj.hp);
      tObj.el.animate(
        [{ transform:'scale(1)', filter:'brightness(1)' },
         { transform:'scale(1.1)', filter:'brightness(1.4)' },
         { transform:'scale(1)', filter:'brightness(1)' }],
        { duration:140, easing:'ease-out' }
      );
    }
    sbState.hit++;
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base        = isBoss ? 70  : 50;
    const comboBonus  = Math.min(sbState.combo * 5, 60);
    const feverBonus  = sbState.fever ? 30 : 0;
    const gained      = base + comboBonus + feverBonus;
    sbState.score += gained;

    sbUpdateHUD();
    sbShowFeedback('good');
    sbFxScreenShake(false);
    sbScoreFx(tObj.el, gained);
    if (sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;

    if (isBoss && !sbState.bossWarned && tObj.hp <= 2) {
      sbState.bossWarned = true;
      const name = sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn;
      sbShowBossBanner(sbI18n[sbLang].bossNear(name), bossInfo.emoji);
    }
    return;
  }

  // defeated
  tObj.alive = false;
  if (tObj.el && tObj.el.parentNode) {
    const el = tObj.el;
    el.classList.add('hit');
    el.animate([{ transform:'scale(1)', opacity:1 }, { transform:'scale(0.1)', opacity:0 }],
      { duration:140, easing:'ease-in' }
    ).onfinish = ()=>{
      if (el && el.parentNode) el.parentNode.removeChild(el);
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
  sbState.score += gained;

  sbUpdateHUD();
  sbScoreFx(tObj.el, gained);

  if (sbState.combo >= 5 && !sbState.fever) {
    sbEnterFever();
  } else {
    sbShowFeedback('perfect');
    sbFxScreenShake(isBoss);
    if (sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;
  }

  if (isBoss) {
    sbState.bossActive = false;
    sbState.activeBossId = null;
    sbState.activeBossInfo = null;
    const name = sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn;
    sbShowBossBanner(sbI18n[sbLang].bossClear(name), bossInfo.emoji);
    sbSpawnNextBossImmediate();
  }
}

// keyboard: space -> hit closest to center
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

// ---------- Loop ----------
function sbMainLoop(now) {
  if (!sbState.running) return;
  if (!sbState.startTime) sbState.startTime = now;
  sbState.elapsedMs = now - sbState.startTime;

  if (sbState.durationMs !== Infinity) {
    const remain = Math.max(0, Math.round((sbState.durationMs - sbState.elapsedMs) / 1000));
    if (sbHUD.timeVal) sbHUD.timeVal.textContent = String(remain);
  } else {
    if (sbHUD.timeVal) sbHUD.timeVal.textContent = '∞';
  }

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss();

  if (sbState.durationMs !== Infinity && sbState.elapsedMs >= sbState.durationMs) {
    sbEndGame();
    return;
  }
  requestAnimationFrame(sbMainLoop);
}

// spawn normal targets
function sbStartSpawnLoop() {
  if (sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = setInterval(()=>{
    if (!sbState.running) return;
    if (Math.random() < 0.1) return;
    sbSpawnTarget(false, null);
  }, sbCfg.spawnMs);
}
function sbStopSpawnLoop() {
  if (sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = null;
}

// ---------- Logging (local only) ----------
function sbLogLocal(rec) {
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {}
}

function sbDownloadCsv() {
  let rows = [];
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    if (!raw) { alert('ยังไม่มีข้อมูล session ของ Shadow Breaker'); return; }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) { alert('ยังไม่มีข้อมูล session ของ Shadow Breaker'); return; }
    const header = [
      'studentId','schoolName','classRoom','groupCode','deviceType',
      'language','note','phase','diff','mode',
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
    alert('ไม่สามารถสร้าง CSV ได้');
    return;
  }

  const csv = rows.join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'ShadowBreakerResearch.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- End game ----------
function sbEndGame() {
  if (!sbState.running) return;
  sbState.running = false;
  sbStopSpawnLoop();
  sbStopMusic();

  const playedSec = Math.round(sbState.elapsedMs / 1000);
  const totalHit  = sbState.hit;
  const totalMiss = sbState.miss;
  const totalAttempts = totalHit + totalMiss;
  const acc = totalAttempts > 0 ? Math.round((totalHit/totalAttempts)*100) : 0;

  const rec = {
    studentId:   sbState.sessionMeta?.studentId  || '',
    schoolName:  sbState.sessionMeta?.schoolName|| '',
    classRoom:   sbState.sessionMeta?.classRoom || '',
    groupCode:   sbState.sessionMeta?.groupCode || '',
    deviceType:  sbState.sessionMeta?.deviceType|| sbDetectDevice(),
    language:    sbState.sessionMeta?.language  || sbLang,
    note:        sbState.sessionMeta?.note      || '',
    phase:       sbState.phase,
    diff:        sbState.diff,
    mode:        sbState.mode,
    gameId:      SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    sessionId:   Date.now().toString(),
    timeSec:     (sbState.durationMs===Infinity) ? -1 : Math.round(sbState.durationMs/1000),
    score:       sbState.score,
    hits:        totalHit,
    perfect:     sbState.perfect,
    good:        sbState.good,
    miss:        sbState.miss,
    accuracy:    acc,
    maxCombo:    sbState.maxCombo,
    fever:       sbState.fever ? 1 : 0,
    timeUsedSec: playedSec,
    createdAt:   new Date().toISOString(),
  };

  // log only if research OR user wants local history
  sbLogLocal(rec);

  // populate overlay
  if (sbR.score)    sbR.score.textContent    = String(sbState.score);
  if (sbR.hit)      sbR.hit.textContent      = String(totalHit);
  if (sbR.perfect)  sbR.perfect.textContent  = String(sbState.perfect);
  if (sbR.good)     sbR.good.textContent     = String(sbState.good);
  if (sbR.miss)     sbR.miss.textContent     = String(sbState.miss);
  if (sbR.acc)      sbR.acc.textContent      = acc + '%';
  if (sbR.combo)    sbR.combo.textContent    = 'x'+sbState.maxCombo;
  if (sbR.timeUsed) sbR.timeUsed.textContent = playedSec + 's';

  if (sbOverlay) sbOverlay.classList.remove('hidden');

  // cleanup targets after end (avoid late timeouts)
  sbClearTargets();
}

// ---------- Start game ----------
function sbStartGame() {
  if (sbState.running) return;

  const t = sbI18n[sbLang];
  const isPlayMode = document.body.classList.contains('mode-play');
  const requireId = !isPlayMode;

  const sid = sbMetaInputs.studentId ? sbMetaInputs.studentId.value.trim() : '';

  if (requireId && !sid) {
    alert(t.alertMeta);
    return;
  }

  const meta = {
    studentId: sid,
    schoolName: sbMetaInputs.schoolName ? sbMetaInputs.schoolName.value.trim() : '',
    classRoom:  sbMetaInputs.classRoom  ? sbMetaInputs.classRoom.value.trim()  : '',
    groupCode:  sbMetaInputs.groupCode  ? sbMetaInputs.groupCode.value.trim()  : '',
    deviceType:
      sbMetaInputs.deviceType && sbMetaInputs.deviceType.value === 'auto'
        ? sbDetectDevice()
        : (sbMetaInputs.deviceType ? sbMetaInputs.deviceType.value : sbDetectDevice()),
    note:     sbMetaInputs.note ? sbMetaInputs.note.value.trim() : '',
    language: sbLang,
  };

  sbState.sessionMeta = meta;
  sbSaveMetaDraft();

  document.body.classList.add('play-only');

  sbResetStats();
  sbPrepareBossQueue();
  sbState.running = true;
  sbState.startTime = 0;

  if (sbStartBtn) {
    sbStartBtn.disabled = true;
    sbStartBtn.style.opacity = 0.7;
  }
  if (sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

  setTimeout(()=>{
    sbPlayMusic();
    requestAnimationFrame(sbMainLoop);
    sbStartSpawnLoop();
  }, 450);
}

// ---------- Events ----------
if (sbStartBtn) sbStartBtn.addEventListener('click', sbStartGame);

if (sbPlayAgainBtn) {
  sbPlayAgainBtn.addEventListener('click',()=>{
    if (sbOverlay) sbOverlay.classList.add('hidden');
    if (sbStartBtn) { sbStartBtn.disabled = false; sbStartBtn.style.opacity = 1; }
    // restart immediately (keeps play-only)
    sbStartGame();
  });
}

if (sbBackHubBtn) {
  sbBackHubBtn.addEventListener('click',()=>{
    const hub = sbQS('hub','') || '';
    location.href = hub || './index.html';
  });
}

if (sbDownloadCsvBtn) sbDownloadCsvBtn.addEventListener('click', sbDownloadCsv);

Object.values(sbMetaInputs).forEach(el=>{
  if (!el) return;
  el.addEventListener('change', sbSaveMetaDraft);
  el.addEventListener('blur',   sbSaveMetaDraft);
});

// ---------- Init ----------
sbLoadMeta();
sbApplyLang();
sbInitBossBanner();
sbInitAudio();
if (sbHUD.timeVal) sbHUD.timeVal.textContent = (sbMode==='endless') ? '∞' : String(sbTimeSec);