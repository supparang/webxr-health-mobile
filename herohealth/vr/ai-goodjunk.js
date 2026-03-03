// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction-only) — PRODUCTION
// PATCH v20260303-AI-PRED-v2-EXPLAIN
// ✅ hazardRisk 0..1 (5–8s ahead) + next5 + reasons[]
// ✅ rolling window (events in last 10s)
// ✅ still research-safe: prediction only (NO adaptive)

'use strict';

function clamp(v,a,b){ v=+v; if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || '');
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  let tSec = 0;

  // lifetime counts
  let spawnGood=0, spawnJunk=0, spawnBonus=0, spawnShield=0, spawnBoss=0;
  let hitGood=0, hitJunk=0, hitBonus=0, hitShield=0, hitBoss=0;
  let expireGood=0, expireJunk=0;

  // rolling window of last ~10 seconds
  const w = []; // {t, type, kind, meta}
  const WIN_SEC = 10;

  const useExternal = (typeof window !== 'undefined') && (typeof window.__HHA_AI_PREDICT__ === 'function');

  function pushWin(type, kind, meta){
    w.push({ t:tSec, type:String(type||''), kind:String(kind||''), meta:meta||null });
    // trim
    const minT = tSec - WIN_SEC;
    while(w.length && w[0].t < minT) w.shift();
  }

  function rate(filterFn){
    const minT = tSec - WIN_SEC;
    let n=0;
    for(const e of w){
      if(e.t >= minT && filterFn(e)) n++;
    }
    return n / Math.max(1, WIN_SEC);
  }

  function buildFeatures(extra){
    extra = extra || {};
    const totalSpawn = Math.max(1, spawnGood+spawnJunk+spawnBonus+spawnShield+spawnBoss);
    const junkRate = spawnJunk / totalSpawn;

    const missGoodExpired = +extra.missGoodExpired || 0;
    const missJunkHit = +extra.missJunkHit || 0;
    const shots = +extra.shots || 0;
    const hits  = +extra.hits  || 0;
    const acc = shots>0 ? hits/shots : 1;

    const shield = +extra.shield || 0;
    const fever  = +extra.fever  || 0;
    const combo  = +extra.combo  || 0;

    // window rates
    const rGoodExpire = rate(e=> e.type==='expire' && e.kind==='good');
    const rJunkHit    = rate(e=> e.type==='hit' && e.kind==='junk' && !e?.meta?.blocked);
    const rSlowHit    = rate(e=> e.type==='hit' && e.kind==='good' && (e?.meta?.rtMs||0) >= 850);
    const rNoTarget   = rate(e=> e.type==='shot' && e.kind==='none'); // cVR miss lock

    return {
      seed, pid, diff, view,
      tSec,
      junkRate,
      missGoodExpired, missJunkHit,
      acc,
      shield, fever, combo,
      rGoodExpire, rJunkHit, rSlowHit, rNoTarget,
      bossActive: !!extra.bossActive,
      stormOn: !!extra.stormOn,
      rageOn: !!extra.rageOn
    };
  }

  function heuristicPredict(f){
    const reasons = [];

    // base from junk density
    let risk = clamp(f.junkRate*0.55, 0, 0.55);
    if(f.junkRate > 0.30) reasons.push('ของเสียหนาแน่น');

    // windowed “pressure”
    risk += clamp(f.rJunkHit*1.2, 0, 0.35);
    if(f.rJunkHit > 0.06) reasons.push('เพิ่งโดนของเสียใน 10 วิ');

    risk += clamp(f.rGoodExpire*0.9, 0, 0.30);
    if(f.rGoodExpire > 0.08) reasons.push('ของดีหลุดบ่อยใน 10 วิ');

    // accuracy drop
    const lowAcc = clamp(0.92 - f.acc, 0, 0.92);
    risk += clamp(lowAcc*0.35, 0, 0.25);
    if(f.acc < 0.85) reasons.push('ความแม่นยำลดลง');

    // slow reactions
    risk += clamp(f.rSlowHit*0.9, 0, 0.18);
    if(f.rSlowHit > 0.06) reasons.push('รีแอคช้าช่วงนี้');

    // cVR lock misses
    if(f.view==='cvr'){
      risk += clamp(f.rNoTarget*0.7, 0, 0.20);
      if(f.rNoTarget > 0.10) reasons.push('ยิงไม่ล็อกเป้า (cVR)');
    }

    // contextual bumps
    if(f.stormOn){ risk += 0.06; reasons.push('ช่วง Storm'); }
    if(f.bossActive){ risk += 0.05; reasons.push('ช่วง Boss'); }

    // mitigations
    if(f.shield > 0){ risk -= 0.08; reasons.push('มีโล่ช่วยกันพลาด'); }
    if(f.combo >= 5 && f.acc >= 0.9){ risk -= 0.06; reasons.push('คอมโบ/ความแม่นดี'); }
    risk = clamp(risk, 0, 1);

    const next5 = [];
    if(risk >= 0.72) next5.push('เลี่ยงของเสียก่อน แล้วค่อยเก็บของดี');
    if(f.shield <= 0 && risk >= 0.55) next5.push('หาโล่ 🛡️ ไว้กันพลาด');
    if(f.rGoodExpire > 0.08) next5.push('โฟกัส “ของดี” อย่าปล่อยให้หาย');
    if(f.view==='cvr' && f.rNoTarget > 0.10) next5.push('เล็งให้เป้าเข้าใกล้จุดกลางก่อนยิง');
    if(f.combo < 3 && risk < 0.55) next5.push('ทำคอมโบ จะได้คะแนนพุ่ง');
    if(next5.length===0) next5.push('จังหวะดีมาก รักษาโฟกัส');

    return { hazardRisk:risk, next5: next5.slice(0,5), reasons: reasons.slice(0,4) };
  }

  let lastPred = { hazardRisk:0, next5:['—'], reasons:[] };

  return {
    onSpawn(kind, meta){
      kind = String(kind||'');
      pushWin('spawn', kind, meta);
      if(kind==='good') spawnGood++;
      else if(kind==='junk') spawnJunk++;
      else if(kind==='bonus') spawnBonus++;
      else if(kind==='shield') spawnShield++;
      else if(kind==='boss') spawnBoss++;
    },
    onHit(kind, meta){
      kind = String(kind||'');
      pushWin('hit', kind, meta);
      if(kind==='good') hitGood++;
      else if(kind==='junk') hitJunk++;
      else if(kind==='bonus') hitBonus++;
      else if(kind==='shield') hitShield++;
      else if(kind==='boss') hitBoss++;
    },
    onExpire(kind, meta){
      kind = String(kind||'');
      pushWin('expire', kind, meta);
      if(kind==='good') expireGood++;
      else if(kind==='junk') expireJunk++;
    },
    onShotNone(meta){
      // optional hook if game calls it (cVR no target locked)
      pushWin('shot', 'none', meta);
    },
    onTick(dt, extra){
      tSec += (+dt||0);
      const f = buildFeatures(extra);

      try{
        if(useExternal){
          const out = window.__HHA_AI_PREDICT__(f);
          if(out && typeof out === 'object'){
            lastPred = {
              hazardRisk: clamp(out.hazardRisk, 0, 1),
              next5: Array.isArray(out.next5) ? out.next5.slice(0,5) : ['—'],
              reasons: Array.isArray(out.reasons) ? out.reasons.slice(0,4) : []
            };
            return lastPred;
          }
        }
      }catch(e){}

      lastPred = heuristicPredict(f);
      return lastPred;
    },
    onEnd(summary){
      return { pred:lastPred, explain:lastPred.reasons || [] };
    },
    getPrediction(){ return lastPred; }
  };
}