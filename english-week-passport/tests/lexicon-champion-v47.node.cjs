'use strict';
const fs=require('fs');
const assert=require('assert');
const js=fs.readFileSync('english-week-passport/lexicon-champion-arena-v47.js','utf8');
const routes=fs.readFileSync('english-week-passport/passport-canonical-routes-v1.js','utf8');
const html=fs.readFileSync('english-week-passport/lexicon-champion-arena-v47.html','utf8');

assert(js.includes("2026-08-07-LEXICON-CHAMPION-V47-PRODUCTION"),'production version missing');
assert(html.includes('lexicon-champion-arena-v47.js'),'V47 HTML does not load V47 JS');
assert(html.includes('firebase-authority-bridge.js'),'Firebase authority bridge missing');

const missionIds=[...js.matchAll(/\{id:'([A-H])',name:'/g)].map(m=>m[1]);
assert.deepStrictEqual(missionIds,['A','B','C','D','E','F','G','H'],'Mission Sets A-H must exist exactly once and in order');
assert(js.includes('missionSeed%MISSIONS.length'),'Mission assignment must be deterministic');
assert(js.includes("stageId:'final_boss'"),'Final Boss must submit the canonical stageId');
assert(js.includes('window.EW_AUTHORITY.submitGame'),'Final Boss must submit through Firebase Authority');
assert(js.includes('FIREBASE_RECEIPT_REQUIRED'),'Firebase receipt must be required in production');
assert(js.includes("location.replace('./index.html?'"),'Production return must go back to Passport');
assert(js.includes("q.get('from')==='passport'"),'Production mode must require Passport launch context');
assert(js.includes("unlocked.includes('final_boss')"),'Production access must verify authority unlock');
assert(js.includes('score:st.mastery,total:100'),'Authority score must use 0-100 mastery');
assert(js.includes('bodyMetrics:st.bodyMetrics'),'Body analytics evidence missing');
assert(js.includes('voiceScore:st.voiceScore'),'Voice analytics evidence missing');
assert(js.includes('completedAt:new Date().toISOString()'),'Completion timestamp missing');
assert(!js.includes('localStorage.setItem(`final_boss'),'Client-side final boss unlock is forbidden');
assert(routes.includes("stage==='final_boss'"),'Passport route must special-case Final Boss');
assert(routes.includes('./lexicon-champion-arena-v47.html?'),'Passport route does not target V4.7');
assert(routes.includes("title:'LEXICON Champion Arena'"),'Passport player-facing title mismatch');

console.log('LEXICON Champion Arena V4.7 production contract: PASS');