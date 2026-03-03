// === /fitness/js/jump-duck.js — Jump-Duck (BOSS+FEVER+AI+LOG+ML) v20260302a ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* -------------------------
   Fatal overlay
------------------------- */
function fatal(msg){
  const box = document.getElementById('jd-fatal');
  if (!box) { alert(msg); return; }
  box.textContent = msg;
  box.classList.remove('jd-hidden');
}
window.addEventListener('error', (e)=>{
  fatal('JS ERROR:\n' + (e?.message || e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
});
window.addEventListener('unhandledrejection', (e)=>{
  fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
});

/* -------------------------
   helpers
------------------------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const clamp01=(v)=>clamp(v,0,1);
function getEl(id){ return document.getElementById(id); }
function setText(id, v){ const el=getEl(id); if(el) el.textContent = String(v); }
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }

function dlText(filename, text, mime='application/json;charset=utf-8'){
  try{
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(e){ console.warn(e); }
}

function escCsv(v){
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}
function toCsv(rows){
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(',')];
  for (const r of rows){
    lines.push(cols.map(c=>escCsv(r[c])).join(','));
  }
  return lines.join('\n');
}

/* -------------------------
   QS / ctx
------------------------- */
function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();
function qs(k, d=''){
  const v = QS.get(k);
  return (v==null || String(v).trim()==='') ? d : String(v);
}
function qbool(k, d=false){
  const v = String(qs(k, d?'1':'0')).toLowerCase();
  return ['1','true','yes','y','on'].includes(v);
}

const HHA = {
  hub: qs('hub',''),
  view: (qs('view','')||'').toLowerCase(), // pc/mobile/cvr/vr
  mode: (qs('mode','')||qs('runMode','')||'').toLowerCase(), // training/test/research
  diff: (qs('diff','')||'').toLowerCase(),
  duration: qs('duration', qs('time','')),
  seed: qs('seed',''),
  studyId: qs('studyId',''),
  phase: qs('phase',''),
  conditionGroup: qs('conditionGroup',''),
  pid: qs('pid',''),
  group: qs('group',''),
  note: qs('note',''),
  logUrl: qs('log',''),
  bossMode: (qs('boss','mixed')||'mixed').toLowerCase()
};

function detectView(){
  if (HHA.view) return HHA.view;
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const w = Math.min(window.innerWidth||0, document.documentElement.clientWidth||0, screen.width||9999);
  const h = Math.min(window.innerHeight||0, document.documentElement.clientHeight||0, screen.height||9999);
  const small = Math.min(w,h) <= 520;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  if ((touch || isMobileUA) && small) return 'cvr';
  if (touch || isMobileUA) return 'mobile';
  return 'pc';
}
function applyViewClass(view){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','jd-ab-on');
  if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}
applyViewClass(detectView());

/* -------------------------
   Optional: auto-load VR UI if WebXR exists
------------------------- */
async function ensureVrUi(){
  try{
    if (window.__HHA_VRUI_LOADED__) return true;
    if (!('xr' in navigator)) return false;
    const src = '../herohealth/vr/vr-ui.js';
    await new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = ()=>reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
    return true;
  }catch(e){
    console.warn(e);
    return false;
  }
}

/* -------------------------
   Seeded RNG
------------------------- */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function strToSeed(s){
  const str = String(s||'');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function getSeed(){
  if (HHA.seed) return strToSeed(HHA.seed);
  const base = `${HHA.pid||''}|${HHA.studyId||''}|${HHA.phase||''}|${HHA.conditionGroup||''}`;
  if (base.replace(/\|/g,'').trim()) return strToSeed(base);
  return (Date.now() >>> 0);
}
let RNG = mulberry32(getSeed());

/* -------------------------
   DOM refs
------------------------- */
const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

const elResearchBlock = $('#jd-research-block');
const elPid     = $('#jd-participant-id');
const elGroup   = $('#jd-group');
const elNote    = $('#jd-note');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');
const elHudPhase  = $('#hud-phase');
const elHudBoss   = $('#hud-boss');

const elProgFill  = $('#hud-prog-fill');
const elProgText  = $('#hud-prog-text');
const elFeverFill = $('#hud-fever-fill');
const elFeverStat = $('#hud-fever-status');

const bossBarWrap = $('#boss-bar-wrap');
const bossFill    = $('#hud-boss-fill');
const bossStatus  = $('#hud-boss-status');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');
const elTele      = $('#jd-tele');

const btnJump = document.querySelector('[data-action="jump"]');
const btnDuck = document.querySelector('[data-action="duck"]');

const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resJumpHit      = $('#res-jump-hit');
const resDuckHit      = $('#res-duck-hit');
const resJumpMiss     = $('#res-jump-miss');
const resDuckMiss     = $('#res-duck-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

const backHubMenu   = $('#jd-back-hub-menu');
const backHubPlay   = $('#jd-back-hub-play');
const backHubResult = $('#jd-back-hub-result');

/* -------------------------
   SFX
------------------------- */
const sfx = {
  hit:'jd-sfx-hit',
  miss:'jd-sfx-miss',
  combo:'jd-sfx-combo',
  beep:'jd-sfx-beep',
  boss:'jd-sfx-boss',
  fever:'jd-sfx-fever'
};
function playSfx(id, vol=1){
  const el = document.getElementById(id);
  if (!el) return;
  try{
    el.pause();
    el.currentTime = 0;
    el.volume = clamp01(vol);
    el.play().catch(()=>{});
  }catch{}
}

/* -------------------------
   Views / UI
------------------------- */
function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu')   viewMenu?.classList.remove('jd-hidden');
  if (name === 'play')   viewPlay?.classList.remove('jd-hidden');
  if (name === 'result') viewResult?.classList.remove('jd-hidden');
}
let judgeTimer = null;
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 520);
}
function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test') return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}
function setHubLinks(){
  const hub = HHA.hub || '';
  if (!hub) return;
  [backHubMenu, backHubPlay, backHubResult].forEach(a=>{ if(a) a.href = hub; });
}
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}
function collectParticipant(metaMode){
  if (metaMode !== 'research') return { id:'', group:'', note:'' };
  return {
    id: (elPid?.value || HHA.pid || '').trim(),
    group: (elGroup?.value || HHA.group || '').trim(),
    note: (elNote?.value || HHA.note || '').trim()
  };
}

/* -------------------------
   Cinematic overlay (auto-create)
------------------------- */
let jdCine = null;
function ensureCine(){
  if (jdCine) return jdCine;
  const host = document.getElementById('jd-play-area') || document.body;
  const wrap = document.createElement('div');
  wrap.id = 'jd-cine';
  wrap.className = 'jd-cine jd-hidden';
  wrap.innerHTML = `
    <div class="jd-cine-backdrop"></div>
    <div class="jd-cine-card">
      <div class="jd-cine-title" id="jd-cine-title">BOSS!</div>
      <div class="jd-cine-sub" id="jd-cine-sub">เตรียมตัว!</div>
      <div class="jd-cine-badges" id="jd-cine-badges"></div>
    </div>
  `;
  host.appendChild(wrap);
  jdCine = wrap;
  return jdCine;
}
function cineShow(title, sub, badges, ms=650){
  const el = ensureCine();
  const t = el.querySelector('#jd-cine-title');
  const s = el.querySelector('#jd-cine-sub');
  const b = el.querySelector('#jd-cine-badges');
  if (t) t.textContent = String(title||'');
  if (s) s.textContent = String(sub||'');
  if (b){
    b.innerHTML = '';
    (badges||[]).slice(0,4).forEach(x=>{
      const span = document.createElement('span');
      span.className = 'jd-cine-badge';
      span.textContent = String(x);
      b.appendChild(span);
    });
  }
  el.classList.remove('jd-hidden');
  el.classList.add('on');
  setTimeout(()=>{
    el.classList.remove('on');
    setTimeout(()=> el.classList.add('jd-hidden'), 160);
  }, ms);
}
function flash(kind='boss'){
  const host = document.getElementById('jd-play-area') || document.body;
  host.classList.remove('fx-boss','fx-win','fx-phase');
  host.classList.add(kind==='win'?'fx-win':(kind==='phase'?'fx-phase':'fx-boss'));
  setTimeout(()=>host.classList.remove('fx-boss','fx-win','fx-phase'), 220);
}

/* -------------------------
   Actionbar smart show
------------------------- */
function isMobileView(){ return document.body.classList.contains('view-mobile'); }
function isCvrView(){ return document.body.classList.contains('view-cvr'); }
function shouldAssistNow(){
  if(!isMobileView()) return false;
  if(!state) return false;
  return !!(state.bossActive && state.bossPhase >= 3);
}
function actionbarShowFor(ms){
  if(!state) return;
  const force = (ms === -1); // teacher force
  if(!force && !shouldAssistNow()) return;
  const dur = force ? 9000 : (ms||2500);
  state.abUntilPerf = performance.now() + dur;
  document.body.classList.add('jd-ab-on');
}
function actionbarMaybeHide(){
  if(!isMobileView()) return;
  if(performance.now() > (state?.abUntilPerf||0)){
    document.body.classList.remove('jd-ab-on');
  }
}

/* -------------------------
   AI button highlight
------------------------- */
function aiHighlightBtn(need, strong=false){
  const isMobile = isMobileView();
  const isCvr = isCvrView();
  if(!isMobile && !isCvr) return;

  if(isMobile && !document.body.classList.contains('jd-ab-on')) return;

  // research/test: strong downgraded
  if(state && (state.mode==='research' || state.mode==='test') && strong) strong=false;

  const on = (need === 'jump') ? btnJump : btnDuck;
  if(!on) return;

  const cls = strong ? 'ai-hot' : 'ai-warn';
  on.classList.remove('ai-hot','ai-warn');
  void on.offsetWidth;
  on.classList.add(cls);
}

/* -------------------------
   Config (difficulty / phases)
------------------------- */
const CFG = {
  SPAWN_X: 100,
  CENTER_X: 24,
  MISS_X: 4,
  PHASE_THRESH: [0.33, 0.70],

  diffs: {
    easy:   { speed: 38, spawnMs: 1300, hitWinMs: 260, stabDmg: 10, stabGain: 3, score: 12 },
    normal: { speed: 48, spawnMs: 1000, hitWinMs: 220, stabDmg: 13, stabGain: 3, score: 14 },
    hard:   { speed: 62, spawnMs:  800, hitWinMs: 200, stabDmg: 16, stabGain: 4, score: 16 }
  },

  judgeWin: {
    easy:   { perfect: 80, great: 150 },
    normal: { perfect: 70, great: 130 },
    hard:   { perfect: 55, great: 110 }
  },

  fever: {
    threshold: 100,
    decayPerSec: 12,
    durationSec: 5.5,
    gainOnHit: { easy: 18, normal: 16, hard: 14 }
  },

  burst: {
    requirePerfectStreak: 3,
    scoreBonus: 360,
    bossDmgBonus: 18
  },

  overheat: {
    gainOnHit: 4,
    gainOnMiss: 10,
    gainOnWrong: 12,
    decayPerSec: 18,
    lockAt: 100,
    lockDurationMs: 900
  },

  boss: {
    hpMax: 100,
    dmgOnHit: 6,
    dmgOnPerfect: 9,
    burstEveryMs: 5200,
    tempoShiftEveryMs: 4200,
    shieldPhaseAtHp: 55,
    counterEveryMs: 6800,
    scoreBossCounter: 520
  },

  aiDir: {
    typeBiasCap: 0.22,
    rtSlowMs: 260,
    rtVerySlowMs: 320,
    tipEveryMs: 6500
  }
};

/* -------------------------
   Boss pack (9 patterns, Mixed+)
------------------------- */
const JD_BOSS_PACK = {
  p1_intro: { id:'p1_intro', label:'Intro', phase:1, tempoMul:1.00, seq:['J','D','J','D','J','D'] },
  p1_gateDance: { id:'p1_gateDance', label:'Gate Dance', phase:1, tempoMul:1.10, seq:['J','R','J','D','R','D','J','D','R','J'] },

  p2_altRush: { id:'p2_altRush', label:'Alt Rush', phase:2, tempoMul:1.22, seq:['J','D','J','D','J','D','X','J','D'] },
  p2_feintBurst:{ id:'p2_feintBurst', label:'Feint Burst', phase:2, tempoMul:1.30, seq:['F','J','D','F','D','J','X','J','D'] },
  p2_tripleStairs:{ id:'p2_tripleStairs', label:'Triple Stairs', phase:2, tempoMul:1.22, seq:['J','J','J','D','D','J','D','D','X','J','D'] },

  p3_shieldStorm:{ id:'p3_shieldStorm', label:'Shield Storm', phase:3, tempoMul:1.40, seq:['S','J','D','J','D','X','J','D','J'] },
  p3_mixedFinale:{ id:'p3_mixedFinale', label:'Mixed Finale', phase:3, tempoMul:1.48, seq:['J','D','X','J','D','X','J','D','J','D'] },
  p3_finalCross:{ id:'p3_finalCross', label:'Final Cross', phase:3, tempoMul:1.45, seq:['J','D','J','X','D','J','D','X','J','D','J','D'] },
  p3_counterWall:{ id:'p3_counterWall', label:'Counter Wall', phase:3, tempoMul:1.35, seq:['C','J','D','C','D','J','X','C','J','D'] },
};

function bossPoolForPhase(phase){
  return Object.values(JD_BOSS_PACK).filter(p=>p.phase===phase);
}

/* -------------------------
   Game state
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;

let lastAction = null; // {type:'jump'|'duck', time:number}
let nextObstacleId = 1;

/* -------------------------
   logging: local + optional post (?log=)
------------------------- */
async function postBatch(kind, rows){
  const url = HHA.logUrl || '';
  if(!url) return { ok:false, skipped:true };
  try{
    const payload = { kind, rows: rows || [] };
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      keepalive: true
    });
    return { ok: !!res.ok, status: res.status };
  }catch(e){
    console.warn('log failed', e);
    return { ok:false, error:String(e && (e.message||e) || e) };
  }
}
function pushEvent(eventType, extra){
  if(!state) return;
  const row = Object.assign({
    timestampIso: nowIso(),
    projectTag: 'HeroHealth',
    runMode: state.mode,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    sessionId: state.sessionId,
    eventType,
    gameMode: state.mode,
    diff: state.diffKey,
    timeFromStartMs: Math.round(state.elapsedMs||0),
    totalScore: Math.round(state.score||0),
    combo: state.combo||0,
    feverState: state.feverActive ? 1 : 0,
    feverValue: +state.fever.toFixed(1),
    extra: '',
    studentKey: state.ctx.pid || state.participant?.id || '',
    schoolCode: '',
    classRoom: '',
    studentNo: '',
    nickName: ''
  }, extra||{});
  state.events.push(row);
}
function buildSessionRow(reason){
  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  return {
    timestampIso: nowIso(),
    projectTag: 'HeroHealth',
    runMode: state.mode,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    sessionId: state.sessionId,

    gameMode: state.mode,
    diff: state.diffKey,
    durationPlannedSec: (state.durationMs||0)/1000,
    durationPlayedSec: +((state.elapsedMs||0)/1000).toFixed(2),

    scoreFinal: Math.round(state.score||0),
    comboMax: state.maxCombo||0,
    misses: state.miss||0,

    accuracyGoodPct: +(acc*100).toFixed(2),
    avgRtGoodMs: rtMean ? +rtMean.toFixed(1) : 0,

    device: detectView(),
    gameVersion: 'JD-v20260302a',
    reason: reason || '',
    startTimeIso: state.startIso || '',
    endTimeIso: nowIso(),

    studentKey: state.ctx.pid || state.participant?.id || '',
    noteResearcher: state.participant?.note || '',
    __extraJson: JSON.stringify({
      bossHpEnd: +(state.bossHp||0).toFixed(1),
      bossCleared: (reason==='boss-down'||reason==='boss-clear') ? 1 : 0,
      overheatPeak: +(state.overheatPeak||0).toFixed(1),
      burstCount: state.burstCount||0
    })
  };
}

/* -------------------------
   Phase helpers
------------------------- */
function getPhase(progress){
  if (progress < CFG.PHASE_THRESH[0]) return 1;
  if (progress < CFG.PHASE_THRESH[1]) return 2;
  return 3;
}
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

/* -------------------------
   Fever / Overheat / Boss support
------------------------- */
function updateFever(dtSec){
  if (!state) return;

  if (state.feverActive){
    state.feverRemain -= dtSec;
    if (state.feverRemain <= 0){
      state.feverActive = false;
      state.feverRemain = 0;
      showJudge('FEVER จบแล้ว ลองสะสมใหม่!', 'ok');
      pushEvent('fever_end', {});
    }
  }else{
    state.fever = Math.max(0, state.fever - CFG.fever.decayPerSec * dtSec);
  }

  const ratio = Math.min(1, (state.fever||0)/100);
  if (elFeverFill) elFeverFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
  if (elFeverStat){
    if (state.feverActive){
      elFeverStat.textContent = 'FEVER!';
      elFeverStat.classList.add('on');
    }else{
      elFeverStat.textContent = 'Ready';
      elFeverStat.classList.remove('on');
    }
  }
}

function feverGainOnHit(){
  const g = CFG.fever.gainOnHit[state.diffKey] ?? 16;
  state.fever = Math.min(100, state.fever + g);
  if (!state.feverActive && state.fever >= CFG.fever.threshold){
    state.feverActive = true;
    state.feverRemain = CFG.fever.durationSec;
    state.fever = 100;
    playSfx(sfx.fever, 0.9);
    showJudge('🔥 FEVER! คะแนนคูณ!', 'combo');
    pushEvent('fever_start', {});
  }
}

function overheatDecay(dtSec){
  if(!state) return;
  if(state.bossPhase < 3 || !state.bossActive){
    state.overheat = clamp(state.overheat - CFG.overheat.decayPerSec*dtSec*1.2, 0, 100);
    return;
  }
  state.overheat = clamp(state.overheat - CFG.overheat.decayPerSec*dtSec, 0, 100);
}
function overheatAdd(v){
  if(!state) return;
  if(state.bossPhase < 3 || !state.bossActive) return;
  state.overheat = clamp(state.overheat + (Number(v)||0), 0, 100);
  state.overheatPeak = Math.max(state.overheatPeak, state.overheat);

  if(state.overheat >= CFG.overheat.lockAt && performance.now() > state.overheatLockUntilPerf){
    state.overheat = 0;
    state.overheatLockUntilPerf = performance.now() + CFG.overheat.lockDurationMs;

    telegraph('OVERHEAT — COOL DOWN', 720);
    showJudge('⛔ OVERHEAT! พัก 1 จังหวะ', 'miss');
    bossTimeline('overheat_lock', { ms: CFG.overheat.lockDurationMs });
    pushEvent('boss_overheat_lock', { itemType:'boss', isGood:1, extra: String(CFG.overheat.lockDurationMs) });
  }
}

/* -------------------------
   Telegraph
------------------------- */
function telegraph(text, ms=620){
  if(!elTele) return;
  const inner = elTele.querySelector('.jd-tele-inner');
  if(inner && text) inner.textContent = String(text);
  elTele.classList.remove('jd-hidden');
  elTele.classList.add('on');
  setTimeout(()=>{
    elTele.classList.remove('on');
    setTimeout(()=> elTele.classList.add('jd-hidden'), 140);
  }, ms);
}

/* -------------------------
   Boss timeline (download)
------------------------- */
function bossTimeline(type, extra){
  if(!state) return;
  state.bossTimeline.push(Object.assign({
    t_ms: Math.round(state.elapsedMs||0),
    type,
    boss_phase: state.bossPhase||0,
    boss_hp: +(state.bossHp||0).toFixed(1),
    fever: +(state.fever||0).toFixed(1),
    overheat: +(state.overheat||0).toFixed(1),
    combo: state.combo||0,
    score: Math.round(state.score||0)
  }, extra||{}));
}

/* -------------------------
   Boss core
------------------------- */
function bossEnter(ts){
  state.bossActive = true;
  state.bossHp = CFG.boss.hpMax;
  state.bossPhase = 1;
  state.bossNextBurstAt = ts + 1200;
  state.bossNextTempoAt = ts + 1400;
  state.bossNextCounterAt = ts + 2200;
  state.bossShieldOn = false;
  state.bossShieldNeed = 0;
  state.bossShieldStreak = 0;

  bossBarWrap && bossBarWrap.classList.remove('jd-hidden');
  bossStatus && (bossStatus.textContent = 'BOSS!');
  bossStatus && bossStatus.classList.add('on');
  playSfx(sfx.boss, 0.9);

  pushEvent('boss_enter', { itemType:'boss' });
  bossTimeline('boss_enter', {});
  cineShow('⚡ BOSS (MIXED+)', 'Phase 1: จับจังหวะให้ได้!', ['TEMPO','FEINT','OVERDRIVE'], 850);
  flash('boss');

  showJudge('⚡ BOSS PHASE! เตรียมสลับ JUMP/DUCK!', 'combo');
  telegraph('BOSS!', 700);
}

function bossDamage(dmg, why){
  dmg = Number(dmg)||0;
  if(!state.bossActive) return;
  state.bossHp = Math.max(0, state.bossHp - dmg);
  bossTimeline('boss_dmg', { dmg, why });

  if(state.bossHp <= 0){
    state.bossHp = 0;
    state.bossActive = false;
    pushEvent('boss_down', {});
    bossTimeline('boss_down', {});
    cineShow('🏆 BOSS DOWN!', 'สุดยอด! เก็บคะแนนรัว ๆ', ['WIN','FEVER','BURST'], 1000);
    flash('win');
    endGame('boss-down');
  }
}

function bossUpdate(ts){
  if(!state) return;
  if(state.phase !== 3){
    // not boss
    setText('hud-boss', '—');
    if(bossBarWrap) bossBarWrap.classList.add('jd-hidden');
    return;
  }

  if(!state.bossActive && !state.bossFinished){
    bossEnter(ts);
  }

  // boss HUD
  setText('hud-boss', `${Math.max(0, Math.round(state.bossHp))}%`);
  if(bossFill) bossFill.style.transform = `scaleX(${Math.max(0, state.bossHp/CFG.boss.hpMax).toFixed(3)})`;
  if(bossStatus){
    const shieldTxt = state.bossShieldOn ? `SHIELD ${state.bossShieldStreak}/${state.bossShieldNeed}` : (state.feverActive?'FEVER!':'BOSS!');
    bossStatus.textContent = shieldTxt;
    bossStatus.classList.add('on');
  }

  // tempo shift
  if(ts >= state.bossNextTempoAt){
    state.bossNextTempoAt = ts + CFG.boss.tempoShiftEveryMs + (RNG()*450 - 200);
    telegraph('TEMPO SHIFT', 600);
    bossTimeline('tempo_shift', {});
  }

  // shield start (auto in phase3 once)
  if(state.bossPhase === 3 && !state.bossShieldOn){
    state.bossShieldOn = true;
    state.bossShieldNeed = (state.diffKey==='hard') ? 8 : (state.diffKey==='easy' ? 5 : 6);
    state.bossShieldStreak = 0;
    telegraph(`SHIELD x${state.bossShieldNeed}`, 520);
    showJudge(`🛡️ SHIELD! ถูกติดกัน ${state.bossShieldNeed} ครั้ง`, 'combo');
    bossTimeline('shield_start', { need: state.bossShieldNeed });
  }

  // burst chain
  if(ts >= state.bossNextBurstAt){
    state.bossNextBurstAt = ts + CFG.boss.burstEveryMs + (RNG()*600 - 240);
    bossBurst();
  }

  // counter window
  if(ts >= state.bossNextCounterAt){
    state.bossNextCounterAt = ts + CFG.boss.counterEveryMs + (RNG()*600 - 240);
    bossCounterOpen();
  }

  // phase update by HP
  const prev = state.bossPhase;
  if(state.bossHp > 66) state.bossPhase = 1;
  else if(state.bossHp > 33) state.bossPhase = 2;
  else state.bossPhase = 3;

  if(prev !== state.bossPhase){
    cineShow(`🔥 PHASE ${state.bossPhase}`, state.bossPhase===2?'Tempo Shift + Double':'Shield + Burst + Overheat', [state.bossPhase===2?'SHIFT':'SHIELD','BURST'], 720);
    flash('phase');
    bossTimeline('phase_up', { from: prev, to: state.bossPhase });
  }
}

function pickBossPattern(){
  const pool = bossPoolForPhase(state.bossPhase);
  if(!pool.length) return null;

  // fixed by query ?boss=<patternId>
  const fixed = pool.find(p=>p.id === HHA.bossMode);
  if(fixed) return fixed;

  // Training: AI director can pick
  if(state.mode === 'training'){
    const aiPick = aiDirPickBossPattern(pool);
    if(aiPick){
      if(state.lastBossPatternId && pool.length>1 && aiPick.id === state.lastBossPatternId){
        // fallthrough
      }else{
        state.lastBossPatternId = aiPick.id;
        return aiPick;
      }
    }
  }

  // weighted mixed+
  const weights = pool.map(p=>{
    if (state.bossPhase === 3){
      if (p.id === 'p3_mixedFinale') return 1.45;
      if (p.id === 'p3_shieldStorm') return 1.35;
      if (p.id === 'p3_finalCross')  return 1.55;
      return 1.00;
    }
    if (state.bossPhase === 2){
      if (p.id === 'p2_feintBurst')   return 1.20;
      if (p.id === 'p2_tripleStairs') return 1.30;
      return 1.00;
    }
    if (p.id === 'p1_gateDance') return 1.15;
    return 1.00;
  });

  let sum = weights.reduce((a,b)=>a+b,0);
  let r = RNG() * sum;
  let picked = pool[0];
  for(let i=0;i<pool.length;i++){
    r -= weights[i];
    if(r <= 0){ picked = pool[i]; break; }
  }
  if(state.lastBossPatternId && pool.length>1 && picked.id === state.lastBossPatternId){
    picked = pool[(pool.indexOf(picked)+1)%pool.length];
  }
  state.lastBossPatternId = picked.id;
  return picked;
}

function bossBurst(){
  const p = pickBossPattern();
  if(!p) return;

  bossTimeline('boss_burst', { pattern: p.id, label: p.label });

  telegraph(`BURST: ${p.label}`, 650);
  showJudge('⚡ BURST!', 'combo');
  playSfx(sfx.combo, 0.55);

  // schedule sequence
  const baseDelay = Math.max(90, Math.round(140 / (p.tempoMul||1)));
  p.seq.forEach((token, i)=>{
    setTimeout(()=>{
      if(!running || !state) return;
      if(token === 'J') makeObstacle('low', performance.now(), true);
      else if(token === 'D') makeObstacle('high', performance.now(), true);
      else if(token === 'X'){
        // double: spawn 2 close
        makeObstacle(RNG()<0.5?'low':'high', performance.now(), true);
        setTimeout(()=>{ if(running && state) makeObstacle(RNG()<0.5?'low':'high', performance.now(), true); }, 90);
      }else if(token === 'F'){
        // feint obstacle: looks special
        makeObstacle(RNG()<0.5?'low':'high', performance.now(), true, { feint:true });
      }else if(token === 'S'){
        // shield prompt (just telegraph)
        telegraph('SHIELD!', 520);
      }else if(token === 'C'){
        // counter prompt
        bossCounterOpen();
      }else if(token === 'R'){
        // reveal (tag highlight)
        telegraph('REVEAL', 360);
      }
    }, baseDelay*i);
  });
}

function bossCounterOpen(){
  if(state.bossCounterOpen) return;
  state.bossCounterOpen = true;
  state.bossCounterNeed = (RNG()<0.5) ? 'jump' : 'duck';
  state.bossCounterUntil = performance.now() + 900;

  telegraph(`COUNTER: ${state.bossCounterNeed.toUpperCase()}`, 720);
  showJudge(`⚡ COUNTER: ${state.bossCounterNeed.toUpperCase()}!`, 'combo');
  playSfx(sfx.combo, 0.45);
  bossTimeline('counter_open', { need: state.bossCounterNeed });
}

function bossCounterResolve(action){
  if(!state.bossCounterOpen) return;
  const ok = (action === state.bossCounterNeed) && (performance.now() <= state.bossCounterUntil);
  state.bossCounterOpen = false;

  if(ok){
    const mult = state.feverActive ? 1.35 : 1.0;
    const gain = Math.round(CFG.boss.scoreBossCounter * mult);
    state.score += gain;
    bossDamage(state.diffKey==='hard' ? 24 : 20, 'counter_success');

    telegraph('COUNTER SUCCESS!', 620);
    showJudge('⚡ COUNTER SUCCESS!', 'combo');
    bossTimeline('counter_success', { gain });
    pushEvent('boss_counter_success', { isGood:1, rtMs:'', extra:String(gain) });
  }else{
    telegraph('COUNTER FAIL', 520);
    showJudge('COUNTER FAIL', 'miss');
    bossTimeline('counter_fail', {});
    pushEvent('boss_counter_fail', { isGood:0 });
  }
}

/* -------------------------
   AI Director (pattern + type pick + HUD)
------------------------- */
function aiDirInit(){
  state.aiDir = {
    n: 0,
    missJump: 0, missDuck: 0,
    hitJump: 0, hitDuck: 0,
    switchCount: 0,
    rtMean: 220,
    rtSd: 40,
    lastNeed: null,

    fatigueRisk: 0,
    skillScore: 0.5,
    suggested: 'normal',
  };
}

function aiDirOnOutcome(need, ok, rtMs){
  const d = state.aiDir;
  d.n++;

  if(d.lastNeed && d.lastNeed !== need) d.switchCount++;
  d.lastNeed = need;

  if(ok){
    if(need==='jump') d.hitJump++; else d.hitDuck++;
  }else{
    if(need==='jump') d.missJump++; else d.missDuck++;
  }

  if(Number.isFinite(rtMs)){
    d.rtMean = 0.88*d.rtMean + 0.12*rtMs;
    const err = rtMs - d.rtMean;
    d.rtSd = 0.90*d.rtSd + 0.10*Math.abs(err);
  }

  const miss = d.missJump + d.missDuck;
  const hit  = d.hitJump + d.hitDuck;
  const acc  = (hit+miss) ? hit/(hit+miss) : 1;

  let fr = 0;
  fr += (d.rtMean > CFG.aiDir.rtSlowMs) ? 0.18 : 0;
  fr += (d.rtMean > CFG.aiDir.rtVerySlowMs) ? 0.18 : 0;
  fr += Math.min(0.25, d.rtSd/200);
  fr += Math.min(0.25, miss/(hit+miss+1));
  d.fatigueRisk = clamp(fr, 0, 1);

  const speedScore = clamp(1 - (d.rtMean-160)/220, 0, 1);
  d.skillScore = clamp(0.68*acc + 0.32*speedScore, 0, 1);

  d.suggested = (d.skillScore >= 0.82) ? 'hard'
              : (d.skillScore >= 0.55) ? 'normal'
              : 'easy';
}

function aiUpdateHudSafe(){
  if(!state || !state.aiDir) return;
  const d = state.aiDir;

  setText('hud-ai-fatigue', `${Math.round((d.fatigueRisk||0)*100)}%`);
  setText('hud-ai-skill', `${Math.round((d.skillScore||0)*100)}%`);

  const locked = (state.mode === 'research' || state.mode === 'test');
  setText('hud-ai-suggest', locked ? `${d.suggested} (lock)` : d.suggested);

  const tipEl = getEl('hud-ai-tip');
  if(tipEl){
    const now = performance.now();
    if(!state._aiTipNext) state._aiTipNext = 0;
    if(now >= state._aiTipNext){
      state._aiTipNext = now + CFG.aiDir.tipEveryMs;
      tipEl.textContent =
        (d.fatigueRisk > 0.7) ? 'พักลมหายใจ 1 จังหวะ แล้วกดให้ “ก่อนถึงเส้น” ✨' :
        (d.rtMean > 280) ? 'ลองกดเร็วขึ้นนิดเดียว จะได้ PERFECT ง่ายขึ้น 🔥' :
        (d.switchCount > 6) ? 'ช่วงสลับ J↔D เตรียมท่าล่วงหน้า 🧠' :
        '';
    }
  }
}

function aiDirPickNextType(baseRand){
  let r = baseRand;

  if(state.mode !== 'training'){
    return (r >= 0.5) ? 'high' : 'low';
  }

  const d = state.aiDir;
  const mj = d.missJump, md = d.missDuck;
  const total = mj + md + 1;
  const needJumpMore = (mj - md) / total; // + => jump is weaker
  let bias = clamp(needJumpMore * 0.18, -CFG.aiDir.typeBiasCap, CFG.aiDir.typeBiasCap);

  if(d.fatigueRisk > 0.65 && d.lastNeed){
    bias += (d.lastNeed === 'jump') ? -0.06 : 0.06;
  }

  r = clamp01(r - bias);
  return (r >= 0.5) ? 'high' : 'low';
}

function aiDirPickBossPattern(pool){
  if(state.mode !== 'training') return null;
  const d = state.aiDir;
  const switchRate = d.n ? d.switchCount / Math.max(1, d.n-1) : 0;

  let prefer = 'mixed';
  if(d.rtMean < 220 && d.fatigueRisk < 0.45) prefer = 'fast';
  if(switchRate > 0.32 || d.rtSd > 55) prefer = 'switch';

  const score = (p)=>{
    let s = 1.0;

    if(prefer==='fast'){
      s += (p.tempoMul||1.0) > 1.3 ? 0.55 : 0.15;
      if(d.fatigueRisk > 0.6) s -= 0.35;
    }
    if(prefer==='switch'){
      const seq = (p.seq||[]).join('');
      const alt = (seq.match(/JD|DJ/g)||[]).length;
      s += (alt <= 3) ? 0.50 : -0.10;
      if(d.rtMean > 280) s += 0.20;
    }
    if(prefer==='mixed'){
      if(state.bossPhase===3 && /final|storm|cross/i.test(p.id)) s += 0.35;
    }
    s += (RNG()*0.10);
    return s;
  };

  let best = pool[0];
  let bestS = -999;
  for(const p of pool){
    const s = score(p);
    if(s > bestS){ bestS = s; best = p; }
  }
  return best;
}

/* -------------------------
   Obstacles
------------------------- */
function makeObstacle(type, ts, isBoss=false, opt={}){
  if(!state || !elObsHost) return;
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);

  if(opt.feint) el.classList.add('jd-feint');

  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    need,
    x: CFG.SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,
    isBoss: !!isBoss,
    warned:false
  });

  state.obstaclesSpawned++;
  playSfx(sfx.beep, 0.45);
}

function spawnObstacle(ts){
  if(!state || !elObsHost) return;

  // spacing guard
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  const r = RNG();
  const type = aiDirPickNextType(r); // 'high'/'low'

  // boss phase3: rare pair (training only)
  const spawnPair = (state.phase === 3 && state.mode === 'training' && RNG() < 0.10);
  makeObstacle(type, ts, false);

  if (spawnPair){
    setTimeout(()=> { if (running && state) makeObstacle(RNG()<0.5?'high':'low', performance.now(), false); }, 140);
  }
}

function updateObstacles(dtMs, now){
  const cfg = state.cfg0;
  let speed = cfg.speed;

  // training accelerate by phase
  if (state.mode === 'training'){
    if (state.phase === 2) speed *= 1.12;
    if (state.phase === 3) speed *= 1.26;
    speed *= (1 + 0.18*state.progress);
  }

  // boss wobble
  if (state.phase === 3 && state.bossActive){
    const wob = 1 + 0.06*Math.sin((now - state.startTime)/420);
    speed *= wob;
  }

  const move = speed * (dtMs/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // soft warn highlight as it approaches center
    if (!obs.warned && obs.x <= CFG.CENTER_X + 18){
      obs.warned = true;
      aiHighlightBtn(obs.need, false);
    }

    // HIT window
    if (!obs.resolved && obs.x <= CFG.CENTER_X + 6 && obs.x >= CFG.CENTER_X - 6){
      aiHighlightBtn(obs.need, true);

      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);
        const w = CFG.judgeWin[state.diffKey] || CFG.judgeWin.normal;
        const perfect = rt <= w.perfect;
        const great   = rt <= w.great;

        if (a.type === obs.need && rt <= cfg.hitWinMs){
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          // score
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (state.phase === 3) ? 1.18 : (state.phase === 2 ? 1.08 : 1.0);
          const feverM = state.feverActive ? 1.35 : 1.0;
          const perfM  = perfect ? 1.15 : (great ? 1.05 : 1.0);
          const gain = Math.round(cfg.score * comboM * phaseM * feverM * perfM);
          state.score += gain;

          // boss damage
          if (state.phase === 3 && state.bossActive){
            let dmg = perfect ? CFG.boss.dmgOnPerfect : CFG.boss.dmgOnHit;
            dmg *= (state.feverActive ? 1.2 : 1.0);
            bossDamage(dmg, perfect ? 'perfect_hit' : 'hit');

            // shield streak
            if (state.bossShieldOn){
              state.bossShieldStreak++;
              if (state.bossShieldStreak >= state.bossShieldNeed){
                state.bossShieldOn = false;
                state.bossShieldNeed = 0;
                state.bossShieldStreak = 0;

                const bonus = Math.round(420 * (state.feverActive ? 1.2 : 1.0));
                state.score += bonus;
                bossDamage(26, 'shield_break');

                telegraph('SHIELD BREAK!', 560);
                showJudge('💥 SHIELD BREAK!', 'combo');
                bossTimeline('shield_break', { bonus });
                pushEvent('boss_shield_break', { isGood:1, extra: String(bonus) });
              }
            }
          }

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          feverGainOnHit();

          // Fever Burst Window
          if(perfect){
            state.perfectStreak = (state.perfectStreak||0) + 1;
          }else{
            state.perfectStreak = 0;
          }
          if(state.feverActive && state.perfectStreak >= CFG.burst.requirePerfectStreak){
            state.perfectStreak = 0;
            state.burstCount = (state.burstCount||0) + 1;

            const bonus = Math.round(CFG.burst.scoreBonus * (state.diffKey==='hard' ? 1.2 : 1.0));
            state.score += bonus;
            if(state.bossActive){
              bossDamage(CFG.burst.bossDmgBonus + (state.diffKey==='hard'?6:0), 'fever_burst');
            }
            telegraph('FEVER BURST!', 820);
            showJudge('🔥 FEVER BURST!!!', 'combo');
            playSfx(sfx.combo, 0.65);
            bossTimeline('fever_burst', { bonus, count: state.burstCount });
            pushEvent('fever_burst', { isGood:1, extra: JSON.stringify({ bonus, count: state.burstCount }) });
          }

          // overheat
          overheatAdd(CFG.overheat.gainOnHit * (state.feverActive ? 0.6 : 1.0));

          // AI director stats
          aiDirOnOutcome(obs.need, true, rt);
          aiUpdateHudSafe();

          // remove DOM
          obs.element && obs.element.remove();
          obs.element = null;

          playSfx(sfx.hit, 0.8);
          if (state.combo >= 8 || perfect) playSfx(sfx.combo, 0.55);

          const msg = perfect
            ? (obs.need === 'jump' ? 'PERFECT JUMP! ⚡' : 'PERFECT DUCK! ⚡')
            : (obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️');

          showJudge(msg, (state.combo>=8 || perfect) ? 'combo' : 'ok');

          pushEvent('hit', {
            rtMs: Math.round(rt),
            judgment: perfect ? 'perfect' : (great?'great':'good'),
            isGood: 1,
            itemType: obs.type,
            lane: obs.need
          });

          continue;
        } else if (rt <= cfg.hitWinMs && a.type !== obs.need){
          // WRONG ACTION
          obs.resolved = true;

          state.miss++;
          state.combo = 0;
          state.perfectStreak = 0;
          state.missStreak = (state.missStreak||0) + 1;

          if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;
          state.stability = Math.max(0, state.stability - cfg.stabDmg);
          state.minStability = Math.min(state.minStability, state.stability);

          // shield reset
          if (state.bossActive && state.bossShieldOn) state.bossShieldStreak = 0;

          // overheat
          overheatAdd(CFG.overheat.gainOnWrong);

          // AI stats
          aiDirOnOutcome(obs.need, false, rt);
          aiUpdateHudSafe();

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx(sfx.miss, 0.85);
          showJudge('ผิดท่า! 🌀', 'miss');
          elPlayArea?.classList.add('shake');
          setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

          pushEvent('miss', {
            rtMs: Math.round(rt),
            judgment: 'wrong',
            isGood: 0,
            itemType: obs.type,
            lane: obs.need,
            extra: 'wrong-action'
          });

          if(state.missStreak >= 2) actionbarShowFor(4200);

          continue;
        }
      }
    }

    // MISS timeout
    if (!obs.resolved && obs.x <= CFG.MISS_X){
      obs.resolved = true;

      state.miss++;
      state.combo = 0;
      state.perfectStreak = 0;

      state.missStreak = (state.missStreak||0) + 1;
      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - cfg.stabDmg);
      state.minStability = Math.min(state.minStability, state.stability);

      if (state.bossActive && state.bossShieldOn) state.bossShieldStreak = 0;

      overheatAdd(CFG.overheat.gainOnMiss);

      aiDirOnOutcome(obs.need, false, NaN);
      aiUpdateHudSafe();

      obs.element && obs.element.remove();
      obs.element = null;

      playSfx(sfx.miss, 0.85);
      showJudge('MISS ลองใหม่อีกที ✨', 'miss');
      elPlayArea?.classList.add('shake');
      setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

      pushEvent('miss', {
        rtMs: '',
        judgment: 'late',
        isGood: 0,
        itemType: obs.type,
        lane: obs.need,
        extra: 'late-no-action'
      });

      if(state.missStreak >= 2) actionbarShowFor(4200);

      if (state.stability <= 0){
        showJudge('หมดแรงทรงตัว! ⛔', 'miss');
        endGame('stability-zero');
        return;
      }

      continue;
    }

    if (obs.x > -20) keep.push(obs);
    else {
      obs.element && obs.element.remove();
      obs.element = null;
    }
  }

  state.obstacles = keep;

  // action decay
  if (lastAction && now - lastAction.time > 260) lastAction = null;
}

/* -------------------------
   Input
------------------------- */
function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  // boss counter resolve
  if(state.bossCounterOpen) bossCounterResolve(type);

  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=> elAvatar?.classList.remove(type), 180);
  }
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp' || ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown' || ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck'); }
}

function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  const y = ev.clientY;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

// VR UI shoot: use y to choose jump/duck
function onHhaShoot(ev){
  if (!running || !elPlayArea) return;
  const d = ev?.detail || {};
  const rect = elPlayArea.getBoundingClientRect();
  const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

/* -------------------------
   Gamepad (optional)
------------------------- */
let gpPrev = { up:false, down:false, a:false, b:false };
function pollGamepad(){
  if (!running) return;
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps && gps[0];
  if (!gp || !gp.buttons) return;

  const up   = !!gp.buttons[12]?.pressed;
  const down = !!gp.buttons[13]?.pressed;
  const a    = !!gp.buttons[0]?.pressed;
  const b    = !!gp.buttons[1]?.pressed;

  if (up && !gpPrev.up) triggerAction('jump');
  if (down && !gpPrev.down) triggerAction('duck');
  if (a && !gpPrev.a) triggerAction('jump');
  if (b && !gpPrev.b) triggerAction('duck');

  gpPrev = { up, down, a, b };
}

/* -------------------------
   ML export
------------------------- */
function mlWindowFeatures(){
  if(!state || !state.win) return {};
  const w = state.win;
  const n = w.rts.length || 0;
  if(!n) return { win_n:0 };

  const okRate = w.ok.reduce((a,b)=>a+(b?1:0),0) / n;

  const rts = w.rts.filter(v=>Number.isFinite(v) && v>0);
  const m = rts.length ? rts.reduce((a,b)=>a+b,0)/rts.length : 0;

  let sd = 0;
  if(rts.length >= 2){
    const v = rts.reduce((a,x)=>a + Math.pow(x-m,2), 0) / (rts.length-1);
    sd = Math.sqrt(v);
  }

  let sw = 0;
  for(let i=1;i<w.need.length;i++){
    if(w.need[i] && w.need[i-1] && w.need[i] !== w.need[i-1]) sw++;
  }
  const switchRate = (w.need.length>=2) ? (sw/(w.need.length-1)) : 0;

  return {
    win_n: n,
    win_ok_rate: +okRate.toFixed(4),
    win_rt_mean_ms: +m.toFixed(1),
    win_rt_sd_ms: +sd.toFixed(1),
    win_switch_rate: +switchRate.toFixed(4)
  };
}
function buildMlJson(){
  if(!state) return null;

  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;

  const rtMean = state.hitRTs && state.hitRTs.length
    ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length
    : 0;

  const labels = {
    acc_pct: +(acc*100).toFixed(2),
    score_final: Math.round(state.score||0),
    max_combo: state.maxCombo||0,
    miss_total: state.miss||0,
    stability_min: +(state.minStability||0).toFixed(1),
    boss_cleared: (state._endReason === 'boss-down' || state._endReason === 'boss-clear') ? 1 : 0,
    end_reason: state._endReason || '',
  };

  let rank='C';
  const stab = state.minStability ?? 0;
  if (acc >= 0.90 && stab >= 85) rank='S';
  else if (acc >= 0.80 && stab >= 75) rank='A';
  else if (acc >= 0.65 && stab >= 60) rank='B';
  else if (acc < 0.40 || stab < 40)   rank='D';
  labels.rank = rank;

  const ctx = state.ctx || {};
  const meta = {
    session_id: state.sessionId,
    created_at_iso: nowIso(),
    mode: state.mode,
    diff: state.diffKey,
    duration_planned_s: (state.durationMs||0)/1000,
    duration_actual_s: +((state.elapsedMs||0)/1000).toFixed(2),
    seed: ctx.seed || '',
    pid: ctx.pid || (state.participant?.id||''),
    studyId: ctx.studyId || '',
    phase: ctx.phase || '',
    conditionGroup: ctx.conditionGroup || '',
    view: ctx.view || '',
    boss_mode: HHA.bossMode
  };

  const ai = state.aiDir ? {
    fatigueRisk: +(state.aiDir.fatigueRisk||0).toFixed(4),
    skillScore: +(state.aiDir.skillScore||0).toFixed(4),
    suggested: state.aiDir.suggested||'normal',
    rtMean: +(state.aiDir.rtMean||0).toFixed(1),
    rtSd: +(state.aiDir.rtSd||0).toFixed(1),
    switchCount: state.aiDir.switchCount||0
  } : {};

  return {
    schema: 'herohealth.jumpduck.ml.v1',
    meta,
    features: Object.assign({}, mlWindowFeatures(), ai, {
      rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
      overheat_peak: +(state.overheatPeak||0).toFixed(1),
      burst_count: state.burstCount||0
    }),
    labels,
    events: Array.isArray(state.events) ? state.events : []
  };
}

/* -------------------------
   Start/End
------------------------- */
function startGameBase(opts){
  const mode = opts.mode || 'training';
  const diffKey = opts.diffKey || 'normal';
  const cfg0 = CFG.diffs[diffKey] || CFG.diffs.normal;
  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;

  // reseed each run
  RNG = mulberry32(getSeed());

  const now = performance.now();
  state = {
    sessionId: makeSessionId(),
    mode,
    diffKey,
    cfg0,
    durationMs,
    isTutorial,

    startTime: now,
    startIso: nowIso(),
    elapsedMs: 0,
    remainingMs: durationMs,
    progress: 0,
    phase: 1,

    stability: 100,
    minStability: 100,

    nextSpawnAt: now + 650,
    obstacles: [],
    obstaclesSpawned: 0,

    hits: 0,
    miss: 0,
    jumpHit:0, duckHit:0,
    jumpMiss:0, duckMiss:0,

    combo: 0,
    maxCombo: 0,
    score: 0,
    hitRTs: [],

    missStreak: 0,
    abUntilPerf: 0,

    // fever
    fever: 0,
    feverActive: false,
    feverRemain: 0,
    perfectStreak: 0,
    burstCount: 0,

    // overheat
    overheat: 0,
    overheatLockUntilPerf: 0,
    overheatPeak: 0,

    // boss
    bossHp: CFG.boss.hpMax,
    bossActive: false,
    bossFinished: false,
    bossPhase: 1,
    bossNextBurstAt: now + 5200,
    bossNextTempoAt: now + 4200,
    bossNextCounterAt: now + 6800,
    bossShieldOn: false,
    bossShieldNeed: 0,
    bossShieldStreak: 0,
    bossCounterOpen: false,
    bossCounterNeed: '',
    bossCounterUntil: 0,
    lastBossPatternId: '',
    bossTimeline: [],

    participant: collectParticipant(mode),

    ctx: { ...HHA },

    events: [],
    sessions: [],

    win: { size: 10, rts: [], ok: [], need: [], action: [], timeMs: [] },

    _endReason: ''
  };

  aiDirInit();

  running = true;
  lastFrame = now;
  nextObstacleId = 1;
  lastAction = null;

  // UI reset
  elObsHost && (elObsHost.innerHTML = '');
  elAvatar && elAvatar.classList.remove('jump','duck');
  if(elTele){ elTele.classList.add('jd-hidden'); elTele.classList.remove('on'); }
  bossBarWrap && bossBarWrap.classList.add('jd-hidden');
  document.body.classList.remove('jd-ab-on');

  // HUD init
  setText('hud-mode', modeLabel(mode));
  setText('hud-diff', diffKey);
  setText('hud-duration', (durationMs/1000|0)+'s');
  setText('hud-stability', '100%');
  setText('hud-obstacles', '0 / 0');
  setText('hud-score', '0');
  setText('hud-combo', '0');
  setText('hud-time', (durationMs/1000).toFixed(1));
  setText('hud-phase', '1');
  setText('hud-boss', '—');

  if (elProgFill) elProgFill.style.transform = 'scaleX(0)';
  if (elProgText) elProgText.textContent = '0%';
  if (elFeverFill) elFeverFill.style.transform = 'scaleX(0)';
  if (elFeverStat){ elFeverStat.textContent = 'Ready'; elFeverStat.classList.remove('on'); }
  if (bossFill) bossFill.style.transform = 'scaleX(1)';
  if (bossStatus){ bossStatus.textContent='—'; bossStatus.classList.remove('on'); }

  pushEvent('start', {});
  bossTimeline('start', {});

  showView('play');
  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showJudge(isTutorial ? 'Tutorial: Low=JUMP 🦘 · High=DUCK 🛡️' : 'READY ✨', 'ok');
}

function startGameFromMenu(){
  const mode = (elMode?.value || HHA.mode || 'training').toLowerCase();
  const diff = (elDiff?.value || HHA.diff || 'normal').toLowerCase();
  const durS = parseInt((elDuration?.value || HHA.duration || '60'),10) || 60;
  startGameBase({ mode, diffKey: diff, durationMs: durS*1000, isTutorial:false });
}
function startTutorial(){
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

async function endGame(reason='end'){
  if(!state) return;

  state._endReason = reason || 'end';
  running = false;

  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  // session row
  const ses = buildSessionRow(reason);
  state.sessions.push(ses);

  // optional post
  if(HHA.logUrl){
    await postBatch('events', state.events);
    await postBatch('sessions', state.sessions.slice(-1));
  }

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  // result
  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  resMode && (resMode.textContent = modeLabel(state.mode));
  resDiff && (resDiff.textContent = state.diffKey);
  resDuration && (resDuration.textContent = (state.durationMs/1000|0)+'s');
  resTotalObs && (resTotalObs.textContent = String(total));
  resHits && (resHits.textContent = String(state.hits));
  resMiss && (resMiss.textContent = String(state.miss));
  resJumpHit && (resJumpHit.textContent = String(state.jumpHit));
  resDuckHit && (resDuckHit.textContent = String(state.duckHit));
  resJumpMiss&& (resJumpMiss.textContent= String(state.jumpMiss));
  resDuckMiss&& (resDuckMiss.textContent= String(state.duckMiss));
  resAcc && (resAcc.textContent = (acc*100).toFixed(1)+' %');
  resRTMean && (resRTMean.textContent = rtMean ? rtMean.toFixed(0)+' ms' : '-');
  resStabilityMin && (resStabilityMin.textContent = state.minStability.toFixed(1)+' %');
  resScore && (resScore.textContent = String(Math.round(state.score)));

  if (resRank){
    let rank = 'C';
    const stab = state.minStability;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }

  showView('result');
}

/* -------------------------
   Loop
------------------------- */
function loop(ts){
  if (!running || !state) return;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);
  state.progress = Math.min(1, state.elapsedMs / state.durationMs);
  state.phase = getPhase(state.progress);

  // HUD basic
  setText('hud-time', (state.remainingMs/1000).toFixed(1));
  setText('hud-phase', String(state.phase));

  if (state.elapsedMs >= state.durationMs){
    endGame('timeup');
    return;
  }

  // progress bar
  if (elProgFill) elProgFill.style.transform = `scaleX(${state.progress.toFixed(3)})`;
  if (elProgText) elProgText.textContent = Math.round(state.progress*100) + '%';

  // fever/overheat
  updateFever(dt/1000);
  overheatDecay(dt/1000);

  // boss update (phase3)
  bossUpdate(ts);

  // overheat lock: stop spawning new but keep moving
  if(state.bossActive && state.bossPhase >= 3 && performance.now() < state.overheatLockUntilPerf){
    updateObstacles(dt, ts);
    pollGamepad();
    actionbarMaybeHide();
    updateHudTail();
    rafId = requestAnimationFrame(loop);
    return;
  }

  // spawn schedule
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts);

    let interval = state.cfg0.spawnMs;
    if (state.mode === 'training'){
      const factor = 1 - 0.30*state.progress;
      interval = interval * Math.max(0.58, factor);
      // slight assist when miss streak high
      if(state.missStreak >= 2) interval *= 1.10;
    }
    state.nextSpawnAt += interval;
  }

  // move
  updateObstacles(dt, ts);

  pollGamepad();
  actionbarMaybeHide();
  updateHudTail();

  rafId = requestAnimationFrame(loop);
}

function updateHudTail(){
  setText('hud-stability', state.stability.toFixed(1)+'%');
  setText('hud-obstacles', `${state.hits} / ${state.obstaclesSpawned}`);
  setText('hud-score', String(Math.round(state.score)));
  setText('hud-combo', String(state.combo));
  aiUpdateHudSafe();
}

/* -------------------------
   Init + Buttons
------------------------- */
async function initJD(){
  setHubLinks();

  // prefill
  if (HHA.mode && elMode) elMode.value = HHA.mode;
  if (HHA.diff && elDiff) elDiff.value = HHA.diff;
  if (HHA.duration && elDuration) elDuration.value = String(HHA.duration);

  if (elPid && HHA.pid) elPid.value = HHA.pid;
  if (elGroup && HHA.group) elGroup.value = HHA.group;
  if (elNote && HHA.note) elNote.value = HHA.note;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame('stop-early'));
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  // actionbar buttons (teacher force show)
  $('[data-action="jump"]')?.addEventListener('click', ()=>{ triggerAction('jump'); actionbarShowFor(-1); });
  $('[data-action="duck"]')?.addEventListener('click', ()=>{ triggerAction('duck'); actionbarShowFor(-1); });

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  // downloads
  $('[data-action="download-events-csv"]')?.addEventListener('click', ()=>{
    if(!state) return;
    dlText(`jd-events-${state.sessionId}.csv`, toCsv(state.events), 'text/csv;charset=utf-8');
    showJudge('ดาวน์โหลด Events CSV แล้ว ✅', 'ok');
  });
  $('[data-action="download-sessions-csv"]')?.addEventListener('click', ()=>{
    if(!state) return;
    dlText(`jd-sessions-${state.sessionId}.csv`, toCsv(state.sessions), 'text/csv;charset=utf-8');
    showJudge('ดาวน์โหลด Sessions CSV แล้ว ✅', 'ok');
  });
  $('[data-action="download-boss-timeline"]')?.addEventListener('click', ()=>{
    if(!state) return;
    dlText(`jd-boss-${state.sessionId}.json`, JSON.stringify(state.bossTimeline, null, 2));
    showJudge('ดาวน์โหลด Boss Timeline แล้ว ✅', 'ok');
  });
  $('[data-action="download-ml-json"]')?.addEventListener('click', ()=>{
    const obj = buildMlJson();
    if(!obj){ showJudge('ยังไม่มีข้อมูล', 'miss'); return; }
    dlText(`jd-ml-${state.sessionId}.json`, JSON.stringify(obj, null, 2));
    showJudge('ดาวน์โหลด ML JSON แล้ว ✅', 'ok');
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', initJD);