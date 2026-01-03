/* === /herohealth/vr-groups/fx-perf.js ===
PACK 21: Performance Guard — PRODUCTION
✅ FPS monitor (cheap) + auto degrade FX level
✅ Exposes GroupsVR.FXPerf.getLevel()/setLevel()
Levels:
  3 ultra (default)
  2 normal
  1 lite
  0 off
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  let level = 3;          // start ultra
  let auto = true;

  // rolling FPS
  let lastT = now();
  let frames = 0;
  let fps = 60;
  let sampleAt = lastT;

  // thresholds
  const DOWN_1 = 48; // below -> reduce
  const DOWN_0 = 38;
  const UP_1   = 55; // above -> recover
  const UP_2   = 58;

  function applyLevel(){
    DOC.body.dataset.fxLevel = String(level);
    DOC.body.classList.toggle('fx-lite', level<=1);
    DOC.body.classList.toggle('fx-off', level<=0);
  }

  function setLevel(n, opts={}){
    level = clamp(n,0,3)|0;
    if (opts.auto === false) auto = false;
    if (opts.auto === true) auto = true;
    applyLevel();
  }

  function getLevel(){ return level|0; }
  function getFps(){ return Math.round(fps); }

  function tick(){
    frames++;
    const t = now();
    const dt = t - lastT;
    lastT = t;

    if (t - sampleAt >= 650){
      fps = (frames * 1000) / Math.max(1, (t - sampleAt));
      frames = 0;
      sampleAt = t;

      if (auto){
        // degrade
        if (fps < DOWN_0 && level > 0) level = Math.max(0, level - 1);
        else if (fps < DOWN_1 && level > 1) level = Math.max(1, level - 1);

        // recover (slow)
        if (fps > UP_2 && level < 3) level = Math.min(3, level + 1);
        else if (fps > UP_1 && level < 2) level = Math.min(2, level + 1);

        applyLevel();
      }
    }

    root.requestAnimationFrame(tick);
  }

  // public API
  NS.FXPerf = { setLevel, getLevel, getFps };

  applyLevel();
  root.requestAnimationFrame(tick);

})(typeof window!=='undefined' ? window : globalThis);