// --- single-instance guard ---
if (window.__MODE_API) {
  try { window.__MODE_API.stop?.(); } catch {}
  delete window.__MODE_API;
}

import { boot as factoryBoot } from '../vr/mode-factory.js';

// 5 หมู่ + หมวดพิเศษ (ตัวอย่างไอคอน)
const VEG   = ['🥦','🥕','🥬','🍅','🍆','🌽','🧄','🧅','🥒','🥔'];
const FRUIT = ['🍎','🍓','🍇','🍍','🍉','🍐','🍊','🫐','🥝','🍋'];
const GRAIN = ['🍞','🥖','🥨','🥯','🍚','🍙','🍘','🍜','🍝','🥞'];
const PROTEIN=['🐟','🍗','🥩','🍤','🥚','🧀','🥜','🌰','🫘','🥛'];
const FAT   = ['🧈','🫒','🥑','🥜','🌰']; // หมวดไขมันดี/ปรุง
const JUNK  = ['🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🥤','🧋','🍿'];

const ALL = [...VEG, ...FRUIT, ...GRAIN, ...PROTEIN, ...FAT];

function isIn(char, list){ return list.includes(char); }

export async function boot(opts = {}) {
  // โกลรอบละ 5 หมู่ (Plate Set) → ครบเริ่มชุดใหม่
  let need = { veg:1, fruit:1, grain:1, protein:1, fat:1 };
  let filled = { veg:0, fruit:0, grain:0, protein:0, fat:0 };

  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-3 };

    if (JUNK.includes(char)) return { good:false, scoreDelta:-10 };

    let hit = null;
    if (isIn(char, VEG))     hit = 'veg';
    else if (isIn(char, FRUIT))   hit = 'fruit';
    else if (isIn(char, GRAIN))   hit = 'grain';
    else if (isIn(char, PROTEIN)) hit = 'protein';
    else if (isIn(char, FAT))     hit = 'fat';

    if (!hit) return { good:false, scoreDelta:-2 };

    // ให้แต้มถ้ายังขาดหมวดนั้นอยู่
    const remaining = Math.max(0, need[hit] - filled[hit]);
    if (remaining > 0){
      filled[hit] += 1;
      const doneSet = Object.keys(need).every(k => filled[k] >= need[k]);
      // ครบจาน → ปรับรูปแบบใหม่ (เพิ่มความยากเล็กน้อย)
      if (doneSet){
        // สุ่มโควตาชุดถัดไป: 1–2 ต่อหมวด
        need = {
          veg: 1 + (Math.random()<0.35?1:0),
          fruit: 1 + (Math.random()<0.35?1:0),
          grain: 1 + (Math.random()<0.35?1:0),
          protein: 1 + (Math.random()<0.35?1:0),
          fat: 1 // ไขมันคง 1 ชิ้น/ชุด
        };
        filled = { veg:0, fruit:0, grain:0, protein:0, fat:0 };
        return { good:true, scoreDelta: 40, feverDelta: 10 }; // โบนัสครบชุด
      }
      return { good:true, scoreDelta: 12, feverDelta: 4 };
    }

    // ถ้ามีเกินโควตา → ได้แต้มเล็กน้อยหรือ 0 (เพื่อไม่สแปมหมวดเดียว)
    return { good:true, scoreDelta: 2 };
  };

  const modeApi = await factoryBoot({
    name: 'plate',
    pools: { good: ALL, bad: JUNK },
    judge,
    ui: { questMainSel: '#tQmain' },
    goldenRate: 0.04,
    goodRate: 0.85,
    ...opts
  });

  // เผื่อ HUD ภายนอกอยากโชว์โควตาที่ต้องการ/ที่ทำได้
  modeApi.getPlateNeed   = ()=> ({ ...need });
  modeApi.getPlateFilled = ()=> ({ ...filled });

  const origStop = modeApi.stop?.bind(modeApi);
  modeApi.stop = function(){
    // cleanup เฉพาะโหมดนี้ (ถ้ามี)
    origStop?.();
  };

  window.__MODE_API = modeApi;
  return modeApi;
}
