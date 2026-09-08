import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const TARGET = '528';

function fail(message){ console.error(`\n❌ ${message}\n`); process.exit(1); }
if(!fs.existsSync(SERVICE_ACCOUNT)) fail(`ไม่พบ Service Account: ${SERVICE_ACCOUNT}`);
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT,'utf8'));
if(serviceAccount.project_id !== PROJECT_ID) fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);

const app = getApps().length ? getApps()[0] : initializeApp({credential:cert(serviceAccount),projectId:PROJECT_ID});
const db = getFirestore(app);
const collections = await db.listCollections();
const fields = ['studentId','sid','pid','loginCode','studentCode','participantId','profile.studentId'];
const seen = new Set();
const hits = [];

function summarize(data={}){
  const out={};
  for(const key of ['studentId','sid','pid','loginCode','fullName','name','nickname','currentStep','currentZone','progressPct','pretestCompleted','posttestCompleted','postExperienceCompleted','reflectionCompleted','certificateEligible','build','release','updatedAt','createdAt']){
    const v=data?.[key]; if(typeof v!=='undefined') out[key]=v;
  }
  if(data?.completed) out.completed=data.completed;
  if(data?.gameCompleted) out.gameCompleted=data.gameCompleted;
  if(data?.assessments) out.assessments=Object.fromEntries(Object.entries(data.assessments).map(([k,v])=>[k,{completed:v?.completed,score:v?.score,total:v?.total,receipt:!!v?.firebaseReceiptToken,attemptId:v?.attemptId}]));
  if(data?.gameResults) out.gameResults=Object.fromEntries(Object.entries(data.gameResults).map(([k,v])=>[k,{completed:v?.completed,passed:v?.passed,score:v?.score,receipt:!!v?.firebaseReceiptToken}]));
  return out;
}
function add(doc, reason){
  const key=doc.ref.path;
  if(seen.has(key)) return;
  seen.add(key);
  hits.push({path:key,reason,data:summarize(doc.data()||{})});
}

console.log(`🔎 READ-ONLY legacy scan for student ${TARGET}`);
console.log(`   Top-level collections: ${collections.length}`);

for(const col of collections){
  const name=col.id;
  try{
    const exact=await col.doc(TARGET).get();
    if(exact.exists) add(exact,'exact document id = 528');
  }catch(_){}
  try{
    const pref=await col.orderBy(FieldPath.documentId()).startAt(TARGET).endAt(TARGET+'\uf8ff').limit(25).get();
    pref.forEach(d=>add(d,'document id starts with 528'));
  }catch(_){}
  for(const field of fields){
    try{
      const q=await col.where(field,'==',TARGET).limit(25).get();
      q.forEach(d=>add(d,`${field} == 528`));
    }catch(_){}
  }
}

console.log(`\nFOUND = ${hits.length}`);
for(const hit of hits){
  console.log(`\n📄 ${hit.path}`);
  console.log(`   reason: ${hit.reason}`);
  console.log(JSON.stringify(hit.data,null,2));
}

if(!hits.length){
  console.log('\n⚠️ ไม่พบ record ของ 528 ใน top-level Firestore collections ด้วยรหัส 528');
  console.log('   ขั้นต่อไปควรตรวจ localStorage ของเครื่องที่ใช้เล่น และ legacy id mapping');
}
console.log('\n✅ READ ONLY: ไม่มีการเขียน/แก้/ลบ Firestore');
