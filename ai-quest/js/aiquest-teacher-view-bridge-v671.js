/* CSAI2102 Teacher Console View Bridge v6.7.1
   Keeps per-student View buttons working after filtering, reflection audit,
   or any table re-render. Uses event delegation and resolves the student
   from the visible row instead of trusting stale button handlers.
*/
(()=>{'use strict';
  const api=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532;
  const clean=value=>String(value||'').trim();
  function students(){
    const a=api();
    return a&&a.state&&Array.isArray(a.state.students)?a.state.students:[];
  }
  function textOf(cell){return clean((cell&&cell.textContent)||'').split(/\s+/)[0]||'';}
  function resolveStudent(button){
    const row=button.closest('tr');
    const cells=row?[...row.children]:[];
    const studentId=textOf(cells[0]);
    if(studentId){
      const exact=students().find(s=>String(s.studentId)===studentId);
      if(exact)return exact;
    }
    const idx=Number(button.dataset.index);
    if(Number.isFinite(idx)){
      const tableIds=[...document.querySelectorAll('#studentsBox tbody tr')].map(tr=>textOf(tr.children[0]));
      const id=tableIds[idx];
      const byVisible=id&&students().find(s=>String(s.studentId)===id);
      if(byVisible)return byVisible;
      return students()[idx]||null;
    }
    return null;
  }
  function open(button){
    const a=api();
    const student=resolveStudent(button);
    if(a&&typeof a.showDetail==='function'&&student){
      a.showDetail(student);
      setTimeout(()=>document.getElementById('detailModal')?.classList.add('open'),0);
      return true;
    }
    return false;
  }
  function bindDelegation(){
    if(window.__AIQUEST_TEACHER_VIEW_BRIDGE_V671__)return;
    window.__AIQUEST_TEACHER_VIEW_BRIDGE_V671__=true;
    document.addEventListener('click',event=>{
      const button=event.target&&event.target.closest?event.target.closest('.detailBtn,button[data-index]'):null;
      if(!button||!document.getElementById('studentsBox')?.contains(button))return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if(!open(button)){
        const box=document.getElementById('studentsBox');
        if(box){
          const warn=document.createElement('div');
          warn.className='loading warnBox';
          warn.textContent='ยังเปิดรายละเอียดไม่ได้ — กด Refresh Google Sheets แล้วลอง View อีกครั้ง';
          box.prepend(warn);
          setTimeout(()=>warn.remove(),3200);
        }
      }
    },true);
  }
  function reinforce(){
    document.querySelectorAll('#studentsBox .detailBtn, #studentsBox button[data-index]').forEach(button=>{
      button.style.pointerEvents='auto';
      button.disabled=false;
    });
  }
  function init(){
    bindDelegation();
    reinforce();
    const box=document.getElementById('studentsBox');
    if(box)new MutationObserver(reinforce).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','style','class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();