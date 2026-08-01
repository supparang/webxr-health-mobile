const endpoint = process.env.EAP_ENDPOINT;
if (!endpoint) throw new Error('EAP_ENDPOINT is required');
const run = `${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
const section = '122-QA';
const passId = `EAP-POLICY-PASS-${run}`;
const failId = `EAP-POLICY-FAIL-${run}`;
const timeoutMs = 90000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parse(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/^[^(]+\((.*)\);?$/s);
  if (match) return JSON.parse(match[1]);
  throw new Error(`Cannot parse Apps Script response: ${raw.slice(0, 500)}`);
}

async function getResume(studentId, studentName) {
  const url = new URL(endpoint);
  url.searchParams.set('action', 'player_resume');
  url.searchParams.set('studentId', studentId);
  url.searchParams.set('studentName', studentName);
  url.searchParams.set('section', section);
  url.searchParams.set('_', Date.now());
  const response = await fetch(url, { redirect:'follow', signal:AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  if (!response.ok) throw new Error(`player_resume HTTP ${response.status}: ${text.slice(0, 300)}`);
  return parse(text);
}

async function postAttempt(studentId, studentName, skill, score, passed) {
  const payload = {
    action:'submit_attempt',
    submissionKind:'fresh_evidence_v118',
    attemptId:`qa-policy-${run}-${studentId}-${skill.toLowerCase()}`,
    studentId, studentName, section,
    sessionId:'S1', routeId:'S1', routeType:'normal_session',
    sessionTitle:'Academic Hero Awakening',
    skill, score, accuracy:score, passMark:60, passed,
    legacyCompletion:false,
    clientTimestamp:new Date().toISOString(),
    sourceUrl:'github-actions://eap15-release-gate',
    sheetEnvelopeVersion:'qa-live-policy-v1'
  };
  const response = await fetch(endpoint, {
    method:'POST', redirect:'follow',
    headers:{'content-type':'text/plain;charset=UTF-8'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`submit_attempt HTTP ${response.status}: ${text.slice(0, 300)}`);
  const data = parse(text);
  if (data.ok !== true) throw new Error(`submit_attempt failed: ${JSON.stringify(data)}`);
  return data;
}

async function poll(studentId, studentName, predicate, label) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    last = await getResume(studentId, studentName);
    if (predicate(last)) return last;
    console.log(`${label} not ready on poll ${attempt}/8`, JSON.stringify({
      version:last.version,
      policy:last.progressPolicy,
      currentRoute:last.currentRoute || last.currentCloudRoute,
      recordCount:last.records && last.records.length
    }));
    if (attempt < 8) await sleep(4000);
  }
  return last;
}

function route(data) {
  return String(data.currentCloudRoute || data.currentRoute || data.nextRoute || '').toUpperCase();
}

for (const [skill, score] of [['Reading', 88], ['Speaking', 84]]) {
  await postAttempt(passId, 'EAP Policy Pass QA', skill, score, true);
}
const passed = await poll(passId, 'EAP Policy Pass QA', data => {
  const rows = data.records || [];
  return route(data) === 'S2' &&
    rows.some(row => row.sessionId === 'S1' && String(row.skill).toLowerCase() === 'reading' && row.passed === true) &&
    rows.some(row => row.sessionId === 'S1' && String(row.skill).toLowerCase() === 'speaking' && row.passed === true);
}, 'S1 Core + Support unlock');
if (route(passed) !== 'S2') {
  throw new Error(`S1 Core + Support did not unlock S2: ${JSON.stringify({version:passed.version,policy:passed.progressPolicy,currentRoute:route(passed),routeProgress:passed.routeProgress && passed.routeProgress.S1})}`);
}
if (!String(passed.progressPolicy || '').includes('core-support')) {
  throw new Error(`Deployed player_resume is not using Core + Support policy: ${JSON.stringify({version:passed.version,policy:passed.progressPolicy})}`);
}

await postAttempt(failId, 'EAP Policy Fail QA', 'Reading', 88, true);
await postAttempt(failId, 'EAP Policy Fail QA', 'Speaking', 45, false);
const failed = await poll(failId, 'EAP Policy Fail QA', data => {
  const rows = data.records || [];
  return rows.some(row => row.sessionId === 'S1' && String(row.skill).toLowerCase() === 'reading') &&
    rows.some(row => row.sessionId === 'S1' && String(row.skill).toLowerCase() === 'speaking');
}, 'S1 fail remains locked');
if (route(failed) !== 'S1') {
  throw new Error(`Failed S1 Support incorrectly unlocked next route: ${JSON.stringify({version:failed.version,policy:failed.progressPolicy,currentRoute:route(failed),routeProgress:failed.routeProgress && failed.routeProgress.S1})}`);
}

console.log(JSON.stringify({
  ok:true,
  version:passed.version,
  progressPolicy:passed.progressPolicy,
  passStudent:passId,
  passCurrentRoute:route(passed),
  failStudent:failId,
  failCurrentRoute:route(failed)
}, null, 2));
