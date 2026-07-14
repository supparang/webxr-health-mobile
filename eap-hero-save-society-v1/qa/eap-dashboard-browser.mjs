import { chromium } from 'playwright';
const base=process.env.EAP_LOCAL_URL||'http://127.0.0.1:4173/eap-hero-save-society-v1/teacher-dashboard-fast.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('https://script.google.com/**',route=>route.abort());
await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.EAPProgressiveDashboard,null,{timeout:60000});
const result=await page.evaluate(()=>window.EAPProgressiveDashboard.injectForTest({
  section:'122',
  roster:[
    {studentId:'50',studentName:'KK',section:'122',status:'active',avgBestScore:91},
    {studentId:'2',studentName:'KAT',section:'122',status:'review',avgBestScore:45}
  ],
  records:{
    '50':[
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
    ],
    '2':[
      {sessionId:'S1',skill:'Reading',bestScore:0,latestScore:0,passed:false},
      {sessionId:'S1',skill:'Speaking',bestScore:100,latestScore:100,passed:true}
    ]
  },
  word:[{studentId:'50',studentName:'KK',sessionId:'S1',sessionTitle:'Word Quest S1',bestAccuracy:88,bestScore:88,attempts:2,passed:true}]
}));
if(result.learners!==2)throw new Error('learner metric failed '+JSON.stringify(result));
if(result.pending!==1)throw new Error('boss pending metric failed '+JSON.stringify(result));
if(result.both!==1)throw new Error('both-game metric failed '+JSON.stringify(result));
const snapshot=await page.evaluate(()=>({
  cards:document.getElementById('cards').innerText,
  status:document.getElementById('statusText').innerText,
  rows:document.querySelectorAll('#body tr').length,
  kk:[...document.querySelectorAll('#body tr')].find(x=>x.innerText.includes('KK'))?.innerText||''
}));
if(snapshot.cards.includes('—'))throw new Error('dashboard cards still blank '+JSON.stringify(snapshot));
if(!snapshot.kk.includes('B1'))throw new Error('KK route not B1 '+JSON.stringify(snapshot));
await page.click('[data-tab="boss"]');
const bossText=await page.locator('#body').innerText();
if(!bossText.includes('pending_teacher_review')||!bossText.includes('รอตรวจ'))throw new Error('Boss review tab failed '+bossText);
if(errors.length)throw new Error('Page errors: '+errors.join(' | '));
console.log(JSON.stringify({ok:true,result,snapshot,bossText},null,2));
await browser.close();
