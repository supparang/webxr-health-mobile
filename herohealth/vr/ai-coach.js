// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach (template-based, safe, no spam)
// Emits: hha:coach { text, sub, mood, icon? }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (opts.emit || function(){});
  const game = String(opts.game || 'hydration');
  const cooldownMs = clamp(opts.cooldownMs ?? 3500, 1200, 12000);

  let lastSayAt = 0;
  let lastKey = '';

  function say(key, text, sub='', mood='neutral'){
    const t = performance.now();
    if (t - lastSayAt < cooldownMs) return;
    if (key && key === lastKey) return;
    lastSayAt = t; lastKey = key;
    emit('hha:coach', { game, text, sub, mood });
  }

  function onStart(){
    say('start', 'โฟกัส “คุมน้ำเข้า GREEN” ก่อนนะ 💧', 'Tip: ยิงไม่รัว จะคุมโซนง่ายขึ้น', 'happy');
  }

  function onUpdate(ctx){
    // ctx: { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo,
    //        directorTag, stormPattern }
    const f = clamp(ctx.fatigue,0,1);
    const fr = clamp(ctx.frustration,0,1);

    // --- Director synergy (PLAY only) ---
    // directorTag: 'relax' | 'tighten' | 'neutral'
    if (ctx.directorTag === 'relax'){
      say('dir_relax', 'โอเค! ผ่อนให้แล้วนะ 🙂', 'เล็งช้า ๆ ให้แม่น แล้วค่อยเร่ง', 'neutral');
    } else if (ctx.directorTag === 'tighten'){
      say('dir_tighten', 'เริ่มเข้ามือแล้ว! เร่งความมันส์ขึ้น 🔥', 'เป้าเล็กลงนิด + เกิดถี่ขึ้น', 'happy');
    }

    // --- Storm pattern tip ---
    if (ctx.inStorm && !ctx.inEndWindow){
      const p = String(ctx.stormPattern||'');
      if (p === 'fakeout'){
        say('pat_fakeout', 'STORM หลอก! อย่ารีบยิงมั่ว 😈', 'ตั้งสติเร็ว • เตรียม BLOCK ให้ไว', 'neutral');
      } else if (p === 'short'){
        say('pat_short', 'STORM สั้น! ต้องตัดสินใจไว ⚡', 'รีบทำ LOW/HIGH แล้วคุมจังหวะ', 'neutral');
      } else if (p === 'long'){
        say('pat_long', 'STORM ยาว! รักษาสติให้ได้ 🌀', 'เก็บ 🛡️ แล้วรอท้ายพายุค่อย BLOCK', 'neutral');
      }
    }

    // --- End window coaching ---
    if (ctx.inStorm && ctx.inEndWindow){
      if ((ctx.shield|0) <= 0) say('end_no_shield', 'ท้ายพายุแล้ว! ไม่มีโล่ ระวัง BAD 🔥', 'รอบหน้าเก็บ 🛡️ ไว้ก่อนเข้าพายุ', 'sad');
      else say('end_block', 'ท้ายพายุแล้ว! “เล็งแล้วค่อย BLOCK” 🛡️', 'ถ้าทำ LOW/HIGH ด้วยจะได้ PERFECT', 'happy');
      return;
    }

    // frustration / fatigue / combo
    if (!ctx.inStorm && fr > 0.62){
      say('frustrated', 'ช้า ๆ แต่ชัวร์นะ 🎯', 'หยุดรัว 1 วิ แล้วคุมจังหวะยิง', 'neutral');
      return;
    }

    if (f > 0.68){
      say('fatigue', 'พักสายตาแป๊บ แล้วเล่นต่อได้ 👀', 'ถ้ารู้สึกมึน ให้พัก 10 วิ', 'neutral');
      return;
    }

    if ((ctx.combo|0) >= 6){
      say('combo', 'คอมโบสวยมาก! ต่ออีกนิด ⚡', 'พยายามอย่า MISS จะได้ STREAK', 'happy');
      return;
    }
  }

  function onEnd(sum){
    // sum has grade, accuracyGoodPct, misses, stormStreakMax?, badges?
    const g = String(sum.grade||'C');
    const acc = Number(sum.accuracyGoodPct||0);
    const st = Number(sum.stormStreakMax||0);
    const badges = Array.isArray(sum.badges) ? sum.badges : [];
    const btxt = badges.length ? ` • Badge: ${badges.join(', ')}` : '';

    if (g === 'SSS' || g === 'SS'){
      say('end_top', `สุดยอด! เกรด ${g} 🏆`, `Accuracy ${acc.toFixed(1)}% • StormStreak ${st}${btxt}`, 'happy');
    } else if (g === 'S' || g === 'A'){
      say('end_good', `ดีมาก! เกรด ${g} ✅`, `StormStreak ${st} • โฟกัสเก็บ 🛡️ ก่อนพายุ${btxt}`, 'happy');
    } else {
      say('end_train', `รอบนี้เกรด ${g} ยังไหว! ซ้อมอีกนิด 💪`, `คุมโซน + อย่ารัว • StormStreak ${st}${btxt}`, 'neutral');
    }
  }

  return { onStart, onUpdate, onEnd };
}