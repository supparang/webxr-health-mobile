// === Hero Health Academy — game/modes/plate.js (easy mini-quests, 20 items/group) ===
import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';

// ---------- Item pools (20 each) ----------
const VEGGIES = [
  '🥦','🥕','🥒','🌽','🍅','🍆','🥗','🥬','🥔','🧅',
  '🧄','🍄','🌶️','🥒','🥕','🥦','🥬','🍅','🥔','🍄'
];
const FRUITS = [
  '🍎','🍌','🍓','🍇','🍉','🍍','🍑','🍊','🍐','🥭',
  '🍒','🍋','🥝','🍈','🫐','🍎','🍌','🍊','🍇','🍍'
];
const GRAINS = [
  '🍞','🥖','🥨','🍚','🍙','🍘','🍜','🍝','🍛','🌯',
  '🌮','🥞','🫓','🥪','🥯','🍞','🍚','🍝','🥖','🥨'
];
const PROTEIN = [
  '🍗','🍖','🥩','🍳','🐟','🍤','🫘','🥜','🧆','🌭',
  '🍣','🍢','🥓','🧆','🍗','🍳','🐟','🍤','🫘','🥩'
];
const DAIRY = [
  '🥛','🧀','🍨','🍦','🥛','🧀','🥛','🧀','🍧','🍦',
  '🥛','🧀','🍨','🍦','🥛','🧀','🥛','🧀','🍧','🍦'
];

const GROUPS = ['veggies','fruits','grains','protein','dairy'];
const POOLS  = { veggies:VEGGIES, fruits:FRUITS, grains:GRAINS, protein:PROTEIN, dairy:DAIRY };

// ---------- Helpers ----------
const rnd = (arr)=>arr[(Math.random()*arr.length)|0];
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

function langName(lang){
  return {
    TH: {veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม'},
    EN: {veggies:'Veggies', fruits:'Fruits', grains:'Grains', protein:'Protein', dairy:'Dairy'}
  }[lang||'TH'];
}

// โควตาตามความยาก (ทั้งหมด ~10–14 ชิ้น/จาน)
function makeQuotas(diffKey='Normal'){
  if (diffKey==='Easy')   return { veggies:4, fruits:3, grains:2, protein:2, dairy:1 }; // 12
  if (diffKey==='Hard')   return { veggies:6, fruits:4, grains:3, protein:3, dairy:1 }; // 17
  /* Normal */            return { veggies:5, fruits:3, grains:2, protein:2, dairy:1 }; // 13
}

// หาว่ากลุ่มไหนต้องการมากสุด (เป้าหมายถัดไป)
function pickTargetGroup(ctx){
  let best = null, bestNeed = -1;
  for (const g of GROUPS){
    const need = (ctx.need[g]||0) - (ctx.have[g]||0);
    if (need > bestNeed){ bestNeed = need; best = g; }
  }
  return bestNeed>0 ? best : null;
}

// อัปเดต HUD (#plateTracker)
function renderPlateHUD(state){
  const host = document.getElementById('platePills'); if (!host) return;
  const L = langName(state.lang);
  const pills = GROUPS.map(g=>{
    const have = state.ctx.have[g]||0;
    const need = state.ctx.need[g]||0;
    const done = have>=need && need>0;
    const barW = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    return `<div class="pill ${done?'ok':''}">
      <b>${L[g]}</b>
      <span>${have}/${need}</span>
      <i style="width:${barW}%"></i>
    </div>`;
  }).join('');
  host.innerHTML = pills;
}

// ยิงข้อความบอกผู้เล่นชั่วคราว
function flashLine(msg){
  const line = document.getElementById('missionLine'); if (!line) return;
  line.textContent = msg;
  line.style.display = 'block';
  setTimeout(()=>{ line.style.display='none'; }, 900);
}

// ---------- Easy mini-quests (5 → pick 3 per run) ----------
function applyEasyMiniQuests(lang='TH'){
  // ใช้ชนิด mission ที่ Progress.event('hit', …) อัปเดตได้แน่นอน
  const pool = [
    { id:'pl_target8',  th:'วางถูกหมวดรวม 8 ชิ้น',     en:'Collect 8 target items',  need:8,  type:'count_target' },
    { id:'pl_veg2',     th:'ใส่ผัก 2 ส่วน',             en:'Add 2 veggie portions',   need:2,  type:'count_group', group:'veggies' },
    { id:'pl_combo6',   th:'ทำคอมโบถึง x6',            en:'Reach combo x6',          need:6,  type:'reach_combo' },
    { id:'pl_perfect2', th:'Perfect 2 ครั้ง',            en:'2 Perfects',              need:2,  type:'count_perfect' },
    { id:'pl_golden1',  th:'เก็บ Golden 1 ชิ้น',         en:'Hit 1 Golden',            need:1,  type:'count_golden' },
  ];
  // สุ่ม 3 และสลับเข้าไปแทน runCtx.missions เฉพาะโหมด plate
  try{
    const rc = Progress.runCtx;
    if (!rc || rc.mode!=='plate') return;
    const shuffled = pool.slice().sort(()=>Math.random()-0.5).slice(0,3)
      .map(m=>({ ...m, label:(lang==='EN'?m.en:m.th), prog:0, done:false }));
    rc.missions = shuffled;
    // แจ้งให้ UI เควสรีเฟรช (main.js renderMissions ฟัง 'run_start')
    Progress.emit('run_start', { mode:'plate', difficulty: rc.difficulty, missions: shuffled });
  }catch{}
}

// ---------- Public API required by main.js ----------
export function init(state, hud, diff){
  // เปิด HUD เพจเพลต
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'block';
  const tgt = document.getElementById('targetWrap');
  if (tgt) tgt.style.display = 'none';

  // สร้างโควตาและตัวนับ
  state.ctx = state.ctx || {};
  state.ctx.need = makeQuotas(state.difficulty||'Normal');
  state.ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  state.ctx.target = pickTargetGroup(state.ctx);

  renderPlateHUD(state);

  // บังคับใช้ easy mini-quests สำหรับโหมด plate
  applyEasyMiniQuests(state.lang || 'TH');
}

export function cleanup(state){
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'none';
}

// สุ่ม meta สำหรับการ spawn 1 ชิ้น
export function pickMeta(diff, state){
  const ctx = state.ctx || {};
  const target = ctx.target || pickTargetGroup(ctx) || rnd(GROUPS);

  // โอกาส 70% ออกเป็นกลุ่มเป้าหมาย เพื่อให้ผู้เล่นทำเควส/โควตาได้ทันเวลา
  const isTargetPick = Math.random() < 0.70;
  const group = isTargetPick ? target : rnd(GROUPS);

  const char = rnd(POOLS[group]);
  const golden = Math.random() < 0.08; // 8% golden ให้เควส golden ทำได้จริง

  return {
    id: `${group}_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: group,
    label: group,
    groupId: group,
    good: group === target,           // นับ “ถูกหมวด” เฉพาะเมื่อเป็นกลุ่มเป้าหมาย
    golden,
    life: diff?.life ?? 3000,
  };
}

// เมื่อผู้เล่นแตะไอคอน
export function onHit(meta, systems, state/*, hud*/){
  const { score, sfx } = systems;
  const ctx = state.ctx;

  // แตะถูก “กลุ่มเป้าหมาย” เท่านั้นถึงจะนับเป็นวางลงจาน
  if (meta.groupId === ctx.target){
    ctx.have[meta.groupId] = (ctx.have[meta.groupId]||0) + 1;

    // Golden = โอกาส Perfect
    const perfect = !!meta.golden || Math.random() < 0.18;
    renderPlateHUD(state);

    // ตรวจครบทั้งจานหรือยัง
    if (isPlateComplete(ctx)){
      flashLine(state.lang==='EN' ? 'Plate Complete!' : 'จัดจานครบ!');
      // โบนัสเล็กน้อยตอนจบจาน
      try{ score.add?.(40); }catch{}
      try{ sfx.play('sfx-perfect'); }catch{}
      // สร้างจานใหม่ (ค่อย ๆ scale ความต้องการ)
      nextPlate(ctx, state.difficulty||'Normal');
      renderPlateHUD(state);
    }else{
      try{ sfx.play(perfect?'sfx-perfect':'sfx-good'); }catch{}
    }

    // ให้ main.js ให้คะแนน/เอฟเฟกต์ต่อ และ Progress.event('hit') จะเก็บสถิติ:
    // - meta.good === true → นับ count_target
    // - meta.groupId === 'veggies' → นับ count_group: veggies
    // - meta.golden === true → นับ count_golden
    return perfect ? 'perfect' : 'good';
  }

  // แตะผิดหมวด
  try{ sfx.play('sfx-bad'); }catch{}
  return 'bad';
}

export function tick(/*state, systems, hud*/){
  // ไม่มีกลไกเวลาพิเศษสำหรับเพลตในแต่ละวินาทีตอนนี้
}

// ---------- Internals ----------
function isPlateComplete(ctx){
  for (const g of GROUPS){
    const need = ctx.need[g]||0;
    const have = ctx.have[g]||0;
    if (need>0 && have<need) return false;
  }
  return true;
}

function nextPlate(ctx, diffKey){
  // เลเวลถัดไป เพิ่มโควตาเล็กน้อย (easy-friendly)
  const base = makeQuotas(diffKey);
  const bump = { Easy:0, Normal:1, Hard:1 }[diffKey] ?? 1;
  ctx.need = {
    veggies: base.veggies + bump,
    fruits:  base.fruits  + (bump?1:0),
    grains:  base.grains,
    protein: base.protein,
    dairy:   base.dairy
  };
  ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  ctx.target = pickTargetGroup(ctx);
}
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

export const fx = {
  onSpawn(el/*, state*/){
    add3DTilt(el);
  },
  onHit(x, y/*, meta, state*/){
    shatter3D(x, y);
  }
};
