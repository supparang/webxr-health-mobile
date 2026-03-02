// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — prediction only (research-safe; NO adaptive difficulty)
// PATCH v20260302-AI-GOODJUNK
'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

export function createGoodJunkAI({ seed='0', pid='anon', diff='normal', view='mobile' }={}){
  let lastPred = { hazardRisk: 0.25, next5: ['เล็งของดี', 'หลบของเสีย', 'รอโบนัส'] };

  // rolling stats
  let spawns = { good:0, junk:0, bonus:0, shield:0, boss:0 };
  let hits   = { good:0, junk:0, bonus:0, shield:0, boss:0 };
  let exp    = { good:0, junk:0, bonus:0, shield:0, boss:0 };

  function mkHint(){
    const junkPressure = spawns.junk > 0 ? hits.junk / spawns.junk : 0;
    const goodDrop = spawns.good > 0 ? exp.good / spawns.good : 0;

    const hints = [];
    if(junkPressure > 0.18) hints.push('ระวัง 🍔🍟 ใกล้ ๆ');
    if(goodDrop > 0.22) hints.push('เร็วขึ้นนิด ของดีหาย');
    if(hits.bonus < 2 && spawns.bonus > 4) hints.push('โบนัสช่วยดึงคะแนน');
    if(view==='cvr') hints.push('ล็อกเป้าให้อยู่กลางจอ');
    if(hints.length===0) hints.push('รักษาคอมโบ แล้วค่อยเสี่ยง');
    return hints.slice(0,5);
  }

  function updatePrediction(extra){
    extra = extra || {};
    // heuristic risk: junk hit + good expired + low shield + high fever (risky play)
    const missJunk = Number(extra.missJunkHit)||0;
    const missGood = Number(extra.missGoodExpired)||0;
    const shield   = Number(extra.shield)||0;
    const fever    = Number(extra.fever)||0;
    const combo    = Number(extra.combo)||0;

    const base = 0.20
      + 0.03*clamp(missJunk,0,50)
      + 0.02*clamp(missGood,0,50)
      + (shield<=0 ? 0.12 : 0.02)
      + (fever>=90 ? 0.08 : 0.00)
      - 0.01*clamp(combo,0,20);

    lastPred = {
      hazardRisk: clamp(base, 0, 0.99),
      next5: mkHint()
    };
    return lastPred;
  }

  return {
    onSpawn(kind){
      kind = String(kind||'').toLowerCase();
      if(spawns[kind] != null) spawns[kind]++;
    },
    onHit(kind){
      kind = String(kind||'').toLowerCase();
      if(hits[kind] != null) hits[kind]++;
    },
    onExpire(kind){
      kind = String(kind||'').toLowerCase();
      if(exp[kind] != null) exp[kind]++;
    },
    onTick(dt, extra){
      return updatePrediction(extra);
    },
    getPrediction(){
      return lastPred;
    },
    onEnd(summary){
      // attach lightweight diagnostics
      return {
        pid, seed, diff, view,
        spawns, hits, expired: exp,
        lastPred
      };
    }
  };
}