import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const MARKER = 'HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R5';

function argValue(name){const p=`--${name}=`;const h=process.argv.find(v=>v.startsWith(p));return h?h.slice(p.length):'';}
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function timestamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
function findMatchingBrace(s,o){let d=0,st='normal';for(let i=o;i<s.length;i++){const c=s[i],n=s[i+1];if(st==='line'){if(c==='\n')st='normal';continue;}if(st==='block'){if(c==='*'&&n==='/'){st='normal';i++;}continue;}if(st==='single'){if(c==='\\'){i++;continue;}if(c==="'")st='normal';continue;}if(st==='double'){if(c==='\\'){i++;continue;}if(c==='"')st='normal';continue;}if(c==='/'&&n==='/'){st='line';i++;continue;}if(c==='/'&&n==='*'){st='block';i++;continue;}if(c==="'"){st='single';continue;}if(c==='"'){st='double';continue;}if(c==='{')d++;if(c==='}'){d--;if(d===0)return i;}}return -1;}

function additivePatch(){return `\n\n    // ${MARKER}_BEGIN\n    match /students/{studentId} {\n      allow get: if request.auth != null\n        && studentId.matches('H5[1-6][0-9][0-9]')\n        && resource.data.active != false;\n    }\n\n    match /studentBindings/{uid} {\n      allow get: if request.auth != null && request.auth.uid == uid;\n      allow create, update: if request.auth != null\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && request.resource.data.studentId.matches('H5[1-6][0-9][0-9]');\n    }\n\n    match /studentProgress/{studentId} {\n      allow get: if request.auth != null\n        && studentId.matches('H5[1-6][0-9][0-9]')\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n      allow create, update: if request.auth != null\n        && studentId.matches('H5[1-6][0-9][0-9]')\n        && request.resource.data.studentId == studentId\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n    }\n\n    match /studentAssessments/{documentId} {\n      allow get: if request.auth != null\n        && resource.data.studentId.matches('H5[1-6][0-9][0-9]')\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == resource.data.studentId;\n      allow create, update: if request.auth != null\n        && request.resource.data.studentId.matches('H5[1-6][0-9][0-9]')\n        && request.resource.data.completed == true\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == request.resource.data.studentId;\n    }\n    // ${MARKER}_END\n`;}

function patchFirestoreSource(source){
  if(source.includes(`${MARKER}_BEGIN`)) return {content:source,changed:false};
  const clean=source.replace(/\n\s*\/\/ HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R[1-4]_BEGIN[\s\S]*?\/\/ HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R[1-4]_END\n?/g,'\n');
  const m=clean.indexOf('match /databases/');
  if(m<0) throw new Error('ไม่พบ database match');
  const o=clean.indexOf('{',m),c=findMatchingBrace(clean,o);
  if(o<0||c<0) throw new Error('โครงสร้าง database match ไม่สมบูรณ์');
  return {content:`${clean.slice(0,c)}${additivePatch()}${clean.slice(c)}`,changed:true};
}

async function compileOnly(securityRules, label, source){
  console.log(`🧪 Compile test: ${label} ...`);
  let rs;
  try {
    const rf=securityRules.createRulesFileFromSource('firestore.rules',source);
    rs=await securityRules.createRuleset(rf);
    console.log(`✅ ${label} compile ผ่าน: ${rs.name}`);
    try { await securityRules.deleteRuleset(rs.name); console.log(`🧹 ลบ diagnostic ruleset แล้ว: ${rs.name}`); }
    catch(e){ console.warn(`⚠️ ลบ diagnostic ruleset ไม่สำเร็จ: ${e.message}`); }
    return true;
  } catch(e) {
    console.error(`❌ ${label} compile ไม่ผ่าน`);
    console.error('   code:',e?.code||'(none)');
    console.error('   details:',e?.details||e?.message||e);
    return false;
  }
}

const serviceAccountPath=path.resolve(argValue('service-account')||DEFAULT_SERVICE_ACCOUNT);
if(!fs.existsSync(serviceAccountPath)) fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
let sa;try{sa=JSON.parse(fs.readFileSync(serviceAccountPath,'utf8'));}catch(e){fail(`อ่าน Service Account ไม่สำเร็จ: ${e.message}`);}if(sa.project_id!==PROJECT_ID)fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const securityRules=getSecurityRules(app);

console.log('🔎 อ่าน Firestore Rules ที่ใช้งานจริง...');
let live;try{live=await securityRules.getFirestoreRuleset();}catch(e){fail(`อ่าน live rules ไม่สำเร็จ: ${e.message}`);}
const files=Array.isArray(live?.source)?live.source:[];
console.log(`📄 Live source files: ${files.length}`);
files.forEach((f,i)=>console.log(`   ${i+1}. ${f.name || '(no name)'} • ${Buffer.byteLength(String(f.content||''),'utf8')} bytes`));
const ff=files.find(f=>String(f?.content||'').includes('service cloud.firestore'));
if(!ff) fail('live ruleset ไม่มี Firestore source');
const liveContent=String(ff.content||'');
const backup=path.join(os.tmpdir(),`herohealth-firestore-before-p5-${timestamp()}.rules`);
fs.writeFileSync(backup,liveContent,'utf8');
console.log(`✅ Backup: ${backup}`);
console.log(`   Current ruleset: ${live.name}`);

const baselineOk=await compileOnly(securityRules,'BASELINE live rules เดิม',liveContent);
if(!baselineOk){
  fail('หยุดก่อน deploy: live rules เดิมที่ดึงผ่าน Admin SDK ยัง compile กลับไม่ได้ จึงไม่ควร patch ต่อ');
}

let patched;try{patched=patchFirestoreSource(liveContent);}catch(e){fail(e.message);}
if(!patched.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0);}
const staged=path.join(os.tmpdir(),`herohealth-firestore-p5-production-${timestamp()}.rules`);
fs.writeFileSync(staged,patched.content,'utf8');
console.log(`📝 Staged: ${staged}`);
console.log(`📏 Patched source: ${Buffer.byteLength(patched.content,'utf8')} bytes`);

const patchedOk=await compileOnly(securityRules,'PATCHED P5 rules',patched.content);
if(!patchedOk){
  fail('ยืนยันแล้วว่า live rules เดิม compile ผ่าน แต่ P5 patch compile ไม่ผ่าน; ยังไม่ได้เปลี่ยน live rules');
}

console.log('🚀 Compile ผ่านทั้ง baseline และ patch → กำลัง release patch ...');
let released;
try{released=await securityRules.releaseFirestoreRulesetFromSource(patched.content);}catch(e){console.error('   code:',e?.code||'(none)');console.error('   details:',e?.details||e?.message||e);fail(`Release ล้มเหลว; live rules เดิมยังอยู่: ${e.message}`);}
console.log('\n✅ HeroHealth P5 Production Learner Rules R5 สำเร็จ');
console.log(`   Released ruleset: ${released.name}`);
console.log('   Learner IDs: H51xx-H56xx');
console.log('   students GET + UID-bound progress/assessment');
