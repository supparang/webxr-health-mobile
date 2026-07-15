import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../EAP_AnalyticsCanonicalV7.gs',import.meta.url),'utf8');
const headers=['section','studentId','studentName','sessionId','sessionTitle','skill','bestScore','bestAccuracy','passed','legacyCompletion','attempts','reviewFlag','updatedAt'];
const rows=[
  ['122','50','KK','1','Academic Hero Awakening','Reading',90,90,true,false,2,'','2026-07-01T10:00:00+07:00'],
  ['122','50','KK','S1','Academic Hero Awakening','Reading',100,100,true,false,4,'','2026-07-02T10:00:00+07:00'],
  ['122','50','KK','S1','Academic Hero Awakening','Speaking',100,100,true,false,2,'','2026-07-02T10:01:00+07:00'],
  ['122','50','KK','S2','Vocabulary Lab','Reading',100,100,true,false,1,'','2026-07-03T10:00:00+07:00'],
  ['122','50','KK','S2','Vocabulary Lab','Writing',61,61,true,false,1,'','2026-07-03T10:01:00+07:00'],
  ['122','50','KK','S3','Main Idea Hunter','Reading',100,100,true,false,1,'','2026-07-04T10:00:00+07:00'],
  ['122','50','KK','S3','Main Idea Hunter','Writing',88,88,true,false,1,'','2026-07-04T10:01:00+07:00'],
  ['122','50','KK','B1','Boss Gate 1','Reading',100,100,true,false,4,'','2026-07-05T10:00:00+07:00'],
  ['122','50','KK','B1','Boss Gate 1','Listening',100,100,true,false,4,'','2026-07-05T10:01:00+07:00'],
  ['122','50','KK','B1','Boss Gate 1','Writing',94,94,true,false,4,'','2026-07-05T10:02:00+07:00'],
  ['122','50','KK','B1','Boss Gate 1','Speaking',93,93,true,false,4,'','2026-07-05T10:03:00+07:00'],
  ['122','2','KAT','S1','Academic Hero Awakening','Reading',0,0,false,false,1,'','2026-07-02T09:00:00+07:00'],
  ['122','2','KAT','S1','Academic Hero Awakening','Speaking',100,100,true,false,1,'','2026-07-02T09:01:00+07:00'],
  ['122','guest','Guest','S1','Academic Hero Awakening','Reading',100,100,true,false,1,'','2026-07-02T08:00:00+07:00']
];
const boss=[
  {studentId:'50',studentName:'KK',section:'122',sessionId:'B1',score:90,reviewStatus:'pending_teacher_review',createdAt:'2026-07-05T10:00:00+07:00'},
  {studentId:'50',studentName:'KK',section:'122',sessionId:'B1',score:93,reviewStatus:'pending_teacher_review',createdAt:'2026-07-06T10:00:00+07:00'},
  {studentId:'2',studentName:'KAT',section:'122',sessionId:'B1',score:88,reviewStatus:'pending_teacher_review',createdAt:'2026-07-05T09:00:00+07:00'},
  {studentId:'2',studentName:'KAT',section:'122',sessionId:'B1',score:91,reviewStatus:'reviewed',teacherReviewedAt:'2026-07-07T09:00:00+07:00',createdAt:'2026-07-06T09:00:00+07:00'},
  {studentId:'guest',studentName:'Guest',section:'122',sessionId:'B1',score:100,reviewStatus:'pending_teacher_review',createdAt:'2026-07-07T08:00:00+07:00'}
];
const word=[
  {studentId:'50',studentName:'KK',section:'122',sessionId:'S1',accuracy:80,score:80,passed:true,playedAt:'2026-07-01T12:00:00+07:00',weakWords:['evidence']},
  {studentId:'50',studentName:'KK',section:'122',sessionId:'S1',accuracy:90,score:90,passed:true,playedAt:'2026-07-02T12:00:00+07:00',weakWords:['limitation']},
  {studentId:'guest',studentName:'Guest',section:'122',sessionId:'S1',accuracy:99,score:99,passed:true,playedAt:'2026-07-03T12:00:00+07:00'}
];
const sandbox={
  console,EAP_CONFIG:{DEFAULT_SECTION:'122'},H:{summary:headers},
  sh_:name=>({getDataRange:()=>({getValues:()=>name==='summary'?[headers,...rows]:[]})}),
  rowObject_:(hs,row)=>Object.fromEntries(hs.map((h,i)=>[h,row[i]])),
  eapEvidenceRows_:()=>boss,eapwqReadAttempts_:()=>word,
  eapCanonicalIdentity_:(source,id,name)=>({studentId:String(id),studentName:String(name)}),
  now_:()=>({iso:'2026-07-15T08:00:00+07:00'})
};
vm.createContext(sandbox);vm.runInContext(code,sandbox,{filename:'EAP_AnalyticsCanonicalV7.gs'});
const data=sandbox.eapTeacherDashboardDataCanonicalV7({section:'122'});
assert.equal(data.ok,true);
assert.equal(data.version,'v7.0-CANONICAL-OFFICIAL-LEARNERS-122');
assert.equal(data.overview.learners,2,'Guest must not be an official learner');
assert.equal(JSON.stringify(Array.from(data.learners,x=>x.studentId).sort()),JSON.stringify(['2','50']));
assert.equal(data.dataQuality.heroDuplicatesCollapsed,1,'1 and S1 duplicate must collapse');
assert.ok(data.dataQuality.quarantinedCount>=3,'Guest rows from all sources must be quarantined');
assert.equal(data.overview.bossSpeakingEvidence,2,'Boss attempts must collapse to latest per learner/Boss');
assert.equal(data.overview.bossPending,1);assert.equal(data.overview.bossReviewed,1);
assert.equal(data.dataQuality.bossDuplicatesCollapsed,2);
assert.equal(data.overview.wordQuestPlayers,1);assert.equal(data.overview.wordQuestAccuracyAverage,90);
assert.equal(data.overview.heroOnly,1);assert.equal(data.overview.wordQuestOnly,0);assert.equal(data.overview.both,1);
const kk=data.learners.find(x=>x.studentId==='50'),kat=data.learners.find(x=>x.studentId==='2');
assert.equal(kk.currentRoute,'B1');assert.equal(kk.status,'review');assert.equal(kk.statusLabel,'รอตรวจ Boss Speaking');assert.equal(kk.bossSpeaking.records.length,1);
assert.equal(kat.currentRoute,'S1');assert.equal(kat.bossSpeaking.status,'reviewed');
assert.equal(data.overview.wordQuestAccuracyAverage===null,data.overview.wordQuestPlayers===0,'Word average and player count must use the same official population');
console.log(JSON.stringify({ok:true,overview:data.overview,dataQuality:data.dataQuality,learners:data.learners.map(x=>({id:x.studentId,route:x.currentRoute,status:x.statusLabel,boss:x.bossSpeaking.status,word:x.wordQuest.avgAccuracy}))},null,2));
