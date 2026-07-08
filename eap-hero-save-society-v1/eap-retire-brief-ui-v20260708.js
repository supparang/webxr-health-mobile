/* =========================================================
   EAP Hero Retire Brief UI v20260708
   - Removes the student Mission Brief / Replay Challenge / Skill Contract panel.
   - Hides Brief buttons from roadmap so students use direct route actions only.
   - Keeps teacher/content metadata in JS objects; UI is simplified for students.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-RETIRE-BRIEF-UI-V1';
  const STYLE_ID = 'eap-retire-brief-ui-style';

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #eap-session-content-brief,
      #eap-replay-challenge-panel,
      #eap-classroom-action-rail{
        display:none!important;
      }
      [data-eap-roadmap-brief]{
        display:none!important;
      }
      #eap-student-15week-roadmap .rm-actions{
        grid-template-columns:1fr!important;
      }
      #eap-student-15week-roadmap .rm-actions button[data-eap-roadmap-route]{
        min-height:44px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function removePanels(){
    document.getElementById('eap-session-content-brief')?.remove();
    document.getElementById('eap-replay-challenge-panel')?.remove();
    document.getElementById('eap-classroom-action-rail')?.remove();
  }

  function patchApis(){
    if (window.EAPHeroContentBridge) {
      window.EAPHeroContentBridge.retired = true;
      window.EAPHeroContentBridge.directMissionFlow = true;
      window.EAPHeroContentBridge.refresh = removePanels;
    }
    if (window.EAPClassroomActionRail) {
      window.EAPClassroomActionRail.retired = true;
      window.EAPClassroomActionRail.refresh = removePanels;
    }
    if (window.EAPReplayChallengeDirector) {
      window.EAPReplayChallengeDirector.metadataOnly = true;
      const oldRefresh = window.EAPReplayChallengeDirector.refresh;
      window.EAPReplayChallengeDirector.refresh = function(){
        try { if (typeof oldRefresh === 'function') oldRefresh(); } catch(error) {}
        removePanels();
      };
    }
  }

  function onClick(event){
    const btn = event.target && event.target.closest && event.target.closest('[data-eap-roadmap-brief]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function refresh(){
    addStyle();
    patchApis();
    removePanels();
  }

  function start(){
    document.addEventListener('click', onClick, true);
    window.addEventListener('load', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true });
    refresh();
    window.setInterval(refresh, 1000);
  }

  window.EAPRetireBriefUI = { version: VERSION, refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();