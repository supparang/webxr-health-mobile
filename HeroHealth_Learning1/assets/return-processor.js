(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2';
const q=new URLSearchParams(location.search);
const kind=q.get('hhReturn');
if(!kind)return;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function clean(){['hhReturn','task','zone','gameId','passed','completed','score','accuracy','eventId','studentId'].forEach(k=>q.delete(k));const next=location.pathname+(q.toString()?`?${q}`:'')+location.hash;history.replaceState({},'',next)}
const s=load();
if(!s||!s.profile){clean();return}
const sid=String(q.get('studentId')||'').trim();
if(sid&&sid!==String(s.profile.studentId||'').trim()){clean();return}
if(kind==='assessment'){
 const task=q.get('task');
 if(!['pretest','posttest','reflection'].includes(task)){clean();return}
 s.completed=s.completed||{};s.scores=s.scores||{};
 s.completed[task]=true;s.scores[task]=Number(q.get('score'))||0;
 save(s);clean();location.reload();return;
}
if(kind==='game'){
 const zone=q.get('zone'),gameId=q.get('gameId');
 const finished=q.get('completed')==='true'||q.get('passed')==='true';
 if(!finished||!['hygiene','nutrition','fitness'].includes(zone)||!gameId){clean();return}
 s.gameCompleted=s.gameCompleted||{hygiene:{},nutrition:{},fitness:{}};
 s.gameCompleted[zone]=s.gameCompleted[zone]||{};s.gameCompleted[zone][gameId]=true;
 s.gameScores=s.gameScores||{};s.gameScores[`${zone}:${gameId}`]=Number(q.get('score'))||0;
 s.gameResults=s.gameResults||{};s.gameResults[`${zone}:${gameId}`]={
  completed:true,passed:q.get('passed')==='true',score:Number(q.get('score'))||0,
  accuracy:Number(q.get('accuracy'))||0,finishedAt:new Date().toISOString()
 };
 const cfg=window.HH_CONFIG||{};const profile=cfg.missionProfiles?.[s.activeMissionProfile||cfg.activeMissionProfile]?.games?.[zone]||[];
 s.completed=s.completed||{};s.completed[zone]=profile.length>0&&profile.every(id=>s.gameCompleted[zone][id]);
 const eventId=q.get('eventId');if(eventId){s.processedEventIds=Array.isArray(s.processedEventIds)?s.processedEventIds:[];if(!s.processedEventIds.includes(eventId))s.processedEventIds.push(eventId);s.processedEventIds=s.processedEventIds.slice(-200)}
 save(s);clean();location.reload();
}
})();