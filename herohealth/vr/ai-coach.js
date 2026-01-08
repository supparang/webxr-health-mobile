// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (micro-tips, explainable, rate-limited)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(ctx), onEnd(summary)
// ✅ emits: hha:coach { game, type, level, msg, why[], ctxMini }
//
// Design:
// - lightweight heuristics (no external model call)
// - deterministic-enough; uses only observed state (good for research)
// - focuses on actionable tips: aim, shield usage, storm end-window, water zone, miss control
//
'use strict';

export function createAICoach(opts = {}){
  const emit = (typeof opts.emit === 'function')
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} };

  const game = String(opts.game || 'game');
  const cooldownMs = Math.max(800, Number(opts.cooldownMs || 3200));

  const S = {
    started:false,
    lastAt:0,
    lastKey:'',
    // simple memory to avoid repeating same message
    seen: new Map(),
    // hysteresis helpers
    lastZone:'',
    lastStorm:false,
    lastEndWindow:false,
    lastShield:0
  };

  function nowMs(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  function canSpeak(key){
    const t = nowMs();
    if (!S.started) return false;
    if (t - S.lastAt < cooldownMs) return false;

    const last = S.seen.get(key) || 0;
    // allow repeating same tip but not too often
    if (t - last < cooldownMs * 2.2) return false;

    return true;
  }

  function speak(payload){
    const key = String(payload.key || payload.type || payload.msg || '');
    if (!key) return false;

    if (!canSpeak(key)) return false;

    S.lastAt = nowMs();
    S.lastKey = key;
    S.seen.set(key, S.lastAt);

    // strip key from outgoing to keep payload clean
    const out = Object.assign({ game }, payload);
    delete out.key;

    emit('hha:coach', out);
    return true;
  }

  // helper levels
  const LV = {
    info:'info',
    warn:'warn',
    hype:'hype'
  };

  function pct(n){ return Math.round(Number(n||0)*100); }

  // ----------- Tip generators (Hydration-focused) -----------
  function tipStormEndWindow(ctx){
    // End Window: must BLOCK using shield, avoid bad
    const why = [];
    if (ctx.inStorm) why.push('กำลังอยู่ใน STORM');
    if (ctx.inEndWindow) why.push('เข้าสู่ End Window แล้ว');
    if ((ctx.shield|0) <= 0) why.push('ไม่มี 🛡️ ในมือ');

    const msg = (ctx.shield|0) > 0
      ? 'End Window! ตอนนี้ “ต้อง BLOCK” — เล็ง 🥤/🌩️ แล้วใช้ 🛡️ กันให้ผ่าน'
      : 'End Window! รีบเก็บ 🛡️ ก่อน แล้วค่อย BLOCK ตอนท้ายพายุ';

    return { type:'tip', level: LV.warn, msg, why, ctxMini:{ inStorm:!!ctx.inStorm, inEndWindow:!!ctx.inEndWindow, shield:ctx.shield|0 } };
  }

  function tipWaterZone(ctx){
    // Keep GREEN as stage1; if off-green during storm it's good for mini
    const z = String(ctx.waterZone||'');
    const why = ['โซนน้ำเปลี่ยนเป็น ' + z];

    if (ctx.inStorm){
      if (z === 'GREEN'){
        return { type:'tip', level: LV.info, msg:'STORM: อย่าให้น้ำอยู่ GREEN — ดันไป LOW/HIGH เพื่อผ่าน Mini ก่อน', why, ctxMini:{ waterZone:z, inStorm:true } };
      }
      return { type:'tip', level: LV.hype, msg:'ดี! STORM นี้น้ำเป็น LOW/HIGH แล้ว — ต่อไปโฟกัส “BLOCK ตอนท้ายพายุ”', why, ctxMini:{ waterZone:z, inStorm:true } };
    }

    if (z !== 'GREEN'){
      return { type:'tip', level: LV.info, msg:'กลับเข้า GREEN อีกนิดนะ — โฟกัสยิง 💧 ให้สมดุล (เก็บคอมโบด้วย)', why, ctxMini:{ waterZone:z } };
    }

    return { type:'tip', level: LV.hype, msg:'GREEN ดีมาก! รักษาโซนนี้ไว้ให้ครบเวลา แล้วเก็บ 🛡️ เตรียม STORM', why, ctxMini:{ waterZone:z } };
  }

  function tipAim(ctx){
    // aim advice when skill low / accuracy low / frustration high
    const why=[];
    if ((ctx.skill||0) < 0.45) why.push('ความแม่นยังต่ำ');
    if ((ctx.frustration||0) > 0.65) why.push('เริ่มพลาดถี่');
    if ((ctx.combo|0) <= 2) why.push('คอมโบยังไม่ขึ้น');

    const msg = ctx.inStorm
      ? 'STORM: อย่ารัว! เล็งชัวร์ก่อนยิง ลด MISS แล้วค่อยลากคอมโบ'
      : 'เล็งค้างนิดนึงแล้วค่อยยิง 💧 — “ชัวร์ก่อนเร็ว” แล้วคอมโบจะมาเอง';

    return { type:'tip', level: LV.info, msg, why, ctxMini:{ skill: Number(ctx.skill||0), frustration:Number(ctx.frustration||0), combo:ctx.combo|0 } };
  }

  function tipShield(ctx){
    // remind to pick shields before storm / keep at least 1
    const sh = ctx.shield|0;
    const why = [];
    if (sh <= 0) why.push('ไม่มี 🛡️');
    if (!ctx.inStorm) why.push('ยังไม่เข้า STORM');
    const msg = 'เก็บ 🛡️ ไว้ก่อนนะ — STORM ตอนท้ายต้องใช้ BLOCK เพื่อผ่าน Mini/Boss';
    return { type:'tip', level: LV.info, msg, why, ctxMini:{ shield:sh, inStorm:!!ctx.inStorm } };
  }

  function tipMissControl(ctx){
    const why=[];
    why.push('MISS สะสมค่อนข้างเยอะ');
    const msg = ctx.inStorm
      ? 'MISS เยอะ: STORM นี้โฟกัส “หลบ BAD” + BLOCK เฉพาะจังหวะท้ายพายุ'
      : 'MISS เยอะ: ลดการยิงพร่ำเพรื่อ เลือกเป้าที่ชัวร์ แล้วค่อยเพิ่มสปีด';
    return { type:'tip', level: LV.warn, msg, why, ctxMini:{ misses:ctx.misses|0 } };
  }

  function tipComboHype(ctx){
    const why=['คอมโบกำลังดี'];
    const msg = ctx.inStorm
      ? 'คอมโบดี! ระวัง BAD ตอนพายุ แล้วปิดจบด้วย BLOCK ท้ายพายุ'
      : 'คอมโบสวยมาก! รักษาจังหวะนี้ไว้ คะแนน+เกรดจะพุ่ง';
    return { type:'tip', level: LV.hype, msg, why, ctxMini:{ combo:ctx.combo|0 } };
  }

  // ----------- Decision policy -----------
  function decide(ctx){
    // priority:
    // 1) end-window storm guidance
    // 2) zone change guidance
    // 3) miss control
    // 4) aim help
    // 5) shield reminder
    // 6) combo hype

    // 1) End window
    if (ctx.inStorm && ctx.inEndWindow) {
      return Object.assign({ key:'storm_endwindow' }, tipStormEndWindow(ctx));
    }

    // 2) water zone changed (hysteresis)
    const z = String(ctx.waterZone||'');
    if (z && z !== S.lastZone) {
      S.lastZone = z;
      return Object.assign({ key:'zone_'+z+(ctx.inStorm?'_storm':'') }, tipWaterZone(ctx));
    }

    // 3) misses high
    if ((ctx.misses|0) >= 12 && (ctx.frustration||0) > 0.55) {
      return Object.assign({ key:'miss_control' }, tipMissControl(ctx));
    }

    // 4) aim help (low skill or high frustration)
    if ((ctx.skill||0) < 0.42 || (ctx.frustration||0) > 0.70) {
      return Object.assign({ key:'aim_help' }, tipAim(ctx));
    }

    // 5) shield reminder when low and not in end window
    if (!ctx.inStorm && (ctx.shield|0) <= 0) {
      return Object.assign({ key:'need_shield' }, tipShield(ctx));
    }

    // 6) combo hype occasionally
    if ((ctx.combo|0) >= 10 && (ctx.skill||0) >= 0.55) {
      return Object.assign({ key:'combo_hype' }, tipComboHype(ctx));
    }

    return null;
  }

  // ----------- Public API -----------
  return {
    onStart(){
      S.started = true;
      S.lastAt = nowMs();
      S.seen.clear();
      S.lastKey = '';
      S.lastZone = '';
      S.lastStorm = false;
      S.lastEndWindow = false;
      S.lastShield = 0;

      // small hello
      speak({
        key:'hello',
        type:'hello',
        level: LV.info,
        msg: 'เริ่มเลย! เป้าหมาย: คุม GREEN ให้นาน แล้วเตรียม 🛡️ ไว้ทำ STORM',
        why: ['เริ่มเกมแล้ว'],
        ctxMini:{}
      });
    },

    onUpdate(ctx = {}){
      if (!S.started) return;

      // Track storm transitions for extra context (optional)
      const inStorm = !!ctx.inStorm;
      const inEnd = !!ctx.inEndWindow;

      // if storm just started, nudge once (but rate-limited)
      if (inStorm && !S.lastStorm){
        S.lastStorm = true;
        speak({
          key:'storm_start',
          type:'tip',
          level: LV.warn,
          msg:'เข้า STORM แล้ว! ทำให้น้ำเป็น LOW/HIGH แล้วเก็บ 🛡️ ไว้ BLOCK ตอนท้ายพายุ',
          why:['STORM เริ่ม'],
          ctxMini:{ inStorm:true }
        });
      }
      if (!inStorm && S.lastStorm){
        S.lastStorm = false;
        // allow next guidance
      }

      if (inEnd && !S.lastEndWindow){
        S.lastEndWindow = true;
        // immediate end-window tip (high priority)
        const p = Object.assign({ key:'storm_endwindow' }, tipStormEndWindow(ctx));
        speak(p);
      }
      if (!inEnd && S.lastEndWindow){
        S.lastEndWindow = false;
      }

      // general decision
      const payload = decide(ctx);
      if (payload) speak(payload);
    },

    onEnd(summary = {}){
      if (!S.started) return;
      // end wrap-up (short)
      const grade = String(summary.grade || '');
      const acc = Number(summary.accuracyGoodPct || 0);
      const miss = Number(summary.misses || 0);
      const boss = Number(summary.bossClearCount || 0);
      const why = [];
      why.push(`Grade=${grade||'-'}`);
      why.push(`Acc=${acc.toFixed(1)}%`);
      why.push(`Miss=${miss|0}`);
      if (boss > 0) why.push('Boss cleared');

      let msg = 'จบเกมแล้ว! ลอง Retry อีกรอบเพื่อดันเกรดขึ้น 🚀';
      if (grade === 'SSS') msg = 'โหดมาก! ได้ SSS แล้ว 🔥 ลองลด MISS ลงอีกนิดจะ “นิ่ง” กว่านี้';
      else if (grade === 'SS') msg = 'SS สวยมาก! ดัน Accuracy อีกนิด แล้วเก็บคอมโบยาว ๆ ไป SSS';
      else if (grade === 'S') msg = 'S ดีมาก! โฟกัส STORM: LOW/HIGH + BLOCK ท้ายพายุ';
      else if (grade === 'A') msg = 'A ผ่านสบาย! ถ้าอยากขึ้น S: ลด MISS + คุม GREEN ให้แน่น';
      else if (grade === 'B') msg = 'B โอเค! เล็งชัวร์ก่อนยิง แล้วคอมโบจะช่วยลากคะแนน';
      else msg = 'ยังไหว! โฟกัสเป้าชัวร์ ๆ ก่อน แล้วค่อยเพิ่มสปีด';

      speak({
        key:'end_wrap',
        type:'end',
        level: LV.info,
        msg,
        why,
        ctxMini:{ grade, acc, miss, boss }
      });

      S.started = false;
    }
  };
}