'use strict';

// ai-dl-lite — placeholder “DL-lite” scaffold (no real ML)
// Keep API stable so other games can share later.
export const AiDlLite = {
  version: '0.1.0',
  predict(snapshot){
    // Return soft signals only
    const acc = Number(snapshot.accPct)||0;
    const miss = Number(snapshot.miss)||0;
    const hp = Number(snapshot.youHp)||100;

    const risk = Math.max(0, Math.min(1, (miss/20)*0.5 + ((100-hp)/100)*0.5 ));
    const skill = Math.max(0, Math.min(1, (acc/100)));

    return { risk, skill };
  }
};