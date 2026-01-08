// === /herohealth/vr/hha-fx-director.js ===
// FX Director — reacts to game events (NO game logic here)

(function(){
  'use strict';
  const DOC = document;
  if (!DOC || window.__HHA_FX_DIRECTOR__) return;
  window.__HHA_FX_DIRECTOR__ = true;

  function pulse(cls, ms=180){
    DOC.body.classList.add(cls);
    setTimeout(()=> DOC.body.classList.remove(cls), ms);
  }

  // judge labels
  window.addEventListener('hha:judge', (e)=>{
    const label = e?.detail?.label || '';
    if(label.includes('GOOD')) pulse('fx-good');
    if(label.includes('MISS')) pulse('fx-miss');
    if(label.includes('BLOCK')) pulse('fx-block');
    if(label.includes('MINI')) pulse('fx-mini');
    if(label.includes('GOAL')) pulse('fx-goal');
  }, { passive:true });

  // low time
  window.addEventListener('hha:time', (e)=>{
    const t = e?.detail?.t;
    if(t <= 5) pulse('fx-lowtime', 120);
  }, { passive:true });

  // end game
  window.addEventListener('hha:celebrate', (e)=>{
    if(e?.detail?.kind === 'end'){
      DOC.body.classList.add('fx-end');
      setTimeout(()=>DOC.body.classList.remove('fx-end'), 1200);
    }
  }, { passive:true });

})();