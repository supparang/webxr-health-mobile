// === modes/groups.safe.js — production shim (named + default export) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GROUPS = {
  veg:['🥦','🥬','🥕','🧅','🍅','🌽','🍆','🫑'],
  fruit:['🍎','🍏','🍉','🍌','🍍','🍇','🍓','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑'],
  grain:['🍞','🥖','🥯','🍚','🍘','🍙','🍜','🍝'],
  protein:['🥚','🐟','🍗','🥩','🥜'],
  dairy:['🥛','🧀','🍦'],
  junk:['🍔','🍟','🍕','🍩','🍪','🧁','🍰','🍫','🍭','🥤','🧋','🍿']
};
const ALL_GOOD=[...GROUPS.veg,...GROUPS.fruit,...GROUPS.grain,...GROUPS.protein,...GROUPS.dairy];
const ALL_JUNK=GROUPS.junk;

const INTERNAL =
  (typeof start === 'function' && start) ||
  (typeof run   === 'function' && run)   ||
  (typeof init  === 'function' && init)  || null;

export async function boot(config = {}) {
  console.log('[groups] boot mode', config);
  if (INTERNAL) return await INTERNAL(config);

  const judge=(char,ctx)=>{
    if (ctx?.type==='timeout') return { good:false, scoreDelta:-3 };
    if (ALL_GOOD.includes(char)) return { good:true, scoreDelta:8, feverDelta:1 };
    if (ALL_JUNK.includes(char)) return { good:false, scoreDelta:-6 };
    return { good:false, scoreDelta:-2 };
  };

  return await factoryBoot({
    name:'groups',
    pools:{ good:ALL_GOOD, bad:ALL_JUNK },
    judge,
    ui:{ questMainSel:'#tQmain' },
    goldenRate:0.05, goodRate:0.80,
    ...config
  });
}

export default { boot };