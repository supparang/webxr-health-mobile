// === modes/plate.quest.js — production-safe (จานอาหาร 5 หมู่ + หมวดพิเศษ) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GROUPS = {
  veg:   ['🥦','🥬','🥕','🍅','🌽','🥒','🍆','🧅','🧄','🥔'],
  fruit: ['🍎','🍏','🍐','🍊','🍋','🍓','🍇','🍉','🍍','🥝','🫐','🍒','🍑','🍈','🥭'],
  grain: ['🍞','🥖','🍚','🍙','🍘','🍜','🍝','🥯','🥨'],
  protein:['🐟','🍗','🥩','🍤','🥚','🫘','🥜','🧀'],
  dairy: ['🥛','🧀','🍦','🍨'],           // ใช้เป็น “หมู่นม/ทางเลือก”
  special:['⭐','💎']                     // หมวดพิเศษ (บัฟ/มัลติเพลเยอร์ ฯลฯ)
};

const GOOD = [...GROUPS.veg, ...GROUPS.fruit, ...GROUPS.grain, ...GROUPS.protein, ...GROUPS.dairy];
const BAD  = ['🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🥤','🧋','🍿'];

export async function boot(opts = {}) {
  let modeApi = null;

  // เป้าหมาย: จัดครบ 5 หมู่ในเวลาที่กำหนด แล้วเริ่มรอบใหม่ (เปลี่ยนความต้องการต่อหมู่แบบสุ่มเล็กน้อย)
  let need = nextRoundNeed();        // {veg:1, fruit:1, grain:1, protein:1, dairy:1}
  let done = { veg:0, fruit:0, grain:0, protein:0, dairy:0 };

  function nextRoundNeed(){
    // สุ่ม 1–2 ต่อหมู่
    const oneOrTwo = ()=> (Math.random()<0.5?1:2);
    return { veg:oneOrTwo(), fruit:oneOrTwo(), grain:oneOrTwo(), protein:oneOrTwo(), dairy:oneOrTwo() };
  }

  function groupOf(ch){
    for (const [k, arr] of Object.entries(GROUPS)){
      if (arr.includes(ch)) return k;
    }
    return null;
  }

  function allMet(){
    return Object.keys(need).every(k => (done[k] >= need[k]));
  }

  function judge(hitChar, ctx){
    if (ctx?.type === 'timeout') return { good:false, scoreDelta:-1 };

    if (BAD.includes(hitChar)) return { good:false, scoreDelta:-6 };

    const g = groupOf(hitChar);
    if (!g || g==='special') return { good:false, scoreDelta:0 };

    // สะสมจำนวนที่ทำได้
    done[g] = (done[g]||0) + 1;

    // เคลียร์รอบเมื่อครบ 5 หมู่ตาม need
    if (allMet()){
      need = nextRoundNeed();
      done = { veg:0, fruit:0, grain:0, protein:0, dairy:0 };
      // ให้บัฟคะแนนพิเศษ
      return { good:true, scoreDelta:30, feverDelta:10 };
    }
    return { good:true, scoreDelta:10, feverDelta:4 };
  }

  modeApi = await factoryBoot({
    name: 'plate',
    pools: { good: GOOD, bad: BAD },
    judge,
    difficulty: opts.difficulty || 'normal',
    host: opts.host,
    goal: opts.goal || 2,      // จำนวนรอบ “ครบ 5 หมู่” ขั้นต่ำ (ปล่อยให้ MiniQuest แสดงผล)
    goldenRate: 0.04,
    goodRate: 0.85,
    ui: { questMainSel: '#tQmain' }
  });

  try { window.__MODE_API = modeApi; } catch {}
  return modeApi;
}