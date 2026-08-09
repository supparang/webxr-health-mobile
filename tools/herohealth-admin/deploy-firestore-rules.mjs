import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const MARKER = 'HEROHEALTH_ADDITIVE_ACCESS_R3';
const TEST_IDS = ['990014', '990015', '990016', '990017'];

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

    if (state === 'line-comment') {
      if (ch === '\n') state = 'normal';
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') { state = 'normal'; i += 1; }
      continue;
    }
    if (state === 'single-quote') {
      if (ch === '\\') { i += 1; continue; }
      if (ch === "'") state = 'normal';
      continue;
    }
    if (state === 'double-quote') {
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"') state = 'normal';
      continue;
    }

    if (ch === '/' && next === '/') { state = 'line-comment'; i += 1; continue; }
    if (ch === '/' && next === '*') { state = 'block-comment'; i += 1; continue; }
    if (ch === "'") { state = 'single-quote'; continue; }
    if (ch === '"') { state = 'double-quote'; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function additivePatch() {
  const ids = TEST_IDS.map(id => `'${id}'`).join(', ');
  const regex = `^(${TEST_IDS.join('|')})_.*$`;
  return `\n\n    // ${MARKER}_BEGIN\n    // Additive only: extend teacher + sandbox access without replacing existing learner rules.\n    match /studentsSandbox/{studentId} {\n      allow read: if request.auth != null\n        && (studentId in [${ids}] || request.auth.token.heroHealthTeacher == true);\n    }\n\n    match /studentBindingsSandbox/{uid} {\n      allow read: if request.auth != null\n        && (request.auth.uid == uid || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && request.resource.data.studentId in [${ids}];\n    }\n\n    match /studentProgressSandbox/{studentId} {\n      allow read: if request.auth != null\n        && (studentId in [${ids}] || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null\n        && studentId in [${ids}]\n        && request.resource.data.studentId == studentId;\n    }\n\n    match /studentAssessmentsSandbox/{documentId} {\n      allow read: if request.auth != null\n        && (documentId.matches('${regex}') || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null\n        && documentId.matches('${regex}')\n        && request.resource.data.studentId in [${ids}]\n        && request.resource.data.completed == true\n        && (request.resource.data.firebaseSavedByUid == request.auth.uid\n          || request.resource.data.createdByUid == request.auth.uid);\n    }\n\n    match /passportCrossDeviceSandbox/{studentId} {\n      allow read: if request.auth != null\n        && (studentId in [${ids}] || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null && studentId in [${ids}];\n    }\n\n    // Teacher/researcher read access is additive; existing learner writes remain untouched.\n    match /students/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    match /studentProgress/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    match /studentAssessments/{documentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    // ${MARKER}_END\n`;
}

function patchFirestoreSource(source) {
  if (source.includes(`${MARKER}_BEGIN`)) return { content: source, changed: false };

  // If an older additive block exists, remove it before adding R3 so rules do not accumulate.
  const withoutOlder = source.replace(/\n\s*\/\/ HEROHEALTH_ADDITIVE_ACCESS_R[12]_BEGIN[\s\S]*?\/\/ HEROHEALTH_ADDITIVE_ACCESS_R[12]_END\n?/g, '\n');
  const databaseMatch = withoutOlder.indexOf('match /databases/');
  if (databaseMatch < 0) throw new Error('ไม่พบ match /databases/{database}/documents ใน live rules');
  const open = withoutOlder.indexOf('{', databaseMatch);
  if (open < 0) throw new Error('โครงสร้าง live rules ไม่สมบูรณ์: ไม่พบ { ของ database match');
  const close = findMatchingBrace(withoutOlder, open);
  if (close < 0) throw new Error('โครงสร้าง live rules ไม่สมบูรณ์: หาปีกกาปิด database match ไม่พบ');

  return {
    content: `${withoutOlder.slice(0, close)}${additivePatch()}${withoutOlder.slice(close)}`,
    changed: true
  };
}

const serviceAccountPath = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccountPath)) {
  fail(`ไม่พบ Service Account: ${serviceAccountPath}\nวางไฟล์ไว้ที่ tools/herohealth-admin/service-account.json หรือใช้ --service-account=/path/to/file.json`);
}

let serviceAccountJson;
try {
  serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`);
}
if (serviceAccountJson.project_id !== PROJECT_ID) {
  fail(`Service Account เป็น project '${serviceAccountJson.project_id || 'unknown'}' แต่ต้องเป็น '${PROJECT_ID}'`);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(serviceAccountJson), projectId: PROJECT_ID });
const securityRules = getSecurityRules(app);

console.log('🔎 กำลังอ่าน Firestore Rules ที่ใช้งานจริงก่อนแก้...');
let liveRuleset;
try {
  liveRuleset = await securityRules.getFirestoreRuleset();
} catch (error) {
  fail(`อ่าน live Firestore Rules ไม่สำเร็จ: ${error.message}`);
}

const sourceFiles = Array.isArray(liveRuleset?.source) ? liveRuleset.source : [];
const firestoreFile = sourceFiles.find(file => String(file?.content || '').includes('service cloud.firestore'));
if (!firestoreFile) fail('live ruleset ไม่มี source file ที่ประกาศ service cloud.firestore');

const liveContent = String(firestoreFile.content || '');
const backupPath = path.join(os.tmpdir(), `herohealth-firestore-live-${timestamp()}.rules`);
fs.writeFileSync(backupPath, liveContent, 'utf8');
console.log(`✅ สำรอง live rules แล้ว: ${backupPath}`);
console.log(`   Current ruleset: ${liveRuleset.name}`);
console.log(`   Source file: ${firestoreFile.name || 'firestore.rules'}`);

let patched;
try {
  patched = patchFirestoreSource(liveContent);
} catch (error) {
  fail(error.message);
}

if (!patched.changed) {
  console.log(`✅ Live rules มี ${MARKER} อยู่แล้ว ไม่ deploy ซ้ำ`);
  console.log('ให้ทดสอบ Teacher Console Production และ 990015 ใหม่ได้เลย');
  process.exit(0);
}

const stagedPath = path.join(os.tmpdir(), `herohealth-firestore-patched-${timestamp()}.rules`);
fs.writeFileSync(stagedPath, patched.content, 'utf8');
console.log(`📝 สร้าง patched rules ชั่วคราวแล้ว: ${stagedPath}`);

console.log('🧪 กำลังสร้าง/validate additive ruleset ใหม่ด้วย Firebase Admin SDK...');
let created;
try {
  const rulesFile = securityRules.createRulesFileFromSource(
    firestoreFile.name || 'firestore.rules',
    patched.content
  );
  created = await securityRules.createRuleset(rulesFile);
} catch (error) {
  fail(`Rules validation/create ล้มเหลว; ยังไม่ได้เปลี่ยน live release: ${error.message}`);
}

console.log(`✅ Ruleset ใหม่ผ่าน validation: ${created.name}`);
console.log('🚀 กำลัง release ruleset ใหม่ไปยัง Cloud Firestore...');
try {
  await securityRules.releaseFirestoreRuleset(created);
} catch (error) {
  fail(`สร้าง ruleset สำเร็จแต่ publish ไม่สำเร็จ: ${error.message}\nLive rules เดิมยังคงใช้งานอยู่`);
}

console.log('\n✅ HeroHealth Firestore Rules additive patch สำเร็จ');
console.log(`   Previous: ${liveRuleset.name}`);
console.log(`   Current:  ${created.name}`);
console.log(`   Backup:   ${backupPath}`);
console.log(`   Patched:  ${stagedPath}`);
console.log('   Sandbox:  990014, 990015, 990016, 990017');
console.log('   Teacher:  heroHealthTeacher == true อ่าน Production collections ได้');
console.log('   Production learner rules: คงไว้จาก live rules เดิม');
console.log('\nรอ Rules propagate สักครู่ แล้ว Logout/Login Teacher Console ใหม่ → Production → Refresh');
