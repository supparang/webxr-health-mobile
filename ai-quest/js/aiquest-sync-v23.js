(()=>{'use strict';const wait=()=>window.AIQuestCloudLogger;const send=(method,p)=>{const c=wait();if(!c||typeof c[method]!=='function')return Promise.reject(new Error('Cloud logger unavailable'));return c[method](p)};window.AIQuestSync={submitProfile:p=>send('sendProfile',p),submitAttempt:p=>send('sendAttempt',p),submitEvent:p=>send('sendEvent',p),lookupProfile:p=>send('getProfile',p),lookupProgress:p=>send('getProgress',p)};
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSaveProfileButton,{once:true});else setTimeout(installSaveProfileButton,0);
console.log('[AIQuest] sync v27 ready • Sheet-only progress + explicit profile save');})();