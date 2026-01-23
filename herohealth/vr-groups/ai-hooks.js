// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — Prediction + MicroTips (SAFE)
// ✅ Default OFF
// ✅ Enable only: runMode='play' AND enabled=true (from groups-vr.html aiEnabled())
// ✅ Research/Practice: forced OFF
// Emits: ai:pred { mistakeRisk, junkRisk, miniSuccessProb, tipLevel }

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  let attached = false;
  let enabled = false;
  let runMode = 'play';
  let timer = null;

  function stop(){
    enabled = false;
    if(timer){ clearInterval(timer); timer=null; }
    try{
      const P = NS.Predictor;
      P && P.setEnabled(false, runMode);
    }catch(_){}
  }

  function attach(cfg){
    cfg = cfg || {};
    runMode = String(cfg.runMode||'play').toLowerCase();
    enabled = !!cfg.enabled && (runMode==='play');

    // hard safety
    if(runMode==='research' || runMode==='practice') enabled = false;

    // bind once
    if(!attached){
      attached = true;

      root.addEventListener('hha:time',  (ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('time', ev.detail||{}); }, {passive:true});
      root.addEventListener('hha:score', (ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('score', ev.detail||{}); }, {passive:true});
      root.addEventListener('hha:rank',  (ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('rank', ev.detail||{}); }, {passive:true});
      root.addEventListener('quest:update',(ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('quest', ev.detail||{}); }, {passive:true});
      root.addEventListener('groups:power',(ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('power', ev.detail||{}); }, {passive:true});
      root.addEventListener('groups:progress',(ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('progress', ev.detail||{}); }, {passive:true});
      root.addEventListener('hha:judge',(ev)=>{ if(!enabled) return; NS.Predictor && NS.Predictor.feed('judge', ev.detail||{}); }, {passive:true});

      root.addEventListener('hha:end', ()=> stop(), {passive:true});
    }

    // enable/disable predictor
    const P = NS.Predictor;
    if(P){
      P.setEnabled(enabled, runMode);
      if(enabled) P.reset();
    }

    // loop: compute prediction + (optional) tips
    if(timer){ clearInterval(timer); timer=null; }
    if(!enabled) return;

    timer = setInterval(()=>{
      if(!enabled) return;
      const P2 = NS.Predictor;
      if(!P2) return;

      const pred = P2.predict();
      if(!pred) return;

      const tip = P2.tip(pred);

      emit('ai:pred', {
        mistakeRisk: pred.mistakeRisk,
        junkRisk: pred.junkRisk,
        miniSuccessProb: pred.miniSuccessProb,
        tipLevel: tip ? tip.level : 'none'
      });

      // micro-tip via coach (rate-limit)
      if(tip && P2.shouldTip()){
        P2.markTip();
        emit('hha:coach', { text: tip.text, mood: tip.mood || 'neutral' });
      }

    }, 300); // 300ms feels responsive but not noisy
  }

  NS.AIHooks = { attach, stop };
})(window);