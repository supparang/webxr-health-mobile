// === /HeroHealth/modes/plate.quest.js (DOM FX via Particles) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const onHitScreen = (e) => {
    const d = e?.detail || {};
    Particles.burstShards(null, null, {
      screen: { x: d.x, y: d.y },
      color: d.good ? '#22c55e' : '#ef4444',
      theme: 'plate'
    });
  };
  window.addEventListener('hha:hit-screen', onHitScreen);
  const cleanup = () => { window.removeEventListener('hha:hit-screen', onHitScreen); window.removeEventListener('hha:end', cleanup); };
  window.addEventListener('hha:end', cleanup, { once: true });

  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦'],
  };
  const GOOD = Object.values(GROUPS).flat();
  function judge(ch, s) {
    const ok = GOOD.includes(ch);
    return ok ? { good:true, scoreDelta: 22 + (s.combo||0)*2 }
              : { good:false, scoreDelta:-10 };
  }

  return factoryBoot({
    difficulty: cfg.difficulty || 'normal',
    duration:   cfg.duration   || 60,
    pools: { good: GOOD, bad: ['🍔','🍟','🍕','🍩','🧋','🥤'] },
    goodRate: 0.65,
    judge
  });
}
export default { boot };
