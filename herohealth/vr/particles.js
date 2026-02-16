// === /herohealth/vr/particles.js ===
// HHA Particles / FX — SAFE UNIVERSAL — v20260215b
// Purpose: provide lightweight DOM FX for hits/misses and mini-events.
// ✅ No deps, no canvas required
// ✅ Works on PC/Mobile/cVR
// ✅ Listens to: hha:judge, hha:coach, hha:labels (optional)
// ✅ Exposes: window.HHA_FX.flash(kind), burst(x,y,kind), shake(intensityMs)
//
// How it works:
// - Creates #hha-fx-layer overlay (pointer-events:none)
// - Spawns small emoji/spark particles with CSS animation
// - Optional screen flash for success/fail
//
// Notes: keep it SMALL + SAFE. Games can override styling if needed.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // Avoid double-init
  if(WIN.HHA_FX && WIN.HHA_FX.__ready) return;

  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function rnd(n){ return Math.random()*n; }

  // ---- layer ----
  let layer = null;
  let flashEl = null;
  let styleEl = null;
  let lastShakeAt = 0;

  function ensureLayer(){
    if(layer && flashEl) return;

    layer = DOC.getElementById('hha-fx-layer');
    if(!layer){
      layer = DOC.createElement('div');
      layer.id = 'hha-fx-layer';
      DOC.body.appendChild(layer);
    }

    flashEl = DOC.getElementById('hha-fx-flash');
    if(!flashEl){
      flashEl = DOC.createElement('div');
      flashEl.id = 'hha-fx-flash';
      DOC.body.appendChild(flashEl);
    }

    styleEl = DOC.getElementById('hha-fx-style');
    if(!styleEl){
      styleEl = DOC.createElement('style');
      styleEl.id = 'hha-fx-style';
      styleEl.textContent = `
        #hha-fx-layer{
          position:fixed; inset:0;
          z-index:9999;
          pointer-events:none;
          overflow:hidden;
        }
        #hha-fx-flash{
          position:fixed; inset:0;
          z-index:9998;
          pointer-events:none;
          opacity:0;
          transition: opacity .14s ease;
          background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.22), rgba(255,255,255,0) 55%);
          mix-blend-mode: screen;
        }
        .hha-p{
          position:absolute;
          left:0; top:0;
          transform: translate(-50%,-50%);
          font-size:18px;
          opacity:0.0;
          will-change: transform, opacity;
          filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
          animation: hha-pop .62s ease-out forwards;
          user-select:none;
          white-space:pre;
        }
        .hha-p.big{ font-size:24px; }
        .hha-p.tiny{ font-size:14px; }
        @keyframes hha-pop{
          0%   { opacity:0; transform: translate(-50%,-50%) scale(.6); }
          12%  { opacity:1; transform: translate(-50%,-50%) scale(1.06); }
          100% { opacity:0; transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, -90px))) scale(.9); }
        }

        /* screen shake via body transform */
        body.hha-shake{
          animation: hha-shake .18s linear 0s 1;
        }
        @keyframes hha-shake{
          0%{ transform: translate(0,0); }
          25%{ transform: translate(2px,-1px); }
          50%{ transform: translate(-2px,2px); }
          75%{ transform: translate(1px,1px); }
          100%{ transform: translate(0,0); }
        }
      `;
      DOC.head.appendChild(styleEl);
    }
  }

  // ---- helpers ----
  function spawnParticle(x,y, ch, dx, dy, cls){
    ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'hha-p' + (cls ? (' '+cls) : '');
    el.textContent = ch;
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.setProperty('--dx', `${Math.round(dx)}px`);
    el.style.setProperty('--dy', `${Math.round(dy)}px`);
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
  }

  function getCenterXY(){
    return { x: (innerWidth/2), y: (innerHeight/2) };
  }

  // ---- public FX ----
  function flash(kind='ok'){
    ensureLayer();
    // kinds: ok | bad | fever | win
    let op = 0.18;
    if(kind === 'bad') op = 0.22;
    if(kind === 'fever') op = 0.20;
    if(kind === 'win') op = 0.26;

    // tint by kind (safe: use filter)
    flashEl.style.opacity = String(op);
    flashEl.style.filter =
      (kind === 'bad') ? 'hue-rotate(320deg) saturate(1.2)' :
      (kind === 'fever') ? 'hue-rotate(40deg) saturate(1.3)' :
      (kind === 'win') ? 'hue-rotate(110deg) saturate(1.4)' :
      'none';

    setTimeout(()=>{ flashEl.style.opacity = '0'; }, 120);
  }

  function burst(x,y, kind='good'){
    ensureLayer();

    const base = (kind === 'junk' || kind === 'bad') ? ['💥','⚠️','✖️','💢'] :
                 (kind === 'storm') ? ['🌪️','✨','⚡','💫'] :
                 (kind === 'boss') ? ['👹','🔥','⚡','💥'] :
                 (kind === 'win') ? ['🎉','✨','🏆','💫'] :
                 ['✨','⭐','💫','✅'];

    const n = (kind === 'boss' || kind === 'storm') ? 10 : 7;
    for(let i=0;i<n;i++){
      const ch = base[Math.floor(Math.random()*base.length)];
      const dx = (Math.random()-0.5) * (kind==='boss'?220:180);
      const dy = - (40 + Math.random()* (kind==='boss'?190:150));
      const cls = (i%5===0) ? 'big' : (i%3===0 ? 'tiny' : '');
      spawnParticle(x, y, ch, dx, dy, cls);
    }
  }

  function shake(){
    const t = now();
    if(t - lastShakeAt < 180) return;
    lastShakeAt = t;
    DOC.body.classList.remove('hha-shake');
    // force reflow
    void DOC.body.offsetWidth;
    DOC.body.classList.add('hha-shake');
    setTimeout(()=> DOC.body.classList.remove('hha-shake'), 220);
  }

  // Expose API
  WIN.HHA_FX = {
    __ready:true,
    flash,
    burst,
    shake
  };

  // ---- event wiring (optional) ----
  // hha:judge detail.kind: good|junk|expire_good|storm_clear|storm_fail|boss_win|boss_lose
  WIN.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    const k = String(d.kind||'').toLowerCase();
    const c = getCenterXY();

    if(k === 'good'){
      flash('ok');
      burst(c.x, c.y, 'good');
    }else if(k === 'junk' || k === 'expire_good'){
      flash('bad');
      burst(c.x, c.y, 'bad');
      shake();
    }else if(k === 'storm_clear'){
      flash('fever');
      burst(c.x, c.y, 'storm');
    }else if(k === 'storm_fail'){
      flash('bad');
      burst(c.x, c.y, 'bad');
      shake();
    }else if(k === 'boss_win'){
      flash('win');
      burst(c.x, c.y, 'win');
    }else if(k === 'boss_lose'){
      flash('bad');
      burst(c.x, c.y, 'boss');
      shake();
    }
  }, { passive:true });

  // hha:labels milestones (optional)
  WIN.addEventListener('hha:labels', (e)=>{
    const d = e.detail || {};
    const type = String(d.type||'');
    const name = String(d.name||'');
    if(type === 'milestone'){
      const c = getCenterXY();
      burst(c.x, c.y, 'win');
      flash('win');
    }
    if(type === 'end'){
      // subtle end flash
      flash('ok');
    }
  }, { passive:true });

})();