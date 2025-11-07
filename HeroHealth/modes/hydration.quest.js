// === modes/hydration.quest.js — water balance gameplay ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// ดื่มได้/ดื่มไม่ดี
const GOOD = ['🥛','💧','🫗','🧊','🍵','🫖','🥤']; // (กำหนดน้ำ/ชาอ่อน)
const BAD  = ['🍺','🍷','🍸','🧋','☕','🥃','🍹'];

let level = 50; // 0..100

function judgeHydration(hitChar, ctx){
  if (hitChar == null) { level = Math.max(0, level - 5); return { good:false, scoreDelta:-2 }; }

  const good = GOOD.includes(hitChar);
  const bad  = BAD.includes(hitChar);

  // ปรับระดับน้ำ
  if (good) level = Math.min(100, level + 6);
  if (bad)  level = Math.max(0, level - 8);

  // โซน
  const inGreen = (level >= 40 && level <= 65);
  const inHigh  = (level > 65);

  if (good) {
    // ถ้าสูงเกินแล้วยังกินต่อ → โทษเบา
    if (inHigh) return { good:false, scoreDelta:-4 };
    return { good:true, scoreDelta:10, feverDelta: inGreen ? 1 : 0 };
  }
  if (bad) {
    // ถ้าน้ำต่ำ แล้วยังดื่มไม่ดี → โทษหนัก
    if (level < 40) return { good:false, scoreDelta:-10 };
    return { good:false, scoreDelta:-6 };
  }
  return { good:false, scoreDelta:-3 };
}

export async function boot(config = {}) {
  level = 50; // reset
  return factoryBoot({
    name: 'hydration',
    pools: { good: [...GOOD, ...BAD] },
    judge: (ch, ctx) => judgeHydration(ch, ctx),
    ui: { questStartText: 'Mini Quest — รักษาระดับน้ำให้อยู่ในโซน GREEN' },
    ...config
  });
}
export default { boot };