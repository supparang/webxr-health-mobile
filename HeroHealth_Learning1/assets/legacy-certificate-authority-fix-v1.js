(()=>{
'use strict';
const VERSION='20260729-LEGACY-CERTIFICATE-AUTHORITY-FIX-V2';
const KEY='herohealth_learning_platform_rc2';
const REQUIRED={hygiene:['handwash','toothbrush'],nutrition:['groups','goodjunk'],fitness:['jumpduck','balance-hold']};
const truthy=v=>v===true||v===1||['true','yes','1'].includes(String(v??'').trim().toLowerCase());
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const text=v=>String(v??'').trim().toLowerCase();
function objects(api){
  const out=[],seen=new Set();
  function walk(v,depth=0){
    if(!v||typeof v!=='object'||depth>5||seen.has(v))return;
    seen.add(v);out.push(v);
    if(Array.isArray(v)){v.slice(-30).forEach(x=>walk(x,depth+1));return}
    Object.values(v).forEach(x=>{if(x&&typeof x==='object')walk(x,depth+1)});
  }
  walk(api);return out;
}
function certificateEvidence(api){
  const list=objects(api);
  let certificate=false,missionComplete=false,currentStepCertificate=false,percent=0,completedSteps=0;
  for(const o of list){
    certificate=certificate||truthy(o.certificate)||truthy(o.certificateEligible)||truthy(o.hasCertificate)||text(o.status).includes('certificate')||text(o.status).includes('ใบประกาศ');
    missionComplete=missionComplete||truthy(o.missionComplete)||truthy(o.courseComplete)||truthy(o.completedAll);
    currentStepCertificate=currentStepCertificate||text(o.currentStep)==='certificate'||text(o.step)==='certificate'||text(o.nextStep)==='certificate';
    percent=Math.max(percent,n(o.percent),n(o.progressPercent),n(o.progressPct),n(o.completionPercent));
    completedSteps=Math.max(completedSteps,n(o.completedSteps),n(o.completedCount),n(o.completeCount));
  }
  const legacyVerified=list.some(o=>truthy(o.legacyVerified));
  const completeEvidence=currentStepCertificate||missionComplete||percent>=100||completedSteps>=9;
  return completeEvidence&&(certificate||missionComplete||currentStepCertificate||legacyVerified||percent>=100||completedSteps>=9);
}
function applyLegacy(next,api){
  if(!certificateEvidence(api))return next;
  next.completed={...(next.completed||{}),pretest:true,hygiene:true,nutrition:true,fitness:true,posttest:true,reflection:true,gameSummary:true};
  next.gameCompleted=next.gameCompleted||{};
  Object.entries(REQUIRED).forEach(([zone,games])=>{
    next.gameCompleted[zone]={...(next.gameCompleted[zone]||{})};
    games.forEach(game=>{next.gameCompleted[zone][game]=true});
  });
  next.sheetAuthority=true;next.offlineAuthority=false;next.legacyVerified=true;
  next.legacyCertificateRestored=true;next.legacyCertificateAuthorityVersion=VERSION;
  next.legacyCertificateRestoredAt=new Date().toISOString();
  next.authoritativeProgress={...(next.authoritativeProgress||{}),percent:100,progressPct:100,completedSteps:9,completedCount:9,currentStep:'certificate',missionComplete:true,status:'certificate'};
  return next;
}
async function refreshCurrent(){
  const state=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}})();
  const sid=String(state?.profile?.studentId||new URLSearchParams(location.search).get('studentId')||'').trim();
  if(!sid||!window.HHStudentResume?.getStudent||!window.HHStudentResume?.officialState)return;
  try{
    try{await window.HHStudentResume.reconcile?.(sid)}catch(_){}
    const api=await window.HHStudentResume.getStudent(sid);
    const next=window.HHStudentResume.officialState(state.profile||{studentId:sid},api);
    if(next?.legacyCertificateRestored===true){
      localStorage.setItem(KEY,JSON.stringify(next));
      sessionStorage.setItem('hh_authority_bootstrap:'+sid,String(Date.now()));
      if(!document.documentElement.dataset.hhLegacyRestored){document.documentElement.dataset.hhLegacyRestored='1';location.reload()}
    }
  }catch(e){console.warn('[HeroHealth legacy certificate refresh]',e)}
}
function install(){
  if(!window.HHStudentResume?.officialState){setTimeout(install,40);return}
  if(window.HHStudentResume.__legacyCertificateFixV2)return;
  const original=window.HHStudentResume.officialState.bind(window.HHStudentResume);
  window.HHStudentResume.officialState=(profile,api)=>applyLegacy(original(profile,api),api);
  window.HHStudentResume.__legacyCertificateFixV1=true;
  window.HHStudentResume.__legacyCertificateFixV2=true;
  window.HHStudentResume.legacyCertificateFixVersion=VERSION;
  setTimeout(refreshCurrent,0);
}
install();
})();