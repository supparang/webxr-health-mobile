// === plate.safe.js — Healthy Plate ===
import { boot as baseBoot } from '../vr/mode-factory.js';

const FRUITVEG = ['🥦','🥕','🌽','🍅','🥬','🍆','🫑','🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🥑','🍒'];
const PRO_GRAIN= ['🐟','🍗','🥚','🥜','🫘','🥩','🍞','🥖','🍚','🍙','🍘','🍝','🌮','🌯','🧀','🥨','🥯','🧆','🍛','🍣'];
const JUNK     = ['🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥓','🥠','🥮'];

const GOOD = [...FRUITVEG.slice(0,10), ...PRO_GRAIN.slice(0,10)];

export async function boot(cfg={}) {
  return baseBoot({
    ...cfg,
    name: 'plate',
    pools: { good: GOOD, bad: JUNK },
    goldenRate: 0.06,
    goodRate:   0.72,
    judge: (ch) => {
      if(!ch) return { good:false, scoreDelta:-5 };
      const healthy = GOOD.includes(ch);
      return { good: healthy, scoreDelta: healthy?10:-5, feverDelta: healthy?5:0 };
    }
  });
}
