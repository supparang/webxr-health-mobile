// ./game/modes/hydration.js
export const name = 'สมดุลน้ำ';

// ช่วยแปลงโซนเป็นคำ
const zone = (p, lo, hi) => (p < lo ? 'low' : (p > hi ? 'high' : 'ok'));

export function init(state, hud, diff){
  state.hyd = 50;
  state.hydMin = 45;
  state.hydMax = 65;
  state.ctx = state.ctx || {};
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  hud.setHydration(state.hyd, 'ok');

  // อัตราสุ่ม 💧 ต่อความยาก (ถ้ามี)
  state.hydWaterRate = (diff && typeof diff.hydWaterRate === 'number') ? diff.hydWaterRate : 0.66;
}

export function pickMeta(diff, state){
  const water = Math.random() < (state.hydWaterRate ?? 0.66);
  return { type:'hydra', water, char: water ? '💧' : '🧋' };
}

export function onHit(meta, systems, state, hud){
  if (meta.type !== 'hydra') return;

  if (meta.water) {
    state.hyd = Math.min(100, state.hyd + 5);
    systems.score.add(5);
    state.ctx.waterHits = (state.ctx.waterHits || 0) + 1;
  } else {
    state.hyd = Math.max(0, state.hyd - 6);
    systems.score.add(-3);
    state.ctx.sweetMiss = (state.ctx.sweetMiss || 0) + 1;
  }

  // โทษเฉพาะสถานะ “มากไป/น้อยไป”
  const z = zone(state.hyd, state.hydMin, state.hydMax);

  // มากไปแล้วเก็บ 💧 เพิ่ม → โดนเพิ่ม
  if (meta.water && z === 'high') {
    systems.score.add(-4);
    state.timeLeft = Math.max(0, (state.timeLeft || 0) - 3);
    state.ctx.overHydPunish = (state.ctx.overHydPunish || 0) + 1;
    state.ctx.timeMinus = (state.ctx.timeMinus || 0) + 3;
  }

  // น้อยไปแล้วยังเก็บ 🧋 → โดนเพิ่ม
  if (!meta.water && z === 'low') {
    systems.score.add(-2);
    state.timeLeft = Math.max(0, (state.timeLeft || 0) - 2);
    state.ctx.lowSweetPunish = (state.ctx.lowSweetPunish || 0) + 1;
    state.ctx.timeMinus = (state.ctx.timeMinus || 0) + 2;
  }

  // อัปเดต HUD
  hud.setHydration(state.hyd, z);
}
