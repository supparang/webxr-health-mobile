(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});

  // --- tiny beep (no external audio file) ---
  let ac = null;
  function ensureAC(){
    try{
      ac = ac || new (root.AudioContext || root.webkitAudioContext)();
      return ac;
    }catch(e){ return null; }
  }
  function beep(freq=900, ms=55, gain=0.05){
    const ctx = ensureAC();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    o.start(t0);
    o.stop(t0 + ms/1000);
  }

  const FX = {
    panic(on){
      DOC.documentElement.classList.toggle('panic', !!on);
    },
    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 240);
    },
    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 240);
    },
    storm(on){
      DOC.documentElement.classList.toggle('storm', !!on);
    },
    stormBadFlash(){
      DOC.documentElement.classList.add('storm-badflash');
      setTimeout(()=>DOC.documentElement.classList.remove('storm-badflash'), 180);
    },
    stormTick(secLeft){
      // higher pitch when time is lower
      const f = secLeft <= 2 ? 1200 : secLeft <= 3 ? 1080 : 980;
      beep(f, 55, 0.055);
    },
    afterimage(xpx, ypx, emoji){
      const mk = (cls, dur)=>{
        const wrap = DOC.createElement('div');
        wrap.className = 'fg-afterimage ' + cls;
        const inner = DOC.createElement('div');
        inner.className = 'fg-afterimage-inner';
        inner.textContent = emoji || '✨';
        inner.style.setProperty('--x', (xpx||0) + 'px');
        inner.style.setProperty('--y', (ypx||0) + 'px');
        wrap.appendChild(inner);
        DOC.body.appendChild(wrap);
        setTimeout(()=>{ try{ wrap.remove(); }catch{} }, dur);
      };
      mk('a1', 260);
      mk('a2', 320);
    }
  };

  NS.FX = NS.FX || FX;
})(window);