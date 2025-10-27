// === /webxr-health-mobile/HeroHealth/game/modes/plate.js ===
// Plate mode: สุ่มโควตา, จานทอง, Daily Focus, Dynamic Difficulty, HUD, FX, Coach, Missions, Progress

import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';

// -------- Config / Data --------
const GROUPS = {
  grains:   { key:'grains',   th:'ธัญพืช',    en:'Grains',    color:'#f4c430', icons:['🍚','🍞','🥖','🥐','🥯','🥨','🫓','🍙','🍜','🍝'] },
  veggies:  { key:'veggies',  th:'ผัก',       en:'Vegetables',color:'#5cb85c', icons:['🥦','🥬','🥒','🌽','🫑','🍅','🥕','🧄','🧅','🍆'] },
  fruits:   { key:'fruits',   th:'ผลไม้',     en:'Fruits',    color:'#ff8a3d', icons:['🍎','🍌','🍓','🍍','🍊','🍇','🍑','🍉','🥝','🍐'] },
  protein:  { key:'protein',  th:'โปรตีน',    en:'Protein',   color:'#e74c3c', icons:['🍗','🥩','🍖','🍤','🍳','🧆','🫘','🧈','🥓','🧀'] },
  dairy:    { key:'dairy',    th:'นม/นมถั่ว', en:'Dairy',     color:'#4fc3f7', icons:['🥛','🧀','🍦','🍨','🥞','🧇','🍮','🥯','🧈','🍧'] },
};
const ORDER = ['grains','veggies','fruits','protein','dairy'];

// difficulty base quotas (will be jittered)
const BASE_QUOTA = {
  Easy:   { grains:2, veggies:3, fruits:2, protein:2, dairy:1 },
  Normal: { grains:2, veggies:3, fruits:2, protein:2, dairy:2 },
  Hard:   { grains:3, veggies:3, fruits:3, protein:3, dairy:2 },
};

// visual FX helpers (use CSS classes already in project)
function popGlow(x,y,hex='#ffd54a'){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    width:70px;height:70px;border-radius:50%;
    background:${hex};filter:blur(14px) brightness(1.1);
    mix-blend-mode:screen;opacity:.85;pointer-events:none;z-index:120;
    animation:plateGlow .45s ease-out forwards`;
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 460);
}
(function ensureKF(){
  if (document.getElementById('plateKF')) return;
  const st=document.createElement('style'); st.id='plateKF';
  st.textContent = `
  @keyframes plateGlow{from{transform:translate(-50%,-50%) scale(.7);opacity:0}
                        70%{opacity:.9}
                        to{transform:translate(-50%,-50%) scale(1.2);opacity:0}}
  `;
  document.head.appendChild(st);
})();

// -------- State (internal to this mode) --------
let ctx = null; // เก็บบน state.ctx ด้วยเพื่อ debug จาก main

// -------- Helpers --------
function cloneQuota(q){
  return { grains:q.grains|0, veggies:q.veggies|0, fruits:q.fruits|0, protein:q.protein|0, dairy:q.dairy|0 };
}
function sumQuota(q){ return ORDER.reduce((s,k)=>s+(q[k]||0),0); }
function isStageDone(q,c){ return ORDER.every(k => (c[k]||0) >= (q[k]||0)); }

function jitterQuota(base, rng = 1){
  const q = cloneQuota(base);
  // สุ่ม ±1 โดยรวมแล้วยังคงสมดุล
  ORDER.forEach(k=>{
    if (q[k]===0) return;
    const d = (Math.random()<0.5? -1: +1);
    q[k] = Math.max(0, q[k] + (Math.random()<0.5?0:d));
  });
  // อย่างน้อยรวมต้อง >= 6
  if (sumQuota(q) < 6){
    const pick = ORDER[(Math.random()*ORDER.length)|0];
    q[pick] += 1;
  }
  return q;
}

function pickDailyFocus(){
  // sync กับ Progress.genDaily() ถ้ามี หรือสุ่มเอง
  try{
    const d = Progress.genDaily?.();
    const keys = ORDER;
    if (d?.missions?.some(m=>m.kind==='acc' || m.id==='accuracy80')){
      // วันโฟกัสความแม่น -> โฟกัส 'veggies' ให้เห็นชัด
      return 'veggies';
    }
    return keys[(Math.random()*keys.length)|0];
  }catch{
    return ORDER[(Math.random()*ORDER.length)|0];
  }
}

function updateHUD(){
  const host = document.getElementById('plateTracker');
  const pills = document.getElementById('platePills');
  if (!host || !pills || !ctx) return;
  host.style.display = 'block';

  const rows = ORDER.map(k=>{
    const g = GROUPS[k]; const need = ctx.quota[k]||0; const have = ctx.count[k]||0;
    const done = have>=need;
    const color = g.color;
    const barPct = need>0? Math.min(100, have/need*100) : 100;
    return `
      <div class="pp-row" style="display:flex;align-items:center;gap:6px;margin:2px 0">
        <span style="font-size:18px">${g.icons[0]}</span>
        <span style="min-width:78px;font-weight:800">${g.th}</span>
        <span style="font-variant-numeric:tabular-nums">${have}/${need}</span>
        <span class="pp-bar" style="flex:1;height:8px;background:#0004;border-radius:99px;overflow:hidden">
          <i style="display:block;height:100%;width:${barPct}%;background:${color};opacity:${done?1:.85}"></i>
        </span>
      </div>`;
  }).join('');
  pills.innerHTML = rows;
  const tgt = document.getElementById('t_quota'); if (tgt) tgt.textContent = `โควตา (Stage ${ctx.stage})`;
}

function coachSay(coach, txtTH, txtEN){
  try{
    if (!coach?.say) return;
    const lang = (localStorage.getItem('hha_lang')||'TH');
    coach.say(lang==='EN'?txtEN:txtTH);
  }catch{}
}

// Dynamic difficulty: จากความแม่นยำของสเตจก่อนหน้า
function adaptNextQuota(prevAcc){
  const base = BASE_QUOTA[ctx.difficulty] || BASE_QUOTA.Normal;
  let q = jitterQuota(base);
  if (prevAcc>=0.85){
    // เพิ่มโควตากลุ่มแบบสุ่ม +1 (ไม่เกิน 1 กลุ่ม)
    const k = ORDER[(Math.random()*ORDER.length)|0];
    q[k] += 1;
  }else if (prevAcc<0.60){
    // ลดรวมลง -1 ถ้าทำได้
    const keys = ORDER.filter(k=>q[k]>0);
    if (keys.length){
      const k = keys[(Math.random()*keys.length)|0];
      q[k] = Math.max(0, q[k]-1);
    }
  }
  return q;
}

function beginStage(state, coach){
  const base = BASE_QUOTA[state.difficulty] || BASE_QUOTA.Normal;
  // โควตาพื้นฐาน + ปรับจากสเตจก่อนหน้า
  const q = ctx.stage===1 ? jitterQuota(base) : adaptNextQuota(ctx.prevAcc||0.75);

  // Daily Focus
  if (!ctx.dailyFocus) ctx.dailyFocus = pickDailyFocus();
  // โฟกัสวันนั้น +1 และโบนัสคะแนน
  q[ctx.dailyFocus] = (q[ctx.dailyFocus]||0) + 1;

  // Golden Plate: ถ้าสเตจก่อนๆ ไม่มี miss ต่อเนื่อง >= 3
  ctx.goldenPlate = (ctx.consecCleanStages>=3);
  ctx.consecCleanStages = Math.min(3, ctx.consecCleanStages); // clamp
  ctx.quota = q;
  ctx.count = { grains:0, veggies:0, fruits:0, protein:0, dairy:0 };
  ctx.stageStartHits = ctx.totalHits;
  ctx.stageBad = 0;

  updateHUD();
  coachSay(coach,
    `จานที่ ${ctx.stage}! วันนี้เน้น ${GROUPS[ctx.dailyFocus].th}`,
    `Plate ${ctx.stage}! Daily focus: ${GROUPS[ctx.dailyFocus].en}`
  );
}

function endStage(state, coach){
  // accuracy stage
  const hits = Math.max(1, (ctx.totalHits - ctx.stageStartHits));
  const justGood = Math.max(0, ctx.stageGood - (ctx.prevStageGood||0));
  const justPerfect = Math.max(0, ctx.stagePerfect - (ctx.prevStagePerfect||0));
  const justBad = Math.max(0, ctx.stageBad);
  const acc = Math.max(0, Math.min(1, (justGood + justPerfect) / (justGood + justPerfect + justBad || 1)));
  ctx.prevAcc = acc;

  if (ctx.stageBad===0) ctx.consecCleanStages++; else ctx.consecCleanStages = 0;

  // แจ้ง Progress
  try{ Progress.event('plate_complete', { stage: ctx.stage, acc }); }catch{}

  // โค้ช & เอฟเฟกต์
  coachSay(coach,
    ctx.goldenPlate ? 'เยี่ยม! จานทองสมบูรณ์!' : 'จานสมบูรณ์!',
    ctx.goldenPlate ? 'Amazing! Golden plate!' : 'Plate complete!'
  );

  // เตรียมสเตจถัดไป
  ctx.stage++;
  ctx.goldenPlate = false;
  ctx.prevStageGood = ctx.stageGood;
  ctx.prevStagePerfect = ctx.stagePerfect;
  beginStage(state, coach);
}

function biasPickNeeded(){
  // เลือกกลุ่มที่ "ยังขาด" มีน้ำหนักมากกว่า
  const weights = [];
  for (const k of ORDER){
    const need = ctx.quota[k]||0, have = ctx.count[k]||0;
    const deficit = Math.max(0, need - have);
    const w = deficit>0 ? (2 + deficit) : 1; // ถ้ายังขาด ให้น้ำหนัก 3.. มากกว่า decoy
    weights.push({k, w});
  }
  // roulette wheel
  const sum = weights.reduce((s,o)=>s+o.w,0);
  let r = Math.random()*sum;
  for (const o of weights){ r-=o.w; if (r<=0) return o.k; }
  return weights[0].k;
}

// -------- Public API (used by main.js) --------
export function init(state, hud, diff){
  // ตั้งค่า context
  ctx = state.ctx.plate = {
    difficulty: state.difficulty,
    stage: 1,
    quota: cloneQuota(BASE_QUOTA[state.difficulty] || BASE_QUOTA.Normal),
    count: { grains:0, veggies:0, fruits:0, protein:0, dairy:0 },
    dailyFocus: null,
    goldenPlate: false,
    stageGood: 0, stagePerfect: 0, stageBad: 0,
    prevStageGood: 0, prevStagePerfect: 0,
    prevAcc: 0.75, consecCleanStages: 0,
    totalHits: 0,
    bias: 0.7,          // โอกาสสุ่มออกชิ้นที่ "ต้องการ" สูงขึ้น
    scoreMul: 1.0,      // global multiplier
    lifeBase: diff?.life || 3000
  };
  // เริ่มสเตจแรก
  beginStage(state, hud?.coach || null);
  // แสดง HUD plate
  const wrap = document.getElementById('plateTracker'); if (wrap) wrap.style.display='block';
  updateHUD();
}

export function cleanup(state){
  const wrap = document.getElementById('plateTracker'); if (wrap) wrap.style.display='none';
  state.ctx.plate = null;
  ctx = null;
}

export function tick(state){
  // ไม่มี timeline พิเศษต่อวินาทีใน plate (ใช้ main tick อยู่แล้ว)
  // แต่สามารถปล่อยคอมเมนต์ไว้อัพเดต UI ถ้าต้องการ
  if (!ctx) return;
}

// สุ่ม meta สำหรับ spawn หนึ่งชิ้น
export function pickMeta(diff, state){
  if (!ctx) return { char:'🍽️', life: diff.life };

  // ตัดสินว่าจะออก "ชิ้นที่ต้องการ" หรือ "decoy"
  const needFirst = Math.random() < ctx.bias;
  let gkey;
  if (needFirst){
    gkey = biasPickNeeded();
  }else{
    // decoy: สุ่มอะไรมาจากทุกหมู่
    gkey = ORDER[(Math.random()*ORDER.length)|0];
  }
  const g = GROUPS[gkey];
  const char = g.icons[(Math.random()*g.icons.length)|0];

  // item life: ปรับตาม golden / difficulty เล็กน้อย
  let life = Math.max(900, Math.round((ctx.lifeBase||3000) * (needFirst? 1.0 : 0.9)));

  // golden effect per item เฉพาะ “จานทอง” → แค่ visual
  const golden = !!ctx.goldenPlate && needFirst;

  return {
    id: `${gkey}_${Date.now()}_${(Math.random()*9999)|0}`,
    char,
    groupId: gkey,
    good: true,       // ให้ main รู้ว่าเป็น item ที่นับได้ (ไม่ใช่ขยะ)
    golden,
    life
  };
}

// เมื่อผู้เล่นคลิกไอคอน
// return one of: 'perfect' | 'good' | 'ok' | 'bad' | 'power'
export function onHit(meta, { score, sfx, coach }, state, hud){
  if (!ctx) return 'ok';
  ctx.totalHits++;

  const { groupId, golden } = meta;
  const need = ctx.quota[groupId]||0;
  const have = ctx.count[groupId]||0;

  const r = (el)=>{ // center for FX
    const b = el.getBoundingClientRect?.(); if (!b) return {x:innerWidth/2,y:innerHeight/2};
    return { x: b.left+b.width/2, y: b.top+b.height/2 };
  };

  // คลิกรายการที่ "ยังไม่ครบโควตา"
  if (have < need){
    ctx.count[groupId] = have + 1;

    // คะแนนพื้นฐาน + โบนัส focus + จานทอง
    let base = 10;
    if (groupId === ctx.dailyFocus) base = Math.round(base * 1.2);
    if (golden || ctx.goldenPlate) base = Math.round(base * 1.5);

    try{ sfx.play?.('sfx-good'); }catch{}
    ctx.stageGood++;

    // ถ้าชิ้นนี้ทำให้ "ครบโควตากลุ่มสุดท้าย" → perfect + ปิดจาน
    if (isStageDone(ctx.quota, ctx.count)){
      ctx.stagePerfect++;
      // เอาไว้ให้ main เพิ่มเอฟเฟกต์คอมโบ/คะแนน (return 'perfect')
      // แจ้ง Progress ว่าจานสมบูรณ์
      try{ Progress.event('plate_complete', { stage: ctx.stage }); }catch{}
      // popup FX
      const {x,y} = r(meta._el||document.body);
      popGlow(x,y,'#ffe082');

      // เตรียมสเตจถัดไป
      endStage(state, coach);
      updateHUD();
      return 'perfect';
    }

    updateHUD();
    return 'good';
  }

  // คลิกเกินโควตา → bad
  ctx.stageBad++;
  try{ sfx.play?.('sfx-bad'); }catch{}
  coachSay(coach, 'โควตากลุ่มนี้ครบแล้วนะ', 'Quota filled for this group');
  return 'bad';
}

// (optional) durations for powerbar (ถ้ามาใช้ร่วมในอนาคต)
export function getPowerDurations(){
  // plate ยังไม่ใช้แถบพลังหลักของ groups แต่ส่งค่าไว้เผื่อ UI reuse
  return { x2: 6, freeze: 3, magnet: 2 };
}
