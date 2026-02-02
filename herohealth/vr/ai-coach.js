// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (safe, explainable, rate-limited)
// ✅ ESM export: createAICoach(opts)
// ✅ Emits via opts.emit('hha:coach', payload)
// ✅ API: onStart(), onUpdate(state), onEnd(summary), say(payload), reset()
// ✅ Never throws (best-effort), works across games
//
// Intended payload example:
// emit('hha:coach', {
//   game:'hydration',
//   type:'tip'|'warn'|'praise'|'stage'|'debug',
//   code:'H_WATER_GREEN' ...,
//   message:'...',
//   why:'...',
//   data:{...},
//   ts: Date.now()
// });

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
function nowAbs(){ return Date.now(); }
function safeLower(s){ return String(s||'').toLowerCase(); }

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : ()=>{};
  const game = safeLower(opts.game || 'hha');
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 800, 15000);
  const verbose = !!opts.verbose;

  const S = {
    started:false,
    lastSpeakAt: 0,
    lastCode: '',
    lastCodeAt: 0,
    tick: 0,

    emaSkill: 0.45,
    emaFrustration: 0.25,
    emaFatigue: 0.15,

    last: {
      inStorm:false,
      inEndWindow:false,
      waterZone:'',
      shield:0,
      combo:0,
      misses:0,
    },

    codeCooldownMs: 9000,
  };

  function canSpeak(code){
    const t = nowMs();
    if (t - S.lastSpeakAt < cooldownMs) return false;
    if (code && code === S.lastCode && (t - S.lastCodeAt) < S.codeCooldownMs) return false;
    return true;
  }

  function speak(payload){
    try{
      const p = Object.assign({ game, ts: nowAbs() }, payload || {});
      const code = String(p.code || '');
      if (!canSpeak(code)) return false;

      S.lastSpeakAt = nowMs();
      S.lastCode = code;
      S.lastCodeAt = nowMs();

      emit('hha:coach', p);
      return true;
    }catch(_){
      return false;
    }
  }

  // ---- Hydration-specific rules ----
  function hydrationRules(st){
    const zone = String(st.waterZone || '').toUpperCase();
    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const shield = Number(st.shield||0);
    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fr = clamp(st.frustration ?? 0.3, 0, 1);
    const fat = clamp(st.fatigue ?? 0.2, 0, 1);
    const combo = Number(st.combo||0);
    const misses = Number(st.misses||0);

    // End Window: the clutch moment
    if (inStorm && inEnd && shield > 0){
      return {
        type:'warn',
        code:'H_STORM_END_BLOCK',
        message:'⏳ End Window! ตอนนี้ต้อง “BLOCK 🥤/🌩️” ให้ได้',
        why:'ช่วงท้ายพายุเป็นหน้าต่างสำคัญของ Mini/Boss—กันโดน BAD ด้วยโล่จะได้คะแนน/ผ่านสเตจ',
        data:{ shield, zone }
      };
    }
    if (inStorm && inEnd && shield <= 0){
      return {
        type:'warn',
        code:'H_STORM_END_NEED_SHIELD',
        message:'🛡️ หมดโล่แล้ว! รอบหน้าก่อนพายุให้เก็บโล่ไว้ 1–2 อัน',
        why:'Mini ต้อง BLOCK ช่วงท้าย—ถ้าไม่มีโล่จะกัน BAD ไม่ได้และมักไม่ผ่าน Mini',
        data:{ shield, zone }
      };
    }

    // Zone strategy
    if (!inStorm && zone === 'GREEN' && fat < 0.6 && skill < 0.65){
      return {
        type:'tip',
        code:'H_GREEN_HOLD',
        message:'✅ อยู่ GREEN ดีแล้ว—พยายาม “คุม GREEN” ให้นานขึ้นเพื่อผ่าน Stage 1',
        why:'Stage 1 ต้องสะสมเวลาอยู่ GREEN ให้ครบก่อนถึงจะไป Stage 2/3',
        data:{ zone }
      };
    }
    if (!inStorm && (zone === 'LOW' || zone === 'HIGH') && shield < 1){
      return {
        type:'tip',
        code:'H_PREP_SHIELD',
        message:'เตรียมพายุนะ! ตอนนี้อยู่นอก GREEN แล้ว—เก็บ 🛡️ ไว้ทำ Storm Mini',
        why:'Mini ต้อง “LOW/HIGH + pressure + End Window + BLOCK” การมีโล่ช่วยผ่านง่ายขึ้น',
        data:{ zone, shield }
      };
    }

    // Performance-based coaching
    if (combo >= 10 && skill >= 0.7){
      return {
        type:'praise',
        code:'H_COMBO_PRAISE',
        message:`🔥 คอมโบ ${combo}! เก็บจังหวะนี้ไว้—ยิง 💧 ให้แม่น แล้วค่อย BLOCK ตอนพายุ`,
        why:'คอมโบสูง = ความแม่นดี คะแนนจะพุ่ง ถ้าคุมจังหวะตอนพายุได้จะผ่าน Stage 2/3 เร็ว',
        data:{ combo, zone }
      };
    }
    if (fr >= 0.75 || misses >= 18){
      return {
        type:'tip',
        code:'H_ANTI_SPAM',
        message:'🎯 ลอง “ชะลอมือ” นิดนึง: เล็งให้ชัวร์ก่อนยิง จะลด MISS ได้ไวมาก',
        why:'รัวเกินไปทำให้ MISS เพิ่มและคอมโบแตก ส่งผลให้เกรดตกแม้คะแนนรวมสูง',
        data:{ misses }
      };
    }

    // Late-game push
    if (fat >= 0.80 && skill >= 0.55){
      return {
        type:'warn',
        code:'H_LATE_GAME_PUSH',
        message:'⏱️ ใกล้จบแล้ว! โฟกัส “Stage ที่ยังไม่ผ่าน” ก่อน (Mini → Boss)',
        why:'ปลายเกมคือช่วงเคลียร์ภารกิจ—ทำ Mini ให้ได้อย่างน้อย 1 และเก็บโล่ไว้ Boss Window',
        data:{ fat, zone, shield }
      };
    }

    return null;
  }

  // ---- Generic fallback ----
  function genericRules(st){
    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fr = clamp(st.frustration ?? 0.3, 0, 1);
    const fat = clamp(st.fatigue ?? 0.2, 0, 1);

    if (fr >= 0.8){
      return {
        type:'tip',
        code:'G_SLOW_DOWN',
        message:'ลองช้าลงนิดนึง แล้วเล็งให้ชัวร์ก่อนยิง 👍',
        why:'ลดพลาด = คอมโบยาวขึ้นและคะแนนนิ่งขึ้น',
        data:{ fr }
      };
    }
    if (skill >= 0.8 && fat < 0.7){
      return {
        type:'praise',
        code:'G_GOOD_FLOW',
        message:'🔥 ฟอร์มดีมาก! ลองเพิ่มความท้าทายด้วยคอมโบยาว ๆ',
        why:'เมื่อแม่นแล้ว การรักษาจังหวะจะทำให้เกรด/คะแนนเพิ่มแบบก้าวกระโดด',
        data:{ skill }
      };
    }
    if (fat >= 0.85){
      return {
        type:'warn',
        code:'G_END_SOON',
        message:'⏱️ ใกล้จบแล้ว! โฟกัสเป้าหมายหลักก่อน',
        why:'ช่วงท้ายให้เก็บแต้ม/เคลียร์ภารกิจให้ครบก่อนเวลา',
        data:{ fat }
      };
    }
    return null;
  }

  function pickCoachMessage(st){
    if (game === 'hydration') return hydrationRules(st) || genericRules(st);
    return genericRules(st);
  }

  function onStart(){
    S.started = true;
    S.tick = 0;
    S.lastSpeakAt = 0;
    S.lastCode = '';
    S.lastCodeAt = 0;
    S.emaSkill = 0.45;
    S.emaFrustration = 0.25;
    S.emaFatigue = 0.15;

    speak({
      type:'tip',
      code:'COACH_START',
      message: game==='hydration'
        ? '💧 โหมดฝึกสมดุลน้ำเริ่มแล้ว! คุม GREEN ให้ผ่าน Stage 1 ก่อนนะ'
        : 'เริ่มเกมแล้ว! ลองรักษาคอมโบให้ยาวขึ้นนะ',
      why: 'แนะนำเป้าหมายหลักของรอบเล่น',
      data:{}
    });
  }

  function onUpdate(state={}){
    if (!S.started) return;
    S.tick++;

    const skill = clamp(state.skill ?? 0.5, 0, 1);
    const fr = clamp(state.frustration ?? 0.25, 0, 1);
    const fat = clamp(state.fatigue ?? 0.2, 0, 1);

    S.emaSkill = S.emaSkill*0.90 + skill*0.10;
    S.emaFrustration = S.emaFrustration*0.90 + fr*0.10;
    S.emaFatigue = S.emaFatigue*0.92 + fat*0.08;

    const st = Object.assign({}, state, {
      skill: S.emaSkill,
      frustration: S.emaFrustration,
      fatigue: S.emaFatigue
    });

    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;

    // transitions
    if (!S.last.inStorm && inStorm){
      speak({
        type:'warn',
        code:'H_STORM_START',
        message: game==='hydration'
          ? '🌀 STORM มาแล้ว! ทำ Mini: LOW/HIGH + pressure + BLOCK ช่วงท้าย'
          : 'ช่วงพิเศษเริ่มแล้ว!',
        why: 'เตือนเป้าหมายของช่วงกิจกรรมพิเศษ',
        data:{}
      });
    }

    if (inStorm && !S.last.inEndWindow && inEnd){
      speak({
        type:'warn',
        code:'H_ENTER_ENDWINDOW',
        message: game==='hydration' ? '⏳ เข้าช่วงท้ายพายุแล้ว! เตรียม BLOCK' : '⏳ ใกล้จบช่วงพิเศษ!',
        why:'End Window เป็นจุดตัดสินของ Mini/Boss',
        data:{}
      });
    }

    // periodic tip
    const msg = pickCoachMessage(st);
    if (msg) speak(msg);

    // store last
    S.last.inStorm = inStorm;
    S.last.inEndWindow = inEnd;
    S.last.waterZone = String(st.waterZone||'');
    S.last.shield = Number(st.shield||0);
    S.last.combo = Number(st.combo||0);
    S.last.misses = Number(st.misses||0);

    if (verbose && (S.tick % 180 === 0)){
      speak({ type:'debug', code:'COACH_DEBUG', message:'coach tick', why:'debug', data:{ st } });
    }
  }

  function onEnd(summary={}){
    const grade = String(summary.grade||'').toUpperCase();
    const acc = Number(summary.accuracyGoodPct||0);
    const miss = Number(summary.misses||0);

    let msg = 'จบรอบแล้ว!';
    let why = 'สรุปผลแบบสั้น';

    if (grade === 'SSS' || grade === 'SS'){
      msg = `🏆 เกรด ${grade}! โหดมาก—รักษาความแม่นแบบนี้ไว้`;
      why = 'คะแนนและความแม่นอยู่ในระดับสูง';
    } else if (acc >= 75 && miss <= 12){
      msg = `✅ ฟอร์มดีขึ้น! ลองดันคอมโบให้ยาวขึ้นอีกนิด เกรดจะกระโดด`;
      why = 'พื้นฐานดี แค่คอมโบ/ความนิ่งเพิ่มอีกนิด';
    } else if (miss >= 20){
      msg = `🎯 รอบหน้าโฟกัสลด MISS ก่อนเลย แล้วคะแนนจะพุ่งเอง`;
      why = 'MISS สูงทำให้คอมโบแตกและเกรดลด';
    }

    speak({
      type:'praise',
      code:'COACH_END',
      message: msg,
      why,
      data:{ grade, acc, miss }
    });
  }

  function say(payload){ return speak(payload || {}); }

  function reset(){
    S.started=false;
    S.tick=0;
    S.lastSpeakAt=0;
    S.lastCode='';
    S.lastCodeAt=0;
  }

  return { onStart, onUpdate, onEnd, say, reset };
}

// Optional debug attach (safe)
try{
  if (typeof window !== 'undefined'){
    window.HHA_AI_COACH = { createAICoach };
  }
}catch(_){}