/* CSAI2102 AI Quest — Reflection Direct Submit v7.3.0
   Guarantees a dedicated idempotent Reflection attempt is dispatched before
   studentGate polling. A second dispatch reuses the same attemptId, so transient
   network loss is repaired without creating duplicate official attempts.
*/
(()=>{'use strict';
if(window.AIQuestReflectionDirectSubmitV730)return;
const VERSION='v7.3.0';
const $=id=>document.getElementById(id);
const clean=v=>String(v==null?'':v).trim();
const norm=x=>clean(x).toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const mission=()=>norm(new URL(location.href).searchParams.get('mission')||'s1');
const score=()=>Number(clean($('score')&&$('score').textContent).replace(/[^0-9.]/g,''))||0;
const threshold=id=>id==='b5'?75:id==='b4'?70:60;
function answers(){return[clean($('r1')&&$('r1').value),clean($('r2')&&$('r2').value),clean($('r3')&&$('r3').value)]}
function visibleCaseSelect(){
 const preferred=['s2EvidenceCase','reflectionCase','caseSelect','selectedCase'];
 for(const id of preferred){const el=$(id);if(el&&el.selectedIndex>0)return el}
 const all=[...document.querySelectorAll('#evidence select,.reflectionBlock select,#result select')];
 return all.find(el=>el.getClientRects().length>0&&el.selectedIndex>0)||all.find(el=>el.selectedIndex>0)||null;
}
function caseMeta(){
 const sel=visibleCaseSelect();
 if(sel){const opt=sel.options&&sel.options[sel.selectedIndex];return{id:clean(sel.value)||clean(opt&&opt.value)||clean(opt&&opt.textContent)||'case',title:clean(opt&&opt.textContent)||clean(sel.value)||'Case'}}
 const blocks=[...document.querySelectorAll('#s2EvidenceInfo,#evidence,.promptBox,.notice,.fb')].map(el=>clean(el.textContent));
 const line=blocks.find(t=>/✓\s*เลือกแล้ว|Case\s*ที่เลือก\s*:/i.test(t)&&!/ยังไม่ได้เลือก Case/i.test(t))||'';
 const title=(line.match(/(?:เลือกแล้ว|Case\s*ที่เลือก\s*:?)\s*([^\n•]+)/i)||[])[1];
 return{id:clean(title)||'case',title:clean(title)||'Case'};
}
function parseCorrect(){const source=[clean($('resultText')&&$('resultText').textContent),clean($('summary')&&$('summary').textContent)].join(' '),m=source.match(/(?:ถูก|Correct)\s*(\d+)\s*\/\s*(\d+)/i)||source.match(/(\d+)\s*\/\s*(\d+)/);return{correct:m?Number(m[1]):Math.round(score()*15/100),total:m?Number(m[2]):15}}
function stars(){const t=clean($('stars')&&$('stars').textContent);return Math.min(3,(t.match(/★/g)||[]).length)}
function ready(){const a=answers(),save=$('save');return score()>=threshold(mission())&&a.every(x=>x.length>=3)&&((save&&save.dataset.caseReady==='1')||caseMeta().id!=='case')}
function note(text,kind=''){const n=$('saveNote');if(n){n.className='notice'+(kind?' '+kind:'');n.textContent=text}}
let lastPayload=null,busy=false,retryTimer=0,eventSent=false;
function buildPayload(){
 const id=mission(),a=answers(),c=caseMeta(),ct=parseCorrect(),sid=clean($('sid')&&$('sid').value),name=clean($('name')&&$('name').value),sc=score(),refHash=hash([sid,id,c.id,...a].join('|'));
 return{
  attemptId:['reflection',sid||'student',id,refHash].join('-'),
  studentId:sid,studentName:name,section:'101',sessionId:id,missionId:id,
  missionTitle:id.toUpperCase()+' • '+clean($('title')&&$('title').textContent).replace(/^\w+\s*•\s*/,''),
  score:sc,accuracy:sc,correct:ct.correct,total:ct.total,stars:stars(),
  passed:sc>=threshold(id),mastered:!/^b/.test(id)&&sc>=60,bossWin:false,
  gateStatus:!/^b/.test(id)&&sc>=60?'passed':'attempted',
  selectedCaseId:c.id,selectedCaseTitle:c.title,selectedCase:c.title,caseId:c.id,evidenceCaseId:c.id,
  reflection1:a[0],reflection2:a[1],reflection3:a[2],reflectionSubmitted:true,reflectionStatus:'submitted',submitStatus:'reflection-submitted',
  source:'reflection-direct-submit-v730',clientTs:new Date().toISOString(),pageUrl:location.href
 };
}
async function persist(force=false){
 if(!window.AIQuestSync||typeof window.AIQuestSync.submitAttempt!=='function')throw new Error('ระบบส่งข้อมูลยังไม่พร้อม');
 if(!lastPayload||!force)lastPayload=buildPayload();
 const p={...lastPayload,clientTs:lastPayload.clientTs||new Date().toISOString()};
 await window.AIQuestSync.submitAttempt(p);
 if(!eventSent){eventSent=true;try{await window.AIQuestSync.submitEvent({eventId:'evt-'+p.attemptId,studentId:p.studentId,studentName:p.studentName,section:'101',sessionId:p.sessionId,missionId:p.missionId,eventType:'reflection_submitted',attemptId:p.attemptId,reflectionSubmitted:true,selectedCaseId:p.selectedCaseId,clientTs:new Date().toISOString(),pageUrl:location.href})}catch(_){eventSent=false}}
 return p;
}
function scheduleIdempotentRetry(){clearTimeout(retryTimer);retryTimer=setTimeout(()=>{persist(true).catch(()=>{})},3500)}
async function submit(){
 if(busy)return false;const save=$('save');if(!ready())return false;
 busy=true;if(save){save.disabled=true;save.textContent='กำลังส่ง Reflection…';save.dataset.directSubmitting='1'}note('กำลังบันทึก Reflection ลง Google Sheet…','');
 try{
  const p=await persist(false);scheduleIdempotentRetry();
  if(save){save.dataset.directSubmitted='1';save.dataset.reflectionAttemptId=p.attemptId;save.textContent='✓ ส่ง Reflection แล้ว'}
  note('ส่งข้อมูลแล้ว กำลังยืนยัน Reflection จาก Google Sheet…','');
  const confirmer=window.AIQuestReflectionSheetConfirmV728||window.AIQuestReflectionSheetConfirmV727||window.AIQuestReflectionSheetConfirmV726;
  if(confirmer&&typeof confirmer.confirmSheet==='function')setTimeout(()=>confirmer.confirmSheet(true),1200);else note('ส่ง Reflection แล้ว กรุณากลับแผนที่เพื่อตรวจสถานะจาก Sheet','good');
  return true;
 }catch(err){
  if(save){save.disabled=false;save.textContent='ส่ง Reflection และผล';save.dataset.directSubmitting='0'}
  note('ส่ง Reflection ไม่สำเร็จ: '+clean(err&&err.message||err)+' กรุณากดส่งอีกครั้ง','bad');return false;
 }finally{busy=false}
}
function resend(){if(!lastPayload&&ready())lastPayload=buildPayload();return lastPayload?persist(true):Promise.reject(new Error('ยังไม่มี Reflection ที่พร้อมส่ง'))}
function capture(e){const target=e.target&&e.target.closest?e.target.closest('#save'):null;if(!target||!ready()||target.dataset.sheetConfirmed==='1')return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();submit()}
function boot(){document.addEventListener('pointerdown',capture,true);document.addEventListener('click',capture,true);console.log('[AIQuest] Reflection direct submit v730 active • idempotent dispatch + automatic retry')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestReflectionDirectSubmitV729=window.AIQuestReflectionDirectSubmitV730={version:VERSION,submit,resend,persist,payload:buildPayload,ready,caseMeta};
})();