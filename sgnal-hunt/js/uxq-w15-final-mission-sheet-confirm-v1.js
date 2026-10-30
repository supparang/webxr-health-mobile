/* CSAI2601 UX Quest — W15 terminal Sheet confirmation v1
 * W15 has no next-node gate. Confirm the final mission from Google Sheet;
 * retry the original local 2+ star event only, same eventId, at most twice.
 * NO fabricated pass, score edits, local unlocks, or direct Sheet writes.
 */
(() => {
 'use strict';
 const VERSION='20261030-W15-FINAL-SHEET-CONFIRM-V1';
 if(!/(?:^|[?&])(?:node|id)=W15(?:&|$)/i.test(location.search||''))return;
 const MAX_RETRIES=2, MAX_AGE_MS=3600000;
 let activeId='', retries=0, busy=false, pending=0, message='';
 const $=()=>document.querySelector('#uxqCanonicalNode .results');
 const identity=()=>{try{return window.UXQIdentity?.get?.()||{};}catch(_){return {};}};
 function localProof(){
   const sender=window.CSAI2601UXQAutoSheet, p=identity();
   if(!$()||!sender||typeof sender.payload!=='function')return null;
   const item=sender.payload();
   if(!item||item.eventType!=='mission_completed'||String(item.missionId).toLowerCase()!=='w15'||
      !item.eventId||!p.studentId||!p.studentName||!p.section||
      String(item.studentId)!==String(p.studentId)||
      String(item.studentName)!==String(p.studentName)||
      String(item.section)!==String(p.section))return null;
   const time=Date.parse(item.completedAt||'');
   if(!Number.isFinite(time)||time>Date.now()+60000||Date.now()-time>MAX_AGE_MS)return null;
   return {item,passed:item.passed===true&&Number(item.stars||0)>=2};
 }
 function classifySheet(data,item){
   if(!data||data.ok!==true)return {state:'error',reason:'SHEET_RESPONSE_INVALID'};
   if(!item||String(data.studentId||'')!==String(item.studentId||'')||
     String(data.section||'')!==String(item.section||'')||
     String(data.courseId||'')!==String(item.courseId||''))
     return {state:'error',reason:'IDENTITY_OR_COURSE_MISMATCH'};
   const canonical=(data.diagnostics?.canonicalPassedMissionIds||[]).map(x=>String(x).toLowerCase());
   const raw=(data.diagnostics?.rawPassedMissionIds||[]).map(x=>String(x).toLowerCase());
   const w15=data.missions?.w15||data.missions?.W15||{};
   const passed=w15.completed===true||w15.passed===true||Number(w15.bestStars||w15.stars||0)>=2;
   if(canonical.includes('w15'))return passed?{state:'confirmed',reason:'W15_OFFICIAL_PASS'}:{state:'error',reason:'W15_CANONICAL_ROW_CONFLICT'};
   if(raw.includes('w15'))return {state:'gap',reason:'W15_RAW_PASS_NOT_CONTIGUOUS'};
   if(Number(data.completedNodes||0)<18)return {state:'gap',reason:'PRIOR_MISSIONS_NOT_CONTIGUOUS'};
   return {state:'missing',reason:'W15_PASS_NOT_FOUND'};
 }
 function statusBox(){
   const root=$();if(!root)return null;
   let box=root.querySelector('#uxqW15FinalProof');if(box)return box;
   box=document.createElement('section');box.id='uxqW15FinalProof';
   box.setAttribute('role','status');box.setAttribute('aria-live','polite');
   box.style.cssText='margin:12px 0;padding:12px;border:1px solid #7dd3fc;border-radius:12px;background:#0e2345;color:#e0f2fe;font-size:.86rem;line-height:1.5;';
   const text=document.createElement('div');text.dataset.w15Message='1';box.appendChild(text);
   const btn=document.createElement('button');btn.type='button';
   btn.textContent='ตรวจผล Mission W15 จาก Google Sheet อีกครั้ง';
   btn.style.cssText='margin-top:8px;min-height:40px;padding:8px 12px;border:1px solid #7dd3fc;border-radius:9px;background:#194064;color:white;';
   btn.addEventListener('click',()=>verify());box.appendChild(btn);
   const actions=root.querySelector('.actions');
   if(actions)actions.parentNode.insertBefore(box,actions);else root.appendChild(box);
   return box;
 }
 function show(text,tone){
   message=text;const box=statusBox();if(!box)return;
   box.style.borderColor=tone==='ok'?'#6ee7b7':tone==='bad'?'#fbbf24':'#7dd3fc';
   const line=box.querySelector('[data-w15-message]');if(line)line.textContent=text;
   const btn=box.querySelector('button');if(btn)btn.disabled=busy;
 }
 async function verify(){
   if(busy)return;
   const proof=localProof();
   if(!proof){
     show('W15: ยังไม่มีผล Mission รอบปัจจุบันที่ตรงกับผู้เรียนนี้ • Studio/Reflection ไม่ใช่หลักฐาน Mission','bad');return;
   }
   if(!proof.passed){
     show('W15: ผล Mission รอบนี้ยังไม่ผ่าน 2★ จึงไม่ส่งข้อมูลยืนยันผ่าน','bad');return;
   }
   if(activeId!==proof.item.eventId){activeId=proof.item.eventId;retries=0;}
   busy=true;
   try{
     show('กำลังอ่าน W15 mission_completed จาก Google Sheet • ยังไม่ถือว่าผ่าน');
     const api=window.UXQSheetConfirmedNext;
     if(!api||typeof api.requestProgress!=='function')throw Error('SHEET_READ_API_NOT_FOUND');
     const status=classifySheet(await api.requestProgress(),proof.item);
     if(status.state==='confirmed'){
       show('✓ Google Sheet ยืนยัน W15 Mission ผ่านแล้ว ครบลำดับ 19 ด่าน • กลับ Mission Control แล้วกดดึงความคืบหน้าจาก Sheet','ok');
       window.dispatchEvent(new CustomEvent('uxq-w15-sheet-confirmed',{detail:{version:VERSION,eventId:activeId}}));return;
     }
     if(status.state==='gap'){
       show('W15: พบช่องว่างของ Mission ก่อนหน้า ('+status.reason+') • ให้ผู้สอนตรวจ Sheet ไม่ปลดล็อกเอง','bad');return;
     }
     if(status.state!=='missing'){
       show('W15: อ่านสถานะจาก Sheet ยังไม่ยืนยัน ('+status.reason+') • ไม่ให้ผ่านโดยอัตโนมัติ','bad');return;
     }
     if(retries>=MAX_RETRIES){
       show('W15: ยังไม่พบผล Mission ที่ผ่านใน Sheet หลังส่งเหตุการณ์เดิมซ้ำ 2 ครั้ง • หยุดส่งและแจ้งผู้สอนตรวจ Sheet','bad');return;
     }
     const sender=window.CSAI2601UXQAutoSheet, again=localProof();
     if(!sender||typeof sender.autoMission!=='function'||!again||!again.passed||again.item.eventId!==activeId)
       throw Error('ORIGINAL_W15_EVENT_NOT_AVAILABLE');
     retries++;
     const res=await sender.autoMission({force:true,reason:'w15_terminal_sheet_missing'});
     if(res?.state!=='dispatched_unverified'){
       show('W15: ส่งหลักฐาน Mission เดิมซ้ำไม่ได้ ('+(res?.state||'unknown')+') • ยังไม่ถือว่าผ่าน','bad');return;
     }
     show('W15: ส่ง eventId เดิมซ้ำ '+retries+'/2 แต่ยังรอ Sheet ยืนยัน • ไม่สร้างคะแนนใหม่');
     clearTimeout(pending);pending=setTimeout(()=>verify(),3500);
   }catch(error){
     show('W15: ตรวจ Sheet ไม่สำเร็จ ('+String(error?.message||error)+') • ไม่ถือว่าผ่าน กรุณาตรวจอีกครั้งหรือแจ้งผู้สอน','bad');
   }finally{busy=false;}
 }
 function scan(){
   const proof=localProof();if(!proof)return;
   statusBox();
   if(activeId!==proof.item.eventId){
     activeId=proof.item.eventId;retries=0;
     clearTimeout(pending);pending=setTimeout(()=>verify(),1500);
   }
 }
 function boot(){
   scan();new MutationObserver(scan).observe(document.getElementById('uxqCanonicalNode')||document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.UXQW15FinalSheetProof=Object.freeze({version:VERSION,classifySheet,verify,getMessage:()=>message});
})();