/* === /herohealth/vr-groups/switch-cinematic.js ===
PACK 35: Perfect Switch Cinematic — PRODUCTION
✅ On groups:progress perfect_switch => flash banner + theme tint
✅ Uses quest:update groupKey/groupName
Respects FXPerf (>=2)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const $  = (q)=> DOC.querySelector(q);

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  const COLORS = {
    fruit:   'rgba(34,211,238,.90)',
    veg:     'rgba(34,197,94,.92)',
    protein: 'rgba(245,158,11,.92)',
    grain:   'rgba(167,139,250,.92)',
    dairy:   'rgba(148,163,184,.90)',
    mix:     'rgba(34,197,94,.92)'
  };

  let lastGroupKey = 'mix';
  let lastGroupName = '—';

  function ensureBanner(){
    let el = $('.switchBanner');
    if (el) return el;

    el = DOC.createElement('div');
    el.className = 'switchBanner';
    el.innerHTML = `
      <div class="switchPill">
        <div class="swIcon">⚡</div>
        <div class="swText"><span class="swA">สลับหมู่:</span> <span id="swName">—</span></div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function flash(){
    if (!allow(2)) return;

    ensureBanner();
    const nameEl = DOC.getElementById('swName');
    if (nameEl) nameEl.textContent = lastGroupName;

    const c = COLORS[lastGroupKey] || COLORS.mix;
    try{ DOC.documentElement.style.setProperty('--swAccent', c); }catch(_){}

    DOC.body.classList.add('fx-switch');
    setTimeout(()=>DOC.body.classList.remove('fx-switch'), 820);
  }

  // update last group from quest updates
  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    lastGroupKey  = String(d.groupKey || lastGroupKey);
    lastGroupName = String(d.groupName || lastGroupName);
  }, {passive:true});

  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='perfect_switch'){
      flash();
    }
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);