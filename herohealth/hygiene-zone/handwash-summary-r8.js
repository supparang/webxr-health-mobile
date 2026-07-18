(()=>{
'use strict';
const RELEASE='20260718-HANDWASH-TOP-LAYER-SUMMARY-R24';
const STEP_NAMES={'0':'เปียกมือ','1':'ใช้สบู่','2':'ฝ่ามือ','3':'หลังมือและซอกนิ้ว','4':'ฝ่ามือประสานนิ้ว','5':'หลังนิ้ว','6':'หัวแม่มือ','7':'ปลายนิ้วและเล็บ','8':'ล้างน้ำ','9':'เช็ดมือ','10':'ปิดก๊อกด้วยกระดาษ'};
let who10EnteredAt=0;
let watchdogBursts=0;
let burstRunning=false;
let latestResult=null;
let summaryOpened=false;

function phaseNow(){return document.documentElement.dataset.handwashPhase||'';}
function finishCommitted(){return document.documentElement.dataset.handwashFinish==='committed';}
function text(id,fallback){return (document.getElementById(id)?.textContent||fallback||'').trim();}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function nativeSummaryVisible(){return !!document.getElementById('summaryOverlay')?.classList.contains('show');}
function topSummaryVisible(){const d=document.getElementById('handwashTopLayerSummaryR24');return !!(d&&d.open);}

function parseRows(){
 return [...document.querySelectorAll('#resultList .result-row')].map(row=>{
  const cells=[...row.querySelectorAll('span')];
  const raw=cells[0]?.textContent||'';
  const m=raw.match(/WHO\s*([^•]+)\s*•\s*(.*)/);
  return {step:(m?.[1]||'').trim(),label:(m?.[2]||'').trim(),quality:parseInt(cells[1]?.textContent||'0',10)||0,mode:(cells[2]?.textContent||'').trim()};
 });
}

function resultRows(result){
 if(Array.isArray(result?.steps)&&result.steps.length){
  return result.steps.map(row=>({
   step:String(row.whoStep??row.who_step??row.step??''),
   label:String(row.label||STEP_NAMES[String(row.whoStep??row.step)]||''),
   quality:Number(row.quality||0),
   mode:row.completed?(row.passMode==='strict'?'ผ่านแม่นยำ':row.passMode==='grace'?'ผ่านด้วย AI Coach':'ผ่านด้วยตัวช่วย'):'ยังไม่ครบ'
  }));
 }
 return parseRows();
}

function fireAssistBurst(){
 if(burstRunning||topSummaryVisible())return;
 const button=document.getElementById('tapBtn');
 if(!button||button.disabled)return;
 burstRunning=true;
 watchdogBursts+=1;
 console.warn('[Handwash R24] WHO10 assist burst '+watchdogBursts);
 [0,260,520,900].forEach((delay,index)=>setTimeout(()=>{
  if(topSummaryVisible()||phaseNow()!=='towelFaucet')return;
  button.click();
  if(index===3)burstRunning=false;
 },delay));
 setTimeout(()=>{burstRunning=false;},1300);
}

function watchWho10(){
 if(topSummaryVisible()){who10EnteredAt=0;return;}
 if(phaseNow()!=='towelFaucet'){who10EnteredAt=0;watchdogBursts=0;return;}
 if(!who10EnteredAt){
  who10EnteredAt=Date.now();
  const coach=document.getElementById('coachText');
  if(coach)coach.textContent='WHO 10 • ถือกระดาษแตะกรอบก๊อก ระบบจะสรุปผลให้อัตโนมัติ';
  console.info('[Handwash R24] WHO10 watchdog armed');
  return;
 }
 const elapsed=Date.now()-who10EnteredAt;
 if(elapsed>=4500&&watchdogBursts===0)fireAssistBurst();
 if(elapsed>=8000&&watchdogBursts===1)fireAssistBurst();
}

function ensureDialog(){
 let dialog=document.getElementById('handwashTopLayerSummaryR24');
 if(dialog)return dialog;
 dialog=document.createElement('dialog');
 dialog.id='handwashTopLayerSummaryR24';
 dialog.setAttribute('aria-label','สรุปผล WHO Handwashing');
 dialog.style.cssText='padding:0;border:0;background:transparent;max-width:none;max-height:none;width:100vw;height:100vh;margin:0;overflow:auto;color:#effbff;';
 dialog.innerHTML=`<style>
 #handwashTopLayerSummaryR24::backdrop{background:rgba(1,10,18,.94);backdrop-filter:blur(10px)}
 #handwashTopLayerSummaryR24 .hw24-wrap{min-height:100%;display:grid;place-items:center;padding:18px;background:rgba(1,10,18,.82);font-family:ui-rounded,"Noto Sans Thai","Segoe UI",system-ui,sans-serif}
 #handwashTopLayerSummaryR24 *{box-sizing:border-box}
 #handwashTopLayerSummaryR24 .hw24-card{width:min(800px,96vw);max-height:94vh;overflow:auto;padding:24px;border:1px solid rgba(132,226,255,.38);border-radius:28px;background:linear-gradient(160deg,#0a3044,#061722);box-shadow:0 30px 100px rgba(0,0,0,.75)}
 #handwashTopLayerSummaryR24 .hw24-hero{text-align:center;font-size:56px}
 #handwashTopLayerSummaryR24 h1{margin:4px 0;text-align:center;font-size:clamp(25px,5vw,38px)}
 #handwashTopLayerSummaryR24 .hw24-sub{margin:8px auto 16px;max-width:680px;color:#afd0dc;text-align:center;line-height:1.5;font-weight:700}
 #handwashTopLayerSummaryR24 .hw24-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0}
 #handwashTopLayerSummaryR24 .hw24-box{padding:12px;border-radius:15px;background:rgba(255,255,255,.07);text-align:center}
 #handwashTopLayerSummaryR24 .hw24-box small{display:block;color:#afd0dc}
 #handwashTopLayerSummaryR24 .hw24-box strong{display:block;margin-top:4px;font-size:21px}
 #handwashTopLayerSummaryR24 .hw24-rows{display:grid;gap:6px;max-height:34vh;overflow:auto}
 #handwashTopLayerSummaryR24 .hw24-row{display:grid;grid-template-columns:minmax(0,1fr) 65px 140px;gap:8px;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.055);font-size:12px}
 #handwashTopLayerSummaryR24 .hw24-row b,#handwashTopLayerSummaryR24 .hw24-row em{text-align:right}
 #handwashTopLayerSummaryR24 .hw24-row em{font-style:normal;color:#67eda9}
 #handwashTopLayerSummaryR24 .hw24-delivery{margin:12px 0;padding:10px;border-radius:12px;background:rgba(1,14,23,.7);color:#afd0dc;text-align:center}
 #handwashTopLayerSummaryR24 .hw24-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
 #handwashTopLayerSummaryR24 button{min-height:50px;padding:0 22px;border:0;border-radius:15px;font:inherit;font-weight:900;cursor:pointer;background:#57dfff;color:#052132}
 #handwashTopLayerSummaryR24 button.hw24-soft{border:1px solid rgba(132,226,255,.3);background:rgba(255,255,255,.09);color:#effbff}
 @media(max-width:620px){#handwashTopLayerSummaryR24 .hw24-grid{grid-template-columns:repeat(2,1fr)}#handwashTopLayerSummaryR24 .hw24-row{grid-template-columns:minmax(0,1fr) 55px}#handwashTopLayerSummaryR24 .hw24-row em{grid-column:1/-1;text-align:left}}
 </style><div class="hw24-wrap"><section class="hw24-card"><div class="hw24-hero">🏆</div><h1 id="hw24Title">ผ่านครบ WHO Handwashing 🎉</h1><p id="hw24Sub" class="hw24-sub"></p><div class="hw24-grid"><div class="hw24-box"><small>คะแนน</small><strong id="hw24Score">0</strong></div><div class="hw24-box"><small>ดาว</small><strong id="hw24Stars">⭐</strong></div><div class="hw24-box"><small>WHO Accuracy</small><strong id="hw24Accuracy">0%</strong></div><div class="hw24-box"><small>เวลา</small><strong id="hw24Time">0s</strong></div></div><div id="hw24Rows" class="hw24-rows"></div><div id="hw24Delivery" class="hw24-delivery">กำลังยืนยันข้อมูลกับ Research Sheet</div><div class="hw24-actions"><button id="hw24Replay">เล่นอีกครั้ง</button><button id="hw24Zone" class="hw24-soft">ไป Cooldown / Hygiene Zone</button></div></section></div>`;
 document.body.appendChild(dialog);
 dialog.querySelector('#hw24Replay').addEventListener('click',()=>location.reload());
 dialog.querySelector('#hw24Zone').addEventListener('click',()=>{
  const native=document.getElementById('summaryZoneBtn');
  if(native){native.click();return;}
  const back=document.getElementById('backBtn');
  if(back){back.click();return;}
  location.href='../hygiene-zone.html';
 });
 dialog.addEventListener('cancel',event=>event.preventDefault());
 return dialog;
}

function openTopSummary(result){
 if(summaryOpened&&topSummaryVisible())return;
 const dialog=ensureDialog();
 const rows=resultRows(result);
 const score=result?.score??text('sumScore',text('scoreText','0'));
 const stars=result?.stars!=null?'⭐'.repeat(Math.max(0,Number(result.stars)||0))+'☆'.repeat(Math.max(0,3-(Number(result.stars)||0))):text('sumStars','⭐');
 const accuracy=result?.accuracy!=null?`${Math.round(Number(result.accuracy)||0)}%`:text('sumAccuracy','0%');
 const used=result?.procedureDurationSec!=null?`${Number(result.procedureDurationSec).toFixed(1)}s`:text('sumTime',text('timeText','0s'));
 const completedRub=Number(result?.completedRubSteps??6);
 const towelPassed=result?.towelFaucetPassed!==false;
 const title=result?.passed?'ผ่าน WHO Handwashing Standard 🏆':result?.techniquePassed?'ทำครบ WHO Technique แล้ว 🎉':'สรุปผล WHO Handwashing';
 const sub=`ทำครบ ${completedRub}/6 ท่าถู • ใช้กระดาษปิดก๊อก ${towelPassed?'สำเร็จ':'ควรฝึกเพิ่ม'} • ${esc(result?.mode||'camera-ar')}`;
 dialog.querySelector('#hw24Title').textContent=title;
 dialog.querySelector('#hw24Sub').textContent=sub;
 dialog.querySelector('#hw24Score').textContent=String(score);
 dialog.querySelector('#hw24Stars').textContent=stars||'☆'.repeat(3);
 dialog.querySelector('#hw24Accuracy').textContent=accuracy;
 dialog.querySelector('#hw24Time').textContent=used;
 dialog.querySelector('#hw24Rows').innerHTML=rows.length?rows.map(row=>`<div class="hw24-row"><span>WHO ${esc(row.step)} • ${esc(row.label||STEP_NAMES[row.step]||'')}</span><b>${esc(row.quality)}%</b><em>${esc(row.mode||'ผ่านแล้ว')}</em></div>`).join(''):'<div class="hw24-row"><span>WHO 0–10 เสร็จสิ้น</span><b>✓</b><em>Completed</em></div>';
 dialog.querySelector('#hw24Delivery').textContent=text('deliveryText','บันทึกผลแล้ว และกำลังยืนยันข้อมูลกับ Research Sheet');
 try{
  if(!dialog.open)dialog.showModal();
 }catch(error){
  console.error('[Handwash R24] showModal failed; using open fallback',error);
  dialog.setAttribute('open','');
  dialog.style.setProperty('display','block','important');
  dialog.style.setProperty('position','fixed','important');
  dialog.style.setProperty('inset','0','important');
  dialog.style.setProperty('z-index','2147483647','important');
 }
 summaryOpened=true;
 document.documentElement.dataset.handwashTopSummary='open';
 console.info('[Handwash R24] TOP-LAYER SUMMARY OPENED',dialog.open,getComputedStyle(dialog).display);
}

window.addEventListener('herohealth:game-result',event=>{
 latestResult=event.detail||latestResult;
 openTopSummary(latestResult);
},{capture:true});

function poll(){
 watchWho10();
 if((finishCommitted()||nativeSummaryVisible())&&!topSummaryVisible())openTopSummary(latestResult);
}
setInterval(poll,160);
new MutationObserver(poll).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-handwash-finish']});
document.addEventListener('DOMContentLoaded',()=>{ensureDialog();poll();},{once:true});
console.info('[Handwash R24] browser top-layer summary installed');

const bridge=document.createElement('script');
bridge.src='./handwash-research-bridge-r18.js?cv=20260718-HANDWASH-RESEARCH-BRIDGE-R18';
bridge.async=false;
bridge.onerror=()=>console.error('[Handwash Research R18] bridge load failed');
document.head.appendChild(bridge);
})();