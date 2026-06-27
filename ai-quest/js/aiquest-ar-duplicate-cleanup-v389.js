/* AI Quest AR Duplicate Card Cleanup v3.8.9
   Keep only the v388 AR card. Older S1/S2 entry scripts may also inject a card.
*/
(function(){
  'use strict';

  function clean(){
    var area = document.getElementById('gameArea');
    if(!area) return;

    Array.prototype.slice.call(area.children).forEach(function(child){
      if(child && child.id === 'aiquestArStableCardV388') return;
      var t = String(child && child.textContent || '');
      var isOldArCard = /S1\s*AR\s*Practice|S2\s*AR\s*Practice|AI\s*Object\s*Scanner|Agent\s*Builder/.test(t)
        && /AR\s*Practice|เริ่ม\s*AR|ฝึก\s*AR/.test(t);
      if(isOldArCard){
        child.remove();
        console.log('[AIQuest AR v389] removed duplicate AR card');
      }
    });
  }

  function watch(){
    clean();
    var area = document.getElementById('gameArea');
    if(!area || area.__aiquestArV389Observed) return;
    area.__aiquestArV389Observed = true;
    var timer = 0;
    new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(clean, 10);
    }).observe(area, {childList:true});
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(watch, 120);
    setTimeout(watch, 500);
    setTimeout(watch, 1000);
  });
  console.log('[AIQuest AR v389] duplicate cleanup loaded');
})();