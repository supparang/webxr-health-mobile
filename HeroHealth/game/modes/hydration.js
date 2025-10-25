// game/modes/hydration.js
// โหมดสมดุลน้ำ: คุม Hydration % ให้อยู่ในช่วง 45–65
// เพิ่ม Normalize/Guard ปุ่ม HUD พร้อมคูลดาวน์ + วงแหวน

export function init(state, hud, diff){
  // ค่าเริ่มต้น
  state.hyd = 55;
  state.hydMin = 45;
  state.hydMax = 65;

  // คูลดาวน์ (วินาที)
  state.hydCD = state.hydCD || { normalize: 0, guard: 0 };
  state.hydGuardUntil = 0; // timestamp (ms)

  showHydHUD(true);
  wireButtons(state);
  renderCD(state); // วาดวงแหวนครั้งแรก
  hud.showHydration?.(state.hyd, state.hydMin, state.hydMax);
}

export function tick(state, {score, fx, sfx, power, coach}, hud){
  // ดรอป/เพิ่มตามกาลเวลา (เบา ๆ)
  const now = performance.now();
  const dt = 1/60; // tick เรียกถี่ — ใช้ค่าคงที่พอ
  const guarded = now < state.hydGuardUntil;

  // ambient drift
  let drift = (Math.random()*0.10 - 0.05); // -0.05..+0.05 ต่อเฟรม
  if (guarded) drift *= 0.1;               // Guard ลดการดริฟต์แรงมาก

  state.hyd = clamp(state.hyd + drift, 0, 100);

  // อัปเดตไฮดรอ HUD
  hud.setHydration?.(state.hyd);

  // อัปเดตคูลดาวน์
  stepCD(state);
  renderCD(state);

  // คะแนนเล็กน้อยจากการรักษาโซนสweetspot
  if (state.hyd>=48 && state.hyd<=62){
    state.__sweetAcc = (state.__sweetAcc||0) + dt;
    if (state.__sweetAcc > 2){ // ทุก 2 วินาที
      state.__sweetAcc = 0;
      score.add?.(1); // โบนัสคงที่เล็กน้อย
      fx.popText?.('+1', {color:'#7fffd4'});
    }
  } else {
    state.__sweetAcc = 0;
  }
}

// === ปุ่ม (เรียกจาก main/ui) ===
export function useNormalize(state, {fx, sfx, coach}){
  if (state.hydCD.normalize>0) return false;
  state.hyd = 55;
  state.hydCD.normalize = 25;           // คูลดาวน์ 25s
  sfx?.perfect?.(); coach?.say?.('Normalize!');
  fx?.popText?.('55%', {color:'#39f'});
  renderCD(state);
  return true;
}

export function useGuard(state, {fx, sfx, coach}){
  if (state.hydCD.guard>0) return false;
  const now = performance.now();
  state.hydGuardUntil = now + 5000;     // Guard 5s
  state.hydCD.guard = 25;               // คูลดาวน์ 25s
  sfx?.power?.(); coach?.say?.('Guard On!');
  fx?.popText?.('GUARD', {color:'#0f0'});
  renderCD(state);
  return true;
}

// === logic เมื่อผู้เล่น "ดื่ม" เครื่องดื่ม (ให้โหมดเรียกใช้) ===
// ตัวอย่าง hook ที่คุณอาจมีอยู่แล้ว: onHit(meta, systems, state, hud)
export function onDrink(type, state, {score, fx, sfx, coach}, hud){
  // type: 'water' | 'mineral' | 'sweet' | 'coffee' ...
  // ตัวอย่างผลกระทบแบบง่าย
  const over = state.hyd>65;
  const under = state.hyd<45;

  if (type==='water' || type==='mineral'){
    state.hyd = clamp(state.hyd + 5, 0, 100);
    score.add?.(5); sfx?.good?.();
  } else if (type==='sweet' || type==='coffee'){
    // กติกาพิเศษตามที่ระบุ
    if (over){
      score.add?.(10); fx?.popText?.('+10', {color:'#ff0'}); sfx?.good?.();
    } else if (under){
      score.add?.(-15); fx?.popText?.('-15', {color:'#f66'}); sfx?.bad?.();
    } else {
      state.hyd = clamp(state.hyd - 10, 0, 100);
      score.add?.(-3); sfx?.bad?.();
    }
  }

  hud.setHydration?.(state.hyd);
}

// ===== Helpers =====
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function showHydHUD(on){
  const a = document.getElementById('hydrationActions');
  if(a) a.style.display = on ? 'flex' : 'none';
}
function wireButtons(state){
  const n = document.getElementById('btnNormalize');
  const g = document.getElementById('btnGuard');
  // กัน bind ซ้ำ
  n?.replaceWith(n.cloneNode(true));
  g?.replaceWith(g.cloneNode(true));
  const n2 = document.getElementById('btnNormalize');
  const g2 = document.getElementById('btnGuard');

  n2?.addEventListener('click', ()=>{
    // main.js จะเรียกผ่านโหมดนี้อีกที แต่เผื่อเรียกตรง
    if (state.hydCD.normalize<=0 && window.MODES?.hydration?.useNormalize){
      window.MODES.hydration.useNormalize(state, window.__HHA_SYS||{});
    }
  }, {passive:true});

  g2?.addEventListener('click', ()=>{
    if (state.hydCD.guard<=0 && window.MODES?.hydration?.useGuard){
      window.MODES.hydration.useGuard(state, window.__HHA_SYS||{});
    }
  }, {passive:true});
}

function stepCD(state){
  // เรียกทุก tick (ประมาณ 60fps) — ลดคูลดาวน์ทีละเฟรม
  const dec = 1/60;
  if (state.hydCD.normalize>0) state.hydCD.normalize = Math.max(0, state.hydCD.normalize - dec);
  if (state.hydCD.guard>0)     state.hydCD.guard     = Math.max(0, state.hydCD.guard - dec);
}

function renderCD(state){
  const n = document.getElementById('btnNormalize');
  const g = document.getElementById('btnGuard');
  const cdN = document.getElementById('cdNormalize');
  const cdG = document.getElementById('cdGuard');
  const ringN = n?.querySelector('.ring');
  const ringG = g?.querySelector('.ring');

  const maxN = 25, maxG = 25;
  const leftN = Math.ceil(state.hydCD.normalize||0);
  const leftG = Math.ceil(state.hydCD.guard||0);

  if (n){
    const pct = 1 - Math.min(1,(state.hydCD.normalize||0)/maxN);
    ringN && ringN.style.setProperty('--pct', String(pct));
    cdN && (cdN.textContent = leftN>0 ? leftN : '0');
    n.disabled = leftN>0;
  }
  if (g){
    const pct = 1 - Math.min(1,(state.hydCD.guard||0)/maxG);
    ringG && ringG.style.setProperty('--pct', String(pct));
    cdG && (cdG.textContent = leftG>0 ? leftG : '0');
    g.disabled = leftG>0;
  }
}
