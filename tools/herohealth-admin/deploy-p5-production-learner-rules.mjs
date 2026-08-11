import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const SA_PATH=path.join(HERE,'service-account.json');
const MARKER='HEROHEALTH_P5_ROSTER_ACCESS_R7';
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function ts(){return new Date().toISOString().replace(/[:.]/g,'-');}

function patchExistingStudentsRule(source){
  if(source.includes(MARKER)) return {content:source,changed:false};

  // Do NOT add another overlapping match block. Modify the existing production
  // /students/{studentId} teacher-readable block in place.
  const re=/match\s+\/students\/\{studentId\}\s*\{\s*allow\s+read:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.token\.heroHealthTeacher\s*==\s*true;\s*\}/m;
  const hit=source.match(re);
  if(!hit) throw new Error('ไม่พบ production match /students/{studentId} teacher block ที่คาดไว้ใน live rules');

  const replacement=`match /students/{studentId} {
      // Existing teacher/researcher production read access.
      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;

      // ${MARKER}
      // Learner login: single-document GET only. No collection LIST and no roster WRITE.
      // HeroHealth production login IDs are five characters: H51xx-H56xx.
      allow get: if request.auth != null
        && studentId.size() == 5
        && studentId[0:3] in ['H51','H52','H53','H54','H55','H56'];
    }`;

  return {content:source.replace(re,replacement),changed:true};
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
const backup=path.join(os.tmpdir(),`herohealth-before-p5-r7-${ts()}.rules`);
fs.writeFileSync(backup,source,'utf8');
console.log(`✅ Backup: ${backup}`);
console.log(`   Live ruleset: ${live.name}`);

const baseline=await compile(rules,'Baseline',source);
if(!baseline) fail('Baseline live rules compile ไม่ผ่าน; หยุดก่อนแก้');
try{await rules.deleteRuleset(baseline.name);}catch(_){ }

let patched;
try{patched=patchExistingStudentsRule(source);}catch(e){fail(e.message);}
if(!patched.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0);}

const staged=path.join(os.tmpdir(),`herohealth-p5-r7-${ts()}.rules`);
fs.writeFileSync(staged,patched.content,'utf8');
console.log(`📝 Staged: ${staged}`);
console.log('   Strategy: modify existing /students/{studentId} block in place; no duplicate match; no regex');

const candidate=await compile(rules,'R7 in-place roster patch',patched.content);
if(!candidate) fail('R7 patch ยัง compile ไม่ผ่าน; live rules ไม่เปลี่ยน');

console.log('🚀 Publish R7 roster access...');
try{await rules.releaseFirestoreRuleset(candidate);}catch(e){fail(`Publish ไม่ผ่าน: ${e.message}`);}
console.log('\n✅ HeroHealth P5 Roster Access R7 สำเร็จ');
console.log('   Teacher production read: คงเดิม');
console.log('   Learner: authenticated single-document GET สำหรับ H51xx-H56xx');
console.log('   Learner LIST/WRITE roster: ไม่ได้เปิด');
console.log('   Progress/assessment rules: ยังไม่แก้ในรอบนี้');
console.log('\nเปิด Passport ใหม่ แล้วทดสอบ H5101');
