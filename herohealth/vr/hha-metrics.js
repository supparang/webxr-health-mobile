// === /herohealth/vr/hha-metrics.js ===
// HHA Metrics — PRODUCTION
// ✅ Rolling RT stats (avg/median), fast hit rate
// ✅ Track per-target hits/spawns/expires
// ✅ Export summary payload for Google Sheet logging
//
// Usage:
//   const M = makeMetrics();
//   M.onSpawn('good'); M.onHit('good', rtMs);
//   const s = M.export();

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function median(arr){
  if (!arr.length) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const m = (a.length/2)|0;
  return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
}

export function makeMetrics(opts={}){
  const RT = []; // store last N only
  const N = clamp(opts.maxRtSamples || 120, 30, 600)|0;

  const c = {
    goodSpawn:0, badSpawn:0, shieldSpawn:0,
    goodHit:0, badHit:0, badGuard:0,
    goodExpire:0,
  };

  let rtSum=0;
  let rtN=0;
  let fastN=0; // rt < fastThreshold
  const fastThreshold = clamp(opts.fastThresholdMs || 420, 180, 900);

  const born = new WeakMap(); // el -> tSpawn

  function onSpawn(kind, el){
    if (kind==='good') c.goodSpawn++;
    else if (kind==='bad') c.badSpawn++;
    else if (kind==='shield') c.shieldSpawn++;
    if (el) born.set(el, performance.now());
  }

  function onExpire(kind){
    if (kind==='good') c.goodExpire++;
  }

  function onHit(kind, rtMs){
    if (kind==='good') c.goodHit++;
    else if (kind==='bad') c.badHit++;
    else if (kind==='badGuard') c.badGuard++;

    const rt = clamp(rtMs, 60, 5000);
    RT.push(rt);
    rtSum += rt;
    rtN += 1;
    if (rt < fastThreshold) fastN += 1;

    if (RT.length > N){
      const x = RT.shift();
      rtSum -= x;
      rtN -= 1;
      if (x < fastThreshold) fastN -= 1;
    }
  }

  function rtFromEl(el){
    const t0 = born.get(el);
    if (!t0) return null;
    return performance.now() - t0;
  }

  function export(){
    const avg = rtN ? (rtSum/rtN) : 0;
    const med = median(RT);
    const fast = rtN ? (fastN/rtN)*100 : 0;

    return {
      nTargetGoodSpawned: c.goodSpawn,
      nTargetJunkSpawned: c.badSpawn,
      nTargetShieldSpawned: c.shieldSpawn,

      nHitGood: c.goodHit,
      nHitJunk: c.badHit,
      nHitJunkGuard: c.badGuard,
      nExpireGood: c.goodExpire,

      avgRtGoodMs: avg,
      medianRtGoodMs: med,
      fastHitRatePct: fast,
    };
  }

  return { onSpawn, onHit, onExpire, rtFromEl, export };
}