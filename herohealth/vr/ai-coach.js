// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — template-based, safe, no spam (PRODUCTION)
// Emits: hha:coach { game, text, sub, mood, icon?, key? }
//
// ✅ Works with coach-manager.js (auto image per game)
// ✅ Rate-limited + avoid repeating same tip key
// ✅ Cross-game ready (hydration/plate/groups/goodjunk)
// ✅ Includes hooks scaffolding for the "3 AI" pack:
//    (1) AI Difficulty Director (optional, disabled in research by default)
//    (2) AI Coach (this module)
//    (3) AI Pattern Generator (optional hook placeholder)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

export function createAICoach(opts={}){
  const emit = (opts.emit || function(){});
  const game = String(opts.game || 'herohealth').toLowerCase();

  // cooldown: how often coach can speak
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 1200, 15000);

  // optional: a "mode" hint from game: play/research
  const runMode = String(opts.runMode || '').toLowerCase();
  const researchSafe = (runMode === 'research') || (String(opts.researchSafe||'') === 'true');

  // --- 3 AI hooks (placeholders) ---
  // Difficulty Director: can be injected later (disabled in research by default)
  const difficultyDirector = opts.difficultyDirector || null; // { onUpdate(ctx) -> {diffK?, spawnMul?, sizeMul?} }
  const patternGenerator   = opts.patternGenerator || null;   // { onUpdate(ctx) -> {patternHint?} }

  // --- internal state ---
  let lastSayAt = 0;
  let lastKey = '';
  let lastCtxSig = '';

  // helper emit
  function say(key, text, sub='', mood='neutral', extra={}){
    const t = now();
    if (t - lastSayAt < cooldownMs) return false;
    if (key && key === lastKey) return false;

    lastSayAt = t;
    lastKey = key || '';
    emit('hha:coach', {
      game,
      key: key || '',
      text: String(text||''),
      sub: String(sub||''),
      mood: String(mood||'neutral'),
      ...extra
    });
    return true;
  }

  // make a small signature to avoid spamming similar advice when ctx barely changes
  function sigFrom(ctx){
    if(!ctx) return '';
    const a = clamp(ctx.skill,0,1);
    const f = clamp(ctx.fatigue,0,1);
    const fr = clamp(ctx.frustration,0,1);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const wz = String(ctx.waterZone||'');
    const sh = (ctx.shield|0);
    const miss = (ctx.misses|0);
    const combo = (ctx.combo|0);
    return [
      a.toFixed(2), f.toFixed(2), fr.toFixed(2),
      inStorm?1:0, inEnd?1:0, wz, sh,
      Math.min(99,miss), Math.min(99,combo)
    ].join('|');
  }

  // --- public API ---
  function onStart(){
    // greet per game
    if (game === 'hydration'){
      say('start_hydration', 'โฟกัส “คุมน้ำเข้า GREEN” ก่อนนะ 💧', 'Tip: อย่ารัวยิง จะคุมโซนง่ายขึ้น', 'happy');
    } else if (game === 'plate'){
      say('start_plate', 'จัดจานให้บาลานซ์! 🍽️', 'Tip: เล็งเป้าที่ถูกกลุ่มก่อน แล้วค่อยสปีด', 'happy');
    } else if (game === 'goodjunk'){
      say('start_goodjunk', 'เก็บของดี หลบของเสีย! 🥦🥤', 'Tip: อย่ายิงมั่ว—เลือกเป้าที่ชัวร์', 'happy');
    } else if (game === 'groups'){
      say('start_groups', 'แยกหมวดอาหารให้แม่น! 🧠', 'Tip: ดูไอคอนก่อนยิง 0.3 วิ', 'happy');
    } else {
      say('start_generic', 'เล็งกลางจอ แล้วค่อยยิง 🎯', 'Tip: ช้าแต่ชัวร์ = คะแนนพุ่ง', 'happy');
    }
  }

  function onUpdate(ctx){
    // ctx: { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo, ... }
    ctx = ctx || {};
    const f  = clamp(ctx.fatigue,0,1);
    const fr = clamp(ctx.frustration,0,1);
    const sk = clamp(ctx.skill,0,1);
    const inStorm = !!ctx.inStorm;
    const inEnd   = !!ctx.inEndWindow;

    const sig = sigFrom(ctx);
    // if context barely changes a lot, we still allow speaking due to cooldown,
    // but we can slightly suppress repeated similar advice.
    const sameSig = (sig && sig === lastCtxSig);
    lastCtxSig = sig || lastCtxSig;

    // --- optional Difficulty Director hook (disabled in research) ---
    if (!researchSafe && difficultyDirector && typeof difficultyDirector.onUpdate === 'function'){
      try{
        const dd = difficultyDirector.onUpdate(ctx);
        // dd is returned for the game to apply; we don’t apply it here.
        // But we can optionally whisper a coach tip when difficulty changes a lot.
        if (dd && typeof dd.diffK === 'number' && !sameSig){
          const k = clamp(dd.diffK,0,1);
          if (k > 0.78) say('dd_harder', 'กำลังปรับให้ท้าทายขึ้นนิด 🔥', 'โฟกัสความแม่นก่อนสปีด', 'neutral');
          else if (k < 0.28) say('dd_easier', 'ปรับให้เล่นลื่นขึ้นนิด ✅', 'ค่อย ๆ เก็บคอมโบยาว ๆ', 'neutral');
        }
      }catch(_){}
    }

    // --- optional Pattern Generator hook (placeholder) ---
    if (!researchSafe && patternGenerator && typeof patternGenerator.onUpdate === 'function'){
      try{
        const pg = patternGenerator.onUpdate(ctx);
        if (pg && pg.patternHint && !sameSig){
          // only occasionally
          say('pg_hint', 'รูปแบบเป้ากำลังเปลี่ยน! 👀', String(pg.patternHint), 'neutral');
        }
      }catch(_){}
    }

    // ===== GAME-SPECIFIC COACHING =====
    if (game === 'hydration'){
      const wz = String(ctx.waterZone||'').toUpperCase();
      const sh = (ctx.shield|0);

      if (inStorm && inEnd){
        if (sh <= 0) say('hy_end_no_shield', 'ท้ายพายุแล้ว! ไม่มีโล่ ระวัง BAD 🔥', 'รอบหน้าเก็บ 🛡️ ก่อนเข้าพายุ', 'sad');
        else say('hy_end_block', 'ท้ายพายุแล้ว! “เล็งแล้วค่อย BLOCK” 🛡️', 'ถ้าทำ LOW/HIGH ด้วยจะได้ PERFECT', 'happy');
        return;
      }
      if (inStorm && sh > 0 && wz === 'GREEN'){
        say('hy_storm_zone', 'Storm มาแล้ว! ทำให้น้ำเป็น LOW/HIGH ก่อน ✅', 'ออกจาก GREEN แล้วค่อย BLOCK ช่วงท้าย', 'neutral');
        return;
      }
      if (!inStorm && fr > 0.62){
        say('hy_frustrated', 'ช้า ๆ แต่ชัวร์นะ 🎯', 'หยุดรัว 1 วิ แล้วคุมจังหวะยิง', 'neutral');
        return;
      }
      if (f > 0.70){
        say('hy_fatigue', 'พักสายตาแป๊บ แล้วเล่นต่อได้ 👀', 'เดี๋ยวระบบจะผ่อนให้หน่อย', 'neutral');
        return;
      }
      if ((ctx.combo|0) >= 6){
        say('hy_combo', 'คอมโบสวยมาก! ต่ออีกนิด ⚡', 'ถ้าถึง STREAK จะได้โบนัส', 'happy');
        return;
      }
      // gentle nudges
      if (!inStorm && wz !== 'GREEN' && (ctx.misses|0) < 10){
        say('hy_nudge_green', 'ลองคุมให้อยู่ GREEN ให้นานขึ้น 💧', 'ยิง GOOD สม่ำเสมอ จะนิ่งขึ้น', 'neutral');
      }
      return;
    }

    // ===== GENERIC / OTHER GAMES =====
    if (inStorm && inEnd){
      say('end_window', 'ใกล้หมดเวลาแล้ว! เก็บแต้มให้ชัวร์ ⚡', 'เล็ง 0.2–0.4 วิ แล้วค่อยยิง', 'neutral');
      return;
    }

    if (fr > 0.65){
      say('frustrated', 'รีเซ็ตจังหวะนิดนึง 🎯', 'หยุดรัว 1 วิ แล้วเลือกยิงเป้าที่ชัวร์', 'neutral');
      return;
    }

    if (f > 0.72){
      say('fatigue', 'พักสายตาแป๊บ แล้วค่อยกลับมา 👀', 'โฟกัสความแม่น > ความเร็ว', 'neutral');
      return;
    }

    if (sk > 0.78 && (ctx.combo|0) >= 5){
      say('hot', 'ฟอร์มมา! ลากคอมโบยาว ๆ 🔥', 'ถ้าพลาดให้รีเซ็ตใจ แล้วเริ่มใหม่', 'happy');
      return;
    }
  }

  function onEnd(sum){
    // sum has grade, accuracyGoodPct, misses
    sum = sum || {};
    const g = String(sum.grade||'C');
    const acc = Number(sum.accuracyGoodPct||0);
    const miss = Number(sum.misses||0);

    if (g === 'SSS' || g === 'SS'){
      say('end_top', `สุดยอด! เกรด ${g} 🏆`, `Accuracy ${acc.toFixed(1)}% • ลองโหมดโหดขึ้นได้`, 'happy');
    } else if (g === 'S' || g === 'A'){
      const tip = (miss > 12) ? 'ลด MISS ลงอีกนิด จะขึ้น SS ได้เลย' : 'คงความแม่น แล้วลากคอมโบยาว ๆ';
      say('end_good', `ดีมาก! เกรด ${g} ✅`, `${tip}`, 'happy');
    } else {
      const tip = (acc < 60) ? 'เล็งค้างสั้น ๆ ก่อนยิง จะดีขึ้นเร็วมาก' : 'ลดการรัวยิง แล้วเลือกเป้าที่ชัวร์';
      say('end_train', `รอบนี้เกรด ${g} ยังไหว! ซ้อมอีกนิด 💪`, tip, 'neutral');
    }
  }

  return { onStart, onUpdate, onEnd };
}