/* === /herohealth/vr-groups/groups-fx.js ===
GroupsVR FX overlay
- zone indicator (No-Junk Zone)
- edge pulse / shake
- small text pops
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function ensureLayer(){
    let el = DOC.querySelector('.groups-fx-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'groups-fx-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden;';
    DOC.body.appendChild(el);
    return el;
  }

  function ensureEdge(){
    let el = DOC.querySelector('.groups-edge');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'groups-edge';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:121;';
    DOC.body.appendChild(el);
    return el;
  }

  function ensureZone(){
    let z = DOC.getElementById('groupsZone');
    if (z) return z;
    z = DOC.createElement('div');
    z.id = 'groupsZone';
    z.className = 'groups-zone';
    DOC.body.appendChild(z);
    return z;
  }

  function popText(text){
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.textContent = text;
    const x = (root.innerWidth||360) * (0.5 + (Math.random()*0.06-0.03));
    const y = (root.innerHeight||640) * (0.44 + (Math.random()*0.06-0.03));
    el.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
       font:1000 14px/1 system-ui;color:#fff;
       text-shadow:0 2px 0 rgba(0,0,0,.28),0 18px 40px rgba(0,0,0,.35);
       opacity:0;`;
    layer.appendChild(el);
    el.animate([
      { transform:'translate(-50%,-50%) scale(0.85)', opacity:0 },
      { transform:'translate(-50%,-60%) scale(1.05)', opacity:1, offset:0.22 },
      { transform:'translate(-50%,-90%) scale(0.98)', opacity:0 }
    ], { duration: 720, easing:'cubic-bezier(.2,.9,.2,1)' });
    setTimeout(()=>el.remove(), 760);
  }

  function edge(kind='warn', ms=420){
    ensureEdge();
    DOC.body.dataset.edge = kind;
    DOC.body.classList.add('groups-edge-on');
    setTimeout(()=> DOC.body.classList.remove('groups-edge-on'), ms);
  }

  function shake(ms=260){
    DOC.body.classList.add('groups-shake');
    setTimeout(()=> DOC.body.classList.remove('groups-shake'), ms);
  }

  function zoneShow(x,y,r){
    const z = ensureZone();
    z.style.setProperty('--zx', x+'px');
    z.style.setProperty('--zy', y+'px');
    z.style.setProperty('--zr', r+'px');
    z.classList.add('show');
  }
  function zoneHide(){
    const z = ensureZone();
    z.classList.remove('show');
  }

  // events
  root.addEventListener('groups:zone', (e)=>{
    const d = e.detail||{};
    if (!d.on){ zoneHide(); return; }
    zoneShow(Number(d.x||0), Number(d.y||0), Number(d.r||140));
  });

  root.addEventListener('groups:mini_urgent', ()=>{ edge('danger', 320); });

  root.addEventListener('groups:tick', (e)=>{
    const d = e.detail||{};
    // tick = subtle shake when close to fire
    if (Number(d.rate||1) >= 1.7) shake(140);
  });

  root.addEventListener('groups:progress', (e)=>{
    const d = e.detail||{};
    const k = String(d.kind||'');
    if (k === 'powerup_star') { popText('⭐ OVERDRIVE!'); edge('good', 380); }
    if (k === 'powerup_ice') { popText('❄️ FREEZE!'); edge('info', 380); }
    if (k === 'powerup_shield') { popText('🛡️ SHIELD!'); edge('good', 380); }
    if (k === 'boss_spawn') { popText('👑 BOSS!'); edge('warn', 520); }
    if (k === 'boss_weak_on') { popText('🎯 WEAK SPOT!'); edge('info', 520); }
    if (k === 'boss_teleport') { popText('💨 BOSS ESCAPE!'); edge('danger', 520); }
    if (k === 'burst_on') { popText('⚡ BURST MODE!'); edge('good', 520); }
    if (k === 'nojunk_fail') { popText('🚫 NO-JUNK FAIL'); edge('danger', 520); }
    if (k === 'nojunk_clear') { popText('✅ NO-JUNK CLEAR'); edge('good', 520); }
  });

})(typeof window !== 'undefined' ? window : globalThis);