/* =========================================================
   EAP Hero • Boss Clash Hard Handoff v1
   PURPOSE
   - Prevent legacy Guardian handlers from stealing the transition after
     a completed 4-skill Boss run.
   - On pointerdown/touchstart of Enter Boss Clash, finish the current Boss
     through EAPBossCompleteNoLoop before legacy click handlers can fire.
   - Applies to B1-B5 and does not alter scores or invent progression.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_BOSS_CLASH_HARD_HANDOFF_V1__) return;
  window.__EAP_BOSS_CLASH_HARD_HANDOFF_V1__ = true;

  var VERSION = '20260813-EAP-BOSS-CLASH-HARD-HANDOFF-V1';
  var armed = false;

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function root(){ return document.getElementById('app') || document.body; }
  function pageText(){ return clean(root() && root().innerText || ''); }
  function isCompleteScreen(){
    var t = pageText();
    var complete = /(?:Fallback|Standard|Single)\s+Run\s+Complete/i.test(t) ||
      (/Reading\s*✓?\s*Complete/i.test(t) && /Listening\s*✓?\s*Complete/i.test(t) && /Writing\s*✓?\s*Complete/i.test(t) && /Speaking\s*✓?\s*Complete/i.test(t));
    return complete && /Enter\s+Boss\s+Clash|Finish\s+Boss\s+Gate/i.test(t);
  }
  function targetButton(node){
    var b = node && node.closest && node.closest('button,a,[role="button"]');
    if (!b) return null;
    return /Enter\s+Boss\s+Clash|Finish\s+Boss\s+Gate/i.test(clean(b.textContent || b.innerText || '')) ? b : null;
  }
  function finish(ev){
    if (!isCompleteScreen()) return false;
    if (ev){
      try{ ev.preventDefault(); }catch(_){}
      try{ ev.stopPropagation(); }catch(_){}
      try{ ev.stopImmediatePropagation(); }catch(_){}
    }
    if (armed) return true;
    armed = true;
    document.documentElement.dataset.eapBossHardHandoff = VERSION;
    try{
      if (window.EAPBossCompleteNoLoop && typeof window.EAPBossCompleteNoLoop.finish === 'function') {
        window.EAPBossCompleteNoLoop.finish(ev || null);
        setTimeout(function(){ armed = false; }, 1200);
        return true;
      }
    }catch(error){ console.error('[EAP Boss Hard Handoff]', error); }
    armed = false;
    return false;
  }

  function intercept(ev){
    var b = targetButton(ev.target);
    if (!b || !isCompleteScreen()) return;
    finish(ev);
  }

  // Earlier than legacy click handlers: the completed screen is removed on pointerdown,
  // so the subsequent click cannot be routed to the old Guardian.
  document.addEventListener('pointerdown', intercept, true);
  document.addEventListener('touchstart', intercept, {capture:true, passive:false});
  document.addEventListener('mousedown', intercept, true);

  function normalize(){
    if (!isCompleteScreen()) return;
    Array.prototype.forEach.call(document.querySelectorAll('button,a,[role="button"]'), function(b){
      if (/Enter\s+Boss\s+Clash/i.test(clean(b.textContent || ''))) {
        b.textContent = 'Finish Boss Gate';
        b.setAttribute('data-eap-boss-hard-handoff','1');
      }
    });
  }
  var timer=0;
  new MutationObserver(function(){ clearTimeout(timer); timer=setTimeout(normalize,30); }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('load', normalize);
  normalize();

  window.EAPBossClashHardHandoffV1 = { version:VERSION, finish:finish, isCompleteScreen:isCompleteScreen };
})();
