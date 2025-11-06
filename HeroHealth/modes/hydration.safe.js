// === Hero Health — modes/hydration.quest.js (Production, 2025-11-07) ===
// Water Level Control + Win-on-Green + 9 Hydration MiniQuests + Zone-based judgement
// Dependencies (already in project):
//  - ../vr/mode-factory.js  (spawner, anti-overlap, score/fever hooks, timers)
//  - ../vr/particles.js     (Particles.* optional; we fallback gracefully)
// HUD events expected by index.vr.html: hha:water, hha:goal (multiTargets), hha:quest, hha:fever, hha:score

import { boot as factoryBoot } from '../vr/mode-factory.js';
import * as FX from '../vr/particles.js';
const Particles = FX.Particles || FX || { burst(){}, spark(){}, smoke(){} };

// ---------------- Icons (good vs avoid) ----------------
const HYDRATE = ['💧','🚰','🧊','🫗','🥛','🍵','🫖','🍊','🍉','🍋','🥒','🍎','🍐','🥝','🍇','🍍'];
const AVOID   = ['🧋','🥤','🍹','☕️','🧃','🍷','🍺','🍸','🍾','🍫','🍭'];
const ALL     = [...HYDRATE, ...AVOID];

// ---------------- Difficulty config ----------------
const CFG = {
  easy:   { zone:[40,70], targetInZone:20, decayPerSec:3.0, duration:60, pickQuests:3 },
  normal: { zone:[45,65], targetInZone:30, decayPerSec:4.0, duration:60, pickQuests:4 },
  hard:   { zone:[48,62], targetInZone:40, decayPerSec:5.5, duration:75, pickQuests:5 },
};

// Zone-based effect when clicking items
const EFFECT = {
  good: { deltaLevel: +11, score: +10, fever: 2 },
  bad:  {
    LOW:   { deltaLevel: -22, score: -12, fever: 0, asGood:false },
    GREEN: { deltaLevel: -14, score:  -6, fever: 0, asGood:false },
    HIGH:  { deltaLevel:  -8, score:  +6, fever: 0, asGood:true  }, // treat as “release” with small reward
  }
};

// ---------------- Utils & HUD helpers ----------------
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const zoneState=(level,zl,zh)=> level<zl?'LOW':(level>zh?'HIGH':'GREEN');

function sample3(arr){ const b=arr.slice(); const o=[]; for(let i=0;i<3&&b.length;i++) o.push(b.splice(Math.floor(Math.random()*b.length),1)[0]); return o; }

function pushChips(){
  try{ window.dispatchEvent(new CustomEvent('hha:chips',{ detail:{ categories:[
    { id:'level', label:'ระดับน้ำ', active:true },
    { id:'avoid', label:'เลี่ยงหวาน/คาเฟอีน', active:false }
  ]}})); }catch{}
}
function pushWater(level, zone){ try{ window.dispatchEvent(new CustomEvent('hha:water',{ detail:{ level, zone } })); }catch{} }
function pushGoal(inZone, need){
  try{
    window.dispatchEvent(new CustomEvent('hha:goal',{ detail:{ multiTargets:[
      { id:'zone',  label:'อยู่ในโซน', have:inZone, need,   examples:['🟩','🟩','🟩'] },
      { id:'good',  label:'ชุ่มน้ำ',   have:'',     need:'', examples:sample3(HYDRATE) },
      { id:'avoid', label:'เลี่ยง',     have:'',     need:'', examples:sample3(AVOID)   },
    ]}}));
  }catch{}
}
function setQuestText(text){ try{ window.dispatchEvent(new CustomEvent('hha:quest',{ detail:{ text } })); }catch{} }

// ---------------- MiniQuests (9 total; we pick N per difficulty) ----------------
/*
  1 INZONE10  : stay GREEN 10s continuous
  2 BURST5    : collect HYDRATE 5 in 10s
  3 RECOVER   : from LOW enter GREEN within 6s
  4 NOJUNK15  : avoid AVOID 15s continuous
  5 HIGH3     : stay HIGH 3s continuous
  6 FEVER1    : trigger Fever 1 time (HYDRATE combo >=5)
  7 PERFECT20 : stay GREEN 20s PERFECT (reset on leave)
  8 STREAK10  : HYDRATE streak 10 hits
  9 OVERDRINK : from HIGH back to GREEN within 3s
*/

function createQuestPool(){
  const T = (id,label,type,need,extra={})=>({ id, label, type, need, prog:0, ...extra });
  return [
    T('INZONE10',  'อยู่ในโซนสีเขียว 10 วิ',               'inzone',  10),
    T('BURST5',    'เก็บของชุ่มน้ำ 5 ชิ้นใน 10 วิ',         'burst',    5, { window:10, history:[] }),
    T('RECOVER',   'ฟื้นจาก LOW → เข้าสู่โซนใน 6 วิ',        'recover',  1, { lowAt:-1 }),
    T('NOJUNK15',  'ไม่โดนของเลี่ยง 15 วิ',                  'nojunk',  15, { lastBadAt:0 }),
    T('HIGH3',     'รักษาโซนสูง (HIGH) 3 วิ',               'high',     3),
    T('FEVER1',    'ติดไฟลุก (Fever) 1 ครั้ง',               'fever',    1),
    T('PERFECT20', 'Perfect Balance 20 วิ',                   'perfect', 20),
    T('STREAK10',  'Hydration Streak 10 ครั้งติด',            'streak',  10),
    T('OVERDRINK', 'ลดระดับจาก HIGH กลับ GREEN ใน 3 วิ',     'overdrink',1, { highAt:-1 }),
  ];
}
function pickQuestsForDifficulty(count){
  const pool = createQuestPool();
  const out=[];
  while(out.length<count && pool.length){
    out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  return { list: out, idx: 0 };
}
function questText(q){
  if(!q) return '';
  const tgt = q.need ?? 1;
  const prog = Math.min(q.prog||0, tgt);
  return `Mini Quest ${q.id}: ${q.label} (${prog}/${tgt})`;
}

// ---------------- Fever visual helpers ----------------
function feverOn(){
  try{ window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'start'}})); }catch{}
  const hud=document.getElementById('hudWater'); const fill=document.getElementById('hudWaterFill');
  if(hud)  hud.classList.add('fire');
  if(fill) fill.style.background='linear-gradient(90deg,#ff5a00,#ffce00)';
}
function feverOff(){
  try{ window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'end'}})); }catch{}
  const hud=document.getElementById('hudWater'); const fill=document.getElementById('hudWaterFill');
  if(hud)  hud.classList.remove('fire');
  if(fill) fill.style.background='#2ad38a';
}

// ---------------- Main boot ----------------
export async function boot({ host, difficulty='normal' } = {}) {
  const cfg = CFG[difficulty] || CFG.normal;
  const [ZL, ZH] = cfg.zone;

  // Core state
  let level = 45 + Math.random()*10;    // start ~45–55%
  let secondsInZone = 0;
  let sec = 0;
  let lastBadAt = 0;
  let feverActive = false;
  let hydrateCombo = 0;                 // for fever & streak quests

  // Quests (pick N by difficulty)
  const Q = pickQuestsForDifficulty(cfg.pickQuests);
  function renderQuest(){ setQuestText( questText(Q.list[Q.idx]) ); }

  // HUD init
  pushChips();
  pushWater(level,{low:ZL,high:ZH});
  pushGoal(secondsInZone, cfg.targetInZone);
  renderQuest();

  // ---------- judge() for factory (called on hit or timeout) ----------
  function judge(hitChar, ctx){
    // timeout (no click) → gentle miss; level decay handled in sec timer
    if(!hitChar) return { good:false, scoreDelta:-2 };

    const isGood = HYDRATE.includes(hitChar);
    const isBad  = AVOID.includes(hitChar);
    const state  = zoneState(level, ZL, ZH);

    const cur = Q.list[Q.idx];

    // GOOD item
    if(isGood && !isBad){
      level = clamp(level + EFFECT.good.deltaLevel, 0, 100);
      pushWater(level,{low:ZL,high:ZH});

      // Fever combo
      hydrateCombo++;
      if(hydrateCombo>=5 && !feverActive){
        feverActive=true; feverOn();
        setTimeout(()=>{ feverActive=false; feverOff(); }, 5000);
      }

      // Quests update on GOOD
      if(cur){
        if(cur.type==='burst'){
          cur.history = (cur.history||[]).filter(t=> sec - t <= (cur.window||10));
          cur.history.push(sec);
          cur.prog = Math.max(cur.prog||0, cur.history.length);
        }
        if(cur.type==='streak'){
          cur.prog = Math.min(cur.need, (cur.prog||0)+1);
        }
        // recover handled in sec timer (LOW→GREEN)
        // perfect handled in sec timer (continuous GREEN)
      }

      renderQuest();
      return { good:true, scoreDelta:(feverActive? EFFECT.good.score*2 : EFFECT.good.score), feverDelta:EFFECT.good.fever + (feverActive?1:0) };
    }

    // BAD item
    if(isBad){
      lastBadAt = sec;
      hydrateCombo = 0;

      const rule = EFFECT.bad[state];
      level = clamp(level + rule.deltaLevel, 0, 100);
      pushWater(level,{low:ZL,high:ZH});

      // Quests affected by bad
      if(cur){
        if(cur.type==='nojunk'){ cur.prog = 0; }           // reset “no junk” streak
        if(cur.type==='streak'){ cur.prog = 0; }           // break hydrate streak
        // overdrink handled in sec timer (HIGH→GREEN within 3s)
      }

      renderQuest();
      if(rule.asGood){
        return { good:true, scoreDelta:rule.score, feverDelta:0 };
      }else{
        return { good:false, scoreDelta:rule.score, feverDelta:0 };
      }
    }

    return { good:false, scoreDelta:0 };
  }

  // ---------- per-second timer: decay, green-time, quest logic ----------
  const secTimer = setInterval(()=>{
    sec++;
    // natural decay
    level = clamp(level - cfg.decayPerSec, 0, 100);
    const state = zoneState(level, ZL, ZH);

    // main win progress: stay GREEN
    if(state==='GREEN') secondsInZone++;
    pushWater(level,{low:ZL,high:ZH});
    pushGoal(secondsInZone, cfg.targetInZone);

    // Quests update by state/time
    const q = Q.list[Q.idx];
    if(q){
      if(q.type==='inzone'){   // continuous GREEN 10s (capped per quest)
        q.prog = Math.min(q.need, (q.prog||0) + (state==='GREEN'?1:0));
        if(state!=='GREEN' && q.prog<q.need) q.prog = 0; // reset on break
      }
      if(q.type==='nojunk'){   // avoid AVOID 15s
        q.prog = Math.min(q.need, (sec - lastBadAt));
      }
      if(q.type==='high'){     // HIGH 3s continuous
        if(state==='HIGH') q.prog = Math.min(q.need, (q.prog||0)+1);
        else if(q.prog<q.need) q.prog = 0;
      }
      if(q.type==='recover'){  // from LOW → GREEN within 6s
        if(state==='LOW' && (q.lowAt??-1)<0) q.lowAt = sec;
        if(q.lowAt>0 && state==='GREEN' && (sec - q.lowAt) <= 6){
          q.prog = 1; q.lowAt = -1;
        }
        if(q.lowAt>0 && (sec - q.lowAt) > 6) q.lowAt = -1; // timeout window
      }
      if(q.type==='fever'){    // fever once
        if(feverActive) q.prog = 1;
      }
      if(q.type==='perfect'){  // PERFECT GREEN 20s (hard reset on break)
        if(state==='GREEN') q.prog = Math.min(q.need, (q.prog||0)+1);
        else if(q.prog<q.need) q.prog = 0;
      }
      if(q.type==='streak'){   // handled on GOOD/BAD; nothing here
        // keep current
      }
      if(q.type==='overdrink'){ // from HIGH → GREEN within 3s
        if(state==='HIGH' && (q.highAt??-1)<0) q.highAt = sec;
        if(q.highAt>0 && state==='GREEN' && (sec - q.highAt) <= 3){
          q.prog = 1; q.highAt = -1;
          // cool spark FX (blue)
          try{
            const host = document.querySelector('#spawnHost') || document.querySelector('a-scene') || document.body;
            Particles.spark?.(host, {x:0,y:1.2,z:-1.2}, '#7dd3fc');
          }catch{}
        }
        if(q.highAt>0 && (sec - q.highAt) > 3) q.highAt = -1;
      }

      // quest completion → next quest
      if(q.prog >= q.need){
        // simple cheer FX
        try{
          const host = document.querySelector('#spawnHost') || document.querySelector('a-scene') || document.body;
          Particles.burst?.(host, {x:0,y:1.4,z:-1.2}, '#baffc9');
        }catch{}
        Q.idx = Math.min(Q.idx+1, Q.list.length-1);
      }
      renderQuest();
    }

  }, 1000);

  // ---------- hand over to factory (spawner/score/anti-overlap/timer) ----------
  let api = await factoryBoot({
    name: 'hydration',
    host, difficulty,
    pools: { good: ALL },         // spawn combined; judge resolves
    judge,
    ui: { questMainSel: '#hudQuest' },

    timeByDiff:      { easy: cfg.duration, normal: cfg.duration, hard: cfg.duration },
    maxActiveByDiff: { easy: 2,  normal: 3,  hard: 3 },
    budgetByDiff:    { easy: 2,  normal: 3,  hard: 3 },
    goldenRate: 0.04, goodRate: 1.0,
    minDist: 0.38, slotCooldownMs: 520,
  });

  // ---------- win condition: stay GREEN enough seconds ----------
  const winCheck = setInterval(()=>{
    if(secondsInZone >= cfg.targetInZone){
      try{ api?.stop?.(); }catch{}
      clearInterval(winCheck);
    }
  }, 200);

  // ---------- cleanup ----------
  const origStop = api?.stop;
  api.stop = function(){
    try{ clearInterval(secTimer); clearInterval(winCheck); }catch{}
    feverOff();
    origStop?.call(api);
  };

  return api;
}
