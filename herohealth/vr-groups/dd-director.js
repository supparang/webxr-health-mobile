// === /herohealth/vr-groups/dd-director.js ===
// DD Director (Fair + Smooth)
// ✅ Calls GameEngine.applyTuning({spawnMs,sizeScale,junkWeight,stormBias})
// ✅ Play only + ?ai=1; OFF in research/practice
// ✅ Rate-limited + gentle clamps

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const qs=(k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };

  function isPlayAndAI(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const ai  = String(qs('ai','0')||'0').toLowerCase();
    return (run==='play') && (ai==='1' || ai==='true');
  }

  const S = {
    on:false,
    lastAt:0,
    // rolling state
    score:0, combo:0, miss:0, acc:0, left:90,
    storm:false,
    // tuning
    t:{ spawnMs:0, sizeScale:1.0, junkWeight:null, stormBias:0 }
  };

  function apply(){
    const E = NS.GameEngine;
    if(!E || typeof E.applyTuning!=='function') return;

    // compute risk-ish
    const accBad = clamp((100 - S.acc)/100, 0, 1);
    const missHeavy = clamp(S.miss/14, 0, 1);
    const comboGood = clamp(S.combo/10, 0, 1);

    // base preset spawn (we don't know preset base here) -> we only set spawnMs when needed
    // help mode
    let sizeScale = 1.0;
    let spawnMs   = 0;      // 0 means "engine uses preset"
    let junkW     = null;
    let stormBias = 0;

    // If struggling: assist
    if (missHeavy >= 0.55 || accBad >= 0.42){
      sizeScale = 1.08 - (accBad*0.06);              // 1.08..~1.03
      spawnMs   = 820 + Math.round(missHeavy*160);   // 820..~1040
      junkW     = 0.12 + (accBad*0.05);              // 0.12..0.17
      stormBias = -0.03;                              // delay storm a bit
    }
    // If doing great: challenge (gentle)
    else if (S.acc >= 88 && S.miss <= 3 && comboGood >= 0.6){
      sizeScale = 0.95;
      spawnMs   = 560;                                // faster
      junkW     = 0.17;                               // slightly more junk
      stormBias = +0.02;                              // little earlier storms
    }
    // normal: tiny nudges only
    else {
      sizeScale = 1.0;
      spawnMs   = 0;
      junkW     = null;
      stormBias = 0;
    }

    // extra clamp if storm already on: don't over-tighten
    if (S.storm){
      sizeScale = clamp(sizeScale, 0.92, 1.10);
      if (spawnMs) spawnMs = clamp(spawnMs, 520, 980);
    }

    S.t = {
      spawnMs: spawnMs ? clamp(spawnMs, 320, 980) : 0,
      sizeScale: clamp(sizeScale, 0.85, 1.15),
      junkWeight: (junkW==null) ? null : clamp(junkW, 0.10, 0.40),
      stormBias: clamp(stormBias, -0.06, 0.06)
    };

    E.applyTuning(S.t);
  }

  function tick(){
    if(!S.on) return;
    const t = Date.now();
    if (t - S.lastAt < 1000) return;
    S.lastAt = t;
    apply();
  }

  // listen signals
  root.addEventListener('hha:score', (ev)=>{
    const d=ev.detail||{};
    S.score = Number(d.score ?? S.score)||0;
    S.combo = Number(d.combo ?? S.combo)||0;
    S.miss  = Number(d.misses ?? S.miss)||0;
  }, {passive:true});

  root.addEventListener('hha:rank', (ev)=>{
    const d=ev.detail||{};
    S.acc = Number(d.accuracy ?? S.acc)||0;
  }, {passive:true});

  root.addEventListener('hha:time', (ev)=>{
    const d=ev.detail||{};
    S.left = Number(d.left ?? S.left)||0;
  }, {passive:true});

  root.addEventListener('groups:progress', (ev)=>{
    const d=ev.detail||{};
    const k=String(d.kind||'');
    if (k==='storm_on') S.storm=true;
    if (k==='storm_off') S.storm=false;
  }, {passive:true});

  // start/stop API
  let it=0;
  function start(){
    if(!isPlayAndAI()) return;
    S.on = true;
    clearInterval(it);
    it = setInterval(tick, 250);
  }
  function stop(){
    S.on = false;
    clearInterval(it);
  }

  NS.DDDirector = { start, stop };

  // auto-start best effort
  try{ start(); }catch(_){}

})(typeof window!=='undefined'?window:globalThis);