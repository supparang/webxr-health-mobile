/* =========================================================
   EAP Hero • Lobby Boss Clean Slate v1
   PURPOSE
   - When Student Lobby says current cloud route is B1-B5,
     hide stale Session/Mission panels that may still be visible.
   - Preserve the Lobby and let Start / Continue open the real Boss route.
   - Restore hidden panels automatically when Lobby/Boss-route condition ends.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_LOBBY_BOSS_CLEAN_SLATE_V1__) return;
  window.__EAP_LOBBY_BOSS_CLEAN_SLATE_V1__ = true;

  var VERSION = '20260813-EAP-LOBBY-BOSS-CLEAN-SLATE-V1';
  var ATTR = 'data-eap-stale-mission-hidden';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function lobby(){ return document.getElementById('eap-student-compact-lobby'); }

  function currentBossRoute(){
    var l = lobby();
    if (!l) return '';
    var t = clean(l.innerText || l.textContent || '');
    var m = t.match(/\bB([1-5])\s+Boss\s+Gate\b/i);
    return m ? 'B' + Number(m[1]) : '';
  }

  function isBossEngineScreen(){
    var t = clean((document.getElementById('app') || document.body).innerText || '');
    return /Boss Gate\s*[1-5]\s*[·:]/i.test(t) && /Reading|Listening|Writing|Speaking/i.test(t) && !/STUDENT LOBBY/i.test(t);
  }

  function hideStaleMissionPanels(){
    var gate = currentBossRoute();
    if (!gate || isBossEngineScreen()) return restore();

    var l = lobby();
    if (!l) return restore();

    var candidates = Array.from(document.querySelectorAll('main,section,.panel,.card,div'));
    candidates.forEach(function(node){
      if (!node || node === l || (node.closest && node.closest('#eap-student-compact-lobby'))) return;
      if (node.hasAttribute(ATTR)) return;
      var t = clean(node.innerText || node.textContent || '');
      if (!t) return;

      var staleMission = /Mission Mode/i.test(t) && /Brief/i.test(t) && /Action/i.test(t) && /Rescue/i.test(t);
      var staleSession = /Academic Hero Awakening|Summary Builder|Critical Reading|Academic Vocabulary|Main Idea Reading|Keyword & Signal Words/i.test(t) && /Mission Mode|Rescue Clash|Focus Route/i.test(t);
      if (!(staleMission || staleSession)) return;

      // Never hide the app root or a container that contains the lobby.
      if (node.id === 'app' || (node.contains && node.contains(l))) return;
      node.setAttribute(ATTR,'1');
      node.style.setProperty('display','none','important');
      node.setAttribute('aria-hidden','true');
    });

    document.documentElement.dataset.eapLobbyBossCleanSlate = VERSION + '|' + gate;
  }

  function restore(){
    Array.from(document.querySelectorAll('['+ATTR+'="1"]')).forEach(function(node){
      node.style.removeProperty('display');
      node.removeAttribute(ATTR);
      node.removeAttribute('aria-hidden');
    });
  }

  var timer = 0;
  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(hideStaleMissionPanels,60);
  }

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('load',schedule);
  window.addEventListener('storage',schedule);
  window.addEventListener('eap:resume-synced',schedule);
  schedule();

  window.EAPLobbyBossCleanSlateV1 = {version:VERSION, run:hideStaleMissionPanels, restore:restore};
})();
