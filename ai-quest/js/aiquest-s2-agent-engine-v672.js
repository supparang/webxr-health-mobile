/* Legacy S2 entry retained for old bookmarks. */
(()=>{'use strict';
  if(window.__AIQUEST_S2_RECOVERY_ENGINE_LOADER_V690__)return;
  window.__AIQUEST_S2_RECOVERY_ENGINE_LOADER_V690__=true;
  const load=src=>new Promise(resolve=>{
    const s=document.createElement('script');s.src=src;s.async=false;
    s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s);
  });
  (async()=>{
    await load('./js/aiquest-s2-reflection-evidence-v675.js?v=20260707-case675');
    await load('./js/aiquest-s2-reflection-semantic-gate-v678.js?v=20260707-semantic678');
    await load('./js/aiquest-s2-case-evidence-skillfix-v676.js?v=20260707-case676');
    await load('./js/aiquest-s2-bootstrap-v674.js?v=20260707-bootstrap690');
    await load('./js/aiquest-s2-agent-engine-v674.js?v=20260707-recovery674');
  })();
})();
