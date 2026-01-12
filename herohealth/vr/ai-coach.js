// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (micro-tips, explainable, rate-limited)
// ✅ API: createAICoach({ emit, game, cooldownMs })
//    -> { onStart(), onUpdate(state), onEnd(summary), say(kind,msg,why?) }
// ✅ Emits: hha:coach { game, kind, msg, why, severity, ts }
// ✅ Safe default (no external calls). Works for all games.
//
// State fields (suggested):
//  - skill [0..1], fatigue [0..1], frustration [0..1]
//  - inStorm bool, inEndWindow bool
//  - waterZone 'GREEN'|'LOW'|'HIGH' (hydration)
//  - shield number, misses number, combo number
//
// Notes:
// - This is NOT a model. It’s a deterministic rule-based coach hook that you can later swap with AI.

'use strict';

export function createAICoach(opts = {}) {
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {} };

  const game = String(opts.game || 'game').toLowerCase();
  const cooldownMs = Math.max(900, Number(opts.cooldownMs || 3000));

  const S = {
    started: false,
    lastSayAt: 0,
    lastKind: '',
    lastMsg: '',
    lastStateAt: 0,

    // memory for “don’t spam same advice”
    seen: Object.create(null),

    // track streak-ish
    lastMisses: 0,
    lastCombo: 0,
    lastZone: '',
    stormWasOn: false,
    bossWasOn: false,
    endWasOn: false
  };

  const now = () => Date.now();

  function clamp(v, a, b) {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }

  function keyFor(kind, msg) {
    return `${kind}::${msg}`;
  }

  function canSay(kind, msg) {
    const t = now();
    if (!S.started) return false;
    if (t - S.lastSayAt < cooldownMs) return false;

    // avoid exact repeats
    if (msg && msg === S.lastMsg) return false;

    // avoid repeating same tip too frequently
    const k = keyFor(kind, msg);
    const last = S.seen[k] || 0;
    if (t - last < Math.max(8000, cooldownMs * 2.2)) return false;

    return true;
  }

  function say(kind, msg, why = '', severity = 0.5) {
    kind = String(kind || 'tip');
    msg = String(msg || '').trim();
    if (!msg) return false;

    if (!canSay(kind, msg)) return false;

    const payload = {
      game,
      kind,
      msg,
      why: String(why || ''),
      severity: clamp(severity, 0, 1),
      ts: now()
    };

    S.lastSayAt = payload.ts;
    S.lastKind = kind;
    S.lastMsg = msg;
    S.seen[keyFor(kind, msg)] = payload.ts;

    emit('hha:coach', payload);
    return true;
  }

  function explain(whyArr) {
    // keep explain short but meaningful
    return (whyArr || []).filter(Boolean).slice(0, 3).join(' • ');
  }

  function onStart() {
    S.started = true;
    S.lastSayAt = 0;
    S.lastKind = '';
    S.lastMsg = '';
    S.lastStateAt = 0;

    S.seen = Object.create(null);
    S.lastMisses = 0;
    S.lastCombo = 0;
    S.lastZone = '';
    S.stormWasOn = false;
    S.bossWasOn = false;
    S.endWasOn = false;

    // gentle kickoff tip (won’t fire if game immediately spams)
    say('start', 'โฟกัส “คอมโบ” ก่อน แล้วค่อยเพิ่มความแม่นยำ ✨', 'เริ่มเกม: สร้างจังหวะการยิงให้คงที่', 0.35);
  }

  function onUpdate(st = {}) {
    if (!S.started) return;

    const t = now();
    // do not evaluate too frequently
    if (t - S.lastStateAt < 380) return;
    S.lastStateAt = t;

    const skill = clamp(st.skill, 0, 1);
    const fatigue = clamp(st.fatigue, 0, 1);
    const frustration = clamp(st.frustration, 0, 1);

    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;

    const waterZone = String(st.waterZone || '');
    const shield = Number(st.shield || 0) || 0;
    const misses = Number(st.misses || 0) || 0;
    const combo = Number(st.combo || 0) || 0;

    const whyBase = [];

    // --- detect transitions (these are prime moments for tips) ---
    const stormStart = inStorm && !S.stormWasOn;
    const stormEnd = !inStorm && S.stormWasOn;
    const endStart = inEnd && !S.endWasOn;
    const endEnd = !inEnd && S.endWasOn;

    S.stormWasOn = inStorm;
    S.endWasOn = inEnd;

    // --- hydration specific: zone guidance ---
    const zoneChanged = waterZone && (waterZone !== S.lastZone);
    if (zoneChanged) {
      S.lastZone = waterZone;
      if (waterZone === 'GREEN') {
        say('zone', 'ตอนนี้น้ำอยู่ GREEN ✅ ลากคอมโบยาว ๆ ได้เลย', 'Zone=GREEN: ปลอดภัยสำหรับสะสม Stage1', 0.25);
      } else if (waterZone === 'LOW') {
        say('zone', 'น้ำ LOW 🟦 ยิง 💧 เพิ่มเพื่อดันกลับ GREEN', 'Zone=LOW: ต้องเติมน้ำกลับสมดุล', 0.45);
      } else if (waterZone === 'HIGH') {
        say('zone', 'น้ำ HIGH 🟧 ระวัง! หยุดรัว แล้วเล็งให้ชัวร์', 'Zone=HIGH: คุมจังหวะ ลดความผิดพลาด', 0.55);
      }
    }

    // --- storm cues ---
    if (stormStart) {
      say(
        'storm',
        'STORM มาแล้ว! เป้าหมายคือ “LOW/HIGH + เก็บ 🛡️”',
        'Storm เริ่ม: เตรียมทำ Mini ให้ผ่าน',
        0.75
      );
    }

    // end window is most important cue
    if (endStart) {
      const w = [];
      if (shield <= 0) w.push('ไม่มี 🛡️');
      if (waterZone === 'GREEN') w.push('ยัง GREEN');
      const msg =
        (shield > 0)
          ? 'END WINDOW! ตอนนี้ต้อง “BLOCK” ให้ได้ 🛡️⚡'
          : 'END WINDOW! รีบหา 🛡️ แล้ว BLOCK (ถ้าโดน BAD จะพัง Mini)';
      say('end-window', msg, explain([
        'End Window = ช่วงตัดสิน Mini',
        shield > 0 ? 'มี Shield พร้อม Block' : 'ต้องมี Shield เพื่อ Block',
        waterZone === 'GREEN' ? 'Mini ต้อง LOW/HIGH ไม่ใช่ GREEN' : 'Zone OK'
      ]), 0.95);
    }

    // --- performance coaching ---
    const missJump = (misses - S.lastMisses) >= 3; // spike
    const comboDrop = (S.lastCombo >= 6 && combo <= 1);

    if (missJump || comboDrop) {
      const w = [];
      if (missJump) w.push(`MISS เพิ่ม +${misses - S.lastMisses}`);
      if (comboDrop) w.push('คอมโบหลุด');
      if (frustration >= 0.6) w.push('เริ่มหงุดหงิด');

      // priority: calm & aim
      say(
        'coach',
        'ชะลอมือ 0.5 วิ แล้วค่อยยิง—เลือกเป้าที่ชัวร์ก่อน 🎯',
        explain(w),
        0.65
      );
    }

    // encourage when doing well
    if (combo >= 10 && (combo - S.lastCombo) >= 3) {
      say(
        'praise',
        `คอมโบมาแล้ว ${combo} 🔥 รักษาจังหวะต่อ!`,
        explain(['คอมโบสูง', `skill≈${skill.toFixed(2)}`]),
        0.35
      );
    }

    // shield hint
    if (inStorm && shield === 0) {
      say(
        'shield',
        'ในพายุให้ “โฟกัส 🛡️ ก่อน” แล้วค่อยจัดเป้าอื่น',
        'Storm: Shield คือกุญแจผ่าน Mini/Boss',
        0.70
      );
    }

    // fatigue pacing
    if (fatigue >= 0.75) {
      say(
        'pace',
        'ใกล้จบแล้ว! ลดการรัว—เล็งให้ชัวร์ เกรดจะดีขึ้น 💪',
        explain(['fatigue สูง', 'เน้นคุณภาพมากกว่าปริมาณ']),
        0.45
      );
    }

    // update memory
    S.lastMisses = misses;
    S.lastCombo = combo;

    // storm end recap (low priority)
    if (stormEnd) {
      say('storm', 'พายุจบ! กลับไปคุม GREEN ต่อ แล้วเตรียมพายุถัดไป', 'Storm จบ: กลับสู่ Stage1/สะสม', 0.30);
    }

    // end window leave (low)
    if (endEnd) {
      // intentionally minimal
    }
  }

  function onEnd(summary = {}) {
    if (!S.started) return;
    S.started = false;

    const grade = String(summary.grade || '').toUpperCase();
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stage = Number(summary.stageCleared || 0);

    const w = [];
    if (grade) w.push(`Grade ${grade}`);
    if (!Number.isNaN(acc)) w.push(`Acc ${acc.toFixed(0)}%`);
    w.push(`Miss ${miss|0}`);
    w.push(`Stage ${stage|0}`);

    let msg = 'จบเกมแล้ว! ลองอีกครั้งเพื่อดัน Stage และเกรดให้สูงขึ้น ✨';
    if (stage >= 3) msg = 'สุดยอด! เคลียร์ครบ 3 Stage แล้ว 🏆';
    else if (stage === 2) msg = 'ดีมาก! เหลืออีกนิดเดียว—ไปเคลียร์ BOSS ให้ได้ 🌩️';
    else if (stage === 1) msg = 'ผ่าน Stage1 แล้ว! ต่อไปโฟกัส Storm Mini ให้ผ่าน 1 พายุ 🌀';

    say('end', msg, explain(w), 0.55);
  }

  return { onStart, onUpdate, onEnd, say };
}