// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// ✅ Export: createAICoach({ emit, game, cooldownMs, locale })
// ✅ Methods: onStart(), onUpdate(state), onEnd(summary), say(text, opts)
// ✅ Emits: hha:coach { game, type:'tip'|'praise'|'warn'|'summary', code, text, reason, ts }
// ✅ Safe no-op if emit missing
// Notes:
// - Designed for HHA Standard games (Hydration/Groups/Plate/GoodJunk)
// - Deterministic optional: pass seed in onStart({seed}) or in config {seed}

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function hashStr(s){
  s = String(s ?? '');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
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

export function createAICoach(cfg={}){
  const emitFn = (typeof cfg.emit === 'function') ? cfg.emit : null;
  const game = String(cfg.game || 'game');
  const cooldownMs = clamp(cfg.cooldownMs ?? 3200, 800, 15000);
  const locale = String(cfg.locale || 'th').toLowerCase();

  // rate-limit by tip-code (avoid repeating same thing too often)
  const perCodeCooldownMs = clamp(cfg.perCodeCooldownMs ?? 9000, 1200, 60000);

  // optional deterministic rng (only used to vary phrasing)
  const seed0 = (cfg.seed != null) ? String(cfg.seed) : '';
  let rng = seed0 ? makeRng(seed0) : null;

  const ST = {
    started:false,
    lastTipAt:0,
    lastAnyAt:0,
    lastCodeAt: Object.create(null),
    lastState:null,

    // memory to prevent spam
    praisedCombo:false,
    praisedAcc:false,
    warnedMiss:false,
    stormExplained:false,
    endExplained:false,
    bossExplained:false,

    // rolling counters
    tickN:0,
    softSilenceUntil:0
  };

  function emitCoach(payload){
    if (!emitFn) return;
    try{
      emitFn('hha:coach', Object.assign({ game, ts: Date.now() }, payload || {}));
    }catch(_){}
  }

  function canSpeak(code, urgent){
    const t = nowMs();
    if (t < ST.softSilenceUntil && !urgent) return false;

    if (!urgent){
      if (t - ST.lastTipAt < cooldownMs) return false;
    }
    if (code){
      const last = ST.lastCodeAt[code] || 0;
      if (t - last < perCodeCooldownMs && !urgent) return false;
    }
    return true;
  }

  function markSpoke(code){
    const t = nowMs();
    ST.lastTipAt = t;
    ST.lastAnyAt = t;
    if (code) ST.lastCodeAt[code] = t;
  }

  // pick phrasing (stable-ish if rng provided)
  function pick(arr){
    if (!arr || !arr.length) return '';
    if (!rng) return arr[0];
    const i = Math.floor(rng() * arr.length);
    return arr[Math.max(0, Math.min(arr.length-1, i))];
  }

  function say(text, opts={}){
    const code = String(opts.code || '');
    const urgent = !!opts.urgent;
    const level = String(opts.level || 'info');
    const type = String(opts.type || 'tip');
    const reason = opts.reason ? String(opts.reason) : '';

    if (!text) return false;
    if (!canSpeak(code, urgent)) return false;

    emitCoach({ type, level, code, text, reason });
    markSpoke(code);
    return true;
  }

  // --- tip library (TH default) ---
  const TH = {
    start: [
      'เริ่มเลย! ยิง 💧 เพื่อคุม Water ให้อยู่โซน GREEN ให้ได้นาน ๆ',
      'ทริค: เล็งให้ชัวร์ก่อนค่อยยิง จะได้คอมโบยาว ๆ'
    ],
    praiseCombo: [
      'คอมโบกำลังมา! รักษาจังหวะต่อเนื่องอีกนิด 🔥',
      'ดีมาก! คอมโบยาวขึ้นแล้ว 👏'
    ],
    praiseAcc: [
      'ความแม่นยำดีมาก! ถ้าไม่พลาดง่าย ๆ เกรดจะพุ่ง 🚀',
      'โห แม่นมาก! รักษาแบบนี้ไว้เลย'
    ],
    warnMiss: [
      'MISS เยอะไปนิดนะ: ลดการรัว แล้วเลือกยิงเป้าที่ชัวร์',
      'ใจเย็น ๆ เล็งก่อนยิง จะลด MISS ได้เยอะเลย'
    ],
    waterGreen: [
      'ตอนนี้ GREEN แล้ว! พยายาม “คุมให้นิ่ง” เพื่อสะสมเวลา',
    ],
    waterNotGreen: [
      'Water หลุด GREEN แล้ว: ยิง 💧 ปรับกลับมาให้อยู่กลาง ๆ',
      'ลองยิงเป็นจังหวะ ไม่ต้องรัว จะคุมโซนง่ายขึ้น'
    ],
    stormIntro: [
      'เข้า STORM แล้ว! เป้าจะถี่ขึ้น—โฟกัส “LOW/HIGH + เก็บ 🛡️”',
    ],
    stormSide: [
      'STORM: ต้องทำให้ Water หลุด GREEN (ไป LOW หรือ HIGH) ก่อน!',
      'STORM: ตอนนี้ต้องไป LOW/HIGH ให้ชัด ๆ แล้วค่อยทำขั้นต่อไป'
    ],
    endWindow: [
      'END WINDOW มาแล้ว! ถ้ามี 🛡️ ให้ BLOCK ตอนนี้เลย!',
      'ท้ายพายุ! ใช้ 🛡️ BLOCK ให้ครบในช่วงนี้'
    ],
    needShield: [
      'ยังไม่มี 🛡️: เก็บโล่ไว้ก่อน พอท้ายพายุจะได้ BLOCK ทัน',
    ],
    boss: [
      'BOSS WINDOW! 🌩️ โผล่ถี่ขึ้น—ต้อง BLOCK ให้ครบตามจำนวน',
    ],
    calm: [
      'โฟกัส 1 อย่าง: “คุม GREEN” ก่อน แล้วค่อยลุยพายุ',
    ],
    endSummary: [
      'จบแล้ว! รอบหน้าโฟกัส “ลด MISS + ผ่านพายุให้ได้” จะเทพขึ้นเร็วมาก',
    ]
  };

  const LIB = (locale.startsWith('th') ? TH : TH);

  function onStart(meta={}){
    ST.started = true;
    ST.tickN = 0;
    ST.softSilenceUntil = 0;
    ST.praisedCombo = false;
    ST.praisedAcc = false;
    ST.warnedMiss = false;
    ST.stormExplained = false;
    ST.endExplained = false;
    ST.bossExplained = false;

    if (meta && meta.seed != null){
      rng = makeRng(String(meta.seed));
    }

    // small delay so UI is ready
    setTimeout(()=>{ say(pick(LIB.start), { code:'start', type:'tip', level:'info', urgent:false }); }, 600);
  }

  function onUpdate(s={}){
    if (!ST.started) return;
    ST.tickN++;

    // Accept flexible state fields; keep it robust
    const waterZone = String(s.waterZone || '').toUpperCase(); // GREEN/LOW/HIGH
    const inStorm = !!s.inStorm;
    const inEndWindow = !!s.inEndWindow;
    const bossActive = !!s.bossActive; // optional
    const shield = Number(s.shield || 0);
    const misses = Number(s.misses || 0);
    const combo = Number(s.combo || 0);
    const skill = clamp(s.skill ?? 0.5, 0, 1);
    const frustration = clamp(s.frustration ?? 0, 0, 1);

    // --- urgent tactical tips ---
    if (inEndWindow){
      if (!ST.endExplained){
        ST.endExplained = true;
        say(pick(LIB.endWindow), { code:'endwindow', level:'warn', urgent:true, reason:'end_window' });
        // short silence after urgent tip to avoid spam
        ST.softSilenceUntil = nowMs() + 900;
        return;
      }
      if (shield <= 0){
        say(pick(LIB.needShield), { code:'need_shield', level:'warn', urgent:true, reason:'end_window_no_shield' });
        ST.softSilenceUntil = nowMs() + 900;
        return;
      }
    }

    if (bossActive && !ST.bossExplained){
      ST.bossExplained = true;
      say(pick(LIB.boss), { code:'boss', level:'warn', urgent:true, reason:'boss_window' });
      ST.softSilenceUntil = nowMs() + 900;
      return;
    }

    // --- storm guidance: LOW/HIGH clarity ---
    if (inStorm){
      if (!ST.stormExplained){
        ST.stormExplained = true;
        say(pick(LIB.stormIntro), { code:'storm_intro', level:'info', urgent:false, reason:'storm_enter' });
        return;
      }
      if (waterZone === 'GREEN'){
        // make LOW/HIGH requirement explicit (your request)
        say(pick(LIB.stormSide), { code:'storm_side', level:'info', urgent:false, reason:'storm_need_lowhigh' });
        return;
      }
    }

    // --- water control hints ---
    if (!inStorm){
      if (waterZone === 'GREEN'){
        // occasionally encourage, but not too much
        if (skill < 0.45 && (ST.tickN % 80 === 0)){
          say(pick(LIB.waterGreen), { code:'water_green', level:'info', urgent:false, reason:'water_green_hold' });
          return;
        }
      } else if (waterZone === 'LOW' || waterZone === 'HIGH'){
        // if struggling, gently nudge
        if (frustration > 0.35 || (ST.tickN % 60 === 0)){
          say(pick(LIB.waterNotGreen), { code:'water_not_green', level:'info', urgent:false, reason:'water_outside_green' });
          return;
        }
      }
    }

    // --- performance coaching ---
    if (!ST.warnedMiss && misses >= 10){
      ST.warnedMiss = true;
      say(pick(LIB.warnMiss), { code:'miss_warn', level:'warn', urgent:false, reason:'miss_high' });
      return;
    }

    if (!ST.praisedCombo && combo >= 8){
      ST.praisedCombo = true;
      say(pick(LIB.praiseCombo), { code:'combo_praise', level:'praise', urgent:false, reason:'combo_up' });
      return;
    }

    if (!ST.praisedAcc && skill >= 0.78){
      ST.praisedAcc = true;
      say(pick(LIB.praiseAcc), { code:'acc_praise', level:'praise', urgent:false, reason:'skill_high' });
      return;
    }

    // fallback calming tip if frustration grows
    if (frustration > 0.65 && (ST.tickN % 90 === 0)){
      say(pick(LIB.calm), { code:'calm', level:'info', urgent:false, reason:'frustration' });
      return;
    }

    ST.lastState = s;
  }

  function onEnd(summary={}){
    // one short wrap-up
    say(pick(LIB.endSummary), { code:'end', type:'summary', level:'info', urgent:true, reason:String(summary.reason || 'end') });
  }

  return { onStart, onUpdate, onEnd, say };
}