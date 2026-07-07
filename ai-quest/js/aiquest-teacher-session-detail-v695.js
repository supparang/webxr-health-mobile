/* CSAI2102 Teacher Session-Aware Detail Viewer v6.9.5
   One student may have attempts in multiple sessions. This viewer defaults to the
   true latest session, lets the teacher choose S1/S2/etc., and keeps metrics,
   selected evidence, and reflections bound to that same selected attempt.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_SESSION_DETAIL_V695__)return;
  window.__AIQUEST_TEACHER_SESSION_DETAIL_V695__=true;

  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const modalId='aiquestSessionDetailV695';
  const titles={s1:'S1 • AI Spotter',s2:'S2 • Agent Builder',s3:'S3 • Search Maze',b1:'B1 • Foundation Boss Gate',s4:'S4 • Route Cost Challenge',s5:'S5 • A* Rescue Mission',s6:'S6 • Minimax Arena',b2:'B2 • Search & Game AI Boss Gate',s7:'S7 • Knowledge Base Forge',s8:'S8 • Uncertainty & Bayes Lab',s9:'S9 • Expert System Studio',b3:'B3 • Reasoning & Knowledge Boss'};
  const canonical=value=>{const raw=String(value||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');const map={m1:'s1',session1:'s1',mission1:'s1',s1:'s1',m2:'s2',session2:'s2',mission2:'s2',s2:'s2',m3:'s3',session3:'s3',mission3:'s3',s3:'s3',boss1:'b1',b1:'b1',m4:'s4',session4:'s4',mission4:'s4',s4:'s4',m5:'s5',session5:'s5',mission5:'s5',s5:'s5',m6:'s6',session6:'s6',mission6:'s6',s6:'s6',boss2:'b2',b2:'b2',m7:'s7',session7:'s7',mission7:'s7',s7:'s7',m8:'s8',session8:'s8',mission8:'s8',s8:'s8',m9:'s9',session9:'s9',mission9:'s9',s9:'s9',boss3:'b3',b3:'b3'};return map[raw]||raw||'unknown';};
  const stamp=attempt=>Date.parse(String(attempt?.serverTs||attempt?.clientTs||attempt?.timestamp||''))||0;
  const dateText=value=>{const time=Date.parse(String(value||''));return Number.isFinite(time)?new Date(time).toLocaleString():String(value||'-');};
  const parsed=value=>{if(!value)return null;if(typeof value==='object')return value;try{return JSON.parse(String(value));}catch(e){return null;}};
  const metaFor=attempt=>{
    for(const value of [attempt?.extraJson,attempt?.extra,attempt?.metrics,attempt?.detail,attempt?.payload]){const object=parsed(value);if(object&&typeof object==='object')return object;}
    return {};
  };
  const state={student:null,groups:[],selectedId:'',selectedAttempt:null};

  function getStudents(){const app=runtime();return app?.state&&Array.isArray(app.state.students)?app.state.students:[];}
  function studentFor(button){
    const row=button.closest('tr');
    const id=String((row?.querySelector('td b')?.textContent)||'').trim();
    const students=getStudents();
    const direct=students.find(student=>String(student.studentId||'').trim()===id);if(direct)return direct;
    const index=num(button.dataset.index);
    const ids=[...document.querySelectorAll('#studentsBox tbody tr')].map(tr=>String(tr.querySelector('td b')?.textContent||'').trim());
    return students.find(student=>String(student.studentId||'').trim()===ids[index])||students[index]||null;
  }
  function groupAttempts(student){
    const map=new Map();
    (Array.isArray(student?.attempts)?student.attempts:[]).forEach(attempt=>{
      const id=canonical(attempt.sessionId||attempt.missionId);
      const row=map.get(id)||{id,title:titles[id]||id.toUpperCase(),attempts:[],latest:null,best:0,latestAt:0};
      row.attempts.push(attempt);row.best=Math.max(row.best,num(attempt.score));
      if(!row.latest||stamp(attempt)>=row.latestAt){row.latest=attempt;row.latestAt=stamp(attempt);}map.set(id,row);
    });
    return [...map.values()].sort((a,b)=>b.latestAt-a.latestAt||a.id.localeCompare(b.id));
  }
  function attemptsRows(groups){return groups.map(group=>'<tr data-session-row="'+esc(group.id)+'"><td><b>'+esc(group.id.toUpperCase())+'</b><br><span style="color:#9fb2cc">'+esc(group.title)+'</span></td><td>'+group.attempts.length+'</td><td>'+group.best+'</td><td>'+num(group.latest?.score)+'</td><td>'+esc(dateText(group.latest?.serverTs||group.latest?.clientTs||group.latest?.timestamp))+'</td><td><button class="aq-session-open" data-session="'+esc(group.id)+'">ดูรายละเอียด</button></td></tr>').join('')||'<tr><td colspan="6">ยังไม่มี attempt detail</td></tr>';}
  function reflectionRows(attempt){
    const meta=metaFor(attempt);const entries=[];
    for(const name of ['reflection1','reflection2','reflection3']){const value=attempt?.[name]??meta?.[name]??meta?.[name.replace('reflection','reflection_')];if(String(value||'').trim())entries.push([name,value]);}
    if(!entries.length&&meta?.reflections&&typeof meta.reflections==='object')Object.entries(meta.reflections).slice(0,3).forEach(([name,value])=>{if(String(value||'').trim())entries.push([name,value]);});
    return entries.length?entries.map(([name,value])=>'<div class="aq-reflection"><b>'+esc(name)+'</b><div>'+esc(value)+'</div></div>').join(''):'<p class="aq-muted">ยังไม่มี Reflection ของ session ที่เลือก</p>';
  }
  function evidence(attempt){
    const meta=metaFor(attempt);const ev=meta.coreReflectionEvidence||meta.reflectionEvidence||{};
    const context=meta.selectedCaseContext||attempt?.selectedCaseContext||ev.selectedCaseContext||'';
    const phase=meta.selectedCasePhase||attempt?.selectedCasePhase||ev.selectedCasePhase||'';
    const focus=meta.selectedCaseFocus||attempt?.selectedCaseFocus||ev.selectedCaseFocus||'';
    const id=meta.selectedCaseId||attempt?.selectedCaseId||ev.selectedCaseId||'';
    if(!context&&!id)return '';
    return '<section class="aq-evidence"><b>🔗 Selected Case Evidence</b><div class="aq-evidence-grid"><span><small>Case</small><strong>'+esc(context||id)+'</strong></span><span><small>Phase</small><strong>'+esc(phase||'—')+'</strong></span><span><small>Focus</small><strong>'+esc(focus||'—')+'</strong></span></div></section>';
  }
  function skillMetrics(attempt,sessionId){
    const meta=metaFor(attempt);const entries=[];
    const add=(label,correct,total)=>{const has=Number.isFinite(Number(correct))||Number.isFinite(Number(total));if(!has)return;entries.push([label,String(num(correct))+'/'+String(num(total))]);};
    add(sessionId==='s1'?'กลไก':'Mechanic',meta.mechanicCorrect??attempt?.mechanicCorrect,meta.mechanicCases??attempt?.mechanicCases??5);
    add(sessionId==='s1'?'ความรู้':'Analysis',meta.knowledgeCorrect??attempt?.knowledgeCorrect,meta.knowledgeCases??attempt?.knowledgeCases??8);
    add('Case Twist',meta.twistCorrect??attempt?.twistCorrect,meta.twistCases??attempt?.twistCases??2);
    if(meta.replayRound!=null)entries.push(['Replay Deck','#'+esc(meta.replayRound)]);
    if(attempt?.accuracy!=null||meta.accuracy!=null)entries.push(['Accuracy',Math.round(num(attempt.accuracy??meta.accuracy))+'%']);
    if(!entries.length)entries.push(['Score',String(num(attempt?.score))]);
    return '<div class="aq-session-metrics">'+entries.map(([label,value])=>'<div><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>').join('')+'</div>';
  }
  function sessionDetail(){
    const sessionId=state.selectedId;const group=state.groups.find(row=>row.id===sessionId)||state.groups[0];const attempt=group?.latest||null;state.selectedAttempt=attempt;
    const host=document.getElementById('aqSessionDetailBody');if(!host||!group||!attempt)return;
    const status=String(attempt.gateStatus||attempt.status||'').toLowerCase();const pass=attempt.mastered===true||attempt.bossWin===true||num(attempt.score)>=60||/pass|master/.test(status);
    host.innerHTML='<div class="aq-session-title"><div><h3>'+esc(group.title)+'</h3><p>รายละเอียดของ attempt ล่าสุดใน session ที่เลือก • '+esc(dateText(attempt.serverTs||attempt.clientTs||attempt.timestamp))+'</p></div><span class="aq-chip '+(pass?'good':'warn')+'">'+(pass?'ผ่าน / มีหลักฐาน':'ต้องทบทวน')+'</span></div>'+skillMetrics(attempt,group.id)+evidence(attempt)+'<section class="aq-session-reflections"><h3>Reflection ของ '+esc(group.id.toUpperCase())+'</h3>'+reflectionRows(attempt)+'</section>';
    window.__AIQUEST_TEACHER_SESSION_DETAIL_V695_STATE__={student:state.student,sessionId:group.id,attempt,group};
    window.dispatchEvent(new CustomEvent('aiquest:session-detail-change',{detail:window.__AIQUEST_TEACHER_SESSION_DETAIL_V695_STATE__}));
  }
  function setSession(id){state.selectedId=id;const select=document.getElementById('aqSessionSelectV695');if(select)select.value=id;document.querySelectorAll('[data-session-row]').forEach(row=>row.classList.toggle('selected',row.dataset.sessionRow===id));sessionDetail();}
  function remove(){document.getElementById(modalId)?.remove();}
  function render(student){
    remove();state.student=student;state.groups=groupAttempts(student);state.selectedId=state.groups[0]?.id||'';
    const attempts=Array.isArray(student?.attempts)?student.attempts:[];const latest=state.groups[0]?.latest||{};const risks=Array.isArray(student?.risks)&&student.risks.length?student.risks.join(' • '):'ไม่มีจุดที่ระบบระบุ';
    const shell=document.createElement('div');shell.id=modalId;shell.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.82);color:#e8f1ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    shell.innerHTML='<style>#'+modalId+' .aq-panel{width:min(100%,1080px);max-height:90vh;overflow:auto;background:#111c31;border:1px solid rgba(148,163,184,.26);border-radius:22px;padding:18px;box-shadow:0 25px 70px rgba(0,0,0,.45)}#'+modalId+' .aq-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}#'+modalId+' .aq-muted{color:#9fb2cc;line-height:1.58}#'+modalId+' .aq-close,#'+modalId+' .aq-session-open{border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:9px 12px;background:#1e293b;color:#fff;font-weight:800;cursor:pointer}#'+modalId+' .aq-summary,#'+modalId+' .aq-session-metrics{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:10px;margin-top:14px}#'+modalId+' .aq-summary>div,#'+modalId+' .aq-session-metrics>div{padding:12px;border:1px solid rgba(148,163,184,.22);border-radius:14px;background:rgba(255,255,255,.035)}#'+modalId+' small{display:block;color:#9fb2cc;font-size:12px}#'+modalId+' .aq-summary b{display:block;font-size:30px}#'+modalId+' .aq-session-metrics b{display:block;font-size:19px;margin-top:3px}#'+modalId+' .aq-section{margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)}#'+modalId+' table{width:100%;border-collapse:collapse;min-width:780px}#'+modalId+' th,#'+modalId+' td{padding:10px;text-align:left;border-bottom:1px solid rgba(148,163,184,.14);vertical-align:top}#'+modalId+' th{background:#0d172a;color:#bae6fd}#'+modalId+' .aq-scroll{overflow:auto;margin-top:10px}#'+modalId+' tr.selected{background:rgba(56,189,248,.12)}#'+modalId+' .aq-select{width:100%;margin-top:9px;padding:11px;border:1px solid rgba(56,189,248,.46);border-radius:13px;background:#16253a;color:#f8fbff;font:inherit;font-weight:800}#'+modalId+' .aq-session-title{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start}#'+modalId+' .aq-session-title h3,#'+modalId+' .aq-session-reflections h3{margin:0}#'+modalId+' .aq-session-title p{margin:5px 0;color:#9fb2cc}#'+modalId+' .aq-chip{display:inline-flex;border:1px solid rgba(148,163,184,.28);border-radius:999px;padding:6px 9px;font-size:12px;font-weight:850}#'+modalId+' .aq-chip.good{color:#bbf7d0;border-color:rgba(52,211,153,.45);background:rgba(52,211,153,.10)}#'+modalId+' .aq-chip.warn{color:#fde68a;border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.10)}#'+modalId+' .aq-evidence{margin-top:12px;padding:11px;border:1px solid rgba(52,211,153,.36);border-radius:13px;background:rgba(6,78,59,.17)}#'+modalId+' .aq-evidence-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:9px;margin-top:8px}#'+modalId+' .aq-evidence-grid span{padding:8px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(2,6,23,.16)}#'+modalId+' .aq-evidence-grid strong{display:block;margin-top:3px}#'+modalId+' .aq-reflection{margin-top:8px;padding:11px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(255,255,255,.035)}#'+modalId+' .aq-reflection div{margin-top:6px;line-height:1.58;white-space:pre-wrap}@media(max-width:720px){#'+modalId+' .aq-summary,#'+modalId+' .aq-session-metrics,#'+modalId+' .aq-evidence-grid{grid-template-columns:1fr}}</style><div class="aq-panel"><div class="aq-top"><div><h2 style="margin:0">'+esc(student.studentId)+' • '+esc(student.studentName)+'</h2><p class="aq-muted" style="margin:6px 0">Section '+esc(student.section||'101')+' • ดูรายละเอียดตาม Session ที่เลือก</p></div><button id="aqSessionDetailClose" class="aq-close">ปิด</button></div><div class="aq-summary"><div><small>Attempts</small><b>'+num(student.attemptCount||attempts.length)+'</b></div><div><small>Best</small><b>'+num(student.bestScore)+'</b></div><div><small>Latest</small><b>'+num(latest.score??student.latestScore)+'</b></div></div><section class="aq-section"><h3 style="margin:0">Session history</h3><div class="aq-scroll"><table><thead><tr><th>Session</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Latest submitted</th><th></th></tr></thead><tbody>'+attemptsRows(state.groups)+'</tbody></table></div></section><section class="aq-section"><h3 style="margin:0">Session detail</h3><p class="aq-muted" style="margin:6px 0">เลือก session เพื่อให้ Skill breakdown, Evidence และ Reflection เปลี่ยนตาม session เดียวกัน</p><select id="aqSessionSelectV695" class="aq-select">'+state.groups.map(group=>'<option value="'+esc(group.id)+'">'+esc(group.title)+' • '+group.attempts.length+' attempts • Latest '+num(group.latest?.score)+'</option>').join('')+'</select><div id="aqSessionDetailBody" style="margin-top:12px"></div></section><section class="aq-section"><h3 style="margin:0">Review focus</h3><p style="line-height:1.6">'+esc(risks)+'</p></section></div>';
    document.body.appendChild(shell);
    document.getElementById('aqSessionDetailClose').onclick=remove;
    shell.addEventListener('click',event=>{if(event.target===shell)remove();});
    shell.querySelectorAll('.aq-session-open').forEach(button=>button.onclick=()=>setSession(button.dataset.session));
    document.getElementById('aqSessionSelectV695').onchange=event=>setSession(event.target.value);
    setSession(state.selectedId);
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#studentsBox .detailBtn,#studentsBox button[data-index]');if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const student=studentFor(button);if(student)render(student);
  },true);
  console.log('[AIQuest] Session-aware teacher detail active v6.9.5');
})();