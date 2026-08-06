import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const DEFAULT_UID = '5y8Y499FzyZYK7aJaCf3SHjnaMD2';
const PROJECT_ID = 'herohealth-learning';

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function resolveCredentialPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const fromArg = process.argv.find((arg) => arg.startsWith('--service-account='))?.split('=')[1];
  const candidate = fromArg || fromEnv || './service-account.json';
  return path.resolve(process.cwd(), candidate);
}

const uidArg = process.argv.find((arg) => arg.startsWith('--uid='))?.split('=')[1];
const uid = String(uidArg || DEFAULT_UID).trim();
if (!uid) fail('ไม่พบ UID ของบัญชีครู');

const credentialPath = resolveCredentialPath();
if (!fs.existsSync(credentialPath)) {
  fail(
    `ไม่พบไฟล์ Service Account ที่ ${credentialPath}\n` +
    'ให้ดาวน์โหลดจาก Firebase Console > Project settings > Service accounts > Generate new private key\n' +
    'แล้ววางเป็น tools/herohealth-admin/service-account.json หรือระบุ --service-account=/path/to/file.json'
  );
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
} catch (error) {
  fail(`อ่านไฟล์ Service Account ไม่สำเร็จ: ${error.message}`);
}

if (serviceAccount.project_id !== PROJECT_ID) {
  fail(`Service Account เป็นของ project '${serviceAccount.project_id}' ไม่ใช่ '${PROJECT_ID}'`);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });

const auth = getAuth(app);

try {
  const before = await auth.getUser(uid);
  const existingClaims = before.customClaims || {};

  await auth.setCustomUserClaims(uid, {
    ...existingClaims,
    heroHealthTeacher: true,
    heroHealthRole: 'teacher'
  });

  const after = await auth.getUser(uid);

  console.log('\n✅ ตั้งสิทธิ์ครู HeroHealth สำเร็จ');
  console.log(`Email: ${after.email || '(ไม่มีอีเมล)'}`);
  console.log(`UID: ${after.uid}`);
  console.log('Custom Claims:', after.customClaims);
  console.log('\nขั้นตอนต่อไป: ออกจากระบบ Teacher Console แล้วเข้าสู่ระบบใหม่ เพื่อรับ ID token ที่มีสิทธิ์ล่าสุด\n');
} catch (error) {
  fail(`ตั้ง Custom Claim ไม่สำเร็จ: ${error.code || ''} ${error.message}`.trim());
}
