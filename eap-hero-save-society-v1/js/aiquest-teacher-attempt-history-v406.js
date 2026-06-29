/* =========================================================
   CSAI2102 AI Quest — Teacher Full Attempt History v4.0.6
   File: /eap-hero-save-society-v1/js/aiquest-teacher-attempt-history-v406.js

   Purpose:
   - Keep the top Student Summary concise (Best/Latest).
   - Show every recorded normal attempt to the teacher, not only latest.
   - Add a per-student attempt timeline inside the existing View modal.
   - Surface S1/S2 AR evidence separately when present in session_events.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v4.0.6-teacher-full-attempt-history';
  const HISTORY_ID = 'aiquestFullAttemptHistoryV406';
  const STYLE_ID = 'aiquestFullAttemptHistoryStyleV406';
  const MODAL_SECTION_ID = 'aiquestStudentTimelineV406';
  let observerStarted = false;
  let detailObserverStarted = false;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));

  function num(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function first(obj, keys){
    const src = obj || {};
    for (const key of keys) {
      if (src[key] !== undefined && src[key] !== null && src[key] !== '') return src[key];
    }
    const lower = {};
    Object.keys(src).forEach((key) => { lower[String(key).toLowerCase()] = src[key]; });
    for (const key of keys) {
      const value = lower[String(key).toLowerCase()];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function app(){ return window.AIQUEST_TEACHER_ONLY_DASHBOARD || null; }
  function state(){ return app()?.state || {}; }

  function sessionKey(value){
    const raw = String(value || '').toLowerCase().replace(/[\s_\-:]+/g, '');
    const map = {
      s1:'S1 · AI Awakening', m1:'S1 · AI Awakening', session1:'S1 · AI Awakening', mission1:'S1 · AI Awakening',
      s2:'S2 · Agent Builder', m2:'S2 · Agent Builder', session2:'S2 · Agent Builder', mission2:'S2 · Agent Builder',
      b1:'B1 · Rookie AI Boss', boss1:'B1 · Rookie AI Boss',
      s3:'S3 · Search Maze', m3:'S3 · Search Maze', session3:'S3 · Search Maze', mission3:'S3 · Search Maze',
      s4:'S4 · Route Cost', m4:'S4 · Route Cost', session4:'S4 · Route Cost', mission4:'S4 · Route Cost',
      s5:'S5 · A* Rescue', m5:'S5 · A* Rescue', session5:'S5 · A* Rescue', mission5:'S5 · A* Rescue',
      b2:'B2 · Search Arena Boss', boss2:'B2 · Search Arena Boss',
      s6:'S6 · Knowledge Base Forge', m6:'S6 · Knowledge Base Forge', session6:'S6 · Knowledge Base Forge', mission6:'S6 · Knowledge Base Forge'
    };
    return map[raw] || String(value || 'Unknown Session');
  }

  function timestampOf(row){
    const raw = row?.raw || row || {};
    return String(first(raw, ['clientTs','serverTs','timestamp','time','createdAt','submittedAt','updatedAt']) || row?.timestamp || '');
  }

  function timeValue(value){
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function timeText(value){
    if (!value) return '-';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : String(value);
  }

  function accuracy(row){
    const raw = row?.raw || row || {};
    const direct = Number(first(raw, ['accuracy','accuracyPct','accuracyPercent']) || row?.accuracy);
    if (Number.isFinite(direct) && direct >= 0) return `${Math.round(direct)}%`;
    const correct = Number(first(raw, ['correct','correctCount','correctItems']) || row?.correct);
    const total = Number(first(raw, ['total','totalQuestions','questionCount']) || row?.total);
    return Number.isFinite(correct) && Number.isFinite(total) && total > 0
      ? `${Math.round(correct / total * 100)}%`
      : 'N/A';
  }

  function correctTotal(row){
    const raw = row?.raw || row || {};
    const correct = first(raw, ['correct','correctCount','correctItems']) || row?.correct;
    const total = first(raw, ['total','totalQuestions','questionCount']) || row?.total;
    return correct !== '' && total !== '' && total !== undefined ? `${correct}/${total}` : '-';
  }

  function helpText(row){
    const raw = row?.raw || row || {};
    const value = first(raw, ['helpUsed','aiHelpUsed','help','hintUsed']);
    return value === '' ? '-' : esc(value);
  }

  function normalAttempts(){
    const attempts = Array.isArray(state().attempts) ? state().attempts : [];
    return attempts.slice().map((attempt, index) => {
      const raw = attempt?.raw || attempt || {};
      return {
        index,
        studentId: String(attempt?.studentId || first(raw, ['studentId','student_id','id','student','pid']) || ''),
        sessionId: String(attempt?.sessionId || first(raw, ['sessionId','missionId','session','mission']) || ''),
        score: num(attempt?.score ?? first(raw, ['score','Score','latestScore','bestScore'])),
        stars: num(attempt?.stars ?? first(raw, ['stars','Stars'])),
        timestamp: timestampOf(attempt),
        raw,
        attempt
      };
    }).filter((row) => row.studentId).sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp) || b.index - a.index);
  }

  function arEvents(){
    const events = Array.isArray(state().events) ? state().events : [];
    return events.filter((event) => {
      const type = String(first(event, ['eventType','type','event_kind','kind'])).toLowerCase();
      return type === 's1_ar_complete' || type === 's2_ar_complete';
    }).map((event, index) => {
      let trace = {};
      try { trace = typeof event.yourAnswer === 'string' ? JSON.parse(event.yourAnswer) : (event.yourAnswer || {}); } catch (_) {}
      return {
        index,
        studentId: String(first(event, ['studentId','student_id','id','student','pid']) || ''),
        type: String(first(event, ['eventType','type','event_kind','kind']) || ''),
        score: num(trace.score ?? trace.arScore ?? event.scoreDelta),
        correct: first(trace, ['correct','arCorrect']) || event.combo || '',
        total: first(trace, ['total','arTotal']) || '',
        help: first(trace, ['helpUsed','arHelpUsed']) || '',
        input: first(trace, ['inputMode','arInputMode']) || '',
        timestamp: String(trace.completedAt || first(event, ['serverTs','clientTs','timestamp','time']) || ''),
        raw:event
      };
    }).filter((row) => row.studentId).sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp) || b.index - a.index);
  }

  function ensureStyle(){
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${HISTORY_ID} .attempt-history-tools{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:12px 0}
      #${HISTORY_ID} .attempt-history-wrap{overflow:auto;max-height:620px;border:1px solid rgba(148,163,184,.16);border-radius:14px}
      #${HISTORY_ID} .attempt-history-note{color:var(--muted);font-size:13px;line-height:1.55;margin:7px 0 0}
      #${MODAL_SECTION_ID}{margin-top:12px}
      #${MODAL_SECTION_ID} .attempt-history-wrap{overflow:auto;max-height:500px;border:1px solid rgba(148,163,184,.16);border-radius:14px}
      .attempt-history-tag{display:inline-flex;align-items:center;border:1px solid rgba(56,189,248,.34);background:rgba(56,189,248,.11);color:#bae6fd;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:900}
      @media(max-width:780px){#${HISTORY_ID} .attempt-history-tools{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function students(){
    return Array.isArray(state().students) ? state().students : [];
  }

  function historyPanel(){
    let panel = $(HISTORY_ID);
    if (panel) return panel;
    const studentsCard = $('studentsBox')?.closest('.card');
    if (!studentsCard) return null;
    panel = document.createElement('section');
    panel.id = HISTORY_ID;
    panel.className = 'card';
    panel.style.marginTop = '14px';
    studentsCard.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function renderHistory(){
    ensureStyle();
    const panel = historyPanel();
    if (!panel) return;

    const attempts = normalAttempts();
    const currentStudent = $('attemptHistoryStudentV406')?.value || 'all';
    const currentSession = $('attemptHistorySessionV406')?.value || 'all';
    const query = String($('attemptHistorySearchV406')?.value || '').trim().toLowerCase();

    const studentOptions = students().map((student) => {
      const id = String(student.studentId || '');
      const name = String(student.name || student.studentName || '');
      return `<option value="${esc(id)}" ${currentStudent === id ? 'selected' : ''}>${esc(id)}${name ? ' · ' + esc(name) : ''}</option>`;
    }).join('');

    const sessions = [...new Set(attempts.map((row) => row.sessionId).filter(Boolean))];
    const sessionOptions = sessions.map((session) => `<option value="${esc(session)}" ${currentSession === session ? 'selected' : ''}>${esc(sessionKey(session))}</option>`).join('');

    const filtered = attempts.filter((row) => {
      const haystack = `${row.studentId} ${row.sessionId} ${row.score} ${row.timestamp}`.toLowerCase();
      return (currentStudent === 'all' || row.studentId === currentStudent) &&
        (currentSession === 'all' || row.sessionId === currentSession) &&
        (!query || haystack.includes(query));
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">All Attempt History</h2>
          <p class="attempt-history-note">แสดงทุกครั้งที่นักศึกษาเล่นและส่งผลเข้า Google Sheets ไม่ตัดเหลือเฉพาะ Best หรือ Latest</p>
        </div>
        <span class="attempt-history-tag">${attempts.length} saved attempts</span>
      </div>
      <div class="attempt-history-tools">
        <select id="attemptHistoryStudentV406"><option value="all">นักศึกษาทุกคน</option>${studentOptions}</select>
        <select id="attemptHistorySessionV406"><option value="all">ทุก Session / Boss</option>${sessionOptions}</select>
        <input id="attemptHistorySearchV406" placeholder="ค้นหา student / session / score" value="${esc(query)}">
      </div>
      <div class="attempt-history-wrap">
        <table>
          <thead><tr><th>#</th><th>Submitted</th><th>Student</th><th>Session</th><th>Score</th><th>Accuracy</th><th>Correct</th><th>Stars</th><th>Help</th></tr></thead>
          <tbody>${filtered.length ? filtered.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${esc(timeText(row.timestamp))}</td>
              <td><b>${esc(row.studentId)}</b></td>
              <td>${esc(sessionKey(row.sessionId))}</td>
              <td>${esc(row.score)}</td>
              <td>${esc(accuracy(row.attempt))}</td>
              <td>${esc(correctTotal(row.attempt))}</td>
              <td>${row.stars ? '★'.repeat(Math.min(3, row.stars)) : '-'}</td>
              <td>${helpText(row.attempt)}</td>
            </tr>`).join('') : '<tr><td colspan="9" class="muted">ไม่พบ attempt ตามตัวกรอง</td></tr>'}</tbody>
        </table>
      </div>`;

    ['attemptHistoryStudentV406','attemptHistorySessionV406'].forEach((id) => {
      $(id)?.addEventListener('change', renderHistory);
    });
    $('attemptHistorySearchV406')?.addEventListener('input', renderHistory);
  }

  function resolveStudentFromDetail(){
    const box = $('detailBox');
    const text = String(box?.textContent || '');
    return students().find((student) => {
      const id = String(student.studentId || '');
      return id && text.includes(id);
    }) || null;
  }

  function appendStudentTimeline(){
    const detail = $('detailBox');
    if (!detail || !detail.innerHTML || $(MODAL_SECTION_ID)) return;
    if (!/Session Progress|Latest Reflection|Teacher Recommendation/i.test(detail.textContent || '')) return;

    const student = resolveStudentFromDetail();
    if (!student) return;
    const studentId = String(student.studentId || '');
    const attempts = normalAttempts().filter((row) => row.studentId === studentId);
    const ars = arEvents().filter((row) => row.studentId === studentId);

    const section = document.createElement('section');
    section.id = MODAL_SECTION_ID;
    section.className = 'card';
    section.innerHTML = `
      <h3 style="margin-top:0">Attempt Timeline — ทุกครั้งที่เล่น</h3>
      <p class="muted" style="margin-top:-2px">จำนวน ${attempts.length} รอบจาก Google Sheets เรียงจากล่าสุดไปเก่าสุด</p>
      <div class="attempt-history-wrap">
        <table>
          <thead><tr><th>Submitted</th><th>Session</th><th>Score</th><th>Accuracy</th><th>Correct</th><th>Stars</th><th>Help</th></tr></thead>
          <tbody>${attempts.length ? attempts.map((row) => `
            <tr>
              <td>${esc(timeText(row.timestamp))}</td>
              <td>${esc(sessionKey(row.sessionId))}</td>
              <td>${esc(row.score)}</td>
              <td>${esc(accuracy(row.attempt))}</td>
              <td>${esc(correctTotal(row.attempt))}</td>
              <td>${row.stars ? '★'.repeat(Math.min(3, row.stars)) : '-'}</td>
              <td>${helpText(row.attempt)}</td>
            </tr>`).join('') : '<tr><td colspan="7" class="muted">ยังไม่พบ attempt รายครั้งใน response นี้</td></tr>'}</tbody>
        </table>
      </div>
      <div style="margin-top:14px">
        <h3 style="margin:0 0 7px">AR Evidence</h3>
        ${ars.length ? `<div class="attempt-history-wrap"><table><thead><tr><th>Completed</th><th>Activity</th><th>Score</th><th>Correct</th><th>Help</th><th>Input</th></tr></thead><tbody>${ars.map((row) => `
          <tr><td>${esc(timeText(row.timestamp))}</td><td>${row.type === 's1_ar_complete' ? 'S1 · AI Object Scanner' : 'S2 · Agent Builder'}</td><td>${esc(row.score)}%</td><td>${esc(row.correct)}/${esc(row.total || '-')}</td><td>${esc(row.help || 0)}</td><td>${esc(row.input || '-')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">ยังไม่มี AR evidence ใน response นี้</div>'}
      </div>`;
    detail.appendChild(section);
  }

  function observeDetail(){
    if (detailObserverStarted) return;
    const detail = $('detailBox');
    if (!detail) return;
    detailObserverStarted = true;
    new MutationObserver(() => setTimeout(appendStudentTimeline, 0)).observe(detail, { childList:true, subtree:true });
  }

  function boot(){
    ensureStyle();
    renderHistory();
    observeDetail();

    if (observerStarted) return;
    observerStarted = true;
    const studentsBox = $('studentsBox');
    if (studentsBox) {
      new MutationObserver(() => setTimeout(renderHistory, 0)).observe(studentsBox, { childList:true, subtree:true });
    }

    const refresh = $('refreshBtn');
    refresh?.addEventListener('click', () => setTimeout(renderHistory, 700));
    window.addEventListener('aiquest:teacher-data-loaded', () => setTimeout(renderHistory, 0));
  }

  function startWhenReady(tries = 0){
    if (app() && $('studentsBox')) { boot(); return; }
    if (tries < 50) setTimeout(() => startWhenReady(tries + 1), 120);
  }

  window.AIQUEST_TEACHER_ATTEMPT_HISTORY = Object.freeze({
    version: VERSION,
    renderHistory,
    normalAttempts,
    arEvents
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startWhenReady(), { once:true });
  else startWhenReady();
})();
