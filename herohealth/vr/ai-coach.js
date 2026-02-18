// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips, rate-limited)
// ✅ API: createAICoach({ emit, game, cooldownMs })
// Returns: { onStart(), onUpdate(state), onEnd(summary), push(text, meta?) }
// Emits: hha:coach { game, type:'tip'|'milestone'|'end', text, meta }

export function createAICoach(opts = {}){
  const emit = typeof opts.emit === 'function' ? opts.emit : (n,d)=>{ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };
  const game = String(opts.game || 'game');
  const cooldownMs = Math.max(800, Number(opts.cooldownMs) || 2500);

  const S = {
    started:false,
    lastSayAt:0,
    lastKey:'',
    lastStateAt:0,
    seenStorm:false,
    seenEndWindow:false,
    praiseCount:0,
  };

  function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
  function canSay(key){
    const t = now();
    if (t - S.lastSayAt < cooldownMs) return false;
    if (key && key === S.lastKey) return false;
    S.lastSayAt = t;
    S.lastKey = key || '';
    return true;
  }

  function say(text, meta = {}, type='tip'){
    if (!text) return false;

    // also mirror to #water-tip if exists (Hydration has it)
    try{
      const el = document.getElementById('water-tip');
      if (el && typeof text === 'string') el.textContent = text;
    }catch(_){}

    emit('hha:coach', { game, type, text, meta });
    return true;
  }

  function explain(label, why){
    return `${label}\nเพราะ: ${why}`;
  }

  function onStart(){
    S.started = true;
    S.seenStorm = false;
    S.seenEndWindow = false;
    S.praiseCount = 0;
    say(`เริ่มเลย! โฟกัสคุม GREEN ก่อน 💧`, { phase:'start' }, 'milestone');
  }

  function onUpdate(st = {}){
    const t = now();
    if (t - S.lastStateAt < 250) return;
    S.lastStateAt = t;

    const skill = clamp01(st.skill);
    const fatigue = clamp01(st.fatigue);
    const frustration = clamp01(st.frustration);
    const inStorm = !!st.inStorm;
    const inEndWindow = !!st.inEndWindow;
    const waterZone = String(st.waterZone || '');
    const shield = Number(st.shield || 0);
    const misses = Number(st.misses || 0);
    const combo = Number(st.combo || 0);

    // 1) Storm first time
    if (inStorm && !S.seenStorm){
      S.seenStorm = true;
      if (canSay('storm1')){
        say(explain(
          `STORM มาแล้ว! ตอนนี้ต้องทำ Mini`,
          `ทำให้น้ำออกจาก GREEN (LOW/HIGH) แล้วเก็บ 🛡️ ไว้ BLOCK ช่วงท้าย`
        ), { tip:'storm_intro', waterZone, shield }, 'milestone');
      }
      return;
    }

    // 2) End window hint
    if (inEndWindow && inStorm && !S.seenEndWindow){
      S.seenEndWindow = true;
      if (canSay('endwin1')){
        say(explain(
          `END WINDOW! ถึงเวลาบล็อก`,
          `แตะยิงใส่ 🥤/🌩️ ตอนมี 🛡️ เพื่อ BLOCK ให้ผ่าน Mini`
        ), { tip:'end_window', shield }, 'milestone');
      }
      return;
    }
    if (!inEndWindow) S.seenEndWindow = false;

    // 3) Skill-based coaching
    if (misses >= 12 && frustration >= 0.55){
      if (canSay('miss_fix')){
        say(explain(
          `MISS เยอะไปนิด 😅`,
          `หยุดรัว 0.5 วิ แล้วค่อยยิงเป้าที่ชัวร์ (คอมโบจะกลับมา)`
        ), { tip:'miss_fix' });
      }
      return;
    }

    if (waterZone === 'GREEN' && combo >= 10 && S.praiseCount < 3){
      if (canSay('praise_green_combo')){
        S.praiseCount++;
        say(`โหดมาก! คุม GREEN + คอมโบยาว ๆ แบบนี้เกรดพุ่งแน่ 🔥`, { tip:'praise' });
      }
      return;
    }

    if (inStorm && shield <= 0 && canSay('need_shield')){
      say(`ตอนพายุพยายามเก็บ 🛡️ ก่อนนะ แล้วรอท้ายพายุค่อย BLOCK`, { tip:'need_shield' });
      return;
    }

    if (!inStorm && waterZone !== 'GREEN' && canSay('back_to_green')){
      say(`นอกพายุให้ดันกลับ GREEN เพื่อสะสม Stage1 💧`, { tip:'back_to_green' });
      return;
    }

    // 4) Fatigue nudge
    if (fatigue >= 0.75 && canSay('fatigue')){
      say(`ใกล้จบแล้ว! เน้นยิงชัวร์ + กัน MISS จะได้ S/A ง่ายขึ้น`, { tip:'fatigue' });
    }
  }

  function onEnd(summary = {}){
    const grade = String(summary.grade || '');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const boss = Number(summary.bossClearCount || 0);

    let text = `จบแล้ว! เกรด ${grade}`;
    if (boss > 0) text += ` + เคลียร์ BOSS ✅`;
    if (acc >= 80) text += ` (Accuracy ดีมาก)`;
    if (miss >= 18) text += ` (ลด MISS อีกนิดจะโหดมาก)`;

    say(text, { type:'end', grade, acc, miss, boss }, 'end');
  }

  function push(text, meta){
    if (!canSay('push:'+String(text).slice(0,24))) return false;
    return say(text, meta || {}, 'tip');
  }

  return { onStart, onUpdate, onEnd, push };
}

function clamp01(v){
  v = Number(v) || 0;
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}