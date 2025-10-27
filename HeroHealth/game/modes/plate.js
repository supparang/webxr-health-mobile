// === Hero Health Academy — modes/plate.js ===
// โหมด: จัดจานสุขภาพ (Healthy Plate)
// กลไก: แตะอาหารให้ตรง "โควตา" ของแต่ละหมู่ เมื่อครบทุกหมู่ = จานสำเร็จ -> เริ่มจานใหม่

// ---------- Config ----------
const GROUPS = {
  veggies: { th:'ผัก',   en:'Veggies', icon:'🥦', pool:['🥦','🥕','🥬','🌽','🍅','🧅','🍆','🥒'] },
  fruits:  { th:'ผลไม้', en:'Fruits',  icon:'🍎', pool:['🍎','🍌','🍇','🍉','🍍','🍓','🍒','🍊','🥭'] },
  grains:  { th:'ธัญพืช',en:'Grains',  icon:'🍚', pool:['🍚','🍞','🥖','🥐','🥯','🍙','🍘','🥞','🫓'] },
  protein: { th:'โปรตีน',en:'Protein', icon:'🍗', pool:['🍗','🥚','🥩','🐟','🍤','🧆','🥜','🫘','🥓'] },
  dairy:   { th:'นม',    en:'Dairy',   icon:'🥛', pool:['🥛','🧀','🍦','🍨','🍶'] },
};

const ORDER = ['veggies','fruits','grains','protein','dairy'];

const QUOTAS = {
  Easy:   { veggies:3, fruits:2, grains:2, protein:2, dairy:1 },
  Normal: { veggies:4, fruits:2, grains:2, protein:2, dairy:1 },
  Hard:   { veggies:4, fruits:3, grains:3, protein:3, dairy:1 },
};

// โอกาสเกิด "ทอง" (คะแนนบวกเพิ่มผ่านระบบคอมโบ/fever ใน main)
const GOLDEN_CHANCE = 0.06;

// ---------- Utils ----------
const $ = (s)=>document.querySelector(s);
const clone = (o)=>JSON.parse(JSON.stringify(o));
const randOf = (arr)=>arr[(Math.random()*arr.length)|0];

function needLeft(need, have, g){
  return Math.max(0, (need[g]||0) - (have[g]||0));
}
function allDone(need, have){
  for (const k of ORDER){
    if (needLeft(need, have, k) > 0) return false;
  }
  return true;
}

function weightPickGroup(need, have){
  // ให้น้ำหนักหมู่ที่ "ยังขาด" โควตา มากกว่าหมู่ที่เต็มแล้ว
  let totalW = 0;
  const weights = ORDER.map(k=>{
    const left = needLeft(need, have, k);
    const w = 1 + (left>0 ? left*2 : 0); // ถ้ายังขาด -> +น้ำหนัก 2 ต่อชิ้นที่ขาด
    totalW += w;
    return {k,w};
  });
  let r = Math.random()*totalW;
  for (const it of weights){
    r -= it.w;
    if (r<=0) return it.k;
  }
  return ORDER[ORDER.length-1];
}

// ---------- HUD render ----------
function renderPlateHUD(ctx, lang='TH'){
  const wrap = $('#plateTracker'); if (!wrap) return;
  const pills = $('#platePills'); if (!pills) return;

  wrap.style.display = 'block';
  $('#targetWrap')?.style && ($('#targetWrap').style.display='none');
  $('#hydroWrap')?.style && ($('#hydroWrap').style.display='none');

  const L = (lang==='EN')?'en':'th';
  const out = ORDER.map(k=>{
    const need = ctx.need[k]||0;
    const have = ctx.have[k]||0;
    const left = Math.max(0, need-have);
    const g = GROUPS[k];
    const done = left===0;
    const dots = '●'.repeat(Math.min(have,need)) + '○'.repeat(left);
    return `<span class="pill${done?' done':''}" style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px;padding:4px 8px;border-radius:999px;background:${done?'#1b5e20':'#203040'};border:1px solid #0004">
      <b>${g.icon}</b><span style="font-weight:700">${g[L]}</span>
      <span style="opacity:.85">${dots||'—'}</span>
    </span>`;
  }).join('');
  pills.innerHTML = out;
}

// ---------- State helpers ----------
function newPlateState(difficulty){
  const need = clone(QUOTAS[difficulty] || QUOTAS.Normal);
  const have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  return { need, have, stage:1 };
}

function nextPlate(ctx){
  ctx.stage += 1;
  // จานใหม่ใช้โควตาเดิม (จะปรับเพิ่มได้ภายหลังถ้าต้องการ scaling)
  ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
}

// ---------- Exports ----------
export function init(state, hud, diff){
  // เตรียม context ของโหมด
  state.ctx.plate = newPlateState(state.difficulty);
  renderPlateHUD(state.ctx.plate, state.lang);

  // โชว์แถบติดตาม
  const tracker = $('#plateTracker'); if (tracker) tracker.style.display = 'block';
}

export function cleanup(state){
  // ซ่อน HUD เฉพาะโหมด plate
  const tracker = $('#plateTracker'); if (tracker) tracker.style.display = 'none';
  // เคลียร์คอนเท็กซ์
  if (state?.ctx) state.ctx.plate = null;
}

export function tick(state, sys, hud){
  // โหมดนี้ไม่ต้องทำอะไรทุกวินาทีเป็นพิเศษ
  // (เผื่ออนาคต: ใส่ hint/coach ได้ที่นี่)
}

export function pickMeta(diff, state){
  const ctx = state.ctx.plate;
  // ถ้าเพิ่งครบจาน แต่ยังไม่ได้รีเซ็ต (edge case) ให้รีเฟรช HUD ไว้ก่อน
  if (!ctx) return { char:'❓', id:'noop', life: diff.life };

  // เลือกหมู่ด้วยน้ำหนักตามของที่ "ยังขาด"
  const gKey = weightPickGroup(ctx.need, ctx.have);
  const g = GROUPS[gKey];
  const char = randOf(g.pool);
  const golden = (Math.random() < GOLDEN_CHANCE);

  return {
    id: gKey + ':' + char,
    char,
    groupId: gKey,
    good: true,          // ใช้ความหมาย "เป็นของหมู่ในจาน" (แต่จะเช็กโควตาตอนกด)
    golden,
    life: diff.life,     // ใช้ TTL ตามระดับความยากจาก main
    aria: `${g.th} ${char}`
  };
}

export function onHit(meta, sys, state /*, hud*/){
  const ctx = state.ctx.plate;
  if (!ctx) return 'ok';

  const gKey = meta.groupId;
  const need = ctx.need[gKey]||0;
  const have = ctx.have[gKey]||0;

  // 1) ถ้า "ยังต้องการ" หมู่นี้อยู่ -> นับชิ้น + อัปเดต HUD
  if (have < need){
    ctx.have[gKey] = have + 1;

    // บันทึกไปยัง Progress ผ่าน event hit (จะนับ groupCount ด้วย)
    // meta.good=true เพื่อให้ระบบภารกิจ/คอมโบในภาพรวมยังทำงานร่วมกันได้
    // (main จะส่ง Progress.event('hit', ...) ให้เองแล้ว)
    renderPlateHUD(ctx, state.lang);

    // เช็กว่าจบหมู่ (last piece of this group) หรือยัง
    const groupDone = (ctx.have[gKey] >= ctx.need[gKey]);
    const plateDone = allDone(ctx.need, ctx.have);

    // ถ้าครบทั้งจาน -> ส่ง event ให้ Progress + เอฟเฟกต์จากโค้ช/เสียง
    if (plateDone){
      try{ sys?.coach?.say?.('จานสมบูรณ์!'); }catch{}
      try{ sys?.sfx?.play?.('sfx-perfect'); }catch{}
      // freeze สั้น ๆ ให้ผู้เล่นเห็นผล
      state.freezeUntil = (performance?.now?.()||Date.now()) + 600;
      // แจ้ง Progress (รองรับมิชชั่น plate_complete)
      try{ import('/webxr-health-mobile/HeroHealth/game/core/progression.js').then(({Progress})=>{
        Progress?.event?.('plate_complete', {stage:ctx.stage});
      }).catch(()=>{}); }catch{}
      // เริ่มจานใหม่
      nextPlate(ctx);
      renderPlateHUD(ctx, state.lang);
      return 'perfect';
    }

    // จบหมู่ -> โบนัสเบา ๆ
    if (groupDone){
      try{ sys?.sfx?.play?.('sfx-good'); }catch{}
      return 'perfect';
    }

    // ชิ้นที่ถูกต้องทั่วไป
    return 'good';
  }

  // 2) ถ้า "หมู่นี้เต็มแล้ว" -> ถือว่าเกินโควตา
  try{ sys?.sfx?.play?.('sfx-bad'); }catch{}
  return 'bad';
}
