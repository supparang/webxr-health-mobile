const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVz1FXvojv8t2DyGE4W7ViCeF9XX42-YDmi3-Xtek6XnrgLRHrKGGE5Mtx4UgQ3vmS/exec';

const els = {
  sectionFilter: document.getElementById('sectionFilter'),
  sessionCodeFilter: document.getElementById('sessionCodeFilter'),
  bankFilter: document.getElementById('bankFilter'),
  modeFilter: document.getElementById('modeFilter'),
  studentSearch: document.getElementById('studentSearch'),
  lowAccOnly: document.getElementById('lowAccOnly'),
  followupFilter: document.getElementById('followupFilter'),

  applyFilterBtn: document.getElementById('applyFilterBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearFilterBtn: document.getElementById('clearFilterBtn'),

  importRosterBtn: document.getElementById('importRosterBtn'),
  exportStudentsBtn: document.getElementById('exportStudentsBtn'),
  exportDetailBtn: document.getElementById('exportDetailBtn'),
  exportAbsenteeBtn: document.getElementById('exportAbsenteeBtn'),
  exportAttendanceSummaryBtn: document.getElementById('exportAttendanceSummaryBtn'),
  exportInterventionBtn: document.getElementById('exportInterventionBtn'),
  exportFollowupBtn: document.getElementById('exportFollowupBtn'),
  exportArchiveBtn: document.getElementById('exportArchiveBtn'),
  printTeacherReportBtn: document.getElementById('printTeacherReportBtn'),
  printSelectedStudentBtn: document.getElementById('printSelectedStudentBtn'),
  urgentLandingChk: document.getElementById('urgentLandingChk'),
  rosterFileInput: document.getElementById('rosterFileInput'),

  ovStudents: document.getElementById('ovStudents'),
  ovSessions: document.getElementById('ovSessions'),
  ovScore: document.getElementById('ovScore'),
  ovAcc: document.getElementById('ovAcc'),

  todayActionGrid: document.getElementById('todayActionGrid'),
  urgentLandingList: document.getElementById('urgentLandingList'),

  selectAllFilteredChk: document.getElementById('selectAllFilteredChk'),
  bulkFollowupStatus: document.getElementById('bulkFollowupStatus'),
  bulkNoteInput: document.getElementById('bulkNoteInput'),
  applyBulkStatusBtn: document.getElementById('applyBulkStatusBtn'),
  archiveSnapshotBtn: document.getElementById('archiveSnapshotBtn'),

  studentsTableBody: document.getElementById('studentsTableBody'),

  detailName: document.getElementById('detailName'),
  detailMeta: document.getElementById('detailMeta'),
  detailBadges: document.getElementById('detailBadges'),
  detailSessions: document.getElementById('detailSessions'),
  detailAvgScore: document.getElementById('detailAvgScore'),
  detailAvgAcc: document.getElementById('detailAvgAcc'),
  weakTermsList: document.getElementById('weakTermsList'),
  sessionsList: document.getElementById('sessionsList'),
  trendChartWrap: document.getElementById('trendChartWrap'),

  followupStatus: document.getElementById('followupStatus'),
  teacherNameInput: document.getElementById('teacherNameInput'),
  teacherNoteInput: document.getElementById('teacherNoteInput'),
  saveFollowupBtn: document.getElementById('saveFollowupBtn'),
  refreshFollowupBtn: document.getElementById('refreshFollowupBtn'),
  followupLatestBox: document.getElementById('followupLatestBox'),
  followupHistoryList: document.getElementById('followupHistoryList'),
  followupTimeline: document.getElementById('followupTimeline'),
  studentProfileSummaryBox: document.getElementById('studentProfileSummaryBox'),

  attendanceTableBody: document.getElementById('attendanceTableBody'),
  attendanceDetailList: document.getElementById('attendanceDetailList'),
  absenteeDetailList: document.getElementById('absenteeDetailList'),
  heatmapWrap: document.getElementById('heatmapWrap'),
  sessionComparisonBody: document.getElementById('sessionComparisonBody'),
  sectionSummaryBody: document.getElementById('sectionSummaryBody'),
  overviewWeakTerms: document.getElementById('overviewWeakTerms'),

  followupSummaryGrid: document.getElementById('followupSummaryGrid'),
  followupSectionSummaryBody: document.getElementById('followupSectionSummaryBody'),
  riskList: document.getElementById('riskList'),
  interventionList: document.getElementById('interventionList'),
  topPerformersList: document.getElementById('topPerformersList'),

  refreshArchiveBtn: document.getElementById('refreshArchiveBtn'),
  compareArchiveBtn: document.getElementById('compareArchiveBtn'),
  archiveTableBody: document.getElementById('archiveTableBody'),
  archiveCompareBox: document.getElementById('archiveCompareBox'),
  termBoundaryLabel: document.getElementById('termBoundaryLabel'),
  termBoundaryMessage: document.getElementById('termBoundaryMessage'),
  createBoundaryBtn: document.getElementById('createBoundaryBtn'),
  softResetViewBtn: document.getElementById('softResetViewBtn')
};

const state = {
  students: [],
  filteredStudents: [],
  selectedStudentId: '',
  selectedStudentIds: new Set(),
  selectedDetail: null,

  lastOverview: null,

  sortKey: 'student_id',
  sortDir: 'asc',

  attendanceRows: [],
  selectedAttendanceKey: '',
  sectionSummaryRows: [],

  followupRows: [],
  followupLatest: null,
  followupSummaryRows: [],
  followupCounts: {},
  latestFollowupByStudent: {},

  archiveRows: [],
  archiveSelectA: '',
  archiveSelectB: '',

  urgentLandingMode: localStorage.getItem('TEACHER_URGENT_LANDING') === '1'
};

function bangkokIsoNow() {
  try {
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
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;
  } catch (_) {
    return new Date().toISOString();
  }
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v) {
  return String(v || '').trim();
}

function htmlEscape(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function on(el, eventName, handler) {
  if (el) el.addEventListener(eventName, handler);
}

function getFilters() {
  return {
    section: safeStr(els.sectionFilter?.value),
    session_code: safeStr(els.sessionCodeFilter?.value),
    bank: safeStr(els.bankFilter?.value),
    mode: safeStr(els.modeFilter?.value)
  };
}

async function postAction(action, payload = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        source: 'teacher.html',
        schema: 'teacher-v12',
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

function setLoading(isLoading) {
  document.body.classList.toggle('loading', !!isLoading);
}

function makePill(text, type = '') {
  const cls = type ? `pill ${type}` : 'pill';
  return `<span class="${cls}">${htmlEscape(text)}</span>`;
}

function scoreText(v) {
  return safeNum(v).toFixed(0);
}

function accuracyText(v) {
  return `${safeNum(v).toFixed(1)}%`;
}

function renderOverview(summary) {
  const s = summary || {};
  if (els.ovStudents) els.ovStudents.textContent = scoreText(s.total_students);
  if (els.ovSessions) els.ovSessions.textContent = scoreText(s.total_sessions);
  if (els.ovScore) els.ovScore.textContent = scoreText(s.avg_score);
  if (els.ovAcc) els.ovAcc.textContent = accuracyText(s.avg_accuracy);

  const weak = Array.isArray(s.top_weak_terms) ? s.top_weak_terms : [];
  if (!els.overviewWeakTerms) return;

  if (!weak.length) {
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

function sortStudents(rows) {
  const arr = [...rows];
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;
  const numericKeys = ['sessions_count', 'last_score', 'last_accuracy'];

  arr.sort((a, b) => {
    if (numericKeys.includes(key)) {
      return (safeNum(a[key]) - safeNum(b[key])) * dir;
    }
    return safeStr(a[key]).localeCompare(safeStr(b[key])) * dir;
  });

  return arr;
}

function renderFollowupSummary(counts, rows) {
  state.followupCounts = counts || {};
  state.followupSummaryRows = Array.isArray(rows) ? rows : [];
  state.latestFollowupByStudent = Object.fromEntries(
    state.followupSummaryRows.map(r => [safeStr(r.student_id), r])
  );

  if (!els.followupSummaryGrid) return;

  const c = state.followupCounts || {};
  const items = [
    { key: 'pending', cls: 'warn' },
    { key: 'contacted', cls: '' },
    { key: 'needs_support', cls: 'bad' },
    { key: 'improved', cls: 'good' },
    { key: 'closed', cls: '' }
  ];

  els.followupSummaryGrid.innerHTML = items.map(item => `
    <div class="listItem">
      <strong>${htmlEscape(item.key)}</strong>
      <div>${makePill(String(safeNum(c[item.key] || 0)), item.cls)}</div>
    </div>
  `).join('');
}

function renderFollowupSectionSummary() {
  if (!els.followupSectionSummaryBody) return;

  const grouped = {};

  (state.students || []).forEach(s => {
    const section = safeStr(s.section) || '-';
    if (!grouped[section]) {
      grouped[section] = {
        section,
        total: 0,
        pending: 0,
        contacted: 0,
        needs_support: 0,
        improved: 0,
        closed: 0,
        no_status: 0
      };
    }

    grouped[section].total += 1;

    const latest = state.latestFollowupByStudent[safeStr(s.student_id)];
    const status = safeStr(latest?.status);

    if (!status) {
      grouped[section].no_status += 1;
    } else if (Object.prototype.hasOwnProperty.call(grouped[section], status)) {
      grouped[section][status] += 1;
    } else {
      grouped[section].no_status += 1;
    }
  });

  const rows = Object.values(grouped).sort((a, b) => safeStr(a.section).localeCompare(safeStr(b.section)));

  if (!rows.length) {
    els.followupSectionSummaryBody.innerHTML = '<tr><td colspan="8">ยังไม่มีข้อมูล follow-up by section</td></tr>';
    return;
  }

  els.followupSectionSummaryBody.innerHTML = rows.map(r => `
    <tr>
      <td>${htmlEscape(r.section || '-')}</td>
      <td>${scoreText(r.total)}</td>
      <td>${scoreText(r.pending)}</td>
      <td>${scoreText(r.contacted)}</td>
      <td>${scoreText(r.needs_support)}</td>
      <td>${scoreText(r.improved)}</td>
      <td>${scoreText(r.closed)}</td>
      <td>${scoreText(r.no_status)}</td>
    </tr>
  `).join('');
}

function applyStudentSearch() {
  const q = safeStr(els.studentSearch?.value).toLowerCase();
  const lowAccMode = safeStr(els.lowAccOnly?.value);
  const followupMode = safeStr(els.followupFilter?.value);

  const rows = state.students.filter(r => {
    if (q) {
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

    if (followupMode) {
      const latest = state.latestFollowupByStudent[safeStr(r.student_id)];
      const latestStatus = safeStr(latest?.status);
      if (latestStatus !== followupMode) return false;
    }

    return true;
  });

  state.filteredStudents = sortStudents(rows);
  renderStudentsTable();
}

function renderStudentsTable() {
  if (!els.studentsTableBody) return;
  const rows = state.filteredStudents;

  if (!rows.length) {
    els.studentsTableBody.innerHTML = '<tr><td colspan="9">ไม่พบข้อมูลนักศึกษาตามเงื่อนไขนี้</td></tr>';
    return;
  }

  els.studentsTableBody.innerHTML = rows.map(r => {
    const sid = safeStr(r.student_id);
    const isActive = sid === safeStr(state.selectedStudentId);
    const isChecked = state.selectedStudentIds.has(sid);
    const latestFollowup = state.latestFollowupByStudent[sid];
    const latestFollowupHtml = latestFollowup?.status
      ? makePill(
          latestFollowup.status,
          latestFollowup.status === 'improved'
            ? 'good'
            : latestFollowup.status === 'needs_support'
              ? 'bad'
              : latestFollowup.status === 'pending'
                ? 'warn'
                : ''
        )
      : '';

    return `
      <tr data-student-id="${htmlEscape(sid)}" class="${isActive ? 'active' : ''}">
        <td>
          <input type="checkbox" class="rowSelectChk" data-student-id="${htmlEscape(sid)}" ${isChecked ? 'checked' : ''} />
        </td>
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
          ${latestFollowupHtml}

          <div class="quickRowActions">
            <button class="quickStatusBtn" data-student-id="${htmlEscape(sid)}" data-status="pending">P</button>
            <button class="quickStatusBtn" data-student-id="${htmlEscape(sid)}" data-status="contacted">C</button>
            <button class="quickStatusBtn" data-student-id="${htmlEscape(sid)}" data-status="needs_support">N</button>
            <button class="quickStatusBtn" data-student-id="${htmlEscape(sid)}" data-status="improved">I</button>
            <button class="quickStatusBtn" data-student-id="${htmlEscape(sid)}" data-status="closed">X</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  els.studentsTableBody.querySelectorAll('tr[data-student-id]').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('.rowSelectChk') || e.target.closest('.quickStatusBtn')) return;
      const sid = tr.getAttribute('data-student-id') || '';
      if (!sid) return;
      state.selectedStudentId = sid;
      renderStudentsTable();
      loadStudentDetail(sid);
    });
  });

  els.studentsTableBody.querySelectorAll('.rowSelectChk').forEach(chk => {
    chk.addEventListener('click', e => e.stopPropagation());
    chk.addEventListener('change', () => {
      const sid = chk.getAttribute('data-student-id') || '';
      if (!sid) return;
      if (chk.checked) state.selectedStudentIds.add(sid);
      else state.selectedStudentIds.delete(sid);
    });
  });

  els.studentsTableBody.querySelectorAll('.quickStatusBtn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const sid = btn.getAttribute('data-student-id') || '';
      const status = btn.getAttribute('data-status') || '';
      if (!sid || !status) return;
      await quickUpdateStatus(sid, status);
    });
  });
}

function renderDetail(profile, summary) {
  if (!profile) {
    if (els.detailName) els.detailName.textContent = 'ไม่พบข้อมูลนักศึกษา';
    if (els.detailMeta) els.detailMeta.textContent = 'ลองเลือกนักศึกษาคนอื่น หรือเช็กว่ามี student_id ใน sheet หรือไม่';
    if (els.detailBadges) els.detailBadges.innerHTML = '';
    if (els.detailSessions) els.detailSessions.textContent = '-';
    if (els.detailAvgScore) els.detailAvgScore.textContent = '-';
    if (els.detailAvgAcc) els.detailAvgAcc.textContent = '-';
    return;
  }

  if (els.detailName) els.detailName.textContent = safeStr(profile.display_name) || 'Unnamed Student';
  if (els.detailMeta) {
    els.detailMeta.innerHTML =
      `Student ID: <span class="mono">${htmlEscape(profile.student_id || '-')}</span><br>` +
      `Section: ${htmlEscape(profile.section || '-')} • Last Session: <span class="mono">${htmlEscape(profile.last_session_id || '-')}</span>`;
  }

  if (els.detailBadges) {
    const badges = [];
    if (profile.recommended_mode) badges.push(makePill(profile.recommended_mode));
    if (profile.recommended_difficulty) badges.push(makePill(profile.recommended_difficulty, 'warn'));
    els.detailBadges.innerHTML = badges.join(' ');
  }

  if (els.detailSessions) els.detailSessions.textContent = scoreText(summary?.sessions_count);
  if (els.detailAvgScore) els.detailAvgScore.textContent = scoreText(summary?.avg_score);
  if (els.detailAvgAcc) els.detailAvgAcc.textContent = accuracyText(summary?.avg_accuracy);
}

function renderWeakTerms(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!els.weakTermsList) return;

  if (!list.length) {
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

function renderSessions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!els.sessionsList) return;

  if (!list.length) {
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

function renderTrendChart(rows) {
  if (!els.trendChartWrap) return;

  const list = Array.isArray(rows) ? [...rows].reverse() : [];
  if (!list.length) {
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

  const scorePath = scores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yScore(v)}`).join(' ');
  const accPath = accs.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yAcc(v)}`).join(' ');
  const labels = list.map((x, i) => `
    <text x="${xPos(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#c7d4ff">${htmlEscape(x.session_code || String(i + 1))}</text>
  `).join('');

  els.trendChartWrap.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="240" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="rgba(255,255,255,.18)" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="rgba(255,255,255,.18)" />
      <path d="${scorePath}" fill="none" stroke="#67e8f9" stroke-width="3" />
      <path d="${accPath}" fill="none" stroke="#fde047" stroke-width="3" />
      ${scores.map((v, i) => `<circle cx="${xPos(i)}" cy="${yScore(v)}" r="4" fill="#67e8f9" />`).join('')}
      ${accs.map((v, i) => `<circle cx="${xPos(i)}" cy="${yAcc(v)}" r="4" fill="#fde047" />`).join('')}
      ${labels}
      <text x="${pad}" y="16" font-size="11" fill="#67e8f9">Score</text>
      <text x="${pad + 52}" y="16" font-size="11" fill="#fde047">Accuracy</text>
    </svg>
  `;
}

function renderAttendance(rows) {
  const list = Array.isArray(rows) ? rows : [];
  state.attendanceRows = list;

  if (!els.attendanceTableBody) return;

  if (!list.length) {
    els.attendanceTableBody.innerHTML = '<tr><td colspan="8">ไม่พบข้อมูล attendance</td></tr>';
    return;
  }

  els.attendanceTableBody.innerHTML = list.map(r => {
    const key = `${safeStr(r.section)}||${safeStr(r.session_code)}`;
    const active = key === state.selectedAttendanceKey ? 'active' : '';
    return `
      <tr data-att-key="${htmlEscape(key)}" class="${active}">
        <td>${htmlEscape(r.section || '-')}</td>
        <td>${htmlEscape(r.session_code || '-')}</td>
        <td>${scoreText(r.roster_count)}</td>
        <td>${scoreText(r.unique_attendees)}</td>
        <td>${scoreText(r.absent_count)}</td>
        <td>${scoreText(r.sessions_count)}</td>
        <td>${scoreText(r.avg_score)}</td>
        <td>${accuracyText(r.avg_accuracy)}</td>
      </tr>
    `;
  }).join('');

  els.attendanceTableBody.querySelectorAll('tr[data-att-key]').forEach(tr => {
    tr.addEventListener('click', () => {
      const key = tr.getAttribute('data-att-key') || '';
      state.selectedAttendanceKey = key;
      renderAttendance(state.attendanceRows);
      renderAttendanceDetailByKey(key);
    });
  });
}

function renderAttendanceDetailByKey(key) {
  const found = (state.attendanceRows || []).find(
    r => `${safeStr(r.section)}||${safeStr(r.session_code)}` === key
  );

  if (!found) {
    if (els.attendanceDetailList) {
      els.attendanceDetailList.innerHTML = '<div class="empty">ยังไม่ได้เลือก session</div>';
    }
    if (els.absenteeDetailList) {
      els.absenteeDetailList.innerHTML = '<div class="empty">ยังไม่ได้เลือก session</div>';
    }
    return;
  }

  const attendees = Array.isArray(found.attendees) ? found.attendees : [];
  if (els.attendanceDetailList) {
    els.attendanceDetailList.innerHTML = attendees.length
      ? attendees.map(a => `
        <div class="listItem">
          <strong>${htmlEscape(a.display_name || '-')}</strong>
          <div>Student ID: <span class="mono">${htmlEscape(a.student_id || '-')}</span></div>
          <div>Last Score: ${scoreText(a.last_score)} • Last Accuracy: ${accuracyText(a.last_accuracy)}</div>
          <div>Ended At: ${htmlEscape(a.ended_at || '-')}</div>
        </div>
      `).join('')
      : '<div class="empty">ไม่พบรายชื่อผู้เข้าเรียน</div>';
  }

  const absentees = Array.isArray(found.absentees) ? found.absentees : [];
  if (els.absenteeDetailList) {
    els.absenteeDetailList.innerHTML = absentees.length
      ? absentees.map(a => `
        <div class="listItem">
          <strong>${htmlEscape(a.display_name || '-')}</strong>
          <div>Student ID: <span class="mono">${htmlEscape(a.student_id || '-')}</span></div>
          <div>Section: ${htmlEscape(a.section || '-')}</div>
        </div>
      `).join('')
      : '<div class="empty">ไม่มีผู้ขาดใน session นี้</div>';
  }
}

function renderSectionSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  state.sectionSummaryRows = list;

  if (!els.sectionSummaryBody) return;

  if (!list.length) {
    els.sectionSummaryBody.innerHTML = '<tr><td colspan="5">ไม่พบข้อมูล section summary</td></tr>';
    return;
  }

  els.sectionSummaryBody.innerHTML = list.map(r => `
    <tr>
      <td>${htmlEscape(r.section || '-')}</td>
      <td>${scoreText(r.unique_students)}</td>
      <td>${scoreText(r.sessions_count)}</td>
      <td>${scoreText(r.avg_score)}</td>
      <td>${accuracyText(r.avg_accuracy)}</td>
    </tr>
  `).join('');
}

function collectRosterAwareStudents() {
  const map = {};

  (state.students || []).forEach(s => {
    const sid = safeStr(s.student_id);
    if (!sid) return;
    map[sid] = {
      student_id: sid,
      display_name: safeStr(s.display_name),
      section: safeStr(s.section),
      sessions_count: safeNum(s.sessions_count),
      last_score: safeNum(s.last_score),
      last_accuracy: safeNum(s.last_accuracy),
      recommended_mode: safeStr(s.recommended_mode),
      recommended_difficulty: safeStr(s.recommended_difficulty)
    };
  });

  (state.attendanceRows || []).forEach(row => {
    (row.attendees || []).forEach(a => {
      const sid = safeStr(a.student_id);
      if (!sid) return;
      if (!map[sid]) {
        map[sid] = {
          student_id: sid,
          display_name: safeStr(a.display_name),
          section: safeStr(row.section),
          sessions_count: 0,
          last_score: safeNum(a.last_score),
          last_accuracy: safeNum(a.last_accuracy),
          recommended_mode: '',
          recommended_difficulty: ''
        };
      }
    });

    (row.absentees || []).forEach(a => {
      const sid = safeStr(a.student_id);
      if (!sid) return;
      if (!map[sid]) {
        map[sid] = {
          student_id: sid,
          display_name: safeStr(a.display_name),
          section: safeStr(a.section || row.section),
          sessions_count: 0,
          last_score: 0,
          last_accuracy: 0,
          recommended_mode: '',
          recommended_difficulty: ''
        };
      }
    });
  });

  return Object.values(map);
}

function buildRiskRows() {
  const bySectionExpectedSessions = {};
  const attendedSets = {};
  const absentSets = {};

  (state.attendanceRows || []).forEach(row => {
    const section = safeStr(row.section) || '-';
    const sessionCode = safeStr(row.session_code) || '-';

    if (!bySectionExpectedSessions[section]) bySectionExpectedSessions[section] = new Set();
    bySectionExpectedSessions[section].add(sessionCode);

    (row.attendees || []).forEach(a => {
      const sid = safeStr(a.student_id);
      if (!sid) return;
      if (!attendedSets[sid]) attendedSets[sid] = new Set();
      attendedSets[sid].add(sessionCode);
    });

    (row.absentees || []).forEach(a => {
      const sid = safeStr(a.student_id);
      if (!sid) return;
      if (!absentSets[sid]) absentSets[sid] = new Set();
      absentSets[sid].add(sessionCode);
    });
  });

  return collectRosterAwareStudents().map(s => {
    const sid = safeStr(s.student_id);
    const section = safeStr(s.section) || '-';
    const expectedSessions = bySectionExpectedSessions[section] ? bySectionExpectedSessions[section].size : 0;
    const attendedSessions = attendedSets[sid] ? attendedSets[sid].size : 0;
    const absentSessions = absentSets[sid] ? absentSets[sid].size : Math.max(0, expectedSessions - attendedSessions);
    const attendanceRate = expectedSessions ? Number(((attendedSessions / expectedSessions) * 100).toFixed(1)) : 0;

    const acc = safeNum(s.last_accuracy);

    let riskLevel = 'low';
    const reasons = [];

    if (expectedSessions > 0 && attendedSessions === 0) {
      riskLevel = 'high';
      reasons.push('ยังไม่พบเข้าเรียน');
    }

    if (expectedSessions > 0 && attendanceRate < 50) {
      riskLevel = 'high';
      reasons.push('เข้าเรียนน้อยกว่า 50%');
    } else if (expectedSessions > 0 && attendanceRate < 100 && riskLevel === 'low') {
      riskLevel = 'medium';
      reasons.push('ขาดบาง session');
    }

    if (s.sessions_count > 0 && acc < 60) {
      riskLevel = 'high';
      reasons.push('accuracy ต่ำกว่า 60%');
    } else if (s.sessions_count > 0 && acc < 80 && riskLevel === 'low') {
      riskLevel = 'medium';
      reasons.push('accuracy ต่ำกว่า 80%');
    }

    if (!reasons.length) reasons.push('ปกติ');

    return {
      ...s,
      expected_sessions: expectedSessions,
      attended_sessions: attendedSessions,
      absent_sessions: absentSessions,
      attendance_rate: attendanceRate,
      risk_level: riskLevel,
      risk_reason: reasons.join(' • '),
      priority: 1,
      action: 'ติดตามตามปกติ',
      note: `Attendance ${attendanceRate}% • Accuracy ${acc}% • Score ${safeNum(s.last_score)}`
    };
  });
}

function buildInterventionRows() {
  return buildRiskRows()
    .map(r => {
      let priority = 1;
      let action = 'ติดตามตามปกติ';
      let note = 'ผลการเรียนอยู่ในเกณฑ์ใช้ได้';

      if (r.expected_sessions > 0 && r.attended_sessions === 0) {
        priority = 5;
        action = 'ติดต่อด่วน + นัดชดเชย';
        note = 'ยังไม่พบการเข้าเรียนเลย';
      } else if (r.attendance_rate < 50) {
        priority = 4;
        action = 'ติดตามเรื่อง attendance';
        note = 'เข้าเรียนน้อยกว่าครึ่ง';
      } else if (r.last_accuracy < 60 && r.sessions_count > 0) {
        priority = 4;
        action = 'ให้ทบทวน Debug Mission (easy)';
        note = 'accuracy ต่ำกว่า 60%';
      } else if (r.last_accuracy < 80 && r.sessions_count > 0) {
        priority = 3;
        action = 'ให้ฝึก AI Training / Code Battle เพิ่ม';
        note = 'accuracy ต่ำกว่า 80%';
      } else if (r.absent_sessions > 0) {
        priority = 2;
        action = 'ติดตาม session ที่ขาด';
        note = 'ขาดบาง session';
      }

      return { ...r, priority, action, note };
    })
    .filter(r => r.priority >= 2)
    .sort((a, b) => {
      const p = b.priority - a.priority;
      if (p !== 0) return p;
      const ab = b.absent_sessions - a.absent_sessions;
      if (ab !== 0) return ab;
      return a.last_accuracy - b.last_accuracy;
    })
    .slice(0, 15);
}

function renderRiskDashboard() {
  const rows = buildRiskRows();

  if (els.riskList) {
    const riskRows = rows
      .filter(r => r.risk_level !== 'low')
      .sort((a, b) => {
        const levelRank = { high: 3, medium: 2, low: 1 };
        const lv = levelRank[b.risk_level] - levelRank[a.risk_level];
        if (lv !== 0) return lv;
        const ab = b.absent_sessions - a.absent_sessions;
        if (ab !== 0) return ab;
        return a.last_accuracy - b.last_accuracy;
      })
      .slice(0, 12);

    els.riskList.innerHTML = riskRows.length
      ? riskRows.map(r => `
        <div class="listItem">
          <strong>${htmlEscape(r.display_name || '-')}</strong>
          <div>Student ID: <span class="mono">${htmlEscape(r.student_id || '-')}</span> • Section: ${htmlEscape(r.section || '-')}</div>
          <div>${makePill(r.risk_level.toUpperCase(), r.risk_level === 'high' ? 'bad' : 'warn')}</div>
          <div>Attendance: ${scoreText(r.attended_sessions)} / ${scoreText(r.expected_sessions)} (${safeNum(r.attendance_rate).toFixed(1)}%)</div>
          <div>Accuracy: ${accuracyText(r.last_accuracy)} • Score: ${scoreText(r.last_score)}</div>
          <div>${htmlEscape(r.risk_reason)}</div>
        </div>
      `).join('')
      : '<div class="empty">ไม่พบนักศึกษากลุ่มเสี่ยงในเงื่อนไขนี้</div>';
  }

  if (els.topPerformersList) {
    const topRows = getTopPerformerRows();

    els.topPerformersList.innerHTML = topRows.length
      ? topRows.map((r, idx) => `
        <div class="listItem">
          <strong>#${idx + 1} ${htmlEscape(r.display_name || '-')}</strong>
          <div>Student ID: <span class="mono">${htmlEscape(r.student_id || '-')}</span> • Section: ${htmlEscape(r.section || '-')}</div>
          <div>Accuracy: ${accuracyText(r.last_accuracy)} • Score: ${scoreText(r.last_score)}</div>
          <div>Attendance: ${scoreText(r.attended_sessions)} / ${scoreText(r.expected_sessions)} (${safeNum(r.attendance_rate).toFixed(1)}%)</div>
        </div>
      `).join('')
      : '<div class="empty">ยังไม่มีข้อมูล top performers</div>';
  }
}

function getTopPerformerRows() {
  return buildRiskRows()
    .filter(r => r.sessions_count > 0)
    .sort((a, b) => {
      const acc = safeNum(b.last_accuracy) - safeNum(a.last_accuracy);
      if (acc !== 0) return acc;
      const att = safeNum(b.attendance_rate) - safeNum(a.attendance_rate);
      if (att !== 0) return att;
      return safeNum(b.last_score) - safeNum(a.last_score);
    })
    .slice(0, 10);
}

function buildHeatmapData() {
  const attendanceRows = Array.isArray(state.attendanceRows) ? state.attendanceRows : [];
  const students = collectRosterAwareStudents().sort((a, b) => {
    const s = safeStr(a.section).localeCompare(safeStr(b.section));
    if (s !== 0) return s;
    return safeStr(a.student_id || a.display_name).localeCompare(safeStr(b.student_id || b.display_name));
  });

  const columns = attendanceRows.map(r => ({
    key: `${safeStr(r.section)}||${safeStr(r.session_code)}`,
    section: safeStr(r.section),
    session_code: safeStr(r.session_code)
  })).sort((a, b) => {
    const s = safeStr(a.section).localeCompare(safeStr(b.section));
    if (s !== 0) return s;
    return safeStr(a.session_code).localeCompare(safeStr(b.session_code));
  });

  const colMap = {};
  attendanceRows.forEach(r => {
    colMap[`${safeStr(r.section)}||${safeStr(r.session_code)}`] = r;
  });

  const rows = students.map(student => {
    const section = safeStr(student.section);
    const cells = columns.map(col => {
      if (safeStr(col.section) !== section) return { status: 'N', label: '—' };

      const found = colMap[col.key];
      const sid = safeStr(student.student_id);

      const isPresent = Array.isArray(found?.attendees) && found.attendees.some(a => safeStr(a.student_id) === sid);
      const isAbsent = Array.isArray(found?.absentees) && found.absentees.some(a => safeStr(a.student_id) === sid);

      if (isPresent) return { status: 'P', label: 'P' };
      if (isAbsent) return { status: 'A', label: 'A' };
      return { status: 'N', label: '—' };
    });

    return { ...student, cells };
  });

  return { columns, rows };
}

function renderHeatmap() {
  if (!els.heatmapWrap) return;

  const { columns, rows } = buildHeatmapData();

  if (!columns.length || !rows.length) {
    els.heatmapWrap.innerHTML = '<div class="empty" style="margin:12px;">ยังไม่มีข้อมูล heatmap</div>';
    return;
  }

  const thead = `
    <thead>
      <tr>
        <th class="stickyLeft">Student</th>
        <th class="stickyLeft" style="left:180px;">Section</th>
        ${columns.map(c => `<th>${htmlEscape(c.section)}<br>${htmlEscape(c.session_code)}</th>`).join('')}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows.map(r => `
        <tr>
          <td class="stickyLeft" style="min-width:180px;">
            <strong>${htmlEscape(r.display_name || '-')}</strong><br>
            <span class="mono">${htmlEscape(r.student_id || '-')}</span>
          </td>
          <td class="stickyLeft" style="left:180px;min-width:90px;">${htmlEscape(r.section || '-')}</td>
          ${r.cells.map(cell => `
            <td>
              <div class="heatCell ${cell.status === 'P' ? 'heatP' : cell.status === 'A' ? 'heatA' : 'heatN'}">
                ${htmlEscape(cell.label)}
              </div>
            </td>
          `).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  els.heatmapWrap.innerHTML = `
    <table class="heatmapTable">
      ${thead}
      ${tbody}
    </table>
  `;
}

function buildSessionComparisonRows() {
  const grouped = {};

  (state.attendanceRows || []).forEach(row => {
    const sessionCode = safeStr(row.session_code) || '-';
    if (!grouped[sessionCode]) {
      grouped[sessionCode] = {
        session_code: sessionCode,
        sections: new Set(),
        roster_count: 0,
        attendees: 0,
        absent: 0,
        score_sum: 0,
        acc_sum: 0,
        row_count: 0
      };
    }

    const g = grouped[sessionCode];
    g.sections.add(safeStr(row.section) || '-');
    g.roster_count += safeNum(row.roster_count);
    g.attendees += safeNum(row.unique_attendees);
    g.absent += safeNum(row.absent_count);
    g.score_sum += safeNum(row.avg_score);
    g.acc_sum += safeNum(row.avg_accuracy);
    g.row_count += 1;
  });

  return Object.values(grouped).map(g => ({
    session_code: g.session_code,
    sections_count: g.sections.size,
    roster_count: g.roster_count,
    attendees: g.attendees,
    absent: g.absent,
    avg_score: g.row_count ? Number((g.score_sum / g.row_count).toFixed(2)) : 0,
    avg_accuracy: g.row_count ? Number((g.acc_sum / g.row_count).toFixed(2)) : 0
  })).sort((a, b) => safeStr(a.session_code).localeCompare(safeStr(b.session_code)));
}

function renderSessionComparison() {
  if (!els.sessionComparisonBody) return;

  const rows = buildSessionComparisonRows();
  if (!rows.length) {
    els.sessionComparisonBody.innerHTML = '<tr><td colspan="7">ยังไม่มีข้อมูล session comparison</td></tr>';
    return;
  }

  els.sessionComparisonBody.innerHTML = rows.map(r => `
    <tr>
      <td>${htmlEscape(r.session_code || '-')}</td>
      <td>${scoreText(r.sections_count)}</td>
      <td>${scoreText(r.roster_count)}</td>
      <td>${scoreText(r.attendees)}</td>
      <td>${scoreText(r.absent)}</td>
      <td>${scoreText(r.avg_score)}</td>
      <td>${accuracyText(r.avg_accuracy)}</td>
    </tr>
  `).join('');
}

function renderInterventionQueue() {
  if (!els.interventionList) return;

  const rows = buildInterventionRows();
  if (!rows.length) {
    els.interventionList.innerHTML = '<div class="empty">ยังไม่มีนักศึกษาที่ต้อง intervention เพิ่ม</div>';
    return;
  }

  els.interventionList.innerHTML = rows.map((r, idx) => `
    <div class="listItem">
      <strong>#${idx + 1} ${htmlEscape(r.display_name || '-')}</strong>
      <div>Student ID: <span class="mono">${htmlEscape(r.student_id || '-')}</span> • Section: ${htmlEscape(r.section || '-')}</div>
      <div>${makePill('P' + r.priority, r.priority >= 4 ? 'bad' : 'warn')}</div>
      <div>Attendance: ${scoreText(r.attended_sessions)} / ${scoreText(r.expected_sessions)} (${safeNum(r.attendance_rate).toFixed(1)}%)</div>
      <div>Accuracy: ${accuracyText(r.last_accuracy)} • Score: ${scoreText(r.last_score)}</div>
      <div><strong>Action:</strong> ${htmlEscape(r.action)}</div>
      <div>${htmlEscape(r.note)}</div>
    </div>
  `).join('');
}

function renderTodayActionSummary() {
  if (!els.todayActionGrid) return;

  const riskRows = buildRiskRows();
  const counts = state.followupCounts || {};
  const noAttendance = riskRows.filter(r => safeNum(r.attended_sessions) === 0 && safeNum(r.expected_sessions) > 0).length;
  const atRisk = riskRows.filter(r => r.risk_level !== 'low').length;

  els.todayActionGrid.innerHTML = `
    <div class="statCard">
      <div class="statLabel">Pending</div>
      <div class="statValue">${scoreText(counts.pending || 0)}</div>
      <div class="statSub">เคสที่ยังไม่ได้เริ่มติดตาม</div>
    </div>
    <div class="statCard">
      <div class="statLabel">Needs Support</div>
      <div class="statValue">${scoreText(counts.needs_support || 0)}</div>
      <div class="statSub">ควรติดตามเชิงช่วยเหลือก่อน</div>
    </div>
    <div class="statCard">
      <div class="statLabel">No Attendance</div>
      <div class="statValue">${scoreText(noAttendance)}</div>
      <div class="statSub">ไม่พบการเข้าเรียนใน session ที่ควรมี</div>
    </div>
    <div class="statCard">
      <div class="statLabel">At Risk</div>
      <div class="statValue">${scoreText(atRisk)}</div>
      <div class="statSub">กลุ่มเสี่ยงจาก attendance หรือ accuracy</div>
    </div>
  `;
}

function getSelectedRows() {
  const selected = [];
  (state.filteredStudents || []).forEach(r => {
    if (state.selectedStudentIds.has(safeStr(r.student_id))) {
      selected.push(r);
    }
  });
  return selected;
}

function parseCsvLine_(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }

  out.push(cur);
  return out.map(x => x.trim());
}

function parseCsvText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '');

  if (!lines.length) return [];

  const rows = lines.map(parseCsvLine_);
  const header = rows[0].map(h => safeStr(h).toLowerCase());

  return rows.slice(1).map(cols => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return {
      student_id: safeStr(obj.student_id),
      display_name: safeStr(obj.display_name),
      section: safeStr(obj.section),
      active: safeStr(obj.active) === '' ? true : ['true', '1', 'yes'].includes(safeStr(obj.active).toLowerCase())
    };
  }).filter(r => r.student_id);
}

async function importRosterFile(file) {
  if (!file) return;

  const text = await file.text();
  const rows = parseCsvText(text);

  if (!rows.length) {
    alert('ไม่พบข้อมูลใน CSV หรือหัวตารางไม่ถูกต้อง');
    return;
  }

  const bad = rows.filter(r => !r.student_id || !r.display_name || !r.section);
  if (bad.length) {
    alert('มีบางแถวที่ขาด student_id / display_name / section');
    return;
  }

  setLoading(true);
  try {
    const res = await postAction('teacher_roster_upsert_bulk', { rows });
    alert(`นำเข้า roster สำเร็จ\nInserted: ${res?.result?.inserted || 0}\nUpdated: ${res?.result?.updated || 0}`);
    await loadOverviewAndStudents();
  } catch (err) {
    console.error(err);
    alert('นำเข้า roster ไม่สำเร็จ');
  } finally {
    setLoading(false);
    if (els.rosterFileInput) els.rosterFileInput.value = '';
  }
}

function toCsv(rows) {
  return rows.map(row => row.map(v => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }).join(',')).join('\n');
}

function downloadCsv(filename, rows) {
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

function exportStudentsCsv() {
  const rows = [
    ['student_id', 'display_name', 'section', 'sessions_count', 'last_score', 'last_accuracy', 'last_session_code', 'recommended_mode', 'recommended_difficulty']
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

function exportSelectedDetailCsv() {
  const detail = state.selectedDetail;
  if (!detail || !detail.profile) {
    alert('ยังไม่ได้เลือกนักศึกษา');
    return;
  }

  const rows = [];
  rows.push(['PROFILE']);
  rows.push(['student_id', 'display_name', 'section', 'recommended_mode', 'recommended_difficulty']);
  rows.push([
    safeStr(detail.profile.student_id),
    safeStr(detail.profile.display_name),
    safeStr(detail.profile.section),
    safeStr(detail.profile.recommended_mode),
    safeStr(detail.profile.recommended_difficulty)
  ]);

  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['sessions_count', 'avg_score', 'avg_accuracy', 'total_terms_answered', 'total_correct', 'total_wrong']);
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
  rows.push(['session_code', 'bank', 'mode', 'score', 'accuracy', 'mistakes', 'started_at', 'ended_at']);
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
  rows.push(['term', 'wrong', 'correct', 'seen', 'accuracy', 'avg_response_ms', 'last_level_after']);
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

function exportAbsenteesCsv() {
  if (!state.selectedAttendanceKey) {
    alert('ยังไม่ได้เลือก session ใน Attendance');
    return;
  }

  const found = (state.attendanceRows || []).find(
    r => `${safeStr(r.section)}||${safeStr(r.session_code)}` === state.selectedAttendanceKey
  );

  if (!found) {
    alert('ไม่พบข้อมูล session ที่เลือก');
    return;
  }

  const absentees = Array.isArray(found.absentees) ? found.absentees : [];
  if (!absentees.length) {
    alert('ไม่มีผู้ขาดใน session นี้');
    return;
  }

  const rows = [['section', 'session_code', 'student_id', 'display_name']];
  absentees.forEach(a => {
    rows.push([
      safeStr(found.section),
      safeStr(found.session_code),
      safeStr(a.student_id),
      safeStr(a.display_name)
    ]);
  });

  downloadCsv(
    `absentees_${safeStr(found.section || 'section')}_${safeStr(found.session_code || 'session')}_${Date.now()}.csv`,
    rows
  );
}

function exportAttendanceSummaryCsv() {
  const rows = [
    ['section', 'session_code', 'roster_count', 'unique_attendees', 'absent_count', 'sessions_count', 'avg_score', 'avg_accuracy']
  ];

  (state.attendanceRows || []).forEach(r => {
    rows.push([
      safeStr(r.section),
      safeStr(r.session_code),
      safeNum(r.roster_count),
      safeNum(r.unique_attendees),
      safeNum(r.absent_count),
      safeNum(r.sessions_count),
      safeNum(r.avg_score),
      safeNum(r.avg_accuracy)
    ]);
  });

  downloadCsv(`attendance_summary_${Date.now()}.csv`, rows);
}

function exportInterventionCsv() {
  const rowsData = buildInterventionRows();

  if (!rowsData.length) {
    alert('ยังไม่มี intervention queue ในเงื่อนไขนี้');
    return;
  }

  const rows = [[
    'priority',
    'student_id',
    'display_name',
    'section',
    'expected_sessions',
    'attended_sessions',
    'absent_sessions',
    'attendance_rate',
    'last_accuracy',
    'last_score',
    'action',
    'note'
  ]];

  rowsData.forEach(r => {
    rows.push([
      safeNum(r.priority),
      safeStr(r.student_id),
      safeStr(r.display_name),
      safeStr(r.section),
      safeNum(r.expected_sessions),
      safeNum(r.attended_sessions),
      safeNum(r.absent_sessions),
      safeNum(r.attendance_rate),
      safeNum(r.last_accuracy),
      safeNum(r.last_score),
      safeStr(r.action),
      safeStr(r.note)
    ]);
  });

  downloadCsv(`intervention_queue_${Date.now()}.csv`, rows);
}

function exportFollowupCsv() {
  const rowsData = Array.isArray(state.followupSummaryRows) ? state.followupSummaryRows : [];

  if (!rowsData.length) {
    alert('ยังไม่มี follow-up data ในเงื่อนไขนี้');
    return;
  }

  const rows = [[
    'student_id',
    'display_name',
    'section',
    'status',
    'note',
    'teacher_name',
    'created_at',
    'updated_at'
  ]];

  rowsData.forEach(r => {
    rows.push([
      safeStr(r.student_id),
      safeStr(r.display_name),
      safeStr(r.section),
      safeStr(r.status),
      safeStr(r.note),
      safeStr(r.teacher_name),
      safeStr(r.created_at),
      safeStr(r.updated_at)
    ]);
  });

  downloadCsv(`followup_summary_${Date.now()}.csv`, rows);
}

function exportArchiveCsv() {
  const rowsData = Array.isArray(state.archiveRows) ? state.archiveRows : [];
  if (!rowsData.length) {
    alert('ยังไม่มี archive rows');
    return;
  }

  const rows = [[
    'archived_at',
    'section',
    'session_code',
    'bank',
    'mode',
    'total_students',
    'total_sessions',
    'avg_score',
    'avg_accuracy',
    'pending',
    'contacted',
    'needs_support',
    'improved',
    'closed',
    'note_json'
  ]];

  rowsData.forEach(r => {
    rows.push([
      safeStr(r.archived_at),
      safeStr(r.section),
      safeStr(r.session_code),
      safeStr(r.bank),
      safeStr(r.mode),
      safeNum(r.total_students),
      safeNum(r.total_sessions),
      safeNum(r.avg_score),
      safeNum(r.avg_accuracy),
      safeNum(r.pending),
      safeNum(r.contacted),
      safeNum(r.needs_support),
      safeNum(r.improved),
      safeNum(r.closed),
      safeStr(r.note_json)
    ]);
  });

  downloadCsv(`teacher_archive_${Date.now()}.csv`, rows);
}

function renderFollowupTimeline(rows) {
  if (!els.followupTimeline) return;

  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    els.followupTimeline.innerHTML = '<div class="empty">ยังไม่มี timeline</div>';
    return;
  }

  els.followupTimeline.innerHTML = list.map(r => `
    <div class="timelineItem">
      <strong>${htmlEscape(r.status || '-')}</strong>
      <div style="margin-top:6px;">${htmlEscape(r.note || '-')}</div>
      <div class="timelineMeta">
        Teacher: ${htmlEscape(r.teacher_name || '-')}<br>
        Created: ${htmlEscape(r.created_at || '-')}<br>
        Updated: ${htmlEscape(r.updated_at || '-')}
      </div>
    </div>
  `).join('');
}

function buildStudentProfileSummary(detail) {
  const profile = detail?.profile || null;
  if (!profile) return null;

  const summary = detail?.summary || {};
  const weakTerms = Array.isArray(detail?.weak_terms) ? detail.weak_terms : [];
  const sessions = Array.isArray(detail?.sessions) ? detail.sessions : [];
  const latestFollowup = state.followupLatest || null;
  const risk = buildRiskRows().find(r => safeStr(r.student_id) === safeStr(profile.student_id));

  const topWeak = weakTerms.slice(0, 3).map(w => safeStr(w.term || w.term_id)).filter(Boolean);
  const recentModes = [...new Set(sessions.slice(0, 5).map(s => safeStr(s.mode)).filter(Boolean))];

  let recommendation = 'ติดตามตามปกติ';
  if (risk) {
    if (risk.priority >= 5) recommendation = 'ควรติดต่อด่วนและนัดชดเชย';
    else if (risk.priority >= 4) recommendation = 'ควรติดตามเชิงช่วยเหลือโดยเร็ว';
    else if (risk.priority >= 3) recommendation = 'ควรเสริมแบบฝึกและติดตามผล';
  }

  return {
    student_id: safeStr(profile.student_id),
    display_name: safeStr(profile.display_name),
    section: safeStr(profile.section),
    sessions_count: safeNum(summary.sessions_count),
    avg_score: safeNum(summary.avg_score),
    avg_accuracy: safeNum(summary.avg_accuracy),
    total_wrong: safeNum(summary.total_wrong),
    weak_terms_text: topWeak.length ? topWeak.join(', ') : '-',
    recent_modes_text: recentModes.length ? recentModes.join(', ') : '-',
    followup_status: safeStr(latestFollowup?.status || ''),
    followup_note: safeStr(latestFollowup?.note || ''),
    recommendation
  };
}

function renderStudentProfileSummary(detail) {
  if (!els.studentProfileSummaryBox) return;

  const s = buildStudentProfileSummary(detail);
  if (!s) {
    els.studentProfileSummaryBox.innerHTML = '<div class="empty">ยังไม่ได้เลือกนักศึกษา</div>';
    return;
  }

  els.studentProfileSummaryBox.innerHTML = `
    <div class="listItem">
      <strong>${htmlEscape(s.display_name || '-')}</strong>
      <div>Student ID: <span class="mono">${htmlEscape(s.student_id || '-')}</span> • Section: ${htmlEscape(s.section || '-')}</div>
      <div>Sessions: ${scoreText(s.sessions_count)} • Avg Score: ${scoreText(s.avg_score)} • Avg Accuracy: ${accuracyText(s.avg_accuracy)}</div>
      <div>Total Wrong: ${scoreText(s.total_wrong)}</div>
      <div>Weak Terms: ${htmlEscape(s.weak_terms_text)}</div>
      <div>Recent Modes: ${htmlEscape(s.recent_modes_text)}</div>
      <div>Latest Follow-up: ${htmlEscape(s.followup_status || '-')}</div>
      <div>Recommendation: ${htmlEscape(s.recommendation)}</div>
      <div>${htmlEscape(s.followup_note || '')}</div>
    </div>

    <div class="listItem">
      <strong>Advisor / Parent Ready Summary</strong>
      <div>
        นักศึกษา ${htmlEscape(s.display_name || '-')} รหัส ${htmlEscape(s.student_id || '-')}
        อยู่ section ${htmlEscape(s.section || '-')}
        มีผลการเรียนจากระบบคำศัพท์เฉลี่ย ${accuracyText(s.avg_accuracy)}
        จาก ${scoreText(s.sessions_count)} session
        จุดที่ควรติดตามคือ ${htmlEscape(s.weak_terms_text)}
        และคำแนะนำปัจจุบันคือ ${htmlEscape(s.recommendation)}.
      </div>
    </div>
  `;
}

function renderFollowup(latest, rows) {
  state.followupLatest = latest || null;
  state.followupRows = Array.isArray(rows) ? rows : [];

  if (els.followupLatestBox) {
    if (!latest) {
      els.followupLatestBox.innerHTML = '<div class="empty">ยังไม่มีข้อมูล follow-up</div>';
    } else {
      els.followupLatestBox.innerHTML = `
        <div class="listItem">
          <strong>Latest Status: ${htmlEscape(latest.status || '-')}</strong>
          <div>Teacher: ${htmlEscape(latest.teacher_name || '-')}</div>
          <div>Updated: ${htmlEscape(latest.updated_at || latest.created_at || '-')}</div>
          <div>${htmlEscape(latest.note || '-')}</div>
        </div>
      `;
    }
  }

  if (els.followupHistoryList) {
    if (!rows || !rows.length) {
      els.followupHistoryList.innerHTML = '<div class="empty">ยังไม่มีประวัติหมายเหตุ</div>';
    } else {
      els.followupHistoryList.innerHTML = rows.map(r => `
        <div class="listItem">
          <strong>${htmlEscape(r.status || '-')}</strong>
          <div>Teacher: ${htmlEscape(r.teacher_name || '-')}</div>
          <div>Created: ${htmlEscape(r.created_at || '-')}</div>
          <div>Updated: ${htmlEscape(r.updated_at || '-')}</div>
          <div>${htmlEscape(r.note || '-')}</div>
        </div>
      `).join('');
    }
  }

  if (latest && els.followupStatus) {
    els.followupStatus.value = safeStr(latest.status || 'pending') || 'pending';
  }

  renderFollowupTimeline(rows);
  renderStudentProfileSummary(state.selectedDetail);
}

async function loadFollowup(studentId) {
  if (!studentId) return;

  try {
    const res = await postAction('teacher_get_followup', { student_id: studentId });
    renderFollowup(res?.latest || null, res?.rows || []);
  } catch (err) {
    console.error(err);
    if (els.followupLatestBox) els.followupLatestBox.innerHTML = '<div class="empty">โหลด follow-up ไม่สำเร็จ</div>';
    if (els.followupHistoryList) els.followupHistoryList.innerHTML = '<div class="empty">โหลด follow-up ไม่สำเร็จ</div>';
    if (els.followupTimeline) els.followupTimeline.innerHTML = '<div class="empty">โหลด timeline ไม่สำเร็จ</div>';
  }
}

async function saveFollowup() {
  const detail = state.selectedDetail;
  if (!detail || !detail.profile) {
    alert('ยังไม่ได้เลือกนักศึกษา');
    return;
  }

  const note = safeStr(els.teacherNoteInput?.value);
  const teacherName = safeStr(els.teacherNameInput?.value) || 'Teacher';
  const status = safeStr(els.followupStatus?.value) || 'pending';

  if (!note) {
    alert('กรอกหมายเหตุก่อนบันทึก');
    return;
  }

  setLoading(true);
  try {
    await postAction('teacher_upsert_followup', {
      student_id: safeStr(detail.profile.student_id),
      display_name: safeStr(detail.profile.display_name),
      section: safeStr(detail.profile.section),
      status,
      note,
      teacher_name: teacherName
    });

    if (els.teacherNoteInput) els.teacherNoteInput.value = '';
    await loadFollowup(detail.profile.student_id);
    await refreshFollowupSummaryOnly();
    alert('บันทึก follow-up เรียบร้อย');
  } catch (err) {
    console.error(err);
    alert('บันทึก follow-up ไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

async function refreshFollowupSummaryOnly() {
  const filters = getFilters();
  const res = await postAction('teacher_get_followup_summary', { section: filters.section });
  renderFollowupSummary(res?.counts || {}, res?.rows || []);
  renderFollowupSectionSummary();
  applyStudentSearch();
  renderTodayActionSummary();
  renderUrgentLanding();
}

async function quickUpdateStatus(studentId, status) {
  const student = (state.students || []).find(s => safeStr(s.student_id) === safeStr(studentId));
  if (!student) {
    alert('ไม่พบข้อมูลนักศึกษา');
    return;
  }

  const teacherName = safeStr(els.teacherNameInput?.value) || 'Teacher';

  try {
    await postAction('teacher_upsert_followup', {
      student_id: safeStr(student.student_id),
      display_name: safeStr(student.display_name),
      section: safeStr(student.section),
      status,
      note: `[Quick update] status changed to ${status}`,
      teacher_name: teacherName
    });

    await refreshFollowupSummaryOnly();

    const selectedSid = safeStr(state.selectedDetail?.profile?.student_id);
    if (selectedSid && selectedSid === safeStr(student.student_id)) {
      await loadFollowup(selectedSid);
    }
  } catch (err) {
    console.error(err);
    alert('อัปเดต quick status ไม่สำเร็จ');
  }
}

async function applyBulkStatus() {
  const rows = getSelectedRows();
  if (!rows.length) {
    alert('ยังไม่ได้เลือกนักศึกษาในตาราง');
    return;
  }

  const status = safeStr(els.bulkFollowupStatus?.value) || 'pending';
  const note = safeStr(els.bulkNoteInput?.value) || `[Bulk update] status changed to ${status}`;
  const teacherName = safeStr(els.teacherNameInput?.value) || 'Teacher';

  setLoading(true);
  try {
    await postAction('teacher_upsert_followup_bulk', {
      rows: rows.map(r => ({
        student_id: safeStr(r.student_id),
        display_name: safeStr(r.display_name),
        section: safeStr(r.section)
      })),
      status,
      note,
      teacher_name: teacherName
    });

    state.selectedStudentIds = new Set();
    if (els.selectAllFilteredChk) els.selectAllFilteredChk.checked = false;
    if (els.bulkNoteInput) els.bulkNoteInput.value = '';

    await refreshFollowupSummaryOnly();

    const selectedSid = safeStr(state.selectedDetail?.profile?.student_id);
    if (selectedSid) {
      await loadFollowup(selectedSid);
    }

    renderStudentsTable();
    alert(`อัปเดตสถานะเรียบร้อย ${rows.length} คน`);
  } catch (err) {
    console.error(err);
    alert('bulk update ไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

async function archiveSnapshot() {
  const filters = getFilters();
  const counts = state.followupCounts || {};
  const overview = state.lastOverview || {};

  setLoading(true);
  try {
    await postAction('teacher_archive_snapshot', {
      archived_at: bangkokIsoNow(),
      section: filters.section,
      session_code: filters.session_code,
      bank: filters.bank,
      mode: filters.mode,
      total_students: safeNum(overview.total_students),
      total_sessions: safeNum(overview.total_sessions),
      avg_score: safeNum(overview.avg_score),
      avg_accuracy: safeNum(overview.avg_accuracy),
      pending: safeNum(counts.pending),
      contacted: safeNum(counts.contacted),
      needs_support: safeNum(counts.needs_support),
      improved: safeNum(counts.improved),
      closed: safeNum(counts.closed),
      note_json: {
        filtered_students: safeNum((state.filteredStudents || []).length),
        attendance_rows: safeNum((state.attendanceRows || []).length)
      }
    });

    await loadArchiveRows();
    alert('archive snapshot เรียบร้อย');
  } catch (err) {
    console.error(err);
    alert('archive snapshot ไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function parseArchiveNoteJson(noteJson) {
  try {
    const obj = typeof noteJson === 'string' ? JSON.parse(noteJson || '{}') : (noteJson || {});
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) {
    return {};
  }
}

async function loadArchiveRows() {
  try {
    const filters = getFilters();
    const res = await postAction('teacher_get_archive_rows', {
      section: filters.section,
      session_code: filters.session_code
    });

    state.archiveRows = Array.isArray(res?.rows) ? res.rows : [];
    renderArchiveTable();
  } catch (err) {
    console.error(err);
    if (els.archiveTableBody) {
      els.archiveTableBody.innerHTML = '<tr><td colspan="11">โหลด archive ไม่สำเร็จ</td></tr>';
    }
  }
}

function renderArchiveTable() {
  if (!els.archiveTableBody) return;

  const rows = Array.isArray(state.archiveRows) ? state.archiveRows : [];
  if (!rows.length) {
    els.archiveTableBody.innerHTML = '<tr><td colspan="11">ยังไม่มี archive snapshots</td></tr>';
    return;
  }

  els.archiveTableBody.innerHTML = rows.map((r, idx) => {
    const note = parseArchiveNoteJson(r.note_json);
    const id = safeStr(r.archived_at) + '||' + idx;
    const checkedA = state.archiveSelectA === id ? 'checked' : '';
    const checkedB = state.archiveSelectB === id ? 'checked' : '';

    return `
      <tr data-archive-id="${htmlEscape(id)}">
        <td><input type="radio" name="archiveA" class="archivePickA" data-archive-id="${htmlEscape(id)}" ${checkedA}></td>
        <td><input type="radio" name="archiveB" class="archivePickB" data-archive-id="${htmlEscape(id)}" ${checkedB}></td>
        <td>${htmlEscape(r.archived_at || '-')}</td>
        <td>${htmlEscape(r.section || '-')}</td>
        <td>${htmlEscape(r.session_code || '-')}</td>
        <td>${scoreText(r.avg_score)}</td>
        <td>${accuracyText(r.avg_accuracy)}</td>
        <td>${scoreText(r.total_students)}</td>
        <td>${scoreText(r.total_sessions)}</td>
        <td>${htmlEscape(note.type || 'snapshot')}</td>
        <td>${htmlEscape(note.label || '-')}</td>
      </tr>
    `;
  }).join('');

  els.archiveTableBody.querySelectorAll('.archivePickA').forEach(el => {
    el.addEventListener('change', () => {
      state.archiveSelectA = el.getAttribute('data-archive-id') || '';
    });
  });

  els.archiveTableBody.querySelectorAll('.archivePickB').forEach(el => {
    el.addEventListener('change', () => {
      state.archiveSelectB = el.getAttribute('data-archive-id') || '';
    });
  });
}

function findArchiveRowById(id) {
  const rows = Array.isArray(state.archiveRows) ? state.archiveRows : [];
  return rows.find((r, idx) => (safeStr(r.archived_at) + '||' + idx) === id) || null;
}

function compareSnapshots() {
  const a = findArchiveRowById(state.archiveSelectA);
  const b = findArchiveRowById(state.archiveSelectB);

  if (!a || !b) {
    if (els.archiveCompareBox) {
      els.archiveCompareBox.innerHTML = '<div class="empty">เลือก snapshot A และ B ก่อน</div>';
    }
    return;
  }

  const noteA = parseArchiveNoteJson(a.note_json);
  const noteB = parseArchiveNoteJson(b.note_json);
  const diff = (x, y) => safeNum(y) - safeNum(x);

  const items = [
    ['Students', a.total_students, b.total_students],
    ['Sessions', a.total_sessions, b.total_sessions],
    ['Avg Score', a.avg_score, b.avg_score],
    ['Avg Accuracy', a.avg_accuracy, b.avg_accuracy],
    ['Pending', a.pending, b.pending],
    ['Contacted', a.contacted, b.contacted],
    ['Needs Support', a.needs_support, b.needs_support],
    ['Improved', a.improved, b.improved],
    ['Closed', a.closed, b.closed]
  ];

  if (els.archiveCompareBox) {
    els.archiveCompareBox.innerHTML = `
      <div class="listItem">
        <strong>Snapshot A</strong>
        <div>${htmlEscape(a.archived_at || '-')} • ${htmlEscape(noteA.type || 'snapshot')} • ${htmlEscape(noteA.label || '-')}</div>
      </div>
      <div class="listItem">
        <strong>Snapshot B</strong>
        <div>${htmlEscape(b.archived_at || '-')} • ${htmlEscape(noteB.type || 'snapshot')} • ${htmlEscape(noteB.label || '-')}</div>
      </div>
      ${items.map(([label, va, vb]) => {
        const d = diff(va, vb);
        const cls = d > 0 ? 'good' : d < 0 ? 'bad' : '';
        const sign = d > 0 ? '+' : '';
        return `
          <div class="listItem">
            <strong>${htmlEscape(label)}</strong>
            <div>A: ${htmlEscape(String(va ?? '-'))} • B: ${htmlEscape(String(vb ?? '-'))}</div>
            <div>${makePill(`${sign}${d}`, cls)}</div>
          </div>
        `;
      }).join('')}
    `;
  }
}

async function createTermBoundary() {
  const label = safeStr(els.termBoundaryLabel?.value);
  const message = safeStr(els.termBoundaryMessage?.value);

  if (!label) {
    alert('กรอก Boundary Label ก่อน');
    return;
  }

  const filters = getFilters();
  const counts = state.followupCounts || {};
  const overview = state.lastOverview || {};

  setLoading(true);
  try {
    await postAction('teacher_create_term_boundary', {
      archived_at: bangkokIsoNow(),
      label,
      message,
      section: filters.section,
      session_code: filters.session_code,
      bank: filters.bank,
      mode: filters.mode,
      total_students: safeNum(overview.total_students),
      total_sessions: safeNum(overview.total_sessions),
      avg_score: safeNum(overview.avg_score),
      avg_accuracy: safeNum(overview.avg_accuracy),
      pending: safeNum(counts.pending),
      contacted: safeNum(counts.contacted),
      needs_support: safeNum(counts.needs_support),
      improved: safeNum(counts.improved),
      closed: safeNum(counts.closed)
    });

    await loadArchiveRows();
    alert('สร้าง term boundary เรียบร้อย');
  } catch (err) {
    console.error(err);
    alert('สร้าง term boundary ไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function softResetView() {
  clearFilters();
  state.selectedStudentId = '';
  state.selectedDetail = null;
  state.selectedStudentIds = new Set();
  state.archiveSelectA = '';
  state.archiveSelectB = '';

  if (els.selectAllFilteredChk) els.selectAllFilteredChk.checked = false;
  if (els.bulkNoteInput) els.bulkNoteInput.value = '';
  if (els.termBoundaryLabel) els.termBoundaryLabel.value = '';
  if (els.termBoundaryMessage) els.termBoundaryMessage.value = '';

  clearDetail();
  loadOverviewAndStudents();
  loadArchiveRows();

  alert('soft reset view เรียบร้อย — ไม่มีการลบข้อมูลดิบ');
}

/* CLEAN: เหลือ renderUrgentLanding แค่ตัวเดียว */
function renderUrgentLanding() {
  if (!els.urgentLandingList) return;

  const rows = buildInterventionRows().slice(0, 8);
  if (!rows.length) {
    els.urgentLandingList.innerHTML = '<div class="empty">ไม่พบเคสเร่งด่วนในเงื่อนไขนี้</div>';
    return;
  }

  els.urgentLandingList.innerHTML = rows.map((r, idx) => `
    <div class="listItem">
      <strong>#${idx + 1} ${htmlEscape(r.display_name || '-')}</strong>
      <div>Student ID: <span class="mono">${htmlEscape(r.student_id || '-')}</span> • Section: ${htmlEscape(r.section || '-')}</div>
      <div>${makePill('P' + r.priority, r.priority >= 4 ? 'bad' : 'warn')}</div>
      <div>Attendance: ${scoreText(r.attended_sessions)} / ${scoreText(r.expected_sessions)} (${safeNum(r.attendance_rate).toFixed(1)}%)</div>
      <div>Accuracy: ${accuracyText(r.last_accuracy)} • Score: ${scoreText(r.last_score)}</div>
      <div><strong>Action:</strong> ${htmlEscape(r.action || '-')}</div>
    </div>
  `).join('');
}

function applyUrgentLandingMode() {
  if (!state.urgentLandingMode) return;

  const urgent = buildInterventionRows();
  if (!urgent.length) return;

  const first = urgent[0];
  const sid = safeStr(first.student_id);
  if (sid && sid !== safeStr(state.selectedStudentId)) {
    state.selectedStudentId = sid;
    renderStudentsTable();
    loadStudentDetail(sid);
  }
}

function printTeacherReport() {
  const overview = state.lastOverview || {};
  const riskRows = buildRiskRows().filter(r => r.risk_level !== 'low').slice(0, 12);
  const topRows = getTopPerformerRows();
  const sectionRows = Array.isArray(state.sectionSummaryRows) ? state.sectionSummaryRows : [];
  const attendanceRows = Array.isArray(state.attendanceRows) ? state.attendanceRows : [];
  const selected = state.selectedDetail || null;
  const filters = getFilters();

  const selectedHtml = selected?.profile ? `
    <h2>Selected Student Detail</h2>
    <table>
      <tr><th>Student ID</th><td>${htmlEscape(selected.profile.student_id || '-')}</td></tr>
      <tr><th>Name</th><td>${htmlEscape(selected.profile.display_name || '-')}</td></tr>
      <tr><th>Section</th><td>${htmlEscape(selected.profile.section || '-')}</td></tr>
      <tr><th>Sessions</th><td>${scoreText(selected.summary?.sessions_count)}</td></tr>
      <tr><th>Avg Score</th><td>${scoreText(selected.summary?.avg_score)}</td></tr>
      <tr><th>Avg Accuracy</th><td>${accuracyText(selected.summary?.avg_accuracy)}</td></tr>
    </table>
  ` : '';

  const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Teacher Report</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111;}
        h1,h2{margin:0 0 10px;}
        .meta{margin:12px 0 18px;font-size:13px;color:#444;line-height:1.6;}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 20px;}
        .box{border:1px solid #ddd;border-radius:12px;padding:12px;}
        .k{font-size:12px;color:#666;text-transform:uppercase;}
        .v{font-size:24px;font-weight:700;margin-top:8px;}
        table{width:100%;border-collapse:collapse;margin:10px 0 20px;}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left;vertical-align:top;}
        th{background:#f3f3f3;}
      </style>
    </head>
    <body>
      <h1>Teacher Dashboard Report</h1>
      <div class="meta">
        Printed at: ${htmlEscape(bangkokIsoNow())}<br>
        Filters: section=${htmlEscape(filters.section || 'ALL')} • session_code=${htmlEscape(filters.session_code || 'ALL')} • bank=${htmlEscape(filters.bank || 'ALL')} • mode=${htmlEscape(filters.mode || 'ALL')}
      </div>

      <div class="grid">
        <div class="box"><div class="k">Students</div><div class="v">${scoreText(overview.total_students)}</div></div>
        <div class="box"><div class="k">Sessions</div><div class="v">${scoreText(overview.total_sessions)}</div></div>
        <div class="box"><div class="k">Avg Score</div><div class="v">${scoreText(overview.avg_score)}</div></div>
        <div class="box"><div class="k">Avg Accuracy</div><div class="v">${accuracyText(overview.avg_accuracy)}</div></div>
      </div>

      <h2>Section Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Unique Students</th>
            <th>Completed Sessions</th>
            <th>Avg Score</th>
            <th>Avg Accuracy</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRows.map(r => `
            <tr>
              <td>${htmlEscape(r.section || '-')}</td>
              <td>${scoreText(r.unique_students)}</td>
              <td>${scoreText(r.sessions_count)}</td>
              <td>${scoreText(r.avg_score)}</td>
              <td>${accuracyText(r.avg_accuracy)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Attendance Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Session Code</th>
            <th>Roster</th>
            <th>Attendees</th>
            <th>Absent</th>
            <th>Completed Sessions</th>
            <th>Avg Score</th>
            <th>Avg Accuracy</th>
          </tr>
        </thead>
        <tbody>
          ${attendanceRows.map(r => `
            <tr>
              <td>${htmlEscape(r.section || '-')}</td>
              <td>${htmlEscape(r.session_code || '-')}</td>
              <td>${scoreText(r.roster_count)}</td>
              <td>${scoreText(r.unique_attendees)}</td>
              <td>${scoreText(r.absent_count)}</td>
              <td>${scoreText(r.sessions_count)}</td>
              <td>${scoreText(r.avg_score)}</td>
              <td>${accuracyText(r.avg_accuracy)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>At-Risk Students</h2>
      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Name</th>
            <th>Section</th>
            <th>Attendance</th>
            <th>Accuracy</th>
            <th>Score</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${riskRows.map(r => `
            <tr>
              <td>${htmlEscape(r.student_id || '-')}</td>
              <td>${htmlEscape(r.display_name || '-')}</td>
              <td>${htmlEscape(r.section || '-')}</td>
              <td>${scoreText(r.attended_sessions)} / ${scoreText(r.expected_sessions)} (${safeNum(r.attendance_rate).toFixed(1)}%)</td>
              <td>${accuracyText(r.last_accuracy)}</td>
              <td>${scoreText(r.last_score)}</td>
              <td>${htmlEscape(r.risk_reason || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Top Performers</h2>
      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Name</th>
            <th>Section</th>
            <th>Accuracy</th>
            <th>Score</th>
            <th>Attendance</th>
          </tr>
        </thead>
        <tbody>
          ${topRows.map(r => `
            <tr>
              <td>${htmlEscape(r.student_id || '-')}</td>
              <td>${htmlEscape(r.display_name || '-')}</td>
              <td>${htmlEscape(r.section || '-')}</td>
              <td>${accuracyText(r.last_accuracy)}</td>
              <td>${scoreText(r.last_score)}</td>
              <td>${scoreText(r.attended_sessions)} / ${scoreText(r.expected_sessions)} (${safeNum(r.attendance_rate).toFixed(1)}%)</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${selectedHtml}
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=1100,height=900');
  if (!win) {
    alert('เบราว์เซอร์บล็อกหน้าพิมพ์ กรุณาอนุญาต pop-up');
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function printSelectedStudentReport() {
  const detail = state.selectedDetail;

  if (!detail || !detail.profile) {
    alert('ยังไม่ได้เลือกนักศึกษา');
    return;
  }

  const profile = detail.profile || {};
  const summary = detail.summary || {};
  const sessions = Array.isArray(detail.sessions) ? detail.sessions : [];
  const weakTerms = Array.isArray(detail.weak_terms) ? detail.weak_terms : [];
  const relatedRisk = buildInterventionRows().find(r => safeStr(r.student_id) === safeStr(profile.student_id));

  const weakTermsHtml = weakTerms.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Term</th>
            <th>Wrong</th>
            <th>Correct</th>
            <th>Seen</th>
            <th>Accuracy</th>
            <th>Avg RT (ms)</th>
            <th>Level</th>
          </tr>
        </thead>
        <tbody>
          ${weakTerms.map(w => `
            <tr>
              <td>${htmlEscape(w.term || w.term_id || '-')}</td>
              <td>${scoreText(w.wrong)}</td>
              <td>${scoreText(w.correct)}</td>
              <td>${scoreText(w.seen)}</td>
              <td>${accuracyText(w.accuracy)}</td>
              <td>${scoreText(w.avg_response_ms)}</td>
              <td>${htmlEscape(w.last_level_after || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div class="small">ไม่พบ weak terms</div>';

  const sessionsHtml = sessions.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Session Code</th>
            <th>Bank</th>
            <th>Mode</th>
            <th>Score</th>
            <th>Accuracy</th>
            <th>Mistakes</th>
            <th>Ended</th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map(s => `
            <tr>
              <td>${htmlEscape(s.session_code || '-')}</td>
              <td>${htmlEscape(s.bank || '-')}</td>
              <td>${htmlEscape(s.mode || '-')}</td>
              <td>${scoreText(s.score)}</td>
              <td>${accuracyText(s.accuracy)}</td>
              <td>${scoreText(s.mistakes)}</td>
              <td>${htmlEscape(s.ended_at || s.timestamp || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div class="small">ยังไม่มี session</div>';

  const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Student Report • ${htmlEscape(profile.display_name || 'Student')}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111;}
        h1,h2{margin:0 0 10px;}
        .meta{margin:12px 0 18px;font-size:13px;color:#444;line-height:1.6;}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 20px;}
        .box{border:1px solid #ddd;border-radius:12px;padding:12px;}
        .k{font-size:12px;color:#666;text-transform:uppercase;}
        .v{font-size:24px;font-weight:700;margin-top:8px;}
        table{width:100%;border-collapse:collapse;margin:10px 0 20px;}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left;vertical-align:top;}
        th{background:#f3f3f3;}
        .small{font-size:12px;color:#555;}
        .section{margin-top:20px;}
      </style>
    </head>
    <body>
      <h1>Selected Student Report</h1>
      <div class="meta">
        Printed at: ${htmlEscape(bangkokIsoNow())}
      </div>

      <h2>${htmlEscape(profile.display_name || '-')}</h2>
      <div class="meta">
        Student ID: ${htmlEscape(profile.student_id || '-')}<br>
        Section: ${htmlEscape(profile.section || '-')}<br>
        Recommended Mode: ${htmlEscape(profile.recommended_mode || '-')}<br>
        Recommended Difficulty: ${htmlEscape(profile.recommended_difficulty || '-')}
      </div>

      <div class="grid">
        <div class="box"><div class="k">Sessions</div><div class="v">${scoreText(summary.sessions_count)}</div></div>
        <div class="box"><div class="k">Avg Score</div><div class="v">${scoreText(summary.avg_score)}</div></div>
        <div class="box"><div class="k">Avg Accuracy</div><div class="v">${accuracyText(summary.avg_accuracy)}</div></div>
      </div>

      ${
        relatedRisk ? `
        <div class="section">
          <h2>Intervention Status</h2>
          <div class="meta">
            Priority: P${scoreText(relatedRisk.priority)}<br>
            Attendance: ${scoreText(relatedRisk.attended_sessions)} / ${scoreText(relatedRisk.expected_sessions)} (${safeNum(relatedRisk.attendance_rate).toFixed(1)}%)<br>
            Absences: ${scoreText(relatedRisk.absent_sessions)}<br>
            Last Accuracy: ${accuracyText(relatedRisk.last_accuracy)}<br>
            Last Score: ${scoreText(relatedRisk.last_score)}<br>
            Action: ${htmlEscape(relatedRisk.action || '-')}<br>
            Note: ${htmlEscape(relatedRisk.note || '-')}
          </div>
        </div>
        ` : ''
      }

      <div class="section">
        <h2>Weak Terms</h2>
        ${weakTermsHtml}
      </div>

      <div class="section">
        <h2>Recent Sessions</h2>
        ${sessionsHtml}
      </div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=1000,height=850');
  if (!win) {
    alert('เบราว์เซอร์บล็อกหน้าพิมพ์ กรุณาอนุญาต pop-up');
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

async function loadOverviewAndStudents() {
  setLoading(true);
  try {
    const filters = getFilters();

    const [overviewRes, studentsRes, attendanceRes, sectionRes, followupRes] = await Promise.all([
      postAction('teacher_get_overview', filters),
      postAction('teacher_get_students', filters),
      postAction('teacher_get_attendance_roster', filters),
      postAction('teacher_get_section_summary', filters),
      postAction('teacher_get_followup_summary', { section: filters.section })
    ]);

    state.lastOverview = overviewRes?.summary || {};
    state.students = Array.isArray(studentsRes?.rows) ? studentsRes.rows : [];

    renderOverview(state.lastOverview);
    renderAttendance(attendanceRes?.rows || []);
    renderSectionSummary(sectionRes?.rows || []);
    renderFollowupSummary(followupRes?.counts || {}, followupRes?.rows || []);
    renderFollowupSectionSummary();

    applyStudentSearch();
    renderRiskDashboard();
    renderHeatmap();
    renderSessionComparison();
    renderInterventionQueue();
    renderTodayActionSummary();
    renderUrgentLanding();

    if (els.urgentLandingChk) els.urgentLandingChk.checked = !!state.urgentLandingMode;
    applyUrgentLandingMode();

    const selectedSid = safeStr(state.selectedStudentId);
    if (selectedSid) {
      const stillExists = state.students.some(x => safeStr(x.student_id) === selectedSid);
      if (stillExists) {
        await loadStudentDetail(selectedSid);
      } else {
        state.selectedStudentId = '';
        state.selectedDetail = null;
        clearDetail();
      }
    } else {
      clearDetail();
    }

    loadArchiveRows();
  } catch (err) {
    console.error(err);
    alert('โหลดข้อมูลครูไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function clearDetail() {
  if (els.detailName) els.detailName.textContent = 'ยังไม่ได้เลือกนักศึกษา';
  if (els.detailMeta) els.detailMeta.textContent = 'เลือกจากตารางด้านซ้ายเพื่อดูข้อมูลรายคน';
  if (els.detailBadges) els.detailBadges.innerHTML = '';
  if (els.detailSessions) els.detailSessions.textContent = '-';
  if (els.detailAvgScore) els.detailAvgScore.textContent = '-';
  if (els.detailAvgAcc) els.detailAvgAcc.textContent = '-';

  if (els.weakTermsList) els.weakTermsList.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';
  if (els.sessionsList) els.sessionsList.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';

  if (els.trendChartWrap) {
    els.trendChartWrap.innerHTML = 'ยังไม่มีข้อมูล';
    els.trendChartWrap.className = 'empty';
  }

  if (els.followupLatestBox) {
    els.followupLatestBox.innerHTML = '<div class="empty">ยังไม่มีข้อมูล follow-up</div>';
  }
  if (els.followupHistoryList) {
    els.followupHistoryList.innerHTML = '<div class="empty">ยังไม่มีประวัติหมายเหตุ</div>';
  }
  if (els.followupTimeline) {
    els.followupTimeline.innerHTML = '<div class="empty">ยังไม่มี timeline</div>';
  }
  if (els.teacherNoteInput) {
    els.teacherNoteInput.value = '';
  }
  if (els.followupStatus) {
    els.followupStatus.value = 'pending';
  }
  if (els.studentProfileSummaryBox) {
    els.studentProfileSummaryBox.innerHTML = '<div class="empty">ยังไม่ได้เลือกนักศึกษา</div>';
  }

  if (els.attendanceDetailList) {
    els.attendanceDetailList.innerHTML = '<div class="empty">ยังไม่ได้เลือก session</div>';
  }
  if (els.absenteeDetailList) {
    els.absenteeDetailList.innerHTML = '<div class="empty">ยังไม่ได้เลือก session</div>';
  }
}

async function loadStudentDetail(studentId) {
  if (!studentId) return;
  setLoading(true);
  try {
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
    await loadFollowup(studentId);
    renderStudentProfileSummary(state.selectedDetail);
  } catch (err) {
    console.error(err);
    alert('โหลดรายละเอียดนักศึกษาไม่สำเร็จ');
  } finally {
    setLoading(false);
  }
}

function clearFilters() {
  if (els.sectionFilter) els.sectionFilter.value = '';
  if (els.sessionCodeFilter) els.sessionCodeFilter.value = '';
  if (els.bankFilter) els.bankFilter.value = '';
  if (els.modeFilter) els.modeFilter.value = '';
  if (els.studentSearch) els.studentSearch.value = '';
  if (els.lowAccOnly) els.lowAccOnly.value = '';
  if (els.followupFilter) els.followupFilter.value = '';
}

function attachSortHandlers() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort') || '';
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      applyStudentSearch();
    });
  });
}

on(els.applyFilterBtn, 'click', loadOverviewAndStudents);
on(els.refreshBtn, 'click', loadOverviewAndStudents);

on(els.clearFilterBtn, 'click', () => {
  clearFilters();
  state.selectedStudentId = '';
  state.selectedDetail = null;
  state.selectedStudentIds = new Set();
  loadOverviewAndStudents();
});

on(els.studentSearch, 'input', applyStudentSearch);
on(els.lowAccOnly, 'change', applyStudentSearch);
on(els.followupFilter, 'change', applyStudentSearch);

on(els.importRosterBtn, 'click', () => {
  els.rosterFileInput?.click();
});

on(els.rosterFileInput, 'change', e => {
  const file = e.target?.files?.[0];
  if (file) importRosterFile(file);
});

on(els.exportStudentsBtn, 'click', exportStudentsCsv);
on(els.exportDetailBtn, 'click', exportSelectedDetailCsv);
on(els.exportAbsenteeBtn, 'click', exportAbsenteesCsv);
on(els.exportAttendanceSummaryBtn, 'click', exportAttendanceSummaryCsv);
on(els.exportInterventionBtn, 'click', exportInterventionCsv);
on(els.exportFollowupBtn, 'click', exportFollowupCsv);
on(els.exportArchiveBtn, 'click', exportArchiveCsv);

on(els.printTeacherReportBtn, 'click', printTeacherReport);
on(els.printSelectedStudentBtn, 'click', printSelectedStudentReport);

on(els.saveFollowupBtn, 'click', saveFollowup);
on(els.refreshFollowupBtn, 'click', () => {
  const sid = safeStr(state.selectedDetail?.profile?.student_id);
  if (!sid) {
    alert('ยังไม่ได้เลือกนักศึกษา');
    return;
  }
  loadFollowup(sid);
});

on(els.selectAllFilteredChk, 'change', () => {
  const checked = !!els.selectAllFilteredChk.checked;
  if (checked) {
    state.filteredStudents.forEach(r => state.selectedStudentIds.add(safeStr(r.student_id)));
  } else {
    state.selectedStudentIds = new Set();
  }
  renderStudentsTable();
});

on(els.applyBulkStatusBtn, 'click', applyBulkStatus);
on(els.archiveSnapshotBtn, 'click', archiveSnapshot);

on(els.refreshArchiveBtn, 'click', loadArchiveRows);
on(els.compareArchiveBtn, 'click', compareSnapshots);
on(els.createBoundaryBtn, 'click', createTermBoundary);
on(els.softResetViewBtn, 'click', softResetView);

on(els.urgentLandingChk, 'change', () => {
  state.urgentLandingMode = !!els.urgentLandingChk.checked;
  localStorage.setItem('TEACHER_URGENT_LANDING', state.urgentLandingMode ? '1' : '0');
  if (state.urgentLandingMode) applyUrgentLandingMode();
});

attachSortHandlers();
loadOverviewAndStudents();
