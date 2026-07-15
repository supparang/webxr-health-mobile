/* CSAI2102 AI Quest — URL Identity Authority v7.3.5
   When a mission URL carries studentId/studentName, that learner identity wins
   over any stale local profile left by a previous learner on the same device.
   Google Sheet remains canonical: a successful exact-ID lookup may correct the name.
*/
(()=>{'use strict';
if(window.AIQuestUrlIdentityAuthorityV735)return;
const VERSION='v7.3.5',clean=v=>String(v==null?'':v).trim(),$=id=>document.getElementById(id);
function identity(){const q=new URLSearchParams(location.search);return{studentId:clean(q.get('studentId')||q.get('studentid')||q.get('sid')),studentName:clean(q.get('studentName')||q.get('studentname')||q.get('name')),section:'101'}}
function note(text,kind=''){const n=$('profileNote')||$('profileStatus');if(n){n.className='notice'+(kind?' '+kind:'');n.textContent=text}}
async function apply(){
 const i=identity(),sid=$('sid'),name=$('name')||$('sname'),section=$('section');
 if(!i.studentId||!sid||!name)return false;
 sid.value=i.studentId;name.value=i.studentName||'';if(section)section.value='101';
 sid.dataset.identityAuthority='url';name.dataset.profileSource='url';
 note('กำลังตรวจ Profile จาก Google Sheets สำหรับ '+i.studentId+'…','');
 try{
  const r=await window.AIQuestSync?.lookupProfile?.({studentId:i.studentId,section:'101'});
  if(clean(sid.value)!==i.studentId)return false;
  if(r?.ok&&r?.found&&r?.profile&&clean(r.profile.studentId)===i.studentId){
   const canonicalName=clean(r.profile.studentName||r.profile.name)||i.studentName;
   name.value=canonicalName;name.dataset.profileSource='sheet';
   try{window.AIQuestStorage?.saveProfile?.({studentId:i.studentId,studentName:canonicalName,section:'101',profileSource:'sheet'})}catch(_){ }
   note('✓ ดึง Profile จาก Google Sheets แล้ว: '+i.studentId+' • '+canonicalName+' • Section 101','good');
  }else{
   name.value=i.studentName||name.value;name.dataset.profileSource='new';
   note('ไม่พบ Profile ของ '+i.studentId+' ใน Google Sheets — ตรวจชื่อแล้วกดบันทึกเพื่อสร้าง Profile ใหม่','');
  }
 }catch(_){
  name.value=i.studentName||name.value;
  note('ตรวจ Profile จาก Sheet ไม่สำเร็จ — ยังคงใช้รหัสจากลิงก์ และจะไม่ดึง Profile คนอื่นจากเครื่องนี้','bad');
 }
 return true;
}
function boot(){let tries=0;const run=()=>{const i=identity();if(!i.studentId)return;if($('sid')&&($('name')||$('sname'))){apply();const ob=new MutationObserver(()=>{const sid=$('sid'),name=$('name')||$('sname');if(sid&&clean(sid.value)!==i.studentId){sid.value=i.studentId;name.value=i.studentName||name.value;apply()}});ob.observe(document.body,{subtree:true,childList:true});return}if(++tries<80)setTimeout(run,100)};run()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestUrlIdentityAuthorityV735={version:VERSION,identity,apply};
console.log('[AIQuest] URL identity authority v735 active • URL ID before stale local cache • Sheet canonical name');
})();