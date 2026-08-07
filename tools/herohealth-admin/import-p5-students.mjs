import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');
const GROUPS = ['A','B','C','D','E','F','G','H','I','J'];
const RELEASE = '20260807-P5-200-BULK-IMPORT-R1';

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(v => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function fail(message) { console.error(`\n❌ ${message}\n`); process.exit(1); }

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(v => String(v || '').trim());
  return rows.slice(1)
    .filter(r => r.some(v => String(v || '').trim()))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
}

function normalizeRow(raw, index) {
  const studentId = String(raw.studentId || raw.student_id || raw.id || '').trim();
  const fullName = String(raw.fullName || raw.full_name || raw.name || '').trim();
  const nickname = String(raw.nickname || raw.nick || '').trim();
  const school = String(raw.school || raw.schoolName || '').trim();
  const section = String(raw.section || raw.classroom || raw.room || 'P5-2026').trim();
  const requestedGroup = String(raw.group || raw.rotationGroup || raw.conditionGroup || '').trim().toUpperCase();
  const group = GROUPS.includes(requestedGroup) ? requestedGroup : GROUPS[index % GROUPS.length];
  return { studentId, fullName, nickname, school, section, group };
}

const csvPathArg = argValue('file');
if (!csvPathArg) {
  fail('กรุณาระบุไฟล์ CSV เช่น npm run import-p5 -- --file=/path/to/p5-200.csv');
}
const csvPath = path.resolve(csvPathArg);
if (!fs.existsSync(csvPath)) fail(`ไม่พบไฟล์ CSV: ${csvPath}`);

const serviceAccountPath = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccountPath)) {
  fail(`ไม่พบ Service Account: ${serviceAccountPath}`);
}
let serviceAccount;
try { serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')); }
catch (error) { fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`); }
if (serviceAccount.project_id !== PROJECT_ID) {
  fail(`Service Account เป็น project '${serviceAccount.project_id || 'unknown'}' แต่ต้องเป็น '${PROJECT_ID}'`);
}

const rawRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const students = rawRows.map(normalizeRow);
if (!students.length) fail('CSV ไม่มีข้อมูลนักเรียน');

const errors = [];
const seen = new Set();
students.forEach((s, i) => {
  if (!s.studentId) errors.push(`แถว ${i + 2}: ไม่มี studentId`);
  if (!s.fullName) errors.push(`แถว ${i + 2}: ไม่มี fullName/name`);
  if (s.studentId && !/^[0-9A-Za-z_-]{3,40}$/.test(s.studentId)) errors.push(`แถว ${i + 2}: studentId '${s.studentId}' มีรูปแบบไม่รองรับ`);
  if (seen.has(s.studentId)) errors.push(`แถว ${i + 2}: studentId '${s.studentId}' ซ้ำ`);
  seen.add(s.studentId);
});
if (errors.length) fail(`CSV validation ไม่ผ่าน:\n- ${errors.slice(0, 30).join('\n- ')}${errors.length > 30 ? `\n...อีก ${errors.length - 30} รายการ` : ''}`);

const groupCounts = Object.fromEntries(GROUPS.map(g => [g, students.filter(s => s.group === g).length]));
console.log('HeroHealth Grade 5 Bulk Import');
console.log(`Project: ${PROJECT_ID}`);
console.log(`CSV: ${csvPath}`);
console.log(`Students: ${students.length}`);
console.log(`Groups: ${GROUPS.map(g => `${g}=${groupCounts[g]}`).join(' • ')}`);
console.log('Mode:', hasFlag('commit') ? 'COMMIT' : 'DRY RUN');

if (!hasFlag('commit')) {
  console.log('\n✅ ตรวจไฟล์ผ่าน แต่ยังไม่ได้เขียน Firebase');
  console.log('ตัวอย่าง 5 คนแรก:');
  console.table(students.slice(0, 5));
  console.log('\nถ้าถูกต้อง ให้รันคำสั่งเดิมและเติม --commit');
  process.exit(0);
}

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
const db = getFirestore(app);

const progressRefs = students.map(s => db.collection('studentProgress').doc(s.studentId));
const progressSnaps = await db.getAll(...progressRefs);
const existingProgress = new Set(progressSnaps.filter(s => s.exists).map(s => s.id));

const writer = db.bulkWriter();
let rosterWrites = 0;
let progressCreates = 0;
writer.onWriteError(error => {
  console.error(`Firestore write error: ${error.documentRef?.path || 'unknown'} • ${error.message}`);
  return error.failedAttempts < 3;
});

students.forEach(student => {
  const sid = student.studentId;
  writer.set(db.collection('students').doc(sid), {
    studentId: sid,
    fullName: student.fullName,
    nickname: student.nickname,
    school: student.school,
    section: student.section,
    classId: student.section,
    grade: 'P5',
    group: student.group,
    rotationGroup: student.group,
    conditionGroup: student.group,
    active: true,
    authority: 'firebase-production',
    cohort: 'HEROHEALTH-P5-2569',
    importedAt: FieldValue.serverTimestamp(),
    importedBy: 'tools/herohealth-admin/import-p5-students.mjs',
    build: RELEASE
  }, { merge: true });
  rosterWrites += 1;

  if (!existingProgress.has(sid)) {
    writer.create(db.collection('studentProgress').doc(sid), {
      studentId: sid,
      currentStep: 'pretest',
      currentZone: 'hygiene',
      progressPct: 0,
      completedCount: 0,
      pretestCompleted: false,
      posttestCompleted: false,
      reflectionCompleted: false,
      certificateEligible: false,
      gameCompleted: { hygiene: {}, nutrition: {}, fitness: {} },
      gameResults: {},
      assessments: {},
      completed: {
        pretest: false,
        hygiene: false,
        nutrition: false,
        fitness: false,
        posttest: false,
        reflection: false
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      build: RELEASE
    });
    progressCreates += 1;
  }
});

await writer.close();
console.log('\n✅ Bulk import สำเร็จ');
console.log(`Roster students: ${rosterWrites}`);
console.log(`New progress docs: ${progressCreates}`);
console.log(`Existing progress preserved: ${students.length - progressCreates}`);
console.log('Collections: students + studentProgress');
console.log('หมายเหตุ: สคริปต์ไม่ล้าง progress เดิม และไม่สร้าง Firebase Auth account รายคน');
