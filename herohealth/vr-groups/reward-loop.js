// === /herohealth/vr-groups/reward-loop.js ===
// PACK 66: Reward Loop (play-only)
// perfect_switch => grants 1 "forgive miss" shield for 6s
// UI: small badge + FX
// Engine hook: if present, engine reads GroupsVR.RewardLoop.consumeForgive()

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function now(){ return (performance.now?performance.now():Date.now()); }

  const S = {
    on:false,
    until:0,
    charges:0,
  };

  function ensureBadge(){
    let el = DOC.querySelector('.shield-badge');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'shield-badge';
    el.innerHTML = `🛡️ SHIELD <span class="sb-n" id="sbN">0</span>`;
    DOC.body.appendChild(el);
    return el;
  }

  function setBadge(){
    const el = ensureBadge();
    const n = el.querySelector('#sbN');
    if (n) n.textContent = String(S.charges|0);
    el.classList.toggle('on', S.on && S.charges>0);
  }

  function arm(){
    // play only (research off)
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run === 'research') return;

    S.on = true;
    S.charges = Math.min(2, (S.charges||0) + 1); // stack up to 2
    S.until = now() + 6000;

    DOC.body.classList.add('fx-shield');
    setTimeout(()=>DOC.body.classList.remove('fx-shield'), 520);

    setBadge();
    try{ navigator.vibrate && navigator.vibrate([18,24,18]); }catch(_){}
    try{
      WIN.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'block', text:'SHIELD +1' } }));
    }catch(_){}

    // auto expire
    setTimeout(()=>{
      if (now() >= S.until){
        S.on = false;
        setBadge();
      }
    }, 6200);
  }

  // Engine reads this hook
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.RewardLoop = {
    isActive: ()=> S.on && now() < S.until && S.charges>0,
    consumeForgive: ()=>{
      if (!(S.on && now() < S.until && S.charges>0)) return false;
      S.charges = Math.max(0, S.charges-1);
      if (S.charges<=0) S.on = false;
      setBadge();
      return true;
    }
  };

  WIN.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k === 'perfect_switch') arm();
  }, {passive:true});

})();