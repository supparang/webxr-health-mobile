const endpoint = process.env.EAP_ENDPOINT;
if (!endpoint) throw new Error('EAP_ENDPOINT is required');
const phase = process.env.EAP_PHASE || 'all';
const run = `${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
const qaSection = '122-QA';
const qaId = `EAP-RC-${run}`;
const newId = `EAP-NEW-${run}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function parse(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const m = raw.match(/^[^(]+\((.*)\);?$/s);
  if (m) return JSON.parse(m[1]);
  throw new Error(`Cannot parse Apps Script response: ${raw.slice(0, 500)}`);
}
async function getResume(studentId, studentName, section) {
  const u = new URL(endpoint);
  u.searchParams.set('action','player_resume');
  u.searchParams.set('studentId',studentId);
  u.searchParams.set('studentName',studentName);
  u.searchParams.set('section',section);
  u.searchParams.set('_',Date.now());
  const started=Date.now();
  const res = await fetch(u, {redirect:'follow',signal:AbortSignal.timeout(45000)});
  const text = await res.text();
  if (!res.ok) throw new Error(`Resume HTTP ${res.status}: ${text.slice(0,300)}`);
  const data=parse(text); data.__elapsedMs=Date.now()-started; return data;
}
async function post(payload) {
  const started=Date.now();
  const res = await fetch(endpoint, {method:'POST',redirect:'follow',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
  const text = await res.text();
  if (!res.ok) throw new Error(`POST HTTP ${res.status}: ${text.slice(0,300)}`);
  const data=parse(text); data.__elapsedMs=Date.now()-started; return data;
}
function assert(cond, message) { if (!cond) throw new Error(message); }
async function probe(){
  console.log('Probe: new identity and deployed endpoint version');
  const fresh = await getResume(newId, 'EAP Release New Identity', '122');
  console.log(JSON.stringify({ok:fresh.ok,version:fresh.version,authorityMode:fresh.authorityMode,recordCount:fresh.records&&fresh.records.length,elapsedMs:fresh.__elapsedMs,scannedSheets:fresh.scannedSheets},null,2));
  assert(fresh.ok === true, `new identity resume not ok: ${JSON.stringify(fresh)}`);
  assert(Array.isArray(fresh.records), 'new identity records is not an array');
  assert(fresh.records.length === 0, `new identity unexpectedly has ${fresh.records.length} records`);
  assert(/V133-SHEET-AUTHORITY-BOSS-REVIEW/.test(String(fresh.version)), `DEPLOY_REQUIRED: public Apps Script is not V133; deployed version=${fresh.version}`);
  assert(fresh.authorityMode === 'sheet-only', `DEPLOY_REQUIRED: authorityMode=${fresh.authorityMode || 'missing'}`);
}
async function s1(){
  console.log('S1 round-trip: write Reading/Speaking and restore');
  for (const [skill, score] of [['Reading',88],['Speaking',84]]) {
    const response = await post({action:'submit_attempt',submissionKind:'fresh_evidence_v118',attemptId:`qa-${run}-s1-${skill.toLowerCase()}`,studentId:qaId,studentName:'EAP Automated Release QA',section:qaSection,sessionId:'S1',sessionTitle:'Academic Hero Awakening',skill,score,accuracy:score,passMark:60,passed:true,legacyCompletion:false,clientTimestamp:new Date().toISOString(),sourceUrl:'github-actions://eap15-release-gate',routeId:'S1',routeType:'normal_session',sheetEnvelopeVersion:'qa-live-contract-v1'});
    console.log(`${skill} POST`,JSON.stringify(response));
    assert(response.ok === true, `submit_attempt ${skill} failed: ${JSON.stringify(response)}`);
  }
  await sleep(2500);
  const restored = await getResume(qaId, 'EAP Automated Release QA', qaSection);
  const rows=restored.records||[],s1=rows.filter(r => r.sessionId === 'S1');
  console.log(JSON.stringify({version:restored.version,elapsedMs:restored.__elapsedMs,s1},null,2));
  assert(restored.ok === true, `QA resume not ok: ${JSON.stringify(restored)}`);
  assert(s1.some(r => String(r.skill).toLowerCase() === 'reading' && r.passed === true), `S1 Reading not restored: ${JSON.stringify(s1)}`);
  assert(s1.some(r => String(r.skill).toLowerCase() === 'speaking' && r.passed === true), `S1 Speaking not restored: ${JSON.stringify(s1)}`);
}
async function boss(){
  console.log('Boss round-trip: pending teacher review must stay unpassed');
  const evidenceId = `qa-${run}-b1-speaking`;
  const bossPost = await post({action:'submit_evidence',submissionKind:'fresh_evidence_v118',evidenceId,section:qaSection,studentId:qaId,studentName:'EAP Automated Release QA',sessionId:'B1',sessionTitle:'Boss Gate 1: Academic Foundations',skill:'Speaking',evidenceType:'boss_speaking_evidence',taskId:'B1_SPEAKING_INTEGRATED_BOSS_QA',score:90,passed:true,prompt:'Automated release contract check.',output:'This is a synthetic QA record stored outside the teaching section.',durationSec:30,targetRange:'20–40 sec',teacherReviewRequired:true,teacherReviewStatus:'pending_teacher_review',occurredAt:new Date().toISOString(),sourceUrl:'github-actions://eap15-release-gate',consentAudio:false});
  console.log('Boss POST',JSON.stringify(bossPost));
  assert(bossPost.ok === true, `submit_evidence failed: ${JSON.stringify(bossPost)}`);
  await sleep(2500);
  const withBoss = await getResume(qaId, 'EAP Automated Release QA', qaSection);
  const row = (withBoss.records||[]).find(r => r.sessionId === 'B1' && String(r.skill).toLowerCase() === 'speaking');
  console.log(JSON.stringify({version:withBoss.version,elapsedMs:withBoss.__elapsedMs,boss:row},null,2));
  assert(row, `B1 Speaking not returned by player_resume: ${JSON.stringify(withBoss.records)}`);
  assert(row.teacherReviewRequired === true, `B1 Speaking reviewRequired lost: ${JSON.stringify(row)}`);
  assert(String(row.teacherReviewStatus).toLowerCase() === 'pending_teacher_review', `pending status lost: ${JSON.stringify(row)}`);
  assert(row.passed === false, `pending Boss Speaking must not pass: ${JSON.stringify(row)}`);
}
if(phase==='probe') await probe();
else if(phase==='s1') await s1();
else if(phase==='boss') await boss();
else {await probe();await s1();await boss();}
console.log(JSON.stringify({ok:true,phase,qaId,qaSection},null,2));
