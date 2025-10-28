// === Hero Health Academy — modes/hydration.js ===
// บาร์ระดับน้ำ (Low/OK/High) + เอฟเฟกต์ไฟลุกเมื่อ FEVER ทำงาน
// ยิงอีเวนต์สำหรับ Quests: 'hydro_tick', 'hydro_cross', 'hydro_click'
// สัญญากับ main.js:
//   export: init(state, hud, diff), cleanup(state, hud),
//           pickMeta(diff, state), onHit(meta, sys, state, hud), tick(state, sys, hud)
//   meta: { id:'water'|'sweet'|'ice'|'gold', char, aria, good, life, booster?, golden? }

import { Quests } from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

export const name = 'hydration';

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
    wrap.style.cssText = 'position:fixed;left:12px;right:12px;top:112px;z-index:65;pointer-events:none';
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

export function init(state={}, hud={}, diff={}){
  state.hydTotalTime = Number(diff?.time)||60;
  state.hyd    = 50;  // 0..100
  state.hydMin = 35;  // ขอบล่างโซน OK
  state.hydMax = 65;  // ขอบบนโซน OK
  state.hydDecay = 0.25;  // ลดเองต่อวินาที (จะช้าลงเมื่อได้ ice)
  state._hydPrevZone = zoneOf(state.hyd, state.hydMin, state.hydMax);
  state.hydDecayBoostUntil = 0;

  ensureHUD();
  hud.showHydration?.();
  // แจ้ง HUD ค่าเริ่มต้น (ถ้ามี API)
  try { hud.setHydration?.({ level: state.hyd, min: state.hydMin, max: state.hydMax }); } catch {}
  render(state);
}

export function cleanup(_state, hud){
  try{ hud.hideHydration?.(); }catch{}
}

export const fx = {
  onSpawn(/*el, state*/){ /* main มี tilt แล้ว */ },
  onHit(/*x, y, meta, state*/){ /* main มี shatter อยู่แล้ว */ }
};

// สุ่มของที่โผล่: น้ำเปล่า, น้ำหวาน, น้ำแข็ง (ตัวช่วย), โบนัสทอง
export function pickMeta(diff={}, state={}){
  // อัตราส่วนแบบหยาบ: water 55%, sweet 30%, ice 10%, golden 5%
  const life = clamp(Number(diff?.life)||3000, 700, 4500);
  const r = Math.random();
  if (r < 0.55) return { id:'water',  char:'💧', aria:'Water',        good:true,  life };
  if (r < 0.85) return { id:'sweet',  char:'🧃', aria:'Sweet drink',  good:false, life };
  if (r < 0.95) return { id:'ice',    char:'🧊', aria:'Ice (cooldown)', good:true, life, booster:true };
  return                { id:'gold',  char:'⭐', aria:'Golden',        good:true,  life, golden:true };
}

export function onHit(meta={}, sys={}, state={}, hud={}){
  const { score, coach } = sys;
  const before = state.hyd;
  const beforeZone = zoneOf(before, state.hydMin, state.hydMax);

  // ปรับระดับตามชนิด
  if (meta.id==='water'){
    // น้ำเปล่าช่วยขึ้นระดับ (ขึ้นน้อยเมื่อ HIGH)
    const z = beforeZone;
    const delta = (z===ZONES.HIGH ? +2 : +6);
    state.hyd = clamp(state.hyd + delta, 0, 100);
  }else if (meta.id==='sweet'){
    // น้ำหวานช่วยลดตอน HIGH / (OK = ลดเล็กน้อย) / (LOW = แย่ ทำให้สูงขึ้น)
    const z = beforeZone;
    const delta = (z===ZONES.HIGH ? -8 : z===ZONES.OK ? -3 : +4);
    state.hyd = clamp(state.hyd + delta, 0, 100);
  }else if (meta.id==='ice'){
    // ลดอัตรา decay ชั่วคราว
    state.hydDecayBoostUntil = performance.now() + 5000;
    state.hydDecay = 0.10;
    try{ coach?.onPower?.('freeze'); }catch{}
  }else if (meta.id==='gold'){
    // Golden ปรับเข้าโซนพอดีแบบนุ่มนวล
    if (state.hyd < state.hydMin) state.hyd = clamp(state.hyd + 10, 0, 100);
    else if (state.hyd > state.hydMax) state.hyd = clamp(state.hyd - 10, 0, 100);
    else state.hyd = clamp(state.hyd + 6, 0, 100);
  }

  // ยิงอีเวนต์ click ให้ระบบ quests
  Quests.event('hydro_click', { zoneBefore: beforeZone, kind: meta.id==='sweet'?'sweet':'water' });

  // ให้ผลลัพธ์กับ main (คะแนน/เรต)
  const afterZone = zoneOf(state.hyd, state.hydMin, state.hydMax);
  if (afterZone === ZONES.OK){
    score.add?.(8);
    return (meta.golden ? 'perfect' : 'good');
  }else if (beforeZone!==afterZone && afterZone!==ZONES.OK){
    // เพิ่งข้ามไปผิดฝั่ง = ถือว่าพลาด
    return 'bad';
  }else{
    return 'ok';
  }
}

export function tick(state={}, sys={}, hud={}){
  const now = performance.now();

  // decay คืนค่าปกติเมื่อหมดบูสต์
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

  // ปรับบรรยากาศเมื่ออยู่นอกโซนนาน ๆ
  if (z!==ZONES.OK && hud?.dimPenalty){ try{ hud.dimPenalty(); }catch{} }

  // แจ้ง HUD ข้อมูลปัจจุบัน (ถ้ามี API)
  try { hud.setHydration?.({ level: state.hyd, min: state.hydMin, max: state.hydMax, zone: z }); } catch {}

  // วาดบาร์/ไฟ
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
  if (needle) needle.style.left = `calc(${pct}% - 6px)`;

  // โซนเพื่อสีกรอบ (ให้ styles ใช้ [data-zone])
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);
  if (bar) bar.dataset.zone = z;

  // แสดง/ซ่อนไฟลุกเมื่อ FEVER ทำงาน
  if (flame){
    if (state?.fever?.active){
      flame.hidden = false;
      flame.style.left = `calc(${pct}% - 10px)`;
    }else{
      flame.hidden = true;
    }
  }
}
