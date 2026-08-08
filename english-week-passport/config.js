window.EW_CONFIG = Object.freeze({
  appId: "ENGLISH-WEEK-PASSPORT-2026",
  version: "2026-08-08-PASSPORT-MOBILE-SMOKE-R1",
  authorityMode: "firestore-direct",
  firebaseProjectId: "englishweek-95869",
  firebaseRegion: "asia-southeast1",
  firebaseAuthorityUrl: "",
  firebaseJourneyUrl: "",
  firebaseTeacherUrl: "",
  firebaseNamespace: "englishWeekPassport/v1",
  webAppUrl: "",
  defaultGroup: "English Week",
  allowDemoWhenEndpointMissing: false,
  allowDemoWhenFirebaseUnavailable: false,
  allowQaDemoFallback: false,
  requestTimeoutMs: 12000,
  assessmentItems: 10,
  leaderboardLimit: 10,
  cacheKeys: Object.freeze({
    identity: "ew_passport_identity_v1",
    demoDb: "ew_passport_demo_db_v1",
    assignmentPrefix: "ew_passport_assignment_v2::"
  })
});

/* LEXICON X • Mobile Smoke-Test Contract R1
 * Production is mobile-first. On PC, ?view=mobile renders the same narrow
 * viewport used for classroom smoke tests while keeping DevTools available.
 * The flag is propagated into child iframes so every game sees mobile width.
 */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('view')!=='mobile')return;

  const root=document.documentElement;
  root.dataset.ewView='mobile';
  root.classList.add('ew-mobile-smoke-root');
  if(document.body)document.body.classList.add('ew-mobile-smoke');

  const style=document.createElement('style');
  style.id='ewMobileSmokeContractR1';
  style.textContent=`
    html.ew-mobile-smoke-root{
      min-height:100%;
      background:#07121f!important;
      overflow:auto!important;
    }
    body.ew-mobile-smoke{
      width:min(430px,100vw)!important;
      max-width:430px!important;
      min-width:0!important;
      height:100dvh!important;
      min-height:100dvh!important;
      margin:0 auto!important;
      position:relative!important;
      inset:auto!important;
      overflow:hidden!important;
      box-shadow:0 0 0 1px rgba(255,255,255,.08),0 18px 60px rgba(0,0,0,.28)!important;
    }
    body.ew-mobile-smoke .app-shell,
    body.ew-mobile-smoke .shell{
      width:100%!important;
      max-width:430px!important;
      height:100dvh!important;
      min-height:100dvh!important;
      position:absolute!important;
      inset:0!important;
      margin:0!important;
    }
    body.ew-mobile-smoke iframe,
    body.ew-mobile-smoke .game-frame{
      width:100%!important;
      max-width:430px!important;
      height:100%!important;
    }
    @media(max-width:720px){
      html.ew-mobile-smoke-root{background:inherit!important;overflow:hidden!important}
      body.ew-mobile-smoke{width:100%!important;max-width:none!important;box-shadow:none!important}
      body.ew-mobile-smoke .app-shell,
      body.ew-mobile-smoke .shell,
      body.ew-mobile-smoke iframe,
      body.ew-mobile-smoke .game-frame{max-width:none!important}
    }
  `;
  document.head.appendChild(style);

  function carryView(frame){
    try{
      const raw=frame.getAttribute('src');
      if(!raw||raw==='about:blank')return;
      const url=new URL(raw,location.href);
      if(url.searchParams.get('view')==='mobile')return;
      url.searchParams.set('view','mobile');
      frame.setAttribute('src',url.href);
    }catch(_){ }
  }

  const scan=()=>document.querySelectorAll('iframe').forEach(carryView);
  scan();
  new MutationObserver((records)=>{
    records.forEach(record=>{
      if(record.type==='attributes'&&record.target?.tagName==='IFRAME')carryView(record.target);
      record.addedNodes?.forEach(node=>{
        if(node?.tagName==='IFRAME')carryView(node);
        node?.querySelectorAll?.('iframe').forEach(carryView);
      });
    });
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});

  window.EW_MOBILE_SMOKE=Object.freeze({version:'2026-08-08-MOBILE-SMOKE-R1',active:true,width:430});
})();
