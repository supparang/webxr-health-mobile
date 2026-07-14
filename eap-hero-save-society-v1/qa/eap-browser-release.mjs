import { chromium } from 'playwright';
const base = process.env.EAP_LOCAL_URL || 'http://127.0.0.1:4173/eap-hero-save-society-v1/index.html';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const pageErrors=[];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(`${base}?eapqa=1`, {waitUntil:'domcontentloaded', timeout:60000});
await page.waitForFunction(() => window.EAP15ReleaseQA && window.EAPRoadmapLockGuard && window.EAPLobbyRouteIsolation, null, {timeout:60000});
let report = await page.evaluate(() => window.EAP15ReleaseQA.run());
if (!report.pass) throw new Error(`Browser QA errors: ${JSON.stringify(report.errors.slice(0,10))}`);
let diag = await page.evaluate(() => window.EAPRoadmapLockGuard.diagnostics());
if (diag.authorityMode !== 'live-sheet-only') throw new Error(`Wrong authority mode: ${JSON.stringify(diag)}`);

await page.evaluate(() => {
  localStorage.setItem('EAP_HERO_PROGRESS_V3', JSON.stringify({
    profile:{studentId:'QA-TAMPER',studentName:'QA Tamper',section:'122'},
    currentCloudRoute:'B5',cloudVerified:true,resumeVerified:true,
    completedSessions:{S1:true,S2:true,S3:true,B1:true,S4:true,S5:true,S6:true,B2:true,S7:true,S8:true,S9:true,B3:true,S10:true,S11:true,S12:true,B4:true,S13:true,S14:true,S15:true}
  }));
});
await page.reload({waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(() => window.EAPRoadmapLockGuard && window.EAPLobbyRouteIsolation, null, {timeout:60000});
const tamper = await page.evaluate(() => ({current:window.EAPRoadmapLockGuard.currentRouteId(),b5:window.EAPRoadmapLockGuard.canOpen('B5'),d:window.EAPRoadmapLockGuard.diagnostics()}));
if (tamper.current !== 'S1' || tamper.b5 !== false || tamper.d.liveVerified !== false) throw new Error(`localStorage tamper unlocked progress: ${JSON.stringify(tamper)}`);

const live = await page.evaluate(() => {
  const s=JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');
  s.profile={studentId:'QA-LIVE',studentName:'QA Live',section:'122'};
  localStorage.setItem('EAP_HERO_PROGRESS_V3',JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('eap:profile-changed'));
  const data={ok:true,studentId:'QA-LIVE',studentName:'QA Live',section:'122',generatedAt:new Date().toISOString(),serverRevision:'qa',records:[
    {routeId:'S1',sessionId:'S1',skill:'Reading',score:90,passed:true},
    {routeId:'S1',sessionId:'S1',skill:'Speaking',score:90,passed:true}
  ]};
  window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data}}));
  return {current:window.EAPRoadmapLockGuard.currentRouteId(),s2:window.EAPRoadmapLockGuard.canOpen('S2'),diag:window.EAPRoadmapLockGuard.diagnostics()};
});
if (live.current !== 'S2' || live.s2 !== true || live.diag.liveVerified !== true) throw new Error(`fresh resume did not advance: ${JSON.stringify(live)}`);

const boss = await page.evaluate(() => {
  const a=window.EAPRoadmapLockGuard;
  const rows=[];
  const add=(route,skills)=>skills.forEach(skill=>rows.push({routeId:route,skill,score:90,passed:true}));
  add('S1',['reading','speaking']); add('S2',['reading','writing']); add('S3',['reading','writing']);
  add('B1',['reading','listening','writing']); rows.push({routeId:'B1',skill:'speaking',score:90,passed:true,teacherReviewStatus:'pending_teacher_review'});
  const pending=a.testEvaluate(rows).current;
  rows[rows.length-1].teacherReviewStatus='reviewed';
  const reviewed=a.testEvaluate(rows).current;
  return {pending,reviewed};
});
if (boss.pending !== 'B1' || boss.reviewed !== 'S4') throw new Error(`Boss review contract failed: ${JSON.stringify(boss)}`);

await page.evaluate(() => {
  const app=document.getElementById('app');
  app.innerHTML='<div id="qa-lobby-shell"><section class="mf-hud">Mission Mode v1z99 Academic Hero Awakening S1 Rescue Clash</section><section id="eap-student-compact-lobby"><div>STUDENT LOBBY</div><button>Start / Continue</button><div>B1 Boss Gate</div><div>KK · ID 50 · Section 122</div></section><div id="eap-student-15week-roadmap">SESSION 1 Session Passed</div></div>';
  const status=document.createElement('div');status.id='eap-sheet-envelope-status';status.textContent='Sheet: 8 send attempts · S7';document.body.appendChild(status);
  const manual=document.createElement('button');manual.id='eap-sheet-manual-send';manual.textContent='ส่งผลล่าสุดเข้า Sheet';document.body.appendChild(manual);
  window.EAPPhaseAActiveTask={sessionId:'S1',taskId:'stale'};
  window.EAPLobbyRouteIsolation.refresh();
});
await page.waitForTimeout(300);
const lobbyIsolation = await page.evaluate(() => {
  const visible=sel=>Array.from(document.querySelectorAll(sel)).filter(el=>getComputedStyle(el).display!=='none').length;
  return {
    isLobby:window.EAPLobbyRouteIsolation.isLobby(),
    bodyClass:document.body.classList.contains('eap-canonical-lobby-isolated'),
    lobbyVisible:visible('#eap-student-compact-lobby'),
    missionVisible:visible('.mf-hud'),
    roadmapVisible:visible('#eap-student-15week-roadmap'),
    sheetStatusVisible:visible('#eap-sheet-envelope-status'),
    sheetButtonVisible:visible('#eap-sheet-manual-send'),
    activeTask:window.EAPPhaseAActiveTask
  };
});
if (!lobbyIsolation.isLobby || !lobbyIsolation.bodyClass || lobbyIsolation.lobbyVisible !== 1 || lobbyIsolation.missionVisible || lobbyIsolation.roadmapVisible || lobbyIsolation.sheetStatusVisible || lobbyIsolation.sheetButtonVisible || lobbyIsolation.activeTask !== null) {
  throw new Error(`B1 lobby isolation failed: ${JSON.stringify(lobbyIsolation)}`);
}

if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
console.log(JSON.stringify({ok:true,qa:`${report.passed}/${report.total}`,tamper,live,boss,lobbyIsolation},null,2));
await browser.close();
