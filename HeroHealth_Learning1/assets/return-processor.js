(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2',R=window.HHRotation;
const q=new URLSearchParams(location.search),kind=q.get('hhReturn');
if(!kind||!R)return;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function clean(){['hhReturn','task','zone','gameId','passed','completed','score','accuracy','eventId','studentId','sessionId','startedAt'].forEach(k=>q.delete(k));const next=location.pathname+(q.toString()?`?${q}`:'')+location.hash;history.replaceState({},'',next)}
const s=load();if(!s||!s.profile){clean();return}
const sid=String(q.get('studentId')||'').trim();if(sid&&sid!==String(s.profile.studentId||'').trim()){clean();return}
if(kind==='assessment'){
 const task=q.get('task');if(!['pretest','posttest','reflection'].includes(task)){clean();return}
 s.completed=s.completed||{};s.scores=s.scores||{};
 const st=R.status(s),gamesDone=st.route.filter(x=>x.type==='game').every(x=>R.done(s,x));
 if(task==='pretest'&&s.completed.pretest!==true){s.completed.pretest=true;s.scores.pretest=Number(q.get('score'))||0}
 else if(task==='posttest'&&s.completed.pretest===true&&gamesDone){s.completed.posttest=true;s.scores.posttest=Number(q.get('score'))||0}
 else if(task==='reflection'&&s.completed.posttest===true){s.completed.reflection=true;s.scores.reflection=Number(q.get('score'))||0}
 else{clean();return}
 save(s);clean();location.reload();return;
}
if(kind==='game'){
 const zone=q.get('zone'),gameId=q.get('gameId'),finished=q.get('completed')==='true'||q.get('passed')==='true';
 if(!finished||!s.completed?.pretest||!zone||!gameId){clean();return}
 s.gameCompleted=s.gameCompleted||{};R.ZONE_ORDER.forEach(z=>s.gameCompleted[z]=s.gameCompleted[z]||{});
 const expected=R.expectedGame(s);
 if(!expected||expected.zoneId!==zone||expected.gameId!==gameId){clean();return}
 s.gameCompleted[zone][gameId]=true;
 s.gameScores=s.gameScores||{};s.gameScores[`${zone}:${gameId}`]=Number(q.get('score'))||0;
 s.gameResults=s.gameResults||{};s.gameResults[`${zone}:${gameId}`]={completed:true,passed:q.get('passed')==='true',score:Number(q.get('score'))||0,accuracy:Number(q.get('accuracy'))||0,finishedAt:new Date().toISOString(),sessionId:q.get('sessionId')||'',startedAt:q.get('startedAt')||'',rotationGroup:R.groupOf(s),rotationZones:R.zonesFor(s)};
 R.syncZoneCompletion(s);
 s.rotationGroup=R.groupOf(s);s.rotationZones=R.zonesFor(s);
 const eventId=q.get('eventId');if(eventId){s.processedEventIds=Array.isArray(s.processedEventIds)?s.processedEventIds:[];if(!s.processedEventIds.includes(eventId))s.processedEventIds.push(eventId);s.processedEventIds=s.processedEventIds.slice(-200)}
 save(s);clean();location.reload();
}
})();
