/* AI Quest AR Duplicate Card Cleanup v3.8.9 SAFE REPLACEMENT
   IMPORTANT: overwrite the previous file with this exact same filename.
   It keeps the FIRST AR entry card for the current session and removes only later duplicates.
*/
(function(){
  'use strict';

  function currentSession(){
    try { return String(new URLSearchParams(location.search).get('session') || '').toLowerCase(); }
    catch(e){ return ''; }
  }

  function candidates(area, session){
    var wanted = (session === 's2' || session === 'm2') ? 'S2 AR Practice' : 'S1 AR Practice';
    return Array.prototype.slice.call(area.children).filter(function(child){
      var t = String(child && child.textContent || '');
      return t.indexOf(wanted) !== -1;
    });
  }

  function clean(){
    var area = document.getElementById('gameArea');
    if(!area) return;
    var session = currentSession();
    if(session !== 's1' && session !== 'm1' && session !== 's2' && session !== 'm2') return;

    var cards = candidates(area, session);
    cards.slice(1).forEach(function(card){
      card.remove();
      console.log('[AIQuest AR v389 safe] removed later duplicate only');
    });
  }

  function watch(){
    var area = document.getElementById('gameArea');
    if(!area || area.__aiquestArV389SafeObserved) return;
    area.__aiquestArV389SafeObserved = true;
    var timer = 0;
    new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(clean, 25);
    }).observe(area, {childList:true});
    setTimeout(clean, 250);
    setTimeout(clean, 900);
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(watch, 120);
    setTimeout(watch, 600);
    setTimeout(watch, 1200);
  });
  console.log('[AIQuest AR v389 safe] loaded');
})();