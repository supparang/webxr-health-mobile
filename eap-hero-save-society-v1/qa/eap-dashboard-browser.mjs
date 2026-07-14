import { chromium } from 'playwright';
const root=process.env.EAP_LOCAL_URL||'http://127.0.0.1:4173/eap-hero-save-society-v1/teacher-dashboard-fast.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('https://script.google.com/**',async route=>{
  const u=new URL(route.request().url());
  const action=u.searchParams.get('action')||'';
  const cb=u.searchParams.get('callback')||'callback';
  const js=data=>`${cb}(${JSON.stringify(data)});`;
  if(action==='teacher_students')return route.abort('failed');
  if(action==='eap_word_summary')return route.fulfill({status:200,contentType:'application/javascript',body:js({ok:true,summaries:[{studentId:'50',studentName:'KK',section:'122',sessionId:'S1',sessionTitle:'Word Quest S1',bestAccuracy:88,bestScore:88,attempts:2,passed:true,lastPlayed:'2026-07-14T12:00:00+07:00'}]})});
  if(action==='player_resume')return route.fulfill({status:200,contentType:'application/javascript',body:js({ok:true,records:[
    {sessionId:'S1',skill:'Reading',bestScore:100,latestScore:100,passed:true},
    {sessionId:'S1',skill:'Speaking',bestScore:100,latestScore:100,passed:true},
    {sessionId:'S2',skill:'Reading',bestScore:100,latestScore:100,passed:true},
    {sessionId:'S2',skill:'Writing',bestScore:61,latestScore:61,passed:true},
    {sessionId:'S3',skill:'Reading',bestScore:100,latestScore:100,passed:true},
    {sessionId:'S3',skill:'Writing',bestScore:88,latestScore:88,passed:true},
    {sessionId:'B1',skill:'Reading',bestScore:100,passed:true},
    {sessionId:'B1',skill:'Listening',bestScore:100,passed:true},
    {sessionId:'B1',skill:'Writing',bestScore:94,passed:true},
    {sessionId:'B1',skill:'Speaking',bestScore:93,passed:true,teacherReviewRequired:true,teacherReviewStatus:'pending_teacher_review'}
  ]})});
  return route.abort('failed');
});
await page.goto(root+'?eapDashboardQa=1',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.EAPProgressiveDashboard&&window.EAPProgressiveDashboard.metrics().learners===1&&window.EAPProgressiveDashboard.metrics().both===1,null,{timeout:15000});
await page.waitForFunction(()=>document.getElementById('statusText').innerText.includes('Hero roster'),null,{timeout:10000});
const result=await page.evaluate(()=>window.EAPProgressiveDashboard.metrics());
if(result.learners!==1||result.both!==1||result.pending!==1||result.wordAvg!==88)throw new Error('word-first metrics failed '+JSON.stringify(result));
const snapshot=await page.evaluate(()=>({cards:document.getElementById('cards').innerText,status:document.getElementById('statusText').innerText,rows:document.getElementById('body').innerText}));
if(snapshot.cards.includes('ผู้เรียนทั้งหมด\n0'))throw new Error('dashboard remained at zero '+JSON.stringify(snapshot));
if(!snapshot.rows.includes('KK')||!snapshot.rows.includes('B1'))throw new Error('KK word-first row missing '+JSON.stringify(snapshot));
if(!snapshot.status.includes('Hero roster'))throw new Error('roster fallback warning missing '+JSON.stringify(snapshot));
await page.click('[data-tab="boss"]');
const bossText=await page.locator('#body').innerText();
if(!bossText.includes('pending_teacher_review')||!bossText.includes('รอตรวจ'))throw new Error('Boss review tab failed '+bossText);
if(errors.length)throw new Error('Page errors: '+errors.join(' | '));
console.log(JSON.stringify({ok:true,result,snapshot,bossText},null,2));
await browser.close();