// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR — Handwash Survival (PRODUCTION-ish v1)
// ✅ HUD Counters: miss left / need combo / no-germ status / boss clears
// ✅ Coach micro-tips (rate-limited)
// ✅ Summary + End overlay + save HHA_LAST_SUMMARY + history
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/style/log
// ❌ Google Sheet (พักไว้ก่อน)

'use strict';

const GAME_ID = 'hygiene';
const VERSION = '1.0.0-pack8';

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_BADGES = 'HHA_BADGES';

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
    // LCG
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
  // keep last 40
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
      ta.style.position='fixed';
      ta.style.left='-9999px';
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

// -------------------- Game config --------------------
const RUN  = (qs('run','story')||'story').toLowerCase();   // story | research | play
const DIFF = (qs('diff','easy')||'easy').toLowerCase();   // easy | normal | hard
const TIME = clamp(qs('time', 70), 20, 9999);
const SEED_RAW = qs('seed', null);
const SEED = (SEED_RAW!=null && String(SEED_RAW).trim()!=='') ? Number(SEED_RAW) : null;

const rng = (RUN==='research' && SEED!=null) ? makeRng(SEED) : rand;

// difficulty tuning
function diffCfg(){
  if(DIFF==='hard')   return { spawnGood: 0.78, spawnBad: 0.22, speed: 1.25, missLimit: 2, comboGoal: 14, bossAt: 0.75 };
  if(DIFF==='normal') return { spawnGood: 0.82, spawnBad: 0.18, speed: 1.05, missLimit: 2, comboGoal: 12, bossAt: 0.70 };
  return               { spawnGood: 0.86, spawnBad: 0.14, speed: 0.95, missLimit: 2, comboGoal: 12, bossAt: 0.68 };
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

let shield = 0;     // seconds
let magnet = 0;     // seconds
let slowmo = 0;     // seconds

let coachLastAt = 0;

// DOM refs
const field = $('field');
const startOv = $('startOv');
const endOv = $('endOv');

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
elMeta.textContent = `run=${RUN} • diff=${DIFF} • time=${TIME}s • seed=${SEED!=null?SEED:'—'}`;

// apply limits
elMissLimit.textContent = String(CFG.missLimit);
elNeedCombo.textContent = String(CFG.comboGoal);

// -------------------- Coach tips --------------------
function coach(msg, force=false){
  const now = Date.now();
  if(!force && (now - coachLastAt) < 2400) return; // rate limit
  coachLastAt = now;
  coachBubble.textContent = `🤖 Coach: ${msg}`;
}

function updateCoachByState(){
  const missLeft = Math.max(0, CFG.missLimit - misses);
  const needC = Math.max(0, CFG.comboGoal - comboMax);

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
  if(bossActive){
    coach('โหมด Boss! โฟกัส 🫧 ต่อเนื่อง อย่าโดน 🦠', false);
    return;
  }
}

// -------------------- Targets --------------------
function clearTargets(){
  field.querySelectorAll('.t').forEach(x=>x.remove());
}

function spawnTarget(kind){
  const el = document.createElement('div');
  el.className = 't ' + (kind==='good'?'good': kind==='bad'?'bad':'power');

  // safe spawn (avoid edge)
  const x = 0.12 + rng()*0.76;
  const y = 0.14 + rng()*0.72;

  const s = (kind==='power') ? (0.92 + rng()*0.18) : (0.92 + rng()*0.22);

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

  // lifetime
  const baseLife = bossActive ? 760 : 980;
  const life = Math.max(420, baseLife / (CFG.speed * (slowmo?0.72:1)));
  const born = performance.now();

  // hit
  el.addEventListener('click', ()=>{
    if(!started || paused) return;

    // magnet effect: allow bigger hit window (simple: always counts)
    const tnow = performance.now();
    const age = tnow - born;

    if(kind==='good'){
      goodHits++;
      score += bossActive ? 3 : 1;
      combo++;
      comboMax = Math.max(comboMax, combo);
      // micro reward
      if(combo===5) coach('คอมโบเริ่มมาแล้ว! รักษาจังหวะ 🫧', false);
      el.remove();
    }else if(kind==='bad'){
      badHits++;
      noGerm = false;
      // shield blocks bad hit
      if(shield > 0){
        coach('🛡️ กันพลาดได้! ระวังต่อ', false);
        el.remove();
      }else{
        misses++;
        combo = 0;
        coach('โดน 🦠! คอมโบขาดแล้ว 😵', true);
        el.remove();
      }
    }else{
      // power pick
      if(el.textContent==='🛡️') shield = Math.max(shield, 6);
      if(el.textContent==='🧲') magnet = Math.max(magnet, 6);
      if(el.textContent==='⏳') slowmo = Math.max(slowmo, 5);
      coach(`ได้ Power ${el.textContent} !`, true);
      el.remove();
    }

    // update HUD now
    updateHud();
    updateCoachByState();
    checkEnd();
  }, { passive:true });

  field.appendChild(el);

  // expire -> counts as miss only if good expired
  const timer = setInterval(()=>{
    if(!field.contains(el)){ clearInterval(timer); return; }
    if(!started || paused) return;

    const tnow = performance.now();
    if(tnow - born >= life){
      clearInterval(timer);
      // expired
      if(kind==='good'){
        misses++;
        combo = 0;
        coach('พลาด 🫧 ไปหนึ่งอัน! ระวังนะ', false);
      }
      el.remove();
      updateHud();
      updateCoachByState();
      checkEnd();
    }
  }, 60);
}

function spawnWave(){
  if(!started || paused) return;

  // boss trigger near end
  const progress = 1 - (timeLeft / TIME);
  if(!bossActive && progress >= CFG.bossAt){
    bossActive = true;
    coach('🏆 Boss Phase! โฟกัส 🫧 ให้ต่อเนื่อง!', true);
  }

  // spawn amount
  const base = bossActive ? 2 : 1;
  const n = base + (rng() < 0.30 ? 1 : 0);

  for(let i=0;i<n;i++){
    const r = rng();
    if(r < CFG.spawnGood){
      spawnTarget('good');
    }else{
      spawnTarget('bad');
    }
  }

  // occasional power
  if(rng() < (bossActive ? 0.18 : 0.12)){
    spawnTarget('power');
  }
}

// -------------------- HUD --------------------
function updateHud(){
  elTL.textContent = `${Math.max(0, Math.ceil(timeLeft))}s`;
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

  // boss
  elBoss.textContent = String(bossClears);
  pillBoss.classList.remove('good','warn','bad');
  pillBoss.classList.add(bossActive ? 'warn' : '');

  // need combo
  const needC = Math.max(0, CFG.comboGoal - comboMax);
  elNeedCombo.textContent = String(needC);
  pillNeedCombo.classList.remove('good','warn','bad');
  pillNeedCombo.classList.add(needC===0 ? 'good' : (needC<=3 ? 'warn' : ''));

  // miss pill
  pillNeedMiss.classList.remove('good','warn','bad');
  pillNeedMiss.classList.add(missLeft<=0 ? 'bad' : (missLeft<=1 ? 'warn' : 'good'));
}

// -------------------- Loop --------------------
function start(){
  if(started) return;
  started = true;
  paused = false;

  startOv.style.display = 'none';
  clearTargets();

  t0 = performance.now();
  tickT = t0;
  timeLeft = TIME;

  coach('เริ่มแล้ว! เล็ง 🫧 และหลบ 🦠 นะ', true);
  updateHud();

  // main tick
  requestAnimationFrame(loop);

  // spawn loop
  spawnWave();
  const spawnMs = DIFF==='hard' ? 520 : (DIFF==='normal' ? 620 : 720);
  start._spawnTimer = setInterval(spawnWave, spawnMs);
}

function togglePause(){
  if(!started) return;
  paused = !paused;
  $('btnPause').textContent = paused ? '▶ Resume' : '⏸ Pause';
  coach(paused ? 'พักก่อนนะ ⏸️' : 'ไปต่อ! 🚀', true);
}

function loop(ts){
  if(!started){ return; }
  requestAnimationFrame(loop);

  if(paused) return;

  const dt = (ts - tickT) / 1000;
  tickT = ts;

  timeLeft -= dt;
  if(timeLeft < 0) timeLeft = 0;

  // power timers
  if(shield>0) shield = Math.max(0, shield - dt);
  if(magnet>0) magnet = Math.max(0, magnet - dt);
  if(slowmo>0) slowmo = Math.max(0, slowmo - dt);

  // boss clear condition: survive boss phase with comboMax reaching threshold OR time ended
  if(bossActive && timeLeft <= 0){
    bossClears += 1;
    bossActive = false;
  }

  updateHud();

  // coach pulse occasionally
  if(Math.floor(timeLeft) % 7 === 0){
    updateCoachByState();
  }

  checkEnd();
}

function checkEnd(){
  if(!started) return;

  // fail by miss
  if(misses > CFG.missLimit){
    endGame('fail-miss');
    return;
  }

  // time up -> end
  if(timeLeft <= 0){
    endGame('time-up');
    return;
  }
}

// -------------------- Summary + Badges --------------------
function gradeFrom(score, acc, miss){
  // simple grade (ปรับได้)
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
  // hygiene badges
  if(sum.noGermOk) awardBadge('hyg_no_germ','🧼','Clean Master','จบเกมโดยไม่โดน 🦠 เลย');
  if(sum.misses <= 1) awardBadge('hyg_low_miss','🎯','Sharp Aim','Miss ไม่เกิน 1');
  if(sum.comboMax >= CFG.comboGoal) awardBadge('hyg_combo12','🔥','Combo Star',`ComboMax ≥ ${CFG.comboGoal}`);
  if(sum.powerPicked >= 3) awardBadge('hyg_power3','🎁','Power Collector','เก็บ Power-up ≥ 3');
  if(sum.bossClears >= 1) awardBadge('hyg_boss','🏆','Boss Cleaner','ล้าง Boss สำเร็จ');
}

function endGame(reason){
  if(!started) return;
  started = false;

  clearInterval(start._spawnTimer);
  start._spawnTimer = null;

  clearTargets();

  const durationPlayedSec = Math.max(0, Math.round(TIME - timeLeft));
  const accuracyGoodPct = (goodHits + badHits) ? (100*goodHits/(goodHits+badHits)) : 0;

  const summary = {
    gameMode: 'hygiene',
    game: 'hygiene',
    version: VERSION,
    runMode: RUN,
    diff: DIFF,
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

    // simple derived
    grade: gradeFrom(score, accuracyGoodPct, misses),

    // research passthrough
    studyId: qs('studyId', null),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', null)
  };

  // store last + history
  saveJson(LS_LAST, summary);
  pushHistory(summary);

  // award hygiene badges
  // power count: infer from score events (we didn't count; keep 0 for now)
  summary.powerPicked = 0; // (ถ้าต้องการจริง เดี๋ยว PACK 9 จะทำ event counters ให้)
  maybeBadges(summary);

  // end overlay
  showEnd(summary);
}

function showEnd(sum){
  endOv.style.display = 'grid';
  $('endSub').textContent =
    `ผลลัพธ์: ${sum.grade} • Score ${sum.scoreFinal} • Miss ${sum.misses}/${CFG.missLimit} • ComboMax ${sum.comboMax} • Acc ${sum.accuracyGoodPct}%`;

  const grid = $('endGrid');
  grid.innerHTML = '';

  const items = [
    ['⏱️ เวลาเล่น', `${sum.durationPlayedSec}s / ${sum.durationPlannedSec}s`],
    ['✅ Score', String(sum.scoreFinal)],
    ['🔥 ComboMax', String(sum.comboMax)],
    ['❌ Miss', `${sum.misses} / ${CFG.missLimit}`],
    ['🎯 Accuracy', `${sum.accuracyGoodPct}%`],
    ['🦠 No-Germ', sum.noGermOk ? 'OK' : 'BROKEN'],
    ['🏆 Boss', String(sum.bossClears)],
    ['🏷️ Run', `${sum.runMode} • ${sum.diff}`],
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

  coach(`จบแล้ว! ถ้าจะได้ Badge ต่อไป → ดู Mission Board ใน HUB 😈`, true);
}

function restart(){
  // reset state
  endOv.style.display = 'none';

  started = false; paused=false;
  score=0; combo=0; comboMax=0; misses=0;
  goodHits=0; badHits=0; noGerm=true;
  bossClears=0; bossActive=false;
  shield=0; magnet=0; slowmo=0;

  $('btnPause').textContent = '⏸ Pause';
  startOv.style.display = 'grid';
  coach('พร้อมแล้ว กด Start อีกครั้ง 🚀', true);
  updateHud();
}

function goHub(){
  const hub = qs('hub', null);
  if(hub){
    location.href = hub;
    return;
  }
  // fallback
  location.href = '../hub.html';
}

// initial HUD
updateHud();
coach('ตั้งเป้า: Miss ≤ 2 • ComboMax ≥ 12 • พยายามไม่โดน 🦠', true);