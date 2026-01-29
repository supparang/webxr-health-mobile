// === /herohealth/vr/ai-coach.js === 
// AI Coach — PRODUCTION (HHA Standard)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Explainable micro-tips + rate-limit + anti-spam
// ✅ Works with hydration.safe.js immediately
// Notes:
// - Emits: emit('hha:coach', { game, type:'tip', key, text, why?, ts })
// - No external deps. Safe no-op if emit missing.

'use strict';

function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(cfg={}){
  const emit = (typeof cfg.emit === 'function') ? cfg.emit : (()=>{});
  const game = String(cfg.game || 'game');
  const cooldownMs = clamp(cfg.cooldownMs ?? 3200, 800, 12000);

  const S = {
    started:false,
    lastSayAt:0,
    lastKeyAt:new Map(),
    lastState:null,

    // soft memory
    seenStorm:false,
    seenEndWindow:false,
    lastCombo:0,
    lastMiss:0,
    lastAcc:0,
    lastWaterZone:'',
    lastShield:0,

    // spam guards
    quietUntil:0
  };

  function canSay(key, extraWait=0){
    const t = nowMs();
    if (t < S.quietUntil) return false;

    const last = S.lastKeyAt.get(key) || 0;
    if (t - last < Math.max(900, cooldownMs + extraWait)) return false;

    if (t - S.lastSayAt < cooldownMs) return false;

    S.lastKeyAt.set(key, t);
    S.lastSayAt = t;
    return true;
  }

  function say(key, text, why){
    if (!canSay(key)) return false;
    emit('hha:coach', {
      game,
      type:'tip',
      key,
      text: String(text || ''),
      why: why ? String(why) : '',
      ts: Date.now()
    });
    return true;
  }

  function sayUrgent(key, text, why){
    // urgent tips bypass some cooldown (still avoids spam by key)
    const t = nowMs();
    const last = S.lastKeyAt.get(key) || 0;
    if (t - last < 750) return false;
    if (t < S.quietUntil) return false;
    S.lastKeyAt.set(key, t);
    S.lastSayAt = t;
    emit('hha:coach', { game, type:'tip', key, text:String(text||''), why: why?String(why):'', ts: Date.now() });
    return true;
  }

  function onStart(){
    S.started = true;
    S.lastSayAt = 0;
    S.lastKeyAt.clear();
    S.quietUntil = 0;
    S.seenStorm = false;
    S.seenEndWindow = false;
    S.lastState = null;

    // small welcome (only once)
    say('start', 'เริ่มแล้ว! โฟกัสยิง 💧 ให้แม่น ๆ แล้วลากคอมโบยาว ๆ', 'คอมโบช่วยดันคะแนนและเกรด');
  }

  function onEnd(summary){
    try{
      const acc = Number(summary?.accuracyGoodPct ?? 0);
      const miss = Number(summary?.misses ?? 0);
      const boss = Number(summary?.bossClearCount ?? 0);
      const stage = Number(summary?.stageCleared ?? 0);

      if (stage < 1) say('end_stage1', 'ครั้งหน้า: ทำ Stage1 ก่อนนะ (คุม GREEN ให้นานขึ้น)', 'Stage1 เป็นทางผ่านไป Storm/Boss');
      else if (stage < 2) say('end_stage2', 'ครั้งหน้า: ตอน Storm ต้องทำ LOW/HIGH ให้ตรงคำสั่ง + BLOCK ช่วงท้าย', 'Mini ผ่าน = ปลด Stage2');
      else if (boss < 1) say('end_boss', 'ครั้งหน้า: เก็บ 🛡️ ก่อนพายุ แล้วรอ Boss Window ค่อย BLOCK 🌩️ ให้ครบ', 'Boss Clear ต้อง block ตามจำนวน');
      else say('end_win', 'ยอดมาก! ผ่าน BOSS แล้ว ลองลากคอมโบให้ยาวขึ้นอีก จะได้ S/SS', 'คอมโบ+ความแม่นคือกุญแจ');

      if (acc < 60) say('end_acc', 'ทริค: เล็งค้างเสี้ยววิ ก่อนยิง อย่ารัว', 'ความแม่นเพิ่ม คะแนนพุ่ง');
      if (miss > 20) say('end_miss', 'MISS เยอะไปนิด: เลือกยิงเป้าที่ “ชัวร์” แล้วค่อยเพิ่มสปีด', 'ลด MISS = เกรดดีขึ้น');
    }catch(_){}
  }

  // Heuristic coach for Hydration (but generic-friendly)
  function onUpdate(st){
    if (!S.started || !st) return;

    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frustration = clamp(st.frustration ?? 0, 0, 1);

    const inStorm = !!st.inStorm;
    const inEndWindow = !!st.inEndWindow;
    const waterZone = String(st.waterZone || '');
    const shield = (st.shield|0);
    const misses = (st.misses|0);
    const combo = (st.combo|0);

    // 0) panic control
    if (frustration > 0.82 && misses > S.lastMiss + 2){
      if (say('calm', 'ใจเย็น ๆ ลดการรัวก่อน แล้วโฟกัสยิงทีละเป้าให้ชัวร์', 'รัวมั่ว = MISS เพิ่มเร็วมาก')){
        S.quietUntil = nowMs() + 1200;
      }
    }

    // 1) accuracy/skill tips
    if (!inStorm && skill < 0.38 && misses >= 6){
      say('aim', 'เล็งให้นิ่งนิดนึงก่อนยิง 💧 จะคุมเกจง่ายขึ้นมาก', 'ยิงแม่นช่วยคุมโซนได้เร็ว');
    }
    if (combo >= 10 && combo > S.lastCombo){
      say('combo', 'คอมโบกำลังมา! รักษาจังหวะ อย่าเสี่ยงยิง BAD', 'คอมโบยาว = คะแนนไหล');
    }

    // 2) water zone nudges (hydration-specific tone)
    if (!inStorm){
      if (waterZone === 'LOW')  say('water_low',  'น้ำต่ำไป → เน้นยิง 💧 ต่อเนื่องให้กลับ GREEN', 'อยู่ GREEN นาน ๆ จะผ่าน Stage1 เร็ว');
      if (waterZone === 'HIGH') say('water_high', 'น้ำสูงไป → หลีกเลี่ยงยิงมั่ว/โดน 🥤 แล้วค่อยคุมกลับ GREEN', 'โดน BAD จะดันน้ำหลุดโซน');
    }

    // 3) storm tips
    if (inStorm && !S.seenStorm){
      S.seenStorm = true;
      say('storm_intro', 'STORM มาแล้ว! ทำ “LOW/HIGH” ให้ตรงคำสั่ง แล้วเก็บ 🛡️ ไว้ BLOCK ช่วงท้าย', 'Mini ผ่านต้องครบเงื่อนไข');
    }

    if (inStorm && shield <= 0){
      say('no_shield', 'ตอนนี้ไม่มี 🛡️! หา 🛡️ ก่อนเข้า End Window จะปลอดภัยกว่า', 'BLOCK ช่วงท้ายต้องใช้ 🛡️');
    }

    // 4) end-window urgent coaching
    if (inEndWindow && !S.seenEndWindow){
      S.seenEndWindow = true;
      sayUrgent('endwindow_now', 'END WINDOW! ตอนนี้ให้ “BLOCK” เป็นหลัก (อย่าเสี่ยงโดน BAD)', 'ช่วงท้ายคือจุดตัดสิน Mini/Boss');
    }
    if (!inEndWindow) S.seenEndWindow = false;

    // 5) fatigue guidance
    if (fatigue > 0.74 && combo === 0 && misses > 10){
      say('fatigue', 'ใกล้หมดเวลาแล้ว: เล่นแบบ “ชัวร์” ลดความเสี่ยง จะดันเกรดขึ้นได้', 'ปลายเกมเน้นความปลอดภัย');
    }

    // update memory
    S.lastCombo = combo;
    S.lastMiss = misses;
    S.lastAcc = clamp(skill*100, 0, 100);
    S.lastWaterZone = waterZone;
    S.lastShield = shield;
    S.lastState = st;
  }

  return { onStart, onUpdate, onEnd, say };
}