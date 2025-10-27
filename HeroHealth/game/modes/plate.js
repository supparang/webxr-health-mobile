// === Hero Health Academy — game/modes/plate.js ===
// แนวคิด: สุ่มไอคอนอาหารจาก 5 หมวด (20 ชิ้น/หมวด)
// - "good" = ไอเทมตรงกับโควตาที่เหลืออยู่ของหมวด (กำลังต้องการ)
// - ครบโควตาทุกหมวด => แจ้ง Progress 'plate_complete' และรีเซ็ตโควตาชุดใหม่
// - มีโอกาสทอง (golden) ให้คืนผล 'perfect' ได้

import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';

const RNG = () => Math.random();

const GROUPS = {
  veggies: {
    nameTH: 'ผัก',
    list: [
      '🥦','🥬','🥕','🧅','🧄','🌶️','🍄','🌽','🥒','🫑',
      '🥗','🍆','🥔','🫛','🥒','🥕','🌱','🥬','🥦','🍄'
    ]
  },
  fruits: {
    nameTH: 'ผลไม้',
    list: [
      '🍎','🍓','🍇','🍉','🍌','🍍','🍑','🍊','🍐','🥝',
      '🍒','🍋','🫐','🥭','🍈','🍏','🍓','🍇','🍊','🍍'
    ]
  },
  grains: {
    nameTH: 'ธัญพืช/แป้ง',
    list: [
      '🍞','🥖','🥯','🥨','🍚','🍙','🍘','🍜','🍝','🥐',
      '🫓','🍩','🥞','🧇','🍔','🌯','🌮','🍕','🍟','🍚'
    ]
  },
  protein: {
    nameTH: 'โปรตีน',
    list: [
      '🍗','🍖','🥩','🍣','🍤','🧆','🥚','🧈','🥓','🍛',
      '🍢','🥙','🍜','🍱','🍤','🍗','🥩','🍣','🥚','🍛'
    ]
  },
  dairy: {
    nameTH: 'นม/ผลิตภัณฑ์นม',
    list: [
      '🧀','🥛','🍦','🍨','🍧','🍮','🍰','🥞','🧈','🥛',
      '🧀','🥛','🍦','🍨','🍧','🍮','🧀','🥛','🍦','🍨'
    ]
  }
};

// โควตาเริ่มต้นต่อรอบ (คิดแบบสัดส่วนจาน)
const BASE_QUOTA = {
  Easy:   { veggies:3, fruits:2, grains:3, protein:2, dairy:1 },
  Normal: { veggies:3, fruits:2, grains:3, protein:2, dairy:1 },
  Hard:   { veggies:4, fruits:2, grains:3, protein:3, dairy:1 }
};

const GOLDEN_CHANCE = 1/12;   // โอกาสทอง

// ctx ภายในโหมด plate จะเก็บไว้ใน state.ctx.plate
function ensureCtx(state, diff){
  if (!state.ctx.plate){
    state.ctx.plate = {
      quota: { ...BASE_QUOTA[state.difficulty] },
      // สำหรับ mini-quests เฉพาะโหมด plate (สุ่ม 3 จาก 5 — ภายในโหมด)
      // หมายเหตุ: ระบบภารกิจหลักมาจาก progression.beginRun() อยู่แล้ว
      miniPool: [
        { id:'mq_veg3',    th:'ใส่ผักให้ครบ 3 ส่วน',  en:'Add 3 veggie portions',     need:3,   type:'add_group', group:'veggies', prog:0, done:false },
        { id:'mq_combo8',  th:'ทำคอมโบ x8',           en:'Reach combo x8',            need:8,   type:'reach_combo', prog:0, done:false },
        { id:'mq_perfect3',th:'Perfect 3 ครั้ง',       en:'3 Perfects',                need:3,   type:'count_perfect', prog:0, done:false },
        { id:'mq_time45',  th:'อยู่รอด 45 วินาที',     en:'Survive 45s',               need:45,  type:'survive_time', prog:0, done:false },
        { id:'mq_any10',   th:'วางให้ถูก 10 ชิ้น',     en:'10 correct hits',           need:10,  type:'count_good', prog:0, done:false },
      ],
      mini: [],
      lastTickSec: 0
    };
    // สุ่ม 3 จาก 5
    const arr = state.ctx.plate.miniPool.slice().sort(()=>Math.random()-0.5).slice(0,3);
    state.ctx.plate.mini = arr;
  }
  return state.ctx.plate;
}

function isAllZero(quota){
  for (const k of Object.keys(quota)){ if ((quota[k]|0) > 0) return false; }
  return true;
}

function renderQuotaUI(state){
  const wrap = document.getElementById('plateTracker');
  const pills = document.getElementById('platePills');
  if (!wrap || !pills) return;
  wrap.style.display = 'block';
  const q = state.ctx.plate.quota;
  const names = { veggies:'🥦', fruits:'🍎', grains:'🍞', protein:'🍗', dairy:'🥛' };
  pills.innerHTML = Object.keys(names).map(k=>{
    const left = q[k]|0;
    const face = names[k];
    const span = `<span class="pill" data-k="${k}" title="${GROUPS[k].nameTH}">${face}×${left}</span>`;
    return span;
  }).join(' ');
}

function resetQuota(state){
  state.ctx.plate.quota = { ...BASE_QUOTA[state.difficulty] };
  renderQuotaUI(state);
}

// ====== Public API ======

export function init(state, hud, diff){
  ensureCtx(state, diff);
  renderQuotaUI(state);
  // เปิดตัวชี้นำโหมด
  const targetWrap = document.getElementById('targetWrap');
  if (targetWrap) { targetWrap.style.display='none'; }
}

export function cleanup(state, hud){
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display='none';
}

export function tick(state, systems, hud){
  // อัปเดต mini-quest แบบเวลา (survive_time)
  const secNow = Math.floor((performance?.now?.()||Date.now())/1000);
  const ctx = state.ctx.plate;
  if (!ctx) return;
  if (ctx.lastTickSec !== secNow){
    ctx.lastTickSec = secNow;
    for (const m of ctx.mini){
      if (m.done) continue;
      if (m.type==='survive_time'){
        m.prog = (m.prog||0) + 1;
        if (m.prog >= m.need){ m.done = true; Progress.addXP(40); }
      }
    }
  }
}

export function pickMeta(diff, state){
  const ctx = ensureCtx(state, diff);
  const q = ctx.quota;

  // เลือกหมวดที่จะ spawn:
  // 65% โอกาสเลือกหมวดที่ยัง "ต้องการ" (quota > 0), 35% อื่น ๆ
  const needKeys = Object.keys(q).filter(k=> (q[k]|0) > 0 );
  const allKeys  = Object.keys(GROUPS);

  let key;
  if (needKeys.length && RNG() < 0.65){
    key = needKeys[(Math.random()*needKeys.length)|0];
  }else{
    key = allKeys[(Math.random()*allKeys.length)|0];
  }

  const pool = GROUPS[key].list;
  const char = pool[(Math.random()*pool.length)|0];

  const golden = RNG() < GOLDEN_CHANCE;
  const meta = {
    id: `${key}_${Math.random().toString(36).slice(2,7)}`,
    label: GROUPS[key].nameTH,
    char,
    groupId: key,
    good: (q[key]|0) > 0,         // ต้องการหมวดนี้อยู่ไหม
    golden,
    life: diff.life || 3000
  };
  return meta;
}

export function onHit(meta, sys, state, hud){
  // ถ้าตรงหมวดที่ต้องการ => ลดโควตา
  const ctx = state.ctx.plate;
  if (!ctx) return 'ok';

  let result = 'ok';
  if (meta.good){
    // โอกาส perfect ถ้าเป็นทอง หรือสุ่มเล็กน้อย
    const perfect = meta.golden || (Math.random() < 0.2);
    ctx.quota[meta.groupId] = Math.max(0, (ctx.quota[meta.groupId]|0) - 1);
    renderQuotaUI(state);
    result = perfect ? 'perfect' : 'good';

    // นับ mini-quests เฉพาะโหมด
    for (const m of ctx.mini){
      if (m.done) continue;
      if (m.type==='add_group' && m.group===meta.groupId){
        m.prog = (m.prog||0) + 1;
        if (m.prog >= m.need){ m.done = true; Progress.addXP(40); }
      }
      if (m.type==='count_good'){
        m.prog = (m.prog||0) + 1;
        if (m.prog >= m.need){ m.done = true; Progress.addXP(40); }
      }
      if (m.type==='count_perfect' && perfect){
        m.prog = (m.prog||0) + 1;
        if (m.prog >= m.need){ m.done = true; Progress.addXP(40); }
      }
      if (m.type==='reach_combo'){
        // โปรยให้ progression อัปเดต combo ด้วย (main.js ส่ง comboNow อยู่แล้ว)
        // ที่นี่รอรับจาก progression ไม่ต้องทำอะไรเพิ่มเติม
      }
    }

    // ครบทุกหมวดแล้ว รีเซ็ต + แจ้ง progression
    if (isAllZero(ctx.quota)){
      Progress.event('plate_complete', {});
      // โบนัสเล็กน้อย
      try{ sys.score.add?.(50); }catch{}
      resetQuota(state);
    }
  }else{
    // กดไม่ตรงหมวดที่ต้องการ
    result = meta.golden ? 'ok' : 'bad';
  }

  return result;
}

// (ออปชัน) Utility ให้หน้า Help หรืออื่น ๆ เรียกดูอายุพลัง ในโหมด plate ไม่มี powers
export function getPowerDurations(){ return {}; }
