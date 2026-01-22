// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR — Handwash Story/Survival (PROD-ish v1.1 PACK 11)
// ✅ Story Mode: 3 Episodes + Cutscene + Mission banner + Boss Germ King
// ✅ HUD Counters: miss left / need combo / no-germ status / boss clears
// ✅ VR/cVR strict: hha:shoot crosshair -> hit nearest target
// ✅ Event Log (local): HHA_HYGIENE_EVENTS_LAST + summary/history
// ❌ Google Sheet (พักไว้ก่อน)

'use strict';

const GAME_ID = 'hygiene';
const VERSION = '1.1.0-pack11';

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
  if(DIFF==='hard')   return { spawnGood: 0.76, spawnBad: 0.24, speed: 1.25, missLimit: 2, comboGoal: 14 };
  if(DIFF==='normal') return { spawnGood: 0.82, spawnBad: 0.18, speed: 1.05, missLimit: 2, comboGoal: 12 };
  return               { spawnGood: 0.86, spawnBad: 0.14, speed: 0.95, missLimit: 2, comboGoal: 12 };
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
let bossActive = false; // survival boss flag (still used lightly)

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
elMeta.textContent = `run=${RUN} • view=${VIEW} • diff=${DIFF} • time=${TIME}s • seed=${SEED!=null?SEED:'—'}`;

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
  // opts: {title, sub, lines[], onDone()}
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

function spawnTarget(kind, opt = {}){
  const el = document.createElement('div');

  const isBoss = (kind === 'boss');
  const cls = isBoss ? 't boss' : ('t ' + (kind==='good'?'good': kind==='bad'?'bad':'power'));
  el.className = cls;

  // safe spawn
  let x = 0.12 + rng()*0.76;
  let y = 0.14 + rng()*0.72;

  // Boss fixed center-ish
  if(isBoss){
    x = 0.5 + (rng()*0.06 - 0.03);
    y = 0.52 + (rng()*0.08 - 0.04);
  }

  const s = isBoss ? (1.15 + rng()*0.10) : ((kind==='power') ? (0.92 + rng()*0.18) : (0.92 + rng()*0.22));

  el.style.setProperty('--x', x.toFixed(4));
  el.style.setProperty('--y', y.toFixed(4));
  el.style.setProperty('--s', s.toFixed(3));

  // emoji
  if(kind==='good') el.textContent = '🫧';
  if(kind==='bad')  el.textContent = '🦠';
  if(kind==='power'){
    const r = rng();
    el.textContent = (r<0.34) ? '🛡️' : (r<0.67) ? '🧲' : '⏳';
  }
  if(isBoss){
    el.textContent = '🦠👑';
  }

  // lifetime
  const baseLife = isBoss ? 999999 : (bossActive ? 760 : 980);
  const life = Math.max(420, baseLife / (CFG.speed * (slowmo?0.72:1)));
  const born = performance.now();

  const spawnMs = Math.round(born);
  const id = Math.floor((rng()*1e9)) + '-' + spawnMs;

  el.dataset.id = id;
  el.dataset.kind = kind;
  el.dataset.spawnMs = String(spawnMs);

  logEv('spawn', { id, kind, boss: !!bossActive, story: storyOn, ep: epIndex+1, x, y, s });

  // hit handler
  el.addEventListener('click', ()=>{
    if(!started || paused) return;

    const tnow = performance.now();

    logEv('shot', {
      source: 'click',
      id: el.dataset.id,
      kind,
      boss: !!bossActive,
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

      logEv('hit', { id: el.dataset.id, kind:'good', rtMs: rt, combo, comboMax, score, story: storyOn, ep: epIndex+1 });
      el.remove();

    }else if(kind==='bad'){
      badHits++;
      noGerm = false;

      if(shield > 0){
        blocks++;
        const perfect = (rng() < 0.35);
        if(perfect) perfectBlocks++;
        logEv('block', { id: el.dataset.id, kind:'bad', perfect, blocks, story: storyOn, ep: epIndex+1 });
        coach('🛡️ บล็อกได้! ไปต่อ!', false);
        el.remove();
      }else{
        misses++;
        combo = 0;
        logEv('bad_hit', { id: el.dataset.id, kind:'bad', misses, story: storyOn, ep: epIndex+1 });
        coach('โดน 🦠! คอมโบขาดแล้ว 😵', true);
        el.remove();
      }

    }else if(kind==='power'){
      powerPicked++;
      if(el.textContent==='🛡️') shield = Math.max(shield, 6);
      if(el.textContent==='🧲') magnet = Math.max(magnet, 6);
      if(el.textContent==='⏳') slowmo = Math.max(slowmo, 5);

      logEv('power_pick', { id: el.dataset.id, power: el.textContent, powerPicked, story: storyOn, ep: epIndex+1 });
      coach(`ได้ Power ${el.textContent}!`, true);
      el.remove();

    }else if(kind==='boss'){
      // Story Boss: ต้องยิงให้ HP หมด (ยิงโดน = สำเร็จ ไม่ถือว่าเป็น bad)
      if(!bossAlive) return;

      bossHp = Math.max(0, bossHp - 1);
      score += 2;
      combo++;
      comboMax = Math.max(comboMax, combo);

      logEv('boss_hit', { id: el.dataset.id, bossHp, bossHpMax, score, combo, story:true, ep: epIndex+1 });

      // feedback
      if(bossHp > 0){
        coach(`โดนแล้ว! Boss เหลือ ${bossHp}/${bossHpMax} 💥`, false);
      }else{
        // boss clear
        bossAlive = false;
        bossClears++;
        logEv('boss_clear', { bossClears, story:true, ep: epIndex+1 });
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

  // expire loop (not for boss)
  if(!isBoss){
    const timer = setInterval(()=>{
      if(!field.contains(el)){ clearInterval(timer); return; }
      if(!started || paused) return;

      const tnow = performance.now();
      if(tnow - born >= life){
        clearInterval(timer);

        logEv('expire', { id: el.dataset.id, kind, ageMs: Math.round(tnow - born), story: storyOn, ep: epIndex+1 });

        if(kind==='good'){
          misses++;
          combo = 0;
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

// -------------------- PACK 9: Shoot routing --------------------
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
  const target = nearestTargetAtScreenXY(x, y, lockPx);
  if(!target) return false;

  logEv('aim_lock', { id: target.dataset.id, kind: target.dataset.kind, lockPx, source, story: storyOn, ep: epIndex+1 });

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

    logEv('shot', { source: d.source || 'hha:shoot', x, y, lockPx, story: storyOn, ep: epIndex+1 });

    const ok = shootAt(x, y, lockPx, d.source || 'hha:shoot');

    if(STRICT_SHOOT && !ok){
      coach('พลาด! เล็ง crosshair ให้ใกล้ 🫧 กว่านี้นะ', false);
    }
  }catch(_){}
}, { passive:true });

// optional: space shoot
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
    hint: 'Mission: เก็บ 🫧 ให้ได้ 10 ครั้งก่อนหมดเวลา (หลบ 🦠)',
    cut: {
      title:'EP1: ก่อนกินข้าว 🍱',
      sub:'เด็กจะกินข้าว…แต่มีเชื้อแอบอยู่!',
      lines:[
        'เพื่อน ๆ กำลังจะกินข้าว 🍱',
        'แต่มีเชื้อโรค 🦠 แอบซ่อนอยู่รอบ ๆ มือ!',
        'ภารกิจ: เก็บฟองสบู่ 🫧 ให้ได้ 10 ครั้ง\nและพยายามอย่าโดน 🦠',
      ]
    },
    setup(){
      goalsTotal = 2; miniTotal = 2;
      // ตั้งภารกิจย่อย
      // goal1: goodHits >= 10
      // goal2: comboMax >= 8
      // mini1: ไม่โดน 🦠 ในช่วง 12s แรก
      // mini2: เก็บ power 1 ชิ้น
      bossAlive = false;
      bossHp = 0; bossHpMax = 0;
    },
    pass(){
      return (goodHits >= 10);
    }
  },
  {
    title: 'EP2: หลังเข้าห้องน้ำ 🚻',
    hint: 'Mission: บล็อกด้วย 🛡️ อย่างน้อย 1 ครั้ง หรืออยู่รอดโดย Miss ไม่เกิน 1',
    cut: {
      title:'EP2: หลังเข้าห้องน้ำ 🚻',
      sub:'ด่านนี้เชื้อมาเป็นชุด ๆ ต้องมีสติ!',
      lines:[
        'หลังเข้าห้องน้ำ 🚻 ต้องล้างมือให้สะอาด!',
        'เชื้อ 🦠 จะมาเร็วขึ้นนิดนึง',
        'ภารกิจ: ถ้าได้ 🛡️ ให้ลองบล็อกอย่างน้อย 1 ครั้ง\nหรือเล่นให้เนียน Miss ไม่เกิน 1',
      ]
    },
    setup(){
      goalsTotal = 2; miniTotal = 2;
      bossAlive = false;
      bossHp = 0; bossHpMax = 0;
    },
    pass(){
      return (blocks >= 1) || (misses <= 1);
    }
  },
  {
    title: 'EP3: Germ King 🦠👑',
    hint: 'Mission: ยิง Boss ให้ HP หมด (6 ครั้ง) ก่อนหมดเวลา!',
    cut: {
      title:'EP3: Germ King 🦠👑',
      sub:'บอสตัวจริงโผล่แล้ว!',
      lines:[
        'โอ๊ะ! Germ King 🦠👑 โผล่มาขัดขวาง!',
        'ภารกิจ: ยิง Boss ให้โดน 6 ครั้ง (HP 6)',
        'ระวัง 🦠 รอบ ๆ ด้วยนะ…\nถ้าพลาดเยอะจะไม่ผ่าน!',
      ]
    },
    setup(){
      bossHpMax = 6;
      bossHp = bossHpMax;
      bossAlive = true;
      // spawn boss now
      spawnTarget('boss');
      logEv('boss_spawn', { bossHpMax, story:true, ep:3 });
    },
    pass(){
      return (!bossAlive && bossHp <= 0);
    }
  }
];

function startEpisode(i){
  epIndex = clamp(i, 0, 2);
  epTimeLeft = Math.max(12, Math.round(TIME/3)); // แบ่งเวลา 3 ตอนแบบง่าย
  if(epIndex === 2) epTimeLeft = Math.max(18, TIME - Math.round(2*TIME/3)); // ให้บอสได้เวลามากหน่อย

  // ปรับอัตราสุ่มให้ท้าทายขึ้นเล็กน้อยใน EP2/EP3
  if(epIndex === 1){
    coach('EP2 เริ่ม! โฟกัส 🫧 + หา 🛡️', true);
  }
  if(epIndex === 2){
    coach('EP3 เริ่ม! ยิง Boss ให้ครบ!', true);
  }

  // setup episode specifics
  EP[epIndex].setup();

  setStoryBanner(EP[epIndex].title, EP[epIndex].hint);
  updateStoryDots();
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
      onDone(){
        startEpisode(nextIdx);
      }
    });
  }else{
    // story finished
    endGame('story-complete');
  }
}

function failEpisode(){
  logEv('episode_fail', { ep: epIndex+1 });
  endGame('story-fail');
}

function checkStoryProgress(){
  if(!storyOn || !started) return;

  // episode timer
  // ใช้ epTimeLeft ลดลงจาก loop
  // pass condition
  if(EP[epIndex].pass()){
    completeEpisode();
  }
}

// -------------------- Spawning --------------------
function spawnWave(){
  if(!started || paused) return;

  // story: spawn depends on episode
  const ep = storyOn ? epIndex : -1;

  // spawn count tuning
  let base = 1;
  if(ep === 1) base = 2;
  if(ep === 2) base = 2;

  // boss episode spawns more germs
  const n = base + (rng() < 0.30 ? 1 : 0);

  for(let i=0;i<n;i++){
    const r = rng();
    const goodRate = (ep === 1) ? 0.80 : (ep === 2 ? 0.78 : CFG.spawnGood);
    if(r < goodRate){
      spawnTarget('good');
    }else{
      spawnTarget('bad');
    }
  }

  // power chance
  const pPow = (ep === 2) ? 0.18 : 0.12;
  if(rng() < pPow){
    spawnTarget('power');
  }
}

// -------------------- Mini/Goal (generic) --------------------
function checkMiniGoal(){
  // เปลี่ยนความหมายตาม story episode แบบอ่านง่าย
  const played = (TIME - timeLeft);

  if(storyOn){
    if(epIndex === 0){
      const g1 = (goodHits >= 10);
      const g2 = (comboMax >= 8);
      goalsTotal = 2;
      const newGoals = (g1?1:0) + (g2?1:0);
      if(newGoals > goalsCleared){
        goalsCleared = newGoals;
        logEv('goal_progress', { goalsCleared, goalsTotal, ep:1, goodHits, comboMax });
      }

      const m1 = (played >= 12 && noGerm === true);
      const m2 = (powerPicked >= 1);
      miniTotal = 2;
      const newMinis = (m1?1:0) + (m2?1:0);
      if(newMinis > miniCleared){
        miniCleared = newMinis;
        logEv('mini_pass', { miniCleared, miniTotal, ep:1, playedSec: Math.round(played), powerPicked, noGerm });
      }
    }

    if(epIndex === 1){
      const g1 = (blocks >= 1);
      const g2 = (misses <= 1);
      goalsTotal = 2;
      const newGoals = (g1?1:0) + (g2?1:0);
      if(newGoals > goalsCleared){
        goalsCleared = newGoals;
        logEv('goal_progress', { goalsCleared, goalsTotal, ep:2, blocks, misses });
      }

      const m1 = (powerPicked >= 2);
      const m2 = (comboMax >= 10);
      miniTotal = 2;
      const newMinis = (m1?1:0) + (m2?1:0);
      if(newMinis > miniCleared){
        miniCleared = newMinis;
        logEv('mini_pass', { miniCleared, miniTotal, ep:2, powerPicked, comboMax });
      }
    }

    if(epIndex === 2){
      const g1 = (!bossAlive && bossHp <= 0);
      const g2 = (misses <= CFG.missLimit);
      goalsTotal = 2;
      const newGoals = (g1?1:0) + (g2?1:0);
      if(newGoals > goalsCleared){
        goalsCleared = newGoals;
        logEv('goal_progress', { goalsCleared, goalsTotal, ep:3, bossHp, misses });
      }

      const m1 = (comboMax >= CFG.comboGoal);
      const m2 = (blocks >= 1);
      miniTotal = 2;
      const newMinis = (m1?1:0) + (m2?1:0);
      if(newMinis > miniCleared){
        miniCleared = newMinis;
        logEv('mini_pass', { miniCleared, miniTotal, ep:3, comboMax, blocks });
      }
    }

    return;
  }

  // non-story baseline
  const g1 = (score >= 18);
  const g2 = (comboMax >= CFG.comboGoal);
  const newGoals = (g1?1:0) + (g2?1:0);
  if(newGoals > goalsCleared){
    goalsCleared = newGoals;
    logEv('goal_progress', { goalsCleared, goalsTotal, score, comboMax });
  }

  const m1 = (played >= 15 && noGerm === true);
  const m2 = (powerPicked >= 1);
  const newMinis = (m1?1:0) + (m2?1:0);
  if(newMinis > miniCleared){
    miniCleared = newMinis;
    logEv('mini_pass', { miniCleared, miniTotal, playedSec: Math.round(played), powerPicked, noGerm });
  }
}

// -------------------- HUD --------------------
function updateHud(){
  // time display: story shows episode time; otherwise global
  const showT = storyOn ? epTimeLeft : timeLeft;
  elTL.textContent = `${Math.max(0, Math.ceil(showT))}s`;

  elScore.textContent = String(score);
  elCombo.textContent = String(combo);
  elComboMax.textContent = String(comboMax);
  elMiss.textContent = String(misses);

  const missLeft = Math.max(0, CFG.missLimit - misses);
  elMissLeft.textContent = String(missLeft);

  // no-germ
  elNoGerm.textContent = noGerm ? 'OK' : 'BROKEN';
  pillNoGerm.classList.remove('good','warn','bad');
  pillNoGerm.classList.add(noGerm ? 'good' : 'bad');

  // boss clears count
  elBoss.textContent = String(bossClears);
  pillBoss.classList.remove('good','warn','bad');
  pillBoss.classList.add(storyOn && epIndex===2 ? 'warn' : '');

  // need combo
  const needC = Math.max(0, CFG.comboGoal - comboMax);
  elNeedCombo.textContent = String(needC);
  pillNeedCombo.classList.remove('good','warn','bad');
  pillNeedCombo.classList.add(needC===0 ? 'good' : (needC<=3 ? 'warn' : ''));

  // miss pill
  pillNeedMiss.classList.remove('good','warn','bad');
  pillNeedMiss.classList.add(missLeft<=0 ? 'bad' : (missLeft<=1 ? 'warn' : 'good'));
}

// -------------------- Coach by state --------------------
function updateCoachByState(){
  const missLeft = Math.max(0, CFG.missLimit - misses);
  const needC = Math.max(0, CFG.comboGoal - comboMax);

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
    coach('โดน 🦠 แล้ว! รอบหน้าลองช้าลงนิดนึง เล็ง 🫧 ก่อนแตะนะ', false);
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

  // initial banner
  if(storyOn){
    storyBanner.style.display = 'flex';
    setStoryBanner('Story: Handwash Adventure 🧼', 'กำลังเริ่ม…');
  }else{
    storyBanner.style.display = 'none';
  }

  // start cutscene if story
  const begin = ()=>{
    coach(STRICT_SHOOT ? 'โหมด VR ยิงด้วย crosshair 🎯 เล็ง 🫧 แล้วหลบ 🦠' : 'เริ่มแล้ว! เล็ง 🫧 และหลบ 🦠 นะ', true);
    updateHud();

    // main loop
    requestAnimationFrame(loop);

    // spawn loop
    spawnWave();
    const spawnMs = DIFF==='hard' ? 520 : (DIFF==='normal' ? 620 : 720);
    start._spawnTimer = setInterval(spawnWave, spawnMs);

    logEv('start', { game:GAME_ID, version:VERSION, run:RUN, diff:DIFF, view:VIEW, seed:SEED, time:TIME, story:storyOn });
  };

  if(storyOn){
    showCutscene({
      title:'🧼 Handwash Adventure',
      sub:'ล้างมือให้ถูก…เพื่อชนะเชื้อโรค!',
      lines:[
        'ยินดีต้อนรับสู่ภารกิจล้างมือ 🧼',
        'เก็บ 🫧 ให้เร็ว • หลบ 🦠 • เก็บ Power 🛡️🧲⏳',
        'ผ่าน 3 ตอน แล้วไปสู้ Boss Germ King 🦠👑 กัน!'
      ],
      onDone(){
        // EP1 cut + start EP1
        showCutscene(Object.assign({}, EP[0].cut, {
          onDone(){
            startEpisode(0);
            begin();
          }
        }));
      }
    });
  }else{
    begin();
  }
}

function togglePause(){
  if(!started) return;
  paused = !paused;
  $('btnPause').textContent = paused ? '▶ Resume' : '⏸ Pause';
  coach(paused ? 'พักก่อนนะ ⏸️' : 'ไปต่อ! 🚀', true);
  logEv('pause', { paused, story:storyOn, ep: epIndex+1 });
}

function loop(ts){
  if(!started){ return; }
  requestAnimationFrame(loop);
  if(paused) return;

  const dt = (ts - tickT) / 1000;
  tickT = ts;

  // global time (non-story)
  timeLeft -= dt;
  if(timeLeft < 0) timeLeft = 0;

  // episode time (story)
  if(storyOn){
    epTimeLeft -= dt;
    if(epTimeLeft < 0) epTimeLeft = 0;

    // EP time out
    if(epTimeLeft <= 0){
      // ถ้าผ่านเงื่อนไขแล้วจะ completeEpisode ใน checkStoryProgress
      // ถ้ายังไม่ผ่าน => fail
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

  updateHud();
  checkMiniGoal();

  // coach pulse occasionally
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

  // non-story time up -> end
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
}

// -------------------- End / Summary --------------------
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

    grade: gradeFrom(score, accuracyGoodPct, misses),

    studyId: qs('studyId', null),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', null)
  };

  // flush events local
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

  // store last + history
  saveJson(LS_LAST, summary);
  pushHistory(summary);

  // badges
  maybeBadges(summary);

  logEv('end', { reason, score, misses, comboMax, story: storyOn, epPassed: summary.storyEpPassed });

  // end overlay
  showEnd(summary);
}

function showEnd(sum){
  endOv.style.display = 'grid';

  const storyTxt = (sum.runMode==='story')
    ? `Story: ผ่าน ${sum.storyEpPassed}/3 ตอน`
    : `Mode: ${sum.runMode}`;

  $('endSub').textContent =
    `${storyTxt} • Grade ${sum.grade} • Score ${sum.scoreFinal} • Miss ${sum.misses}/${CFG.missLimit} • ComboMax ${sum.comboMax} • Acc ${sum.accuracyGoodPct}%`;

  const grid = $('endGrid');
  grid.innerHTML = '';

  const items = [
    ['⏱️ เวลาเล่น', `${sum.durationPlayedSec}s / ${sum.durationPlannedSec}s`],
    ['✅ Score', String(sum.scoreFinal)],
    ['🔥 ComboMax', String(sum.comboMax)],
    ['❌ Miss', `${sum.misses} / ${CFG.missLimit}`],
    ['🎯 Accuracy', `${sum.accuracyGoodPct}%`],
    ['⏱️ Median RT', `${sum.medianRtGoodMs} ms`],
    ['🎁 Power', String(sum.powerPicked)],
    ['🛡️ Blocks', `${sum.blocks} (perfect ${sum.perfectBlocks})`],
    ['🏆 Boss', String(sum.bossClears)],
    ['🎯 Goals', `${sum.goalsCleared}/${sum.goalsTotal}`],
    ['🧩 Minis', `${sum.miniCleared}/${sum.miniTotal}`],
    ['🏷️ Run', `${sum.runMode} • ${sum.diff} • ${sum.view}`],
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

  coach('จบแล้ว! กลับ HUB ไปดู Rule Engine ได้เลย 😈📊', true);
}

function restart(){
  endOv.style.display = 'none';

  started = false; paused=false;

  // reset state
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

  $('btnPause').textContent = '⏸ Pause';
  startOv.style.display = 'grid';

  // clear events buffer (new run)
  EV.length = 0;
  RT_GOOD.length = 0;

  setStoryBanner('', '');
  if(storyBanner) storyBanner.style.display = storyOn ? 'flex' : 'none';

  coach('พร้อมแล้ว กด Start อีกครั้ง 🚀', true);
  updateHud();
}

function goHub(){
  const hub = qs('hub', null);
  if(hub){
    location.href = hub;
    return;
  }
  location.href = '../hub.html';
}

// -------------------- Init message --------------------
updateHud();
if(STRICT_SHOOT){
  coach('โหมด VR ยิงด้วย crosshair 🎯 แตะหน้าจอเพื่อยิง • เล็ง 🫧 แล้วหลบ 🦠', true);
}else{
  coach('เลือก run=story เพื่อเล่นแบบมีภารกิจ 3 ตอน + Boss 🦠👑', true);
}