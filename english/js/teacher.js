const ENDPOINT =
  window.TECHPATH_ATTENDANCE_ENDPOINT ||
  '';

const BUILD = window.TEACHER_BUILD || 'teacher-dev';

const state = {
  rows: [],
  filteredRows: [],
  summary: null,
  filters: {
    search: '',
    section: '',
    status: '',
    session: '',
    minTime: ''
  },
  autoRefresh: true,
  autoTimer: null,
  selectedRow: null
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtSec(sec) {
  const n = Math.max(0, Number(sec || 0));
  const mm = String(Math.floor(n / 60)).padStart(2, '0');
  const ss = String(Math.floor(n % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('th-TH');
}

function safe(v, fallback = '-') {
  return String(v ?? '').trim() || fallback;
}

function tagClass(status) {
  const s = String(status || '').trim();
  if (s === 'completed') return 'completed';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'entered') return 'entered';
  if (s === 'left') return 'left';
  return 'entered';
}

async function fetchJSON(params = {}) {
  const url = new URL(ENDPOINT);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  });
  url.searchParams.set('_t', String(Date.now()));

  const res = await fetch(url.toString(), { method: 'GET' });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function renderSummaryCards(summary) {
  const root = $('summary-cards');
  if (!summary) {
    root.innerHTML = `<div class="panel card"><div class="k">No data</div><div class="v">-</div></div>`;
    return;
  }

  const cards = [
    { label: 'Sessions ทั้งหมด', value: summary.total },
    { label: 'Completed', value: summary.completed, cls: 'ok' },
    { label: 'Min time ผ่าน', value: summary.minTimeMet, cls: 'ok' },
    { label: 'In progress', value: summary.inProgress, cls: 'warn' },
    { label: 'Entered', value: summary.entered, cls: 'warn' },
    { label: 'Avg Duration', value: fmtSec(summary.avgDurationSec || 0) },
    { label: 'Avg Score', value: summary.avgScore ?? 0 }
  ];

  root.innerHTML = cards.map(c => `
    <div class="panel card ${c.cls || ''}">
      <div class="k">${escapeHtml(c.label)}</div>
      <div class="v">${escapeHtml(c.value)}</div>
    </div>
  `).join('');
}

function fillSelect(selectId, items, placeholder) {
  const el = $(selectId);
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (items.includes(current)) el.value = current;
}

function applyFilters() {
  const search = state.filters.search.toLowerCase().trim();
  state.filteredRows = state.rows.filter(r => {
    if (state.filters.section && String(r.classSection || '') !== state.filters.section) return false;
    if (state.filters.status && String(r.attendanceStatus || '') !== state.filters.status) return false;
    if (state.filters.session && String(r.sessionNo || '') !== state.filters.session) return false;
    if (state.filters.minTime === 'yes' && !r.minTimeMet) return false;
    if (state.filters.minTime === 'no' && !!r.minTimeMet) return false;

    if (search) {
      const hay = [
        r.studentId,
        r.studentName,
        r.classSection,
        r.sessionNo,
        r.attendanceStatus
      ].join(' ').toLowerCase();

      if (!hay.includes(search)) return false;
    }

    return true;
  });
}

function renderTable() {
  const tbody = $('students-tbody');
  const meta = $('table-meta');

  if (!state.filteredRows.length) {
    tbody.innerHTML = `<tr><td colspan="11">ไม่พบข้อมูล</td></tr>`;
    meta.textContent = '0 rows';
    return;
  }

  meta.textContent = `${state.filteredRows.length} rows`;

  tbody.innerHTML = state.filteredRows.map((r, idx) => `
    <tr data-idx="${idx}">
      <td>${escapeHtml(safe(r.studentId))}</td>
      <td>${escapeHtml(safe(r.studentName))}</td>
      <td>${escapeHtml(safe(r.classSection))}</td>
      <td>${escapeHtml(safe(r.sessionNo))}</td>
      <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(safe(r.attendanceStatus))}</span></td>
      <td>${escapeHtml(fmtSec(r.durationSec || 0))}</td>
      <td>${escapeHtml(fmtSec(r.activeTimeSec || 0))}</td>
      <td>${escapeHtml(String(r.score ?? 0))}</td>
      <td class="${r.completed ? 'yes' : 'no'}">${r.completed ? 'YES' : 'NO'}</td>
      <td class="${r.minTimeMet ? 'yes' : 'no'}">${r.minTimeMet ? 'YES' : 'NO'}</td>
      <td>${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const idx = Number(tr.dataset.idx || 0);
      const row = state.filteredRows[idx];
      state.selectedRow = row;
      loadStudentDetail(row);
    });
  });
}

function bindFilterEvents() {
  $('filter-search').addEventListener('input', e => {
    state.filters.search = e.target.value || '';
    applyFilters();
    renderTable();
  });

  $('filter-section').addEventListener('change', e => {
    state.filters.section = e.target.value || '';
    applyFilters();
    renderTable();
  });

  $('filter-status').addEventListener('change', e => {
    state.filters.status = e.target.value || '';
    applyFilters();
    renderTable();
  });

  $('filter-session').addEventListener('change', e => {
    state.filters.session = e.target.value || '';
    applyFilters();
    renderTable();
  });

  $('filter-minTime').addEventListener('change', e => {
    state.filters.minTime = e.target.value || '';
    applyFilters();
    renderTable();
  });

  $('btn-refresh').addEventListener('click', () => {
    loadDashboard(true);
  });

  $('btn-auto').addEventListener('click', () => {
    state.autoRefresh = !state.autoRefresh;
    $('btn-auto').textContent = `Auto refresh: ${state.autoRefresh ? 'ON' : 'OFF'}`;
    setupAutoRefresh();
  });
}

function renderDetailLoading() {
  $('detail-body').innerHTML = `<div class="detail-empty">กำลังโหลดรายละเอียด...</div>`;
}

function renderDetail(detail) {
  const root = $('detail-body');
  const s = detail.latestSession || {};
  const counts = detail.countsByEvent || {};
  const sessions = Array.isArray(detail.sessions) ? detail.sessions : [];
  const events = Array.isArray(detail.events) ? detail.events : [];

  const eventCountHtml = Object.entries(counts).length
    ? Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `
          <div class="mini-card">
            <div class="k">${escapeHtml(k)}</div>
            <div class="v">${escapeHtml(v)}</div>
          </div>
        `).join('')
    : `<div class="detail-empty">ไม่มี event</div>`;

  const sessionsHtml = sessions.length
    ? sessions.map(x => `
        <div class="session-item">
          <div class="top">
            <div class="name">${escapeHtml(safe(x.sessionNo))} • ${escapeHtml(safe(x.attendanceStatus))}</div>
            <div class="meta">${escapeHtml(fmtDate(x.lastServerTs || x.firstServerTs))}</div>
          </div>
          <div class="meta">
            duration ${escapeHtml(fmtSec(x.durationSec || 0))}
            • active ${escapeHtml(fmtSec(x.activeTimeSec || 0))}
            • score ${escapeHtml(String(x.score ?? 0))}
            • completed ${x.completed ? 'YES' : 'NO'}
          </div>
        </div>
      `).join('')
    : `<div class="detail-empty">ไม่มีประวัติ session</div>`;

  const eventsHtml = events.length
    ? events.slice(0, 20).map(ev => `
        <div class="event-item">
          <div class="top">
            <div class="name">${escapeHtml(safe(ev.eventType))}</div>
            <div class="meta">${escapeHtml(fmtDate(ev.serverTs || ev.clientTs))}</div>
          </div>
          <div class="meta">
            S ${escapeHtml(safe(ev.sessionNo))}
            • score ${escapeHtml(String(ev.score ?? 0))}
            • duration ${escapeHtml(fmtSec(ev.durationSec || 0))}
          </div>
        </div>
      `).join('')
    : `<div class="detail-empty">ไม่มี event รายละเอียด</div>`;

  root.innerHTML = `
    <div class="kv">
      <div class="k">Student ID</div><div>${escapeHtml(safe(s.studentId))}</div>
      <div class="k">Name</div><div>${escapeHtml(safe(s.studentName))}</div>
      <div class="k">Section</div><div>${escapeHtml(safe(s.classSection))}</div>
      <div class="k">Current S</div><div>${escapeHtml(safe(s.sessionNo))}</div>
      <div class="k">Status</div><div><span class="tag ${tagClass(s.attendanceStatus)}">${escapeHtml(safe(s.attendanceStatus))}</span></div>
      <div class="k">Duration</div><div>${escapeHtml(fmtSec(s.durationSec || 0))}</div>
      <div class="k">Active</div><div>${escapeHtml(fmtSec(s.activeTimeSec || 0))}</div>
      <div class="k">Score</div><div>${escapeHtml(String(s.score ?? 0))}</div>
      <div class="k">Completed</div><div class="${s.completed ? 'yes' : 'no'}">${s.completed ? 'YES' : 'NO'}</div>
      <div class="k">Min Time</div><div class="${s.minTimeMet ? 'yes' : 'no'}">${s.minTimeMet ? 'YES' : 'NO'}</div>
      <div class="k">Last Server</div><div>${escapeHtml(fmtDate(s.lastServerTs || s.firstServerTs))}</div>
    </div>

    <div class="section-title">Event Counts</div>
    <div class="mini-grid">${eventCountHtml}</div>

    <div class="section-title">Recent Sessions</div>
    <div class="session-list">${sessionsHtml}</div>

    <div class="section-title">Recent Events</div>
    <div class="event-list">${eventsHtml}</div>
  `;
}

async function loadStudentDetail(row) {
  if (!row) return;
  renderDetailLoading();

  try {
    const data = await fetchJSON({
      api: 'attendance',
      teacher: 'student_detail',
      studentId: row.studentId || '',
      visitId: row.visitId || ''
    });
    renderDetail(data);
  } catch (err) {
    $('detail-body').innerHTML = `<div class="detail-empty">โหลดรายละเอียดไม่สำเร็จ: ${escapeHtml(err.message || err)}</div>`;
  }
}

async function loadDashboard(keepDetail = false) {
  try {
    $('table-meta').textContent = 'กำลังโหลดข้อมูล...';

    const data = await fetchJSON({
      api: 'attendance',
      teacher: 'dashboard'
    });

    state.rows = Array.isArray(data.rows) ? data.rows : [];
    state.summary = data.summary || null;

    fillSelect('filter-section', data.filters?.sections || [], 'ทุก Section');
    fillSelect('filter-status', data.filters?.statuses || [], 'ทุกสถานะ');
    fillSelect('filter-session', data.filters?.sessions || [], 'ทุก S');

    renderSummaryCards(state.summary);
    applyFilters();
    renderTable();

    if (keepDetail && state.selectedRow) {
      const match = state.rows.find(r =>
        String(r.visitId || '') === String(state.selectedRow.visitId || '')
      );
      if (match) {
        state.selectedRow = match;
        loadStudentDetail(match);
      }
    }
  } catch (err) {
    $('students-tbody').innerHTML = `<tr><td colspan="11">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message || err)}</td></tr>`;
    $('table-meta').textContent = 'error';
  }
}

function setupAutoRefresh() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }

  if (!state.autoRefresh) return;

  state.autoTimer = setInterval(() => {
    loadDashboard(true);
  }, 15000);
}

function initStaticUI() {
  $('endpoint-pill').textContent = `Endpoint: ${ENDPOINT ? 'connected' : 'missing'}`;
  $('footer-note').textContent = `Build: ${BUILD}`;
  $('btn-auto').textContent = `Auto refresh: ${state.autoRefresh ? 'ON' : 'OFF'}`;
}

async function init() {
  initStaticUI();
  bindFilterEvents();
  setupAutoRefresh();
  await loadDashboard(false);
}

init();