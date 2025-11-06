// --- single-instance guard ---
if (window.__MODE_API) {
  try { window.__MODE_API.stop?.(); } catch {}
  delete window.__MODE_API;
}

import { boot as factoryBoot } from '../vr/mode-factory.js';

// ตัวอย่างหมวด (คุณมีชุดจริงอยู่แล้วสามารถแทนได้)
const VEG   = ['🥦','🥕','🥬','🍅','🍆','🌽','🧄','🧅','🥒','🥔'];
const FRUIT = ['🍎','🍓','🍇','🍍','🍉','🍐','🍊','🫐','🥝','🍋'];
const GRAIN = ['🍞','🥖','🥨','🥯','🍚','🍙','🍘','🍜','🍝','🥞'];
const PROTEIN=['🐟','🍗','🥩','🍤','🥚','🧀','🥜','🌰','🫘','🥛']; // + dairy/protein
const JUNK  = ['🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🥤','🧋','🍿'];

const ALL_GOOD = [...VEG, ...FRUIT, ...GRAIN, ...PROTEIN];

export async function boot(opts = {}) {
  // โหมดนี้มักสุ่ม “หมวดเป้า” เป็นรอบ ๆ — ตัวอย่างง่าย ๆ:
  let currentCat = 'VEG';
  const catPools = { VEG, FRUIT, GRAIN, PROTEIN };

  // ผู้ตัดสิน: กดตรงหมวดเป้าคือถูก กดหมวดอื่น=เตือน กด JUNK=ผิด
  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-3 };
    const inJunk = JUNK.includes(char);
    if (inJunk) return { good:false, scoreDelta:-8 };
    const pool = catPools[currentCat] || [];
    if (pool.includes(char)) return { good:true, scoreDelta:12, feverDelta:5 };
    return { good:false, scoreDelta:-2 }; // ผิดหมวด
  };

  const modeApi = await factoryBoot({
    name: 'groups',
    pools: { good: ALL_GOOD, bad: JUNK },
    judge,
    ui: { questMainSel: '#tQmain' },
    goldenRate: 0.05,
    goodRate: 0.80,
    ...opts
  });

  const origStop = modeApi.stop?.bind(modeApi);
  modeApi.stop = function(){
    // cleanup เฉพาะโหมดนี้ (ถ้ามี)
    origStop?.();
  };

  window.__MODE_API = modeApi;
  return modeApi;
}
