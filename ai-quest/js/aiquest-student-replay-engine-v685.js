/* CSAI2102 Core Replay Loader v6.8.5
   Loads the current runtime engine first, then the guaranteed result-screen Case picker.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_REPLAY_LOADER_V685__)return;
  window.__AIQUEST_CORE_REPLAY_LOADER_V685__=true;
  const load=(src,done)=>{const node=document.createElement('script');node.src=src;node.async=false;node.onload=done;node.onerror=done;document.head.appendChild(node);};
  load('./js/aiquest-student-replay-engine-v674.js?v=20260707-casepicker685',()=>{
    load('./js/aiquest-core-case-picker-recovery-v684.js?v=20260707-casepicker685',()=>{});
  });
})();
