import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const RELEASE = '20260907-P5-P6-LOGIN-ROSTER-R1';
const GROUPS = ['A','B','C','D','E','F','G','H','I','J'];

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(v => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function fail(message) { console.error(`\n❌ ${message}\n`); process.exit(1); }

function parseCsv(text) {
  const rows=[]; let row=[]; let field=''; let quoted=false;
  const src=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<src.length;i+=1){
    const ch=src[i];
    if(quoted){
      if(ch==='"'){
        if(src[i+1]==='"'){field+='"';i+=1;} else quoted=false;
      }else field+=ch;
      continue;
    }
    if(ch==='"'){quoted=true;continue;}
    if(ch===','){row.push(field);field='';continue;}
    if(ch==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';continue;}
    field+=ch;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(!rows.length)return[];
  const headers=rows[0].map(v=>String(v||'').trim());
  return rows.slice(1).filter(r=>r.some(v=>String(v||'').trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'').trim()])));
}

function normalize(raw,index){
  const loginCode=String(raw.loginCode||raw.login_code||raw.code||'').trim();
  const schoolStudentId=String(raw.schoolStudentId||raw.school_student_id||raw.originalStudentId||'').trim();
  const fullName=String(raw.fullName||raw.full_name||raw.name||'').trim();
  const nickname=String(raw.nickname||raw.nick||'').trim();
  const grade=String(raw.grade||'').trim().toUpperCase();
  const section=String(raw.section||`${grade}-2569`).trim();
  const requestedGroup=String(raw.group||'').trim().toUpperCase();
  const group=GROUPS.includes(requestedGroup)?requestedGroup:GROUPS[index%GROUPS.length];
  return {loginCode,schoolStudentId,fullName,nickname,grade,section,group};
}

const csvArg=argValue('file');
if(!csvArg)fail('กรุณาระบุ CSV เช่น npm run import-p5p6-login -- --file=/path/to/herohealth-p5-p6-private.csv');
const csvPath=path.resolve(csvArg);
if(!fs.existsSync(csvPath))fail(`ไม่พบ CSV: ${csvPath}`);

const serviceAccountPath=path.resolve(argValue('service-account')||DEFAULT_SERVICE_ACCOUNT);
if(!fs.existsSync(serviceAccountPath))fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
let serviceAccount;
try{serviceAccount=JSON.parse(fs.readFileSync(serviceAccountPath,'utf8'));}
catch(error){fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`);}
if(serviceAccount.project_id!==PROJECT_ID)fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);

const students=parseCsv(fs.readFileSync(csvPath,'utf8')).map(normalize);
if(!students.length)fail('CSV ไม่มีข้อมูล');
const errors=[]; const seen=new Set();
students.forEach((s,i)=>{
  const row=i+2;
  if(!s.loginCode)errors.push(`แถว ${row}: ไม่มี loginCode`);
  if(!/^(5(?:0[1-9]|1\d|2[0-8])|6(?:0[1-9]|1\d|2[0-8]))$/.test(s.loginCode))errors.push(`แถว ${row}: loginCode '${s.loginCode}' ต้องอยู่ใน 501-528 หรือ 601-628`);
  const expectedGrade=s.loginCode.startsWith('5')?'P5':'P6';
  if(s.grade!==expectedGrade)errors.push(`แถว ${row}: grade '${s.grade}' ไม่ตรงกับ loginCode ${s.loginCode} (ต้องเป็น ${expectedGrade})`);
  if(!s.fullName)errors.push(`แถว ${row}: ไม่มี fullName`);
  if(!s.schoolStudentId)errors.push(`แถว ${row}: ไม่มี schoolStudentId`);
  if(seen.has(s.loginCode))errors.push(`แถว ${row}: loginCode ${s.loginCode} ซ้ำ`);
  seen.add(s.loginCode);
});
if(errors.length)fail(`CSV validation ไม่ผ่าน:\n- ${errors.join('\n- ')}`);

console.log('HeroHealth P5/P6 private roster import');
console.log(`Project: ${PROJECT_ID}`);
console.log(`Rows: ${students.length}`);
console.log(`P5: ${students.filter(s=>s.grade==='P5').length}`);
console.log(`P6: ${students.filter(s=>s.grade==='P6').length}`);
console.log(`Mode: ${hasFlag('commit')?'COMMIT':'DRY RUN'}`);
if(!hasFlag('commit')){
  console.table(students.map(({schoolStudentId,...s})=>s));
  console.log('\n✅ ตรวจข้อมูลผ่าน แต่ยังไม่เขียน Firebase เติม --commit เมื่อต้องการนำเข้าจริง');
  process.exit(0);
}

const app=getApps().length?getApps()[0]:initializeApp({credential:cert(serviceAccount),projectId:PROJECT_ID});
const db=getFirestore(app);
const progressRefs=students.map(s=>db.collection('studentProgress').doc(s.loginCode));
const progressSnaps=await db.getAll(...progressRefs);
const existingProgress=new Set(progressSnaps.filter(s=>s.exists).map(s=>s.id));
const writer=db.bulkWriter();
writer.onWriteError(error=>{console.error(`Firestore write error: ${error.documentRef?.path||'unknown'} • ${error.message}`);return error.failedAttempts<3;});

for(const s of students){
  const sid=s.loginCode;
  writer.set(db.collection('students').doc(sid),{
    studentId:sid,
    loginCode:sid,
    fullName:s.fullName,
    nickname:s.nickname,
    grade:s.grade,
    section:s.section,
    classId:s.section,
    group:s.group,
    rotationGroup:s.group,
    conditionGroup:s.group,
    active:true,
    authority:'firebase-production',
    cohort:`HEROHEALTH-${s.grade}-2569`,
    importedAt:FieldValue.serverTimestamp(),
    importedBy:'tools/herohealth-admin/import-p5-p6-login-roster.mjs',
    build:RELEASE
  },{merge:true});

  // School IDs are kept out of the learner-facing roster document.
  writer.set(db.collection('studentIdentityPrivate').doc(sid),{
    loginCode:sid,
    schoolStudentId:s.schoolStudentId,
    fullName:s.fullName,
    grade:s.grade,
    section:s.section,
    updatedAt:FieldValue.serverTimestamp(),
    build:RELEASE
  },{merge:true});

  if(!existingProgress.has(sid)){
    writer.create(db.collection('studentProgress').doc(sid),{
      studentId:sid,
      currentStep:'pretest',
      currentZone:'hygiene',
      progressPct:0,
      completedCount:0,
      pretestCompleted:false,
      posttestCompleted:false,
      reflectionCompleted:false,
      certificateEligible:false,
      gameCompleted:{hygiene:{},nutrition:{},fitness:{}},
      gameResults:{},assessments:{},
      completed:{pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false},
      createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),build:RELEASE
    });
  }
}
await writer.close();
console.log('\n✅ Import สำเร็จ');
console.log('Learner IDs: 501-528 และ 601-628');
console.log('School IDs stored only in studentIdentityPrivate');
