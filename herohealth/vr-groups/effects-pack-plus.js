/* === /herohealth/vr-groups/effects-pack-plus.js ===
FX+++ Add-on (safe)
✅ Combo milestones 10/15/20
✅ Storm finale pulse (last 2s)
✅ Boss lowHP vignette + heartbeat pulse
Depends on: effects-pack.js (recommended), optional Particles.js
*/
(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function addCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||220);
    }catch(_){}
  }

  function P(){
    return WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null;
  }
  function celebrate(){ try{ const p=P(); p&&p.celebrate&&p.celebrate(); }catch(_){}
  }

  // ---------- combo milestones ----------
  let lastMilestone = 0;
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    const c = Number(d.combo||0);

    // milestone only (10,15,20,...)
    const m = (c>=10) ? (Math.floor(c/5)*5) : 0;
    if (m >= 10 && m !== lastMilestone && m % 5 === 0){
      lastMilestone = m;

      // safe intensity scaling
      const k = Math.min(3, Math.floor((m-10)/5)+1); // 10->1, 15->2, 20->3
      addCls('fx-milestone', 520 + k*120);
      addCls('fx-milestone-' + k, 560 + k*140);

      // light celebrate
      celebrate();

      // subtle haptics
      try{
        if (navigator.vibrate){
          navigator.vibrate(k===1 ? [12,20,12] : (k===2 ? [14,22,14,28,14] : [16,26,16,30,16]));
        }
      }catch(_){}
    }

    if (c < 8) lastMilestone = 0;
  }, {passive:true});

  // ---------- storm finale pulse ----------
  // relies on class groups-storm-urgent (already set in engine)
  let tmr = 0;
  function stormPulseLoop(){
    clearTimeout(tmr);
    const urgent = DOC.body.classList.contains('groups-storm-urgent');
    DOC.body.classList.toggle('fx-storm-finale', urgent);
    if (urgent) addCls('fx-pulse', 320);
    tmr = setTimeout(stormPulseLoop, urgent ? 420 : 700);
  }
  stormPulseLoop();

  // ---------- boss lowHP vignette & heartbeat ----------
  WIN.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k === 'boss_lowhp'){
      DOC.body.classList.add('fx-boss-low');
      setTimeout(()=>DOC.body.classList.remove('fx-boss-low'), 1200);
      // a tiny pulse sequence
      addCls('fx-pulse', 300);
      setTimeout(()=>addCls('fx-pulse', 300), 360);
      try{ navigator.vibrate && navigator.vibrate([14,40,14]); }catch(_){}
    }
  }, {passive:true});

})();