import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const SA_PATH=path.join(HERE,'service-account.json');
const MARKER='HEROHEALTH_P5_ROSTER_ACCESS_R6';
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function ts(){return new Date().toISOString().replace(/[:.]/g,'-');}
function closeBrace(s,o){let d=0,st='n';for(let i=o;i<s.length;i++){let c=s[i],n=s[i+1];if(st==='lc'){if(c==='\n')st='n';continue}if(st==='bc'){if(c==='*'&&n==='/'){st='n';i++}continue}if(st==='sq'){if(c==='\\'){i++;continue}if(c==="'")st='n';continue}if(st==='dq'){if(c==='\\'){i++;continue}if(c==='"')st='n';continue}if(c==='/'&&n==='/'){st='lc';i++;continue}if(c==='/'&&n==='*'){st='bc';i++;continue}if(c==="'"){st='sq';continue}if(c==='"'){st='dq';continue}if(c==='{')d++;if(c==='}'&&--d===0)return i}return-1}
function patch(source){
  if(source.includes(`${MARKER}_BEGIN`))return{content:source,changed:false};
  // Remove any staged older P5 blocks if present in a future live source.
  const clean=source.replace(/\n\s*\/\/ HEROHEALTH_P5_(?:PRODUCTION_LEARNER_ACCESS_R[1-5]|ROSTER_ACCESS_R[1-5])_BEGIN[\s\S]*?\/\/ HEROHEALTH_P5_(?:PRODUCTION_LEARNER_ACCESS_R[1-5]|ROSTER_ACCESS_R[1-5])_END\n?/g,'\n');
  const m=clean.indexOf('match /databases/'); if(m<0)throw new Error('ไม่พบ database match');
  const o=clean.indexOf('{',m),c=closeBrace(clean,o); if(o<0||c<0)throw new Error('database match ไม่สมบูรณ์');
  // Deliberately minimal. Existing importer created only H51xx-H56xx production roster IDs.
  // This rule only permits authenticated Firebase clients to GET a single matching roster document.
  // It does not permit list/query, create, update, or delete.
  const block=`\n\n    // ${MARKER}_BEGIN\n    match /students/{studentId} {\n      allow get: if request.auth != null && studentId.matches('H5[1-6][0-9][0-9]');\n    }\n    // ${MARKER}_END\n`;
  return{content:`${clean.slice(0,c)}${block}${clean.slice(c)}`,changed:true};
}
if(!fs.existsSync(SA_PATH))fail(`ไม่พบ ${SA_PATH}`);
const sa=JSON.parse(fs.readFileSync(SA_PATH,'utf8'));if(sa.project_id!==PROJECT_ID)fail(`service account ต้องเป็น ${PROJECT_ID}`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const rules=getSecurityRules(app);
console.log('🔎 อ่าน live Firestore Rules...');
const live=await rules.getFirestoreRuleset();
const file=(live.source||[]).find(f=>String(f.content||'').includes('service cloud.firestore'));if(!file)fail('ไม่พบ Firestore source');
const source=String(file.content||'');
const backup=path.join(os.tmpdir(),`herohealth-before-p5-r6-${ts()}.rules`);fs.writeFileSync(backup,source,'utf8');
console.log(`✅ Backup: ${backup}`);console.log(`   Live ruleset: ${live.name}`);
console.log('🧪 Baseline compile...');
let base;try{base=await rules.createRuleset(rules.createRulesFileFromSource('firestore.rules',source));console.log(`✅ Baseline ผ่าน: ${base.name}`);try{await rules.deleteRuleset(base.name)}catch{}}catch(e){fail(`Baseline compile ไม่ผ่าน: ${e.message}`)}
const p=patch(source);if(!p.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0)}
const staged=path.join(os.tmpdir(),`herohealth-p5-r6-${ts()}.rules`);fs.writeFileSync(staged,p.content,'utf8');
console.log(`📝 Staged: ${staged}`);console.log('🧪 Minimal roster patch compile...');
let created;try{created=await rules.createRuleset(rules.createRulesFileFromSource('firestore.rules',p.content));console.log(`✅ P5 roster patch compile ผ่าน: ${created.name}`)}catch(e){console.error('code:',e?.code);console.error('details:',e?.details||e?.message);fail('Minimal roster patch ยัง compile ไม่ผ่าน; live rules ไม่เปลี่ยน')}
console.log('🚀 Publish minimal roster access...');
try{await rules.releaseFirestoreRuleset(created)}catch(e){fail(`Publish ไม่ผ่าน: ${e.message}`)}
console.log('\n✅ HeroHealth P5 Roster Access R6 สำเร็จ');
console.log('   H51xx-H56xx: authenticated GET students/{studentId}');
console.log('   LIST/WRITE roster: ไม่ได้เปิด');
console.log('   ขั้นนี้แก้เฉพาะ Login lookup ก่อน; progress rules เดิมไม่ถูกแก้');
console.log('\nเปิด Passport ใหม่ แล้วทดสอบ H5101');
