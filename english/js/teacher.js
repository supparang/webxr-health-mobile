const ENDPOINT =
  window.TECHPATH_ATTENDANCE_ENDPOINT ||
  'https://script.google.com/macros/s/AKfycbzMOBCDTaE6eH8iFeS3Jcv_LqFfLcOBIxk3nG-sDNKWTHeYuxaVtv9JQ3JoR48KUgBd/exec';

const BUILD = window.TEACHER_BUILD || 'teacher-rtdb-studentid-r1';
const APP_ID = window.TECHPATH_APP_ID || 'english-d4bfa';

const state = {
  rows: [],
  filteredRows: [],
  summary: null,
  roster: [],
  leaderboardRows: [],
  legacyUidRows: [],
  firebase: {
    app: null,
    db: null,
    auth: null,
    ready: false
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

const ROSTER_STORAGE_KEY = 'TECHPATH_TEACHER_ROSTER_V2';

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

function safe(v, fallback = '-') {
  return String(v ?? '').trim() || fallback;
}

function normalizeText(v) {
  return String(v ?? '').trim();
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
  if (s === 'failed') return 'failed';
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

function sessionOrderList() {
  return ['S00', ...Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`)];
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

function renderSummaryCards(summary) {
  const root = $('summary-cards');
  if (!root) return;

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
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    items.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (items.includes(current)) el.value = current;
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
      state.selectedRow = state.filteredRows[idx];
      renderSelectedStudent();
    });
  });
}

function renderSelectedStudent() {
  const root = $('student-detail');
  if (!root) return;

  const r = state.selectedRow;
  if (!r) {
    root.innerHTML = `<div class="empty">เลือกนักศึกษาเพื่อดูรายละเอียด</div>`;
    return;
  }

  root.innerHTML = `
    <div class="detail-grid">
      <div><strong>Student ID</strong><br>${escapeHtml(safe(r.studentId))}</div>
      <div><strong>Name</strong><br>${escapeHtml(safe(r.studentName))}</div>
      <div><strong>Section</strong><br>${escapeHtml(safe(r.classSection))}</div>
      <div><strong>Session</strong><br>${escapeHtml(safe(r.sessionNo))}</div>
      <div><strong>Status</strong><br>${escapeHtml(safe(r.attendanceStatus))}</div>
      <div><strong>Score</strong><br>${escapeHtml(String(r.score ?? 0))}</div>
      <div><strong>Duration</strong><br>${escapeHtml(fmtSec(r.durationSec || 0))}</div>
      <div><strong>Active Time</strong><br>${escapeHtml(fmtSec(r.activeTimeSec || 0))}</div>
      <div><strong>Entered</strong><br>${escapeHtml(fmtDate(r.enteredAt))}</div>
      <div><strong>Started</strong><br>${escapeHtml(fmtDate(r.startedAt))}</div>
      <div><strong>Finished</strong><br>${escapeHtml(fmtDate(r.finishedAt))}</div>
      <div><strong>Last Active</strong><br>${escapeHtml(fmtDate(r.lastActiveAt))}</div>
    </div>
  `;
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

function parseCsvLine(line, delimiter = ',') {
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
  if (line.includes(';') && !line.includes(',')) return parseCsvLine(line, ';');
  return parseCsvLine(line, ',');
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

    rows.push({ studentId, studentName, classSection });
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

function renderRosterMeta() {
  const meta = $('roster-meta');
  if (!meta) return;

  const rosterRows = Array.isArray(state.roster) ? state.roster : [];
  const attendedKeys = new Set((state.rows || []).map(studentKeyFromAttendanceRow));

  const entered = rosterRows.filter(r => attendedKeys.has(studentKeyFromRosterRow(r))).length;
  const neverEntered = rosterRows.length - entered;

  meta.textContent = `Roster ${rosterRows.length} • Entered ${entered} • Never Entered ${neverEntered}`;
}

function renderRegisterMode() {
  const tbody = $('register-tbody');
  const meta = $('register-meta');
  if (!tbody || !meta) return;

  const rosterRows = Array.isArray(state.roster) ? state.roster : [];
  if (!rosterRows.length) {
    tbody.innerHTML = `<tr><td colspan="7">ยังไม่มี roster</td></tr>`;
    meta.textContent = '0 rows';
    return;
  }

  const attendanceMap = new Map();
  state.rows.forEach(r => {
    attendanceMap.set(studentKeyFromAttendanceRow(r), r);
  });

  const merged = rosterRows.map(r => {
    const found = attendanceMap.get(studentKeyFromRosterRow(r));
    return {
      studentId: r.studentId,
      studentName: r.studentName,
      classSection: r.classSection,
      entered: !!found,
      sessionNo: found?.sessionNo || '-',
      attendanceStatus: found?.attendanceStatus || 'never_entered',
      durationSec: found?.durationSec || 0,
      minTimeMet: !!found?.minTimeMet
    };
  });

  meta.textContent = `${merged.length} rows`;

  tbody.innerHTML = merged.map(r => `
    <tr>
      <td>${escapeHtml(safe(r.studentId))}</td>
      <td>${escapeHtml(safe(r.studentName))}</td>
      <td>${escapeHtml(safe(r.classSection))}</td>
      <td class="${r.entered ? 'yes' : 'no'}">${r.entered ? 'YES' : 'NO'}</td>
      <td>${escapeHtml(safe(r.sessionNo))}</td>
      <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(safe(r.attendanceStatus))}</span></td>
      <td>${escapeHtml(fmtSec(r.durationSec || 0))}</td>
    </tr>
  `).join('');
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
  exportRowsAsCSV(state.filteredRows || [], 'techpath-attendance');
}

async function initFirebaseForTeacher() {
  if (!window.firebase) return null;

  const cfg =
    window.TECHPATH_FIREBASE_CONFIG ||
    window.HHA_FIREBASE_CONFIG ||
    window.FIREBASE_CONFIG ||
    null;

  if (!cfg) return null;

  let app = null;
  try {
    app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(cfg);
  } catch (_) {
    app = firebase.app();
  }

  const auth = firebase.auth(app);
  const db = firebase.database(app);

  try {
    await auth.signInAnonymously();
  } catch (e) {
    console.warn('Teacher anonymous sign-in failed:', e);
  }

  state.firebase = {
    app,
    db,
    auth,
    ready: true
  };

  return state.firebase;
}

function leaderboardByStudentPath() {
  return `artifacts/${APP_ID}/public/data/vr_leaderboards_by_student`;
}

function leaderboardLegacyUidPath() {
  return `artifacts/${APP_ID}/public/data/vr_leaderboards`;
}

function leaderboardArchiveRootPath() {
  return `artifacts/${APP_ID}/public/data/vr_leaderboard_archives`;
}

async function loadLeaderboardFromRTDB() {
  const wrap = $('leaderboard-admin-list');
  const meta = $('leaderboard-admin-meta');
  if (!state.firebase.ready || !state.firebase.db) {
    if (wrap) wrap.innerHTML = `<div class="empty">Firebase not ready</div>`;
    if (meta) meta.textContent = 'offline';
    return;
  }

  const snap = await state.firebase.db.ref(leaderboardByStudentPath()).get();
  const rows = snap.exists() ? Object.values(snap.val() || {}) : [];

  rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  state.leaderboardRows = rows;

  if (meta) meta.textContent = `${rows.length} rows`;

  if (!wrap) return;
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty">ยังไม่มี leaderboard</div>`;
    return;
  }

  wrap.innerHTML = rows.map((r, i) => `
    <div class="leaderboard-row">
      <div class="rank">${i + 1}</div>
      <div class="who">
        <div><strong>${escapeHtml(safe(r.name))}</strong></div>
        <div class="sub">ID ${escapeHtml(safe(r.studentId))} • Sec ${escapeHtml(safe(r.section))}</div>
      </div>
      <div class="score">${escapeHtml(Number(r.score || 0))}</div>
    </div>
  `).join('');
}

async function loadLegacyUidAudit() {
  const wrap = $('legacy-leaderboard-audit');
  const meta = $('legacy-leaderboard-meta');
  if (!state.firebase.ready || !state.firebase.db) {
    if (wrap) wrap.innerHTML = `<div class="empty">Firebase not ready</div>`;
    if (meta) meta.textContent = 'offline';
    return;
  }

  const snap = await state.firebase.db.ref(leaderboardLegacyUidPath()).get();
  const val = snap.exists() ? (snap.val() || {}) : {};
  const rows = Object.entries(val).map(([uid, data]) => ({ uid, ...(data || {}) }));

  rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  state.legacyUidRows = rows;

  if (meta) meta.textContent = `${rows.length} legacy rows`;

  if (!wrap) return;
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty">ไม่มี legacy leaderboard</div>`;
    return;
  }

  wrap.innerHTML = rows.map(r => `
    <div class="leaderboard-row">
      <div class="rank">uid</div>
      <div class="who">
        <div><strong>${escapeHtml(safe(r.name))}</strong></div>
        <div class="sub">${escapeHtml(safe(r.uid))}</div>
      </div>
      <div class="score">${escapeHtml(Number(r.score || 0))}</div>
    </div>
  `).join('');
}

async function archiveAndClearLeaderboard() {
  if (!state.firebase.ready || !state.firebase.db) {
    alert('Firebase ยังไม่พร้อม');
    return;
  }

  const rowsSnap = await state.firebase.db.ref(leaderboardByStudentPath()).get();
  const rows = rowsSnap.exists() ? (rowsSnap.val() || {}) : {};
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');

  if (Object.keys(rows).length) {
    await state.firebase.db.ref(`${leaderboardArchiveRootPath()}/${stamp}`).set(rows);
  }

  await state.firebase.db.ref(leaderboardByStudentPath()).set(null);
  await loadLeaderboardFromRTDB();
}

async function clearLeaderboardNow() {
  if (!state.firebase.ready || !state.firebase.db) {
    alert('Firebase ยังไม่พร้อม');
    return;
  }

  await state.firebase.db.ref(leaderboardByStudentPath()).set(null);
  await loadLeaderboardFromRTDB();
}

async function migrateLegacyLeaderboardToStudentBoard() {
  if (!state.firebase.ready || !state.firebase.db) {
    alert('Firebase ยังไม่พร้อม');
    return;
  }

  const legacySnap = await state.firebase.db.ref(leaderboardLegacyUidPath()).get();
  const legacyVal = legacySnap.exists() ? (legacySnap.val() || {}) : {};

  if (!Object.keys(legacyVal).length) {
    alert('ไม่มี legacy leaderboard ให้ migrate');
    return;
  }

  const target = {};

  Object.entries(legacyVal).forEach(([uid, row]) => {
    const r = row || {};
    const studentId = normalizeText(r.studentId);
    if (!studentId) return;

    const prev = target[studentId];
    if (!prev || Number(r.score || 0) > Number(prev.score || 0)) {
      target[studentId] = {
        studentId,
        name: r.name || studentId,
        section: r.section || '',
        avatar: r.avatar || '🧑‍💻',
        score: Number(r.score || 0),
        timestamp: r.timestamp || Date.now(),
        updatedAt: Date.now(),
        lastUid: uid
      };
    }
  });

  await state.firebase.db.ref(leaderboardByStudentPath()).update(target);
  await loadLeaderboardFromRTDB();
  alert('migrate เสร็จแล้ว');
}

function bindLeaderboardButtons() {
  $('btn-refresh-leaderboard')?.addEventListener('click', async () => {
    await loadLeaderboardFromRTDB();
    await loadLegacyUidAudit();
  });

  $('btn-clear-leaderboard')?.addEventListener('click', async () => {
    const ok = confirm('ยืนยันลบ leaderboard ปัจจุบันทั้งหมด?');
    if (!ok) return;
    await clearLeaderboardNow();
  });

  $('btn-archive-clear-leaderboard')?.addEventListener('click', async () => {
    const ok = confirm('archive แล้วค่อย clear leaderboard ใช่ไหม?');
    if (!ok) return;
    await archiveAndClearLeaderboard();
  });

  $('btn-migrate-legacy-leaderboard')?.addEventListener('click', async () => {
    const ok = confirm('migrate legacy uid leaderboard -> studentId leaderboard ?');
    if (!ok) return;
    await migrateLegacyLeaderboardToStudentBoard();
  });
}

async function loadAttendanceDashboard() {
  const statusEl = $('endpoint-status');
  if (statusEl) statusEl.textContent = 'Loading...';

  const data = await fetchJSON({ action: 'dashboard' });

  state.rows = Array.isArray(data.rows) ? data.rows : [];
  state.summary = data.summary || null;

  const sections = [...new Set(state.rows.map(r => String(r.classSection || '').trim()).filter(Boolean))].sort();
  const statuses = [...new Set(state.rows.map(r => String(r.attendanceStatus || '').trim()).filter(Boolean))].sort();
  const sessions = [...new Set(state.rows.map(r => String(r.sessionNo || '').trim()).filter(Boolean))].sort();

  fillSelect('filter-section', sections, 'ทุก Section');
  fillSelect('filter-status', statuses, 'ทุกสถานะ');
  fillSelect('filter-session', sessions, 'ทุก S');

  renderSummaryCards(state.summary);
  applyFilters();
  renderTable();
  renderSelectedStudent();
  renderSectionSummary();
  renderSessionHeatmap();
  renderRiskTable();
  renderRosterMeta();
  renderRegisterMode();

  const quickText = $('quick-status-text');
  if (quickText && state.summary) {
    quickText.textContent =
      `completed ${state.summary.completed || 0} • in progress ${state.summary.inProgress || 0} • minTimeMet ${state.summary.minTimeMet || 0}`;
  }

  if (statusEl) statusEl.textContent = `Endpoint: connected • ${BUILD}`;
}

function bindFilters() {
  $('search-input')?.addEventListener('input', e => {
    state.filters.search = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderRegisterMode();
  });

  $('filter-section')?.addEventListener('change', e => {
    state.filters.section = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderRegisterMode();
  });

  $('filter-status')?.addEventListener('change', e => {
    state.filters.status = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderRegisterMode();
  });

  $('filter-session')?.addEventListener('change', e => {
    state.filters.session = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderRegisterMode();
  });

  $('filter-min-time')?.addEventListener('change', e => {
    state.filters.minTime = e.target.value || '';
    applyFilters();
    renderTable();
    renderSectionSummary();
    renderSessionHeatmap();
    renderRiskTable();
    renderRegisterMode();
  });

  document.querySelectorAll('.quick-chip[data-qf]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quickFilter = btn.dataset.qf || 'all';
      document.querySelectorAll('.quick-chip[data-qf]').forEach(x => {
        x.classList.toggle('active', x === btn);
      });
      applyFilters();
      renderTable();
      renderSectionSummary();
      renderSessionHeatmap();
      renderRiskTable();
      renderRegisterMode();
    });
  });

  $('btn-refresh')?.addEventListener('click', async () => {
    await loadAttendanceDashboard();
  });

  $('btn-export-csv')?.addEventListener('click', exportCurrentCSV);
}

function bindRosterUI() {
  $('btn-save-roster')?.addEventListener('click', () => {
    const text = $('roster-input')?.value || '';
    state.roster = parseRosterText(text);
    saveRosterToLocal();
    renderRosterMeta();
    renderRegisterMode();
    alert(`บันทึก roster แล้ว ${state.roster.length} รายการ`);
  });

  $('btn-clear-roster')?.addEventListener('click', () => {
    state.roster = [];
    try {
      localStorage.removeItem(ROSTER_STORAGE_KEY);
    } catch (_) {}
    if ($('roster-input')) $('roster-input').value = '';
    renderRosterMeta();
    renderRegisterMode();
  });

  $('btn-import-roster-file')?.addEventListener('click', () => {
    $('roster-file')?.click();
  });

  $('roster-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    if ($('roster-input')) $('roster-input').value = text;
    state.roster = parseRosterText(text);
    saveRosterToLocal();
    renderRosterMeta();
    renderRegisterMode();
  });
}

function setAutoRefresh(on) {
  state.autoRefresh = !!on;

  const btn = $('btn-auto-refresh');
  if (btn) {
    btn.textContent = `Auto refresh: ${on ? 'ON' : 'OFF'}`;
  }

  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }

  if (on) {
    state.autoTimer = setInterval(async () => {
      try {
        await loadAttendanceDashboard();
        await loadLeaderboardFromRTDB();
      } catch (e) {
        console.error('auto refresh failed', e);
      }
    }, 15000);
  }
}

function bindAutoRefreshButton() {
  $('btn-auto-refresh')?.addEventListener('click', () => {
    setAutoRefresh(!state.autoRefresh);
  });
}

async function initTeacher() {
  state.roster = loadRosterFromLocal();

  if ($('roster-input') && state.roster.length) {
    $('roster-input').value = state.roster
      .map(r => [r.studentId, r.studentName, r.classSection].join(','))
      .join('\n');
  }

  bindFilters();
  bindRosterUI();
  bindLeaderboardButtons();
  bindAutoRefreshButton();

  renderRosterMeta();
  renderRegisterMode();

  await loadAttendanceDashboard();
  await initFirebaseForTeacher();
  await loadLeaderboardFromRTDB();
  await loadLegacyUidAudit();

  setAutoRefresh(true);
}

window.addEventListener('DOMContentLoaded', () => {
  initTeacher().catch(err => {
    console.error(err);
    const statusEl = $('endpoint-status');
    if (statusEl) statusEl.textContent = `Error: ${err.message || err}`;
  });
});
