(()=>{
'use strict';
const RELEASE='20260718-HANDWASH-SUMMARY-WHO10-WATCHDOG-R20';
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
 const completed=rows.filter(x=>!x.mode.includes('ยังไม่ครบ'));
 const rub=rows.filter(x=>['2','3','4','5','6','7'].includes(x.step));
 const completedRub=rub.filter(x=>!x.mode.includes('ยังไม่ครบ'));
 const coachCount=completedRub.filter(x=>/Coach|Assist/i.test(x.mode)).length;
 const rawAcc=parseInt(document.getElementById('sumAccuracy')?.textContent||'0',10)||0;
 const finished=completedRub.length===6 && rows.some(x=>x.step==='8'&&!x.mode.includes('ยังไม่ครบ'));
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
  x.row.dataset.qualityBand=x.quality>=70?'strong':x.quality>=40?'developing':'practice';
 });
 let note=document.getElementById('r8LearningNote');
 if(!note){
  note=document.createElement('div');note.id='r8LearningNote';note.className='delivery';
  document.getElementById('resultList')?.insertAdjacentElement('afterend',note);
 }
 note.textContent=finished?`คะแนนการเรียนรู้ ${learningScore}% • ${stars===3?'พร้อมท้าทายเวลา':stars===2?'ทำครบดีมาก ฝึกท่าที่ Coach ช่วยอีกนิด':'ผ่านครบแล้ว รอบหน้าฝึกท่าที่คะแนนต่ำที่สุด'}`:'ทำต่อให้ครบทุกขั้น แล้ว AI Coach จะสรุปท่าที่ควรฝึก';
 document.documentElement.dataset.handwashSummaryRelease=RELEASE;
}

/* WHO10 Watchdog R20
 * Runtime functions live inside a compiled closure. The public Tap Assist button
 * is the safest supported bridge into completeProcess()/finishRun().
 */
let who10EnteredAt=0;
let watchdogBursts=0;
let burstRunning=false;
function summaryVisible(){return !!document.getElementById('summaryOverlay')?.classList.contains('show');}
function phaseNow(){return document.documentElement.dataset.handwashPhase||'';}
function fireAssistBurst(){
 if(burstRunning||summaryVisible())return;
 const button=document.getElementById('tapBtn');
 if(!button||button.disabled)return;
 burstRunning=true;
 watchdogBursts+=1;
 console.warn('[Handwash R20] WHO10 watchdog assist burst '+watchdogBursts);
 [0,260,520,900].forEach((delay,index)=>setTimeout(()=>{
  if(summaryVisible()||phaseNow()!=='towelFaucet')return;
  button.click();
  if(index===3)burstRunning=false;
 },delay));
 setTimeout(()=>{burstRunning=false;},1300);
}
function watchWho10(){
 const phase=phaseNow();
 if(summaryVisible()){
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
  console.info('[Handwash R20] WHO10 watchdog armed');
  return;
 }
 const elapsed=Date.now()-who10EnteredAt;
 if(elapsed>=5000&&watchdogBursts===0)fireAssistBurst();
 if(elapsed>=8500&&watchdogBursts===1)fireAssistBurst();
 if(elapsed>=12000&&watchdogBursts===2){
  const stop=document.getElementById('stopBtn');
  console.error('[Handwash R20] WHO10 final fallback: stop and show summary');
  stop?.click();
  watchdogBursts=3;
 }
}
setInterval(watchWho10,250);
console.info('[Handwash R20] WHO10 DOM watchdog installed');

new MutationObserver(polish).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
document.addEventListener('DOMContentLoaded',polish,{once:true});
const bridge=document.createElement('script');
bridge.src='./handwash-research-bridge-r18.js?cv=20260718-HANDWASH-RESEARCH-BRIDGE-R18';
bridge.async=false;
bridge.onerror=()=>console.error('[Handwash Research R18] bridge load failed');
document.head.appendChild(bridge);
})();