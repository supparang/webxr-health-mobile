// === groups.safe.js — Food Groups ===
import { boot as baseBoot } from '../vr/mode-factory.js';

const FRUIT  = ['🍎','🍏','🍇','🍓','🍒','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍈','🥭','🍑'];
const VEGGIE = ['🥦','🥕','🌽','🍅','🥒','🧄','🧅','🥬','🍆','🫑'];
const PROTEIN= ['🐟','🍗','🥚','🥜','🫘','🥩','🧀','🍖','🦐','🦑'];
const GRAINS = ['🍞','🥖','🥯','🥨','🍚','🍙','🍘','🍝'];

const GOOD = [...FRUIT, ...VEGGIE, ...PROTEIN, ...GRAINS].slice(0, 40);
const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥓','🥠','🥮'];

export async function boot(cfg={}) {
  return baseBoot({
    ...cfg,
    name: 'groups',
    pools: { good: GOOD, bad: JUNK },
    goldenRate: 0.06,
    goodRate:   0.75,
    judge: (ch) => {
      if(!ch) return { good:false, scoreDelta:-5 };
      const healthy = GOOD.includes(ch);
      return { good: healthy, scoreDelta: healthy?10:-5, feverDelta: healthy?5:0 };
    }
  });
}
