const ENDPOINT =
  window.TECHPATH_ATTENDANCE_ENDPOINT ||
  'https://script.google.com/macros/s/AKfycbzOs6lQUEdTug17xKDDaVKEFMN0n0hkoBY9erwH309hkHMDYzNB_FhtSzhmNnF0uF5f/exec';

const BUILD = window.TEACHER_BUILD || 'teacher-dev';

const state = {
  rows: [],
  filteredRows: [],
  summary: null,
  roster: [],
  adminMeta: {},
  registerSort: {
    key: 'studentId',
    dir: 'asc'
  },
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

const ROSTER_STORAGE_KEY = 'TECHPATH_TEACHER_ROSTER_V1';
const ADMIN_META_STORAGE_KEY = 'TECHPATH_TEACHER_ADMIN_META_V1';

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

function normalizeText(v) {
  return String(v ?? '').trim();
}

function tagClass(status) {
  const s = String(status || '').trim();
  if (s === 'completed') return 'completed';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'entered') return 'entered';
  if (s === 'left') return 'left';
  if (s === 'never_entered') return 'never_entered';
  if (s === 'unfinished') return 'unfinished';
  if (s === 'min_fail') return 'min_fail';
  if (s === 'passed') return 'passed';
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
  if (!el) return;
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

  if (!tbody || !meta) return;

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
  if (!tbody || !meta) return;

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
      if ($('filter-section')) $('filter-section').value = state.filters.section;
      renderSectionChips();
      applyFilters();
      renderTable();
      renderSectionSummary();
      renderSessionHeatmap();
      renderRiskTable();
      renderSectionSessionMatrix();
      renderGroupBoards();
      renderRegisterMode();
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
  renderGroupBoards();
  renderRegisterMode();
}

function exportRowsAsCSV(rows, filenamePrefix) {
  if (!rows || !rows.length) {
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
      headers.map(h => `"${String(r[h] ?? '').replaceAll('"', '""')}"`).join(',')
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentCSV() {
  const rows = state.filteredRows || [];
  if (!rows.length) {
    alert('ไม่มีข้อมูลสำหรับ export');
    return;
  }
  exportRowsAsCSV(rows, 'techpath-attendance');
}

function exportSectionCSV() {
  const sec = state.filters.section || '';
  const rows = state.filteredRows.filter(r => !sec || String(r.classSection || '') === sec);

  if (!rows.length) {
    alert('ไม่มีข้อมูลของ section นี้สำหรับ export');
    return;
  }

  exportRowsAsCSV(rows, `techpath-attendance-${sec || 'all-sections'}`);
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
      sessions.forEach(s => { base[s] = 0; });
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

function studentKeyFromAttendanceRow(r) {
  const sid = normalizeText(r.studentId);
  if (sid) return `id:${sid}`;
  const name = normalizeText(r.studentName).toLowerCase();
  const sec = normalizeText(r.classSection).toLowerCase();
  return `name:${name}|sec:${sec}`;
}

function studentKeyFromRosterRow(r) {
  const sid = normalizeText(r.studentId);
  if (sid) return `id:${sid}`;
  const name = normalizeText(r.studentName).toLowerCase();
  const sec = normalizeText(r.classSection).toLowerCase();
  return `name:${name}|sec:${sec}`;
}

function parseCsvLineWithDelimiter(line, delimiter = ',') {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function parseFlexibleRosterLine(line) {
  if (line.includes('\t')) return line.split('\t').map(x => x.trim());
  if (line.includes('|')) return line.split('|').map(x => x.trim());
  if (line.includes(';') && !line.includes(',')) return parseCsvLineWithDelimiter(line, ';');
  return parseCsvLineWithDelimiter(line, ',');
}

function isRosterHeaderRow(parts) {
  const joined = parts.join(' ').toLowerCase();
  return (
    joined.includes('studentid') ||
    joined.includes('student id') ||
    joined.includes('student_name') ||
    joined.includes('student name') ||
    joined.includes('studentname') ||
    joined.includes('section') ||
    joined.includes('classsection') ||
    joined.includes('class section')
  );
}

function parseRosterText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  const rows = [];

  for (const line of lines) {
    const clean = parseFlexibleRosterLine(line)
      .map(x => String(x || '').trim())
      .filter(Boolean);

    if (!clean.length) continue;
    if (isRosterHeaderRow(clean)) continue;

    const studentId = clean[0] || '';
    const studentName = clean[1] || '';
    const classSection = clean[2] || '';

    if (!studentId && !studentName) continue;

    rows.push({
      studentId,
      studentName,
      classSection
    });
  }

  const dedup = new Map();
  rows.forEach(r => {
    dedup.set(studentKeyFromRosterRow(r), r);
  });

  return [...dedup.values()].sort((a, b) => {
    const secCmp = normalizeText(a.classSection).localeCompare(normalizeText(b.classSection));
    if (secCmp !== 0) return secCmp;
    return normalizeText(a.studentId || a.studentName).localeCompare(
      normalizeText(b.studentId || b.studentName)
    );
  });
}

function saveRosterToLocal() {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(state.roster || []));
  } catch (_) {}
}

function loadRosterFromLocal() {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function defaultAdminMeta() {
  return {
    institution: '',
    course: '',
    semester: '',
    academicYear: '',
    instructor: '',
    logoUrl: ''
  };
}

function loadAdminMetaFromLocal() {
  try {
    const raw = localStorage.getItem(ADMIN_META_STORAGE_KEY);
    if (!raw) return defaultAdminMeta();
    const data = JSON.parse(raw);
    return { ...defaultAdminMeta(), ...(data || {}) };
  } catch (_) {
    return defaultAdminMeta();
  }
}

function saveAdminMetaToLocal() {
  try {
    localStorage.setItem(ADMIN_META_STORAGE_KEY, JSON.stringify(state.adminMeta || defaultAdminMeta()));
  } catch (_) {}
}

function readAdminMetaFromInputs() {
  state.adminMeta = {
    institution: $('meta-institution')?.value?.trim() || '',
    course: $('meta-course')?.value?.trim() || '',
    semester: $('meta-semester')?.value?.trim() || '',
    academicYear: $('meta-academic-year')?.value?.trim() || '',
    instructor: $('meta-instructor')?.value?.trim() || '',
    logoUrl: $('meta-logo-url')?.value?.trim() || ''
  };
}

function renderAdminMetaInputs() {
  const meta = state.adminMeta || defaultAdminMeta();
  if ($('meta-institution')) $('meta-institution').value = meta.institution || '';
  if ($('meta-course')) $('meta-course').value = meta.course || '';
  if ($('meta-semester')) $('meta-semester').value = meta.semester || '';
  if ($('meta-academic-year')) $('meta-academic-year').value = meta.academicYear || '';
  if ($('meta-instructor')) $('meta-instructor').value = meta.instructor || '';
  if ($('meta-logo-url')) $('meta-logo-url').value = meta.logoUrl || '';

  const status = $('admin-meta-status');
  if (status) {
    const parts = [
      meta.institution,
      meta.course,
      meta.semester,
      meta.academicYear
    ].filter(Boolean);
    status.textContent = parts.length ? parts.join(' • ') : 'ยังไม่ได้บันทึก';
  }
}

function bindAdminMetaButtons() {
  $('btn-save-admin-meta')?.addEventListener('click', () => {
    readAdminMetaFromInputs();
    saveAdminMetaToLocal();
    renderAdminMetaInputs();
    alert('บันทึก admin meta แล้ว');
  });

  $('btn-clear-admin-meta')?.addEventListener('click', () => {
    state.adminMeta = defaultAdminMeta();
    try { localStorage.removeItem(ADMIN_META_STORAGE_KEY); } catch (_) {}
    renderAdminMetaInputs();
  });
}

function buildRosterStats() {
  const rosterRows = Array.isArray(state.roster) ? state.roster : [];
  const secFilter = normalizeText(state.filters.section);
  const search = normalizeText(state.filters.search).toLowerCase();

  const filteredRoster = rosterRows.filter(r => {
    if (secFilter && normalizeText(r.classSection) !== secFilter) return false;

    if (search) {
      const hay = [
        r.studentId,
        r.studentName,
        r.classSection
      ].join(' ').toLowerCase();

      if (!hay.includes(search)) return false;
    }

    return true;
  });

  const attendedKeys = new Set((state.rows || []).map(studentKeyFromAttendanceRow));

  const neverEntered = filteredRoster.filter(r => !attendedKeys.has(studentKeyFromRosterRow(r)));

  return {
    rosterTotal: filteredRoster.length,
    entered: filteredRoster.length - neverEntered.length,
    neverEntered: neverEntered.length
  };
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsText(file, 'utf-8');
  });
}

function exportRosterRowsAsCSV(rows, filenamePrefix) {
  if (!rows || !rows.length) {
    alert('ไม่มีข้อมูลสำหรับ export');
    return;
  }

  const headers = ['studentId', 'studentName', 'classSection'];

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
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderRosterMeta() {
  const meta = $('roster-meta');
  const textarea = $('roster-input');
  const totalEl = $('roster-total-count');
  const enteredEl = $('roster-entered-count');
  const neverEl = $('roster-never-count');

  const stats = buildRosterStats();

  if (totalEl) totalEl.textContent = String(stats.rosterTotal);
  if (enteredEl) enteredEl.textContent = String(stats.entered);
  if (neverEl) neverEl.textContent = String(stats.neverEntered);

  if (!meta) return;

  if (!state.roster.length) {
    meta.textContent = 'ยังไม่มี roster';
    if (textarea && !textarea.value.trim()) textarea.value = '';
    return;
  }

  meta.textContent = `loaded ${state.roster.length} students • entered ${stats.entered} • never ${stats.neverEntered}`;

  if (textarea && !textarea.value.trim()) {
    textarea.value = state.roster
      .map(r => [r.studentId, r.studentName, r.classSection].join(', '))
      .join('\n');
  }
}

function bindRosterButtons() {
  $('btn-load-roster')?.addEventListener('click', () => {
    const text = $('roster-input')?.value || '';
    state.roster = parseRosterText(text);
    renderRosterMeta();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('btn-save-roster')?.addEventListener('click', () => {
    const text = $('roster-input')?.value || '';
    state.roster = parseRosterText(text);
    saveRosterToLocal();
    renderRosterMeta();
    renderGroupBoards();
    renderRegisterMode();
    alert('บันทึก roster ในเครื่องแล้ว');
  });

  $('btn-clear-roster')?.addEventListener('click', () => {
    state.roster = [];
    try { localStorage.removeItem(ROSTER_STORAGE_KEY); } catch (_) {}
    const ta = $('roster-input');
    if (ta) ta.value = '';
    renderRosterMeta();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('btn-import-roster-file')?.addEventListener('click', () => {
    $('roster-file-input')?.click();
  });

  $('roster-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readTextFile(file);
      const ta = $('roster-input');
      if (ta) ta.value = text;

      state.roster = parseRosterText(text);
      renderRosterMeta();
      renderGroupBoards();
      renderRegisterMode();
      alert(`นำเข้า roster สำเร็จ ${state.roster.length} รายชื่อ`);
    } catch (err) {
      alert(`นำเข้าไฟล์ไม่สำเร็จ: ${err.message || err}`);
    } finally {
      e.target.value = '';
    }
  });

  $('btn-export-never-by-section')?.addEventListener('click', () => {
    const groups = buildGroupBuckets(state.filteredRows);
    const rows = groups.neverEntered || [];

    if (!rows.length) {
      alert('ไม่มีรายชื่อ never entered สำหรับ export');
      return;
    }

    const bySection = new Map();
    rows.forEach(r => {
      const sec = normalizeText(r.classSection) || 'NO-SECTION';
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(r);
    });

    const sections = [...bySection.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    sections.forEach(([sec, list], idx) => {
      setTimeout(() => {
        exportRosterRowsAsCSV(list, `techpath-never-entered-${sec}`);
      }, idx * 250);
    });
  });
}

function renderGroupList(elId, rows, emptyText) {
  const el = $(elId);
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `<div class="group-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  el.innerHTML = rows.slice(0, 20).map(r => `
    <div class="group-item">
      <div class="name">${escapeHtml(safe(r.studentName))}</div>
      <div class="meta">
        ${escapeHtml(safe(r.studentId))} • ${escapeHtml(safe(r.classSection))}<br>
        ${escapeHtml(safe(r.sessionNo))} • ${escapeHtml(safe(r.attendanceStatus || r.registerStatus))}<br>
        duration ${escapeHtml(fmtSec(r.durationSec || 0))} • min ${(r.minTimeMet || false) ? 'YES' : 'NO'}
      </div>
    </div>
  `).join('');
}

function buildGroupBuckets(rows) {
  const rosterRows = Array.isArray(state.roster) ? state.roster : [];
  const attendedKeys = new Set((state.rows || []).map(studentKeyFromAttendanceRow));

  const search = normalizeText(state.filters.search).toLowerCase();
  const secFilter = normalizeText(state.filters.section);

  const neverEntered = rosterRows.filter(r => {
    if (secFilter && normalizeText(r.classSection) !== secFilter) return false;

    if (search) {
      const hay = [
        r.studentId,
        r.studentName,
        r.classSection
      ].join(' ').toLowerCase();

      if (!hay.includes(search)) return false;
    }

    return !attendedKeys.has(studentKeyFromRosterRow(r));
  });

  return {
    unfinished: rows.filter(r => !r.completed),
    passed: rows.filter(r => r.completed && r.minTimeMet),
    minFail: rows.filter(r => !r.minTimeMet),
    neverEntered
  };
}

function renderGroupBoards() {
  const groups = buildGroupBuckets(state.filteredRows);

  if ($('group-unfinished-count')) $('group-unfinished-count').textContent = String(groups.unfinished.length);
  if ($('group-passed-count')) $('group-passed-count').textContent = String(groups.passed.length);
  if ($('group-minfail-count')) $('group-minfail-count').textContent = String(groups.minFail.length);
  if ($('group-never-count')) $('group-never-count').textContent = String(groups.neverEntered.length);

  renderGroupList('group-unfinished-list', groups.unfinished, 'ไม่มีรายการ');
  renderGroupList('group-passed-list', groups.passed, 'ยังไม่มีผู้ผ่านครบเกณฑ์');
  renderGroupList('group-minfail-list', groups.minFail, 'ทุกคนผ่าน min time แล้ว');

  const neverEl = $('group-never-list');
  if (neverEl) {
    if (!state.roster.length) {
      neverEl.innerHTML = `<div class="group-empty">ยังไม่มี roster</div>`;
    } else if (!groups.neverEntered.length) {
      neverEl.innerHTML = `<div class="group-empty">ทุกคนใน roster เคยเข้าแล้ว</div>`;
    } else {
      neverEl.innerHTML = groups.neverEntered.slice(0, 20).map(r => `
        <div class="group-item">
          <div class="name">${escapeHtml(safe(r.studentName))}</div>
          <div class="meta">
            ${escapeHtml(safe(r.studentId))} • ${escapeHtml(safe(r.classSection))}
          </div>
        </div>
      `).join('');
    }
  }

  renderRosterMeta();
}

function buildLatestAttendanceByStudent(rows) {
  const map = new Map();

  const sorted = [...rows].sort((a, b) => {
    const aa = String(a.lastServerTs || a.firstServerTs || '');
    const bb = String(b.lastServerTs || b.firstServerTs || '');
    return bb.localeCompare(aa);
  });

  sorted.forEach(r => {
    const key = studentKeyFromAttendanceRow(r);
    if (!key) return;
    if (!map.has(key)) map.set(key, r);
  });

  return map;
}

function registerStatusFromAttendance(att) {
  if (!att) {
    return { entered: false, status: 'never_entered' };
  }

  if (att.completed && att.minTimeMet) {
    return { entered: true, status: 'passed' };
  }

  if (!att.minTimeMet) {
    return { entered: true, status: 'min_fail' };
  }

  if (!att.completed) {
    return { entered: true, status: 'unfinished' };
  }

  return { entered: true, status: 'entered' };
}

function buildRegisterRows(opts = {}) {
  const rosterRows = Array.isArray(state.roster) ? state.roster : [];
  if (!rosterRows.length) return [];

  const latestMap = buildLatestAttendanceByStudent(state.rows || []);
  const search = opts.ignoreSearch ? '' : normalizeText(state.filters.search).toLowerCase();
  const secFilter = opts.ignoreSection ? '' : normalizeText(state.filters.section);

  return rosterRows
    .filter(r => {
      if (secFilter && normalizeText(r.classSection) !== secFilter) return false;

      if (search) {
        const hay = [
          r.studentId,
          r.studentName,
          r.classSection
        ].join(' ').toLowerCase();

        if (!hay.includes(search)) return false;
      }

      return true;
    })
    .map(r => {
      const att = latestMap.get(studentKeyFromRosterRow(r)) || null;
      const stat = registerStatusFromAttendance(att);

      return {
        studentId: normalizeText(r.studentId),
        studentName: normalizeText(r.studentName),
        classSection: normalizeText(r.classSection),
        entered: stat.entered,
        registerStatus: stat.status,
        sessionNo: att ? normalizeText(att.sessionNo) : '',
        durationSec: att ? Number(att.durationSec || 0) : 0,
        activeTimeSec: att ? Number(att.activeTimeSec || 0) : 0,
        score: att ? Number(att.score || 0) : 0,
        completed: att ? !!att.completed : false,
        minTimeMet: att ? !!att.minTimeMet : false,
        lastServerTs: att ? (att.lastServerTs || att.firstServerTs || '') : '',
        visitId: att ? (att.visitId || '') : '',
        lessonId: att ? (att.lessonId || '') : '',
        pageUrl: att ? (att.pageUrl || '') : '',
        userAgent: att ? (att.userAgent || '') : ''
      };
    })
    .sort((a, b) => {
      const secCmp = a.classSection.localeCompare(b.classSection);
      if (secCmp !== 0) return secCmp;
      return (a.studentId || a.studentName).localeCompare(b.studentId || b.studentName);
    });
}

function comparePrimitive(a, b) {
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(a) - Number(b);
  }

  const na = Number(a);
  const nb = Number(b);
  const bothNumeric =
    !Number.isNaN(na) &&
    !Number.isNaN(nb) &&
    String(a).trim() !== '' &&
    String(b).trim() !== '';

  if (bothNumeric) return na - nb;

  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function sortRegisterRows(rows) {
  const key = state.registerSort?.key || 'studentId';
  const dir = state.registerSort?.dir === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const cmp = comparePrimitive(a[key], b[key]);
    if (cmp !== 0) return cmp * dir;

    const secCmp = comparePrimitive(a.classSection, b.classSection);
    if (secCmp !== 0) return secCmp;

    return comparePrimitive(a.studentId || a.studentName, b.studentId || b.studentName);
  });
}

function updateRegisterSortHeaderUI() {
  document.querySelectorAll('.sort-th').forEach(th => {
    th.classList.remove('active-asc', 'active-desc');
    const key = th.dataset.sort;
    if (key === state.registerSort.key) {
      th.classList.add(state.registerSort.dir === 'desc' ? 'active-desc' : 'active-asc');
    }
  });
}

function bindRegisterSortHeaders() {
  document.querySelectorAll('.sort-th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;

      if (state.registerSort.key === key) {
        state.registerSort.dir = state.registerSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.registerSort.key = key;
        state.registerSort.dir = 'asc';
      }

      updateRegisterSortHeaderUI();
      renderRegisterMode();
    });
  });
}

function renderRegisterMode() {
  const tbody = $('register-tbody');
  const meta = $('register-meta');
  if (!tbody || !meta) return;

  if (!state.roster.length) {
    tbody.innerHTML = `<tr><td colspan="12">ยังไม่มี roster</td></tr>`;
    meta.textContent = 'ยังไม่มี roster';
    if ($('register-total-count')) $('register-total-count').textContent = '0';
    if ($('register-entered-count')) $('register-entered-count').textContent = '0';
    if ($('register-never-count')) $('register-never-count').textContent = '0';
    if ($('register-unfinished-count')) $('register-unfinished-count').textContent = '0';
    if ($('register-passed-count')) $('register-passed-count').textContent = '0';
    if ($('register-minfail-count')) $('register-minfail-count').textContent = '0';
    updateRegisterSortHeaderUI();
    return;
  }

  const rows = sortRegisterRows(buildRegisterRows());

  const total = rows.length;
  const entered = rows.filter(r => r.entered).length;
  const neverEntered = rows.filter(r => r.registerStatus === 'never_entered').length;
  const unfinished = rows.filter(r => r.registerStatus === 'unfinished').length;
  const passed = rows.filter(r => r.registerStatus === 'passed').length;
  const minFail = rows.filter(r => r.registerStatus === 'min_fail').length;

  if ($('register-total-count')) $('register-total-count').textContent = String(total);
  if ($('register-entered-count')) $('register-entered-count').textContent = String(entered);
  if ($('register-never-count')) $('register-never-count').textContent = String(neverEntered);
  if ($('register-unfinished-count')) $('register-unfinished-count').textContent = String(unfinished);
  if ($('register-passed-count')) $('register-passed-count').textContent = String(passed);
  if ($('register-minfail-count')) $('register-minfail-count').textContent = String(minFail);

  const sec = normalizeText(state.filters.section) || 'all sections';
  meta.textContent = `${total} students in register • ${sec}`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12">ไม่พบข้อมูล</td></tr>`;
    updateRegisterSortHeaderUI();
    return;
  }

  tbody.innerHTML = rows.map(r => {
    let rowClass = '';
    if (r.registerStatus === 'never_entered') rowClass = 'register-row-never';
    else if (r.registerStatus === 'unfinished') rowClass = 'register-row-unfinished';
    else if (r.registerStatus === 'min_fail') rowClass = 'register-row-minfail';
    else if (r.registerStatus === 'passed') rowClass = 'register-row-passed';

    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(safe(r.studentId))}</td>
        <td>${escapeHtml(safe(r.studentName))}</td>
        <td>${escapeHtml(safe(r.classSection))}</td>
        <td class="${r.entered ? 'yes' : 'no'}">${r.entered ? 'YES' : 'NO'}</td>
        <td><span class="tag ${tagClass(r.registerStatus)}">${escapeHtml(r.registerStatus)}</span></td>
        <td>${escapeHtml(safe(r.sessionNo))}</td>
        <td>${escapeHtml(fmtSec(r.durationSec || 0))}</td>
        <td>${escapeHtml(fmtSec(r.activeTimeSec || 0))}</td>
        <td>${escapeHtml(String(r.score ?? 0))}</td>
        <td class="${r.completed ? 'yes' : 'no'}">${r.completed ? 'YES' : 'NO'}</td>
        <td class="${r.minTimeMet ? 'yes' : 'no'}">${r.minTimeMet ? 'YES' : 'NO'}</td>
        <td>${escapeHtml(fmtDate(r.lastServerTs))}</td>
      </tr>
    `;
  }).join('');

  updateRegisterSortHeaderUI();
}

function exportRegisterCSV() {
  const rows = buildRegisterRows();
  if (!rows.length) {
    alert('ไม่มี register สำหรับ export');
    return;
  }

  const headers = [
    'studentId',
    'studentName',
    'classSection',
    'entered',
    'registerStatus',
    'sessionNo',
    'durationSec',
    'activeTimeSec',
    'score',
    'completed',
    'minTimeMet',
    'lastServerTs'
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
  const sec = normalizeText(state.filters.section) || 'all-sections';
  a.href = url;
  a.download = `techpath-register-${sec}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printRegisterView() {
  const rows = buildRegisterRows();
  if (!rows.length) {
    alert('ไม่มี register สำหรับพิมพ์');
    return;
  }

  const sec = normalizeText(state.filters.section) || 'All Sections';
  const stamp = new Date().toLocaleString('th-TH');

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>TechPath Attendance Register</title>
<style>
  body{font-family:Arial,sans-serif;padding:24px;color:#111;}
  h1{margin:0 0 6px 0;font-size:22px;}
  .meta{margin-bottom:16px;color:#444;font-size:13px;line-height:1.5;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top;}
  th{background:#f2f2f2;}
</style>
</head>
<body>
  <h1>TechPath Attendance Register</h1>
  <div class="meta">Section: ${escapeHtml(sec)} • Printed: ${escapeHtml(stamp)}</div>
  <table>
    <thead>
      <tr>
        <th>Student ID</th>
        <th>Name</th>
        <th>Section</th>
        <th>Entered</th>
        <th>Status</th>
        <th>S</th>
        <th>Duration</th>
        <th>Active</th>
        <th>Score</th>
        <th>Completed</th>
        <th>Min Time</th>
        <th>Last Server</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(safe(r.studentId))}</td>
          <td>${escapeHtml(safe(r.studentName))}</td>
          <td>${escapeHtml(safe(r.classSection))}</td>
          <td>${r.entered ? 'YES' : 'NO'}</td>
          <td>${escapeHtml(r.registerStatus)}</td>
          <td>${escapeHtml(safe(r.sessionNo))}</td>
          <td>${escapeHtml(fmtSec(r.durationSec || 0))}</td>
          <td>${escapeHtml(fmtSec(r.activeTimeSec || 0))}</td>
          <td>${escapeHtml(String(r.score ?? 0))}</td>
          <td>${r.completed ? 'YES' : 'NO'}</td>
          <td>${r.minTimeMet ? 'YES' : 'NO'}</td>
          <td>${escapeHtml(fmtDate(r.lastServerTs))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) {
    alert('เบราว์เซอร์บล็อกหน้าพิมพ์');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function summarizeRegisterRows(rows) {
  return {
    total: rows.length,
    entered: rows.filter(r => r.entered).length,
    neverEntered: rows.filter(r => r.registerStatus === 'never_entered').length,
    unfinished: rows.filter(r => r.registerStatus === 'unfinished').length,
    passed: rows.filter(r => r.registerStatus === 'passed').length,
    minFail: rows.filter(r => r.registerStatus === 'min_fail').length
  };
}

function buildSectionRegisterBundles(rows) {
  const map = new Map();

  rows.forEach(r => {
    const section = normalizeText(r.classSection) || '-';
    if (!map.has(section)) map.set(section, []);
    map.get(section).push(r);
  });

  return [...map.entries()]
    .map(([section, list]) => ({
      section,
      rows: list,
      summary: summarizeRegisterRows(list)
    }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

function renderPrintableSectionReportHTML(bundles, overall, options = {}) {
  const printedAt = new Date().toLocaleString('th-TH');
  const title = options.title || 'TechPath Attendance Section Report';
  const meta = state.adminMeta || defaultAdminMeta();

  const logoHtml = meta.logoUrl
    ? `<img src="${escapeHtml(meta.logoUrl)}" alt="logo" style="max-height:64px;max-width:180px;object-fit:contain;">`
    : '';

  return `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  *{ box-sizing:border-box; }
  body{
    margin:0;
    font-family: Arial, Helvetica, sans-serif;
    color:#111;
    background:#fff;
  }
  .page{
    page-break-after: always;
    min-height: calc(297mm - 24mm);
  }
  .page:last-child{
    page-break-after: auto;
  }
  h1,h2,h3{ margin:0; }
  .cover{
    padding:4mm 0;
  }
  .cover-top{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:16px;
    margin-bottom:10px;
  }
  .cover h1{
    font-size:24px;
    margin-bottom:8px;
  }
  .sub{
    color:#444;
    font-size:13px;
    margin-bottom:6px;
  }
  .meta{
    font-size:12px;
    color:#444;
    margin-bottom:12px;
    line-height:1.5;
  }
  .stats{
    display:grid;
    grid-template-columns: repeat(6, 1fr);
    gap:8px;
    margin-bottom:14px;
  }
  .stat{
    border:1px solid #bbb;
    border-radius:10px;
    padding:8px;
  }
  .stat .k{
    font-size:11px;
    color:#555;
    margin-bottom:4px;
  }
  .stat .v{
    font-size:18px;
    font-weight:700;
  }
  table{
    width:100%;
    border-collapse:collapse;
  }
  th, td{
    border:1px solid #999;
    padding:6px 7px;
    text-align:left;
    vertical-align:top;
    font-size:11px;
  }
  th{
    background:#f1f1f1;
  }
  .summary-table{
    margin-top:10px;
  }
  .section-head{
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    gap:12px;
    margin-bottom:10px;
  }
  .section-head .left h2{
    font-size:20px;
    margin-bottom:4px;
  }
  .section-head .left .meta{
    margin:0;
  }
  .signatures{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:18px;
    margin-top:18px;
  }
  .sig-box{
    padding-top:22px;
    border-top:1px solid #444;
    text-align:center;
    font-size:12px;
  }
  .note{
    margin-top:10px;
    font-size:11px;
    color:#555;
  }
</style>
</head>
<body>
  <section class="page cover">
    <div class="cover-top">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <div class="sub">${escapeHtml(meta.institution || 'Institution')}</div>
        <div class="sub">${escapeHtml(meta.course || 'Course / Subject')}</div>
      </div>
      <div>${logoHtml}</div>
    </div>

    <div class="meta">
      Semester: ${escapeHtml(meta.semester || '-')}<br>
      Academic Year: ${escapeHtml(meta.academicYear || '-')}<br>
      Instructor: ${escapeHtml(meta.instructor || '-')}<br>
      Printed at: ${escapeHtml(printedAt)}
    </div>

    <div class="stats">
      <div class="stat"><div class="k">Roster Total</div><div class="v">${overall.total}</div></div>
      <div class="stat"><div class="k">Entered</div><div class="v">${overall.entered}</div></div>
      <div class="stat"><div class="k">Never Entered</div><div class="v">${overall.neverEntered}</div></div>
      <div class="stat"><div class="k">Unfinished</div><div class="v">${overall.unfinished}</div></div>
      <div class="stat"><div class="k">Passed</div><div class="v">${overall.passed}</div></div>
      <div class="stat"><div class="k">Min Fail</div><div class="v">${overall.minFail}</div></div>
    </div>

    <table class="summary-table">
      <thead>
        <tr>
          <th>Section</th>
          <th>Total</th>
          <th>Entered</th>
          <th>Never Entered</th>
          <th>Unfinished</th>
          <th>Passed</th>
          <th>Min Fail</th>
        </tr>
      </thead>
      <tbody>
        ${bundles.map(b => `
          <tr>
            <td>${escapeHtml(b.section)}</td>
            <td>${b.summary.total}</td>
            <td>${b.summary.entered}</td>
            <td>${b.summary.neverEntered}</td>
            <td>${b.summary.unfinished}</td>
            <td>${b.summary.passed}</td>
            <td>${b.summary.minFail}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="note">รายงานนี้สร้างจาก roster ที่ครูโหลดเข้าในระบบ เทียบกับ attendance logs ปัจจุบัน</div>
  </section>

  ${bundles.map(b => `
    <section class="page">
      <div class="section-head">
        <div class="left">
          <h2>Section: ${escapeHtml(b.section)}</h2>
          <div class="meta">
            ${escapeHtml(meta.institution || '-')} • ${escapeHtml(meta.course || '-')}<br>
            Semester ${escapeHtml(meta.semester || '-')} • Academic Year ${escapeHtml(meta.academicYear || '-')}<br>
            Instructor: ${escapeHtml(meta.instructor || '-')}
          </div>
        </div>
        <div class="meta">Printed at: ${escapeHtml(printedAt)}</div>
      </div>

      <div class="stats">
        <div class="stat"><div class="k">Total</div><div class="v">${b.summary.total}</div></div>
        <div class="stat"><div class="k">Entered</div><div class="v">${b.summary.entered}</div></div>
        <div class="stat"><div class="k">Never Entered</div><div class="v">${b.summary.neverEntered}</div></div>
        <div class="stat"><div class="k">Unfinished</div><div class="v">${b.summary.unfinished}</div></div>
        <div class="stat"><div class="k">Passed</div><div class="v">${b.summary.passed}</div></div>
        <div class="stat"><div class="k">Min Fail</div><div class="v">${b.summary.minFail}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Name</th>
            <th>Entered</th>
            <th>Status</th>
            <th>S</th>
            <th>Duration</th>
            <th>Active</th>
            <th>Score</th>
            <th>Completed</th>
            <th>Min Time</th>
            <th>Last Server</th>
          </tr>
        </thead>
        <tbody>
          ${b.rows.map(r => `
            <tr>
              <td>${escapeHtml(safe(r.studentId))}</td>
              <td>${escapeHtml(safe(r.studentName))}</td>
              <td>${r.entered ? 'YES' : 'NO'}</td>
              <td>${escapeHtml(r.registerStatus)}</td>
              <td>${escapeHtml(safe(r.sessionNo))}</td>
              <td>${escapeHtml(fmtSec(r.durationSec || 0))}</td>
              <td>${escapeHtml(fmtSec(r.activeTimeSec || 0))}</td>
              <td>${escapeHtml(String(r.score ?? 0))}</td>
              <td>${r.completed ? 'YES' : 'NO'}</td>
              <td>${r.minTimeMet ? 'YES' : 'NO'}</td>
              <td>${escapeHtml(fmtDate(r.lastServerTs))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">ผู้สอน / Instructor Signature</div>
        <div class="sig-box">ผู้ตรวจสอบ / Verified By</div>
        <div class="sig-box">วันที่ / Date</div>
      </div>
    </section>
  `).join('')}
</body>
</html>
  `;
}

function openPrintWindowWithHTML(html) {
  const win = window.open('', '_blank', 'width=1200,height=900');
  if (!win) {
    alert('เบราว์เซอร์บล็อกหน้าพิมพ์');
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function printSectionReport(mode = 'current') {
  const rows = mode === 'all'
    ? buildRegisterRows({ ignoreSection: true, ignoreSearch: true })
    : buildRegisterRows();

  if (!rows.length) {
    alert('ไม่มี section report สำหรับพิมพ์');
    return;
  }

  const bundles = buildSectionRegisterBundles(rows);
  const overall = summarizeRegisterRows(rows);

  const html = renderPrintableSectionReportHTML(
    bundles,
    overall,
    {
      title: mode === 'all'
        ? 'TechPath Attendance Report - All Sections'
        : 'TechPath Attendance Report - Current View'
    }
  );

  openPrintWindowWithHTML(html);
}

function bindRegisterButtons() {
  $('btn-export-register')?.addEventListener('click', exportRegisterCSV);
  $('btn-print-register')?.addEventListener('click', printRegisterView);
  $('btn-print-section-report')?.addEventListener('click', () => printSectionReport('current'));
  $('btn-print-all-reports')?.addEventListener('click', () => printSectionReport('all'));
}

function bindFilterEvents() {
  $('filter-search')?.addEventListener('input', e => {
    state.filters.search = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('filter-section')?.addEventListener('change', e => {
    state.filters.section = e.target.value || '';
    renderSectionChips();
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('filter-status')?.addEventListener('change', e => {
    state.filters.status = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('filter-session')?.addEventListener('change', e => {
    state.filters.session = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('filter-minTime')?.addEventListener('change', e => {
    state.filters.minTime = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderSectionSessionMatrix();
    renderGroupBoards();
    renderRegisterMode();
  });

  $('btn-refresh')?.addEventListener('click', () => {
    loadDashboard(true);
  });

  $('btn-auto')?.addEventListener('click', () => {
    state.autoRefresh = !state.autoRefresh;
    $('btn-auto').textContent = `Auto refresh: ${state.autoRefresh ? 'ON' : 'OFF'}`;
    setupAutoRefresh();
  });

  $('btn-export')?.addEventListener('click', exportCurrentCSV);

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
      renderGroupBoards();
      renderRegisterMode();
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

function bindV5GroupButtons() {
  $('btn-export-unfinished')?.addEventListener('click', () => {
    const groups = buildGroupBuckets(state.filteredRows);
    exportRowsAsCSV(groups.unfinished, 'techpath-unfinished');
  });

  $('btn-export-passed')?.addEventListener('click', () => {
    const groups = buildGroupBuckets(state.filteredRows);
    exportRowsAsCSV(groups.passed, 'techpath-passed');
  });

  $('btn-export-minfail')?.addEventListener('click', () => {
    const groups = buildGroupBuckets(state.filteredRows);
    exportRowsAsCSV(groups.minFail, 'techpath-minfail');
  });

  $('btn-export-never')?.addEventListener('click', () => {
    const groups = buildGroupBuckets(state.filteredRows);
    exportRosterRowsAsCSV(groups.neverEntered, 'techpath-never-entered');
  });
}

function renderDetailLoading() {
  const el = $('detail-body');
  if (el) {
    el.innerHTML = `<div class="detail-empty">กำลังโหลดรายละเอียด...</div>`;
  }
}

function renderDetail(detail) {
  const root = $('detail-body');
  if (!root) return;

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
    const body = $('detail-body');
    if (body) {
      body.innerHTML = `<div class="detail-empty">โหลดรายละเอียดไม่สำเร็จ: ${escapeHtml(err.message || err)}</div>`;
    }
  }
}

async function loadDashboard(keepDetail = false) {
  try {
    const meta = $('table-meta');
    if (meta) meta.textContent = 'กำลังโหลดข้อมูล...';

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
    renderGroupBoards();
    renderRegisterMode();

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
    if ($('students-tbody')) $('students-tbody').innerHTML = `<tr><td colspan="11">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message || err)}</td></tr>`;
    if ($('section-summary-tbody')) $('section-summary-tbody').innerHTML = `<tr><td colspan="7">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    if ($('risk-tbody')) $('risk-tbody').innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    if ($('section-session-matrix-tbody')) $('section-session-matrix-tbody').innerHTML = `<tr><td colspan="19">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    if ($('table-meta')) $('table-meta').textContent = 'error';
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
  if ($('endpoint-pill')) $('endpoint-pill').textContent = `Endpoint: ${ENDPOINT ? 'connected' : 'missing'}`;
  if ($('footer-note')) $('footer-note').textContent = `Build: ${BUILD}`;
  if ($('btn-auto')) $('btn-auto').textContent = `Auto refresh: ${state.autoRefresh ? 'ON' : 'OFF'}`;
}

async function init() {
  initStaticUI();
  state.roster = loadRosterFromLocal();
  state.adminMeta = loadAdminMetaFromLocal();
  renderAdminMetaInputs();
  renderRosterMeta();
  bindFilterEvents();
  bindV4ActionButtons();
  bindV5GroupButtons();
  bindRosterButtons();
  bindRegisterButtons();
  bindRegisterSortHeaders();
  bindAdminMetaButtons();
  setupMobileFilterToggle();
  setupAutoRefresh();
  await loadDashboard(false);
}

init();
