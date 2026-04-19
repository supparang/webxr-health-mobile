const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwe1R6e_771rxLsBct6nypvOvHn6vZhdBeCf0p3Kr2v_9phhMFbwBqLnV5Ug2ZAnBG2/exec';

const els = {
  sectionFilter: document.getElementById('sectionFilter'),
  sessionCodeFilter: document.getElementById('sessionCodeFilter'),
  bankFilter: document.getElementById('bankFilter'),
  modeFilter: document.getElementById('modeFilter'),
  studentSearch: document.getElementById('studentSearch'),
  applyFilterBtn: document.getElementById('applyFilterBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearFilterBtn: document.getElementById('clearFilterBtn'),

  ovStudents: document.getElementById('ovStudents'),
  ovSessions: document.getElementById('ovSessions'),
  ovScore: document.getElementById('ovScore'),
  ovAcc: document.getElementById('ovAcc'),

  studentsTableBody: document.getElementById('studentsTableBody'),
  detailName: document.getElementById('detailName'),
  detailMeta: document.getElementById('detailMeta'),
  detailBadges: document.getElementById('detailBadges'),
  detailSessions: document.getElementById('detailSessions'),
  detailAvgScore: document.getElementById('detailAvgScore'),
  detailAvgAcc: document.getElementById('detailAvgAcc'),
  weakTermsList: document.getElementById('weakTermsList'),
  sessionsList: document.getElementById('sessionsList'),
  overviewWeakTerms: document.getElementById('overviewWeakTerms')
};

const state = {
  students: [],
  filteredStudents: [],
  selectedStudentId: '',
  lastOverview: null
};

function bangkokIsoNow(){
  try{
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(new Date());
    const map = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;
  }catch(_){
    return new Date().toISOString();
  }
}

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v){
  return String(v || '').trim();
}

function htmlEscape(str){
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getFilters(){
  return {
    section: safeStr(els.sectionFilter.value),
    session_code: safeStr(els.sessionCodeFilter.value),
    bank: safeStr(els.bankFilter.value),
    mode: safeStr(els.modeFilter.value)
  };
}

async function postAction(action, payload = {}, timeoutMs = 6000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try{
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        source: 'teacher.html',
        schema: 'teacher-v1',
        action,
        timestamp: bangkokIsoNow(),
        payload
      }),
      signal: controller.signal
    });

    const data = await res.json();
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function setLoading(isLoading){
  document.body.classList.toggle('loading', !!isLoading);
}

function makePill(text, type = ''){
  const cls = type ? `pill ${type}` : 'pill';
  return `<span class="${cls}">${htmlEscape(text)}</span>`;
}

function accuracyPill(acc){
  const n = safeNum(acc);
  if (n >= 80) return makePill(`${n}%`, 'good');
  if (n >= 60) return makePill(`${n}%`, 'warn');
  return makePill(`${n}%`, 'bad');
}

function scoreText(v){
  return safeNum(v).toFixed(0);
}

function renderOverview(summary){
  const s = summary || {};
  els.ovStudents.textContent = scoreText(s.total_students);
  els.ovSessions.textContent = scoreText(s.total_sessions);
  els.ovScore.textContent = scoreText(s.avg_score);
  els.ovAcc.textContent = `${safeNum(s.avg_accuracy).toFixed(1)}%`;

  const weak = Array.isArray(s.top_weak_terms) ? s.top_weak_terms : [];
  if (!weak.length){
    els.overviewWeakTerms.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';
    return;
  }

  els.overviewWeakTerms.innerHTML = weak.map(item => `
    <div class="listItem">
      <strong>${htmlEscape(item.term || '-')}</strong>
      <div>Wrong: ${scoreText(item.wrong)} • Seen: ${scoreText(item.seen)}</div>
    </div>
  `).join('');
}

function renderStudentsTable(){
  const rows = state.filteredStudents;

  if (!rows.length){
    els.studentsTableBody.innerHTML = '<tr><td colspan="8">ไม่พบข้อมูลนักศึกษาตามเงื่อนไขนี้</td></tr>';
    return;
  }

  els.studentsTableBody.innerHTML = rows.map(r => {
    const isActive = safeStr(r.student_id) === safeStr(state.selectedStudentId);
    return `
      <tr data-student-id="${htmlEscape(r.student_id)}" class="${isActive ? 'active' : ''}">
        <td class="mono">${htmlEscape(r.student_id || '-')}</td>
        <td>${htmlEscape(r.display_name || '-')}</td>
        <td>${htmlEscape(r.section || '-')}</td>
        <td>${scoreText(r.sessions_count)}</td>
        <td>${scoreText(r.last_score)}</td>
        <td>${safeNum(r.last_accuracy).toFixed(1)}%</td>
        <td>${htmlEscape(r.last_session_code || '-')}</td>
        <td>
          ${r.recommended_mode ? makePill(r.recommended_mode) : ''}
          ${r.recommended_difficulty ? makePill(r.recommended_difficulty, 'warn') : ''}
        </td>
      </tr>
    `;
  }).join('');

  els.studentsTableBody.querySelectorAll('tr[data-student-id]').forEach(tr => {
    tr.addEventListener('click', () => {
      const sid = tr.getAttribute('data-student-id') || '';
      if (!sid) return;
      state.selectedStudentId = sid;
      renderStudentsTable();
      loadStudentDetail(sid);
    });
  });
}

function applyStudentSearch(){
  const q = safeStr(els.studentSearch.value).toLowerCase();

  state.filteredStudents = state.students.filter(r => {
    if (!q) return true;
    const hay = [
      safeStr(r.student_id),
      safeStr(r.display_name),
      safeStr(r.section)
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });

  renderStudentsTable();
}

function renderDetail(profile, summary){
  if (!profile){
    els.detailName.textContent = 'ไม่พบข้อมูลนักศึกษา';
    els.detailMeta.textContent = 'ลองเลือกนักศึกษาคนอื่น หรือเช็กว่ามี student_id ใน sheet หรือไม่';
    els.detailBadges.innerHTML = '';
    els.detailSessions.textContent = '-';
    els.detailAvgScore.textContent = '-';
    els.detailAvgAcc.textContent = '-';
    return;
  }

  els.detailName.textContent = safeStr(profile.display_name) || 'Unnamed Student';
  els.detailMeta.innerHTML =
    `Student ID: <span class="mono">${htmlEscape(profile.student_id || '-')}</span><br>` +
    `Section: ${htmlEscape(profile.section || '-')} • Last Session: <span class="mono">${htmlEscape(profile.last_session_id || '-')}</span>`;

  const badges = [];
  if (profile.recommended_mode) badges.push(makePill(profile.recommended_mode));
  if (profile.recommended_difficulty) badges.push(makePill(profile.recommended_difficulty, 'warn'));
  els.detailBadges.innerHTML = badges.join(' ');

  els.detailSessions.textContent = scoreText(summary?.sessions_count);
  els.detailAvgScore.textContent = scoreText(summary?.avg_score);
  els.detailAvgAcc.textContent = `${safeNum(summary?.avg_accuracy).toFixed(1)}%`;
}

function renderWeakTerms(rows){
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length){
    els.weakTermsList.innerHTML = '<div class="empty">ยังไม่มี weak terms สำหรับนักศึกษาคนนี้</div>';
    return;
  }

  els.weakTermsList.innerHTML = list.map(item => `
    <div class="listItem">
      <strong>${htmlEscape(item.term || item.term_id || '-')}</strong>
      <div>Wrong: ${scoreText(item.wrong)} • Correct: ${scoreText(item.correct)} • Seen: ${scoreText(item.seen)}</div>
      <div>Accuracy: ${safeNum(item.accuracy).toFixed(1)}% • Avg RT: ${scoreText(item.avg_response_ms)} ms • Level: ${htmlEscape(item.last_level_after || '-')}</div>
    </div>
  `).join('');
}

function renderSessions(rows){
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length){
    els.sessionsList.innerHTML = '<div class="empty">ยังไม่มี recent sessions</div>';
    return;
  }

  els.sessionsList.innerHTML = list.slice(0, 20).map(item => `
    <div class="listItem">
      <strong>${htmlEscape(item.session_code || '-')} • ${htmlEscape(item.mode || '-')} • Bank ${htmlEscape(item.bank || '-')}</strong>
      <div>Score: ${scoreText(item.score)} • Accuracy: ${safeNum(item.accuracy).toFixed(1)}% • Mistakes: ${scoreText(item.mistakes)}</div>
      <div>Started: ${htmlEscape(item.started_at || '-')}</div>
      <div>Ended: ${htmlEscape(item.ended_at || item.timestamp || '-')}</div>
    </div>
  `).join('');
}

async function loadOverviewAndStudents(){
  setLoading(true);
  try{
    const filters = getFilters();

    const [overviewRes, studentsRes] = await Promise.all([
      postAction('teacher_get_overview', filters),
      postAction('teacher_get_students', filters)
    ]);

    state.lastOverview = overviewRes?.summary || {};
    state.students = Array.isArray(studentsRes?.rows) ? studentsRes.rows : [];
    renderOverview(state.lastOverview);
    applyStudentSearch();

    if (state.selectedStudentId){
      const stillExists = state.students.some(x => safeStr(x.student_id) === safeStr(state.selectedStudentId));
      if (stillExists){
        loadStudentDetail(state.selectedStudentId);
      } else {
        state.selectedStudentId = '';
        clearDetail();
      }
    } else {
      clearDetail();
    }
  } catch (err){
    console.error(err);
    alert('โหลดข้อมูลครูไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function clearDetail(){
  els.detailName.textContent = 'ยังไม่ได้เลือกนักศึกษา';
  els.detailMeta.textContent = 'เลือกจากตารางด้านซ้ายเพื่อดูข้อมูลรายคน';
  els.detailBadges.innerHTML = '';
  els.detailSessions.textContent = '-';
  els.detailAvgScore.textContent = '-';
  els.detailAvgAcc.textContent = '-';
  els.weakTermsList.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';
  els.sessionsList.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';
}

async function loadStudentDetail(studentId){
  if (!studentId) return;
  setLoading(true);
  try{
    const filters = getFilters();
    const res = await postAction('teacher_get_student_detail', {
      ...filters,
      student_id: studentId
    });

    renderDetail(res?.profile || null, res?.summary || {});
    renderWeakTerms(res?.weak_terms || []);
    renderSessions(res?.sessions || []);
  } catch (err){
    console.error(err);
    alert('โหลดรายละเอียดนักศึกษาไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function clearFilters(){
  els.sectionFilter.value = '';
  els.sessionCodeFilter.value = '';
  els.bankFilter.value = '';
  els.modeFilter.value = '';
  els.studentSearch.value = '';
}

els.applyFilterBtn.addEventListener('click', loadOverviewAndStudents);
els.refreshBtn.addEventListener('click', loadOverviewAndStudents);
els.clearFilterBtn.addEventListener('click', () => {
  clearFilters();
  state.selectedStudentId = '';
  loadOverviewAndStudents();
});
els.studentSearch.addEventListener('input', applyStudentSearch);

loadOverviewAndStudents();
