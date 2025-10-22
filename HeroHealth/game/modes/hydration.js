export const name = 'สมดุลน้ำ';

export function init(state, hud, diff){
  state.hyd = 50;
  state.hydMin = 45;
  state.hydMax = 65;
  state.hydWaterLockUntil = 0; // ล็อกเก็บน้ำชั่วคราว
  state.hydSweetLockUntil = 0; // ล็อกเก็บของหวานชั่วคราว
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  hud.setHydration(state.hyd, 'ok');
}

export function pickMeta(diff, state){
  const rate = (diff && typeof diff.hydWaterRate === 'number') ? diff.hydWaterRate : 0.66;
  const water = Math.random() < rate;
  return { type:'hydra', water, char: water ? '💧' : '🧋' };
}

export function onHit(meta, systems, state, hud){
  if(meta.type !== 'hydra') return;
  const now = performance?.now ? performance.now() : Date.now();
  const zoneBefore = state.hyd < state.hydMin ? 'low' : (state.hyd > state.hydMax ? 'high' : 'ok');

  // LOCK กันสแปม
  if (meta.water && now < (state.hydWaterLockUntil||0)) { systems.fx?.spawn3D(null,'LOCK','bad'); return; }
  if (!meta.water && now < (state.hydSweetLockUntil||0)) { systems.fx?.spawn3D(null,'LOCK','bad'); return; }

  if (meta.water) {
    if (zoneBefore === 'high') {
      systems.score.add(-5);
      state.timeLeft = Math.max(0, (state.timeLeft||0) - 2);
      systems.fx?.spawn3D(null, 'Overflow -5 • -2s', 'bad');
      systems.sfx?.play?.('sfx-bad');
      state.hydWaterLockUntil = now + 1500;
    } else {
      state.hyd = Math.min(100, state.hyd + 5);
      systems.score.add(5);
      systems.fx?.spawn3D?.(null, '+5', 'good');
      systems.sfx?.play?.('sfx-good');
    }
  } else { // sweet
    if (zoneBefore === 'low') {
      systems.score.add(-5);
      state.timeLeft = Math.max(0, (state.timeLeft||0) - 2);
      systems.fx?.spawn3D(null, 'Dehydrated -5 • -2s', 'bad');
      systems.sfx?.play?.('sfx-bad');
      state.hydSweetLockUntil = now + 1500;
      state.hyd = Math.max(0, state.hyd - 6);
    } else {
      state.hyd = Math.max(0, state.hyd - 6);
      systems.score.add(-3);
      state.ctx.sweetMiss = (state.ctx.sweetMiss||0) + 1;
      systems.fx?.spawn3D?.(null, '-3', 'bad');
      systems.sfx?.play?.('sfx-bad');
    }
  }

  const z = state.hyd < state.hydMin ? 'low' : (state.hyd > state.hydMax ? 'high' : 'ok');
  hud.setHydration(state.hyd, z);
}
