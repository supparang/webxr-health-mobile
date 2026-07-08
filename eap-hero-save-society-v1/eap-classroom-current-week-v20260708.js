/* =========================================================
   EAP Hero Classroom Current Week v20260708
   V2: manual helper only.
   - Does NOT set any default route automatically.
   - This prevents weekly maintenance confusion.
   - Teachers can still open a specific week with URL params, e.g. ?session=2.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-CLASSROOM-CURRENT-WEEK-MANUAL-ONLY';

  function clean(value){
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function normalizeRoute(route){
    const raw = clean(route).toUpperCase();
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw;
  }

  function setRoute(route){
    const normalized = normalizeRoute(route);
    if (!normalized) return false;
    const session = /^S\d+$/i.test(normalized)
      ? normalized.replace(/^S/i,'')
      : normalized;
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', normalized);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', normalized);
      localStorage.setItem('EAP_HERO_CURRENT_SESSION', session);
      localStorage.setItem('EAP_ACTIVE_SESSION', session);
      localStorage.setItem('EAP_HERO_CLASSROOM_ROUTE_SET_MANUALLY_AT', new Date().toISOString());
    } catch(error) {}
    return true;
  }

  function clearRoute(){
    try {
      [
        'EAP_HERO_ACTIVE_ROUTE',
        'EAP_HERO_CURRENT_ROUTE',
        'EAP_HERO_CURRENT_SESSION',
        'EAP_ACTIVE_SESSION',
        'EAP_HERO_CLASSROOM_DEFAULT_ROUTE',
        'EAP_HERO_CLASSROOM_DEFAULT_TITLE',
        'EAP_HERO_CLASSROOM_DEFAULT_VERSION'
      ].forEach(key => localStorage.removeItem(key));
    } catch(error) {}
    return true;
  }

  function info(){
    return {
      version: VERSION,
      autoDefault: false,
      recommendation: 'Use explicit URL params such as ?session=2 for a specific teaching week.'
    };
  }

  window.EAPClassroomCurrentWeek = {
    version: VERSION,
    setRoute,
    clearRoute,
    info
  };
})();