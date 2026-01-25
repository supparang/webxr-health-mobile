// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable Micro-tips)
// ✅ createAICoach({ emit, game, cooldownMs, maxBurst, debug })
// ✅ Rate-limited tips (anti-spam) + context-aware
// ✅ Explainable: every tip has {why, how} + tags for research logging
// ✅ Deterministic-friendly: no randomness required (unless you add)
// ✅ Emits: hha:coach { game, type:'tip'|'stage'|'start'|'end', ... }
//
// Usage:
// import { createAICoach } from '../vr/ai-coach.js';
// const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs: 3000 });
// AICOACH.onStart();
// AICOACH.onUpdate({ skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo });
// AICOACH.onEnd(summary);

'use strict';

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'hha').toLowerCase();
  const cooldownMs = clampInt(opts.cooldownMs ?? 2800, 800, 12000);
  const maxBurst = clampInt(opts.maxBurst ?? 2, 1, 6);
  const debug = !!opts.debug;

  // Internal state
  const S = {
    started:false,
    ended:false,
    t0:0,
    lastTipAt:0,
    burst:0,
    lastKey:'',
    // soft memory to avoid repeating same pattern
    seen: new Map(), // key -> lastTime
    // running stats from updates
    last:{
      skill:0.5,
      fatigue:0,
      frustration:0.2,
      misses:0,
      combo:0,
      waterZone:'',
      shield:0,
      inStorm:false,
      inEndWindow:false
    }
  };

  function now(){ return (typeof performance!=='undefined' ? performance.now() : Date.now()); }
  function log(...a){ if(debug) console.log('[AI-COACH]', ...a); }

  // ---------- public API ----------
  function onStart(detail={}){
    if (S.started) return;
    S.started=true;
    S.ended=false;
    S.t0=now();
    S.lastTipAt=0;
    S.burst=0;
    S.lastKey='';
    S.seen.clear();

    emitSafe('hha:coach', {
      game, type:'start',
      message: pickStartMessage(game),
      why: 'เริ่มเกมแล้ว—โค้ชจะให้ทิปสั้น ๆ เป็นช่วง ๆ (ไม่สแปม)',
      how: 'ทำตามทีละข้อ แล้วคะแนน/เกรดจะไต่ขึ้นเอง',
      tags:['start','coach']
    });
  }

  function onUpdate(ctx={}){
    if (!S.started || S.ended) return;

    // normalize context (0..1 where relevant)
    const C = normalizeCtx(ctx, S.last);
    S.last = C;

    // rate limit / burst control
    const t = now();
    const canTalk = (t - S.lastTipAt) >= cooldownMs;

    // decay burst slowly
    if (t - S.lastTipAt > cooldownMs*2.2) S.burst = 0;

    if (!canTalk) return;
    if (S.burst >= maxBurst) return;

    // choose best tip by priority
    const tip = chooseTip(game, C);
    if (!tip) return;

    // avoid repeating same key too often
    if (!allowKey(tip.key, t)) return;

    // emit
    S.lastTipAt = t;
    S.burst++;

    emitSafe('hha:coach', {
      game,
      type:'tip',
      key: tip.key,
      message: tip.message,
      why: tip.why,
      how: tip.how,
      severity: tip.severity, // 1..3
      tags: tip.tags || []
    });

    log('TIP', tip.key, tip.message);
  }

  function onEnd(summary={}){
    if (S.ended) return;
    S.ended=true;

    const grade = String(summary.grade || '').toUpperCase();
    const acc = Number(summary.accuracyGoodPct ?? summary.accuracy ?? 0);

    const msg = buildEndMessage(game, grade, acc, summary);

    emitSafe('hha:coach', {
      game, type:'end',
      message: msg.message,
      why: msg.why,
      how: msg.how,
      tags:['end','coach', `grade:${grade||'NA'}`]
    });
  }

  // Optional: force tip (for debugging)
  function say(message, meta={}){
    const t = now();
    S.lastTipAt = t;
    S.burst = Math.min(maxBurst, S.burst+1);
    emitSafe('hha:coach', {
      game, type:'tip',
      key: meta.key || 'manual',
      message: String(message||''),
      why: meta.why || '',
      how: meta.how || '',
      severity: clampInt(meta.severity ?? 1, 1, 3),
      tags: meta.tags || ['manual']
    });
  }

  return { onStart, onUpdate, onEnd, say };
}

function emitSafe(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }
  catch(_){}
}

// ---------- tip brain ----------
function chooseTip(game, C){
  // Priority: safety/critical -> objective -> performance -> motivation
  const tips = [];

  // 1) High frustration / many misses
  if (C.frustration >= 0.72 || C.missRate >= 0.34){
    tips.push({
      key:'calm-aim',
      severity:3,
      message:'ช้าลงนิดนึง 🎯 เล็งให้ชัวร์ก่อนยิง แล้วค่อยรัวต่อ',
      why:'MISS เยอะจะตัดคอมโบ + กดเกรดลงเร็ว',
      how:'เลือกยิงเป้าที่ใกล้/ใหญ่ก่อน แล้วค่อยไปเป้าไกล',
      tags:['performance','miss','combo']
    });
  }

  // 2) Hydration-specific storm/end-window coaching
  if (game === 'hydration'){
    if (C.inStorm && !C.inEndWindow && (C.waterZone === 'GREEN')){
      tips.push({
        key:'storm-leave-green',
        severity:3,
        message:'Storm มาแล้ว 🌪️ ทำให้ Water ออก GREEN ก่อน (LOW/HIGH) เพื่อผ่าน Mini',
        why:'Mini ต้อง “LOW/HIGH + pressure + end window + block”',
        how:'พลาดไม่เป็นไร—ยิง/โดน BAD นิดเดียวให้หลุด GREEN แล้วรีบเก็บ 🛡️',
        tags:['storm','mission','zone']
      });
    }

    if (C.inStorm && C.inEndWindow && C.shield <= 0){
      tips.push({
        key:'end-window-need-shield',
        severity:3,
        message:'End Window แล้ว! 🛡️ ต้องมี Shield เพื่อ BLOCK ให้ผ่าน Mini',
        why:'ถ้าไม่มี Shield จะ block ไม่ได้ (Mini ไม่ผ่าน)',
        how:'ก่อนพายุรอบหน้า เก็บ 🛡️ ไว้ 1–2 อัน แล้วค่อยทำ End Window',
        tags:['storm','endwindow','shield']
      });
    }

    if (C.inStorm && C.inEndWindow && C.shield > 0){
      tips.push({
        key:'end-window-block',
        severity:2,
        message:'ตอนนี้แหละ! ✨ ใช้ 🛡️ BLOCK ช่วงท้าย (End Window) แล้วจะได้โบนัส',
        why:'จังหวะท้ายพายุคือเงื่อนไขผ่าน Mini และมีแต้มเพิ่ม',
        how:'ยืนคุมใจ—ยิงเฉพาะเป้า BAD/🌩️ ที่มั่นใจว่าบล็อกได้',
        tags:['storm','endwindow','block']
      });
    }

    if (C.inStorm && C.inEndWindow && C.bossLikely){
      tips.push({
        key:'boss-window',
        severity:2,
        message:'Boss Window! 🌩️ เป้า BAD จะถี่ขึ้น—เก็บแต้มด้วยการ BLOCK ให้ครบ',
        why:'Boss clear ต้อง BLOCK 🌩️ ให้ถึงจำนวนที่กำหนด',
        how:'กันพลาด: ไม่ต้องรัว ยิงเฉพาะจังหวะที่ล็อกกลางจอ/ใกล้ ๆ',
        tags:['boss','storm','block']
      });
    }
  }

  // 3) Low skill early — basic guidance
  if (C.playedSec < 18 && C.skill < 0.45){
    tips.push({
      key:'basic-focus',
      severity:2,
      message:'โฟกัสเป้าดี 💧 ก่อนนะ แล้วค่อยหลบ/บล็อก 🥤',
      why:'ช่วงต้น ถ้าคุมคอมโบได้ จะดันเกรดเร็วมาก',
      how:'ยิงดีให้ต่อเนื่อง 5–8 ครั้ง แล้วค่อยเก็บโล่',
      tags:['basic','combo']
    });
  }

  // 4) Combo coaching
  if (C.combo >= 10 && C.skill >= 0.55){
    tips.push({
      key:'extend-combo',
      severity:1,
      message:'คอมโบสวยมาก! 🔥 รักษาจังหวะเดิม แล้วคะแนนจะพุ่ง',
      why:'คอมโบช่วยแต้มต่อชิ้น + ลดโอกาสพลาด',
      how:'อย่ารัว—ให้จังหวะนิ่ง ๆ “ยิง–เห็นผล–ยิง”',
      tags:['combo','motivation']
    });
  }

  // 5) Shield economy
  if (C.shield <= 0 && C.missRate < 0.22 && C.playedSec > 12){
    tips.push({
      key:'save-shield',
      severity:2,
      message:'เก็บ 🛡️ ไว้หน่อยนะ—กันพลาดตอน Storm/Boss ได้คุ้มมาก',
      why:'Shield = ประกันชีวิต ลด MISS และช่วยผ่านเงื่อนไข Mini',
      how:'เห็นโล่เมื่อไหร่ ให้ prioritise 1 ชิ้นก่อน',
      tags:['shield','strategy']
    });
  }

  // 6) Generic motivation when calm but slow
  if (tips.length === 0 && C.playedSec > 12){
    tips.push({
      key:'steady',
      severity:1,
      message:'ไปต่อแบบนี้ได้เลย ✅ “นิ่งก่อนเร็ว” แล้วเกรดจะขึ้นเอง',
      why:'ความสม่ำเสมอสำคัญกว่าเล่นเร็ว',
      how:'รักษา Accuracy ให้สูงกว่าเดิมทีละนิด',
      tags:['motivation']
    });
  }

  // pick highest severity then by "fit"
  tips.sort((a,b)=> (b.severity-a.severity));
  return tips[0] || null;
}

function allowKey(key, t){
  // “cool repeat” per key ~ 9s
  const REP_MS = 9000;
  const self = allowKey._S || (allowKey._S = { seen:new Map() });
  const last = self.seen.get(key) || 0;
  if (t - last < REP_MS) return false;
  self.seen.set(key, t);
  return true;
}

// ---------- context normalization ----------
function normalizeCtx(ctx, prev){
  const skill = clamp01(ctx.skill ?? prev.skill ?? 0.5);
  const fatigue = clamp01(ctx.fatigue ?? prev.fatigue ?? 0);
  const frustration = clamp01(ctx.frustration ?? prev.frustration ?? 0.2);

  const misses = clampInt(ctx.misses ?? prev.misses ?? 0, 0, 9999);
  const combo = clampInt(ctx.combo ?? prev.combo ?? 0, 0, 9999);
  const shield = clampInt(ctx.shield ?? prev.shield ?? 0, 0, 99);

  const waterZone = String(ctx.waterZone ?? prev.waterZone ?? '').toUpperCase();
  const inStorm = !!(ctx.inStorm ?? prev.inStorm ?? false);
  const inEndWindow = !!(ctx.inEndWindow ?? prev.inEndWindow ?? false);

  const playedSec = clamp01(Number(ctx.playedSec ?? 0) / 120) * 120; // optional
  // if caller doesn't provide playedSec, approximate by fatigue*planned? (keep simple)
  const playedApprox = playedSec > 0 ? playedSec : (fatigue * 90);

  const missRate = clamp01((misses/Math.max(1, (playedApprox/6)+6))); // coarse
  const bossLikely = !!ctx.bossLikely || (inStorm && inEndWindow); // hydration heuristic

  return {
    skill, fatigue, frustration,
    misses, combo, shield,
    waterZone, inStorm, inEndWindow,
    playedSec: playedApprox,
    missRate,
    bossLikely
  };
}

// ---------- end messaging ----------
function buildEndMessage(game, grade, acc, summary){
  const tips = [];
  const miss = Number(summary.misses||0);
  const stage = Number(summary.stageCleared||0);

  if (stage < 1) tips.push('โฟกัส Stage1: คุม GREEN ให้ผ่านก่อน');
  else if (stage < 2) tips.push('Stage2: ตอน Storm ต้องทำ LOW/HIGH + BLOCK ช่วงท้าย');
  else if (stage < 3) tips.push('Stage3: รอ Boss Window แล้ว BLOCK 🌩️ ให้ครบ');

  if (acc < 60) tips.push('Accuracy ต่ำ: ช้าลงนิดนึงแล้วเล็งให้ชัวร์');
  if (miss > 20) tips.push('MISS เยอะ: ลดการรัว + เลือกยิงเป้าชัวร์');

  let message = 'สรุป: เก่งขึ้นแน่ ✅';
  if (grade === 'SSS' || grade === 'SS') message = 'สุดยอดมาก! 🏆 เกรดสูงมาก';
  else if (grade === 'S' || grade === 'A') message = 'ดีมาก! 🔥 อีกนิดเดียวจะ S/SS';
  else if (grade === 'B') message = 'โอเคเลย 👍 ตอนนี้ขยับไป A ได้แน่';
  else message = 'ยังไต่ได้อีกเยอะ 💪 เดี๋ยวรอบหน้าดีขึ้นชัด';

  return {
    message: `${message}\n• ${tips.join('\n• ') || 'เล่นต่ออีกนิด แล้วทำตามทิปที่โค้ชบอก'}`,
    why: 'คะแนน/เกรดมาจากความแม่น + คุมคอมโบ + ผ่านภารกิจ',
    how: 'เล่นซ้ำโดยตั้งเป้า “Accuracy + ผ่าน Stage ทีละขั้น”'
  };
}

// ---------- start message ----------
function pickStartMessage(game){
  if (game === 'hydration'){
    return 'เป้าหมายหลัก: คุม 💧 ให้ Water อยู่ GREEN นาน ๆ แล้วค่อยผ่าน Storm/Boss';
  }
  return 'เริ่มเลย! โค้ชจะให้ทิปสั้น ๆ ช่วยเพิ่มคะแนนแบบไม่สแปม';
}

// ---------- utils ----------
function clamp01(v){ v=Number(v)||0; return v<0?0:(v>1?1:v); }
function clampInt(v,a,b){ v=(Number(v)||0)|0; return v<a?a:(v>b?b:v); }