/* === /herohealth/vr-groups/groups-fx.js ===
FX binder: screen edge flash / shake / body classes
Listens: hha:judge, hha:celebrate, quest:update, hha:end
*/
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function ensureEdge(){
    let el = DOC.querySelector('.hha-edgefx');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'hha-edgefx';
    el.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:95;
      box-shadow: inset 0 0 0 0 rgba(0,0,0,0);
      transition: box-shadow .12s ease, filter .12s ease;
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function flash(kind){
    const el = ensureEdge();
    const good = 'rgba(34,197,94,.22)';
    const bad  = 'rgba(239,68,68,.22)';
    const boss = 'rgba(250,204,21,.18)';
    const c = (kind==='good') ? good : (kind==='boss') ? boss : bad;
    el.style.boxShadow = `inset 0 0 0 10px ${c}`;
    setTimeout(()=>{ el.style.boxShadow = 'inset 0 0 0 0 rgba(0,0,0,0)'; }, 140);
  }

  function shake(str=1){
    const s = Math.max(0.6, Math.min(2.0, Number(str||1)));
    DOC.body.animate(
      [
        { transform:`translate(${ 0}px,${ 0}px)` },
        { transform:`translate(${ 2*s}px,${-3*s}px)` },
        { transform:`translate(${-3*s}px,${ 2*s}px)` },
        { transform:`translate(${ 2*s}px,${ 2*s}px)` },
        { transform:`translate(${ 0}px,${ 0}px)` },
      ],
      { duration: 180, iterations: 1, easing:'ease-out' }
    );
  }

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    if (k.includes('boss')){ flash('boss'); shake(1.1); }
    else if (k.includes('good')){ flash('good'); }
    else if (k.includes('bad') || k.includes('miss')){ flash('bad'); shake(1.25); }
  }, { passive:true });

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'');
    if (kind==='goal' || kind==='mini'){
      flash('good');
    }
  }, { passive:true });

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const t = Number(d.miniTimeLeftSec||0);
    DOC.body.classList.toggle('mini-urgent', t>0 && t<=3);
  }, { passive:true });

  root.addEventListener('hha:end', ()=>{
    DOC.body.classList.remove('mini-urgent','groups-storm','groups-storm-urgent','clutch');
  }, { passive:true });

})(typeof window!=='undefined'?window:globalThis);