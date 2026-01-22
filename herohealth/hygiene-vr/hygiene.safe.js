// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR — Handwash Story/Survival (PROD-ish v1.2 PACK 12)
// ✅ PACK12: Germ Wave hazard + 5s Scrub Frenzy mini-game + Cinematic win/lose + WebAudio SFX
// ✅ Story Mode: 3 Episodes + Cutscene + Mission banner + Boss Germ King
// ✅ HUD Counters: miss left / need combo / no-germ status / boss clears
// ✅ VR/cVR strict: hha:shoot crosshair -> hit nearest target
// ✅ Event Log (local): HHA_HYGIENE_EVENTS_LAST + summary/history
// ❌ Google Sheet (พักไว้ก่อน)

'use strict';

const GAME_ID = 'hygiene';
const VERSION = '1.2.0-pack12';

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_BADGES = 'HHA_BADGES';
const LS_EV_LAST = 'HHA_HYGIENE_EVENTS_LAST'; // { meta, events[] }

const $ = (id)=>document.getElementById(id);

function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } }
function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
function nowIso(){ return new Date().toISOString(); }
function rand(){ return Math.random(); }

// seeded rng (simple LCG) for research deterministic
function makeRng(seed){
  let s = (Number(seed)||0) >>> 0;
  if(!s) s = (Date.now()>>>0);
  return function(){
    s = (1664525*s + 1013904223) >>> 0;
    return (s / 4294967296);
  };
}

function loadJson(key, fb){
  try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fb; }catch(_){ return fb; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(_){}
}
function pushHistory(summary){
  const arr = loadJson(LS_HIST, []);
  const list = Array.isArray(arr) ? arr : [];
  list.unshift(summary);
  while(list.length > 40) list.pop();
  saveJson(LS_HIST, list);
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(String(text));
    return true;
  }catch(_){
    try{
      const ta=document.createElement('textarea');
      ta.value=String(text);
      ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      ta.remove();
      return true;
    }catch(__){ return false; }
  }
}
function toast(msg){
  try{
    let el = document.querySelector('.hha-toast');
    if(!el){
      el=document.createElement('div');
      el.className='hha-toast';
      el.style.cssText=`
        position:fixed; left:50%;
        bottom: calc(92px + env(safe-area-inset-bottom,0px));
        transform: translateX(-50%);
        background: rgba(2,6,23,.88);
        color: rgba(229,231,235,.95);
        border:1px solid rgba(148,163,184,.18);
        padding:10px 12px;
        border-radius:999px;
        font: 900 12px/1.2 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, sans-serif;
        box-shadow:0 22px 70px rgba(0,0,0,.45);
        z-index:9999; opacity:0;
        transition: opacity .16s ease, transform .16s ease;
        pointer-events:none; white-space:nowrap;
      `;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity='1';
    el.style.transform='translateX(-50%) translateY(-2px)';
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translateX(-50%) translateY(0px)';
    }, 900);
  }catch(_){}
}

// -------------------- PACK 12: WebAudio SFX --------------------
let _ac = null;
function sfx(type='tap'){
  try{
    if(!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    const ac = _ac;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);

    let f = 420, dur = 0.06, vol = 0.05;
    if(type==='good'){ f=660; dur=0.07; vol=0.06; }
    if(type==='bad'){ f=180; dur=0.10; vol=0.07; }
    if(type==='power'){ f=520; dur=0.09; vol=0.06; }
    if(type==='boss'){ f=320; dur=0.08; vol=0.07; }
    if(type==='wave'){ f=220; dur=0.12; vol=0.08; }
    if(type==='win'){ f=740; dur=0.18; vol=0.06; }
    if(type==='lose'){ f=140; dur=0.18; vol=0.07; }

    o.type = 'square';
    o.frequency.value = f;
    g.gain.value = vol;

    const t = ac.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.stop(t+dur+0.02);
  }catch(_){}
}

// -------------------- PACK 10: Event buffer --------------------
const EV = [];
const EV_MAX = 900;

function logEv(type, data = {}){
  try{
    const t = performance.now();
    const item = Object.assign({
      tMs: Math.round(t),
      tsIso: new Date().toISOString(),
      type
    }, data || {});
    EV.push(item);
    if(EV.length > EV_MAX) EV.splice(0, EV.length - EV_MAX);
  }catch(_){}
}
function flushEventsLocal(meta){
  try{
    const payload = { meta: meta || {}, events: EV.slice(-EV_MAX) };
    localStorage.setItem(LS_EV_LAST, JSON.stringify(payload));
  }catch(_){}
}

// RT tracking (spawn -> hit)
const RT_GOOD = [];
function median(arr){
  const a = (arr||[]).map(Number).filter(x=>isFinite(x)).sort((x,y)=>x-y);
  if(!a.length) return 0;
  const m = (a.length-1)/2;
  return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1]) / 2;
}
function avg(arr){
  const a = (arr||[]).map(Number).filter(x=>isFinite(x));
  if(!a.length) return 0;
  return a.reduce((s,x)=>s+x,0)/a.length;
}

// -------------------- Game config --------------------
const RUN  = (qs('run','story')||'story').toLowerCase();   // story | research | play
const DIFF = (qs('diff','easy')||'easy').toLowerCase();   // easy | normal | hard
const TIME = clamp(qs('time', 70), 20, 9999);
const SEED_RAW = qs('seed', null);
const SEED = (SEED_RAW!=null && String(SEED_RAW).trim()!=='') ? Number(SEED_RAW) : null;

const VIEW = (qs('view','')||'').toLowerCase() || ( /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'') ? 'mobile' : 'pc' );
const STRICT_SHOOT = (VIEW === 'cvr' || VIEW === 'vr'); // vr/cvr ยิงจาก crosshair

const rng = (RUN==='research' && SEED!=null) ? makeRng(SEED) : rand;

function diffCfg(){
  // PACK12: waveHardness = โอกาสเกิด wave + ความเร็ว wave
  if(DIFF==='hard')   return { spawnGood: 0.74, spawnBad: 0.26, speed: 1.28, missLimit: 2, comboGoal: 14, waveP:0.22, waveSpeed:1.25 };
  if(DIFF==='normal') return { spawnGood: 0.81, spawnBad: 0.19, speed: 1.08, missLimit: 2, comboGoal: 12, waveP:0.16, waveSpeed:1.10 };
  return               { spawnGood: 0.86, spawnBad: 0.14, speed: 0.96, missLimit: 2, comboGoal: 12, waveP:0.10, waveSpeed:0.95 };
}
const CFG = diffCfg();

// -------------------- State --------------------
let started = false;
let paused = false;

let t0 = 0;
let tickT = 0;
let timeLeft = TIME;

let score = 0;
let combo = 0;
let comboMax = 0;
let misses = 0;

let goodHits = 0;
let badHits = 0;
let noGerm = true;

let bossClears = 0;
let bossActive = false;

let shield = 0;
let magnet = 0;
let slowmo = 0;

let coachLastAt = 0;

let powerPicked = 0;

let goalsCleared = 0;
let goalsTotal = 2;

let miniCleared = 0;
let miniTotal = 2;

let blocks = 0;
let perfectBlocks = 0;

let bossEnterCount = 0;

// Story director state
let storyOn = (RUN === 'story');
let epIndex = 0;
let epDone = [false,false,false];
let epTimeLeft = 0;

// Boss (Story)
let bossHp = 0;
let bossHpMax = 0;
let bossAlive = false;

// PACK 12: Germ Wave + Frenzy
let waveActive = false;
let waveCooldown = 0;
let waveHits = 0;

let frenzyUsed = false;
let frenzyActive = false;
let frenzyLeft = 0;
let frenzyScrubs = 0;     // จำนวนครั้งที่ “ถู”
let frenzyNeed = 18;      // threshold
let cleanseToken = 1;     // ได้สิทธิ์ “ล้าง noGerm ให้กลับ OK” 1 ครั้ง/รอบ (จาก frenzy)

// DOM refs
const field = $('field');
const startOv = $('startOv');
const endOv = $('endOv');

// story UI
const storyBanner = $('storyBanner');
const storyTitle  = $('storyTitle');
const storyHint   = $('storyHint');
const d1 = $('d1'), d2 = $('d2'), d3 = $('d3');

// cutscene UI
const csOv = $('csOv');
const csTitle = $('csTitle');
const csSub = $('csSub');
const csLine = $('csLine');
const csNext = $('csNext');
const csSkip = $('csSkip');

const elMeta = $('metaLine');
const elTL = $('tLeft');
const elScore = $('score');
const elCombo = $('combo');
const elComboMax = $('comboMax');
const elMiss = $('miss');
const elMissLimit = $('missLimit');
const elMissLeft = $('missLeft');
const elNoGerm = $('noGerm');
const pillNoGerm = $('noGermPill');
const elBoss = $('boss');
const pillBoss = $('bossPill');

const elNeedCombo = $('needCombo');
const pillNeedCombo = $('needComboPill');
const pillNeedMiss = $('needMissPill');

const coachBubble = $('coachBubble');

// buttons
$('btnStart').onclick = ()=>start();
$('btnPause').onclick = ()=>togglePause();
$('btnBack').onclick = ()=>goHub();
$('btnToHub').onclick = ()=>goHub();
$('btnReplay').onclick = ()=>restart();
$('btnCopySummary').onclick = async ()=>{ const s = localStorage.getItem(LS_LAST)||''; await copyText(s); toast('คัดลอก Summary แล้ว ✅'); };

// meta line
elMeta.textContent = `run=${RUN} • view=${VIEW} • diff=${DIFF} • time=${TIME}s • seed=${SEED!=null?SEED:'—'} • v=${VERSION}`;

// apply limits
elMissLimit.textContent = String(CFG.missLimit);
elNeedCombo.textContent = String(CFG.comboGoal);

// -------------------- Coach tips --------------------
function coach(msg, force=false){
  const now = Date.now();
  if(!force && (now - coachLastAt) < 2200) return;
  coachLastAt = now;
  coachBubble.textContent = `🤖 Coach: ${msg}`;
}

function updateStoryDots(){
  const dots = [d1,d2,d3];
  dots.forEach((dot,i)=>{
    if(!dot) return;
    dot.classList.remove('on','done');
    if(epDone[i]) dot.classList.add('done');
    else if(i === epIndex) dot.classList.add('on');
  });
}

function setStoryBanner(title, hint){
  if(!storyBanner) return;
  storyBanner.style.display = storyOn ? 'flex' : 'none';
  if(storyTitle) storyTitle.textContent = title || '';
  if(storyHint) storyHint.textContent = hint || '';
  updateStoryDots();
}

// -------------------- Cutscene --------------------
function showCutscene(opts){
  const title = opts?.title || '📖 Story';
  const sub   = opts?.sub || '';
  const lines = Array.isArray(opts?.lines) ? opts.lines : ['...'];
  const onDone = (typeof opts?.onDone === 'function') ? opts.onDone : (()=>{});

  let i = 0;

  csTitle.textContent = title;
  csSub.textContent = sub;
  csLine.textContent = lines[i] || '';

  csOv.style.display = 'grid';

  function next(){
    i++;
    if(i >= lines.length){
      csOv.style.display = 'none';
      csNext.onclick = null;
      csSkip.onclick = null;
      onDone();
      return;
    }
    csLine.textContent = lines[i];
  }

  csNext.onclick = ()=>next();
  csSkip.onclick = ()=>{
    csOv.style.display = 'none';
    csNext.onclick = null;
    csSkip.onclick = null;
    onDone();
  };
}

// -------------------- Targets --------------------
function clearTargets(){
  field.querySelectorAll('.t').forEach(x=>x.remove());
}

function spawnTarget(kind){
  const el = document.createElement('div');

  const isBoss = (kind === 'boss');
  const cls = isBoss ? 't boss' : ('t ' + (kind==='good'?'good': kind==='bad'?'bad':'power'));
  el.className = cls;

  // safe spawn
  let x = 0.12 + rng()*0.76;
  let y = 0.14 + rng()*0.72;

  if(isBoss){
    x = 0.5 + (rng()*0.06 - 0.03);
    y = 0.52 + (rng()*0.08 - 0.04);
  }

  const s = isBoss ? (1.15 + rng()*0.10) : ((kind==='power') ? (0.92 + rng()*0.18) : (0.92 + rng()*0.22));

  el.style.setProperty('--x', x.toFixed(4));
  el.style.setProperty('--y', y.toFixed(4));
  el.style.setProperty('--s', s.toFixed(3));

  if(kind==='good') el.textContent = '🫧';
  if(kind==='bad')  el.textContent = '🦠';
  if(kind==='power'){
    const r = rng();
    el.textContent = (r<0.34) ? '🛡️' : (r<0.67) ? '🧲' : '⏳';
  }
  if(isBoss){
    el.textContent = '🦠👑';
  }

  const baseLife = isBoss ? 999999 : (bossActive ? 760 : 980);
  const life = Math.max(420, baseLife / (CFG.speed * (slowmo?0.72:1)));
  const born = performance.now();

  const spawnMs = Math.round(born);
  const id = Math.floor((rng()*1e9)) + '-' + spawnMs;

  el.dataset.id = id;
  el.dataset.kind = kind;
  el.dataset.spawnMs = String(spawnMs);

  logEv('spawn', { id, kind, story: storyOn, ep: epIndex+1, x, y, s });

  el.addEventListener('click', ()=>{
    if(!started || paused) return;

    // PACK12: ถ้า frenzy กำลังทำงาน -> “แตะ/ยิง” = scrub
    if(frenzyActive){
      frenzyScrubs++;
      sfx('tap');
      logEv('frenzy_scrub', { scrubs: frenzyScrubs, left: frenzyLeft, ep: epIndex+1 });
      updateHud();
      updateCoachByState();
      return;
    }

    const tnow = performance.now();

    logEv('shot', {
      source: 'click',
      id: el.dataset.id,
      kind,
      story: storyOn,
      ep: epIndex+1,
      shieldOn: shield>0,
      magnetOn: magnet>0,
      slowmoOn: slowmo>0
    });

    if(kind==='good'){
      goodHits++;
      score += bossActive ? 3 : 1;
      combo++;
      comboMax = Math.max(comboMax, combo);

      const rt = Math.max(0, Math.round(tnow - Number(el.dataset.spawnMs||born)));
      RT_GOOD.push(rt);
      if(RT_GOOD.length > 240) RT_GOOD.splice(0, RT_GOOD.length - 240);

      sfx('good');
      logEv('hit', { id: el.dataset.id, kind:'good', rtMs: rt, combo, comboMax, score, ep: epIndex+1 });
      el.remove();

    }else if(kind==='bad'){
      badHits++;
      noGerm = false;

      if(shield > 0){
        blocks++;
        const perfect = (rng() < 0.35);
        if(perfect) perfectBlocks++;
        sfx('power');
        logEv('block', { id: el.dataset.id, kind:'bad', perfect, blocks, ep: epIndex+1 });
        coach('🛡️ บล็อกได้! ไปต่อ!', false);
        el.remove();
      }else{
        misses++;
        combo = 0;
        sfx('bad');
        logEv('bad_hit', { id: el.dataset.id, kind:'bad', misses, ep: epIndex+1 });
        coach('โดน 🦠! คอมโบขาดแล้ว 😵', true);
        el.remove();
      }

    }else if(kind==='power'){
      powerPicked++;
      if(el.textContent==='🛡️') shield = Math.max(shield, 6);
      if(el.textContent==='🧲') magnet = Math.max(magnet, 6);
      if(el.textContent==='⏳') slowmo = Math.max(slowmo, 5);

      sfx('power');
      logEv('power_pick', { id: el.dataset.id, power: el.textContent, powerPicked, ep: epIndex+1 });
      coach(`ได้ Power ${el.textContent}!`, true);
      el.remove();

    }else if(kind==='boss'){
      if(!bossAlive) return;

      bossHp = Math.max(0, bossHp - 1);
      score += 2;
      combo++;
      comboMax = Math.max(comboMax, combo);

      sfx('boss');
      logEv('boss_hit', { id: el.dataset.id, bossHp, bossHpMax, score, combo, ep: epIndex+1 });

      if(bossHp > 0){
        coach(`โดนแล้ว! Boss เหลือ ${bossHp}/${bossHpMax} 💥`, false);
      }else{
        bossAlive = false;
        bossClears++;
        logEv('boss_clear', { bossClears, ep: epIndex+1 });
        coach('🏆 ชนะแล้ว! Germ King แพ้แล้ว!', true);
        el.remove();
      }
    }

    updateHud();
    checkMiniGoal();
    updateCoachByState();
    checkEnd();
    checkStoryProgress();
  }, { passive:true });

  field.appendChild(el);

  if(!isBoss){
    const timer = setInterval(()=>{
      if(!field.contains(el)){ clearInterval(timer); return; }
      if(!started || paused) return;

      const tnow = performance.now();
      if(tnow - born >= life){
        clearInterval(timer);

        logEv('expire', { id: el.dataset.id, kind, ageMs: Math.round(tnow - born), ep: epIndex+1 });

        if(kind==='good'){
          misses++;
          combo = 0;
          sfx('bad');
          coach('พลาด 🫧 ไปหนึ่งอัน! ระวังนะ', false);
        }
        el.remove();
        updateHud();
        checkMiniGoal();
        updateCoachByState();
        checkEnd();
        checkStoryProgress();
      }
    }, 60);
  }

  return el;
}

// -------------------- PACK 12: Germ Wave hazard --------------------
function ensureWaveLayer(){
  let layer = field.querySelector('.hyg-wave-layer');
  if(layer) return layer;
  layer = document.createElement('div');
  layer.className = 'hyg-wave-layer';
  layer.style.cssText = `
    position:absolute; inset:0; pointer-events:none; z-index:20;
  `;
  field.appendChild(layer);
  return layer;
}

function spawnWave(){
  if(!started || paused) return;
  if(waveActive) return;

  // in story EP1: wave น้อย, EP2/EP3 เยอะขึ้น
  let p = CFG.waveP;
  if(storyOn && epIndex===0) p *= 0.65;
  if(storyOn && epIndex===2) p *= 1.20;

  if(rng() > p) return;
  if(waveCooldown > 0) return;

  waveActive = true;
  waveCooldown = 3.2; // seconds cooldown after wave ends
  sfx('wave');

  const layer = ensureWaveLayer();

  // choose direction
  const horizontal = (rng() < 0.5);
  const el = document.createElement('div');

  const thick = (horizontal ? 72 : 72);
  const speed = CFG.waveSpeed * (slowmo ? 0.72 : 1);
  const dur = 1.25 / Math.max(0.65, speed); // seconds

  // random lane
  const lane = 0.18 + rng()*0.64;

  el.className = 'hyg-wave';
  el.style.cssText = `
    position:absolute;
    ${horizontal ? `left:-30%; right:-30%; top:${(lane*100).toFixed(1)}%; height:${thick}px; transform:translateY(-50%);`
                : `top:-30%; bottom:-30%; left:${(lane*100).toFixed(1)}%; width:${thick}px; transform:translateX(-50%);`}
    background: linear-gradient(${horizontal ? '90deg' : '180deg'},
      rgba(239,68,68,0),
      rgba(239,68,68,.25),
      rgba(239,68,68,.35),
      rgba(239,68,68,.25),
      rgba(239,68,68,0)
    );
    border:1px solid rgba(239,68,68,.25);
    box-shadow: 0 0 28px rgba(239,68,68,.22);
    border-radius: 999px;
    opacity:.95;
  `;

  layer.appendChild(el);
  logEv('wave_spawn', { horizontal, lane, durSec: Number(dur.toFixed(2)), ep: epIndex+1 });

  // animate across
  const tStart = performance.now();
  let hitRegistered = false;

  function waveLoop(){
    if(!started){ cleanup(); return; }
    if(paused){ requestAnimationFrame(waveLoop); return; }

    const t = (performance.now() - tStart) / 1000;
    const p = Math.min(1, t / dur);

    // move
    if(horizontal){
      const x = (-30 + p*160); // -30% -> 130%
      el.style.transform = `translateY(-50%) translateX(${x}%)`;
    }else{
      const y = (-30 + p*160);
      el.style.transform = `translateX(-50%) translateY(${y}%)`;
    }

    // collision check once per frame (cheap)
    if(!hitRegistered){
      // define danger zone in screen: wave rect intersects center-ish area
      const r = el.getBoundingClientRect();
      const cx = window.innerWidth/2;
      const cy = window.innerHeight/2;
      const inDanger = (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom);

      // If crosshair zone hit => register
      if(inDanger){
        hitRegistered = true;
        waveHits++;

        if(shield > 0){
          blocks++;
          sfx('power');
          logEv('wave_block', { waveHits, blocks, ep: epIndex+1 });
          coach('🛡️ บล็อกคลื่นเชื้อได้!', false);
        }else{
          misses++;
          combo = 0;
          noGerm = false;
          sfx('bad');
          logEv('wave_hit', { waveHits, misses, ep: epIndex+1 });
          coach('🌊 โดนคลื่นเชื้อ! ระวังงง!', true);
        }

        updateHud();
        checkMiniGoal();
        updateCoachByState();
        checkEnd();
      }
    }

    if(p >= 1){
      cleanup();
      return;
    }
    requestAnimationFrame(waveLoop);
  }

  function cleanup(){
    try{ el.remove(); }catch(_){}
    waveActive = false;
    logEv('wave_end', { waveHits, ep: epIndex+1 });
  }

  requestAnimationFrame(waveLoop);
}

// -------------------- PACK 12: Scrub Frenzy mini-game (5s) --------------------
function canTriggerFrenzy(){
  if(frenzyUsed) return false;
  if(frenzyActive) return false;
  // Trigger when misses close to limit or in story EP2
  const missLeft = Math.max(0, CFG.missLimit - misses);
  if(missLeft <= 1) return true;
  if(storyOn && epIndex === 1 && (epTimeLeft <= 7)) return true;
  return false;
}

function startFrenzy(){
  if(!started || paused) return;
  if(frenzyActive || frenzyUsed) return;

  frenzyActive = true;
  frenzyUsed = true;

  frenzyLeft = 5.0;
  frenzyScrubs = 0;

  // threshold adjusts by diff
  frenzyNeed = (DIFF==='hard') ? 22 : (DIFF==='normal' ? 18 : 16);

  logEv('frenzy_start', { frenzyNeed, ep: epIndex+1 });
  coach(`🧼 Scrub Frenzy! แตะ/ยิงให้เร็ว ${frenzyNeed} ครั้งใน 5 วิ!`, true);
  toast('🧼 Scrub Frenzy 5s!');

  // cinematic overlay via cutscene UI reuse (show as live counter)
  try{
    csTitle.textContent = '🧼 Scrub Frenzy (5s)';
    csSub.textContent = 'แตะ/ยิงเร็ว ๆ เพื่อ “ล้างมือขั้นสุด”';
    csLine.textContent = `Scrubs: 0 / ${frenzyNeed}\nTip: แตะเร็ว ๆ หรือยิง crosshair`;
    csOv.style.display = 'grid';
    csSkip.textContent = 'ยอมแพ้';
    csNext.textContent = 'ถูต่อ ▶';
  }catch(_){}

  // Buttons just keep it open
  csNext.onclick = ()=>{ /* no-op */ };
  csSkip.onclick = ()=>{
    frenzyLeft = 0;
  };
}

function updateFrenzy(dt){
  if(!frenzyActive) return;

  frenzyLeft -= dt;
  if(frenzyLeft < 0) frenzyLeft = 0;

  // update overlay text
  try{
    csLine.textContent = `Scrubs: ${frenzyScrubs} / ${frenzyNeed}\nเหลือเวลา: ${frenzyLeft.toFixed(1)}s`;
  }catch(_){}

  if(frenzyLeft <= 0){
    // end frenzy
    frenzyActive = false;
    try{
      csOv.style.display = 'none';
      csNext.onclick = null;
      csSkip.onclick = null;
    }catch(_){}

    const pass = (frenzyScrubs >= frenzyNeed);

    if(pass){
      // reward: bonus score + cleanse token (restore noGerm once)
      score += 6;
      combo += 2;
      comboMax = Math.max(comboMax, combo);
      cleanseToken = Math.min(1, cleanseToken); // keep 1 token
      // “ล้าง” สถานะ noGerm ให้กลับ OK ทันที 1 ครั้ง ถ้าเคยพัง
      if(!noGerm){
        noGerm = true;
        logEv('cleanse_used_auto', { ep: epIndex+1 });
      }
      sfx('win');
      logEv('frenzy_pass', { frenzyScrubs, frenzyNeed, score, ep: epIndex+1 });
      coach('สุดยอด! ล้างมือขั้นเทพ ✅ ได้โบนัส + สถานะสะอาดกลับมา!', true);
      toast('✅ Frenzy PASS!');

    }else{
      // small penalty: reset combo
      combo = 0;
      sfx('lose');
      logEv('frenzy_fail', { frenzyScrubs, frenzyNeed, ep: epIndex+1 });
      coach('เกือบแล้ว! รอบหน้าถูให้เร็วขึ้นนะ 😈', true);
      toast('❌ Frenzy FAIL');
    }

    updateHud();
    checkMiniGoal();
    updateCoachByState();
    checkEnd();
    checkStoryProgress();
  }
}

// -------------------- Shoot routing --------------------
function nearestTargetAtScreenXY(x, y, lockPx){
  const candidates = Array.from(field.querySelectorAll('.t'));
  if(!candidates.length) return null;

  const bonus = (magnet > 0) ? 18 : 0;
  const r = Math.max(10, Number(lockPx||28) + bonus);

  let best = null;
  let bestD2 = Infinity;

  for(const el of candidates){
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width/2;
    const cy = b.top  + b.height/2;

    const dx = (cx - x);
    const dy = (cy - y);
    const d2 = dx*dx + dy*dy;

    if(d2 <= r*r && d2 < bestD2){
      best = el;
      bestD2 = d2;
    }
  }
  return best;
}

function shootAt(x, y, lockPx, source='shoot'){
  if(!started || paused) return false;

  // frenzy: any shoot = scrub
  if(frenzyActive){
    frenzyScrubs++;
    sfx('tap');
    logEv('frenzy_scrub', { scrubs: frenzyScrubs, left: frenzyLeft, source, ep: epIndex+1 });
    updateHud();
    updateCoachByState();
    return true;
  }

  const target = nearestTargetAtScreenXY(x, y, lockPx);
  if(!target) return false;

  logEv('aim_lock', { id: target.dataset.id, kind: target.dataset.kind, lockPx, source, ep: epIndex+1 });

  try{
    target.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:x, clientY:y }));
  }catch(_){
    try{ target.click(); }catch(__){}
  }
  return true;
}

window.addEventListener('hha:shoot', (ev)=>{
  try{
    const d = (ev && ev.detail) ? ev.detail : {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!isFinite(x) || !isFinite(y)) return;

    const lockPx = isFinite(Number(d.lockPx)) ? Number(d.lockPx) : 28;

    logEv('shot', { source: d.source || 'hha:shoot', x, y, lockPx, ep: epIndex+1 });

    const ok = shootAt(x, y, lockPx, d.source || 'hha:shoot');

    if(STRICT_SHOOT && !ok && !frenzyActive){
      coach('พลาด! เล็ง crosshair ให้ใกล้ 🫧 กว่านี้นะ', false);
    }
  }catch(_){}
}, { passive:true });

document.addEventListener('keydown', (e)=>{
  if(e.key === ' ' && STRICT_SHOOT){
    const x = window.innerWidth/2;
    const y = window.innerHeight/2;
    shootAt(x, y, 28, 'space');
  }
});

// -------------------- Story Episodes --------------------
const EP = [
  {
    title: 'EP1: ก่อนกินข้าว 🍱',
    hint: 'Mission: เก็บ 🫧 ให้ได้ 10 ครั้ง (หลบ 🦠) ระวังคลื่นเชื้อ 🌊',
    cut: {
      title:'EP1: ก่อนกินข้าว 🍱',
      sub:'เด็กจะกินข้าว…แต่มีเชื้อแอบอยู่!',
      lines:[
        'เพื่อน ๆ กำลังจะกินข้าว 🍱',
        'แต่มีเชื้อโรค 🦠 แอบซ่อนอยู่รอบ ๆ มือ!',
        'ภารกิจ: เก็บฟองสบู่ 🫧 ให้ได้ 10 ครั้ง\nและพยายามอย่าโดน 🦠',
        'ระวัง: คลื่นเชื้อ 🌊 จะผ่านเป็นครั้งคราว!'
      ]
    },
    setup(){
      goalsTotal = 2; miniTotal = 2;
      bossAlive = false;
      bossHp = 0; bossHpMax = 0;
    },
    pass(){ return (goodHits >= 10); }
  },
  {
    title: 'EP2: หลังเข้าห้องน้ำ 🚻',
    hint: 'Mission: บล็อกคลื่น/เชื้อด้วย 🛡️ ≥1 หรือ Miss ≤1 (มี Frenzy ช่วยได้)',
    cut: {
      title:'EP2: หลังเข้าห้องน้ำ 🚻',
      sub:'ด่านนี้เชื้อมาเป็นชุด ๆ ต้องมีสติ!',
      lines:[
        'หลังเข้าห้องน้ำ 🚻 ต้องล้างมือให้สะอาด!',
        'เชื้อ 🦠 จะมาเร็วขึ้นนิดนึง + คลื่นเชื้อ 🌊 บ่อยขึ้น',
        'ถ้าเกือบแพ้ จะมี Scrub Frenzy 5 วิช่วย!\n(แตะ/ยิงให้เร็ว)'
      ]
    },
    setup(){
      goalsTotal = 2; miniTotal = 2;
      bossAlive = false;
      bossHp = 0; bossHpMax = 0;
    },
    pass(){ return (blocks >= 1) || (misses <= 1); }
  },
  {
    title: 'EP3: Germ King 🦠👑',
    hint: 'Mission: ยิง Boss ให้ HP หมด (6) + ระวังคลื่นเชื้อ 🌊',
    cut: {
      title:'EP3: Germ King 🦠👑',
      sub:'บอสตัวจริงโผล่แล้ว!',
      lines:[
        'โอ๊ะ! Germ King 🦠👑 โผล่มาขัดขวาง!',
        'ภารกิจ: ยิง Boss ให้โดน 6 ครั้ง (HP 6)',
        'ระวัง 🦠 + คลื่นเชื้อ 🌊 ด้วยนะ…',
        'ถ้าเกือบแพ้… Scrub Frenzy จะช่วยครั้งเดียว!'
      ]
    },
    setup(){
      bossHpMax = 6;
      bossHp = bossHpMax;
      bossAlive = true;
      spawnTarget('boss');
      logEv('boss_spawn', { bossHpMax, ep:3 });
    },
    pass(){ return (!bossAlive && bossHp <= 0); }
  }
];

function startEpisode(i){
  epIndex = clamp(i, 0, 2);
  epTimeLeft = Math.max(12, Math.round(TIME/3));
  if(epIndex === 2) epTimeLeft = Math.max(18, TIME - Math.round(2*TIME/3));

  setStoryBanner(EP[epIndex].title, EP[epIndex].hint);
  updateStoryDots();

  EP[epIndex].setup();

  // PACK12: reset episode-specific things
  waveCooldown = 1.2;
  waveActive = false;

  coach(`เริ่ม ${EP[epIndex].title}!`, true);
}

function completeEpisode(){
  epDone[epIndex] = true;
  logEv('episode_pass', { ep: epIndex+1 });

  if(epIndex < 2){
    const nextIdx = epIndex + 1;
    showCutscene({
      title: '✅ ผ่านตอนนี้แล้ว!',
      sub: 'เตรียมไปตอนถัดไป',
      lines:[
        `เก่งมาก! ผ่าน ${EP[epIndex].title}`,
        `ต่อไป: ${EP[nextIdx].title}`,
        'พร้อมแล้วกด “ถัดไป”'
      ],
      onDone(){ startEpisode(nextIdx); }
    });
  }else{
    endGame('story-complete');
  }
}

function failEpisode(){
  logEv('episode_fail', { ep: epIndex+1 });
  endGame('story-fail');
}

function checkStoryProgress(){
  if(!storyOn || !started) return;
  if(EP[epIndex].pass()){
    completeEpisode();
  }
}

// -------------------- Spawning --------------------
function spawnWaveTargets(){
  if(!started || paused) return;

  const ep = storyOn ? epIndex : -1;

  let base = 1;
  if(ep === 1) base = 2;
  if(ep === 2) base = 2;

  const n = base + (rng() < 0.30 ? 1 : 0);

  for(let i=0;i<n;i++){
    const r = rng();
    const goodRate = (ep === 1) ? 0.78 : (ep === 2 ? 0.76 : CFG.spawnGood);
    if(r < goodRate) spawnTarget('good');
    else spawnTarget('bad');
  }

  const pPow = (ep === 2) ? 0.18 : 0.12;
  if(rng() < pPow) spawnTarget('power');

  // PACK12: germ wave hazard chance
  spawnWave();
}

// -------------------- Mini/Goal --------------------
function checkMiniGoal(){
  const played = (TIME - timeLeft);

  if(storyOn){
    if(epIndex === 0){
      const g1 = (goodHits >= 10);
      const g2 = (comboMax >= 8);
      goalsTotal = 2;
      const newGoals = (g1?1:0) + (g2?1:0);
      goalsCleared = Math.max(goalsCleared, newGoals);

      const m1 = (played >= 12 && noGerm === true);
      const m2 = (powerPicked >= 1);
      miniTotal = 2;
      const newMinis = (m1?1:0) + (m2?1:0);
      miniCleared = Math.max(miniCleared, newMinis);
    }
    if(epIndex === 1){
      const g1 = (blocks >= 1);
      const g2 = (misses <= 1);
      goalsTotal = 2;
      goalsCleared = Math.max(goalsCleared, (g1?1:0) + (g2?1:0));

      const m1 = (powerPicked >= 2);
      const m2 = (comboMax >= 10);
      miniTotal = 2;
      miniCleared = Math.max(miniCleared, (m1?1:0) + (m2?1:0));
    }
    if(epIndex === 2){
      const g1 = (!bossAlive && bossHp <= 0);
      const g2 = (misses <= CFG.missLimit);
      goalsTotal = 2;
      goalsCleared = Math.max(goalsCleared, (g1?1:0) + (g2?1:0));

      const m1 = (comboMax >= CFG.comboGoal);
      const m2 = (blocks >= 1);
      miniTotal = 2;
      miniCleared = Math.max(miniCleared, (m1?1:0) + (m2?1:0));
    }
    return;
  }

  // baseline
  goalsTotal = 2;
  const g1 = (score >= 18);
  const g2 = (comboMax >= CFG.comboGoal);
  goalsCleared = Math.max(goalsCleared, (g1?1:0) + (g2?1:0));

  miniTotal = 2;
  const m1 = (played >= 15 && noGerm === true);
  const m2 = (powerPicked >= 1);
  miniCleared = Math.max(miniCleared, (m1?1:0) + (m2?1:0));
}

// -------------------- HUD --------------------
function updateHud(){
  const showT = storyOn ? epTimeLeft : timeLeft;
  elTL.textContent = `${Math.max(0, Math.ceil(showT))}s`;

  elScore.textContent = String(score);
  elCombo.textContent = String(combo);
  elComboMax.textContent = String(comboMax);
  elMiss.textContent = String(misses);

  const missLeft = Math.max(0, CFG.missLimit - misses);
  elMissLeft.textContent = String(missLeft);

  elNoGerm.textContent = noGerm ? 'OK' : 'BROKEN';
  pillNoGerm.classList.remove('good','warn','bad');
  pillNoGerm.classList.add(noGerm ? 'good' : 'bad');

  elBoss.textContent = String(bossClears);
  pillBoss.classList.remove('good','warn','bad');
  if(storyOn && epIndex===2) pillBoss.classList.add('warn');

  const needC = Math.max(0, CFG.comboGoal - comboMax);
  elNeedCombo.textContent = String(needC);
  pillNeedCombo.classList.remove('good','warn','bad');
  pillNeedCombo.classList.add(needC===0 ? 'good' : (needC<=3 ? 'warn' : ''));

  pillNeedMiss.classList.remove('good','warn','bad');
  pillNeedMiss.classList.add(missLeft<=0 ? 'bad' : (missLeft<=1 ? 'warn' : 'good'));

  // PACK12: hint frenzy ready
  if(canTriggerFrenzy() && !frenzyUsed && !frenzyActive){
    coach('ใกล้แพ้แล้ว! จะมี Scrub Frenzy ช่วย! (แตะ/ยิงเร็ว ๆ)', false);
  }
}

// -------------------- Coach by state --------------------
function updateCoachByState(){
  const missLeft = Math.max(0, CFG.missLimit - misses);
  const needC = Math.max(0, CFG.comboGoal - comboMax);

  if(frenzyActive){
    coach(`ถูให้ทัน! ${frenzyScrubs}/${frenzyNeed} 🧼`, false);
    return;
  }

  if(storyOn){
    if(epIndex===2 && bossAlive){
      coach(`ยิง Boss อีก ${bossHp}/${bossHpMax} ครั้ง! 🎯`, false);
      return;
    }
    if(epIndex===0 && goodHits<10){
      coach(`EP1: เก็บ 🫧 อีก ${Math.max(0,10-goodHits)} ครั้ง`, false);
      return;
    }
    if(epIndex===1 && blocks<1 && misses<=1){
      coach('EP2: หา 🛡️ แล้วบล็อกสักครั้งนะ', false);
      return;
    }
  }

  if(!noGerm){
    if(cleanseToken>0 && frenzyUsed && !frenzyActive){
      coach('ยังพอไหว! ลองเล่นเนียน ๆ ต่อไป สถานะสะอาดกลับได้จาก Frenzy ที่ผ่านนะ', false);
    }else{
      coach('โดน 🦠 แล้ว! รอบหน้าลองช้าลงนิดนึง เล็ง 🫧 ก่อนแตะนะ', false);
    }
    return;
  }

  if(missLeft <= 1){
    coach(`ระวัง! พลาดได้อีก ${missLeft} ครั้งเท่านั้น 🧯`, false);
    return;
  }

  if(needC > 0 && combo >= 6){
    coach(`ดีมาก! ถ้ารักษาคอมโบต่อ จะเหลืออีก ${needC} เพื่อได้ Badge 🔥`, false);
    return;
  }
}

// -------------------- Loop --------------------
function start(){
  if(started) return;

  started = true;
  paused = false;

  startOv.style.display = 'none';
  clearTargets();

  // reset timers
  t0 = performance.now();
  tickT = t0;
  timeLeft = TIME;

  // reset story
  storyOn = (RUN === 'story');
  epIndex = 0;
  epDone = [false,false,false];

  // PACK12 reset hazards/frenzy
  waveActive = false;
  waveCooldown = 1.0;
  waveHits = 0;

  frenzyUsed = false;
  frenzyActive = false;
  frenzyLeft = 0;
  frenzyScrubs = 0;
  cleanseToken = 1;

  // entry
  const begin = ()=>{
    coach(STRICT_SHOOT ? 'โหมด VR ยิงด้วย crosshair 🎯 เล็ง 🫧 แล้วหลบ 🦠 + ระวังคลื่นเชื้อ 🌊' : 'เริ่มแล้ว! เล็ง 🫧 หลบ 🦠 ระวังคลื่นเชื้อ 🌊', true);
    updateHud();

    requestAnimationFrame(loop);

    spawnWaveTargets();
    const spawnMs = DIFF==='hard' ? 520 : (DIFF==='normal' ? 620 : 720);
    start._spawnTimer = setInterval(spawnWaveTargets, spawnMs);

    logEv('start', { game:GAME_ID, version:VERSION, run:RUN, diff:DIFF, view:VIEW, seed:SEED, time:TIME, story:storyOn });
  };

  if(storyOn){
    setStoryBanner('Story: Handwash Adventure 🧼', 'กำลังเริ่ม…');
    showCutscene({
      title:'🧼 Handwash Adventure',
      sub:'ล้างมือให้ถูก…เพื่อชนะเชื้อโรค!',
      lines:[
        'ยินดีต้อนรับสู่ภารกิจล้างมือ 🧼',
        'เก็บ 🫧 ให้เร็ว • หลบ 🦠 • เก็บ Power 🛡️🧲⏳',
        'ระวัง: คลื่นเชื้อ 🌊 จะผ่านเป็นครั้งคราว',
        'ถ้าใกล้แพ้… จะมี Scrub Frenzy 5 วิช่วยครั้งเดียว!'
      ],
      onDone(){
        showCutscene(Object.assign({}, EP[0].cut, { onDone(){ startEpisode(0); begin(); } }));
      }
    });
  }else{
    storyBanner.style.display = 'none';
    begin();
  }
}

function togglePause(){
  if(!started) return;
  paused = !paused;
  $('btnPause').textContent = paused ? '▶ Resume' : '⏸ Pause';
  coach(paused ? 'พักก่อนนะ ⏸️' : 'ไปต่อ! 🚀', true);
  logEv('pause', { paused, ep: epIndex+1 });
}

function loop(ts){
  if(!started) return;
  requestAnimationFrame(loop);
  if(paused) return;

  const dt = (ts - tickT) / 1000;
  tickT = ts;

  // global time
  timeLeft -= dt;
  if(timeLeft < 0) timeLeft = 0;

  // story episode time
  if(storyOn){
    epTimeLeft -= dt;
    if(epTimeLeft < 0) epTimeLeft = 0;

    if(epTimeLeft <= 0){
      if(!EP[epIndex].pass()){
        failEpisode();
        return;
      }
    }
  }

  // power timers
  if(shield>0) shield = Math.max(0, shield - dt);
  if(magnet>0) magnet = Math.max(0, magnet - dt);
  if(slowmo>0) slowmo = Math.max(0, slowmo - dt);

  // wave cooldown
  if(waveCooldown > 0) waveCooldown = Math.max(0, waveCooldown - dt);

  // frenzy auto trigger
  if(canTriggerFrenzy() && !frenzyUsed && !frenzyActive){
    startFrenzy();
  }

  // frenzy update
  updateFrenzy(dt);

  updateHud();
  checkMiniGoal();

  if(Math.floor((storyOn?epTimeLeft:timeLeft)) % 7 === 0){
    updateCoachByState();
  }

  checkStoryProgress();
  checkEnd();
}

function checkEnd(){
  if(!started) return;

  // fail by miss
  if(misses > CFG.missLimit){
    endGame('fail-miss');
    return;
  }

  if(!storyOn && timeLeft <= 0){
    endGame('time-up');
    return;
  }
}

// -------------------- Badges --------------------
function gradeFrom(score, acc, miss){
  if(miss <= 0 && acc >= 85 && score >= 35) return 'A';
  if(miss <= 1 && acc >= 75) return 'B';
  if(acc >= 60) return 'C';
  return 'D';
}
function awardBadge(id, emoji, name, desc){
  const all = loadJson(LS_BADGES, []);
  const arr = Array.isArray(all) ? all : [];
  if(arr.some(x=>x && x.id===id)) return;
  arr.unshift({ id, game:'hygiene', emoji, name, desc, at: nowIso(), source:'game', diff:DIFF, run:RUN });
  saveJson(LS_BADGES, arr);
  toast(`ปลดล็อก ${emoji} ${name} 🎉`);
}
function maybeBadges(sum){
  if(sum.noGermOk) awardBadge('hyg_no_germ','🧼','Clean Master','จบเกมโดยไม่โดน 🦠 เลย');
  if(sum.misses <= 1) awardBadge('hyg_low_miss','🎯','Sharp Aim','Miss ไม่เกิน 1');
  if(sum.comboMax >= CFG.comboGoal) awardBadge('hyg_combo','🔥','Combo Star',`ComboMax ≥ ${CFG.comboGoal}`);
  if(sum.powerPicked >= 3) awardBadge('hyg_power3','🎁','Power Collector','เก็บ Power-up ≥ 3');
  if(sum.bossClears >= 1) awardBadge('hyg_boss','🏆','Boss Cleaner','ชนะ Boss สำเร็จ');
  if(sum.storyCompleted) awardBadge('hyg_story','📖','Story Hero','ผ่าน Story ครบ 3 ตอน');
  if(sum.waveHits <= 0) awardBadge('hyg_wave_zero','🌊','Wave Dodger','หลบคลื่นเชื้อได้หมด!');
  if(sum.frenzyPass) awardBadge('hyg_frenzy','⚡','Scrub Speed','ผ่าน Scrub Frenzy!');
}

// -------------------- End / Summary + Cinematic --------------------
function endGame(reason){
  if(!started) return;
  started = false;

  clearInterval(start._spawnTimer);
  start._spawnTimer = null;

  clearTargets();

  const durationPlayedSec = Math.max(0, Math.round((performance.now() - t0) / 1000));
  const accuracyGoodPct = (goodHits + badHits) ? (100*goodHits/(goodHits+badHits)) : 0;

  const summary = {
    gameMode: 'hygiene',
    game: 'hygiene',
    version: VERSION,
    runMode: RUN,
    diff: DIFF,
    view: VIEW,
    time: TIME,
    seed: (RUN==='research' ? SEED : (SEED!=null ? SEED : null)),
    reasonEnd: reason,

    timestampIso: nowIso(),
    durationPlannedSec: TIME,
    durationPlayedSec,

    scoreFinal: score,
    comboMax,
    misses,
    goodHits,
    badHits,
    accuracyGoodPct: Number(accuracyGoodPct.toFixed(2)),

    noGermOk: noGerm,
    bossClears,
    bossEnterCount,

    goalsCleared,
    goalsTotal,
    miniCleared,
    miniTotal,

    powerPicked,
    blocks,
    perfectBlocks,

    medianRtGoodMs: Math.round(median(RT_GOOD)),
    avgRtGoodMs: Math.round(avg(RT_GOOD)),

    storyCompleted: (RUN==='story' && reason==='story-complete'),
    storyEpPassed: epDone.filter(Boolean).length,

    // PACK12
    waveHits,
    frenzyUsed,
    frenzyPass: (frenzyUsed && !frenzyActive && frenzyScrubs >= frenzyNeed),

    grade: gradeFrom(score, accuracyGoodPct, misses),

    studyId: qs('studyId', null),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', null)
  };

  flushEventsLocal({
    game: 'hygiene',
    version: VERSION,
    run: RUN,
    diff: DIFF,
    view: VIEW,
    time: TIME,
    seed: summary.seed,
    reasonEnd: reason
  });

  saveJson(LS_LAST, summary);
  pushHistory(summary);

  maybeBadges(summary);

  logEv('end', { reason, score, misses, comboMax, epPassed: summary.storyEpPassed });

  // PACK12: cinematic end (ใช้ cutscene overlay ก่อนโชว์ end card)
  const win = (reason === 'story-complete' || reason === 'time-up');
  if(win){
    sfx('win');
    showCutscene({
      title:'🎉 ชนะแล้ว!',
      sub:'มือสะอาด! เชื้อโรคแพ้!',
      lines:[
        'เก่งมากกก! 🧼✨',
        'คุณล้างมือได้ถูกต้องและหลบเชื้อได้ดี',
        `คะแนน: ${summary.scoreFinal} • เกรด: ${summary.grade}`,
        (summary.waveHits<=0 ? 'โบนัส: หลบคลื่นเชื้อได้หมด! 🌊' : `คลื่นเชื้อโดนไป ${summary.waveHits} ครั้ง 🌊`),
        (summary.frenzyPass ? 'Scrub Frenzy ผ่าน! ⚡' : (summary.frenzyUsed ? 'Scrub Frenzy ไม่ผ่าน (รอบหน้าเอาใหม่!)' : 'ไม่ได้ใช้ Scrub Frenzy')),
      ],
      onDone(){ showEnd(summary); }
    });
  }else{
    sfx('lose');
    showCutscene({
      title:'😈 แพ้แล้ว!',
      sub:'เชื้อโรคชนะ…รอบหน้าเอาใหม่!',
      lines:[
        'ยังไม่เป็นไร!',
        'เคล็ดลับ: เล็ง 🫧 ก่อน • หลบ 🦠 • เก็บ 🛡️ ไว้บล็อกคลื่นเชื้อ 🌊',
        'ถ้าใกล้แพ้… Scrub Frenzy จะช่วยครั้งเดียว (แตะ/ยิงให้เร็ว)',
        `คะแนน: ${summary.scoreFinal} • Miss: ${summary.misses}/${CFG.missLimit}`
      ],
      onDone(){ showEnd(summary); }
    });
  }
}

function showEnd(sum){
  endOv.style.display = 'grid';

  const storyTxt = (sum.runMode==='story')
    ? `Story: ผ่าน ${sum.storyEpPassed}/3 ตอน`
    : `Mode: ${sum.runMode}`;

  $('endSub').textContent =
    `${storyTxt} • Grade ${sum.grade} • Score ${sum.scoreFinal} • Miss ${sum.misses}/${CFG.missLimit} • ComboMax ${sum.comboMax} • Acc ${sum.accuracyGoodPct}% • Wave ${sum.waveHits}`;

  const grid = $('endGrid');
  grid.innerHTML = '';

  const items = [
    ['⏱️ เวลาเล่น', `${sum.durationPlayedSec}s / ${sum.durationPlannedSec}s`],
    ['✅ Score', String(sum.scoreFinal)],
    ['🔥 ComboMax', String(sum.comboMax)],
    ['❌ Miss', `${sum.misses} / ${CFG.missLimit}`],
    ['🎯 Accuracy', `${sum.accuracyGoodPct}%`],
    ['⏱️ Median RT', `${sum.medianRtGoodMs} ms`],
    ['🌊 Wave Hits', String(sum.waveHits)],
    ['⚡ Frenzy', sum.frenzyUsed ? (sum.frenzyPass ? 'PASS' : 'FAIL') : '—'],
    ['🎁 Power', String(sum.powerPicked)],
    ['🛡️ Blocks', `${sum.blocks} (perfect ${sum.perfectBlocks})`],
    ['🏆 Boss', String(sum.bossClears)],
    ['🎯 Goals/Minis', `${sum.goalsCleared}/${sum.goalsTotal} • ${sum.miniCleared}/${sum.miniTotal}`],
  ];

  items.forEach(([k,v])=>{
    const card = document.createElement('div');
    card.style.cssText = `
      border:1px solid rgba(148,163,184,.16);
      background: rgba(15,23,42,.55);
      border-radius: 18px;
      padding: 12px;
    `;
    card.innerHTML = `<div style="color:#94a3b8;font-weight:900;font-size:12px;">${k}</div>
                      <div style="font-weight:1100;font-size:18px;margin-top:4px;">${v}</div>`;
    grid.appendChild(card);
  });

  coach('จบแล้ว! กลับ HUB ไปดู Rule Engine + Dashboard ได้เลย 😈📊', true);
}

function restart(){
  endOv.style.display = 'none';

  started = false; paused=false;

  score=0; combo=0; comboMax=0; misses=0;
  goodHits=0; badHits=0; noGerm=true;

  bossClears=0; bossActive=false;
  shield=0; magnet=0; slowmo=0;

  powerPicked=0;
  goalsCleared=0; goalsTotal=2;
  miniCleared=0; miniTotal=2;

  blocks=0; perfectBlocks=0; bossEnterCount=0;

  storyOn = (RUN==='story');
  epIndex=0; epDone=[false,false,false];
  epTimeLeft=0;

  bossAlive=false; bossHp=0; bossHpMax=0;

  // PACK12 reset
  waveActive=false; waveCooldown=1.0; waveHits=0;
  frenzyUsed=false; frenzyActive=false; frenzyLeft=0; frenzyScrubs=0;
  cleanseToken=1;

  $('btnPause').textContent = '⏸ Pause';
  startOv.style.display = 'grid';

  EV.length = 0;
  RT_GOOD.length = 0;

  setStoryBanner('', '');
  if(storyBanner) storyBanner.style.display = storyOn ? 'flex' : 'none';

  coach('พร้อมแล้ว กด Start อีกครั้ง 🚀', true);
  updateHud();
}

function goHub(){
  const hub = qs('hub', null);
  if(hub){ location.href = hub; return; }
  location.href = '../hub.html';
}

// -------------------- Init message --------------------
updateHud();
if(STRICT_SHOOT){
  coach('โหมด VR ยิงด้วย crosshair 🎯 ระวังคลื่นเชื้อ 🌊 + ถ้าใกล้แพ้มี Frenzy ช่วย!', true);
}else{
  coach('แนะนำ run=story: มีคลื่นเชื้อ 🌊 + Scrub Frenzy 5 วิ + Boss 🦠👑', true);
}