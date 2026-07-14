(()=>{'use strict';
const wait=()=>window.AIQuestCloudLogger;
const send=(method,p)=>{const c=wait();if(!c||typeof c[method]!=='function')return Promise.reject(new Error('Cloud logger unavailable'));return c[method](p)};
window.AIQuestSync={submitProfile:p=>send('sendProfile',p),submitAttempt:p=>send('sendAttempt',p),submitEvent:p=>send('sendEvent',p),lookupProfile:p=>send('getProfile',p),lookupProgress:p=>send('getProgress',p)};

function loadScriptOnce(id,src,onload,onerror){
 if(document.getElementById(id))return;
 const script=document.createElement('script');script.id=id;script.async=false;script.src=src;
 script.onload=onload||(()=>{});script.onerror=onerror||(()=>{});document.head.appendChild(script);
}
function loadUpperCourseQuality(){
 if(window.AIQuestUpperCourseQualityV714)return;
 loadScriptOnce('aiquestUpperCourseQuality714','./js/aiquest-upper-course-quality-v714.js?v=20260714-upper714',()=>console.log('[AIQuest] upper-course quality v714 active'),()=>console.warn('[AIQuest] upper-course quality layer unavailable'));
}
function loadProgressionGuard(){
 if(window.AIQuestProgressionGuardV717)return;
 loadScriptOnce('aiquestProgressionGuard717','./js/aiquest-progression-guard-v716.js?v=20260714-reflection717',()=>console.log('[AIQuest] progression guard v717 loaded'),()=>console.warn('[AIQuest] progression guard unavailable'));
}
function installSaveProfileButton(){
 const sid=document.getElementById('sid'),name=document.getElementById('name'),load=document.getElementById('load'),note=document.getElementById('note');
 if(!sid||!name||!load||!note||document.getElementById('saveProfileExplicit'))return;
 const btn=document.createElement('button');btn.id='saveProfileExplicit';btn.type='button';btn.className='btn good';btn.textContent='บันทึก Profile';btn.style.display='none';
 load.insertAdjacentElement('afterend',btn);
 const show=()=>{btn.style.display=(!name.readOnly&&String(sid.value||'').trim())?'inline-flex':'none'};
 const say=(text,kind)=>{note.className='notice'+(kind?' '+kind:'');note.textContent=text};
 btn.addEventListener('click',async()=>{
  const studentId=String(sid.value||'').trim(),studentName=String(name.value||'').trim();
  if(!studentId){sid.focus();say('กรุณากรอกรหัสนักศึกษา','bad');return}
  if(!studentName){name.focus();say('กรุณากรอกชื่อ-นามสกุลก่อนบันทึก Profile','bad');return}
  btn.disabled=true;btn.textContent='กำลังบันทึก…';say('กำลังบันทึก Profile ลง Google Sheet…','');
  const profile={studentId,studentName,section:'101',clientTs:new Date().toISOString(),pageUrl:location.href,profileSource:'new'};
  try{
   await window.AIQuestSync.submitProfile(profile);
   try{localStorage.setItem('CSAI2102_AIQUEST_PROFILE_V421',JSON.stringify(profile))}catch(e){}
   name.readOnly=true;btn.style.display='none';say('✓ บันทึก Profile แล้ว: '+studentId+' • '+studentName+' • Section 101 — เริ่ม S1 ได้','good');
  }catch(err){say('บันทึก Profile ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่','bad')}
  finally{btn.disabled=false;btn.textContent='บันทึก Profile'}
 });
 const observer=new MutationObserver(show);observer.observe(name,{attributes:true,attributeFilter:['readonly','disabled']});
 sid.addEventListener('input',show);name.addEventListener('input',show);load.addEventListener('click',()=>setTimeout(show,300));
 setInterval(show,800);show();
}
function runtimeAudit(){
 let tries=0;
 const check=()=>{
  const C=window.AIQuestAllContentV702;
  if(C&&typeof C.deck==='function'){
   const ids=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
   const report={};
   ids.forEach(id=>{try{const d=C.deck(id,97)||[];report[id]={items:d.length,uniqueCorrect:new Set(d.map(x=>String(x.correct||''))).size,uniqueOptions:new Set(d.flatMap(x=>[x.correct,...(x.distractors||[])].map(String))).size,slots:[0,1,2,3].map(s=>d.filter(x=>Number(x.answerSlot)===s).length)}}catch(e){report[id]={error:String(e.message||e)}}});
   window.CSAI2102_ITEM_QUALITY_AUDIT=report;console.table(report);return;
  }
  if(++tries<80)setTimeout(check,100);
 };
 check();
}
loadUpperCourseQuality();loadProgressionGuard();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installSaveProfileButton();loadUpperCourseQuality();loadProgressionGuard();runtimeAudit()},{once:true});
else setTimeout(()=>{installSaveProfileButton();loadUpperCourseQuality();loadProgressionGuard();runtimeAudit()},0);
console.log('[AIQuest] sync v30 ready • Sheet-only + mandatory Reflection result flow + S-only labels');
})();