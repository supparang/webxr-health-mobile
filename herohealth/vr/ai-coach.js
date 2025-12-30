// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (template-based, safe, no spam)
// Emits: hha:coach { text, sub, mood, icon? }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (opts.emit || function(){});
  const game = String(opts.game || 'hydration');
  const enabled = (opts.enabled !== false);
  const cooldownMs = clamp(opts.cooldownMs ?? 3500, 1200, 12000);

  let lastSayAt = 0;
  let lastKey = '';
  let lastKeyAt = 0;

  function canSpeak(key, force=false){
    if (!enabled) return false;
    const t = performance.now();
    if (!force && (t - lastSayAt < cooldownMs)) return false;

    // prevent immediate repeats of same key, but allow again after longer window
    if (!force && key && key === lastKey && (t - lastKeyAt < Math.max(6000, cooldownMs*1.6))) return false;
    return true;
  }

  function say(key, text, sub='', mood='neutral', force=false){
    if (!canSpeak(key, force)) return;
    const t = performance.now();
    lastSayAt = t;
    lastKey = key || '';
    lastKeyAt = t;
    emit('hha:coach', { game, text, sub, mood });
  }

  function force(key, text, sub='', mood='neutral'){
    say(key, text, sub, mood, true);
  }

  function onStart(){
    say('start', 'โฟกัส “น้ำให้คุมเข้า GREEN” ก่อนนะ 💧', 'Tip: ยิงแบบไม่รัว จะคุมโซนง่ายขึ้น', 'happy');
  }

  function onUpdate(ctx){
    // ctx: { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
    const f  = clamp(ctx.fatigue,0,1);
    const fr = clamp(ctx.frustration,0,1);
    const wz = String(ctx.waterZone||'').toUpperCase();

    if (ctx.inStorm && ctx.inEndWindow){
      if ((ctx.shield|0) <= 0) say('end_no_shield', 'ท้ายพายุแล้ว! ไม่มีโล่ ระวัง BAD 🔥', 'เก็บ 🛡️ ก่อนเข้าพายุรอบหน้า', 'sad');
      else say('end_block', 'ท้ายพายุแล้ว! “เล็งแล้วค่อย BLOCK” 🛡️', 'ถ้าทำ LOW/HIGH ด้วยจะได้ PERFECT', 'happy');
      return;
    }

    if (ctx.inStorm && (ctx.shield|0) > 0 && wz === 'GREEN'){
      say('storm_zone', 'Storm มาแล้ว! ทำให้น้ำเป็น LOW/HIGH ก่อน ✅', 'ออกจาก GREEN แล้วค่อย BLOCK ช่วงท้าย', 'neutral');
      return;
    }

    if (!ctx.inStorm && fr > 0.62){
      say('frustrated', 'ช้า ๆ แต่ชัวร์นะ 🎯', 'หยุดรัว 1 วิ แล้วคุมจังหวะยิง', 'neutral');
      return;
    }

    if (f > 0.68){
      say('fatigue', 'พักสายตาแป๊บ แล้วเล่นต่อได้ 👀', 'โหมดนี้จะผ่อนให้หน่อย', 'neutral');
      return;
    }

    if ((ctx.combo|0) >= 6){
      say('combo', 'คอมโบสวยมาก! ต่ออีกนิด ⚡', 'ถ้าถึง STREAK จะได้โบนัส', 'happy');
      return;
    }
  }

  function onEnd(sum){
    const g = String(sum.grade||'C');
    const acc = Number(sum.accuracyGoodPct||0);
    if (g === 'SSS' || g === 'SS'){
      say('end_top', `สุดยอด! เกรด ${g} 🏆`, `Accuracy ${acc.toFixed(1)}% • รอบหน้าลอง diff harder ได้`, 'happy', true);
    } else if (g === 'S' || g === 'A'){
      say('end_good', `ดีมาก! เกรด ${g} ✅`, `จุดโฟกัส: เก็บ 🛡️ ก่อนเข้าพายุ`, 'happy', true);
    } else {
      say('end_train', `รอบนี้เกรด ${g} ยังไหว! ซ้อมอีกนิด 💪`, `โฟกัส: อย่ารัว • ยิงให้แม่นก่อน`, 'neutral', true);
    }
  }

  return { onStart, onUpdate, onEnd, say, force };
}