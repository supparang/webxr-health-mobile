(()=>{
'use strict';
const original=window.HH?.openNextGame;
const R=window.HHRotation;
const RELEASE='20260730-GAME-SHELL-CORE-FIRST-R38';
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
window.HH.openNextGame=function(zoneId){
 const C=window.HH_CONFIG||{};let s;try{s=JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2')||'{}')}catch(_){s=null}
 if(!s?.profile)return original?original(zoneId):undefined;
 const expected=R.expectedGame(s);
 if(!expected){alert('เกมในภารกิจครบแล้ว');return}
 if(zoneId!==expected.zoneId){alert('ภารกิจถัดไปคือ '+expected.label);return}
 const z=C.zones?.find(x=>x.id===expected.zoneId),g=z?.games?.find(x=>x.id===expected.gameId);
 if(!g?.url){alert('ยังไม่ได้กำหนด URL ของ '+expected.label);return}
 const shell=new URL('./game-shell-once.html',location.href),target=new URL(g.url,location.href),group=R.groupOf(s),device=detectDevice(),view=detectView();
 shell.searchParams.set('shellVersion',RELEASE);shell.searchParams.set('_',Date.now());
 target.searchParams.set('launchVersion',RELEASE);target.searchParams.set('_',Date.now());
 const common=[['studentId',s.profile.studentId],['section',s.profile.section],['group',group],['zone',expected.zoneId],['gameId',expected.gameId],['missionProfile',R.profileIdOf(s)],['rotationOrder',R.zonesFor(s).join(',')],['device',device],['view',view],['classroom','1'],['mobileOnly',C.mobileOnly?'1':'0'],['singleAttempt','1']];
 common.forEach(([k,v])=>target.searchParams.set(k,v||''));
 [...common,['target',target.href],['title',expected.label],['return',location.href]].forEach(([k,v])=>shell.searchParams.set(k,v||''));
 location.href=shell.href;
};
})();
