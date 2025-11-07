// === modes/goodjunk.safe.js — production-safe (no duplicated `api`) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// กลุ่มละ 20 อย่าง (ตัวอย่าง)
const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

export async function boot(opts = {}) {
  let modeApi = null;

  // กติกา: กด GOOD ได้คะแนน +10, กด JUNK ติดลบ -5
  function judge(hitChar, ctx){
    if (ctx?.type === 'timeout') {
      // พลาด = ถือเป็น junk miss
      return { good:false, scoreDelta:-2 };
    }
    const isGood = GOOD.includes(hitChar);
    if (isGood) return { good:true, scoreDelta:10, feverDelta:5 };
    return { good:false, scoreDelta:-5 };
  }

  modeApi = await factoryBoot({
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    judge,
    difficulty: opts.difficulty || 'normal',
    host: opts.host,
    goal: opts.goal || 40,
    goldenRate: 0.07,
    goodRate: 0.70,
    ui: { questMainSel: '#tQmain' }
  });

  try { window.__MODE_API = modeApi; } catch {}
  return modeApi;
}