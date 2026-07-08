/* =========================================================
   EAP Hero Classroom Current Week v20260708
   Purpose:
   - Set the classroom default route to Week 2 / S2 for tomorrow's class.
   - Do not override explicit URL parameters such as ?session=1 or ?route=S1.
   - Do not erase learner progress; only sets the active classroom route.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-CLASSROOM-CURRENT-WEEK-S2';
  const DEFAULT_ROUTE = 'S2';
  const DEFAULT_SESSION = '2';
  const ROUTE_TITLE = 'Vocabulary Lab';
  const KEYS = [
    'EAP_HERO_ACTIVE_ROUTE',
    'EAP_HERO_CURRENT_ROUTE',
    'EAP_HERO_CURRENT_SESSION',
    'EAP_ACTIVE_SESSION'
  ];

  function clean(value){
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function hasExplicitRoute(){
    const q = new URLSearchParams(location.search);
    return !!clean(q.get('session') || q.get('route') || q.get('stage'));
  }

  function setRoute(){
    if (hasExplicitRoute()) return;
    try {
      localStorage.setItem('EAP_HERO_CLASSROOM_DEFAULT_ROUTE', DEFAULT_ROUTE);
      localStorage.setItem('EAP_HERO_CLASSROOM_DEFAULT_TITLE', ROUTE_TITLE);
      localStorage.setItem('EAP_HERO_CLASSROOM_DEFAULT_VERSION', VERSION);
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', DEFAULT_ROUTE);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', DEFAULT_ROUTE);
      localStorage.setItem('EAP_HERO_CURRENT_SESSION', DEFAULT_SESSION);
      localStorage.setItem('EAP_ACTIVE_SESSION', DEFAULT_SESSION);
    } catch(error) {}
  }

  function routeInfo(){
    return {
      version: VERSION,
      defaultRoute: DEFAULT_ROUTE,
      defaultSession: DEFAULT_SESSION,
      title: ROUTE_TITLE,
      explicitUrlRoute: hasExplicitRoute()
    };
  }

  setRoute();

  window.EAPClassroomCurrentWeek = {
    version: VERSION,
    defaultRoute: DEFAULT_ROUTE,
    defaultSession: DEFAULT_SESSION,
    title: ROUTE_TITLE,
    setRoute,
    info: routeInfo
  };
})();