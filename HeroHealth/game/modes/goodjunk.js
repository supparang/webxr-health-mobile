// === mode: goodjunk ===
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

const GOODS = ['🥗','🍎','🥦','🍇','🍓','🥕','🥒','🍅','🌽','🍠','🍊','🍌'];
const JUNKS = ['🍟','🍔','🌭','🍕','🍩','🍰','🥤','🍗🧂','🍬','🧁'];

const rnd = a=>a[(Math.random()*a.length)|0];

export function init(state,hud,diff){ const tgt=$('#targetWrap'); if(tgt) tgt.style.display='none'; state.ctx={}; }
export function cleanup(){}

export function pickMeta(diff,state){
  const isGood = Math.random() < 0.65;
  const char = isGood ? rnd(GOODS) : rnd(JUNKS);
  const golden = isGood && Math.random()<0.08;
  return {
    id:'gj_'+Date.now().toString(36),
    char, aria: isGood?'good':'junk', label: isGood?'good':'junk',
    isGood, golden, good: isGood, life: diff?.life ?? 3000
  };
}

export function onHit(meta, sys, state){
  const { sfx } = sys;
  if (meta.isGood){
    try{ sfx.play(meta.golden?'sfx-perfect':'sfx-good'); }catch{}
    return meta.golden ? 'perfect' : 'good';
  } else {
    try{ sfx.play('sfx-bad'); }catch{}
    return 'bad';
  }
}

export const fx = {
  onSpawn: add3DTilt,
  onHit(x,y){ shatter3D(x,y); }
};
