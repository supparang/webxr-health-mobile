/*
  CSAI2102 AI Quest
  PATCH v2.3.7 Student Detail View
  Adds an all-students table + per-student detail modal to Teacher Console.
*/
(function(){
  'use strict';

  const VERSION = 'v2.3.7-student-detail-view';

  function qs(){ return new URLSearchParams(location.search); }
  function isTeacherMode(){
    const p = qs();
    return p.get('teacher') === '1' || p.get('admin') === '1' || p.get('dev') === '1' || p.get('mode') === 'teacher' || p.get('view') === 'teacher';
  }
  function $(selector){ return document.querySelector(selector); }
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function injectStyle(){
    if($('#aiquestStudentDetailStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiquestStudentDetailStyle';
    style.textContent = `
      .studentSearchRow{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
      .studentSearchRow input,.studentSearchRow select{flex:1 1 220px;background:rgba(255,255,255,.06);color:var(--text);border:1px solid var(--line);border-radius:14px;padding:10px 12px}
      .teacherModalBack{position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:120;display:none;align-items:center;justify-content:center;padding:18px}
      .teacherModalBack.show{display:flex}
      .teacherModal{width:min(980px,100%);max-height:90vh;overflow:auto;background:#0f172a;border:1px solid var(--line);border-radius:26px;box-shadow:0 24px 70px rgba(0,0,0,.5);padding:18px}
      .teacherModalTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .teacherModalTop h3{margin:0;font-size:24px}
      .studentDetailGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
      .studentDetailCard{border:1px solid var(--line);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.studentDetailCard b{color:#bae6fd}
      .reflectionBlock{border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(255,255,255,.045);margin-top:10px;line-height:1.65}
      .eventMini{margin-top:8px;padding:10px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);font-size:13px;line-height:1.55}
      .viewDetailBtn{padding:7px 9px;border-radius:999px;border:1px solid rgba(56,189,248,.35);background:rgba(56,189,248,.12);color:#bae6fd;font-weight:1000;cursor:pointer}
      .viewDetailBtn:hover{filter:brightness(1.12)}
      @media(max-width:780px){.studentDetailGrid{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    if($('#teacherAllStudentsPanel')) return;
    const consolePanel = $('#teacherConsolePanel');
    if(!consolePanel) return;
    const decisionBox = $('#teacherDecisionBox');
    const parentGrid = decisionBox ? decisionBox.closest('.teacherGrid2') : null;

    const panel = document.createElement('div');
    panel.className = 'teacherBox';
    panel.id = 'teacherAllStudentsPanel';
    panel.style.marginTop = '14px';
    panel.innerHTML = `
      <h3>All Students Detail</h3>
      <div class="teacherSmallNote">ดูนักศึกษาทุกคน กด View เพื่อดู attempts, reflection, misconception และ event รายคน</div>
      <div class="studentSearchRow">
        <input id="studentSearchInput" placeholder="ค้นหา studentId / ชื่อ / section">
        <select id="studentRiskFilter">
          <option value="all">ทั้งหมด</option>
          <option value="risk">เฉพาะคนที่ควรช่วย</option>
          <option value="notSubmitted">ยังไม่ส่ง</option>
          <option value="reflectionMissing">Reflection ไม่ครบ</option>
          <option value="mastery">Mastery</option>
        </select>
      </div>
      <div class="teacherTableWrap">
        <table class="teacherTable">
          <thead><tr><th>Student</th><th>Section</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Reflection</th><th>Risk</th><th>Detail</th></tr></thead>
          <tbody id="teacherAllStudentsBody"><tr><td colspan="8">กำลังโหลดข้อมูล...</td></tr></tbody>
        </table>
      </div>
    `;

    if(parentGrid) consolePanel.insertBefore(panel, parentGrid);
    else consolePanel.appendChild(panel);

    const modal = document.createElement('div');
    modal.className = 'teacherModalBack';
    modal.id = 'studentDetailModal';
    modal.innerHTML = `
      <div class="teacherModal">
        <div class="teacherModalTop">
          <div><h3 id="studentDetailTitle">Student Detail</h3><div class="teacherSmallNote" id="studentDetailSub"></div></div>
          <div class="teacherToolBar" style="margin-top:0">
            <button class="btn secondary" id="btnStudentDetailExport">Export Student JSON</button>
            <button class="btn secondary" id="btnStudentDetailClose">ปิด</button>
          </div>
        </div>
        <div id="studentDetailContent"></div>
      </div>`;
    document.body.appendChild(modal);

    $('#studentSearchInput').oninput = renderAllStudentsFromState;
    $('#studentRiskFilter').onchange = renderAllStudentsFromState;
    $('#btnStudentDetailClose').onclick = closeStudentDetail;
    $('#studentDetailModal').onclick = e => { if(e.target && e.target.id === 'studentDetailModal') closeStudentDetail(); };
    $('#btnStudentDetailExport').onclick = exportCurrentStudentJson;
  }

  function getAllStudents(){
    const data = window.AIQuestTeacherConsole && window.AIQuestTeacherConsole.lastData;
    const d = data && data.data ? data.data : {};
    return d.allStudents || d.studentsDetail || d.risks || [];
  }

  function renderAllStudentsFromState(){
    const body = $('#teacherAllStudentsBody');
    if(!body) return;
    const all = getAllStudents();
    const q = ($('#studentSearchInput')?.value || '').trim().toLowerCase();
    const filter = $('#studentRiskFilter')?.value || 'all';
    let list = all.slice();
    if(q){ list = list.filter(s => [s.studentId,s.studentName,s.section].join(' ').toLowerCase().includes(q)); }
    if(filter === 'risk') list = list.filter(s => (s.risks || []).length);
    else if(filter === 'notSubmitted') list = list.filter(s => !Number(s.attemptCount || 0));
    else if(filter === 'reflectionMissing') list = list.filter(s => Number(s.attemptCount || 0) && !s.reflectionComplete);
    else if(filter === 'mastery') list = list.filter(s => !!s.mastered);

    if(!list.length){ body.innerHTML = '<tr><td colspan="8">ไม่พบนักศึกษาตามเงื่อนไข</td></tr>'; return; }

    body.innerHTML = list.map(s => {
      const risks = (s.risks || []).map(tag => `<span class="riskTag ${/ต่ำ|ไม่ครบ|ยังไม่ส่ง|ผิด|help|Help|remedial/i.test(tag) ? 'bad' : 'warn'}">${escapeHtml(tag)}</span>`).join(' ') || '<span class="riskTag good">ปกติ</span>';
      return `<tr>
        <td><b>${escapeHtml(s.studentId || '-')}</b><br>${escapeHtml(s.studentName || '')}</td>
        <td>${escapeHtml(s.section || '-')}</td>
        <td>${Number(s.attemptCount || 0)}</td>
        <td>${escapeHtml(s.bestScore ?? '-')}</td>
        <td>${escapeHtml(s.latestScore ?? '-')}</td>
        <td>${s.reflectionComplete ? '<span class="riskTag good">ครบ</span>' : '<span class="riskTag bad">ไม่ครบ</span>'}</td>
        <td>${risks}</td>
        <td><button class="viewDetailBtn" data-student-id="${escapeHtml(s.studentId || '')}">View</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('.viewDetailBtn').forEach(btn => { btn.onclick = () => openStudentDetail(btn.getAttribute('data-student-id')); });
  }

  function openStudentDetail(studentId){
    const s = getAllStudents().find(x => String(x.studentId || '') === String(studentId || ''));
    if(!s){ alert('ไม่พบข้อมูลนักศึกษา: ' + studentId); return; }
    window.AIQuestTeacherConsole.currentStudent = s;
    $('#studentDetailTitle').textContent = `${s.studentId || '-'} · ${s.studentName || ''}`;
    $('#studentDetailSub').textContent = `Section ${s.section || '-'} · Attempts ${Number(s.attemptCount || 0)} · Best ${s.bestScore ?? '-'}`;
    const risks = (s.risks || []).map(tag => `<span class="riskTag bad">${escapeHtml(tag)}</span>`).join(' ') || '<span class="riskTag good">ปกติ</span>';
    const mis = (s.misconceptions || []).slice(0,8).map(m => `<span class="riskTag warn">${escapeHtml(m.key)}: ${Number(m.count || 0)}</span>`).join(' ') || 'ยังไม่มี misconception ชัดเจน';
    const attempts = (s.attempts || []).slice().reverse();
    const events = s.recentEvents || [];
    $('#studentDetailContent').innerHTML = `
      <div class="studentDetailGrid">
        <div class="studentDetailCard"><b>Best Score</b><br>${escapeHtml(s.bestScore ?? '-')}</div>
        <div class="studentDetailCard"><b>Latest Score</b><br>${escapeHtml(s.latestScore ?? '-')}</div>
        <div class="studentDetailCard"><b>Help Used</b><br>${escapeHtml(s.helpUsed ?? '-')}</div>
        <div class="studentDetailCard"><b>Reflection</b><br>${s.reflectionComplete ? 'ครบ' : 'ไม่ครบ'}</div>
      </div>
      <div class="reflectionBlock"><b>Risk:</b><br>${risks}<br><br><b>Misconception:</b><br>${mis}</div>
      <div class="reflectionBlock"><b>Latest Reflection</b><br><b>1)</b> ${escapeHtml(s.latestReflection?.reflection1 || '-')}<br><b>2)</b> ${escapeHtml(s.latestReflection?.reflection2 || '-')}<br><b>3)</b> ${escapeHtml(s.latestReflection?.reflection3 || '-')}</div>
      <div class="teacherGrid2">
        <div class="teacherBox"><h3>Attempts</h3><div class="teacherTableWrap"><table class="teacherTable"><thead><tr><th>Time</th><th>Score</th><th>Accuracy</th><th>Help</th><th>Stars</th><th>Boss</th></tr></thead><tbody>
          ${attempts.length ? attempts.map(a => `<tr><td>${escapeHtml(a.clientTs || a.serverTs || '-')}</td><td>${escapeHtml(a.score ?? '-')}</td><td>${escapeHtml(a.accuracy ?? '-')}</td><td>${escapeHtml(a.helpUsed ?? '-')}</td><td>${escapeHtml(a.stars ?? '-')}</td><td>${a.bossWin ? 'ชนะ' : 'ยังไม่ชนะ'}</td></tr>`).join('') : '<tr><td colspan="6">ยังไม่มี attempt</td></tr>'}
        </tbody></table></div></div>
        <div class="teacherBox"><h3>Recent Events / Wrong Items</h3>
          ${events.length ? events.map(e => `<div class="eventMini"><b>${escapeHtml(e.phase || e.eventType || '-')}</b><br>${escapeHtml(e.prompt || '')}<br><b>ตอบ:</b> ${escapeHtml(e.yourAnswer || '-')} | <b>เฉลย:</b> ${escapeHtml(e.correctAnswer || '-')} | <b>ถูก:</b> ${escapeHtml(e.isCorrect)}</div>`).join('') : '<div class="teacherSmallNote">ยังไม่มี event รายคน</div>'}
        </div>
      </div>`;
    $('#studentDetailModal').classList.add('show');
  }
  function closeStudentDetail(){ $('#studentDetailModal')?.classList.remove('show'); }
  function exportCurrentStudentJson(){
    const s = window.AIQuestTeacherConsole.currentStudent;
    if(!s){ alert('ยังไม่ได้เลือกนักศึกษา'); return; }
    const blob = new Blob([JSON.stringify(s, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `aiquest-student-${s.studentId || 'detail'}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function patchRefresh(){
    const api = window.AIQuestTeacherConsole;
    if(!api || api.__studentDetailPatched) return false;
    const original = api.refreshConsole;
    api.refreshConsole = async function(showToastFlag){
      const result = await original.call(api, showToastFlag);
      setTimeout(renderAllStudentsFromState, 80);
      return result;
    };
    api.__studentDetailPatched = true;
    return true;
  }

  function boot(){
    if(!isTeacherMode()) return;
    injectStyle();
    ensurePanel();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      ensurePanel();
      patchRefresh();
      renderAllStudentsFromState();
      if(tries > 20) clearInterval(timer);
    }, 400);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.AIQuestStudentDetail = {VERSION, renderAllStudentsFromState, openStudentDetail};
  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
