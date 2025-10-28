// === Hero Health Academy — game/modes/plate.js (multi-group accept + overfill penalty + HUD bars) ===
import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

export const name = 'plate';

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
const rnd   = (arr)=>arr[(Math.random()*arr.length)|0];
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const L = (lang)=>({
  TH:{veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม',
      plateDone:'จัดจานครบ!', overfill:'เกินโควตา!'},
  EN:{veggies:'Veggies', fruits:'Fruits', grains:'Grains', protein:'Protein', dairy:'Dairy',
      plateDone:'Plate Complete!', overfill:'Over quota!'}
})[lang||'TH'];

function makeQuotas(diffKey='Normal'){
  if (diffKey==='Easy')   return { veggies:4, fruits:3, grains:2, protein:2, dairy:1 }; // 12
  if (diffKey==='Hard')   return { veggies:6, fruits:4, grains:3, protein:3, dairy:1 }; // 17
  /* Normal */            return { veggies:5, fruits:3, grains:2, protein:2, dairy:1 }; // 13
}

// กลุ่มที่ยัง “ขาด” (need - have > 0)
function lackingGroups(ctx){
  const out = [];
  for (const g of GROUPS){
    const need = (ctx.need[g]||0), have = (ctx.have[g]||0);
    if (need>0 && have<need) out.push(g);
  }
  return out;
}

// ---------- HUD ----------
function renderPlateHUD(state){
  const host = document.getElementById('platePills'); if (!host) return;
  const Lang = L(state.lang);
  const pills = GROUPS.map(g=>{
    const have = state.ctx.have[g]||0;
    const need = state.ctx.need[g]||0;
    const done = need>0 && have>=need;
    const barW = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    return `<div class="pill ${done?'ok':''}">
      <b>${Lang[g]}</b>
      <span>${have}/${need}</span>
      <i style="width:${barW}%"></i>
    </div>`;
  }).join('');
  host.innerHTML = pills;
}

function flashLine(msg){
  const line = document.getElementById('missionLine'); if (!line) return;
  line.textContent = msg;
  line.style.display = 'block';
  setTimeout(()=>{ line.style.display='none'; }, 950);
}

// ---------- Public API ----------
export function init(state={}, hud, diff){
  // เปิด HUD ของเพลต
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'block';
  // ซ่อน targetWrap (ไม่บังคับทีละหมวด)
  const tgt = document.getElementById('targetWrap'); if (tgt) tgt.style.display = 'none';

  // ตั้งค่าโควตาเริ่มต้น
  state.ctx = state.ctx || {};
  state.ctx.need = makeQuotas(state.difficulty||'Normal');
  state.ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  state.ctx.overfillCount = 0;
  state.ctx.perfectPlates = 0;

  renderPlateHUD(state);

  // แจ้งเริ่มรันให้ Progress (เผื่อ UI ภายนอกต้อง sync)
  try{
    Progress.emit('run_start', {
      mode:'plate',
      difficulty: state.difficulty,
      missions: (Progress.runCtx?.missions||[])
    });
  }catch{}
}

export function cleanup(){
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'none';
}

// ชิ้นใหม่: โอกาสสูงที่จะสุ่ม “หมวดยังขาด”
export function pickMeta(diff={}, state={}){
  const ctx = state.ctx || {};
  const lack = lackingGroups(ctx);
  const isLackPick = Math.random() < 0.75 && lack.length>0;
  const group = isLackPick ? rnd(lack) : rnd(GROUPS);

  const char = rnd(POOLS[group]);
  const golden = Math.random() < 0.08;

  const need = (ctx.need[group]||0), have = (ctx.have[group]||0);
  const withinQuota = need>0 && have<need;

  return {
    id: `${group}_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: group,
    label: group,
    groupId: group,
    good: withinQuota,          // ดีเมื่อยังไม่ครบโควตา
    golden,
    life: (typeof diff.life==='number') ? diff.life : 3000
  };
}

// แตะไอคอน: ยอมรับ “ทุกรายการ” ที่อยู่ในหมวดที่ยังขาดโควตา
export function onHit(meta={}, systems={}, state={}){
  const { score, sfx } = systems;
  const Lang = L(state.lang);
  const ctx = state.ctx || (state.ctx={have:{},need:{}});

  const need = (ctx.need[meta.groupId]||0);
  const have = (ctx.have[meta.groupId]||0);
  const withinQuota = need>0 && have<need;

  if (withinQuota){
    // นับเข้าหมวดนั้น (Golden = โอกาสให้ Perfect ทาง main ผ่านคะแนน/เอฟเฟกต์)
    ctx.have[meta.groupId] = have + 1;
    renderPlateHUD(state);

    // ตรวจจบ “จาน”
    if (isPlateComplete(ctx)){
      flashLine(Lang.plateDone);
      try{ score.add?.(40); }catch{}
      try{ sfx?.play?.('sfx-perfect'); }catch{}
      // เริ่มจานใหม่ (scale ความท้าทายเล็กน้อย)
      nextPlate(ctx, state.difficulty||'Normal');
      renderPlateHUD(state);
    }else{
      try{ sfx?.play?.(meta.golden?'sfx-perfect':'sfx-good'); }catch{}
    }

    return meta.golden ? 'perfect' : 'good';
  }

  // เกินโควตา → บทลงโทษ (ให้ main หักคอมโบผ่านผล 'bad')
  ctx.overfillCount = (ctx.overfillCount||0) + 1;
  flashLine('⚠ ' + Lang.overfill);
  try{ sfx?.play?.('sfx-bad'); }catch{}
  return 'bad';
}

export function tick(/*state, systems, hud*/){
  // plate ยังไม่ต้องใช้ tick ตอนนี้
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
  // เพิ่มโควตาเล็กน้อยในรอบถัดไป (ยังคง easy-friendly)
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
  ctx.overfillCount = 0;
}

// ------- Shared FX hooks (tilt + shatter) -------
export const fx = {
  onSpawn(el/*, state*/){ add3DTilt(el); },
  onHit(x, y/*, meta, state*/){ shatter3D(x, y); }
};
