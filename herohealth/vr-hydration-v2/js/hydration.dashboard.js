// === /herohealth/vr-hydration-v2/js/hydration.dashboard.js ===
// Hydration V2 Dashboard
// PATCH v20260317d-HYDRATION-V2-DASHBOARD

const refs = {
  countHistory: document.getElementById('countHistory'),
  lastTotalScore: document.getElementById('lastTotalScore'),
  lastSessionWeek: document.getElementById('lastSessionWeek'),
  lastTeamStatus: document.getElementById('lastTeamStatus'),

  latestGrid: document.getElementById('latestGrid'),
  latestEmpty: document.getElementById('latestEmpty'),

  summaryGrid: document.getElementById('summaryGrid'),
  summaryEmpty: document.getElementById('summaryEmpty'),

  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),

  backLauncherBtn: document.getElementById('backLauncherBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearBtn: document.getElementById('clearBtn')
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
}

function renderAll() {
  const latest = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
  const history = readJson('HHA_HYDRATION_V2_RESEARCH_HISTORY', []);
  const summary = readJson('HHA_LAST_SUMMARY', null);

  renderStats(latest, history);
  renderLatest(latest);
  renderSummary(summary);
  renderHistory(history);
}

function renderStats(latest, history) {
  refs.countHistory.textContent = String(Array.isArray(history) ? history.length : 0);
  refs.lastTotalScore.textContent = latest ? String(latest.totalScore ?? '-') : '-';
  refs.lastSessionWeek.textContent = latest
    ? `W${latest.weekNo ?? '-'} S${latest.sessionNo ?? '-'}`
    : '-';
  refs.lastTeamStatus.textContent = latest
    ? (latest.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน')
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

function renderHistory(history) {
  refs.historyList.innerHTML = '';

  if (!Array.isArray(history) || history.length === 0) {
    refs.historyEmpty.style.display = '';
    return;
  }

  refs.historyEmpty.style.display = 'none';

  history.slice(0, 20).forEach((item, index) => {
    const el = document.createElement('article');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="history-top">
        <div class="history-title">#${index + 1} • W${item.weekNo ?? '-'} S${item.sessionNo ?? '-'}</div>
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
        team=${item.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน'} •
        contribution=${escapeHtml(item.classTankContribution ?? 0)}%<br/>
        ${escapeHtml(item.socialSummary || '-')}
      </div>
    `;
    refs.historyList.appendChild(el);
  });
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}