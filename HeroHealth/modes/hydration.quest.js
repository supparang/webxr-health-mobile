// === modes/hydration.quest.js — production-safe (ควบคุมระดับน้ำ + เควส) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// ไอคอนของดี/ของไม่ดีต่อสมดุลน้ำ (ตัวอย่าง)
const GOOD = ['💧','🥛','🍉','🍐','🍊','🥒'];     // น้ำ, นม, ผลไม้ฉ่ำน้ำ, ผักน้ําสูง
const BAD  = ['🥤','🧋','🍺','🍷','🍫','🍟'];     // น้ำหวาน, คาเฟอีน/แอลกอฮอล์, เค็มจัดมันจัด

export async function boot(opts = {}) {
  let modeApi = null;

  // สถานะสมดุลน้ำในร่างกาย (0–100) โซน: LOW<40 / GREEN 40–70 / HIGH>70
  let hydro = 55;

  function zone(v){ return v<40 ? 'LOW' : v>70 ? 'HIGH' : 'GREEN'; }

  function judge(hitChar, ctx){
    if (ctx?.type === 'timeout') {
      // ปล่อยผ่าน = สมดุลค่อย ๆ ลด
      hydro = Math.max(0, hydro - 2);
      return { good:false, scoreDelta:0 };
    }

    // ปรับระดับน้ำ
    if (GOOD.includes(hitChar)) hydro = Math.min(100, hydro + 8);
    else if (BAD.includes(hitChar)) hydro = Math.max(0, hydro - 10);
    else hydro = Math.max(0, hydro - 1);

    const z = zone(hydro);

    // ให้คะแนนตามโซน
    if (GOOD.includes(hitChar)) {
      if (z === 'GREEN') return { good:true, scoreDelta:12, feverDelta:6 };
      if (z === 'HIGH')  return { good:true, scoreDelta:6 };
      return { good:true, scoreDelta:8 }; // จาก LOW ขึ้นมา
    } else if (BAD.includes(hitChar)) {
      if (z === 'LOW')  return { good:false, scoreDelta:-10 }; // ลงโทษหนักเมื่ออยู่โซนต่ำแล้วกดยิ่งแย่
      if (z === 'HIGH') return { good:false, scoreDelta:-3 };  // โซนสูงโดนเบากว่า
      return { good:false, scoreDelta:-6 };
    }
    return { good:false, scoreDelta:0 };
  }

  modeApi = await factoryBoot({
    name: 'hydration',
    pools: { good: GOOD, bad: BAD },
    judge,
    difficulty: opts.difficulty || 'normal',
    host: opts.host,
    goal: opts.goal || 1,     // ชนะด้วย “อยู่ในโซน GREEN ตามเวลา” จะถูกนับฝั่ง MiniQuest/Timer
    goldenRate: 0.03,
    goodRate: 0.65,
    ui: { questMainSel: '#tQmain' }
  });

  try { window.__MODE_API = modeApi; } catch {}
  return modeApi;
}