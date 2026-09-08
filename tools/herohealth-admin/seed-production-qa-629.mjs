import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const STUDENT_ID = '629';
const RELEASE = '20260908-PRODUCTION-QA-629-R1';

function fail(message){ console.error(`\n❌ ${message}\n`); process.exit(1); }
if(!fs.existsSync(SERVICE_ACCOUNT)) fail(`ไม่พบ Service Account: ${SERVICE_ACCOUNT}`);
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT,'utf8'));
if(serviceAccount.project_id !== PROJECT_ID) fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);

const app = getApps().length ? getApps()[0] : initializeApp({credential:cert(serviceAccount),projectId:PROJECT_ID});
const db = getFirestore(app);
const rosterRef = db.collection('students').doc(STUDENT_ID);
const progressRef = db.collection('studentProgress').doc(STUDENT_ID);

await rosterRef.set({
  studentId:STUDENT_ID,
  loginCode:STUDENT_ID,
  fullName:'Test Student 629',
  nickname:'Test 629',
  grade:'TEST',
  section:'PRODUCTION-QA',
  classId:'PRODUCTION-QA',
  group:'B',
  rotationGroup:'B',
  conditionGroup:'QA',
  active:true,
  authority:'firebase-production',
  cohort:'HEROHEALTH-PRODUCTION-QA-2569',
  testAccount:true,
  productionQa:true,
  excludeFromResearch:true,
  researchParticipant:false,
  seededAt:FieldValue.serverTimestamp(),
  seededBy:'tools/herohealth-admin/seed-production-qa-629.mjs',
  build:RELEASE
},{merge:true});

const progressSnap = await progressRef.get();
if(!progressSnap.exists){
  await progressRef.set({
    studentId:STUDENT_ID,
    currentStep:'pretest',
    currentZone:'hygiene',
    progressPct:0,
    completedCount:0,
    pretestCompleted:false,
    posttestCompleted:false,
    reflectionCompleted:false,
    certificateEligible:false,
    gameCompleted:{hygiene:{},nutrition:{},fitness:{}},
    gameResults:{},
    assessments:{},
    completed:{pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false},
    productionQa:true,
    excludeFromResearch:true,
    researchParticipant:false,
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp(),
    build:RELEASE
  });
}

console.log('✅ Production QA student created');
console.log('   Login: 629');
console.log('   Name: Test Student 629');
console.log('   Flow: production Firebase');
console.log('   Research export: EXCLUDE');
console.log(progressSnap.exists ? '   Progress: preserved (existing)' : '   Progress: initialized at pretest');
