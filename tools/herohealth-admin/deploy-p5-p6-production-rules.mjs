import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const CLEAN_RULES_PATH = path.join(HERE, 'firestore.production.clean-r11.rules');
const RELEASE = 'HEROHEALTH_CLEAN_PRODUCTION_R12_QA529';

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(v => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}
function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

const serviceAccountPath = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccountPath)) fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
if (!fs.existsSync(CLEAN_RULES_PATH)) fail(`ไม่พบ Clean Rules: ${CLEAN_RULES_PATH}`);

let serviceAccountJson;
try { serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')); }
catch (error) { fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`); }
if (serviceAccountJson.project_id !== PROJECT_ID) {
  fail(`Service Account ต้องเป็น project '${PROJECT_ID}' แต่พบ '${serviceAccountJson.project_id || 'unknown'}'`);
}

const cleanSource = fs.readFileSync(CLEAN_RULES_PATH, 'utf8');
if (!cleanSource.includes("rules_version = '2';")) fail('Clean Rules ไม่มี rules_version = 2');
if (!cleanSource.includes('service cloud.firestore')) fail('Clean Rules ไม่มี service cloud.firestore');
if (!cleanSource.includes('Production QA learner: 529')) fail('Clean Rules ยังไม่มี Production QA 529');
if (!cleanSource.includes("52[0-9]")) fail('Clean Rules ยังไม่อนุญาต 529');
if (cleanSource.includes('schoolStudentId')) fail('Clean Rules ต้องไม่มี schoolStudentId');

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(serviceAccountJson), projectId: PROJECT_ID });
const securityRules = getSecurityRules(app);

console.log(`🛡️  ${RELEASE}`);
console.log('🔎 อ่าน Firestore Rules production ที่ใช้งานจริงก่อน deploy...');
let liveRuleset;
try { liveRuleset = await securityRules.getFirestoreRuleset(); }
catch (error) { fail(`อ่าน live Firestore Rules ไม่สำเร็จ: ${error.message}`); }

const sourceFiles = Array.isArray(liveRuleset?.source) ? liveRuleset.source : [];
const firestoreFile = sourceFiles.find(file => String(file?.content || '').includes('service cloud.firestore'));
if (!firestoreFile) fail('live ruleset ไม่มี source file ที่ประกาศ service cloud.firestore');
const liveContent = String(firestoreFile.content || '');
const backupPath = path.join(os.tmpdir(), `herohealth-firestore-live-before-clean-r12-qa529-${timestamp()}.rules`);
fs.writeFileSync(backupPath, liveContent, 'utf8');
console.log(`✅ สำรอง live rules: ${backupPath}`);
console.log(`   Current ruleset: ${liveRuleset.name}`);
console.log(`📄 Clean source: ${CLEAN_RULES_PATH}`);
console.log('   Real learners: 501-528, 601-628');
console.log('   Production QA: 529');
console.log('   Sandbox: 990001-990029');
console.log('   Private identity: denied to web clients');

console.log('🚀 Compile + release Clean Production Rules ด้วย Firebase Admin SDK...');
try {
  await securityRules.releaseFirestoreRulesetFromSource(cleanSource);
} catch (error) {
  console.error('   code:', error?.code || '(none)');
  console.error('   message:', error?.message || String(error));
  if (error?.errorInfo) console.error('   errorInfo:', JSON.stringify(error.errorInfo, null, 2));
  console.error(`   clean rules: ${CLEAN_RULES_PATH}`);
  console.error(`   backup: ${backupPath}`);
  fail('Clean Production Rules compile/release ไม่สำเร็จ; live rules เดิมยังคงใช้งานอยู่');
}

let confirmed;
try { confirmed = await securityRules.getFirestoreRuleset(); }
catch (_error) { confirmed = null; }

console.log('\n✅ HeroHealth Clean Production Rules R12 deploy สำเร็จ');
console.log(`   Previous: ${liveRuleset.name}`);
console.log(`   Current:  ${confirmed?.name || '(released; confirm name unavailable)'}`);
console.log('   Login: 501-528, 529 QA, 601-628');
console.log('   /students: learner GET รายคน; LIST เฉพาะ teacher');
console.log('   /studentBindings: UID ของตนเอง');
console.log('   /studentProgress: ต้องตรง UID binding');
console.log('   /studentAssessments: ต้องตรง UID binding + writer UID');
console.log('   /studentIdentityPrivate: client deny');
console.log(`   Backup: ${backupPath}`);
console.log('\nรอประมาณ 10-30 วินาที แล้ว Login ใหม่ด้วย 529');
