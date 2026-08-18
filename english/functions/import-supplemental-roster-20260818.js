import fs from 'node:fs';
import admin from 'firebase-admin';

const PROJECT_ID = 'englishweek-95869';
const CSV_PATH = 'english-week-passport/data/roster-2026-08-18-845.csv';
const PROFILE_COL = 'ewp_profiles';
const ROSTER_VERSION = '2026-08-18-supplemental-845';
const PROFILE_SOURCE = 'english-week-supplemental-roster-2569';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(v => String(v || '').trim()));
}

function normalize(text) {
  const matrix = parseCsv(text);
  if (matrix.length < 2) throw new Error('CSV_EMPTY');
  const headers = matrix[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  for (const h of ['studentId', 'name']) if (!(h in idx)) throw new Error(`MISSING_COLUMN_${h}`);
  return matrix.slice(1).map(r => ({
    studentId: String(r[idx.studentId] || '').replace(/\s+/g, '').trim(),
    name: String(r[idx.name] || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(),
    program: String(r[idx.program] || '').trim().toUpperCase(),
    eventDate: String(r[idx.eventDate] || '').trim(),
    cohort: String(r[idx.cohort] || '').trim(),
    round: String(r[idx.round] || '').trim(),
    active: String(r[idx.active] ?? 'true').trim().toLowerCase() !== 'false'
  })).filter(r => r.studentId || r.name);
}

function validate(rows) {
  const seen = new Set();
  for (const [i, r] of rows.entries()) {
    if (!/^\d{8,13}$/.test(r.studentId)) throw new Error(`INVALID_STUDENT_ID row=${i + 2} id=${r.studentId}`);
    if (!r.name) throw new Error(`NAME_REQUIRED row=${i + 2}`);
    if (seen.has(r.studentId)) throw new Error(`DUPLICATE_STUDENT_ID ${r.studentId}`);
    seen.add(r.studentId);
  }
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const rows = normalize(fs.readFileSync(CSV_PATH, 'utf8'));
validate(rows);
if (rows.length !== 845) throw new Error(`EXPECTED_845_GOT_${rows.length}`);

let existing = new Set();
for (let i = 0; i < rows.length; i += 250) {
  const part = rows.slice(i, i + 250);
  const refs = part.map(r => db.collection(PROFILE_COL).doc(r.studentId));
  const snaps = await db.getAll(...refs);
  snaps.forEach(s => { if (s.exists) existing.add(s.id); });
}

const missing = rows.filter(r => !existing.has(r.studentId));
let created = 0;
for (let i = 0; i < missing.length; i += 400) {
  const part = missing.slice(i, i + 400);
  const batch = db.batch();
  for (const r of part) {
    const ref = db.collection(PROFILE_COL).doc(r.studentId);
    batch.create(ref, {
      playerId: r.studentId,
      fullName: r.name,
      nickname: r.name,
      groupName: r.program || 'English Week',
      program: r.program || '',
      cohort: r.cohort || '2569',
      sourceEventDate: r.eventDate || '2026-08-18',
      sourceRound: r.round || '',
      active: r.active,
      eligible: true,
      institution: 'Faculty of Science',
      profileSource: PROFILE_SOURCE,
      rosterVersion: ROSTER_VERSION,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRosterImportAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
  created += part.length;
  console.log(`Created ${created}/${missing.length}`);
}

console.log(JSON.stringify({ totalCsv: rows.length, alreadyExisted: existing.size, created, rosterVersion: ROSTER_VERSION }));
