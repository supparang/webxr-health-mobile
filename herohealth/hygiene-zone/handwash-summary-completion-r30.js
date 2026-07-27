(()=>{
'use strict';
const RELEASE='20260727-HANDWASH-SUMMARY-COMPLETION-R30';
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function ensureAuditPanel(){let panel=document.getElementById('handwashStrictAuditR30');if(panel)return panel;panel=document.createElement('section');panel.id='handwashStrictAuditR30';panel.style.cssText='margin:12px 0;padding:12px;border:1px solid rgba(132,226,255,.35);border-radius:14px;background:rgba(2,18,29,.72);font-size:12px;line-height:1.5';const list=document.getElementById('resultList');list?.parentNode?.insertBefore(panel,list);return panel;}
function render(result){
 const steps=Array.isArray(result?.steps)?result.steps:[];
 const rubDone=Number(result?.completedRubSteps??result?.whoStepsCompleted??steps.filter(x=>String(x.group||x.kind||'').includes('rub')&&x.completed).length);
 const processDone=Number(result?.completedProcessSteps??steps.filter(x=>String(x.group||x.kind||'')==='process'&&x.completed).length);
 const wristsPassed=result?.wristsPassed===true||steps.some(row=>String(row.id||'')==='wrists'&&row.completed===true);
 const analyticsPct=Number(result?.metricCompletenessPct||0);
 const completed=rubDone===7&&processDone===5&&wristsPassed;
 const analyticsReady=analyticsPct>=90;
 const progressionEligible=completed&&analyticsReady;
 const skillPassed=result?.passed===true;
 const title=document.getElementById('summaryTitle'),sub=document.getElementById('summarySub'),list=document.getElementById('resultList'),delivery=document.getElementById('deliveryText'),replay=document.getElementById('replayBtn'),zone=document.getElementById('summaryZoneBtn'),hero=document.getElementById('summaryHero');
 if(hero)hero.textContent=progressionEligible?'🏆':'🧼';
 if(title)title.textContent=progressionEligible?'จบภารกิจ Handwash แล้ว':'Handwash ยังทำไม่ครบ';
 if(sub)sub.textContent=`ท่าถู ${rubDone}/7 • กระบวนการ ${processDone}/5 • รอบข้อมือ ${wristsPassed?'ผ่าน':'ยังไม่ผ่าน'} • Analytics ${analyticsPct}%`;
 if(list)list.innerHTML=steps.map((row,index)=>`<div class="result-row"><span>${index+1}. ${esc(row.label||row.id||'ขั้นตอน')}</span><span>${Math.round(Number(row.quality||0))}%</span><span>${row.completed?'ทำครบ':'ยังไม่ครบ'}</span></div>`).join('');
 const audit=ensureAuditPanel();
 if(audit){const missing=Array.isArray(result?.analyticsAudit?.missingMetrics)?result.analyticsAudit.missingMetrics:[];audit.innerHTML=`<b>${progressionEligible?'✅ จบเกมแล้ว • พร้อมไปภารกิจถัดไป':'⛔ ยังไม่จบภารกิจ'}</b><br>เกณฑ์จบเกม: ท่าถู 7/7 + กระบวนการ 5/5 + รอบข้อมือ + Analytics อย่างน้อย 90%<br>ผลทักษะ: ${skillPassed?'ผ่านเกณฑ์':'ควรพัฒนาเพิ่มเติม'} • WHO Accuracy ${Number(result?.accuracy||0)}%${missing.length?` • ขาด ${esc(missing.join(', '))}`:''}`;}
 if(delivery)delivery.textContent=progressionEligible?'ข้อมูลพร้อมบันทึกและปลดล็อกภารกิจถัดไป':'ผลรอบนี้ยังไม่ครบ จึงยังไม่ปลดล็อกภารกิจถัดไป';
 if(replay)replay.textContent=progressionEligible?'เล่นอีกครั้ง':'เล่นใหม่ให้ครบ';
 if(zone){zone.textContent=progressionEligible?'บันทึกผลและไปภารกิจถัดไป':'กลับโดยไม่ปลดล็อกด่านถัดไป';zone.style.opacity=progressionEligible?'1':'.72';}
 const stop=document.getElementById('stopBtn');if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}
 document.documentElement.dataset.handwashProcedureComplete=progressionEligible?'true':'false';
 document.documentElement.dataset.handwashSkillPass=skillPassed?'true':'false';
}
window.addEventListener('herohealth:game-result',event=>setTimeout(()=>render(event.detail||{}),0));
document.addEventListener('DOMContentLoaded',()=>{const stop=document.getElementById('stopBtn');if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}},{once:true});
document.documentElement.dataset.handwashSummary=RELEASE;console.info('[Handwash Summary R30] installed');
})();