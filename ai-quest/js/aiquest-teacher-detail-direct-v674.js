/* Legacy teacher detail entry — routed to the session-aware viewer. */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_DETAIL_DIRECT_V674__||window.__AIQUEST_TEACHER_SESSION_DETAIL_V695__)return;
  window.__AIQUEST_TEACHER_DETAIL_DIRECT_V674__=true;
  const script=document.createElement('script');
  script.src='./js/aiquest-teacher-session-detail-v695.js?v=20260707-sessiondetail695';
  script.async=false;
  document.head.appendChild(script);
})();