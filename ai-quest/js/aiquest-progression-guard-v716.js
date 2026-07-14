/* CSAI2102 AI Quest — Progression Guard v7.1.6
   Official progression requires BOTH pass and submitted Reflection.
   Also normalizes learner-facing labels to S1-S15 / B1-B5 only (no W labels).
*/
(()=>{'use strict';
if(window.AIQuestProgressionGuardV716)return;
const VERSION='v7.1.6';
const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
const norm=x=>String(x||'').toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const hasText=v=>String(v||'').trim().length>=3;
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
 const q=new URL(location.href).searchParams;
 const id=norm(q.get('mission')||'');
 const title=document.getElementById('title');
 if(title&&id){
  title.textContent=title.textContent.replace(/^W\d+\s*•\s*/i,'').replace(/^S\d+\s*•\s*/i,'');
  title.textContent=id.toUpperCase()+' • '+title.textContent;
 }
 document.querySelectorAll('h1,h2,h3,.status,.muted,.notice').forEach(el=>{
  if(el.childElementCount===0)el.textContent=el.textContent.replace(/\bW(\d{1,2})\s*•\s*S\1\b/gi,'S$1').replace(/\bW(\d{1,2})\b/gi,'S$1');
 });
}
async function readProgress(studentId){
 if(!studentId||!window.AIQuestSync||typeof window.AIQuestSync.lookupProgress!=='function')throw new Error('progress lookup unavailable');
 return window.AIQuestSync.lookupProgress({studentId,section:'101'});
}
function missionId(){return norm(new URL(location.href).searchParams.get('mission')||'s1')}
function blockMissionEntry(){
 const id=missionId(),idx=ORDER.indexOf(id);if(idx<=0)return;
 const sid=document.getElementById('sid'),start=document.getElementById('start'),note=document.getElementById('profileNote');
 if(!sid||!start)return;
 const verify=async()=>{
  const studentId=String(sid.value||'').trim();
  if(!studentId){start.disabled=true;return}
  start.disabled=true;start.textContent='กำลังตรวจสิทธิ์จาก Sheet…';
  try{
   const r=await readProgress(studentId),prev=ORDER[idx-1];
   if(!officialDone(prev,r)){
    start.disabled=true;start.textContent='🔒 ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ก่อน';
    if(note){note.className='notice bad';note.textContent='ยังเข้า '+id.toUpperCase()+' ไม่ได้: ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ให้ครบก่อน ระบบตรวจจาก Google Sheet เท่านั้น';}
   }else{
    start.disabled=false;start.textContent='▶ เริ่ม Challenge Deck';
   }
  }catch(e){
   start.disabled=true;start.textContent='ตรวจสิทธิ์ไม่สำเร็จ';
   if(note){note.className='notice bad';note.textContent='ไม่สามารถตรวจ Progress จาก Sheet ได้ จึงยังไม่เปิดด่าน';}
  }
 };
 sid.addEventListener('change',verify);sid.addEventListener('input',()=>{start.disabled=true});
 const save=document.getElementById('saveProfile');if(save)save.addEventListener('click',()=>setTimeout(verify,300));
 setTimeout(verify,500);
}
async function enforceMap(){
 const sid=document.getElementById('sid'),load=document.getElementById('load'),grid=document.getElementById('grid'),note=document.getElementById('note');
 if(!sid||!load||!grid)return;
 const apply=async()=>{
  const studentId=String(sid.value||'').trim();if(!studentId)return;
  try{
   const r=await readProgress(studentId);
   document.querySelectorAll('a[data-mission]').forEach(a=>{
    const id=norm(a.dataset.mission),idx=ORDER.indexOf(id);if(idx<=0)return;
    const prev=ORDER[idx-1],allowed=officialDone(prev,r);
    const card=a.closest('.mission');
    if(!allowed){
     a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.textContent='🔒 ต้องส่ง Reflection '+prev.toUpperCase();a.classList.remove('good','warn');
     if(card){card.classList.add('locked');card.classList.remove('done');const st=card.querySelector('.status');if(st)st.textContent='ล็อก';const m=card.querySelector('.muted');if(m)m.textContent='ต้องผ่านและส่ง Reflection '+prev.toUpperCase()+' ก่อน';}
    }
   });
  }catch(e){if(note){note.className='notice bad';note.textContent='ตรวจ Reflection progression จาก Sheet ไม่สำเร็จ จึงไม่เปิดด่านถัดไป';}}
 };
 load.addEventListener('click',()=>setTimeout(apply,900));
 const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(apply,150)});ob.observe(grid,{childList:true,subtree:true});
 setTimeout(apply,800);
}
function boot(){renameSessionLabels();blockMissionEntry();enforceMap();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestProgressionGuardV716={version:VERSION,officialDone,reflectionDone};
console.log('[AIQuest] progression guard v716 active • pass + reflection required');
})();