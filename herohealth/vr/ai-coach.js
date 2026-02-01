// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (lightweight, explainable, rate-limited)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Emits: emit('hha:coach', {type:'tip', game, code, level, text, why})
//
// Design goals:
// - Helpful micro-tips, not spammy
// - Explainable (why)
// - Safe: never throws, no external deps

'use strict';

export function createAICoach(cfg = {}){
  const emit = typeof cfg.emit === 'function' ? cfg.emit : ()=>{};
  const game = String(cfg.game || 'generic');
  const cooldownMs = Math.max(800, Number(cfg.cooldownMs || 2800));

  const S = {
    started:false,
    lastTipAt:0,
    lastCode:'',
    seen: new Map(), // code -> count
    t0:0,
    // tiny memory for better tips
    emaSkill: 0.45,
    emaFrus: 0.25
  };

  function now(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

  function canSpeak(code){
    const t = now();
    if (t - S.lastTipAt < cooldownMs) return false;
    if (code && code === S.lastCode && (S.seen.get(code)||0) >= 2) return false;
    return true;
  }

  function say(code, level, text, why){
    if (!canSpeak(code)) return false;
    S.lastTipAt = now();
    S.lastCode = code || '';
    S.seen.set(code, (S.seen.get(code)||0) + 1);
    try{
      emit('hha:coach', { type:'tip', game, code, level, text, why });
    }catch(_){}
    return true;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function ruleEngine(st){
    // Normalize
    const skill = clamp(st.skill, 0, 1);
    const frustration = clamp(st.frustration, 0, 1);
    const fatigue = clamp(st.fatigue, 0, 1);
    const inStorm = !!st.inStorm;
    const inEndWindow = !!st.inEndWindow;
    const zone = String(st.waterZone || '');
    const shield = Number(st.shield||0);
    const misses = Number(st.misses||0);
    const combo = Number(st.combo||0);

    // smooth memory
    S.emaSkill = S.emaSkill*0.86 + skill*0.14;
    S.emaFrus  = S.emaFrus*0.86  + frustration*0.14;

    // ---- Priority tips (Hydration specific) ----
    if (inStorm && inEndWindow && shield <= 0){
      if (say('storm_need_shield','warn',
        'Storm ช่วงท้ายมาแล้ว — รีบเก็บ 🛡️ ก่อน แล้วค่อย BLOCK 🥤/🌩️',
        'Mini จะนับผ่านเมื่อ “BLOCK ใน End Window” และห้ามโดน BAD')) return;
    }

    if (inStorm && inEndWindow && shield > 0){
      if (say('storm_block_now','info',
        'ตอนนี้คือ End Window — ใช้ 🛡️ BLOCK ให้ติด!',
        'นี่คือเงื่อนไขสำคัญของ Storm Mini (ได้คะแนน/ผ่านด่าน)')) return;
    }

    if (inStorm && zone === 'GREEN'){
      if (say('storm_leave_green','info',
        'Storm Mini ต้อง LOW/HIGH — ลอง “ปล่อย GREEN” ก่อน แล้วค่อยทำ pressure',
        'เงื่อนไข Mini ต้อง zone ไม่ใช่ GREEN')) return;
    }

    if (!inStorm && zone !== 'GREEN'){
      if (say('back_to_green','info',
        'ตอนปกติพยายามกลับไป GREEN — ยิง 💧 ให้สมดุลน้ำ',
        'Stage1 ต้องสะสมเวลาใน GREEN')) return;
    }

    // ---- General performance coaching ----
    if (S.emaSkill < 0.38 && misses >= 10){
      if (say('slow_down','warn',
        'MISS เริ่มเยอะ — ชะลอการยิงนิดนึง เล็งให้ชัวร์ก่อนค่อยยิง',
        'ลดการรัวจะช่วย Accuracy และคอมโบ')) return;
    }

    if (S.emaSkill > 0.72 && combo >= 8){
      if (say('keep_combo','info',
        'คอมโบกำลังสวย! ลากคอมโบต่อ เกรดจะพุ่งเร็วมาก',
        'ระบบให้คะแนนบวกตามคอมโบ')) return;
    }

    if (fatigue > 0.72 && S.emaFrus > 0.55){
      if (say('reset_breath','info',
        'พักสายตา 1 วินาที แล้วค่อยกลับมายิงทีละเป้า',
        'ช่วยรีเซ็ตจังหวะ ลดความพลาดช่วงท้ายเกม')) return;
    }

    // fallback occasional
    if (say('generic_tip','info',
      'ทิป: ยิง 💧 เพื่อคุม GREEN / เก็บ 🛡️ ไว้กัน BAD ตอนพายุ',
      'นี่คือ core loop ของ Hydration Quest')) return;
  }

  return {
    onStart(){
      S.started = true;
      S.t0 = now();
      S.lastTipAt = 0;
      S.lastCode = '';
      S.seen.clear();
      S.emaSkill = 0.45;
      S.emaFrus  = 0.25;
      // opener tip (ไม่ spam)
      say('start','info',
        'เริ่มแล้ว! โฟกัสคุม “GREEN” ก่อน แล้วเตรียมทำ Storm Mini',
        'Stage1 ต้องสะสมเวลา GREEN และ Storm Mini ต้อง LOW/HIGH + BLOCK ช่วงท้าย');
    },

    onUpdate(state = {}){
      if (!S.started) return;
      try{ ruleEngine(state); }catch(_){}
    },

    onEnd(summary = {}){
      if (!S.started) return;
      S.started = false;

      // Small end reflection (best-effort)
      const acc = Number(summary.accuracyGoodPct||0);
      const miss = Number(summary.misses||0);
      const ok = Number(summary.stormSuccess||0);

      if (ok <= 0){
        say('end_focus_mini','info',
          'รอบหน้าโฟกัส Storm Mini: LOW/HIGH + BLOCK ใน End Window + ห้ามโดน BAD',
          'ถ้าผ่าน Mini อย่างน้อย 1 ครั้ง Stage2 จะจบไวมาก');
      } else if (acc < 65){
        say('end_accuracy','info',
          'รอบหน้าเน้น Accuracy: เล็งค้างนิดเดียวแล้วค่อยยิง',
          'Accuracy ดันเกรดได้แรงสุด');
      } else if (miss > 18){
        say('end_miss','info',
          'รอบหน้าเน้นลด MISS: เลือกยิงเป้าที่ชัวร์ ไม่ต้องรีบ',
          'MISS เยอะจะตัดคอมโบและกดเกรด');
      } else {
        say('end_good','info',
          'ฟอร์มดีมาก! ลองลากคอมโบยาว ๆ แล้วเคลียร์ BOSS ให้ได้',
          'คอมโบ + Boss Clear จะพาไป Tier สูง');
      }
    }
  };
}