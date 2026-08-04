(()=>{
'use strict';
const RELEASE='20260804-GAME-SHELL-LAUNCHER-R53-FIREBASE-RECEIPT';
let attempts=0;
let timer=0;

function detectDevice(){
 const q=new URLSearchParams(location.search),forced=String(q.get('device')||'').toLowerCase();
 if(['mobile','tablet','desktop'].includes(forced))return forced;
 const w=Math.min(window.innerWidth||9999,screen.width||9999),touch=navigator.maxTouchPoints>0;
 if(w<=767||/Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent))return'mobile';
 if(w<=1180||(touch&&/iPad|Android/i.test(navigator.userAgent)))return'tablet';
 return'desktop';
}
function detectView(){
 const q=new URLSearchParams(location.search),forced=String(q.get('view')||'').toLowerCase();
 if(['portrait','landscape'].includes(forced))return forced;
 return(window.innerWidth||0)>(window.innerHeight||0)?'landscape':'portrait';
}
function analyticsTarget(gameId,configured){
 if(gameId==='goodjunk')return new URL('./goodjunk-classroom-analytics-v15.html',location.href);
 if(gameId==='balance-hold')return new URL('../fitness/balance-hold-classroom-analytics-v50.html',location.href);
 return configured;
}
function install(){
 attempts++;
 const HH=window.HH,R=window.HHRotation;
 if(!HH||!R){if(attempts>400)clearInterval(timer);return false}
 if(HH.openNextGame?.__hhLauncherR53===true){clearInterval(timer);return true}
 const original=HH.openNextGame?.bind(HH);
 const launcher=function(zoneId){
  const C=window.HH_CONFIG||{};let s;
  try{s=JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2')||'{}')}catch(_){s=null}
  if(!s?.profile)return original?original(zoneId):undefined;
  const expected=R.expectedGame(s);
  if(!expected){alert('เกมในภารกิจครบแล้ว');return}
  if(zoneId!==expected.zoneId){alert('ภารกิจถัดไปคือ '+expected.label);return}
  const z=C.zones?.find(x=>x.id===expected.zoneId),g=z?.games?.find(x=>x.id===expected.gameId);
  if(!g?.url){alert('ยังไม่ได้กำหนด URL ของ '+expected.label);return}
  const pageQuery=new URLSearchParams(location.search);
  const authority=String(pageQuery.get('authority')||window.HH_AUTHORITY_MODE||'sheet').toLowerCase();
  const firebaseUid=String(pageQuery.get('firebaseUid')||s.firebaseUid||'');
  const shell=new URL('./game-shell-authority-r42.html',location.href);
  const configured=new URL(g.url,location.href),target=analyticsTarget(expected.gameId,configured);
  const group=R.groupOf(s),device=detectDevice(),view=detectView();
  shell.searchParams.set('shellVersion',RELEASE);
  shell.searchParams.set('strictAuthority','1');
  shell.searchParams.set('authority',authority);
  shell.searchParams.set('analyticsMode','full-once');
  shell.searchParams.set('_',Date.now());
  target.searchParams.set('launchVersion',RELEASE);
  target.searchParams.set('authority',authority);
  target.searchParams.set('analyticsMode','full-once');
  target.searchParams.set('finishGate',authority==='firebase'?'firebase-receipt-r1':'v50-direct');
  target.searchParams.set('_',Date.now());
  const common=[
   ['studentId',s.profile.studentId],['sid',s.profile.studentId],['section',s.profile.section],['group',group],
   ['zone',expected.zoneId],['gameId',expected.gameId],['missionProfile',R.profileIdOf(s)],
   ['rotationOrder',R.zonesFor(s).join(',')],['device',device],['view',view],
   ['classroom','1'],['mobileOnly',C.mobileOnly?'1':'0'],['singleAttempt','1'],
   ['authority',authority],['firebaseUid',firebaseUid]
  ];
  common.forEach(([k,v])=>target.searchParams.set(k,v||''));
  [...common,['target',target.href],['title',expected.label],['return',location.href]].forEach(([k,v])=>shell.searchParams.set(k,v||''));
  location.href=shell.href;
 };
 launcher.__hhLauncherV50=true;
 launcher.__hhLauncherR52=true;
 launcher.__hhLauncherR53=true;
 launcher.__hhLauncherRelease=RELEASE;
 HH.openNextGame=launcher;
 HH.__gameShellLauncherV50=RELEASE;
 HH.__gameShellLauncherR52=RELEASE;
 HH.__gameShellLauncherR53=RELEASE;
 clearInterval(timer);
 console.info('[HeroHealth] Firebase-aware Game Shell Launcher installed',RELEASE);
 return true;
}
install();
timer=setInterval(install,50);
addEventListener('pageshow',install);
window.HHGameShellLauncherV50={install,version:RELEASE};
window.HHGameShellLauncherR52={install,version:RELEASE};
window.HHGameShellLauncherR53={install,version:RELEASE};
})();
