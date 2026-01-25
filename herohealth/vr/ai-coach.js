// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable Micro-tips) — HHA Standard
// ✅ rate-limit tips (cooldownMs)
// ✅ explainable: says WHY (skill/frustration/storm/endwindow/waterZone/shield)
// ✅ deterministic-friendly: no randomness required
// Exports: createAICoach({ emit, game, cooldownMs })

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function createAICoach(cfg){
  const emit = (cfg && typeof cfg.emit === 'function') ? cfg.emit : ()=>{};
  const game = String(cfg?.game || 'game');
  const cooldownMs = Math.max(800, Number(cfg?.cooldownMs||2500));

  const S = {
    started:false,
    lastTipAt:0,
    lastKey:'',
    // state memory to prevent spam
    lastStorm:false,
    lastEnd:false,
    lastZone:'',
    lastShield:-1,
    lastMisses:0,
    lastCombo:0,
    lastSkill:0,
    lastFrustration:0,
    nTips:0
  };

  function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

  function canSpeak(key){
    const t = now();
    if (t - S.lastTipAt < cooldownMs) return false;
    if (key && key === S.lastKey) return false;
    S.lastTipAt = t;
    S.lastKey = key || '';
    S.nTips++;
    return true;
  }

  function say(type, text, why, extra){
    emit('hha:coach', Object.assign({
      game,
      type,              // 'tip' | 'praise' | 'warn' | 'end'
      text: String(text||''),
      why: String(why||''),
      ts: Date.now()
    }, extra||{}));
  }

  function onStart(){
    S.started=true;
    S.lastTipAt=0;
    S.lastKey='';
    S.nTips=0;
    say('tip',
      'เริ่มเลย! เป้าหมาย: คุม GREEN ก่อน แล้วค่อยผ่าน Storm Mini และเคลียร์ Boss 🌩️',
      'เพื่อให้เด็กจับ “จังหวะคุมสมดุลน้ำ” ได้ก่อนเพิ่มความท้าทาย',
      { priority: 1 }
    );
  }

  function onUpdate(st){
    if (!S.started) return;

    const skill = clamp(st?.skill, 0, 1);
    const frustration = clamp(st?.frustration, 0, 1);
    const fatigue = clamp(st?.fatigue, 0, 1);

    const inStorm = !!st?.inStorm;
    const inEnd = !!st?.inEndWindow;
    const zone = String(st?.waterZone || '');
    const shield = Number(st?.shield||0)|0;
    const misses = Number(st?.misses||0)|0;
    const combo = Number(st?.combo||0)|0;

    // 1) Storm entry cue
    if (inStorm && !S.lastStorm){
      if (canSpeak('storm-enter')){
        say('warn',
          'พายุมาแล้ว! ช่วงนี้ต้อง “ไม่ GREEN” (LOW/HIGH) แล้วรอ End Window เพื่อ BLOCK 🛡️',
          'Mini จะผ่านเมื่อออกจาก GREEN และ BLOCK ช่วงท้ายพายุโดยไม่โดน BAD',
          { priority: 2 }
        );
      }
    }

    // 2) End window cue
    if (inEnd && !S.lastEnd){
      if (canSpeak('end-window')){
        const needShield = shield<=0;
        say('warn',
          needShield ? 'เข้า End Window แล้ว แต่ไม่มีโล่! เล็งหลบ BAD ก่อน หรือเก็บ 🛡️ ให้ทัน' : 'เข้า End Window แล้ว! ตอนนี้แหละ BLOCK ให้ได้ 🛡️',
          needShield ? 'ต้องใช้โล่เพื่อ BLOCK ให้ผ่าน Mini/Boss' : 'ช่วงนี้คือเงื่อนไขสำคัญของ Mini/Boss',
          { priority: 3 }
        );
      }
    }

    // 3) Zone feedback during storm (helpful, not spam)
    if (inStorm && zone && zone !== S.lastZone){
      if (zone === 'GREEN'){
        if (canSpeak('storm-green')){
          say('tip',
            'ตอนพายุ อย่าให้อยู่ GREEN นาน — ยิงดี/เสียให้หลุดไป LOW หรือ HIGH ก่อน',
            'Mini ต้อง “ไม่ GREEN” + สะสม pressure แล้วค่อย BLOCK ช่วงท้าย',
            { priority: 2 }
          );
        }
      } else if (zone === 'LOW' || zone === 'HIGH'){
        if (canSpeak('storm-zone-ok')){
          say('praise',
            `ดีมาก! ตอนนี้อยู่ ${zone} แล้ว ✅ ต่อไปคือรอ End Window แล้ว BLOCK`,
            'ออกจาก GREEN สำเร็จแล้ว เหลือทำเงื่อนไขท้ายพายุ',
            { priority: 2 }
          );
        }
      }
    }

    // 4) Shield economy hint
    if (shield !== S.lastShield){
      if (shield >= 2 && !inStorm){
        if (canSpeak('shield-save')){
          say('tip',
            'มีโล่หลายอันแล้ว เก็บไว้ใช้ตอนพายุ/บอส จะผ่านไวขึ้นมาก',
            'โล่คือทรัพยากรสำคัญสำหรับ End Window และ Boss Window',
            { priority: 1 }
          );
        }
      }
      if (shield === 0 && inStorm && inEnd){
        if (canSpeak('shield-zero-end')){
          say('warn',
            'End Window แต่โล่หมด! รอบหน้าให้เก็บ 🛡️ ก่อนพายุเข้ามา',
            'ถ้าไม่มีโล่ จะ BLOCK ไม่ได้ ทำให้ Mini/Boss ผ่านยาก',
            { priority: 3 }
          );
        }
      }
    }

    // 5) Aim / frustration hints
    const missDelta = misses - S.lastMisses;
    if (missDelta >= 3 && canSpeak('miss-spike')){
      say('tip',
        'MISS ติด ๆ กัน: ลดการรัว แล้ว “ค้างเล็งครึ่งจังหวะ” ก่อนยิง',
        'ความนิ่งช่วยเพิ่ม accuracy และรักษาคอมโบ',
        { priority: 2 }
      );
    }

    if (frustration >= 0.78 && canSpeak('frustrated')){
      say('tip',
        'ใจเย็น ๆ นะ! เลือกยิงเป้าที่ชัวร์ก่อน คอมโบจะกลับมาเอง',
        'ลด MISS จะทำให้คะแนนและการคุมสมดุลดีขึ้น',
        { priority: 2 }
      );
    }

    // 6) Praise streak / skill
    if (combo >= 12 && combo > S.lastCombo && canSpeak('combo-praise')){
      say('praise',
        `คอมโบ ${combo}! สุดยอด ⚡ ลากต่ออีกนิด เกรดจะพุ่ง`,
        'คอมโบสูงมักสัมพันธ์กับ accuracy สูงและการควบคุมเกมที่นิ่ง',
        { priority: 1 }
      );
    }

    // 7) fatigue nudge (late-game)
    if (fatigue >= 0.72 && canSpeak('fatigue')){
      say('tip',
        'ช่วงท้ายแล้ว! โฟกัส “เป้าชัวร์” + เก็บโล่ไว้รอบพายุสุดท้าย',
        'ท้ายเกมเงื่อนไข Storm/Boss สำคัญกว่าการยิงมั่ว',
        { priority: 1 }
      );
    }

    // update memory
    S.lastStorm = inStorm;
    S.lastEnd = inEnd;
    S.lastZone = zone;
    S.lastShield = shield;
    S.lastMisses = misses;
    S.lastCombo = combo;
    S.lastSkill = skill;
    S.lastFrustration = frustration;
  }

  function onEnd(summary){
    const grade = String(summary?.grade || 'C');
    const acc = Number(summary?.accuracyGoodPct||0);
    const miss = Number(summary?.misses||0);
    const mini = Number(summary?.stormSuccess||0);

    let msg = `จบแล้ว! เกรด ${grade} • Accuracy ${acc.toFixed(1)}% • MISS ${miss}`;
    if (mini>0) msg += ` • ผ่าน Mini ${mini}`;
    let why = 'สรุปผลเพื่อสะท้อนพฤติกรรมการเล่นและจุดที่ควรพัฒนา';

    if (acc < 60) why = 'เน้นความนิ่งและลดการรัว จะทำให้ accuracy ดีขึ้นทันที';
    else if (mini<=0) why = 'รอบหน้าลองออกจาก GREEN ตอนพายุ แล้ว BLOCK ช่วง End Window';
    else if (grade==='S' || grade==='SS' || grade==='SSS') why = 'ทำได้ดีมาก! เล่นได้ทั้งสกิลยิงและการจัดการพายุ';

    say('end', msg, why, { priority: 1, summary: true });
  }

  return { onStart, onUpdate, onEnd };
}

export { createAICoach };