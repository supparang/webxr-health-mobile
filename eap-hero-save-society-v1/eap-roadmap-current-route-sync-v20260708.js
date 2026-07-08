/* =========================================================
   EAP Hero Roadmap Current Route Sync v20260708
   - Keeps the 15-week roadmap "ตอนนี้" card aligned with verified Cloud/Sheet unlock.
   - Uses EAPRoadmapLockGuard.currentRoute() as source after resume/lock guard runs.
   - Updates local route cache only to the verified current route.
   - Does not change scores, pass/fail, Sheet, or teacher review.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-ROADMAP-CURRENT-ROUTE-SYNC-V1';
  const KEYS = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE'];
  let last = '';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function routeId(route){ return clean(route && route.routeId || route || '').toUpperCase(); }
  function sessionNumber(rid){ const m = clean(rid).match(/^S(\d+)$/i); return m ? Number(m[1]) : 0; }

  function verifiedCurrentRoute(){
    try {
      if (window.EAPRoadmapLockGuard && typeof window.EAPRoadmapLockGuard.currentRoute === 'function') {
        const route = window.EAPRoadmapLockGuard.currentRoute();
        const rid = routeId(route);
        if (rid) return rid;
      }
    } catch(error) {}
    return '';
  }

  function writeRoute(rid){
    if (!rid) return;
    try {
      KEYS.forEach(key => localStorage.setItem(key, rid));
      const n = sessionNumber(rid);
      if (n) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(n));
      else localStorage.removeItem('EAP_HERO_CURRENT_SESSION');
    } catch(error) {}
  }

  function refreshRoadmap(){
    try {
      if (window.EAPStudentHomeRoadmap && typeof window.EAPStudentHomeRoadmap.refresh === 'function') {
        window.EAPStudentHomeRoadmap.refresh();
      }
    } catch(error) {}
    try {
      if (window.EAPRoadmapLockGuard && typeof window.EAPRoadmapLockGuard.refresh === 'function') {
        window.EAPRoadmapLockGuard.refresh();
      }
    } catch(error) {}
  }

  function sync(){
    const rid = verifiedCurrentRoute();
    if (!rid) return;
    if (rid !== last) {
      last = rid;
      writeRoute(rid);
      refreshRoadmap();
    }
  }

  function start(){
    window.addEventListener('load', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('eap:resume-synced', () => setTimeout(sync, 250));
    setTimeout(sync, 300);
    setTimeout(sync, 1200);
    setInterval(sync, 1800);
  }

  window.EAPRoadmapCurrentRouteSync = { version: VERSION, sync };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();