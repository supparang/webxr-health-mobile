/* CSAI2102 Teacher Direct Detail Viewer v6.7.4
   Renders student history directly from the Teacher Console runtime.
   Does not depend on legacy showDetail bindings or dynamic row handlers.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_DETAIL_DIRECT_V674__)return;
  window.__AIQUEST_TEACHER_DETAIL_DIRECT_V674__=true;

  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const dateText=value=>{const t=Date.parse(String(value||''));return Number.isFinite(t)?new Date(t).toLocaleString():String(value||'-');};
  const canonical=value=>String(value||'').trim().toUpperCase()||'—';
  const modalId='aiquestDirectStudentDetailV674';

  function getStudents(){
    const app=runtime();
    return app&&app.state&&Array.isArray(app.state.students)?app.state.students:[];
  }

  function studentFor(button){
    const row=button.closest('tr');
    const id=String((row&&row.querySelector('td b')&&row.querySelector('td b').textContent)||'').trim();
    const students=getStudents();
    const direct=students.find(student=>String(student.studentId||'').trim()===id);
    if(direct)return direct;
    const index=Number(button.dataset.index);
    const ids=[...document.querySelectorAll('#studentsBox tbody tr')].map(tr=>String((tr.querySelector('td b')||{}).textContent||'').trim());
    const visibleId=Number.isFinite(index)?ids[index]:'';
    return students.find(student=>String(student.studentId||'').trim()===visibleId)||students[index]||null;
  }

  function sessionRows(attempts){
    const map=new Map();
    (attempts||[]).forEach(attempt=>{
      const id=canonical(attempt.sessionId||attempt.missionId);
      const stamp=attempt.serverTs||attempt.clientTs||attempt.timestamp||'';
      const old=map.get(id)||{attempts:0,best:0,latest:attempt,latestAt:stamp};
      old.attempts++;
      old.best=Math.max(old.best,num(attempt.score));
      if(Date.parse(stamp)||0>=Date.parse(old.latestAt)||0){old.latest=attempt;old.latestAt=stamp;}
      map.set(id,old);
    });
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([id,row])=>'<tr><td><b>'+esc(id)+'</b></td><td>'+row.attempts+'</td><td>'+row.best+'</td><td>'+num(row.latest.score)+'</td><td>'+esc(dateText(row.latestAt))+'</td></tr>').join('')||'<tr><td colspan="5">ยังไม่มี attempt detail</td></tr>';
  }

  function reflections(student){
    const r=student&&student.latestReflection&&typeof student.latestReflection==='object'?student.latestReflection:{};
    const keys=Object.keys(r).filter(key=>/^reflection/i.test(key)&&String(r[key]||'').trim());
    return keys.length?keys.slice(0,3).map(key=>'<div style="margin-top:8px;padding:11px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(255,255,255,.035)"><b>'+esc(key)+'</b><div style="margin-top:6px;line-height:1.58;white-space:pre-wrap">'+esc(r[key])+'</div></div>').join(''):'<p style="color:#9fb2cc">ยังไม่มี Reflection ล่าสุด</p>';
  }

  function remove(){document.getElementById(modalId)?.remove();}

  function render(student){
    remove();
    const attempts=Array.isArray(student.attempts)?student.attempts:[];
    const risks=Array.isArray(student.risks)&&student.risks.length?student.risks.join(' • '):'ไม่มีจุดที่ระบบระบุ';
    const shell=document.createElement('div');
    shell.id=modalId;
    shell.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.82);color:#e8f1ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    shell.innerHTML='<div style="width:min(100%,1040px);max-height:90vh;overflow:auto;background:#111c31;border:1px solid rgba(148,163,184,.26);border-radius:22px;padding:18px;box-shadow:0 25px 70px rgba(0,0,0,.45)">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0">'+esc(student.studentId)+' • '+esc(student.studentName)+'</h2><p style="margin:6px 0;color:#9fb2cc">Section '+esc(student.section||'101')+' • รายละเอียดจาก Google Sheets ที่โหลดในรอบนี้</p></div><button id="aiquestDirectDetailClose" style="border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:10px 14px;background:#1e293b;color:#fff;font-weight:800;cursor:pointer">ปิด</button></div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:10px;margin-top:14px"><div style="padding:12px;border:1px solid rgba(148,163,184,.22);border-radius:14px"><span style="color:#9fb2cc;font-size:12px">Attempts</span><b style="display:block;font-size:30px">'+num(student.attemptCount||attempts.length)+'</b></div><div style="padding:12px;border:1px solid rgba(148,163,184,.22);border-radius:14px"><span style="color:#9fb2cc;font-size:12px">Best</span><b style="display:block;font-size:30px">'+num(student.bestScore)+'</b></div><div style="padding:12px;border:1px solid rgba(148,163,184,.22);border-radius:14px"><span style="color:#9fb2cc;font-size:12px">Latest</span><b style="display:block;font-size:30px">'+num(student.latestScore)+'</b></div></div>'+
      '<section style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)"><h3 style="margin:0">Session history</h3><div style="overflow:auto;margin-top:10px"><table style="width:100%;min-width:650px;border-collapse:collapse"><thead><tr style="background:#0d172a;color:#bae6fd"><th style="text-align:left;padding:10px">Session</th><th style="text-align:left;padding:10px">Attempts</th><th style="text-align:left;padding:10px">Best</th><th style="text-align:left;padding:10px">Latest</th><th style="text-align:left;padding:10px">Latest submitted</th></tr></thead><tbody>'+sessionRows(attempts)+'</tbody></table></div></section>'+
      '<section style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)"><h3 style="margin:0">Review focus</h3><p style="line-height:1.6">'+esc(risks)+'</p></section>'+
      '<section style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)"><h3 style="margin:0">Latest Reflection</h3>'+reflections(student)+'</section>'+
      '</div>';
    document.body.appendChild(shell);
    document.getElementById('aiquestDirectDetailClose').onclick=remove;
    shell.addEventListener('click',event=>{if(event.target===shell)remove();});
  }

  document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest?event.target.closest('#studentsBox .detailBtn, #studentsBox button[data-index]'):null;
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const student=studentFor(button);
    if(student){render(student);return;}
    const box=document.getElementById('studentsBox');
    if(box){const note=document.createElement('div');note.style.cssText='margin:10px 0;padding:11px;border:1px solid rgba(251,113,133,.45);border-radius:12px;background:rgba(251,113,133,.1);color:#fecdd3';note.textContent='ยังอ่านรายละเอียดรายคนไม่สำเร็จ — กด Refresh Google Sheets แล้วลองใหม่';box.prepend(note);setTimeout(()=>note.remove(),3500);}
  },true);

  document.querySelectorAll('#studentsBox .detailBtn').forEach(button=>{button.disabled=false;button.style.pointerEvents='auto';});
  console.log('[AIQuest] Direct student detail viewer active v6.7.4');
})();