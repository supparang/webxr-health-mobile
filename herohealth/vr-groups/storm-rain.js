// === /herohealth/vr-groups/storm-rain.js ===
// PACK 65: Storm Rain + Edge Warning
// - When storm_on -> add vignette + edge arrows (non-blocking)
// - When storm urgent -> stronger pulse
// Pure UI layer: no gameplay changes

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function ensure(){
    let el = DOC.querySelector('.storm-ui');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'storm-ui';
    el.innerHTML = `
      <div class="storm-vignette"></div>
      <div class="storm-edge storm-top">⬇️</div>
      <div class="storm-edge storm-right">⬅️</div>
      <div class="storm-edge storm-bottom">⬆️</div>
      <div class="storm-edge storm-left">➡️</div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function on(ms){
    ensure();
    DOC.body.classList.add('storm-rain-on');
    setTimeout(()=>DOC.body.classList.remove('storm-rain-on'), ms||1200);
  }

  WIN.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='storm_on') on(1400);
  }, {passive:true});

})();