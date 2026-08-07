(()=>{
'use strict';
const original=window.HH?.openNextGame;
const R=window.HHRotation;
const RELEASE='20260807-GAME-LAUNCHER-R47-RESPONSIVE-SMOKE';
if(!window.HH||!R)return;

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
function smokeMode(){return /^(1|true|yes)$/i.test(String(new URLSearchParams(location.search).get('smoke')||new URLSearchParams(location.search).get('smokeTest')||''))}
function analyticsTarget(gameId,configured){
 if(gameId==='groups'){
  const wrapper=new URL('./groups-mobile-coach-fix.html',location.href);
  wrapper.searchParams.set('source',configured.href);
  return wrapper;
 }
 if(gameId==='goodjunk')return new URL('./goodjunk-classroom-analytics-v15.html',location.href);
 if(gameId==='balance-hold')return new URL('../fitness/balance-hold-classroom-analytics-v50.html',location.href);
 return configured;
}
function authorityMode(){return String(new URLSearchParams(location.search).get('authority')||'sheet').toLowerCase()}

window.HH.openNextGame=function(zoneId){
 const C=window.HH_CONFIG||{};let s;
 try{s=JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2')||'{}')}catch(_){s=null}
 if(!s?.profile)return original?original(zoneId):undefined;
 const expected=R.expectedGame(s);
 if(!expected){alert('เกมในภารกิจครบแล้ว');return}
 if(zoneId!==expected.zoneId){alert('ภารกิจถัดไปคือ '+expected.label);return}
 const z=C.zones?.find(x=>x.id===expected.zoneId),g=z?.games?.find(x=>x.id===expected.gameId);
 if(!g?.url){alert('ยังไม่ได้กำหนด URL ของ '+expected.label);return}

 const configured=new URL(g.url,location.href),target=analyticsTarget(expected.gameId,configured);
 const group=R.groupOf(s),device=detectDevice(),view=detectView(),authority=authorityMode(),smoke=smokeMode();
 const firebaseUid=String(new URLSearchParams(location.search).get('firebaseUid')||s?.firebaseAuthority?.uid||window.HH_FIREBASE_AUTHORITY?.uid||'');
 const common=[
  ['studentId',s.profile.studentId],['sid',s.profile.studentId],['section',s.profile.section],['group',group],
  ['zone',expected.zoneId],['gameId',expected.gameId],['missionProfile',R.profileIdOf(s)],
  ['rotationOrder',R.zonesFor(s).join(',')],['device',device],['view',view],
  ['classroom','1'],['mobileOnly',C.mobileOnly?'1':'0'],['singleAttempt','1'],
  ['authority',authority],['firebaseUid',firebaseUid],['smoke',smoke?'1':'']
 ];
 common.forEach(([k,v])=>{if(v!=='')target.searchParams.set(k,v)});
 target.searchParams.set('launchVersion',RELEASE);
 target.searchParams.set('analyticsMode','full-once');
 target.searchParams.set('finishGate',authority==='firebase'?'firebase-receipt-r1':'sheet-event-receipt');
 target.searchParams.set('_',Date.now());

 const shell=new URL('./game-shell-authority-r42.html',location.href);
 shell.searchParams.set('shellVersion',RELEASE);
 shell.searchParams.set('strictAuthority','1');
 shell.searchParams.set('authority',authority);
 shell.searchParams.set('analyticsMode','full-once');
 if(smoke)shell.searchParams.set('smoke','1');
 shell.searchParams.set('_',Date.now());
 [...common,['target',target.href],['title',expected.label],['return',location.href]].forEach(([k,v])=>{if(v!=='')shell.searchParams.set(k,v)});
 location.assign(shell.href);
};
window.HH.openNextGame.__hhBaseLauncherR47=true;
window.HH.openNextGame.__hhLauncherRelease=RELEASE;

function findActionButton(event){
 const direct=event.target?.closest?.('button');
 if(direct)return direct;
 if(typeof event.clientX!=='number'||typeof event.clientY!=='number')return null;
 const stack=document.elementsFromPoint(event.clientX,event.clientY)||[];
 return stack.map(el=>el?.closest?.('button')).find(Boolean)||null;
}
function parseZone(button){
 const onclick=String(button?.getAttribute?.('onclick')||'');
 const match=onclick.match(/openNextGame\(['\"]([^'\"]+)['\"]\)/);
 if(match)return match[1];
 let s;
 try{s=JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2')||'{}')}catch(_){s={}}
 return R.expectedGame(s)?.zoneId||null;
}
function rescueAction(event){
 if(authorityMode()!=='firebase')return;
 const button=findActionButton(event);
 if(!button||button.disabled)return;
 const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
 const onclick=String(button.getAttribute('onclick')||'');
 if(!(text.includes('เริ่มเกมถัดไป')||text.includes('เริ่มฐาน')||onclick.includes('openNextGame')))return;
 const zoneId=parseZone(button);
 if(!zoneId)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 button.disabled=true;button.textContent='กำลังเปิดเกม…';
 console.info('[HeroHealth Firebase] receipt-shell interaction rescue',zoneId,button);
 window.HH.openNextGame(zoneId);
}

document.addEventListener('pointerup',rescueAction,true);
document.addEventListener('click',rescueAction,true);
console.info('[HeroHealth Firebase] shared receipt shell launcher installed',RELEASE,{smoke:smokeMode(),device:detectDevice(),view:detectView()});
})();