/* =========================================================
   EAP Hero Session Content Bridge v20260708
   V3 RETIRED STUDENT BRIEF
   - Mission Brief / Skill Contract / Vocabulary accordion panel is no longer shown to students.
   - Student flow is direct: Start/Continue -> current route -> Core/Support/Boss.
   - Keeps a tiny API shim for older buttons/scripts, but refresh is a no-op.
   - Does not change content pack, score, pass/fail, mastery, Sheet, or teacher review.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-STUDENT-BRIEF-RETIRED-DIRECT-MISSION-V3';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const PANEL_ID = 'eap-session-content-brief';
  const STYLE_ID = 'eap-session-content-bridge-retired-style';

  const clean = value => String(value == null ? '' : value).trim();

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function byRouteId(routeId){
    const data = pack();
    const key = clean(routeId).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => clean(route.routeId).toUpperCase() === key) || null;
  }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID},
      #eap-replay-challenge-panel,
      #eap-classroom-action-rail{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function removeRetiredPanels(){
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById('eap-replay-challenge-panel')?.remove();
    document.getElementById('eap-classroom-action-rail')?.remove();
  }

  function refresh(){
    addStyle();
    removeRetiredPanels();
  }

  window.EAPHeroContentBridge = {
    version: VERSION,
    retired: true,
    directMissionFlow: true,
    getPack: pack,
    getRoute: byRouteId,
    refresh: refresh
  };

  function start(){
    refresh();
    window.setInterval(refresh, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();