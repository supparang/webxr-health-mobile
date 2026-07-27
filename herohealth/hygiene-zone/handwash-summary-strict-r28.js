(()=>{
'use strict';
const RELEASE='20260727-HANDWASH-SUMMARY-COMPLETION-R29';
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function ensureAuditPanel(){
 let panel=document.getElementById('handwashStrictAuditR28');
 if(panel)return panel;
 panel=document.createElement('section');
 panel.id='handwashStrictAuditR28';
 panel.style.cssText='margin:12px 0;padding:12px;border:1px solid rgba(132,226,255,.35);border-radius:14px;background:rgba(2,18,29,.72);font-size:12px;line-height:1.5';
 const list=document.getElementById('resultList');
 list?.parentNode?.insertBefore(panel,list);
 return panel;
}
function render(result){
 const steps=Array.isArray(result?.steps)?result.steps:[];
 const rubDone=Number(result?.completedRubSteps??result?.whoStepsCompleted??0);
 const processDone=Number(result?.completedProcessSteps??0);
 const wristsPassed=result?.wristsPassed===true||steps.some(row=>String(row.id||'')==='wrists'&&row.completed===true);
 const completed=result?.completed===true&&rubDone===7&&processDone===5&&wristsPassed;
 const skillPassed=result?.passed===true;
 const analyticsReady=Number(result?.metricCompletenessPct||0)>=90;
 const progressionEligible=completed&&analyticsReady;
 const title=document.getElementById('summaryTitle');
 const sub=document.getElementById('summarySub');
 const list=document.getElementById('resultList');
 const delivery=document.getElementById('deliveryText');
 const replay=document.getElementById('replayBtn');
 const zone=document.getElementById('summaryZoneBtn');
 const hero=document.getElementById('summaryHero');
 if(hero)hero.textContent=progressionEligible?'🏆':'🧼';
 if(title)title.textContent=progressionEligible?'ทำ Handwash ครบ 7 ท่าถูและครบทุกกระบวนการ':'Handwash ยังไม่ครบ 7 ท่าถูและ 5 ขั้นกระบวนการ';
 if(sub)sub.textContent=`ท่าถู ${rubDone}/7 • กระบวนการ ${processDone}/5 • รอบข้อมือ ${wristsPassed?'ผ่าน':'ยังไม่ผ่าน'} • Analytics ${Number(result?.metricCompletenessPct||0)}%`;
 if(list){
  list.innerHTML=steps.map((row,index)=>`<div class="result-row"><span>${index+1}. ${esc(row.label||row.id||'ขั้นตอน')}</span><span>${Math.round(Number(row.quality||0))}%</span><span>${row.completed?'ทำครบ':'ยังไม่ครบ'}</span></div>`).join('');
 }
 const audit=ensureAuditPanel();
 if(audit){
  const missing=Array.isArray(result?.analyticsAudit?.missingMetrics)?result.analyticsAudit.missingMetrics:[];
  audit.innerHTML=`<b>${progressionEligible?'✅ พร้อมบันทึกและไปภารกิจถัดไป':'⛔ ยังไม่ปลดล็อกเกมถัดไป'}</b><br>`+
   `เกณฑ์จบภารกิจ: 7 ท่าถู + 5 ขั้นกระบวนการ + รอบข้อมือ + จบตามลำดับ<br>`+
   `ผลทักษะ: ${skillPassed?'ผ่านเกณฑ์':'บันทึกเป็นจุดที่ควรพัฒนา'} • Learning Analytics: ${Number(result?.metricCompletenessPct||0)}%${missing.length?` • ขาด ${esc(missing.join(', '))}`:' • ครบชุดหลัก'}`;
 }
 if(delivery)delivery.textContent=progressionEligible?'ข้อมูลพร้อมส่งเข้า HH_Game_Results, HH_Game_Summary, HH_Game_Metrics และ HH_Game_Event_Log':'ผลรอบนี้ยังไม่ครบกระบวนการ จึงไม่บันทึกเป็นภารกิจสำเร็จ';
 if(replay)replay.textContent=progressionEligible?'เล่นอีกครั้ง':'เล่นใหม่ให้ครบ 7 ขั้น';
 if(zone){zone.textContent=progressionEligible?'บันทึกผลและกลับระบบ':'กลับโดยไม่ปลดล็อกด่านถัดไป';zone.style.opacity=progressionEligible?'1':'.72';}
 const stop=document.getElementById('stopBtn');
 if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}
 document.documentElement.dataset.handwashStrictPass=skillPassed?'true':'false';
 document.documentElement.dataset.handwashProcedureComplete=progressionEligible?'true':'false';
}
window.addEventListener('herohealth:game-result',event=>setTimeout(()=>render(event.detail||{}),0),{capture:false});
document.addEventListener('DOMContentLoaded',()=>{
 const stop=document.getElementById('stopBtn');
 if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}
},{once:true});
document.documentElement.dataset.handwashStrictSummary=RELEASE;
console.info('[Handwash Summary R29] installed');
})();