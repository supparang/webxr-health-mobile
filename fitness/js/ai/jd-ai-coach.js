// === js/ai/jd-ai-coach.js ===
// Micro-tips Coach (PACK 2)
// Rate-limit to avoid annoyance; explainable tips only when needed
'use strict';

(function(){
  const WIN = window;
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function createCoach(){
    let lastTipAt = 0;

    const COOLDOWN_MS = 3200;

    function pickTip(ctx){
      // ctx: {predictor, stats, boss, diffKey}
      const pred = ctx.predictor || {};
      const stats = ctx.stats || {};
      const risk = clamp(pred.risk_miss_next ?? 0.4, 0, 1);
      const rt   = Number(stats.rtRecent||0);
      const missStreak = Number(stats.missStreak||0);

      if(ctx.boss && risk > 0.62){
        return { msg:'⚡ Storm มาแล้ว! ใจเย็น มองเส้นชน แล้วกดให้พอดี', kind:'ok' };
      }
      if(missStreak >= 2){
        return { msg:'ลองกด “ตอนเข้าเส้นชน” พอดี ๆ นะ (พลาดติดกันแล้ว)', kind:'miss' };
      }
      if(rt > 310){
        return { msg:'ช้ากว่าเดิมนิดนึง—เตรียมมือไว้ก่อนเข้าเส้นชน', kind:'ok' };
      }
      if(risk > 0.70){
        return { msg:'จังหวะเริ่มหลุด—พักหายใจ แล้วกลับมาเก็บคอมโบใหม่', kind:'miss' };
      }
      if(stats.hitStreak >= 6 && (stats.accRecent||0) > 0.85){
        return { msg:'ฟอร์มดีมาก! ถ้ารักษา Perfect ได้ จะเข้าโหมดคูณคะแนนเร็วขึ้น 🔥', kind:'combo' };
      }
      return null;
    }

    function maybeTip(nowMs, ctx){
      if(nowMs - lastTipAt < COOLDOWN_MS) return null;
      const tip = pickTip(ctx);
      if(!tip) return null;
      lastTipAt = nowMs;
      return tip;
    }

    return { maybeTip };
  }

  WIN.JD_AI_COACH_FACTORY = { createCoach };
})();