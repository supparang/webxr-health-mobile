const ENDPOINT =
  window.TECHPATH_ATTENDANCE_ENDPOINT ||
  'https://script.google.com/macros/s/AKfycbzOs6lQUEdTug17xKDDaVKEFMN0n0hkoBY9erwH309hkHMDYzNB_FhtSzhmNnF0uF5f/exec';

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
  quickFilter: 'all',
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

function applyQuickFilter(row) {
  switch (state.quickFilter) {
    case 'completed':
      return !!row.completed;
    case 'not_completed':
      return !row.completed;
    case 'in_progress':
      return String(row.attendanceStatus || '') === 'in_progress';
    case 'min_fail':
      return !row.minTimeMet;
    default:
      return true;
  }
}

function applyFilters() {
  const search = state.filters.search.toLowerCase().trim();

  state.filteredRows = state.rows.filter(r => {
    if (state.filters.section && String(r.classSection || '') !== state.filters.section) return false;
    if (state.filters.status && String(r.attendanceStatus || '') !== state.filters.status) return false;
    if (state.filters.session && String(r.sessionNo || '') !== state.filters.session) return false;
    if (state.filters.minTime === 'yes' && !r.minTimeMet) return false;
    if (state.filters.minTime === 'no' && !!r.minTimeMet) return false;
    if (!applyQuickFilter(r)) return false;

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

function buildSectionSummary(rows) {
  const map = new Map();

  rows.forEach(r => {
    const section = String(r.classSection || '').trim() || '-';
    if (!map.has(section)) {
      map.set(section, {
        section,
        total: 0,
        completed: 0,
        minTimeMet: 0,
        durationSecSum: 0,
        activeTimeSecSum: 0,
        scoreSum: 0
      });
    }

    const g = map.get(section);
    g.total += 1;
    g.completed += r.completed ? 1 : 0;
    g.minTimeMet += r.minTimeMet ? 1 : 0;
    g.durationSecSum += Number(r.durationSec || 0);
    g.activeTimeSecSum += Number(r.activeTimeSec || 0);
    g.scoreSum += Number(r.score || 0);
  });

  return [...map.values()]
    .map(g => ({
      section: g.section,
      total: g.total,
      completed: g.completed,
      minTimeMet: g.minTimeMet,
      avgDurationSec: g.total ? Math.round(g.durationSecSum / g.total) : 0,
      avgActiveTimeSec: g.total ? Math.round(g.activeTimeSecSum / g.total) : 0,
      avgScore: g.total ? Math.round(g.scoreSum / g.total) : 0
    }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

function renderSectionSummary() {
  const tbody = $('section-summary-tbody');
  const meta = $('section-meta');
  const rows = buildSectionSummary(state.filteredRows);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">ไม่พบข้อมูล</td></tr>`;
    meta.textContent = '0 sections';
    return;
  }

  meta.textContent = `${rows.length} sections`;

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.section)}</td>
      <td>${escapeHtml(r.total)}</td>
      <td class="yes">${escapeHtml(r.completed)}</td>
      <td class="${r.minTimeMet === r.total ? 'yes' : 'no'}">${escapeHtml(r.minTimeMet)}</td>
      <td>${escapeHtml(fmtSec(r.avgDurationSec))}</td>
      <td>${escapeHtml(fmtSec(r.avgActiveTimeSec))}</td>
      <td>${escapeHtml(r.avgScore)}</td>
    </tr>
  `).join('');
}

function sessionOrderList() {
  return ['S00', ...Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`)];
}

function buildSectionChipRows(rows) {
  const map = new Map();

  rows.forEach(r => {
    const sec = String(r.classSection || '').trim() || '-';
    map.set(sec, (map.get(sec) || 0) + 1);
  });

  return [...map.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

function renderSectionChips() {
  const root = $('section-chip-row');
  if (!root) return;

  const sections = buildSectionChipRows(state.rows);

  root.innerHTML = `
    <button class="section-chip ${state.filters.section ? '' : 'active'}" data-sec="">
      ทุก Section (${state.rows.length})
    </button>
    ${sections.map(s => `
      <button class="section-chip ${state.filters.section === s.section ? 'active' : ''}" data-sec="${escapeHtml(s.section)}">
        ${escapeHtml(s.section)} (${escapeHtml(s.count)})
      </button>
    `).join('')}
  `;

  root.querySelectorAll('.section-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.section = btn.dataset.sec || '';
      $('filter-section').value = state.filters.section;
      renderSectionChips();
      applyFilters();
      renderTable();
      renderSectionSummary();
      renderSessionHeatmap();
      renderRiskTable();
      renderSectionSessionMatrix();
    });
  });
}

function buildSessionHeatmapRows(rows) {
  const sessions = sessionOrderList();
  const out = sessions.map(s => ({
    sessionNo: s,
    total: 0,
    completed: 0,
    inProgress: 0,
    minFail: 0
  }));

  const bySession = new Map(out.map(x => [x.sessionNo, x]));

  rows.forEach(r => {
    const s = String(r.sessionNo || 'S00').trim() || 'S00';
    const item = bySession.get(s);
    if (!item) return;

    item.total += 1;
    if (r.completed) item.completed += 1;
    if (String(r.attendanceStatus || '') === 'in_progress') item.inProgress += 1;
    if (!r.minTimeMet) item.minFail += 1;
  });

  return out;
}

function heatLevel(n) {
  if (n <= 0) return 'lv0';
  if (n === 1) return 'lv1';
  if (n === 2) return 'lv2';
  if (n <= 4) return 'lv3';
  if (n <= 7) return 'lv4';
  return 'lv5';
}

function renderSessionHeatmap() {
  const root = $('session-heatmap-grid');
  const meta = $('heatmap-meta');
  if (!root || !meta) return;

  const rows = buildSessionHeatmapRows(state.filteredRows);
  const activeSessions = rows.filter(r => r.total > 0).length;
  meta.textContent = `${activeSessions} active sessions`;

  root.innerHTML = rows.map(r => `
    <div class="heatmap-cell ${heatLevel(r.total)}">
      <div class="s">${escapeHtml(r.sessionNo)}</div>
      <div class="n">${escapeHtml(r.total)}</div>
      <div class="m">
        complete ${escapeHtml(r.completed)}<br>
        in progress ${escapeHtml(r.inProgress)}<br>
        min fail ${escapeHtml(r.minFail)}
      </div>
    </div>
  `).join('');
}

function buildAtRiskRows(rows) {
  return rows
    .filter(r => {
      const status = String(r.attendanceStatus || '');
      return !r.completed || !r.minTimeMet || status === 'in_progress' || status === 'left';
    })
    .sort((a, b) => {
      const aScore =
        (!a.completed ? 4 : 0) +
        (!a.minTimeMet ? 3 : 0) +
        (String(a.attendanceStatus || '') === 'in_progress' ? 2 : 0) +
        (String(a.attendanceStatus || '') === 'left' ? 1 : 0);

      const bScore =
        (!b.completed ? 4 : 0) +
        (!b.minTimeMet ? 3 : 0) +
        (String(b.attendanceStatus || '') === 'in_progress' ? 2 : 0) +
        (String(b.attendanceStatus || '') === 'left' ? 1 : 0);

      if (bScore !== aScore) return bScore - aScore;
      return String(b.lastServerTs || '').localeCompare(String(a.lastServerTs || ''));
    });
}

function renderRiskTable() {
  const tbody = $('risk-tbody');
  const meta = $('risk-meta');
  if (!tbody || !meta) return;

  const rows = buildAtRiskRows(state.filteredRows);
  meta.textContent = `${rows.length} rows`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">ไม่มีรายการเสี่ยง</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.slice(0, 50).map(r => `
    <tr>
      <td>${escapeHtml(safe(r.studentName))}<br><span style="color:#9db2c7;font-size:.82rem;">${escapeHtml(safe(r.studentId))}</span></td>
      <td>${escapeHtml(safe(r.classSection))}</td>
      <td>${escapeHtml(safe(r.sessionNo))}</td>
      <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(safe(r.attendanceStatus))}</span></td>
      <td>${escapeHtml(fmtSec(r.durationSec || 0))}</td>
      <td class="${r.minTimeMet ? 'yes' : 'no'}">${r.minTimeMet ? 'YES' : 'NO'}</td>
    </tr>
  `).join('');
}

function setQuickFilterChipActive(value) {
  document.querySelectorAll('.quick-chip[data-qf]').forEach(x => {
    x.classList.toggle('active', (x.dataset.qf || 'all') === value);
  });
}

function applyFastFilter(mode) {
  if (mode === 'unfinished') {
    state.quickFilter = 'not_completed';
    setQuickFilterChipActive('not_completed');
  } else if (mode === 'minfail') {
    state.quickFilter = 'min_fail';
    setQuickFilterChipActive('min_fail');
  } else {
    state.quickFilter = 'all';
    setQuickFilterChipActive('all');
  }

  applyFilters();
  renderTable();
  renderSectionSummary();
  renderSessionHeatmap();
  renderRiskTable();
  renderSectionSessionMatrix();
}

function exportCurrentCSV() {
  const rows = state.filteredRows || [];
  if (!rows.length) {
    alert('ไม่มีข้อมูลสำหรับ export');
    return;
  }

  const headers = [
    'visitId',
    'studentId',
    'studentName',
    'classSection',
    'sessionNo',
    'lessonId',
    'enteredAt',
    'startedAt',
    'finishedAt',
    'lastActiveAt',
    'durationSec',
    'activeTimeSec',
    'actionsCount',
    'score',
    'completed',
    'attendanceStatus',
    'minTimeMet',
    'firstServerTs',
    'lastServerTs',
    'pageUrl',
    'userAgent'
  ];

  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const val = r[h] ?? '';
        const text = String(val).replaceAll('"', '""');
        return `"${text}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  a.href = url;
  a.download = `techpath-attendance-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportSectionCSV() {
  const sec = state.filters.section || '';
  const rows = state.filteredRows.filter(r => !sec || String(r.classSection || '') === sec);

  if (!rows.length) {
    alert('ไม่มีข้อมูลของ section นี้สำหรับ export');
    return;
  }

  const headers = [
    'visitId',
    'studentId',
    'studentName',
    'classSection',
    'sessionNo',
    'lessonId',
    'enteredAt',
    'startedAt',
    'finishedAt',
    'lastActiveAt',
    'durationSec',
    'activeTimeSec',
    'actionsCount',
    'score',
    'completed',
    'attendanceStatus',
    'minTimeMet',
    'firstServerTs',
    'lastServerTs',
    'pageUrl',
    'userAgent'
  ];

  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${String(r[h] ?? '').replaceAll('"', '""')}"`).join(',')
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  const secLabel = sec || 'all-sections';
  a.href = url;
  a.download = `techpath-attendance-${secLabel}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildSectionSessionMatrix(rows) {
  const sessions = Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
  const map = new Map();

  rows.forEach(r => {
    const section = String(r.classSection || '').trim() || '-';
    if (!map.has(section)) {
      const base = {
        section,
        total: 0,
        done: 0,
        minOk: 0
      };
      sessions.forEach(s => base[s] = 0);
      map.set(section, base);
    }

    const g = map.get(section);
    g.total += 1;
    if (r.completed) g.done += 1;
    if (r.minTimeMet) g.minOk += 1;

    const s = String(r.sessionNo || '').trim();
    if (sessions.includes(s)) g[s] += 1;
  });

  return [...map.values()].sort((a, b) => a.section.localeCompare(b.section));
}

function badgeClass(n) {
  const x = Number(n || 0);
  if (x <= 0) return 'zero';
  if (x <= 2) return 'low';
  if (x <= 5) return 'mid';
  return 'high';
}

function renderSectionSessionMatrix() {
  const tbody = $('section-session-matrix-tbody');
  const meta = $('matrix-meta');
  if (!tbody || !meta) return;

  const rows = buildSectionSessionMatrix(state.filteredRows);
  meta.textContent = `${rows.length} sections`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="19">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  const sessions = Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.section)}</td>
      <td class="center">${escapeHtml(r.total)}</td>
      <td class="center yes">${escapeHtml(r.done)}</td>
      <td class="center ${r.minOk === r.total ? 'yes' : 'no'}">${escapeHtml(r.minOk)}</td>
      ${sessions.map(s => `
        <td class="center">
          <span class="matrix-badge ${badgeClass(r[s])}">
            ${escapeHtml(r[s])}
          </span>
        </td>
      `).join('')}
    </tr>
  `).join('');
}

function bindFilterEvents() {
  $('filter-search').addEventListener('input', e => {
    state.filters.search = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
  });

  $('filter-section').addEventListener('change', e => {
    state.filters.section = e.target.value || '';
    renderSectionChips();
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
  });

  $('filter-status').addEventListener('change', e => {
    state.filters.status = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
  });

  $('filter-session').addEventListener('change', e => {
    state.filters.session = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
  });

  $('filter-minTime').addEventListener('change', e => {
    state.filters.minTime = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
  });

  $('btn-refresh').addEventListener('click', () => {
    loadDashboard(true);
  });

  $('btn-auto').addEventListener('click', () => {
    state.autoRefresh = !state.autoRefresh;
    $('btn-auto').textContent = `Auto refresh: ${state.autoRefresh ? 'ON' : 'OFF'}`;
    setupAutoRefresh();
  });

  $('btn-export').addEventListener('click', exportCurrentCSV);

  document.querySelectorAll('.quick-chip[data-qf]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quickFilter = btn.dataset.qf || 'all';
      setQuickFilterChipActive(state.quickFilter);
      applyFilters();
      renderTable();
      renderSectionSummary();
      renderSessionHeatmap();
      renderRiskTable();
      renderSectionSessionMatrix();
    });
  });
}

function bindV4ActionButtons() {
  $('btn-show-unfinished')?.addEventListener('click', () => {
    applyFastFilter('unfinished');
  });

  $('btn-show-minfail')?.addEventListener('click', () => {
    applyFastFilter('minfail');
  });

  $('btn-clear-fastfilters')?.addEventListener('click', () => {
    applyFastFilter('all');
  });

  $('btn-export-section')?.addEventListener('click', () => {
    exportSectionCSV();
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
    renderSectionChips();
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();

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
    $('section-summary-tbody').innerHTML = `<tr><td colspan="7">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    $('risk-tbody').innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    $('section-session-matrix-tbody').innerHTML = `<tr><td colspan="19">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
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

function setupMobileFilterToggle() {
  const btn = $('mobile-filter-toggle');
  if (!btn) return;

  if (window.innerWidth <= 700) {
    document.body.classList.add('filters-collapsed');
    btn.textContent = 'แสดง Filters';
  } else {
    document.body.classList.remove('filters-collapsed');
    btn.textContent = 'ซ่อน Filters';
  }

  btn.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('filters-collapsed');
    btn.textContent = collapsed ? 'แสดง Filters' : 'ซ่อน Filters';
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) {
      document.body.classList.remove('filters-collapsed');
      btn.textContent = 'ซ่อน Filters';
    } else if (document.body.classList.contains('filters-collapsed')) {
      btn.textContent = 'แสดง Filters';
    } else {
      btn.textContent = 'ซ่อน Filters';
    }
  });
}

function initStaticUI() {
  $('endpoint-pill').textContent = `Endpoint: ${ENDPOINT ? 'connected' : 'missing'}`;
  $('footer-note').textContent = `Build: ${BUILD}`;
  $('btn-auto').textContent = `Auto refresh: ${state.autoRefresh ? 'ON' : 'OFF'}`;
}

async function init() {
  initStaticUI();
  bindFilterEvents();
  bindV4ActionButtons();
  setupMobileFilterToggle();
  setupAutoRefresh();
  await loadDashboard(false);
}

init();
