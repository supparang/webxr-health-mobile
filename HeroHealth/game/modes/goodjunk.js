// === modes/goodjunk.js — Good vs Junk (DOM-spawn, Fever, Shield/Star, Sequential Mini-Quests) ===
export const name = 'goodjunk';

/* ---------- Data pools ---------- */
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // star=+points burst, shield=ignore next miss

/* ---------- Difficulty presets ---------- */
const DIFF = {
  Easy:   { spawnPerSec: 1.85, life: 1.95, size: 64, goodBias: 0.78, goldenRate: 0.14, powerRate: 0.12 },
  Normal: { spawnPerSec: 1.55, life: 1.70, size: 56, goodBias: 0.70, goldenRate: 0.12, powerRate: 0.10 },
  Hard:   { spawnPerSec: 1.35, life: 1.45, size: 48, goodBias: 0.64, goldenRate: 0.10, powerRate: 0.08 }
};

/* ---------- Mini-Quest pool (sequential) ---------- */
const QUEST_POOL = [
  // key, label(TH/EN), target by diff
  { key:'good_hits',    th:'เก็บของดีให้ครบ', en:'Collect good items',      target:{Easy:12, Normal:15, Hard:18} },
  { key:'perfects',     th:'PERFECT ให้ถึง',    en:'Make PERFECT hits',       target:{Easy:3,  Normal:4,  Hard:5 } },
  { key:'avoid_junk',   th:'หลีกเลี่ยงของไม่ดี', en:'Avoid junk',             target:{Easy:8,  Normal:10, Hard:12} },
  { key:'combo_reach',  th:'ทำคอมโบถึง',       en:'Reach combo',             target:{Easy:8,  Normal:10, Hard:12} },
  { key:'fever_time',   th:'เวลา FEVER สะสม',   en:'Accumulate FEVER time',   target:{Easy:5,  Normal:7,  Hard:9 } }, // seconds
  { key:'stars',        th:'เก็บดาว (⭐) ให้ครบ', en:'Collect Stars',          target:{Easy:2,  Normal:3,  Hard:4 } },
  { key:'shields',      th:'เก็บโล่ (🛡️) ให้ครบ', en:'Collect Shields',       target:{Easy:1,  Normal:2,  Hard:3 } },
  { key:'streak',       th:'ตีโดนต่อเนื่อง',    en:'Hit streak',             target:{Easy:10, Normal:12, Hard:14} },
  { key:'no_miss',      th:'ไม่พลาดในช่วงสั้น',  en:'No miss in a window',    target:{Easy:6,  Normal:7,  Hard:8 } }, // hits without miss
  { key:'score_goal',   th:'ทำคะแนนถึง',         en:'Reach score',            target:{Easy:800,Normal:1200,Hard:1600} }
];

/* ---------- Module state ---------- */
let host = null;
let inited = false;
let alive = false;

let diff = 'Normal';
let cfg = DIFF.Normal;

let spawnAcc = 0;          // spawn accumulator (seconds)
let lastSpawnAt = 0;       // last forced spawn marker
let life = 1.6;            // lifetime seconds (per item)
let baseSize = 56;         // font size px
let goodBias = 0.70;       // prob good
let goldenRate = 0.12;     // prob golden
let powerRate  = 0.10;     // prob power

// scoring/flow
let combo = 0;
let bestCombo = 0;
let fever = false;
let missChain = 0;         // counts consecutive "miss chains" to disable fever
let shieldLeft = 0;
let feverTimeAcc = 0;      // seconds accumulated in fever

// quest
let questIdx = 0;
let questProg = 0;
let questNeed = 0;
let questKey = '';
let lang = 'TH';

// helpers
const $ = (s)=>document.querySelector(s);

/* ---------- Utilities ---------- */
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

/* ---------- Init-on-first-update ---------- */
function ensureInit(){
  if (inited) return;
  // difficulty from document body
  diff = (document.body.getAttribute('data-diff') || 'Normal');
  cfg = DIFF[diff] || DIFF.Normal;

  life = cfg.life;
  baseSize = cfg.size;
  goodBias = cfg.goodBias;
  goldenRate = cfg.goldenRate;
  powerRate  = cfg.powerRate;

  host = document.getElementById('spawnHost') || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(h); return h; })();
  host.innerHTML = '';

  combo = 0; bestCombo = 0; fever = false; missChain = 0; shieldLeft = 0; feverTimeAcc = 0;

  lang = (localStorage.getItem('hha_lang')||'TH').toUpperCase();
  setMission(0);

  inited = true;
  alive = true;
  spawnAcc = 0;
  lastSpawnAt = performance.now();
}

/* ---------- Mission / Quest ---------- */
function setMission(idx){
  questIdx = clamp(idx, 0, QUEST_POOL.length-1);
  const q = QUEST_POOL[questIdx];
  questKey = q.key;
  questNeed = q.target[diff] || q.target.Normal;
  questProg = 0;
  updateMissionLine();
  dispatchQuest('begin');
}
function nextMission(){
  if (questIdx < QUEST_POOL.length-1) {
    setMission(questIdx+1);
  } else {
    // loop or mark all done; here loop:
    setMission(0);
  }
}
function labelFor(q){
  return (lang==='EN'? q.en : q.th);
}
function updateMissionLine(){
  const q = QUEST_POOL[questIdx];
  const line = $('#missionLine');
  if (!line) return;
  line.style.display = 'inline-flex';
  line.textContent = `${labelFor(q)} • ${questProg|0}/${questNeed|0}`;
  // also send a custom event for real HUD
  try{
    window.dispatchEvent(new CustomEvent('hha:mission', { detail: { key:questKey, label:labelFor(q), progress:questProg|0, need:questNeed|0 } }));
  }catch{}
}
function addQuestProgress(k, amt=1){
  if (k !== questKey) return;
  questProg += amt;
  updateMissionLine();
  if (questProg >= questNeed) {
    // mission complete toast
    smallToast(lang==='EN' ? 'Mission Complete!' : 'ภารกิจสำเร็จ!');
    dispatchQuest('done');
    setTimeout(nextMission, 600);
  }
}
function dispatchQuest(kind){
  try{
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { kind, index: questIdx, key: questKey, progress: questProg|0, need: questNeed|0 }
    }));
  }catch{}
}

/* ---------- Fever ---------- */
function refreshFeverOnHit(){
  combo++;
  bestCombo = Math.max(bestCombo, combo);
  missChain = 0; // reset miss streak
  if (!fever && combo >= 10){ // open fever
    fever = true;
    smallToast(lang==='EN'?'FEVER ON!':'โหมด FEVER!');
    try{ window.dispatchEvent(new CustomEvent('hha:fever', { detail:{on:true} })); }catch{}
  }
}
function refreshFeverOnMiss(){
  combo = 0;
  if (fever){
    missChain++;
    if (missChain >= 3){
      fever = false;
      missChain = 0;
      smallToast(lang==='EN'?'FEVER ended':'FEVER หมดลง');
      try{ window.dispatchEvent(new CustomEvent('hha:fever', { detail:{on:false} })); }catch{}
    }
  }
}

/* ---------- Spawning ---------- */
function spawnFood(bus){
  const isPower = Math.random() < powerRate;
  if (isPower) {
    return spawnPower(pick(POWERS), bus);
  }
  const isGolden = Math.random() < goldenRate;
  const isGood = isGolden || (Math.random() < goodBias);
  const glyph = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
  return spawnOne(glyph, isGood, isGolden, bus);
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.type = 'button';
  d.textContent = glyph;

  const size = baseSize + (isGolden ? 10 : 0) + (fever ? 4 : 0);
  Object.assign(d.style, {
    position: 'absolute',
    border: '0',
    background: 'transparent',
    fontSize: size+'px',
    transform: 'translate(-50%,-50%)',
    filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    transition: 'transform .18s ease-out'
  });

  const pad = 64, W = innerWidth, H = innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x+'px';
  d.style.top  = y+'px';

  // lifetime
  const lifeMs = Math.floor((life + (isGolden?0.25:0))*1000);
  const killto = setTimeout(()=>{ try{ d.remove(); }catch{} onMiss(bus); }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto);
    try{ d.remove(); }catch{}
    explodeAt(x,y);

    if (isGood){
      const perfect = isGolden || Math.random() < 0.22;
      const basePts = perfect ? 200 : 100;
      const mult = fever ? 1.5 : 1.0;
      const pts = Math.round(basePts*mult);

      refreshFeverOnHit();
      bus?.hit?.({ kind:(perfect?'perfect':'good'), points:pts, ui:{x:ev.clientX, y:ev.clientY} });
      if (perfect) addQuestProgress('perfects', 1);
      addQuestProgress('good_hits', 1);
      addQuestProgress('streak', 1);
      addQuestProgress('no_miss', 1);

    } else { // junk
      onMiss(bus);
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d = document.createElement('button');
  d.className='spawn-emoji power';
  d.type='button';
  d.textContent = (kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style, {
    position:'absolute', border:'0', background:'transparent',
    fontSize: (baseSize+8)+'px',
    transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))'
  });
  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';

  const killto = setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((life+0.25)*1000));
  d.addEventListener('click', (ev)=>{
    clearTimeout(killto); try{ d.remove(); }catch{}
    if (kind==='shield'){
      shieldLeft++;
      smallToast(lang==='EN'?'Shield +1':'ได้โล่ +1');
      addQuestProgress('shields', 1);
      bus?.power?.('shield');
    } else { // star
      const pts = fever ? 240 : 160;
      refreshFeverOnHit();
      addQuestProgress('stars', 1);
      bus?.hit?.({ kind:'perfect', points:pts, ui:{x:ev.clientX, y:ev.clientY} });
    }
  }, { passive:true });

  host.appendChild(d);
}

/* ---------- Miss handling ---------- */
function onMiss(bus){
  if (shieldLeft > 0){
    shieldLeft--;
    smallToast(lang==='EN'?'Shield saved you!':'โล่ช่วยไว้!');
    // do not count as miss in quests when shield triggers
    return;
  }
  refreshFeverOnMiss();
  addQuestProgress('avoid_junk', 1); // นับ "การหลีกเลี่ยง" โดยเกิดตอน miss จาก junk? (ตี junk = พลาด)
  // reset some streak-like quests
  resetQuestWindowCounters();
  bus?.miss?.();
  try{ bus?.sfx?.bad?.(); }catch{}
}

function resetQuestWindowCounters(){
  // For "no_miss" we reset by setting its progress window back to 0
  if (questKey === 'no_miss') questProg = 0, updateMissionLine();
  if (questKey === 'streak')  questProg = 0, updateMissionLine();
}

/* ---------- Small HUD helpers ---------- */
function smallToast(text){
  let el = document.getElementById('hha-mini-toast');
  if (!el){
    el = document.createElement('div');
    el.id='hha-mini-toast';
    el.style.cssText = 'position:fixed;right:14px;bottom:96px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);pointer-events:none;z-index:1200;opacity:0;transition:opacity .25s';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(el._to);
  el._to = setTimeout(()=>{ el.style.opacity='0'; }, 1100);
}

/* ---------- Particles ---------- */
function explodeAt(x,y){
  const n=8+((Math.random()*6)|0);
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.textContent='✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff', textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out', opacity:'1', zIndex:1200, pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(()=>{ p.style.transform=`translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{} }, 720);
  }
}

/* ---------- External hooks (from main/hud) ---------- */
export function setFever(on){ fever = !!on; }               // optional external control
export function grantShield(n=1){ shieldLeft += n|0; }      // optional external control

/* ---------- Update loop (called by main.js) ---------- */
export function update(dt, bus){
  if (!alive) { ensureInit(); }
  if (!alive) return;

  // accumulate fever seconds
  if (fever) feverTimeAcc += dt, addQuestProgress('fever_time', dt);

  // forced spawn fallback (avoid black screen)
  const now = performance.now();
  const exists = document.querySelector('.spawn-emoji');
  if (!exists && now - lastSpawnAt > 1800){
    spawnFood(bus);
    lastSpawnAt = now;
  }

  // natural spawn
  spawnAcc += dt * (cfg.spawnPerSec || 1.5); // “desired spawns” accumulator
  while (spawnAcc >= 1){
    spawnFood(bus);
    spawnAcc -= 1;
    lastSpawnAt = performance.now();
  }

  // quest “score_goal” tracking via bus is not guaranteed → simple read from #scoreVal
  if (questKey === 'score_goal'){
    const sEl = document.getElementById('scoreVal');
    const sc = sEl ? (parseInt(sEl.textContent||'0',10)||0) : 0;
    questProg = Math.max(questProg, sc); // use max as progress
    updateMissionLine();
    if (questProg >= questNeed){ smallToast(lang==='EN'?'Mission Complete!':'ภารกิจสำเร็จ!'); dispatchQuest('done'); setTimeout(nextMission, 600); }
  }

  // quest “combo_reach” tracking — use bestCombo if HUD exposes, else local combo
  if (questKey === 'combo_reach'){
    questProg = Math.max(questProg, combo);
    updateMissionLine();
    if (questProg >= questNeed){ smallToast(lang==='EN'?'Mission Complete!':'ภารกิจสำเร็จ!'); dispatchQuest('done'); setTimeout(nextMission, 600); }
  }
}

/* ---------- Cleanup (optional) ---------- */
export function cleanup(){
  alive = false;
  try{ host && (host.innerHTML=''); }catch{}
  inited = false;
}
