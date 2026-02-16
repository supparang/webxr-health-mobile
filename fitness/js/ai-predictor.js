// === /fitness/js/ai-predictor.js ===
// AI Predictor (lightweight) for Rhythm Boxer
// ✅ Predict fatigueRisk / skillScore / suggestedDifficulty / tip
// ✅ Research-lock: never changes engine behavior (prediction only)
// ✅ Assist toggle: ?ai=1 (still prediction-only in this patch)

'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }

  function qs(key, def=''){
    try{ return new URL(location.href).searchParams.get(key) ?? def; }catch(_){ return def; }
  }

  // ---- Flags ----
  const AI_ON = String(qs('ai','0')).toLowerCase() === '1';
  let _locked = false; // set by engine via mode
  let _assist = AI_ON; // currently only affects HUD label / future hook

  // exported API (engine reads this)
  const RB_AI = {
    isLocked(){ return _locked; },
    isAssistEnabled(){ return _assist; },
    setLocked(v){ _locked = !!v; },
    setAssistEnabled(v){ _assist = !!v; },

    predict(snapshot){
      // snapshot fields:
      // accPct, hitMiss, hitPerfect, hitGreat, hitGood, combo,
      // offsetAbsMean, hp, songTime, durationSec

      const acc = Number(snapshot.accPct||0);
      const miss = Number(snapshot.hitMiss||0);
      const combo = Number(snapshot.combo||0);
      const hp = Number(snapshot.hp||100);

      const offAbs = (snapshot.offsetAbsMean==null) ? 0.09 : Number(snapshot.offsetAbsMean||0.09);

      // skillScore: based on acc, stability (low offset), and combo
      const accScore = clamp01(acc/100);
      const stableScore = clamp01(1 - (offAbs / 0.14));   // 0.14s -> low
      const comboScore = clamp01(combo / 30);

      const skillScore = clamp01(0.55*accScore + 0.30*stableScore + 0.15*comboScore);

      // fatigueRisk: rising if hp low, miss high, and time late
      const t = Number(snapshot.songTime||0);
      const dur = Math.max(1, Number(snapshot.durationSec||60));
      const prog = clamp01(t/dur);

      const missPressure = clamp01(miss / 18);          // 18 miss ~ high
      const hpPressure = clamp01((100 - hp) / 80);      // hp 20 -> 1
      const latePressure = clamp01((prog - 0.55) / 0.45); // after 55% song

      const fatigueRisk = clamp01(0.45*hpPressure + 0.35*missPressure + 0.20*latePressure);

      // suggestion (only label; engine does not adapt in this patch)
      let suggestedDifficulty = 'normal';
      if(skillScore >= 0.82 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
      else if(skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

      // coach tips (short, rotate-like)
      let tip = '';
      if(acc < 70) tip = 'โฟกัส “เส้นทองล่าง” แล้วกดเมื่อหัวโน้ตแตะเส้น';
      else if(offAbs > 0.10) tip = 'จังหวะยังแกว่ง: ลดกดรัว แล้วฟัง beat ให้ชัด';
      else if(miss >= 10) tip = 'ถ้าพลาดติดกัน ให้หยุดครึ่งจังหวะแล้วค่อยกลับมา';
      else if(combo >= 20) tip = 'ดีมาก! รักษาคอมโบด้วยการกด “พอดี” ไม่ต้องรีบ';
      else if(hp < 50) tip = 'HP ต่ำ: เน้น Good ให้ได้ก่อน แล้วค่อยไล่ Great/Perfect';

      // if AI disabled -> still return baseline to avoid HUD crash
      if(!AI_ON){
        return { fatigueRisk: 0, skillScore: 0.5, suggestedDifficulty: 'normal', tip: '' };
      }

      return { fatigueRisk, skillScore, suggestedDifficulty, tip };
    }
  };

  // expose
  WIN.RB_AI = RB_AI;

})();