const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwe1R6e_771rxLsBct6nypvOvHn6vZhdBeCf0p3Kr2v_9phhMFbwBqLnV5Ug2ZAnBG2/exec';

const els = {
  sectionFilter: document.getElementById('sectionFilter'),
  sessionCodeFilter: document.getElementById('sessionCodeFilter'),
  bankFilter: document.getElementById('bankFilter'),
  modeFilter: document.getElementById('modeFilter'),
  studentSearch: document.getElementById('studentSearch'),
  lowAccOnly: document.getElementById('lowAccOnly'),

  applyFilterBtn: document.getElementById('applyFilterBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearFilterBtn: document.getElementById('clearFilterBtn'),
  exportStudentsBtn: document.getElementById('exportStudentsBtn'),
  exportDetailBtn: document.getElementById('exportDetailBtn'),

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
  overviewWeakTerms: document.getElementById('overviewWeakTerms'),
  trendChartWrap: document.getElementById('trendChartWrap')
};

const state = {
  students: [],
  filteredStudents: [],
  selectedStudentId: '',
  lastOverview: null,
  selectedDetail: null,
  sortKey: 'student_id',
  sortDir: 'asc'
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
        schema: 'teacher-v2',
        action,
        timestamp: bangkokIsoNow(),
        payload
      }),
      signal: controller.signal
    });

    return await res.json();
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

function scoreText(v){
  return safeNum(v).toFixed(0);
}

function accuracyText(v){
  return `${safeNum(v).toFixed(1)}%`;
}

function renderOverview(summary){
  const s = summary || {};
  els.ovStudents.textContent = scoreText(s.total_students);
  els.ovSessions.textContent = scoreText(s.total_sessions);
  els.ovScore.textContent = scoreText(s.avg_score);
  els.ovAcc.textContent = accuracyText(s.avg_accuracy);

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

function sortStudents(rows){
  const arr = [...rows];
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;

  arr.sort((a,b) => {
    const numericKeys = ['sessions_count', 'last_score', 'last_accuracy'];
    if (numericKeys.includes(key)){
      return (safeNum(a[key]) - safeNum(b[key])) * dir;
    }
    return safeStr(a[key]).localeCompare(safeStr(b[key])) * dir;
  });

  return arr;
}

function applyStudentSearch(){
  const q = safeStr(els.studentSearch.value).toLowerCase();
  const lowAccMode = safeStr(els.lowAccOnly.value);

  let rows = state.students.filter(r => {
    if (q){
      const hay = [
        safeStr(r.student_id),
        safeStr(r.display_name),
        safeStr(r.section)
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (lowAccMode === 'lt60' && !(safeNum(r.last_accuracy) < 60)) return false;
    if (lowAccMode === 'lt80' && !(safeNum(r.last_accuracy) < 80)) return false;
    if (lowAccMode === 'nosession' && !(safeNum(r.sessions_count) === 0)) return false;

    return true;
  });

  state.filteredStudents = sortStudents(rows);
  renderStudentsTable();
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
        <td>${accuracyText(r.last_accuracy)}</td>
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
  els.detailAvgAcc.textContent = accuracyText(summary?.avg_accuracy);
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
      <div>Accuracy: ${accuracyText(item.accuracy)} • Avg RT: ${scoreText(item.avg_response_ms)} ms • Level: ${htmlEscape(item.last_level_after || '-')}</div>
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
      <div>Score: ${scoreText(item.score)} • Accuracy: ${accuracyText(item.accuracy)} • Mistakes: ${scoreText(item.mistakes)}</div>
      <div>Started: ${htmlEscape(item.started_at || '-')}</div>
      <div>Ended: ${htmlEscape(item.ended_at || item.timestamp || '-')}</div>
    </div>
  `).join('');
}

function renderTrendChart(rows){
  const list = Array.isArray(rows) ? [...rows].reverse() : [];
  if (!list.length){
    els.trendChartWrap.innerHTML = 'ยังไม่มีข้อมูล';
    els.trendChartWrap.className = 'empty';
    return;
  }

  els.trendChartWrap.className = '';
  const w = 560;
  const h = 220;
  const pad = 28;

  const scores = list.map(x => safeNum(x.score));
  const accs = list.map(x => safeNum(x.accuracy));
  const maxScore = Math.max(10, ...scores);
  const maxAcc = 100;

  const xPos = i => {
    if (list.length === 1) return w / 2;
    return pad + ((w - pad * 2) * i / (list.length - 1));
  };
  const yScore = v => h - pad - ((h - pad * 2) * v / maxScore);
  const yAcc = v => h - pad - ((h - pad * 2) * v / maxAcc);

  const scorePath = scores.map((v,i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yScore(v)}`).join(' ');
  const accPath = accs.map((v,i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yAcc(v)}`).join(' ');

  const labels = list.map((x,i) => `
    <text x="${xPos(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#c7d4ff">${htmlEscape(x.session_code || String(i+1))}</text>
  `).join('');

  els.trendChartWrap.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="240" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;">
      <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(255,255,255,.18)" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="rgba(255,255,255,.18)" />
      <path d="${scorePath}" fill="none" stroke="#67e8f9" stroke-width="3" />
      <path d="${accPath}" fill="none" stroke="#fde047" stroke-width="3" />
      ${scores.map((v,i)=>`<circle cx="${xPos(i)}" cy="${yScore(v)}" r="4" fill="#67e8f9" />`).join('')}
      ${accs.map((v,i)=>`<circle cx="${xPos(i)}" cy="${yAcc(v)}" r="4" fill="#fde047" />`).join('')}
      ${labels}
      <text x="${pad}" y="16" font-size="11" fill="#67e8f9">Score</text>
      <text x="${pad+52}" y="16" font-size="11" fill="#fde047">Accuracy</text>
    </svg>
  `;
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
        state.selectedDetail = null;
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
  els.trendChartWrap.innerHTML = 'ยังไม่มีข้อมูล';
  els.trendChartWrap.className = 'empty';
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

    state.selectedDetail = res || null;
    renderDetail(res?.profile || null, res?.summary || {});
    renderWeakTerms(res?.weak_terms || []);
    renderSessions(res?.sessions || []);
    renderTrendChart(res?.sessions || []);
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
  els.lowAccOnly.value = '';
}

function toCsv(rows){
  return rows.map(row => row.map(v => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }).join(',')).join('\n');
}

function downloadCsv(filename, rows){
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportStudentsCsv(){
  const rows = [
    ['student_id','display_name','section','sessions_count','last_score','last_accuracy','last_session_code','recommended_mode','recommended_difficulty']
  ];

  state.filteredStudents.forEach(r => {
    rows.push([
      safeStr(r.student_id),
      safeStr(r.display_name),
      safeStr(r.section),
      safeNum(r.sessions_count),
      safeNum(r.last_score),
      safeNum(r.last_accuracy),
      safeStr(r.last_session_code),
      safeStr(r.recommended_mode),
      safeStr(r.recommended_difficulty)
    ]);
  });

  downloadCsv(`teacher_students_${Date.now()}.csv`, rows);
}

function exportSelectedDetailCsv(){
  const detail = state.selectedDetail;
  if (!detail || !detail.profile){
    alert('ยังไม่ได้เลือกนักศึกษา');
    return;
  }

  const rows = [];
  rows.push(['PROFILE']);
  rows.push(['student_id','display_name','section','recommended_mode','recommended_difficulty']);
  rows.push([
    safeStr(detail.profile.student_id),
    safeStr(detail.profile.display_name),
    safeStr(detail.profile.section),
    safeStr(detail.profile.recommended_mode),
    safeStr(detail.profile.recommended_difficulty)
  ]);
  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['sessions_count','avg_score','avg_accuracy','total_terms_answered','total_correct','total_wrong']);
  rows.push([
    safeNum(detail.summary?.sessions_count),
    safeNum(detail.summary?.avg_score),
    safeNum(detail.summary?.avg_accuracy),
    safeNum(detail.summary?.total_terms_answered),
    safeNum(detail.summary?.total_correct),
    safeNum(detail.summary?.total_wrong)
  ]);
  rows.push([]);
  rows.push(['SESSIONS']);
  rows.push(['session_code','bank','mode','score','accuracy','mistakes','started_at','ended_at']);
  (detail.sessions || []).forEach(s => {
    rows.push([
      safeStr(s.session_code),
      safeStr(s.bank),
      safeStr(s.mode),
      safeNum(s.score),
      safeNum(s.accuracy),
      safeNum(s.mistakes),
      safeStr(s.started_at),
      safeStr(s.ended_at || s.timestamp)
    ]);
  });
  rows.push([]);
  rows.push(['WEAK_TERMS']);
  rows.push(['term','wrong','correct','seen','accuracy','avg_response_ms','last_level_after']);
  (detail.weak_terms || []).forEach(w => {
    rows.push([
      safeStr(w.term || w.term_id),
      safeNum(w.wrong),
      safeNum(w.correct),
      safeNum(w.seen),
      safeNum(w.accuracy),
      safeNum(w.avg_response_ms),
      safeStr(w.last_level_after)
    ]);
  });

  downloadCsv(`teacher_detail_${safeStr(detail.profile.student_id || 'student')}_${Date.now()}.csv`, rows);
}

function attachSortHandlers(){
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort') || '';
      if (!key) return;
      if (state.sortKey === key){
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      applyStudentSearch();
    });
  });
}

els.applyFilterBtn.addEventListener('click', loadOverviewAndStudents);
els.refreshBtn.addEventListener('click', loadOverviewAndStudents);
els.clearFilterBtn.addEventListener('click', () => {
  clearFilters();
  state.selectedStudentId = '';
  state.selectedDetail = null;
  loadOverviewAndStudents();
});
els.studentSearch.addEventListener('input', applyStudentSearch);
els.lowAccOnly.addEventListener('change', applyStudentSearch);
els.exportStudentsBtn.addEventListener('click', exportStudentsCsv);
els.exportDetailBtn.addEventListener('click', exportSelectedDetailCsv);

attachSortHandlers();
loadOverviewAndStudents();
