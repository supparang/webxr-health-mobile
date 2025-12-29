/* === /herohealth/vr-groups/groups-fx.js ===
Groups VR — FX Layer (PRODUCTION)
- React to hha:judge + hha:celebrate + storm urgent
- Light shake + screen flash (safe)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));

  function pulseBody(cls, ms){
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms|0);
  }

  // tiny overlay flash
  let flashEl = null;
  function ensureFlash(){
    if (flashEl && flashEl.isConnected) return flashEl;
    flashEl = DOC.createElement('div');
    flashEl.style.cssText = [
      'position:fixed','inset:0','z-index:30','pointer-events:none',
      'background:rgba(34,211,238,.12)','opacity:0','transition:opacity .12s ease'
    ].join(';');
    DOC.body.appendChild(flashEl);
    return flashEl;
  }
  function flash(kind){
    const el = ensureFlash();
    el.style.background =
      kind==='bad'  ? 'rgba(239,68,68,.16)' :
      kind==='boss' ? 'rgba(34,211,238,.14)' :
      kind==='gold' ? 'rgba(250,204,21,.16)' :
                      'rgba(34,211,238,.10)';
    el.style.opacity = '1';
    setTimeout(()=>{ el.style.opacity = '0'; }, 120);
  }

  // shake via CSS var on body
  let shakeT = 0;
  function shake(power){
    power = clamp(Number(power)||0, 0, 1);
    DOC.body.style.setProperty('--fx-shake', String(power));
    clearTimeout(shakeT);
    shakeT = setTimeout(()=>DOC.body.style.removeProperty('--fx-shake'), 220);
  }

  // bind
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();

    if (kind === 'miss'){
      shake(0.6);
      flash('bad');
    } else if (kind === 'bad'){
      shake(0.45);
      flash('bad');
    } else if (kind === 'boss'){
      shake(0.35);
      flash('boss');
    } else if (kind === 'good'){
      flash('gold');
    }

    // particles integration (optional)
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.celebrate === 'function' && (kind==='boss' || kind==='miss')){
        P.celebrate();
      }
    }catch{}
  }, {passive:true});

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    flash(kind==='goal'?'gold':(kind==='mini'?'boss':'gold'));
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.celebrate === 'function') P.celebrate();
    }catch{}
  }, {passive:true});

  // apply shake visually (simple)
  const style = DOC.createElement('style');
  style.textContent = `
    body{
      transform: translateZ(0);
    }
    body[style*="--fx-shake"] .fg-layer{
      animation: fxShake .22s linear 1;
    }
    @keyframes fxShake{
      0%{ transform: translate(var(--vx,0px), var(--vy,0px)) translateX(0px); }
      25%{ transform: translate(var(--vx,0px), var(--vy,0px)) translateX(-3px); }
      50%{ transform: translate(var(--vx,0px), var(--vy,0px)) translateX(3px); }
      75%{ transform: translate(var(--vx,0px), var(--vy,0px)) translateX(-2px); }
      100%{ transform: translate(var(--vx,0px), var(--vy,0px)) translateX(0px); }
    }
  `;
  DOC.head.appendChild(style);

  NS.FX = { flash, shake };
})(typeof window !== 'undefined' ? window : globalThis);