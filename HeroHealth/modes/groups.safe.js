// === modes/groups.safe.js — production-safe ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// หมวดตัวอย่าง (ปรับ/เพิ่มได้)
const CATS = {
  veg:   ['🥦','🥬','🥕','🍅','🧅','🧄','🌽','🥒','🥔','🍆'],
  fruit: ['🍎','🍏','🍐','🍊','🍋','🍓','🍇','🍉','🍍','🥝','🫐','🍒','🍑','🍈','🥭'],
  grain: ['🍞','🥖','🥐','🥨','🥯','🍚','🍙','🍘','🍜','🍝','🍛'],
  protein:['🐟','🍗','🥩','🍤','🥚','🧄'],   // ใส่โปรตีนอื่น ๆ เพิ่มได้
  junk:  ['🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🥤','🧋','🍿']
};

// สร้างพูลรวม เพื่อให้ factory จัด spawn ได้
const GOOD = [...CATS.veg, ...CATS.fruit, ...CATS.grain, ...CATS.protein];
const BAD  = [...CATS.junk];

export async function boot(opts = {}) {
  let modeApi = null;

  // ตัวอย่างกติกา: รอบนี้กำหนด "หมวดเป้าหมาย" แบบสุ่ม 1–3 หมวด
  const allKeys = ['veg','fruit','grain','protein'];
  const pickN = (n)=> {
    const src=[...allKeys], out=[];
    while(out.length<n && src.length){ out.push(src.splice(Math.floor(Math.random()*src.length),1)[0]); }
    return out;
  };
  const targetCats = pickN(2); // เริ่ม 2 หมวด (ค่อย ๆ เพิ่มได้ภายหลัง)

  function judge(hitChar, ctx){
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-2 };

    // อยู่ในเป้าหมายถือว่าถูก, ถ้าเป็น junk = ผิด
    const isTarget = targetCats.some(k => (CATS[k]||[]).includes(hitChar));
    const isJunk   = CATS.junk.includes(hitChar);

    if (isJunk) return { good:false, scoreDelta:-6 };
    if (isTarget) return { good:true, scoreDelta:12, feverDelta:6 };
    // ไม่ใช่หมวดเป้าหมายแต่ยังเป็นของดี → คะแนนน้อยหน่อย
    if (GOOD.includes(hitChar)) return { good:true, scoreDelta:5 };

    return { good:false, scoreDelta:-3 };
  }

  modeApi = await factoryBoot({
    name: 'groups',
    pools: { good: GOOD, bad: BAD },
    judge,
    difficulty: opts.difficulty || 'normal',
    host: opts.host,
    goal: opts.goal || 10,
    goldenRate: 0.05,
    goodRate: 0.80,
    ui: { questMainSel: '#tQmain' }
  });

  try { window.__MODE_API = modeApi; } catch {}
  return modeApi;
}