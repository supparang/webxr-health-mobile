// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION V2 (explainable micro-tips + rate-limit + anti-spam)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart / onUpdate / onEnd
// ✅ Priority tips for Storm End Window / Boss Window / Stage focus
// ✅ Anti-repeat: per-key + per-message cooldown
// ✅ Explainable: includes reason field (short)

// Emits: 'hha:coach' { game, key, msg, reason, level }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function')
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const game = String(opts.game || 'game');

  // cooldown: minimum time between any messages
  const globalCooldownMs = clamp(opts.cooldownMs || 3200, 900, 15000);

  // extra guard: don't repeat same key too often
  const keyCooldownMs = clamp(opts.keyCooldownMs || 12000, 2000, 60000);

  // tick sampling (onUpdate may be called every frame)
  const sampleEveryTicks = clamp(opts.sampleEveryTicks || 45, 10, 180);

  const S = {
    started:false,
    ended:false,
    ticks:0,

    lastAt:0,
    lastKeyAt:Object.create(null),
    lastMsgAt:Object.create(null),
  };

  function canSpeak(key, msg){
    const now = Date.now();
    if (S.ended) return false;

    if (now - S.lastAt < globalCooldownMs) return false;

    if (key){
      const t = S.lastKeyAt[key] || 0;
      if (now - t < keyCooldownMs) return false;
    }

    if (msg){
      const t = S.lastMsgAt[msg] || 0;
      if (now - t < keyCooldownMs) return false;
    }

    return true;
  }

  function say(key, msg, reason='', level='info'){
    if (!canSpeak(key, msg)) return;

    const now = Date.now();
    S.lastAt = now;
    if (key) S.lastKeyAt[key] = now;
    if (msg) S.lastMsgAt[msg] = now;

    emit('hha:coach', { game, key, msg, reason, level });
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    say(
      'start',
      'เริ่มเลย! 🎯 ยิงให้ชัวร์ก่อน แล้วค่อยลากคอมโบ',
      'เริ่มเกม: ความแม่นสำคัญที่สุดช่วงแรก',
      'good'
    );
  }

  // Helper: compact interpretation
  function normState(st){
    const o = st || {};
    return {
      stage: (o.stage|0) || 1,
      skill: clamp(o.skill ?? 0.5, 0, 1),
      fatigue: clamp(o.fatigue ?? 0, 0, 1),
      frustration: clamp(o.frustration ?? 0, 0, 1),

      inStorm: !!o.inStorm,
      inEndWindow: !!o.inEndWindow,
      inBoss: !!o.inBoss, // optional
      waterZone: String(o.waterZone || ''),
      shield: (o.shield|0) || 0,
      misses: (o.misses|0) || 0,
      combo: (o.combo|0) || 0,

      stormCycles: (o.stormCycles|0) || 0,
      stormSuccess: (o.stormSuccess|0) || 0,
      bossClearCount: (o.bossClearCount|0) || 0,

      greenHoldSec: Number(o.greenHoldSec || 0),
      greenTargetSec: Number(o.greenTargetSec || 0),

      endWindowNeedBlock: !!o.endWindowNeedBlock, // optional
    };
  }

  function onUpdate(stRaw){
    if (!S.started || S.ended) return;
    S.ticks++;

    // sample only sometimes
    if ((S.ticks % sampleEveryTicks) !== 0) return;

    const st = normState(stRaw);

    // 0) Emergency / high frustration
    if (st.frustration > 0.72 || st.misses >= 16){
      say(
        'calm_down',
        'ลดการรัวนะ 🙂 เล็งค้างนิดนึงแล้วค่อยยิง จะลด MISS ได้เยอะ',
        'MISS/ความกดดันสูง: ต้องลดสปีดเพื่อเพิ่มความแม่น',
        'warn'
      );
      return;
    }

    // 1) Storm End Window (highest priority)
    if (st.inStorm && st.inEndWindow){
      if (st.shield <= 0){
        say(
          'storm_end_need_shield',
          '⏱️ ช่วงท้ายพายุแล้ว! ถ้ามี 🛡️ จะ BLOCK ได้ปลอดภัยกว่า',
          'End Window ต้อง BLOCK แต่ตอนนี้ไม่มีโล่',
          'warn'
        );
        return;
      }

      if (st.waterZone === 'GREEN'){
        say(
          'storm_end_leave_green',
          '⚡ Storm Mini: ตอนนี้ต้อง “ออกจาก GREEN” (ไป LOW/HIGH) แล้วค่อย BLOCK ช่วงท้าย',
          'Mini ผ่านต้อง zone≠GREEN + BLOCK ช่วงท้าย',
          'warn'
        );
        return;
      }

      say(
        'storm_end_block_now',
        '✅ ตอนท้ายพายุ: โฟกัส BLOCK ให้ครบ แล้วอย่าโดน 🥤',
        'เงื่อนไขผ่าน Mini: zoneOK + pressure + endWindow + blockedInEnd',
        'good'
      );
      return;
    }

    // 2) Storm (not end) — remind objectives
    if (st.inStorm){
      if (st.waterZone === 'GREEN'){
        say(
          'storm_leave_green',
          '🌀 เข้า Storm แล้ว: เป้าหมายคือ LOW/HIGH (อย่าอยู่ GREEN)',
          'Mini ต้องออกจาก GREEN',
          'info'
        );
        return;
      }

      if (st.shield <= 0){
        say(
          'storm_get_shield',
          '🛡️ ในพายุถ้าเห็นโล่ ให้เก็บไว้! ช่วย BLOCK ตอนท้ายพายุ/บอส',
          'Storm มี End Window ต้องใช้โล่',
          'info'
        );
        return;
      }
    }

    // 3) Boss / Stage 3 focus (if provided by engine)
    if (st.stage >= 3){
      if (st.shield <= 0){
        say(
          'boss_need_shield',
          '🌩️ Stage 3: เก็บ 🛡️ ไว้ก่อน แล้วรอ Boss Window ค่อย BLOCK',
          'บอสต้อง BLOCK ให้ครบภายในหน้าต่างท้ายพายุ',
          'warn'
        );
        return;
      }
      if (st.combo >= 8 && st.skill >= 0.6){
        say(
          'boss_keep_rhythm',
          '🔥 เก่งมาก! รักษาจังหวะเดิมไว้ แล้วรอจังหวะบอสค่อย BLOCK',
          'ตอนนี้เล่นนิ่งแล้ว โอกาสเคลียร์บอสสูง',
          'good'
        );
        return;
      }
    }

    // 4) Stage 1 focus (GREEN hold)
    if (st.stage <= 1){
      if (st.greenTargetSec > 0 && st.greenHoldSec < st.greenTargetSec * 0.35){
        say(
          'stage1_green',
          '🎯 Stage 1: คุมให้อยู่ GREEN ให้นาน ๆ (อย่าเผลอไป LOW/HIGH)',
          'ต้องสะสมเวลาที่อยู่ GREEN ให้ครบ',
          'info'
        );
        return;
      }
      if (st.shield === 0){
        say(
          'prep_shield',
          '🛡️ เตรียมโล่ 1–2 อันไว้ล่วงหน้า จะผ่าน Storm Mini ได้ง่ายขึ้น',
          'Storm ต้อง BLOCK ตอนท้ายพายุ',
          'info'
        );
        return;
      }
    }

    // 5) Performance encouragement
    if (st.combo >= 10 && st.skill >= 0.62){
      say(
        'combo_push',
        '🔥 คอมโบสวยมาก! อย่าเปลี่ยนสปีดกะทันหัน แล้วเกรดจะพุ่ง',
        'ความนิ่งช่วยรักษา Accuracy/Combo',
        'good'
      );
      return;
    }

    // 6) Fatigue
    if (st.fatigue > 0.75){
      say(
        'fatigue',
        'ใกล้จบแล้ว! โฟกัส “ยิงชัวร์” มากกว่ายิงเร็ว',
        'ท้ายเกมพลาดทีเดียวคอมโบหลุดง่าย',
        'info'
      );
      return;
    }
  }

  function onEnd(summary){
    if (S.ended) return;
    S.ended = true;

    const grade = String(summary?.grade || 'C');
    const acc = Number(summary?.accuracyGoodPct || 0);
    const miss = Number(summary?.misses || 0);
    const ok = Number(summary?.stormSuccess || 0);
    const cycles = Number(summary?.stormCycles || 0);
    const boss = Number(summary?.bossClearCount || 0);

    let msg = `จบแล้ว! เกรด ${grade} • Accuracy ${acc.toFixed(0)}% • MISS ${miss}`;
    if (cycles > 0) msg += ` • Mini ${ok}/${cycles}`;
    if (boss > 0) msg += ` • Boss ✅`;

    say('end', msg, 'สรุปผลจากรอบนี้', 'end');
  }

  return { onStart, onUpdate, onEnd };
}