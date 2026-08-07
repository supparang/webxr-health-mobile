'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const loader = read('english-week-passport/app-core-loader-v2.js');
const bridge = read('english-week-passport/assessment-checkpoint-bridge-v1.js');
const index = read('english-week-passport/index.html');
const fn = read('english/functions/english-week-assessment-checkpoint.js');
const main = read('english/functions/main.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(loader.includes('ASSESSMENT-RESUME'), 'loader version must declare assessment resume');
assert(loader.includes('getAssessmentCheckpoint'), 'loader must retrieve pending assessment checkpoint');
assert(loader.includes('saveAssessmentCheckpointNow'), 'loader must save checkpoint after answering');
assert(loader.includes('clearAssessmentCheckpoint'), 'loader must clear checkpoint after successful submit');
assert(loader.includes('currentIndex: Math.min(state.questions.length, state.index + (state.answered ? 1 : 0))'), 'checkpoint must point to next unanswered item');
assert(loader.includes('startStage("pre_challenge", checkpoint)'), 'login must restore interrupted pre challenge');
assert(loader.includes('assessmentResume:true'), 'runtime feature flag missing');

assert(bridge.includes('englishWeekAssessmentCheckpoint'), 'bridge must derive checkpoint Cloud Function endpoint');
assert(bridge.includes("remote('save'"), 'bridge must save checkpoint remotely');
assert(bridge.includes("remote('get'"), 'bridge must retrieve checkpoint remotely');
assert(bridge.includes("remote('clear'"), 'bridge must clear checkpoint remotely');
assert(bridge.includes('saveLocal(checkpoint)'), 'bridge must save local fallback immediately');

const bridgePos = index.indexOf('assessment-checkpoint-bridge-v1.js');
const loaderPos = index.indexOf('app-core-loader-v2.js');
assert(bridgePos >= 0 && loaderPos > bridgePos, 'checkpoint bridge must load before app core loader');

assert(fn.includes("const COLLECTION = 'ewp_assessment_checkpoints'"), 'checkpoint Firestore collection missing');
assert(fn.includes("action === 'save'"), 'checkpoint save action missing');
assert(fn.includes("action === 'get'"), 'checkpoint get action missing');
assert(fn.includes("action === 'clear'"), 'checkpoint clear action missing');
assert(fn.includes("status: 'pending'"), 'checkpoint pending status missing');
assert(main.includes("englishWeekAssessmentCheckpoint"), 'checkpoint function must be exported from main.js');

console.log('Assessment resume V1 contract: PASS');
