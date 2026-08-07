import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert } from 'firebase-admin/app';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const API = 'https://firebaserules.googleapis.com';
const MARKER = 'HEROHEALTH_ADDITIVE_ACCESS_R2';
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
  return `\n\n    // ${MARKER}_BEGIN\n    // Additive only: these matches extend access and do not replace existing Production learner rules.\n    match /studentsSandbox/{studentId} {\n      allow read: if request.auth != null\n        && (studentId in [${ids}] || request.auth.token.heroHealthTeacher == true);\n    }\n\n    match /studentBindingsSandbox/{uid} {\n      allow read: if request.auth != null\n        && (request.auth.uid == uid || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null\n        && request.auth.uid == uid\n        && request.resource.data.uid == request.auth.uid\n        && request.resource.data.studentId in [${ids}];\n    }\n\n    match /studentProgressSandbox/{studentId} {\n      allow read: if request.auth != null\n        && (studentId in [${ids}] || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null\n        && studentId in [${ids}]\n        && request.resource.data.studentId == studentId;\n    }\n\n    match /studentAssessmentsSandbox/{documentId} {\n      allow read: if request.auth != null\n        && (documentId.matches('${regex}') || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null\n        && documentId.matches('${regex}')\n        && request.resource.data.studentId in [${ids}]\n        && request.resource.data.completed == true\n        && (request.resource.data.firebaseSavedByUid == request.auth.uid\n          || request.resource.data.createdByUid == request.auth.uid);\n    }\n\n    match /passportCrossDeviceSandbox/{studentId} {\n      allow read: if request.auth != null\n        && (studentId in [${ids}] || request.auth.token.heroHealthTeacher == true);\n      allow create, update: if request.auth != null && studentId in [${ids}];\n    }\n\n    // Teacher/researcher read access is additive; existing learner writes remain untouched.\n    match /students/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    match /studentProgress/{studentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    match /studentAssessments/{documentId} {\n      allow read: if request.auth != null && request.auth.token.heroHealthTeacher == true;\n    }\n    // ${MARKER}_END\n`;
}

function patchFirestoreSource(source) {
  if (source.includes(`${MARKER}_BEGIN`)) return { content: source, changed: false };
  const databaseMatch = source.indexOf('match /databases/');
  if (databaseMatch < 0) throw new Error('ไม่พบ match /databases/{database}/documents ใน live rules');
  const open = source.indexOf('{', databaseMatch);
  if (open < 0) throw new Error('โครงสร้าง live rules ไม่สมบูรณ์: ไม่พบ { ของ database match');
  const close = findMatchingBrace(source, open);
  if (close < 0) throw new Error('โครงสร้าง live rules ไม่สมบูรณ์: หาปีกกาปิด database match ไม่พบ');
  return {
    content: `${source.slice(0, close)}${additivePatch()}${source.slice(close)}`,
    changed: true
  };
}

const serviceAccount = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccount)) {
  fail(`ไม่พบ Service Account: ${serviceAccount}\nวางไฟล์ไว้ที่ tools/herohealth-admin/service-account.json หรือใช้ --service-account=/path/to/file.json`);
}

let serviceAccountJson;
try {
  serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccount, 'utf8'));
} catch (error) {
  fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`);
}
if (serviceAccountJson.project_id !== PROJECT_ID) {
  fail(`Service Account เป็น project '${serviceAccountJson.project_id || 'unknown'}' แต่ต้องเป็น '${PROJECT_ID}'`);
}

const credential = cert(serviceAccountJson);
let accessToken;
try {
  const token = await credential.getAccessToken();
  accessToken = token.access_token;
} catch (error) {
  fail(`ขอ Google access token ไม่สำเร็จ: ${error.message}`);
}

async function api(resource, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${resource}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
  if (!response.ok) {
    const detail = data?.error?.message || data?.raw || `${response.status} ${response.statusText}`;
    throw new Error(`${method} ${resource}: ${detail}`);
  }
  return data;
}

async function currentFirestoreRelease() {
  for (const releaseId of ['cloud.firestore', 'cloud.firestore/(default)']) {
    try {
      return await api(`/v1/projects/${PROJECT_ID}/releases/${releaseId}`);
    } catch (_) {}
  }
  const listed = await api(`/v1/projects/${PROJECT_ID}/releases`);
  const release = (listed?.releases || []).find(item =>
    String(item?.name || '').endsWith('/releases/cloud.firestore') ||
    String(item?.name || '').endsWith('/releases/cloud.firestore/(default)')
  );
  if (!release) throw new Error('ไม่พบ Firestore Rules release ของ default database');
  return release;
}

console.log('🔎 กำลังอ่าน Firestore Rules ที่ใช้งานจริงก่อนแก้...');
let release;
let liveRuleset;
try {
  release = await currentFirestoreRelease();
  liveRuleset = await api(`/v1/${release.rulesetName}`);
} catch (error) {
  fail(`อ่าน live Firestore Rules ไม่สำเร็จ: ${error.message}`);
}

const files = Array.isArray(liveRuleset?.source?.files) ? liveRuleset.source.files : [];
const targetIndex = files.findIndex(file => String(file?.content || '').includes('service cloud.firestore'));
if (targetIndex < 0) fail('live ruleset ไม่มีไฟล์ที่ประกาศ service cloud.firestore');

const liveContent = String(files[targetIndex].content || '');
const backupPath = path.join(os.tmpdir(), `herohealth-firestore-live-${timestamp()}.rules`);
fs.writeFileSync(backupPath, liveContent, 'utf8');
console.log(`✅ สำรอง live rules แล้ว: ${backupPath}`);
console.log(`   Current ruleset: ${release.rulesetName}`);

let patched;
try {
  patched = patchFirestoreSource(liveContent);
} catch (error) {
  fail(error.message);
}

if (!patched.changed) {
  console.log(`✅ Live rules มี ${MARKER} อยู่แล้ว ไม่ deploy ซ้ำ`);
  console.log('ให้ทดสอบ 990015 ใน Passport/Diagnostic ใหม่ได้เลย');
  process.exit(0);
}

const newFiles = files.map((file, index) => index === targetIndex ? { ...file, content: patched.content } : file);
const newSource = {
  files: newFiles,
  ...(liveRuleset?.source?.attachmentPoint ? { attachmentPoint: liveRuleset.source.attachmentPoint } : {})
};

console.log('🧪 กำลังสร้าง/validate additive ruleset ใหม่...');
let created;
try {
  created = await api(`/v1/projects/${PROJECT_ID}/rulesets`, {
    method: 'POST',
    body: { source: newSource }
  });
} catch (error) {
  fail(`Rules validation/create ล้มเหลว; ยังไม่ได้เปลี่ยน live release: ${error.message}`);
}

console.log(`✅ Ruleset ใหม่ผ่าน validation: ${created.name}`);
console.log('🚀 กำลังสลับ Firestore release ไปยัง ruleset ใหม่...');
try {
  await api(`/v1/${release.name}`, {
    method: 'PATCH',
    body: {
      release: { name: release.name, rulesetName: created.name },
      updateMask: 'rulesetName'
    }
  });
} catch (error) {
  fail(`สร้าง ruleset สำเร็จแต่ publish release ไม่สำเร็จ: ${error.message}\nLive rules เดิมยังอ้าง ${release.rulesetName}`);
}

console.log('\n✅ HeroHealth Firestore Rules additive patch สำเร็จ');
console.log(`   Previous: ${release.rulesetName}`);
console.log(`   Current:  ${created.name}`);
console.log(`   Backup:   ${backupPath}`);
console.log('   Sandbox:  990014, 990015, 990016, 990017');
console.log('   Production learner rules: คงไว้จาก live rules เดิม');
console.log('\nให้เปิด Student Sandbox Diagnostic หรือ Passport ใหม่แล้วทดสอบ 990015 ต่อได้ทันที');
