// === Hero Health — modes/groups.safe.js (Production) ===
// โหมด: จัดกลุ่มอาหาร (Food Groups)
// ใช้ระบบจาก vr/mode-factory.js พร้อมภารกิจเก็บอาหารให้ครบแต่ละหมวด

import { boot as factoryBoot } from '../vr/mode-factory.js';

// หมวดหมู่อาหารหลัก
const GROUPS = {
  grains : ['🍚','🍞','🥖','🥯','🥨','🍙','🍘'],
  protein: ['🥩','🍗','🥚','🐟','🦐','🍤','🥜','🌰','🍖'],
  dairy  : ['🥛','🧀','🍦','🍨','🥞'],
  fruit  : ['🍎','🍓','🍇','🍉','🍌','🍍','🍋','🍊','🍐','🍑','🍒','🍈','🥭'],
  veggie : ['🥦','🥬','🥕','🍅','🌽','🧅','🫑','🥗']
};

// รวบรวมทั้งหมดเป็น pool เดียว
const ALL = Object.values(GROUPS).flat();
const BAD = ['🍩','🍪','🍰','🍔','🍕','🌭','🥓','🥤','🍫','🧁','🍿','🍟'];

// ตารางภารกิจย่อย
const QUEST_BY_DIFF = {
  easy:   { goal: 25, desc: 'เก็บอาหารแต่ละหมวดหมู่รวม 25 ชิ้น หลีกเลี่ยงขยะ!' },
  normal: { goal: 40, desc: 'เก็บอาหารแต่ละหมวดหมู่รวม 40 ชิ้น หลีกเลี่ยงขยะ!' },
  hard:   { goal: 55, desc: 'เก็บอาหารแต่ละหมวดหมู่รวม 55 ชิ้น หลีกเลี่ยงขยะ!' }
};

// กติกาให้คะแนน
function judgeGroups(char, ctx){
  if (char == null) return { good:false, scoreDelta:-3 };

  const isHealthy = ALL.includes(char);
  const isJunk = BAD.includes(char);

  if (isHealthy){
    const bonus = (ctx.combo && ((ctx.combo+1) % 5 === 0)) ? 3 : 0;
    return { good:true, scoreDelta: 12 + bonus };
  }
  else if (isJunk){
    return { good:false, scoreDelta:-6 };
  }
  else {
    // ไม่อยู่ในชุดใด ๆ → ไม่ให้คะแนน
    return { good:false, scoreDelta:0 };
  }
}

// Boot โหมดหลัก
export async function boot(config = {}){
  const diff = config.difficulty || 'normal';
  const quest = QUEST_BY_DIFF[diff] ?? QUEST_BY_DIFF.normal;

  // แจ้ง Mini Quest ตอนเริ่ม
  try {
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { text: `โหมด Food Groups — ${quest.desc}` }
    }));
  } catch {}

  // เรียก factory
  return factoryBoot({
    name: 'groups',
    pools: { good: ALL, bad: BAD },
    judge: judgeGroups,
    goal: quest.goal,
    ...config
  });
}

export default { boot };