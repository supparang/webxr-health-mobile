// === /herohealth/ai/coach-goodjunk.js ===
// Coach tips based on estimator output + event patterns.
// Rate-limited so it won't spam kids.

'use strict';

export function makeCoachGoodJunk(opts={}){
  const cfg = {
    minGapMs: 6500,
    ...opts
  };

  const S = { lastTipAt: 0, lastKey: '' };

  function canSpeak(){
    const now = Date.now();
    return (now - S.lastTipAt) >= cfg.minGapMs;
  }

  function emitTip(est, ctx){
    if(!canSpeak()) return null;
    const risk = est?.riskMiss5s ?? 0.25;

    let msg = null;
    let key = '';

    if(ctx?.bossActive && risk > 0.55){
      msg = 'โหมดบอส! เล็ง “ของดี” ก่อน แล้วค่อยยิง ✨ (อย่าใจร้อนโดนของเสีย)';
      key = 'boss_risk';
    }else if(est?.reasons?.includes('โดนของเสียบ่อย → แยกให้ชัด')){
      msg = 'ทริค: ของเสียมักหน้าตา “หลอกตา” — เล็งให้ชัดก่อนยิง 👀';
      key = 'junk_rate';
    }else if(est?.reasons?.includes('ของดีหมดอายุเยอะ → ต้องเล็งเร็วขึ้น')){
      msg = 'ทริค: ของดีหมดอายุบ่อย → โฟกัสยิง “ของดี” ที่ใกล้กลางจอก่อน 🥗';
      key = 'expire_rate';
    }else if(risk > 0.60){
      msg = 'พัก 1 วินิดนึง แล้วค่อยยิงทีละเป้า จะลด MISS ได้เยอะเลย 👍';
      key = 'high_risk';
    }else if((est?.skillScore ?? 0.5) > 0.78){
      msg = 'โห เล่นไหลมาก! ลอง “คอมโบ 10” ให้ได้อีกครั้ง 🔥';
      key = 'high_skill';
    }

    if(!msg) return null;
    if(key && key === S.lastKey) return null; // avoid repeats

    S.lastKey = key;
    S.lastTipAt = Date.now();
    return { msg, tag:'AI Coach' };
  }

  return { emitTip };
}