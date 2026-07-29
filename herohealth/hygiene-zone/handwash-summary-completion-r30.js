(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-SUMMARY-FULLSCREEN-R34';
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function done(row){return row?.completed===true||['strict','grace','assist','pass','passed'].includes(String(row?.passMode||'').toLowerCase());}
function ensureStyle(){
 if(document.getElementById('handwashSummaryFullscreenR34'))return;
 const style=document.createElement('style');style.id='handwashSummaryFullscreenR34';style.textContent=`
 html,body,#app{max-width:100vw!important;overflow-x:hidden!important}
 #summaryOverlay.show{position:fixed!important;z-index:2147482000!important;inset:0!important;width:100dvw!important;height:100dvh!important;display:block!important;padding:8px 8px calc(12px + env(safe-area-inset-bottom,0px))!important;overflow-y:auto!important;overflow-x:hidden!important;background:rgba(1,11,18,.97)!important;backdrop-filter:blur(12px)!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important}
 #summaryOverlay .card{display:block!important;width:min(100%,620px)!important;max-width:620px!important;min-width:0!important;max-height:none!important;margin:0 auto!important;padding:16px 12px calc(18px + env(safe-area-inset-bottom,0px))!important;border-radius:22px!important;overflow:visible!important}
 #summaryOverlay .hero{font-size:42px!important}
 #summaryOverlay h2{font-size:clamp(26px,8vw,38px)!important;line-height:1.25!important}
 #summaryOverlay #summarySub{font-size:14px!important;line-height:1.55!important}
 #summaryOverlay .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
 #summaryOverlay .summary-box{min-width:0!important;padding:11px 8px!important}
 #summaryOverlay .summary-box b{font-size:clamp(22px,7vw,34px)!important;overflow-wrap:anywhere!important}
 #handwashMissingStepsR32,#handwashStrictAuditR30{width:100%!important;max-width:100%!important;overflow-wrap:anywhere!important}
 #summaryOverlay .result-list{display:grid!important;gap:8px!important;max-height:none!important;overflow:visible!important}
 #summaryOverlay .result-row{display:grid!important;grid-template-columns:minmax(0,1fr) 54px 84px!important;gap:8px!important;align-items:center!important;width:100%!important;min-width:0!important;padding:10px!important;border-radius:13px!important;font-size:12px!important;line-height:1.35!important}
 #summaryOverlay .result-row span{min-width:0!important;overflow-wrap:anywhere!important;word-break:normal!important}
 #summaryOverlay .result-row span:nth-child(2),#summaryOverlay .result-row span:nth-child(3){text-align:right!important;white-space:normal!important}
 #summaryOverlay .actions{position:sticky!important;z-index:5!important;bottom:0!important;display:grid!important;grid-template-columns:1fr!important;gap:9px!important;margin:14px -4px 0!important;padding:10px 4px calc(4px + env(safe-area-inset-bottom,0px))!important;background:linear-gradient(180deg,rgba(4,21,33,0),rgba(4,21,33,.96) 24%)!important}
 #summaryOverlay .bigbtn{width:100%!important;min-height:56px!important;padding:10px 14px!important;font-size:18px!important;line-height:1.25!important;white-space:normal!important}
 @media(max-width:430px){
  #summaryOverlay.show{padding-left:6px!important;padding-right:6px!important}
  #summaryOverlay .card{padding-left:10px!important;padding-right:10px!important}
  #summaryOverlay .result-row{grid-template-columns:minmax(0,1fr) 50px!important}
  #summaryOverlay .result-row span:nth-child(3){grid-column:1/-1!important;text-align:left!important;padding-top:2px!important}
 }
 `;document.head.appendChild(style);
}
function ensureAuditPanel(){let panel=document.getElementById('handwashStrictAuditR30');if(panel)return panel;panel=document.createElement('section');panel.id='handwashStrictAuditR30';panel.style.cssText='margin:12px 0;padding:12px;border:1px solid rgba(132,226,255,.35);border-radius:14px;background:rgba(2,18,29,.72);font-size:12px;line-height:1.5';const list=document.getElementById('resultList');list?.parentNode?.insertBefore(panel,list);return panel;}
function ensureMissingPanel(){let panel=document.getElementById('handwashMissingStepsR32');if(panel)return panel;panel=document.createElement('section');panel.id='handwashMissingStepsR32';panel.style.cssText='margin:10px 0;padding:12px;border-radius:14px;font-size:13px;font-weight:850;line-height:1.55;text-align:left';const grid=document.getElementById('summaryGrid');grid?.parentNode?.insertBefore(panel,grid);return panel;}
function labelOf(row,index){return String(row?.label||row?.id||`ขั้น ${index+1}`);}
function render(result){
 ensureStyle();
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
 const passedCount=steps.length-missingRows.length;
 const missingLabels=missingRows.map(row=>labelOf(row,row.__index));
 const title=document.getElementById('summaryTitle'),sub=document.getElementById('summarySub'),list=document.getElementById('resultList'),delivery=document.getElementById('deliveryText'),replay=document.getElementById('replayBtn'),zone=document.getElementById('summaryZoneBtn'),hero=document.getElementById('summaryHero');
 if(hero)hero.textContent=progressionEligible?'🏆':'🧼';
 if(title)title.textContent=progressionEligible?'จบภารกิจ Handwash แล้ว':'Handwash ยังทำไม่ครบ';
 if(sub)sub.textContent=`ทำครบ ${passedCount}/${steps.length||12} ขั้น • ท่าถู ${rubDone}/7 • กระบวนการ ${processDone}/5 • รอบข้อมือ ${wristsPassed?'ผ่าน':'ยังไม่ผ่าน'} • Analytics ${analyticsPct}%`;
 const missingPanel=ensureMissingPanel();
 if(missingPanel){
  missingPanel.style.cssText='margin:10px 0;padding:12px;border-radius:14px;font-size:13px;font-weight:850;line-height:1.55;text-align:left;width:100%;max-width:100%;overflow-wrap:anywhere';
  if(progressionEligible){missingPanel.style.cssText+=';border:2px solid #67eda9;background:rgba(5,91,59,.72);color:#edfff6';missingPanel.innerHTML='<b>✅ ทำครบทุกขั้นแล้ว</b><br>ระบบยืนยันทั้งวิธีทำ กระบวนการ รอบข้อมือ และข้อมูล Analytics';}
  else{missingPanel.style.cssText+=';border:2px solid #ff9bad;background:rgba(105,23,39,.74);color:#fff0f3';missingPanel.innerHTML=`<b>ขั้นที่ยังต้องทำให้ครบ (${missingLabels.length})</b><br>${missingLabels.length?missingLabels.map((name,index)=>`${index+1}. ${esc(name)}`).join('<br>'):'ระบบยังไม่พบหลักฐานครบทุกขั้น'}${!wristsPassed&&!missingLabels.some(x=>/ข้อมือ/.test(x))?'<br>• รอบข้อมือยังไม่ผ่าน':''}${!analyticsReady?`<br>• Analytics ต้องอย่างน้อย 90% (ขณะนี้ ${analyticsPct}%)`:''}`;}
 }
 if(list)list.innerHTML=steps.map((row,index)=>{const ok=done(row);return `<div class="result-row" style="border:1px solid ${ok?'rgba(103,237,169,.35)':'rgba(255,112,137,.55)'};background:${ok?'rgba(5,91,59,.22)':'rgba(105,23,39,.32)'}"><span>${ok?'✅':'❌'} ${index+1}. ${esc(labelOf(row,index))}</span><span>${Math.round(Number(row.quality||0))}%</span><span>${ok?'ทำถูกและครบ':'ยังไม่ครบ'}</span></div>`}).join('');
 const audit=ensureAuditPanel();
 if(audit){const missing=Array.isArray(result?.analyticsAudit?.missingMetrics)?result.analyticsAudit.missingMetrics:[];audit.style.borderColor=progressionEligible?'rgba(103,237,169,.62)':'rgba(255,112,137,.62)';audit.innerHTML=`<b>${progressionEligible?'✅ จบเกมแล้ว • พร้อมไปภารกิจถัดไป':'⛔ ยังไม่จบภารกิจ'}</b><br>เกณฑ์จบเกม: ท่าถู 7/7 + กระบวนการ 5/5 + รอบข้อมือ + Analytics อย่างน้อย 90%<br>ผลทักษะ: ${skillPassed?'ผ่านเกณฑ์':'ควรพัฒนาเพิ่มเติม'} • WHO Accuracy ${Number(result?.accuracy||0)}%${missing.length?` • ขาด ${esc(missing.join(', '))}`:''}`;}
 if(delivery)delivery.textContent=progressionEligible?'ข้อมูลพร้อมบันทึกและปลดล็อกภารกิจถัดไป':'ดูรายชื่อขั้นที่ยังขาด แล้วกดเล่นใหม่พร้อม Step Guide เพื่อทำให้ครบ';
 if(replay)replay.textContent=progressionEligible?'เล่นอีกครั้ง':'เล่นใหม่พร้อม Step Guide';
 if(zone){zone.textContent=progressionEligible?'บันทึกผลและไปภารกิจถัดไป':'กลับโดยไม่ปลดล็อกด่านถัดไป';zone.style.opacity=progressionEligible?'1':'.72';}
 const stop=document.getElementById('stopBtn');if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}
 const overlay=document.getElementById('summaryOverlay');if(overlay){overlay.scrollLeft=0;overlay.scrollTop=0;requestAnimationFrame(()=>{overlay.scrollLeft=0;overlay.scrollTop=0;});}
 document.documentElement.dataset.handwashProcedureComplete=progressionEligible?'true':'false';
 document.documentElement.dataset.handwashSkillPass=skillPassed?'true':'false';
 document.documentElement.dataset.handwashMissingCount=String(missingRows.length);
 document.documentElement.dataset.handwashSummaryFullscreen='R34';
}
window.addEventListener('herohealth:game-result',event=>setTimeout(()=>render(event.detail||{}),0));
document.addEventListener('DOMContentLoaded',()=>{ensureStyle();const stop=document.getElementById('stopBtn');if(stop){const b=stop.querySelector('b');if(b)b.textContent='ยุติรอบ (ไม่จบภารกิจ)';}},{once:true});
document.documentElement.dataset.handwashSummary=RELEASE;console.info('[Handwash Summary R34] fullscreen mobile summary installed');
})();