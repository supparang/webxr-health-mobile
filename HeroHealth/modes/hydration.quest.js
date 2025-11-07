// === modes/hydration.quest.js — production shim (named + default export) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GOOD_DRINKS = ['💧','🥛','🫖','🍵','🧃'];
const RISK_DRINKS = ['🥤','🧋','🍹','🍺','🍷','🍻','🍾'];

const INTERNAL =
  (typeof start === 'function' && start) ||
  (typeof run   === 'function' && run)   ||
  (typeof init  === 'function' && init)  || null;

export async function boot(config = {}) {
  console.log('[hydration] boot mode', config);
  if (INTERNAL) return await INTERNAL(config);

  const judge=(char,ctx)=>{
    if (ctx?.type==='timeout') return { good:false, scoreDelta:-2 };
    if (GOOD_DRINKS.includes(char)) return { good:true, scoreDelta:10, feverDelta:1 };
    if (RISK_DRINKS.includes(char)) return { good:false, scoreDelta:-7 };
    return { good:false, scoreDelta:-2 };
  };

  return await factoryBoot({
    name:'hydration',
    pools:{ good:GOOD_DRINKS, bad:RISK_DRINKS },
    judge,
    ui:{ questMainSel:'#tQmain' },
    goldenRate:0.04, goodRate:0.75,
    ...config
  });
}

export default { boot };