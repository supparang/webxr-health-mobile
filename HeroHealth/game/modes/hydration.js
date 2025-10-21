
export const name='สมดุลน้ำ';
const zone = (p, lo, hi) => (p < lo ? 'low' : (p > hi ? 'high' : 'ok'));
export function init(state,hud,diff){
  state.hyd=50; state.hydMin=45; state.hydMax=65; state.ctx = state.ctx||{};
  state.hydWaterRate = (diff && typeof diff.hydWaterRate==='number') ? diff.hydWaterRate : 0.66;
  const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='block';
  hud.setHydration(state.hyd,'ok');
}
export function pickMeta(diff,state){ const water=Math.random() < (state.hydWaterRate ?? 0.66); return {type:'hydra',water,char:water?'💧':'🧋'}; }
export function onHit(meta,systems,state,hud){
  if(meta.type!=='hydra') return;
  if(meta.water){ state.hyd=Math.min(100,state.hyd+5); systems.score.add(5); systems.sfx.play('sfx-good'); systems.fx.spawn3D(null,'+5','good'); state.ctx.waterHits=(state.ctx.waterHits||0)+1; }
  else { state.hyd=Math.max(0,state.hyd-6); if(!systems.power.consumeShield()){ systems.score.add(-3); systems.sfx.play('sfx-bad'); systems.fx.spawn3D(null,'-3','bad'); } state.ctx.sweetMiss=(state.ctx.sweetMiss||0)+1; }
  const z=zone(state.hyd, state.hydMin, state.hydMax);
  if(meta.water && z==='high'){ systems.score.add(-4); state.timeLeft=Math.max(0,(state.timeLeft||0)-3); systems.fx.spawn3D(null,'-4 (-3s)','bad'); state.ctx.overHydPunish=(state.ctx.overHydPunish||0)+1; state.ctx.timeMinus=(state.ctx.timeMinus||0)+3; }
  if(!meta.water && z==='low'){ systems.score.add(-2); state.timeLeft=Math.max(0,(state.timeLeft||0)-2); systems.fx.spawn3D(null,'-2 (-2s)','bad'); state.ctx.lowSweetPunish=(state.ctx.lowSweetPunish||0)+1; state.ctx.timeMinus=(state.ctx.timeMinus||0)+2; }
  hud.setHydration(state.hyd, z);
}
