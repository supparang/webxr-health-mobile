window.EW_CONFIG = Object.freeze({
  appId: "ENGLISH-WEEK-PASSPORT-2026",
  version: "2026-08-08-PASSPORT-MOBILE-SMOKE-R3-SCROLL",
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

/* LEXICON X • Mobile Smoke-Test Contract R3
 * Desktop ?view=mobile = centered mobile viewport.
 * Passport pages remain vertically scrollable.
 * Gameplay shells remain fixed/full-screen.
 * The view flag propagates through nested game iframes.
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
  style.id='ewMobileSmokeContractR3';
  style.textContent=`
    html.ew-mobile-smoke-root{
      width:100%!important;
      min-height:100%!important;
      background:#07121f!important;
      overflow:hidden!important;
    }
    body.ew-mobile-smoke{
      width:430px!important;
      max-width:430px!important;
      min-width:0!important;
      height:100dvh!important;
      min-height:100dvh!important;
      position:fixed!important;
      top:0!important;
      left:50%!important;
      right:auto!important;
      bottom:auto!important;
      transform:translateX(-50%)!important;
      margin:0!important;
      overflow:hidden!important;
      box-shadow:0 0 0 1px rgba(255,255,255,.08),0 18px 60px rgba(0,0,0,.28)!important;
    }
    body.ew-mobile-smoke .shell{
      width:100%!important;
      max-width:430px!important;
      height:100dvh!important;
      min-height:100dvh!important;
      position:absolute!important;
      inset:0!important;
      margin:0!important;
      overflow:hidden!important;
    }
    body.ew-mobile-smoke iframe,
    body.ew-mobile-smoke .game-frame{
      display:block!important;
      width:100%!important;
      max-width:430px!important;
      height:100%!important;
    }

    /* Passport is a document, not a full-screen game. It must scroll. */
    html[data-lexicon-stage="passport"].ew-mobile-smoke-root{
      overflow:hidden!important;
    }
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke{
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch!important;
      overscroll-behavior-y:contain!important;
      touch-action:pan-y!important;
      scrollbar-gutter:stable!important;
    }
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke .app-shell{
      width:100%!important;
      max-width:430px!important;
      height:auto!important;
      min-height:100dvh!important;
      position:relative!important;
      inset:auto!important;
      margin:0!important;
      overflow:visible!important;
      touch-action:pan-y!important;
    }
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke .screen,
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke .passport-map{
      overflow:visible!important;
      touch-action:pan-y!important;
    }

    @media(max-width:720px){
      html.ew-mobile-smoke-root{background:inherit!important;overflow:hidden!important}
      body.ew-mobile-smoke{
        width:100%!important;
        max-width:none!important;
        left:0!important;
        transform:none!important;
        box-shadow:none!important;
      }
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

  window.EW_MOBILE_SMOKE=Object.freeze({version:'2026-08-08-MOBILE-SMOKE-R3-SCROLL',active:true,width:430,passportScroll:true});
})();
