/* === /herohealth/plate/plate.safe.js ===
PlateVR — PRODUCTION (HHA Standard + ULTIMATE PACK)
✅ Start overlay (กดเริ่มแล้วค่อยเริ่มนับเวลา)
✅ HUD + Coach (ใช้รูปใน /herohealth/img: plate-neutral/happy/sad/fever.png)
✅ Targets (DOM) + Crosshair shoot + Tap hit
✅ Safe-zone clamp กันทับ HUD บน/ล่าง/ซ้าย/ขวา + coachPanel
✅ View shift (drag + gyro) แล้ว "เป้าเลื่อนตาม" เหมือน VR
✅ Miss+Lives (3/3) + Fever + Shield (จาก FEVER)
✅ Boss hazards (Ring gap + Laser line + Double) “หลบได้จริง”
✅ Screen shake/impact scale ตาม fever%
✅ Explode / pop targets + particles.js burst/scorePop
✅ Goals sequential + Minis chain (2 goals, 7 minis)
✅ End summary overlay + Back HUB + Play again + localStorage(HHA_LAST_SUMMARY)
✅ Deterministic RNG (research default) + optional ?seed=
✅ Logging: dispatch 'hha:log_event' {type,data} + session summary via 'hha:end'
*/

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc = ROOT.document;
if (!doc) throw new Error('PlateVR requires document');

const qs = () => new URLSearchParams(ROOT.location.search || '');
const clamp = (v, a, b) => { v = Number(v); if (!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); };
const now = () => (ROOT.performance && performance.now) ? performance.now() : Date.now();

function $(id){ return doc.getElementById(id); }
function setTxt(el, s){ if(el) el.textContent = String(s); }

function safeFxText(s){
  return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// ------------------------- modules (Particles / Logger) -------------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){}, };

function logEvent(type, data){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_event', { detail: { type, data: data||{} } }));
  }catch(_){}
}

function emitEndSummary(summary){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:end', { detail: summary || {} }));
  }catch(_){}
}

function vibe(ms){
  try{ if(navigator.vibrate) navigator.vibrate(ms|0); }catch(_){}
}

// ------------------------- audio (tiny) -------------------------
const AudioX = (() => {
  let ctx = null;
  function ensure(){
    if(ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function ping(freq=660, dur=0.06, gain=0.05){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }
  function ok(){ ping(880, 0.05, 0.05); }
  function good(){ ping(740, 0.06, 0.05); }
  function gold(){ ping(1040, 0.08, 0.06); }
  function bad(){ ping(220, 0.08, 0.07); }
  function warn(){ ping(420, 0.10, 0.06); }
  function tick(){ ping(520, 0.03, 0.03); }
  async function unlock(){
    const c = ensure(); if(!c) return;
    if(c.state === 'suspended') try{ await c.resume(); }catch(_){}
    // tiny silent
    try{ ping(2, 0.01, 0.0001); }catch(_){}
  }
  return { unlock, ok, good, gold, bad, warn, tick };
})();

// ------------------------- params / mode -------------------------
const P = qs();
const MODE = String(P.get('run') || 'play').toLowerCase();          // play | research
const DIFF = String(P.get('diff') || 'normal').toLowerCase();      // easy | normal | hard
const TOTAL_TIME = clamp(P.get('time') || 80, 30, 600) | 0;
const DEBUG = (String(P.get('debug')||'') === '1');

const HUB_URL = String(P.get('hub') || '../index.html');
const GAME_TAG = 'PlateVR';

const STUDY = {
  studyId: String(P.get('study') || ''),
  phase: String(P.get('phase') || ''),
  conditionGroup: String(P.get('cond') || ''),
  sessionOrder: String(P.get('order') || ''),
};

// deterministic seed
function hashSeed(str){
  str = String(str || '');
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0);
}
function mulberry32(a){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_SEED = (MODE === 'research')
  ? (P.get('seed') || `research-${DIFF}-${TOTAL_TIME}`)
  : (P.get('seed') || `play-${Date.now()}`);

const RNG = mulberry32(hashSeed(DEFAULT_SEED));
const R = () => RNG();
const rnd = (a,b)=> a + R()*(b-a);
const rndi = (a,b)=> (a + Math.floor(R()*(b-a+1)))|0;

function isTouch(){
  return ('ontouchstart' in ROOT) || (navigator.maxTouchPoints > 0);
}

// ------------------------- DOM refs -------------------------
const HUD = {
  time: $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss: $('hudMiss'),
  plate: $('hudGroupsHave'),
  feverPct: $('hudFeverPct'),
  grade: $('hudGrade'),
  lives: $('hudLives'),
  shieldCount: $('hudShield'),

  miniLine: $('miniLine'),
  goalLine: $('goalLine'),
  miniHint: $('miniHint'),

  paused: $('hudPaused'),
  hitFx: $('hitFx'),

  startOverlay: $('startOverlay'),
  btnStart: $('btnStart'),

  btnEnterVR: $('btnEnterVR'),
  btnPause: $('btnPause'),
  btnRestart: $('btnRestart'),

  resultBackdrop: $('resultBackdrop'),
  btnBackHub: $('btnBackHub'),
  btnPlayAgain: $('btnPlayAgain'),

  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  rG1: $('rG1'), rG2: $('rG2'), rG3: $('rG3'), rG4: $('rG4'), rG5: $('rG5'), rGTotal: $('rGTotal'),

  coachImg: $('coachImg'),
  coachText: $('coachText'),

  bossRing: $('bossRing'),
  bossLaser: $('bossLaser'),
};

function refreshHUDRefs(){
  HUD.time ||= $('hudTime');
  HUD.score ||= $('hudScore');
  HUD.combo ||= $('hudCombo');
  HUD.miss ||= $('hudMiss');
  HUD.plate ||= $('hudGroupsHave');
  HUD.feverPct ||= $('hudFeverPct');
  HUD.grade ||= $('hudGrade');
  HUD.lives ||= $('hudLives');
  HUD.shieldCount ||= $('hudShield');

  HUD.miniLine ||= $('miniLine');
  HUD.goalLine ||= $('goalLine');
  HUD.miniHint ||= $('miniHint');

  HUD.paused ||= $('hudPaused');
  HUD.hitFx ||= $('hitFx');

  HUD.startOverlay ||= $('startOverlay');
  HUD.btnStart ||= $('btnStart');

  HUD.btnEnterVR ||= $('btnEnterVR');
  HUD.btnPause ||= $('btnPause');
  HUD.btnRestart ||= $('btnRestart');

  HUD.resultBackdrop ||= $('resultBackdrop');
  HUD.btnBackHub ||= $('btnBackHub');
  HUD.btnPlayAgain ||= $('btnPlayAgain');

  HUD.rMode ||= $('rMode');
  HUD.rGrade ||= $('rGrade');
  HUD.rScore ||= $('rScore');
  HUD.rMaxCombo ||= $('rMaxCombo');
  HUD.rMiss ||= $('rMiss');
  HUD.rPerfect ||= $('rPerfect');
  HUD.rGoals ||= $('rGoals');
  HUD.rMinis ||= $('rMinis');
  HUD.rG1 ||= $('rG1'); HUD.rG2 ||= $('rG2'); HUD.rG3 ||= $('rG3'); HUD.rG4 ||= $('rG4'); HUD.rG5 ||= $('rG5'); HUD.rGTotal ||= $('rGTotal');

  HUD.coachImg ||= $('coachImg');
  HUD.coachText ||= $('coachText');

  HUD.bossRing ||= $('bossRing');
  HUD.bossLaser ||= $('bossLaser');
}

// ------------------------- layers / view shift -------------------------
let layer = null;
function ensureLayer(){
  if(layer) return layer;
  layer = doc.createElement('div');
  layer.className = 'plate-layer';
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '520',
    pointerEvents: 'none',
    transform: 'translate3d(0px,0px,0px)',
  });
  doc.body.appendChild(layer);
  return layer;
}

const VIEW = { x: 0, y: 0, tx: 0, ty: 0, dragging:false, sx:0, sy:0, gx:0, gy:0, hasGyro:false };
function applyView(){
  ensureLayer();
  // smooth
  VIEW.x += (VIEW.tx - VIEW.x) * 0.22;
  VIEW.y += (VIEW.ty - VIEW.y) * 0.22;
  layer.style.transform = `translate3d(${VIEW.x}px, ${VIEW.y}px, 0)`;
}
function viewOffset(){
  return { x: VIEW.x, y: VIEW.y };
}

function bindViewControls(){
  // drag
  const onDown = (e)=>{
    if(S.paused || S.ended) return;
    VIEW.dragging = true;
    const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
    VIEW.sx = t.clientX; VIEW.sy = t.clientY;
    VIEW.gx = VIEW.tx; VIEW.gy = VIEW.ty;
  };
  const onMove = (e)=>{
    if(!VIEW.dragging) return;
    const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const dx = t.clientX - VIEW.sx;
    const dy = t.clientY - VIEW.sy;
    // feel like head-turn: small movement
    VIEW.tx = clamp(VIEW.gx + dx*0.35, -220, 220);
    VIEW.ty = clamp(VIEW.gy + dy*0.35, -160, 160);
  };
  const onUp = ()=>{
    VIEW.dragging = false;
    // keep a bit
    VIEW.tx = clamp(VIEW.tx, -240, 240);
    VIEW.ty = clamp(VIEW.ty, -180, 180);
  };

  doc.addEventListener('pointerdown', onDown, { passive:true });
  doc.addEventListener('pointermove', onMove, { passive:true });
  doc.addEventListener('pointerup', onUp, { passive:true });

  doc.addEventListener('touchstart', onDown, { passive:true });
  doc.addEventListener('touchmove', onMove, { passive:true });
  doc.addEventListener('touchend', onUp, { passive:true });

  // gyro
  function onOri(e){
    if(!e) return;
    const g = clamp(e.gamma || 0, -35, 35); // left/right
    const b = clamp(e.beta  || 0, -35, 35); // up/down
    VIEW.hasGyro = true;
    // merge with drag target
    VIEW.tx = clamp(VIEW.tx + g*0.55, -240, 240);
    VIEW.ty = clamp(VIEW.ty + b*0.22, -180, 180);
  }
  ROOT.addEventListener('deviceorientation', onOri, true);
}

// ------------------------- spawn / safe zones -------------------------
function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  if(!r || !Number.isFinite(r.left)) return null;
  return { l:r.left, t:r.top, r:r.right, b:r.bottom };
}

function getBlockedRects(){
  // HUD panels + buttons + mini + coach
  const ids = ['hudTop','hudBtns','miniPanel','coachPanel'];
  const out = [];
  for(const id of ids){
    const el = $(id);
    const rr = rectOf(el);
    if(rr) out.push(rr);
  }
  return out;
}

function pointInRect(x,y, rr){
  return x>=rr.l && x<=rr.r && y>=rr.t && y<=rr.b;
}

function pickSpawnXY(sizePx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;

  // clamp safe-area + edges
  const pad = 10;
  const safe = {
    l: pad + sizePx*0.55,
    r: vw - pad - sizePx*0.55,
    t: pad + sizePx*0.55,
    b: vh - pad - sizePx*0.55,
  };

  // extra: do not spawn too close to center crosshair safezone
  const cx = vw/2, cy = vh/2;
  let safeR = Math.min(170, Math.min(vw,vh)*0.18);
  if(vw < 420 || vh < 700) safeR = Math.min(140, Math.min(vw,vh)*0.16);

  const blocked = getBlockedRects();
  const tries = 80;

  for(let i=0;i<tries;i++){
    const x = rnd(safe.l, safe.r);
    const y = rnd(safe.t, safe.b);

    // safezone around crosshair
    const dx = x - cx, dy = y - cy;
    if(Math.hypot(dx,dy) < safeR) continue;

    // avoid blocked rects
    let ok = true;
    for(const rr of blocked){
      if(pointInRect(x,y, rr)) { ok=false; break; }
    }
    if(!ok) continue;

    return { x, y };
  }

  // fallback: relax safezone
  return {
    x: rnd(safe.l, safe.r),
    y: rnd(safe.t, safe.b),
  };
}

// ------------------------- game config (diff) -------------------------
const DIFF_CFG = {
  easy:   { spawnMs: 980, lifeMs: 2100, badBias: 0.18, goldBias: 0.05, bossEveryMs: 10500 },
  normal: { spawnMs: 780, lifeMs: 1850, badBias: 0.26, goldBias: 0.06, bossEveryMs: 9000  },
  hard:   { spawnMs: 640, lifeMs: 1650, badBias: 0.34, goldBias: 0.07, bossEveryMs: 7800  },
};

const D0 = DIFF_CFG[DIFF] || DIFF_CFG.normal;

// ------------------------- state -------------------------
const S = {
  started: false,
  paused: false,
  ended: false,

  t0: 0,
  lastFrame: 0,
  elapsedMs: 0,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  perfect: 0,

  fever: 0,
  feverOn: false,

  shield: 0,
  shieldMax: 3,

  lives: 3,
  livesMax: 3,
  lifeStepMiss: 3,    // 1 heart ต่อ 3 miss (ท้าทายกำลังดี)
  lifeLost: 0,

  plateHave: new Set(),      // groups 1..5 collected
  gCount: { 1:0,2:0,3:0,4:0,5:0 },

  targets: [],
  nextSpawnAt: 0,
  nextBossAt: 0,

  // adaptive (play only)
  adapt: {
    spawnMul: 1.00,
    lifeMul:  1.00,
    junkBias: 0.00,
    lastAt: 0,
    ema: 0,
    wHits:0,wBad:0,wWhiff:0,wMiss:0,wPerf:0,
  },

  // quest director
  Q: null,
};

// ------------------------- coach -------------------------
const COACH_IMG = {
  neutral: './img/plate-neutral.png',
  happy:   './img/plate-happy.png',
  sad:     './img/plate-sad.png',
  fever:   './img/plate-fever.png',
};

let _coachTimer = 0;
function gradeFromScore(){
  // grade: SSS, SS, S, A, B, C
  const s = S.score;
  if(s >= 5600) return 'SSS';
  if(s >= 4200) return 'SS';
  if(s >= 3000) return 'S';
  if(s >= 2000) return 'A';
  if(s >= 1200) return 'B';
  return 'C';
}
function coachHintBase(){
  return `Grade: ${gradeFromScore()} • Lives: ${S.lives}/${S.livesMax} • Plate: ${S.plateHave.size}/5`;
}
function setCoach(mood, text, sub='', ms=1700){
  refreshHUDRefs();
  mood = String(mood||'neutral').toLowerCase();
  if(!COACH_IMG[mood]) mood = 'neutral';
  if(HUD.coachImg){
    const src = COACH_IMG[mood] || COACH_IMG.neutral;
    if(HUD.coachImg.getAttribute('src') !== src) HUD.coachImg.setAttribute('src', src);
  }
  if(HUD.coachText){
    const s = sub ? `<span class="sub">${safeFxText(sub)}</span>` : '';
    HUD.coachText.innerHTML = `${safeFxText(text||'')}${s}`;
  }
  if(_coachTimer) clearTimeout(_coachTimer);
  if(ms > 0 && mood !== 'neutral'){
    _coachTimer = setTimeout(()=>{
      const back = S.feverOn ? 'fever' : 'neutral';
      const backText = S.feverOn ? '🔥 FEVER! ยิงให้ไว! แต้มคูณมาแล้ว!' : 'โฟกัสกลางจอ แล้วกวาดให้ครบ 5 หมู่!';
      setCoach(back, backText, coachHintBase(), 0);
    }, ms|0);
  }
}

// ------------------------- HUD helpers -------------------------
function setShield(n){
  S.shield = clamp(n, 0, S.shieldMax) | 0;
  refreshHUDRefs();
  if(HUD.shieldCount) setTxt(HUD.shieldCount, String(S.shield));
}
function setLives(n){
  S.lives = clamp(n, 0, S.livesMax) | 0;
  refreshHUDRefs();
  if(HUD.lives) setTxt(HUD.lives, `${S.lives}/${S.livesMax}`);
}
function addScore(d){
  S.score = Math.max(0, (S.score + (d|0))|0);
  refreshHUDRefs();
  if(HUD.score) setTxt(HUD.score, S.score);
}
function setCombo(n){
  S.combo = Math.max(0, n|0);
  S.comboMax = Math.max(S.comboMax, S.combo);
  refreshHUDRefs();
  if(HUD.combo) setTxt(HUD.combo, S.combo);
}
function addMiss(){
  S.miss++;
  refreshHUDRefs();
  if(HUD.miss) setTxt(HUD.miss, S.miss);

  // life loss every step misses
  const wantLost = Math.floor(S.miss / S.lifeStepMiss);
  const need = wantLost - S.lifeLost;
  if(need > 0){
    S.lifeLost += need;
    setLives(S.lives - need);
    if(S.lives <= 0){
      endGame('หมดหัวใจ');
    }else{
      setCoach('sad', `เสียหัวใจ! เหลือ ${S.lives}/${S.livesMax} ❤️`, coachHintBase(), 1500);
    }
  }
}

function setFever(pct){
  S.fever = clamp(pct, 0, 100);
  refreshHUDRefs();
  if(HUD.feverPct) setTxt(HUD.feverPct, `${Math.round(S.fever)}%`);

  const on = (S.fever >= 100);
  if(on && !S.feverOn){
    S.feverOn = true;
    // give shield charges
    setShield(Math.max(S.shield, 2));
    setCoach('fever', '🔥 FEVER! ได้โล่ป้องกันขยะ/บอส 2 ครั้ง!', coachHintBase(), 1800);
    logEvent('fever_on', { fever: S.fever, shield: S.shield });
  }
  if(!on && S.feverOn && S.fever < 90){
    S.feverOn = false;
    logEvent('fever_off', { fever: S.fever, shield: S.shield });
  }
}

function addFever(delta){
  setFever(S.fever + delta);
}

// hit flash
let _hitFxT = 0;
function hitFlash(kind){
  refreshHUDRefs();
  const el = HUD.hitFx;
  if(!el) return;
  el.setAttribute('data-kind', kind || 'good');
  el.classList.remove('show');
  void el.offsetHeight;
  el.classList.add('show');
  if(_hitFxT) clearTimeout(_hitFxT);
  _hitFxT = setTimeout(()=>{ try{ el.classList.remove('show'); }catch(_){} }, 90);
}

// screen shake (scale with fever)
let _shakeT = 0;
function shake(base=1.0, ms=160){
  try{
    const f = clamp((S.fever||0)/100, 0, 1);
    const amp = clamp(base * (0.85 + f*1.25), 0.6, 2.6);

    doc.body.style.setProperty('--shakeMs', `${Math.round(ms)}ms`);
    doc.body.style.setProperty('--sx',  `${Math.round(-2*amp)}px`);
    doc.body.style.setProperty('--sy',  `${Math.round( 1*amp)}px`);
    doc.body.style.setProperty('--sx2', `${Math.round( 2*amp)}px`);
    doc.body.style.setProperty('--sy2', `${Math.round(-2*amp)}px`);

    doc.body.classList.remove('hha-shake');
    void doc.body.offsetHeight;
    doc.body.classList.add('hha-shake');

    if(_shakeT) clearTimeout(_shakeT);
    _shakeT = setTimeout(()=>{ try{ doc.body.classList.remove('hha-shake'); }catch(_){} }, Math.max(80, ms+40));
  }catch(_){}
}

// ------------------------- targets / emojis -------------------------
const GROUPS = [
  { id:1, name:'โปรตีน', emoji:['🥩','🥚','🥛','🐟','🫘'] },
  { id:2, name:'ข้าว-แป้ง', emoji:['🍚','🍞','🍜','🥔','🌽'] },
  { id:3, name:'ผัก', emoji:['🥦','🥬','🥒','🥕','🌶️'] },
  { id:4, name:'ผลไม้', emoji:['🍎','🍌','🍊','🍉','🍇'] },
  { id:5, name:'ไขมันดี', emoji:['🥑','🫒','🥜','🧈','🧀'] },
];

const JUNK = ['🍟','🍔','🍕','🍩','🍰','🧋','🥤','🍭'];
const TRAP = ['💣','🧨','☠️','🧪'];
const FAKE = ['🎭','🌀','❌','⚠️'];
const GOLD = ['⭐','🌟','💎'];
const BOSS = ['👹','😈','🦾'];

function pick(arr){ return arr[rndi(0, arr.length-1)]; }

function makeTargetEl(emoji, size){
  const el = doc.createElement('div');
  el.className = 'plateTarget';
  Object.assign(el.style, {
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    transform: 'translate(-50%,-50%)',
    display: 'grid',
    placeItems: 'center',
    fontSize: `${Math.round(size*0.60)}px`,
    borderRadius: '999px',
    pointerEvents: 'auto',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    background: 'rgba(2,6,23,.35)',
    border: '1px solid rgba(148,163,184,.18)',
    boxShadow: '0 16px 38px rgba(0,0,0,.28)',
    backdropFilter: 'blur(6px)',
  });
  el.textContent = emoji;
  return el;
}

function dieTarget(rec, kind='good'){
  if(!rec || rec.dead || !rec.el) return;
  try{
    rec.el.classList.remove('die-good','die-bad');
    rec.el.classList.add(kind==='bad' ? 'die-bad' : 'die-good');
  }catch(_){}
  setTimeout(()=>{ try{ rec.el && rec.el.remove(); }catch(_){} }, 175);
}

// ------------------------- adaptive (play only) -------------------------
function adaptBump(evt){
  if(MODE !== 'play') return;
  switch(evt){
    case 'hit_good': S.adapt.wHits++; break;
    case 'hit_bad':  S.adapt.wBad++; break;
    case 'whiff':    S.adapt.wWhiff++; break;
    case 'miss':     S.adapt.wMiss++; break;
    case 'perfect':  S.adapt.wPerf++; break;
  }
}

function adaptTick(){
  if(MODE !== 'play') return;
  const t = now();
  if(!S.adapt.lastAt) S.adapt.lastAt = t;
  if(t - S.adapt.lastAt < 2200) return;

  const hits = S.adapt.wHits;
  const bad  = S.adapt.wBad;
  const whf  = S.adapt.wWhiff;
  const mis  = S.adapt.wMiss;
  const perf = S.adapt.wPerf;
  const totalShots = Math.max(1, hits + bad + whf);

  const hitRate   = hits / totalShots;
  const badRate   = bad  / totalShots;
  const perfRate  = perf / Math.max(1, hits);
  const missRate  = mis  / Math.max(1, (mis+hits));

  let skill =
    0.55*hitRate +
    0.20*perfRate -
    0.35*badRate -
    0.25*missRate;

  skill = clamp(skill, 0, 1);
  S.adapt.ema = (S.adapt.ema*0.70) + (skill*0.30);
  const s = S.adapt.ema;

  // เก่ง -> เร็วขึ้น, อายุสั้นลง, junk เพิ่ม
  S.adapt.spawnMul = clamp(1.18 - s*0.52, 0.72, 1.22);
  S.adapt.lifeMul  = clamp(1.14 - s*0.36, 0.78, 1.20);
  S.adapt.junkBias = clamp(-0.05 + s*0.12, -0.06, 0.10);

  S.adapt.wHits = S.adapt.wBad = S.adapt.wWhiff = S.adapt.wMiss = S.adapt.wPerf = 0;
  S.adapt.lastAt = t;

  if(DEBUG) console.log('[PlateVR][ADAPT]', {skill:s.toFixed(2), spawnMul:S.adapt.spawnMul.toFixed(2), lifeMul:S.adapt.lifeMul.toFixed(2), junkBias:S.adapt.junkBias.toFixed(2)});
}

// ------------------------- boss hazards (Ring gap + Laser + Double) -------------------------
function showRingHaz(x, y, dPx, gapRad, gapWidthDeg=70, thPx=12){
  refreshHUDRefs();
  const host = HUD.bossRing || $('bossRing');
  if(!host) return;
  const ring = host.querySelector('.ring');
  if(!ring) return;
  host.style.display = 'block';
  ring.style.setProperty('--x', `${x}px`);
  ring.style.setProperty('--y', `${y}px`);
  ring.style.setProperty('--d', `${dPx}px`);
  ring.style.setProperty('--th', `${thPx}px`);
  ring.style.setProperty('--gapA', String(gapRad));
  ring.style.setProperty('--gapW', `${gapWidthDeg}deg`);
}

function showLaserHaz(x, y, angRad, wPx=16){
  refreshHUDRefs();
  const host = HUD.bossLaser || $('bossLaser');
  if(!host) return;
  const beam = host.querySelector('.beam');
  if(!beam) return;
  host.style.display = 'block';
  beam.style.setProperty('--x', `${x}px`);
  beam.style.setProperty('--y', `${y}px`);
  beam.style.setProperty('--ang', `${angRad}rad`);
  beam.style.setProperty('--w', `${wPx}px`);
}

function hideBossHaz(){
  refreshHUDRefs();
  if(HUD.bossRing) HUD.bossRing.style.display = 'none';
  if(HUD.bossLaser) HUD.bossLaser.style.display = 'none';
}

function angleDistRad(a,b){
  let d = a - b;
  while(d > Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return Math.abs(d);
}

function bossPhase(){
  const remain = S.elapsedMs / (TOTAL_TIME*1000);
  // เริ่มอ่อน -> กลาง -> โหดท้ายเกม
  if(remain < 0.33) return 1;
  if(remain < 0.70) return 2;
  return 3;
}
function bossStyleForPhase(ph){
  if(ph === 1) return 'ring';
  if(ph === 2) return (R()<0.65 ? 'laser' : 'ring');
  return (R()<0.45 ? 'double' : (R()<0.72 ? 'laser' : 'ring'));
}

function bossHazardWarn(rec, style, phase){
  const off = viewOffset();
  const bx = rec.cx + off.x;
  const by = rec.cy + off.y;

  rec.meta ||= {};
  rec.meta.haz = {
    style,
    bx, by,
    ring: { gapA: R()*Math.PI*2, gapW: (phase===3?55:(phase===2?62:72)), rad: (phase===3?220:(phase===2?210:200)) },
    laser:{ ang: (R()*Math.PI*2), w: (phase===3?18:16) }
  };

  hideBossHaz();

  const dPx = rec.meta.haz.ring.rad*2;
  const thPx = (phase===3)?14:12;

  if(style === 'ring'){
    showRingHaz(bx, by, dPx, rec.meta.haz.ring.gapA, rec.meta.haz.ring.gapW, thPx);
    setCoach('fever', '⚠️ BOSS RING! เลื่อนมุมมองให้ “ช่องว่าง” ตรงกลางจอ!', coachHintBase(), 1400);
  }else if(style === 'laser'){
    showLaserHaz(bx, by, rec.meta.haz.laser.ang, rec.meta.haz.laser.w);
    setCoach('fever', '⚠️ LASER! หลบเส้นเลเซอร์จากบอส!', coachHintBase(), 1400);
  }else{
    showRingHaz(bx, by, dPx, rec.meta.haz.ring.gapA, rec.meta.haz.ring.gapW, thPx);
    showLaserHaz(bx, by, rec.meta.haz.laser.ang, rec.meta.haz.laser.w);
    setCoach('fever', '☠️ DOUBLE! ต้องหลบทั้งวง + เลเซอร์!', coachHintBase(), 1600);
  }

  shake(0.85, 160);
}

function bossHazardHit(rec){
  const hz = rec && rec.meta && rec.meta.haz;
  if(!hz) return { hit:false };

  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const cx = vw/2, cy = vh/2;

  let hitRing=false, hitLaser=false;

  if(hz.style === 'ring' || hz.style === 'double'){
    const dx = cx - hz.bx;
    const dy = cy - hz.by;
    const rr = Math.hypot(dx,dy);
    const ang = Math.atan2(dy, dx);
    const ringRad = hz.ring.rad;
    const band = 18;
    const inBand = (rr >= ringRad - band) && (rr <= ringRad + band);
    const half = (hz.ring.gapW * Math.PI / 180) * 0.5;
    const inGap = (angleDistRad(ang, hz.ring.gapA) <= half);
    hitRing = inBand && !inGap;
  }

  if(hz.style === 'laser' || hz.style === 'double'){
    const ang = hz.laser.ang;
    const dx = cx - hz.bx;
    const dy = cy - hz.by;
    const dist = Math.abs(-Math.sin(ang)*dx + Math.cos(ang)*dy);
    const thr = Math.max(10, (hz.laser.w||16)*0.62);
    hitLaser = (dist <= thr);
  }

  return { hit:(hitRing||hitLaser), hitRing, hitLaser };
}

// ------------------------- quest (2 goals + 7 minis) -------------------------
const GOALS = [
  { id:'G1', title:'Goal 1: เก็บให้ครบ 5 หมู่', check:()=> S.plateHave.size>=5 },
  { id:'G2', title:'Goal 2: ทำคะแนนให้ถึงเป้า', check:()=> S.score>= (DIFF==='hard'?2600:(DIFF==='easy'?1800:2200)) },
];

const MINIS = [
  { id:'M1', title:'Mini: PERFECT 3 ครั้ง', hint:'เล็งกลางเป้าให้เป๊ะ', check:()=> S.perfect>=3 },
  { id:'M2', title:'Mini: COMBO 12+', hint:'อย่าให้พลาดติดกัน', check:()=> S.comboMax>=12 },
  { id:'M3', title:'Mini: เก็บหมู่ 3 (ผัก) 3 ครั้ง', hint:'สีเขียวช่วยมาก!', check:()=> (S.gCount[3]||0)>=3 },
  { id:'M4', title:'Mini: Gold 2 ครั้ง', hint:'⭐/💎 ให้คะแนนสูง', check:()=> (S._goldHits||0)>=2 },
  { id:'M5', title:'Mini: หลบบอส 2 ครั้ง', hint:'ดูวง/เลเซอร์ แล้วขยับมุมมอง', check:()=> (S._bossDodges||0)>=2 },
  { id:'M6', title:'Mini: ห้ามโดนขยะ 10 วินาที', hint:'ถ้าโดนขยะ รีเซ็ต', windowSec:10 },
  { id:'M7', title:'Mini: Plate Rush — ครบ 5 ใน 8 วิ & ห้ามโดนขยะ', hint:'เริ่มนับเมื่อเก็บหมู่แรก', rushSec:8 },
];

function makeQuestDirector(){
  return {
    goalIndex: 0,
    goalsCleared: 0,
    miniIndex: 0,
    minisCleared: 0,

    miniState: {
      noJunkUntil: 0,
      rushActive:false,
      rushStartAt:0,
      rushJunkHit:false,
      rushStartPlateSize:0,
      lastJunkAt:0,
    },

    updateHUD(){
      refreshHUDRefs();
      const g = GOALS[this.goalIndex] || GOALS[GOALS.length-1];
      const m = MINIS[this.miniIndex] || MINIS[MINIS.length-1];
      if(HUD.goalLine) setTxt(HUD.goalLine, `Goal: ${g ? g.title : '—'} (${this.goalsCleared}/${GOALS.length})`);
      if(HUD.miniLine) setTxt(HUD.miniLine, `MINI: ${m ? m.title : '—'} (${this.minisCleared}/${MINIS.length})`);
      if(HUD.miniHint) setTxt(HUD.miniHint, m && m.hint ? m.hint : 'ทำให้เต็มที่!');
    },

    tick(){
      // goal
      const g = GOALS[this.goalIndex];
      if(g && g.check && g.check()){
        this.goalsCleared++;
        this.goalIndex = Math.min(GOALS.length-1, this.goalIndex+1);

        Particles.celebrate && Particles.celebrate('GOAL');
        setCoach('happy', 'ผ่าน GOAL! 🏆', coachHintBase(), 1400);
        AudioX.ok(); vibe(25);
        logEvent('quest_goal_clear', { goalId:g.id, goalsCleared:this.goalsCleared });
      }

      // mini special: M6 no-junk window
      const m = MINIS[this.miniIndex];
      if(m && m.id === 'M6'){
        const t = now();
        if(this.miniState.noJunkUntil <= 0){
          this.miniState.noJunkUntil = t + (m.windowSec*1000);
          this.miniState.lastJunkAt = 0;
        }
        // if junk happened, reset
        if(this.miniState.lastJunkAt && this.miniState.lastJunkAt > t - (m.windowSec*1000)){
          this.miniState.noJunkUntil = t + (m.windowSec*1000);
          this.miniState.lastJunkAt = 0;
          setCoach('sad', 'โดนขยะ! รีเซ็ตจับเวลาใหม่ 😵', coachHintBase(), 1200);
        }
        // if reached end
        if(t >= this.miniState.noJunkUntil){
          this._clearMini(m);
        }
      }

      // mini special: M7 rush
      if(m && m.id === 'M7'){
        const t = now();
        if(!this.miniState.rushActive){
          // start when pick first group
          if(S.plateHave.size >= 1){
            this.miniState.rushActive = true;
            this.miniState.rushStartAt = t;
            this.miniState.rushJunkHit = false;
            this.miniState.rushStartPlateSize = S.plateHave.size;
          }
        }else{
          const elapsed = (t - this.miniState.rushStartAt);
          const okPlate = (S.plateHave.size >= 5);
          const inTime = (elapsed <= (m.rushSec*1000));
          if(okPlate && inTime && !this.miniState.rushJunkHit){
            this._clearMini(m);
          }else if(elapsed > (m.rushSec*1000)){
            // fail -> reset
            this.miniState.rushActive = false;
            this.miniState.rushStartAt = 0;
            this.miniState.rushJunkHit = false;
            setCoach('sad', 'Plate Rush ไม่ทัน! ลองใหม่ 💨', coachHintBase(), 1300);
          }
        }
      }

      // normal minis
      if(m && m.check && m.check()){
        this._clearMini(m);
      }

      this.updateHUD();
    },

    markJunkHit(){
      const m = MINIS[this.miniIndex];
      if(m && m.id === 'M6') this.miniState.lastJunkAt = now();
      if(m && m.id === 'M7') this.miniState.rushJunkHit = true;
    },

    _clearMini(m){
      this.minisCleared++;
      this.miniIndex = Math.min(MINIS.length-1, this.miniIndex+1);

      Particles.celebrate && Particles.celebrate('MINI');
      setCoach('happy', 'ผ่าน MINI! ✨', coachHintBase(), 1400);
      AudioX.ok(); vibe(20);
      logEvent('quest_mini_clear', { miniId:m.id, minisCleared:this.minisCleared });

      // reset mini states for next
      this.miniState.noJunkUntil = 0;
      this.miniState.rushActive = false;
      this.miniState.rushStartAt = 0;
      this.miniState.rushJunkHit = false;
      this.miniState.rushStartPlateSize = 0;
      this.miniState.lastJunkAt = 0;
    }
  };
}

// ------------------------- spawn logic / kind decide -------------------------
function decideKind(){
  // base rates
  let gold = D0.goldBias;
  let junk = D0.badBias;
  let trap = (DIFF==='hard'?0.10:(DIFF==='easy'?0.05:0.08));
  let fake = (DIFF==='hard'?0.08:(DIFF==='easy'?0.03:0.06));
  let boss = 0.00;

  // boss appears on schedule
  // (spawnTick will override to boss sometimes)

  // adaptive tweak (play only)
  if(MODE==='play' && S.adapt){
    const b = S.adapt.junkBias || 0;
    junk = clamp(junk + b, 0.06, 0.52);
    trap = clamp(trap + (b*0.55), 0.01, 0.28);
    fake = clamp(fake + (b*0.35), 0.00, 0.26);
  }

  // fever on -> more good/gold, less junk
  if(S.feverOn){
    gold = clamp(gold + 0.03, 0.04, 0.18);
    junk = clamp(junk - 0.06, 0.05, 0.40);
    trap = clamp(trap - 0.02, 0.00, 0.22);
  }

  const r = R();
  if(r < gold) return 'gold';
  if(r < gold + junk) return 'junk';
  if(r < gold + junk + trap) return 'trap';
  if(r < gold + junk + trap + fake) return 'fake';
  return 'good';
}

function spawnBoss(){
  const ph = bossPhase();
  const style = bossStyleForPhase(ph);
  const size = (ph===3?96:(ph===2?92:88));
  const {x,y} = pickSpawnXY(size);
  const emoji = pick(BOSS);
  const rec = {
    id: `B${Date.now()}_${rndi(100,999)}`,
    kind: 'boss',
    emoji,
    size,
    cx: x, cy: y,
    bornAt: now(),
    dieAt: now() + (2200),
    warned: false,
    atkAt: now() + (ph===3?850:(ph===2?980:1100)),
    style,
    el: null,
    dead:false,
    meta:{}
  };

  const el = makeTargetEl(emoji, size);
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.background = 'rgba(248,113,113,.10)';
  el.style.border = '1px solid rgba(248,113,113,.30)';
  el.style.boxShadow = '0 18px 44px rgba(248,113,113,.10), 0 18px 44px rgba(0,0,0,.25)';
  el.dataset.kind = 'boss';
  el.dataset.id = rec.id;

  rec.el = el;
  ensureLayer().appendChild(el);
  S.targets.push(rec);

  logEvent('spawn', { kind:'boss', emoji, x, y, phase:ph, style });
}

function spawnOne(){
  const kind = decideKind();
  const baseSize = (DIFF==='hard'?78:(DIFF==='easy'?90:84));
  let size = baseSize;

  // little variety
  size = clamp(size + rndi(-8, 10), 64, 104);

  const {x,y} = pickSpawnXY(size);
  let emoji = '🍽️';
  let groupId = 0;

  if(kind === 'good'){
    const g = pick(GROUPS);
    groupId = g.id;
    emoji = pick(g.emoji);
  }else if(kind === 'gold'){
    emoji = pick(GOLD);
  }else if(kind === 'junk'){
    emoji = pick(JUNK);
  }else if(kind === 'trap'){
    emoji = pick(TRAP);
  }else if(kind === 'fake'){
    emoji = pick(FAKE);
  }

  let life = D0.lifeMs;
  if(MODE==='play' && S.adapt) life *= (S.adapt.lifeMul || 1.0);
  // small jitter
  life = clamp(life * rnd(0.92, 1.12), 900, 3600);

  const rec = {
    id: `${Date.now()}_${rndi(1000,9999)}`,
    kind,
    emoji,
    groupId,
    size,
    cx: x, cy: y,
    bornAt: now(),
    dieAt: now() + life,
    el: null,
    dead:false,
  };

  const el = makeTargetEl(emoji, size);
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.dataset.kind = kind;
  el.dataset.id = rec.id;
  if(kind==='gold'){
    el.style.background = 'rgba(250,204,21,.10)';
    el.style.border = '1px solid rgba(250,204,21,.28)';
  }
  if(kind==='junk' || kind==='trap' || kind==='fake'){
    el.style.background = 'rgba(248,113,113,.08)';
    el.style.border = '1px solid rgba(248,113,113,.22)';
  }

  rec.el = el;
  ensureLayer().appendChild(el);
  S.targets.push(rec);

  logEvent('spawn', { kind, emoji, x, y, groupId, ttlMs: Math.round(life) });
}

function spawnTick(){
  const t = now();
  const base = D0.spawnMs * ((MODE==='play') ? (S.adapt.spawnMul || 1.0) : 1.0);

  if(t >= S.nextSpawnAt){
    S.nextSpawnAt = t + clamp(base * rnd(0.92, 1.14), 420, 1600);
    spawnOne();
  }

  // boss schedule
  if(t >= S.nextBossAt){
    S.nextBossAt = t + clamp(D0.bossEveryMs * rnd(0.85, 1.25), 6500, 14000);
    // not too many bosses alive
    const nBoss = S.targets.filter(a=>a && !a.dead && a.kind==='boss').length;
    if(nBoss < 1) spawnBoss();
  }
}

// ------------------------- gameplay: hit / miss / shoot -------------------------
function fxScore(x,y, text){
  try{ Particles.scorePop && Particles.scorePop(x,y, text); }catch(_){}
}
function fxBurst(x,y, kind){
  try{ Particles.burstAt && Particles.burstAt(x,y, kind); }catch(_){}
}

function perfectJudgeFromDist(dist, size){
  const r = size*0.34;
  if(dist <= r*0.52) return 'PERFECT';
  if(dist <= r*0.95) return 'GREAT';
  return 'GOOD';
}

function removeRec(rec){
  if(!rec || rec.dead) return;
  rec.dead = true;
  try{ rec.el && rec.el.remove(); }catch(_){}
}

function onMiss(rec, why='expire'){
  if(S.ended) return;

  // miss definition:
  // - good expire = miss
  // - junk hit = miss (but shield block does NOT count as miss)
  // - boss hazard hit => punishBad handles miss
  addMiss();
  adaptBump('miss');

  if(why === 'expire'){
    setCombo(0);
    setCoach('sad', 'พลาดแล้ว! รีบกวาดให้ครบ 5 หมู่!', coachHintBase(), 1200);
    shake(0.95, 170);
    logEvent('miss_expire', { itemType: rec.kind, emoji: rec.emoji, id: rec.id });
  }
}

function punishBad(reason='bad', isBoss=false){
  if(S.ended) return;

  // shield blocks bad hits
  if(S.shield > 0){
    setShield(S.shield - 1);
    hitFlash('good');
    fxScore(ROOT.innerWidth/2, ROOT.innerHeight/2, '🛡️ BLOCK!');
    fxBurst(ROOT.innerWidth/2, ROOT.innerHeight/2, 'shield');
    AudioX.ok(); vibe(10);
    setCoach('happy', 'โล่กันได้! ไปต่อ! 🛡️', coachHintBase(), 1100);
    logEvent('shield_block', { reason, boss:!!isBoss, shieldLeft:S.shield });
    return;
  }

  hitFlash(isBoss?'boss':'bad');
  AudioX.bad(); vibe(isBoss?35:25);
  shake(isBoss?1.5:1.15, isBoss?210:180);

  // count as miss (junk hit or boss hit)
  addMiss();
  adaptBump('hit_bad');
  setCombo(0);

  if(S.Q) S.Q.markJunkHit();

  setCoach('sad', isBoss?'โดนบอส! หลบตอนเตือน ⚠️':'โดนขยะ/กับดัก! ระวัง!', coachHintBase(), 1500);
  logEvent('hit_bad', { reason, boss:!!isBoss });
}

function hitGood(rec, judge){
  const base = (judge==='PERFECT') ? 120 : (judge==='GREAT' ? 80 : 60);
  const mult = 1 + Math.min(1.6, S.combo*0.06);
  const add = Math.round(base * mult);

  addScore(add);
  setCombo(S.combo + 1);

  if(judge==='PERFECT'){
    S.perfect++;
    adaptBump('perfect');
    addFever(10);
    AudioX.gold();
  }else if(judge==='GREAT'){
    addFever(6);
    AudioX.good();
  }else{
    addFever(4);
    AudioX.good();
  }

  adaptBump('hit_good');
  hitFlash(judge==='PERFECT'?'gold':'good');

  // plate group collect
  if(rec.groupId >= 1 && rec.groupId <= 5){
    S.plateHave.add(rec.groupId);
    S.gCount[rec.groupId] = (S.gCount[rec.groupId]||0) + 1;
  }

  // HUD plate
  refreshHUDRefs();
  if(HUD.plate) setTxt(HUD.plate, `${S.plateHave.size}/5`);

  // fx
  const off = viewOffset();
  const fxX = rec.cx + off.x;
  const fxY = rec.cy + off.y;
  fxScore(fxX, fxY, judge==='PERFECT'?'✨PERFECT':(judge==='GREAT'?'👍GREAT':'✅GOOD'));
  fxBurst(fxX, fxY, judge==='PERFECT'?'gold':'good');

  logEvent('hit', { itemType:'good', emoji:rec.emoji, groupId:rec.groupId, judgment:judge, scoreAdd:add, combo:S.combo });

  if(S.Q) S.Q.tick();

  // little coaching
  if(judge==='PERFECT') setCoach('happy', 'PERFECT! โคตรคม! ✨', coachHintBase(), 900);
}

function hitGold(rec){
  const base = 200;
  const mult = 1 + Math.min(1.8, S.combo*0.07);
  const add = Math.round(base * mult);
  addScore(add);
  setCombo(S.combo + 1);
  S._goldHits = (S._goldHits||0) + 1;
  addFever(14);
  hitFlash('gold');
  AudioX.gold(); vibe(16);

  const off = viewOffset();
  fxScore(rec.cx+off.x, rec.cy+off.y, '⭐ GOLD!');
  fxBurst(rec.cx+off.x, rec.cy+off.y, 'gold');

  logEvent('hit', { itemType:'gold', emoji:rec.emoji, judgment:'GOLD', scoreAdd:add, combo:S.combo });
  if(S.Q) S.Q.tick();
}

function hitBoss(rec){
  // hitting boss gives small points but schedules hazard
  addScore(30);
  setCombo(S.combo + 1);
  addFever(4);
  hitFlash('boss');
  AudioX.warn(); vibe(10);

  const off = viewOffset();
  fxScore(rec.cx+off.x, rec.cy+off.y, '👹 BOSS!');
  fxBurst(rec.cx+off.x, rec.cy+off.y, 'boss');

  logEvent('hit', { itemType:'boss', emoji:rec.emoji, judgment:'HIT', scoreAdd:30, combo:S.combo });
}

function resolveHit(rec, shotX, shotY){
  if(!rec || rec.dead) return;

  const dx = shotX - (rec.cx + viewOffset().x);
  const dy = shotY - (rec.cy + viewOffset().y);
  const dist = Math.hypot(dx,dy);

  if(rec.kind === 'good'){
    const j = perfectJudgeFromDist(dist, rec.size);
    hitGood(rec, j);
    dieTarget(rec, 'good');
    removeRec(rec);
    return;
  }
  if(rec.kind === 'gold'){
    hitGold(rec);
    dieTarget(rec, 'good');
    removeRec(rec);
    return;
  }
  if(rec.kind === 'boss'){
    hitBoss(rec);
    // boss stays until ttl
    return;
  }

  // bad
  punishBad(rec.kind, false);
  dieTarget(rec, 'bad');
  removeRec(rec);
}

function findTargetAt(shotX, shotY){
  // choose nearest visible target within radius
  let best = null;
  let bestD = 1e9;

  const off = viewOffset();
  for(const rec of S.targets){
    if(!rec || rec.dead || !rec.el) continue;
    const x = rec.cx + off.x;
    const y = rec.cy + off.y;
    const d = Math.hypot(shotX - x, shotY - y);
    const hitR = rec.size * 0.46;
    if(d <= hitR && d < bestD){
      best = rec;
      bestD = d;
    }
  }
  return best;
}

function airShot(){
  if(S.ended || !S.started || S.paused) return;
  adaptBump('whiff');
  AudioX.tick();
  setCombo(Math.max(0, S.combo - 1));
  setCoach('sad', 'WHIFF! ใกล้เป้ากว่านี้อีกนิด 🎯', coachHintBase(), 1100);
  shake(0.55, 140);
  logEvent('air_shot', {});
}

function shootAtCenter(){
  const shotX = ROOT.innerWidth/2;
  const shotY = ROOT.innerHeight/2;

  const rec = findTargetAt(shotX, shotY);
  if(rec){
    resolveHit(rec, shotX, shotY);
  }else{
    airShot();
  }
}

// tap hit directly (on element)
function bindTargetClick(){
  ensureLayer();
  layer.addEventListener('pointerdown', (e)=>{
    if(S.ended || !S.started || S.paused) return;
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    if(!t.classList.contains('plateTarget')) return;

    // find rec by id
    const id = t.dataset.id;
    const rec = S.targets.find(a => a && a.id === id);
    if(!rec) return;

    const rect = t.getBoundingClientRect();
    const shotX = rect.left + rect.width/2;
    const shotY = rect.top + rect.height/2;

    resolveHit(rec, shotX, shotY);
  }, { passive:true });
}

// ------------------------- tick expire / boss attack -------------------------
function tickExpire(){
  const t = now();
  for(const rec of S.targets){
    if(!rec || rec.dead) continue;
    if(rec.kind === 'boss'){
      if(t >= rec.dieAt){
        hideBossHaz();
        dieTarget(rec,'bad');
        removeRec(rec);
      }
      continue;
    }
    if(t >= rec.dieAt){
      // good expire counts as miss, others just disappear
      if(rec.kind === 'good') onMiss(rec, 'expire');
      dieTarget(rec, rec.kind==='good'?'good':'bad');
      removeRec(rec);
    }
  }
  // compact
  if(S.targets.length > 120){
    S.targets = S.targets.filter(a=>a && !a.dead);
  }
}

function tickBossAttack(){
  const t = now();
  for(const rec of S.targets){
    if(!rec || rec.dead || rec.kind !== 'boss') continue;

    const ph = bossPhase();
    const style = rec.style || bossStyleForPhase(ph);
    const warnLead = (style==='double') ? 720 : 560;

    if(t >= rec.atkAt - warnLead && !rec.warned){
      rec.warned = true;
      bossHazardWarn(rec, style, ph);
      AudioX.warn(); vibe(15);
      logEvent('boss_warn', { phase:ph, style });
    }

    if(t >= rec.atkAt){
      rec.warned = false;

      const hz = bossHazardHit(rec);
      if(!hz.hit){
        // dodge reward
        S._bossDodges = (S._bossDodges||0) + 1;
        addScore(120);
        addFever(8);
        fxScore(ROOT.innerWidth/2, ROOT.innerHeight/2, 'DODGE!');
        AudioX.ok(); vibe(18);
        setCoach('happy', 'หลบได้! โคตรดี! 🔥', coachHintBase(), 1100);
        logEvent('boss_attack_dodge', { phase:ph, style, hz });
        if(S.Q) S.Q.tick();
      }else{
        punishBad('boss', true);
        logEvent('boss_attack_hit', { phase:ph, style, hz });
      }

      hideBossHaz();

      // schedule next
      const phaseMul = (ph===3)?0.78:(ph===2)?0.90:1.0;
      rec.atkAt = t + Math.round(rnd(900, 1400) * phaseMul);
      // chain in phase3 sometimes
      if(ph===3 && R()<0.22){
        rec.atkAt = t + rndi(850, 1200);
      }
    }
  }
}

// ------------------------- pause / restart / end -------------------------
function showStartOverlay(on){
  refreshHUDRefs();
  if(HUD.startOverlay) HUD.startOverlay.style.display = on ? 'flex' : 'none';
}
function showPaused(on){
  refreshHUDRefs();
  if(HUD.paused) HUD.paused.style.display = on ? 'block' : 'none';
}

function endGame(reason='จบเกม'){
  if(S.ended) return;
  S.ended = true;
  S.paused = true;

  // remove remaining targets (soft)
  for(const rec of S.targets){
    try{
      if(rec && !rec.dead) dieTarget(rec, rec.kind==='good'?'good':'bad');
    }catch(_){}
  }

  const grade = gradeFromScore();

  refreshHUDRefs();
  if(HUD.resultBackdrop) HUD.resultBackdrop.style.display = 'flex';

  setTxt(HUD.rMode, MODE);
  setTxt(HUD.rGrade, grade);
  setTxt(HUD.rScore, S.score);
  setTxt(HUD.rMaxCombo, S.comboMax);
  setTxt(HUD.rMiss, S.miss);
  setTxt(HUD.rPerfect, S.perfect);

  const goals = `${S.Q ? S.Q.goalsCleared : 0}/${GOALS.length}`;
  const minis = `${S.Q ? S.Q.minisCleared : 0}/${MINIS.length}`;
  setTxt(HUD.rGoals, goals);
  setTxt(HUD.rMinis, minis);

  setTxt(HUD.rG1, S.gCount[1]||0);
  setTxt(HUD.rG2, S.gCount[2]||0);
  setTxt(HUD.rG3, S.gCount[3]||0);
  setTxt(HUD.rG4, S.gCount[4]||0);
  setTxt(HUD.rG5, S.gCount[5]||0);
  setTxt(HUD.rGTotal, (S.gCount[1]||0)+(S.gCount[2]||0)+(S.gCount[3]||0)+(S.gCount[4]||0)+(S.gCount[5]||0));

  setCoach('neutral', `จบเกมแล้ว: ${reason}`, `Grade ${grade} • Score ${S.score} • Miss ${S.miss}`, 0);

  // summary for storage
  const summary = {
    game: GAME_TAG,
    mode: MODE,
    diff: DIFF,
    timeSec: TOTAL_TIME,
    seed: DEFAULT_SEED,
    reason,
    score: S.score,
    grade,
    comboMax: S.comboMax,
    miss: S.miss,
    perfect: S.perfect,
    goalsCleared: S.Q ? S.Q.goalsCleared : 0,
    goalsTotal: GOALS.length,
    minisCleared: S.Q ? S.Q.minisCleared : 0,
    minisTotal: MINIS.length,
    gCount: S.gCount,
    plateHave: Array.from(S.plateHave),
    startedAtMs: S.t0,
    endedAtMs: now(),
    durationPlayedSec: Math.round(S.elapsedMs/1000),
    study: STUDY,
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
  }catch(_){}

  emitEndSummary(summary);
  logEvent('end', summary);
}

function restartGame(){
  // reload keeping query
  ROOT.location.reload();
}

function goHub(){
  try{
    const u = new URL(HUB_URL, ROOT.location.href);
    // pass back
    u.searchParams.set('from', 'plate');
    u.searchParams.set('last', String(Date.now()));
    ROOT.location.href = String(u);
  }catch(_){
    ROOT.location.href = HUB_URL;
  }
}

// ------------------------- UI binds -------------------------
function bindUI(){
  refreshHUDRefs();

  if(HUD.btnStart){
    HUD.btnStart.addEventListener('click', async ()=>{
      await AudioX.unlock();
      await requestMotionIfNeeded();
      showStartOverlay(false);
      start();
      setCoach('happy', 'ลุย! กวาดให้ครบ 5 หมู่เป็น “จานสมดุล”!', coachHintBase(), 1600);
    }, { passive:true });
  }

  if(HUD.btnEnterVR){
    HUD.btnEnterVR.addEventListener('click', ()=>{
      const scene = doc.querySelector('a-scene');
      if(scene && scene.enterVR) scene.enterVR();
    }, { passive:true });
  }

  if(HUD.btnPause){
    HUD.btnPause.addEventListener('click', ()=>{
      if(!S.started || S.ended) return;
      S.paused = !S.paused;
      showPaused(S.paused);
      if(!S.paused) S.lastFrame = now();
      logEvent('pause', { paused:S.paused });
    }, { passive:true });
  }

  if(HUD.btnRestart){
    HUD.btnRestart.addEventListener('click', ()=>{
      restartGame();
    }, { passive:true });
  }

  if(HUD.btnBackHub){
    HUD.btnBackHub.addEventListener('click', ()=> goHub(), { passive:true });
  }
  if(HUD.btnPlayAgain){
    HUD.btnPlayAgain.addEventListener('click', ()=> restartGame(), { passive:true });
  }

  // crosshair shoot: tap anywhere OR click
  doc.addEventListener('click', (e)=>{
    if(!S.started || S.paused || S.ended) return;
    // ignore clicks on buttons
    const t = e.target;
    if(t && t.closest && t.closest('button')) return;
    shootAtCenter();
  }, true);

  // also on touchend
  doc.addEventListener('touchend', (e)=>{
    if(!S.started || S.paused || S.ended) return;
    const t = e.target;
    if(t && t.closest && t.closest('button')) return;
    shootAtCenter();
  }, { passive:true });
}

// motion permission
async function requestMotionIfNeeded(){
  try{
    const DMO = ROOT.DeviceMotionEvent;
    if(DMO && typeof DMO.requestPermission === 'function'){
      const res = await DMO.requestPermission();
      if(res !== 'granted'){
        if(DEBUG) console.log('Motion permission not granted');
      }
    }
  }catch(_){}
}

// ------------------------- loop / start -------------------------
function start(){
  if(S.started) return;
  S.started = true;
  S.paused = false;
  S.ended = false;

  ensureLayer();
  bindTargetClick();

  S.t0 = now();
  S.lastFrame = S.t0;
  S.elapsedMs = 0;

  S.score = 0; S.combo = 0; S.comboMax = 0; S.miss = 0; S.perfect = 0;
  S.fever = 0; S.feverOn = false;
  S.shield = 0;
  S.lives = 3; S.livesMax = 3; S.lifeLost = 0;
  S.plateHave = new Set();
  S.gCount = {1:0,2:0,3:0,4:0,5:0};
  S.targets = [];
  S.nextSpawnAt = now() + 250;
  S.nextBossAt = now() + (DIFF==='hard'?6500:(DIFF==='easy'?9500:8000));

  // quest
  S.Q = makeQuestDirector();
  S.Q.updateHUD();

  // HUD init
  refreshHUDRefs();
  setTxt(HUD.time, 0);
  setTxt(HUD.score, 0);
  setTxt(HUD.combo, 0);
  setTxt(HUD.miss, 0);
  setTxt(HUD.plate, '0/5');
  setTxt(HUD.feverPct, '0%');
  setTxt(HUD.grade, gradeFromScore());
  setShield(0);
  setLives(S.livesMax);

  setCoach('neutral', 'เริ่มแล้ว! เลื่อนมุมมอง + ยิงกลางจอ 🎯', `Mode: ${MODE} • Diff: ${DIFF.toUpperCase()} • Time: ${TOTAL_TIME}s`, 0);

  logEvent('start', {
    game: GAME_TAG,
    mode: MODE,
    diff: DIFF,
    timeSec: TOTAL_TIME,
    seed: DEFAULT_SEED,
    study: STUDY,
    ua: navigator.userAgent || '',
    device: isTouch() ? 'touch' : 'mouse',
  });

  function frame(){
    if(S.ended) return;

    const t = now();
    const dt = Math.min(80, t - S.lastFrame);
    S.lastFrame = t;

    if(!S.paused){
      S.elapsedMs = t - S.t0;

      // time
      const left = Math.max(0, (TOTAL_TIME*1000) - S.elapsedMs);
      const sec = Math.ceil(left/1000);
      refreshHUDRefs();
      if(HUD.time) setTxt(HUD.time, sec);

      // fever decay
      if(S.fever > 0){
        const decay = (S.feverOn ? 0.020 : 0.035) * dt;
        setFever(S.fever - decay);
      }

      // grade update
      if(HUD.grade) setTxt(HUD.grade, gradeFromScore());

      // update view
      applyView();

      // spawn
      spawnTick();

      // expire
      tickExpire();

      // boss attack
      tickBossAttack();

      // quest tick
      if(S.Q) S.Q.tick();

      // adaptive tick
      adaptTick();

      // urgent mini hints (tick sfx when rush near end)
      const m = MINIS[S.Q ? S.Q.miniIndex : 0];
      if(m && m.id==='M7' && S.Q && S.Q.miniState.rushActive){
        const tNow = now();
        const remain = (m.rushSec*1000) - (tNow - S.Q.miniState.rushStartAt);
        if(remain > 0 && remain < 2200){
          doc.body.classList.add('hha-mini-urgent');
          if(remain < 1200) AudioX.tick();
        }else{
          doc.body.classList.remove('hha-mini-urgent');
        }
      }else{
        doc.body.classList.remove('hha-mini-urgent');
      }

      // end by time
      if(left <= 0){
        endGame('หมดเวลา');
        return;
      }
    }

    ROOT.requestAnimationFrame(frame);
  }

  ROOT.requestAnimationFrame(frame);
}

// ------------------------- boot -------------------------
function boot(){
  ensureLayer();
  bindViewControls();
  bindUI();

  showStartOverlay(true);
  showPaused(false);

  // initial HUD
  refreshHUDRefs();
  setTxt(HUD.time, 0);
  setTxt(HUD.score, 0);
  setTxt(HUD.combo, 0);
  setTxt(HUD.miss, 0);
  setTxt(HUD.plate, '0/5');
  setTxt(HUD.feverPct, '0%');
  setTxt(HUD.grade, 'C');
  setShield(0);
  setLives(3);

  setCoach('neutral', 'พร้อมแล้วกด “เริ่มเล่น” ได้เลย!', `Diff: ${DIFF.toUpperCase()} • Time: ${TOTAL_TIME}s`, 0);

  if(DEBUG){
    console.log('[PlateVR] boot', { MODE, DIFF, TOTAL_TIME, seed: DEFAULT_SEED });
  }
}

boot();