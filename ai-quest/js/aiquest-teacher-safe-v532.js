/*
  CSAI2102 AI Quest — Teacher Console Safe Runtime v5.3.2
  ---------------------------------------------------------
  Purpose: single bounded Google Sheets request, no polling loops,
  no MutationObserver, no repeated full-history rendering.
*/
(function(){
  'use strict';

  const VERSION = 'v5.3.2-teacher-safe-single-fetch';
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
  const SECTION = '101';
  const MAX_STUDENTS = 120;
  const MAX_ATTEMPTS_PER_DETAIL = 24;
  const CORE = [
    ['s1','S1 • AI Awakening'],['s2','S2 • Agent Builder'],['s3','S3 • Search Maze'],['b1','B1 • Foundation Boss Gate'],
    ['s4','S4 • Route Cost Challenge'],['s5','S5 • A* Rescue Mission'],['s6','S6 • Minimax Arena'],['b2','B2 • Search & Game AI Boss Gate']
  ];
  const PHASE2 = [['s7','S7 • Knowledge Base Forge'],['s8','S8 • Uncertainty & Bayes Lab'],['s9','S9 • Expert System Studio'],['b3','B3 • Reasoning & Knowledge Boss']];

  const state = { payload:null, data:null, students:[], loading:false, lastLoaded:'' };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = (value, fallback=0) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
  const array = (value) => Array.isArray(value) ? value : [];
  const obj = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };

  function canonical(value){
    const raw = String(value || '').toLowerCase().trim().replace(/[\s_\-:]+/g,'');
    const map = {
      m1:'s1',session1:'s1',mission1:'s1',s1:'s1',
      m2:'s2',session2:'s2',mission2:'s2',s2:'s2',
      m3:'s3',session3:'s3',mission3:'s3',s3:'s3',
      boss1:'b1',rookieboss:'b1',b1:'b1',
      m4:'s4',session4:'s4',mission4:'s4',s4:'s4',
      m5:'s5',session5:'s5',mission5:'s5',s5:'s5',
      m6:'s6',session6:'s6',mission6:'s6',s6:'s6',
      boss2:'b2',searchboss:'b2',b2:'b2',
      m7:'s7',session7:'s7',mission7:'s7',s7:'s7',
      m8:'s8',session8:'s8',mission8:'s8',s8:'s8',
      m9:'s9',session9:'s9',mission9:'s9',s9:'s9',
      boss3:'b3',reasoningboss:'b3',b3:'b3'
    };
    return map[raw] || raw;
  }

  function dateValue(value){
    const n = Date.parse(value || '');
    return Number.isFinite(n) ? n : 0;
  }

  function latestText(value){
    const n = dateValue(value);
    return n ? new Date(n).toLocaleString() : (value || '-');
  }

  function passed(attempt){
    const a = obj(attempt);
    return !!(a.mastered === true || a.bossWin === true || num(a.stars) >= 1 || num(a.score) >= 60 || String(a.gateStatus || '').toLowerCase().includes('pass'));
  }

  function normalizeStudent(row){
    const r = obj(row);
    const attempts = array(r.attempts).filter((a) => a && typeof a === 'object');
    const bestFromAttempts = attempts.reduce((max,a) => Math.max(max, num(a.score)), 0);
    const latestAttempt = attempts.slice().sort((a,b) => dateValue(b.serverTs || b.clientTs) - dateValue(a.serverTs || a.clientTs))[0] || {};
    const risks = array(r.risks).map(String).filter(Boolean);
    return {
      studentId: String(r.studentId || r.student_id || r.id || '-'),
      studentName: String(r.studentName || r.name || ''),
      section: String(r.section || SECTION),
      attempts,
      attemptCount: num(r.attemptCount, attempts.length),
      bestScore: Math.max(num(r.bestScore), bestFromAttempts),
      latestScore: num(r.latestScore, num(latestAttempt.score)),
      latestAccuracy: num(latestAttempt.accuracy, 0),
      mastered: !!r.mastered || attempts.some((a) => !!a.mastered),
      helpUsed: num(r.helpUsed),
      reflectionComplete: !!r.reflectionComplete,
      risks,
      misconceptions: array(r.misconceptions),
      latestReflection: obj(r.latestReflection),
      recentEvents: array(r.recentEvents)
    };
  }

  function extractStudents(payload){
    const data = obj(payload && payload.data ? payload.data : payload);
    const candidates = [data.allStudents, data.students, payload && payload.allStudents, payload && payload.students];
    const found = candidates.find(Array.isArray) || [];
    return found.map(normalizeStudent)
      .filter((student) => !student.section || String(student.section) === SECTION)
      .sort((a,b) => `${a.studentName}|${a.studentId}`.localeCompare(`${b.studentName}|${b.studentId}`));
  }

  function allAttempts(){
    return state.students.flatMap((student) => student.attempts.map((attempt) => Object.assign({studentId:student.studentId,studentName:student.studentName,section:student.section}, attempt)));
  }

  function stats(){
    const attempts = allAttempts();
    const latest = state.students.map((s) => num(s.latestScore, NaN)).filter(Number.isFinite);
    return {
      students: state.students.length,
      attempts: attempts.length || state.students.reduce((sum,s) => sum + s.attemptCount, 0),
      average: latest.length ? Math.round(latest.reduce((sum,v) => sum + v, 0) / latest.length) : 0
    };
  }

  function statusPill(ok, textValue){ return `<span class="pill ${ok ? 'good' : 'warn'}">${esc(textValue)}</span>`; }

  function auditRows(order){
    const attempts = allAttempts();
    return order.map(([id,label]) => {
      const rows = attempts.filter((attempt) => canonical(attempt.sessionId || attempt.missionId) === id);
      const graded = rows.filter((attempt) => !String(attempt.runMode || '').toLowerCase().includes('practice'));
      const list = graded.length ? graded : rows;
      const latest = list.slice().sort((a,b) => dateValue(b.serverTs || b.clientTs) - dateValue(a.serverTs || a.clientTs))[0] || {};
      const learners = new Set(list.map((a) => String(a.studentId || '')).filter(Boolean));
      return { id,label,rows:list,latest,learners,verified:list.length > 0 };
    });
  }

  function renderAudit(hostId, title, subtitle, order){
    const rows = auditRows(order);
    const verified = rows.filter((row) => row.verified).length;
    const body = rows.map((row) => `<tr>
      <td><b>${esc(row.label)}</b></td>
      <td>${statusPill(row.verified, row.verified ? 'ยืนยันแล้ว' : 'ยังไม่พบหลักฐาน')}</td>
      <td>${row.rows.length}</td><td>${row.learners.size}</td>
      <td>${row.verified ? esc(num(row.latest.score)) : '-'}</td>
      <td>${row.verified && num(row.latest.accuracy) ? esc(num(row.latest.accuracy))+'%' : '-'}</td>
      <td>${row.verified ? esc(latestText(row.latest.serverTs || row.latest.clientTs)) : '-'}</td>
    </tr>`).join('');
    set(hostId, `<div class="card-head"><div><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p></div><span class="pill ${verified===rows.length?'good':'warn'}">${verified}/${rows.length} sessions</span></div>
      <div class="table-wrap"><table><thead><tr><th>Session</th><th>หลักฐาน</th><th>Attempts</th><th>Students</th><th>Latest score</th><th>Accuracy</th><th>Latest submitted</th></tr></thead><tbody>${body}</tbody></table></div>`);
  }

  function filteredStudents(){
    const query = String($('studentSearch')?.value || '').toLowerCase().trim();
    const filter = String($('studentFilter')?.value || 'all');
    return state.students.filter((student) => {
      const haystack = `${student.studentId} ${student.studentName} ${student.section} ${student.risks.join(' ')} ${student.misconceptions.map((m)=>m && m.key || m).join(' ')}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filter === 'review' && !student.risks.length && student.latestScore >= 70) return false;
      if (filter === 'mastery' && !student.mastered && student.bestScore < 85) return false;
      return true;
    }).slice(0, MAX_STUDENTS);
  }

  function renderStudents(){
    const rows = filteredStudents();
    if (!rows.length) {
      set('studentsBox','<div class="loading">ยังไม่พบข้อมูลตามเงื่อนไข</div>');
      return;
    }
    set('studentsBox', `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Mastery</th><th>Review focus</th><th></th></tr></thead><tbody>${rows.map((s,index) => `<tr>
      <td><b>${esc(s.studentId)}</b><br><span class="muted">${esc(s.studentName)} • ${esc(s.section)}</span></td>
      <td>${esc(s.attemptCount)}</td><td>${esc(s.bestScore || '-')}</td><td>${esc(s.latestScore || '-')}</td>
      <td>${statusPill(s.mastered || s.bestScore >= 85, s.mastered || s.bestScore >= 85 ? 'Mastery' : s.latestScore >= 60 ? 'Passed' : 'Review')}</td>
      <td>${esc(s.risks[0] || (s.misconceptions[0] && (s.misconceptions[0].key || s.misconceptions[0])) || '—')}</td>
      <td><button class="btn detailBtn" data-index="${index}">View</button></td>
    </tr>`).join('')}</tbody></table></div>`);
    $$('.detailBtn').forEach((button) => button.onclick = () => showDetail(rows[num(button.dataset.index)]));
  }

  function $$(selector, root=document){ return [...root.querySelectorAll(selector)]; }

  function renderPhase(){
    const data = state.data || {};
    const phase = array(data.phaseAnalytics);
    if (phase.length) {
      set('phaseBox', phase.slice(0,12).map((item) => {
        const label = item.phase || item.label || item.name || 'Phase';
        const value = num(item.accuracy || item.pct || item.percent || item.score, 0);
        return `<div class="progress-row"><b>${esc(label)}</b><span>${esc(value)}%</span><div class="bar"><i style="width:${Math.max(2,Math.min(100,value))}%"></i></div></div>`;
      }).join(''));
      return;
    }
    set('phaseBox','<div class="loading">ยังไม่มี phase analytics จาก Google Sheets</div>');
  }

  function renderReview(){
    const rows = state.students.filter((s) => s.risks.length || s.latestScore < 60).slice(0,20);
    set('reviewBox', rows.length ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Latest</th><th>Focus</th></tr></thead><tbody>${rows.map((s) => `<tr><td>${esc(s.studentId)}<br><span class="muted">${esc(s.studentName)}</span></td><td>${esc(s.latestScore || '-')}</td><td>${esc(s.risks[0] || 'score / reflection review')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="loading">ยังไม่มีนักศึกษาที่ระบบระบุให้ทบทวนเป็นพิเศษ</div>');
  }

  function renderMisconceptions(){
    const counts = new Map();
    state.students.forEach((student) => array(student.misconceptions).forEach((item) => {
      const key = String(item && (item.key || item.label) || item || '').trim();
      const count = num(item && item.count, 1);
      if (key) counts.set(key, (counts.get(key) || 0) + count);
    }));
    const items = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0,10);
    set('misBox', items.length ? items.map(([key,count]) => `<span class="pill blue">${esc(key)} • ${esc(count)}</span>`).join('') : '<div class="loading">ยังไม่มี misconception summary จากการส่งผลล่าสุด</div>');
  }

  function renderSheetStatus(){
    const data = state.data || {};
    const payload = state.payload || {};
    set('sheetBox', `<p><b>Source:</b> Google Sheets teacherConsole</p><p><b>Section:</b> ${SECTION}</p><p><b>Server:</b> ${esc(payload.version || data.version || 'connected')}</p><p><b>Last refresh:</b> ${esc(state.lastLoaded || '-')}</p><p class="muted">หน้านี้โหลดข้อมูลเมื่อกด Refresh เท่านั้น เพื่อป้องกันหน้าเว็บค้าง</p>`);
  }

  function renderOverview(){
    const result = stats();
    text('mStudents', result.students || '-');
    text('mAttempts', result.attempts || '-');
    text('mAvg', result.average || '-');
    text('teacherSub','Teacher Console • Core + Module 3 • Section 101');
  }

  function renderAll(){
    renderOverview();
    renderStudents();
    renderPhase();
    renderReview();
    renderMisconceptions();
    renderAudit('coreAuditBox','Core Evidence Audit: S1–S6 / B1–B2','สรุปจาก attempt ที่อ่านได้จาก Google Sheets',CORE);
    renderAudit('phase2AuditBox','Module 3 Evidence Audit: S7–S9 / B3','แยกหลักฐาน Module 3 ออกจาก Core อย่างชัดเจน',PHASE2);
    renderSheetStatus();
  }

  function showDetail(student){
    if (!student) return;
    const attempts = student.attempts.slice().sort((a,b) => dateValue(b.serverTs || b.clientTs) - dateValue(a.serverTs || a.clientTs)).slice(0,MAX_ATTEMPTS_PER_DETAIL);
    const sessions = new Map();
    attempts.forEach((attempt) => {
      const id = canonical(attempt.sessionId || attempt.missionId);
      if (!id) return;
      const old = sessions.get(id) || {best:0,attempts:0,latest:attempt};
      old.attempts += 1;
      old.best = Math.max(old.best,num(attempt.score));
      if (dateValue(attempt.serverTs || attempt.clientTs) >= dateValue(old.latest.serverTs || old.latest.clientTs)) old.latest = attempt;
      sessions.set(id,old);
    });
    const reflection = Object.entries(student.latestReflection).filter(([key,value]) => /^reflection/i.test(key) && String(value || '').trim()).slice(0,3);
    const sessionRows = [...sessions.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([id,item]) => `<tr><td><b>${esc(id.toUpperCase())}</b></td><td>${esc(item.attempts)}</td><td>${esc(item.best)}</td><td>${esc(num(item.latest.score))}</td><td>${esc(latestText(item.latest.serverTs || item.latest.clientTs))}</td></tr>`).join('') || '<tr><td colspan="5">ยังไม่มีรายละเอียด attempt ใน payload</td></tr>';
    $('detailBox').innerHTML = `<div class="detail-header"><div><h2>${esc(student.studentId)} • ${esc(student.studentName)}</h2><p class="muted">Section ${esc(student.section)}</p></div><button class="btn" id="closeDetail">ปิด</button></div><div class="grid cols3"><div class="metric"><span>Attempts</span><b>${esc(student.attemptCount)}</b></div><div class="metric"><span>Best</span><b>${esc(student.bestScore)}</b></div><div class="metric"><span>Latest</span><b>${esc(student.latestScore)}</b></div></div><section class="detail-section"><h3>Session history</h3><div class="table-wrap"><table><thead><tr><th>Session</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Latest submitted</th></tr></thead><tbody>${sessionRows}</tbody></table></div></section><section class="detail-section"><h3>Review focus</h3><p>${esc(student.risks.join(' • ') || 'ไม่มีจุดที่ระบบระบุ')}</p></section><section class="detail-section"><h3>Latest Reflection</h3>${reflection.length ? reflection.map(([key,value]) => `<div class="reflection"><b>${esc(key)}</b><p>${esc(value)}</p></div>`).join('') : '<p class="muted">ยังไม่มี reflection ล่าสุด</p>'}</section>`;
    $('detailModal').classList.add('open');
    $('closeDetail').onclick = () => $('detailModal').classList.remove('open');
  }

  async function fetchJson(url){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url,{cache:'no-store',signal:controller.signal});
      const textValue = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return JSON.parse(textValue);
    } finally { clearTimeout(timer); }
  }

  async function load(){
    if (state.loading) return;
    state.loading = true;
    text('loadState','กำลังอ่านข้อมูลจาก Google Sheets…');
    const refresh = $('refreshBtn'); if (refresh) refresh.disabled = true;
    try {
      const payload = await fetchJson(`${ENDPOINT}?action=teacherConsole&section=${SECTION}&sessionId=all&includeTest=1&t=${Date.now()}`);
      state.payload = payload;
      state.data = obj(payload.data || payload);
      state.students = extractStudents(payload);
      state.lastLoaded = new Date().toLocaleString();
      renderAll();
      text('loadState', `โหลดข้อมูลแล้ว • ${state.lastLoaded}`);
    } catch (error) {
      const message = error && error.name === 'AbortError' ? 'หมดเวลารอ Google Sheets — ลอง Refresh อีกครั้ง' : `อ่านข้อมูลไม่สำเร็จ: ${error && error.message || error}`;
      text('loadState', message);
      set('studentsBox', `<div class="loading warnBox">${esc(message)}</div>`);
    } finally {
      state.loading = false;
      const refresh = $('refreshBtn'); if (refresh) refresh.disabled = false;
    }
  }

  function bind(){
    $('refreshBtn').onclick = load;
    $('studentSearch').oninput = renderStudents;
    $('studentFilter').onchange = renderStudents;
    $('previewBtn').onclick = () => window.open('./index.html?release=20260704-classroom','_blank','noopener');
    $('launchBtn').onclick = () => window.open('./classroom-launch.html?release=20260703-classroom','_blank','noopener');
    $('detailModal').onclick = (event) => { if (event.target === $('detailModal')) $('detailModal').classList.remove('open'); };
  }

  window.AIQUEST_TEACHER_SAFE_V532 = {VERSION,load,state,showDetail};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>{bind();load();},{once:true});
  else {bind();load();}
})();