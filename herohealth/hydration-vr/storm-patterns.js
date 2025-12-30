// === /herohealth/hydration-vr/storm-patterns.js ===
// Hydration Storm Patterns — deterministic with rng
// Patterns: short / long / fakeout
// Fakeout = storm สั้นมาก + end window สั้น (หลอกให้ตั้งตัว)
// Return { name, durSec, endWindowSec, bossWindowSec, spawnMul, bossNeed, bonusScore, label }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function pickStormPattern(rng, diff='normal', cycle=1){
  // weight per diff
  const w = diff==='hard'
    ? { short:0.36, long:0.34, fakeout:0.30 }
    : diff==='easy'
    ? { short:0.46, long:0.26, fakeout:0.28 }
    : { short:0.40, long:0.30, fakeout:0.30 };

  // deterministic pick
  const r = rng();
  let name = 'short';
  const a = w.short;
  const b = a + w.long;
  if (r < a) name='short';
  else if (r < b) name='long';
  else name='fakeout';

  // slight ramp by cycle (later storms a bit tighter)
  const ramp = clamp((cycle-1)/6, 0, 1); // 0..1

  if (name === 'short'){
    const dur = (diff==='hard'? 4.8 : diff==='easy'? 4.6 : 4.7) - 0.25*ramp;
    return {
      name,
      durSec: clamp(dur, 3.6, 5.2),
      endWindowSec: clamp((diff==='hard'?1.05:1.15) - 0.05*ramp, 0.85, 1.25),
      bossWindowSec: clamp((diff==='hard'?2.0:2.1) - 0.10*ramp, 1.55, 2.2),
      spawnMul: diff==='hard'?0.54:0.60,
      bossNeed: diff==='hard'?2:1,
      bonusScore: 38,
      label: 'Storm (short)'
    };
  }

  if (name === 'long'){
    const dur = (diff==='hard'? 7.0 : diff==='easy'? 6.2 : 6.6) + 0.20*ramp;
    return {
      name,
      durSec: clamp(dur, 6.0, 7.8),
      endWindowSec: clamp((diff==='hard'?1.30:1.25) + 0.05*ramp, 1.05, 1.45),
      bossWindowSec: clamp((diff==='hard'?2.6:2.35) + 0.05*ramp, 2.05, 2.8),
      spawnMul: diff==='hard'?0.58:0.64,
      bossNeed: diff==='hard'?3:2,
      bonusScore: 52,
      label: 'Storm (long)'
    };
  }

  // fakeout
  // หลอก: duration สั้นมาก + end window สั้น => ต้อง “ตั้งสติเร็ว”
  const dur = (diff==='hard'? 3.9 : diff==='easy'? 4.0 : 3.95) - 0.20*ramp;
  return {
    name,
    durSec: clamp(dur, 3.2, 4.3),
    endWindowSec: clamp((diff==='hard'?0.85:0.95) - 0.05*ramp, 0.70, 1.05),
    bossWindowSec: clamp((diff==='hard'?1.7:1.8) - 0.10*ramp, 1.25, 1.95),
    spawnMul: diff==='hard'?0.50:0.56,
    bossNeed: 1,
    bonusScore: 44,
    label: 'Storm (fake-out)'
  };
}