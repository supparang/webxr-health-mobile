// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach (micro-tips) — PRODUCTION (lightweight)
// - Explainable tips
// - Rate-limited
// - Deterministic-friendly (no random needed)

'use strict';

export function createAICoach(opts = {}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = Math.max(800, Number(opts.cooldownMs || 3000));
  const verbose = !!opts.verbose;

  const S = {
    started:false,
    ended:false,
    lastAt:0,
    lastKey:'',
    nTips:0,
    stageHinted: new Set(),
  };

  function now(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function canSpeak(key){
    const t = now();
    if (S.ended) return false;
    if (S.lastKey === key && (t - S.lastAt) < cooldownMs*1.15) return false;
    if ((t - S.lastAt) < cooldownMs) return false;
    S.lastAt = t;
    S.lastKey = key;
    S.nTips++;
    return true;
  }

  function speak(key, text, meta={}){
    if (!canSpeak(key)) return;
    emit('hha:coach', {
      game,
      type:'tip',
      key,
      text,
      ...meta
    });
    if (verbose) console.log('[AI Coach]', key, text, meta);
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    speak('start', 'เริ่มเลย! โฟกัสยิง 💧 เพื่อคุมน้ำให้อยู่ GREEN ให้นานที่สุด', { level:'info' });
  }

  function onUpdate(ctx = {}){
    // ctx from hydration.safe.js:
    // { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = Number(ctx.shield || 0);
    const misses = Number(ctx.misses || 0);
    const combo = Number(ctx.combo || 0);
    const skill = Number(ctx.skill || 0);
    const fr = Number(ctx.frustration || 0);

    // Base reminders
    if (!inStorm && zone !== 'GREEN' && canSpeak('zone_back_green')){
      speak('zone_back_green', 'ตอนนี้น้ำไม่ GREEN แล้วนะ — ยิง 💧 ถี่ขึ้นนิดเพื่อดันกลับเข้า GREEN', { level:'warn' });
      return;
    }

    // Shield management
    if (inStorm && shield <= 0){
      speak('need_shield', 'พายุมาแล้วแต่ 🛡️ หมด! รอบหน้าเก็บ 🛡️ ไว้ก่อนพายุ 1–2 อัน', { level:'warn' });
      return;
    }

    // End window timing
    if (inStorm && inEnd && shield > 0){
      speak('end_window_block', 'นี่คือ End Window! ใช้ 🛡️ BLOCK เป้าสี BAD/🌩️ ตอนนี้เลย', { level:'urgent' });
      return;
    }

    // Boss coaching (heuristic)
    if (inStorm && inEnd && shield > 0 && combo >= 6 && skill >= 0.55){
      speak('boss_push', 'โอกาสเคลียร์ BOSS มาแล้ว — เก็บคอมโบไว้ แล้ว BLOCK ให้ครบ!', { level:'hype' });
      return;
    }

    // Miss control
    if (misses >= 10 && fr >= 0.55){
      speak('calm_down', 'MISS เริ่มสูง — ลดการรัว เล็งค้างนิดนึงแล้วค่อยยิง จะนิ่งขึ้นมาก', { level:'calm' });
      return;
    }

    // Positive reinforcement
    if (combo >= 10 && skill >= 0.6){
      speak('nice_combo', 'คอมโบดีมาก! ถ้ารักษา GREEN ไปเรื่อย ๆ เกรดจะพุ่งแรง', { level:'good' });
      return;
    }
  }

  function onEnd(summary = {}){
    S.ended = true;
    // one last message (optional)
    emit('hha:coach', {
      game,
      type:'end',
      text: 'จบเกมแล้ว! ดู Tips ในสรุปผล แล้วลอง Retry เพื่อดัน Tier ให้สูงขึ้น 🔥',
      summary
    });
  }

  return { onStart, onUpdate, onEnd };
}