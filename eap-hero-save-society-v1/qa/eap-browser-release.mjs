import './eap-reading-receipt-contract.mjs';
import { chromium } from 'playwright';
const base = process.env.EAP_LOCAL_URL || 'http://127.0.0.1:4173/eap-hero-save-society-v1/index.html';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const pageErrors=[];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(`${base}?eapqa=1`, {waitUntil:'domcontentloaded', timeout:60000});
await page.waitForFunction(() => window.EAP15ReleaseQA && window.EAPAuthorityRuntime && window.EAPCloudRouteUIAuthority && window.EAPLobbyRouteIsolation, null, {timeout:60000});
const report = await page.evaluate(() => window.EAP15ReleaseQA.run());
if (!report.pass) throw new Error(`Browser QA errors: ${JSON.stringify(report.errors.slice(0,10))}`);
const initial = await page.evaluate(() => ({
  runtime:window.EAPAuthorityRuntime.diagnostics(),
  route:window.EAPAuthorityRuntime.currentRoute(),
  verified:window.EAPAuthorityRuntime.isVerified()
}));
if (initial.verified && !initial.route) throw new Error(`Verified runtime without route: ${JSON.stringify(initial)}`);

// Test a fresh, isolated browser context: forged local progress must not
// turn into an authoritative server resume. No live student account is used.
const isolated = await browser.newContext();
await isolated.addInitScript(() => {
  localStorage.setItem('EAP_HERO_PROGRESS_V3',JSON.stringify({
    profile:{studentId:'QA-TAMPER',studentName:'QA Tamper',section:'122'},
    currentCloudRoute:'B5',cloudVerified:true,resumeVerified:true,
    completedSessions:{S1:true,S2:true,B1:true,B5:true},
    portfolio:[{sessionId:'S1',skill:'Reading',score:100,pendingSheetSync:true}]
  }));
});
const tamperPage=await isolated.newPage();
await tamperPage.goto(`${base}?eapqa=1`,{waitUntil:'domcontentloaded',timeout:60000});
await tamperPage.waitForFunction(() => !!window.EAPAuthorityRuntime,null,{timeout:60000});
const tamper=await tamperPage.evaluate(() => ({
  verified:window.EAPAuthorityRuntime.isVerified(),
  route:window.EAPAuthorityRuntime.currentRoute()
}));
if (tamper.verified || tamper.route) throw new Error(`Unverified local progress gained authority: ${JSON.stringify(tamper)}`);
await isolated.close();

await page.evaluate(() => {
  const app=document.getElementById('app');
  app.innerHTML='<div id="qa-lobby-shell"><h1>EAP Hero: Save the Society</h1><div>Student Mode</div><section class="mf-hud">Mission Mode v1z99 Academic Hero Awakening S1 Rescue Clash</section><section id="eap-student-compact-lobby"><div>STUDENT LOBBY</div><button>Start / Continue</button><div>B1 Boss Gate</div><div>KK · ID 50 · Section 122</div></section><div id="eap-student-15week-roadmap">SESSION 1 Session Passed</div></div>';
  const status=document.createElement('div');status.id='eap-sheet-envelope-status';status.textContent='Sheet: 8 send attempts · S7';document.body.appendChild(status);
  const manual=document.createElement('button');manual.id='eap-sheet-manual-send';manual.textContent='ส่งผลล่าสุดเข้า Sheet';document.body.appendChild(manual);
  window.EAPPhaseAActiveTask={sessionId:'S1',taskId:'stale'};
  window.EAPLobbyRouteIsolation.refresh();
});
await page.waitForTimeout(600);
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
console.log(JSON.stringify({ok:true,qa:`${report.passed}/${report.total}`,initial,tamper,lobbyIsolation},null,2));
await browser.close();
