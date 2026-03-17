// === /herohealth/vr-hydration-v2/js/hydration.dashboard.js ===
// Hydration V2 Dashboard
// PATCH v20260317h-HYDRATION-V2-DASHBOARD-REPORTING

const refs = {
  countHistory: document.getElementById('countHistory'),
  countFiltered: document.getElementById('countFiltered'),
  avgTotalScore: document.getElementById('avgTotalScore'),
  avgPlanningScore: document.getElementById('avgPlanningScore'),
  countPassed: document.getElementById('countPassed'),
  lastSessionWeek: document.getElementById('lastSessionWeek'),

  latestGrid: document.getElementById('latestGrid'),
  latestEmpty: document.getElementById('latestEmpty'),

  summaryGrid: document.getElementById('summaryGrid'),
  summaryEmpty: document.getElementById('summaryEmpty'),

  studySummaryGrid: document.getElementById('studySummaryGrid'),
  studySummaryEmpty: document.getElementById('studySummaryEmpty'),

  cohortGrid: document.getElementById('cohortGrid'),
  cohortEmpty: document.getElementById('cohortEmpty'),

  alertList: document.getElementById('alertList'),
  alertEmpty: document.getElementById('alertEmpty'),

  teacherGrid: document.getElementById('teacherGrid'),
  teacherEmpty: document.getElementById('teacherEmpty'),

  sessionChart: document.getElementById('sessionChart'),
  sessionChartEmpty: document.getElementById('sessionChartEmpty'),
  breakdownChart: document.getElementById('breakdownChart'),
  breakdownChartEmpty: document.getElementById('breakdownChartEmpty'),

  playerGrid: document.getElementById('playerGrid'),
  playerEmpty: document.getElementById('playerEmpty'),

  pidAggregateGrid: document.getElementById('pidAggregateGrid'),
  pidAggregateEmpty: document.getElementById('pidAggregateEmpty'),
  studyAggregateGrid: document.getElementById('studyAggregateGrid'),
  studyAggregateEmpty: document.getElementById('studyAggregateEmpty'),

  pidDetailRoot: document.getElementById('pidDetailRoot'),
  pidDetailEmpty: document.getElementById('pidDetailEmpty'),
  studyTimelineRoot: document.getElementById('studyTimelineRoot'),
  studyTimelineEmpty: document.getElementById('studyTimelineEmpty'),

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
  exportSessionsCsvBtn: document.getElementById('exportSessionsCsvBtn'),
  exportParticipantsCsvBtn: document.getElementById('exportParticipantsCsvBtn'),
  exportStudiesCsvBtn: document.getElementById('exportStudiesCsvBtn'),
  clearBtn: document.getElementById('clearBtn')
};

let dashboardState = {
  latest: null,
  summary: null,
  history: [],
  filtered: [],
  selectedPid: '',
  selectedStudyId: ''
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
  refs.exportSessionsCsvBtn.addEventListener('click', exportSessionsCsv);
  refs.exportParticipantsCsvBtn.addEventListener('click', exportParticipantsCsv);
  refs.exportStudiesCsvBtn.addEventListener('click', exportStudiesCsv);

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

  refs.playerGrid.addEventListener('click', onPlayerGridClick);
  refs.pidAggregateGrid.addEventListener('click', onPidAggregateClick);
  refs.studyAggregateGrid.addEventListener('click', onStudyAggregateClick);
  refs.pidDetailRoot.addEventListener('click', onPidDetailClick);
  refs.studyTimelineRoot.addEventListener('click', onStudyTimelineClick);
}

function renderAll() {
  dashboardState.latest = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
  dashboardState.summary = readJson('HHA_LAST_SUMMARY', null);
  dashboardState.history = readJson('HHA_HYDRATION_V2_RESEARCH_HISTORY', []);

  if (!Array.isArray(dashboardState.history)) {
    dashboardState.history = [];
  }

  dashboardState.filtered = applyFilters(dashboardState.history);
  hydrateSelections();

  renderStats(dashboardState.latest, dashboardState.history, dashboardState.filtered);
  renderLatest(dashboardState.latest);
  renderSummary(dashboardState.summary);
  renderStudySummary(dashboardState.filtered);
  renderCohortComparison(dashboardState.filtered);
  renderAlerts(dashboardState.filtered);
  renderTeacherCards(dashboardState.filtered);
  renderCharts(dashboardState.filtered);
  renderPlayerCards(dashboardState.filtered);
  renderAggregates(dashboardState.filtered);
  renderPidDetail(dashboardState.filtered, dashboardState.selectedPid);
  renderStudyTimeline(dashboardState.filtered, dashboardState.selectedStudyId);
  renderHistory(dashboardState.filtered);
}

function applyFiltersAndRender() {
  dashboardState.filtered = applyFilters(dashboardState.history);
  hydrateSelections();

  renderStats(dashboardState.latest, dashboardState.history, dashboardState.filtered);
  renderStudySummary(dashboardState.filtered);
  renderCohortComparison(dashboardState.filtered);
  renderAlerts(dashboardState.filtered);
  renderTeacherCards(dashboardState.filtered);
  renderCharts(dashboardState.filtered);
  renderPlayerCards(dashboardState.filtered);
  renderAggregates(dashboardState.filtered);
  renderPidDetail(dashboardState.filtered, dashboardState.selectedPid);
  renderStudyTimeline(dashboardState.filtered, dashboardState.selectedStudyId);
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

function hydrateSelections() {
  const pids = [...new Set(dashboardState.filtered.map(x => String(x.pid || 'anon')))];
  const studies = [...new Set(dashboardState.filtered.map(x => String(x.studyId || '(empty)')))];

  if (!pids.includes(dashboardState.selectedPid)) {
    dashboardState.selectedPid = pids[0] || '';
  }
  if (!studies.includes(dashboardState.selectedStudyId)) {
    dashboardState.selectedStudyId = studies[0] || '';
  }
}

function renderStats(latest, history, filtered) {
  refs.countHistory.textContent = String(Array.isArray(history) ? history.length : 0);
  refs.countFiltered.textContent = String(Array.isArray(filtered) ? filtered.length : 0);

  const avgTotal = filtered.length
    ? filtered.reduce((sum, item) => sum + Number(item.totalScore || 0), 0) / filtered.length
    : 0;

  const avgPlanning = filtered.length
    ? filtered.reduce((sum, item) => sum + Number(item.planningScore || 0), 0) / filtered.length
    : 0;

  const passed = filtered.filter(item => !!item.teamMissionDone).length;

  refs.avgTotalScore.textContent = formatNumber(avgTotal);
  refs.avgPlanningScore.textContent = formatNumber(avgPlanning);
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

function renderStudySummary(filtered) {
  refs.studySummaryGrid.innerHTML = '';

  const grouped = groupBy(filtered, item => String(item.studyId || '(empty)'));
  const studies = [...grouped.entries()]
    .map(([studyId, items]) => ({
      studyId,
      runs: items.length,
      participants: new Set(items.map(x => String(x.pid || 'anon'))).size,
      avgTotal: avg(items.map(x => Number(x.totalScore || 0))),
      avgPlanning: avg(items.map(x => Number(x.planningScore || 0))),
      passRate: items.length ? (items.filter(x => !!x.teamMissionDone).length / items.length) * 100 : 0
    }))
    .sort((a,b) => b.avgTotal - a.avgTotal)
    .slice(0, 6);

  if (!studies.length) {
    refs.studySummaryEmpty.style.display = '';
    return;
  }

  refs.studySummaryEmpty.style.display = 'none';

  studies.forEach(row => {
    const el = document.createElement('article');
    el.className = 'study-summary-card';
    el.innerHTML = `
      <div class="study-summary-top">
        <div class="study-summary-title">Study ${escapeHtml(row.studyId)}</div>
        <div class="study-summary-badge">${escapeHtml(row.runs)} runs</div>
      </div>
      <div class="study-summary-meta">
        participants = ${escapeHtml(row.participants)}<br/>
        avg total = ${formatNumber(row.avgTotal)}<br/>
        avg planning = ${formatNumber(row.avgPlanning)}<br/>
        mission pass = ${formatNumber(row.passRate)}%
      </div>
    `;
    refs.studySummaryGrid.appendChild(el);
  });
}

function renderCohortComparison(filtered) {
  refs.cohortGrid.innerHTML = '';

  const cohorts = [
    makeCohortCard(filtered, 'quick', item => item.mode === 'quick', 'Mode: quick'),
    makeCohortCard(filtered, 'program', item => item.mode === 'program', 'Mode: program'),
    makeCohortCard(filtered, 'solo', item => item.type === 'solo', 'Type: solo'),
    makeCohortCard(filtered, 'team', item => item.type === 'team', 'Type: team'),
    makeCohortCard(filtered, 'play', item => item.run === 'play', 'Run: play'),
    makeCohortCard(filtered, 'research', item => item.run === 'research', 'Run: research')
  ].filter(Boolean);

  if (!cohorts.length) {
    refs.cohortEmpty.style.display = '';
    return;
  }

  refs.cohortEmpty.style.display = 'none';

  cohorts.forEach(row => {
    const el = document.createElement('article');
    el.className = 'cohort-card';
    el.innerHTML = `
      <div class="cohort-top">
        <div class="cohort-title">${escapeHtml(row.title)}</div>
        <div class="cohort-badge">${escapeHtml(row.count)} runs</div>
      </div>
      <div class="cohort-meta">
        avg total = ${formatNumber(row.avgTotal)}<br/>
        avg planning = ${formatNumber(row.avgPlanning)}<br/>
        avg social = ${formatNumber(row.avgSocial)}<br/>
        mission pass = ${formatNumber(row.passRate)}%
      </div>
    `;
    refs.cohortGrid.appendChild(el);
  });
}

function makeCohortCard(filtered, key, predicate, title) {
  const items = filtered.filter(predicate);
  if (!items.length) return null;
  return {
    key,
    title,
    count: items.length,
    avgTotal: avg(items.map(x => Number(x.totalScore || 0))),
    avgPlanning: avg(items.map(x => Number(x.planningScore || 0))),
    avgSocial: avg(items.map(x => Number(x.socialScore || 0))),
    passRate: items.length ? (items.filter(x => !!x.teamMissionDone).length / items.length) * 100 : 0
  };
}

function renderAlerts(filtered) {
  refs.alertList.innerHTML = '';

  const alerts = buildAlerts(filtered);

  if (!alerts.length) {
    refs.alertEmpty.style.display = '';
    return;
  }

  refs.alertEmpty.style.display = 'none';

  alerts.slice(0, 12).forEach(alert => {
    const el = document.createElement('article');
    el.className = 'alert-card';
    el.innerHTML = `
      <div class="alert-title">${escapeHtml(alert.title)}</div>
      <div class="alert-meta">${escapeHtml(alert.meta)}</div>
    `;
    refs.alertList.appendChild(el);
  });
}

function buildAlerts(filtered) {
  const alerts = [];

  const byPid = groupBy(filtered, x => String(x.pid || 'anon'));

  byPid.forEach((items, pid) => {
    const sorted = [...items].sort((a,b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0));
    const latest = sorted[sorted.length - 1];
    const sameSessionCount = sorted.filter(x => Number(x.sessionNo || 0) === Number(latest.sessionNo || 0)).length;

    if (sameSessionCount >= 3) {
      alerts.push({
        title: `PID ${pid} อยู่ session เดิมหลายรอบ`,
        meta: `ล่าสุด W${latest.weekNo || '-'} S${latest.sessionNo || '-'} และมีอย่างน้อย ${sameSessionCount} records ที่ session นี้`
      });
    }

    const recentThree = sorted.slice(-3);
    if (recentThree.length === 3 && recentThree.every(x => !x.teamMissionDone)) {
      alerts.push({
        title: `PID ${pid} ยังไม่ผ่าน team mission ต่อเนื่อง`,
        meta: `3 records ล่าสุดยังไม่ผ่าน team mission`
      });
    }

    if (recentThree.length >= 2) {
      const totalValues = recentThree.map(x => Number(x.totalScore || 0));
      const declining = totalValues[0] > totalValues[1] && totalValues[1] > totalValues[2];
      if (declining) {
        alerts.push({
          title: `PID ${pid} คะแนนรวมลดลงต่อเนื่อง`,
          meta: `3 records ล่าสุดมี total score ลดลงต่อเนื่อง`
        });
      }
    }
  });

  const byStudy = groupBy(filtered, x => String(x.studyId || '(empty)'));
  byStudy.forEach((items, studyId) => {
    const passRate = items.length ? (items.filter(x => !!x.teamMissionDone).length / items.length) * 100 : 0;
    if (items.length >= 4 && passRate < 25) {
      alerts.push({
        title: `Study ${studyId} มี pass rate ต่ำ`,
        meta: `mission pass rate = ${formatNumber(passRate)}% จาก ${items.length} runs`
      });
    }
  });

  return alerts;
}

function renderTeacherCards(filtered) {
  refs.teacherGrid.innerHTML = '';

  if (!filtered.length) {
    refs.teacherEmpty.style.display = '';
    return;
  }

  refs.teacherEmpty.style.display = 'none';

  const bestTotal = [...filtered].sort((a,b) => Number(b.totalScore||0) - Number(a.totalScore||0))[0];
  const bestPlanning = [...filtered].sort((a,b) => Number(b.planningScore||0) - Number(a.planningScore||0))[0];
  const bestSocial = [...filtered].sort((a,b) => Number(b.socialScore||0) - Number(a.socialScore||0))[0];
  const latest = [...filtered].sort((a,b) => new Date(b.savedAt||0).getTime() - new Date(a.savedAt||0).getTime())[0];

  const cards = [
    {
      title: 'Best Total Score',
      meta: bestTotal
        ? `${bestTotal.pid || 'anon'} • total=${bestTotal.totalScore || 0} • W${bestTotal.weekNo || '-'} S${bestTotal.sessionNo || '-'}`
        : '-'
    },
    {
      title: 'Best Planning',
      meta: bestPlanning
        ? `${bestPlanning.pid || 'anon'} • planning=${bestPlanning.planningScore || 0} • create=${bestPlanning.createdPlanScore || 0}`
        : '-'
    },
    {
      title: 'Strongest Social',
      meta: bestSocial
        ? `${bestSocial.pid || 'anon'} • social=${bestSocial.socialScore || 0} • mission=${bestSocial.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน'}`
        : '-'
    },
    {
      title: 'Latest Session',
      meta: latest
        ? `${latest.pid || 'anon'} • ${formatDate(latest.savedAt)} • W${latest.weekNo || '-'} S${latest.sessionNo || '-'}`
        : '-'
    }
  ];

  cards.forEach(card => {
    const el = document.createElement('article');
    el.className = 'teacher-card';
    el.innerHTML = `
      <div class="teacher-title">${escapeHtml(card.title)}</div>
      <div class="teacher-meta" style="margin-top:10px;">${escapeHtml(card.meta)}</div>
    `;
    refs.teacherGrid.appendChild(el);
  });
}

function renderCharts(filtered) {
  renderSessionChart(filtered);
  renderBreakdownChart(filtered);
}

function renderSessionChart(filtered) {
  refs.sessionChart.innerHTML = '';

  const grouped = new Map();
  filtered.forEach(item => {
    const key = `S${item.sessionNo || '-'}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(Number(item.totalScore || 0));
  });

  const rows = [...grouped.entries()]
    .map(([label, values]) => ({
      label,
      value: values.reduce((a,b)=>a+b,0) / values.length
    }))
    .sort((a,b) => Number(a.label.replace('S','')) - Number(b.label.replace('S','')));

  if (!rows.length) {
    refs.sessionChartEmpty.style.display = '';
    return;
  }

  refs.sessionChartEmpty.style.display = 'none';

  const maxValue = Math.max(...rows.map(r => r.value), 1);
  rows.forEach(row => refs.sessionChart.appendChild(makeBarRow(row.label, row.value, maxValue)));
}

function renderBreakdownChart(filtered) {
  refs.breakdownChart.innerHTML = '';

  if (!filtered.length) {
    refs.breakdownChartEmpty.style.display = '';
    return;
  }

  refs.breakdownChartEmpty.style.display = 'none';

  const values = [
    { label: 'Action', value: avg(filtered.map(x => Number(x.actionScore || 0))) },
    { label: 'Knowledge', value: avg(filtered.map(x => Number(x.knowledgeScore || 0))) },
    { label: 'Planning', value: avg(filtered.map(x => Number(x.planningScore || 0))) },
    { label: 'Social', value: avg(filtered.map(x => Number(x.socialScore || 0))) }
  ];

  const maxValue = Math.max(...values.map(v => v.value), 1);
  values.forEach(row => refs.breakdownChart.appendChild(makeBarRow(row.label, row.value, maxValue)));
}

function renderPlayerCards(filtered) {
  refs.playerGrid.innerHTML = '';

  const latestByPid = new Map();
  filtered.forEach(item => {
    const pid = String(item.pid || 'anon');
    const current = latestByPid.get(pid);
    if (!current || new Date(item.savedAt || 0).getTime() > new Date(current.savedAt || 0).getTime()) {
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
    const selected = String(item.pid || 'anon') === dashboardState.selectedPid;
    const el = document.createElement('article');
    el.className = `player-card selectable ${selected ? 'selected' : ''}`;
    el.setAttribute('data-pid', String(item.pid || 'anon'));
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
      <div class="card-actions">
        <button class="btn small ghost" type="button" data-view-pid="${escapeHtml(item.pid || 'anon')}">ดู PID นี้</button>
        <button class="btn small primary" type="button" data-next-from-record="${escapeHtml(encodeRecord(item))}">ไป session ถัดไป</button>
      </div>
    `;
    refs.playerGrid.appendChild(el);
  });
}

function renderAggregates(filtered) {
  renderPidAggregate(filtered);
  renderStudyAggregate(filtered);
}

function renderPidAggregate(filtered) {
  refs.pidAggregateGrid.innerHTML = '';

  const grouped = groupBy(filtered, item => String(item.pid || 'anon'));

  const rows = [...grouped.entries()]
    .map(([pid, items]) => ({
      pid,
      latest: latestItem(items),
      runs: items.length,
      avgTotal: avg(items.map(x => Number(x.totalScore || 0))),
      avgPlanning: avg(items.map(x => Number(x.planningScore || 0))),
      passed: items.filter(x => !!x.teamMissionDone).length
    }))
    .sort((a,b) => b.avgTotal - a.avgTotal)
    .slice(0, 12);

  if (!rows.length) {
    refs.pidAggregateEmpty.style.display = '';
    return;
  }

  refs.pidAggregateEmpty.style.display = 'none';

  rows.forEach(row => {
    const selected = row.pid === dashboardState.selectedPid;
    const el = document.createElement('article');
    el.className = `aggregate-card selectable ${selected ? 'selected' : ''}`;
    el.setAttribute('data-aggregate-pid', row.pid);
    el.innerHTML = `
      <div class="aggregate-top">
        <div class="aggregate-name">PID ${escapeHtml(row.pid)}</div>
        <div class="aggregate-badge">${escapeHtml(row.runs)} runs</div>
      </div>
      <div class="aggregate-meta">
        avg total = ${formatNumber(row.avgTotal)}<br/>
        avg planning = ${formatNumber(row.avgPlanning)}<br/>
        team mission passed = ${escapeHtml(row.passed)}
      </div>
    `;
    refs.pidAggregateGrid.appendChild(el);
  });
}

function renderStudyAggregate(filtered) {
  refs.studyAggregateGrid.innerHTML = '';

  const grouped = groupBy(filtered, item => String(item.studyId || '(empty)'));

  const rows = [...grouped.entries()]
    .map(([studyId, items]) => ({
      studyId,
      latest: latestItem(items),
      runs: items.length,
      participants: new Set(items.map(x => String(x.pid || 'anon'))).size,
      avgTotal: avg(items.map(x => Number(x.totalScore || 0))),
      missionRate: items.length ? (items.filter(x => !!x.teamMissionDone).length / items.length) * 100 : 0
    }))
    .sort((a,b) => b.avgTotal - a.avgTotal)
    .slice(0, 12);

  if (!rows.length) {
    refs.studyAggregateEmpty.style.display = '';
    return;
  }

  refs.studyAggregateEmpty.style.display = 'none';

  rows.forEach(row => {
    const selected = row.studyId === dashboardState.selectedStudyId;
    const el = document.createElement('article');
    el.className = `aggregate-card selectable ${selected ? 'selected' : ''}`;
    el.setAttribute('data-aggregate-study', row.studyId);
    el.innerHTML = `
      <div class="aggregate-top">
        <div class="aggregate-name">Study ${escapeHtml(row.studyId)}</div>
        <div class="aggregate-badge">${escapeHtml(row.runs)} runs</div>
      </div>
      <div class="aggregate-meta">
        participants = ${escapeHtml(row.participants)}<br/>
        avg total = ${formatNumber(row.avgTotal)}<br/>
        mission pass rate = ${formatNumber(row.missionRate)}%
      </div>
    `;
    refs.studyAggregateGrid.appendChild(el);
  });
}

function renderPidDetail(filtered, selectedPid) {
  refs.pidDetailRoot.innerHTML = '';

  if (!selectedPid) {
    refs.pidDetailEmpty.style.display = '';
    return;
  }

  const items = filtered
    .filter(x => String(x.pid || 'anon') === selectedPid)
    .sort((a,b) => bySessionThenDate(a, b));

  if (!items.length) {
    refs.pidDetailEmpty.style.display = '';
    return;
  }

  refs.pidDetailEmpty.style.display = 'none';

  const latest = latestItem(items);
  const avgTotal = avg(items.map(x => Number(x.totalScore || 0)));
  const avgPlanning = avg(items.map(x => Number(x.planningScore || 0)));
  const passed = items.filter(x => !!x.teamMissionDone).length;

  const sessionRows = items.map(item => ({
    label: `W${item.weekNo || '-'} S${item.sessionNo || '-'}`,
    value: Number(item.totalScore || 0),
    record: item
  }));
  const maxValue = Math.max(...sessionRows.map(r => r.value), 1);

  const container = document.createElement('div');
  container.className = 'detail-card';
  container.innerHTML = `
    <div class="detail-top">
      <div class="detail-title">PID ${escapeHtml(selectedPid)}</div>
      <div class="detail-badge">${escapeHtml(items.length)} runs</div>
    </div>
    <div class="detail-meta">
      latest study = ${escapeHtml(latest.studyId || '(empty)')}<br/>
      latest mode/type/run = ${escapeHtml(latest.mode || '-')} / ${escapeHtml(latest.type || '-')} / ${escapeHtml(latest.run || '-')}<br/>
      avg total = ${formatNumber(avgTotal)} • avg planning = ${formatNumber(avgPlanning)} • team passed = ${escapeHtml(passed)}
    </div>
    <div class="card-actions">
      <button class="btn small primary" type="button" data-next-from-record="${escapeHtml(encodeRecord(latest))}">ไป session ถัดไปของ PID นี้</button>
      <button class="btn small ghost" type="button" data-focus-study="${escapeHtml(latest.studyId || '(empty)')}">ดู study นี้</button>
    </div>
    <div class="timeline-list" id="pidTimelineList"></div>
  `;

  refs.pidDetailRoot.appendChild(container);

  const timelineRoot = container.querySelector('#pidTimelineList');
  sessionRows.forEach(row => {
    timelineRoot.appendChild(makeTimelineRow(row.label, row.value, maxValue));
  });
}

function renderStudyTimeline(filtered, selectedStudyId) {
  refs.studyTimelineRoot.innerHTML = '';

  if (!selectedStudyId) {
    refs.studyTimelineEmpty.style.display = '';
    return;
  }

  const items = filtered
    .filter(x => String(x.studyId || '(empty)') === selectedStudyId)
    .sort((a,b) => bySessionThenDate(a, b));

  if (!items.length) {
    refs.studyTimelineEmpty.style.display = '';
    return;
  }

  refs.studyTimelineEmpty.style.display = 'none';

  const latest = latestItem(items);
  const participants = [...new Set(items.map(x => String(x.pid || 'anon')))].length;

  const sessionMap = new Map();
  items.forEach(item => {
    const key = `W${item.weekNo || '-'} S${item.sessionNo || '-'}`;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key).push(item);
  });

  const rows = [...sessionMap.entries()].map(([label, records]) => ({
    label,
    avgTotal: avg(records.map(x => Number(x.totalScore || 0))),
    runs: records.length,
    participants: new Set(records.map(x => String(x.pid || 'anon'))).size
  }));

  const maxValue = Math.max(...rows.map(r => r.avgTotal), 1);

  const container = document.createElement('div');
  container.className = 'detail-card';
  container.innerHTML = `
    <div class="detail-top">
      <div class="detail-title">Study ${escapeHtml(selectedStudyId)}</div>
      <div class="detail-badge">${escapeHtml(items.length)} runs</div>
    </div>
    <div class="detail-meta">
      participants = ${escapeHtml(participants)}<br/>
      latest = W${escapeHtml(latest.weekNo || '-')} S${escapeHtml(latest.sessionNo || '-')} • PID ${escapeHtml(latest.pid || 'anon')}<br/>
      avg total = ${formatNumber(avg(items.map(x => Number(x.totalScore || 0))))}
    </div>
    <div class="card-actions">
      <button class="btn small primary" type="button" data-next-from-record="${escapeHtml(encodeRecord(latest))}">ไป session ถัดไปของ study ล่าสุด</button>
      <button class="btn small ghost" type="button" data-focus-pid="${escapeHtml(latest.pid || 'anon')}">ดู PID ล่าสุด</button>
    </div>
    <div class="timeline-list" id="studyTimelineList"></div>
  `;

  refs.studyTimelineRoot.appendChild(container);

  const timelineRoot = container.querySelector('#studyTimelineList');
  rows.forEach(row => {
    timelineRoot.appendChild(makeTimelineRow(
      `${row.label} • ${row.participants} participants`,
      row.avgTotal,
      maxValue
    ));
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

function onPlayerGridClick(ev) {
  const viewBtn = ev.target.closest('[data-view-pid]');
  if (viewBtn) {
    dashboardState.selectedPid = String(viewBtn.getAttribute('data-view-pid') || '');
    rerenderSelectedViews();
    return;
  }

  const nextBtn = ev.target.closest('[data-next-from-record]');
  if (nextBtn) {
    const record = decodeRecord(nextBtn.getAttribute('data-next-from-record'));
    openNextSession(record);
    return;
  }

  const card = ev.target.closest('[data-pid]');
  if (card) {
    dashboardState.selectedPid = String(card.getAttribute('data-pid') || '');
    rerenderSelectedViews();
  }
}

function onPidAggregateClick(ev) {
  const card = ev.target.closest('[data-aggregate-pid]');
  if (!card) return;
  dashboardState.selectedPid = String(card.getAttribute('data-aggregate-pid') || '');
  rerenderSelectedViews();
}

function onStudyAggregateClick(ev) {
  const card = ev.target.closest('[data-aggregate-study]');
  if (!card) return;
  dashboardState.selectedStudyId = String(card.getAttribute('data-aggregate-study') || '');
  rerenderSelectedViews();
}

function onPidDetailClick(ev) {
  const nextBtn = ev.target.closest('[data-next-from-record]');
  if (nextBtn) {
    const record = decodeRecord(nextBtn.getAttribute('data-next-from-record'));
    openNextSession(record);
    return;
  }

  const focusStudyBtn = ev.target.closest('[data-focus-study]');
  if (focusStudyBtn) {
    dashboardState.selectedStudyId = String(focusStudyBtn.getAttribute('data-focus-study') || '');
    rerenderSelectedViews();
  }
}

function onStudyTimelineClick(ev) {
  const nextBtn = ev.target.closest('[data-next-from-record]');
  if (nextBtn) {
    const record = decodeRecord(nextBtn.getAttribute('data-next-from-record'));
    openNextSession(record);
    return;
  }

  const focusPidBtn = ev.target.closest('[data-focus-pid]');
  if (focusPidBtn) {
    dashboardState.selectedPid = String(focusPidBtn.getAttribute('data-focus-pid') || '');
    rerenderSelectedViews();
  }
}

function rerenderSelectedViews() {
  renderPlayerCards(dashboardState.filtered);
  renderAggregates(dashboardState.filtered);
  renderPidDetail(dashboardState.filtered, dashboardState.selectedPid);
  renderStudyTimeline(dashboardState.filtered, dashboardState.selectedStudyId);
}

function openNextSession(record) {
  if (!record) return;

  const nextSession = Number(record.sessionNo || 1) + 1;
  const nextWeek = Math.max(1, Math.floor((nextSession - 1) / 2) + 1);

  const qs = new URLSearchParams(window.location.search);
  const launcher = qs.get('launcher') || './hydration-v2.html';

  const target = new URL(launcher, window.location.href);
  target.searchParams.set('mode', record.mode || 'program');
  target.searchParams.set('type', record.type || 'solo');
  target.searchParams.set('run', record.run || 'research');
  target.searchParams.set('diff', record.diff || 'normal');
  target.searchParams.set('pid', record.pid || '');
  target.searchParams.set('studyId', record.studyId || '');
  target.searchParams.set('session', String(nextSession));
  target.searchParams.set('week', String(nextWeek));
  target.searchParams.set('seed', String(Date.now()));

  const currentHub = new URLSearchParams(window.location.search).get('hub');
  if (currentHub) target.searchParams.set('hub', currentHub);

  window.location.href = target.toString();
}

function exportJson() {
  const data = dashboardState.filtered || [];
  const filename = `hydration-v2-filtered-${timestampForFile()}.json`;
  downloadTextFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

function exportSessionsCsv() {
  const data = dashboardState.filtered || [];
  const columns = [
    'savedAt','pid','studyId','mode','type','run','weekNo','sessionNo','seed',
    'actionScore','knowledgeScore','planningScore','socialScore','totalScore',
    'goodCatch','badCatch','missedGood','bestCombo','rewardCount',
    'correctChoices','wrongChoices','evaluateChoice','evaluateCorrect',
    'createdPlanScore','classTankContribution','teamMissionDone','teamStars','socialSummary'
  ];

  const rows = [
    columns.join(','),
    ...data.map(item => columns.map(col => csvCell(item[col])).join(','))
  ];

  downloadTextFile(
    rows.join('\n'),
    `hydration-v2-sessions-${timestampForFile()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

function exportParticipantsCsv() {
  const rows = buildParticipantRows(dashboardState.filtered);
  const columns = ['pid','studyId','runs','latestWeek','latestSession','avgTotal','avgPlanning','avgSocial','teamMissionPassedCount'];

  const lines = [
    columns.join(','),
    ...rows.map(row => columns.map(col => csvCell(row[col])).join(','))
  ];

  downloadTextFile(
    lines.join('\n'),
    `hydration-v2-participants-${timestampForFile()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

function exportStudiesCsv() {
  const rows = buildStudyRows(dashboardState.filtered);
  const columns = ['studyId','runs','participants','avgTotal','avgPlanning','avgSocial','missionPassRate'];

  const lines = [
    columns.join(','),
    ...rows.map(row => columns.map(col => csvCell(row[col])).join(','))
  ];

  downloadTextFile(
    lines.join('\n'),
    `hydration-v2-studies-${timestampForFile()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

function buildParticipantRows(filtered) {
  const grouped = groupBy(filtered, item => `${String(item.pid || 'anon')}||${String(item.studyId || '(empty)')}`);

  return [...grouped.entries()].map(([key, items]) => {
    const [pid, studyId] = key.split('||');
    const latest = latestItem(items);
    return {
      pid,
      studyId,
      runs: items.length,
      latestWeek: latest.weekNo || '',
      latestSession: latest.sessionNo || '',
      avgTotal: formatNumber(avg(items.map(x => Number(x.totalScore || 0)))),
      avgPlanning: formatNumber(avg(items.map(x => Number(x.planningScore || 0)))),
      avgSocial: formatNumber(avg(items.map(x => Number(x.socialScore || 0)))),
      teamMissionPassedCount: items.filter(x => !!x.teamMissionDone).length
    };
  });
}

function buildStudyRows(filtered) {
  const grouped = groupBy(filtered, item => String(item.studyId || '(empty)'));

  return [...grouped.entries()].map(([studyId, items]) => ({
    studyId,
    runs: items.length,
    participants: new Set(items.map(x => String(x.pid || 'anon'))).size,
    avgTotal: formatNumber(avg(items.map(x => Number(x.totalScore || 0)))),
    avgPlanning: formatNumber(avg(items.map(x => Number(x.planningScore || 0)))),
    avgSocial: formatNumber(avg(items.map(x => Number(x.socialScore || 0)))),
    missionPassRate: formatNumber(items.length ? (items.filter(x => !!x.teamMissionDone).length / items.length) * 100 : 0)
  }));
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

function makeBarRow(label, value, maxValue) {
  const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;

  const el = document.createElement('div');
  el.className = 'bar-row';
  el.innerHTML = `
    <div class="bar-top">
      <span>${escapeHtml(label)}</span>
      <span>${escapeHtml(formatNumber(value))}</span>
    </div>
    <div class="bar-track">
      <div class="bar-fill" style="width:${percent}%;"></div>
    </div>
  `;
  return el;
}

function makeTimelineRow(label, value, maxValue) {
  const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const el = document.createElement('div');
  el.className = 'timeline-row';
  el.innerHTML = `
    <div class="timeline-top">
      <span>${escapeHtml(label)}</span>
      <span>${escapeHtml(formatNumber(value))}</span>
    </div>
    <div class="timeline-track">
      <div class="timeline-fill" style="width:${percent}%;"></div>
    </div>
  `;
  return el;
}

function latestItem(items) {
  return [...items].sort((a,b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())[0];
}

function bySessionThenDate(a, b) {
  const sa = Number(a.sessionNo || 0);
  const sb = Number(b.sessionNo || 0);
  if (sa !== sb) return sa - sb;
  return new Date(a.savedAt || 0).getTime() - new Date(b.savedAt || 0).getTime();
}

function encodeRecord(record) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(record))));
  } catch (_) {
    return '';
  }
}

function decodeRecord(text) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(text || ''))));
  } catch (_) {
    return null;
  }
}

function groupBy(items, keyFn) {
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
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

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a,b) => a + Number(b || 0), 0) / values.length;
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