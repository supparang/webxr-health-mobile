/* === /herohealth/vr-groups/fx-perf.js ===
PACK 40: FXPerf Auto — PRODUCTION
✅ Auto-detect FPS and set FX level 1..3
✅ Stores in body.dataset.fxLevel + localStorage (HHA_FX_LEVEL)
✅ query override: ?fx=1|2|3 or ?fx=auto
✅ Safe on mobile, no dependencies
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const LS = 'HHA_FX_LEVEL';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  let mode = String(qs('fx','auto')||'auto').toLowerCase();
  let forced = 0;
  if (mode === '1' || mode === '2' || mode === '3') forced = Number(mode)||0;

  function setLevel(lv){
    lv = Math.max(1, Math.min(3, Number(lv)||2));
    DOC.body.dataset.fxLevel = String(lv);
    try{ localStorage.setItem(LS, String(lv)); }catch(_){}
    return lv;
  }

  function getSaved(){
    try{
      const v = localStorage.getItem(LS);
      const n = Number(v);
      if (n>=1 && n<=3) return n;
    }catch(_){}
    return 3;
  }

  let cur = forced ? setLevel(forced) : setLevel(getSaved());

  // simple FPS sampler
  let frames = 0;
  let t0 = performance.now();
  let lastEval = t0;

  // thresholds tuned for mobile webview
  function decideLevel(fps){
    // >56 => 3, 42-56 => 2, <42 => 1
    if (fps >= 56) return 3;
    if (fps >= 42) return 2;
    return 1;
  }

  function loop(t){
    frames++;
    const dt = t - t0;
    if (dt >= 900){
      const fps = (frames / dt) * 1000;
      t0 = t; frames = 0;

      if (mode === 'auto' && !forced){
        const next = decideLevel(fps);

        // hysteresis: don’t flap too often
        const since = t - lastEval;
        if (since > 1400 && next !== cur){
          cur = setLevel(next);
          lastEval = t;
          try{
            root.dispatchEvent(new CustomEvent('groups:fxlevel', { detail:{ level: cur, fps: Math.round(fps) } }));
          }catch(_){}
        }
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  NS.FXPerf = {
    getLevel(){ return Number(DOC.body.dataset.fxLevel||2)||2; },
    setLevel(lv){ mode='manual'; forced=Number(lv)||2; return setLevel(forced); },
    setAuto(){ mode='auto'; forced=0; return setLevel(getSaved()); }
  };

})(typeof window!=='undefined'?window:globalThis);