/* CSAI2102 AI Quest — AR Final Route v4.0.1
   Leave the underlying session open when AR closes, but remove the AR query
   so refresh/back does not reopen camera mode accidentally.
*/
(() => {
  'use strict';
  if (window.__AIQUEST_AR_FINAL_ROUTE_V401__) return;
  window.__AIQUEST_AR_FINAL_ROUTE_V401__ = true;

  function clearARQuery(){
    const u = new URL(location.href);
    if (!u.searchParams.get('ar')) return;
    u.searchParams.delete('ar');
    u.searchParams.delete('mode');
    if (u.searchParams.get('from') === 's1' || u.searchParams.get('from') === 's2') u.searchParams.delete('from');
    try { history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); }
    catch (_) {}
  }

  window.addEventListener('aiquest:ar-stop', (event) => {
    const reason = String(event?.detail?.reason || '');
    if (['pagehide','beforeunload','boot-failed'].includes(reason)) return;
    clearARQuery();
  });
})();
