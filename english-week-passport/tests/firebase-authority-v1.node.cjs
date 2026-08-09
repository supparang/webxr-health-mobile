const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

const configSource = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const journeySource = fs.readFileSync(path.join(root, 'journey-client-v1.js'), 'utf8');
const directAuthority = fs.readFileSync(path.join(root, 'firestore-direct-authority-v1.js'), 'utf8');
const rules = fs.readFileSync(path.join(repo, 'english-week-firebase-spark', 'firestore.rules'), 'utf8');
const teacher = fs.readFileSync(path.join(repo, 'english', 'functions', 'english-week-teacher.js'), 'utf8');
const firebaserc = JSON.parse(fs.readFileSync(path.join(repo, 'english', '.firebaserc'), 'utf8'));
const workflow = fs.readFileSync(path.join(repo, '.github', 'workflows', 'english-week-firebase-deploy.yml'), 'utf8');

const context = { window: {}, URLSearchParams, document: { documentElement:{}, body:null } };
vm.runInNewContext(configSource, context);
const cfg = context.window.EW_CONFIG;

assert.equal(cfg.authorityMode, 'firestore-direct');
assert.equal(cfg.firebaseProjectId, 'englishweek-95869');
assert.equal(cfg.allowDemoWhenFirebaseUnavailable, false);
assert.match(cfg.firebaseTeacherUrl, /englishweek-95869\.cloudfunctions\.net\/englishWeekTeacher$/);

assert.match(directAuthority, /const FLOW = Object\.freeze\(\[/);
assert.match(directAuthority, /'pre_challenge','word_match','category_forest','sentence_city'/);
assert.match(directAuthority, /'word_detective','final_boss','post_challenge','certificate'/);
assert.match(directAuthority, /STAGE_LOCKED/);
assert.match(directAuthority, /ewp_game_results/);

assert.match(journeySource, /JOURNEY-CLIENT-V5-REAL-ANALYTICS/);
assert.match(journeySource, /collection\(COL\.assessments\)\.where\('playerId','==',playerId\)/);
assert.match(journeySource, /collection\(COL\.gameResults\)\.where\('playerId','==',playerId\)/);
assert.match(journeySource, /firstAttemptAccuracy/);
assert.match(journeySource, /retryCount/);
assert.match(journeySource, /totalDurationMs/);

assert.match(rules, /match \/ewp_assessments\/\{receiptId\}/);
assert.match(rules, /allow list: if owns\(resource\.data\.playerId\)/);
assert.match(rules, /match \/ewp_game_results\/\{receiptId\}/);

assert.match(teacher, /TEACHER-AUTHORITY-R2-FIRESTORE-DIRECT/);
assert.doesNotMatch(teacher, /ewp_reflections/);
assert.doesNotMatch(teacher, /ewp_journey/);
assert.match(teacher, /p\.finalReflection/);
assert.match(teacher, /p\.summaryViewed/);
assert.match(teacher, /aggregatePlayerGames/);

assert.equal(firebaserc.projects.default, 'englishweek-95869');
assert.match(workflow, /--project englishweek-95869/);
assert.match(workflow, /functions:englishWeekTeacher/);
assert.match(workflow, /firestore:rules/);
assert.doesNotMatch(workflow, /english-d4bfa/);

console.log('English Week Firestore-direct production contract: PASS');
