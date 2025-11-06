// === modes/groups.safe.js ===
import { boot as bootFactory } from '../vr/mode-factory.js';

const FRUITS = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🍌','🍅','🍊','🍓','🍎'];
const PROTEIN= ['🐟','🥚','🥩','🍗','🥓','🧀','🥜','🌰','🫘','🍤','🦐','🦑','🥙','🌯','🍣','🍛','🍖','🍔','🌭','🍗'];
const GRAINS = ['🍞','🥯','🥖','🥐','🍚','🍙','🍘','🫓','🥨','🫕','🫔','🍜','🍝','🍱','🥞','🧇','🍩','🥟','🥪','🍿'];
const VEGGIE = ['🥗','🥦','🥬','🥕','🌽','🫑','🍆','🧄','🧅','🥒','🍄','🥔','🌶️','🥗','🥦','🥬','🥕','🍅','🫛','🧄'];

const GROUPS = [
  { key:'ผลไม้',  set:FRUITS },
  { key:'โปรตีน', set:PROTEIN },
  { key:'ธัญพืช', set:GRAINS },
  { key:'ผัก',    set:VEGGIE },
];

export async function boot(opts={}){
  let current = GROUPS[Math.floor(Math.random()*GROUPS.length)];
  // แสดงคำสั่งบน Mini Quest line
  try{ document.querySelector('#tQmain')?.setAttribute('troika-text',`value: เก็บกลุ่ม: ${current.key}`); }catch{}

  return bootFactory({
    name:'groups',
    pools:{ good:[...current.set], bad:[...FRUITS,...PROTEIN,...GRAINS,...VEGGIE].filter(x=>!current.set.includes(x)) },
    judge:(char, ctx)=>{
      if(!char) return { good:false, scoreDelta:-6 };
      const ok = current.set.includes(char);
      // เปลี่ยนกลุ่มทุก ๆ 6 ตัวที่เก็บถูก
      if(ok && (ctx.streak+1)%6===0){
        current = GROUPS[Math.floor(Math.random()*GROUPS.length)];
        try{ document.querySelector('#tQmain')?.setAttribute('troika-text',`value: เก็บกลุ่ม: ${current.key}`); }catch{}
      }
      return ok ? { good:true, scoreDelta:12, feverDelta:8 } : { good:false, scoreDelta:-6 };
    },
    ...opts
  });
}
