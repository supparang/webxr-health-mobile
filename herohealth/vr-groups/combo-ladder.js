// === /herohealth/vr-groups/combo-ladder.js ===
// PACK 63: Combo Ladder + Callouts + Small Bonuses
// Uses hha:score events -> reads combo, triggers hha:judge streak + particles
// Bonus is applied by emitting groups:bonus for engine (optional)
// If engine doesn't handle bonus, still shows FX (safe)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function addCls(c, ms){
    try{ DOC.body.classList.add(c); setTimeout(()=>DOC.body.classList.remove(c), ms||420); }catch(_){}
  }
  function hasParticles(){
    const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
    return !!P;
  }
  function celebrate(){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      P && P.celebrate && P.celebrate();
    }catch(_){}
  }
  function popText(x,y,text,cls){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      P && P.popText && P.popText(x,y,text,cls||'');
    }catch(_){}
  }

  const steps = [
    { combo: 6,  label:'COMBO x6',  bonus: 40 },
    { combo: 10, label:'COMBO x10', bonus: 80 },
    { combo: 14, label:'COMBO x14', bonus: 120 },
    { combo: 18, label:'COMBO x18', bonus: 170 },
  ];

  let lastFired = 0;
  let fired = new Set();

  function reset(){
    fired = new Set();
    lastFired = 0;
  }

  function center(){
    return { x:(WIN.innerWidth||360)/2, y:Math.max(120, (WIN.innerHeight||640)*0.26) };
  }

  WIN.addEventListener('hha:start', reset, {passive:true});
  WIN.addEventListener('hha:end', reset, {passive:true});

  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    const combo = Number(d.combo||0);

    // anti-spam window
    const t = (performance.now?performance.now():Date.now());
    if (t - lastFired < 650) return;

    // if combo dropped, allow future steps again (but not instant spam)
    if (combo <= 1 && fired.size){
      fired.clear();
      return;
    }

    for (const s of steps){
      if (combo === s.combo && !fired.has(s.combo)){
        fired.add(s.combo);
        lastFired = t;

        addCls('fx-combo', 520);
        const {x,y} = center();

        if (hasParticles()){
          popText(x,y, s.label + ` +${s.bonus}`, 'fx-combo');
          celebrate();
        }

        try{ navigator.vibrate && navigator.vibrate([14,18,14,28,14]); }catch(_){}

        // optional: tell engine to add bonus (engine may or may not listen)
        try{
          WIN.dispatchEvent(new CustomEvent('groups:bonus', { detail:{ amount:s.bonus, reason:'combo', combo:s.combo } }));
        }catch(_){}

        // also emit judge streak for effects-pack.js
        try{
          WIN.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'streak', text:s.label } }));
        }catch(_){}
        break;
      }
    }
  }, {passive:true});

})();