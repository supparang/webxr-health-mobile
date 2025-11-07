// === modes/goodjunk.safe.js — production shim (ensures named export) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// พูลมาตรฐาน (กลุ่มละ ~20)
const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

// ถ้าไฟล์นี้เคยมีฟังก์ชันภายใน เช่น start/run/init ให้เรียกใช้ก่อน (ไม่รู้ชื่อแน่ชัด จึงตรวจแบบปลอดภัย)
const INTERNAL =
  (typeof start === 'function' && start) ||
  (typeof run   === 'function' && run)   ||
  (typeof init  === 'function' && init)  || null;

export async function boot(config = {}) {
  console.log('[goodjunk] boot mode', config);

  // ใช้โค้ดเดิมถ้ามี
  if (INTERNAL) return await INTERNAL(config);

  // ไม่มีก็เรียกโรงงานกลาง
  const judge = (char, ctx) => {
    if (ctx?.type === 'timeout') return { good: false, scoreDelta: -3 };
    const isGood = GOOD.includes(char);
    const isBad  = JUNK.includes(char);
    if (isGood && !isBad) return { good: true,  scoreDelta: 10, feverDelta: 1 };
    return { good: false, scoreDelta: -5 };
  };

  return await factoryBoot({
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    judge,
    ui: { questMainSel: '#tQmain' },
    goldenRate: 0.07,
    goodRate: 0.70,
    ...config
  });
}

// optional default เพื่อความเข้ากันได้
export default { boot };