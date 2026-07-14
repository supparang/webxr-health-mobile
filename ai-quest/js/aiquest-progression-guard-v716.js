/* CSAI2102 AI Quest — Progression Guard v7.1.7
   Official progression requires BOTH pass and submitted Reflection.
   Learner-facing labels use S1-S15 / B1-B5 only (no W labels).
   Result flow states:
   - failed: replay only
   - passed, reflection missing: complete Reflection and submit
   - passed, reflection submitted: next mission enabled
*/
(()=>{'use strict';
if(window.AIQuestProgressionGuardV717)return;
const VERSION='v7.1.7';
const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
const norm=x=>String(x||'').toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const hasText=v=>String(v||'').trim().length>=3;
const $=id=>document.getElementById(id);
function reflectionDone(a){
 if(!a)return false;
 if(a.reflectionSubmitted===true||String(a.reflectionStatus||'').toLowerCase()==='submitted')return true;
 return hasText(a.reflection1)&&hasText(a.reflection2)&&hasText(a.reflection3);
}
function officialDone(id,r){
 const p=(r&&r.progress&&r.progress[id])||{};
 const attempts=Array.isArray(r&&r.attempts)?r.attempts.filter(a=>norm(a.sessionId||a.missionId)===id):[];
 const passed=!!p.passed||attempts.some(a=>a.passed===true||a.mastered===true||String(a.gateStatus||'').toLowerCase()==='passed'||String(a.gateStatus||'').toLowerCase()==='mastered');
 const reflected=p.reflectionSubmitted===true||String(p.reflectionStatus||'').toLowerCase()==='submitted'||attempts.some(reflectionDone);
 return passed&&reflected;
}
function renameSessionLabels(){
 const id=missionId();
 const title=$('title');
 if(title&&id){
  let t=title.textContent.replace(/^W\d+\s*•\s*/i,'').replace(/^S\d+\s*•\s*/i,'').trim();
  title.textContent=id.toUpperCase()+' • '+t;
 }
 document.querySelectorAll('h1,h2,h3,.status,.muted,.notice,#sub').forEach(el=>{
  if(el.childElementCount===0)el.textContent=el.textContent
   .replace(/\bW(\d{1,2})\s*•\s*S\1\b/gi,'S$1')
   .replace(/\bW(\d{1,2})\b/gi,'S$1');
 });
}
async function readProgress(studentId){
 if(!studentId||!window.AIQuestSync||typeof window.AIQuestSync.lookupProgress!=='function')throw new Error('progress lookup unavailable');
 return window.AIQuestSync.lookupProgress({studentId,section:'101'});
}
function missionId(){return norm(new URL(location.href).searchParams.get('mission')||'s1')}
function blockMissionEntry(){
 const id=missionId(),idx=ORDER.indexOf(id);if(idx<=0)return;
 let tries=0;
 const install=()=>{
  const sid=$('sid'),start=$('start'),note=$('profileNote');
  if(!sid||!start){if(++tries<80)setTimeout(install,100);return}
  const verify=async()=>{
   const studentId=String(sid.value||'').trim();
   start.disabled=true;
   if(!studentId){start.textContent='กรอกรหัสและดึง Profile ก่อน';return}
   start.textContent='กำลังตรวจสิทธิ์จาก Sheet…';
   try{
    const r=await readProgress(studentId),prev=ORDER[idx-1];
    if(!officialDone(prev,r)){
     start.disabled=true;start.textContent='🔒 ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ก่อน';
     if(note){note.className='notice bad';note.textContent='ยังเข้า '+id.toUpperCase()+' ไม่ได้: ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ครบก่อน ระบบตรวจจาก Google Sheet เท่านั้น';}
    }else{
     start.disabled=false;start.textContent='▶ เริ่ม Challenge Deck';
    }
   }catch(e){
    start.disabled=true;start.textContent='ตรวจสิทธิ์ไม่สำเร็จ';
    if(note){note.className='notice bad';note.textContent='ไม่สามารถตรวจ Progress จาก Sheet ได้ จึงยังไม่เปิดด่าน';}
   }
  };
  sid.addEventListener('change',verify);sid.addEventListener('input',()=>{start.disabled=true;start.textContent='กำลังรอตรวจสิทธิ์…'});
  const save=$('saveProfile');if(save)save.addEventListener('click',()=>setTimeout(verify,450));
  const ob=new MutationObserver(()=>{if(String(sid.value||'').trim())setTimeout(verify,250)});ob.observe(sid,{attributes:true,attributeFilter:['value']});
  setTimeout(verify,700);
 };
 install();
}
async function enforceMap(){
 const sid=$('sid'),load=$('load'),grid=$('grid'),note=$('note');
 if(!sid||!load||!grid)return;
 const apply=async()=>{
  const studentId=String(sid.value||'').trim();if(!studentId)return;
  try{
   const r=await readProgress(studentId);
   document.querySelectorAll('a[data-mission]').forEach(a=>{
    const id=norm(a.dataset.mission),idx=ORDER.indexOf(id);if(idx<=0)return;
    const prev=ORDER[idx-1],allowed=officialDone(prev,r),card=a.closest('.mission');
    if(!allowed){
     a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.textContent='🔒 ต้องผ่านและส่ง Reflection '+prev.toUpperCase();a.classList.remove('good','warn');
     if(card){card.classList.add('locked');const st=card.querySelector('.status');if(st)st.textContent='ล็อก';const m=card.querySelector('.muted');if(m)m.textContent='ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ก่อน';}
    }
   });
  }catch(e){if(note){note.className='notice bad';note.textContent='ตรวจ Reflection progression จาก Sheet ไม่สำเร็จ จึงไม่เปิดด่านถัดไป';}}
 };
 load.addEventListener('click',()=>setTimeout(apply,1000));
 const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(apply,180)});ob.observe(grid,{childList:true,subtree:true});
 setTimeout(apply,900);
}
function resultScore(){return Number(String(($('score')&&$('score').textContent)||'0').replace(/[^0-9.]/g,''))||0}
function reflectionFieldsDone(){return hasText($('r1')&&$('r1').value)&&hasText($('r2')&&$('r2').value)&&hasText($('r3')&&$('r3').value)}
function caseChosen(){
 const select=document.querySelector('.reflectionBlock select,#evidence select,select');
 return !select||String(select.value||'').trim()!=='';
}
function sentSuccessfully(){
 const note=String(($('saveNote')&&$('saveNote').textContent)||'');
 const save=$('save');
 return /ส่งผลเข้า Google Sheets แล้ว|ส่งผลแล้ว|บันทึก.*แล้ว/i.test(note)||(save&&save.disabled&&/ส่งผลแล้ว/i.test(save.textContent));
}
function enforceResultFlow(){
 let tries=0;
 const install=()=>{
  const result=$('result'),next=$('nextMission'),save=$('save'),replay=$('replay'),note=$('saveNote');
  if(!result||!next||!save||!replay){if(++tries<100)setTimeout(install,100);return}
  const reflection=document.querySelector('.reflectionBlock');
  const update=()=>{
   renameSessionLabels();
   const visible=result.classList.contains('on')||getComputedStyle(result).display!=='none';
   if(!visible)return;
   const passed=resultScore()>=60;
   const reflected=reflectionFieldsDone()&&caseChosen();
   const sent=sentSuccessfully();
   if(!passed){
    next.style.display='none';save.style.display='none';
    if(reflection)reflection.style.display='none';
    replay.style.display='inline-flex';
    if(note){note.className='notice bad';note.textContent='ยังไม่ผ่านด่านนี้ กรุณาเล่นใหม่ให้ได้อย่างน้อย 60%';}
    return;
   }
   if(reflection)reflection.style.display='block';
   save.style.display='inline-flex';replay.style.display='inline-flex';
   if(!sent){
    next.style.display='none';
    save.disabled=!reflected;
    save.textContent=reflected?'ส่ง Reflection และผล':'เลือก Case และตอบ Reflection ครบ 3 ช่อง';
    if(note&&!reflected){note.className='notice bad';note.textContent='ต้องเลือก Case และตอบ Reflection ครบ 3 ช่องก่อนส่ง';}
   }else{
    save.disabled=true;save.textContent='✓ ส่งผลแล้ว';
    next.style.display='inline-flex';next.removeAttribute('aria-disabled');
    const idx=ORDER.indexOf(missionId()),nextId=ORDER[idx+1];
    next.textContent=nextId?'ไป '+nextId.toUpperCase()+' ถัดไป →':'กลับแผนที่';
   }
  };
  next.addEventListener('click',e=>{
   if(resultScore()<60||!sentSuccessfully()){
    e.preventDefault();e.stopImmediatePropagation();
    update();
    if(note){note.className='notice bad';note.textContent=resultScore()<60?'ยังไม่ผ่านด่าน กรุณาเล่นใหม่':'ต้องส่ง Reflection ให้สำเร็จก่อนจึงไปด่านถัดไปได้';}
   }
  },true);
  save.addEventListener('click',e=>{
   if(resultScore()<60||!reflectionFieldsDone()||!caseChosen()){
    e.preventDefault();e.stopImmediatePropagation();update();
   }else setTimeout(update,300);
  },true);
  ['r1','r2','r3'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',update)});
  document.querySelectorAll('select').forEach(el=>el.addEventListener('change',update));
  const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(update,80)});ob.observe(result,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','disabled']});
  update();setInterval(update,700);
 };
 install();
}
function boot(){renameSessionLabels();blockMissionEntry();enforceMap();enforceResultFlow();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestProgressionGuardV716=window.AIQuestProgressionGuardV717={version:VERSION,officialDone,reflectionDone};
console.log('[AIQuest] progression guard v717 active • pass + reflection + S-only labels');
})();