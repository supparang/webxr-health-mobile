import {readFileSync} from 'node:fs';
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

// Browser-level S1 Reading smoke test: run only with a synthetic QA identity,
// fake Apps Script endpoint and intercepted network. Never touches production.
{
  const isolatedReading = await browser.newContext();
  const qaEndpoint='https://script.google.com/macros/s/QA-BROWSER-READING-SMOKE/exec';
  const cfgSource=readFileSync(new URL('../eap-sheet-config.js',import.meta.url),'utf8');
  const prodEndpoint='https://script.google.com/macros/s/AKfycbzkU4qUEhfHmwZCSifwBY1nX21sktS1hA6KMFC1i3ZG2YZZlbij0JC47ODGxcjkhXYsxA/exec';
  if (!cfgSource.includes(prodEndpoint)) throw new Error('QA fixture could not override the production endpoint');
  const qaConfigSource=cfgSource.replace(prodEndpoint,qaEndpoint).replace("section:'122'", "section:'122-QA'");
  await isolatedReading.route('**/eap-sheet-config.js*',r=>r.fulfill({
    status:200,contentType:'text/javascript',body:qaConfigSource
  }));
  await isolatedReading.route(/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com)\//,r=>r.fulfill({
    status:200,contentType:'text/plain',body:''
  }));
  await isolatedReading.addInitScript(() => {
    try {
      const id={studentId:'QA-OFFLINE-READING',id:'QA-OFFLINE-READING',
        studentName:'Offline QA',name:'Offline QA',section:'122-QA'};
      localStorage.setItem('EAP_HERO_ACTIVE_PLAYER_V1',JSON.stringify(id));
      localStorage.setItem('EAP_HERO_PLAYER_PROFILE_V1',JSON.stringify(id));
      localStorage.setItem('EAP_HERO_PROGRESS_V3',JSON.stringify({profile:id,
        currentSession:1,portfolio:[],sessions:{},sessionScores:{}}));
    } catch (_) {}
  });
  const readingPage=await isolatedReading.newPage();
  await readingPage.goto(base+'?eapqa=1',{waitUntil:'domcontentloaded',timeout:60000});
  await readingPage.waitForFunction(() =>
    !!(window.EAPHero?.submitReading && window.EAPHeroTrustedTransportV124?.diagnostics),
    null,{timeout:60000});
  const readingSmoke=await readingPage.evaluate(async () => {
    const before=window.EAPHeroTrustedTransportV124.diagnostics();
    const seen=[];
    const rejections=[];
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=function(input,init) {
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(String(url).includes('submit_attempt'))seen.push(String(url).slice(0,300));
      return fetchOriginal(input,init).catch(err=>{
        if(String(url).includes('submit_attempt'))rejections.push(String(err));
        throw err;
      });
    };
    window.EAPHero.submitReading(1);
    await new Promise(resolve=>setTimeout(resolve,100));
    const pending=JSON.parse(localStorage.getItem('EAP_HERO_VERIFIED_ATTEMPT_PENDING_V124')||'{}');
    const rows=Object.values(pending);
    return {
      before:before.pending,
      after:window.EAPHeroTrustedTransportV124.diagnostics().pending,
      seenSubmitAttempt:seen,
      submitErrors:rejections,
      identity: {
        active:JSON.parse(localStorage.getItem('EAP_HERO_ACTIVE_PLAYER_V1')||'{}'),
        profile:JSON.parse(localStorage.getItem('EAP_HERO_PLAYER_PROFILE_V1')||'{}'),
        gameState:JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}').profile
      },
      config:window.EAP_SHEET_CONFIG,
      storedReading:(JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}').portfolio||[])
        .filter(r=>r.skill==='Reading').map(r=>({id:r.id,evidenceId:r.evidenceId,score:r.score})),
      attempts:rows.map(row=>({studentId:row.payload?.studentId,
        section:row.payload?.section,skill:row.payload?.skill,
        score:row.payload?.score,evidenceId:row.payload?.evidenceId,
        attemptId:row.payload?.attemptId}))
    };
  });
  if (readingSmoke.before!==0 || readingSmoke.after!==1 ||
      readingSmoke.attempts.length!==1 ||
      readingSmoke.attempts[0].studentId!=='QA-OFFLINE-READING' ||
      readingSmoke.attempts[0].section!=='122-QA' ||
      readingSmoke.attempts[0].skill!=='Reading' ||
      Number(readingSmoke.attempts[0].score)!==100 ||
      readingSmoke.attempts[0].evidenceId!==readingSmoke.attempts[0].attemptId) {
    throw new Error('S1 Reading did not enter offline transport: '+JSON.stringify(readingSmoke));
  }
  console.log('Offline browser S1 Reading -> pending receipt-safe transport: PASS');
  await isolatedReading.close();
}

if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
console.log(JSON.stringify({ok:true,qa:`${report.passed}/${report.total}`,initial,tamper,lobbyIsolation},null,2));
await browser.close();
