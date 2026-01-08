// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach (V2) — PRODUCTION
// ✅ Explainable micro-tips (ไม่มั่ว, อิงสถานะเกมจริง)
// ✅ Rate-limit + anti-spam + “only when helpful”
// ✅ Works across games (stage/quests optional)
// ✅ Emits: hha:coach { type, msg, why[], prio, at, game }
//
// Usage:
//   import { createAICoach } from '../vr/ai-coach.js';
//   const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
//   AICOACH.onStart(); AICOACH.onUpdate(ctx); AICOACH.onEnd(summary);

'use strict';

export function createAICoach(opts = {}) {
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){} };

  const game = String(opts.game || 'game').toLowerCase();
  const cooldownMs = Math.max(900, Number(opts.cooldownMs || 2800));
  const minGapSameKeyMs = Math.max(2000, Number(opts.minGapSameKeyMs || 8000));

  const S = {
    startedAt: 0,
    lastEmitAt: 0,
    lastKeyAt: Object.create(null),
    lastCtxAt: 0,
    lastStage: null,
    lastStorm: false,
    lastBoss: false,
    lastEndWindow: false,
    lastWaterZone: '',
    softSilenceUntil: 0
  };

  function now() { return Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(v){ return clamp(v,0,1); }

  function canSpeak(key, prio = 1) {
    const t = now();
    if (t < S.softSilenceUntil && prio <= 1) return false;
    if (t - S.lastEmitAt < cooldownMs && prio <= 1) return false;
    const lastK = S.lastKeyAt[key] || 0;
    if (t - lastK < minGapSameKeyMs) return false;
    return true;
  }

  function say(key, msg, why = [], prio = 1, type = 'tip') {
    if (!canSpeak(key, prio)) return false;
    const t = now();
    S.lastEmitAt = t;
    S.lastKeyAt[key] = t;

    emit('hha:coach', {
      type,
      msg: String(msg || ''),
      why: Array.isArray(why) ? why.slice(0, 6).map(String) : [],
      prio: prio | 0,
      at: t,
      game
    });
    return true;
  }

  // --------- game-agnostic helpers ----------
  function perfBand(ctx){
    const skill = pct(ctx.skill);
    const fr = pct(ctx.frustration);
    const ft = pct(ctx.fatigue);
    if (skill >= 0.78 && fr <= 0.45) return 'hot';
    if (skill <= 0.42 && fr >= 0.55) return 'struggle';
    if (ft >= 0.85) return 'tired';
    return 'ok';
  }

  // --------- Hydration brain (stage-aware) ----------
  function hydrationTips(ctx){
    const tips = [];

    const stage = Number(ctx.stage || 0) || 0;
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const inBoss = !!ctx.inBoss;

    const waterZone = String(ctx.waterZone || '');
    const shield = Number(ctx.shield || 0) | 0;
    const misses = Number(ctx.misses || 0) | 0;
    const combo = Number(ctx.combo || 0) | 0;

    const greenHoldSec = Number(ctx.greenHoldSec || 0);
    const greenTargetSec = Math.max(1, Number(ctx.greenTargetSec || 0) || 0);

    const stormCycles = Number(ctx.stormCycles || 0) | 0;
    const stormSuccess = Number(ctx.stormSuccess || 0) | 0;
    const bossClearCount = Number(ctx.bossClearCount || 0) | 0;

    // Stage transition callout (พูดครั้งเดียวตอนเปลี่ยน)
    if (stage && stage !== S.lastStage) {
      tips.push({
        key: `stage_${stage}`,
        prio: 2,
        msg:
          stage === 1 ? 'Stage 1: คุมให้น้ำอยู่ GREEN ให้ครบเวลา ✅' :
          stage === 2 ? 'Stage 2: รอ STORM แล้วทำ Mini: ต้องเป็น LOW/HIGH + BLOCK ช่วงท้าย ⚡' :
          'Stage 3: Boss Window! ต้องมี 🛡️ แล้ว BLOCK 🌩️ ให้ครบ 👑',
        why: [
          `stage=${stage}`,
          stage === 1 ? 'โฟกัสสมดุลน้ำ' :
          stage === 2 ? 'Mini สำคัญ: LOW/HIGH + End Window' :
          'Boss Clear = จบภารกิจ'
        ]
      });
    }

    // Stage 1 progress nudges
    if (stage === 1) {
      const p = greenHoldSec / greenTargetSec;
      if (p < 0.25 && misses >= 6) {
        tips.push({
          key: 's1_slow_down',
          prio: 1,
          msg: 'Stage 1: อย่ารัว! เล็งชัวร์ก่อนยิง 💧 แล้วคุม GREEN ให้นิ่ง ๆ',
          why: [`GREEN ${(greenHoldSec).toFixed(1)}/${greenTargetSec}s`, `miss=${misses}`]
        });
      }
      if (p >= 0.6 && shield <= 0) {
        tips.push({
          key: 's1_collect_shield',
          prio: 1,
          msg: 'ใกล้ผ่าน Stage 1 แล้ว! เก็บ 🛡️ ตุนไว้ทำ STORM ต่อเลย',
          why: [`GREEN ${(p*100).toFixed(0)}%`, `shield=${shield}`]
        });
      }
    }

    // STORM cues
    if (inStorm && !S.lastStorm) {
      tips.push({
        key: 'storm_start',
        prio: 2,
        msg: 'STORM มาแล้ว! ต้องทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) แล้วเตรียม BLOCK ช่วงท้าย ⚡',
        why: [`zone=${waterZone}`, `shield=${shield}`]
      });
    }

    // During storm: if still GREEN, push advice
    if (inStorm && waterZone === 'GREEN') {
      tips.push({
        key: 'storm_leave_green',
        prio: 2,
        msg: 'ตอน STORM ห้ามอยู่ GREEN! โดน BAD บ้าง/ปล่อยสมดุลให้ LOW/HIGH แล้วค่อย BLOCK ท้ายพายุ',
        why: [`zone=${waterZone}`, `EndWindow=${inEnd?'YES':'no'}`]
      });
    }

    // End window: urgent block
    if (inStorm && inEnd) {
      if (shield <= 0) {
        tips.push({
          key: 'end_no_shield',
          prio: 3,
          msg: 'End Window แล้วแต่ไม่มี 🛡️! โฟกัสยิงเป้าชัวร์ + หลีก BAD ให้รอดก่อน',
          why: ['End Window=YES', `shield=${shield}`]
        });
      } else {
        tips.push({
          key: 'end_block_now',
          prio: 3,
          msg: 'End Window! ตอนนี้แหละ “BLOCK” ให้ติด ✅',
          why: ['End Window=YES', `shield=${shield}`]
        });
      }
    }

    // Boss window cues
    if (inBoss && !S.lastBoss) {
      tips.push({
        key: 'boss_enter',
        prio: 3,
        msg: 'Boss Window! 🌩️ โผล่ถี่ขึ้น—ใช้ 🛡️ BLOCK ให้ครบ แล้วจะเคลียร์ Stage 3 👑',
        why: [`shield=${shield}`, `bossClear=${bossClearCount}`]
      });
    }

    // If player struggling
    const band = perfBand(ctx);
    if (band === 'struggle') {
      tips.push({
        key: 'struggle_focus',
        prio: 1,
        msg: 'ทริค: เลือกยิง “เป้ากลาง ๆ” ก่อน อย่าปาดไกล ลด MISS แล้วคอมโบจะกลับมาเอง',
        why: [`skill≈${(ctx.skill||0).toFixed(2)}`, `frustration≈${(ctx.frustration||0).toFixed(2)}`]
      });
    }
    if (band === 'tired') {
      tips.push({
        key: 'tired_breathe',
        prio: 1,
        msg: 'เหนื่อยแล้ว: ช้าลงนิดนึง หายใจ แล้วค่อยยิงทีละเป้า 🎯',
        why: [`fatigue≈${(ctx.fatigue||0).toFixed(2)}`]
      });
    }

    // Positive reinforcement
    if (combo >= 14 && misses <= 6) {
      tips.push({
        key: 'good_combo',
        prio: 1,
        msg: 'คอมโบสวยมาก! 🔥 รักษาจังหวะเดิม เกรดจะไต่ขึ้นเร็ว',
        why: [`combo=${combo}`, `miss=${misses}`]
      });
    }

    // If never passed storm yet
    if (stormCycles >= 1 && stormSuccess <= 0 && !inStorm) {
      tips.push({
        key: 'storm_fail_hint',
        prio: 1,
        msg: 'ยังไม่ผ่าน Mini: ตอน STORM ต้องเป็น LOW/HIGH + ช่วงท้ายต้อง BLOCK และ “ห้ามโดน BAD”',
        why: [`stormSuccess=${stormSuccess}/${stormCycles}`]
      });
    }

    return tips;
  }

  function onUpdate(ctx = {}) {
    const t = now();
    if (t - S.lastCtxAt < 180) return; // กันเรียกถี่เกิน
    S.lastCtxAt = t;

    // Track transitions
    const stage = Number(ctx.stage || 0) || 0;
    const inStorm = !!ctx.inStorm;
    const inBoss = !!ctx.inBoss;
    const inEnd = !!ctx.inEndWindow;
    const waterZone = String(ctx.waterZone || '');

    const tips = (game === 'hydration')
      ? hydrationTips(ctx)
      : []; // เกมอื่นจะค่อยเติมทีละเกมภายหลังได้

    // pick “best” tip: highest prio first, then newest key
    tips.sort((a,b)=> (b.prio|0)-(a.prio|0));

    for (const tip of tips) {
      if (say(tip.key, tip.msg, tip.why, tip.prio, 'tip')) break;
    }

    S.lastStage = stage || S.lastStage;
    S.lastStorm = inStorm;
    S.lastBoss = inBoss;
    S.lastEndWindow = inEnd;
    S.lastWaterZone = waterZone || S.lastWaterZone;
  }

  function onStart() {
    S.startedAt = now();
    S.lastEmitAt = 0;
    S.lastKeyAt = Object.create(null);
    S.lastCtxAt = 0;
    S.lastStage = null;
    S.lastStorm = false;
    S.lastBoss = false;
    S.lastEndWindow = false;
    S.lastWaterZone = '';
    S.softSilenceUntil = now() + 900; // กันพูดทันทีตอนเปิด
    say('start', 'พร้อมแล้ว! โฟกัสเป้าชัวร์ ๆ แล้วลากคอมโบ 🔥', ['start'], 1, 'start');
  }

  function onEnd(summary = {}) {
    const grade = String(summary.grade || '');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stageCleared = Number(summary.stageCleared || 0) | 0;

    const why = [
      `grade=${grade||'-'}`,
      `acc=${acc.toFixed(1)}%`,
      `miss=${miss}`,
      `stageCleared=${stageCleared}`
    ];

    say('end', `จบแล้ว! ได้ ${grade||'—'} • Accuracy ${acc.toFixed(1)}% • Miss ${miss}`, why, 2, 'end');
  }

  return { onStart, onUpdate, onEnd };
}