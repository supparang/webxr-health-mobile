/* CSAI2102 Teacher Console View Recovery v6.7.3
   Delegated click handler survives dynamic table redraws and reflection patches. */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_VIEW_RECOVERY_V673__)return;
  window.__AIQUEST_TEACHER_VIEW_RECOVERY_V673__=true;
  function api(){return window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;}
  function runtimeStudents(){const r=api();return r&&r.state&&Array.isArray(r.state.students)?r.state.students:[];}
  function cellId(button){
    const row=button&&button.closest&&button.closest('tr');
    const strong=row&&row.querySelector('td b');
    return String((strong&&strong.textContent)||'').trim();
  }
  function visibleIds(){return [...document.querySelectorAll('#studentsBox tbody tr')].map(row=>String((row.querySelector('td b')||{}).textContent||'').trim());}
  function resolveStudent(button){
    const id=cellId(button);
    const list=runtimeStudents();
    if(id){const found=list.find(student=>String(student.studentId||'').trim()===id);if(found)return found;}
    const index=Number(button&&button.dataset&&button.dataset.index);
    if(Number.isFinite(index)){
      const byId=visibleIds()[index];
      const found=byId&&list.find(student=>String(student.studentId||'').trim()===byId);
      if(found)return found;
      return list[index]||null;
    }
    return null;
  }
  function warn(text){
    const box=document.getElementById('studentsBox');
    if(!box)return;
    const old=document.getElementById('viewRecoveryWarn');if(old)old.remove();
    const el=document.createElement('div');el.id='viewRecoveryWarn';el.className='loading warnBox';el.textContent=text;
    box.prepend(el);setTimeout(()=>el.remove(),3500);
  }
  function open(button){
    const runtime=api();
    const student=resolveStudent(button);
    if(!runtime||typeof runtime.showDetail!=='function'){warn('ยังโหลดระบบ View ไม่ครบ — กด Refresh Google Sheets แล้วลองอีกครั้ง');return false;}
    if(!student){warn('ยังหา student จากแถวนี้ไม่เจอ — กด Refresh Google Sheets แล้วลองอีกครั้ง');return false;}
    runtime.showDetail(student);
    setTimeout(()=>document.getElementById('detailModal')?.classList.add('open'),0);
    return true;
  }
  document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest?event.target.closest('#studentsBox .detailBtn, #studentsBox button[data-index]'):null;
    if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();open(button);
  },true);
  function reinforce(){document.querySelectorAll('#studentsBox .detailBtn, #studentsBox button[data-index]').forEach(button=>{button.disabled=false;button.style.pointerEvents='auto';});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reinforce,{once:true});else reinforce();
  const box=document.getElementById('studentsBox');if(box)new MutationObserver(reinforce).observe(box,{childList:true,subtree:true,attributes:true});
  console.log('[AIQuest] Teacher View recovery active v6.7.3');
})();