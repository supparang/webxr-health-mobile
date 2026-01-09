// === /herohealth/vr/fx-hooks.js ===
// Universal FX Hooks — PRODUCTION
// ✅ API: window.HHA_FX.pulse(type, opts)
// ✅ Event: window.dispatchEvent(new CustomEvent('hha:fx',{detail:{type,...}}))
// ✅ Works with particles.js if present: window.Particles or window.GAME_MODULES.Particles
// ✅ Minimal DOM shockwave helper (optional)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_FX_HOOKS__) return;
  WIN.__HHA_FX_HOOKS__ = true;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function getParticles(){
    try{
      return WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null;
    }catch(_){ return null; }
  }

  function ensureShockStyle(){
    if (DOC.getElementById('hha-shock-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-shock-style';
    st.textContent = `
      .hha-shock{
        position:fixed;
        left: var(--x,50%);
        top: var(--y,50%);
        width: 10px; height:10px;
        transform: translate(-50%,-50%);
        border-radius:999px;
        border:2px solid rgba(34,211,238,.55);
        pointer-events:none;
        opacity:0.9;
        animation: hhaShock 420ms ease-out forwards;
        filter: blur(.2px);
        z-index: 200;
      }
      @keyframes hhaShock{
        0%{ transform: translate(-50%,-50%) scale(1); opacity:.85; }
        100%{ transform: translate(-50%,-50%) scale(18); opacity:0; }
      }

      /* recommended body classes (games may already define their own) */
      body.hha-hitfx{ animation: hhaHitPulse .14s ease-out 1; }
      @keyframes hhaHitPulse{
        0%{ filter: brightness(1); }
        60%{ filter: brightness(1.12) saturate(1.10); }
        100%{ filter: brightness(1); }
      }
      body.hha-endfx{ animation: hhaEndBlink .55s ease-in-out infinite, hhaEndShake .26s ease-in-out infinite; }
      @keyframes hhaEndBlink{ 0%,100%{ filter: brightness(1); } 50%{ filter: brightness(1.08) saturate(1.06); } }
      @keyframes hhaEndShake{ 0%,100%{ transform: translate3d(0,0,0); } 50%{ transform: translate3d(0,1px,0); } }

      body.hha-bossfx{ animation: hhaBossFlash .22s ease-in-out infinite; }
      @keyframes hhaBossFlash{
        0%,100%{ box-shadow: inset 0 0 0 rgba(239,68,68,0); }
        50%{ box-shadow: inset 0 0 0 999px rgba(239,68,68,.04); }
      }
    `;
    DOC.head.appendChild(st);
  }

  function shock(x, y){
    ensureShockStyle();
    const el = DOC.createElement('div');
    el.className = 'hha-shock';
    el.style.setProperty('--x', clamp(x,0,100).toFixed(2)+'%');
    el.style.setProperty('--y', clamp(y,0,100).toFixed(2)+'%');
    DOC.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
  }

  function pulseBody(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), clamp(ms||140, 60, 2000));
    }catch(_){}
  }

  function popTextAtCenter(text){
    try{
      const P = getParticles();
      if (!P) return false;
      const cx = WIN.innerWidth/2;
      const cy = WIN.innerHeight/2;
      if (typeof P.popText === 'function'){ P.popText(cx, cy, String(text||''), ''); return true; }
      if (typeof P.pop === 'function'){ P.pop(cx, cy, String(text||'')); return true; }
    }catch(_){}
    return false;
  }

  function play(type, opts){
    const t = String(type||'').toLowerCase();
    const o = opts || {};
    const x = ('xPct' in o) ? o.xPct : ('x' in o ? o.x : 50);
    const y = ('yPct' in o) ? o.yPct : ('y' in o ? o.y : 50);

    if (o.text) popTextAtCenter(o.text);

    if (t === 'hit' || t === 'good' || t === 'shield'){
      pulseBody('hha-hitfx', o.ms || 140);
      return;
    }

    if (t === 'perfect' || t === 'streak'){
      pulseBody('hha-hitfx', o.ms || 200);
      return;
    }

    if (t === 'block'){
      pulseBody('hha-hitfx', o.ms || 120);
      return;
    }

    if (t === 'miss' || t === 'bad' || t === 'damage'){
      shock(x, y);
      pulseBody('hha-hitfx', o.ms || 160);
      return;
    }

    if (t === 'storm'){
      pulseBody('hha-hitfx', o.ms || 180);
      return;
    }

    if (t === 'boss_on'){
      try{ DOC.body.classList.add('hha-bossfx'); }catch(_){}
      return;
    }
    if (t === 'boss_off'){
      try{ DOC.body.classList.remove('hha-bossfx'); }catch(_){}
      return;
    }

    if (t === 'end_on'){
      try{ DOC.body.classList.add('hha-endfx'); }catch(_){}
      return;
    }
    if (t === 'end_off'){
      try{ DOC.body.classList.remove('hha-endfx'); }catch(_){}
      return;
    }
  }

  const API = {
    pulse: (type, opts)=>play(type, opts),
    shock: (xPct,yPct)=>shock(xPct,yPct),
    boss: (on)=>play(on?'boss_on':'boss_off'),
    end: (on)=>play(on?'end_on':'end_off'),
  };
  WIN.HHA_FX = API;

  WIN.addEventListener('hha:fx', (ev)=>{
    const d = ev && ev.detail ? ev.detail : null;
    if (!d) return;
    play(d.type, d);
  });

})();