// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable Micro-Tips) — PRODUCTION (lightweight, safe)
// ✅ createAICoach({emit, game, cooldownMs})
// ✅ onStart(), onUpdate(ctx), onEnd(summary)
// ✅ rate-limit tips (cooldown), suppress spam, context-aware tips
// ✅ emits: hha:coach { type:'tip', code, text, why, prio, game }
// ✅ deterministic-friendly: no random needed (uses thresholds only)
//
// Designed for HeroHealth mini-games:
// - hydration / goodjunk / plate / groups etc.

'use strict';

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}
function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

export function createAICoach(opts = {}){
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const game = String(opts.game || 'game').toLowerCase();
  const cooldownMs = clamp(opts.cooldownMs ?? 2800, 800, 15000);

  const S = {
    started:false,
    ended:false,
    t0:0,
    lastTipAt:0,
    lastCode:'',
    codeCount:{},     // per-code throttling
    totalTips:0,

    // snapshot for delta-based logic
    prev:{
      misses:0,
      combo:0,
      frustration:0,
      fatigue:0,
      skill:0,
      inStorm:false,
      inEndWindow:false,
      waterZone:'',
      shield:0
    }
  };

  function canTip(code){
    const t = nowMs();
    if (S.ended) return false;
    if (t - S.lastTipAt < cooldownMs) return false;

    // prevent repeating same tip code too often
    if (S.lastCode === code && (t - S.lastTipAt) < cooldownMs*2.2) return false;

    const c = S.codeCount[code] || 0;
    if (c >= 3) return false; // hard cap per session
    return true;
  }

  function pushTip({code, text, why='', prio=1}){
    if (!code || !text) return false;
    if (!canTip(code)) return false;

    const payload = {
      type:'tip',
      game,
      code:String(code),
      text:String(text),
      why:String(why || ''),
      prio: clamp(prio, 1, 5)
    };

    try{ emit('hha:coach', payload); }catch(_){}

    S.lastTipAt = nowMs();
    S.lastCode = payload.code;
    S.codeCount[payload.code] = (S.codeCount[payload.code]||0) + 1;
    S.totalTips++;
    return true;
  }

  // ---------- Tip rules (by game) ----------
  function rulesHydration(ctx){
    // ctx fields expected (from hydration.safe.js):
    // skill 0..1, fatigue 0..1, frustration 0..1,
    // inStorm bool, inEndWindow bool, waterZone string, shield int, misses int, combo int

    const skill = clamp(ctx.skill, 0, 1);
    const fatigue = clamp(ctx.fatigue, 0, 1);
    const frustr = clamp(ctx.frustration, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = ctx.shield|0;
    const misses = ctx.misses|0;
    const combo = ctx.combo|0;

    // 1) early onboarding
    if (S.totalTips <= 0 && fatigue < 0.12){
      if (pushTip({
        code:'HYD_START_1',
        text:'ทริค: ยิง 💧 เพื่อคุมให้น้ำอยู่ “GREEN” ให้นานที่สุด',
        why:'อยู่ GREEN จะสะสม Stage1 ได้เร็วและลดความกดดันตอนพายุ',
        prio:3
      })) return;
    }

    // 2) accuracy / aiming
    if (frustr > 0.62 && skill < 0.55 && misses - S.prev.misses >= 2){
      if (pushTip({
        code:'HYD_AIM_1',
        text:'เล็งนิ่ง ๆ ก่อนยิง 0.2 วิ แล้วค่อยกด (ลดการรัว)',
        why:'MISS สูงทำให้คะแนนตกและหลุดคอมโบง่าย',
        prio:4
      })) return;
    }

    // 3) combo encouragement
    if (combo >= 10 && combo - S.prev.combo >= 5 && skill >= 0.62){
      if (pushTip({
        code:'HYD_COMBO_1',
        text:'คอมโบกำลังมา! เลือกยิงเป้าที่ชัวร์ก่อน เพื่อยืดสตรีค',
        why:'สตรีคยาวช่วยดันเกรดและคะแนนพุ่งไว',
        prio:2
      })) return;
    }

    // 4) Storm prep: need shield
    if (!inStorm && fatigue > 0.18 && shield <= 0){
      if (pushTip({
        code:'HYD_SHIELD_PREP',
        text:'เก็บ 🛡️ ไว้ก่อนพายุ 1–2 อัน แล้วค่อยลุย Storm Mini',
        why:'ช่วง End Window ต้องใช้ 🛡️ BLOCK เพื่อผ่าน Stage2/3',
        prio:4
      })) return;
    }

    // 5) Storm: zone must be LOW/HIGH (not GREEN)
    if (inStorm && !inEnd && zone === 'GREEN'){
      if (pushTip({
        code:'HYD_STORM_ZONE',
        text:'ตอนพายุ: ทำให้น้ำ “ไม่เป็น GREEN” (LOW/HIGH) ก่อนถึงท้ายพายุ',
        why:'Mini จะเช็คเงื่อนไข LOW/HIGH + สะสมแรงกดดันให้ครบ',
        prio:5
      })) return;
    }

    // 6) End window: block now
    if (inStorm && inEnd){
      if (shield <= 0){
        if (pushTip({
          code:'HYD_END_NEED_SHIELD',
          text:'End Window มาแล้ว! ถ้าไม่มี 🛡️ ให้เล่นปลอดภัย ลดการโดน 🥤',
          why:'โดน BAD ช่วงพายุทำให้ Mini แพ้ได้',
          prio:5
        })) return;
      } else {
        if (pushTip({
          code:'HYD_END_BLOCK',
          text:'End Window! ใช้ 🛡️ BLOCK ให้ได้อย่างน้อย 1 ครั้ง (ห้ามโดน 🥤)',
          why:'ผ่าน Mini ต้อง “BLOCK ในช่วงท้าย” + ไม่โดน BAD',
          prio:5
        })) return;
      }
    }

    // 7) Boss window hint (late storm)
    // (we infer boss-ish by: inStorm && inEnd and shield>=1 and skill ok)
    if (inStorm && inEnd && shield >= 1 && skill >= 0.55 && fatigue > 0.25){
      if (pushTip({
        code:'HYD_BOSS_1',
        text:'ถ้าเห็น 🌩️ โผล่ถี่ช่วงท้ายพายุ: โฟกัส BLOCK 🌩️ ให้ครบเพื่อเคลียร์ BOSS',
        why:'Stage3 ต้อง BLOCK 🌩️ สะสมให้ครบตามที่กำหนด',
        prio:4
      })) return;
    }

    // 8) fatigue: keep calm
    if (fatigue > 0.75 && frustr > 0.55){
      if (pushTip({
        code:'HYD_FATIGUE',
        text:'ใกล้จบแล้ว! เล่นนิ่ง ๆ เน้นเป้าที่ชัวร์ ลด MISS จะดันเกรดได้ทัน',
        why:'ช่วงท้าย ความนิ่งสำคัญกว่าความเร็ว',
        prio:3
      })) return;
    }
  }

  function rulesGeneric(ctx){
    // fallback tips for other games
    const skill = clamp(ctx.skill, 0, 1);
    const frustr = clamp(ctx.frustration, 0, 1);
    const misses = ctx.misses|0;
    if (frustr > 0.65 && skill < 0.55 && misses - S.prev.misses >= 2){
      pushTip({
        code:'GEN_AIM_1',
        text:'ลดการรัว + เล็งให้ชัวร์ก่อนยิง จะคุมเกมได้ง่ายขึ้น',
        why:'ช่วยลด miss และรักษาคอมโบ',
        prio:3
      });
    }
  }

  function onStart(){
    S.started = true;
    S.ended = false;
    S.t0 = nowMs();
    S.lastTipAt = 0;
    S.lastCode = '';
    S.codeCount = {};
    S.totalTips = 0;
    S.prev = {
      misses:0, combo:0, frustration:0, fatigue:0, skill:0,
      inStorm:false, inEndWindow:false, waterZone:'', shield:0
    };

    // small "hello" without spam
    pushTip({
      code:'HELLO',
      text:'โหมดโค้ชพร้อมแล้ว ✅ ถ้าพลาดบ่อย เดี๋ยวจะบอกทริคให้เป็นช่วง ๆ',
      why:'โค้ชจะเตือนเฉพาะจังหวะสำคัญ (ไม่สแปม)',
      prio:1
    });
  }

  function onUpdate(ctx = {}){
    if (!S.started || S.ended) return;

    // choose rule set
    if (game === 'hydration') rulesHydration(ctx);
    else rulesGeneric(ctx);

    // update prev snapshot (for delta detection)
    S.prev.misses = ctx.misses|0;
    S.prev.combo = ctx.combo|0;
    S.prev.frustration = clamp(ctx.frustration, 0, 1);
    S.prev.fatigue = clamp(ctx.fatigue, 0, 1);
    S.prev.skill = clamp(ctx.skill, 0, 1);
    S.prev.inStorm = !!ctx.inStorm;
    S.prev.inEndWindow = !!ctx.inEndWindow;
    S.prev.waterZone = String(ctx.waterZone||'');
    S.prev.shield = ctx.shield|0;
  }

  function onEnd(summary = {}){
    if (S.ended) return;
    S.ended = true;

    // One final actionable wrap-up (no spam)
    const g = String(summary.grade || '').toUpperCase();
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stormOk = Number(summary.stormSuccess || summary.miniCleared || 0);

    let text = 'จบเกมแล้ว ✅';
    let why  = '';

    if (g === 'SSS' || g === 'SS'){
      text = 'โหดมาก! เก็บความนิ่งไว้แบบนี้ แล้วลองดัน “MISS ต่ำกว่าเดิม” อีกนิด';
      why  = 'เกรดสูงสุดขึ้นกับความนิ่งและการรักษาคอมโบ';
    } else if (stormOk <= 0){
      text = 'รอบหน้าโฟกัส “ผ่าน Storm Mini” ก่อน: LOW/HIGH + BLOCK ช่วง End Window';
      why  = 'ผ่าน Mini = ปลดล็อก Stage2 และทางไป Stage3';
    } else if (acc < 70){
      text = 'รอบหน้าเน้นเล็งให้ชัวร์ก่อนยิง จะดัน Accuracy > 70% ได้ไว';
      why  = 'Accuracy เป็นตัวหลักที่พาเกรดจาก B→A→S';
    } else if (miss > 15){
      text = 'รอบหน้าเล่นปลอดภัย ลดการโดน BAD และอย่ารัว จะกด MISS ลงได้เยอะ';
      why  = 'MISS เยอะทำให้หลุดคอมโบและคะแนนตก';
    } else {
      text = 'รอบหน้าลองลากคอมโบยาวขึ้น + เก็บ 🛡️ ก่อนพายุ จะเคลียร์ครบทุกสเตจง่ายขึ้น';
      why  = 'คอมโบ + การเตรียมโล่ทำให้ช่วงพายุไม่พัง';
    }

    try{
      emit('hha:coach', { type:'end', game, text, why, prio:3 });
    }catch(_){}
  }

  return { onStart, onUpdate, onEnd };
}