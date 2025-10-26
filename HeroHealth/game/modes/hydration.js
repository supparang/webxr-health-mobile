// game/modes/hydration.js
// โหมด: สมดุลน้ำ 💧 45–65%
// onHit → return 'good' | 'ok' | 'bad'

export function init(state, hud){
  state.ctx = state.ctx || {};
  state.ctx.hyd    = 55;
  state.ctx.hydMin = 45;
  state.ctx.hydMax = 65;
  try{ hud?.showHydration?.(); }catch{}
  updateBar(state.ctx.hyd);
  setHydroLabel(state.lang, state.ctx.hyd);
}

export function pickMeta(diff){
  const drinks = [
    { char:'💧', effect:+10 }, // water
    { char:'🥛', effect:+8  }, // milk
    { char:'🥤', effect:-15 }, // soda
    { char:'☕', effect:-10 }  // coffee
  ];
  const meta = drinks[(Math.random()*drinks.length)|0];
  meta.life = diff?.life ?? 3000;
  return meta;
}

export function onHit(meta, sys, state){
  const { sfx } = sys || {};
  const ctx = state.ctx || {};
  const before = ctx.hyd ?? 55;

  ctx.hyd = Math.max(0, Math.min(100, before + (meta.effect||0)));
  updateBar(ctx.hyd);
  setHydroLabel(state.lang, ctx.hyd);

  const inZone = (ctx.hyd >= ctx.hydMin && ctx.hyd <= ctx.hydMax);
  if ((meta.effect||0) > 0){ try{ sfx?.good?.(); }catch{} return inZone ? 'good' : 'ok'; }
  else { try{ sfx?.bad?.(); }catch{} return inZone ? 'ok' : 'bad'; }
}

export function tick(state){
  const ctx = state.ctx || {};
  ctx.hyd = Math.max(0, (ctx.hyd ?? 55) - 0.4);
  updateBar(ctx.hyd);
  setHydroLabel(state.lang, ctx.hyd);
}

export function cleanup(state, hud){
  try{ hud?.hideHydration?.(); }catch{}
  const bar = document.getElementById('hydroBar');
  const lb  = document.getElementById('hydroLabel');
  if (bar) bar.style.width = '0%';
  if (lb)  lb.textContent  = '—';
  if (state?.ctx){ state.ctx.hyd = undefined; state.ctx.hydMin = undefined; state.ctx.hydMax = undefined; }
}

// helpers
function updateBar(val){
  const bar = document.getElementById('hydroBar');
  if (!bar) return;
  const p = Math.round(val);
  bar.style.width = p + '%';
  let color = '#4FC3F7';
  if (p < 45) color = '#E53935'; else if (p > 65) color = '#FFB300';
  bar.style.background = color;
}
function setHydroLabel(lang='TH', val){
  const el = document.getElementById('hydroLabel');
  if (!el) return;
  const p = Math.round(val);
  el.textContent = (lang==='EN') ? `Hydration ${p}%` : `สมดุลน้ำ ${p}%`;
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
}
