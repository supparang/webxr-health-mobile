import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const SA_PATH=path.join(HERE,'service-account.json');
const MARKER='HEROHEALTH_P5_BINDING_PROGRESS_R8';
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function ts(){return new Date().toISOString().replace(/[:.]/g,'-');}

function p5Expr(v){
  return `${v}.size() == 5 && ${v}[0:3] in ['H51','H52','H53','H54','H55','H56']`;
}

function patchRules(source){
  if(source.includes(MARKER)) return {content:source,changed:false};
  let out=source;

  // 1) Add production UID -> student binding. There is no production binding block in the current live rules.
  const dbClose=out.lastIndexOf('}');
  if(dbClose<0) throw new Error('โครงสร้าง live rules ไม่สมบูรณ์');
  const bindingBlock=`\n\n    // ${MARKER}_BINDING\n    match /studentBindings/{uid} {\n      allow get: if request.auth != null && request.auth.uid == uid;\n      allow create, update: if request.auth != null\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && ${p5Expr('request.resource.data.studentId')};\n      allow delete: if false;\n    }\n`;
  out=`${out.slice(0,dbClose)}${bindingBlock}${out.slice(dbClose)}`;

  // 2) Modify the existing production studentProgress teacher block in place.
  const re=/match\s+\/studentProgress\/\{studentId\}\s*\{\s*allow\s+read:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.token\.heroHealthTeacher\s*==\s*true;\s*\}/m;
  const hit=out.match(re);
  if(!hit) throw new Error('ไม่พบ production match /studentProgress/{studentId} teacher block ใน live rules');

  const progressBlock=`match /studentProgress/{studentId} {\n      // Existing teacher/researcher production read access.\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n\n      // ${MARKER}_PROGRESS\n      // Learner may access only the progress document matching its current anonymous UID binding.\n      allow get: if request.auth != null\n        && ${p5Expr('studentId')}\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n\n      allow create, update: if request.auth != null\n        && ${p5Expr('studentId')}\n        && request.resource.data.studentId == studentId\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n    }`;
  out=out.replace(re,progressBlock);

  // Top-level marker makes reruns idempotent.
  out=out.replace('service cloud.firestore {',`service cloud.firestore {\n  // ${MARKER}`);
  return {content:out,changed:true};
}

async function compile(rules,label,source){
  console.log(`🧪 ${label} compile...`);
  try{
    const rs=await rules.createRuleset(rules.createRulesFileFromSource('firestore.rules',source));
    console.log(`✅ ${label} ผ่าน: ${rs.name}`);
    return rs;
  }catch(e){
    console.error(`❌ ${label} ไม่ผ่าน`);
    console.error('   code:',e?.code||'(none)');
    console.error('   details:',e?.details||e?.message||e);
    return null;
  }
}

if(!fs.existsSync(SA_PATH)) fail(`ไม่พบ ${SA_PATH}`);
const sa=JSON.parse(fs.readFileSync(SA_PATH,'utf8'));
if(sa.project_id!==PROJECT_ID) fail(`service account ต้องเป็น ${PROJECT_ID}`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const rules=getSecurityRules(app);

console.log('🔎 อ่าน live Firestore Rules...');
const live=await rules.getFirestoreRuleset();
const file=(live.source||[]).find(f=>String(f.content||'').includes('service cloud.firestore'));
if(!file) fail('ไม่พบ Firestore source');
const source=String(file.content||'');
const backup=path.join(os.tmpdir(),`herohealth-before-p5-r8-${ts()}.rules`);
fs.writeFileSync(backup,source,'utf8');
console.log(`✅ Backup: ${backup}`);
console.log(`   Live ruleset: ${live.name}`);

const baseline=await compile(rules,'Baseline',source);
if(!baseline) fail('Baseline live rules compile ไม่ผ่าน; หยุดก่อนแก้');
try{await rules.deleteRuleset(baseline.name);}catch(_){ }

let patched;
try{patched=patchRules(source);}catch(e){fail(e.message);}
if(!patched.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0);}

const staged=path.join(os.tmpdir(),`herohealth-p5-r8-${ts()}.rules`);
fs.writeFileSync(staged,patched.content,'utf8');
console.log(`📝 Staged: ${staged}`);
console.log('   Strategy: keep R7 roster access; add UID binding; modify existing progress block in place; no regex');

const candidate=await compile(rules,'R8 binding + progress patch',patched.content);
if(!candidate) fail('R8 patch compile ไม่ผ่าน; live rules ไม่เปลี่ยน');

console.log('🚀 Publish R8 binding + progress access...');
try{await rules.releaseFirestoreRuleset(candidate);}catch(e){fail(`Publish ไม่ผ่าน: ${e.message}`);}
console.log('\n✅ HeroHealth P5 Binding + Progress R8 สำเร็จ');
console.log('   R7 roster GET: คงเดิม');
console.log('   studentBindings: anonymous UID ของเครื่องสร้าง/อัปเดต binding ของตนเองได้');
console.log('   studentProgress: UID ที่ bind แล้ว GET/CREATE/UPDATE ได้เฉพาะ studentId เดียวกัน');
console.log('   Learner LIST progress: ไม่ได้เปิด');
console.log('   Assessment rules: ยังไม่ได้แก้');
console.log('\nเปิด Passport ใหม่ แล้วทดสอบ H5601 หรือ H5101');
