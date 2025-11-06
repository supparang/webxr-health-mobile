// --- single-instance guard (prevent duplicate globals across hot reloads) ---
if (window.__MODE_API) {
  try { window.__MODE_API.stop?.(); } catch {}
  delete window.__MODE_API;
}

import { boot as factoryBoot } from '../vr/mode-factory.js';

// กลุ่มละ 20 อย่าง (GOOD / JUNK)
const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

function sample(a){ return a[Math.floor(Math.random()*a.length)]; }

export async function boot(opts = {}) {
  // ผู้ตัดสินผลโดนเป้า
  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-5 };
    const isGood = !!GOOD.includes(char);
    if (isGood) return { good:true,  scoreDelta:10, feverDelta:5 };
    return { good:false, scoreDelta:-8 };
  };

  const modeApi = await factoryBoot({
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    judge,
    ui: { questMainSel: '#tQmain' },
    goldenRate: 0.07,
    goodRate: 0.70,
    // ค่ามาตรฐานจาก mode-factory จะจัด anti-overlap ให้อยู่แล้ว
    ...opts
  });

  // (ถ้ามีงานล้างทรัพยากรเพิ่ม ให้พัน stop ที่นี่)
  const origStop = modeApi.stop?.bind(modeApi);
  modeApi.stop = function(){
    // cleanup เฉพาะโหมดนี้ (ถ้ามี)
    origStop?.();
  };

  window.__MODE_API = modeApi;
  return modeApi;
}
