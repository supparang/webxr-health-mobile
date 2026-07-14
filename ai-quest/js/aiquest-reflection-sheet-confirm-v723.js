/* CSAI2102 AI Quest — Reflection Sheet Confirmation v7.2.6
   The next mission is shown only after Apps Script studentGate confirms that
   the current mission is both passed and has submitted Reflection in Google Sheet.
   v726 replaces the confirmed Next control with a native anchor, removing every
   stale click handler from the old button, and adds a document-capture fallback.
*/
(()=>{'use strict';
if(window.AIQuestReflectionSheetConfirmV726)return;
const VERSION='v7.2.6';
const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
const $=id=>document.getElementById(id);
const txt=v=>String(v==null?'':v).trim();
const norm=x=>txt(x).toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function mission(){return norm(new URL(location.href).searchParams.get('mission')||'s1')}
function passed(){return Number(txt($('score')&&$('score').textContent).replace(/[^0-9.]/g,''))>=60}
function confirmedState(){const c=window.CSAI2102_REFLECTION_GATE_CONFIRMED;return c&&c.missionId===mission()?c:null}
function sentSignal(){
 const n=txt($('saveNote')&&$('saveNote').textContent),b=$('save');
 return /ส่งผลเข้า Google Sheets แล้ว|ส่งผลแล้ว|บันทึก.*แล้ว|Google Sheet ยืนยันแล้ว/i.test(n)||
  !!(b&&/ส่งผลแล้ว/i.test(txt(b.textContent)))||!!confirmedState();
}
function nextId(){const i=ORDER.indexOf(mission());return i>=0?ORDER[i+1]||'':''}
function note(text,kind=''){const n=$('saveNote');if(n){n.className='notice'+(kind?' '+kind:'');n.textContent=text}}
function nextUrl(){
 const n=nextId();
 if(!n)return new URL('./course-map-all-v715.html?route=student-v715',location.href).toString();
 const u=new URL(location.href);
 u.searchParams.set('mission',n);
 u.searchParams.set('release','challenge711');
 u.searchParams.set('_gate',Date.now().toString());
 return u.toString();
}
function navigateNext(){
 const c=confirmedState();
 if(!c){confirmSheet(true);return false}
 const target=nextUrl();
 try{window.location.assign(target)}catch(e){window.location.href=target}
 return true;
}
function ensurePendingButton(){
 let next=$('nextMission');
 if(next&&next.tagName==='BUTTON')return next;
 const save=$('save'),replay=$('replay');if(!save||!save.parentElement)return null;
 if(next)next.remove();
 next=document.createElement('button');next.id='nextMission';next.type='button';next.className='btn next';next.style.display='none';
 if(replay&&replay.parentElement===save.parentElement)save.insertAdjacentElement('afterend',next);else save.parentElement.appendChild(next);
 return next;
}
function makeConfirmedLink(){
 const old=$('nextMission'),save=$('save'),replay=$('replay');
 if(!save||!save.parentElement)return null;
 const href=nextUrl(),n=nextId();
 let link;
 if(old&&old.tagName==='A'&&old.dataset.sheetConfirmed==='1')link=old;
 else{
  link=document.createElement('a');
  link.id='nextMission';link.className='btn next';link.href=href;link.setAttribute('role','button');
  if(old&&old.parentElement)old.replaceWith(link);
  else if(replay&&replay.parentElement===save.parentElement)save.insertAdjacentElement('afterend',link);
  else save.parentElement.appendChild(link);
 }
 link.href=href;
 link.dataset.sheetConfirmed='1';
 link.dataset.nativeNavigation='1';
 link.removeAttribute('aria-disabled');
 link.textContent=n?'ไป '+n.toUpperCase()+' ถัดไป →':'กลับแผนที่';
 link.style.setProperty('display','inline-flex','important');
 link.style.visibility='visible';link.style.opacity='1';link.style.pointerEvents='auto';link.style.cursor='pointer';
 return link;
}
function ensureVerifyButton(){
 let b=$('verifyReflectionSheet');if(b)return b;
 const save=$('save');if(!save||!save.parentElement)return null;
 b=document.createElement('button');b.id='verifyReflectionSheet';b.type='button';b.className='btn next';b.textContent='ตรวจผลจาก Sheet อีกครั้ง';b.style.display='none';
 save.insertAdjacentElement('afterend',b);return b;
}
function hideVerify(){
 const verify=$('verifyReflectionSheet');
 if(verify){verify.disabled=false;verify.textContent='ตรวจผลจาก Sheet อีกครั้ง';verify.style.setProperty('display','none','important');verify.setAttribute('aria-hidden','true')}
}
function lockNext(message){
 const c=confirmedState();if(c){forceConfirmedUI(c.gate);return}
 const next=ensurePendingButton();if(next){next.style.setProperty('display','none','important');next.dataset.sheetConfirmed='0';next.setAttribute('aria-disabled','true')}
 if(message)note(message,'');
}
let checking=false,sequence=0;
function forceConfirmedUI(gate){
 checking=false;sequence++;hideVerify();
 const link=makeConfirmedLink(),save=$('save');if(!link)return;
 if(save){save.disabled=true;save.textContent='✓ ส่งผลแล้ว';save.dataset.sheetConfirmed='1'}
 window.CSAI2102_REFLECTION_GATE_CONFIRMED={missionId:mission(),confirmedAt:new Date().toISOString(),gate};
 note('✓ ส่งผลเข้า Google Sheets แล้ว • Google Sheet ยืนยันแล้ว: ผ่านและส่ง Reflection '+mission().toUpperCase()+' ครบเรียบร้อย','good');
}
function openNext(gate){forceConfirmedUI(gate)}
async function lookup(){
 const sid=txt($('sid')&&$('sid').value);if(!sid)throw new Error('ไม่พบรหัสนักศึกษา');
 if(!window.AIQuestSync||typeof window.AIQuestSync.lookupGate!=='function')throw new Error('Backend ยังไม่รองรับ studentGate');
 return window.AIQuestSync.lookupGate({studentId:sid,sessionId:mission(),section:'101'});
}
async function confirmSheet(force=false){
 const existing=confirmedState();if(existing){forceConfirmedUI(existing.gate);return true}
 if(checking)return false;if(!passed())return false;
 checking=true;const my=++sequence,verify=ensureVerifyButton();ensurePendingButton();
 if(verify){verify.removeAttribute('aria-hidden');verify.disabled=true;verify.style.setProperty('display','inline-flex','important');verify.textContent='กำลังตรวจ Sheet…'}
 lockNext('ส่งข้อมูลแล้ว กำลังยืนยัน Reflection จาก Google Sheet…');
 try{
  for(let i=0;i<9;i++){
   if(my!==sequence)return false;
   try{const gate=await lookup();if(gate&&gate.completed===true){openNext(gate);return true}}catch(err){if(i===8)throw err}
   await delay(i<3?1200:2200);
  }
  if(my!==sequence||confirmedState())return true;
  if(verify){verify.disabled=false;verify.removeAttribute('aria-hidden');verify.style.setProperty('display','inline-flex','important');verify.textContent='ตรวจผลจาก Sheet อีกครั้ง'}
  note('ยังไม่พบ Reflection ที่ยืนยันแล้วใน Sheet กรุณากด “ตรวจผลจาก Sheet อีกครั้ง” โดยไม่ต้องเล่นใหม่','bad');return false;
 }catch(err){
  if(my!==sequence||confirmedState())return true;
  if(verify){verify.disabled=false;verify.removeAttribute('aria-hidden');verify.style.setProperty('display','inline-flex','important');verify.textContent='ตรวจผลจาก Sheet อีกครั้ง'}
  note('ตรวจยืนยันจาก Sheet ไม่สำเร็จ: '+txt(err&&err.message||err),'bad');return false;
 }finally{
  if(my===sequence)checking=false;
  if(confirmedState())hideVerify();
 }
}
function captureConfirmedNavigation(e){
 const target=e.target&&e.target.closest?e.target.closest('#nextMission'):null;
 if(!target||target.dataset.sheetConfirmed!=='1')return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 navigateNext();
}
function boot(){
 const result=$('result'),save=$('save');if(!result||!save){setTimeout(boot,120);return}
 const verify=ensureVerifyButton();
 if(verify&&!verify.dataset.bound){verify.dataset.bound='1';verify.addEventListener('click',()=>confirmSheet(true))}
 document.addEventListener('pointerdown',captureConfirmedNavigation,true);
 document.addEventListener('click',captureConfirmedNavigation,true);
 save.addEventListener('click',()=>{if(confirmedState()){forceConfirmedUI(confirmedState().gate);return}lockNext();setTimeout(()=>{if(sentSignal())confirmSheet(true)},500)},false);
 const observer=new MutationObserver(()=>{
  const c=confirmedState();
  if(c)forceConfirmedUI(c.gate);
  else if(sentSignal()&&(!$('nextMission')||$('nextMission').dataset.sheetConfirmed!=='1'))confirmSheet(false);
 });
 observer.observe(result,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','class','style']});
 setInterval(()=>{
  const c=confirmedState();
  if(c)forceConfirmedUI(c.gate);
  else if(sentSignal()&&!checking)confirmSheet(false);
 },650);
 console.log('[AIQuest] Reflection Sheet confirmation v726 active • native Next link + document capture navigation');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestReflectionSheetConfirmV723=window.AIQuestReflectionSheetConfirmV724=window.AIQuestReflectionSheetConfirmV725=window.AIQuestReflectionSheetConfirmV726={version:VERSION,confirmSheet,lookup,forceConfirmedUI,navigateNext,nextUrl};
})();