// === goodjunk.safe.js — Good vs Junk (Production Mode, 2025-11-06) ===
import { boot as baseBoot } from '../vr/mode-factory.js';

const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

// --- Gameplay Config ---
export async function boot(cfg={}) {
  return baseBoot({
    ...cfg,
    name: 'goodjunk',
    pools: { good: GOOD, bad: JUNK },
    goldenRate: 0.07,     // 7% โอกาสได้ “Golden Item”
    goodRate:   0.70,     // 70% เป้าเป็นของดี
    minDist:    0.45,     // ป้องกันเป้าซ้อนกัน
    slotCooldownMs: 620,  // ระยะห่างเวลาสร้างเป้าใหม่
    judge: (ch, ctx) => {
      // กดพลาดหรือหมดเวลา → ลดคะแนน
      if (!ch) return { good:false, scoreDelta:-5 };
      const healthy = GOOD.includes(ch);
      if (healthy)
        return { good:true, scoreDelta:10, feverDelta:5 };
      else
        return { good:false, scoreDelta:-5, feverDelta:0 };
    }
  });
}
