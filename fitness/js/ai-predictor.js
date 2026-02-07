'use strict';

/* Minimal predictor stub (extend later with ML/DL if needed).
   Exposes window.RB_AI.predict(snap) => {fatigueRisk, skillScore, suggestedDifficulty, tip}
   Also exposes lock & assist flags.
*/

(function(){
  const WIN = window;

  const state = {
    locked: true,     // research: locked by default (prediction only)
    assistOn: false,  // enable with ?ai=1 (normal)
  };

  function parseQS(){
    try{
      const qs = new URL(location.href).searchParams;
      const ai = qs.get('ai');
      if(ai === '1'){
        state.assistOn = true;
        state.locked = false; // normal assist allowed
      }
    }catch(_){}
  }
  parseQS();

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function predict(snap){
    // naive heuristics: miss rate & hp drop => fatigue risk; acc & offsets => skill
    const dur = snap.durationSec || 60;
    const t = snap.songTime || 0;
    const prog = dur>0 ? (t/dur) : 0;

    const miss = snap.hitMiss || 0;
    const acc = (snap.accPct != null) ? snap.accPct : 0;

    // fatigue risk grows with miss and low hp
    const hp = snap.hp != null ? snap.hp : 100;
    const fatigueRisk = clamp01( (miss/25) * 0.55 + ((100-hp)/100) * 0.55 );

    // skill score grows with acc and low offsetAbsMean
    const off = snap.offsetAbsMean != null ? snap.offsetAbsMean : 0.12;
    const offScore = clamp01(1 - (off / 0.16));
    const skillScore = clamp01( (acc/100) * 0.70 + offScore * 0.30 );

    let suggestedDifficulty = 'normal';
    if(skillScore < 0.45) suggestedDifficulty = 'easy';
    if(skillScore > 0.78) suggestedDifficulty = 'hard';

    let tip = '';
    if(miss >= 6 && prog > 0.10){
      tip = 'ช้าลงนิดนึง—โฟกัสเส้นตี แล้วค่อยกด';
    }else if(off > 0.11 && prog > 0.10){
      tip = 'ลองกดให้ตรงเส้นมากขึ้น (อย่ากดก่อน/หลังเกินไป)';
    }else if(acc > 80 && prog > 0.15){
      tip = 'ดีมาก! รักษาจังหวะ แล้วคุมคอมโบต่อ';
    }

    return { fatigueRisk, skillScore, suggestedDifficulty, tip };
  }

  WIN.RB_AI = {
    predict,
    isLocked: ()=>!!state.locked,
    isAssistEnabled: ()=>!!state.assistOn,
  };
})();