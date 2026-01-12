// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Methods: onStart(), onUpdate(ctx), onEnd(summary), say(type,msg,meta)
// ✅ Emits: hha:coach { game, type, msg, level, why[], suggest[], ts, ctx? }
// ✅ Rate-limit + anti-spam + dedupe per "type"
// ✅ Designed for: fair + explainable (no "black box") micro nudges
//
// Notes:
// - This module is intentionally lightweight and deterministic given same ctx stream
// - It does not "auto-control difficulty" (that's AI Director hook later)
// - Your HUD can listen to hha:coach and display bubbles/toasts
//
// Example usage (already in hydration.safe.js):
//   import { createAICoach } from '../vr/ai-coach.js';
//   const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs: 3000 });
//   AICOACH.onUpdate({ skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo });

export function createAICoach(opts = {}) {
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const GAME = String(opts.game || 'game').toLowerCase();
  const COOL = clamp(opts.cooldownMs ?? 3200, 1200, 12000);

  // -------- internal state --------
  const S = {
    started: false,
    t0: 0,
    lastSayAt: 0,
    lastTypeAt: Object.create(null), // type -> ts
    lastMsgHash: '',
    emaSkill: 0.45,
    emaFrust: 0.25,
    emaFatigue: 0.10,
    streakBad: 0,      // consecutive "bad signals"
    streakGood: 0,     // consecutive "good signals"
    lastCtx: null
  };

  // -------- helpers --------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }
  function hashMsg(s){
    s = String(s||'');
    let h = 2166136261;
    for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h>>>0).toString(16);
  }

  function canSay(type){
    const t = now();
    if (t - S.lastSayAt < COOL) return false;
    const last = S.lastTypeAt[type] || 0;
    // per-type throttle slightly longer to avoid repeating same nudge
    if (t - last < Math.max(COOL*1.35, 2600)) return false;
    return true;
  }

  function pack(type, msg, meta = {}) {
    const payload = Object.assign({
      game: GAME,
      type: String(type||'tip'),
      msg: String(msg||''),
      level: meta.level || 'info', // info|warn|success|urgent
      why: Array.isArray(meta.why) ? meta.why.slice(0,4) : [],
      suggest: Array.isArray(meta.suggest) ? meta.suggest.slice(0,4) : [],
      ts: new Date().toISOString()
    }, meta.ctx ? { ctx: meta.ctx } : null);
    return payload;
  }

  function say(type, msg, meta = {}) {
    const t = now();
    const p = pack(type, msg, meta);
    const h = hashMsg(p.type + '|' + p.msg + '|' + (p.level||''));
    // dedupe identical message bursts
    if (h === S.lastMsgHash && (t - S.lastSayAt) < COOL*1.8) return false;
    if (!canSay(p.type)) return false;

    S.lastMsgHash = h;
    S.lastSayAt = t;
    S.lastTypeAt[p.type] = t;

    emit('hha:coach', p);
    return true;
  }

  // -------- rule engine (simple + explainable) --------
  // ctx fields expected:
  //  skill: 0..1
  //  fatigue: 0..1
  //  frustration: 0..1
  //  inStorm: bool
  //  inEndWindow: bool
  //  waterZone: 'GREEN' | 'LOW' | 'HIGH' | ...
  //  shield: number
  //  misses: number
  //  combo: number
  function decide(ctx = {}) {
    const c = Object.assign({
      skill: 0.5,
      fatigue: 0.0,
      frustration: 0.0,
      inStorm: false,
      inEndWindow: false,
      waterZone: '',
      shield: 0,
      misses: 0,
      combo: 0
    }, ctx);

    // smooth signals (stable coach)
    S.emaSkill = S.emaSkill*0.88 + clamp(c.skill,0,1)*0.12;
    S.emaFrust = S.emaFrust*0.85 + clamp(c.frustration,0,1)*0.15;
    S.emaFatigue = S.emaFatigue*0.90 + clamp(c.fatigue,0,1)*0.10;

    const z = String(c.waterZone || '').toUpperCase();
    const shield = clamp(c.shield, 0, 99);
    const misses = clamp(c.misses, 0, 9999);
    const combo = clamp(c.combo, 0, 9999);

    // infer "pressure"
    const danger = clamp(S.emaFrust*0.65 + S.emaFatigue*0.35, 0, 1);

    // update streaks
    const badSignal = (danger >= 0.62) || (misses >= 12 && combo <= 2);
    const goodSignal = (S.emaSkill >= 0.70 && danger <= 0.45 && combo >= 6);

    if (badSignal){ S.streakBad++; S.streakGood = 0; }
    else if (goodSignal){ S.streakGood++; S.streakBad = 0; }
    else { S.streakBad = Math.max(0, S.streakBad-1); S.streakGood = Math.max(0, S.streakGood-1); }

    // ---- game-specific hints (hydration-like) ----
    // End window coaching: urgent + actionable
    if (c.inStorm && c.inEndWindow) {
      if (shield <= 0) {
        return {
          type: 'endwindow',
          msg: '⏱️ ช่วงท้ายพายุ! ตอนนี้ยังไม่มี 🛡️ — เล็งยิงเก็บ 🛡️ ก่อน แล้วค่อย BLOCK 🌩️',
          level: 'urgent',
          why: ['อยู่ใน End Window', 'Shield = 0 → BLOCK ไม่ได้'],
          suggest: ['โฟกัสหา 🛡️ ก่อน', 'อย่ารัวถ้า MISS เยอะ']
        };
      }
      // Need zone not GREEN for mini pass in your rules
      if (z === 'GREEN') {
        return {
          type: 'endwindow',
          msg: '⏱️ End Window! ทำให้ “ไม่ GREEN” (LOW/HIGH) ก่อน แล้วค่อยใช้ 🛡️ BLOCK ช่วงท้าย',
          level: 'urgent',
          why: ['End Window ต้อง “ไม่ GREEN” + BLOCK'],
          suggest: ['ถ้า GREEN อยู่ ยิง 💧 ช้า ๆ เพื่อคุมสมดุล', 'กันโดน 🥤 ระหว่างพายุ']
        };
      }
      return {
        type: 'endwindow',
        msg: '🔥 End Window! ตอนนี้โซน OK แล้ว — ใช้ 🛡️ BLOCK ให้ครบ (อย่าโดน BAD)',
        level: 'urgent',
        why: ['โซนไม่ GREEN แล้ว', 'เหลือทำ BLOCK ช่วงท้าย'],
        suggest: ['เล็งนิ่ง ๆ ก่อนยิง', 'เก็บคอมโบด้วยการเลือกเป้าชัวร์']
      };
    }

    // During storm (not end window)
    if (c.inStorm && !c.inEndWindow) {
      if (shield <= 0) {
        return {
          type: 'storm',
          msg: '🌀 พายุมาแล้ว! เก็บ 🛡️ ไว้ก่อนนะ — ช่วงท้ายต้องใช้ BLOCK',
          level: 'warn',
          why: ['Storm ต้องมี BLOCK ช่วงท้าย'],
          suggest: ['เลือกยิง 🛡️ ก่อน', 'เลี่ยง 🥤 ถ้าไม่มั่นใจ']
        };
      }
      if (z === 'GREEN') {
        return {
          type: 'storm',
          msg: '🌀 ตอนพายุ ควรทำให้ “ไม่ GREEN” (LOW/HIGH) สักพัก เพื่อผ่าน Mini',
          level: 'info',
          why: ['Mini ต้องไม่ GREEN + pressure'],
          suggest: ['ถ้า GREEN อยู่ ให้ระวังการยิง 💧', 'อย่าพลาดโดน 🥤']
        };
      }
      return {
        type: 'storm',
        msg: '🌀 โซนไม่ GREEN แล้ว ดีมาก! รักษาไว้จนถึงท้ายพายุ แล้วค่อย BLOCK ช่วง End Window',
        level: 'success',
        why: ['เข้าเงื่อนไขโซนแล้ว'],
        suggest: ['คุมจังหวะยิง', 'เตรียม BLOCK ตอนท้าย']
      };
    }

    // Not storm: stage-1 style hints (GREEN hold / accuracy)
    if (!c.inStorm) {
      if (z !== 'GREEN') {
        return {
          type: 'balance',
          msg: '💧 ตอนนี้โซนไม่ GREEN — ลองยิง 💧 แบบ “ช้าแต่ชัวร์” เพื่อกลับเข้า GREEN แล้วสะสมเวลา',
          level: 'info',
          why: ['Stage 1 ต้องสะสมเวลาใน GREEN'],
          suggest: ['เลิกยิงรัว', 'เน้นความแม่นก่อนคอมโบ']
        };
      }

      // accuracy / miss coaching
      if (S.streakBad >= 3) {
        return {
          type: 'aim',
          msg: '🎯 ถ้าเริ่มพลาดถี่: “หยุด 1 วิ → เล็งนิ่ง → ค่อยยิง” จะทำให้ MISS ลดลงทันที',
          level: 'warn',
          why: ['ความกดดันสูง', 'พลาดสะสมทำให้คอมโบหลุด'],
          suggest: ['เลือกเป้าใหญ่/ใกล้กลางจอ', 'ยิงเป็นจังหวะ 1-2-3']
        };
      }

      if (S.streakGood >= 3) {
        return {
          type: 'praise',
          msg: '⚡ เล่นดีมาก! คอมโบเริ่มนิ่งแล้ว — ลากคอมโบต่ออีกหน่อย เกรดจะพุ่ง',
          level: 'success',
          why: ['skill สูงขึ้น', 'ความกดดันต่ำ', 'คอมโบต่อเนื่อง'],
          suggest: ['เน้นความแม่นต่อ', 'เตรียมเก็บ 🛡️ ก่อนพายุ']
        };
      }

      // gentle reminder about shields (future storm)
      if (shield <= 0 && (S.emaSkill >= 0.45)) {
        return {
          type: 'prep',
          msg: '🛡️ เตรียมไว้หน่อยนะ: เก็บ Shield 1–2 อันไว้ก่อนพายุ จะผ่าน Mini ง่ายขึ้น',
          level: 'info',
          why: ['พายุจะต้องใช้ BLOCK'],
          suggest: ['เห็น 🛡️ ให้เก็บก่อนบางจังหวะ']
        };
      }
    }

    return null;
  }

  // -------- public API --------
  function onStart() {
    if (S.started) return;
    S.started = true;
    S.t0 = now();
    S.lastSayAt = 0;
    S.lastTypeAt = Object.create(null);
    S.lastMsgHash = '';
    S.streakBad = 0;
    S.streakGood = 0;
    // optional: greet once (low priority)
    say('hello', '👋 พร้อมลุย! โฟกัส “ช้าแต่ชัวร์” ก่อน แล้วค่อยลากคอมโบ', {
      level: 'info',
      why: ['เริ่มเกมใหม่'],
      suggest: ['คุม GREEN ให้นาน', 'เก็บ 🛡️ ไว้ทำพายุ']
    });
  }

  function onUpdate(ctx = {}) {
    S.lastCtx = ctx;
    if (!S.started) return;
    const d = decide(ctx);
    if (!d) return;
    say(d.type, d.msg, {
      level: d.level || 'info',
      why: d.why || [],
      suggest: d.suggest || [],
      // attach tiny ctx for debugging (optional, trimmed)
      ctx: {
        inStorm: !!ctx.inStorm,
        inEndWindow: !!ctx.inEndWindow,
        waterZone: ctx.waterZone,
        shield: ctx.shield|0,
        misses: ctx.misses|0,
        combo: ctx.combo|0
      }
    });
  }

  function onEnd(summary = {}) {
    if (!S.started) return;
    // Wrap up hint (single)
    const grade = String(summary.grade || '').toUpperCase();
    const miss = summary.misses|0;
    const acc = Number(summary.accuracyGoodPct || 0);

    let msg = '📌 จบเกมแล้ว! รอบหน้าลอง “คุม GREEN ก่อน → ผ่านพายุ 1 ครั้ง → เคลียร์บอส”';
    let why = ['สรุปหลังจบเกม'];
    let suggest = ['ลด MISS', 'เพิ่ม Accuracy', 'เก็บ Shield ก่อนพายุ'];

    if (grade === 'SSS' || grade === 'SS') {
      msg = '🏆 โหดมาก! เกรดสูงแล้ว — ลองท้าด้วยการลด MISS ให้ต่ำลงอีก และผ่านทุกพายุ';
      suggest = ['ลด MISS', 'รักษา Accuracy', 'ผ่านพายุให้ครบ'];
    } else if (acc < 60) {
      msg = '🎯 รอบหน้าเน้น “เล็งนิ่งก่อนยิง” จะทำให้ Accuracy ดีขึ้นเร็วมาก';
      suggest = ['หยุด 1 วิ ก่อนยิง', 'เลือกเป้าที่ชัวร์', 'อย่ารัว'];
    } else if (miss >= 20) {
      msg = '💥 MISS ยังเยอะ: เปลี่ยนเป็นยิงเป็นจังหวะ + เลือกเป้าชัวร์ จะคุมเกมได้ทันที';
      suggest = ['ยิงเป็นจังหวะ', 'ลดการรัว', 'เก็บ Shield ให้พอ'];
    }

    say('end', msg, { level:'info', why, suggest });
  }

  return { onStart, onUpdate, onEnd, say };
}