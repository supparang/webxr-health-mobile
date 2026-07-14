import { chromium } from 'playwright';

const root=process.env.EAP_LOCAL_URL||'http://127.0.0.1:4173/eap-hero-save-society-v1/teacher-dashboard-fast.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];
let launchedUrl='';

page.on('pageerror',error=>errors.push(String(error)));
await page.route('https://script.google.com/**',async route=>{
  launchedUrl=route.request().url();
  await route.fulfill({
    status:200,
    contentType:'text/html; charset=utf-8',
    body:'<!doctype html><title>EAP Analytics</title><h1 id="appsScriptDashboard">EAP Analytics Apps Script</h1>'
  });
});

await page.goto(root+'?qa=1',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.EAP_ANALYTICS_LAUNCHER&&window.EAP_ANALYTICS_LAUNCHER.target,{timeout:10000});
const launcher=await page.evaluate(()=>window.EAP_ANALYTICS_LAUNCHER);
await page.waitForSelector('#appsScriptDashboard',{timeout:10000});

const target=new URL(launcher.target);
if(target.hostname!=='script.google.com')throw new Error('Launcher host is not Apps Script: '+launcher.target);
if(target.searchParams.get('action')!=='eap_teacher_dashboard')throw new Error('Launcher action is not canonical dashboard: '+launcher.target);
if(target.searchParams.get('section')!=='122')throw new Error('Launcher section is not 122: '+launcher.target);
if(!launchedUrl.includes('action=eap_teacher_dashboard'))throw new Error('Browser did not navigate to Apps Script dashboard: '+launchedUrl);
if(/teacher_students|eap_word_summary|player_resume/.test(launchedUrl))throw new Error('Launcher still calls cross-domain data APIs: '+launchedUrl);
if(errors.length)throw new Error('Page errors: '+errors.join(' | '));

console.log(JSON.stringify({ok:true,launcher,launchedUrl},null,2));
await browser.close();
