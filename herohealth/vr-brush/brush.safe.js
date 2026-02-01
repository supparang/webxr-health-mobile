// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE Engine — starter scaffold (A+B+C spec ready to extend)
(function(){
  'use strict';
  const WIN = window, DOC = document;

  function emit(n,d){ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){ } }
  function makeRNG(seed){
    let x = (Number(seed)||Date.now()) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  // Minimal HUD helpers (you can replace with full HUD module later)
  const HUD = (function(){
    const id = (s)=>DOC.getElementById(s);
    const el = { tLeft:id('tLeft'), tFill:id('tFill'), tPhase:id('tPhase') };
    function setTimer(secLeft, secTotal, phase){
      if(el.tLeft){
        const m = Math.floor(secLeft/60), s = Math.floor(secLeft%60);
        el.tLeft.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }
      if(el.tPhase) el.tPhase.textContent = phase||'';
      if(el.tFill){
        const pct = secTotal>0 ? (secLeft/secTotal)*100 : 0;
        el.tFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      }
    }
    return { setTimer };
  })();

  function boot(ctx){
    const rng = makeRNG(ctx.seed);
    const t0 = performance.now();
    const total = Number(ctx.time)||90;
    let left = total;

    emit('hha:start', { game:'brush', ctx });

    let lastEmit = 0;
    function raf(now){
      const dt = Math.min(0.05, (now - (WIN.__BRUSH_LAST__||now)) / 1000);
      WIN.__BRUSH_LAST__ = now;

      left = Math.max(0, left - dt);

      // update HUD
      HUD.setTimer(left, total, 'INTRO • Loading');

      // emit time tick
      if(now - lastEmit > 250){
        lastEmit = now;
        emit('hha:time', { tLeft:left, score:0 });
      }

      if(left<=0){
        const summary = { scoreTotal:0, rank:'D', meta:ctx, durationSec:total, tsStart:t0, tsEnd:now };
        emit('hha:end', { summary });
        return;
      }
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  WIN.BrushVR = WIN.BrushVR || {};
  WIN.BrushVR.boot = boot;
})();