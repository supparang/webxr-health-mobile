// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// Export: createAICoach({ emit, game, cooldownMs })
// ✅ Emits: hha:coach { game, type, text, level, tag, ts }
// ✅ Safe: no external deps, no network, deterministic-friendly
// ✅ Rate limit: cooldownMs (default 3000)
// ✅ Designed for kids: short, positive, actionable

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function pickOne(arr, k=0.5){
  if (!Array.isArray(arr) || !arr.length) return null;
  const i = Math.floor(clamp(k,0,0.9999) * arr.length);
  return arr[i] || arr[0];
}

function fmtZone(z){
  const Z = String(z||'').toUpperCase();
  if (Z==='GREEN') return 'GREEN (พอดี)';
  if (Z==='LOW') return 'LOW (น้อยไป)';
  if (Z==='HIGH') return 'HIGH (มากไป)';
  return Z || '—';
}

function mkTips(game){
  // You can extend per-game later; keep hydration tuned now.
  const base = {
    warm: [
      'เริ่มเลย! เล็งช้า ๆ แต่ชัวร์ 😊',
      'โฟกัสทีละเป้า คอมโบจะยาวขึ้น!',
      'อย่ารัวมั่ว ๆ เลือกยิงที่โดนแน่ ๆ'
    ],
    goodAim: [
      'เล็งดีมาก! ลากคอมโบยาว ๆ ได้เลย ⚡',
      'Accuracy สวย! อีกนิดเกรดขึ้นแน่',
      'จังหวะยิงนิ่งมาก เก่ง!'
    ],
    lowAcc: [
      'ลอง “เล็งค้าง 0.2 วิ” แล้วค่อยยิง 🎯',
      'ช้าลงนิดนึง จะโดนง่ายขึ้น',
      'เลือกยิงเป้าใกล้กลางจอก่อน'
    ],
    manyMiss: [
      'MISS เยอะไปนิด—ลดการรัว แล้วค่อย ๆ ยิง',
      'พักหายใจ แล้วเลือกยิงเป้าที่ชัวร์',
      'โฟกัสความแม่นก่อน คะแนนจะพุ่งเอง'
    ],
    stormPrep: [
      'พายุใกล้มาแล้ว! เก็บ 🛡️ ไว้ก่อนนะ',
      'เตรียมทำ Storm Mini: ต้อง LOW/HIGH + BLOCK ช่วงท้าย',
      'อย่าลืม: ช่วง End Window ต้อง BLOCK ให้ได้!'
    ],
    endWindow: [
      'ตอนนี้คือ End Window! ใช้ 🛡️ BLOCK เลย! 🛡️',
      'สั่น ๆ แบบนี้คือช่วงทอง—BLOCK ให้ทัน!',
      'End Window มาแล้ว ยิง/แตะให้ BLOCK!'
    ],
    bossWindow: [
      'BOSS WINDOW! 🌩️ โผล่ถี่ขึ้น—BLOCK ให้ครบ!',
      'ตอนนี้ต้องกัน 🌩️ ให้ได้! ใช้ 🛡️',
      'อย่าพลาด! BLOCK 🌩️ ครบแล้วได้โบนัสใหญ่'
    ],
    zoneGreen: [
      'ตอนนี้น้ำอยู่ GREEN ดีมาก! รักษาไว้',
      'GREEN กำลังดี—คุมให้นาน ๆ',
    ],
    zoneNotGreen: [
      'ตอนนี้น้ำไม่ GREEN แล้ว—ดีสำหรับผ่าน Mini ในพายุ!',
      'LOW/HIGH ตรงนี้แหละ ใช้ทำ Mini ได้เลย'
    ]
  };

  if (String(game||'').toLowerCase()==='hydration') return base;
  return base; // default
}

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3000, 600, 20000);

  const TIPS = mkTips(game);

  const state = {
    started:false,
    ended:false,
    lastEmitAt: -1e9,
    lastTag: '',
    // internal memory (lightweight)
    last: {
      skill:0.5,
      frustration:0,
      fatigue:0,
      misses:0,
      combo:0,
      inStorm:false,
      inEndWindow:false,
      waterZone:'',
      shield:0
    },
    // hysteresis
    seenStorm:false,
    seenEndWindow:false,
    seenBoss:false
  };

  function canEmit(tag){
    const t = nowMs();
    if (t - state.lastEmitAt < cooldownMs) return false;
    if (tag && tag === state.lastTag) return false; // avoid repeating exact same tag back-to-back
    return true;
  }

  function push(tag, text, extra={}){
    if (!text) return false;
    if (!canEmit(tag)) return false;

    state.lastEmitAt = nowMs();
    state.lastTag = tag || '';

    emit('hha:coach', {
      game,
      type:'tip',
      tag: tag || '',
      level: extra.level || 'info',
      text,
      ts: Date.now(),
      ...extra
    });
    return true;
  }

  function chooseSkillTip(k){
    // k ~ 0..1
    if (k >= 0.78) return pickOne(TIPS.goodAim, k);
    if (k <= 0.46) return pickOne(TIPS.lowAcc, 1-k);
    return null;
  }

  function chooseMissTip(frustration){
    // frustration ~ 0..1
    if (frustration >= 0.62) return pickOne(TIPS.manyMiss, frustration);
    return null;
  }

  function chooseZoneTip(z){
    const Z = String(z||'').toUpperCase();
    if (Z === 'GREEN') return pickOne(TIPS.zoneGreen, 0.5);
    if (Z) return pickOne(TIPS.zoneNotGreen, 0.5);
    return null;
  }

  return {
    onStart(){
      if (state.started) return;
      state.started = true;
      state.ended = false;
      // greet once
      push('warm', pickOne(TIPS.warm, 0.5), { level:'info' });
    },

    onUpdate(ctx={}){
      if (!state.started || state.ended) return;

      // normalize ctx
      const skill = clamp(ctx.skill ?? state.last.skill, 0, 1);
      const fatigue = clamp(ctx.fatigue ?? state.last.fatigue, 0, 1);
      const frustration = clamp(ctx.frustration ?? state.last.frustration, 0, 1);
      const inStorm = !!ctx.inStorm;
      const inEndWindow = !!ctx.inEndWindow;
      const waterZone = String(ctx.waterZone ?? state.last.waterZone || '');
      const shield = clamp(ctx.shield ?? state.last.shield, 0, 99);
      const misses = clamp(ctx.misses ?? state.last.misses, 0, 9999);
      const combo = clamp(ctx.combo ?? state.last.combo, 0, 9999);

      // store last
      state.last = { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo };

      // 1) High-priority situational tips
      if (inStorm && !state.seenStorm){
        state.seenStorm = true;
        // Prep tip (first storm encounter)
        push('storm-prep', pickOne(TIPS.stormPrep, 0.5), { level:'warn' });
        return;
      }

      if (inEndWindow){
        state.seenEndWindow = true;
        // End window: urge to block
        push('end-window', pickOne(TIPS.endWindow, 0.6), { level:'urgent' , meta:{ shield, zone: fmtZone(waterZone) }});
        return;
      }

      // Boss window (best-effort: ctx may pass it later; for now infer by "inStorm && shield low && skill ok")
      if (inStorm && shield > 0 && skill >= 0.55 && frustration <= 0.75){
        // occasional boss-like encouragement (not too spammy)
        push('boss-window', pickOne(TIPS.bossWindow, skill), { level:'warn' });
        // do not return; allow other tips later
      }

      // 2) Coaching based on performance (soft)
      // If misses just jumped a lot -> supportive tip
      const missDelta = misses - (state._prevMisses||0);
      state._prevMisses = misses;

      if (missDelta >= 6){
        const t = chooseMissTip(frustration) || pickOne(TIPS.manyMiss, 0.5);
        push('many-miss', t, { level:'warn' });
        return;
      }

      // If combo is high -> praise
      if (combo >= 14 && skill >= 0.65){
        push('good-aim', pickOne(TIPS.goodAim, skill), { level:'good' });
        return;
      }

      // If skill is low -> aim tip
      const sTip = chooseSkillTip(skill);
      if (sTip){
        push('skill', sTip, { level:'info' });
        return;
      }

      // 3) Hydration-specific: zone hint (sparingly)
      // only if fatigue not too high (avoid noisy tips near end)
      if (fatigue <= 0.82){
        const zTip = chooseZoneTip(waterZone);
        if (zTip) push('zone', zTip, { level:'info', meta:{ zone: fmtZone(waterZone) }});
      }
    },

    onEnd(summary={}){
      if (state.ended) return;
      state.ended = true;

      // gentle wrap-up
      const grade = String(summary.grade||'').toUpperCase() || '—';
      const msg =
        (grade==='SSS' || grade==='SS') ? 'โหดมาก! เกรดแรงสุด ๆ 🔥 ลองเพิ่มคอมโบให้ยาวอีกนิด!' :
        (grade==='S' || grade==='A') ? 'เยี่ยม! อีกนิดเดียวเกรดจะพุ่งขึ้นอีก 🚀' :
        'ไม่เป็นไร รอบหน้าทำได้! โฟกัส “เล็งช้าแต่ชัวร์” แล้วคอมโบจะมาเอง 😊';

      push('end', msg, { level:'info', type:'end' });
    }
  };
}