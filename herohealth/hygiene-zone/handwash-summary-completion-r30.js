(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-SUMMARY-MISSING-STEPS-R32';
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function done(row){return row?.completed===true||['strict','grace','assist','pass','passed'].includes(String(row?.passMode||'').toLowerCase());}
function ensureAuditPanel(){let panel=document.getElementById('handwashStrictAuditR30');if(panel)return panel;panel=document.createElement('section');panel.id='handwashStrictAuditR30';panel.style.cssText='margin:12px 0;padding:12px;border:1px solid rgba(132,226,255,.35);border-radius:14px;background:rgba(2,18,29,.72);font-size:12px;line-height:1.5';const list=document.getElementById('resultList');list?.parentNode?.insertBefore(panel,list);return panel;}
function ensureMissingPanel(){let panel=document.getElementById('handwashMissingStepsR32');if(panel)return panel;panel=document.createElement('section');panel.id='handwashMissingStepsR32';panel.style.cssText='margin:10px 0;padding:12px;border-radius:14px;font-size:13px;font-weight:850;line-height:1.55;text-align:left';const grid=document.getElementById('summaryGrid');grid?.parentNode?.insertBefore(panel,grid);return panel;}
function labelOf(row,index){return String(row?.label||row?.id||`ขั้น ${index+1}`);}
function render(result){
 const steps=Array.isArray(result?.steps)?result.steps:[];
 const rubDone=Number(result?.completedRubSteps??result?.whoStepsCompleted??steps.filter(x=>String(x.group||x.kind||'').includes('rub')&&done(x)).length);
 const processDone=Number(result?.completedProcessSteps??steps.filter(x=>String(x.group||x.kind||'')==='process'&&done(x)).length);
 const wrist=steps.find(row=>String(row?.id||'').toLowerCase()==='wrists'||/ข้อมือ/.test(String(row?.label||'')));
 const wristsPassed=result?.wristsPassed===true||done(wrist);
 const analyticsPct=Number(result?.metricCompletenessPct||0);
 const completed=rubDone===7&&processDone===5&&wristsPassed;
 const analyticsReady=analyticsPct>=90;
 const progressionEligible=completed&&analyticsReady;
 const skillPassed=result?.passed===true;
 const missingRows=steps.map((row,index)=>({...row,__index:index})).filter(row=>!done(row));
 const missingLabels=missingRows.map(row=>labelOf(row,row.__index));
 const title=document.getElementById('summaryTitle'),sub=document.getElementById('summarySub'),list=document.getElementById('resultList'),delivery=document.getElementById('deliveryText'),replay=document.getElementById('replayBtn'),zone=document.getElementById('summaryZoneBtn'),hero=document.getElementById('summaryHero');
 if(hero)hero.textContent=progressionEligible?'🏆':'🧼';
 if(title)title.textContent=progressionEligible?'จบภารกิจ Handwash แล้ว':'Handwash ยังทำไม่ครบ';
 if(sub)sub.textContent=`ท่าถู ${rubDone}/7 • กระบวนการ ${processDone}/5 • รอบข้อมือ ${wristsPassed?'ผ่าน':'ยังไม่ผ่าน'} • Analytics ${analyticsPct}%`;
 const missingPanel=ensureMissingPanel();
 if(missingPanel){
  if(progressionEligible){missingPanel.style.cssText+=';border:2px solid #67eda9;background:rgba(5,91,59,.72);color:#edfff6';missingPanel.innerHTML='<b>✅ ทำครบทุกขั้นแล้ว</b><br>ระบบยืนยันทั้งวิธีทำ กระบวนการ รอบข้อมือ และข้อมูล Analytics';}
  else{missingPanel.style.cssText+=';border:2px solid #ff9bad;background:rgba(105,23,39,.74);color:#fff0f3';missingPanel.innerHTML=`<b>ขั้นที่ยังต้องทำให้ครบ</b><br>${missingLabels.length?missingLabels.map((name,index)=>`${index+1}. ${esc(name)}`).join('<br>'):'ระบบยังไม่พบหลักฐานครบทุกขั้น'}${!wristsPassed&&!missingLabels.some(x=>/ข้อมือ/.test(x))?'<br>• รอบข้อมือยังไม่ผ่าน':''}${!analyticsReady?`<br>• Analytics ต้องอย่างน้อย 90% (ขณะนี้ ${analyticsPct}%)`:''}`;}
 }
 if(list)list.innerHTML=steps.map((row,index)=>{const ok=done(row);return `<div class="result-row" style="border:1px solid ${ok?'rgba(103,237,169,.35)':'rgba(255,112,137,.55)'};background:${ok?'rgba(5,91,59,.22)':'rgba(105,23,39,.32)'}"><span>${ok?'✅':'❌'} ${index+1}. ${esc(labelOf(row,index))}</span><span>${Math.round(Number(row.quality||0))}%</span><span>${ok?'ทำถูกและครบ':'ยังไม่ครบ'}</span></div>`}).join('');
 const audit=ensureAuditPanel();
 if(audit){const missing=Array.isArray(result?.analyticsAudit?.missingMetrics)?result.analyticsAudit.missingMetrics:[];audit.style.borderColor=progressionEligible?'rgba(103,237,169,.62)':'rgba(255,112,137,.62)';audit.innerHTML=`<b>${progressionEligible?'✅ จบเกมแล้ว • พร้อมไปภารกิจถัดไป':'⛔ ยังไม่จบภารกิจ'}</b><br>เกณฑ์จบเกม: ท่าถู 7/7 + กระบวนการ 5/5 + รอบข้อมือ + Analytics อย่างน้อย 90%<br>ผลทักษะ: ${skillPassed?'ผ่านเกณฑ์':'ควรพัฒนาเพิ่มเติม'} • WHO Accuracy ${Number(result?.accuracy||0)}%${missing.length?` • ขาด ${esc(missing.join(', '))}`:''}`;}
 if(delivery)delivery.textContent=progressionEligible?'ข้อมูลพร้อมบันทึกและปลดล็อกภารกิจถัดไป':'ดูรายชื่อขั้นที่ยังขาดด้านบน แล้วกดเล่นใหม่เพื่อทำเฉพาะขั้นให้ครบ';
 if(replay)replay.textContent=progressionEligible?'เล่นอีกครั้ง':'เล่นใหม่พร้อม Step Guide';
 if(zone){zone.textContent=progressionEligible?'บันทึกผลและไปภารกิจถัดไป':'กลับโดยไม่ปลดล็อกด่านถัดไป';zone.style.opacity=progressionEligible?'1':'.72';}
 const stop=document.getElementById('stopBtn');if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}
 document.documentElement.dataset.handwashProcedureComplete=progressionEligible?'true':'false';
 document.documentElement.dataset.handwashSkillPass=skillPassed?'true':'false';
 document.documentElement.dataset.handwashMissingCount=String(missingRows.length);
}
window.addEventListener('herohealth:game-result',event=>setTimeout(()=>render(event.detail||{}),0));
document.addEventListener('DOMContentLoaded',()=>{const stop=document.getElementById('stopBtn');if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}},{once:true});
document.documentElement.dataset.handwashSummary=RELEASE;console.info('[Handwash Summary R32] exact missing-step summary installed');
})();