// === /herohealth/vr-hydration-v2/js/hydration.dashboard.js ===
// Hydration V2 Dashboard
// PATCH v20260317e-HYDRATION-V2-DASHBOARD-FILTER-EXPORT

const refs = {
  countHistory: document.getElementById('countHistory'),
  countFiltered: document.getElementById('countFiltered'),
  avgTotalScore: document.getElementById('avgTotalScore'),
  countPassed: document.getElementById('countPassed'),
  lastSessionWeek: document.getElementById('lastSessionWeek'),

  latestGrid: document.getElementById('latestGrid'),
  latestEmpty: document.getElementById('latestEmpty'),

  summaryGrid: document.getElementById('summaryGrid'),
  summaryEmpty: document.getElementById('summaryEmpty'),

  playerGrid: document.getElementById('playerGrid'),
  playerEmpty: document.getElementById('playerEmpty'),

  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),

  pidFilter: document.getElementById('pidFilter'),
  studyIdFilter: document.getElementById('studyIdFilter'),
  modeFilter: document.getElementById('modeFilter'),
  typeFilter: document.getElementById('typeFilter'),
  runFilter: document.getElementById('runFilter'),
  missionFilter: document.getElementById('missionFilter'),

  applyFilterBtn: document.getElementById('applyFilterBtn'),
  resetFilterBtn: document.getElementById('resetFilterBtn'),

  backLauncherBtn: document.getElementById('backLauncherBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  clearBtn: document.getElementById('clearBtn')
};

let dashboardState = {
  latest: null,
  summary: null,
  history: [],
  filtered: []
};

boot();

function boot() {
  bindUI();
  renderAll();
}

function bindUI() {
  refs.backLauncherBtn.addEventListener('click', () => {
    const qs = new URLSearchParams(window.location.search);
    const target = qs.get('launcher') || './hydration-v2.html';
    window.location.href = target;
  });

  refs.refreshBtn.addEventListener('click', renderAll);
  refs.applyFilterBtn.addEventListener('click', applyFiltersAndRender);
  refs.resetFilterBtn.addEventListener('click', resetFilters);

  refs.exportJsonBtn.addEventListener('click', exportJson);
  refs.exportCsvBtn.addEventListener('click', exportCsv);

  refs.clearBtn.addEventListener('click', () => {
    const ok = window.confirm('ต้องการล้าง localStorage ที่เกี่ยวกับ Hydration V2 ใช่หรือไม่');
    if (!ok) return;

    const keys = [
      'HHA_LAST_SUMMARY',
      'HHA_SUMMARY_HISTORY',
      'HHA_HYDRATION_V2_RESEARCH_LAST',
      'HHA_HYDRATION_V2_RESEARCH_HISTORY'
    ];

    try {
      keys.forEach(key => localStorage.removeItem(key));

      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('HHA_HYDRATION_V2_PROGRESS:')) {
          localStorage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn('[HydrationV2Dashboard] clear failed', err);
    }

    renderAll();
  });

  [
    refs.pidFilter,
    refs.studyIdFilter,
    refs.modeFilter,
    refs.typeFilter,
    refs.runFilter,
    refs.missionFilter
  ].forEach(el => {
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') applyFiltersAndRender();
    });
  });
}

function renderAll() {
  dashboardState.latest = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
  dashboardState.summary = readJson('HHA_LAST_SUMMARY', null);
  dashboardState.history = readJson('HHA_HYDRATION_V2_RESEARCH_HISTORY', []);

  if (!Array.isArray(dashboardState.history)) {
    dashboardState.history = [];
  }

  dashboardState.filtered = applyFilters(dashboardState.history);

  renderStats(dashboardState.latest, dashboardState.history, dashboardState.filtered);
  renderLatest(dashboardState.latest);
  renderSummary(dashboardState.summary);
  renderPlayerCards(dashboardState.filtered);
  renderHistory(dashboardState.filtered);
}

function applyFiltersAndRender() {
  dashboardState.filtered = applyFilters(dashboardState.history);
  renderStats(dashboardState.latest, dashboardState.history, dashboardState.filtered);
  renderPlayerCards(dashboardState.filtered);
  renderHistory(dashboardState.filtered);
}

function resetFilters() {
  refs.pidFilter.value = '';
  refs.studyIdFilter.value = '';
  refs.modeFilter.value = '';
  refs.typeFilter.value = '';
  refs.runFilter.value = '';
  refs.missionFilter.value = '';
  applyFiltersAndRender();
}

function applyFilters(history) {
  const pid = refs.pidFilter.value.trim().toLowerCase();
  const studyId = refs.studyIdFilter.value.trim().toLowerCase();
  const mode = refs.modeFilter.value.trim();
  const type = refs.typeFilter.value.trim();
  const run = refs.runFilter.value.trim();
  const mission = refs.missionFilter.value.trim();

  return history.filter(item => {
    if (pid && !String(item.pid || '').toLowerCase().includes(pid)) return false;
    if (studyId && !String(item.studyId || '').toLowerCase().includes(studyId)) return false;
    if (mode && String(item.mode || '') !== mode) return false;
    if (type && String(item.type || '') !== type) return false;
    if (run && String(item.run || '') !== run) return false;

    if (mission === 'passed' && !item.teamMissionDone) return false;
    if (mission === 'failed' && item.teamMissionDone) return false;

    return true;
  });
}

function renderStats(latest, history, filtered) {
  refs.countHistory.textContent = String(Array.isArray(history) ? history.length : 0);
  refs.countFiltered.textContent = String(Array.isArray(filtered) ? filtered.length : 0);

  const avg = filtered.length
    ? filtered.reduce((sum, item) => sum + Number(item.totalScore || 0), 0) / filtered.length
    : 0;

  const passed = filtered.filter(item => !!item.teamMissionDone).length;

  refs.avgTotalScore.textContent = formatNumber(avg);
  refs.countPassed.textContent = String(passed);
  refs.lastSessionWeek.textContent = latest
    ? `W${latest.weekNo ?? '-'} S${latest.sessionNo ?? '-'}`
    : '-';
}

function renderLatest(latest) {
  refs.latestGrid.innerHTML = '';

  if (!latest) {
    refs.latestEmpty.style.display = '';
    return;
  }

  refs.latestEmpty.style.display = 'none';

  const items = [
    ['Saved At', formatDate(latest.savedAt)],
    ['PID', latest.pid || '(empty)'],
    ['Study ID', latest.studyId || '(empty)'],
    ['Mode / Type / Run', `${latest.mode} / ${latest.type} / ${latest.run}`],
    ['Session / Week', `W${latest.weekNo ?? '-'} • S${latest.sessionNo ?? '-'}`],
    ['Seed', latest.seed ?? '-'],
    ['Action Score', latest.actionScore ?? 0],
    ['Knowledge Score', latest.knowledgeScore ?? 0],
    ['Planning Score', latest.planningScore ?? 0],
    ['Social Score', latest.socialScore ?? 0],
    ['Total Score', latest.totalScore ?? 0],
    ['Good / Bad / Missed', `${latest.goodCatch ?? 0} / ${latest.badCatch ?? 0} / ${latest.missedGood ?? 0}`],
    ['Scenario Summary', latest.scenarioSummary || '-'],
    ['Evaluate', `${latest.evaluateChoice || '-'} • ${latest.evaluateCorrect ? 'correct' : 'not-correct'}`],
    ['Created Plan Score', latest.createdPlanScore ?? 0],
    ['Team', `${latest.classTankContribution ?? 0}% • ${latest.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน'}`],
    ['Social Summary', latest.socialSummary || '-'],
    ['Rewards', Array.isArray(latest.rewardHistory) ? latest.rewardHistory.join(', ') || '-' : '-']
  ];

  items.forEach(([label, value]) => {
    refs.latestGrid.appendChild(makeInfoBox(label, value));
  });
}

function renderSummary(summary) {
  refs.summaryGrid.innerHTML = '';

  if (!summary) {
    refs.summaryEmpty.style.display = '';
    return;
  }

  refs.summaryEmpty.style.display = 'none';

  const items = [
    ['Saved At', formatDate(summary.savedAt)],
    ['Reason', summary.reason || '-'],
    ['Mode / Type / Run', `${summary.mode} / ${summary.type} / ${summary.run}`],
    ['Session / Week', `W${summary.weekNo ?? '-'} • S${summary.sessionNo ?? '-'}`],
    ['Total Score', summary.totalScore ?? 0],
    ['Action / Knowledge / Planning / Social', `${summary.actionScore ?? 0} / ${summary.knowledgeScore ?? 0} / ${summary.planningScore ?? 0} / ${summary.socialScore ?? 0}`],
    ['Evaluate', `${summary.evaluateChoice || '-'} • ${summary.evaluateCorrect ? 'correct' : 'not-correct'}`],
    ['Created Plan Score', summary.createdPlanScore ?? 0],
    ['Team Stars', summary.teamStars ?? 0],
    ['Social Mission', summary.socialMissionLabel || '-'],
    ['Next Session / Week', `W${summary.nextWeekNo ?? '-'} • S${summary.nextSessionNo ?? '-'}`]
  ];

  items.forEach(([label, value]) => {
    refs.summaryGrid.appendChild(makeInfoBox(label, value));
  });
}

function renderPlayerCards(filtered) {
  refs.playerGrid.innerHTML = '';

  const latestByPid = new Map();

  filtered.forEach(item => {
    const pid = String(item.pid || 'anon');
    if (!latestByPid.has(pid)) {
      latestByPid.set(pid, item);
      return;
    }

    const current = latestByPid.get(pid);
    const currentDate = new Date(current.savedAt || 0).getTime();
    const itemDate = new Date(item.savedAt || 0).getTime();

    if (itemDate > currentDate) {
      latestByPid.set(pid, item);
    }
  });

  const cards = [...latestByPid.values()]
    .sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())
    .slice(0, 12);

  if (!cards.length) {
    refs.playerEmpty.style.display = '';
    return;
  }

  refs.playerEmpty.style.display = 'none';

  cards.forEach(item => {
    const el = document.createElement('article');
    el.className = 'player-card';
    el.innerHTML = `
      <div class="player-top">
        <div class="player-name">${escapeHtml(item.pid || 'anon')}</div>
        <div class="player-badge">W${escapeHtml(item.weekNo ?? '-')} • S${escapeHtml(item.sessionNo ?? '-')}</div>
      </div>
      <div class="player-meta">
        Study: <strong>${escapeHtml(item.studyId || '(empty)')}</strong><br/>
        ${escapeHtml(item.mode || '-')} / ${escapeHtml(item.type || '-')} / ${escapeHtml(item.run || '-')}<br/>
        total=${escapeHtml(item.totalScore ?? 0)} • social=${escapeHtml(item.socialScore ?? 0)}<br/>
        team=${item.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน'} • stars=${escapeHtml(item.teamStars ?? 0)}<br/>
        ${escapeHtml(item.socialSummary || '-')}
      </div>
    `;
    refs.playerGrid.appendChild(el);
  });
}

function renderHistory(filtered) {
  refs.historyList.innerHTML = '';

  if (!Array.isArray(filtered) || filtered.length === 0) {
    refs.historyEmpty.style.display = '';
    return;
  }

  refs.historyEmpty.style.display = 'none';

  filtered
    .slice(0, 30)
    .forEach((item, index) => {
      const el = document.createElement('article');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-top">
          <div class="history-title">#${index + 1} • ${escapeHtml(item.pid || 'anon')} • W${escapeHtml(item.weekNo ?? '-')} S${escapeHtml(item.sessionNo ?? '-')}</div>
          <div class="history-meta">${escapeHtml(formatDate(item.savedAt))}</div>
        </div>
        <div class="history-body">
          <strong>${escapeHtml(item.mode || '-')}</strong> /
          <strong>${escapeHtml(item.type || '-')}</strong> /
          <strong>${escapeHtml(item.run || '-')}</strong><br/>
          total=${escapeHtml(item.totalScore ?? 0)} •
          action=${escapeHtml(item.actionScore ?? 0)} •
          knowledge=${escapeHtml(item.knowledgeScore ?? 0)} •
          planning=${escapeHtml(item.planningScore ?? 0)} •
          social=${escapeHtml(item.socialScore ?? 0)}<br/>
          good=${escapeHtml(item.goodCatch ?? 0)} • bad=${escapeHtml(item.badCatch ?? 0)} • missed=${escapeHtml(item.missedGood ?? 0)}<br/>
          team=${item.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน'} • contribution=${escapeHtml(item.classTankContribution ?? 0)}%<br/>
          ${escapeHtml(item.socialSummary || '-')}
        </div>
      `;
      refs.historyList.appendChild(el);
    });
}

function exportJson() {
  const data = dashboardState.filtered || [];
  const filename = `hydration-v2-filtered-${timestampForFile()}.json`;
  downloadTextFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

function exportCsv() {
  const data = dashboardState.filtered || [];
  const columns = [
    'savedAt',
    'pid',
    'studyId',
    'mode',
    'type',
    'run',
    'weekNo',
    'sessionNo',
    'seed',
    'actionScore',
    'knowledgeScore',
    'planningScore',
    'socialScore',
    'totalScore',
    'goodCatch',
    'badCatch',
    'missedGood',
    'bestCombo',
    'rewardCount',
    'correctChoices',
    'wrongChoices',
    'evaluateChoice',
    'evaluateCorrect',
    'createdPlanScore',
    'classTankContribution',
    'teamMissionDone',
    'teamStars',
    'socialSummary'
  ];

  const rows = [
    columns.join(','),
    ...data.map(item =>
      columns.map(col => csvCell(item[col])).join(',')
    )
  ];

  const filename = `hydration-v2-filtered-${timestampForFile()}.csv`;
  downloadTextFile(rows.join('\n'), filename, 'text/csv;charset=utf-8;');
}

function downloadTextFile(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function makeInfoBox(label, value) {
  const el = document.createElement('div');
  el.className = 'info-box';
  el.innerHTML = `
    <div class="info-label">${escapeHtml(label)}</div>
    <div class="info-value">${escapeHtml(String(value ?? '-'))}</div>
  `;
  return el;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
}

function timestampForFile() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}