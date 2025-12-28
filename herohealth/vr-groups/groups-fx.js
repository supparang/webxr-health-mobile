/* === /herohealth/vr-groups/groups-fx.js ===
FX controller:
- storm border + urgent pulse
- judge flash
- celebrate trigger (Particles if exists)
*/

(function(root){
  'use strict';
  const DOC = document;

  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles || null;

  // inject css
  if (!DOC.getElementById('groups-fx-css')){
    const st = DOC.createElement('style');
    st.id = 'groups-fx-css';
    st.textContent = `
      body.groups-storm::before{
        content:"";
        position:fixed; inset:0; pointer-events:none; z-index:80;
        border-radius:0;
        box-shadow: inset 0 0 0 2px rgba(34,211,238,.18),
                    inset 0 0 35px rgba(34,211,238,.12);
        opacity:.75;
      }
      body.groups-storm.groups-storm-urgent::before{
        animation: stormPulse .22s ease-in-out infinite alternate;
      }
      @keyframes stormPulse{
        from{ box-shadow: inset 0 0 0 2px rgba(249,115,115,.22), inset 0 0 42px rgba(249,115,115,.12); opacity:.82;}
        to  { box-shadow: inset 0 0 0 2px rgba(34,211,238,.22), inset 0 0 42px rgba(34,211,238,.12); opacity:.95;}
      }

      /* flash layer */
      .gflash{
        position:fixed; inset:0; pointer-events:none;
        z-index:90;
        opacity:0;
        background: radial-gradient(circle at 50% 55%, rgba(255,255,255,.12), transparent 55%);
      }
      .gflash.on{ opacity:1; animation: flashOut .18s ease-out forwards; }
      @keyframes flashOut{ to{ opacity:0; } }

      /* shake */
      body.gshake{ animation: gshake .12s linear infinite; }
      @keyframes gshake{
        0%{ transform:translate(0,0) }
        25%{ transform:translate(1px,-1px) }
        50%{ transform:translate(-1px,1px) }
        75%{ transform:translate(1px,1px) }
        100%{ transform:translate(0,0) }
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureFlash(){
    let el = DOC.querySelector('.gflash');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'gflash';
    DOC.body.appendChild(el);
    return el;
  }

  function flash(){
    const el = ensureFlash();
    el.classList.remove('on');
    // force reflow
    void el.offsetWidth;
    el.classList.add('on');
  }

  function shake(ms){
    DOC.body.classList.add('gshake');
    setTimeout(()=>DOC.body.classList.remove('gshake'), Math.max(60, ms|0));
  }

  root.addEventListener('hha:judge', (e)=>{
    const d = e.detail||{};
    const kind = String(d.kind||'');
    if (kind==='bad'){ flash(); shake(180); }
    if (kind==='boss'){ flash(); }
  }, { passive:true });

  root.addEventListener('groups:storm', (e)=>{
    const d = e.detail||{};
    if (d.on){ DOC.body.classList.add('groups-storm'); }
    else { DOC.body.classList.remove('groups-storm','groups-storm-urgent'); }
  }, { passive:true });

  root.addEventListener('hha:celebrate', (e)=>{
    const d = e.detail||{};
    try{ Particles && Particles.celebrate && Particles.celebrate(d); }catch{}
    flash();
  }, { passive:true });

})();