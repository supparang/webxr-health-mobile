// === /herohealth/vr/ai-coach.js ===
// AI Coach (HHA) — PRODUCTION
// ✅ Emits coach messages via emit('hha:coach', {...})
// ✅ Rate-limit + avoids spam + context-aware (Storm/EndWindow/Boss)
// ✅ Auto-disable in research mode (run=research or runMode=research)
// ✅ Works with hydration.safe.js calls: createAICoach({ emit, game, cooldownMs })

'use strict';

export function createAICoach(config={}){
  const emit = (typeof config.emit === 'function') ? config.emit : (()=>{});
  const game = String(config.game || 'hha');
  const cooldownMs = Number(config.cooldownMs || 3000);
  const forceEnable = (config.forceEnable === true);

  // Detect research -> disable by default (still deterministic + no noise)
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const enabled = forceEnable ? true : (run !== 'research');

  const S = {
    enabled,
    lastAt: 0,
    lastKey: '',
    startAt: 0,
    phase: 'idle',
    // smoothing + anti-flip
    emaSkill: 0.45,
    emaFrust: 0.25,
    emaFat: 0.10,
    lastStorm: false,
    lastEndWindow: false,
    lastBoss: false,
    // “nudge” counters
    missStreak: 0,
    goodStreak: 0,
    lastCombo: 0,
    lastShield: 0
  };

  function nowMs(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  function say(key, text, extra={}){
    if (!S.enabled) return false;

    const t = nowMs();
    if (t - S.lastAt < cooldownMs) return false;
    if (key && key === S.lastKey && (t - S.lastAt < cooldownMs*1.6)) return false;

    S.lastAt = t;
    S.lastKey = key || '';

    emit('hha:coach', Object.assign({
      game,
      type: 'tip',
      key: key || '',
      text: String(text || ''),
      t: Date.now()
    }, extra));

    return true;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function smoothEMA(oldV, newV, alpha){
    return oldV*(1-alpha) + newV*alpha;
  }

  function onStart(){
    S.startAt = nowMs();
    S.phase = 'play';
    S.lastAt = 0;
    S.lastKey = '';
    S.emaSkill = 0.45;
    S.emaFrust = 0.25;
    S.emaFat = 0.10;
    S.missStreak = 0;
    S.goodStreak = 0;
    S.lastCombo = 0;
    S.lastShield = 0;

    // เปิดเกมพูด 1 ครั้ง (แต่ไม่รบกวน research)
    say('start', 'เริ่มเลย! 🎯 โฟกัส “คอมโบ” แล้วคุม Water ให้เข้าโซนที่ต้องการนะ', { level:'info' });
  }

  function onUpdate(ctx={}){
    if (!S.enabled) return;

    // ctx from hydration.safe.js:
    // skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo
    const skill = clamp(ctx.skill, 0, 1);
    const fat   = clamp(ctx.fatigue, 0, 1);
    const frust = clamp(ctx.frustration, 0, 1);

    S.emaSkill = smoothEMA(S.emaSkill, skill, 0.12);
    S.emaFat   = smoothEMA(S.emaFat, fat, 0.08);
    S.emaFrust = smoothEMA(S.emaFrust, frust, 0.10);

    const inStorm = !!ctx.inStorm;
    const inEnd   = !!ctx.inEndWindow;
    const shield  = Number(ctx.shield||0)|0;
    const misses  = Number(ctx.misses||0)|0;
    const combo   = Number(ctx.combo||0)|0;
    const zone    = String(ctx.waterZone||'').toUpperCase();

    // streak tracking
    if (misses > 0 && (combo === 0) && (S.lastCombo > 0)) S.missStreak++;
    if (combo > S.lastCombo) S.goodStreak++;
    if (combo === 0 && S.lastCombo === 0) S.goodStreak = Math.max(0, S.goodStreak-1);

    // shield change
    const gotShield = (shield > S.lastShield);

    // --- event-like transitions (พูดตอนเปลี่ยนสถานะ) ---
    if (inStorm && !S.lastStorm){
      say('storm_in', '🌀 STORM มาแล้ว! ตอนพายุให้ “เตรียม BLOCK ช่วงท้าย” (End Window) นะ', { level:'warn' });
    }
    if (!inStorm && S.lastStorm){
      // หลังพายุจบ ให้สรุปสั้นๆ
      if (S.emaSkill >= 0.65) say('storm_out_good', 'ดีมาก! พายุจบแล้ว 🔥 รักษาคอมโบต่อ เดี๋ยวเกรดพุ่ง', { level:'good' });
      else say('storm_out', 'พายุจบแล้ว ✨ รอบหน้า “เก็บโล่ก่อน” แล้วค่อยบล็อกช่วงท้าย', { level:'info' });
    }

    if (inEnd && !S.lastEndWindow){
      say('endwindow_in', '⏱️ END WINDOW! ตอนนี้แหละ “บล็อกให้ได้” ถ้ามี 🛡️', { level:'warn' });
    }

    // Boss hint: ให้พูดเมื่อ “อยู่ boss window” (hydration.safe sets inBoss -> bossActive)
    // เราไม่มี ctx.bossActive แต่พอ inStorm + inEndWindow ใกล้จบมากๆ มักเป็นบอส
    // ถ้าอยากชัวร์: ส่ง ctx.bossActive ใน hydration.safe.js แล้วโค้ชจะคมขึ้น
    if (inStorm && inEnd && !S.lastBoss && S.emaFat > 0.25){
      // คำพูดแบบระวัง ไม่บอกมั่ว
      say('boss_hint', '🌩️ ช่วงท้ายพายุเป้าจะถี่ขึ้น! ถ้ามีโล่ให้ “กันไว้บล็อก” จะผ่านไว', { level:'warn' });
      S.lastBoss = true;
    }
    if (!inEnd) S.lastBoss = false;

    // --- continuous coaching (ไม่ถี่เกิน) ---
    // 1) ถ้า water ยัง GREEN ตอนพายุ -> ชี้ให้หลุดโซน
    if (inStorm && zone === 'GREEN'){
      say('storm_need_non_green', '🎯 ตอน STORM ต้องทำให้น้ำ “ไม่ใช่ GREEN” (LOW/HIGH) ก่อนนะ แล้วค่อย BLOCK ช่วงท้าย', { level:'warn' });
    }

    // 2) ถ้า shield เพิ่งได้
    if (gotShield){
      say('got_shield', '🛡️ ได้โล่แล้ว! เก็บไว้ใช้ตอน END WINDOW จะผ่านมินิง่ายมาก', { level:'good' });
    }

    // 3) ถ้า miss เยอะ/หัวร้อน
    if (S.emaFrust > 0.70 || S.missStreak >= 2){
      say('calm_down', 'ช้าๆก็ได้ ✋ เล็งให้ชัวร์ก่อนยิง ลดการรัว แล้วคอมโบจะกลับมาเอง', { level:'info' });
      S.missStreak = 0;
    }

    // 4) ถ้าเล่นดี -> ชมแบบกระชับ (ไม่ชมบ่อย)
    if (S.emaSkill > 0.78 && combo >= 8){
      say('skill_high', '⚡ โคตรคม! รักษาคอมโบยาวๆ แล้วไปลุยพายุแบบโหดได้เลย', { level:'good' });
    }

    // 5) ถ้า fatigue สูง -> บอก “ย่อมือ”
    if (S.emaFat > 0.80 && S.emaSkill < 0.55){
      say('fatigue', 'ใกล้จบแล้ว! โฟกัสเป้าที่ชัวร์พอ ไม่ต้องยิงทุกอัน 👍', { level:'info' });
    }

    S.lastStorm = inStorm;
    S.lastEndWindow = inEnd;
    S.lastCombo = combo;
    S.lastShield = shield;
  }

  function onEnd(summary={}){
    if (!S.enabled) return;

    const grade = String(summary.grade||'').toUpperCase() || 'C';
    const acc = Number(summary.accuracyGoodPct||0);
    const miss = Number(summary.misses||0);
    const stage = Number(summary.stageCleared||0);

    if (grade === 'SSS' || grade === 'SS'){
      say('end_top', `🏆 สุดจัด! เกรด ${grade} — โหมดโหดขึ้นอีกก็ยังไหว`, { level:'good', kind:'end' });
      return;
    }

    if (stage < 1){
      say('end_s1', 'Stage1 ยังไม่ผ่าน: คุม GREEN ให้ได้ก่อน แล้วเกมจะ “เปิดทาง” ให้พายุ', { level:'info', kind:'end' });
      return;
    }
    if (stage < 2){
      say('end_s2', 'Stage2 ยังไม่ผ่าน: พายุต้องทำ LOW/HIGH + BLOCK ตอน END WINDOW (ห้ามโดน BAD)', { level:'warn', kind:'end' });
      return;
    }
    if (stage < 3){
      say('end_s3', 'Stage3 ยังไม่ผ่าน: เก็บโล่ไว้ช่วงท้ายพายุ แล้วบล็อก 🌩️ ให้ครบ', { level:'warn', kind:'end' });
      return;
    }

    // ผ่านแล้วแต่ยังไม่เทพ
    if (acc < 70) say('end_acc', 'Accuracy ยังดันได้อีก: ชะลอจังหวะเล็กน้อยแล้วค่อยยิง', { level:'info', kind:'end' });
    if (miss > 15) say('end_miss', 'MISS เยอะไปนิด: เลือกยิงเฉพาะเป้าที่กลางๆชัวร์ๆ', { level:'info', kind:'end' });

    say('end_ok', `จบแล้ว! เกรด ${grade} — รอบหน้า “คอมโบ + โล่” จะทำให้ผ่านไวขึ้น`, { level:'good', kind:'end' });
  }

  return { onStart, onUpdate, onEnd };
}