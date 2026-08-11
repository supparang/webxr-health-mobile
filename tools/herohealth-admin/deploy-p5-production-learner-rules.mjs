import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const SA_PATH=path.join(HERE,'service-account.json');
const MARKER='HEROHEALTH_P5_BINDING_PLACEMENT_R10';
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function ts(){return new Date().toISOString().replace(/[:.]/g,'-');}
function closeBrace(s,o){let d=0,st='n';for(let i=o;i<s.length;i++){const c=s[i],n=s[i+1];if(st==='lc'){if(c==='\n')st='n';continue}if(st==='bc'){if(c==='*'&&n==='/'){st='n';i++}continue}if(st==='sq'){if(c==='\\'){i++;continue}if(c==="'")st='n';continue}if(st==='dq'){if(c==='\\'){i++;continue}if(c==='"')st='n';continue}if(c==='/'&&n==='/'){st='lc';i++;continue}if(c==='/'&&n==='*'){st='bc';i++;continue}if(c==="'"){st='sq';continue}if(c==='"'){st='dq';continue}if(c==='{')d++;if(c==='}'&&--d===0)return i}return-1}
function p5(v){return `${v}.size() == 5 && ${v}[0:3] in ['H51','H52','H53','H54','H55','H56']`;}

function patch(source){
  if(source.includes(MARKER)) return {content:source,changed:false};
  let out=source;

  // Remove the misplaced R8 binding block (R8 placed it at service scope).
  out=out.replace(/\n\s*\/\/ HEROHEALTH_P5_BINDING_PROGRESS_R8_BINDING\n\s*match \/studentBindings\/\{uid\} \{[\s\S]*?\n\s*\}\n?/m,'\n');

  // IMPORTANT: do not use the first "{" after "match /databases/" because that
  // is the wildcard brace in {database}. Find the block-opening brace only AFTER
  // the literal /documents segment.
  const dm=out.indexOf('match /databases/');
  if(dm<0) throw new Error('ไม่พบ match /databases/{database}/documents');
  const documentsPos=out.indexOf('/documents',dm);
  if(documentsPos<0) throw new Error('ไม่พบ /documents ใน database match');
  const open=out.indexOf('{',documentsPos + '/documents'.length);
  if(open<0) throw new Error('ไม่พบ block-opening brace หลัง /documents');
  const dbClose=closeBrace(out,open);
  if(dbClose<0) throw new Error('หา database closing brace ไม่สำเร็จ');

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
const backup=path.join(os.tmpdir(),`herohealth-before-p5-r10-${ts()}.rules`);fs.writeFileSync(backup,source,'utf8');
console.log(`✅ Backup: ${backup}`);console.log(`   Live ruleset: ${live.name}`);
const base=await compile(rules,'Baseline',source);if(!base)fail('Baseline live rules compile ไม่ผ่าน');try{await rules.deleteRuleset(base.name)}catch(_){ }
let patched;try{patched=patch(source)}catch(e){fail(e.message)}
if(!patched.changed){console.log(`✅ ${MARKER} มีอยู่แล้ว`);process.exit(0)}
const staged=path.join(HERE,'p5-r10-staged.rules');fs.writeFileSync(staged,patched.content,'utf8');
console.log(`📝 Staged (เก็บไว้ในโฟลเดอร์นี้): ${staged}`);
console.log('   Strategy: remove misplaced R8 binding; locate database block brace AFTER /documents; insert binding inside database match');
const candidate=await compile(rules,'R10 binding placement patch',patched.content);if(!candidate)fail(`R10 compile ไม่ผ่าน; live rules ไม่เปลี่ยน\nตรวจ staged ได้ที่ ${staged}`);
console.log('🚀 Publish R10 binding placement...');
try{await rules.releaseFirestoreRuleset(candidate)}catch(e){fail(`Publish ไม่ผ่าน: ${e.message}`)}
console.log('\n✅ HeroHealth P5 Binding Placement R10 สำเร็จ');
console.log('   R7 roster GET: คงเดิม');
console.log('   R8 studentProgress: คงเดิม');
console.log('   studentBindings: อยู่ภายใน /databases/{database}/documents ถูกตำแหน่งแล้ว');
console.log('   Assessment: ยังไม่แก้');
console.log('\nเปิด Passport ใหม่ แล้วทดสอบ H5601');
