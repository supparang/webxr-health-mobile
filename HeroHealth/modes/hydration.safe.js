// === modes/hydration.safe.js ===
import { boot as bootFactory } from '../vr/mode-factory.js';

const HYDRATE = ['💧','🧊','🥛','🍵','🍶','🍵','🥤','🧃','🥣','🥥','🫗']; // จัดเป็น “ดี” เน้นน้ำ/ซุป/ชาอ่อน
const SWEET   = ['🧋','🥤','🥤','🍹','🍸','🍷','🍺','🍾','🍶','☕','🧃','🍧','🍨']; // หวาน/คาเฟอีน/แอลกอฮอล์

export async function boot(opts={}){
  // ให้ 💧 ออกบ่อยกว่า (ดีต่อ)
  return bootFactory({
    name:'hydration',
    pools:{ good:HYDRATE, bad:SWEET },
    goodRate:0.75,
    judge:(char, ctx)=>{
      if(!char) return { good:false, scoreDelta:-5 };
      const ok = HYDRATE.includes(char);
      return ok ? { good:true, scoreDelta:(ctx.feverActive?20:10), feverDelta:8 } : { good:false, scoreDelta:-5 };
    },
    ...opts
  });
}
