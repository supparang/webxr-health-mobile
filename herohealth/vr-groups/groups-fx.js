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
      // iOS/Android often requires resume on user gesture — we'll resume on first start click in HTML too
      return ac;
    }catch(e){ return null; }
  }
  function beep(freq=900, ms=55, gain=0.05){
    const ctx = ensureAC();
    if (!ctx) return;
    try{
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime;
      o.start(t0);
      o.stop(t0 + ms/1000);
    }catch(e){}
  }

  const FX = {
    panic(on){ DOC.documentElement.classList.toggle('panic', !!on); },
    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 240);
    },
    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 240);
    },

    storm(on){ DOC.documentElement.classList.toggle('storm', !!on); },
    stormBadFlash(){
      DOC.documentElement.classList.add('storm-badflash');
      setTimeout(()=>DOC.documentElement.classList.remove('storm-badflash'), 180);
    },
    stormTick(secLeft){
      const f = secLeft <= 2 ? 1200 : secLeft <= 3 ? 1080 : 980;
      beep(f, 55, 0.055);
    },

    afterimage(xpx, ypx, emoji){
      // lightweight afterimage dots (optional)
      const mk = (cls, dur, scale)=>{
        const wrap = DOC.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = (xpx||0) + 'px';
        wrap.style.top  = (ypx||0) + 'px';
        wrap.style.transform = `translate(-50%,-50%) scale(${scale})`;
        wrap.style.zIndex = '55';
        wrap.style.pointerEvents = 'none';
        wrap.style.opacity = cls === 'a1' ? '0.75' : '0.5';
        wrap.style.transition = 'opacity .18s ease-out, transform .18s ease-out';
        wrap.textContent = emoji || '✨';
        wrap.style.fontSize = '38px';
        DOC.body.appendChild(wrap);
        setTimeout(()=>{
          wrap.style.opacity = '0';
          wrap.style.transform = `translate(-50%,-55%) scale(${scale*0.92})`;
        }, 10);
        setTimeout(()=>{ try{ wrap.remove(); }catch{} }, dur);
      };
      mk('a1', 260, 1.0);
      mk('a2', 320, 0.92);
    }
  };

  NS.FX = NS.FX || FX;
})(window);