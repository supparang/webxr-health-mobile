/* === /herohealth/vr-groups/groups-fx.js ===
GroupsVR FX (PRODUCTION)
✅ listens: hha:judge, hha:celebrate
✅ uses global Particles if present (../vr/particles.js) else fallback flash/shake
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});

  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles || { scorePop(){}, burstAt(){} };

  function flash(kind){
    const el = DOC.createElement('div');
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '999';
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    el.style.transition = 'opacity 140ms ease';
    el.style.background =
      (kind==='bad')  ? 'rgba(239,68,68,.14)' :
      (kind==='boss') ? 'rgba(34,211,238,.14)' :
                        'rgba(34,197,94,.10)';
    DOC.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity = '1'; });
    setTimeout(()=>{ el.style.opacity = '0'; }, 120);
    setTimeout(()=>{ el.remove(); }, 320);
  }

  function shake(ms, strength){
    ms = Math.max(120, ms||260);
    strength = Math.max(2, strength||6);
    const t0 = performance.now();
    function step(){
      const t = performance.now() - t0;
      if (t >= ms){
        DOC.body.style.transform = '';
        return;
      }
      const k = (1 - t/ms);
      const x = (Math.random()*2-1) * strength * k;
      const y = (Math.random()*2-1) * strength * k;
      DOC.body.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(step);
    }
    step();
  }

  root.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) || {};
    const kind = String(d.kind||'').toLowerCase();

    if (kind === 'bad' || kind === 'miss'){
      flash('bad');
      shake(260, 6);
    } else if (kind === 'boss'){
      flash('boss');
      shake(220, 4);
    } else if (kind === 'good'){
      flash('good');
    }
  }, { passive:true });

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = (ev && ev.detail) || {};
    const title = String(d.title||'');
    // ยิง particle กลางจอ
    try{
      Particles.scorePop && Particles.scorePop(title || '🎉', root.innerWidth*0.5, root.innerHeight*0.45);
      Particles.burstAt && Particles.burstAt(root.innerWidth*0.5, root.innerHeight*0.45, 24);
    }catch{}
  }, { passive:true });

  NS.FX = { flash, shake };

})(typeof window !== 'undefined' ? window : globalThis);