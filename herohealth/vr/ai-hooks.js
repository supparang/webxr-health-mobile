// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks (lightweight) — Prediction + Micro-tips + Event buffer
// Emits: brush:ai (consumed by brush.boot.js) + keeps dataset buffer for ML/DL
(function(){
  'use strict';
  const WIN = window;

  function qs(k,d=''){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } }
  const run = String(qs('run', qs('mode','play'))||'play').toLowerCase(); // play|research
  const aiOn = (String(qs('ai','1')) !== '0'); // ?ai=0 disable
  const researchLike = (run === 'research');

  const BUF_MAX = 600;
  const buf = [];
  function push(ev){
    buf.push(ev);
    if(buf.length > BUF_MAX) buf.splice(0, buf.length - BUF_MAX);
  }

  const S = {
    lastTs: 0,
    shots: 0,
    hits: 0,
    miss: 0,
    combo: 0,
    comboMax: 0,
    clean: 0,
    risk: 0,
    fatigue: 0,
    lastTipTs: 0,
    tipCoolMs: 1200
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function now(){ return Date.now(); }

  function emitAI(type, detail){
    try{
      WIN.dispatchEvent(new CustomEvent('brush:ai', { detail: { type, ...detail } }));
    }catch(_){}
  }

  function updateRisk(ev){
    const dt = (S.lastTs ? (ev.ts - S.lastTs) : 0);
    S.lastTs = ev.ts;

    if(ev.type === 'shot'){
      S.shots++;
      if(ev.hit) S.hits++; else S.miss++;
      S.combo = (ev.combo ?? S.combo);
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.clean = (ev.clean ?? S.clean);
    } else if(ev.type === 'timeout'){
      S.miss++;
      S.combo = 0;
      S.clean = (ev.clean ?? S.clean);
    } else if(ev.type === 'state'){
      S.combo = (ev.combo ?? S.combo);
      S.clean = (ev.clean ?? S.clean);
      S.miss  = (ev.miss ?? S.miss);
    }

    const acc = (S.shots>0) ? (S.hits/S.shots) : 0;
    const missRate = (S.shots>0) ? (S.miss/S.shots) : 0;

    const dense = dt>0 ? clamp(260/dt, 0, 1) : 0;
    S.fatigue = clamp(S.fatigue*0.92 + dense*0.06 + missRate*0.05, 0, 1);

    const behind = clamp((40 - (S.clean||0))/40, 0, 1);
    S.risk = clamp(missRate*0.55 + behind*0.25 + S.fatigue*0.20, 0, 1);

    return { acc, missRate, risk:S.risk, fatigue:S.fatigue };
  }

  function maybeTip(kind, z){
    if(!aiOn) return;
    if(researchLike) return; // default OFF in research
    const t = now();
    if(t - S.lastTipTs < S.tipCoolMs) return;
    S.lastTipTs = t;

    if(kind === 'risk_high'){
      emitAI('gate_on', { why:'risk_high', risk:z.risk, acc:z.acc });
      return;
    }
    if(kind === 'timing'){
      emitAI('shock_on', { why:'timing', missRate:z.missRate });
      return;
    }
  }

  const API = {
    onEvent(ev){
      push(ev);
      const z = updateRisk(ev);

      if(z.risk > 0.62) maybeTip('risk_high', z);

      if(ev.type==='shot' && ev.hit===false && (z.missRate > 0.38)){
        maybeTip('timing', z);
      }
    },
    getBuffer(){ return buf.slice(); },
    reset(){
      buf.length = 0;
      S.lastTs=0; S.shots=0; S.hits=0; S.miss=0; S.combo=0; S.comboMax=0; S.clean=0;
      S.risk=0; S.fatigue=0; S.lastTipTs=0;
    }
  };

  WIN.HHA = WIN.HHA || {};
  WIN.HHA.ai = API;
})();