// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (HHA)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Returns: { onStart, onUpdate, onEnd, say }
// ✅ Emits: emit('hha:coach', { game, level, text, key, ts })

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

export function createAICoach(opts){
  const emit = (opts && typeof opts.emit === 'function') ? opts.emit : ()=>{};
  const game = String((opts && opts.game) || 'game');
  const cooldownMs = Math.max(600, Number((opts && opts.cooldownMs) || 2500));

  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const coachOn = (run !== 'research'); // research: ปิดแนะนำอัตโนมัติ (ตามมาตรฐานงานวิจัย)

  const ST = {
    lastAt: 0,
    lastKey: '',
    started: false,
    lastZone: '',
    lastInStorm: false,
    lastEndWindow: false,
    lastBoss: false,
    lastShield: -1,
    lastComboPraiseAt: 0,
    lastMissWarnAt: 0
  };

  function canSpeak(key){
    const now = performance.now();
    if (!coachOn) return false;
    if (now - ST.lastAt < cooldownMs) return false;
    if (key && key === ST.lastKey) return false;
    return true;
  }

  function say(key, level, text, extra){
    if (!canSpeak(key)) return false;
    ST.lastAt = performance.now();
    ST.lastKey = key || '';
    emit('hha:coach', Object.assign({
      game,
      level: level || 'info',   // info | good | warn
      text: String(text || ''),
      key: key || '',
      ts: Date.now()
    }, extra || {}));
    return true;
  }

  function onStart(){
    ST.started = true;
    ST.lastZone = '';
    ST.lastInStorm = false;
    ST.lastEndWindow = false;
    ST.lastBoss = false;
    ST.lastShield = -1;
    ST.lastComboPraiseAt = 0;
    ST.lastMissWarnAt = 0;

    say('start', 'info', 'เริ่มเลย! ยิง 💧 เพื่อคุมให้อยู่โซน GREEN ให้นานที่สุดนะ');
  }

  function onUpdate(ctx){
    if (!coachOn) return;
    if (!ctx) return;

    const skill = clamp(ctx.skill, 0, 1);
    const frustration = clamp(ctx.frustration, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEndWindow = !!ctx.inEndWindow;
    const boss = !!ctx.bossActive;
    const zone = String(ctx.waterZone || '');
    const shield = Number(ctx.shield || 0);
    const misses = Number(ctx.misses || 0);
    const combo = Number(ctx.combo || 0);

    // zone change
    if (zone && zone !== ST.lastZone){
      ST.lastZone = zone;
      if (zone === 'GREEN') say('zone_green', 'good', 'ดีมาก! ตอนนี้อยู่ GREEN แล้ว รักษาให้นิ่ง ๆ');
      if (zone === 'LOW')   say('zone_low', 'warn', 'LOW แล้วนะ! หา 💧 ให้ไวขึ้นนิดนึงเพื่อดันกลับ GREEN');
      if (zone === 'HIGH')  say('zone_high', 'warn', 'HIGH แล้วนะ! ชะลอการพลาด แล้วค่อย ๆ ดันกลับ GREEN');
    }

    // storm transitions
    if (inStorm && !ST.lastInStorm){
      ST.lastInStorm = true;
      say('storm_start', 'warn', 'พายุมาแล้ว! เป้าจะถี่ขึ้น—เก็บ 🛡️ แล้วรอท้ายพายุเพื่อ BLOCK');
    }
    if (!inStorm && ST.lastInStorm){
      ST.lastInStorm = false;
      say('storm_end', 'info', 'พายุผ่านไป! กลับไปโฟกัสคุม GREEN ต่อ');
    }

    // end window transitions
    if (inEndWindow && !ST.lastEndWindow){
      ST.lastEndWindow = true;
      say('end_window', 'warn', 'End Window มาแล้ว! ตอนนี้ “ต้อง BLOCK” ให้สำเร็จ (อย่าโดน BAD)');
    }
    if (!inEndWindow && ST.lastEndWindow){
      ST.lastEndWindow = false;
    }

    // shield changes
    if (shield !== ST.lastShield){
      ST.lastShield = shield;
      if (shield >= 2) say('shield_2', 'good', 'มี 🛡️ แล้ว! เก็บไว้ใช้ช่วง End Window จะผ่าน Mini ง่ายมาก');
      else if (shield === 1) say('shield_1', 'info', 'มี 🛡️ 1 อันแล้ว—พยายามเก็บเพิ่มก่อนพายุ');
      else if (shield === 0 && inStorm) say('shield_0_storm', 'warn', 'พายุมาแต่ไม่มี 🛡️ เลย ระวัง BAD ให้มาก!');
    }

    // boss callout
    if (boss && !ST.lastBoss){
      ST.lastBoss = true;
      say('boss', 'warn', 'BOSS WINDOW! 🌩️ โผล่แล้ว—ใช้ 🛡️ BLOCK ให้ครบตามจำนวน');
    }
    if (!boss && ST.lastBoss){
      ST.lastBoss = false;
    }

    // praise combo (not too often)
    if (combo >= 8){
      const now = performance.now();
      if (now - ST.lastComboPraiseAt > 6500){
        ST.lastComboPraiseAt = now;
        say('combo_praise', 'good', 'คอมโบสวยมาก! อย่ารัว—เล็งชัวร์ ๆ แล้วลากยาว ๆ');
      }
    }

    // warn on misses spike
    if (misses >= 10){
      const now = performance.now();
      if (now - ST.lastMissWarnAt > 7000){
        ST.lastMissWarnAt = now;
        if (frustration > 0.65) say('miss_warn', 'warn', 'MISS เริ่มเยอะ ลอง “ช้าลงนิด” เลือกยิงเป้าที่ชัวร์ก่อนนะ');
        else say('miss_warn2', 'info', 'ถ้าอยากลด MISS: เล็งค้างนิดนึง แล้วค่อยยิง จะนิ่งขึ้น');
      }
    }

    // skill-based micro tip (light)
    if (skill < 0.35 && !inStorm){
      say('skill_low', 'info', 'ทริก: ไม่ต้องยิงทุกอัน เลือกจังหวะที่เป้าอยู่กลาง ๆ จะคุม GREEN ง่ายขึ้น');
    } else if (skill > 0.78 && !inStorm){
      say('skill_high', 'good', 'ฟอร์มดีมาก! ลองตั้งเป้า “คุม GREEN ยาว ๆ + คอมโบ” จะได้ S/SS');
    }
  }

  function onEnd(summary){
    if (!coachOn) return;
    const grade = String((summary && summary.grade) || '');
    const acc = Number((summary && summary.accuracyGoodPct) || 0);
    const miss = Number((summary && summary.misses) || 0);
    const stormOk = Number((summary && summary.stormSuccess) || 0);
    const bossOk = Number((summary && summary.bossClearCount) || 0);

    if (bossOk > 0) say('end_boss', 'good', `สุดยอด! เคลียร์ BOSS ได้แล้ว 🎉 เกรด ${grade}`);
    else if (stormOk > 0) say('end_mini', 'good', `ดีมาก! ผ่านพายุได้แล้ว ต่อไปโฟกัส BOSS 🌩️ (BLOCK ให้ครบ)`);
    else say('end', 'info', `จบเกมแล้ว เกรด ${grade} — รอบหน้าลอง “เก็บ 🛡️ ก่อนพายุ แล้ว BLOCK ช่วง End Window”`);

    if (acc < 65) say('end_acc', 'info', 'เป้าหมายต่อไป: ดัน Accuracy ให้เกิน 70% (เล็งนิ่ง ๆ แล้วค่อยยิง)');
    if (miss > 18) say('end_miss', 'warn', 'MISS เยอะไปนิด รอบหน้า “ลดการรัว” จะดีขึ้นทันที');
  }

  return { onStart, onUpdate, onEnd, say };
}