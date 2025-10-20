
export const name='สมดุลน้ำ';
export function init(state,hud){ state.hyd=50; state.hydMin=45; state.hydMax=65; const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='block'; hud.setHydration(state.hyd,'ok'); }
export function pickMeta(diff,state){ const water=Math.random()<0.66; return {type:'hydra',water,char:water?'💧':'🧋'}; }
export function onHit(meta,systems,state,hud){ if(meta.type!=='hydra') return; if(meta.water){ state.hyd=Math.min(100,state.hyd+5); systems.score.add(5);} else { state.hyd=Math.max(0,state.hyd-6); systems.score.add(-3); state.ctx.sweetMiss=(state.ctx.sweetMiss||0)+1; } const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok'); hud.setHydration(state.hyd,z); }