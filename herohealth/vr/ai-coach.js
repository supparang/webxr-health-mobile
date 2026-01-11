// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (explainable micro-tips)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(ctx), onEnd(summary)
// ✅ Emits: hha:coach { game, level, code, msg, why, ctx, at }
// ✅ Rate-limited + dedupe + "situational" tips (skill/fatigue/frustration/storm/endWindow)
//
// Notes:
// - This is "AI-like" rule-based coach (deterministic & explainable).
// - Safe defaults: does nothing noisy.
// - In research mode you can still keep it enabled or disable outside (your game decides).

export function createAICoach(opts = {}) {
  const emit = typeof opts.emit === 'function' ? opts.emit : (()=>{});
  const game = String(opts.game || 'hha').toLowerCase();
  const cooldownMs = Math.max(800, Number(opts.cooldownMs || 3200));
  const debug = !!opts.debug;

  const now = ()=> Date.now();
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---- internal state ----
  const S = {
    started: false,
    lastTipAt: 0,
    lastCode: '',
    sameCodeStreak: 0,
    // light memory to avoid repeats
    seen: Object.create(null),  // code -> ts
    // EMAs for smoothing
    emaSkill: 0.45,
    emaFatigue: 0.0,
    emaFrustration: 0.0,
    // phase awareness
    inStorm: false,
    inEndWindow: false,
    lastStormAt: 0,
    lastEndWindowAt: 0,
    // counters
    tick: 0,
    // allow stronger tip sometimes
    urgencyBoostUntil: 0
  };

  function log(...a){ if (debug) console.log('[AI-COACH]', ...a); }

  function canSpeak(force=false){
    const t = now();
    if (force) return true;
    if (t - S.lastTipAt < cooldownMs) return false;
    return true;
  }

  function markSeen(code){
    S.seen[code] = now();
    // prune occasionally
    if ((S.tick % 60) === 0){
      const entries = Object.entries(S.seen).sort((a,b)=>Number(b[1]) - Number(a[1]));
      const keep = entries.slice(0, 30);
      const next = Object.create(null);
      for (const [c, ts] of keep) next[c] = ts;
      S.seen = next;
    }
  }

  function alreadySeenRecently(code, windowMs=45000){
    const t = S.seen[code] || 0;
    return (now() - t) < windowMs;
  }

  function say(level, code, msg, why, ctx, force=false){
    if (!code) code = 'TIP';
    if (!canSpeak(force)) return false;

    // dedupe (soft)
    if (code === S.lastCode) S.sameCodeStreak++; else S.sameCodeStreak = 0;
    S.lastCode = code;

    // avoid spamming same code
    if (S.sameCodeStreak >= 2 && !force) return false;

    // avoid repeating too often
    if (alreadySeenRecently(code) && !force) return false;

    S.lastTipAt = now();
    markSeen(code);

    const payload = {
      game,
      level: level || 'tip',  // tip | warn | praise | info
      code,
      msg: String(msg || ''),
      why: String(why || ''),
      ctx: ctx ? safeCtx(ctx) : {},
      at: new Date().toISOString()
    };

    emit('hha:coach', payload);
    log('emit', payload);
    return true;
  }

  function safeCtx(ctx){
    // keep small + safe primitives
    const out = {};
    const allow = [
      'skill','fatigue','frustration','misses','combo','shield','waterZone',
      'inStorm','inEndWindow','accuracy','grade','stage','stormCycles','stormSuccess'
    ];
    for (const k of allow){
      if (k in ctx){
        const v = ctx[k];
        if (typeof v === 'number') out[k] = Number.isFinite(v) ? Number(v) : 0;
        else if (typeof v === 'string') out[k] = String(v).slice(0, 40);
        else if (typeof v === 'boolean') out[k] = !!v;
      }
    }
    return out;
  }

  function to01(x, def=0){
    x = Number(x);
    if (!Number.isFinite(x)) x = def;
    return clamp(x, 0, 1);
  }

  // ---- Heuristics: common cross-game coach logic ----
  function updateEmas(ctx){
    const sk = to01(ctx.skill, 0.45);
    const ft = to01(ctx.fatigue, 0.0);
    const fr = to01(ctx.frustration, 0.0);
    S.emaSkill = S.emaSkill*0.88 + sk*0.12;
    S.emaFatigue = S.emaFatigue*0.90 + ft*0.10;
    S.emaFrustration = S.emaFrustration*0.86 + fr*0.14;
  }

  function detectPhases(ctx){
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;

    if (inStorm && !S.inStorm) S.lastStormAt = now();
    if (inEnd && !S.inEndWindow) S.lastEndWindowAt = now();

    S.inStorm = inStorm;
    S.inEndWindow = inEnd;
  }

  // ---- Hydration-specific advice ----
  function hydrationTips(ctx){
    const misses = Number(ctx.misses||0);
    const combo = Number(ctx.combo||0);
    const shield = Number(ctx.shield||0);
    const zone = String(ctx.waterZone||'').toUpperCase();

    // 1) End Window callout (very important)
    if (ctx.inStorm && ctx.inEndWindow){
      if (shield <= 0){
        return say(
          'warn',
          'HYD_ENDWINDOW_NEED_SHIELD',
          '🛡️ ช่วงท้ายพายุแล้ว! แต่ตอนนี้ไม่มีโล่ — รีบเก็บ 🛡️ ก่อน แล้วค่อย BLOCK 🌩️',
          'ช่วง End Window ต้องใช้โล่ BLOCK เพื่อผ่าน Mini/Boss',
          ctx
        );
      }
      return say(
        'info',
        'HYD_ENDWINDOW_BLOCK_NOW',
        '⏱️ End Window มาแล้ว! ใช้ 🛡️ BLOCK 🌩️ ให้ครบ (อย่าพลาด)',
        'การผ่าน Mini/Boss จะเช็คการ BLOCK ในช่วงท้ายพายุ',
        ctx
      );
    }

    // 2) Storm prep: need shield before storm
    if (!ctx.inStorm && shield === 0 && S.emaSkill > 0.35 && S.emaFatigue < 0.9){
      return say(
        'tip',
        'HYD_PREP_SHIELD',
        'เตรียมพายุไว้ก่อน: เก็บ 🛡️ สัก 1–2 อัน จะผ่าน Storm Mini ง่ายขึ้นมาก',
        'ช่วงพายุถ้าไม่มีโล่จะกัน 🌩️ ไม่ได้ ทำให้ Mini ล้มเหลว',
        ctx
      );
    }

    // 3) Zone control: keep GREEN for stage 1
    if (!ctx.inStorm){
      if (zone !== 'GREEN' && S.emaSkill < 0.55){
        return say(
          'tip',
          'HYD_ZONE_BACK_TO_GREEN',
          'น้ำหลุด GREEN แล้วนะ 👉 ยิง 💧 เพื่อดันกลับไป GREEN จะเก็บเวลา Stage 1 ได้ไว',
          'Stage 1 ต้องสะสมเวลาในโซน GREEN',
          ctx
        );
      }
    }

    // 4) Accuracy / spam control
    if (misses >= 10 && S.emaFrustration > 0.55){
      return say(
        'warn',
        'HYD_STOP_SPAM',
        'อย่ารัวนะ 😅 ลอง “เล็งนิ่ง 0.2 วิ แล้วค่อยยิง” จะ MISS ลดลงทันที',
        'MISS สูงทำให้เสียแต้มและทำให้ผ่าน Stage ยากขึ้น',
        ctx
      );
    }

    // 5) Praise: good combo
    if (combo >= 12 && S.emaSkill >= 0.70){
      return say(
        'praise',
        'HYD_COMBO_PRAISE',
        `โหดมาก! คอมโบ ${combo} 🔥 รักษาจังหวะนี้ไว้ เกรดจะพุ่ง`,
        'คอมโบยาว = ความแม่นและการตัดสินใจดี',
        ctx
      );
    }

    return false;
  }

  // ---- Generic tips (fallback for other games) ----
  function genericTips(ctx){
    const misses = Number(ctx.misses||0);
    const combo = Number(ctx.combo||0);

    if (S.emaFrustration > 0.7 && misses >= 8){
      return say(
        'warn',
        'GEN_CALM',
        'พักสายตา 2 วิ แล้วค่อยยิงต่อ — ความนิ่งชนะความเร็ว 💪',
        'ความหงุดหงิดสูงมักทำให้กดรัวและพลาดมากขึ้น',
        ctx
      );
    }

    if (combo >= 10 && S.emaSkill > 0.6){
      return say(
        'praise',
        'GEN_COMBO',
        `คอมโบ ${combo}! ดีมาก 🔥`,
        'รักษาจังหวะเดิม แล้วค่อยเพิ่มความเร็วทีละนิด',
        ctx
      );
    }

    if (S.emaFatigue > 0.86){
      return say(
        'info',
        'GEN_FATIGUE',
        'ใกล้หมดเวลาแล้ว! โฟกัส “เป้าที่ชัวร์” ก่อน',
        'ช่วงท้ายเกมควรลดความเสี่ยงเพื่อคุมคะแนน',
        ctx
      );
    }

    return false;
  }

  // ---- Public API ----
  function onStart(){
    S.started = true;
    S.lastTipAt = 0;
    S.lastCode = '';
    S.sameCodeStreak = 0;
    S.tick = 0;
    S.emaSkill = 0.45;
    S.emaFatigue = 0;
    S.emaFrustration = 0;
    S.inStorm = false;
    S.inEndWindow = false;
    S.urgencyBoostUntil = 0;

    say(
      'info',
      'COACH_READY',
      'โหมด Coach พร้อม ✅ ถ้าพลาดเยอะ/เข้า Storm แล้ว ฉันจะเตือนให้เอง',
      'ช่วยบอกจังหวะสำคัญ + วิธีผ่านภารกิจแบบอธิบายได้',
      { skill:0.45, fatigue:0, frustration:0, inStorm:false, inEndWindow:false },
      true
    );
  }

  function onUpdate(ctx = {}){
    if (!S.started) return;
    S.tick++;

    // Smooth
    updateEmas(ctx);
    detectPhases(ctx);

    const packed = Object.assign({}, ctx, {
      skill: S.emaSkill,
      fatigue: S.emaFatigue,
      frustration: S.emaFrustration,
      inStorm: !!ctx.inStorm,
      inEndWindow: !!ctx.inEndWindow
    });

    // Priority: critical windows first
    if (game === 'hydration'){
      if (hydrationTips(packed)) return;
    }

    // If not hydration or no hydration tip emitted
    genericTips(packed);
  }

  function onEnd(summary = {}){
    // 1 final reflective message (optional)
    const grade = String(summary.grade || '').toUpperCase();
    const acc = Number(summary.accuracyGoodPct || summary.accuracy || 0);
    const miss = Number(summary.misses || 0);

    let msg = 'จบเกมแล้ว ✅';
    let why = 'สรุปแบบสั้น ๆ เพื่อปรับรอบหน้า';

    if (grade && grade !== 'C'){
      msg = `จบเกมแล้ว ✅ เกรด ${grade} — ไปต่อให้โหดขึ้นได้อีก!`;
    }
    if (acc >= 80 && miss <= 10){
      msg = `โหด! Accuracy ${acc.toFixed(0)}% + MISS ต่ำ 👍`;
    } else if (acc < 60){
      msg = `รอบหน้าเน้นความนิ่งก่อน: Accuracy ${acc.toFixed(0)}%`;
    } else if (miss >= 20){
      msg = `รอบหน้าโฟกัสลด MISS (${miss}) แล้วคะแนนจะพุ่ง`;
    }

    say('info', 'COACH_END', msg, why, {
      accuracy: acc,
      grade: grade || '',
      misses: miss,
      stormCycles: Number(summary.stormCycles||0),
      stormSuccess: Number(summary.stormSuccess||0),
      stage: Number(summary.stageCleared||0)
    }, true);
  }

  return { onStart, onUpdate, onEnd };
}