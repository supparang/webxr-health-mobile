// === goodjunk.safe.js — Good vs Junk (20/20 items) ===
import { boot as baseBoot } from '../vr/mode-factory.js';

const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

export async function boot(cfg={}) {
  return baseBoot({
    ...cfg,
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    goldenRate: 0.07,
    goodRate:   0.70,
    // ให้ดี = +10 / ขยะ = -5 และเติม fever เมื่อเก็บดี
    judge: (ch, ctx) => {
      if(!ch) return { good:false, scoreDelta:-5 };
      const healthy = GOOD.includes(ch);
      return { good: healthy, scoreDelta: healthy?10:-5, feverDelta: healthy?5:0 };
    }
  });
}
