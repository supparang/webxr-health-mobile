import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT=path.join(HERE,'service-account.json');
const PROJECT_ID='herohealth-learning';
const SID='529';

function fail(msg){console.error(`\n❌ ${msg}\n`);process.exit(1)}
if(!fs.existsSync(SERVICE_ACCOUNT)) fail(`ไม่พบ ${SERVICE_ACCOUNT}`);
const sa=JSON.parse(fs.readFileSync(SERVICE_ACCOUNT,'utf8'));
if(sa.project_id!==PROJECT_ID) fail(`Service Account ต้องเป็น ${PROJECT_ID}`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const db=getFirestore(app);
const ref=db.collection('studentProgress').doc(SID);
const snap=await ref.get();
if(!snap.exists) fail('ไม่พบ studentProgress/529');
const before=snap.data()||{};
const fitness=before.gameCompleted?.fitness||{};
const results=before.gameResults||{};
console.log('🔎 ก่อนซ่อม 529');
console.log('   fitness gameCompleted =', JSON.stringify(fitness));
console.log('   balance result keys =', Object.keys(results).filter(k=>['balance','balancehold','balance-hold'].includes(String(k).toLowerCase())));
console.log('   completed.fitness =', before.completed?.fitness);
console.log('   posttestCompleted =', before.posttestCompleted);

const nextFitness={...fitness};
delete nextFitness.balance;delete nextFitness.balancehold;delete nextFitness['balance-hold'];
const nextResults={...results};
delete nextResults.balance;delete nextResults.balancehold;delete nextResults['balance-hold'];
const nextCompleted={...(before.completed||{}),fitness:false,posttest:false};

await ref.set({
  gameCompleted:{...(before.gameCompleted||{}),fitness:nextFitness},
  gameResults:nextResults,
  completed:nextCompleted,
  posttestCompleted:false,
  certificateEligible:false,
  currentStep:'balance',
  currentZone:'fitness',
  rewardChampionUnlocked:false,
  reward:{...(before.reward||{}),championUnlocked:false},
  updatedAt:FieldValue.serverTimestamp(),
  qaRepair:{reason:'balance-not-played-but-marked-complete',repairedAt:FieldValue.serverTimestamp(),release:'20260908-QA529-BALANCE-REPAIR-R1'}
},{merge:true});
console.log('\n✅ ซ่อม studentProgress/529 แล้ว');
console.log('   Balance aliases cleared');
console.log('   Fitness completion reset to false');
console.log('   Post-test + Champion locked again');
console.log('   JumpDuck และ 5 เกมก่อนหน้าคงเดิม');
