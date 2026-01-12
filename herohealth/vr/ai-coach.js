// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable Micro-Tips + Rate-Limit)
// ✅ Works across all HHA games
// ✅ API: createAICoach({ emit, game, cooldownMs, maxTipsPerRun, lang, runMode, seed })
// ✅ Methods: onStart(), onUpdate(state), onEvent(name, payload), onEnd(summary)
// ✅ Emits: hha:coach { game, level, msg, why, code, atMs, stateSnap? }
// ✅ No external deps

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

function pickByScore(items, rng){
  // items: [{score, ...}]
  let sum = 0;
  for (const it of items) sum += Math.max(0, Number(it.score)||0);
  if (sum <= 0) return items[0] || null;
  let r = (rng ? rng() : Math.random()) * sum;
  for (const it of items){
    r -= Math.max(0, Number(it.score)||0);
    if (r <= 0) return it;
  }
  return items[items.length-1] || null;
}

function defaultEmit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

export function createAICoach(opts = {}){
  const CFG = Object.assign({
    emit: defaultEmit,
    game: 'generic',
    lang: 'th',               // 'th' | 'en'
    runMode: '',              // 'play' | 'research' | 'study' ...
    seed: '',                 // deterministic selection if provided
    cooldownMs: 3500,         // minimum time between tips
    maxTipsPerRun: 10,        // hard cap
    minStateIntervalMs: 250,  // ignore updates too frequent
    debug: false,
  }, opts || {});

  const emit = (typeof CFG.emit === 'function') ? CFG.emit : defaultEmit;
  const rng = makeRng(String(CFG.seed || `${CFG.game}|${CFG.runMode||''}`));

  const S = {
    started: false,
    ended: false,
    t0: 0,
    lastUpdateAt: 0,
    lastTipAt: -1e9,
    tipsSent: 0,
    lastCode: '',
    lastCodes: [],
    cooldownMs: clamp(CFG.cooldownMs, 800, 20000),
    cap: clamp(CFG.maxTipsPerRun, 0, 40),
    // short memory / smoothness
    emaSkill: 0.5,
    emaFrustration: 0.1,
    emaFatigue: 0.1,
    // context (for better tips)
    lastState: null
  };

  function say(level, code, msg, why, stateSnap){
    if (S.ended) return false;
    const t = nowMs();
    if (S.tipsSent >= S.cap) return false;

    // Rate limit
    if ((t - S.lastTipAt) < S.cooldownMs) return false;

    // Avoid repeating same code too often
    if (code && code === S.lastCode && (t - S.lastTipAt) < (S.cooldownMs * 2.2)) return false;
    if (code && S.lastCodes.includes(code) && (t - S.lastTipAt) < (S.cooldownMs * 1.6)) return false;

    S.lastTipAt = t;
    S.tipsSent++;
    S.lastCode = String(code||'');
    S.lastCodes.push(S.lastCode);
    if (S.lastCodes.length > 6) S.lastCodes.shift();

    emit('hha:coach', {
      game: CFG.game,
      level: level || 'tip', // 'tip' | 'warn' | 'praise'
      code: String(code||''),
      msg: String(msg||''),
      why: String(why||''),
      atMs: Math.round(t - S.t0),
      stateSnap: stateSnap ? Object.assign({}, stateSnap) : undefined
    });

    return true;
  }

  // ----------- message templates -----------
  function thMsg(code, ctx){
    // ctx is sanitized snapshot
    switch(code){
      case 'AIM_PAUSE':
        return {
          level:'tip',
          msg:'เล็งค้างนิดนึง แล้วค่อยยิง จะชัวร์ขึ้น 🎯',
          why:`เพราะ Accuracy ตอนนี้ ${ctx.acc?.toFixed?.(0) ?? ctx.acc}% ยังต่ำ และยิงรัวแล้วพลาดง่าย`
        };
      case 'MISS_SPIKE':
        return {
          level:'warn',
          msg:'MISS เริ่มพุ่งแล้วนะ—ลดการรัว เลือกยิงเป้าที่ใกล้กลางจอ 💥',
          why:`เพราะอัตรา MISS ต่อเวลาเพิ่มขึ้น (miss=${ctx.miss})`
        };
      case 'COMBO_PUSH':
        return {
          level:'praise',
          msg:'คอมโบกำลังดี! ลากต่ออีกนิด เกรดจะเด้งแรง ⚡',
          why:`เพราะ combo=${ctx.combo} และ accuracy=${ctx.acc?.toFixed?.(0) ?? ctx.acc}% อยู่ในโซนดี`
        };
      case 'STORM_RULE':
        return {
          level:'tip',
          msg:'ช่วงพายุ: ต้องทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) แล้ว BLOCK ตอนท้าย (End Window) 🌀🛡️',
          why:'เงื่อนไขผ่าน Stage2 คือ zoneOK + pressure + endWindow + block และห้ามโดน BAD ตอนพายุ'
        };
      case 'ENDWINDOW_NOW':
        return {
          level:'warn',
          msg:'เข้า End Window แล้ว! รีบ BLOCK ด้วย 🛡️ ตอนนี้เลย ⏱️',
          why:'เพราะอยู่ช่วงท้ายพายุ ถ้าไม่ block จะไม่ผ่าน Mini'
        };
      case 'BOSS_WINDOW':
        return {
          level:'warn',
          msg:'Boss Window! 🌩️ โผล่ถี่ขึ้น—เก็บ 🛡️ แล้ว BLOCK ให้ครบ!',
          why:`เพราะ bossActive=true และต้อง BLOCK ให้ครบตามที่เกมกำหนด`
        };
      case 'SHIELD_SAVE':
        return {
          level:'tip',
          msg:'เก็บ 🛡️ ไว้ก่อนพายุ 1–2 อัน จะผ่าน Mini ง่ายขึ้น',
          why:`เพราะตอนนี้ shield=${ctx.shield} และอีกไม่นานมี Storm`
        };
      case 'GREEN_FOCUS':
        return {
          level:'tip',
          msg:'ตอนนี้โฟกัส Stage1 ก่อน: คุม GREEN ให้นาน ๆ ด้วยการยิง 💧 ให้สม่ำเสมอ 💧',
          why:`เพราะ greenHold ยังไม่ถึงเป้า และโซน GREEN สำคัญสุดช่วงต้น`
        };
      default:
        return {
          level:'tip',
          msg:'เล่นต่อได้เลย! โฟกัสความแม่น + ลด MISS นิดนึง 👍',
          why:'เพื่อให้ผ่านทุก Stage และได้ Tier สูง'
        };
    }
  }

  function enMsg(code, ctx){
    switch(code){
      case 'AIM_PAUSE':
        return { level:'tip', msg:'Hold your aim for a moment, then shoot 🎯', why:'Accuracy is low; rushing increases misses.' };
      case 'MISS_SPIKE':
        return { level:'warn', msg:'Misses are rising—slow down and shoot near center 💥', why:`miss=${ctx.miss}` };
      case 'COMBO_PUSH':
        return { level:'praise', msg:'Nice combo! Keep it going ⚡', why:`combo=${ctx.combo}, acc=${ctx.acc}%` };
      case 'STORM_RULE':
        return { level:'tip', msg:'Storm: make water NOT GREEN (LOW/HIGH) then BLOCK in End Window 🌀🛡️', why:'Mini requires zone+pressure+endWindow+block; no BAD hit.' };
      case 'ENDWINDOW_NOW':
        return { level:'warn', msg:'End Window now—BLOCK with 🛡️ ⏱️', why:'You must block at the end to clear the mini.' };
      case 'BOSS_WINDOW':
        return { level:'warn', msg:'Boss Window! 🌩️ Spawn rate up—BLOCK enough hits!', why:'Boss is active.' };
      case 'SHIELD_SAVE':
        return { level:'tip', msg:'Save 1–2 shields before Storm 🛡️', why:`shield=${ctx.shield}` };
      case 'GREEN_FOCUS':
        return { level:'tip', msg:'Focus Stage 1: keep GREEN by hitting 💧 steadily', why:'GREEN hold target not reached yet.' };
      default:
        return { level:'tip', msg:'Keep playing—accuracy up, misses down 👍', why:'To clear all stages and rank up.' };
    }
  }

  function render(code, ctx){
    return (String(CFG.lang||'th').toLowerCase()==='en') ? enMsg(code, ctx) : thMsg(code, ctx);
  }

  function snapshot(state){
    const acc = clamp(Number(state?.skill ?? (state?.accuracyGoodPct ? state.accuracyGoodPct/100 : 0)), 0, 1) * 100;
    return {
      acc,
      combo: Number(state?.combo||0),
      miss: Number(state?.misses||0),
      shield: Number(state?.shield||0),
      inStorm: !!state?.inStorm,
      inEndWindow: !!state?.inEndWindow,
      waterZone: String(state?.waterZone||'')
    };
  }

  // ----------- decision logic -----------
  function decide(state){
    // state comes from your game per frame-ish (but rate limited by coach)
    const snap = snapshot(state);

    // Smooth core signals
    const skill = clamp(Number(state?.skill ?? (snap.acc/100)), 0, 1);
    const frus  = clamp(Number(state?.frustration ?? 0), 0, 1);
    const fat   = clamp(Number(state?.fatigue ?? 0), 0, 1);

    S.emaSkill = S.emaSkill*0.90 + skill*0.10;
    S.emaFrustration = S.emaFrustration*0.88 + frus*0.12;
    S.emaFatigue = S.emaFatigue*0.92 + fat*0.08;

    // Candidate tips
    const C = [];

    // Hydration-specific high-value tips (but harmless for other games)
    if (snap.inStorm){
      C.push({ code:'STORM_RULE', score: 0.55 });
      if (snap.inEndWindow) C.push({ code:'ENDWINDOW_NOW', score: 1.25 });
      if (state?.bossActive) C.push({ code:'BOSS_WINDOW', score: 1.05 });
      if (snap.shield <= 0 && !snap.inEndWindow) C.push({ code:'SHIELD_SAVE', score: 0.60 });
    } else {
      // Stage1 focus (generic enough)
      if (snap.waterZone === 'GREEN' && fat < 0.9){
        C.push({ code:'GREEN_FOCUS', score: 0.35 });
      }
      if (snap.shield <= 0 && fat < 0.85){
        C.push({ code:'SHIELD_SAVE', score: 0.22 });
      }
    }

    // Skill-based coaching
    if (S.emaSkill < 0.55) C.push({ code:'AIM_PAUSE', score: 0.70 + (0.55 - S.emaSkill) });
    if (S.emaFrustration > 0.55) C.push({ code:'MISS_SPIKE', score: 0.55 + (S.emaFrustration - 0.55) });
    if (snap.combo >= 8 && S.emaSkill >= 0.62) C.push({ code:'COMBO_PUSH', score: 0.30 + (snap.combo/30) });

    // If nothing, no tip
    if (!C.length) return null;

    // Reduce nagging: if too early in run, avoid heavy warnings unless urgent
    const t = nowMs() - S.t0;
    const early = (t < 6500);
    if (early){
      for (const it of C){
        if (it.code === 'MISS_SPIKE') it.score *= 0.55;
        if (it.code === 'STORM_RULE') it.score *= 0.65;
      }
      // BUT urgent end-window remains high
    }

    // Pick one
    const chosen = pickByScore(C, rng);
    return chosen ? { code: chosen.code, snap } : null;
  }

  // ----------- public API -----------
  function onStart(){
    S.started = true;
    S.ended = false;
    S.t0 = nowMs();
    S.lastUpdateAt = 0;
    S.lastTipAt = -1e9;
    S.tipsSent = 0;
    S.lastCode = '';
    S.lastCodes = [];
    S.emaSkill = 0.5;
    S.emaFrustration = 0.1;
    S.emaFatigue = 0.1;

    // Gentle first tip (optional)
    // say('tip','START','เริ่มเลย! โฟกัสแม่น + คุมจังหวะยิง 👌','เพื่อให้ผ่าน Stage ได้ไว');
  }

  function onUpdate(state){
    if (!S.started || S.ended) return;

    const t = nowMs();
    if ((t - S.lastUpdateAt) < CFG.minStateIntervalMs) return;
    S.lastUpdateAt = t;
    S.lastState = state || null;

    const out = decide(state);
    if (!out) return;

    const { code, snap } = out;
    const r = render(code, snap);
    // Extra throttle: don’t spam same category during storms unless urgent
    const urgent = (code === 'ENDWINDOW_NOW' || code === 'BOSS_WINDOW');
    if (!urgent && (t - S.lastTipAt) < (S.cooldownMs * 1.05)) return;

    say(r.level, code, r.msg, r.why, snap);
  }

  function onEvent(name, payload){
    // Optional hook if a game wants to notify coach of discrete events
    // Example: onEvent('mini:fail', {reason:'hit-bad'})
    if (S.ended) return;
    const n = String(name||'').toLowerCase();

    if (n.includes('mini:fail')){
      const msg = (CFG.lang==='en')
        ? 'Mini failed—remember: avoid BAD and BLOCK at the end.'
        : 'Mini ไม่ผ่าน—จำไว้ว่า “ห้ามโดน BAD” และต้อง BLOCK ช่วงท้าย';
      const why = (payload && payload.reason) ? `เหตุผล: ${payload.reason}` : 'ลองใหม่อีกรอบ';
      say('warn','MINI_FAIL', msg, why);
    }
  }

  function onEnd(summary){
    if (S.ended) return;
    S.ended = true;

    // One final praise/tip is okay if still under cap
    try{
      const grade = String(summary?.grade||'');
      if (grade && grade !== 'C'){
        say('praise','END_PRAISE',
          (CFG.lang==='en') ? `Nice run! Grade ${grade}.` : `จบเกมแล้ว! ได้เกรด ${grade} 👏`,
          (CFG.lang==='en') ? 'Keep accuracy high and misses low.' : 'คุม Accuracy ต่อ + ลด MISS อีกนิดจะขึ้น Tier ง่ายมาก'
        );
      }
    }catch(_){}
  }

  return { onStart, onUpdate, onEvent, onEnd };
}