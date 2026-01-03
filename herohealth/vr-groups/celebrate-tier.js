/* === /herohealth/vr-groups/celebrate-tier.js ===
PACK 28: Tier Celebration Consumer (fx:combo-tier)
✅ Adds body class fx-tier-s/ss/sss temporarily
✅ Uses particles.celebrate() if available
✅ Adds popText burst at center
*/

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function addCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||520);
    }catch(_){}
  }

  function hasParticles(){
    const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
    return !!P;
  }
  function celebrate(){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }
  function popText(x,y,text,cls=''){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.popText==='function') P.popText(x,y,text,cls);
    }catch(_){}
  }
  function burst(x,y,n=24){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.burst==='function') P.burst(x,y,n);
    }catch(_){}
  }

  WIN.addEventListener('fx:combo-tier', (ev)=>{
    const d = ev.detail||{};
    const tier = String(d.tier||'').toLowerCase();
    const x = (WIN.innerWidth||360)*0.5;
    const y = (WIN.innerHeight||640)*0.35;

    if (tier === 's') addCls('fx-tier-s', 520);
    if (tier === 'ss') addCls('fx-tier-ss', 620);
    if (tier === 'sss') addCls('fx-tier-sss', 720);

    if (hasParticles()){
      popText(x,y, String(d.text||'COMBO!'), 'fx-tier');
      burst(x,y, tier==='sss' ? 34 : tier==='ss' ? 28 : 22);
      celebrate();
    }
    try{ navigator.vibrate && navigator.vibrate(tier==='sss'?[18,18,18]:[16,26,16]); }catch(_){}
  }, {passive:true});

})();