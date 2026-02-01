// === /herohealth/vr/particles.js ===
// HHA FX Core — PRODUCTION (SAFE, LIGHTWEIGHT)
// ✅ Provides window.HHA_FX: flash/ring/burst/confetti/popEmoji/popText
// ✅ Back-compat: window.Particles.* (same API subset)
// ✅ DOM-only, no canvas, pointer-events:none
// ✅ Safe: never throws; auto cleanup; respects reduced-motion
// ✅ Designed to be shared across all HeroHealth games

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC || root.__HHA_FX_CORE__) return;
  root.__HHA_FX_CORE__ = true;

  // ---------- helpers ----------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const rnd = (a,b)=> a + Math.random()*(b-a);
  const irnd = (a,b)=> Math.floor(rnd(a,b+1));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function reducedMotion(){
    try{
      return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(_){ return false; }
  }

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.setAttribute('aria-hidden','true');
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      // IMPORTANT: keep above playfield targets but below topmost UI if needed.
      // Most HHA HUD uses 170-190; put FX around 140.
      'z-index:140',
      'overflow:hidden'
    ].join(';');
    DOC.body.appendChild(layer);
    return layer;
  }

  function cssOnce(){
    if (DOC.getElementById('hha-fx-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      .hha-fx-layer{contain:layout paint size;}
      .hha-fx{position:absolute;left:0;top:0;transform:translate(-50%,-50%);will-change:transform,opacity;}
      .hha-fx-pop{font:900 18px/1 system-ui;color:#fff;text-shadow:0 10px 26px rgba(0,0,0,.55);opacity:.98;}
      .hha-fx-emoji{font:900 30px/1 system-ui;filter:drop-shadow(0 10px 22px rgba(0,0,0,.55));}

      @keyframes hhaPopUp{
        0%{transform:translate(-50%,-50%) scale(.92);opacity:.96;}
        70%{transform:translate(-50%,-74%) scale(1.20);opacity:1;}
        100%{transform:translate(-50%,-96%) scale(1.06);opacity:0;}
      }

      .hha-ring{width:10px;height:10px;border-radius:999px;border:2px solid rgba(255,255,255,.85);opacity:.9;}
      @keyframes hhaRing{
        0%{transform:translate(-50%,-50%) scale(.35);opacity:.85;}
        70%{transform:translate(-50%,-50%) scale(1.00);opacity:.55;}
        100%{transform:translate(-50%,-50%) scale(1.25);opacity:0;}
      }

      .hha-flash{width:10px;height:10px;border-radius:999px;background:rgba(255,255,255,.95);filter:blur(0.5px);opacity:.75;}
      @keyframes hhaFlash{
        0%{transform:translate(-50%,-50%) scale(.40);opacity:.75;}
        40%{transform:translate(-50%,-50%) scale(1.00);opacity:.55;}
        100%{transform:translate(-50%,-50%) scale(1.40);opacity:0;}
      }

      .hha-bit{
        width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.92);
        filter:drop-shadow(0 8px 18px rgba(0,0,0,.30));
      }
      @keyframes hhaBit{
        0%{transform:translate3d(var(--x0),var(--y0),0) scale(1);opacity:1;}
        100%{transform:translate3d(var(--x1),var(--y1),0) scale(.65);opacity:0;}
      }

      .hha-conf{
        width:10px;height:6px;border-radius:3px;background:rgba(255,255,255,.92);
        transform:translate(-50%,-50%);
        filter:drop-shadow(0 10px 18px rgba(0,0,0,.25));
      }
      @keyframes hhaConf{
        0%{transform:translate3d(var(--x0),var(--y0),0) rotate(0deg);opacity:1;}
        100%{transform:translate3d(var(--x1),var(--y1),0) rotate(520deg);opacity:0;}
      }
    `;
    DOC.head.appendChild(st);
  }

  function makeEl(cls, x, y){
    cssOnce();
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = cls;
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    layer.appendChild(el);
    return el;
  }

  function hueCSS(hue){
    // Use hue-rotate for simple theming without hardcoding color palettes
    const h = Number(hue);
    if(!Number.isFinite(h)) return '';
    return `filter:hue-rotate(${Math.round(h)}deg)`;
  }

  function cleanupLater(el, ms){
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, Math.max(60, ms|0));
  }

  // ---------- core FX ----------
  function popText(x,y,text, opt){
    try{
      if (!text) return;
      if (reducedMotion()) return; // keep it calm when reduced-motion
      opt = opt || {};
      const size = clamp(opt.size ?? 18, 12, 44);
      const el = makeEl('hha-fx hha-fx-pop', x, y);
      el.textContent = String(text);
      el.style.fontSize = size + 'px';
      if(opt.hue != null) el.style.cssText += ';' + hueCSS(opt.hue);
      el.style.animation = 'hhaPopUp 520ms ease-out forwards';
      cleanupLater(el, 620);
    }catch(_){}
  }

  function popEmoji(x,y,emoji, opt){
    try{
      if (!emoji) return;
      if (reducedMotion()) return;
      opt = opt || {};
      const size = clamp(opt.size ?? 30, 16, 72);
      const el = makeEl('hha-fx hha-fx-emoji', x, y);
      el.textContent = String(emoji);
      el.style.fontSize = size + 'px';
      if(opt.hue != null) el.style.cssText += ';' + hueCSS(opt.hue);
      el.style.animation = 'hhaPopUp 560ms ease-out forwards';
      cleanupLater(el, 680);
    }catch(_){}
  }

  function ring(x,y,opt){
    try{
      if (reducedMotion()) return;
      opt = opt || {};
      const size = clamp(opt.size ?? 26, 12, 140);
      const el = makeEl('hha-fx hha-ring', x, y);
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      if(opt.hue != null) el.style.cssText += ';' + hueCSS(opt.hue);
      el.style.animation = 'hhaRing 520ms ease-out forwards';
      cleanupLater(el, 620);
    }catch(_){}
  }

  function flash(x,y,opt){
    try{
      if (reducedMotion()) return;
      opt = opt || {};
      const size = clamp(opt.size ?? 26, 12, 160);
      const el = makeEl('hha-fx hha-flash', x, y);
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      if(opt.hue != null) el.style.cssText += ';' + hueCSS(opt.hue);
      el.style.animation = 'hhaFlash 360ms ease-out forwards';
      cleanupLater(el, 460);
    }catch(_){}
  }

  function burst(x,y,opt){
    try{
      if (reducedMotion()) return;
      opt = opt || {};
      const count = clamp(opt.count ?? 12, 2, 60);
      const speed = clamp(opt.speed ?? 620, 180, 1800);
      const size  = clamp(opt.size ?? 10, 4, 24);
      const lifeMs= clamp(opt.lifeMs ?? 620, 220, 2000);
      const hue = opt.hue;

      // Use a tiny container for bits
      const layer = ensureLayer();
      cssOnce();

      for(let i=0;i<count;i++){
        const el = DOC.createElement('div');
        el.className = 'hha-fx hha-bit';
        el.style.left = (x|0) + 'px';
        el.style.top  = (y|0) + 'px';
        el.style.width = size + 'px';
        el.style.height= size + 'px';
        if(hue != null) el.style.cssText += ';' + hueCSS(hue);

        // random direction
        const ang = rnd(0, Math.PI*2);
        const dist = rnd(speed*0.35, speed*0.75);
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;

        el.style.setProperty('--x0', '-50%');
        el.style.setProperty('--y0', '-50%');
        // translate3d uses absolute px from origin, but we want relative => do it inside CSS vars
        // hack: use CSS vars to represent final offset; initial is -50% -50%
        el.style.setProperty('--x1', `calc(-50% + ${Math.round(dx)}px)`);
        el.style.setProperty('--y1', `calc(-50% + ${Math.round(dy)}px)`);

        el.style.animation = `hhaBit ${lifeMs}ms cubic-bezier(.12,.88,.18,1) forwards`;
        layer.appendChild(el);
        cleanupLater(el, lifeMs + 80);
      }
    }catch(_){}
  }

  function confetti(x,y,opt){
    try{
      if (reducedMotion()) return;
      opt = opt || {};
      const count = clamp(opt.count ?? 18, 3, 80);
      const lifeMs= clamp(opt.lifeMs ?? 1100, 350, 2800);
      const hue = opt.hue;

      const layer = ensureLayer();
      cssOnce();

      for(let i=0;i<count;i++){
        const el = DOC.createElement('div');
        el.className = 'hha-fx hha-conf';
        el.style.left = (x|0) + 'px';
        el.style.top  = (y|0) + 'px';
        if(hue != null) el.style.cssText += ';' + hueCSS(hue);

        const dx = rnd(-220, 220);
        const dy = rnd(180, 520);

        el.style.setProperty('--x0', '-50%');
        el.style.setProperty('--y0', '-50%');
        el.style.setProperty('--x1', `calc(-50% + ${Math.round(dx)}px)`);
        el.style.setProperty('--y1', `calc(-50% + ${Math.round(dy)}px)`);

        const dur = lifeMs + irnd(-140, 160);
        el.style.animation = `hhaConf ${dur}ms cubic-bezier(.12,.88,.18,1) forwards`;

        // slight variety
        el.style.width  = irnd(8, 14) + 'px';
        el.style.height = irnd(5, 9) + 'px';
        el.style.borderRadius = irnd(2, 5) + 'px';
        el.style.opacity = String(rnd(0.75, 0.98));

        layer.appendChild(el);
        cleanupLater(el, dur + 100);
      }
    }catch(_){}
  }

  // ---------- public API ----------
  const API = {
    popText,
    popEmoji,
    ring,
    flash,
    burst,
    confetti
  };

  // Preferred namespace
  root.HHA_FX = root.HHA_FX || API;

  // Back-compat namespace (and allow mixing existing code)
  root.Particles = root.Particles || {};
  // Keep old Particles.popText if already exists; otherwise provide ours
  if(typeof root.Particles.popText !== 'function') root.Particles.popText = popText;

  // Provide the rest under Particles too (safe, non-breaking)
  if(typeof root.Particles.popEmoji !== 'function') root.Particles.popEmoji = popEmoji;
  if(typeof root.Particles.ring !== 'function') root.Particles.ring = ring;
  if(typeof root.Particles.flash !== 'function') root.Particles.flash = flash;
  if(typeof root.Particles.burst !== 'function') root.Particles.burst = burst;
  if(typeof root.Particles.confetti !== 'function') root.Particles.confetti = confetti;

  // Tiny self-test helper (optional)
  root.HHA_FX_TEST = function(){
    try{
      const W = DOC.documentElement.clientWidth || innerWidth || 360;
      const H = DOC.documentElement.clientHeight || innerHeight || 640;
      const x = Math.round(W/2), y = Math.round(H/2);
      flash(x,y,{size:34}); ring(x,y,{size:34,hue:120});
      burst(x,y,{count:14,speed:700,size:10,lifeMs:700,hue:120});
      popEmoji(x,y,'✨',{size:40});
      popText(x,y,'FX OK',{size:20});
      confetti(x,y,{count:18,lifeMs:1200,hue:200});
    }catch(_){}
  };

})(window);