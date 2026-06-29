/* CSAI2102 AI Quest — Teacher AR + Attempt History v4.0.3
   - Displays every normal Session attempt received from Google Sheets.
   - Displays every S2 AR supplementary event from session_events.
   - Keeps AR separate from the score and gates of the normal Session.
*/
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let lastFingerprint = '';

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[char]));
  }
  function num(value, fallback=0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function parse(value){
    if (!value || typeof value === 'object') return value || {};
    try { return JSON.parse(String(value)); } catch (_) { return {}; }
  }
  function app(){ return window.AIQUEST_TEACHER_ONLY_DASHBOARD || null; }
  function dashboardState(){ return app()?.state || {}; }
  function rawStudents(){
    const raw = dashboardState().raw || {};
    const data = raw.data || raw;
    const all = data.allStudents || raw.allStudents || [];
    return Array.isArray(all) ? all : [];
  }
  function timeText(value){
    const seconds = Math.max(0,Math.round(num(value)));
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }
  function dateText(value){
    const parsed = Date.parse(value || '');
    return parsed ? new Date(parsed).toLocaleString() : (value || '-');
  }
  function sessionLabel(value){
    const key = String(value || '').toLowerCase().replace(/[\s_\-:]+/g,'');
    const map = {
      s1:'S1 · AI Awakening',m1:'S1 · AI Awakening',
      s2:'S2 · Agent Builder',m2:'S2 · Agent Builder',
      b1:'B1 · Rookie AI Boss',
      s3:'S3 · Search Maze',m3:'S3 · Search Maze',
      s4:'S4 · Route Cost',m4:'S4 · Route Cost',
      s5:'S5 · A* Rescue',m5:'S5 · A* Rescue',
      b2:'B2 · Search Arena Boss',
      s6:'S6 · Knowledge Base Forge',m6:'S6 · Knowledge Base Forge'
    };
    return map[key] || String(value || 'Unknown Session');
  }
  function accuracyText(row){
    const correct = num(row.correct,NaN);
    const total = num(row.total,NaN);
    if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) return `${Math.round(correct / total * 100)}%`;
    const direct = num(row.accuracy,NaN);
    return Number.isFinite(direct) && direct >= 0 ? `${Math.round(direct)}%` : '-';
  }
  function studentMap(){
    const map = new Map();
    const state = dashboardState();
    (state.students || []).forEach((student) => {
      map.set(String(student.studentId || ''), {
        name:String(student.name || student.studentName || ''),
        section:String(student.section || '')
      });
    });
    rawStudents().forEach((student) => {
      const id = String(student.studentId || student.id || '');
      if (!id) return;
      map.set(id, {
        name:String(student.studentName || student.name || map.get(id)?.name || ''),
        section:String(student.section || map.get(id)?.section || '')
      });
    });
    return map;
  }

  function normalAttempts(){
    const people = studentMap();
    const attempts = Array.isArray(dashboardState().attempts) ? dashboardState().attempts : [];
    return attempts.map((attempt,index) => {
      const raw = attempt.raw || {};
      const studentId = String(attempt.studentId || raw.studentId || raw.student_id || raw.id || '');
      const person = people.get(studentId) || {};
      const session = attempt.sessionId || raw.sessionId || raw.missionId || raw.session || raw.mission || '';
      return {
        index,
        studentId,
        studentName:person.name || String(raw.studentName || raw.name || ''),
        section:person.section || String(raw.section || ''),
        session,
        score:num(attempt.score ?? raw.score ?? raw.latestScore),
        accuracy:attempt.accuracy ?? raw.accuracy ?? raw.accuracyPct,
        correct:attempt.correct ?? raw.correct ?? raw.correctCount,
        total:attempt.total ?? raw.total ?? raw.totalQuestions,
        stars:num(attempt.stars ?? raw.stars),
        timestamp:String(attempt.timestamp || raw.timestamp || raw.time || raw.createdAt || raw.clientTs || ''),
        raw
      };
    }).sort((a,b) => {
      const at = Date.parse(a.timestamp) || 0;
      const bt = Date.parse(b.timestamp) || 0;
      return bt - at || b.index - a.index;
    });
  }

  function allArEvents(){
    const rows = [];
    rawStudents().forEach((student) => {
      const events = Array.isArray(student.recentEvents) ? student.recentEvents : [];
      events.forEach((event) => {
        const type = String(event?.eventType || '').toLowerCase();
        if (type !== 's1_ar_complete' && type !== 's2_ar_complete') return;
        const trace = parse(event.yourAnswer);
        rows.push({
          type,
          studentId:String(student.studentId || event.studentId || ''),
          studentName:String(student.studentName || student.name || ''),
          score:Math.round(num(trace.score ?? trace.arScore ?? event.scoreDelta)),
          correct:num(trace.correct ?? trace.arCorrect ?? event.combo),
          total:num(trace.total ?? trace.arTotal),
          help:num(trace.helpUsed ?? trace.arHelpUsed),
          usedSec:num(trace.usedSec ?? trace.arUsedSec),
          input:String(trace.inputMode ?? trace.arInputMode ?? 'hand_or_mouse_touch'),
          completedAt:String(trace.completedAt || event.serverTs || event.clientTs || ''),
          raw:event
        });
      });
    });
    return rows.sort((a,b) => (Date.parse(b.completedAt)||0) - (Date.parse(a.completedAt)||0));
  }

  function cardAfterStudents(id){
    let box = $(id);
    if (box) return box;
    const studentsCard = $('studentsBox')?.closest('.card');
    if (!studentsCard) return null;
    box = document.createElement('section');
    box.id = id;
    box.className = 'card';
    box.style.marginTop = '14px';
    studentsCard.insertAdjacentElement('afterend',box);
    return box;
  }
  function cardBeforeStudents(id){
    let box = $(id);
    if (box) return box;
    const studentsCard = $('studentsBox')?.closest('.card');
    if (!studentsCard) return null;
    box = document.createElement('section');
    box.id = id;
    box.className = 'card';
    box.style.marginBottom = '14px';
    studentsCard.insertAdjacentElement('beforebegin',box);
    return box;
  }

  function renderAttemptHistory(){
    const box = cardAfterStudents('aiquestAttemptHistoryV403');
    if (!box) return;
    const rows = normalAttempts();
    if (!rows.length) {
      box.innerHTML = `<h2>All Attempt History</h2><p class="muted">ยังไม่พบรายการ attempt จาก Server Summary</p>`;
      return;
    }
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">All Attempt History</h2>
          <p class="muted" style="margin:7px 0 0">แสดงทุกรอบที่เล่น ${rows.length} รอบจาก Google Sheets ไม่ได้แสดงเฉพาะ Latest</p>
        </div>
        <span class="pill blue">${rows.length} session attempts</span>
      </div>
      <div style="overflow:auto;max-height:620px;margin-top:12px">
        <table>
          <thead><tr><th>#</th><th>Student</th><th>Session</th><th>Score</th><th>Accuracy</th><th>Correct</th><th>Stars</th><th>Submitted</th></tr></thead>
          <tbody>${rows.map((row,i) => `
            <tr>
              <td>${i+1}</td>
              <td><b>${esc(row.studentId || '-')}</b><br><span class="muted">${esc(row.studentName || '')}</span></td>
              <td>${esc(sessionLabel(row.session))}</td>
              <td>${esc(row.score)}</td>
              <td>${esc(accuracyText(row))}</td>
              <td>${esc(num(row.correct,0))}/${esc(num(row.total,0) || '-')}</td>
              <td>${row.stars ? '★'.repeat(Math.min(3,row.stars)) : '-'}</td>
              <td>${esc(dateText(row.timestamp))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderS2Ar(){
    const box = cardBeforeStudents('s2ArAnalytics381');
    if (!box) return;
    const rows = allArEvents().filter(row => row.type === 's2_ar_complete');
    if (!rows.length) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
          <div><h2 style="margin:0">S2 AR Practice</h2><p class="muted" style="margin:7px 0 0">Agent Builder • กิจกรรมเสริมจาก session_events</p></div>
          <span class="pill warn">ยังไม่มี S2 AR event จาก Server Summary</span>
        </div>
        <div class="loading" style="margin-top:12px">หลังอัปเดตรอบนี้ ให้เปิด Student Page หนึ่งครั้งเพื่อส่งผล S2 AR ที่ค้างในเครื่องขึ้นระบบ แล้วกด Refresh ที่หน้านี้</div>`;
      return;
    }
    const average = Math.round(rows.reduce((sum,row) => sum + row.score,0) / rows.length);
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div><h2 style="margin:0">S2 AR Practice</h2><p class="muted" style="margin:7px 0 0">Agent Builder • ประวัติกิจกรรมเสริมจาก session_events</p></div>
        <span class="pill good">✓ Real S2 AR events ${rows.length} รอบ</span>
      </div>
      <div class="grid cols3" style="margin-top:12px">
        <div class="metric"><span class="muted">AR runs</span><b>${rows.length}</b></div>
        <div class="metric"><span class="muted">Avg AR score</span><b>${average}%</b></div>
        <div class="metric"><span class="muted">Latest completed</span><b style="font-size:17px">${esc(dateText(rows[0]?.completedAt))}</b></div>
      </div>
      <div style="overflow:auto;max-height:420px;margin-top:12px">
        <table>
          <thead><tr><th>Student</th><th>AR score</th><th>Correct</th><th>Help</th><th>Time</th><th>Input</th><th>Completed</th></tr></thead>
          <tbody>${rows.map(row => `
            <tr>
              <td><b>${esc(row.studentId || '-')}</b><br><span class="muted">${esc(row.studentName || '')}</span></td>
              <td><span class="pill ${row.score >= 85 ? 'good' : 'warn'}">${esc(row.score)}%</span></td>
              <td>${esc(row.correct)}/${esc(row.total || '-')}</td>
              <td>${esc(row.help)}</td>
              <td>${esc(timeText(row.usedSec))}</td>
              <td>${esc(row.input)}</td>
              <td>${esc(dateText(row.completedAt))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderArEvidenceHistory(){
    const box = cardAfterStudents('aiquestArEvidenceHistoryV403');
    if (!box) return;
    const rows = allArEvents();
    if (!rows.length) {
      box.innerHTML = `<h2>AR Evidence History</h2><p class="muted">ยังไม่มี S1/S2 AR evidence จาก session_events</p>`;
      return;
    }
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div><h2 style="margin:0">AR Evidence History</h2><p class="muted" style="margin:7px 0 0">แสดงทุกครั้งที่ทำ S1/S2 AR ไม่ตัดเหลือเฉพาะผลล่าสุด</p></div>
        <span class="pill good">${rows.length} AR runs</span>
      </div>
      <div style="overflow:auto;max-height:420px;margin-top:12px">
        <table>
          <thead><tr><th>AR Session</th><th>Student</th><th>Score</th><th>Correct</th><th>Help</th><th>Time</th><th>Completed</th></tr></thead>
          <tbody>${rows.map(row => `
            <tr>
              <td>${row.type === 's1_ar_complete' ? 'S1 · AI Object Scanner' : 'S2 · Agent Builder'}</td>
              <td><b>${esc(row.studentId || '-')}</b><br><span class="muted">${esc(row.studentName || '')}</span></td>
              <td>${esc(row.score)}%</td>
              <td>${esc(row.correct)}/${esc(row.total || '-')}</td>
              <td>${esc(row.help)}</td>
              <td>${esc(timeText(row.usedSec))}</td>
              <td>${esc(dateText(row.completedAt))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function fingerprint(){
    const state = dashboardState();
    const attempts = Array.isArray(state.attempts) ? state.attempts : [];
    const events = allArEvents();
    return JSON.stringify({
      attempts:attempts.map(a => [a.studentId,a.sessionId,a.score,a.timestamp,a.correct,a.total]),
      events:events.map(e => [e.type,e.studentId,e.completedAt,e.score,e.correct,e.total])
    });
  }

  function refresh(){
    const next = fingerprint();
    if (next === lastFingerprint && $('aiquestAttemptHistoryV403') && $('s2ArAnalytics381') && $('aiquestArEvidenceHistoryV403')) return;
    lastFingerprint = next;
    renderS2Ar();
    renderAttemptHistory();
    renderArEvidenceHistory();
  }

  function boot(){
    refresh();
    setInterval(refresh,900);
  }

  window.AIQUEST_TEACHER_S2_AR_ANALYTICS = {
    version:'v4.0.3',
    getS2Records:() => allArEvents().filter(row => row.type === 's2_ar_complete'),
    getAttempts:normalAttempts,
    refresh
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
