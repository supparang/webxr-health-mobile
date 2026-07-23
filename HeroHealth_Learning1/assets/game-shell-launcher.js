(()=>{
'use strict';
const original=window.HH?.openNextGame;
const R=window.HHRotation;
if(!window.HH||!R)return;
window.HH.openNextGame=function(zoneId){
 const C=window.HH_CONFIG||{};let s;try{s=JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2')||'{}')}catch(_){s=null}
 if(!s?.profile)return original?original(zoneId):undefined;
 const expected=R.expectedGame(s);
 if(!expected){alert('เกมในภารกิจครบแล้ว');return}
 if(zoneId!==expected.zoneId){alert('ภารกิจถัดไปคือ '+expected.label);return}
 const z=C.zones?.find(x=>x.id===expected.zoneId),g=z?.games?.find(x=>x.id===expected.gameId);
 if(!g?.url){alert('ยังไม่ได้กำหนด URL ของ '+expected.label);return}
 const shell=new URL('./game-shell.html',location.href),target=new URL(g.url,location.href),group=R.groupOf(s);
 [['studentId',s.profile.studentId],['section',s.profile.section],['group',group],['zone',expected.zoneId],['gameId',expected.gameId],['missionProfile',R.profileIdOf(s)],['rotationOrder',R.zonesFor(s).join(',')]].forEach(([k,v])=>target.searchParams.set(k,v||''));
 [['target',target.href],['studentId',s.profile.studentId],['section',s.profile.section],['group',group],['zone',expected.zoneId],['gameId',expected.gameId],['title',expected.label],['rotationOrder',R.zonesFor(s).join(',')],['return',location.href]].forEach(([k,v])=>shell.searchParams.set(k,v||''));
 location.href=shell.href;
};
})();
