// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (SAFE)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Emits: hha:coach { level, msg, tag, game }
// ✅ Rate-limited, explainable micro-tips
// ✅ No DOM side effects (won't break layers)

'use strict';

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : (()=>{});
  const game = String(opts.game || 'game');
  const cooldownMs = Math.max(900, Number(opts.cooldownMs)||2800);

  const S = {
    lastAt: 0,
    lastTag: '',
    started: false,
    lastCtx: null,
  };

  function now(){ return performance.now(); }

  function canSpeak(tag){
    const t = now();
    if (t - S.lastAt < cooldownMs) return false;
    if (tag && tag === S.lastTag) return false;
    S.lastAt = t;
    S.lastTag = tag || '';
    return true;
  }

  function say(level, msg, tag){
    if (!canSpeak(tag)) return;
    emit('hha:coach', { game, level, msg, tag });
  }

  function onStart(){
    S.started = true;
    S.lastAt = 0;
    S.lastTag = '';
    say('info', 'เริ่มเลย! เล็งให้ชัวร์ แล้วลากคอมโบยาว ๆ 🔥', 'start');
  }

  function onEnd(summary){
    try{
      const g = String(summary?.grade||'');
      if (g==='C') say('tip','อย่ารัว! คุมจังหวะแล้วค่อยยิง จะช่วย Accuracy พุ่ง','end_c');
      else if (g==='A') say('tip','ดีมาก! ถ้าลด MISS อีกนิด มีลุ้น S/SS','end_a');
      else if (g==='S' || g==='SS' || g==='SSS') say('praise','โหดมาก! รักษาความนิ่ง + คุมพายุได้แล้ว 🛡️⚡','end_s');
    }catch(_){}
  }

  // ctx fields (hydration):
  // { skill,fatigue,frustration,inStorm,inEndWindow,waterZone,shield,misses,combo,stage }
  function onUpdate(ctx={}){
    if (!S.started) return;
    S.lastCtx = ctx;

    const skill = Number(ctx.skill||0);
    const fat = Number(ctx.fatigue||0);
    const fr = Number(ctx.frustration||0);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone||'');
    const sh = Number(ctx.shield||0);
    const miss = Number(ctx.misses||0);
    const combo = Number(ctx.combo||0);
    const stage = Number(ctx.stage||0);

    // --- High value tips ---
    if (stage===1 && zone!=='GREEN'){
      say('tip', 'Stage1 ต้องคุมให้อยู่ GREEN นาน ๆ — ยิง 💧 เพื่อดึงกลับเข้าโซน', 's1_green');
      return;
    }

    if (stage>=2 && !inStorm){
      if (sh<=0) say('tip','Stage2/3: เก็บ 🛡️ ไว้ก่อนพายุ จะช่วย BLOCK ตอนท้าย','need_shield');
      else if (sh>=2) say('tip','พร้อมพายุแล้ว! มี 🛡️ แล้ว รอ STORM แล้ว BLOCK ช่วงท้าย (End Window)','ready_storm');
      return;
    }

    if (inStorm && stage===2){
      if (zone==='GREEN') say('tip','STORM Mini: ทำให้น้ำเป็น LOW/HIGH ก่อน แล้วค่อย BLOCK ตอนท้าย','storm_need_lowhigh');
      else if (!inEnd) say('tip','ดี! ตอนนี้ LOW/HIGH แล้ว เก็บจังหวะไว้—เดี๋ยวท้ายพายุต้อง BLOCK','storm_hold');
      else {
        if (sh<=0) say('warn','End Window มาแล้วแต่ไม่มี 🛡️! เลือกยิงเป้าชัวร์ ๆ ลดโดน BAD','end_no_shield');
        else say('warn','End Window! ใช้ 🛡️ BLOCK ให้ติด แล้วห้ามโดน BAD','end_block');
      }
      return;
    }

    if (inStorm && stage===3){
      if (inEnd && sh>0) say('warn','Boss Window! 🌩️ โผล่ถี่—โฟกัส BLOCK ให้ครบตามจำนวน','boss_window');
      else if (sh<=0) say('tip','Stage3: ก่อนเข้าช่วง Boss Window ควรมี 🛡️ อย่างน้อย 1–2','boss_need_shield');
      return;
    }

    // --- performance coaching ---
    if (miss>=18 && fr>0.55){
      say('tip','MISS เริ่มเยอะ: ชะลอการยิง + เล็งค้างนิดนึงก่อนค่อยกด','too_many_miss');
      return;
    }
    if (combo>=10 && skill>0.65){
      say('praise','คอมโบโหด! รักษาจังหวะนี้ไว้ เกรดจะพุ่ง 🚀','combo_hot');
      return;
    }
    if (fat>0.75 && fr>0.55){
      say('tip','ใกล้หมดเวลาแล้ว—เลือกยิงเฉพาะเป้าที่ชัวร์ จะคุมคะแนนได้ดีกว่า','late_focus');
      return;
    }
  }

  return { onStart, onUpdate, onEnd };
}