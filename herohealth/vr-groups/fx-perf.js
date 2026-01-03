/* === /herohealth/vr-groups/fx-perf.js ===
PACK 33: FX Performance Controller — PRODUCTION
✅ Estimates FPS (lightweight)
✅ Sets FX level 1..3 (default 3)
✅ Exposes GroupsVR.FXPerf.getLevel()
✅ Writes body[data-fx-level] for CSS gating
✅ Safe in research (keeps stable, but still can clamp if too low)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const NOW = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  const cfg = {
    sampleMs: 1400,
    checkEveryMs: 1600,
    // thresholds (tune)
    fpsLow: 36,    // <= low => level 1
    fpsMid: 46,    // <= mid => level 2
    fpsHigh: 55,   // >= high => level 3
    minLevel: 1,
    maxLevel: 3,
  };

  let level = 3;
  let lastCheck = 0;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function isResearch(){
    return String(qs('run','play')||'play').toLowerCase() === 'research';
  }

  function setLevel(n){
    n = Math.max(cfg.minLevel, Math.min(cfg.maxLevel, Number(n)||3));
    if (n === level) return;
    level = n;
    try{
      DOC.body.dataset.fxLevel = String(level);
      DOC.body.setAttribute('data-fx-level', String(level));
    }catch(_){}
    try{
      DOC.body.classList.toggle('fx-low', level===1);
      DOC.body.classList.toggle('fx-mid', level===2);
      DOC.body.classList.toggle('fx-full', level===3);
    }catch(_){}
  }

  function measureFps(ms){
    ms = Math.max(800, Number(ms)||1200);
    return new Promise((resolve)=>{
      let frames = 0;
      const t0 = NOW();
      function step(){
        frames++;
        if (NOW() - t0 >= ms){
          const fps = frames / ((NOW()-t0)/1000);
          resolve(fps);
          return;
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  async function loop(){
    const t = NOW();
    if (t - lastCheck < cfg.checkEveryMs){
      requestAnimationFrame(loop);
      return;
    }
    lastCheck = t;

    const fps = await measureFps(cfg.sampleMs);

    // research: keep stable (prefer 2–3) unless truly low
    if (isResearch()){
      if (fps <= cfg.fpsLow) setLevel(1);
      else setLevel(2);
      requestAnimationFrame(loop);
      return;
    }

    // play: adaptive
    if (fps <= cfg.fpsLow) setLevel(1);
    else if (fps <= cfg.fpsMid) setLevel(2);
    else if (fps >= cfg.fpsHigh) setLevel(3);

    requestAnimationFrame(loop);
  }

  // init
  try{
    DOC.body.dataset.fxLevel = DOC.body.dataset.fxLevel || '3';
    level = Number(DOC.body.dataset.fxLevel)||3;
    setLevel(level);
  }catch(_){}

  NS.FXPerf = {
    getLevel: ()=> level,
    setLevel,
    config: cfg
  };

  requestAnimationFrame(loop);

})(typeof window!=='undefined' ? window : globalThis);