// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable Micro-tips, Rate-limited, Research-safe)
// ✅ createAICoach({ emit, game, cooldownMs, enabled })
//
// Design goals:
// - สนุก: โค้ชพูดเป็น “ไมโครทิป” เวลาเหมาะๆ (เชียร์/เตือน/แนะนำขั้นตอน)
// - ไม่รำคาญ: rate-limit + anti-spam (ซ้ำไม่พูดถี่)
// - Explainable: บอกเหตุผลสั้นๆ ว่าทำไมแนะนำแบบนี้
// - Research-safe: โหมด research ปิดได้ 100% (ไม่ทำอะไร)

// Usage:
// import { createAICoach } from '../vr/ai-coach.js';
// const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs: 3000 });
// AICOACH.onStart(); AICOACH.onUpdate(state); AICOACH.onEnd(summary);

'use strict';

export function createAICoach(opts = {}) {
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'game').toLowerCase();
  const cooldownMs = clampNum(opts.cooldownMs, 800, 120000, 3200);
  const enabledOpt = (opts.enabled === undefined) ? true : !!opts.enabled;

  // Auto-disable in research if URL has run=research or runMode=research
  const runMode = String(qs('run', qs('runMode', 'play'))).toLowerCase();
  const enabled = enabledOpt && (runMode !== 'research');

  const S = {
    enabled,
    started:false,
    lastSayAt:0,
    lastKey:'',
    lastPayloadStr:'',
    // Anti-repeat memory
    seen: new Map(), // key -> ts
    // pacing
    intensity: 0.35, // 0..1
    // state snapshot
    last: null,
    // stage memory (generic)
    stage: 1,
    // encouragement cadence
    lastCheerAt:0,
    lastWarnAt:0,
    lastTeachAt:0,
  };

  function now(){ return performance.now ? performance.now() : Date.now(); }

  function say(type, key, text, why='', extra = {}) {
    if (!S.enabled) return;

    const t = now();
    if (t - S.lastSayAt < cooldownMs) return;

    // Anti spam: same key not too frequent
    const prev = S.seen.get(key) || 0;
    if (t - prev < Math.max(8000, cooldownMs * 2.2)) return;

    // Avoid repeating identical payload
    const payload = Object.assign({
      game,
      type,       // 'tip' | 'warn' | 'cheer' | 'stage'
      key,
      text,
      why,        // short explanation (optional)
      ts: Date.now()
    }, extra);

    const pstr = safeJSONStringify(payload);
    if (pstr && pstr === S.lastPayloadStr) return;

    S.lastSayAt = t;
    S.lastKey = key;
    S.lastPayloadStr = pstr || '';

    S.seen.set(key, t);

    emit('hha:coach', payload);
  }

  function coachStart() {
    if (!S.enabled) return;
    S.started = true;
    S.lastSayAt = 0;
    S.seen.clear();
    S.intensity = 0.35;

    // gentle intro
    say('tip', 'intro', introText(game).text, introText(game).why, { priority: 0.2 });
  }

  function coachEnd(summary) {
    if (!S.enabled) return;

    // End: short reflection
    try{
      const grade = String(summary?.grade || '').toUpperCase();
      const acc = Number(summary?.accuracyGoodPct || 0);
      const miss = Number(summary?.misses || 0);
      const stage = Number(summary?.stageCleared || 0);

      if (stage >= 3) {
        say('cheer', 'end_clear', `สุดยอด! ผ่านครบ 3 Stage ✅ (เกรด ${grade || '—'})`, 'คุณจัดการทั้งคุมสมดุล + Mini + Boss ได้ครบ', { priority: 0.9 });
      } else if (stage === 2) {
        say('tip', 'end_stage2', `เก่งมาก! ผ่านถึง Stage 2 แล้ว 🔥`, 'ต่อไปโฟกัส Boss Window: เก็บ 🛡️ ไว้ก่อนพายุ', { priority: 0.8 });
      } else if (stage === 1) {
        say('tip', 'end_stage1', `ผ่าน Stage 1 แล้ว 👍`, 'รอพายุแล้วทำ Mini: LOW/HIGH + BLOCK ช่วงท้าย', { priority: 0.7 });
      } else {
        // if still not stage1
        say('tip', 'end_stage0', `ใกล้แล้ว! ลองอีกครั้ง 💪`, 'คุม Water ให้อยู่ GREEN ให้นานขึ้น โดยยิง 💧 แบบใจเย็น', { priority: 0.6 });
      }

      if (miss >= 18) {
        say('warn', 'end_miss', `MISS เยอะไปนิด (${miss})`, 'ลดการรัว เล็งค้าง 0.2 วิ แล้วค่อยยิง จะนิ่งขึ้น', { priority: 0.8 });
      } else if (acc >= 80) {
        say('cheer', 'end_acc', `ความแม่นยำดีมาก (${acc.toFixed(0)}%) ⚡`, 'รักษาคอมโบยาว ๆ แล้วคะแนนจะพุ่ง', { priority: 0.8 });
      }
    }catch(_){}
  }

  function coachUpdate(state = {}) {
    if (!S.enabled || !S.started) return;

    const t = now();
    const st = normalizeState(game, state);
    const prev = S.last;
    S.last = st;

    // adapt intensity slightly (not changing gameplay; only coach talk frequency selection)
    // Higher frustration -> more supportive, not more frequent.
    S.intensity = clamp01( 0.35 + (st.fatigue*0.10) + (st.frustration*0.18) - (st.skill*0.12) );

    // 1) Stage-based teaching (hydration-specific)
    if (game === 'hydration') {
      hydrationCoach(st, prev, t);
      return;
    }

    // 2) Generic fallback tips (for other games)
    genericCoach(st, prev, t);
  }

  // ------------ Hydration coach logic ------------
  function hydrationCoach(st, prev, t){
    // Stage detection by signals if provided
    // (hydration.safe.js emits stage on hha:score detail; but here we rely on state passed in)
    const stage = clampNum(st.stage || 1, 1, 3, 1);
    S.stage = stage;

    // A) First-time stage announcements (rare)
    if (!prev || stage !== prev.stage){
      if (stage === 1) {
        say('stage', 'stage1', `Stage 1: คุม GREEN ให้ได้ก่อน 💧`, 'ยิง 💧 จะค่อย ๆ ดึงกลับสมดุล', { stage });
      } else if (stage === 2) {
        say('stage', 'stage2', `Stage 2: ทำ Storm Mini ให้ผ่าน 🌀`, 'ต้อง LOW/HIGH + BLOCK ช่วงท้าย และห้ามโดน BAD', { stage });
      } else if (stage === 3) {
        say('stage', 'stage3', `Stage 3: Boss Window มาแล้ว 🌩️`, 'เก็บ 🛡️ ไว้ก่อนพายุ แล้ว BLOCK ให้ครบ', { stage });
      }
    }

    // B) In-storm guidance (high value)
    if (st.inStorm) {
      // Boss window: short, urgent, not spam
      if (st.inBossWindow && st.shield <= 0) {
        if (t - S.lastWarnAt > 6000) {
          S.lastWarnAt = t;
          say('warn', 'boss_no_shield', `บอสมา! แต่ 🛡️ หมด 😱`, 'ช่วงนี้ให้เลี่ยง 🥤/🌩️ ก่อน แล้วหาจังหวะเก็บ 🛡️', { urgent:true });
        }
      } else if (st.inBossWindow && st.shield > 0) {
        if (t - S.lastTeachAt > 6500) {
          S.lastTeachAt = t;
          say('tip', 'boss_block', `Boss Window! ใช้ 🛡️ BLOCK 🌩️`, 'บล็อกครบตามจำนวนจะเคลียร์ Stage 3', { urgent:true });
        }
      }

      // End window: remind block requirement
      if (st.inEndWindow && st.shield > 0) {
        if (t - S.lastTeachAt > 7000) {
          S.lastTeachAt = t;
          say('tip', 'endwindow_block', `ช่วงท้ายพายุ! บล็อกให้ได้ ✅`, 'ต้อง BLOCK ตอน End Window ถึงจะผ่าน Mini', { urgent:true });
        }
      } else if (st.inEndWindow && st.shield <= 0) {
        if (t - S.lastWarnAt > 7000) {
          S.lastWarnAt = t;
          say('warn', 'endwindow_no_shield', `End Window แต่ไม่มี 🛡️`, 'ก่อนพายุครั้งหน้า เก็บ 🛡️ ตุนไว้ 1–2 อัน', { urgent:true });
        }
      }

      // Water zone hint for mini: need LOW/HIGH (not GREEN)
      if (st.waterZone === 'GREEN' && stage >= 2) {
        if (t - S.lastTeachAt > 8000) {
          S.lastTeachAt = t;
          say('tip', 'mini_need_lowhigh', `Mini ต้องทำให้น้ำไม่ GREEN`, 'ปล่อยให้ LOW/HIGH นิดนึง แล้วค่อย BLOCK ช่วงท้าย', {});
        }
      }

      // Avoid BAD hits in storm
      if (prev && st.misses > prev.misses && st.inStorm) {
        if (t - S.lastWarnAt > 5500) {
          S.lastWarnAt = t;
          say('warn', 'storm_hit_bad', `โดน BAD ระวัง!`, 'ตอนพายุ ถ้าโดน BAD จะทำ Mini พลาดง่ายมาก', { urgent:true });
        }
      }

      return;
    }

    // C) Not in storm: prep tips (low frequency)
    // Encourage building shield before storm
    if (stage >= 2 && st.shield <= 0) {
      if (t - S.lastTeachAt > 11000) {
        S.lastTeachAt = t;
        say('tip', 'prep_shield', `เตรียม 🛡️ ไว้ก่อนพายุ`, 'พายุมาเมื่อไหร่ จะได้ BLOCK ช่วงท้ายได้ทันที', {});
      }
    }

    // D) Difficulty / fun / challenge cues (cheers)
    // Combo growth praise
    if (prev && st.combo > prev.combo && st.combo > 8 && (st.combo % 6 === 0)) {
      if (t - S.lastCheerAt > 9000) {
        S.lastCheerAt = t;
        say('cheer', 'combo_cheer', `คอมโบ ${st.combo} 🔥`, 'รักษาจังหวะเดิม แล้วคะแนนจะไหล', {});
      }
    }

    // If frustration high: calming guidance
    if (st.frustration >= 0.72) {
      if (t - S.lastTeachAt > 12000) {
        S.lastTeachAt = t;
        say('tip', 'calm_aim', `ใจเย็น ๆ เล็งก่อนยิง`, 'เล็งค้างนิดนึงแล้วค่อยยิง จะลด MISS ได้เยอะ', {});
      }
    }

    // If accuracy low but time is going: corrective but gentle
    if (st.skill <= 0.35 && st.fatigue >= 0.45) {
      if (t - S.lastTeachAt > 13000) {
        S.lastTeachAt = t;
        say('tip', 'low_acc_fix', `โฟกัสยิงเป้าที่ชัวร์`, 'เลือกยิงเป้าที่อยู่กลาง ๆ ก่อน จะคุม GREEN ง่ายขึ้น', {});
      }
    }

    // Stage1 reminder if still not green stable
    if (stage === 1 && st.waterZone !== 'GREEN') {
      if (t - S.lastTeachAt > 12000) {
        S.lastTeachAt = t;
        say('tip', 'stage1_green', `Stage1: พยายามกลับเข้า GREEN`, 'ยิง 💧 จะดึงกลับสมดุลได้เร็วขึ้น', {});
      }
    }
  }

  // ------------ Generic coach logic ------------
  function genericCoach(st, prev, t){
    if (st.frustration >= 0.75 && t - S.lastTeachAt > 12000) {
      S.lastTeachAt = t;
      say('tip', 'generic_calm', `ค่อย ๆ เล่นตามจังหวะ`, 'เล็งก่อนยิง/แตะ จะลดพลาดได้', {});
    }
    if (prev && st.combo > prev.combo && st.combo >= 10 && t - S.lastCheerAt > 10000) {
      S.lastCheerAt = t;
      say('cheer', 'generic_combo', `คอมโบกำลังมา! 🔥`, 'รักษาสมาธิ แล้วทำสถิติใหม่ได้', {});
    }
  }

  // ------------- utilities -------------
  function normalizeState(game, state){
    // Expect caller to send these fields (hydration.safe.js does)
    const out = {
      game,
      skill: clamp01(num(state.skill, 0.45)),
      fatigue: clamp01(num(state.fatigue, 0.0)),
      frustration: clamp01(num(state.frustration, 0.0)),
      combo: num(state.combo, 0)|0,
      misses: num(state.misses, 0)|0,

      inStorm: !!state.inStorm,
      inEndWindow: !!state.inEndWindow,

      waterZone: String(state.waterZone || '').toUpperCase(),
      shield: num(state.shield, 0)|0,

      stage: num(state.stage, 1)|0,

      // hydration extra (optional)
      inBossWindow: !!state.inBossWindow
    };
    return out;
  }

  // Public API
  return Object.freeze({
    enabled: S.enabled,
    onStart: coachStart,
    onUpdate: coachUpdate,
    onEnd: coachEnd,
    say: (type, key, text, why='', extra={}) => say(type, key, text, why, extra),
  });
}

// -------------------- helpers --------------------
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function num(v, d=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clampNum(v, a, b, d){
  const n = num(v, d);
  return (n < a) ? a : (n > b ? b : n);
}
function clamp01(v){ return clampNum(v, 0, 1, 0); }
function safeJSONStringify(obj){
  try{ return JSON.stringify(obj); }catch(_){ return ''; }
}
function introText(game){
  if (game === 'hydration') {
    return {
      text: `โค้ชมาแล้ว! 💧 คุม GREEN ก่อน แล้วค่อยผ่านพายุ + บอส`,
      why: `Stage1 คุมสมดุลน้ำ → Stage2 ทำ Mini (LOW/HIGH + BLOCK) → Stage3 Boss Window`
    };
  }
  return { text:`โค้ชมาแล้ว! เล่นตามจังหวะ เดี๋ยวมีทิปให้`, why:`จะเตือนเฉพาะตอนสำคัญ ไม่รัว` };
}