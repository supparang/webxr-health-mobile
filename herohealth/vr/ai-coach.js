// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable Micro-tips) — PRODUCTION
// ✅ emit('hha:coach', {game,type,text,priority,reason,ts})
// ✅ Rate-limit + max per run
// ✅ Auto-disable in research (run=research or runMode=research)
// ✅ Hydration tips: GREEN hold, Storm Mini (LOW/HIGH+BLOCK end window), Boss window
// ✅ Generic hints: accuracy/frustration/skill

'use strict';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : ()=>{};
  const game = String(opts.game || 'generic');
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 800, 12000);
  const maxPerRun = clamp(opts.maxPerRun ?? 18, 4, 60);

  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const enabledByMode = (run !== 'research');         // ✅ research ปิด default
  const enabled = (opts.enabled ?? enabledByMode) ? true : false;

  // internal state
  const ST = {
    enabled,
    started:false,
    ended:false,
    count:0,
    lastAt:0,
    lastKey:'',
    // milestone flags (per run)
    toldStorm:false,
    toldEndWindow:false,
    toldBoss:false,
    toldGreen:false,
    toldShield:false,
    toldAccLow:false,
    toldMissHigh:false,
    lastStormState:'', // track transitions
  };

  function now(){ return Date.now(); }

  function canSpeak(key, priority=false){
    if (!ST.enabled || ST.ended) return false;
    if (ST.count >= maxPerRun) return false;

    const t = now();
    if (!priority){
      if (t - ST.lastAt < cooldownMs) return false;
      if (key && ST.lastKey === key) return false;
    } else {
      // priority: still prevent spam
      if (t - ST.lastAt < Math.max(900, Math.floor(cooldownMs*0.45))) return false;
    }
    return true;
  }

  function speak(type, text, reason, key, priority=false){
    if (!canSpeak(key, priority)) return false;

    ST.count++;
    ST.lastAt = now();
    ST.lastKey = key || `${type}:${text}`;

    emit('hha:coach', {
      game,
      type: String(type||'tip'),
      text: String(text||''),
      priority: !!priority,
      reason: reason || '',
      ts: ST.lastAt
    });
    return true;
  }

  // -------- Hydration specific rules --------
  function hydrationRules(s){
    // s: {skill,fatigue,frustration,inStorm,inEndWindow,waterZone,shield,misses,combo}
    const inStorm = !!s.inStorm;
    const inEnd = !!s.inEndWindow;
    const zone = String(s.waterZone || '');
    const shield = (s.shield|0);
    const miss = (s.misses|0);
    const skill = clamp(s.skill,0,1);
    const frus = clamp(s.frustration,0,1);

    // 1) remind stage2: ต้องทำให้ไม่ GREEN ก่อน storm mini ผ่าน
    if (inStorm && zone === 'GREEN' && !ST.toldGreen){
      if (speak(
        'tip',
        'Storm Mini ต้อง “ออกจาก GREEN” ก่อนนะ! ยิง 🥤/โดน BAD นิดเดียวให้เป็น LOW/HIGH แล้วค่อย BLOCK ช่วงท้าย',
        'storm & zone=GREEN',
        'hydr:storm_need_not_green'
      )){
        ST.toldGreen = true;
        return;
      }
    }

    // 2) shield hint early storm
    if (inStorm && !inEnd && shield <= 0 && !ST.toldShield){
      if (speak(
        'tip',
        'พายุมาแล้ว! รีบเก็บ 🛡️ อย่างน้อย 1 อันไว้ BLOCK ช่วง End Window',
        'storm & shield=0',
        'hydr:storm_need_shield'
      )){
        ST.toldShield = true;
        return;
      }
    }

    // 3) end window (priority)
    if (inStorm && inEnd && shield > 0 && !ST.toldEndWindow){
      if (speak(
        'urgent',
        'END WINDOW! ตอนนี้แหละ—แตะเพื่อ BLOCK 🥤 / 🌩️ ให้ครบ 🔥',
        'inEndWindow & shield>0',
        'hydr:end_window_block',
        true
      )){
        ST.toldEndWindow = true;
        return;
      }
    }

    // 4) boss window (priority) — ถ้าเกมส่ง inBoss ไม่มา เราใช้เงื่อนไข “inEnd && skill สูง” เป็น proxy ได้
    // (ใน hydration.safe.js คุณส่งข้อมูล inStorm/inEndWindow แล้ว — ถ้าจะให้แม่น 100% เพิ่ม inBoss มาใน onUpdate ก็ได้)
    if (inStorm && inEnd && skill >= 0.60 && shield > 0 && !ST.toldBoss){
      if (speak(
        'challenge',
        'โหมดบอส! 🌩️ จะโผล่ถี่ขึ้น—โฟกัส BLOCK ให้ครบตามจำนวน (อย่ารัวมั่ว)',
        'endWindow & skill>=0.60',
        'hydr:boss_hint',
        true
      )){
        ST.toldBoss = true;
        return;
      }
    }

    // 5) encouragement / control if frustration high
    if (frus >= 0.72 && miss >= 8 && !ST.toldMissHigh){
      if (speak(
        'coach',
        'MISS เริ่มสูงแล้ว—ช้าลงนิด เล็งให้ชัวร์ก่อนแตะ ยิงเฉพาะเป้าที่อยู่ใกล้กลางจอ',
        'frustration high',
        'hydr:miss_high'
      )){
        ST.toldMissHigh = true;
        return;
      }
    }

    // 6) accuracy low (generic)
    if (skill <= 0.32 && !ST.toldAccLow){
      if (speak(
        'coach',
        'ทริค: คุมจังหวะ “เล็งค้าง 0.2 วิ แล้วค่อยแตะ” จะนิ่งขึ้นและคอมโบมาเอง',
        'skill low',
        'hydr:skill_low'
      )){
        ST.toldAccLow = true;
        return;
      }
    }

    // 7) storm intro (once)
    if (inStorm && !ST.toldStorm){
      if (speak(
        'tip',
        'STORM! เป้าหมายคือ “LOW/HIGH + BLOCK ช่วงท้าย” และห้ามโดน BAD ตอนพายุ',
        'storm start',
        'hydr:storm_intro'
      )){
        ST.toldStorm = true;
        return;
      }
    }
  }

  // -------- Generic rules (fallback) --------
  function genericRules(s){
    const skill = clamp(s.skill,0,1);
    const frus = clamp(s.frustration,0,1);
    const fatigue = clamp(s.fatigue,0,1);

    if (frus >= 0.78){
      speak('coach', 'ใจเย็น ๆ เลือกยิงเป้าที่ชัวร์ก่อน แล้วค่อยเร่งสปีด', 'generic frustration', 'gen:frus');
      return;
    }
    if (fatigue >= 0.78 && skill <= 0.45){
      speak('coach', 'ช่วงท้ายเกมอย่ารัว—เน้นแม่นก่อน คะแนนจะคุ้มกว่า', 'generic fatigue', 'gen:fatigue');
      return;
    }
    if (skill >= 0.78){
      speak('challenge', 'โหดขึ้นละนะ—ลากคอมโบยาว ๆ แล้วเล็งเป้าเล็กให้ทัน!', 'generic high skill', 'gen:skill_hi');
      return;
    }
  }

  // public API
  return {
    enabled: ST.enabled,

    onStart(){
      if (!ST.enabled || ST.started) return;
      ST.started = true;

      if (game === 'hydration'){
        speak(
          'hello',
          'พร้อม! เป้าหมายคือคุม GREEN → ผ่าน STORM (LOW/HIGH + BLOCK) → เคลียร์บอส 🌩️',
          'start hydration',
          'hydr:start',
          true
        );
      } else {
        speak('hello', 'พร้อมเริ่ม! โฟกัสความแม่นก่อน แล้วคอมโบจะมาเอง', 'start generic', 'gen:start', true);
      }
    },

    onUpdate(state){
      if (!ST.enabled || ST.ended) return;
      const s = state || {};

      if (game === 'hydration') hydrationRules(s);
      else genericRules(s);
    },

    onEnd(summary){
      if (!ST.enabled || ST.ended) return;
      ST.ended = true;

      const g = String(summary?.grade || '');
      const acc = Number(summary?.accuracyGoodPct || 0);
      const miss = Number(summary?.misses || 0);
      const stage = Number(summary?.stageCleared || 0);

      if (game === 'hydration'){
        const msg =
          stage >= 3 ? 'สุดยอด! ผ่านครบ 3 Stage แล้ว 🌟' :
          stage === 2 ? 'ดีมาก! ผ่าน Storm Mini แล้ว ต่อไปเคลียร์บอส 🌩️' :
          stage === 1 ? 'ผ่าน Stage1 แล้ว ต่อไปโฟกัส Storm Mini (LOW/HIGH + BLOCK)' :
          'รอบหน้าเอาใหม่! โฟกัสคุม GREEN ก่อน แล้วค่อยลุยพายุ';

        speak('end', `${msg} (Grade ${g || '—'} | Acc ${acc.toFixed(0)}% | Miss ${miss|0})`, 'end hydration', 'hydr:end', true);
      } else {
        speak('end', `จบเกม! Grade ${g || '—'} | Acc ${acc.toFixed(0)}% | Miss ${miss|0}`, 'end generic', 'gen:end', true);
      }
    }
  };
}