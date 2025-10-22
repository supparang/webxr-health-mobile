// ./game/modes/hydration.js
export const name = 'สมดุลน้ำ';

export function init(state, hud, diff){
  state.hyd = 50;
  state.hydMin = 45;
  state.hydMax = 65;
  state.hydWaterLockUntil = 0; // ล็อกเลือกน้ำชั่วคราว (ms)
  state.hydSweetLockUntil = 0; // ล็อกเลือกของหวานชั่วคราว (ms)

  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  hud.setHydration(state.hyd, 'ok');
}

// อัตราเกิดน้ำ/ของหวาน ปรับตาม diff (มี hydWaterRate ใน DIFFS)
export function pickMeta(diff, state){
  const rate = (diff && typeof diff.hydWaterRate === 'number') ? diff.hydWaterRate : 0.66;
  const water = Math.random() < rate;
  return { type:'hydra', water, char: water ? '💧' : '🧋' };
}

export function onHit(meta, systems, state, hud){
  if(meta.type !== 'hydra') return;

  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // โซนก่อนปรับ
  const zoneBefore = (state.hyd < state.hydMin) ? 'low' : (state.hyd > state.hydMax ? 'high' : 'ok');

  // ล็อกกันสแปม: ถ้าอยู่ในโซนผิดแล้วยังชนเดิมซ้ำ ให้เพิกเฉย
  if (meta.water && now < (state.hydWaterLockUntil||0)) {
    systems.fx?.spawn3D(null, 'LOCK', 'bad');
    return;
  }
  if (!meta.water && now < (state.hydSweetLockUntil||0)) {
    systems.fx?.spawn3D(null, 'LOCK', 'bad');
    return;
  }

  // กติกา:
  // - high + water  => โทษหนัก (-5, -2s) + ล็อกน้ำ 1500ms
  // - low  + sweet  => โทษหนัก (-5, -2s) + ล็อกหวาน 1500ms
  // - ปกติ: water +5% (+5 คะแนน), sweet -6% (-3 คะแนน)
  if (meta.water) {
    if (zoneBefore === 'high') {
      systems.score.add(-5);
      state.timeLeft = Math.max(0, (state.timeLeft||0) - 2);
      systems.fx?.spawn3D(null, 'Overflow -5 • -2s', 'bad');
      state.hydWaterLockUntil = now + 1500;
      // ไม่เพิ่มน้ำซ้ำเมื่อ high
    } else {
      state.hyd = Math.min(100, state.hyd + 5);
      systems.score.add(5);
      systems.fx?.spawn3D?.(null, '+5', 'good');
    }
  } else {
    // sweet
    if (zoneBefore === 'low') {
      systems.score.add(-5);
      state.timeLeft = Math.max(0, (state.timeLeft||0) - 2);
      systems.fx?.spawn3D(null, 'Dehydrated -5 • -2s', 'bad');
      state.hydSweetLockUntil = now + 1500;
      // ยังหักความชุ่มชื้นเบา ๆ เพื่อเน้นผล (คง -6% เหมือนเดิม)
      state.hyd = Math.max(0, state.hyd - 6);
    } else {
      state.hyd = Math.max(0, state.hyd - 6);
      systems.score.add(-3);
      state.ctx.sweetMiss = (state.ctx.sweetMiss||0) + 1;
      systems.fx?.spawn3D?.(null, '-3', 'bad');
    }
  }

  // อัปเดตโซน/แถบ HUD
  const z = state.hyd < state.hydMin ? 'low' : (state.hyd > state.hydMax ? 'high' : 'ok');
  hud.setHydration(state.hyd, z);
}
