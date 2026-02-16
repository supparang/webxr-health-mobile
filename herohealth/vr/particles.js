// === /herohealth/vr/particles.js ===
// HeroHealth FX Particles — SAFE — PRODUCTION v20260215a
// ✅ No external deps
// ✅ Never crashes if target elements missing
// ✅ Provides tiny FX helpers via window.HHA_FX
//
// Supported (best-effort):
// - flash(idOrEl, ms=120, opacity=1)
// - shake(elOrSelector, ms=220, px=6)
// - burst(x,y,{n=18,spread=70,life=520,size=6,gravity=0.18})  // confetti-like
// - pulse(idOrEl, on=true, cls='fx-on')  // toggle css class
//
// Optional DOM hooks (if present):
// - #hitFx : flash overlay
// - #plate-layer or body : burst container
//
// Events (optional):
// - listens to hha:judge => flashes/bursts on good/junk
// - listens to hha:labels => milestone confetti
//
// NOTE: This file is SAFE utility only; games can ignore it.

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const FX = {};
  WIN.HHA_FX = WIN.HHA_FX || FX;

  function qs(sel){
    try{ return DOC.querySelector(sel); }catch{ return null; }
  }
  function getEl(x){
    if(!x) return null;
    if(typeof x === 'string'){
      // id or selector
      const byId = DOC.getElementById(x);
      if(byId) return byId;
      return qs(x);
    }
    return x;
  }
  function clamp(v,a,b){
    v = Number(v)||0;
    return v<a?a:(v>b?b:v);
  }

  // ---------- Flash overlay ----------
  FX.flash = function(idOrEl, ms=120, opacity=1){
    try{
      const el = getEl(idOrEl) || DOC.getElementById('hitFx');
      if(!el) return;
      const o = clamp(opacity, 0, 1);
      el.style.opacity = String(o);
      el.style.display = 'block';
      setTimeout(()=>{
        try{ el.style.opacity = '0'; }catch{}
      }, Math.max(20, ms|0));
      setTimeout(()=>{
        try{ el.style.display = ''; }catch{}
      }, Math.max(40, (ms|0) + 160));
    }catch{}
  };

  // ---------- Shake ----------
  FX.shake = function(elOrSel, ms=220, px=6){
    try{
      const el = getEl(elOrSel) || DOC.body;
      if(!el) return;
      const dur = clamp(ms, 80, 900);
      const amp = clamp(px, 2, 22);

      const start = performance.now ? performance.now() : Date.now();
      const base = el.style.transform || '';
      const raf = (cb)=> (WIN.requestAnimationFrame ? WIN.requestAnimationFrame(cb) : setTimeout(cb, 16));

      function step(){
        const t = (performance.now ? performance.now() : Date.now()) - start;
        const p = clamp(t / dur, 0, 1);
        // ease out
        const e = 1 - Math.pow(p, 2);
        const dx = (Math.random()*2-1) * amp * e;
        const dy = (Math.random()*2-1) * amp * e;
        try{ el.style.transform = `${base} translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`; }catch{}
        if(p < 1) raf(step);
        else{
          try{ el.style.transform = base; }catch{}
        }
      }
      raf(step);
    }catch{}
  };

  // ---------- Burst (confetti-like) ----------
  function ensureBurstLayer(){
    // prefer plate-layer; else body
    return DOC.getElementById('plate-layer') || DOC.body;
  }

  FX.burst = function(x,y, opt={}){
    try{
      const layer = ensureBurstLayer();
      if(!layer) return;

      const n = clamp(opt.n ?? 18, 6, 60);
      const spread = clamp(opt.spread ?? 70, 20, 200);
      const life = clamp(opt.life ?? 520, 220, 1600);
      const size = clamp(opt.size ?? 6, 3, 18);
      const gravity = clamp(opt.gravity ?? 0.18, 0, 1);

      const rect = layer.getBoundingClientRect();
      const ox = clamp(Number(x)|| (rect.left+rect.width/2), rect.left, rect.right);
      const oy = clamp(Number(y)|| (rect.top+rect.height/2), rect.top, rect.bottom);

      // convert to layer local
      const lx = ox - rect.left;
      const ly = oy - rect.top;

      const frag = DOC.createDocumentFragment();

      for(let i=0;i<n;i++){
        const p = DOC.createElement('i');
        p.style.position = 'absolute';
        p.style.left = `${lx}px`;
        p.style.top  = `${ly}px`;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.borderRadius = '999px';
        p.style.pointerEvents = 'none';
        p.style.zIndex = '60';
        p.style.opacity = '0.95';
        p.style.transform = 'translate(-50%,-50%)';
        // no fixed colors by spec? (not requested) -> random alpha only; use currentColor-ish
        // We'll use white-ish with varying opacity; games can override via CSS if desired.
        p.style.background = `rgba(255,255,255,${(0.35 + Math.random()*0.45).toFixed(2)})`;

        const ang = Math.random()*Math.PI*2;
        const spd = (0.55 + Math.random()*0.9) * spread;
        const vx0 = Math.cos(ang) * spd;
        const vy0 = Math.sin(ang) * spd * 0.7 - spread*0.35;

        const spin = (Math.random()*2-1) * 720; // deg/s

        const t0 = performance.now ? performance.now() : Date.now();

        function tick(){
          const tn = performance.now ? performance.now() : Date.now();
          const dt = (tn - t0) / 1000;
          const tLife = clamp((tn - t0) / life, 0, 1);

          const vx = vx0;
          const vy = vy0 + gravity * 380 * dt;

          const dx = vx * dt;
          const dy = vy * dt;

          const fade = 1 - tLife;
          try{
            p.style.transform =
              `translate(${(-50 + dx).toFixed(2)}px, ${(-50 + dy).toFixed(2)}px) rotate(${(spin*dt).toFixed(1)}deg)`;
            p.style.opacity = String(clamp(fade, 0, 1));
          }catch{}

          if(tLife < 1){
            (WIN.requestAnimationFrame ? WIN.requestAnimationFrame(tick) : setTimeout(tick, 16));
          }else{
            try{ p.remove(); }catch{}
          }
        }

        (WIN.requestAnimationFrame ? WIN.requestAnimationFrame(tick) : setTimeout(tick, 16));

        frag.appendChild(p);
      }

      layer.appendChild(frag);
    }catch{}
  };

  // ---------- Pulse class toggle ----------
  FX.pulse = function(idOrEl, on=true, cls='fx-on'){
    try{
      const el = getEl(idOrEl);
      if(!el) return;
      if(on) el.classList.add(cls);
      else el.classList.remove(cls);
    }catch{}
  };

  // ---------- Optional auto hooks ----------
  function getXYFromEvent(e){
    try{
      const d = e?.detail || {};
      const x = Number(d.x);
      const y = Number(d.y);
      if(Number.isFinite(x) && Number.isFinite(y)) return {x,y};
    }catch{}
    // fallback: center
    try{ return { x: innerWidth/2, y: innerHeight/2 }; }catch{ return {x:0,y:0}; }
  }

  // judge -> quick feedback
  WIN.addEventListener('hha:judge', (e)=>{
    try{
      const d = e?.detail || {};
      const k = String(d.kind||'').toLowerCase();

      if(k === 'good'){
        FX.flash('hitFx', 90, 0.35);
        const {x,y} = getXYFromEvent(e);
        FX.burst(x,y,{ n:14, spread:58, life:520, size:6 });
      }else if(k === 'junk' || k === 'expire_good'){
        FX.flash('hitFx', 120, 0.55);
        FX.shake(DOC.body, 220, 7);
      }else if(k.includes('boss') || k.includes('storm')){
        FX.flash('hitFx', 140, 0.45);
      }
    }catch{}
  }, { passive:true });

  // labels milestone -> celebration
  WIN.addEventListener('hha:labels', (e)=>{
    try{
      const d = e?.detail || {};
      if(String(d.type||'') === 'milestone'){
        FX.flash('hitFx', 140, 0.38);
        FX.burst(innerWidth/2, innerHeight/2, { n:28, spread:110, life:760, size:7 });
      }
      if(String(d.type||'') === 'end'){
        FX.burst(innerWidth/2, innerHeight/2, { n:34, spread:140, life:920, size:7 });
      }
    }catch{}
  }, { passive:true });

})();