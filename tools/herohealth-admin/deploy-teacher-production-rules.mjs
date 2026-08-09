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
const MARKER = 'HEROHEALTH_TEACHER_PRODUCTION_R4';

function fail(message){ console.error(`\n❌ ${message}\n`); process.exit(1); }
function timestamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

function findMatchingBrace(source, openIndex){
  let depth = 0;
  let state = 'normal';
  for(let i = openIndex; i < source.length; i++){
    const ch = source[i], next = source[i+1];
    if(state === 'line'){ if(ch === '\n') state = 'normal'; continue; }
    if(state === 'block'){ if(ch === '*' && next === '/'){ state = 'normal'; i++; } continue; }
    if(state === 'single'){ if(ch === '\\'){ i++; continue; } if(ch === "'") state = 'normal'; continue; }
    if(state === 'double'){ if(ch === '\\'){ i++; continue; } if(ch === '"') state = 'normal'; continue; }
    if(ch === '/' && next === '/'){ state = 'line'; i++; continue; }
    if(ch === '/' && next === '*'){ state = 'block'; i++; continue; }
    if(ch === "'"){ state = 'single'; continue; }
    if(ch === '"'){ state = 'double'; continue; }
    if(ch === '{') depth++;
    if(ch === '}'){
      depth--;
      if(depth === 0) return i;
    }
  }
  return -1;
}

function locateDatabaseDocumentsBlock(source){
  // Important: locate the block-opening brace AFTER /documents.
  // Do not mistake the wildcard brace in {database} for the block brace.
  const re = /match\s+\/databases\/\{[^}]+\}\/documents\s*\{/m;
  const m = re.exec(source);
  if(!m) throw new Error('ไม่พบ match /databases/{database}/documents { ใน live rules');
  const open = m.index + m[0].lastIndexOf('{');
  const close = findMatchingBrace(source, open);
  if(close < 0) throw new Error('หา closing brace ของ database documents block ไม่สำเร็จ');
  return { open, close };
}

function patch(source){
  if(source.includes(`${MARKER}_BEGIN`)) return { content: source, changed: false };

  const { close } = locateDatabaseDocumentsBlock(source);
  const add = `\n\n    // ${MARKER}_BEGIN\n    // Additive, read-only Teacher Console access. Existing learner rules remain untouched.\n    match /students/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n\n    match /studentProgress/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n\n    match /studentAssessments/{documentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    // ${MARKER}_END\n`;

  return {
    content: `${source.slice(0, close)}${add}${source.slice(close)}`,
    changed: true
  };
}

function preview(source){
  const lines = source.split(/\r?\n/);
  const idx = lines.findIndex(line => line.includes(`${MARKER}_BEGIN`));
  if(idx < 0) return '(ไม่พบ marker ใน preview)';
  const from = Math.max(0, idx - 3);
  const to = Math.min(lines.length, idx + 19);
  return lines.slice(from, to).map((line, i) => `${String(from+i+1).padStart(4,' ')} | ${line}`).join('\n');
}

if(!fs.existsSync(SERVICE_ACCOUNT)) fail(`ไม่พบ ${SERVICE_ACCOUNT}`);
let key;
try{ key = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT,'utf8')); }
catch(e){ fail(`อ่าน service-account.json ไม่สำเร็จ: ${e.message}`); }
if(key.project_id !== PROJECT_ID) fail(`Service Account project ต้องเป็น ${PROJECT_ID}`);

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(key), projectId: PROJECT_ID });
const rules = getSecurityRules(app);

console.log('🔎 อ่าน Firestore Rules ที่ใช้งานจริง...');
let live;
try{ live = await rules.getFirestoreRuleset(); }
catch(e){ fail(`อ่าน live rules ไม่สำเร็จ: ${e.message}`); }

const file = (live.source || []).find(f => String(f.content || '').includes('service cloud.firestore'));
if(!file) fail('ไม่พบ Firestore source file ใน live ruleset');

const liveSource = String(file.content || '');
let result;
try{ result = patch(liveSource); }
catch(e){ fail(`สร้าง teacher patch ไม่สำเร็จ: ${e.message}`); }

if(!result.changed){
  console.log(`✅ Live rules มี ${MARKER} อยู่แล้ว`);
  console.log('ให้ Logout/Login Teacher Console แล้วเลือก Production → Refresh');
  process.exit(0);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(),'herohealth-teacher-rules-'));
const rulesPath = path.join(work,'firestore.rules');
const configPath = path.join(work,'firebase.json');
const backupPath = path.join(work,`firestore-live-backup-${timestamp()}.rules`);
fs.writeFileSync(backupPath, liveSource, 'utf8');
fs.writeFileSync(rulesPath, result.content, 'utf8');
fs.writeFileSync(configPath, JSON.stringify({ firestore: { rules: 'firestore.rules' } }, null, 2), 'utf8');

console.log(`✅ Backup: ${backupPath}`);
console.log(`📝 Patched: ${rulesPath}`);
console.log('🔍 Preview block ที่จะเพิ่ม:');
console.log(preview(result.content));
console.log('🧪 Firebase CLI จะ compile ก่อน และ deploy เฉพาะ firestore:rules ...');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cliEnv = { ...process.env };
delete cliEnv.GOOGLE_APPLICATION_CREDENTIALS;

const run = spawnSync(npx, [
  '--yes','firebase-tools@latest','deploy',
  '--only','firestore:rules',
  '--project',PROJECT_ID,
  '--config',configPath,
  '--non-interactive'
], {
  cwd: work,
  stdio: 'inherit',
  env: cliEnv
});

if(run.error) fail(`เรียก Firebase CLI ไม่สำเร็จ: ${run.error.message}`);
if(run.status !== 0) fail(`Teacher rules deploy ไม่สำเร็จ (exit ${run.status}) — live rules ไม่ถูกเปลี่ยนเพราะ compile/deploy ไม่ผ่าน`);

console.log('\n✅ Teacher Console Production Rules deploy สำเร็จ');
console.log('   students: teacher read');
console.log('   studentProgress: teacher read');
console.log('   studentAssessments: teacher read');
console.log('   Existing learner rules: preserved');
console.log('\nต่อไป: Logout/Login Teacher Console → Production → Refresh');
