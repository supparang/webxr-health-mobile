export const name='สมดุลน้ำ';

// ไอเท็ม
const WATER=["💧","🚰"], SWEET=["🥤","🧃","🧋"];

// ค่าโซนแนะนำ (เปอร์เซ็นต์)
export const OPT_MIN = 45;
export const OPT_MAX = 65;

// เรียกตอนเริ่มโหมด
export function init(state, hud){
  state.hyd = 50;          // เริ่มกลาง ๆ
  state.hydMin = OPT_MIN;  // พอดีต่ำสุด
  state.hydMax = OPT_MAX;  // พอดีสูงสุด
  window.HYD_OPT_MIN = state.hydMin; // ให้ HUD อ่าน
  window.HYD_OPT_MAX = state.hydMax;
}

// อัตราสุ่มไอคอน
export function pickMeta(diff){
  const rate= diff==='Easy'?0.78: diff==='Hard'?0.55:0.66;
  const water = Math.random()<rate;
  const arr = water ? WATER : SWEET;
  return {type:'hydra', water, char:arr[0]};
}

// ตีความโซน
function zoneOf(v, min, max){
  if(v < min) return 'low';
  if(v > max) return 'high';
  return 'ok';
}

// ได้ไอเท็ม
export function onHit(meta, systems, state, hud){
  // ปรับสมดุล
  if(meta.water){ state.hyd = Math.min(100, state.hyd + 6); }
  else          { state.hyd = Math.max(0,   state.hyd - 8); }

  // ให้คะแนนตามโซนหลังอัปเดต
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);
  if(meta.water){
    if(z==='ok'){ systems.score.add(6); systems.fever.onGood(); systems.score.good(); systems.fx.ding(); }
    else if(z==='low'){ systems.score.add(5); systems.score.good(); systems.fx.ding(); }
    else { // high
      systems.score.add(2); systems.score.bad(); systems.fx.thud();
    }
  }else{ // หวาน
    if(z==='ok'){ systems.score.add(-3); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); }
    else if(z==='low'){ systems.score.add(-1); systems.score.bad(); systems.fx.thud(); }   // ยังขาดน้ำอยู่ โทษเบาลง
    else { systems.score.add(-4); systems.score.bad(); systems.fx.thud(); }                // เกินอยู่แล้วยิ่งแย่
  }

  // อัปเดต HUD
  const zone = zoneOf(state.hyd, state.hydMin, state.hydMax);
  hud.setHydration(state.hyd, zone);
}
