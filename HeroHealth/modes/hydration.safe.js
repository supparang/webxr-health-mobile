// === hydration.safe.js — Hydration ===
import { boot as baseBoot } from '../vr/mode-factory.js';

const GOOD = ['💧','🚰','🫗','🥛','🫖','🍵','🫙','🧊','🍶','🧃','🍋','🍐','🍉','🍊','🍏','🍇','🥒','🍓','🍍','🥥'];
const BAD  = ['🥤','🧋','🍹','🍸','🍷','🍺','🍻','🍾','🥃','🧉','🍨','🍧','🍫','🍬','🍭','🍩','🍪','🍰','🍮','🧃'];

export async function boot(cfg={}) {
  return baseBoot({
    ...cfg,
    name: 'hydration',
    pools: { good: GOOD, bad: BAD },
    goldenRate: 0.05,
    goodRate:   0.70,
    judge: (ch) => {
      if(!ch) return { good:false, scoreDelta:-6 };
      const healthy = GOOD.includes(ch);
      return { good: healthy, scoreDelta: healthy?12:-6, feverDelta: healthy?5:0 };
    }
  });
}
