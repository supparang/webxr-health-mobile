// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (prediction only) — PRODUCTION SAFE
// Provides: onTick(), getPrediction(), onEnd(), onSpawn(), onHit(), onExpire()
// NOTE: NO adaptive difficulty. No gameplay manipulation. Prediction + HUD hints only.
// FULL v20260228-AI-GOODJUNK

'use strict';

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || '');
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  // lightweight state
  let t = 0;
  let lastPred = null;

  // counters
  let spawnGood=0, spawnJunk=0, spawnBonus=0, spawnShield=0, spawnBoss=0;
  let hitGood=0, hitJunk=0, hitBonus=0, hitShield=0, hitBoss=0;
  let expireGood=0, expireJunk=0, expireBonus=0, expireShield=0, expireBoss=0;

  // Next watchout pool (HUD only)
  const WATCH = [
    'ระวัง JUNK ใกล้กลางจอ',
    'เร่งเก็บ GOOD ก่อนหมดเวลา',
    'ถ้าโล่มี 1+ กล้าเสี่ยงได้',
    'คุมคอมโบ อย่าหลุด',
    'บอสมา ยิงแตกโล่ก่อน'
  ];

  // small stable RNG (deterministic by seed+pid)
  function xmur3(str){
    str = String(str||'');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let tt = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      tt = (tt + d) | 0;
      c = (c + tt) | 0;
      return (tt >>> 0) / 4294967296;
    };
  }
  const seedFn = xmur3(`${seed}|${pid}|goodjunk`);
  const rng = sfc32(seedFn(),seedFn(),seedFn(),seedFn());
  const r01 = ()=> rng();
  const rPick = (arr)=> arr[(r01()*arr.length)|0];

  function hazardRiskFrom(features){
    // features: missGoodExpired, missJunkHit, shield, fever, combo
    const missGood = Number(features?.missGoodExpired||0);
    const missJunk = Number(features?.missJunkHit||0);
    const shield   = Number(features?.shield||0);
    const fever    = Number(features?.fever||0);
    const combo    = Number(features?.combo||0);

    // risk rises with junk hits + missed goods, and when shield is low & combo high (more to lose)
    let risk =
      0.14 +
      0.08*Math.min(10, missJunk) +
      0.04*Math.min(12, missGood) +
      0.02*Math.min(12, combo) +
      (shield<=0 ? 0.10 : 0.0) +
      (fever>=80 ? 0.06 : 0.0);

    // normalize-ish
    risk = Math.max(0, Math.min(0.99, risk));
    return risk;
  }

  function nextWatchout(features){
    const shield = Number(features?.shield||0);
    const combo  = Number(features?.combo||0);
    const missJ  = Number(features?.missJunkHit||0);
    const missG  = Number(features?.missGoodExpired||0);

    if(shield<=0 && missJ>=2) return 'ระวัง JUNK (ไม่มีโล่)';
    if(missG>=2) return 'รีบเก็บ GOOD ก่อนหมดเวลา';
    if(combo>=5) return 'คอมโบสูง! อย่าพลาด JUNK';
    if(spawnBoss>0) return 'บอสมา: ยิงแตกโล่ก่อน';
    return rPick(WATCH);
  }

  function buildPrediction(features){
    const hazardRisk = hazardRiskFrom(features);
    const hint = nextWatchout(features);
    // Provide a short list (HUD uses [0])
    return {
      hazardRisk,
      next5: [hint, rPick(WATCH), rPick(WATCH), rPick(WATCH), rPick(WATCH)],
      meta: { seed, pid, diff, view, t: +t.toFixed(2) }
    };
  }

  return {
    onSpawn(kind){
      if(kind==='good') spawnGood++;
      else if(kind==='junk') spawnJunk++;
      else if(kind==='bonus') spawnBonus++;
      else if(kind==='shield') spawnShield++;
      else if(kind==='boss') spawnBoss++;
    },
    onHit(kind, meta){
      if(kind==='good') hitGood++;
      else if(kind==='junk'){
        // blocked junk hit should not be counted as harmful but still "hit" in telemetry
        hitJunk++;
      }
      else if(kind==='bonus') hitBonus++;
      else if(kind==='shield') hitShield++;
      else if(kind==='boss') hitBoss++;
      void meta;
    },
    onExpire(kind){
      if(kind==='good') expireGood++;
      else if(kind==='junk') expireJunk++;
      else if(kind==='bonus') expireBonus++;
      else if(kind==='shield') expireShield++;
      else if(kind==='boss') expireBoss++;
    },
    onTick(dt, features){
      t += Number(dt||0);
      // Update prediction ~5Hz to be stable (but caller can call every frame)
      if(!lastPred || (t - (lastPred.meta?.t||0)) >= 0.20){
        lastPred = buildPrediction(features);
      }
      return lastPred;
    },
    getPrediction(){
      return lastPred;
    },
    onEnd(summary){
      // Attach AI diagnostics (no scoring control)
      return {
        aiTag: 'GoodJunkAI_PRED_ONLY',
        seed, pid, diff, view,
        counters: {
          spawn:{ good:spawnGood, junk:spawnJunk, bonus:spawnBonus, shield:spawnShield, boss:spawnBoss },
          hit:{ good:hitGood, junk:hitJunk, bonus:hitBonus, shield:hitShield, boss:hitBoss },
          expire:{ good:expireGood, junk:expireJunk, bonus:expireBonus, shield:expireShield, boss:expireBoss }
        },
        lastPrediction: lastPred || null,
        // helpful: recommend tie-break fields present in summary
        tieBreak: {
          order: 'score → acc → miss → medianRT',
          score: summary?.scoreFinal ?? null,
          acc: summary?.accPct ?? null,
          miss: summary?.missTotal ?? null,
          medianRT: summary?.medianRtGoodMs ?? null
        }
      };
    }
  };
}