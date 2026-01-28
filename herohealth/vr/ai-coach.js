// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable micro-tips) — PRODUCTION
// ✅ Export: createAICoach({ emit, game, cooldownMs })
// ✅ Rate-limit tips + avoids spam
// ✅ Auto-disable in research (unless ?ai=1)
// ✅ No DOM dependency: emits only -> 'hha:coach'

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function now(){ return (typeof performance!=='undefined' && performance.now)? performance.now() : Date.now(); }

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 2800, 800, 20000);

  // research auto-off
  const run = String(qs('run', qs('runMode','play'))||'play').toLowerCase();
  const forceOn = String(qs('ai','')).trim() === '1';
  const forceOff = String(qs('ai','')).trim() === '0';
  let enabled = forceOff ? false : (forceOn ? true : (run !== 'research'));

  let lastSayAt = 0;
  let lastKey = '';
  let started = false;

  const MEM = {
    missLast: 0,
    accLast: 0,
    waterLast: '',
    shieldLast: 0,
    endWindowLast: false,
    stormLast: false,
    comboLast: 0,
    nagCount: 0
  };

  function say(key, text, level='tip', extra={}){
    if (!enabled) return;
    const t = now();
    if (t - lastSayAt < cooldownMs) return;
    if (key && key === lastKey) return;

    lastSayAt = t;
    lastKey = key || '';
    emit('hha:coach', {
      game,
      level,
      key: key || '',
      text: String(text || ''),
      ...extra
    });
  }

  function onStart(){
    started = true;
    MEM.nagCount = 0;
    say('start', 'พร้อมแล้ว! ยิง 💧 คุมให้อยู่ GREEN แล้วเตรียมทำ STORM 🌀', 'start');
  }

  function onUpdate(s={}){
    if (!started || !enabled) return;

    const skill = clamp(s.skill ?? 0.4, 0, 1);
    const frustration = clamp(s.frustration ?? 0.2, 0, 1);
    const fatigue = clamp(s.fatigue ?? 0.0, 0, 1);

    const inStorm = !!s.inStorm;
    const inEndWindow = !!s.inEndWindow;
    const waterZone = String(s.waterZone || '');
    const shield = s.shield|0;
    const misses = s.misses|0;
    const combo = s.combo|0;

    // --- high priority: End Window actions
    if (inStorm && inEndWindow){
      if (shield > 0){
        say('end_block', 'ตอนนี้คือ End Window! ✅ กด/ยิง 🥤 เพื่อ BLOCK (ใช้ 🛡️) ให้ผ่าน Mini!', 'urgent', { urgent:true });
        MEM.endWindowLast = true;
        return;
      } else {
        say('end_no_shield', 'End Window มาแล้วแต่ยังไม่มี 🛡️ — รอบหน้าลอง “เก็บโล่ก่อนพายุ” นะ', 'urgent', { urgent:true });
        MEM.endWindowLast = true;
        return;
      }
    }

    // --- storm guidance
    if (inStorm){
      if (waterZone === 'GREEN'){
        say('storm_leave_green', 'พายุมาแล้ว! ออกนอก GREEN ให้เป็น LOW/HIGH ก่อน แล้วค่อยรอ End Window เพื่อ BLOCK', 'tip');
        return;
      }
      if (shield <= 0){
        say('storm_get_shield', 'ระหว่างพายุพยายามเก็บ 🛡️ อย่างน้อย 1 อันไว้รอ End Window', 'tip');
        return;
      }
    }

    // --- misses spike
    const missDelta = misses - (MEM.missLast|0);
    if (missDelta >= 3){
      say('miss_spike', 'MISS รัว ๆ แล้ว 😅 ลอง “หยุดรัว” เล็งค้างนิดนึงแล้วค่อยยิง', 'tip');
      MEM.missLast = misses;
      return;
    }

    // --- frustration
    if (frustration >= 0.78){
      say('calm', 'ใจเย็น ๆ นะ 🙂 โฟกัสเป้าใกล้กลางจอ + ไม่ต้องรัว จะคุมคอมโบได้เอง', 'tip');
      return;
    }

    // --- skill-based nudges
    if (skill < 0.35 && combo <= 2){
      say('skill_low', 'ทิป: เล็งเป้ากลาง ๆ ก่อน ยิงทีละเป้าให้ชัวร์ คอมโบจะขึ้นเอง', 'tip');
      return;
    }
    if (skill > 0.72 && combo >= 8){
      say('skill_high', 'สุดยอด! 🔥 ลากคอมโบยาว ๆ แล้วคุม GREEN ต่อ เกรดจะพุ่งมาก', 'praise');
      return;
    }

    // --- fatigue late game
    if (fatigue > 0.70 && !inStorm){
      say('late_game', 'ช่วงท้ายแล้ว! เก็บแต้มจาก 💧 ให้แม่น + อย่าพลาด BAD', 'tip');
      return;
    }

    // update memory
    MEM.missLast = misses;
    MEM.waterLast = waterZone;
    MEM.shieldLast = shield;
    MEM.stormLast = inStorm;
    MEM.endWindowLast = inEndWindow;
    MEM.comboLast = combo;
  }

  function onEnd(summary={}){
    if (!enabled) return;
    const grade = String(summary.grade || '');
    const acc = Number(summary.accuracyGoodPct || 0);

    if (grade === 'SSS' || grade === 'SS'){
      say('end_top', `โหดมาก! ได้ ${grade} 🎉 Accuracy ${acc.toFixed(0)}%`, 'end');
    } else if (grade === 'S' || grade === 'A'){
      say('end_mid', `ดีมาก! ได้ ${grade} ✅ รอบหน้าลองลด MISS ลงอีกนิด เกรดจะขึ้น`, 'end');
    } else {
      say('end_low', `ยังไหว! รอบหน้าโฟกัสยิง 💧 ให้แม่นขึ้น + เก็บ 🛡️ ก่อนพายุ`, 'end');
    }
  }

  function setEnabled(v){ enabled = !!v; }

  return { onStart, onUpdate, onEnd, setEnabled };
}