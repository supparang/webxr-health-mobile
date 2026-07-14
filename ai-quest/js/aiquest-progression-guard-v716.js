/* CSAI2102 AI Quest — Progression Guard v7.1.9
   Official progression requires BOTH pass and submitted Reflection.
   Learner-facing labels use S1-S15 / B1-B5 only.
   Uses the fast Apps Script studentGate endpoint and always fails closed.
*/
(()=>{'use strict';
if(window.AIQuestProgressionGuardV719)return;
const VERSION='v7.1.9';
const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
const norm=x=>String(x||'').toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const hasText=v=>String(v||'').trim().length>=3;
const $=id=>document.getElementById(id);
const wait=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error((label||'request')+' timeout')),ms))]);
function reflectionDone(a){if(!a)return false;if(a.reflectionSubmitted===true||String(a.reflectionStatus||'').toLowerCase()==='submitted'||a.completed===true)return true;return hasText(a.reflection1)&&hasText(a.reflection2)&&hasText(a.reflection3)}
function passDone(a){if(!a)return false;const s=String(a.gateStatus||a.status||'').toLowerCase();return a.passed===true||a.mastered===true||s==='passed'||s==='mastered'||s==='completed'}
function officialDone(id,r){const p=(r&&r.progress&&r.progress[id])||{};const attempts=Array.isArray(r&&r.attempts)?r.attempts.filter(a=>norm(a.sessionId||a.missionId)===id):[];return(passDone(p)||attempts.some(passDone))&&(reflectionDone(p)||attempts.some(reflectionDone))}
function missionId(){return norm(new URL(location.href).searchParams.get('mission')||'s1')}
function renameSessionLabels(){const id=missionId(),title=$('title');if(title&&id){let t=title.textContent.replace(/^W\d+\s*•\s*/i,'').replace(/^S\d+\s*•\s*/i,'').trim();title.textContent=id.toUpperCase()+' • '+t}document.querySelectorAll('h1,h2,h3,.status,.muted,.notice,#sub').forEach(el=>{if(el.childElementCount===0)el.textContent=el.textContent.replace(/\bW(\d{1,2})\s*•\s*S\1\b/gi,'S$1').replace(/\bW(\d{1,2})\b/gi,'S$1')})}
async function readProgress(studentId){if(!studentId||!window.AIQuestSync||typeof window.AIQuestSync.lookupProgress!=='function')throw new Error('progress lookup unavailable');return wait(window.AIQuestSync.lookupProgress({studentId,section:'101'}),24000,'studentProgress')}
async function readGate(studentId,sessionId){
 if(!studentId)throw new Error('studentId is required');
 if(!window.AIQuestSync)throw new Error('sync unavailable');
 if(typeof window.AIQuestSync.lookupGate==='function'){
  const r=await wait(window.AIQuestSync.lookupGate({studentId,sessionId,section:'101'}),22000,'studentGate');
  if(r&&typeof r.completed==='boolean')return r;
  const version=String(r&&r.version||'');
  const err=new Error('BACKEND_UPGRADE_REQUIRED'+(version?': '+version:''));err.code='BACKEND_UPGRADE_REQUIRED';err.backendVersion=version;throw err;
 }
 const r=await readProgress(studentId);
 return{ok:true,action:'studentGate-fallback',studentId,sessionId,completed:officialDone(sessionId,r),passed:passDone((r.progress||{})[sessionId]),reflectionSubmitted:reflectionDone((r.progress||{})[sessionId]),version:r.version||''};
}
function blockMissionEntry(){
 const id=missionId(),idx=ORDER.indexOf(id);if(idx<=0)return;
 let tries=0;
 const install=()=>{
  const sid=$('sid'),start=$('start'),note=$('profileNote');
  if(!sid||!start){if(++tries<100)setTimeout(install,100);return}
  const prev=ORDER[idx-1];let checking=false,lastStudent='',seq=0,debounce=0;
  const setNote=(text,kind='bad')=>{if(note){note.className='notice '+kind;note.textContent=text}};
  const lockMissing=()=>{start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='🔒 ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ก่อน';setNote('ยังเข้า '+id.toUpperCase()+' ไม่ได้: ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ครบก่อน ระบบตรวจจาก Google Sheet เท่านั้น')};
  const lockUpgrade=version=>{start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='🔒 ต้องอัปเดต Backend ก่อน';setNote('Backend '+(version||'ปัจจุบัน')+' ยังไม่มี studentGate/Reflection status — ต้อง Deploy Code.gs v4.4.3 ก่อนจึงตรวจสิทธิ์ '+id.toUpperCase()+' ได้')};
  const lockError=message=>{start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='ตรวจสิทธิ์ไม่สำเร็จ';setNote(message||'ไม่สามารถตรวจ Progress จาก Sheet ได้ จึงยังไม่เปิดด่าน')};
  const open=()=>{start.disabled=false;start.dataset.progressionAllowed='1';start.textContent='▶ เริ่ม Challenge Deck';setNote('✓ ตรวจสิทธิ์จาก Google Sheet แล้ว: '+prev.toUpperCase()+' ผ่านและส่ง Reflection ครบ สามารถเริ่ม '+id.toUpperCase()+' ได้','good')};
  const verify=async(force=false)=>{
   const studentId=String(sid.value||'').trim();
   if(!studentId){start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='กรอกรหัสและดึง Profile ก่อน';return false}
   if(checking)return false;
   if(!force&&start.dataset.progressionAllowed==='1'&&lastStudent===studentId)return true;
   checking=true;lastStudent=studentId;const mySeq=++seq;start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='กำลังตรวจสิทธิ์จาก Sheet…';setNote('กำลังตรวจ '+prev.toUpperCase()+' จาก Google Sheet…','');
   try{
    const gate=await readGate(studentId,prev);
    if(mySeq!==seq)return false;
    if(gate.completed===true){open();return true}
    lockMissing();return false;
   }catch(e){
    if(mySeq!==seq)return false;
    if(e&&e.code==='BACKEND_UPGRADE_REQUIRED'||String(e&&e.message||'').includes('BACKEND_UPGRADE_REQUIRED'))lockUpgrade(e.backendVersion||String(e.message||'').split(': ').slice(1).join(': '));
    else if(/timeout/i.test(String(e&&e.message||'')))lockError('ตรวจสิทธิ์จาก Sheet เกินเวลา ระบบจึงล็อก '+id.toUpperCase()+' ไว้ กรุณาตรวจ Apps Script deployment แล้วลองอีกครั้ง');
    else lockError('ตรวจสิทธิ์จาก Sheet ไม่สำเร็จ: '+String(e&&e.message||e));
    return false;
   }finally{if(mySeq===seq)checking=false}
  };
  const schedule=(delay=180)=>{clearTimeout(debounce);debounce=setTimeout(()=>verify(true),delay)};
  start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='กำลังรอตรวจสิทธิ์จาก Sheet…';
  sid.addEventListener('input',()=>{seq++;checking=false;lastStudent='';start.disabled=true;start.dataset.progressionAllowed='0';start.textContent='กำลังรอตรวจสิทธิ์…'});
  sid.addEventListener('change',()=>schedule(50));
  const save=$('saveProfile');if(save)save.addEventListener('click',()=>schedule(450));
  if(note){const ob=new MutationObserver(()=>{const t=String(note.textContent||'');if(/ดึง Profile.*Google Sheets.*แล้ว|Profile.*Sheet.*แล้ว/i.test(t)&&String(sid.value||'').trim())schedule(80)});ob.observe(note,{childList:true,subtree:true,characterData:true})}
  start.addEventListener('click',async e=>{if(start.dataset.progressionAllowed==='1')return;e.preventDefault();e.stopImmediatePropagation();const ok=await verify(true);if(ok){start.dataset.progressionAllowed='1';start.disabled=false;start.click()}},true);
  let bootTries=0;const bootCheck=()=>{if(String(sid.value||'').trim())verify(true);else if(++bootTries<40)setTimeout(bootCheck,250)};setTimeout(bootCheck,500);
 };
 install();
}
async function enforceMap(){const sid=$('sid'),load=$('load'),grid=$('grid'),note=$('note');if(!sid||!load||!grid)return;const apply=async()=>{const studentId=String(sid.value||'').trim();if(!studentId)return;try{const r=await readProgress(studentId);document.querySelectorAll('a[data-mission]').forEach(a=>{const id=norm(a.dataset.mission),idx=ORDER.indexOf(id);if(idx<=0)return;const prev=ORDER[idx-1],allowed=officialDone(prev,r),card=a.closest('.mission');if(!allowed){a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.textContent='🔒 ต้องผ่านและส่ง Reflection '+prev.toUpperCase();a.classList.remove('good','warn');if(card){card.classList.add('locked');const st=card.querySelector('.status');if(st)st.textContent='ล็อก';const m=card.querySelector('.muted');if(m)m.textContent='ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ก่อน'}}})}catch(e){if(note){note.className='notice bad';note.textContent='ตรวจ Reflection progression จาก Sheet ไม่สำเร็จ จึงไม่เปิดด่านถัดไป'}}};load.addEventListener('click',()=>setTimeout(apply,1000));const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(apply,180)});ob.observe(grid,{childList:true,subtree:true});setTimeout(apply,900)}
function resultScore(){return Number(String(($('score')&&$('score').textContent)||'0').replace(/[^0-9.]/g,''))||0}
function reflectionFieldsDone(){return hasText($('r1')&&$('r1').value)&&hasText($('r2')&&$('r2').value)&&hasText($('r3')&&$('r3').value)}
function caseChosen(){const select=document.querySelector('.reflectionBlock select,#evidence select,select');return!select||String(select.value||'').trim()!==''}
function sentSuccessfully(){const note=String(($('saveNote')&&$('saveNote').textContent)||''),save=$('save');return/ส่งผลเข้า Google Sheets แล้ว|ส่งผลแล้ว|บันทึก.*แล้ว/i.test(note)||(save&&save.disabled&&/ส่งผลแล้ว/i.test(save.textContent))}
function enforceResultFlow(){let tries=0;const install=()=>{const result=$('result'),next=$('nextMission'),save=$('save'),replay=$('replay'),note=$('saveNote');if(!result||!next||!save||!replay){if(++tries<100)setTimeout(install,100);return}const reflection=document.querySelector('.reflectionBlock');const update=()=>{renameSessionLabels();const visible=result.classList.contains('on')||getComputedStyle(result).display!=='none';if(!visible)return;const passed=resultScore()>=60,reflected=reflectionFieldsDone()&&caseChosen(),sent=sentSuccessfully();if(!passed){next.style.display='none';save.style.display='none';if(reflection)reflection.style.display='none';replay.style.display='inline-flex';if(note){note.className='notice bad';note.textContent='ยังไม่ผ่านด่านนี้ กรุณาเล่นใหม่ให้ได้อย่างน้อย 60%'}return}if(reflection)reflection.style.display='block';save.style.display='inline-flex';replay.style.display='inline-flex';if(!sent){next.style.display='none';save.disabled=!reflected;save.textContent=reflected?'ส่ง Reflection และผล':'เลือก Case และตอบ Reflection ครบ 3 ช่อง';if(note&&!reflected){note.className='notice bad';note.textContent='ต้องเลือก Case และตอบ Reflection ครบ 3 ช่องก่อนส่ง'}}else{save.disabled=true;save.textContent='✓ ส่งผลแล้ว';next.style.display='inline-flex';next.removeAttribute('aria-disabled');const idx=ORDER.indexOf(missionId()),nextId=ORDER[idx+1];next.textContent=nextId?'ไป '+nextId.toUpperCase()+' ถัดไป →':'กลับแผนที่'}};next.addEventListener('click',e=>{if(resultScore()<60||!sentSuccessfully()){e.preventDefault();e.stopImmediatePropagation();update();if(note){note.className='notice bad';note.textContent=resultScore()<60?'ยังไม่ผ่านด่าน กรุณาเล่นใหม่':'ต้องส่ง Reflection ให้สำเร็จก่อนจึงไปด่านถัดไปได้'}}},true);save.addEventListener('click',e=>{if(resultScore()<60||!reflectionFieldsDone()||!caseChosen()){e.preventDefault();e.stopImmediatePropagation();update()}else setTimeout(update,300)},true);['r1','r2','r3'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',update)});document.querySelectorAll('select').forEach(el=>el.addEventListener('change',update));const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(update,80)});ob.observe(result,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','disabled']});update();setInterval(update,700)};install()}
function boot(){renameSessionLabels();blockMissionEntry();enforceMap();enforceResultFlow()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestProgressionGuardV716=window.AIQuestProgressionGuardV717=window.AIQuestProgressionGuardV718=window.AIQuestProgressionGuardV719={version:VERSION,officialDone,reflectionDone,readGate};
console.log('[AIQuest] progression guard v719 active • fast studentGate • bounded fail-closed check');
})();