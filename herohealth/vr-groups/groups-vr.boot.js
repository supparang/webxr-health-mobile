/* === /herohealth/vr-groups/groups-vr.boot.js ===
GroupsVR — Boot (PRODUCTION)
✅ อ่าน query: diff, time, run, style, seed, hub
✅ bind HUD จาก events: hha:score/hha:time/hha:fever/hha:rank/groups:power/quest:update/hha:coach/hha:end
✅ Start overlay (2D/VR)
✅ Result overlay + save last summary (localStorage: HHA_LAST_SUMMARY / HHA_LAST_SUMMARY_GROUPS)
✅ Back HUB + flush-hardened (pagehide / beforeunload + events)
*/

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(){ return new URLSearchParams(location.search); }
function pick(q, k, d){ const v = q.get(k); return (v==null || v==='') ? d : v; }
function clamp(v,a,b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); }
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }
function safeJson(obj){ try{ return JSON.stringify(obj); }catch{ return ''; } }

const $ = (id)=> DOC.getElementById(id);

// ---- elements ----
const fgLayer = $('fg-layer');

const startOverlay  = $('startOverlay');
const resultOverlay = $('resultOverlay');

const btnStart2D = $('btnStart2D');
const btnStartVR = $('btnStartVR');

const btnRestart   = $('btnRestart');
const btnBackHub   = $('btnBackHub');
const btnPlayAgain = $('btnPlayAgain');
const btnBackHub2  = $('btnBackHub2');

// HUD ids
const hudScore  = $('hudScore');
const hudCombo  = $('hudCombo');
const hudMiss   = $('hudMiss');
const hudFever  = $('hudFever');
const hudShield = $('hudShield');

const hudGroup  = $('hudGroup');
const hudTimer  = $('hudTimer');

const hudPowerText = $('hudPowerText');
const hudPowerFill = $('hudPowerFill');

const hudGoalText  = $('hudGoalText');
const hudGoalNum   = $('hudGoalNum');
const hudGoalBar   = $('hudGoalBar');
const hudGoalTimer = $('hudGoalTimer');

const hudMiniLine  = $('hud-mini-line');
const hudMiniText  = $('hudMiniText');
const hudMiniNum   = $('hudMiniNum');
const hudMiniBar   = $('hudMiniBar');
const hudMiniTimer = $('hudMiniTimer');

const hudAcc   = $('hudAcc');
const hudGrade = $('hudGrade');
const hudRt    = $('hudRt');

const coachEmoji = $('coachEmoji');
const coachText  = $('coachText');

// result fields
const resultTitle = $('resultTitle');
const rGrade = $('rGrade');
const rAcc   = $('rAcc');
const rScore = $('rScore');
const rCombo = $('rCombo');
const rMiss  = $('rMiss');
const rJunk  = $('rJunk');
const rAvgRt = $('rAvgRt');
const rMedRt = $('rMedRt');

// ---- config ----
const q = qs();
const diff  = String(pick(q, 'diff', 'normal')).toLowerCase();           // easy|normal|hard
const time  = clamp(pick(q, 'time', '90'), 30, 180);
const run   = String(pick(q, 'run', 'play')).toLowerCase();             // play|research
const style = String(pick(q, 'style', 'mix')).toLowerCase();            // mix|feel|hard
const seed  = String(pick(q, 'seed', pick(q,'ts', String(Date.now())))); // deterministic
const hub   = String(pick(q, 'hub', '../hub.html'));

const session = {
  gameTag: 'GroupsVR',
  sessionId: `GRP_${Date.now()}_${Math.floor(Math.random()*1e6)}`,
  startTimeIso: '',
  endTimeIso: '',
  diff, time, runMode: (run==='research'?'research':'play'), style, seed
};

let ended = false;

// ---- helpers ----
function show(el){ if(el) el.style.display = 'flex'; }
function hide(el){ if(el) el.style.display = 'none'; }
function addClass(el, c){ try{ el.classList.add(c); }catch{} }
function remClass(el, c){ try{ el.classList.remove(c); }catch{} }

function setText(el, t){ if(el) el.textContent = String(t ?? ''); }
function setPct(el, pct){ if(!el) return; el.style.width = `${clamp(pct,0,100).toFixed(1)}%`; }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
}

function flushNow(reason){
  // 1) event signal ให้ logger/โมดูลอื่น hook ได้
  dispatch('hha:flush', { gameTag: session.gameTag, sessionId: session.sessionId, reason: reason||'flush' });

  // 2) ถ้า logger มี API ก็เรียกแบบปลอดภัย
  try{ ROOT.HHACloudLogger && ROOT.HHACloudLogger.flush && ROOT.HHACloudLogger.flush(); }catch{}
  try{ ROOT.HHA_Logger && ROOT.HHA_Logger.flush && ROOT.HHA_Logger.flush(); }catch{}
}

// ---- Goal (simple, always visible) ----
// เราโชว์ Goal เป็น “เก็บให้แม่น + สะสม Power เพื่อสลับหมู่เร็ว”
// ถ้าคุณอยากให้ goal เป็น “ครบ 5 หมู่ภายในเวลา” เดี๋ยวผมอัปเกรดเป็น quest director ต่อได้
function updateGoalHint(){
  setText(hudGoalText, 'เล่นให้แม่น + สะสม POWER เพื่อสลับหมู่! (หลบขยะ)');
  setText(hudGoalNum, '—');
  setPct(hudGoalBar, 0);
  setText(hudGoalTimer, '');
}

// ---- boot ----
function startGame(tryEnterVr){
  if (!ROOT.GroupsVR || !ROOT.GroupsVR.GameEngine) {
    alert('GroupsVR GameEngine ยังไม่โหลด');
    return;
  }

  ended = false;
  hide(resultOverlay);
  hide(startOverlay);

  updateGoalHint();

  // attach layer
  ROOT.GroupsVR.GameEngine.setLayerEl(fgLayer);

  // session start
  session.startTimeIso = nowIso();
  dispatch('hha:session-start', {
    ...session,
    startTimeIso: session.startTimeIso
  });

  // start engine
  ROOT.GroupsVR.GameEngine.start(diff, {
    runMode: session.runMode,
    time: session.time,
    style: session.style,
    seed: session.seed,
    diff: session.diff
  });

  // optionally enter VR
  if (tryEnterVr) {
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene && scene.enterVR) scene.enterVR();
    }catch{}
  }
}

function backHub(){
  flushNow('backHub');

  // HHA standard: ถ้ามี param hub=... ให้กลับไปอันนั้น
  try{
    location.href = hub;
  }catch{
    location.assign(hub);
  }
}

function restart(){
  flushNow('restart');
  try{ ROOT.GroupsVR && ROOT.GroupsVR.GameEngine && ROOT.GroupsVR.GameEngine.stop('restart'); }catch{}
  show(startOverlay);
}

btnStart2D?.addEventListener('click', ()=> startGame(false));
btnStartVR?.addEventListener('click', ()=> startGame(true));

btnRestart?.addEventListener('click', restart);
btnBackHub?.addEventListener('click', backHub);
btnPlayAgain?.addEventListener('click', ()=> { hide(resultOverlay); show(startOverlay); });
btnBackHub2?.addEventListener('click', backHub);

// ---- HUD bind from events ----
ROOT.addEventListener('hha:score', (ev)=>{
  const d = (ev && ev.detail) || {};
  setText(hudScore, d.score ?? 0);
  setText(hudCombo, d.combo ?? 0);
  setText(hudMiss,  d.misses ?? 0);
});

ROOT.addEventListener('hha:time', (ev)=>{
  const d = (ev && ev.detail) || {};
  const left = Math.max(0, Math.round(Number(d.left)||0));
  setText(hudTimer, `${left}s`);
});

ROOT.addEventListener('hha:fever', (ev)=>{
  const d = (ev && ev.detail) || {};
  const f = Math.max(0, Math.min(100, Math.round(Number(d.feverPct)||0)));
  setText(hudFever, `${f}%`);
  setText(hudShield, Number(d.shield)||0);
});

ROOT.addEventListener('hha:rank', (ev)=>{
  const d = (ev && ev.detail) || {};
  setText(hudGrade, d.grade ?? 'C');
  setText(hudAcc, `${Number(d.accuracy||0)}%`);
});

ROOT.addEventListener('groups:power', (ev)=>{
  const d = (ev && ev.detail) || {};
  const c = Number(d.charge)||0;
  const t = Math.max(1, Number(d.threshold)||1);
  setText(hudPowerText, `${c}/${t}`);
  setPct(hudPowerFill, (c/t)*100);
});

ROOT.addEventListener('quest:update', (ev)=>{
  const d = (ev && ev.detail) || {};

  // mini
  if (d.miniTitle != null) setText(hudMiniText, d.miniTitle);
  if (d.miniNow != null || d.miniTotal != null) {
    const now = Number(d.miniNow||0);
    const tot = Math.max(1, Number(d.miniTotal||1));
    setText(hudMiniNum, `${now}/${tot}`);
  }
  if (d.miniPct != null) setPct(hudMiniBar, Number(d.miniPct)||0);
  if (d.miniTimeLeftSec != null) {
    const s = Math.max(0, Number(d.miniTimeLeftSec)||0);
    setText(hudMiniTimer, s>0 ? `${s}s` : '');
    if (s > 0 && s <= 3) addClass(hudMiniLine, 'mini-urgent');
    else remClass(hudMiniLine, 'mini-urgent');
  }

  // (ถ้าอนาคตอยากอัป goal แบบจริง: d.goalTitle/goalNow/goalTotal/goalPct/goalTimeLeftSec)
});

ROOT.addEventListener('hha:coach', (ev)=>{
  const d = (ev && ev.detail) || {};
  const mood = String(d.mood||'neutral');
  const emoji = (mood==='happy') ? '🤩' : (mood==='sad') ? '😵' : (mood==='warn') ? '⚠️' : '🎶';
  setText(coachEmoji, emoji);

  // ทำให้ 1 บรรทัดไม่ยาวจนล้น: แทน \n ด้วย " • "
  const text = String(d.text||'').replace(/\n/g,' • ');
  if (text) setText(coachText, text);
});

// ---- group label (จับจาก progress / หรือ fallback จาก text coach) ----
ROOT.addEventListener('groups:progress', (ev)=>{
  const d = (ev && ev.detail) || {};
  // ถ้าคุณอยากให้แม่น 100%: ผมเพิ่ม event "groups:group" ใน engine ได้
  // ตอนนี้ให้ HUD group ไม่สั่น และอิงจากค่าที่ engine ใช้จริงผ่านการอ่านข้อความโค้ช
});

// ---- end ----
ROOT.addEventListener('hha:end', (ev)=>{
  if (ended) return;
  ended = true;

  const d = (ev && ev.detail) || {};
  session.endTimeIso = nowIso();

  // result text
  const grade = d.grade || 'C';
  const acc   = Number(d.accuracyGoodPct||0);
  const score = Number(d.scoreFinal||0);
  const combo = Number(d.comboMax||0);
  const miss  = Number(d.misses||0);
  const junkE = Number(d.junkErrorPct||0);
  const avgRt = Number(d.avgRtGoodMs||0);
  const medRt = Number(d.medianRtGoodMs||0);

  setText(resultTitle, `จบเกมแล้ว! (${String(d.reason||'end')})`);
  setText(rGrade, grade);
  setText(rAcc,   `${acc}%`);
  setText(rScore, score);
  setText(rCombo, combo);
  setText(rMiss,  miss);
  setText(rJunk,  `${junkE}%`);
  setText(rAvgRt, avgRt ? `${avgRt} ms` : '—');
  setText(rMedRt, medRt ? `${medRt} ms` : '—');

  // show overlay
  addClass(resultOverlay, 'show');
  resultOverlay.style.display = 'flex';

  // ---- HHA Standard: save last summary ----
  const summary = {
    timestampIso: session.endTimeIso,
    projectTag: 'HeroHealth',
    gameTag: session.gameTag,
    sessionId: session.sessionId,
    runMode: session.runMode,
    diff: session.diff,
    timeSec: session.time,
    style: session.style,
    seed: session.seed,

    scoreFinal: score,
    comboMax: combo,
    misses: miss,
    accuracyGoodPct: acc,
    junkErrorPct: junkE,
    avgRtGoodMs: avgRt,
    medianRtGoodMs: medRt,

    nTargetGoodSpawned: Number(d.nTargetGoodSpawned||0),
    nTargetJunkSpawned: Number(d.nTargetJunkSpawned||0),
    nTargetDecoySpawned:Number(d.nTargetDecoySpawned||0),
    nTargetWrongSpawned:Number(d.nTargetWrongSpawned||0),
    nTargetStarSpawned: Number(d.nTargetStarSpawned||0),
    nTargetIceSpawned:  Number(d.nTargetIceSpawned||0),
    nTargetBossSpawned: Number(d.nTargetBossSpawned||0),

    nHitGood: Number(d.nHitGood||0),
    nHitJunk: Number(d.nHitJunk||0),
    nHitDecoy:Number(d.nHitDecoy||0),
    nHitWrong:Number(d.nHitWrong||0),
    nHitStar: Number(d.nHitStar||0),
    nHitIce:  Number(d.nHitIce||0),
    nHitBoss: Number(d.nHitBoss||0),
    nHitJunkGuard: Number(d.nHitJunkGuard||0),
    nExpireGood: Number(d.nExpireGood||0),

    miniKind: String(d.miniKind||''),
    miniNeed: Number(d.miniNeed||0),
    miniGot:  Number(d.miniGot||0),
    miniFailed: !!d.miniFailed,
    miniFailReason: String(d.miniFailReason||''),

    backToHub: hub
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', safeJson(summary));
    localStorage.setItem('HHA_LAST_SUMMARY_GROUPS', safeJson(summary));
  }catch{}

  // session end event (logger hook)
  dispatch('hha:session-end', { ...session, ...summary });

  // flush
  flushNow('end');
});

// ---- flush hardened ----
ROOT.addEventListener('beforeunload', ()=> flushNow('beforeunload'));
ROOT.addEventListener('pagehide', ()=> flushNow('pagehide'));

// ---- initial UI ----
show(startOverlay);
hide(resultOverlay);

setText(hudTimer, `${time}s`);
setText(hudGroup, 'หมู่ 1');
updateGoalHint();

// default coach line (เพลงที่คุณให้)
setText(coachEmoji, '🎶');
setText(coachText, 'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน');