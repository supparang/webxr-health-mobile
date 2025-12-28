// === /herohealth/plate/plate.safe.js ===
// Plate VR — ULTIMATE ALL-IN-ONE (START-GATED + HUB RETURN + UI FIXES + COACH + STATE)
// ✅ Fix mini never pass (PlateRush counts GOLD->group, shield-block doesn't fail mini)
// ✅ Play target pass-rate: 40–60%   | Research: 30–45% (by mini modifiers + durations)
// ✅ Mini modifiers (hazard down / gold up) during strict minis
// ✅ Start-gated, hub return, logger, coach, deterministic research seed

import {
  makeInitialState,
  resetState,
  buildHhaContextFromQuery,
  makeSessionId,
  computeGradeFrom,
  buildLastSummary
} from './plate.state.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc  = ROOT.document;

function $(id){ return doc ? doc.getElementById(id) : null; }
function setTxt(el, t){ if(el) el.textContent = String(t); }

// ✅ PATCH: make setShow work even when CSS has display:none
function setShow(el, on){
  if(!el) return;
  if(on){
    el.style.display = (el.id === 'resultBackdrop' || el.id === 'startOverlay') ? 'flex' : 'block';
  }else{
    el.style.display = 'none';
  }
}

// ---------- Fatal overlay ----------
(function attachFatalOverlay(){
  if (!doc) return;
  const box = doc.createElement('div');
  box.id = 'hhaFatal';
  Object.assign(box.style, {
    position:'fixed', left:'12px', right:'12px', top:'12px',
    zIndex:99999, display:'none',
    background:'rgba(2,6,23,.86)',
    border:'1px solid rgba(248,113,113,.35)',
    borderRadius:'16px', padding:'12px',
    color:'#e5e7eb', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    boxShadow:'0 20px 60px rgba(0,0,0,.55)',
    backdropFilter:'blur(8px)',
    maxHeight:'70vh', overflow:'auto'
  });
  box.innerHTML = `<div style="font-weight:1000; font-size:16px">⚠️ PlateVR Crash</div>
  <div id="hhaFatalMsg" style="margin-top:8px; color:rgba(229,231,235,.9); font-weight:900; white-space:pre-wrap"></div>
  <div style="margin-top:10px; color:rgba(148,163,184,.95); font-weight:900">
    แนะนำ: เปิด Console ดู error เพิ่ม และเช็กว่า plate-vr.html โหลด <b>./plate/plate.safe.js</b> ถูก path
  </div>`;
  doc.body && doc.body.appendChild(box);

  function showErr(msg){
    try{
      const el = $('hhaFatalMsg');
      if (el) el.textContent = msg;
      box.style.display = 'block';
    }catch(_){}
  }

  ROOT.addEventListener('error', (e)=>{
    const m = (e && (e.message || (e.error && e.error.message))) || 'Unknown error';
    const s = (e && e.error && e.error.stack) ? `\n\n${e.error.stack}` : '';
    showErr(`${m}${s}`);
  });
  ROOT.addEventListener('unhandledrejection', (e)=>{
    const r = e && e.reason;
    const m = (r && (r.message || String(r))) || 'Unhandled rejection';
    const s = (r && r.stack) ? `\n\n${r.stack}` : '';
    showErr(`${m}${s}`);
  });
})();

// ---------- URL params ----------
const URLX = new URL(ROOT.location.href);
const Q = URLX.searchParams;

const RUN_RAW = String(Q.get('run') || Q.get('runMode') || 'play').toLowerCase();
const MODE = (RUN_RAW === 'study' || RUN_RAW === 'research') ? 'research' : 'play';  // play | research
const DIFF = String(Q.get('diff') || 'normal').toLowerCase();                         // easy | normal | hard
const DEBUG = (Q.get('debug') === '1');

// ✅ default time by diff if no explicit time=
const HAS_TIME_PARAM = Q.has('time');
const DEFAULT_TIME_BY_DIFF = (DIFF === 'easy') ? 80 : (DIFF === 'hard') ? 60 : 70;
const TOTAL_TIME = Math.max(
  20,
  parseInt(HAS_TIME_PARAM ? (Q.get('time') || '0') : String(DEFAULT_TIME_BY_DIFF), 10) || DEFAULT_TIME_BY_DIFF
);

// ---------- RNG (Research strict) ----------
let SEED = parseInt(Q.get('seed') || '', 10);
if (!Number.isFinite(SEED)) SEED = 1337;
let _seed = (SEED >>> 0) || 1337;

function srnd(){
  _seed ^= (_seed << 13); _seed >>>= 0;
  _seed ^= (_seed >>> 17); _seed >>>= 0;
  _seed ^= (_seed << 5); _seed >>>= 0;
  return (_seed >>> 0) / 4294967296;
}
const R = (MODE === 'research') ? srnd : Math.random;

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now   = ()=>performance.now();
const fmt   = (n)=>String(Math.max(0, Math.floor(n)));
const rnd   = (a,b)=>a + R()*(b-a);
function randFrom(arr){ return arr[(R()*arr.length)|0]; }

// ---------- Modules ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){}, floatPop(){} };

const scene = doc ? doc.querySelector('a-scene') : null;
const cam   = doc ? doc.querySelector('#cam') : null;

// ---------- HUD refs ----------
const HUD = {
  time: $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss: $('hudMiss'),
  feverPct: $('hudFeverPct'),
  grade: $('hudGrade'),
  mode: $('hudMode'),
  diff: $('hudDiff'),
  have: $('hudGroupsHave'),
  perfect: $('hudPerfectCount'),
  goalLine: $('goalLine'),
  miniLine: $('miniLine'),
  miniHint: $('miniHint'),
  paused: $('hudPaused'),
  btnEnterVR: $('btnEnterVR'),
  btnPause: $('btnPause'),
  btnRestart: $('btnRestart'),
  resultBackdrop: $('resultBackdrop'),
  btnPlayAgain: $('btnPlayAgain'),

  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  rG1: $('rG1'),
  rG2: $('rG2'),
  rG3: $('rG3'),
  rG4: $('rG4'),
  rG5: $('rG5'),
  rGTotal: $('rGTotal'),
};

// ---------- Difficulty ----------
const DIFF_TABLE = {
  easy: {
    size: 92, life: 3200, spawnMs: 900, maxTargets: 10,
    junkRate: 0.18, goldRate: 0.10, trapRate: 0.045, bossRate: 0.020, fakeRate: 0.020,
    slowRate: 0.045, noJunkRate: 0.020, stormRate: 0.020,
    aimAssist: 150,
    bossHP: 3, bossAtkMs:[2600, 3400], bossPhase2At: 0.45, bossPhase3At: 0.22,
    stormDurMs:[4200, 6500], slowDurMs:[3200, 5200], noJunkDurMs:[4200, 6200],
  },
  normal: {
    size: 78, life: 2700, spawnMs: 780, maxTargets: 12,
    junkRate: 0.24, goldRate: 0.12, trapRate: 0.070, bossRate: 0.040, fakeRate: 0.040,
    slowRate: 0.050, noJunkRate: 0.026, stormRate: 0.032,
    aimAssist: 135,
    bossHP: 5, bossAtkMs:[1900, 2650], bossPhase2At: 0.55, bossPhase3At: 0.30,
    stormDurMs:[4200, 7200], slowDurMs:[3200, 5600], noJunkDurMs:[4200, 6800],
  },
  hard: {
    size: 66, life: 2300, spawnMs: 660, maxTargets: 14,
    junkRate: 0.30, goldRate: 0.14, trapRate: 0.095, bossRate: 0.060, fakeRate: 0.070,
    slowRate: 0.055, noJunkRate: 0.022, stormRate: 0.040,
    aimAssist: 125,
    bossHP: 6, bossAtkMs:[1550, 2300], bossPhase2At: 0.60, bossPhase3At: 0.34,
    stormDurMs:[4800, 8200], slowDurMs:[3200, 5800], noJunkDurMs:[4200, 7200],
  },
};
const D = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- State ----------
const LIVES_PARAM = parseInt(Q.get('lives') || '', 10);
const LIVES_START = (Number.isFinite(LIVES_PARAM) && LIVES_PARAM > 0) ? LIVES_PARAM : 3;

// ✅ context งานวิจัย (ส่งไป logger ทุกแถว)
const HHA_CTX = buildHhaContextFromQuery(Q);

// ✅ state กลาง
const S = makeInitialState({
  totalTime: TOTAL_TIME,
  livesMax: LIVES_START,
  sessionId: makeSessionId(),
  ctx: HHA_CTX
});

// ---------- Helpers ----------
function inVR(){
  try { return !!(scene && scene.is && scene.is('vr-mode')); } catch(_) { return false; }
}
function vibe(ms){ try { navigator.vibrate && navigator.vibrate(ms); } catch(_){} }

function dispatchEvt(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
}

/* ===== FX wrappers ===== */
function safeFxText(t){
  t = String(t ?? '');
  if (/^\d+(\.\d+)?$/.test(t) && t.length >= 10) return '✓';
  if (t.length > 18) return t.slice(0,18) + '…';
  return t;
}
function fxPop(txt, x, y, label=''){
  try{ Particles.scorePop && Particles.scorePop(x, y, safeFxText(txt), label ? safeFxText(label) : ''); }catch(_){}
}
function fxBurst(x,y,tag){
  try{ Particles.burstAt && Particles.burstAt(x,y,String(tag||'good')); }catch(_){}
}
function fxJudge(label){
  dispatchEvt('hha:judge', { label: safeFxText(label) });
}
function fxCelebrate(kind, intensity=1.0){
  try{
    Particles.celebrate && Particles.celebrate({ kind: safeFxText(kind), intensity: clamp(intensity,0.6,2.2) });
  }catch(_){}
}

// hit flash overlay
const hitFxEl = $('hitFx');
function flash(kind='bad', ms=110){
  if(!hitFxEl) return;
  hitFxEl.dataset.kind = String(kind||'bad');
  hitFxEl.classList.add('show');
  setTimeout(()=>{ try{ hitFxEl.classList.remove('show'); }catch(_){} }, ms|0);
}

// ---------- Coach (uses /img/coach-*.png) ----------
const Coach = (function(){
  const img   = $('coachImg');
  const msgEl = $('coachMsg');

  const MOOD_IMG = {
    neutral: './img/coach-neutral.png',
    happy:   './img/coach-happy.png',
    sad:     './img/coach-sad.png',
    fever:   './img/coach-fever.png',
  };

  let _ttl = 0;
  let _timer = 0;

  function setMood(m){
    if(!img) return;
    const key = (m && MOOD_IMG[m]) ? m : 'neutral';
    img.src = MOOD_IMG[key];
  }

  function say(text, mood='neutral', ttlMs=1800){
    if(!msgEl) return;
    setMood(mood);
    msgEl.textContent = String(text || '');
    _ttl = now() + Math.max(800, ttlMs|0);
    if(_timer) clearTimeout(_timer);
    _timer = setTimeout(()=>{ setMood('neutral'); }, Math.max(900, ttlMs|0));
    try{ dispatchEvt('hha:coach', { text:String(text||''), mood:String(mood||'neutral') }); }catch(_){}
  }

  function tick(){
    if(!_ttl || now() < _ttl) return;
    _ttl = 0;
  }

  return { say, tick };
})();

// ---------- START overlay + HUB return ----------
const HUB_URL_RAW = String(Q.get('hub') || './hub.html');

function resolveUrl(href){
  try { return new URL(href, ROOT.location.href).toString(); }
  catch(_) { return href; }
}
async function requestMotionPermissionIfNeeded(){
  try{
    const DME = ROOT.DeviceMotionEvent;
    if (!DME || typeof DME.requestPermission !== 'function') return true;
    const res = await DME.requestPermission();
    return (res === 'granted');
  }catch(_){
    return false;
  }
}
function showStartOverlay(on){
  const ov = $('startOverlay');
  if(!ov) return;
  setShow(ov, !!on);
}

function goHub(){
  try{
    const summary = buildLastSummary(S, { run: RUN_RAW, mode: MODE, diff: DIFF });
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
  }catch(_){}

  const hubUrl = resolveUrl(HUB_URL_RAW);
  const sp = new URLSearchParams();

  const keep = [
    'timestampIso','projectTag','runMode','studyId','phase','conditionGroup',
    'sessionOrder','blockLabel','siteCode','schoolYear','semester',
    'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName',
    'gender','age','gradeLevel'
  ];
  for(const k of keep){
    const v = Q.get(k);
    if(v !== null) sp.set(k, v);
  }
  sp.set('from','plate');
  sp.set('lastSessionId', S.sessionId);

  const join = hubUrl.includes('?') ? '&' : '?';
  ROOT.location.assign(hubUrl + join + sp.toString());
}

// ---------- DOM target layer + CSS ----------
(function injectCss(){
  if (!doc) return;
  const st = doc.createElement('style');
  st.textContent = `
  .plate-layer{position:fixed; inset:0; z-index:400; pointer-events:auto; touch-action:none; will-change:transform; transform:translate3d(0,0,0);}
  .plateTarget{
    position:absolute; left:0; top:0;
    width:var(--sz,80px); height:var(--sz,80px);
    transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(var(--sc,1));
    border-radius:999px; display:grid; place-items:center;
    font-weight:1000; user-select:none; -webkit-tap-highlight-color:transparent;
    box-shadow:0 18px 46px rgba(0,0,0,.35); backdrop-filter: blur(8px);
  }
  .plateTarget::before{content:''; position:absolute; inset:-2px; border-radius:inherit; pointer-events:none; opacity:.95;}
  .plateTarget.good{background:rgba(34,197,94,.16); border:1px solid rgba(34,197,94,.35);}
  .plateTarget.good::before{border:3px solid rgba(34,197,94,.75); box-shadow:0 0 0 8px rgba(34,197,94,.12), 0 0 40px rgba(34,197,94,.18);}
  .plateTarget.junk{background:rgba(251,113,133,.14); border:1px solid rgba(251,113,133,.35);}
  .plateTarget.junk::before{border:3px solid rgba(251,113,133,.75); box-shadow:0 0 0 8px rgba(251,113,133,.10), 0 0 40px rgba(251,113,133,.16);}
  .plateTarget.gold{background:rgba(250,204,21,.14); border:1px solid rgba(250,204,21,.42);}
  .plateTarget.gold::before{border:3px solid rgba(250,204,21,.85); box-shadow:0 0 0 10px rgba(250,204,21,.12), 0 0 54px rgba(250,204,21,.18);}
  .plateTarget.trap{background:rgba(147,51,234,.12); border:1px solid rgba(147,51,234,.38);}
  .plateTarget.trap::before{border:3px solid rgba(147,51,234,.70); box-shadow:0 0 0 10px rgba(147,51,234,.12), 0 0 60px rgba(147,51,234,.14);}
  .plateTarget.fake{background:rgba(34,197,94,.14); border:1px dashed rgba(34,197,94,.35);}
  .plateTarget.fake::before{border:3px dashed rgba(34,197,94,.55); box-shadow:0 0 0 10px rgba(34,197,94,.10), 0 0 52px rgba(34,197,94,.14);}
  .plateTarget.slow{background:rgba(56,189,248,.12); border:1px solid rgba(56,189,248,.38);}
  .plateTarget.slow::before{border:3px solid rgba(56,189,248,.75); box-shadow:0 0 0 10px rgba(56,189,248,.10), 0 0 60px rgba(56,189,248,.14);}
  .plateTarget.nojunk{background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.38);}
  .plateTarget.nojunk::before{border:3px solid rgba(16,185,129,.75); box-shadow:0 0 0 10px rgba(16,185,129,.10), 0 0 60px rgba(16,185,129,.14);}
  .plateTarget.storm{background:rgba(249,115,22,.12); border:1px solid rgba(249,115,22,.38);}
  .plateTarget.storm::before{border:3px solid rgba(249,115,22,.75); box-shadow:0 0 0 10px rgba(249,115,22,.10), 0 0 60px rgba(249,115,22,.14);}
  .plateTarget.boss{background:rgba(2,6,23,.62); border:1px solid rgba(248,113,113,.35);}
  .plateTarget.boss::before{border:3px solid rgba(248,113,113,.75); box-shadow:0 0 0 12px rgba(248,113,113,.10), 0 0 70px rgba(248,113,113,.18);}
  .plateTarget.boss.warn::before{
    box-shadow:0 0 0 12px rgba(248,113,113,.14), 0 0 95px rgba(248,113,113,.28);
    filter: brightness(1.15);
  }
  .plateTarget .emoji{font-size:calc(var(--sz,80px) * 0.52); line-height:1; filter: drop-shadow(0 10px 18px rgba(0,0,0,.28));}
  .plateTarget .tag{
    position:absolute; bottom:-10px; left:50%; transform:translateX(-50%);
    font-size:12px; font-weight:1000; padding:4px 10px; border-radius:999px;
    background:rgba(2,6,23,.72); border:1px solid rgba(148,163,184,.20); color:#e5e7eb; white-space:nowrap;
  }
  .plateTarget .hp{
    position:absolute; top:-10px; left:50%; transform:translateX(-50%);
    width:70%; height:8px; border-radius:999px; background:rgba(148,163,184,.16);
    border:1px solid rgba(148,163,184,.22); overflow:hidden;
  }
  .plateTarget .hp > div{height:100%; width:100%; background:rgba(248,113,113,.85); transform-origin:left; transform:scaleX(var(--hp,1)); transition:transform .08s linear;}
  @keyframes popIn{0%{opacity:0; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(.60);} 100%{opacity:1; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(var(--sc,1));}}
  .plateTarget.spawn{animation: popIn 220ms ease-out both;}
  @keyframes aimPulse{0%{filter:brightness(1);} 50%{filter:brightness(1.18);} 100%{filter:brightness(1);}}
  .plateTarget.aimed{animation: aimPulse 520ms ease-in-out infinite;}

  body.hha-mini-urgent #miniPanel{
    border-color: rgba(250,204,21,.55)!important;
    box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 30px rgba(250,204,21,.12);
  }
  `;
  doc.head.appendChild(st);
})();

const layer = doc.createElement('div');
layer.className = 'plate-layer';
doc.body && doc.body.appendChild(layer);

// ---------- Audio (tiny beeps) ----------
const AudioX = (function(){
  let ctx=null;
  function ensure(){ if(ctx) return ctx; try{ ctx=new (ROOT.AudioContext||ROOT.webkitAudioContext)(); }catch(_){ } return ctx; }
  function unlock(){ const c=ensure(); if(!c) return; if(c.state==='suspended'){ try{ c.resume(); }catch(_){ } } }
  function beep(freq=740, dur=0.06, gain=0.05, type='sine'){
    const c=ensure(); if(!c) return;
    const t0=c.currentTime;
    const o=c.createOscillator(); const g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(gain,t0);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0+dur+0.01);
  }
  const tick=()=>beep(860,0.05,0.04,'square');
  const warn=()=>beep(520,0.08,0.06,'sawtooth');
  const good=()=>beep(980,0.045,0.035,'sine');
  const perfect=()=>beep(1180,0.06,0.04,'triangle');
  const bad=()=>beep(220,0.08,0.06,'sawtooth');
  const bossHit=()=>beep(420,0.06,0.05,'square');
  const bossDown=()=>{beep(240,0.11,0.06,'sawtooth'); setTimeout(()=>beep(760,0.08,0.05,'triangle'),60);};
  const power=()=>{beep(720,0.08,0.04,'triangle'); setTimeout(()=>beep(1040,0.06,0.035,'sine'),50);};
  const shield=()=>{beep(980,0.08,0.045,'triangle'); setTimeout(()=>beep(1320,0.06,0.04,'sine'),60);};
  const atk=()=>{beep(160,0.10,0.06,'sawtooth'); setTimeout(()=>beep(90,0.12,0.05,'square'),70);};
  return { unlock, tick, warn, good, perfect, bad, bossHit, bossDown, power, shield, atk };
})();

// ---------- Logger ----------
function logSession(phase){
  dispatchEvt('hha:log_session',{
    ...S.ctx,
    sessionId:S.sessionId, game:'PlateVR', phase,
    run: RUN_RAW, mode:MODE, diff:DIFF, timeTotal:TOTAL_TIME, lives:S.livesMax,
    seed: SEED, ts:Date.now(), ua:navigator.userAgent
  });
}
function logEvent(type, data){
  dispatchEvt('hha:log_event',{
    ...S.ctx,
    sessionId:S.sessionId, game:'PlateVR', type,
    t: Math.round((now() - S.tStart) || 0),
    score:S.score, combo:S.combo, miss:S.miss, perfect:S.perfectCount,
    fever:Math.round(S.fever), shield:S.shield, lives:S.lives,
    data:data||{}
  });
}

// ---------- Camera -> view offset ----------
function getCamAngles(){
  const r = cam && cam.object3D ? cam.object3D.rotation : null;
  if(!r) return {yaw:0,pitch:0};
  return { yaw: r.y || 0, pitch: r.x || 0 };
}
function viewOffset(){
  if(inVR()) return {x:0,y:0};
  const {yaw,pitch}=getCamAngles();
  const vw=ROOT.innerWidth, vh=ROOT.innerHeight;
  const pxPerRadX=clamp(vw*0.55,180,720);
  const pxPerRadY=clamp(vh*0.48,160,640);
  return {
    x: clamp(-yaw*pxPerRadX, -vw*1.2, vw*1.2),
    y: clamp(+pitch*pxPerRadY, -vh*1.2, vh*1.2),
  };
}
function applyLayerTransform(){
  const off=viewOffset();
  layer.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
}

// ---------- Safezone + Anti-overlap ----------
function intersect(a,b){ return !(a.x+a.w<b.x||b.x+b.w<a.x||a.y+a.h<b.y||b.y+b.h<a.y); }
function getBlockedRects(){
  const rects=[];
  const ids=['hudTop','hudBtns','miniPanel','coachPanel'];
  for(const id of ids){
    const el=$(id); if(!el) continue;
    const r=el.getBoundingClientRect();
    if(r.width>10 && r.height>10) rects.push({x:r.left,y:r.top,w:r.width,h:r.height});
  }
  return rects.map(b=>({x:b.x-10,y:b.y-10,w:b.w+20,h:b.h+20}));
}
function overlapsExisting(cx,cy,sizePx){
  const minGap = 0.72;
  for(const r of S.targets){
    if(!r || r.dead) continue;
    const d = Math.hypot(r.cx - cx, r.cy - cy);
    const lim = (r.size*0.5 + sizePx*0.5) * minGap;
    if(d < lim) return true;
  }
  return false;
}
function pickSafeXY(sizePx){
  const vw=ROOT.innerWidth, vh=ROOT.innerHeight;
  const m=14, half=sizePx*0.5;
  const blocked=getBlockedRects();
  const tries=110;
  const off=viewOffset();
  for(let i=0;i<tries;i++){
    const sx=rnd(m+half, vw-m-half);
    const sy=rnd(m+half, vh-m-half);
    const rr={x:sx-half,y:sy-half,w:sizePx,h:sizePx};
    let ok=true;
    for(const br of blocked){ if(intersect(rr,br)){ ok=false; break; } }
    if(!ok) continue;
    const cx = sx-off.x, cy = sy-off.y;
    if(overlapsExisting(cx,cy,sizePx)) continue;
    return { x:cx, y:cy };
  }
  return { x:vw*0.5-off.x, y:vh*0.55-off.y };
}

// ---------- Content ----------
const FOOD_BY_GROUP={
  1:['🍗','🥩','🐟','🍳','🥛','🧀','🥜'],
  2:['🍚','🍞','🥔','🌽','🥨','🍜','🍙'],
  3:['🥦','🥕','🥬','🥒','🌶️','🍅'],
  4:['🍎','🍌','🍊','🍉','🍍','🍇'],
  5:['🥑','🧈','🫒','🥥','🧀'],
};
const JUNK=['🍩','🍟','🍔','🍕','🧋','🍭','🍫','🥤'];
const TRAPS=['🎁','⭐','🍬','🍰','🧁'];

function isPowerKind(kind){ return (kind==='slow'||kind==='nojunk'||kind==='storm'); }

// ---------- Score/Fever/Grade ----------
function addScore(delta){ S.score += delta; setTxt(HUD.score, S.score); }
function addCombo(){ S.combo+=1; S.maxCombo=Math.max(S.maxCombo,S.combo); setTxt(HUD.combo,S.combo); }
function setShield(n){ S.shield=clamp(n,0,S.shieldMax); }
function setLives(n){ S.lives=clamp(n,0,S.livesMax); }

function emitFever(){
  dispatchEvt('hha:fever', { feverPct: Math.round(S.fever), fever: Math.round(S.fever) });
}
function addFever(v){
  const prev=S.fever;
  S.fever=clamp(S.fever+v,0,100);
  const pct=Math.round(S.fever);
  setTxt(HUD.feverPct, `${pct}%`);
  emitFever();

  if(!S.feverOn && S.fever>=100){
    S.feverOn=true;
    fxCelebrate('FEVER!', 1.2);
    AudioX.shield(); vibe(40);
    setShield(S.shield+1);
    Coach.say('FEVER! โล่พร้อมแล้ว 🛡️', 'fever', 1900);
    logEvent('fever_on',{});
  }
  if(S.feverOn && S.fever<=15){
    S.feverOn=false;
    Coach.say('ใจเย็นลงแล้ว… ระวังขยะนะ!', 'neutral', 1500);
    logEvent('fever_off',{});
  }
  if(prev<100 && S.fever>=100) S.fever=100;
}
function gradeFromScore(){ return computeGradeFrom(S); }
function updateGrade(){ setTxt(HUD.grade, gradeFromScore()); }

// ---------- Goals / Minis ----------
const GOALS=[
  { key:'plates2', title:'🍽️ ทำ “จานสมดุล” ให้ได้ 2 ใบ', target:2 },
  { key:'perfect6', title:'⭐ ทำ PERFECT ให้ได้ 6 ครั้ง', target:6 },
];

// --- Mini tuning: durations by mode/diff (Play: 40–60% | Research: 30–45%) ---
function miniDur(key, base){
  const d = (DIFF==='easy')? 'easy' : (DIFF==='hard')? 'hard' : 'normal';
  const play = (MODE!=='research');

  // helpers
  const map = (easy, normal, hard) => (d==='easy'?easy:(d==='hard'?hard:normal));

  switch(String(key||'')){
    case 'plateRush':
      // Play slightly easier; Research tighter
      return play ? map(9800, 8800, 7800) : map(9000, 8200, 7600);
    case 'perfectStreak':
      return play ? map(14000, 12500, 11000) : map(12000, 11000, 10000);
    case 'goldHunt':
      return play ? map(13000, 12000, 11000) : map(12000, 11500, 11000);
    case 'comboSprint':
      return play ? map(16500, 15000, 14000) : map(15000, 14500, 14000);
    case 'cleanAndCount':
      return play ? map(12000, 11000, 10000) : map(11000, 10000, 9000);
    case 'noMiss':
      return play ? map(12000, 12000, 12000) : map(12000, 12000, 12000);
    case 'shine':
      return play ? map(11000, 10000, 9500) : map(10000, 9500, 9000);
    default:
      return base;
  }
}

// --- Mini modifiers: reduce hazards / boost helpful spawns during strict minis ---
function miniMods(){
  const key = S.activeMini && S.activeMini.key ? String(S.activeMini.key) : '';
  if(!key) return null;

  const play = (MODE!=='research');
  const diffMul = (DIFF==='easy') ? 0.90 : (DIFF==='hard') ? 1.08 : 1.00;

  // default no change
  let m = {
    // probability scales applied in decideKind()
    junkMul:1, trapMul:1, fakeMul:1, bossMul:1, goldAdd:0,
    // whether boss spawn is allowed during this mini
    noBoss:false,
    // slight assist: more "good"
    goodBias:0,
  };

  if(key==='plateRush'){
    // make it passable: hazards down, gold up, no boss interrupt
    m.junkMul = play ? 0.55 : 0.62;
    m.trapMul = play ? 0.55 : 0.65;
    m.fakeMul = play ? 0.55 : 0.70;
    m.bossMul = 0.10;
    m.goldAdd = play ? 0.045 : 0.030;
    m.noBoss  = true;
    m.goodBias= play ? 0.05 : 0.03;
  } else if(key==='cleanAndCount'){
    m.junkMul = play ? 0.60 : 0.70;
    m.trapMul = play ? 0.65 : 0.75;
    m.fakeMul = play ? 0.70 : 0.80;
    m.goldAdd = play ? 0.020 : 0.012;
    m.bossMul = 0.35;
    m.goodBias= play ? 0.03 : 0.02;
  } else if(key==='noMiss'){
    m.junkMul = play ? 0.70 : 0.78;
    m.trapMul = play ? 0.75 : 0.82;
    m.fakeMul = play ? 0.78 : 0.85;
    m.bossMul = 0.55;
    m.goldAdd = play ? 0.018 : 0.010;
    m.goodBias= play ? 0.02 : 0.01;
  } else if(key==='goldHunt'){
    m.goldAdd = play ? 0.060 : 0.045; // help ensure 2 gold appears
    m.junkMul = 0.92*diffMul;
    m.trapMul = 0.92*diffMul;
    m.fakeMul = 0.95*diffMul;
    m.bossMul = 0.80;
    m.goodBias= 0.01;
  } else if(key==='perfectStreak'){
    m.junkMul = play ? 0.85 : 0.92;
    m.trapMul = play ? 0.85 : 0.92;
    m.fakeMul = play ? 0.90 : 0.95;
    m.bossMul = 0.85;
    m.goodBias= play ? 0.02 : 0.01;
  } else if(key==='comboSprint'){
    m.junkMul = play ? 0.88 : 0.94;
    m.trapMul = play ? 0.90 : 0.95;
    m.fakeMul = play ? 0.92 : 0.96;
    m.bossMul = 0.90;
    m.goodBias= play ? 0.015 : 0.01;
  } else if(key==='shine'){
    m.goldAdd = play ? 0.020 : 0.015;
    m.junkMul = play ? 0.92 : 0.96;
    m.trapMul = play ? 0.92 : 0.96;
    m.fakeMul = play ? 0.94 : 0.97;
    m.bossMul = 0.92;
    m.goodBias= 0.01;
  }

  // diff impact (subtle)
  m.junkMul *= diffMul;
  m.trapMul *= diffMul;
  m.fakeMul *= diffMul;
  return m;
}

const MINIS=[
  {
    key:'plateRush',
    title:'Plate Rush',
    hint:'ครบ 5 หมู่ในเวลาจำกัด • ห้าม “โดน” ขยะ/กับดัก/บอส (ถ้าโล่บล็อกไม่นับว่าโดน)',
    dur:8000,
    init(){
      S._mini = { got:new Set(), fail:false };
    },
    // ✅ FAIL only when truly got hit (not shield-blocked)
    onBadHit(){ S._mini.fail = true; },
    // ✅ Count group from plate add (covers GOOD + GOLD mapping)
    onPlateAdd(group){
      if(!group) return;
      if(!S._mini || !S._mini.got) return;
      S._mini.got.add(group);
    },
    progress(){
      const n = (S._mini && S._mini.got) ? S._mini.got.size : 0;
      const f = (S._mini && S._mini.fail) ? ' ✗' : '';
      return `${n}/5${f}`;
    },
    isClear(){
      return (S._mini.got.size>=5) && !S._mini.fail;
    }
  },
  {
    key:'perfectStreak',
    title:'Perfect Streak',
    hint:'PERFECT ติดกัน 5 ครั้ง',
    dur:11000,
    init(){ S._mini={st:0}; },
    onJudge(j){ if(j==='PERFECT') S._mini.st++; else if(j!=='HIT') S._mini.st=0; },
    progress(){ return `${S._mini.st}/5`; },
    isClear(){ return S._mini.st>=5; }
  },
  {
    key:'goldHunt',
    title:'Gold Hunt',
    hint:'เก็บ ⭐ Gold 2 อัน',
    dur:12000,
    init(){ S._mini={g:0}; },
    onHit(rec){ if(rec && rec.kind==='gold') S._mini.g++; },
    progress(){ return `${S._mini.g}/2`; },
    isClear(){ return S._mini.g>=2; }
  },
  {
    key:'comboSprint',
    title:'Combo Sprint',
    hint:'คอมโบถึง 8 ภายในเวลาจำกัด',
    dur:15000,
    init(){ S._mini={best:0}; },
    tick(){ S._mini.best=Math.max(S._mini.best,S.combo); },
    progress(){ return `${Math.max(S._mini.best,S.combo)}/8`; },
    isClear(){ return Math.max(S._mini.best,S.combo)>=8; }
  },
  {
    key:'cleanAndCount',
    title:'Clean & Count',
    hint:'ของดี 4 ชิ้น • ห้ามโดนขยะ/กับดัก',
    dur:10000,
    init(){ S._mini={good:0, fail:false}; },
    onHit(rec){
      if(!rec) return;
      if(rec.kind==='good'||rec.kind==='gold') S._mini.good++;
    },
    onBadHit(){ S._mini.fail=true; },
    progress(){ return `${S._mini.good}/4${S._mini.fail?' ✗':''}`; },
    isClear(){ return S._mini.good>=4 && !S._mini.fail; }
  },
  {
    key:'noMiss',
    title:'No-Miss',
    hint:'เวลานี้ห้ามพลาด (รวมหมดอายุของดีด้วย)',
    dur:12000,
    init(){ S._mini={m:S.miss,l:S.lives}; },
    progress(){ return `MISS:${S.miss - S._mini.m}`; },
    isClear(){ return S.miss===S._mini.m && S.lives===S._mini.l; }
  },
  {
    key:'shine',
    title:'Shine',
    hint:'PERFECT 2 ครั้ง หรือ เก็บ Power 1 อัน ก็ผ่าน',
    dur:10000,
    init(){ S._mini={p:0, pow:false}; },
    onJudge(j){ if(j==='PERFECT') S._mini.p++; },
    onPower(){ S._mini.pow=true; },
    progress(){ return `P:${S._mini.p}/2 • POWER:${S._mini.pow?'1':'0'}`; },
    isClear(){ return S._mini.pow || S._mini.p>=2; }
  },
];

function goalProgressText(){
  const g=S.activeGoal;
  if(!g) return '0';
  if(g.key==='plates2') return `${S.goalsCleared}/${g.target}`;
  if(g.key==='perfect6') return `${S.perfectCount}/${g.target}`;
  return '0';
}
function setGoal(i){
  S.goalIndex=clamp(i,0,GOALS.length-1);
  S.activeGoal=GOALS[S.goalIndex];
  setTxt(HUD.goalLine, `GOAL ${S.goalIndex+1}/2: ${S.activeGoal.title} (${goalProgressText()})`);
}
function checkGoalClear(){
  const g=S.activeGoal; if(!g) return false;
  if(g.key==='plates2') return S.goalsCleared>=g.target;
  if(g.key==='perfect6') return S.perfectCount>=g.target;
  return false;
}
function onGoalCleared(){
  fxCelebrate('GOAL CLEAR!', 1.25);
  Coach.say('สุดยอด! GOAL ผ่านแล้ว 🔥', 'happy', 1600);
  flash('gold', 140);
  vibe(60);
  logEvent('goal_clear',{goal:S.activeGoal && S.activeGoal.key});
  if(S.goalIndex+1<GOALS.length) setGoal(S.goalIndex+1);
}

function startMini(){
  const idx=S.minisCleared % MINIS.length;
  const m=MINIS[idx];
  S.activeMini=m;

  const dur = miniDur(m.key, m.dur);
  S.miniEndsAt=now()+dur;

  S.miniUrgentArmed=false;
  S.miniTickAt=0;

  if(typeof m.init==='function') m.init();

  updateMiniHud();
  fxCelebrate('MINI!', 0.9);
  Coach.say(`MINI เริ่ม: ${m.title} ⚡`, 'neutral', 1200);
  logEvent('mini_start',{mini:m.key,dur});
}

function updateMiniHud(){
  const m=S.activeMini;
  if(!m){ setTxt(HUD.miniLine,'MINI: …'); setTxt(HUD.miniHint,'…'); return; }
  const left=Math.max(0,(S.miniEndsAt-now())/1000);
  const prog=(typeof m.progress==='function') ? m.progress() : '';
  const p = prog ? ` • ${prog}` : '';
  setTxt(HUD.miniLine, `MINI: ${m.title}${p} • ${left.toFixed(1)}s`);
  setTxt(HUD.miniHint, m.hint||'');
}

function tickMini(){
  const m=S.activeMini; if(!m) return;
  if(typeof m.tick==='function') m.tick();

  const leftMs=S.miniEndsAt-now();
  const urgent=(leftMs<=3000 && leftMs>0);

  if(urgent && !S.miniUrgentArmed){
    S.miniUrgentArmed=true;
    doc.body.classList.add('hha-mini-urgent');
    AudioX.warn(); vibe(20);
  }
  if(!urgent && S.miniUrgentArmed){
    S.miniUrgentArmed=false;
    doc.body.classList.remove('hha-mini-urgent');
  }
  if(urgent){
    const sec=Math.ceil(leftMs/1000);
    if(sec!==S.miniTickAt){ S.miniTickAt=sec; AudioX.tick(); }
  }
  if(leftMs<=0){
    doc.body.classList.remove('hha-mini-urgent');
    const ok=(typeof m.isClear==='function') ? !!m.isClear() : false;
    if(ok){
      S.minisCleared++; fxCelebrate('MINI CLEAR!', 1.15);
      Coach.say('MINI ผ่าน! โหดมาก 😎', 'happy', 1400);
      flash('good', 120);
      addScore(450); addFever(18); vibe(50);
      logEvent('mini_clear',{mini:m.key});
    }else{
      fxJudge('MINI FAIL');
      Coach.say('พลาดนิดเดียว! ลองใหม่ เอาให้ผ่าน 💥', 'sad', 1500);
      addScore(-120); addFever(-12);
      logEvent('mini_fail',{mini:m.key});
    }
    startMini();
  }else updateMiniHud();
}

// ---------- Plate logic ----------
function notifyMiniPlateAdd(group){
  const m = S.activeMini;
  if(m && typeof m.onPlateAdd === 'function'){
    try{ m.onPlateAdd(group); }catch(_){}
  }
}

function onGood(group){
  if(group>=1 && group<=5){
    S.plateHave.add(group);
    S.groupCounts[group-1]+=1;

    // ✅ Mini PlateRush now counts ANY group gain (GOOD+GOLD)
    notifyMiniPlateAdd(group);
  }
  setTxt(HUD.have, `${S.plateHave.size}/${S.groupsTotal}`);
  if(S.plateHave.size>=S.groupsTotal){
    S.goalsCleared++;
    S.plateHave.clear();
    setTxt(HUD.have, `0/5`);
    fxCelebrate('PLATE +1!', 1.0);
    Coach.say('จานสมดุล +1! เก่งมาก 🍽️', 'happy', 1400);
    flash('good', 120);
    vibe(35);
    logEvent('plate_complete',{plates:S.goalsCleared});
    setGoal(S.goalIndex);
    if(S.activeGoal && S.activeGoal.key==='plates2' && checkGoalClear()) onGoalCleared();
  }
}

// ---------- Aim assist ----------
function pickNearCrosshair(radiusPx){
  const vw=ROOT.innerWidth, vh=ROOT.innerHeight;
  const cx=vw/2, cy=vh/2;
  const off=viewOffset();
  let best=null, bestD=Infinity;
  for(const rec of S.targets){
    if(!rec || rec.dead) continue;
    const sx=rec.cx+off.x, sy=rec.cy+off.y;
    const d=Math.hypot(sx-cx, sy-cy);
    if(d<bestD){ bestD=d; best=rec; }
  }
  if(best && bestD<=radiusPx) return {rec:best, dist:bestD};
  return null;
}
function updateAimHighlight(){
  const assist = inVR()? Math.max(D.aimAssist,170) : D.aimAssist;
  const picked=pickNearCrosshair(assist);
  const tid=picked? picked.rec.el.dataset.tid : null;
  if(tid===S.aimedId) return;
  if(S.aimedId){
    const prev=S.targets.find(r=>r && r.el && r.el.dataset.tid===S.aimedId);
    prev && prev.el && prev.el.classList.remove('aimed');
  }
  S.aimedId=tid;
  picked && picked.rec && picked.rec.el && picked.rec.el.classList.add('aimed');
}

// ---------- Target spawn/manage ----------
let targetSeq=0;

function computeSizePx(kind){
  const vw=ROOT.innerWidth, vh=ROOT.innerHeight;
  const base=D.size;
  const scale=clamp(Math.min(vw,vh)/820,0.86,1.12);
  let sz=clamp(base*scale,52,118);
  if(kind==='gold') sz=clamp(sz*1.05,56,128);
  if(kind==='trap'||kind==='fake') sz=clamp(sz*1.06,56,132);
  if(kind==='boss') sz=clamp(sz*1.38,84,168);
  if(isPowerKind(kind)) sz=clamp(sz*1.10,62,150);
  return sz;
}
function bossPhaseFor(rec){
  if(!rec||rec.kind!=='boss') return 1;
  const ratio=rec.hpMax ? (rec.hp/rec.hpMax) : 1;
  if(ratio<=D.bossPhase3At) return 3;
  if(ratio<=D.bossPhase2At) return 2;
  return 1;
}
function bossAttackStyleForPhase(phase){
  if(phase===3) return 'double';
  if(phase===2) return 'laser';
  return 'ring';
}

function makeTarget(kind, group, opts={}){
  const sizePx=computeSizePx(kind);
  const pos=pickSafeXY(sizePx);

  const el=doc.createElement('div');
  el.className=`plateTarget ${kind} spawn`;
  el.dataset.tid=String(++targetSeq);

  const sc=0.92 + R()*0.22;
  const sc2=(kind==='gold'||kind==='boss'||isPowerKind(kind)) ? (sc*1.08) : sc;

  el.style.setProperty('--sz', `${sizePx}px`);
  el.style.setProperty('--x', `${(pos.x - sizePx/2)}px`);
  el.style.setProperty('--y', `${(pos.y - sizePx/2)}px`);
  el.style.setProperty('--sc', `${sc2}`);

  let emoji='🍽️', tag='', hp=0, meta={};

  if(kind==='junk'){ emoji=randFrom(JUNK); tag='JUNK'; }
  else if(kind==='gold'){ emoji='⭐'; tag='GOLD'; }
  else if(kind==='trap'){ emoji=randFrom(TRAPS); tag='TRAP'; }
  else if(kind==='fake'){ emoji=randFrom(FOOD_BY_GROUP[group]||['🥗']); tag='???'; meta.fake=true; }
  else if(kind==='slow'){ emoji='🐢'; tag='SLOW'; }
  else if(kind==='nojunk'){ emoji='🟢'; tag='NO-JUNK'; }
  else if(kind==='storm'){ emoji='🌪️'; tag='STORM'; }
  else if(kind==='boss'){
    emoji=(R()<0.5)?'🦠':'😈'; tag='BOSS';
    hp=Math.max(2, opts.hp || D.bossHP || 5);
    meta.phase=1; meta.atkStyle='ring';
  } else {
    emoji=randFrom(FOOD_BY_GROUP[group]||['🥗']);
    tag=`G${group}`;
  }

  el.innerHTML = `
    ${kind==='boss' ? `<div class="hp"><div></div></div>` : ``}
    <div class="emoji">${emoji}</div>
    ${tag ? `<div class="tag">${tag}</div>` : ``}
  `;

  const bornAt=now();
  let life=D.life;
  if(kind==='boss') life=clamp(D.life*1.8,3400,7800);
  if(kind==='gold') life=D.life*0.92;
  if(kind==='trap'||kind==='fake') life=D.life*0.95;
  if(isPowerKind(kind)) life=clamp(D.life*0.95,1700,3200);
  if(now()<S.slowUntil) life*=1.12;

  const rec={
    el, kind, group,
    bornAt, dieAt:bornAt+life,
    cx:pos.x, cy:pos.y, size:sizePx,
    hp, hpMax:hp, dead:false,
    meta,
    atkAt:(kind==='boss') ? (bornAt + rnd(D.bossAtkMs[0], D.bossAtkMs[1])) : 0,
    _warned:false,
  };

  S.targets.push(rec);

  let fired = false;
  const hitHandler=(e)=>{
    if (fired && e.type !== 'pointerdown') return;
    fired = true;
    setTimeout(()=>{ fired = false; }, 120);

    e.preventDefault(); e.stopPropagation();
    AudioX.unlock();
    hitTarget(rec, true, e);
  };
  el.addEventListener('pointerdown', hitHandler, {passive:false});
  el.addEventListener('click', hitHandler, {passive:false});

  layer.appendChild(el);
  setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(_){ } }, 260);

  logEvent('spawn',{kind,group,size:sizePx,x:rec.cx,y:rec.cy,hp});
  return rec;
}
function removeTarget(rec){
  if(!rec||rec.dead) return;
  rec.dead=true;
  try{ rec.el.remove(); }catch(_){}
  const i=S.targets.indexOf(rec);
  if(i>=0) S.targets.splice(i,1);
}
function bossHpSync(rec){
  if(!rec||rec.kind!=='boss') return;
  const bar=rec.el.querySelector('.hp > div');
  if(!bar) return;
  const ratio=rec.hpMax ? clamp(rec.hp/rec.hpMax,0,1) : 0;
  rec.el.style.setProperty('--hp', String(ratio));
  bar.style.transform = `scaleX(${ratio})`;
}
function expireTargets(){
  const t=now();
  for(let i=S.targets.length-1;i>=0;i--){
    const rec=S.targets[i];
    if(!rec || rec.dead) continue;

    if(t>=rec.dieAt){
      if(rec.kind==='good'||rec.kind==='gold'){
        onMiss('expire_good',{kind:rec.kind,group:rec.group});
        fxJudge('MISS');
        flash('bad', 110);
        logEvent('miss_expire',{kind:rec.kind,group:rec.group});
      }else if(rec.kind==='boss'){
        bossAttackPunish('boss_expire', true);
        S.bossActive=false;
      }
      removeTarget(rec);
    }
  }
}

// ---------- MISS/LIFE ----------
function shieldBlock(reason){
  if(S.shield<=0) return false;
  setShield(S.shield-1);
  fxCelebrate('🛡️ BLOCK!', 1.05);
  flash('gold', 120);
  AudioX.shield(); vibe(30);
  logEvent('shield_block',{reason,shield:S.shield});
  return true;
}

function onMiss(reason, extra={}){
  S.combo=0; setTxt(HUD.combo,0);
  S.miss++; setTxt(HUD.miss,S.miss);

  const t=now();
  const protectedNoJunk=(t<S.noJunkUntil) && (reason==='junk'||reason==='trap'||reason==='boss'||reason==='boss_attack');
  if(!protectedNoJunk) setLives(S.lives-1);

  Coach.say('โอ๊ย! ระวังขยะ/กับดัก 😵', 'sad', 1200);

  updateGrade();
  if(S.lives<=0) endGame(true);
  logEvent('miss',{reason,...extra});
}

// ✅ returns true if blocked by shield (so mini should NOT fail)
function punishBad(reason){
  if(shieldBlock(reason)){ addScore(-60); addFever(-6); return true; }
  S.combo=0; setTxt(HUD.combo,0);
  addFever(reason==='boss'?-22:-16);
  addScore((now()<S.noJunkUntil)?-120:(reason==='trap'?-240:-180));
  fxJudge((now()<S.noJunkUntil)?'BAD(SAFE)':'BAD');
  flash(reason==='boss'?'boss':'bad', 120);
  AudioX.bad(); vibe(reason==='boss'?75:45);
  onMiss(reason,{});
  return false;
}

function bossAttackPunish(tag, forceHit=false){
  const vw=ROOT.innerWidth, vh=ROOT.innerHeight;
  const cx=vw/2, cy=vh/2;
  const off=viewOffset();

  let boss=null;
  for(const r of S.targets){ if(r && !r.dead && r.kind==='boss'){ boss=r; break; } }
  let close=false;
  if(boss){
    const sx=boss.cx+off.x, sy=boss.cy+off.y;
    const d=Math.hypot(sx-cx, sy-cy);
    const danger = inVR()? 240 : 210;
    close = (d <= danger);
  }
  if(forceHit) close=true;

  AudioX.atk(); vibe(35);
  logEvent('boss_attack_punish',{tag, close});

  if(!close){
    fxJudge('DODGED!');
    addScore(+40);
    addFever(+2);
    return;
  }

  if(shieldBlock(tag)){ addScore(-80); addFever(-8); return; }
  addScore(-320); addFever(-20);
  fxJudge('BOSS ATK!');
  flash('boss', 140);
  onMiss('boss_attack',{});
}

// ---------- Powerups ----------
function activateSlow(ms){
  S.slowUntil=Math.max(S.slowUntil, now()+ms);
  AudioX.power(); vibe(25); fxCelebrate('SLOW!', 1.0);
  logEvent('power_slow',{until:S.slowUntil});
  if(S.activeMini && typeof S.activeMini.onPower==='function') S.activeMini.onPower();
}
function activateNoJunk(ms){
  S.noJunkUntil=Math.max(S.noJunkUntil, now()+ms);
  AudioX.power(); vibe(25); fxCelebrate('NO-JUNK!', 1.0);
  logEvent('power_nojunk',{until:S.noJunkUntil});
  if(S.activeMini && typeof S.activeMini.onPower==='function') S.activeMini.onPower();
}
function activateStorm(ms){
  S.stormUntil=Math.max(S.stormUntil, now()+ms);
  AudioX.power(); vibe(30); fxCelebrate('STORM!', 1.05);
  logEvent('power_storm',{until:S.stormUntil});
  if(S.activeMini && typeof S.activeMini.onPower==='function') S.activeMini.onPower();
}

// ---------- Hit handling ----------
function judgeFromDist(distPx, sizePx){
  const n=clamp(distPx/(sizePx*0.55),0,1);
  return (n<=0.38) ? 'PERFECT' : 'HIT';
}

function miniBadIfAny(blocked){
  // only if actually hit (not shield-blocked)
  if(blocked) return;
  const m = S.activeMini;
  if(m && typeof m.onBadHit === 'function'){
    try{ m.onBadHit(); }catch(_){}
  }
}

function hitTarget(rec, direct, ev){
  if(!S.running || S.paused || !rec || rec.dead) return;

  const off=viewOffset();
  const tx = rec.cx + off.x;
  const ty = rec.cy + off.y;

  let px=null, py=null;
  if(direct && ev){
    if(typeof ev.clientX === 'number'){ px=ev.clientX; py=ev.clientY; }
    else if(ev.touches && ev.touches[0]){ px=ev.touches[0].clientX; py=ev.touches[0].clientY; }
    else if(ev.changedTouches && ev.changedTouches[0]){ px=ev.changedTouches[0].clientX; py=ev.changedTouches[0].clientY; }
  }
  if(px===null){
    px = ROOT.innerWidth/2;
    py = ROOT.innerHeight/2;
  }

  const dist = Math.hypot(tx-px, ty-py);

  if(rec.kind==='slow'){
    const ms = (MODE==='research') ? Math.round((D.slowDurMs[0]+D.slowDurMs[1])*0.5) : rnd(D.slowDurMs[0],D.slowDurMs[1]);
    activateSlow(ms);
    fxBurst(tx,ty,'power'); fxPop('+120',tx,ty);
    flash('good', 90);
    addScore(120); addFever(10);
    logEvent('hit_power',{kind:'slow',dist,direct:!!direct});
    removeTarget(rec); updateGrade(); return;
  }
  if(rec.kind==='nojunk'){
    const ms = (MODE==='research') ? Math.round((D.noJunkDurMs[0]+D.noJunkDurMs[1])*0.5) : rnd(D.noJunkDurMs[0],D.noJunkDurMs[1]);
    activateNoJunk(ms);
    fxBurst(tx,ty,'power'); fxPop('+160',tx,ty);
    flash('good', 90);
    addScore(160); addFever(10);
    logEvent('hit_power',{kind:'nojunk',dist,direct:!!direct});
    removeTarget(rec); updateGrade(); return;
  }
  if(rec.kind==='storm'){
    const ms = (MODE==='research') ? Math.round((D.stormDurMs[0]+D.stormDurMs[1])*0.5) : rnd(D.stormDurMs[0],D.stormDurMs[1]);
    activateStorm(ms);
    fxBurst(tx,ty,'power'); fxPop('+200',tx,ty);
    flash('gold', 95);
    addScore(200); addFever(12);
    logEvent('hit_power',{kind:'storm',dist,direct:!!direct});
    removeTarget(rec); updateGrade(); return;
  }

  if(rec.kind==='fake'){
    fxJudge('TRICK!');
    fxBurst(tx,ty,'trap'); fxPop('-220',tx,ty);
    const blocked = punishBad('trap');
    miniBadIfAny(blocked);
    if(S.activeMini && typeof S.activeMini.onHit==='function') S.activeMini.onHit({kind:'trap'},'BAD');
    if(S.activeMini && typeof S.activeMini.onJudge==='function') S.activeMini.onJudge('BAD');
    removeTarget(rec); updateGrade(); setGoal(S.goalIndex);
    logEvent('hit',{kind:'fake',dist,direct:!!direct, blocked});
    return;
  }
  if(rec.kind==='trap'){
    fxBurst(tx,ty,'trap'); fxPop('-240',tx,ty);
    const blocked = punishBad('trap');
    miniBadIfAny(blocked);
    if(S.activeMini && typeof S.activeMini.onHit==='function') S.activeMini.onHit(rec,'BAD');
    if(S.activeMini && typeof S.activeMini.onJudge==='function') S.activeMini.onJudge('BAD');
    removeTarget(rec); updateGrade(); setGoal(S.goalIndex);
    logEvent('hit',{kind:'trap',dist,direct:!!direct, blocked});
    return;
  }
  if(rec.kind==='junk'){
    fxBurst(tx,ty,'bad'); fxPop('-180',tx,ty);
    const blocked = punishBad('junk');
    miniBadIfAny(blocked);
    if(S.activeMini && typeof S.activeMini.onHit==='function') S.activeMini.onHit(rec,'BAD');
    if(S.activeMini && typeof S.activeMini.onJudge==='function') S.activeMini.onJudge('BAD');
    removeTarget(rec); updateGrade(); setGoal(S.goalIndex);
    logEvent('hit',{kind:'junk',dist,direct:!!direct, blocked});
    return;
  }

  if(rec.kind==='boss'){
    rec.hp = Math.max(0, (rec.hp|0)-1);
    bossHpSync(rec);
    const ph=bossPhaseFor(rec);
    AudioX.bossHit(); vibe(20);
    fxJudge(ph===3?'BOSS RAGE!':'BOSS HIT!');
    fxBurst(tx,ty,'boss'); fxPop('+120',tx,ty);
    flash('boss', 110);
    addScore(120); addFever(7);
    logEvent('boss_hit',{hp:rec.hp,hpMax:rec.hpMax,phase:ph,dist,direct:!!direct});

    if(S.activeMini && typeof S.activeMini.onHit==='function') S.activeMini.onHit(rec,'HIT');
    if(S.activeMini && typeof S.activeMini.onJudge==='function') S.activeMini.onJudge('HIT');

    if(rec.hp<=0){
      AudioX.bossDown(); vibe(65);
      fxCelebrate('BOSS DOWN!', 1.35);
      Coach.say('บอสล้มแล้ว! โคตรโหด 😈💥', 'happy', 1700);
      flash('gold', 160);
      addScore(1200); addFever(30);
      S.combo += 2; S.maxCombo=Math.max(S.maxCombo,S.combo); setTxt(HUD.combo,S.combo);
      fxPop('+1200',tx,ty);
      logEvent('boss_down',{});
      S.bossActive=false;
      removeTarget(rec);
    }
    updateGrade(); setGoal(S.goalIndex);
    return;
  }

  const judge=judgeFromDist(dist, rec.size);
  const mult=S.feverOn?1.35:1.0;
  const base=(rec.kind==='gold')?520:240;
  const bonus=(judge==='PERFECT')?220:0;
  const stormBonus=(now()<S.stormUntil)?60:0;
  const delta=Math.round((base+bonus+stormBonus)*mult);

  addScore(delta);
  addCombo();

  if(judge==='PERFECT'){
    S.perfectCount++; setTxt(HUD.perfect,S.perfectCount);
    addFever(14);
    fxJudge('PERFECT'); AudioX.perfect(); vibe(30);
    flash(rec.kind==='gold'?'gold':'good', 95);
  }else{
    addFever(8);
    fxJudge('GOOD'); AudioX.good();
    flash(rec.kind==='gold'?'gold':'good', 85);
  }

  fxBurst(tx,ty,(rec.kind==='gold')?'gold':'good');
  fxPop(`+${delta}`,tx,ty);

  if(rec.kind==='good') onGood(rec.group);
  if(rec.kind==='gold'){
    let g=1+((R()*5)|0);
    for(let k=0;k<5;k++){
      const gg=1+((g-1+k)%5);
      if(!S.plateHave.has(gg)){ g=gg; break; }
    }
    onGood(g); // ✅ now counts into PlateRush via onPlateAdd
  }

  if(S.activeMini && typeof S.activeMini.onHit==='function') S.activeMini.onHit(rec,judge);
  if(S.activeMini && typeof S.activeMini.onJudge==='function') S.activeMini.onJudge(judge);

  if(S.activeGoal && S.activeGoal.key==='perfect6'){
    if(checkGoalClear()) onGoalCleared();
  }

  removeTarget(rec);
  updateGrade(); setGoal(S.goalIndex);
  logEvent('hit',{kind:rec.kind,group:rec.group,judge,dist,direct:!!direct,delta});
}

// ---------- Decide kind/group ----------
function decideGroup(){ return 1 + ((R()*5)|0); }

function decideKind(){
  const t=now();
  const noJunk=(t<S.noJunkUntil);
  const storm=(t<S.stormUntil);
  const fever=S.feverOn;

  let gold=D.goldRate + (fever?0.03:0);
  let junk=D.junkRate + (storm?0.04:0);
  let trap=D.trapRate + (storm?0.03:0);
  let fake=D.fakeRate + (storm?0.02:0);
  let slow=D.slowRate * (fever?1.05:1.0);
  let nojunk=D.noJunkRate * (fever?1.10:1.0);
  let stormP=D.stormRate * (fever?1.20:1.0);

  // ✅ Apply mini modifiers (locks pass-rate range)
  const mm = miniMods();
  if(mm){
    junk *= mm.junkMul;
    trap *= mm.trapMul;
    fake *= mm.fakeMul;
    gold += mm.goldAdd;
    // bias toward "good" by reducing hazard slightly and increasing fallback good
    if(mm.goodBias){
      junk *= (1 - mm.goodBias);
      trap *= (1 - mm.goodBias*0.8);
      fake *= (1 - mm.goodBias*0.6);
      gold += mm.goodBias*0.02;
    }
  }

  gold=clamp(gold,0.06,0.25);
  junk=clamp(junk,0.06,0.45);
  trap=clamp(trap,0.02,0.25);
  fake=clamp(fake,0.00,0.22);

  if(noJunk){
    junk*=0.12; trap*=0.12; fake*=0.10;
    gold*=1.10; slow*=1.08; stormP*=0.60;
  }
  if(t<S.slowUntil){
    junk*=0.86; trap*=0.86; fake*=0.86; gold*=1.05;
  }

  const r=R(); let acc=0;
  acc+=slow; if(r<acc) return 'slow';
  acc+=nojunk; if(r<acc) return 'nojunk';
  acc+=stormP; if(r<acc) return 'storm';

  acc+=gold; if(r<acc) return 'gold';
  acc+=junk; if(r<acc) return 'junk';
  acc+=trap; if(r<acc) return 'trap';
  acc+=fake; if(r<acc) return 'fake';
  return 'good';
}

// ---------- Boss spawn + attacks ----------
function spawnBossIfReady(){
  const mm = miniMods();
  if(mm && mm.noBoss) return; // ✅ no boss during PlateRush

  if(S.bossActive) return;
  const t=now();

  if(!S.bossNextAt){
    S.bossNextAt = (MODE==='research') ? (t + 11000) : (t + rnd(9000,15000));
  }
  if(t < S.bossNextAt) return;

  S.bossActive=true;

  const hp = (S.feverOn ? Math.max(2, D.bossHP-1) : D.bossHP);
  const boss = makeTarget('boss',0,{hp});
  bossHpSync(boss);

  const base = (MODE==='research')
    ? (t + 14000)
    : (t + (S.feverOn ? rnd(8500,12500) : rnd(10500,16500)));
  S.bossNextAt = base;

  fxJudge('BOSS!');
  fxCelebrate('⚠️', 1.0);
  flash('boss', 140);
  AudioX.warn(); vibe(25);
  Coach.say('บอสมาแล้ว! เล็งกลางจอไว้ ⚠️', 'fever', 1900);
  logEvent('boss_spawn',{hp});
}

function tickBossAttack(){
  const t=now();
  for(const rec of S.targets){
    if(!rec || rec.dead || rec.kind!=='boss') continue;
    const ph=bossPhaseFor(rec);
    const style=bossAttackStyleForPhase(ph);
    const phaseMul=(ph===3)?0.78:(ph===2)?0.90:1.0;

    const warnLead=(style==='double')?680:520;
    if(t >= rec.atkAt - warnLead && !rec._warned){
      rec._warned=true;
      rec.el.classList.add('warn');
      fxJudge(style==='double'?'☠️':'⚠️');
      AudioX.warn(); vibe(15);
    }
    if(t >= rec.atkAt){
      rec._warned=false;
      rec.el.classList.remove('warn');

      bossAttackPunish('boss_attack', false);
      logEvent('boss_attack',{phase:ph,style});

      const baseMin=D.bossAtkMs[0]*phaseMul;
      const baseMax=D.bossAtkMs[1]*phaseMul;
      rec.atkAt = t + ((MODE==='research') ? Math.round((baseMin+baseMax)*0.5) : rnd(baseMin,baseMax));

      if(ph===3 && R()<0.22){
        rec.atkAt = t + ((MODE==='research') ? 1100 : rnd(900,1400));
        fxJudge('CHAIN!');
      }
    }
  }
}

// ---------- Spawn tick ----------
function spawnTick(){
  const t=now();
  if(t < S.nextSpawnAt) return;

  const cap = D.maxTargets || 12;
  if(S.targets.length >= cap){
    S.nextSpawnAt = t + 180;
    return;
  }

  spawnBossIfReady();

  const stormOn=(t < S.stormUntil);
  const slowOn=(t < S.slowUntil);

  let interval=D.spawnMs;
  if(S.feverOn) interval*=0.78;
  if(stormOn) interval*=0.56;
  if(slowOn) interval*=1.22;
  if(t < S.noJunkUntil) interval*=0.92;

  let burst = 1;
  if(MODE !== 'research'){
    if(stormOn) burst = (R()<0.65)?3:2;
    else if(S.feverOn) burst = (R()<0.22)?2:1;
    if(DIFF==='hard' && R()<0.10) burst += 1;
  } else {
    burst = stormOn ? 2 : 1;
  }

  // tiny push to ensure mini goals are feasible
  const mm = miniMods();
  if(mm && (S.activeMini && S.activeMini.key==='plateRush') && MODE!=='research'){
    if(R()<0.30) burst = Math.min(burst+1, 3);
  }

  for(let i=0;i<burst;i++){
    if(S.targets.length >= cap) break;
    const kind=decideKind();
    const group=(kind==='good'||kind==='fake') ? decideGroup() : 0;
    makeTarget(kind,group);
  }

  const jitter = (MODE==='research') ? 0 : rnd(-120,120);
  S.nextSpawnAt = t + Math.max(240, interval + jitter);
}

// ---------- Tap-anywhere shooting ----------
function isUIElement(target){
  if(!target) return false;
  return !!(target.closest && (target.closest('.btn') || target.closest('#resultBackdrop') || target.closest('#startOverlay')));
}
function airShot(){
  S.combo=0; setTxt(HUD.combo,0);
  addScore(-20);
  addFever(-2);
  fxJudge('WHIFF');
  flash('bad', 80);
  AudioX.tick();
  S.miss++; setTxt(HUD.miss, S.miss);
  updateGrade();
  logEvent('air_shot',{});
}
function shootCrosshair(){
  if(!S.running || S.paused) return;
  AudioX.unlock();
  const assist = inVR()? Math.max(D.aimAssist,170) : D.aimAssist;
  const picked = pickNearCrosshair(assist);
  if(picked && picked.rec) hitTarget(picked.rec,false,null);
  else airShot();
}
function onGlobalPointerDown(e){
  if(!S.running || S.paused) return;
  if(isUIElement(e.target)) return;
  e.preventDefault();
  shootCrosshair();
}

// ---------- Pause/Restart/VR ----------
function setPaused(on){
  S.paused=!!on;
  setShow(HUD.paused,S.paused);
  if(HUD.btnPause) HUD.btnPause.textContent = S.paused ? '▶️ RESUME' : '⏸️ PAUSE';
  logEvent('pause',{paused:S.paused});
}
function enterVR(){ try{ scene && scene.enterVR && scene.enterVR(); }catch(_){ } }

// ---------- Restart / End ----------
function restart(){
  for(const rec of [...S.targets]) removeTarget(rec);

  S.sessionId = makeSessionId();

  resetState(S, { totalTime: TOTAL_TIME, livesMax: S.livesMax, sessionId: S.sessionId });

  S.bossNextAt = (MODE==='research') ? (now()+11000) : (now()+rnd(8000,14000));

  setTxt(HUD.score,0); setTxt(HUD.combo,0); setTxt(HUD.miss,0);
  setTxt(HUD.perfect,0); setTxt(HUD.have,'0/5'); setTxt(HUD.feverPct,'0%');
  emitFever();
  updateGrade(); setPaused(false);
  setShow(HUD.resultBackdrop,false);

  setGoal(0);
  startMini();

  Coach.say('เริ่มใหม่! ลุยต่อเลย 💪', 'neutral', 1200);

  logSession('start');
  start();
}

function endGame(isGameOver){
  if(!S.running) return;
  S.running=false;
  doc.body.classList.remove('hha-mini-urgent');
  S.nextSpawnAt=Infinity;
  for(const rec of [...S.targets]) removeTarget(rec);

  setTxt(HUD.rMode, MODE==='research'?'Research':'Play');
  setTxt(HUD.rGrade, gradeFromScore());
  setTxt(HUD.rScore, S.score);
  setTxt(HUD.rMaxCombo, S.maxCombo);
  setTxt(HUD.rMiss, S.miss);
  setTxt(HUD.rPerfect, S.perfectCount);
  setTxt(HUD.rGoals, `${Math.min(S.goalsCleared,2)}/2`);
  setTxt(HUD.rMinis, `${Math.min(S.minisCleared,7)}/7`);
  setTxt(HUD.rG1, S.groupCounts[0]);
  setTxt(HUD.rG2, S.groupCounts[1]);
  setTxt(HUD.rG3, S.groupCounts[2]);
  setTxt(HUD.rG4, S.groupCounts[3]);
  setTxt(HUD.rG5, S.groupCounts[4]);
  setTxt(HUD.rGTotal, S.groupCounts.reduce((a,b)=>a+b,0));

  setShow(HUD.resultBackdrop,true);

  fxCelebrate(isGameOver?'GAME OVER':'ALL DONE!', isGameOver?1.05:1.2);
  vibe(isGameOver?60:50);
  Coach.say(isGameOver ? 'หมดหัวใจแล้ว! ลองใหม่ได้ 💥' : 'จบแล้ว! เก่งมาก 🎉', isGameOver?'sad':'happy', 1700);
  logSession(isGameOver?'gameover':'end');
}

// ---------- Main loop ----------
function start(){
  S.running=true;
  S.tStart=now();
  S.nextSpawnAt=now()+350;

  setTxt(HUD.mode, MODE==='research'?'Research':'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));
  setGoal(S.goalIndex);

  function frame(){
    if(!S.running) return;

    applyLayerTransform();
    updateAimHighlight();

    if(!S.paused){
      const elapsed=(now()-S.tStart)/1000;
      S.timeLeft=Math.max(0, TOTAL_TIME - elapsed);
      setTxt(HUD.time, fmt(S.timeLeft));

      if(S.timeLeft<=10){
        const sec=Math.ceil(S.timeLeft);
        if(sec!==S.lowTimeLastSec){ S.lowTimeLastSec=sec; AudioX.tick(); }
      }else S.lowTimeLastSec=null;

      spawnTick();
      tickBossAttack();
      expireTargets();
      tickMini();

      Coach.tick();

      addFever(S.feverOn ? -0.22 : -0.10);

      setGoal(S.goalIndex);

      if(S.timeLeft<=0) endGame(false);
    }
    ROOT.requestAnimationFrame(frame);
  }
  ROOT.requestAnimationFrame(frame);
}

// ---------- Hotkeys ----------
function bindShootHotkeys(){
  ROOT.addEventListener('keydown',(e)=>{
    const k=String(e.key||'').toLowerCase();
    if(k===' '||k==='enter'||k==='z'||k==='x') shootCrosshair();
  });
  if(scene){
    const fire=()=>shootCrosshair();
    scene.addEventListener('triggerdown', fire);
    scene.addEventListener('abuttondown', fire);
    scene.addEventListener('xbuttondown', fire);
    scene.addEventListener('gripdown', fire);
    scene.addEventListener('mousedown', fire);
    scene.addEventListener('click', fire);
  }
}

// ✅ PATCH: refresh HUD refs (กัน DOM timing)
function refreshHUDRefs(){
  HUD.btnEnterVR = HUD.btnEnterVR || $('btnEnterVR');
  HUD.btnPause   = HUD.btnPause   || $('btnPause');
  HUD.btnRestart = HUD.btnRestart || $('btnRestart');
  HUD.resultBackdrop = HUD.resultBackdrop || $('resultBackdrop');
  HUD.btnPlayAgain   = HUD.btnPlayAgain   || $('btnPlayAgain');
}

// ✅ PATCH: delegate handler ให้ปุ่มทำงานชัวร์ (pointerup + click)
function bindUIDelegated(){
  if (S._uiDelegated) return;
  S._uiDelegated = true;

  const actStart = async ()=>{
    try{
      AudioX.unlock();
      await requestMotionPermissionIfNeeded();
    }catch(_){}
    showStartOverlay(false);

    if(!S.started){
      S.started = true;
      restart();
    }
  };

  const handler = (e)=>{
    const el = e.target && e.target.closest
      ? e.target.closest('#btnBackHub, #btnPlayAgain, #btnRestart, #btnPause, #btnEnterVR, #btnStart')
      : null;
    if(!el) return;

    e.preventDefault();
    e.stopPropagation();

    refreshHUDRefs();

    switch(el.id){
      case 'btnBackHub':
        goHub();
        break;

      case 'btnPlayAgain':
        setShow(HUD.resultBackdrop, false);
        S.started = true;
        restart();
        break;

      case 'btnRestart':
        S.started = true;
        restart();
        break;

      case 'btnPause':
        if(!S.running) return;
        setPaused(!S.paused);
        break;

      case 'btnEnterVR':
        enterVR();
        break;

      case 'btnStart':
        actStart();
        break;
    }
  };

  doc.addEventListener('pointerup', handler, { passive:false });
  doc.addEventListener('click', handler, { passive:false });
}

// ✅ PATCH: ensure binding (retry) กันบางจังหวะ DOM/overlay
function ensureUIBindings(){
  refreshHUDRefs();
  bindUIDelegated();

  const ok =
    !!$('btnBackHub') &&
    !!$('btnPlayAgain') &&
    !!$('btnStart') &&
    !!$('resultBackdrop') &&
    !!$('startOverlay');

  if(!ok && (S._uiBindTries++ < 12)){
    setTimeout(ensureUIBindings, 250);
  }
}

// ---------- Bind UI ----------
function bindUI(){
  if(S.booted) return;
  S.booted = true;

  layer.addEventListener('pointerdown', onGlobalPointerDown, {passive:false});
  layer.addEventListener('touchstart', onGlobalPointerDown, {passive:false});
  layer.addEventListener('click', onGlobalPointerDown, {passive:false});

  const rb = $('resultBackdrop');
  rb && rb.addEventListener('click', (e)=>{
    if(e.target === rb) setShow(rb,false);
  });

  ensureUIBindings();
}

// ---------- BOOT (สำคัญ: ไม่ start ทันที) ----------
(function boot(){
  try{
    if(ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.init==='function'){
      ROOT.HHACloudLogger.init({ debug: DEBUG });
    }
  }catch(_){}

  bindUI();
  bindShootHotkeys();

  setShield(0);
  setLives(S.livesMax);

  setTxt(HUD.mode, MODE==='research'?'Research':'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));
  setTxt(HUD.have,'0/5');
  setTxt(HUD.score,0); setTxt(HUD.combo,0); setTxt(HUD.miss,0);
  setTxt(HUD.perfect,0); setTxt(HUD.feverPct,'0%');
  emitFever();
  updateGrade();

  S.started = false;
  showStartOverlay(true);

  Coach.say('พร้อมแล้ว! เก็บให้ครบ 5 หมู่ 💪', 'neutral', 2200);

  if(DEBUG) console.log('[PlateVR] boot ok (waiting start)', { RUN_RAW, MODE, DIFF, TOTAL_TIME, seed:SEED, D });
})();
