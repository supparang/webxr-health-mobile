(()=>{
'use strict';
const RELEASE='20260727-HANDWASH-SUMMARY-STRICT-R28';
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
 const passed=result?.passed===true&&rubDone===7&&processDone===5&&wristsPassed;
 const title=document.getElementById('summaryTitle');
 const sub=document.getElementById('summarySub');
 const list=document.getElementById('resultList');
 const delivery=document.getElementById('deliveryText');
 const replay=document.getElementById('replayBtn');
 const zone=document.getElementById('summaryZoneBtn');
 const hero=document.getElementById('summaryHero');
 if(hero)hero.textContent=passed?'🏆':'🧼';
 if(title)title.textContent=passed?'ผ่านครบ 7 ท่าถูมือและกระบวนการทั้งหมด':'ยังไม่ผ่าน Handwash • ต้องครบ 7/7 ท่าถู';
 if(sub)sub.textContent=`ท่าถู ${rubDone}/7 • กระบวนการ ${processDone}/5 • รอบข้อมือ ${wristsPassed?'ผ่าน':'ยังไม่ผ่าน'} • Analytics ${Number(result?.metricCompletenessPct||0)}%`;
 if(list){
  list.innerHTML=steps.map((row,index)=>`<div class="result-row"><span>${index+1}. ${esc(row.label||row.id||'ขั้นตอน')}</span><span>${Math.round(Number(row.quality||0))}%</span><span>${row.completed?'ผ่าน':'ยังไม่ครบ'}</span></div>`).join('');
 }
 const audit=ensureAuditPanel();
 if(audit){
  const missing=Array.isArray(result?.analyticsAudit?.missingMetrics)?result.analyticsAudit.missingMetrics:[];
  audit.innerHTML=`<b>${passed?'✅ พร้อมบันทึกผลอย่างเป็นทางการ':'⛔ ยังไม่ปลดล็อกเกมถัดไป'}</b><br>`+
   `เกณฑ์บังคับ: 7 ท่าถู + 5 ขั้นกระบวนการ + รอบข้อมือ + จบตามลำดับ<br>`+
   `Learning Analytics: ${Number(result?.metricCompletenessPct||0)}%${missing.length?` • ขาด ${esc(missing.join(', '))}`:' • ครบชุดหลัก'}`;
 }
 if(delivery)delivery.textContent=passed?'ข้อมูลพร้อมส่งเข้า HH_Game_Results, HH_Game_Summary, HH_Game_Metrics และ HH_Game_Event_Log':'ผลรอบนี้ไม่ถูกนับว่าผ่าน กรุณากดเล่นอีกครั้ง';
 if(replay)replay.textContent=passed?'เล่นอีกครั้ง':'เล่นใหม่ให้ครบ 7 ขั้น';
 if(zone){zone.textContent=passed?'บันทึกผลและกลับระบบ':'กลับโดยไม่บันทึกว่าผ่าน';zone.style.opacity=passed?'1':'.72';}
 const stop=document.getElementById('stopBtn');
 if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่ผ่าน)';}
 document.documentElement.dataset.handwashStrictPass=passed?'true':'false';
}
window.addEventListener('herohealth:game-result',event=>setTimeout(()=>render(event.detail||{}),0),{capture:false});
document.addEventListener('DOMContentLoaded',()=>{
 const stop=document.getElementById('stopBtn');
 if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่ผ่าน)';}
},{once:true});
document.documentElement.dataset.handwashStrictSummary=RELEASE;
console.info('[Handwash Summary R28] installed');
})();