// game/modes/groups.js
// โหมด: จาน 5 หมู่ (เลือกเก็บให้ตรง "หมวดเป้าหมาย")

// ===== หมวดอาหารและอิโมจิ =====
const GROUPS = {
  grain:   { labelTH: 'ธัญพืช',  labelEN:'Grain',   em: ['🍚','🍞','🥖','🥯','🍜'] },
  veg:     { labelTH: 'ผัก',     labelEN:'Veg',     em: ['🥦','🥕','🥬','🌽','🫑'] },
  protein: { labelTH: 'โปรตีน',  labelEN:'Protein', em: ['🥩','🍗','🍖','🥚','🐟'] },
  fruit:   { labelTH: 'ผลไม้',   labelEN:'Fruit',   em: ['🍎','🍌','🍇','🍓','🍊'] },
  dairy:   { labelTH: 'นม',      labelEN:'Dairy',   em: ['🥛','🧀','🍦','🍨'] }
};
const GROUP_KEYS = Object.keys(GROUPS);

// ===== Utils =====
const pick = (arr)=>arr[(Math.random()*arr.length)|0];

// ป้ายหมวดสำหรับ HUD
function badgeOf(key, lang='TH'){
  const g = GROUPS[key];
  if(!g) return '—';
  const name = (lang==='EN'? g.labelEN : g.labelTH);
  return `${name}`;
}

// ===== Public API (main.js จะเรียกใช้) =====
export function init(state, hud, diff){
  // เตรียม context เฉพาะโหมด
  state.ctx = state.ctx || {};
  state.ctx.groups = state.ctx.groups || {
    target: pick(GROUP_KEYS),
    targetHits: 0
  };

  // โชว์ HUD เป้าหมาย (ถ้า HUD รองรับ)
  if (hud?.showTarget) hud.showTarget();
  setTargetHUD(state, hud);

  // รีเซ็ตตัวนับผิดหมู่
  state.ctx.wrongGroup = 0;
}

export function tick(state, sys, hud){
  // โหมดนี้ไม่มี tick พิเศษ แต่กันไว้เผื่ออนาคต
}

// difficulty → โอกาสเกิดตรงเป้า
function targetChanceByDiff(diffKey){
  if(diffKey==='Easy')   return 0.45;
  if(diffKey==='Hard')   return 0.65;
  return 0.55; // Normal
}

// คืน meta ของไอเท็มที่จะสแปวน์
export function pickMeta(diff, state){
  const ctx = state.ctx?.groups || {};
  const target = ctx.target || 'grain';

  const wantTarget = Math.random() < targetChanceByDiff(state.difficulty);
  let groupKey = wantTarget ? target : pick(GROUP_KEYS.filter(k=>k!==target));
  if(!GROUPS[groupKey]) groupKey = 'grain';

  const char = pick(GROUPS[groupKey].em);

  // อายุปุ่มขึ้นกับ diff.life ถ้าไม่มี ใส่ค่า default
  const life = (diff?.life ?? 3000);

  // meta ที่ตัวสแปวน์/คลิกต้องใช้
  return {
    type: 'food',
    char,
    life,
    groupKey,
    good: (groupKey === target), // ตรงเป้า = true
  };
}

// เมื่อผู้เล่นคลิก
export function onHit(meta, sys, state, hud){
  const { score, sfx, fx, coach } = sys || {};
  const lang = (state.lang || 'TH');

  const ctx = state.ctx?.groups || (state.ctx.groups = { target: 'grain', targetHits: 0 });

  if (meta.type!=='food'){
    score?.add?.(1);
    fx?.popText?.('+1',{color:'#8ff'});
    return;
  }

  // กรณีตรงเป้า
  if (meta.good){
    score?.add?.(7);
    // combo +1 แบบปลอดภัย
    score.combo = (score.combo||0) + 1;
    if (hud?.setCombo) hud.setCombo(score.combo);
    fx?.popText?.('+7',{color:'#7fffd4'});

    // นับจำนวนที่เก็บตรงเป้า เพื่อหมุนเป้าหมาย
    ctx.targetHits = (ctx.targetHits||0) + 1;

    // คอมเมนต์สั้น ๆ
    coach?.say?.(lang==='TH' ? 'เป้าหมายโดน!' : 'On target!');
    sfx?.good?.();

    // ทุกๆ 3 ชิ้นตรงเป้า → สุ่มเป้าใหม่
    if (ctx.targetHits >= 3){
      rotateTarget(state, hud);
      ctx.targetHits = 0;
    }
    return;
  }

  // กรณีถูกหมู่แต่ไม่ใช่เป้า (เช็คด้วยว่า meta.groupKey เป็นหนึ่งใน 5 หมู่)
  if (GROUPS[meta.groupKey]){
    score?.add?.(2);
    fx?.popText?.('+2',{color:'#9fdcff'});
    // ไม่เพิ่ม/ลดคอมโบ
    coach?.say?.(lang==='TH' ? 'ได้แต่ยังไม่ใช่เป้า' : 'Okay, not the target');
    sfx?.tick?.();
    return;
  }

  // ผิดหมู่ (จริง ๆ ในชุดนี้จะไม่ค่อยเกิด เพราะเราสุ่มเฉพาะ 5 หมู่)
  score?.add?.(-2);
  score.combo = 0; if (hud?.setCombo) hud.setCombo(0);
  state.ctx.wrongGroup = (state.ctx.wrongGroup||0) + 1;
  fx?.popText?.('-2',{color:'#ff7a7a'});
  coach?.say?.(lang==='TH' ? 'ผิดหมวด!' : 'Wrong group!');
  sfx?.bad?.();
}

// ===== Helpers =====
function rotateTarget(state, hud){
  const current = state.ctx.groups.target;
  const pool = GROUP_KEYS.filter(k=>k!==current);
  const next = pick(pool);
  state.ctx.groups.target = next;
  setTargetHUD(state, hud);
}

function setTargetHUD(state, hud){
  const lang = (state.lang || 'TH');
  const key = state.ctx.groups.target;
  const label = badgeOf(key, lang);
  // ถ้า HUD รองรับ API เหล่านี้จะใช้ได้ทันที
  if (hud?.setTargetBadge) hud.setTargetBadge(label);
  else {
    // fallback: เข้าถึง DOM โดยตรง
    const b = document.getElementById('targetBadge');
    if (b) b.textContent = label;
    const wrap = document.getElementById('targetWrap');
    if (wrap) wrap.style.display = 'block';
  }
}
