// === /herohealth/plate/plate.ai-tips.js ===
// PlateVR AI Coach Micro-tips — PRODUCTION (explainable, rate-limited)
// - Not "real AI" yet: rule-based + ready for future AI hook
// - Prevents spam via cooldown

'use strict';

export function createPlateAiTips(opts = {}){
  const cfg = Object.assign({
    cooldownMs: 4500,
    enabled: true
  }, opts || {});

  const TIP = { last:0 };

  function canSpeak(){
    const now = Date.now();
    if(now - TIP.last < cfg.cooldownMs) return false;
    TIP.last = now;
    return true;
  }

  function say(emit, msg){
    if(!cfg.enabled) return;
    if(!canSpeak()) return;
    emit('hha:coach', { msg, tag:'AICoach' });
  }

  function onJunkHit({ emit, hitJunk }){
    if(!cfg.enabled) return;
    if((hitJunk % 2) === 0){
      say(emit, 'ทิป: ของทอด/หวานพลังงานสูง กินมากไปเสี่ยงอ้วนและฟันผุ 🦷');
    }
  }

  function onAccuracy({ emit, accPct }){
    if(!cfg.enabled) return;
    if(Number(accPct) < 75){
      say(emit, 'ทิป: ลองรอให้เป้าเข้ากลางก่อนค่อยแตะ จะแม่นขึ้น 🎯');
    }
  }

  function onMissingGroups({ emit, g }){
    if(!cfg.enabled) return;
    // g = [count..] 5 groups
    const missing = [];
    for(let i=0;i<5;i++) if((g?.[i]||0) === 0) missing.push(i);
    if(missing.length >= 3){
      const emo = ['🍚','🥦','🍖','🥛','🍌'];
      say(emit, `ทิป: ตอนนี้ยังขาด ${missing.map(i=>emo[i]||'🍽️').join(' ')} ลองเก็บให้ครบทุกหมู่ 🍽️`);
    }
  }

  return { onJunkHit, onAccuracy, onMissingGroups };
}