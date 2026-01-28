// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// ✅ createAICoach({ emit, game, cooldownMs }) -> { onStart, onUpdate, onEnd }
// ✅ Default: disabled in research mode (?run=research or ?runMode=research) or ?ai=0
// ✅ Emits: hha:coach {game, text, key, level, icon}
// ✅ Safe no-op if emit missing

'use strict';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : (()=>{});
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 800, 15000);

  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const aiQ = String(qs('ai','1'));
  const enabled = (aiQ !== '0') && (run !== 'research');

  const S = {
    enabled,
    t0: 0,
    lastTipAt: 0,
    lastKey: '',
    // a tiny memory to avoid repeating
    seen: new Map(),
    // rolling signals
    lastMisses: 0,
    lastCombo: 0,
    lastWater: '',
    lastStorm: false,
    lastEndWindow: false,
    lastShield: 0,
  };

  function canSpeak(key){
    if (!S.enabled) return false;
    const now = Date.now();
    if (now - S.lastTipAt < cooldownMs) return false;
    if (S.lastKey === key) return false;
    const hit = S.seen.get(key) || 0;
    if (hit >= 3) return false; // cap repeats
    return true;
  }

  function speak(text, key, level='tip', icon='💡'){
    if (!text) return;
    key = String(key || text).slice(0,80);

    if (!canSpeak(key)) return;

    S.lastTipAt = Date.now();
    S.lastKey = key;
    S.seen.set(key, (S.seen.get(key)||0)+1);

    emit('hha:coach', { game, text, key, level, icon });
  }

  function onStart(){
    if (!S.enabled) return;
    S.t0 = Date.now();
    speak('เริ่มเลย! โฟกัสยิง 💧 ให้คุมน้ำอยู่ GREEN ก่อน แล้วค่อยลุยพายุ 🌀', 'start', 'tip', '🧠');
  }

  function onEnd(summary){
    if (!S.enabled) return;
    const g = String(summary?.grade || '');
    if (g === 'SSS' || g === 'SS') speak('โหดมาก! เกรดสูงสุดแล้ว ลองเพิ่มความยากหรือดันคอมโบยาว ๆ อีก!', 'end_hi', 'praise', '🏆');
    else if (g === 'S' || g === 'A') speak('ดีมาก! ถ้าลด MISS ลงอีกนิด เกรดจะพุ่งเลย', 'end_mid', 'tip', '⭐');
    else speak('ไม่เป็นไร ลอง “เล็งช้า ๆ ไม่รัว” แล้วเก็บ 🛡️ ก่อนพายุ จะผ่าน Mini ง่ายขึ้น', 'end_low', 'tip', '🛡️');
  }

  // Choose ONE best tip each tick (but rate-limited)
  function onUpdate(st){
    if (!S.enabled) return;
    st = st || {};

    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const waterZone = String(st.waterZone || '');
    const shield = Number(st.shield || 0);
    const misses = Number(st.misses || 0);
    const combo = Number(st.combo || 0);

    const frustration = clamp(st.frustration ?? 0, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);

    // 1) End window is urgent
    if (inStorm && inEnd && shield > 0){
      speak('ตอนนี้ END WINDOW! ใช้ 🛡️ BLOCK ให้ได้ (อย่าพลาด)', 'endwindow_block', 'urgent', '⏱️');
      S.lastEndWindow = inEnd;
      return;
    }
    if (inStorm && inEnd && shield <= 0){
      speak('END WINDOW มาแล้ว แต่ไม่มี 🛡️ — รอบหน้าตุนโล่ไว้ก่อนพายุ!', 'endwindow_noshield', 'urgent', '⚠️');
      S.lastEndWindow = inEnd;
      return;
    }

    // 2) Storm prep
    if (!inStorm && shield <= 0){
      speak('เตรียมพายุ: เก็บ 🛡️ สัก 1–2 อันไว้ก่อน จะผ่าน Mini ง่ายมาก', 'prep_shield', 'tip', '🛡️');
      return;
    }

    // 3) Water control guidance
    if (!inStorm && waterZone === 'GREEN'){
      if (combo >= 8) speak('คอมโบสวย! รักษา GREEN ต่อ แล้วเก็บแต้มยาว ๆ', 'green_combo', 'praise', '🔥');
      else speak('ตอนนี้ GREEN ดีแล้ว เล็งนิ่ง ๆ แล้วค่อยยิง จะคุมเกจง่ายขึ้น', 'green_hold', 'tip', '🟩');
      return;
    }
    if (inStorm && (waterZone === 'LOW' || waterZone === 'HIGH')){
      const side = (waterZone === 'LOW') ? 'LOW (ต่ำ)' : 'HIGH (สูง)';
      speak(`ดี! ตอนนี้อยู่นอก GREEN แล้ว (${side}) รอช่วงท้ายแล้ว BLOCK 🛡️`, 'storm_side_ok', 'tip', '🌀');
      return;
    }

    // 4) Accuracy / misses coaching
    const missDelta = misses - (S.lastMisses|0);
    if (missDelta >= 3 || frustration >= 0.75){
      speak('MISS ถี่ไปนิด — หยุดรัว 1 วิ แล้ว “เล็งให้ชัวร์ค่อยยิง”', 'miss_spike', 'tip', '🎯');
      S.lastMisses = misses;
      return;
    }

    if (fatigue >= 0.85){
      speak('ใกล้จบแล้ว! เล่นเนียน ๆ ไม่ต้องรีบ เก็บเป้าที่ชัวร์', 'fatigue', 'tip', '🏁');
      return;
    }

    // keep rolling state
    S.lastMisses = misses;
    S.lastCombo = combo;
    S.lastWater = waterZone;
    S.lastStorm = inStorm;
    S.lastEndWindow = inEnd;
    S.lastShield = shield;
  }

  return { onStart, onUpdate, onEnd };
}