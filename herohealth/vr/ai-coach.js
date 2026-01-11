// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable micro-tips)
// ✅ createAICoach({ emit, game, cooldownMs }): returns { onStart, onUpdate, onEnd, pushTip }
// ✅ Rate-limited tips (anti-spam)
// ✅ Explainable: each tip has "why" + "action"
// ✅ Cross-game safe: no dependencies, pure JS
//
// Events emitted (optional):
// - hha:coach { game, type:'tip'|'stage'|'summary', level, title, message, why, action, ts }
// - hha:ai    { game, kind:'coach', tipId, ts }  (light telemetry)
//
// Notes:
// - In research mode you can keep this enabled or disable by caller. (Hydration uses it always, OK.)
// - You can also wire these tips to a HUD toast UI later.

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function now(){ return Date.now(); }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function safeEmit(emit, name, detail){
  try{
    if (typeof emit === 'function') emit(name, detail);
    else ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

function makeId(prefix='tip'){
  return prefix + '_' + Math.random().toString(16).slice(2) + '_' + (now().toString(36));
}

function text(x, fallback=''){
  if (x == null) return fallback;
  const s = String(x);
  return s.length ? s : fallback;
}

// --- small heuristic helpers ---
function pickLevel({ frustration=0, fatigue=0, skill=0 }){
  // 0..1 inputs
  const f = clamp(frustration,0,1);
  const t = clamp(fatigue,0,1);
  const s = clamp(skill,0,1);

  // calm when frustrated/fatigued
  if (f > 0.72 || t > 0.80) return 'calm';
  if (s > 0.75 && f < 0.45) return 'hype';
  return 'coach';
}

function shouldTipCoolDown(S, cooldownMs){
  const cd = Math.max(300, Number(cooldownMs)||2500);
  return (now() - S.lastTipAt) < cd;
}

function uniqKey(obj){
  // dedupe by stable "type|title|action"
  try{
    return [
      obj?.type || '',
      obj?.title || '',
      obj?.action || '',
      obj?.why || ''
    ].join('|').slice(0, 220);
  }catch(_){
    return '';
  }
}

export function createAICoach(opts={}){
  const emit = opts.emit;
  const game = text(opts.game, 'game');
  const cooldownMs = Number(opts.cooldownMs ?? 2800);

  const S = {
    startedAt: 0,
    lastTipAt: 0,
    lastStageAt: 0,
    lastUpdateAt: 0,
    tipCount: 0,
    // simple memory to avoid repeating same tip too often
    recent: [],
    recentMax: 10,

    // rolling states for detection
    prev: {
      misses: 0,
      combo: 0,
      skill: 0.45,
      frustration: 0.0,
      fatigue: 0.0,
      inStorm: false,
      inEndWindow: false,
      waterZone: 'GREEN',
      shield: 0
    },

    // anti-noise counters
    lowAccTicks: 0,
    highAccTicks: 0,
    missSpikeTicks: 0,
    stormFailRiskTicks: 0,
    bossWindowTicks: 0
  };

  function rememberTip(key){
    if (!key) return;
    S.recent.push({ key, ts: now() });
    if (S.recent.length > S.recentMax) S.recent.splice(0, S.recent.length - S.recentMax);
  }

  function seenRecently(key, withinMs=20000){
    const t = now();
    return S.recent.some(it => it && it.key === key && (t - it.ts) <= withinMs);
  }

  function pushTip(tip){
    const level = tip.level || pickLevel(tip);
    const payload = {
      game,
      type: 'tip',
      level,
      tipId: tip.tipId || makeId('tip'),
      title: text(tip.title,'Tip'),
      message: text(tip.message,''),
      why: text(tip.why,''),
      action: text(tip.action,''),
      ts: now()
    };

    const key = uniqKey(payload);
    if (seenRecently(key, 18000)) return false;
    if (shouldTipCoolDown(S, cooldownMs)) return false;

    S.lastTipAt = now();
    S.tipCount++;

    rememberTip(key);

    safeEmit(emit, 'hha:coach', payload);
    safeEmit(emit, 'hha:ai', { game, kind:'coach', tipId: payload.tipId, ts: payload.ts });
    return true;
  }

  function stage(stageNo){
    // allow stage announcements but not spam
    const t = now();
    if ((t - S.lastStageAt) < 1200) return false;
    S.lastStageAt = t;

    safeEmit(emit, 'hha:coach', {
      game,
      type: 'stage',
      stage: stageNo|0,
      level: 'coach',
      title: `Stage ${stageNo|0}`,
      message: stageNo===1 ? 'คุม GREEN ให้ผ่านก่อน 💧'
            : stageNo===2 ? 'Storm Mini มาแล้ว! ทำ LOW/HIGH + BLOCK ช่วงท้าย 🛡️'
            : 'Boss Window! BLOCK 🌩️ ให้ครบ 🔥',
      ts: t
    });
    return true;
  }

  // --- per-game heuristics (Hydration-focused but generic enough) ---
  function analyzeHydration(ctx){
    // ctx fields are provided by hydration.safe.js
    const acc = clamp(ctx.skill ?? 0.5, 0, 1); // already a blended value in hydration.safe
    const fatigue = clamp(ctx.fatigue ?? 0, 0, 1);
    const frustration = clamp(ctx.frustration ?? 0, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = text(ctx.waterZone, 'GREEN');
    const shield = ctx.shield|0;
    const misses = ctx.misses|0;
    const combo = ctx.combo|0;

    // track stability
    if (acc < 0.52) S.lowAccTicks++; else S.lowAccTicks = Math.max(0, S.lowAccTicks-1);
    if (acc > 0.78) S.highAccTicks++; else S.highAccTicks = Math.max(0, S.highAccTicks-1);

    // miss spike
    const dm = Math.max(0, misses - (S.prev.misses|0));
    if (dm >= 2) S.missSpikeTicks += 2;
    else S.missSpikeTicks = Math.max(0, S.missSpikeTicks-1);

    // storm risk: in storm but zone is still GREEN or shield is 0
    if (inStorm){
      const risk = (zone === 'GREEN') || (shield <= 0);
      if (risk) S.stormFailRiskTicks++; else S.stormFailRiskTicks = Math.max(0, S.stormFailRiskTicks-1);
    } else {
      S.stormFailRiskTicks = Math.max(0, S.stormFailRiskTicks-1);
    }

    // boss window presence
    if (inStorm && inEnd) S.bossWindowTicks++; else S.bossWindowTicks = Math.max(0, S.bossWindowTicks-1);

    // ------- decide tips (priority order) -------
    // 1) Calm down when frustrated
    if (frustration > 0.78 && !shouldTipCoolDown(S, cooldownMs)){
      return pushTip({
        level: 'calm',
        title: 'ช้าแต่ชัวร์ 👍',
        message: 'ลดการรัว แล้วโฟกัสยิงเป้าที่ “ใกล้กลางจอ” ก่อน',
        why: 'ตอนนี้ MISS/ความกดดันสูง ถ้ารัวจะพลาดเพิ่ม',
        action: 'เล็งค้าง 0.2 วิ → ยิงทีละนัด'
      });
    }

    // 2) Low accuracy guidance
    if (S.lowAccTicks >= 8){
      return pushTip({
        title: 'เพิ่ม Accuracy 🎯',
        message: 'ลอง “นิ่งก่อนยิง” แล้วค่อยกด ไม่ต้องรีบ',
        why: 'Accuracy ต่ำต่อเนื่อง ทำให้ Stage ผ่านช้าลง',
        action: 'เล็งให้กึ่งกลางเป้า แล้วกดครั้งเดียว'
      });
    }

    // 3) Storm mini hint: must be LOW/HIGH and block in end window
    if (inStorm && zone === 'GREEN' && S.stormFailRiskTicks >= 4){
      return pushTip({
        title: 'Storm Mini ต้องไม่ GREEN 🌀',
        message: 'ตอนพายุ ให้ดันน้ำออกจาก GREEN (LOW/HIGH) ก่อน แล้วค่อย BLOCK ช่วงท้าย',
        why: 'Mini ผ่านได้เมื่อ “ไม่ GREEN” + มีแรงกดดันครบ + BLOCK ช่วง End Window',
        action: 'ถ้าน้ำยัง GREEN: ยิง 🥤/หลบ 💧 ให้หลุดโซนก่อน'
      });
    }

    // 4) End window: block now
    if (inStorm && inEnd && shield <= 0){
      return pushTip({
        level: 'coach',
        title: 'End Window มาแล้ว! 🛡️',
        message: 'ต้องมี Shield เพื่อ BLOCK ช่วงท้ายพายุ',
        why: 'ช่วงท้ายคือจุดชี้เป็นชี้ตายของ Mini/Boss',
        action: 'ก่อนพายุ เก็บ 🛡️ ไว้ 1–2 อันเสมอ'
      });
    }

    // 5) Boss window hype if doing well
    if (inStorm && inEnd && combo >= 6 && acc > 0.70 && S.highAccTicks >= 6){
      return pushTip({
        level: 'hype',
        title: 'จังหวะทอง! 🔥',
        message: 'คอมโบกำลังมา—เก็บ 🛡️ แล้ว BLOCK 🌩️ ให้ครบ!',
        why: 'ช่วง Boss/End Window ได้แต้มและความก้าวหน้าสูงสุด',
        action: 'กันพลาด: อย่ายิงมั่ว เลือกเป้าที่แน่นอน'
      });
    }

    // 6) Fatigue hint late-game
    if (fatigue > 0.86){
      return pushTip({
        level: 'calm',
        title: 'ใกล้จบแล้ว 💪',
        message: 'โฟกัส “ไม่พลาด” มากกว่า “คอมโบ”',
        why: 'ท้ายเกมพลาดทีเดียวคะแนนและแรงกดดันพุ่ง',
        action: 'ยิงเฉพาะเป้าชัวร์ ลดความเสี่ยง'
      });
    }

    // no tip
    return false;
  }

  function onStart(){
    S.startedAt = now();
    S.lastUpdateAt = S.startedAt;
    S.lastTipAt = 0;
    S.tipCount = 0;
    S.recent = [];
    // one friendly intro (optional, light)
    pushTip({
      level: 'coach',
      title: 'พร้อมลุย! 💧',
      message: 'Stage1: คุม GREEN ให้ผ่านก่อน แล้วค่อยลุยพายุ+บอส',
      why: 'ผ่านทีละขั้น จะง่ายและเสถียรที่สุด',
      action: 'โฟกัส 💧 ให้แม่น และเก็บ 🛡️ ไว้ก่อนพายุ'
    });
  }

  function onUpdate(ctx){
    const t = now();
    // avoid running too frequently if caller calls every frame
    if ((t - S.lastUpdateAt) < 350) return;
    S.lastUpdateAt = t;

    // stage announcements if provided by game (optional)
    if (ctx && typeof ctx.stage === 'number'){
      // you can call coach.stage(stage) from outside too;
      // here we only announce if stage changed
      if ((ctx.stage|0) !== (S.prev.stage|0)){
        S.prev.stage = ctx.stage|0;
        stage(S.prev.stage);
      }
    }

    analyzeHydration(ctx || {});

    // store last
    S.prev.misses = ctx?.misses|0;
    S.prev.combo  = ctx?.combo|0;
    S.prev.skill  = clamp(ctx?.skill ?? S.prev.skill, 0, 1);
    S.prev.frustration = clamp(ctx?.frustration ?? S.prev.frustration, 0, 1);
    S.prev.fatigue = clamp(ctx?.fatigue ?? S.prev.fatigue, 0, 1);
    S.prev.inStorm = !!ctx?.inStorm;
    S.prev.inEndWindow = !!ctx?.inEndWindow;
    S.prev.waterZone = text(ctx?.waterZone, S.prev.waterZone);
    S.prev.shield = ctx?.shield|0;
  }

  function onEnd(summary){
    // final nudge (non-spammy)
    const acc = clamp(summary?.accuracyGoodPct ?? 0, 0, 100);
    const miss = summary?.misses|0;
    const stage = summary?.stageCleared|0;

    safeEmit(emit, 'hha:coach', {
      game,
      type: 'summary',
      level: 'coach',
      title: 'สรุปจากโค้ช 🧠',
      message:
        stage >= 3 ? 'คุณผ่านครบ 3 Stage แล้ว! โหดจัด 🔥'
      : stage === 2 ? 'คุณผ่าน Stage1–2 แล้ว เหลือบอสอีกนิดเดียว ⚡'
      : stage === 1 ? 'คุณผ่าน Stage1 แล้ว ต่อไปฝึก Storm Mini 🌀'
      : 'เริ่มดีแล้ว—คุม GREEN ให้ผ่านก่อนนะ 💧',
      why: `Accuracy ${acc.toFixed(1)}% • Miss ${miss}`,
      action:
        acc < 70 ? 'ฝึก “นิ่งก่อนยิง” เพื่อดัน Accuracy'
      : miss > 12 ? 'ลดการรัว เลือกยิงเป้าชัวร์'
      : 'ลองดันคอมโบยาว ๆ และเก็บ Shield ก่อนพายุ',
      ts: now()
    });
  }

  return {
    onStart,
    onUpdate,
    onEnd,
    pushTip
  };
}