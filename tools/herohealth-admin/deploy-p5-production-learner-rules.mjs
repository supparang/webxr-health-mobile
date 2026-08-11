import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const MARKER = 'HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R4';

function argValue(name){const p=`--${name}=`;const h=process.argv.find(v=>v.startsWith(p));return h?h.slice(p.length):'';}
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function timestamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
function findMatchingBrace(s,o){let d=0,st='normal';for(let i=o;i<s.length;i++){const c=s[i],n=s[i+1];if(st==='line'){if(c==='\n')st='normal';continue;}if(st==='block'){if(c==='*'&&n==='/'){st='normal';i++;}continue;}if(st==='single'){if(c==='\\'){i++;continue;}if(c==="'")st='normal';continue;}if(st==='double'){if(c==='\\'){i++;continue;}if(c==='"')st='normal';continue;}if(c==='/'&&n==='/'){st='line';i++;continue;}if(c==='/'&&n==='*'){st='block';i++;continue;}if(c==="'"){st='single';continue;}if(c==='"'){st='double';continue;}if(c==='{')d++;if(c==='}'){d--;if(d===0)return i;}}return -1;}

function additivePatch(){return `\n\n    // ${MARKER}_BEGIN\n    match /students/{studentId} {\n      allow get: if request.auth != null && studentId.matches('^H5[1-6][0-9][0-9]$') && resource.data.active != false;\n    }\n    match /studentBindings/{uid} {\n      allow get: if request.auth != null && request.auth.uid == uid;\n      allow create, update: if request.auth != null && request.auth.uid == uid && request.resource.data.uid == request.auth.uid && request.resource.data.studentId.matches('^H5[1-6][0-9][0-9]$');\n    }\n    match /studentProgress/{studentId} {\n      allow get: if request.auth != null && studentId.matches('^H5[1-6][0-9][0-9]$') && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid)) && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n      allow create, update: if request.auth != null && studentId.matches('^H5[1-6][0-9][0-9]$') && request.resource.data.studentId == studentId && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid)) && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n    }\n    match /studentAssessments/{documentId} {\n      allow get: if request.auth != null && resource.data.studentId.matches('^H5[1-6][0-9][0-9]$') && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid)) && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == resource.data.studentId;\n      allow create, update: if request.auth != null && request.resource.data.studentId.matches('^H5[1-6][0-9][0-9]$') && request.resource.data.completed == true && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid)) && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == request.resource.data.studentId;\n    }\n    // ${MARKER}_END\n`;}

function patchFirestoreSource(source){
  if(source.includes(`${MARKER}_BEGIN`)) return {content:source,changed:false};
  const clean=source.replace(/\n\s*\/\/ HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R[1-3]_BEGIN[\s\S]*?\/\/ HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R[1-3]_END\n?/g,'\n');
  const m=clean.indexOf('match /databases/'); if(m<0) throw new Error('ไม่พบ database match');
  const o=clean.indexOf('{',m), c=findMatchingBrace(clean,o); if(o<0||c<0) throw new Error('โครงสร้าง database match ไม่สมบูรณ์');
  return {content:`${clean.slice(0,c)}${additivePatch()}${clean.slice(c)}`,changed:true};
}

const serviceAccountPath=path.resolve(argValue('service-account')||DEFAULT_SERVICE_ACCOUNT);
if(!fs.existsSync(serviceAccountPath)) fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
let sa; try{sa=JSON.parse(fs.readFileSync(serviceAccountPath,'utf8'));}catch(e){fail(`อ่าน Service Account ไม่สำเร็จ: ${e.message}`);}
if(sa.project_id!==PROJECT_ID) fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const securityRules=getSecurityRules(app);

console.log('🔎 อ่าน Firestore Rules ที่ใช้งานจริง...');
let live; try{live=await securityRules.getFirestoreRuleset();}catch(e){fail(`อ่าน live rules ไม่สำเร็จ: ${e.message}`);}
const files=Array.isArray(live?.source)?live.source:[];
const ff=files.find(f=>String(f?.content||'').includes('service cloud.firestore'));
if(!ff) fail('live ruleset ไม่มี Firestore source');
const content=String(ff.content||'');
const backup=path.join(os.tmpdir(),`herohealth-firestore-before-p5-${timestamp()}.rules`);
fs.writeFileSync(backup,content,'utf8');
console.log(`✅ Backup: ${backup}`);
console.log(`   Current ruleset: ${live.name}`);

let patched; try{patched=patchFirestoreSource(content);}catch(e){fail(e.message);}
if(!patched.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0);}
const staged=path.join(os.tmpdir(),`herohealth-firestore-p5-production-${timestamp()}.rules`);
fs.writeFileSync(staged,patched.content,'utf8');
const bytes=Buffer.byteLength(patched.content,'utf8');
console.log(`📝 Staged: ${staged}`);
console.log(`📏 Rules source size: ${bytes} bytes (${(bytes/1024).toFixed(1)} KiB)`);
if(bytes>=256*1024) fail('Rules source เกิน 256 KiB จึง deploy ไม่ได้');

try{
  const page=await securityRules.listRulesetMetadata(100);
  console.log(`📚 Rulesets returned in first page: ${page.rulesets?.length||0}${page.nextPageToken?' + more':''}`);
}catch(e){console.warn('⚠️ นับ rulesets ไม่สำเร็จ:',e?.message||e);}

console.log('🚀 Direct release ด้วย releaseFirestoreRulesetFromSource() ...');
let released;
try{
  released=await securityRules.releaseFirestoreRulesetFromSource(patched.content);
}catch(e){
  console.error('   Firebase error code:',e?.code||'(none)');
  console.error('   Firebase error details:',e?.details||e?.message||e);
  fail(`Direct release ล้มเหลว; live rules เดิมยังอยู่: ${e.message}`);
}

console.log('\n✅ HeroHealth P5 Production Learner Rules R4 สำเร็จ');
console.log(`   Previous: ${live.name}`);
console.log(`   Current:  ${released.name}`);
console.log('   Learner IDs: H51xx-H56xx');
console.log('   students GET + UID-bound progress/assessment');
