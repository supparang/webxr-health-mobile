import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const root=process.env.EAP_LOCAL_URL||'http://127.0.0.1:4173/eap-hero-save-society-v1/EAP_DashboardTeacherCanonicalV7.html';
const fixture={
  ok:true,version:'v7.0-CANONICAL-OFFICIAL-LEARNERS-122',section:'122',
  overview:{learners:2,heroOnly:1,wordQuestOnly:0,both:1,heroPlayers:2,wordQuestPlayers:1,masteryRecords:12,exposureTouchpoints:3,bossSpeakingEvidence:2,bossPending:1,bossReviewed:1,bossResubmit:0,heroAverage:93.5,wordQuestAccuracyAverage:90,needsSupport:1},
  dataQuality:{rawSummaryCount:16,canonicalHeroCount:15,heroDuplicatesCollapsed:1,rawWordAttemptCount:3,canonicalWordSessionCount:1,rawBossEvidenceCount:5,canonicalBossEvidenceCount:2,bossDuplicatesCollapsed:2,quarantinedCount:3},
  learners:[
    {studentId:'2',studentName:'KAT',participation:'heroOnly',currentRoute:'S1',status:'active',statusLabel:'Active',hero:{masteryRecords:[{sessionId:'S1',skill:'reading',role:'Core',bestScore:0,passed:false,attempts:1}],exposureRecords:[],avgScore:50},bossSpeaking:{records:[{sessionId:'B1',score:91,reviewState:'reviewed',eventAt:'2026-07-07'}],pending:0,reviewed:1,resubmit:0,status:'reviewed'},wordQuest:{records:[],bestRecords:[],latestRecords:[],avgAccuracy:null,weakWords:[]}},
    {studentId:'50',studentName:'KK',participation:'both',currentRoute:'B1',status:'review',statusLabel:'รอตรวจ Boss Speaking',hero:{masteryRecords:[{sessionId:'S1',skill:'reading',role:'Core',bestScore:100,passed:true,attempts:4}],exposureRecords:[{sessionId:'S1',skill:'listening',bestScore:70,updatedAt:'2026-07-05'}],avgScore:95.8},bossSpeaking:{records:[{sessionId:'B1',score:93,reviewState:'pending',eventAt:'2026-07-06'}],pending:1,reviewed:0,resubmit:0,status:'pending'},wordQuest:{records:[{sessionId:'S1'}],bestRecords:[{sessionId:'S1',accuracy:90,sessionAttemptCount:2}],latestRecords:[{sessionId:'S1',accuracy:90}],avgAccuracy:90,weakWords:['limitation']}}
  ]
};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(data=>{
  const runner={_ok:null,_bad:null,withSuccessHandler(fn){this._ok=fn;return this},withFailureHandler(fn){this._bad=fn;return this},eapTeacherDashboardDataCanonicalV7(){setTimeout(()=>this._ok&&this._ok(data),0);return this}};
  window.google={script:{run:runner}};
},fixture);
await page.goto(root,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>document.getElementById('body')?.innerText.includes('KK'),null,{timeout:10000});
const snapshot=await page.evaluate(()=>({cards:document.getElementById('cards').innerText,quality:document.getElementById('quality').innerText,body:document.getElementById('body').innerText,subtitle:document.querySelector('.subtitle').innerText}));
assert.match(snapshot.subtitle,/Canonical official-learner view v7/);
assert.match(snapshot.cards,/ผู้เรียนทั้งหมด\s*2/);
assert.match(snapshot.cards,/Word Best Accuracy\s*90%/);
assert.match(snapshot.cards,/Boss รอตรวจ\s*1/);
assert.match(snapshot.quality,/Summary 16 → Canonical 15/);
assert.match(snapshot.body,/50\s+KK/);
assert.match(snapshot.body,/B1/);
assert.match(snapshot.body,/รอตรวจ/);
assert.doesNotMatch(snapshot.body,/Guest/i);
await page.click('[data-tab="boss"]');
const bossText=await page.locator('#body').innerText();
assert.match(bossText,/KK/);assert.match(bossText,/B1/);assert.match(bossText,/รอตรวจ/);
await page.click('[data-tab="support"]');
const supportText=await page.locator('#body').innerText();
assert.match(supportText,/KK/);assert.doesNotMatch(supportText,/KAT/);
assert.equal(errors.length,0,'Page errors: '+errors.join(' | '));
console.log(JSON.stringify({ok:true,snapshot,bossText,supportText},null,2));
await browser.close();
