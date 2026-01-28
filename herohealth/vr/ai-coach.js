// === /herohealth/vr/ai-coach.js ===
// AI Coach (PRODUCTION) — lightweight, explainable, rate-limited
// ✅ Exports: createAICoach({ emit, game, cooldownMs })
// ✅ Methods: onStart(), onUpdate(ctx), onEnd(summary)
// ✅ Emits: hha:coach { type:'tip'|'status'|'end', key, msg, game }
//
// Design goals:
// - Helpful but not spammy (cooldown + dedupe by key)
// - Explainable micro-tips
// - No randomness (research-friendly; deterministic given ctx)

'use strict';

function clamp(v, a, b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 1200, 12000);

  const S = {
    lastAt: 0,
    lastKey: '',
    started: false,
    lastCtx: null,
    // soft state (for better hints)
    lastZone: '',
    lastStorm: false,
    lastEndWindow: false,
    lastShield: 0
  };

  function say(type, key, msg, force=false){
    const now = Date.now();
    if (!force){
      if (key && key === S.lastKey && (now - S.lastAt) < cooldownMs*1.6) return;
      if ((now - S.lastAt) < cooldownMs) return;
    }
    S.lastAt = now;
    S.lastKey = key || '';
    emit('hha:coach', { type, key, msg, game });
  }

  function onStart(){
    S.started = true;
    S.lastAt = 0;
    S.lastKey = '';
    say('status', 'start', 'เริ่มเลย! ยิง 💧 เพื่อคุมน้ำให้อยู่ GREEN และเก็บ 🛡️ ไว้กันพายุ', true);
  }

  function onUpdate(ctx={}){
    if (!S.started) return;

    const c = ctx || {};
    const skill = clamp(c.skill ?? 0.4, 0, 1);
    const fatigue = clamp(c.fatigue ?? 0, 0, 1);
    const frustration = clamp(c.frustration ?? 0, 0, 1);

    const inStorm = !!c.inStorm;
    const inEndWindow = !!c.inEndWindow;
    const zone = String(c.waterZone || '');
    const shield = (c.shield|0);
    const misses = (c.misses|0);
    const combo = (c.combo|0);

    // transitions
    const zoneChanged = (zone && zone !== S.lastZone);
    const stormChanged = (inStorm !== S.lastStorm);
    const endChanged = (inEndWindow !== S.lastEndWindow);
    const shieldChanged = (shield !== S.lastShield);

    // KEY: storm coaching
    if (stormChanged && inStorm){
      if (shield <= 0){
        say('tip', 'storm_noshield', 'พายุมาแล้ว! ตอนนี้ยังไม่มี 🛡️ — รีบเก็บ 🛡️ ก่อน แล้วค่อยไป BLOCK ช่วงท้าย', false);
      } else {
        say('tip', 'storm_ready', 'พายุมา! เตรียมคุมโซนให้ถูกฝั่ง (LOW/HIGH) และ “เก็บ 🛡️ ไว้ใช้ตอน End Window”', false);
      }
    }

    if (endChanged && inEndWindow){
      if (shield > 0){
        say('tip', 'endwindow_block', 'End Window มาแล้ว! ตอนนี้ให้ BLOCK 🌩️/🥤 ด้วย 🛡️ เพื่อผ่าน Mini', false);
      } else {
        say('tip', 'endwindow_needshield', 'End Window มาแล้ว แต่ไม่มี 🛡️ — รอบหน้าเก็บ 🛡️ ไว้ก่อนพายุ!', false);
      }
    }

    // KEY: water zone guidance
    if (!inStorm){
      if (zoneChanged && zone === 'LOW'){
        say('tip', 'zone_low', 'น้ำ LOW — ยิง 💧 เพิ่มเพื่อดันกลับเข้า GREEN', false);
      } else if (zoneChanged && zone === 'HIGH'){
        say('tip', 'zone_high', 'น้ำ HIGH — ระวัง! ลดการพลาด และอย่ายิงมั่ว จะหลุด GREEN ง่าย', false);
      } else if (zoneChanged && zone === 'GREEN'){
        say('status', 'zone_green', 'ดีมาก! ตอนนี้อยู่ GREEN — รักษาไว้ให้นานที่สุด', false);
      }
    }

    // KEY: accuracy / pacing
    if (frustration > 0.72 || misses >= 18){
      say('tip', 'calm', 'MISS เริ่มเยอะแล้ว: “ชะลอการรัว” เล็งให้นิ่งแล้วค่อยยิง จะคุม GREEN ง่ายขึ้น', false);
    } else if (skill > 0.70 && combo >= 10){
      say('status', 'combo', 'คอมโบกำลังดีมาก! รักษาจังหวะต่อเนื่อง เกรดจะพุ่ง', false);
    }

    // KEY: shield hint
    if (shieldChanged && shield > 0 && !inStorm){
      say('status', 'got_shield', 'ได้ 🛡️ แล้ว! เก็บไว้ใช้ช่วงท้ายพายุ (End Window) เพื่อ BLOCK', false);
    }

    // KEY: fatigue
    if (fatigue > 0.78){
      say('tip', 'fatigue', 'ใกล้จบแล้ว! โฟกัส “ยิงให้ชัวร์” มากกว่ารัว คะแนนจะนิ่งขึ้น', false);
    }

    S.lastCtx = c;
    S.lastZone = zone;
    S.lastStorm = inStorm;
    S.lastEndWindow = inEndWindow;
    S.lastShield = shield;
  }

  function onEnd(summary={}){
    const grade = String(summary.grade || 'C');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = (summary.misses|0);
    const minis = (summary.stormSuccess|0);

    let msg = `จบเกม! เกรด ${grade} • Accuracy ${acc.toFixed(0)}% • MISS ${miss}`;
    if (minis <= 0) msg += ' • รอบหน้าลองผ่าน Storm Mini ให้ได้ 1 ครั้งนะ';
    else msg += ` • ผ่าน Mini ${minis} ครั้ง เยี่ยม`;

    say('end', 'end', msg, true);
  }

  return { onStart, onUpdate, onEnd };
}