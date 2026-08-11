window.EW_CONFIG = Object.freeze({
  appId: "ENGLISH-WEEK-PASSPORT-2026",
  version: "2026-08-11-PRODUCTION-CLOSEOUT-PASS55-60",
  authorityMode: "firestore-direct",
  firebaseProjectId: "englishweek-95869",
  firebaseRegion: "asia-southeast1",
  firebaseAuthorityUrl: "",
  firebaseJourneyUrl: "",
  firebaseTeacherUrl: "https://asia-southeast1-englishweek-95869.cloudfunctions.net/englishWeekTeacher",
  firebaseNamespace: "englishWeekPassport/v1",
  webAppUrl: "",
  defaultGroup: "English Week",
  allowDemoWhenEndpointMissing: false,
  allowDemoWhenFirebaseUnavailable: false,
  allowQaDemoFallback: false,
  requestTimeoutMs: 12000,
  assessmentItems: 10,
  leaderboardLimit: 10,
  gamePassMark: 60,
  gamePassMarks: Object.freeze({
    word_match:55,
    category_forest:60,
    sentence_city:60,
    word_detective:60,
    final_boss:60
  }),
  cacheKeys: Object.freeze({
    identity: "ew_passport_identity_v1",
    demoDb: "ew_passport_demo_db_v1",
    assignmentPrefix: "ew_passport_assignment_v2::"
  })
});

(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('view')!=='mobile')return;
  const root=document.documentElement;
  root.dataset.ewView='mobile';root.classList.add('ew-mobile-smoke-root');if(document.body)document.body.classList.add('ew-mobile-smoke');
  const style=document.createElement('style');style.id='ewMobileSmokeContractR4';style.textContent=`
    html.ew-mobile-smoke-root{width:100%!important;min-width:100%!important;min-height:100%!important;background:#07121f!important;overflow:hidden!important;display:flex!important;justify-content:center!important;align-items:flex-start!important}
    body.ew-mobile-smoke{flex:0 0 430px!important;width:430px!important;max-width:430px!important;min-width:0!important;height:100dvh!important;min-height:100dvh!important;position:relative!important;inset:auto!important;transform:none!important;margin:0!important;overflow:hidden!important;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 18px 60px rgba(0,0,0,.28)!important}
    body.ew-mobile-smoke .shell{width:100%!important;max-width:430px!important;height:100dvh!important;min-height:100dvh!important;position:absolute!important;inset:0!important;margin:0!important;overflow:hidden!important}
    body.ew-mobile-smoke iframe,body.ew-mobile-smoke .game-frame{display:block!important;width:100%!important;max-width:430px!important;height:100%!important}
    html[data-lexicon-stage="passport"].ew-mobile-smoke-root{overflow:hidden!important}
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke{height:100dvh!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important;scrollbar-gutter:stable!important}
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke .app-shell{width:100%!important;max-width:430px!important;height:auto!important;min-height:100dvh!important;position:relative!important;inset:auto!important;margin:0!important;overflow:visible!important;touch-action:pan-y!important}
    html[data-lexicon-stage="passport"] body.ew-mobile-smoke .screen,html[data-lexicon-stage="passport"] body.ew-mobile-smoke .passport-map{overflow:visible!important;touch-action:pan-y!important}
    @media(max-width:720px){html.ew-mobile-smoke-root{display:block!important;background:inherit!important;overflow:hidden!important}body.ew-mobile-smoke{width:100%!important;max-width:none!important;flex:none!important;box-shadow:none!important}body.ew-mobile-smoke .app-shell,body.ew-mobile-smoke .shell,body.ew-mobile-smoke iframe,body.ew-mobile-smoke .game-frame{max-width:none!important}}
  `;document.head.appendChild(style);
  function carryView(frame){try{const raw=frame.getAttribute('src');if(!raw||raw==='about:blank')return;const url=new URL(raw,location.href);if(url.searchParams.get('view')==='mobile')return;url.searchParams.set('view','mobile');frame.setAttribute('src',url.href)}catch(_){}}
  const scan=()=>document.querySelectorAll('iframe').forEach(carryView);scan();
  new MutationObserver(records=>records.forEach(record=>{if(record.type==='attributes'&&record.target?.tagName==='IFRAME')carryView(record.target);record.addedNodes?.forEach(node=>{if(node?.tagName==='IFRAME')carryView(node);node?.querySelectorAll?.('iframe').forEach(carryView)})})).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  window.EW_MOBILE_SMOKE=Object.freeze({version:'2026-08-08-MOBILE-SMOKE-R4-CENTER',active:true,width:430,passportScroll:true,centering:'html-flex-host'});
})();

/* Shell + inner-frame emergency exit R2 */
(function(){
  'use strict';
  if(!/passport-game-shell-firestore-v2\.html$/i.test(String(location.pathname||'')))return;
  function returnPassport(){
    try{document.exitPointerLock?.()}catch(_){}
    try{if(document.fullscreenElement)document.exitFullscreen?.()}catch(_){}
    const q=new URLSearchParams(location.search);
    const out=new URLSearchParams({resume:'passport',fromGame:q.get('stage')||'game',exit:'manual',v:'20260811-shell-exit-r2'});
    if(q.get('view')==='mobile')out.set('view','mobile');
    location.replace('./index.html?'+out.toString());
  }
  function makeButton(doc,id){
    if(!doc?.body||doc.getElementById(id))return;
    const btn=doc.createElement('button');btn.id=id;btn.type='button';btn.textContent='← Passport';btn.setAttribute('aria-label','กลับ Passport');
    btn.style.cssText='position:fixed;z-index:2147483647;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));min-width:112px;min-height:46px;padding:0 14px;border:1px solid rgba(255,255,255,.62);border-radius:14px;background:rgba(5,18,31,.96);color:#fff;font:900 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.42);cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none';
    btn.addEventListener('pointerdown',e=>e.stopPropagation(),true);
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();returnPassport()},true);
    doc.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();returnPassport()}},true);
    doc.body.appendChild(btn);
  }
  function wireFrame(frame){const wire=()=>{try{const doc=frame.contentDocument;makeButton(doc,'ewInnerPassportExit');doc?.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();returnPassport()}},true);doc?.exitPointerLock?.()}catch(_){}};frame.addEventListener('load',()=>setTimeout(wire,80));setTimeout(wire,120)}
  function install(){makeButton(document,'ewShellEmergencyExit');document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();returnPassport()}},true);document.querySelectorAll('iframe').forEach(wireFrame);new MutationObserver(records=>records.forEach(r=>r.addedNodes?.forEach(n=>{if(n?.tagName==='IFRAME')wireFrame(n);n?.querySelectorAll?.('iframe').forEach(wireFrame)}))).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.EW_SHELL_EMERGENCY_EXIT=Object.freeze({version:'2026-08-09-SHELL-EXIT-R2-INNER',returnPassport});
})();

/* LEXICON X • Production Game Pass Policy R2
 * Game 1 (LexiMatch) passes at 55%. Games 2–5 pass at 60%.
 * Pre/Post remain completion-only and are not pass/fail gates.
 */
(function(){
  'use strict';
  const VERSION='2026-08-11-PASS-POLICY-R2-G1-55-OTHERS-60';
  const PASS_MARKS=Object.freeze({word_match:55,category_forest:60,sentence_city:60,word_detective:60,final_boss:60});
  const STAGES=new Set(Object.keys(PASS_MARKS));
  let storedAuthority=window.EW_AUTHORITY||null;
  const clean=v=>String(v==null?'':v).trim();
  const nowIso=()=>new Date().toISOString();
  const unique=a=>[...new Set((Array.isArray(a)?a:[]).map(clean).filter(Boolean))];
  const receiptId=stage=>`game-${stage}-${PASS_MARKS[stage]}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  function reconcile(raw,playerId){
    const passed=unique(raw?.passed).filter(x=>STAGES.has(x));
    const bestScores=raw?.bestScores&&typeof raw.bestScores==='object'?{...raw.bestScores}:{};
    const unlocked=['pre_challenge'];
    if(raw?.preDone)unlocked.push('word_match');
    if(passed.includes('word_match'))unlocked.push('category_forest');
    if(passed.includes('category_forest'))unlocked.push('sentence_city');
    if(passed.includes('sentence_city'))unlocked.push('word_detective');
    if(passed.includes('word_detective'))unlocked.push('final_boss');
    if(passed.includes('final_boss'))unlocked.push('post_challenge');
    if(raw?.postDone)unlocked.push('certificate');
    return {...raw,playerId,passed,bestScores,unlocked,currentStage:unlocked[unlocked.length-1],finalDone:Boolean(raw?.finalDone||passed.includes('final_boss')),totalScore:Object.values(bestScores).reduce((sum,v)=>sum+Number(v||0),0),updatedAt:nowIso(),passPolicyVersion:VERSION,gamePassMarks:PASS_MARKS};
  }
  async function ensureFirebase(){if(!window.firebase?.firestore||!window.firebase?.auth)throw new Error('FIREBASE_DIRECT_NOT_READY');const auth=firebase.auth();if(!auth.currentUser)await auth.signInAnonymously();return firebase.firestore()}
  function wrap(base){
    if(!base||typeof base!=='object'||base.passPolicyVersion===VERSION)return base;
    const custom=async payload=>{
      const playerId=clean(payload?.playerId),stageId=clean(payload?.stageId);
      if(!playerId||!STAGES.has(stageId))throw new Error('INVALID_GAME_PAYLOAD');
      const passMark=PASS_MARKS[stageId];
      const total=Math.max(0,Number(payload?.total||0)),score=Math.max(0,Number(payload?.score||0));
      const accuracy=total>0?Math.round(score/total*100):0,passed=accuracy>=passMark,id=receiptId(stageId);
      const db=await ensureFirebase(),progressRef=db.collection('ewp_progress').doc(playerId),resultRef=db.collection('ewp_game_results').doc(id),summaryRef=db.collection('ewp_game_summary').doc(playerId);let nextProgress=null;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(progressRef),raw=snap.exists?{playerId,...(snap.data()||{})}:{playerId,passed:[],bestScores:{},preDone:false,postDone:false};
        const current=reconcile(raw,playerId);if(!current.unlocked.includes(stageId))throw new Error('STAGE_LOCKED');
        const nextPassed=[...current.passed];if(passed&&!nextPassed.includes(stageId))nextPassed.push(stageId);
        const nextBest={...current.bestScores,[stageId]:Math.max(Number(current.bestScores?.[stageId]||0),accuracy)};
        nextProgress=reconcile({...current,passed:nextPassed,bestScores:nextBest},playerId);
        tx.set(progressRef,nextProgress,{merge:true});
        tx.set(resultRef,{...payload,playerId,stageId,receiptId:id,accuracy,passMark,passed,submittedAt:nowIso(),sourceVersion:VERSION,authorityMode:'firestore-direct',passPolicy:stageId==='word_match'?'g1-55':'g2-5-60'});
        tx.set(summaryRef,{playerId,totalScore:nextProgress.totalScore,bestScores:nextProgress.bestScores,passed:nextProgress.passed,currentStage:nextProgress.currentStage,gamePassMarks:PASS_MARKS,updatedAt:nowIso(),sourceVersion:VERSION},{merge:true});
      });
      let resumed=null;try{resumed=typeof base.resume==='function'?await base.resume(playerId,payload?.nickname||''):null}catch(_){}
      return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority + Production Pass Policy',receiptId:id,accuracy,passMark,passed,progress:nextProgress,authority:resumed&&resumed.ok?resumed:{ok:true,mode:'firebase',progress:nextProgress},version:VERSION};
    };
    return Object.freeze({...base,submitGame:custom,passMark:60,passMarks:PASS_MARKS,passPolicyVersion:VERSION});
  }
  try{Object.defineProperty(window,'EW_AUTHORITY',{configurable:true,enumerable:true,get(){return storedAuthority},set(value){storedAuthority=wrap(value);window.dispatchEvent(new CustomEvent('ew-pass-policy-ready',{detail:{version:VERSION,passMarks:PASS_MARKS}}))}});if(storedAuthority)storedAuthority=wrap(storedAuthority)}catch(_){if(window.EW_AUTHORITY)window.EW_AUTHORITY=wrap(window.EW_AUTHORITY)}
  window.EW_PASS_POLICY=Object.freeze({version:VERSION,gamePassMarks:PASS_MARKS,prePost:'completion-only'});
})();

/* Reconcile shell wording with the active per-stage pass policy. */
(function(){
  'use strict';
  if(!/passport-game-shell-firestore-v2\.html$/i.test(String(location.pathname||'')))return;
  const stage=new URLSearchParams(location.search).get('stage')||'';
  async function reconcileStatus(){
    const detail=document.getElementById('statusDetail');if(!detail||!/คะแนนยังไม่ถึงเกณฑ์ผ่าน/.test(detail.textContent||''))return;
    let identity=null;try{identity=JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){}
    if(!identity?.playerId||!window.EW_AUTHORITY?.resume)return;
    try{const r=await window.EW_AUTHORITY.resume(identity.playerId,identity.nickname||identity.fullName||'');if(r?.progress?.passed?.includes(stage)){const mark=window.EW_CONFIG?.gamePassMarks?.[stage]||60;detail.textContent=`ผ่านด่านและปลดล็อกขั้นถัดไปแล้ว • เกณฑ์ผ่าน ${mark}%`}}catch(_){}
  }
  const install=()=>{const status=document.getElementById('status');if(!status)return;new MutationObserver(reconcileStatus).observe(status,{childList:true,subtree:true,characterData:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();