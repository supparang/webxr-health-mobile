(()=>{'use strict';
const K='CSAI2102_AIQUEST_PROFILE_V421',S='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
const c=v=>String(v||'').trim(),r=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(e){return{}}},w=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const getProfile=()=>{const p=r(K);if(p.studentId)return p;const s=r(S);return s.profile||s.student||{studentId:s.studentId||'',studentName:s.studentName||s.name||'',section:s.section||'101'}};
const saveProfile=x=>{const p={studentId:c(x?.studentId),studentName:c(x?.studentName||x?.name),section:'101',updatedAt:new Date().toISOString(),profileSource:c(x?.profileSource||'local')};if(!p.studentId||!p.studentName)return p;w(K,p);const s=r(S);s.studentId=p.studentId;s.studentName=p.studentName;s.name=p.studentName;s.section='101';s.profile=p;s.student=p;w(S,s);return p};
window.AIQuestStorage={getProfile,saveProfile,isProfileReady:p=>{p=p||getProfile();return!!(c(p.studentId)&&c(p.studentName)&&String(p.section||'101')==='101')},uid:(x='id')=>x+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,10)};
function bootSheetProfile(){
  const $=id=>document.getElementById(id),sid=$('sid'),name=$('name')||$('sname'),section=$('section'),note=$('profileNote')||$('profileStatus'),save=$('saveProfile');
  if(!sid||!name||!note)return;
  let lookupSeq=0,lookupTimer=null;
  const say=(text,kind)=>{note.className='notice'+(kind?' '+kind:'');note.textContent=text};
  const lookup=async quiet=>{
    const studentId=c(sid.value);if(!studentId)return;
    if(!/^[A-Za-z0-9_-]{1,32}$/.test(studentId)){if(!quiet)say('รหัสนักศึกษาใช้ตัวอักษร/ตัวเลขได้ไม่เกิน 32 ตัวอักษร','bad');return}
    const requestId=++lookupSeq;say('กำลังตรวจ Profile จาก Google Sheets…','');
    try{
      const response=await window.AIQuestSync?.lookupProfile?.({studentId});
      if(requestId!==lookupSeq)return;
      if(response?.ok&&response?.found&&response?.profile){
        const p=response.profile;
        if(String(p.studentId||'')!==studentId)return;
        const cached=saveProfile({studentId:p.studentId,studentName:p.studentName,section:'101',profileSource:'sheet'});
        name.value=cached.studentName; if(section)section.value='101';
        say('✓ ดึง Profile จาก Google Sheets แล้ว: '+cached.studentId+' • '+cached.studentName+' • Section 101','good');
        name.dataset.profileSource='sheet';
      }else if(response?.ok&&response?.action==='profileLookup'&&typeof response.found==='undefined'){
        if(!quiet)say('Profile Lookup ยังไม่ถูกเปิดใช้บน Apps Script — ใช้ข้อมูลในเครื่องชั่วคราว','bad');
      }else{
        name.dataset.profileSource='new';
        if(!quiet)say('ไม่พบ Profile ใน Google Sheets — กรอกชื่อ แล้วกดบันทึกข้อมูลเพื่อสร้าง Profile ใหม่','');
      }
    }catch(err){if(requestId===lookupSeq&&!quiet)say('เชื่อมต่อ Google Sheets ไม่สำเร็จ — กรอกชื่อและบันทึกในเครื่องได้','bad')}
  };
  sid.addEventListener('blur',()=>lookup(false));
  sid.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup(false)}});
  sid.addEventListener('input',()=>{clearTimeout(lookupTimer);lookupTimer=setTimeout(()=>{if(sid.value.trim().length>=1)lookup(true)},700)});
  if(save&&!document.getElementById('lookupProfile')){
    const btn=document.createElement('button');btn.type='button';btn.id='lookupProfile';btn.className='btn secondary';btn.textContent='ดึง Profile จาก Sheet';btn.title='ค้นหาด้วยรหัสนักศึกษาแบบตรงรหัส';btn.addEventListener('click',()=>lookup(false));
    save.parentElement?.insertBefore(btn,save);
  }
  const cached=getProfile();if(cached.studentId){sid.value=cached.studentId;name.value=cached.studentName||name.value;if(section)section.value='101';setTimeout(()=>lookup(true),250)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootSheetProfile,{once:true});else setTimeout(bootSheetProfile,0);
console.log('[AIQuest] storage runtime ready • Sheet-first cache enabled');
})();