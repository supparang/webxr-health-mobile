// === Hero Health — modes/goodjunk.safe.js (Production) ===
// ใช้แกนเกมจาก vr/mode-factory.js + นิยามพูล "ของดี" / "ของขยะ" และกติกาให้คะแนน

import { boot as factoryBoot } from '../vr/mode-factory.js';

// พูลอีโมจิ (คละผักผลไม้/อาหารดี) และขยะ
const GOOD = [
  '🍎','🍏','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🥝','🍍','🍒','🍑','🥭','🍈',
  '🥦','🥕','🥬','🍅','🌽','🧅','🫑','🍠','🥗','🍚','🍞','🥜','🐟','🥛','🧀'
];

const JUNK = [
  '🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿'
];

// กติกาให้คะแนน/ลงโทษ
function judgeGoodJunk(char, ctx){
  // timeout (miss) จาก factory จะส่ง char=null
  if (char == null) {
    // พลาด — ลดสกอร์เล็กน้อย รีเซ็ตคอมโบถูกจัดการใน factory แล้ว
    return { good:false, scoreDelta:-3 };
  }

  const isGood = GOOD.includes(char);
  if (isGood){
    // ให้ +10 พื้นฐาน พร้อมโบนัสคอมโบเบา ๆ ทุก ๆ 5 คอมโบ (+2)
    const bonus = (ctx.combo && ((ctx.combo+1) % 5 === 0)) ? 2 : 0;
    return { good:true, scoreDelta: 10 + bonus };
  }else{
    // ขยะ: หัก 5 แต้ม (ขั้นต่ำไม่ติดลบใน factory)
    return { good:false, scoreDelta:-5 };
  }
}

// เลือกเป้าหมาย (goal) ตามความยาก
const GOAL_BY_DIFF = { easy: 24, normal: 36, hard: 50 };

export async function boot(config = {}){
  const diff = config.difficulty || 'normal';
  const goal = GOAL_BY_DIFF[diff] ?? 36;

  // แจ้ง Mini-Quest ตอนเริ่ม
  try {
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { text: `โหมด Good vs Junk — เก็บของดีให้ครบ ${goal} ชิ้น หลีกเลี่ยงของขยะ!` }
    }));
  } catch {}

  // เรียกแกนเกม (anti-overlap, คะแนน/คอมโบ/เอฟเฟกต์ จัดการให้)
  return factoryBoot({
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    judge: judgeGoodJunk,
    goal,
    ...config
  });
}

export default { boot };