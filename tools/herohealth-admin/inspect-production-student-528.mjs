import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const SERVICE_ACCOUNT=path.join(HERE,'service-account.json');
const STUDENT_ID='528';

function fail(message){console.error(`\n❌ ${message}\n`);process.exit(1)}
if(!fs.existsSync(SERVICE_ACCOUNT))fail(`ไม่พบ Service Account: ${SERVICE_ACCOUNT}`);
const serviceAccount=JSON.parse(fs.readFileSync(SERVICE_ACCOUNT,'utf8'));
if(serviceAccount.project_id!==PROJECT_ID)fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);

const app=getApps().length?getApps()[0]:initializeApp({credential:cert(serviceAccount),projectId:PROJECT_ID});
const db=getFirestore(app);
const progressRef=db.collection('studentProgress').doc(STUDENT_ID);
const progressSnap=await progressRef.get();
const p=progressSnap.exists?progressSnap.data():{};
const assessmentsSnap=await db.collection('studentAssessments').where('studentId','==',STUDENT_ID).get();

const aliases={
 handwash:['handwash','hand-wash'],
 toothbrush:['toothbrush','brush'],
 groups:['groups','foodgroups','food-groups'],
 goodjunk:['goodjunk','good-junk'],
 jumpduck:['jumpduck','jump-duck'],
 balance:['balance','balancehold','balance-hold']
};
const zones={handwash:'hygiene',toothbrush:'hygiene',groups:'nutrition',goodjunk:'nutrition',jumpduck:'fitness',balance:'fitness'};
const resultDone=r=>Boolean(r&&r.completed===true&&r.passed!==false&&r.progressionEligible!==false);
const gameDone=game=>aliases[game].some(id=>p?.gameCompleted?.[zones[game]]?.[id]===true)||aliases[game].some(id=>resultDone(p?.gameResults?.[id]));

console.log('🔎 HEROHEALTH 528 READ-ONLY INSPECTION');
console.log('   studentProgress exists =',progressSnap.exists);
console.log('');
console.log('ASSESSMENTS / FLAGS');
console.log('   pretestCompleted =',p?.pretestCompleted===true);
console.log('   assessments.pretest.completed =',p?.assessments?.pretest?.completed===true);
console.log('   assessments.pretest.receipt =',Boolean(p?.assessments?.pretest?.firebaseReceiptToken));
console.log('   posttestCompleted =',p?.posttestCompleted===true);
console.log('   assessments.posttest.completed =',p?.assessments?.posttest?.completed===true);
console.log('   assessments.posttest.receipt =',Boolean(p?.assessments?.posttest?.firebaseReceiptToken));
console.log('');
console.log('GAMES');
for(const game of Object.keys(aliases))console.log(`   ${game} =`,gameDone(game));
console.log('');
console.log('POST EXPERIENCE / REFLECTION');
console.log('   postExperienceCompleted =',p?.postExperienceCompleted===true);
console.log('   postExperience.completed =',p?.postExperience?.completed===true);
console.log('   postExperienceReceiptToken =',Boolean(p?.postExperienceReceiptToken));
console.log('   reflectionCompleted =',p?.reflectionCompleted===true);
console.log('   reflection.completed =',p?.reflection?.completed===true);
console.log('   reflectionReceiptToken =',Boolean(p?.reflectionReceiptToken));
console.log('');
console.log('PROGRESSION FIELDS');
console.log('   currentStep =',p?.currentStep??'(none)');
console.log('   currentZone =',p?.currentZone??'(none)');
console.log('   progressPct =',p?.progressPct??'(none)');
console.log('   completed =',JSON.stringify(p?.completed||{}));
console.log('');
console.log('studentAssessments docs =',assessmentsSnap.size);
for(const doc of assessmentsSnap.docs){
 const d=doc.data()||{};
 console.log(`   ${doc.id}: type=${d.assessmentType||d.mode||'(unknown)'} completed=${d.completed===true} receipt=${Boolean(d.firebaseReceiptToken)}`);
}
console.log('\n✅ READ ONLY: ไม่มีการแก้ไข Firestore');
