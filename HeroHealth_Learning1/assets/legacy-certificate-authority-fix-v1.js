(()=>{
'use strict';
const VERSION='20260729-LEGACY-CERTIFICATE-AUTHORITY-FIX-V1';
const REQUIRED={hygiene:['handwash','toothbrush'],nutrition:['groups','goodjunk'],fitness:['jumpduck','balance-hold']};
const truthy=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'').toLowerCase()==='yes';
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
function certificateEvidence(api){
  const a=api?.authoritativeState||{},live=api?.live||a.live||{},progress=api?.progress||a.progress||{};
  const certificate=truthy(api?.certificate)||truthy(api?.certificateEligible)||truthy(api?.hasCertificate)||truthy(a?.certificate)||truthy(a?.certificateEligible)||truthy(a?.hasCertificate)||truthy(live?.certificate)||truthy(live?.certificateEligible)||truthy(live?.hasCertificate)||String(live?.status||'').toLowerCase().includes('certificate');
  const percent=Math.max(n(api?.percent),n(api?.progressPercent),n(a?.percent),n(a?.progressPercent),n(live?.percent),n(live?.progressPercent),n(progress?.percent),n(progress?.progressPercent));
  const completedSteps=Math.max(n(api?.completedSteps),n(a?.completedSteps),n(live?.completedSteps),n(progress?.completedSteps));
  return certificate&&(percent>=100||completedSteps>=9||truthy(api?.legacyVerified)||truthy(a?.legacyVerified));
}
function applyLegacy(next,api){
  if(!certificateEvidence(api))return next;
  next.completed={...(next.completed||{}),pretest:true,hygiene:true,nutrition:true,fitness:true,posttest:true,reflection:true,gameSummary:true};
  next.gameCompleted=next.gameCompleted||{};
  Object.entries(REQUIRED).forEach(([zone,games])=>{
    next.gameCompleted[zone]={...(next.gameCompleted[zone]||{})};
    games.forEach(game=>{next.gameCompleted[zone][game]=true});
  });
  next.sheetAuthority=true;
  next.offlineAuthority=false;
  next.legacyVerified=true;
  next.legacyCertificateRestored=true;
  next.legacyCertificateAuthorityVersion=VERSION;
  next.legacyCertificateRestoredAt=new Date().toISOString();
  next.authoritativeProgress={...(next.authoritativeProgress||{}),percent:100,completedSteps:9,status:'certificate'};
  return next;
}
function install(){
  if(!window.HHStudentResume?.officialState){setTimeout(install,40);return}
  if(window.HHStudentResume.__legacyCertificateFixV1)return;
  const original=window.HHStudentResume.officialState.bind(window.HHStudentResume);
  window.HHStudentResume.officialState=(profile,api)=>applyLegacy(original(profile,api),api);
  window.HHStudentResume.__legacyCertificateFixV1=true;
  window.HHStudentResume.legacyCertificateFixVersion=VERSION;
}
install();
})();