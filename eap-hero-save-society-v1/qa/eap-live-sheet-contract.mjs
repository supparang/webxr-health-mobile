const endpoint = process.env.EAP_ENDPOINT;
if (!endpoint) throw new Error('EAP_ENDPOINT is required');
const phase = process.env.EAP_PHASE || 'all';
const run = `${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
const qaSection = '122-QA';
const qaId = `EAP-RC-${run}`;
const newId = `EAP-NEW-${run}`;
const REQUEST_TIMEOUT_MS = 90000;
const REQUEST_ATTEMPTS = 3;
const POLL_ATTEMPTS = 7;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parse(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const m = raw.match(/^[^(]+\((.*)\);?$/s);
  if (m) return JSON.parse(m[1]);
  throw new Error(`Cannot parse Apps Script response: ${raw.slice(0, 500)}`);
}

function retryable(error) {
  const message = String(error && (error.message || error) || '');
  return /timeout|timed out|abort|network|fetch failed|HTTP 429|HTTP 5\d\d/i.test(message);
}

async function withRetry(label, task, attempts = REQUEST_ATTEMPTS) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await task(attempt);
      if (attempt > 1) console.log(`${label} recovered on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`${label} attempt ${attempt}/${attempts} failed: ${String(error && (error.stack || error.message) || error)}`);
      if (attempt >= attempts || !retryable(error)) throw error;
      await sleep(2500 * attempt);
    }
  }
  throw lastError;
}

async function getActionOnce(action, params={}) {
  const u = new URL(endpoint);
  u.searchParams.set('action',action);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  u.searchParams.set('_',Date.now());
  const started=Date.now();
  const res = await fetch(u, {redirect:'follow',signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
  const text = await res.text();
  if (!res.ok) throw new Error(`${action} HTTP ${res.status}: ${text.slice(0,300)}`);
  const data=parse(text); data.__elapsedMs=Date.now()-started; return data;
}

async function getAction(action, params={}) {
  return withRetry(`GET ${action}`, () => getActionOnce(action, params));
}

async function getResume(studentId, studentName, section) {
  return getAction('player_resume',{studentId,studentName,section});
}

async function postOnce(payload) {
  const started=Date.now();
  const res = await fetch(endpoint, {
    method:'POST',redirect:'follow',
    headers:{'content-type':'text/plain;charset=UTF-8'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST HTTP ${res.status}: ${text.slice(0,300)}`);
  const data=parse(text); data.__elapsedMs=Date.now()-started; return data;
}

async function post(payload) {
  const id = payload.attemptId || payload.evidenceId || payload.action || 'payload';
  return withRetry(`POST ${id}`, () => postOnce(payload));
}

async function pollResume(studentId, studentName, section, predicate, label) {
  let last;
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    last = await getResume(studentId, studentName, section);
    if (predicate(last)) {
      if (attempt > 1) console.log(`${label} became visible on poll ${attempt}`);
      return last;
    }
    console.log(`${label} not visible on poll ${attempt}/${POLL_ATTEMPTS}; waiting for Sheet/cache refresh`);
    if (attempt < POLL_ATTEMPTS) await sleep(4000);
  }
  return last;
}

function assert(cond, message) { if (!cond) throw new Error(message); }
function canonicalBossPass(row){
  const status=String(row&&row.teacherReviewStatus||row&&row.reviewFlag||'').toLowerCase();
  return !!row && row.teacherReviewRequired===true && /reviewed|approved|accepted|pass|passed|complete|completed/.test(status) && !/pending|revise|revision|rework|needs[_ -]?work/.test(status) && (row.passed===true || Number(row.score)>=60);
}

async function probe(){
  console.log('Probe: new identity and deployed endpoint behavior');
  const fresh = await getResume(newId, 'EAP Release New Identity', '122');
  console.log(JSON.stringify({ok:fresh.ok,version:fresh.version,authorityMode:fresh.authorityMode,recordCount:fresh.records&&fresh.records.length,generatedAt:fresh.generatedAt,elapsedMs:fresh.__elapsedMs,scannedSheets:fresh.scannedSheets},null,2));
  assert(fresh.ok === true, `new identity resume not ok: ${JSON.stringify(fresh)}`);
  assert(Array.isArray(fresh.records), 'new identity records is not an array');
  assert(fresh.records.length === 0, `new identity unexpectedly has ${fresh.records.length} records`);
  assert(Number(fresh.__elapsedMs) < REQUEST_TIMEOUT_MS, `player_resume too slow: ${fresh.__elapsedMs} ms`);
  assert(Number.isFinite(Date.parse(fresh.generatedAt)),`player_resume generatedAt missing/invalid: ${fresh.generatedAt}`);
}

async function s1(){
  console.log('S1 round-trip: write Reading/Speaking and restore');
  for (const [skill, score] of [['Reading',88],['Speaking',84]]) {
    const response = await post({action:'submit_attempt',submissionKind:'fresh_evidence_v118',attemptId:`qa-${run}-s1-${skill.toLowerCase()}`,studentId:qaId,studentName:'EAP Automated Release QA',section:qaSection,sessionId:'S1',sessionTitle:'Academic Hero Awakening',skill,score,accuracy:score,passMark:60,passed:true,legacyCompletion:false,clientTimestamp:new Date().toISOString(),sourceUrl:'github-actions://eap15-release-gate',routeId:'S1',routeType:'normal_session',sheetEnvelopeVersion:'qa-live-contract-v2'});
    console.log(`${skill} POST`,JSON.stringify(response));
    assert(response.ok === true, `submit_attempt ${skill} failed: ${JSON.stringify(response)}`);
  }
  const restored = await pollResume(qaId, 'EAP Automated Release QA', qaSection, data => {
    const rows=data.records||[],s1rows=rows.filter(r=>r.sessionId==='S1');
    return s1rows.some(r=>String(r.skill).toLowerCase()==='reading'&&r.passed===true) && s1rows.some(r=>String(r.skill).toLowerCase()==='speaking'&&r.passed===true);
  }, 'S1 Reading/Speaking');
  const rows=restored.records||[],s1rows=rows.filter(r => r.sessionId === 'S1');
  console.log(JSON.stringify({version:restored.version,elapsedMs:restored.__elapsedMs,s1:s1rows},null,2));
  assert(restored.ok === true, `QA resume not ok: ${JSON.stringify(restored)}`);
  assert(s1rows.some(r => String(r.skill).toLowerCase() === 'reading' && r.passed === true), `S1 Reading not restored: ${JSON.stringify(s1rows)}`);
  assert(s1rows.some(r => String(r.skill).toLowerCase() === 'speaking' && r.passed === true), `S1 Speaking not restored: ${JSON.stringify(s1rows)}`);
}

async function boss(){
  console.log('Boss round-trip: pending blocks, reviewed passes');
  const pendingId = `qa-${run}-b1-speaking-pending`;
  const pendingPost = await post({action:'submit_evidence',submissionKind:'fresh_evidence_v118',evidenceId:pendingId,section:qaSection,studentId:qaId,studentName:'EAP Automated Release QA',sessionId:'B1',sessionTitle:'Boss Gate 1: Academic Foundations',skill:'Speaking',evidenceType:'boss_speaking_evidence',taskId:'B1_SPEAKING_INTEGRATED_BOSS_QA',score:90,passed:true,prompt:'Automated release contract check.',output:'Synthetic QA evidence for pending teacher review.',durationSec:30,targetRange:'20–40 sec',checklistComplete:true,selectedFrame:'The source suggests that ____.',attemptCount:1,hintUsed:0,replayCount:0,teacherReviewRequired:true,teacherReviewStatus:'pending_teacher_review',occurredAt:new Date().toISOString(),sourceUrl:'github-actions://eap15-release-gate',consentAudio:false});
  console.log('Pending POST',JSON.stringify(pendingPost));
  assert(pendingPost.ok === true, `pending submit_evidence failed: ${JSON.stringify(pendingPost)}`);
  const pendingResume = await pollResume(qaId, 'EAP Automated Release QA', qaSection, data => (data.records||[]).some(r=>r.sessionId==='B1'&&String(r.skill).toLowerCase()==='speaking'&&String(r.teacherReviewStatus).toLowerCase()==='pending_teacher_review'), 'B1 pending review');
  const pendingRow = (pendingResume.records||[]).find(r => r.sessionId === 'B1' && String(r.skill).toLowerCase() === 'speaking');
  console.log(JSON.stringify({stage:'pending',version:pendingResume.version,elapsedMs:pendingResume.__elapsedMs,boss:pendingRow,canonicalBossPass:canonicalBossPass(pendingRow)},null,2));
  assert(pendingRow, `B1 Speaking pending row not returned: ${JSON.stringify(pendingResume.records)}`);
  assert(pendingRow.teacherReviewRequired === true, `B1 Speaking reviewRequired lost: ${JSON.stringify(pendingRow)}`);
  assert(String(pendingRow.teacherReviewStatus).toLowerCase() === 'pending_teacher_review', `pending status lost: ${JSON.stringify(pendingRow)}`);
  assert(canonicalBossPass(pendingRow) === false, `pending Boss Speaking must be blocked: ${JSON.stringify(pendingRow)}`);

  const reviewedId = `qa-${run}-b1-speaking-reviewed`;
  const reviewedPost = await post({action:'submit_evidence',submissionKind:'fresh_evidence_v118',evidenceId:reviewedId,section:qaSection,studentId:qaId,studentName:'EAP Automated Release QA',sessionId:'B1',sessionTitle:'Boss Gate 1: Academic Foundations',skill:'Speaking',evidenceType:'boss_speaking_teacher_review',taskId:'B1_SPEAKING_INTEGRATED_BOSS_QA',score:90,passed:true,prompt:'Automated release contract check.',output:'Synthetic QA evidence after teacher review.',durationSec:30,targetRange:'20–40 sec',checklistComplete:true,selectedFrame:'The source suggests that ____.',attemptCount:1,hintUsed:0,replayCount:0,teacherReviewRequired:true,teacherReviewStatus:'reviewed',teacherFeedbackCodes:'CL|EV',teacherComment:'Automated QA reviewed evidence.',teacherReviewedAt:new Date().toISOString(),occurredAt:new Date().toISOString(),sourceUrl:'github-actions://eap15-release-gate',consentAudio:false});
  console.log('Reviewed POST',JSON.stringify(reviewedPost));
  assert(reviewedPost.ok === true, `reviewed submit_evidence failed: ${JSON.stringify(reviewedPost)}`);
  const reviewedResume = await pollResume(qaId, 'EAP Automated Release QA', qaSection, data => (data.records||[]).some(r=>r.sessionId==='B1'&&String(r.skill).toLowerCase()==='speaking'&&String(r.teacherReviewStatus).toLowerCase()==='reviewed'), 'B1 reviewed evidence');
  const reviewedRow = (reviewedResume.records||[]).find(r => r.sessionId === 'B1' && String(r.skill).toLowerCase() === 'speaking');
  console.log(JSON.stringify({stage:'reviewed',version:reviewedResume.version,elapsedMs:reviewedResume.__elapsedMs,boss:reviewedRow,canonicalBossPass:canonicalBossPass(reviewedRow)},null,2));
  assert(reviewedRow, `B1 Speaking reviewed row not returned: ${JSON.stringify(reviewedResume.records)}`);
  assert(String(reviewedRow.teacherReviewStatus).toLowerCase() === 'reviewed', `reviewed status not restored: ${JSON.stringify(reviewedRow)}`);
  assert(canonicalBossPass(reviewedRow) === true, `reviewed Boss Speaking must pass canonical rule: ${JSON.stringify(reviewedRow)}`);
}

async function dashboard(){
  console.log('Fast Teacher Console: roster plus selected-student Sheet evidence');
  const roster=await getAction('teacher_students',{section:qaSection,q:qaId});
  const students=Array.isArray(roster.students)?roster.students:[];
  const learner=students.find(x=>String(x.studentId)===qaId);
  assert(roster.ok===true,`teacher_students not ok: ${JSON.stringify(roster)}`);
  assert(learner,`QA learner missing from teacher_students: ${JSON.stringify(students)}`);
  const detail=await pollResume(qaId,learner.studentName||'EAP Automated Release QA',qaSection,data=>{
    const rows=data.records||[];
    return rows.some(r=>r.sessionId==='S1'&&String(r.skill).toLowerCase()==='reading') && rows.some(r=>r.sessionId==='S1'&&String(r.skill).toLowerCase()==='speaking') && rows.some(r=>r.sessionId==='B1'&&String(r.skill).toLowerCase()==='speaking'&&String(r.teacherReviewStatus).toLowerCase()==='reviewed');
  },'Teacher Console S1 + reviewed B1');
  const rows=detail.records||[];
  const s1Reading=rows.find(r=>r.sessionId==='S1'&&String(r.skill).toLowerCase()==='reading');
  const s1Speaking=rows.find(r=>r.sessionId==='S1'&&String(r.skill).toLowerCase()==='speaking');
  const bossRow=rows.find(r=>r.sessionId==='B1'&&String(r.skill).toLowerCase()==='speaking');
  console.log(JSON.stringify({rosterVersion:roster.version,rosterElapsedMs:roster.__elapsedMs,learner,detailVersion:detail.version,detailElapsedMs:detail.__elapsedMs,recordCount:rows.length,s1Reading,s1Speaking,bossRow,canonicalBossPass:canonicalBossPass(bossRow)},null,2));
  assert(Number(roster.__elapsedMs)<REQUEST_TIMEOUT_MS,`teacher_students too slow: ${roster.__elapsedMs}`);
  assert(s1Reading&&s1Speaking,`S1 evidence missing from Fast Teacher Console data: ${JSON.stringify(rows)}`);
  assert(bossRow&&String(bossRow.teacherReviewStatus).toLowerCase()==='reviewed',`Boss reviewed evidence missing from Fast Teacher Console data: ${JSON.stringify(rows)}`);
  assert(canonicalBossPass(bossRow)===true,`Fast Teacher Console did not resolve reviewed Boss evidence: ${JSON.stringify(bossRow)}`);
}

if(phase==='probe') await probe();
else if(phase==='s1') await s1();
else if(phase==='boss') await boss();
else if(phase==='dashboard') await dashboard();
else {await probe();await s1();await boss();await dashboard();}
console.log(JSON.stringify({ok:true,phase,qaId,qaSection,requestTimeoutMs:REQUEST_TIMEOUT_MS,requestAttempts:REQUEST_ATTEMPTS,pollAttempts:POLL_ATTEMPTS},null,2));
