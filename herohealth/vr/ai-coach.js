// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (shared, explainable, rate-limited)
// ✅ createAICoach({ emit, game, cooldownMs, maxPerMinute, allowInResearch })
// ✅ onStart(), onUpdate(ctx), onEnd(summary), say(type, text, meta)
// ✅ Explainable micro-tips (rule-based now; AI hooks later)
// ✅ Safe for research: no randomness needed; deterministic from inputs
//
// Events (optional):
// - emit('hha:coach', { game, type, text, level, reason, when, meta })
//
// NOTE: This is NOT an LLM. It's a deterministic coach layer.
// You can later connect to your "AI hooks" module if desired.

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

function nowMs(){ return Date.now ? Date.now() : (new Date()).getTime(); }

function safeEmit(emit, type, payload){
  try{
    if (typeof emit === 'function') emit(type, payload);
    else ROOT.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }catch(_){}
}

function minuteBucket(t){
  return Math.floor(t / 60000);
}

function pickSeverity(frustration, fatigue){
  // 0..1
  const f = clamp(frustration, 0, 1);
  const ft = clamp(fatigue, 0, 1);
  if (f > 0.72) return 'urgent';
  if (f > 0.52) return 'warn';
  if (ft > 0.75) return 'soft';
  return 'info';
}

function normGame(g){
  return String(g||'').toLowerCase().trim() || 'generic';
}

// Tip templates by game (can expand later)
const TIPS = {
  hydration: {
    green: 'คุมให้อยู่ GREEN ให้ได้นาน ๆ: ยิง 💧 แบบใจเย็น อย่ารัว',
    lowhigh: 'ตอน STORM ต้องทำให้น้ำไม่อยู่ GREEN (LOW/HIGH) ก่อน แล้วค่อย BLOCK ช่วงท้าย',
    shield: 'เก็บ 🛡️ ไว้ก่อนพายุ 1–2 อัน จะผ่าน End Window ง่ายขึ้น',
    endwindow: 'ใกล้จบพายุแล้ว! รอช่วงท้าย (End Window) แล้วค่อย BLOCK ให้ติด',
    boss: 'BOSS WINDOW! 🌩️ โผล่ถี่ขึ้น — ใช้ 🛡️ BLOCK ให้ครบตามจำนวน',
    accuracy: 'ถ้าเล็งยาก: หยุดนิ้วครึ่งวินาทีแล้วค่อยยิง Accuracy จะดีขึ้น',
    miss: 'MISS เยอะ: เลือกยิงเป้าที่ชัวร์ ลดการรัว และเก็บคอมโบทีละนิด'
  },
  generic: {
    warm: 'เริ่มต้นดีมาก! โฟกัส “ยิงให้ชัวร์” ก่อน แล้วค่อยเร่งสปีด',
    acc: 'Accuracy สำคัญกว่าเร็ว: ช้าลงนิดเดียว แต่แม่นขึ้นเยอะ',
    combo: 'คอมโบยาว ๆ = คะแนนพุ่ง: เลือกเป้าชัวร์แล้วลากยาว',
    calm: 'หายใจลึก ๆ แล้วค่อยยิง จะคุมเกมได้ง่ายขึ้น'
  }
};

function defaultRules(game){
  const g = normGame(game);

  // Rules are ordered by priority. Each rule returns {ok, msg, reason, cooldownKey, gate?}
  if (g === 'hydration'){
    return [
      // urgent when storm end window active
      (ctx)=> ctx.inStorm && ctx.inEndWindow
        ? ({ ok:true, msg:TIPS.hydration.endwindow, reason:'storm_endwindow', cooldownKey:'storm_endwindow' })
        : ({ ok:false }),

      // boss window
      (ctx)=> ctx.inStorm && ctx.inEndWindow && (ctx.shield|0) <= 0
        ? ({ ok:true, msg:'ไม่มี 🛡️ แล้ว! เลี่ยง BAD ให้ได้ก่อน แล้วค่อยหา 🛡️ ใหม่', reason:'no_shield_endwindow', cooldownKey:'no_shield_endwindow' })
        : ({ ok:false }),

      (ctx)=> ctx.inStorm && ctx.inEndWindow && ctx.shield > 0 && ctx.waterZone !== 'GREEN'
        ? ({ ok:true, msg:'เยี่ยม! น้ำ LOW/HIGH แล้ว — BLOCK ช่วงท้ายให้ติดนะ', reason:'mini_ready', cooldownKey:'mini_ready' })
        : ({ ok:false }),

      // stage guidance (use ctx.waterZone, shield)
      (ctx)=> !ctx.inStorm && ctx.waterZone === 'GREEN' && (ctx.fatigue||0) < 0.65
        ? ({ ok:true, msg:TIPS.hydration.green, reason:'hold_green', cooldownKey:'hold_green' })
        : ({ ok:false }),

      (ctx)=> !ctx.inStorm && (ctx.shield|0) < 1
        ? ({ ok:true, msg:TIPS.hydration.shield, reason:'need_shield', cooldownKey:'need_shield' })
        : ({ ok:false }),

      // skill issues
      (ctx)=> (ctx.frustration||0) > 0.55 && (ctx.misses|0) >= 8
        ? ({ ok:true, msg:TIPS.hydration.miss, reason:'miss_high', cooldownKey:'miss_high' })
        : ({ ok:false }),

      (ctx)=> (ctx.skill||0) < 0.55
        ? ({ ok:true, msg:TIPS.hydration.accuracy, reason:'skill_low', cooldownKey:'skill_low' })
        : ({ ok:false }),
    ];
  }

  // generic fallback
  return [
    (ctx)=> (ctx.frustration||0) > 0.6
      ? ({ ok:true, msg:TIPS.generic.calm, reason:'frustration', cooldownKey:'frustration' })
      : ({ ok:false }),
    (ctx)=> (ctx.skill||0) < 0.55
      ? ({ ok:true, msg:TIPS.generic.acc, reason:'skill_low', cooldownKey:'skill_low' })
      : ({ ok:false }),
    (ctx)=> (ctx.combo|0) >= 10
      ? ({ ok:true, msg:TIPS.generic.combo, reason:'combo_good', cooldownKey:'combo_good' })
      : ({ ok:false }),
    ()=> ({ ok:true, msg:TIPS.generic.warm, reason:'warm', cooldownKey:'warm' }),
  ];
}

export function createAICoach(opts = {}){
  const emit = opts.emit;
  const game = normGame(opts.game);
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 900, 15000);
  const maxPerMinute = clamp(opts.maxPerMinute ?? 10, 2, 30);
  const allowInResearch = (opts.allowInResearch ?? true) ? true : false;

  const RULES = Array.isArray(opts.rules) ? opts.rules : defaultRules(game);

  const S = {
    started:false,
    lastSayAt:0,
    lastTypeAt: Object.create(null), // cooldownKey -> ms
    minute: minuteBucket(nowMs()),
    saidThisMinute: 0,
    lastCtx: null,
    runMode: null
  };

  function canSpeak(runMode){
    // If user wants: allowInResearch can be false to disable coach in research
    if (!allowInResearch && String(runMode||'').toLowerCase() === 'research') return false;
    const t = nowMs();

    // rate limit per minute
    const m = minuteBucket(t);
    if (m !== S.minute){
      S.minute = m;
      S.saidThisMinute = 0;
    }
    if (S.saidThisMinute >= maxPerMinute) return false;

    // global cooldown
    if (t - S.lastSayAt < cooldownMs) return false;

    return true;
  }

  function canSpeakType(key){
    const k = String(key||'');
    if (!k) return true;
    const t = nowMs();
    const last = Number(S.lastTypeAt[k]||0);
    // per-tip cooldown (longer than global to avoid repeating same advice)
    const cd = Math.max(cooldownMs * 1.9, 3200);
    if (t - last < cd) return false;
    S.lastTypeAt[k] = t;
    return true;
  }

  function say(type, text, meta={}){
    const t = nowMs();
    const payload = {
      game,
      type: String(type||'tip'),
      text: String(text||''),
      level: meta.level || 'info',
      reason: meta.reason || '',
      when: new Date(t).toISOString(),
      meta: Object.assign({}, meta)
    };

    S.lastSayAt = t;
    S.saidThisMinute++;

    safeEmit(emit, 'hha:coach', payload);
    return payload;
  }

  function onStart(ctx = {}){
    S.started = true;
    S.lastSayAt = 0;
    S.lastCtx = null;
    S.runMode = (ctx.runMode || ctx.run || null);

    // optional warm greet (soft, but still rate-limited)
    // intentionally do NOT auto-speak immediately; let first update decide.
  }

  function onUpdate(ctx = {}){
    if (!S.started) return;

    // normalize ctx
    const C = Object.assign({
      skill: 0.5,
      fatigue: 0.0,
      frustration: 0.0,
      inStorm:false,
      inEndWindow:false,
      waterZone:'',
      shield:0,
      misses:0,
      combo:0,
      runMode: S.runMode
    }, ctx || {});

    S.runMode = (C.runMode || S.runMode);

    // quick debounce: if ctx unchanged a lot, don't spam
    // (use lightweight signature)
    const sig = [
      (C.inStorm?1:0),
      (C.inEndWindow?1:0),
      String(C.waterZone||''),
      (C.shield|0),
      (C.misses|0),
      (C.combo|0),
      Math.round(clamp(C.skill,0,1)*10),
      Math.round(clamp(C.frustration,0,1)*10),
      Math.round(clamp(C.fatigue,0,1)*10),
    ].join('|');

    if (S.lastCtx === sig){
      return;
    }
    S.lastCtx = sig;

    if (!canSpeak(S.runMode)) return;

    // evaluate rules in order
    for (const rule of RULES){
      let out = null;
      try{ out = rule(C); }catch(_){ out = null; }
      if (!out || !out.ok) continue;

      const key = out.cooldownKey || out.reason || 'tip';
      if (!canSpeakType(key)) continue;

      const level = pickSeverity(C.frustration, C.fatigue);
      return say('tip', out.msg, { reason: out.reason || key, level });
    }
  }

  function onEnd(summary = {}){
    // optional: closing message (but keep it minimal; don't spam on end)
    // You already have end summary UI, so coach can stay quiet.
    S.started = false;
    S.lastCtx = null;
  }

  return { onStart, onUpdate, onEnd, say };
}