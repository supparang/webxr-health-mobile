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
const MARKER = 'HEROHEALTH_P5_P6_PRODUCTION_LEARNER_R1';

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
function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let state = 'normal';
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
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

function productionPatch() {
  return `\n\n    // ${MARKER}_BEGIN\n    // Production learner access for child-facing login codes 501-528 and 601-628.\n    // School student IDs are NOT stored in /students and remain private admin data.\n    function hhP5P6SignedIn() {\n      return request.auth != null;\n    }\n    function hhP5P6StudentId(studentId) {\n      return studentId.matches('^5(0[1-9]|1[0-9]|2[0-8])$')\n        || studentId.matches('^6(0[1-9]|1[0-9]|2[0-8])$');\n    }\n    function hhP5P6Teacher() {\n      return hhP5P6SignedIn() && request.auth.token.heroHealthTeacher == true;\n    }\n    function hhP5P6BoundTo(studentId) {\n      return hhP5P6SignedIn()\n        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid))\n        && get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId == studentId;\n    }\n\n    match /students/{studentId} {\n      // Learners can fetch only a single known login-code document; collection listing stays teacher-only.\n      allow get: if hhP5P6SignedIn() && hhP5P6StudentId(studentId);\n      allow list: if hhP5P6Teacher();\n      allow create, update, delete: if false;\n    }\n\n    match /studentBindings/{uid} {\n      allow get: if hhP5P6SignedIn() && (request.auth.uid == uid || hhP5P6Teacher());\n      allow list: if hhP5P6Teacher();\n      allow create, update: if hhP5P6SignedIn()\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && hhP5P6StudentId(request.resource.data.studentId);\n      allow delete: if false;\n    }\n\n    match /studentProgress/{studentId} {\n      allow get: if hhP5P6BoundTo(studentId) || hhP5P6Teacher();\n      allow list: if hhP5P6Teacher();\n      allow create, update: if hhP5P6BoundTo(studentId)\n        && hhP5P6StudentId(studentId)\n        && request.resource.data.studentId == studentId;\n      allow delete: if false;\n    }\n\n    match /studentAssessments/{documentId} {\n      allow get: if hhP5P6Teacher()\n        || (hhP5P6SignedIn()\n          && resource.data.studentId is string\n          && hhP5P6StudentId(resource.data.studentId)\n          && hhP5P6BoundTo(resource.data.studentId));\n      allow list: if hhP5P6Teacher();\n      allow create, update: if hhP5P6SignedIn()\n        && request.resource.data.studentId is string\n        && hhP5P6StudentId(request.resource.data.studentId)\n        && hhP5P6BoundTo(request.resource.data.studentId)\n        && request.resource.data.completed == true\n        && (request.resource.data.firebaseSavedByUid == request.auth.uid\n          || request.resource.data.createdByUid == request.auth.uid\n          || request.resource.data.uid == request.auth.uid);\n      allow delete: if false;\n    }\n\n    // Private identity map is never learner-readable. Teacher access, if needed, must be granted separately.\n    match /studentIdentityPrivate/{studentId} {\n      allow read, write: if false;\n    }\n    // ${MARKER}_END\n`;
}

function patchFirestoreSource(source) {
  if (source.includes(`${MARKER}_BEGIN`)) return { content: source, changed: false };
  const withoutOlder = source.replace(/\n\s*\/\/ HEROHEALTH_P5_P6_PRODUCTION_LEARNER_R\d+_BEGIN[\s\S]*?\/\/ HEROHEALTH_P5_P6_PRODUCTION_LEARNER_R\d+_END\n?/g, '\n');
  const databaseMatch = withoutOlder.indexOf('match /databases/');
  if (databaseMatch < 0) throw new Error('ไม่พบ match /databases/{database}/documents ใน live rules');
  const open = withoutOlder.indexOf('{', databaseMatch);
  if (open < 0) throw new Error('ไม่พบ { ของ database match');
  const close = findMatchingBrace(withoutOlder, open);
  if (close < 0) throw new Error('หาปีกกาปิด database match ไม่พบ');
  return { content: `${withoutOlder.slice(0, close)}${productionPatch()}${withoutOlder.slice(close)}`, changed: true };
}

const serviceAccountPath = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccountPath)) fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
let serviceAccountJson;
try { serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')); }
catch (error) { fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`); }
if (serviceAccountJson.project_id !== PROJECT_ID) fail(`Service Account ต้องเป็น project '${PROJECT_ID}'`);

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccountJson), projectId: PROJECT_ID });
const securityRules = getSecurityRules(app);

console.log('🔎 อ่าน Firestore Rules production ที่ใช้งานจริง...');
let liveRuleset;
try { liveRuleset = await securityRules.getFirestoreRuleset(); }
catch (error) { fail(`อ่าน live Firestore Rules ไม่สำเร็จ: ${error.message}`); }
const sourceFiles = Array.isArray(liveRuleset?.source) ? liveRuleset.source : [];
const firestoreFile = sourceFiles.find(file => String(file?.content || '').includes('service cloud.firestore'));
if (!firestoreFile) fail('live ruleset ไม่มี source file ที่ประกาศ service cloud.firestore');
const liveContent = String(firestoreFile.content || '');
const backupPath = path.join(os.tmpdir(), `herohealth-firestore-live-before-p5p6-${timestamp()}.rules`);
fs.writeFileSync(backupPath, liveContent, 'utf8');
console.log(`✅ สำรอง live rules: ${backupPath}`);
console.log(`   Current ruleset: ${liveRuleset.name}`);

let patched;
try { patched = patchFirestoreSource(liveContent); }
catch (error) { fail(error.message); }
if (!patched.changed) {
  console.log(`✅ Live rules มี ${MARKER} อยู่แล้ว ไม่ deploy ซ้ำ`);
  process.exit(0);
}
const stagedPath = path.join(os.tmpdir(), `herohealth-firestore-p5p6-${timestamp()}.rules`);
fs.writeFileSync(stagedPath, patched.content, 'utf8');
console.log(`📝 สร้าง patched rules: ${stagedPath}`);
console.log('🚀 Compile + release ด้วย Firebase Admin SDK (ถ้า compile ไม่ผ่าน live rules เดิมจะไม่ถูกเปลี่ยน)...');
try {
  await securityRules.releaseFirestoreRulesetFromSource(patched.content);
} catch (error) {
  console.error('   code:', error?.code || '(none)');
  console.error('   message:', error?.message || String(error));
  if (error?.errorInfo) console.error('   errorInfo:', JSON.stringify(error.errorInfo, null, 2));
  if (error?.stack) console.error(error.stack);
  fail('Deploy P5/P6 production rules ไม่สำเร็จ; live rules เดิมยังคงใช้งานอยู่');
}

console.log('\n✅ HeroHealth P5/P6 production learner rules deploy สำเร็จ');
console.log('   Login codes: 501-528, 601-628');
console.log('   /students: learner get-only, no collection list');
console.log('   /studentBindings: own UID only');
console.log('   /studentProgress: bound learner only');
console.log('   /studentAssessments: bound learner only');
console.log(`   Backup: ${backupPath}`);
console.log(`   Patched: ${stagedPath}`);
console.log('\nรอ 10-30 วินาที แล้วทดสอบ Logout → Login 501 และ 601 ใหม่');
