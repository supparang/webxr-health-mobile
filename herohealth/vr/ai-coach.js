// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable + rate-limited + cross-game)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Emits: hha:coach { game, level, tag, msg, why, action, at, ctx }
// ✅ Safe defaults: does nothing if emit not provided
//
// Design goals:
// - Explainable micro-tips (why + action)
// - Rate-limit to avoid spam
// - Fair + non-invasive (no hidden difficulty changes here)
// - Works even if state fields are missing

'use strict';

export function createAICoach(opts = {}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : (()=>{});
  const GAME = String(opts.game || 'generic');
  const COOLDOWN = Math.max(700, Number(opts.cooldownMs || 3000));

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> Date.now();

  const S = {
    started:false,
    lastTipAt:0,
    lastTag:'',
    lastLevel:'',
    // simple memory for deltas
    prev: {
      score:0, combo:0, misses:0, shield:0,
      accuracy: null,
      inStorm:false, inEndWindow:false,
      waterZone:'',
    },
    // anti-repeat counters
    tagCount: Object.create(null),
    // "moment" gating
    suppressUntil: 0
  };

  function say(level, tag, msg, why, action, ctx){
    const t = now();
    if (t < S.suppressUntil) return false;

    // hard cooldown
    if (t - S.lastTipAt < COOLDOWN) return false;

    // avoid repeating same tag too often
    const c = (S.tagCount[tag]||0);
    if (tag === S.lastTag && c >= 1) return false;

    S.lastTipAt = t;
    S.lastTag = tag;
    S.lastLevel = level;
    S.tagCount[tag] = c + 1;

    emit('hha:coach', {
      game: GAME,
      level,          // 'info' | 'tip' | 'warn' | 'hype'
      tag,            // short key
      msg,            // short human text
      why,            // explainable reason (1-2 lines)
      action,         // what to do next (imperative)
      at: t,
      ctx: ctx || {}
    });
    return true;
  }

  // ---------- helpers: derive signals ----------
  function safeNum(x, d=0){ x=Number(x); return Number.isFinite(x)?x:d; }
  function bool(x){ return !!x; }

  function inferAccuracy(st){
    // allow explicit accuracy or compute from hits/spawns if present
    if (st && st.accuracyGoodPct != null){
      const a = safeNum(st.accuracyGoodPct, 0);
      // can be 0..100 or 0..1; normalize
      return (a <= 1.2) ? clamp(a*100,0,100) : clamp(a,0,100);
    }
    const hit = safeNum(st.nHitGood, NaN);
    const spawn = safeNum(st.nGoodSpawn, NaN);
    if (Number.isFinite(hit) && Number.isFinite(spawn) && spawn > 0){
      return clamp((hit/spawn)*100,0,100);
    }
    return null;
  }

  function inferFrustration(st){
    // 0..1 (approx)
    const miss = safeNum(st.misses, 0);
    const timeFrac = safeNum(st.fatigue, NaN); // allow caller provide
    const acc = inferAccuracy(st);
    let f = 0;

    // if caller provides frustration: trust it (0..1)
    if (st && st.frustration != null){
      f = safeNum(st.frustration, 0);
      return clamp(f, 0, 1);
    }

    // else infer
    const accBad = (acc==null) ? 0.45 : clamp(1 - (acc/100), 0, 1);
    f += accBad*0.55;
    f += clamp(miss/25, 0, 1)*0.45;

    // slight increase later in session
    if (Number.isFinite(timeFrac)) f = clamp(f + timeFrac*0.10, 0, 1);
    return clamp(f, 0, 1);
  }

  function inferSkill(st){
    // 0..1 (approx)
    if (st && st.skill != null) return clamp(st.skill,0,1);
    const acc = inferAccuracy(st);
    const combo = safeNum(st.combo, 0);
    const kAcc = (acc==null) ? 0.55 : clamp(acc/100, 0, 1);
    const kCombo = clamp(combo/20, 0, 1);
    return clamp(kAcc*0.72 + kCombo*0.28, 0, 1);
  }

  // ---------- tip rules (generic + hydration-special) ----------
  function handleHydration(st){
    const waterZone = String(st.waterZone || '').toUpperCase();
    const shield = safeNum(st.shield, 0);
    const inStorm = bool(st.inStorm);
    const inEnd = bool(st.inEndWindow);

    // 1) Storm is coming / during storm: remind shield + end window
    if (inStorm && !inEnd && shield <= 0){
      return say(
        'warn','storm_need_shield',
        'พายุมาแล้ว! รีบเก็บ 🛡️ ไว้ BLOCK ช่วงท้าย',
        'Storm Mini ต้อง “BLOCK” ใน End Window ถ้าไม่มีโล่จะพลาดง่าย',
        'โฟกัสยิง 🛡️ ก่อน แล้วค่อยยิง 💧 คุมโซน',
        { inStorm:true, shield }
      );
    }

    // 2) In End Window: prompt block
    if (inStorm && inEnd && shield > 0){
      return say(
        'tip','end_window_block',
        'ตอนนี้เป็น End Window! ใช้ 🛡️ BLOCK ให้ทัน!',
        'ช่วงท้ายพายุเป็นหน้าต่างทำคะแนน/ผ่านมินิที่สำคัญที่สุด',
        'เล็งกลาง ๆ แล้ว “BLOCK” ทันที (อย่ารัวมั่ว)',
        { inStorm:true, inEndWindow:true, shield }
      );
    }

    // 3) Zone control: stuck GREEN too little
    // (if caller provides waterZone, we can encourage maintaining GREEN)
    if (!inStorm && waterZone !== 'GREEN'){
      return say(
        'tip','recover_green',
        `น้ำหลุด GREEN (${waterZone}) — ดันกลับเข้า GREEN`,
        'Stage1 ต้องสะสมเวลาที่อยู่ GREEN ให้ครบเป้า',
        'ยิง 💧 ต่อเนื่องแบบนิ่ง ๆ เพื่อดันเข้า GREEN',
        { waterZone }
      );
    }

    return false;
  }

  function handleGeneric(st){
    const acc = inferAccuracy(st);
    const misses = safeNum(st.misses, 0);
    const combo = safeNum(st.combo, 0);
    const frustration = inferFrustration(st);
    const skill = inferSkill(st);

    // 1) Accuracy low
    if (acc != null && acc < 55 && misses >= 6){
      return say(
        'tip','low_accuracy',
        'อย่ารัว — เล็งค้างนิดนึงแล้วค่อยยิง',
        `Accuracy ตอนนี้ ${acc.toFixed(0)}% และ MISS ค่อนข้างเยอะ`,
        'ยิง “ชัวร์” ก่อน คอมโบจะกลับมาเอง',
        { acc, misses, combo }
      );
    }

    // 2) Miss spike
    const dMiss = misses - safeNum(S.prev.misses, 0);
    if (dMiss >= 4){
      return say(
        'warn','miss_spike',
        'MISS พุ่ง! ชะลอจังหวะก่อนนะ',
        'พลาดติด ๆ กันทำให้คะแนนและคอมโบร่วงเร็ว',
        'หยุด 1 วินาที แล้วค่อยยิงทีละเป้า',
        { dMiss, misses }
      );
    }

    // 3) Combo hype
    if (combo >= 10 && combo > safeNum(S.prev.combo, 0) && skill >= 0.68){
      return say(
        'hype','combo_hot',
        `โคตรดี! คอมโบ ${combo} 🔥`,
        'คอมโบยาว = เกรดพุ่ง + ได้คะแนนทบ',
        'รักษาจังหวะเดิม อย่าเสี่ยงยิงไกลเกิน',
        { combo, acc, skill }
      );
    }

    // 4) High frustration (gentle)
    if (frustration >= 0.78){
      return say(
        'info','cooldown',
        'พักสายตา 2 วิ แล้วกลับมาใหม่',
        'ถ้าตึงเกินไปจะยิงพลาดง่ายขึ้นทันที',
        'หายใจลึก ๆ แล้วค่อยเริ่มยิงอีกครั้ง',
        { frustration }
      );
    }

    return false;
  }

  // ---------- public API ----------
  function onStart(){
    S.started = true;
    S.lastTipAt = 0;
    S.lastTag = '';
    S.lastLevel = '';
    S.tagCount = Object.create(null);
    S.suppressUntil = 0;
    S.prev = { score:0, combo:0, misses:0, shield:0, accuracy:null, inStorm:false, inEndWindow:false, waterZone:'' };

    // light intro (optional)
    say(
      'info','coach_ready',
      'โหมด Coach พร้อมแล้ว 🎯',
      'จะบอกทิปสั้น ๆ เฉพาะจังหวะสำคัญ (ไม่สแปม)',
      'เล่นตามเป้าหมาย: แม่น + คอมโบ + ลด MISS',
      {}
    );
  }

  function onUpdate(st = {}){
    if (!S.started) return;

    // update prev snapshot early (but keep for delta checks)
    const prev = Object.assign({}, S.prev);

    // normalize keys we care about
    const cur = {
      score: safeNum(st.score, safeNum(st.scoreFinal, prev.score)),
      combo: safeNum(st.combo, prev.combo),
      misses: safeNum(st.misses, prev.misses),
      shield: safeNum(st.shield, prev.shield),
      waterZone: String(st.waterZone || prev.waterZone || ''),
      inStorm: bool(st.inStorm),
      inEndWindow: bool(st.inEndWindow),
      accuracyGoodPct: (st.accuracyGoodPct != null) ? st.accuracyGoodPct : null,
      nHitGood: st.nHitGood,
      nGoodSpawn: st.nGoodSpawn,
      skill: st.skill,
      frustration: st.frustration,
      fatigue: st.fatigue
    };

    // store snapshot
    S.prev = {
      score: cur.score,
      combo: cur.combo,
      misses: cur.misses,
      shield: cur.shield,
      accuracy: inferAccuracy(cur),
      inStorm: cur.inStorm,
      inEndWindow: cur.inEndWindow,
      waterZone: cur.waterZone
    };

    // 1) hydration-specific first (if game matches OR if waterZone/shield present)
    if (GAME === 'hydration' || (cur.waterZone || cur.shield || cur.inStorm)){
      if (handleHydration(cur)) return;
    }

    // 2) generic tips
    if (handleGeneric(Object.assign({ prev }, cur))) return;
  }

  function onEnd(summary = {}){
    // after end, suppress spam
    S.suppressUntil = now() + 2500;

    const acc = inferAccuracy(summary);
    const miss = safeNum(summary.misses, 0);
    const grade = String(summary.grade || '').toUpperCase() || 'C';

    // End recap (single)
    say(
      'info','end_recap',
      `จบเกมแล้ว! เกรด ${grade} • MISS ${miss} • ACC ${acc!=null?acc.toFixed(0)+'%':'—'}`,
      'ใช้สรุปนี้เพื่อวางแผนรอบต่อไปให้เก่งขึ้นเร็ว',
      (acc!=null && acc<70) ? 'รอบหน้า: เพิ่มความแม่นก่อน' : (miss>15 ? 'รอบหน้า: ลด MISS ก่อน' : 'รอบหน้า: ลากคอมโบให้ยาวขึ้น'),
      { grade, miss, acc }
    );
  }

  return { onStart, onUpdate, onEnd };
}