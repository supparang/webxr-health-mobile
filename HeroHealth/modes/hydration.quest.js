// --- single-instance guard ---
if (window.__MODE_API) {
  try { window.__MODE_API.stop?.(); } catch {}
  delete window.__MODE_API;
}

import { boot as factoryBoot } from '../vr/mode-factory.js';

// น้ำดี / เสี่ยง
const HYDRATE_GOOD = ['💧','🚰','🥤','🫗','🧊'];        // น้ำเปล่า/ดื่มน้ำ
const HYDRATE_BAD  = ['🍺','🍷','🥃','🧋','🥤🧋','🍸','🍹']; // น้ำตาล/คาเฟอีน/แอลกอฮอล์ (สัญลักษณ์)

let level = 50; // 0–100

function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function zone(){ return level<35?'LOW':(level>65?'HIGH':'GREEN'); }

export async function boot(opts = {}) {
  // ผู้ตัดสินผล & กติกาโซนระดับน้ำ
  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-2 };

    const isGood = HYDRATE_GOOD.includes(char);
    const isBad  = HYDRATE_BAD.includes(char);
    const z = zone();

    if (isGood){
      // ดื่มน้ำ: เพิ่มระดับน้ำ
      level = clamp(level + (z==='LOW'?12 : z==='GREEN'?8 : 4), 0, 100);
      const bonus = (z==='LOW'?14 : z==='GREEN'?10 : 6);
      const fever = (z==='GREEN'?6 : 2);
      return { good:true, scoreDelta: bonus, feverDelta: fever };
    }

    if (isBad){
      // ถ้า HIGH ให้คะแนนได้เล็กน้อย (ฝึกบาลานซ์กลับ GREEN)
      if (z==='HIGH'){
        level = clamp(level - 10, 0, 100);
        return { good:true, scoreDelta: 6, feverDelta: 2 };
      }
      // LOW/กลาง → ลงโทษแรง
      level = clamp(level - (z==='LOW'?12:8), 0, 100);
      return { good:false, scoreDelta: -10 };
    }

    // อื่น ๆ ไม่มีผล
    return { good:false, scoreDelta: -1 };
  };

  const modeApi = await factoryBoot({
    name: 'hydration',
    pools: { good: HYDRATE_GOOD, bad: HYDRATE_BAD },
    judge,
    ui: { questMainSel: '#tQmain' },
    goldenRate: 0.03,
    goodRate: 0.70,
    ...opts
  });

  // ตัวอย่าง: expose ตัวอ่านค่า level (ถ้าจะไปโชว์บน HUD ภายนอก)
  modeApi.getHydrationLevel = ()=> level;

  const origStop = modeApi.stop?.bind(modeApi);
  modeApi.stop = function(){
    // cleanup เฉพาะโหมดนี้ (ถ้ามี interval ฯลฯ)
    origStop?.();
  };

  window.__MODE_API = modeApi;
  return modeApi;
}
