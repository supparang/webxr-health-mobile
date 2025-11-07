// === modes/goodjunk.safe.js — wrapper for factory ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

function judgeGoodJunk(hitChar, ctx){
  if (hitChar == null) return { good:false, scoreDelta:-5 }; // miss timeout
  const isGood = GOOD.includes(hitChar);
  return isGood ? { good:true, scoreDelta:10, feverDelta:1 } : { good:false, scoreDelta:-8 };
}

export async function boot(config = {}) {
  return factoryBoot({
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    judge: (ch, ctx) => judgeGoodJunk(ch, ctx),
    ui: { questStartText: `Mini Quest — เลือกอาหารดีให้ครบ ${config.goal ?? 40} ชิ้น` },
    ...config
  });
}
export default { boot };