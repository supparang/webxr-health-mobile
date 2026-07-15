import assert from 'node:assert/strict';

const endpoint=process.env.EAP_ENDPOINT||'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
const section=process.env.EAP_SECTION||'122';
const url=new URL(endpoint);
url.searchParams.set('action','eap_teacher_dashboard_data');
url.searchParams.set('section',section);
url.searchParams.set('_qa',Date.now().toString());

const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),120000);
let response;
try{
  response=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{accept:'application/json'}});
}finally{clearTimeout(timer)}
assert.equal(response.ok,true,`Dashboard endpoint HTTP ${response.status}`);
const text=await response.text();
let data;
try{data=JSON.parse(text)}catch(error){throw new Error(`Dashboard endpoint did not return JSON: ${text.slice(0,300)}`)}
assert.equal(data.ok,true,'Dashboard API must return ok=true');
assert.equal(data.version,'v7.0-CANONICAL-OFFICIAL-LEARNERS-122','Deployed Dashboard is not canonical v7');
assert.equal(String(data.section),String(section));
assert.ok(data.overview&&data.dataQuality&&Array.isArray(data.learners),'Missing canonical response sections');

const learners=data.learners;
const badIdentity=learners.filter(x=>/^(guest|anonymous|unknown|null|none|demo|sample|test|qa)([-_\s].*)?$/i.test(String(x.studentId||''))||/\b(guest|anonymous|demo student|test student|qa student)\b/i.test(String(x.studentName||'')));
assert.equal(badIdentity.length,0,`Non-official learners leaked: ${badIdentity.map(x=>x.studentId).join(', ')}`);

const o=data.overview;
assert.equal(Number(o.learners),learners.length,'Learner count must match canonical roster');
assert.ok(Number(o.bossSpeakingEvidence)<=learners.length*5,'Boss evidence exceeds one latest item per learner/B1–B5');
if(Number(o.wordQuestPlayers)===0){
  assert.equal(o.wordQuestAccuracyAverage,null,'Word average must be null when official Word players = 0');
}else{
  assert.ok(Number.isFinite(Number(o.wordQuestAccuracyAverage)),'Word average must be numeric when official Word players > 0');
  const actualPlayers=learners.filter(x=>x.wordQuest&&Array.isArray(x.wordQuest.records)&&x.wordQuest.records.length>0).length;
  assert.equal(Number(o.wordQuestPlayers),actualPlayers,'Word count and average population differ');
}
if(Number(o.bossPending)>0){
  const pendingLearners=learners.filter(x=>x.bossSpeaking&&Number(x.bossSpeaking.pending)>0);
  assert.ok(pendingLearners.length>0,'Overview has pending Boss evidence but no learner carries pending state');
  assert.ok(pendingLearners.every(x=>x.status==='review'),'Pending Boss learner must be review status');
}
assert.ok(Number(data.dataQuality.canonicalHeroCount)<=Number(data.dataQuality.rawSummaryCount),'Canonical Hero count cannot exceed raw Summary count');
assert.ok(Number(data.dataQuality.canonicalBossEvidenceCount)<=Number(data.dataQuality.rawBossEvidenceCount),'Canonical Boss count cannot exceed raw Boss count');

console.log(JSON.stringify({
  ok:true,
  version:data.version,
  section:data.section,
  overview:o,
  dataQuality:data.dataQuality,
  learners:learners.map(x=>({id:x.studentId,name:x.studentName,currentRoute:x.currentRoute,status:x.statusLabel,mastery:x.hero?.masteryRecords?.length||0,exposure:x.hero?.exposureRecords?.length||0,boss:x.bossSpeaking?.status||'none',wordBest:x.wordQuest?.avgAccuracy??null}))
},null,2));
