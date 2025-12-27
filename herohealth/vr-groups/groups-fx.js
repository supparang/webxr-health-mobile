(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});

  // ---------- Tiny beep (no external audio file) ----------
  let ac = null;

  function ensureAC(){
    try{
      ac = ac || new (root.AudioContext || root.webkitAudioContext)();
      return ac;
    }catch(e){ return null; }
  }

  async function resumeAudio(){
    const ctx = ensureAC();
    if (!ctx) return false;
    try{
      if (ctx.state === 'suspended') await ctx.resume();
      return true;
    }catch(e){ return false; }
  }

  function beep(freq=900, ms=55, gain=0.05){
    const ctx = ensureAC();
    if (!ctx) return;
    try{
      if (ctx.state === 'suspended') return;

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = 'sine';
      o.frequency.value = freq;

      const t0 = ctx.currentTime;
      const dur = Math.max(0.02, ms/1000);

      // ramp กัน click
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);

      o.connect(g); g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.01);
    }catch(e){}
  }

  // ---------- Pulse helper ----------
  let pulseTo = null;
  function stormPulse(secLeft){
    const el = DOC.documentElement;
    const s = (secLeft|0);

    // intensity: ใกล้หมดแรงขึ้น
    const k = (s <= 1) ? 1.0 : (s <= 2) ? 0.85 : (s <= 3) ? 0.7 : 0.55;
    el.style.setProperty('--stormPulse', String(k));

    el.classList.add('storm-pulse');
    if (pulseTo) clearTimeout(pulseTo);
    pulseTo = setTimeout(()=>{ el.classList.remove('storm-pulse'); }, 140);

    // tiny vibration (optional, safe)
    try{
      if (root.navigator && navigator.vibrate){
        if (s <= 2) navigator.vibrate(18);
        else if (s <= 3) navigator.vibrate(10);
      }
    }catch(e){}
  }

  const FX = {
    resumeAudio,

    panic(on){ DOC.documentElement.classList.toggle('panic', !!on); },

    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 240);
    },

    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 240);
    },

    storm(on){
      const el = DOC.documentElement;
      el.classList.toggle('storm', !!on);
      if (!on){
        el.classList.remove('storm-pulse');
        el.style.setProperty('--stormPulse', '0');
      }
    },

    stormBadFlash(){
      DOC.documentElement.classList.add('storm-badflash');
      setTimeout(()=>DOC.documentElement.classList.remove('storm-badflash'), 180);
    },

    // ✅ “ติ๊กๆ” + pulse ขอบจอ + เข้มขึ้นช่วงท้าย
    stormTick(secLeft){
      const s = (secLeft|0);
      stormPulse(s);

      if (s <= 2){
        // double tick (เร่งใจ)
        beep(1220, 55, 0.060);
        setTimeout(()=>beep(1420, 40, 0.050), 95);
      } else if (s <= 3){
        beep(1100, 55, 0.055);
      } else {
        beep(980, 55, 0.050);
      }
    },

    afterimage(xpx, ypx, emoji){
      const mk = (dur, scale, op)=>{
        const wrap = DOC.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = (xpx||0) + 'px';
        wrap.style.top  = (ypx||0) + 'px';
        wrap.style.transform = `translate(-50%,-50%) scale(${scale})`;
        wrap.style.zIndex = '60';
        wrap.style.pointerEvents = 'none';
        wrap.style.opacity = String(op);
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
      mk(260, 1.00, 0.75);
      mk(320, 0.92, 0.55);
    }
  };

  // ✅ merge ปลอดภัย
  NS.FX = Object.assign(NS.FX || {}, FX);

})(typeof window !== 'undefined' ? window : globalThis);