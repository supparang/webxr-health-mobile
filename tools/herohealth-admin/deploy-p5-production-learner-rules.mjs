import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const MARKER = 'HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R2';

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(v => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}
function fail(message) { console.error(`\n❌ ${message}\n`); process.exit(1); }
function timestamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function findMatchingBrace(source, openIndex) {
  let depth = 0, state = 'normal';
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (state === 'line-comment') { if (ch === '\n') state = 'normal'; continue; }
    if (state === 'block-comment') { if (ch === '*' && next === '/') { state = 'normal'; i += 1; } continue; }
    if (state === 'single-quote') { if (ch === '\\') { i += 1; continue; } if (ch === "'") state = 'normal'; continue; }
    if (state === 'double-quote') { if (ch === '\\') { i += 1; continue; } if (ch === '"') state = 'normal'; continue; }
    if (ch === '/' && next === '/') { state = 'line-comment'; i += 1; continue; }
    if (ch === '/' && next === '*') { state = 'block-comment'; i += 1; continue; }
    if (ch === "'") { state = 'single-quote'; continue; }
    if (ch === '"') { state = 'double-quote'; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}
function additivePatch() {
  return `\n\n    // ${MARKER}_BEGIN\n    // P5 production learner access; additive to existing teacher/sandbox rules.\n    match /students/{studentId} {\n      allow get: if request.auth != null\n        && studentId.matches('^H5[1-6][0-9][0-9]$')\n        && resource.data.active != false;\n    }\n\n    match /studentBindings/{uid} {\n      allow get: if request.auth != null && request.auth.uid == uid;\n      allow create, update: if request.auth != null\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && request.resource.data.studentId.matches('^H5[1-6][0-9][0-9]$');\n      allow delete: if false;\n    }\n\n    match /studentProgress/{studentId} {\n      allow get: if request.auth != null\n        && studentId.matches('^H5[1-6][0-9][0-9]$')\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n      allow create, update: if request.auth != null\n        && studentId.matches('^H5[1-6][0-9][0-9]$')\n        && request.resource.data.studentId == studentId\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n      allow delete: if false;\n    }\n\n    match /studentAssessments/{documentId} {\n      allow get: if request.auth != null\n        && resource.data.studentId.matches('^H5[1-6][0-9][0-9]$')\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == resource.data.studentId;\n      allow create, update: if request.auth != null\n        && request.resource.data.studentId.matches('^H5[1-6][0-9][0-9]$')\n        && request.resource.data.completed == true\n        && request.resource.data.firebaseSavedByUid == request.auth.uid\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == request.resource.data.studentId;\n      allow delete: if false;\n    }\n    // ${MARKER}_END\n`;
}
function patchFirestoreSource(source) {
  if (source.includes(`${MARKER}_BEGIN`)) return { content: source, changed: false };
  // Remove failed/older P5 patch if it was ever staged into a later live ruleset.
  const clean = source.replace(/\n\s*\/\/ HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R1_BEGIN[\s\S]*?\/\/ HEROHEALTH_P5_PRODUCTION_LEARNER_ACCESS_R1_END\n?/g, '\n');
  const databaseMatch = clean.indexOf('match /databases/');
  if (databaseMatch < 0) throw new Error('ไม่พบ match /databases/{database}/documents ใน live rules');
  const open = clean.indexOf('{', databaseMatch);
  const close = findMatchingBrace(clean, open);
  if (open < 0 || close < 0) throw new Error('โครงสร้าง database match ไม่สมบูรณ์');
  return { content: `${clean.slice(0, close)}${additivePatch()}${clean.slice(close)}`, changed: true };
}
const serviceAccountPath = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccountPath)) fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
let serviceAccountJson;
try { serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')); }
catch (error) { fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`); }
if (serviceAccountJson.project_id !== PROJECT_ID) fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccountJson), projectId: PROJECT_ID });
const securityRules = getSecurityRules(app);
console.log('🔎 อ่าน Firestore Rules ที่ใช้งานจริง...');
let liveRuleset;
try { liveRuleset = await securityRules.getFirestoreRuleset(); }
catch (error) { fail(`อ่าน live Firestore Rules ไม่สำเร็จ: ${error.message}`); }
const sourceFiles = Array.isArray(liveRuleset?.source) ? liveRuleset.source : [];
const firestoreFile = sourceFiles.find(file => String(file?.content || '').includes('service cloud.firestore'));
if (!firestoreFile) fail('live ruleset ไม่มี service cloud.firestore');
const liveContent = String(firestoreFile.content || '');
const backupPath = path.join(os.tmpdir(), `herohealth-firestore-before-p5-${timestamp()}.rules`);
fs.writeFileSync(backupPath, liveContent, 'utf8');
console.log(`✅ Backup: ${backupPath}`);
console.log(`   Current ruleset: ${liveRuleset.name}`);
let patched;
try { patched = patchFirestoreSource(liveContent); } catch (error) { fail(error.message); }
if (!patched.changed) { console.log(`✅ ${MARKER} มีอยู่แล้ว ไม่ deploy ซ้ำ`); process.exit(0); }
const stagedPath = path.join(os.tmpdir(), `herohealth-firestore-p5-production-${timestamp()}.rules`);
fs.writeFileSync(stagedPath, patched.content, 'utf8');
console.log(`📝 Staged: ${stagedPath}`);
console.log('🧪 Validate ruleset...');
let created;
try {
  const rulesFile = securityRules.createRulesFileFromSource(firestoreFile.name || 'firestore.rules', patched.content);
  created = await securityRules.createRuleset(rulesFile);
} catch (error) { fail(`Rules validation/create ล้มเหลว; live rules ยังไม่เปลี่ยน: ${error.message}`); }
console.log(`✅ Validation ผ่าน: ${created.name}`);
console.log('🚀 Publish production learner rules...');
try { await securityRules.releaseFirestoreRuleset(created); }
catch (error) { fail(`Publish ไม่สำเร็จ; live rules เดิมยังอยู่: ${error.message}`); }
console.log('\n✅ HeroHealth P5 Production Learner Rules R2 สำเร็จ');
console.log(`   Previous: ${liveRuleset.name}`);
console.log(`   Current:  ${created.name}`);
console.log(`   Backup:   ${backupPath}`);
console.log('   Learner IDs: H51xx-H56xx');
console.log('   students: GET only; LIST remains closed');
console.log('   progress/assessment: UID binding required');
console.log('\nเปิด Passport ใหม่ แล้วทดสอบ H5101');
