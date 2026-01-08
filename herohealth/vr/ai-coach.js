// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (explainable micro-tips + rate-limit)
// ✅ createAICoach({emit, game, cooldownMs})
// ✅ onStart / onUpdate / onEnd
// Notes: This is "light AI" (no network). Uses heuristics for tips.

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs || 3000, 800, 15000);

  const S = {
    lastAt: 0,
    lastKey: '',
    started: false,
    ended: false,
    ticks: 0
  };

  function say(key, msg, meta={}){
    const now = Date.now();
    if (S.ended) return;
    if (now - S.lastAt < cooldownMs) return;
    if (key && key === S.lastKey) return;

    S.lastAt = now;
    S.lastKey = key || '';

    emit('hha:coach', {
      game,
      key,
      msg,
      ...meta
    });
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    say('start', 'เริ่มเลย! 🎯 โฟกัส Accuracy ก่อน แล้วค่อยลากคอมโบ', { level:'info' });
  }

  function onUpdate(st){
    if (!S.started || S.ended) return;
    if (!st) return;
    S.ticks++;

    // sample every ~1s-ish (caller may call every frame)
    if ((S.ticks % 45) !== 0) return;

    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frus = clamp(st.frustration ?? 0, 0, 1);
    const inStorm = !!st.inStorm;
    const inEndWindow = !!st.inEndWindow;
    const zone = String(st.waterZone || '');
    const shield = (st.shield|0);
    const miss = (st.misses|0);
    const combo = (st.combo|0);

    // Priority tips
    if (inStorm && inEndWindow){
      if (shield <= 0){
        say('storm_end_need_shield', '⏱️ ช่วงท้ายพายุแล้ว! ถ้ามี 🛡️ จะ BLOCK ได้ปลอดภัยกว่า', { level:'warn' });
        return;
      }
      if (zone === 'GREEN'){
        say('storm_end_leave_green', '⚡ Storm Mini: ตอนนี้ต้อง “ออกจาก GREEN” (ไป LOW/HIGH) แล้วค่อย BLOCK ช่วงท้าย', { level:'warn' });
        return;
      }
      say('storm_end_block', '✅ ดีมาก! ตอนท้ายพายุ “BLOCK ให้ครบ” แล้วอย่าโดน BAD', { level:'good' });
      return;
    }

    if (inStorm && zone === 'GREEN'){
      say('storm_leave_green', '🌀 เข้า Storm แล้ว: เป้าหมายคือ LOW/HIGH (อย่าอยู่ GREEN)', { level:'info' });
      return;
    }

    if (frus > 0.65 || miss >= 12){
      say('frustration', 'ลดการรัวนะ 🙂 เล็งค้างนิดนึงแล้วค่อยยิง จะลด MISS ได้เยอะ', { level:'info' });
      return;
    }

    if (skill < 0.35){
      say('skill_low', 'ทิป: เล็งให้ “ชัวร์” ก่อน 3–4 ครั้งติด แล้วค่อยเร่งสปีด', { level:'info' });
      return;
    }

    if (combo >= 10 && skill >= 0.6){
      say('combo_push', '🔥 คอมโบกำลังสวย! รักษาจังหวะเดิม อย่าเปลี่ยนสปีดกะทันหัน', { level:'good' });
      return;
    }

    if (!inStorm && shield === 0){
      say('need_shield', '🛡️ เก็บโล่ไว้ 1–2 อัน จะช่วยผ่าน Storm Mini/Boss ได้ง่ายขึ้น', { level:'info' });
      return;
    }

    if (fatigue > 0.7){
      say('fatigue', 'ใกล้จบแล้ว! โฟกัส “ยิงชัวร์” มากกว่ายิงเร็ว', { level:'info' });
      return;
    }
  }

  function onEnd(summary){
    if (S.ended) return;
    S.ended = true;

    const grade = String(summary?.grade || 'C');
    const acc = Number(summary?.accuracyGoodPct || 0);
    const miss = Number(summary?.misses || 0);
    const miniOk = Number(summary?.stormSuccess || 0);
    const cycles = Number(summary?.stormCycles || 0);

    // One final explainable message
    let msg = `จบแล้ว! เกรด ${grade} • Accuracy ${acc.toFixed(0)}% • MISS ${miss}`;
    if (cycles > 0){
      msg += ` • Mini ${miniOk}/${cycles}`;
    }
    say('end', msg, { level:'end' });
  }

  return { onStart, onUpdate, onEnd };
}