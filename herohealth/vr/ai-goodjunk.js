// === /webxr-health-mobile/herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction + Difficulty Director)
// v20260302-AI-PREDICT-DIRECTOR
'use strict';

import { loadGoodJunkWeights, predictGoodJunkRisk } from './goodjunk-model.js';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createGoodJunkAI(cfg={}){
  const st = {
    ready: false,
    mode: 'fallback',
    lastHintAt: 0,
    lastTickAt: 0,
    hintCooldownMs: 2200,
    tickMinMs: 900,
    // director state
    pressure: 0.0,   // 0..1
    lastDirectorAt: 0
  };

  async function init(){
    // load weights if available (non-blocking)
    const url = String(cfg.weightsUrl || '../vr/goodjunk_weights.json');
    const r = await loadGoodJunkWeights(url);
    st.ready = true;
    st.mode = r.mode || 'fallback';
    return r;
  }

  function directorFrom(snap, risk){
    // ✅ research-safe policy: do NOT change difficulty in research
    const run = String(cfg.run || 'play').toLowerCase();
    const allowDirector = (run === 'play'); // only play
    if(!allowDirector){
      return { enabled:false, pressure:0, spawnMult:1, junkBias:0, sizeScale:1, note:'director_off_research' };
    }

    // pressure update: increase when player is strong, decrease when risk high
    // strong signal = high acc + low miss + decent combo
    const acc = clamp(snap.accPct,0,100);
    const miss = Number(snap.miss||0);
    const combo = clamp(snap.combo,0,999);

    let p = st.pressure;
    const strong = (acc >= 88 && miss <= 1 && combo >= 6);
    if(strong && risk < 0.35) p += 0.08;
    if(risk > 0.70) p -= 0.10;
    if(miss >= 4) p -= 0.08;

    p = clamp(p, 0, 1);
    st.pressure = p;

    // map pressure -> knobs
    // spawnMult: 1.0..1.55 (เร็วขึ้น)
    const spawnMult = 1 + 0.55*p;
    // junkBias: 0..0.18 (เพิ่ม junk นิดหน่อย)
    const junkBias = 0.18*p;
    // sizeScale: 1..0.86 (เล็กลงนิด)
    const sizeScale = 1 - 0.14*p;

    return {
      enabled: true,
      pressure: p,
      spawnMult,
      junkBias,
      sizeScale,
      note: strong ? 'player_strong_raise_pressure' : (risk>0.7 ? 'risk_high_lower_pressure' : 'stable')
    };
  }

  function maybeHint(snap){
    const t = Date.now();
    if(t - st.lastTickAt < st.tickMinMs) return null;
    st.lastTickAt = t;

    const pred = predictGoodJunkRisk(snap);
    const risk = clamp(pred.risk, 0, 1);

    // hint rate-limit
    let hint = '—';
    if(t - st.lastHintAt >= st.hintCooldownMs){
      hint = pred.hint || '—';
      st.lastHintAt = t;
    }

    const dir = directorFrom(snap, risk);

    return {
      mode: pred.mode,
      risk,
      hint,
      director: dir
    };
  }

  return { init, maybeHint };
}