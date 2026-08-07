import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'herohealth-learning';
const CONFIG = path.join(HERE, 'firebase.rules.json');
const DEFAULT_SERVICE_ACCOUNT = path.join(HERE, 'service-account.json');

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(v => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

const serviceAccount = path.resolve(argValue('service-account') || DEFAULT_SERVICE_ACCOUNT);
if (!fs.existsSync(serviceAccount)) {
  fail(`ไม่พบ Service Account: ${serviceAccount}\nวางไฟล์ไว้ที่ tools/herohealth-admin/service-account.json หรือใช้ --service-account=/path/to/file.json`);
}
if (!fs.existsSync(CONFIG)) fail(`ไม่พบ Firebase config: ${CONFIG}`);

let credential;
try {
  credential = JSON.parse(fs.readFileSync(serviceAccount, 'utf8'));
} catch (error) {
  fail(`อ่าน Service Account ไม่สำเร็จ: ${error.message}`);
}

if (credential.project_id !== PROJECT_ID) {
  fail(`Service Account เป็น project '${credential.project_id || 'unknown'}' แต่ต้องเป็น '${PROJECT_ID}'`);
}

const rulesFile = path.resolve(HERE, '../../herohealth/firebase/roster-binding-progress-sandbox.rules');
const rulesText = fs.readFileSync(rulesFile, 'utf8');
for (const id of ['990014', '990015', '990016', '990017']) {
  if (!rulesText.includes(id)) fail(`Rules preflight ไม่พบ test id ${id}`);
}
if (!rulesText.includes('heroHealthTeacher')) fail('Rules preflight ไม่พบ Teacher Custom Claim');

console.log('✅ Preflight ผ่าน');
console.log(`   Project: ${PROJECT_ID}`);
console.log('   Sandbox IDs: 990014, 990015, 990016, 990017');
console.log(`   Rules: ${rulesFile}`);
console.log('\nกำลัง deploy Firestore Rules...\n');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npx,
  [
    '--yes',
    'firebase-tools@latest',
    'deploy',
    '--config', CONFIG,
    '--project', PROJECT_ID,
    '--only', 'firestore:rules',
    '--non-interactive'
  ],
  {
    cwd: HERE,
    stdio: 'inherit',
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: serviceAccount
    }
  }
);

if (result.error) fail(`เรียก Firebase CLI ไม่สำเร็จ: ${result.error.message}`);
if (result.status !== 0) fail(`Firebase deploy ล้มเหลว (exit ${result.status})`);

console.log('\n✅ Deploy Firestore Rules สำเร็จ');
console.log('ให้เปิด Passport/Diagnostic ใหม่ด้วย cache-buster แล้วทดสอบ 990015 ต่อได้ทันที');
