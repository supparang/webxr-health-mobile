(()=>{
'use strict';
const RELEASE='20260718-HANDWASH-SUMMARY-PORTAL-R23';
const STEP_NAMES={
'0':'เปียกมือ','1':'ใช้สบู่','2':'ฝ่ามือ','3':'หลังมือและซอกนิ้ว','4':'ฝ่ามือประสานนิ้ว','5':'หลังนิ้ว','6':'หัวแม่มือ','7':'ปลายนิ้วและเล็บ','8':'ล้างน้ำ','9':'เช็ดมือ','10':'ปิดก๊อกด้วยกระดาษ'
};
function parseRows(){
 return [...document.querySelectorAll('#resultList .result-row')].map(row=>{
  const cells=[...row.querySelectorAll('span')];
  const text=cells[0]?.textContent||'';
  const m=text.match(/WHO\s*([^•]+)\s*•\s*(.*)/);
  const q=parseInt(cells[1]?.textContent||'0',10)||0;
  const mode=(cells[2]?.textContent||'').trim();
  return {row,cells,step:(m?.[1]||'').trim(),label:(m?.[2]||'').trim(),quality:q,mode};
 });
}
function polish(){
 const overlay=document.getElementById('summaryOverlay');
 if(!overlay?.classList.contains('show'))return;
 const rows=parseRows();
 if(!rows.length)return;
 const rub=rows.filter(x=>['2','3','4','5','6','7'].includes(x.step));
 const completedRub=rub.filter(x=>!x.mode.includes('ยังไม่ครบ'));
 const coachCount=completedRub.filter(x=>/Coach|Assist/i.test(x.mode)).length;
 const rawAcc=parseInt(document.getElementById('sumAccuracy')?.textContent||'0',10)||0;
 const finished=completedRub.length===6&&rows.some(x=>x.step==='8'&&!x.mode.includes('ยังไม่ครบ'));
 const learningScore=Math.round(Math.min(100,rawAcc*.62+(completedRub.length/6)*28+(finished?10:0)));
 const stars=finished?(learningScore>=88?3:learningScore>=70?2:1):0;
 const starEl=document.getElementById('sumStars');
 if(starEl)starEl.textContent='⭐'.repeat(stars)+'☆'.repeat(3-stars);
 const title=document.getElementById('summaryTitle');
 if(title&&finished)title.textContent=stars>=3?'สุดยอด! เชี่ยวชาญ WHO Handwashing 🏆':stars===2?'ผ่านครบและทำได้ดีมาก 🌟':'ผ่านครบ WHO Handwashing 🎉';
 const sub=document.getElementById('summarySub');
 const weak=[...rub].sort((a,b)=>a.quality-b.quality).slice(0,2);
 if(sub&&finished){
  sub.textContent=coachCount?`ผ่านครบ 6/6 ท่าถู • AI Coach ช่วย ${coachCount} ท่า • รอบหน้าเน้น ${weak.map(x=>STEP_NAMES[x.step]||x.label).join(' และ ')}`:'ผ่านครบ 6/6 ท่าถูแบบ Strict • พร้อมลองโหมด Challenge';
 }
 rows.forEach(x=>{
  if(x.mode.includes('ยังไม่ครบ'))return;
  const label=x.mode==='Strict'?'ผ่านแม่นยำ':/Coach/i.test(x.mode)?'ผ่านด้วย AI Coach':/Assist/i.test(x.mode)?'ผ่านด้วยตัวช่วย':'ผ่านแล้ว';
  if(x.cells[2])x.cells[2].textContent=label;
 });
 document.documentElement.dataset.handwashSummaryRelease=RELEASE;
}

let who10EnteredAt=0;
let watchdogBursts=0;
let burstRunning=false;
function nativeSummaryVisible(){return !!document.getElementById('summaryOverlay')?.classList.contains('show');}
function portalVisible(){return !!document.getElementById('handwashSummaryPortalR23');}
function phaseNow(){return document.documentElement.dataset.handwashPhase||'';}
function fireAssistBurst(){
 if(burstRunning||nativeSummaryVisible()||portalVisible())return;
 const button=document.getElementById('tapBtn');
 if(!button||button.disabled)return;
 burstRunning=true;
 watchdogBursts+=1;
 console.warn('[Handwash R23] WHO10 assist burst '+watchdogBursts);
 [0,260,520,900].forEach((delay,index)=>setTimeout(()=>{
  if(nativeSummaryVisible()||portalVisible()||phaseNow()!=='towelFaucet')return;
  button.click();
  if(index===3)burstRunning=false;
 },delay));
 setTimeout(()=>{burstRunning=false;},1300);
}
function watchWho10(){
 const phase=phaseNow();
 if(nativeSummaryVisible()||portalVisible()){
  who10EnteredAt=0;
  return;
 }
 if(phase!=='towelFaucet'){
  who10EnteredAt=0;
  watchdogBursts=0;
  return;
 }
 if(!who10EnteredAt){
  who10EnteredAt=Date.now();
  const coach=document.getElementById('coachText');
  if(coach)coach.textContent='WHO 10 • ถือกระดาษแตะกรอบก๊อก ระบบจะจบให้อัตโนมัติหากตรวจจับยาก';
  console.info('[Handwash R23] WHO10 watchdog armed');
  return;
 }
 const elapsed=Date.now()-who10EnteredAt;
 if(elapsed>=5000&&watchdogBursts===0)fireAssistBurst();
 if(elapsed>=8500&&watchdogBursts===1)fireAssistBurst();
}

function text(id,fallback){return (document.getElementById(id)?.textContent||fallback||'').trim();}
function esc(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function buildPortal(){
 if(portalVisible())return;
 const committed=document.documentElement.dataset.handwashFinish==='committed';
 const nativeShown=nativeSummaryVisible();
 if(!committed&&!nativeShown)return;
 polish();
 const rows=parseRows();
 const score=text('sumScore',text('scoreText','0'));
 const stars=text('sumStars','⭐');
 const accuracy=text('sumAccuracy','0%');
 const used=text('sumTime',text('timeText','0s'));
 const title=text('summaryTitle','ผ่านครบ WHO Handwashing 🎉');
 const sub=text('summarySub','ทำครบ 6/6 ท่าถู และใช้กระดาษปิดก๊อกสำเร็จ');
 const delivery=text('deliveryText','กำลังยืนยันข้อมูลกับ Research Sheet');
 const host=document.createElement('div');
 host.id='handwashSummaryPortalR23';
 host.setAttribute('role','dialog');
 host.setAttribute('aria-modal','true');
 host.style.cssText='all:initial;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;';
 const shadow=host.attachShadow({mode:'open'});
 const rowHtml=rows.length?rows.map(row=>`<div class="row"><span>WHO ${esc(row.step)} • ${esc(row.label)}</span><b>${esc(row.quality)}%</b><em>${esc(row.mode||'ผ่านแล้ว')}</em></div>`).join(''):'<div class="row"><span>WHO 0–10 เสร็จสิ้น</span><b>✓</b><em>Completed</em></div>';
 shadow.innerHTML=`<style>
 :host{font-family:ui-rounded,"Noto Sans Thai","Segoe UI",system-ui,sans-serif;color:#effbff}
 *{box-sizing:border-box}.veil{position:fixed;inset:0;display:grid;place-items:center;padding:18px;background:rgba(1,10,18,.93);overflow:auto}.card{width:min(780px,96vw);max-height:94vh;overflow:auto;padding:24px;border:1px solid rgba(132,226,255,.36);border-radius:28px;background:linear-gradient(160deg,#0a3044,#061722);box-shadow:0 24px 80px rgba(0,0,0,.65)}.hero{text-align:center;font-size:54px}h1{margin:4px 0;text-align:center;font-size:clamp(25px,5vw,38px)}.sub{margin:8px auto 16px;max-width:650px;color:#afd0dc;text-align:center;line-height:1.5;font-weight:700}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0}.box{padding:12px;border-radius:15px;background:rgba(255,255,255,.07);text-align:center}.box small{display:block;color:#afd0dc}.box strong{display:block;margin-top:4px;font-size:21px}.rows{display:grid;gap:6px;max-height:32vh;overflow:auto}.row{display:grid;grid-template-columns:minmax(0,1fr) 65px 130px;gap:8px;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.055);font-size:12px}.row b,.row em{text-align:right}.row em{font-style:normal;color:#67eda9}.delivery{margin:12px 0;padding:10px;border-radius:12px;background:rgba(1,14,23,.7);color:#afd0dc;text-align:center}.actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}button{min-height:50px;padding:0 22px;border:0;border-radius:15px;font:inherit;font-weight:900;cursor:pointer;background:#57dfff;color:#052132}.soft{border:1px solid rgba(132,226,255,.3);background:rgba(255,255,255,.09);color:#effbff}@media(max-width:620px){.grid{grid-template-columns:repeat(2,1fr)}.row{grid-template-columns:minmax(0,1fr) 55px}.row em{grid-column:1/-1;text-align:left}}
 </style><div class="veil"><section class="card"><div class="hero">🏆</div><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p><div class="grid"><div class="box"><small>คะแนน</small><strong>${esc(score)}</strong></div><div class="box"><small>ดาว</small><strong>${esc(stars)}</strong></div><div class="box"><small>WHO Accuracy</small><strong>${esc(accuracy)}</strong></div><div class="box"><small>เวลา</small><strong>${esc(used)}</strong></div></div><div class="rows">${rowHtml}</div><div class="delivery">${esc(delivery)}</div><div class="actions"><button id="replay">เล่นอีกครั้ง</button><button id="zone" class="soft">ไป Cooldown / Hygiene Zone</button></div></section></div>`;
 shadow.getElementById('replay').addEventListener('click',()=>location.reload());
 shadow.getElementById('zone').addEventListener('click',()=>{
  const native=document.getElementById('summaryZoneBtn');
  if(native){native.click();return;}
  const back=document.getElementById('backBtn');
  if(back){back.click();return;}
  location.href='../hygiene-zone.html';
 });
 document.documentElement.appendChild(host);
 document.documentElement.dataset.handwashPortal='visible';
 console.info('[Handwash R23] independent summary portal opened',rows.length);
}

setInterval(()=>{watchWho10();buildPortal();},200);
new MutationObserver(()=>{polish();buildPortal();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-handwash-finish']});
document.addEventListener('DOMContentLoaded',()=>{polish();buildPortal();},{once:true});
console.info('[Handwash R23] independent Shadow DOM summary portal installed');
const bridge=document.createElement('script');
bridge.src='./handwash-research-bridge-r18.js?cv=20260718-HANDWASH-RESEARCH-BRIDGE-R18';
bridge.async=false;
bridge.onerror=()=>console.error('[Handwash Research R18] bridge load failed');
document.head.appendChild(bridge);
})();