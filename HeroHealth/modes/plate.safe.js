// === modes/plate.safe.js ===
import { boot as bootFactory } from '../vr/mode-factory.js';

const GRAIN = ['🍞','🥯','🥖','🍚','🍙','🍘','🫓','🥨','🥞','🧇','🍜','🍝'];
const PROT  = ['🐟','🥚','🥩','🍗','🧀','🥜','🫘','🍤','🍣','🥙','🌯'];
const VEG   = ['🥗','🥦','🥬','🥕','🌽','🫑','🍆','🥒','🍄','🥔','🧄','🧅'];
const FRUIT = ['🍎','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒'];
const DAIRY = ['🥛','🧈','🧀','🍦','🍨']; // ใช้พอประมาณ

const SETS = [
  { key:'ธัญพืช', set:GRAIN },
  { key:'โปรตีน', set:PROT  },
  { key:'ผัก',   set:VEG   },
  { key:'ผลไม้', set:FRUIT },
  { key:'นม',    set:DAIRY },
];

export async function boot(opts={}){
  let cur = SETS[Math.floor(Math.random()*SETS.length)];
  try{ document.querySelector('#tQmain')?.setAttribute('troika-text',`value: เก็บหมวด: ${cur.key}`); }catch{}

  return bootFactory({
    name:'plate',
    pools:{ good:[...cur.set], bad:[...GRAIN,...PROT,...VEG,...FRUIT,...DAIRY].filter(x=>!cur.set.includes(x)) },
    judge:(char, ctx)=>{
      if(!char) return { good:false, scoreDelta:-6 };
      const ok = cur.set.includes(char);
      if(ok && (ctx.streak+1)%5===0){
        cur = SETS[Math.floor(Math.random()*SETS.length)];
        try{ document.querySelector('#tQmain')?.setAttribute('troika-text',`value: เก็บหมวด: ${cur.key}`); }catch{}
      }
      return ok ? { good:true, scoreDelta:12, feverDelta:8 } : { good:false, scoreDelta:-6 };
    },
    ...opts
  });
}
