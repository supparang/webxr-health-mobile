import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const SA_PATH=path.join(HERE,'service-account.json');
const MARKER='HEROHEALTH_P5_BINDING_PLACEMENT_R9';
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function ts(){return new Date().toISOString().replace(/[:.]/g,'-');}
function closeBrace(s,o){let d=0,st='n';for(let i=o;i<s.length;i++){const c=s[i],n=s[i+1];if(st==='lc'){if(c==='\n')st='n';continue}if(st==='bc'){if(c==='*'&&n==='/'){st='n';i++}continue}if(st==='sq'){if(c==='\\'){i++;continue}if(c==="'")st='n';continue}if(st==='dq'){if(c==='\\'){i++;continue}if(c==='"')st='n';continue}if(c==='/'&&n==='/'){st='lc';i++;continue}if(c==='/'&&n==='*'){st='bc';i++;continue}if(c==="'"){st='sq';continue}if(c==='"'){st='dq';continue}if(c==='{')d++;if(c==='}'&&--d===0)return i}return-1}
function p5(v){return `${v}.size() == 5 && ${v}[0:3] in ['H51','H52','H53','H54','H55','H56']`;}

function patch(source){
  if(source.includes(MARKER)) return {content:source,changed:false};
  let out=source;

  // Remove the R8 studentBindings block wherever it was inserted. R8 used the
  // service-closing brace, so the block could sit outside /databases/.../documents.
  out=out.replace(/\n\s*\/\/ HEROHEALTH_P5_BINDING_PROGRESS_R8_BINDING\n\s*match \/studentBindings\/\{uid\} \{[\s\S]*?\n\s*\}\n?/m,'\n');

  // Find the actual database match and insert studentBindings immediately before
  // its closing brace. This guarantees the rule matches Firestore document paths.
  const dm=out.indexOf('match /databases/');
  if(dm<0) throw new Error('ไม่พบ match /databases/{database}/documents');
  const open=out.indexOf('{',dm);
  const dbClose=closeBrace(out,open);
  if(open<0||dbClose<0) throw new Error('หา database closing brace ไม่สำเร็จ');

  const binding=`\n\n    // ${MARKER}\n    match /studentBindings/{uid} {\n      allow get: if request.auth != null && request.auth.uid == uid;\n      allow create, update: if request.auth != null\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && ${p5('request.resource.data.studentId')};\n      allow delete: if false;\n    }\n`;
  out=`${out.slice(0,dbClose)}${binding}${out.slice(dbClose)}`;
  return {content:out,changed:true};
}

async function compile(rules,label,source){
  console.log(`🧪 ${label} compile...`);
  try{const rs=await rules.createRuleset(rules.createRulesFileFromSource('firestore.rules',source));console.log(`✅ ${label} ผ่าน: ${rs.name}`);return rs;}
  catch(e){console.error(`❌ ${label} ไม่ผ่าน`);console.error('   code:',e?.code||'(none)');console.error('   details:',e?.details||e?.message||e);return null;}
}

if(!fs.existsSync(SA_PATH))fail(`ไม่พบ ${SA_PATH}`);
const sa=JSON.parse(fs.readFileSync(SA_PATH,'utf8'));if(sa.project_id!==PROJECT_ID)fail(`service account ต้องเป็น ${PROJECT_ID}`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const rules=getSecurityRules(app);
console.log('🔎 อ่าน live Firestore Rules...');
const live=await rules.getFirestoreRuleset();
const file=(live.source||[]).find(f=>String(f.content||'').includes('service cloud.firestore'));if(!file)fail('ไม่พบ Firestore source');
const source=String(file.content||'');
const backup=path.join(os.tmpdir(),`herohealth-before-p5-r9-${ts()}.rules`);fs.writeFileSync(backup,source,'utf8');
console.log(`✅ Backup: ${backup}`);console.log(`   Live ruleset: ${live.name}`);

const base=await compile(rules,'Baseline',source);if(!base)fail('Baseline live rules compile ไม่ผ่าน');try{await rules.deleteRuleset(base.name)}catch(_){ }
let patched;try{patched=patch(source)}catch(e){fail(e.message)}
if(!patched.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0)}
const staged=path.join(os.tmpdir(),`herohealth-p5-r9-${ts()}.rules`);fs.writeFileSync(staged,patched.content,'utf8');
console.log(`📝 Staged: ${staged}`);
console.log('   Strategy: move studentBindings inside /databases/{database}/documents; preserve R7 roster + R8 progress');
const candidate=await compile(rules,'R9 binding placement patch',patched.content);if(!candidate)fail('R9 compile ไม่ผ่าน; live rules ไม่เปลี่ยน');
console.log('🚀 Publish R9 binding placement...');
try{await rules.releaseFirestoreRuleset(candidate)}catch(e){fail(`Publish ไม่ผ่าน: ${e.message}`)}
console.log('\n✅ HeroHealth P5 Binding Placement R9 สำเร็จ');
console.log('   R7 roster GET: คงเดิม');
console.log('   studentBindings: อยู่ภายใน database documents match แล้ว');
console.log('   R8 studentProgress: คงเดิม');
console.log('   Assessment: ยังไม่แก้');
console.log('\nเปิด Passport ใหม่ แล้วทดสอบ H5601');
