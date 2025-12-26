// === /herohealth/vr/ui-fever.js ===
// HeroHealth — Fever UI (GLOBAL) — FULL COMPAT
// ✅ listens: hha:fever (value|fever, on?, shield?, endsAt?)
// ✅ fallback: hha:score (fever, shield)
// ✅ auto-on if on is missing (fever>=70 or stunActive)
// ✅ safe: create minimal UI if none exists
// Exposes: window.FeverUI and window.GAME_MODULES.FeverUI

(function(root){
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const int = (v)=> (Number(v)||0) | 0;
  const now = ()=> (performance.now ? performance.now() : Date.now());

  let feverVal = 0;
  let feverOn = false;
  let shield = 0;
  let endsAt = 0;
  let lastRenderAt = 0;

  let wrap=null, bar=null, fill=null, txt=null, sh=null, timer=null;

  function ensureFeverBar(){
    if (wrap && doc.body.contains(wrap)) return;

    wrap = doc.getElementById('hha-fever');
    if (!wrap){
      wrap = doc.createElement('div');
      wrap.id = 'hha-fever';
      Object.assign(wrap.style, {
        position:'fixed',
        left:'50%',
        top:'74px',
        transform:'translateX(-50%)',
        zIndex:'58',
        pointerEvents:'none',
        display:'flex',
        gap:'10px',
        alignItems:'center',
        padding:'10px 12px',
        borderRadius:'999px',
        border:'1px solid rgba(148,163,184,.22)',
        background:'rgba(2,6,23,.60)',
        boxShadow:'0 18px 50px rgba(0,0,0,.42)',
        backdropFilter:'blur(10px)',
        WebkitBackdropFilter:'blur(10px)',
        color:'#e5e7eb',
        fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial',
        fontWeight:'950',
        fontSize:'12px',
        opacity:'0.92'
      });

      const icon = doc.createElement('div');
      icon.textContent = '🔥';
      Object.assign(icon.style, { fontSize:'14px' });

      bar = doc.createElement('div');
      Object.assign(bar.style, {
        width:'180px',
        height:'10px',
        borderRadius:'999px',
        overflow:'hidden',
        background:'rgba(255,255,255,.10)',
        border:'1px solid rgba(255,255,255,.14)'
      });

      fill = doc.createElement('div');
      Object.assign(fill.style, {
        height:'100%',
        width:'0%',
        borderRadius:'999px',
        background:'linear-gradient(90deg, rgba(34,197,94,.92), rgba(245,158,11,.92), rgba(239,68,68,.92))',
        transition:'width .10s linear'
      });
      bar.appendChild(fill);

      txt = doc.createElement('div');
      txt.textContent = '0%';
      Object.assign(txt.style, { minWidth:'42px', textAlign:'right' });

      sh = doc.createElement('div');
      sh.textContent = '🛡️0';
      Object.assign(sh.style, { opacity:'0.92' });

      timer = doc.createElement('div');
      timer.textContent = '';
      Object.assign(timer.style, { opacity:'0.70', fontWeight:'900' });

      wrap.appendChild(icon);
      wrap.appendChild(bar);
      wrap.appendChild(txt);
      wrap.appendChild(sh);
      wrap.appendChild(timer);

      doc.body.appendChild(wrap);
    }else{
      // If user already has UI, try bind pieces (optional)
      bar = wrap.querySelector('.hha-fever-bar') || bar;
      fill = wrap.querySelector('.hha-fever-fill') || fill;
    }
  }

  function render(force=false){
    const t = now();
    if (!force && (t - lastRenderAt) < 50) return;
    lastRenderAt = t;

    ensureFeverBar();

    const v = clamp(feverVal, 0, 100);
    if (fill) fill.style.width = v.toFixed(0) + '%';
    if (txt) txt.textContent = v.toFixed(0) + '%';
    if (sh) sh.textContent = '🛡️' + (shield|0);

    // glow when feverOn
    if (wrap){
      wrap.style.opacity = feverOn ? '0.98' : '0.88';
      wrap.style.boxShadow = feverOn
        ? '0 18px 60px rgba(239,68,68,.18), 0 18px 50px rgba(0,0,0,.42)'
        : '0 18px 50px rgba(0,0,0,.42)';
      wrap.style.borderColor = feverOn ? 'rgba(239,68,68,.28)' : 'rgba(148,163,184,.22)';
    }

    // countdown (optional)
    if (timer){
      if (endsAt && endsAt > Date.now()){
        const leftMs = Math.max(0, endsAt - Date.now());
        const left = Math.ceil(leftMs/1000);
        timer.textContent = `⏳${left}s`;
      }else{
        timer.textContent = '';
      }
    }
  }

  // Public API
  const FeverUI = {
    set(v, on){ feverVal = clamp(v,0,100); feverOn = !!on; render(true); },
    setShield(n){ shield = clamp(int(n),0,9); render(true); },
    get(){ return { value: feverVal, on: feverOn, shield, endsAt }; }
  };

  // Expose
  root.FeverUI = root.FeverUI || FeverUI;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = root.GAME_MODULES.FeverUI || FeverUI;

  // Listen events
  root.addEventListener('hha:fever', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const v = (d.value != null) ? d.value : (d.fever != null ? d.fever : null);
    if (v != null) feverVal = clamp(v, 0, 100);

    if (d.on != null) feverOn = !!d.on;
    else if (v != null) feverOn = (clamp(v,0,100) >= 70) || !!d.stunActive;

    if (d.shield != null) shield = clamp(int(d.shield), 0, 9);

    if (d.endsAt != null){
      const e = Number(d.endsAt)||0;
      endsAt = (e > 1e12) ? e : (e>0 ? Date.now() + e : 0);
    }

    render(true);
  }, { passive:true });

  // fallback for older engines
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.fever != null) feverVal = clamp(d.fever, 0, 100);
    if (d.shield != null) shield = clamp(int(d.shield), 0, 9);
    // do not override feverOn here aggressively
    render(false);
  }, { passive:true });

  // initial render
  setTimeout(()=>render(true), 0);

})(typeof window !== 'undefined' ? window : globalThis);