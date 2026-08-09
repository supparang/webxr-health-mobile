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
const MARKER = 'HEROHEALTH_TEACHER_PRODUCTION_R3';

function fail(message){ console.error(`\n❌ ${message}\n`); process.exit(1); }
function timestamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

function injectTeacherRead(source, collection){
  const re = new RegExp(`match\\s+/${collection}/\\{[^}]+\\}\\s*\\{`);
  const match = re.exec(source);
  if(!match) throw new Error(`ไม่พบ match /${collection}/{...} ใน live rules — หยุดเพื่อไม่แก้โครงสร้างเดิมแบบเดา`);
  const insertAt = match.index + match[0].length;
  const marker = `// ${MARKER}_${collection}`;
  if(source.includes(marker)) return source;
  const rule = `\n      ${marker}\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;`;
  return `${source.slice(0,insertAt)}${rule}${source.slice(insertAt)}`;
}

function patch(source){
  if(source.includes(`// ${MARKER}_students`) &&
     source.includes(`// ${MARKER}_studentProgress`) &&
     source.includes(`// ${MARKER}_studentAssessments`)) {
    return {content:source,changed:false};
  }

  // R3 deliberately does NOT add new match blocks and does NOT move braces.
  // It only appends one read-only allow statement inside the three existing
  // Production collection matches. This preserves all learner write rules verbatim.
  let content = source;
  content = injectTeacherRead(content,'students');
  content = injectTeacherRead(content,'studentProgress');
  content = injectTeacherRead(content,'studentAssessments');
  return {content,changed:content!==source};
}

function preview(source){
  const lines=source.split(/\r?\n/);
  const interesting=[];
  lines.forEach((line,i)=>{
    if(line.includes(MARKER)){
      const from=Math.max(0,i-2),to=Math.min(lines.length,i+4);
      for(let n=from;n<to;n++) interesting.push(`${String(n+1).padStart(4,' ')} | ${lines[n]}`);
      interesting.push('----');
    }
  });
  return interesting.join('\n');
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

const liveSource=String(file.content||'');
let result;
try{result=patch(liveSource);}catch(e){fail(`สร้าง teacher patch ไม่สำเร็จ: ${e.message}`);}
if(!result.changed){
  console.log(`✅ Live rules มี ${MARKER} ครบแล้ว`);
  console.log('ให้ Logout/Login Teacher Console แล้วเลือก Production → Refresh');
  process.exit(0);
}

const work=fs.mkdtempSync(path.join(os.tmpdir(),'herohealth-teacher-rules-'));
const rulesPath=path.join(work,'firestore.rules');
const configPath=path.join(work,'firebase.json');
const backupPath=path.join(work,`firestore-live-backup-${timestamp()}.rules`);
fs.writeFileSync(backupPath,liveSource,'utf8');
fs.writeFileSync(rulesPath,result.content,'utf8');
fs.writeFileSync(configPath,JSON.stringify({firestore:{rules:'firestore.rules'}},null,2),'utf8');
console.log(`✅ Backup: ${backupPath}`);
console.log(`📝 Patched: ${rulesPath}`);
console.log('🔍 Preview จุดที่เพิ่ม Teacher read:');
console.log(preview(result.content));
console.log('🧪 Firebase CLI จะ compile ก่อน และ deploy เฉพาะ firestore:rules ...');

const npx=process.platform==='win32'?'npx.cmd':'npx';
const cliEnv={...process.env};
delete cliEnv.GOOGLE_APPLICATION_CREDENTIALS;

const run=spawnSync(npx,['--yes','firebase-tools@latest','deploy','--only','firestore:rules','--project',PROJECT_ID,'--config',configPath,'--non-interactive'],{
  cwd:work,
  stdio:'inherit',
  env:cliEnv
});
if(run.error) fail(`เรียก Firebase CLI ไม่สำเร็จ: ${run.error.message}`);
if(run.status!==0) fail(`Teacher rules deploy ไม่สำเร็จ (exit ${run.status}) — live rules ไม่ถูกเปลี่ยนเพราะ compile/deploy ไม่ผ่าน`);

console.log('\n✅ Teacher Console Production Rules deploy สำเร็จ');
console.log('   students: teacher read');
console.log('   studentProgress: teacher read');
console.log('   studentAssessments: teacher read');
console.log('   Existing learner rules: preserved verbatim');
console.log('\nต่อไป: Logout/Login Teacher Console → Production → Refresh');