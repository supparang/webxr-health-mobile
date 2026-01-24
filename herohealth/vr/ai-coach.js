// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable Micro-tips)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Emits: hha:coach { type, level, title, tip, why, next, ts, game }
// ✅ Rate-limit + dedupe + context-aware tips (storm/end-window/boss/accuracy/miss/combo)
// ✅ Deterministic-friendly (no randomness required)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function normGameName(g){
  const s = String(g||'').toLowerCase().trim();
  return s || 'hha';
}

function defaultEmit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function makeDedupeKey(msg){
  const t = (msg && msg.type) ? String(msg.type) : '';
  const title = (msg && msg.title) ? String(msg.title) : '';
  const tip = (msg && msg.tip) ? String(msg.tip) : '';
  return `${t}::${title}::${tip}`.slice(0, 220);
}

function chooseLevel(state){
  // soft urgency scale 0..1
  const fr = clamp(state.frustration, 0, 1);
  const inEnd = !!state.inEndWindow;
  const inStorm = !!state.inStorm;
  if (inEnd) return 'urgent';
  if (inStorm && fr > 0.55) return 'warn';
  if (fr > 0.70) return 'warn';
  return 'info';
}

function makeCoach(opts){
  const emit = (opts && typeof opts.emit === 'function') ? opts.emit : defaultEmit;
  const game = normGameName(opts && opts.game);
  const cooldownMs = clamp((opts && opts.cooldownMs) || 2800, 900, 120000);

  const S = {
    started:false,
    ended:false,
    lastAt: -1e9,
    lastKey: '',
    // rolling indicators
    emaSkill: 0.45,
    emaFr: 0.30,
    emaMissRate: 0.15,
    lastCombo: 0,
    lastMisses: 0,
    lastTipAt: -1e9,
    // milestones
    toldStorm: false,
    toldEndWindow: false,
    toldBoss: false,
    toldAccuracy: false,
    toldSpam: false,
    toldShield: false,
    toldGreen: false,
    toldCombo: false,
  };

  function canSpeak(key){
    const t = nowMs();
    if (t - S.lastAt < cooldownMs) return false;
    if (key && key === S.lastKey && t - S.lastAt < cooldownMs*2) return false;
    return true;
  }

  function speak(msg){
    const t = nowMs();
    const payload = Object.assign({
      ts: Date.now(),
      game
    }, msg || {});
    const key = makeDedupeKey(payload);

    if (!canSpeak(key)) return false;

    S.lastAt = t;
    S.lastKey = key;
    try{ emit('hha:coach', payload); }catch(_){}
    return true;
  }

  function updateEma(state){
    const skill = clamp(state.skill, 0, 1);
    const fr = clamp(state.frustration, 0, 1);

    S.emaSkill = S.emaSkill*0.88 + skill*0.12;
    S.emaFr    = S.emaFr*0.86    + fr*0.14;

    const misses = clamp(state.misses, 0, 999999);
    const played = clamp(state.fatigue, 0, 1); // 0..1 progress
    const missRate = clamp(misses / Math.max(1, 8 + played*40), 0, 1);
    S.emaMissRate = S.emaMissRate*0.90 + missRate*0.10;

    S.lastCombo = clamp(state.combo, 0, 999999);
    S.lastMisses = misses;
  }

  // ---- Tip generators (hydration-friendly, but usable globally) ----
  function tipStorm(state){
    const shield = clamp(state.shield, 0, 99);
    return {
      type:'tip',
      level: chooseLevel(state),
      title:'Storm มาแล้ว! 🌀',
      tip: shield>0
        ? 'ตอนพายุ: ทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) แล้วเก็บ 🛡️ ไว้ BLOCK ช่วงท้าย'
        : 'ตอนพายุ: หา 🛡️ ก่อน แล้วทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) เพื่อผ่าน Mini',
      why: 'Mini จะเช็ค “น้ำไม่ GREEN + มีแรงกดดัน + เข้าช่วง End Window + BLOCK สำเร็จ”',
      next: 'โฟกัสเก็บ 🛡️ 1–2 อัน แล้วรอช่วงท้ายพายุให้สั่น/กระพริบ'
    };
  }

  function tipEndWindow(state){
    return {
      type:'tip',
      level:'urgent',
      title:'End Window! ⏱️',
      tip:'ตอนหน้าจอกระพริบ/สั่น = ช่วง End Window → ต้อง BLOCK ให้ติดอย่างน้อย 1 ครั้ง',
      why:'นับผ่าน Mini เมื่อ block ใน End Window และห้ามโดน BAD แบบไม่กัน',
      next:'อย่ารัวยิงมั่ว ๆ — เก็บเป้า BAD/🌩️ ที่มาใกล้ ๆ กลางจอ'
    };
  }

  function tipBoss(state){
    const shield = clamp(state.shield, 0, 99);
    return {
      type:'tip',
      level:'warn',
      title:'Boss Window 🌩️',
      tip: shield>0
        ? 'ช่วงท้ายพายุจะมี 🌩️ ถี่ขึ้น → ใช้ 🛡️ BLOCK ให้ครบตามจำนวน'
        : 'Boss Window ต้องใช้ 🛡️ BLOCK — รีบหา 🛡️ ก่อนเข้าท้ายพายุ',
      why:'Boss Clear จะให้โบนัสใหญ่ และช่วยดัน Stage 3 ผ่าน',
      next:'เก็บ 🛡️ ล่วงหน้า แล้วค่อย “กัน” ตอนท้ายพายุ'
    };
  }

  function tipAccuracy(state){
    return {
      type:'tip',
      level:'info',
      title:'เล็งชัวร์ก่อนยิง 🎯',
      tip:'ถ้า Accuracy ตก: “ค้างเล็ง 0.2 วิ” แล้วค่อยยิง จะชัวร์ขึ้นมาก',
      why:'คะแนน+เกรดพุ่งจากความแม่น และคอมโบจะไม่ขาด',
      next:'โฟกัสยิง GOOD เป็นหลัก แล้วค่อยกัน BAD ตอนจำเป็น'
    };
  }

  function tipSpam(state){
    return {
      type:'tip',
      level:'warn',
      title:'อย่ารัวมั่ว 💥',
      tip:'Miss เริ่มไหล: ลดการรัว → เลือกยิงเป้าที่ “ชัวร์” ก่อน',
      why:'การรัวทำให้พลาดและคอมโบขาดง่าย โดยเฉพาะตอนพายุ',
      next:'ตั้งจังหวะ 1–2 คลิก/วินาที แล้วไล่คอมโบ'
    };
  }

  function tipShield(state){
    return {
      type:'tip',
      level:'info',
      title:'🛡️ คือของสำคัญ',
      tip:'เห็น 🛡️ ให้เก็บก่อน 1–2 อัน โดยเฉพาะก่อนพายุ',
      why:'Storm/Boss ต้องใช้ BLOCK เพื่อผ่าน Mini/Stage 3',
      next:'เก็บ 🛡️ แล้วคุมโซนน้ำให้พร้อมเข้า Mini'
    };
  }

  function tipGreenHold(state){
    return {
      type:'tip',
      level:'info',
      title:'Stage 1: คุม GREEN 💧',
      tip:'ยิง 💧 เพื่อดันน้ำกลับเข้า GREEN แล้วพยายามรักษาให้นาน ๆ (สะสมเวลา)',
      why:'Stage 1 ต้องสะสมเวลา GREEN ถึงเป้า ก่อนจะไป Stage 2/3',
      next:'ถ้าหลุด GREEN ให้ยิง 💧 1–2 ครั้งติด ๆ เพื่อดึงกลับ'
    };
  }

  function tipCombo(state){
    return {
      type:'tip',
      level:'info',
      title:'ลากคอมโบให้ยาว ⚡',
      tip:'คอมโบยาว = คะแนนโตไวมาก → เลือกยิงเป้า GOOD ที่อยู่ใกล้ ๆ ก่อน',
      why:'ระบบให้แต้มเพิ่มตามคอมโบ และช่วยดันเกรด',
      next:'ถ้ามี BAD เยอะ ให้กันด้วย 🛡️ แทนการเสียคอมโบ'
    };
  }

  function tipEncourage(state){
    return {
      type:'coach',
      level:'info',
      title:'ไปต่อได้! 🚀',
      tip:'จังหวะเริ่มดีขึ้นแล้ว ลองโฟกัส “ชัวร์ก่อนเร็ว”',
      why:'เมื่อความแม่นนิ่ง คอมโบและเกรดจะพุ่งเอง',
      next:'ตั้งเป้า: Accuracy > 70% และ Miss ลดลง'
    };
  }

  function decide(state){
    // inputs expected:
    // skill, fatigue(0..1), frustration(0..1), inStorm, inEndWindow, waterZone, shield, misses, combo
    const skill = clamp(state.skill, 0, 1);
    const fr    = clamp(state.frustration, 0, 1);
    const fat   = clamp(state.fatigue, 0, 1);
    const shield= clamp(state.shield, 0, 99);
    const misses= clamp(state.misses, 0, 999999);
    const combo = clamp(state.combo, 0, 999999);
    const inStorm = !!state.inStorm;
    const inEnd = !!state.inEndWindow;
    const zone = String(state.waterZone||'').toUpperCase();

    // Always prioritize end window tip once
    if (inEnd && !S.toldEndWindow){
      S.toldEndWindow = true;
      return tipEndWindow(state);
    }

    // Storm intro
    if (inStorm && !S.toldStorm){
      S.toldStorm = true;
      return tipStorm(state);
    }

    // Boss tip when storm and late + shield low
    if (inStorm && !inEnd && fr > 0.25 && shield <= 0 && !S.toldBoss){
      // still can mention boss preparation
      S.toldBoss = true;
      return tipBoss(state);
    }

    // Shield economy reminder (early game)
    if (!inStorm && shield <= 0 && fat > 0.12 && fat < 0.55 && !S.toldShield){
      S.toldShield = true;
      return tipShield(state);
    }

    // Stage1 green hold helper (if zone not green often)
    if (!inStorm && fat < 0.45 && zone !== 'GREEN' && !S.toldGreen){
      S.toldGreen = true;
      return tipGreenHold(state);
    }

    // Accuracy low
    if (skill < 0.42 && fat > 0.10 && !S.toldAccuracy){
      S.toldAccuracy = true;
      return tipAccuracy(state);
    }

    // Too many misses / spam warning
    if (misses >= 10 && (S.emaMissRate > 0.28 || fr > 0.65) && !S.toldSpam){
      S.toldSpam = true;
      return tipSpam(state);
    }

    // Combo coaching
    if (combo >= 8 && skill >= 0.55 && !S.toldCombo){
      S.toldCombo = true;
      return tipCombo(state);
    }

    // Occasional encouragement when stabilized
    if (fat > 0.40 && fr < 0.40 && skill >= 0.50){
      return tipEncourage(state);
    }

    return null;
  }

  return {
    onStart(){
      if (S.started) return;
      S.started = true;
      S.ended = false;
      S.lastAt = -1e9;
      S.lastKey = '';
      // soft hello (optional, low priority)
      speak({
        type:'coach',
        level:'info',
        title:'โค้ชพร้อมแล้ว 🤖',
        tip:'เริ่มจาก “ชัวร์ก่อนเร็ว” แล้วค่อยลากคอมโบ',
        why:'เกมจะให้แต้มจากความแม่น + คอมโบ',
        next:'ยิง GOOD ให้มาก แล้วเก็บ 🛡️ ไว้กันตอนพายุ'
      });
    },

    onUpdate(state){
      if (!S.started || S.ended) return;
      updateEma(state);

      const msg = decide(state);
      if (!msg) return;

      // extra rate-limit tightening during heavy action
      const t = nowMs();
      const inEnd = !!state.inEndWindow;
      if (!inEnd && t - S.lastTipAt < cooldownMs) return;

      if (speak(msg)){
        S.lastTipAt = t;
      }
    },

    onEnd(summary){
      if (S.ended) return;
      S.ended = true;

      const grade = String((summary && summary.grade) || '').toUpperCase();
      const acc = clamp((summary && summary.accuracyGoodPct) || 0, 0, 100);
      const miss = clamp((summary && summary.misses) || 0, 0, 999999);
      const stage = clamp((summary && summary.stageCleared) || 0, 0, 3);

      let title = 'จบเกมแล้ว! ✅';
      let tip = 'รอบหน้าลองเพิ่มความแม่น + ลด MISS นิดเดียว เกรดจะพุ่ง';
      let why = 'เกรดผูกกับ Accuracy และความสม่ำเสมอของคอมโบ/การกันช่วงสำคัญ';
      let next = 'Retry แล้วตั้งเป้า Accuracy > 70%';

      if (stage < 1){
        title = 'เกือบแล้ว! 🎯';
        tip = 'โฟกัส Stage 1 ก่อน: คุม GREEN ให้ครบเวลา (สะสม)';
        why = 'Stage 1 คือประตูไป Stage 2/3';
        next = 'คุม GREEN ให้ผ่านก่อน แล้วค่อยทำ Storm Mini';
      } else if (stage < 2){
        title = 'Stage 1 ผ่านแล้ว! 🔥';
        tip = 'ต่อไปคือ Storm Mini: ทำให้น้ำ LOW/HIGH + BLOCK ช่วง End Window';
        why = 'Mini ต้องครบเงื่อนไข และห้ามโดน BAD แบบไม่กัน';
        next = 'เก็บ 🛡️ ไว้ก่อนพายุ 1–2 อัน';
      } else if (stage < 3){
        title = 'เหลือบอสแล้ว! 🌩️';
        tip = 'รอ Boss Window ตอนท้ายพายุ แล้ว BLOCK 🌩️ ให้ครบ';
        why = 'Boss Clear ดัน Stage 3 ผ่าน';
        next = 'เก็บ 🛡️ ล่วงหน้า แล้วค่อยกันช่วงท้าย';
      } else if (grade === 'SSS' || grade === 'SS'){
        title = 'โหดจัด! 🏆';
        tip = 'เล่นนิ่งมากแล้ว ลองเพิ่มความยาก/เวลาเพื่อท้าทายตัวเอง';
        why = `Accuracy ${acc.toFixed(1)}% และ MISS ${miss} ถือว่าสุด`;
        next = 'ลอง diff=hard หรือ time เพิ่ม';
      } else if (acc < 60){
        title = 'คุมจังหวะอีกนิด 🎯';
        tip = 'รอบหน้า “ค้างเล็ง 0.2 วิ” แล้วค่อยยิง Accuracy จะขึ้นชัด';
        why = `Accuracy ตอนนี้ ${acc.toFixed(1)}%`;
        next = 'ตั้งเป้า Accuracy > 70%';
      } else if (miss > 20){
        title = 'ลด MISS แล้วจะพุ่ง 💥';
        tip = 'ลดการรัว + เลือกยิงเป้าที่ชัวร์ โดยเฉพาะตอนพายุ';
        why = `MISS ตอนนี้ ${miss}`;
        next = 'ตั้งเป้า MISS < 10';
      }

      speak({ type:'coach', level:'info', title, tip, why, next });
    }
  };
}

export function createAICoach(opts){
  return makeCoach(opts || {});
}