/* CSAI2102 Teacher Console View Recovery v6.7.2
   Delegated click handler survives dynamic table redraws. */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_VIEW_RECOVERY_V672__)return;
  window.__AIQUEST_TEACHER_VIEW_RECOVERY_V672__=true;
  function api(){return window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;}
  function resolveStudent(button){
    const row=button&&button.closest&&button.closest('tr');
    const id=row&&row.querySelector('td b')?String(row.querySelector('td b').textContent||'').trim():'';
    const runtime=api();
    const students=runtime&&runtime.state&&Array.isArray(runtime.state.students)?runtime.state.students:[];
    return students.find(student=>String(student.studentId||'').trim()===id)||null;
  }
  document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest?event.target.closest('.detailBtn'):null;
    if(!button)return;
    const runtime=api();
    const student=resolveStudent(button);
    if(!runtime||typeof runtime.showDetail!=='function'||!student)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runtime.showDetail(student);
  },true);
  console.log('[AIQuest] Teacher View recovery active');
})();