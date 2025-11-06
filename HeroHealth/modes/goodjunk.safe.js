// === modes/goodjunk.safe.js ===
import { boot as bootFactory } from '../vr/mode-factory.js';

const GOOD=['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK=['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

export async function boot(opts={}){
  return bootFactory({
    name:'goodjunk',
    pools:{ good:GOOD, bad:JUNK },
    judge:(char, ctx)=>{
      if(!char) return { good:false, scoreDelta:-5 }; // timeout on good = miss
      const isGood = GOOD.includes(char);
      if(isGood) return { good:true, scoreDelta: (ctx.feverActive?20:10), feverDelta:8 };
      return { good:false, scoreDelta:-5 };
    },
    ...opts
  });
}
