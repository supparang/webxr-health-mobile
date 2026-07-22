(()=>{
'use strict';
const original=window.HH?.openNextGame;
if(!window.HH)return;
window.HH.openNextGame=function(zoneId){
 const C=window.HH_CONFIG||{};let s;try{s=JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2')||'{}')}catch(_){s=null}
 if(!s?.profile){return original?original(zoneId):undefined}
 const seq=C.rotation?.[s.group]||[];const currentZone=seq.find(id=>!s.completed?.[id]);
 if(zoneId!==currentZone){alert('ยังไม่ถึงฐานนี้');return}
 const ids=C.missionProfiles?.[s.activeMissionProfile||C.activeMissionProfile]?.games?.[zoneId]||[];
 const nextId=ids.find(id=>!s.gameCompleted?.[zoneId]?.[id]);
 const z=C.zones?.find(x=>x.id===zoneId);const g=z?.games?.find(x=>x.id===nextId);
 if(!g?.url){alert('ยังไม่ได้กำหนดเกมถัดไป');return}
 const shell=new URL('./game-shell.html',location.href);const target=new URL(g.url,location.href);
 target.searchParams.set('studentId',s.profile.studentId);target.searchParams.set('section',s.profile.section);target.searchParams.set('group',s.group);target.searchParams.set('zone',zoneId);target.searchParams.set('gameId',g.id);target.searchParams.set('missionProfile',s.activeMissionProfile||C.activeMissionProfile);
 shell.searchParams.set('target',target.href);shell.searchParams.set('studentId',s.profile.studentId);shell.searchParams.set('zone',zoneId);shell.searchParams.set('gameId',g.id);shell.searchParams.set('title',g.thai||g.title||g.id);shell.searchParams.set('return',location.href);location.href=shell.href;
};
})();