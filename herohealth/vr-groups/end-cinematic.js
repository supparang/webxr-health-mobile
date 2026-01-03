// === /herohealth/vr-groups/end-cinematic.js ===
// PACK 58: End Cinematic + Medal Drop + Rank FX
// - Works with Particles.js (optional) + effects-pack.js classes
// - No gameplay impact, safe for research too

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  const LS_BEST = 'HHA_GROUPS_BEST'; // best summary cache

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function ensureLayer(){
    let el = DOC.querySelector('.groups-cine-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'groups-cine-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:170;overflow:hidden;';
    DOC.body.appendChild(el);
    return el;
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
  function burst(x,y,n){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      P && P.burst && P.burst(x,y,n||22);
    }catch(_){}
  }
  function popText(x,y,text,cls){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      P && P.popText && P.popText(x,y,text,cls||'');
    }catch(_){}
  }

  function readBest(){
    try{ return JSON.parse(localStorage.getItem(LS_BEST)||'null'); }catch{ return null; }
  }
  function writeBest(s){
    try{ localStorage.setItem(LS_BEST, JSON.stringify(s)); }catch{}
  }

  function betterThan(a,b){
    if (!a) return false;
    if (!b) return true;
    // primary: score, secondary: acc, tertiary: miss (lower better)
    const as = Number(a.scoreFinal||0), bs = Number(b.scoreFinal||0);
    if (as !== bs) return as > bs;
    const aa = Number(a.accuracyGoodPct||0), ba = Number(b.accuracyGoodPct||0);
    if (aa !== ba) return aa > ba;
    const am = Number(a.misses||0), bm = Number(b.misses||0);
    return am < bm;
  }

  function rankEmoji(grade){
    grade = String(grade||'C').toUpperCase();
    if (grade==='SSS') return '🏆';
    if (grade==='SS')  return '🥇';
    if (grade==='S')   return '🥈';
    if (grade==='A')   return '🥉';
    if (grade==='B')   return '🎖️';
    return '📘';
  }

  function medalTitle(grade){
    grade = String(grade||'C').toUpperCase();
    if (grade==='SSS') return 'LEGEND!';
    if (grade==='SS')  return 'MASTER!';
    if (grade==='S')   return 'GREAT!';
    if (grade==='A')   return 'NICE!';
    if (grade==='B')   return 'GOOD!';
    return 'KEEP TRYING!';
  }

  function dropMedal(grade, isBest){
    const layer = ensureLayer();
    const W = Math.max(320, WIN.innerWidth||360);
    const cx = W*0.5;

    const wrap = DOC.createElement('div');
    wrap.className = 'cine-medal' + (isBest ? ' cine-best' : '');
    wrap.style.left = cx + 'px';
    wrap.style.top  = '-40px';

    const e = DOC.createElement('div');
    e.className = 'cine-emoji';
    e.textContent = rankEmoji(grade);

    const t = DOC.createElement('div');
    t.className = 'cine-title';
    t.textContent = medalTitle(grade);

    wrap.appendChild(e);
    wrap.appendChild(t);
    layer.appendChild(wrap);

    // burst at settle
    setTimeout(()=>{
      const x = cx;
      const y = Math.max(120, (WIN.innerHeight||640)*0.28);
      burst(x,y, isBest ? 34 : 26);
      popText(x,y, isBest ? 'NEW BEST!' : 'CLEAR!', isBest ? 'fx-best' : '');
      if (hasParticles()) celebrate();
      try{ navigator.vibrate && navigator.vibrate(isBest ? [25,30,25,50,25] : [18,22,18]); }catch{}
    }, 520);

    setTimeout(()=>{ try{ wrap.remove(); }catch{} }, 2400);
  }

  // ---- public hook (optional) ----
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.Cine = {
    showEnd: function(summary){
      const grade = String((summary||{}).grade||'C');
      const best = readBest();
      const isBest = betterThan(summary, best);
      if (isBest) writeBest(summary);

      try{ DOC.body.classList.add('fx-end'); setTimeout(()=>DOC.body.classList.remove('fx-end'), 900); }catch{}
      dropMedal(grade, isBest);
    }
  };

  // auto listen
  WIN.addEventListener('hha:end', (ev)=>{
    const s = ev.detail||{};
    try{ WIN.GroupsVR && WIN.GroupsVR.Cine && WIN.GroupsVR.Cine.showEnd(s); }catch(_){}
  }, {passive:true});

})();