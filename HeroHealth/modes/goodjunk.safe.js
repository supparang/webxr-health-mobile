// === modes/goodjunk.safe.js — production shim (named + default export) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

const INTERNAL =
  (typeof start === 'function' && start) ||
  (typeof run   === 'function' && run)   ||
  (typeof init  === 'function' && init)  || null;

export async function boot(config = {}) {
  console.log('[goodjunk] boot mode', config);
  if (INTERNAL) return await INTERNAL(config);

  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-3 };
    const isGood = GOOD.includes(char), isBad = JUNK.includes(char);
    if (isGood && !isBad) return { good:true, scoreDelta:10, feverDelta:1 };
    return { good:false, scoreDelta:-5 };
  };

  return await factoryBoot({
    name:'goodjunk',
    pools:{ good:GOOD, bad:JUNK },
    judge,
    ui:{ questMainSel:'#tQmain' },
    goldenRate:0.07, goodRate:0.70,
    ...config
  });
}

export default { boot };