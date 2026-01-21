// === /herohealth/hydration-vr/ai-hooks.hydration.js ===
// Hydration AI Hooks — PRODUCTION (A+B+C)
// ✅ Director (difficulty), Predictor (risk), Coach triggers
// ✅ Safe defaults; Research mode -> neutral director
// ✅ Export single function: makeHydrationAI({emit, runMode, kids})

import { createAIDirector } from '../vr/ai-director.js';
import { createAIPredictor } from '../vr/ai-predict.js';

export function makeHydrationAI({ emit, runMode='play', kids=false } = {}){
  const director = createAIDirector({});
  const predictor = createAIPredictor({});

  // rate-limit coach nudges (avoid spam)
  const COACH = { lastAt: 0, cooldownMs: 3200 };

  function coach(type, text){
    const now = performance.now();
    if (now - COACH.lastAt < COACH.cooldownMs) return;
    COACH.lastAt = now;
    try{ emit('hha:coach', { type, text }); }catch(_){}
  }

  function update(ctx){
    // ctx from game loop
    const {
      acc, comboK, missRate, frustration, fatigue,
      inStorm, inEndWindow, zone, shield, timeK, combo
    } = ctx;

    const pred = predictor.update({
      acc, missRate, frustration, fatigue,
      inStorm, inEndWindow, zone, shield, timeK, combo, kids
    });

    const dir = director.update({
      runMode, kids,
      acc, comboK, missRate, frustration, fatigue,
      inStorm, zone, timeK
    });

    // coach triggers (Explainable micro tips)
    if (pred.signals.missSurge){
      coach('tip', 'ลอง “เล็งค้างนิดเดียว” แล้วค่อยยิงนะ');
    }
    if (pred.signals.fatigueHigh){
      coach('tip', 'พักสายตา 1 วิ แล้วกลับมายิงช้า ๆ จะนิ่งขึ้น');
    }
    if (pred.signals.stuckGreenInStorm){
      coach('tip', 'ตอนพายุให้ทำ “LOW หรือ HIGH” ก่อนนะ (ออก GREEN)');
    }
    if (pred.signals.needShield){
      coach('tip', 'ช่วงท้ายพายุ! หา 🛡️ แล้ว BLOCK ให้ทัน');
    }
    if (pred.signals.stormFailRisk && inEndWindow){
      coach('tip', 'ท้ายพายุมาแล้ว! โฟกัส BLOCK อย่างเดียว!');
    }

    return { pred, dir };
  }

  return { update };
}