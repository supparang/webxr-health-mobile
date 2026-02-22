// === /fitness/js/rb-ai.js ===
// Rhythm Boxer AI Prediction / Assist Gate (research-locked, explainable)
// ✅ predict(snapshot) => fatigueRisk, skillScore, suggestedDifficulty, tip
// ✅ research lock from ?mode=research
// ✅ assist enable via ?ai=1 (prediction only; engine may choose to use later)
// ✅ deterministic-enough tips cadence handled by engine (engine rate-limits tip display)
'use strict';

(function(){
  const WIN = window;

  function q(name, def=''){
    try { return new URL(location.href).searchParams.get(name) ?? def; }
    catch(_) { return def; }
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }
  function num(v, d=0){ v=Number(v); return Number.isFinite(v)?v:d; }

  const modeQ = String(q('mode','')).toLowerCase();
  const runQ  = String(q('run','')).toLowerCase();

  // research lock if explicitly in research mode
  const locked = (modeQ === 'research' || runQ === 'research');

  // assist flag: ?ai=1 (only for normal/play)
  const assistEnabled = !locked && String(q('ai','0')) === '1';

  function explainTip(s){
    const hp = num(s.hp, 100);
    const acc = num(s.accPct, 0);
    const miss = num(s.hitMiss, 0);
    const combo = num(s.combo, 0);
    const offAbs = (s.offsetAbsMean == null) ? null : num(s.offsetAbsMean, 0);

    // Tip priority (explainable & simple)
    if (hp < 35 && miss >= 6) {
      return 'เซฟ HP ก่อน: ตีเฉพาะโน้ตตรงกลาง/ชัวร์ ๆ แล้วค่อยเร่งคอมโบ';
    }
    if (offAbs != null && offAbs > 0.095) {
      return 'จังหวะยังคลาดเยอะ: ลองกดให้ตรงเส้น hit line มากขึ้น';
    }
    if (acc < 60 && combo < 5) {
      return 'โฟกัส “ไม่พลาด” ก่อนคะแนน: ลดการกดมั่ว จะดีขึ้นเร็วมาก';
    }
    if (acc >= 85 && combo >= 10) {
      return 'ดีมาก! รักษาคอมโบไว้ แล้วเก็บ Perfect เพิ่มเพื่อเปิด Fever';
    }
    if (miss >= 10) {
      return 'พักสายตาครึ่งวิ แล้วจับ lane หลักก่อน อย่าพยายามเก็บทุกโน้ต';
    }
    return 'รักษาจังหวะสม่ำเสมอ: มองเส้น hit line เป็นหลัก';
  }

  function predict(snapshot){
    // snapshot:
    // { accPct, hitMiss, hitPerfect, hitGreat, hitGood, combo, offsetAbsMean, hp, songTime, durationSec }
    const s = snapshot || {};

    const acc = clamp(num(s.accPct, 0) / 100, 0, 1);
    const miss = num(s.hitMiss, 0);
    const combo = num(s.combo, 0);
    const hp = clamp(num(s.hp, 100) / 100, 0, 1);
    const t = num(s.songTime, 0);
    const dur = Math.max(1, num(s.durationSec, 60));
    const prog = clamp01(t / dur);

    const p = num(s.hitPerfect, 0);
    const g = num(s.hitGreat, 0);
    const good = num(s.hitGood, 0);
    const hitTotal = Math.max(1, p + g + good);
    const precision = clamp01((p*1.0 + g*0.7 + good*0.45) / hitTotal);

    const offAbs = (s.offsetAbsMean == null) ? 0.08 : Math.min(0.20, num(s.offsetAbsMean, 0.08));
    const timingPenalty = clamp01(offAbs / 0.12); // >0.12s is bad

    // Fatigue risk (heuristic "prediction")
    let fatigueRisk =
      (1 - hp) * 0.40 +
      clamp01(miss / 20) * 0.28 +
      timingPenalty * 0.20 +
      prog * 0.12;

    // Combo can reduce risk slightly (confidence/stability proxy)
    fatigueRisk -= Math.min(0.10, combo / 200);
    fatigueRisk = clamp01(fatigueRisk);

    // Skill score (0..1)
    let skillScore =
      acc * 0.42 +
      precision * 0.28 +
      clamp01(combo / 25) * 0.15 +
      (1 - timingPenalty) * 0.15;
    skillScore = clamp01(skillScore);

    let suggestedDifficulty = 'normal';
    if (skillScore >= 0.82 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
    else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

    const tip = explainTip(s);

    return {
      fatigueRisk: +fatigueRisk.toFixed(3),
      skillScore: +skillScore.toFixed(3),
      suggestedDifficulty,
      tip,
      locked,
      assistEnabled,
      model: 'heuristic-v1'
    };
  }

  WIN.RB_AI = {
    predict,
    isLocked: ()=>locked,
    isAssistEnabled: ()=>assistEnabled
  };
})();