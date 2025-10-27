// === Hero Health Academy — modes/hydration.js ===
// บาร์ระดับน้ำ (Low/OK/High) + เอฟเฟกต์ไฟลุกเมื่อ FEVER ทำงาน
// ยิงอีเวนต์สำหรับ Quests: 'hydro_tick', 'hydro_cross', 'hydro_click'

import { Quests } from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

const ZONES = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };

function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function zoneOf(level, minOK, maxOK){
  if (level < minOK) return ZONES.LOW;
  if (level > maxOK) return ZONES.HIGH;
  return ZONES.OK;
}

function ensureHUD(){
  // ใช้ #hydroWrap ที่ HUD เตรียมไว้ ถ้าไม่มีให้สร้าง
  let wrap = document.getElementById('hydroWrap');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.id = 'hydroWrap';
    document.body.appendChild(wrap);
  }
  if (!wrap.querySelector('.hydroBar')){
    wrap.innerHTML = `
      <div class="hydroBar" aria-label="hydration-bar">
        <div class="seg low"><span>น้อยไป</span></div>
        <div class="seg ok"><span>พอดี</span></div>
        <div class="seg high"><span>มากไป</span></div>
        <div class="needle" role="presentation"></div>
        <div class="flame" role="presentation" hidden>
          <i></i><i></i><i></i>
        </div>
      </div>
    `;
  }
  return wrap;
}

// -------------------------------------------------

export function init(state, hud, diff){
  state.hydTotalTime = diff.time|0;
  state.hyd = 50;         // 0..100
  state.hydMin = 35;      // ขอบล่างโซน OK
  state.hydMax = 65;      // ขอบบนโซน OK
  state.hydDecay = 0.25;  // ลดเองต่อวินาที
  state._hydPrevZone = zoneOf(state.hyd, state.hydMin, state.hydMax);

  ensureHUD();
  hud.showHydration?.();
  render(state);
}

export function cleanup(state, hud){
  hud.hideHydration?.();
}

export const fx = {
  onSpawn(el, state){
    // เพิ่มเงา/tilt ถูกจัดการใน main แล้ว ไม่ต้องทำซ้ำ
  },
  onHit(x, y, meta, state){
    // main จะเรียกแตกกระจายกลางให้แล้ว ที่นี่ไม่บังคับทำอะไรเพิ่ม
  }
};

// สุ่มของที่โผล่: น้ำเปล่า, น้ำหวาน, น้ำแข็ง (ตัวช่วย), โบนัสทอง
export function pickMeta(diff, state){
  // อัตราส่วนแบบหยาบ: water 55%, sweet 30%, ice 10%, golden 5%
  const r = Math.random();
  if (r < 0.55) return { id:'water',  char:'💧',  aria:'Water',  good:true,  life: diff.life };
  if (r < 0.85) return { id:'sweet',  char:'🧃',  aria:'Sweet drink', good:false, life: diff.life };
  if (r < 0.95) return { id:'ice',    char:'🧊',  aria:'Ice (cooldown)', good:true,  life: diff.life, booster:true };
  return                { id:'gold',  char:'⭐',  aria:'Golden', good:true, life: diff.life, golden:true };
}

export function onHit(meta, sys, state, hud){
  const { score, coach } = sys;
  const before = state.hyd;
  const beforeZone = zoneOf(before, state.hydMin, state.hydMax);

  if (meta.id==='water'){
    // น้ำเปล่าช่วยขึ้นระดับ (มากขึ้นถ้าอยู่ LOW/OK, น้อยลงถ้าอยู่ HIGH)
    const z = beforeZone;
    const delta = (z===ZONES.HIGH ? +2 : +6);
    state.hyd = clamp(state.hyd + delta, 0, 100);
  }else if (meta.id==='sweet'){
    // น้ำหวานช่วยลดตอน HIGH / (OK = -เล็กน้อย) / (LOW = แย่)
    const z = beforeZone;
    const delta = (z===ZONES.HIGH ? -8 : z===ZONES.OK ? -3 : +4); // LOW ดื่มหวาน = แย่ (ขึ้นอีก)
    state.hyd = clamp(state.hyd + delta, 0, 100);
  }else if (meta.id==='ice'){
    // ช่วยคุมความเร็ว ลด decay ชั่วคราว + ให้คะแนนเล็กน้อย
    state.hydDecayBoostUntil = performance.now() + 5000;
    state.hydDecay = 0.1;
    try{ coach?.onPower?.('freeze'); }catch{}
  }else if (meta.id==='gold'){
    // Golden = เติมเข้าพอดีแบบค่อย ๆ
    if (state.hyd < state.hydMin) state.hyd = clamp(state.hyd + 10, 0, 100);
    else if (state.hyd > state.hydMax) state.hyd = clamp(state.hyd - 10, 0, 100);
    else state.hyd = clamp(state.hyd + 6, 0, 100);
  }

  // เควสต์ click logic
  Quests.event('hydro_click', { zoneBefore: beforeZone, kind: meta.id==='sweet'?'sweet':'water' });

  // ให้ผลลัพธ์กับ main (คะแนน, ดี/พลาด)
  const afterZone = zoneOf(state.hyd, state.hydMin, state.hydMax);
  if (afterZone === ZONES.OK){
    score.add?.(8);
    return (meta.golden ? 'perfect' : 'good');
  }else if (beforeZone!==afterZone && afterZone!==ZONES.OK){
    // ข้ามโซนไปผิดฝั่ง = พลาดแรง
    return 'bad';
  }else{
    return 'ok';
  }
}

export function tick(state, sys, hud){
  const now = performance.now();

  // decay คืนค่าปรกติเมื่อหมดบูสต์
  if (state.hydDecayBoostUntil && now > state.hydDecayBoostUntil){
    state.hydDecayBoostUntil = 0;
    state.hydDecay = 0.25;
  }

  // ลดตามเวลา
  state.hyd = clamp(state.hyd - state.hydDecay, 0, 100);

  // โซนปัจจุบัน
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);

  // ยิง hydro_tick ให้ Quests (ใช้วัดเวลาที่อยู่โซน OK)
  Quests.event('hydro_tick', { level: state.hyd, zone: (z===ZONES.OK?'OK':z) });

  // ตรวจ crossing
  if (z !== state._hydPrevZone){
    Quests.event('hydro_cross', { from: state._hydPrevZone, to: (z===ZONES.OK?'OK':z) });
    state._hydPrevZone = z;
  }

  // บังคับ penalty ถ้า HIGH/LOW ต่อเนื่องนาน ๆ (ใส้สั่นจาง ๆ)
  if (z!==ZONES.OK && hud?.dimPenalty){ hud.dimPenalty(); }

  // อัปเดต HUD
  render(state);
}

// -------------------------------------------------
// บาร์ + flame visual
function render(state){
  const wrap = document.getElementById('hydroWrap'); if (!wrap) return;
  const bar  = wrap.querySelector('.hydroBar');
  const needle = wrap.querySelector('.needle');
  const flame  = wrap.querySelector('.flame');

  // needle ตำแหน่งตาม 0..100
  const pct = clamp(state.hyd|0, 0, 100);
  needle.style.left = `calc(${pct}% - 6px)`;

  // โซนเพื่อสีกรอบ
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);
  bar.dataset.zone = z;

  // แสดง/ซ่อนไฟลุกเมื่อ FEVER ทำงาน
  if (state?.fever?.active){
    flame.hidden = false;
    flame.style.left = `calc(${pct}% - 10px)`;
  }else{
    flame.hidden = true;
  }
}
