import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const MARKER = 'HEROHEALTH_TEACHER_PRODUCTION_R1';

function fail(message){ console.error(`\n❌ ${message}\n`); process.exit(1); }
function timestamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }
function findMatchingBrace(source, openIndex){
  let depth=0,state='normal';
  for(let i=openIndex;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(state==='line'){ if(ch==='\n')state='normal'; continue; }
    if(state==='block'){ if(ch==='*'&&next==='/'){state='normal';i++;} continue; }
    if(state==='single'){ if(ch==='\\'){i++;continue;} if(ch==="'")state='normal'; continue; }
    if(state==='double'){ if(ch==='\\'){i++;continue;} if(ch==='"')state='normal'; continue; }
    if(ch==='/'&&next==='/'){state='line';i++;continue;}
    if(ch==='/'&&next==='*'){state='block';i++;continue;}
    if(ch==="'"){state='single';continue;}
    if(ch==='"'){state='double';continue;}
    if(ch==='{')depth++;
    if(ch==='}'){depth--; if(depth===0)return i;}
  }
  return -1;
}
function patch(source){
  if(source.includes(`${MARKER}_BEGIN`)) return {content:source,changed:false};
  const dbIdx=source.indexOf('match /databases/');
  if(dbIdx<0) throw new Error('ไม่พบ match /databases/{database}/documents');
  const open=source.indexOf('{',dbIdx);
  const close=findMatchingBrace(source,open);
  if(open<0||close<0) throw new Error('หา block database ใน rules ไม่สำเร็จ');
  const add=`\n\n    // ${MARKER}_BEGIN\n    // Teacher Console read-only access. Existing learner rules remain unchanged.\n    match /students/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    match /studentProgress/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    match /studentAssessments/{documentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    // ${MARKER}_END\n`;
  return {content:`${source.slice(0,close)}${add}${source.slice(close)}`,changed:true};
}

if(!fs.existsSync(SERVICE_ACCOUNT)) fail(`ไม่พบ ${SERVICE_ACCOUNT}`);
let key;
try{key=JSON.parse(fs.readFileSync(SERVICE_ACCOUNT,'utf8'));}catch(e){fail(`อ่าน service-account.json ไม่สำเร็จ: ${e.message}`);}
if(key.project_id!==PROJECT_ID) fail(`Service Account project ต้องเป็น ${PROJECT_ID}`);

const app=getApps().length?getApps()[0]:initializeApp({credential:cert(key),projectId:PROJECT_ID});
const rules=getSecurityRules(app);
console.log('🔎 อ่าน Firestore Rules ที่ใช้งานจริง...');
let live;
try{live=await rules.getFirestoreRuleset();}catch(e){fail(`อ่าน live rules ไม่สำเร็จ: ${e.message}`);}
const file=(live.source||[]).find(f=>String(f.content||'').includes('service cloud.firestore'));
if(!file) fail('ไม่พบ Firestore source file ใน live ruleset');
const result=patch(String(file.content||''));
if(!result.changed){
  console.log(`✅ Live rules มี ${MARKER} อยู่แล้ว`);
  console.log('ให้ Logout/Login Teacher Console แล้วเลือก Production → Refresh');
  process.exit(0);
}

const work=fs.mkdtempSync(path.join(os.tmpdir(),'herohealth-teacher-rules-'));
const rulesPath=path.join(work,'firestore.rules');
const configPath=path.join(work,'firebase.json');
const backupPath=path.join(work,`firestore-live-backup-${timestamp()}.rules`);
fs.writeFileSync(backupPath,String(file.content||''),'utf8');
fs.writeFileSync(rulesPath,result.content,'utf8');
fs.writeFileSync(configPath,JSON.stringify({firestore:{rules:'firestore.rules'}},null,2),'utf8');
console.log(`✅ Backup: ${backupPath}`);
console.log(`📝 Patched: ${rulesPath}`);
console.log('🧪 Firebase CLI จะ compile ก่อน และ deploy เฉพาะ firestore:rules ...');

const npx=process.platform==='win32'?'npx.cmd':'npx';
const run=spawnSync(npx,['--yes','firebase-tools@latest','deploy','--only','firestore:rules','--project',PROJECT_ID,'--config',configPath,'--non-interactive'],{
  cwd:work,
  stdio:'inherit',
  env:{...process.env,GOOGLE_APPLICATION_CREDENTIALS:SERVICE_ACCOUNT}
});
if(run.error) fail(`เรียก Firebase CLI ไม่สำเร็จ: ${run.error.message}`);
if(run.status!==0) fail(`Teacher rules deploy ไม่สำเร็จ (exit ${run.status}) — live rules จะไม่ถูกเปลี่ยนถ้า compile ไม่ผ่าน`);
console.log('\n✅ Teacher Console Production Rules deploy สำเร็จ');
console.log('   students: teacher read');
console.log('   studentProgress: teacher read');
console.log('   studentAssessments: teacher read');
console.log('   Existing learner rules: preserved from live rules');
console.log('\nต่อไป: Logout/Login Teacher Console → Production → Refresh');
