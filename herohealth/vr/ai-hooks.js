// === /herohealth/vr/ai-hooks.js ===
// AI Hooks (OFF by default, especially in research)
// จุดเสียบสำหรับ:
// (1) AI Difficulty Director (fair, smooth)
// (2) AI Coach (micro tips, explainable)
// (3) AI Pattern/Spawn Generator (seeded/deterministic)
//
// Usage:
//   import { createAIHooks } from '../vr/ai-hooks.js';
//   const AI = createAIHooks({ enabled, seed, runMode, diff, game, emit });
//   AI.onStart(...); AI.onUpdate(...); AI.onEnd(...);
//   base = AI.tuneSpawn({...});
//   probs = AI.tuneKind({...});
//   s = AI.tuneSize({...});
//   px = AI.tuneAim({...});

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

export function createAIHooks(opts={}){
  const enabled = !!opts.enabled;
  const seed = String(opts.seed || Date.now());
  const runMode = String(opts.runMode || 'play').toLowerCase();
  const diff = String(opts.diff || 'normal').toLowerCase();
  const game = String(opts.game || 'game');
  const emit = (typeof opts.emit === 'function') ? opts.emit : ()=>{};

  // research/study: default OFF แม้ user ส่ง enabled มาผิด
  const safeEnabled = enabled && !(runMode === 'research' || runMode === 'study');

  // deterministic rng for AI decisions
  const rng = makeRng(`${seed}|AI|${game}`);

  // internal smooth signals
  const M = {
    t0: 0,
    lastTipAt: 0,
    // EMA signals
    emaSkill: 0.45,
    emaFrust: 0.20,
    emaFatigue: 0.0,
    // “pressure” จาก performance เพื่อปรับความยากแบบยุติธรรม
    directorK: 0.0, // -1..+1
  };

  function note(type, data){
    if (!safeEnabled) return;
    emit('hha:ai', { type, game, ...data });
  }

  function onStart(ctx={}){
    if (!safeEnabled) return;
    M.t0 = performance.now();
    note('start', { diff, runMode, seed });
  }

  function onUpdate(ctx={}){
    if (!safeEnabled) return;

    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const frust = clamp(ctx.frustration ?? 0.2, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0.0, 0, 1);

    // EMA
    M.emaSkill = M.emaSkill*0.90 + skill*0.10;
    M.emaFrust = M.emaFrust*0.90 + frust*0.10;
    M.emaFatigue = M.emaFatigue*0.92 + fatigue*0.08;

    // Director: ถ้า frust สูง -> ผ่อนเล็กน้อย / ถ้า skill สูง+frust ต่ำ -> เร่ง
    const want = clamp((M.emaSkill - 0.55)*1.25 - (M.emaFrust - 0.25)*1.35 - (M.emaFatigue - 0.55)*0.60, -1, 1);
    M.directorK = M.directorK*0.92 + want*0.08;

    // micro-tip แบบ rate-limit (ไม่ spam)
    const now = performance.now();
    const cooldown = 3500;
    if (now - M.lastTipAt > cooldown){
      // tip trigger เฉพาะช่วงสำคัญ (storm/endwindow) หรือ frust สูง
      const inStorm = !!ctx.inStorm;
      const inEnd = !!ctx.inEndWindow;
      if (inEnd || (inStorm && M.emaFrust > 0.55) || (M.emaSkill < 0.35 && M.emaFrust > 0.45)){
        M.lastTipAt = now;

        let msg = 'เล็งค้างนิด แล้วค่อยยิง';
        if (inEnd) msg = 'End Window มาแล้ว! เก็บ 🛡️ แล้ว BLOCK ให้ทัน';
        else if (ctx.shield <= 0 && inStorm) msg = 'พายุมาแล้ว แต่โล่หมด! โฟกัสหา 🛡️ ก่อน';
        else if (M.emaSkill > 0.72 && M.emaFrust < 0.30) msg = 'โหดได้! ลากคอมโบยาว ๆ แล้วคุมจังหวะ';

        emit('hha:coach', {
          type: 'ai-tip',
          game,
          msg,
          explain: `directorK=${M.directorK.toFixed(2)} skill=${M.emaSkill.toFixed(2)} frust=${M.emaFrust.toFixed(2)} fat=${M.emaFatigue.toFixed(2)}`
        });
      }
    }
  }

  function onEnd(summary={}){
    if (!safeEnabled) return;
    note('end', { grade: summary.grade, score: summary.scoreFinal, acc: summary.accuracyGoodPct, miss: summary.misses });
  }

  // ---- Tuning hooks ----
  function tuneSpawn(ctx={}){
    // ctx.baseMs, ctx.inStorm, ctx.adaptK, etc.
    let ms = Number(ctx.baseMs || 600);

    if (!safeEnabled) return ms;

    // directorK>0 = ยากขึ้น (ถี่ขึ้น), <0 = ผ่อน (ช้าลง)
    const k = clamp(M.directorK, -1, 1);

    // น้ำหนักคุมไม่ให้แกว่ง: ปรับแค่ ~±12%
    const mul = 1.0 - 0.12*k;

    // ถ้า frust สูงมาก -> ผ่อนเพิ่มอีกนิด
    const fr = M.emaFrust;
    const soft = (fr > 0.65) ? 1.08 : 1.0;

    ms = ms * mul * soft;

    // deterministic micro jitter เพิ่ม feel แต่ไม่ทำให้ unfair
    const j = (rng()*2-1) * 18; // +/-18ms
    return ms + j;
  }

  function tuneKind(ctx={}){
    // ctx: pGood, pBad, pSh, inStorm, inBoss
    let pGood = Number(ctx.pGood ?? 0.66);
    let pBad  = Number(ctx.pBad  ?? 0.28);
    let pSh   = Number(ctx.pSh   ?? 0.06);

    if (!safeEnabled) return { pGood, pBad, pSh };

    const k = clamp(M.directorK, -1, 1);

    // directorK>0 เพิ่ม bad นิด (โหดขึ้น), directorK<0 เพิ่ม good/shield (ผ่อน)
    // จำกัดการขยับไม่เกิน +/-0.06
    const delta = 0.06 * k;

    pBad  = clamp(pBad + delta, 0.12, 0.55);
    pGood = clamp(pGood - delta*0.75, 0.25, 0.80);

    // ถ้า frust สูง + storm: เพิ่ม shield เล็กน้อย (ให้โอกาสพลิกเกม)
    if (ctx.inStorm && M.emaFrust > 0.55){
      pSh = clamp(pSh + 0.03, 0.05, 0.18);
    } else {
      pSh = clamp(pSh + (-0.01*k), 0.04, 0.14);
    }

    // normalize
    const sum = pGood + pBad + pSh;
    pGood /= sum; pBad /= sum; pSh /= sum;

    return { pGood, pBad, pSh };
  }

  function tuneSize(ctx={}){
    let s = Number(ctx.s || 64);
    if (!safeEnabled) return s;

    // directorK>0 -> เป้าเล็กลงนิด (โหดขึ้น), <0 -> ใหญ่ขึ้นนิด
    const k = clamp(M.directorK, -1, 1);
    const mul = 1.0 - 0.08*k; // +/-8%
    s = s * mul;

    // ถ้า skill ต่ำ/ frust สูง -> เพิ่ม size ช่วยเล็กน้อย
    if (M.emaSkill < 0.35 && M.emaFrust > 0.45) s *= 1.06;

    return s;
  }

  function tuneAim(ctx={}){
    let px = Number(ctx.px || 56);
    if (!safeEnabled) return px;

    // directorK>0 -> lock แคบลง (โหดขึ้น), <0 -> กว้างขึ้น
    const k = clamp(M.directorK, -1, 1);
    px = px * (1.0 + (-0.10*k)); // +/-10%

    // ถ้า frust สูงมาก -> ช่วยเพิ่มอีกนิด
    if (M.emaFrust > 0.70) px *= 1.10;

    return px;
  }

  return {
    enabled: safeEnabled,
    note,
    onStart,
    onUpdate,
    onEnd,
    tuneSpawn,
    tuneKind,
    tuneSize,
    tuneAim
  };
}