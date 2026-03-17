// === /herohealth/vr-hydration-v2/js/hydration.report.js ===
// Hydration V2 Mini Report
// PATCH v20260317i-HYDRATION-V2-REPORT

const refs = {
  reportTitle: document.getElementById('reportTitle'),
  reportLead: document.getElementById('reportLead'),
  statsGrid: document.getElementById('statsGrid'),
  summaryGrid: document.getElementById('summaryGrid'),
  highlightGrid: document.getElementById('highlightGrid'),
  tableWrap: document.getElementById('tableWrap'),
  tableEmpty: document.getElementById('tableEmpty'),
  backBtn: document.getElementById('backBtn'),
  printBtn: document.getElementById('printBtn')
};

boot();

function boot() {
  refs.backBtn.addEventListener('click', () => history.back());
  refs.printBtn.addEventListener('click', () => window.print());

  const payload = readJson('HHA_HYDRATION_V2_REPORT_SOURCE', null);

  if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
    refs.reportTitle.textContent = 'ยังไม่มีข้อมูลรายงาน';
    refs.reportLead.textContent = 'กลับไปที่ dashboard แล้วกดปุ่ม mini report ก่อน';
    refs.tableEmpty.style.display = '';
    return;
  }

  render(payload);
}

function render(payload) {
  const items = payload.items || [];
  const summary = payload.summary || {};
  const highlights = payload.highlights || {};
  const scopeType = payload.scopeType || 'filtered';
  const scopeValue = payload.scopeValue || 'all';

  refs.reportTitle.textContent =
    scopeType === 'pid'
      ? `Mini Report • PID ${scopeValue}`
      : scopeType === 'study'
        ? `Mini Report • Study ${scopeValue}`
        : 'Mini Report • Filtered Scope';

  refs.reportLead.textContent =
    `สร้างเมื่อ ${formatDate(payload.generatedAt)} • ${items.length} records`;

  refs.statsGrid.innerHTML = '';
  [
    ['Runs', summary.runs || 0, 'จำนวน records ในรายงานนี้'],
    ['Participants', summary.participants || 0, 'จำนวนผู้เล่นที่เกี่ยวข้อง'],
    ['Avg Total', formatNumber(summary.avgTotal || 0), 'คะแนนรวมเฉลี่ย'],
    ['Pass Rate', `${formatNumber(summary.passRate || 0)}%`, 'อัตราผ่าน team mission']
  ].forEach(([label, value, sub]) => {
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(String(value))}</div>
      <div class="sub">${escapeHtml(sub)}</div>
    `;
    refs.statsGrid.appendChild(el);
  });

  refs.summaryGrid.innerHTML = '';
  [
    ['Scope', `${scopeType} • ${scopeValue}`],
    ['Generated At', formatDate(payload.generatedAt)],
    ['Avg Planning', formatNumber(summary.avgPlanning || 0)],
    ['Avg Social', formatNumber(summary.avgSocial || 0)],
    ['Latest Session', summary.latestSessionLabel || '-'],
    ['Latest PID', summary.latestPid || '-']
  ].forEach(([title, body]) => {
    refs.summaryGrid.appendChild(makeInfo(title, body));
  });

  refs.highlightGrid.innerHTML = '';
  [
    ['Best Total', highlights.bestTotal || '-'],
    ['Best Planning', highlights.bestPlanning || '-'],
    ['Best Social', highlights.bestSocial || '-'],
    ['Recent Trend', highlights.recentTrend || '-']
  ].forEach(([title, body]) => {
    refs.highlightGrid.appendChild(makeInfo(title, body));
  });

  renderTable(items);
}

function renderTable(items) {
  refs.tableWrap.innerHTML = '';
  if (!items.length) {
    refs.tableEmpty.style.display = '';
    return;
  }

  refs.tableEmpty.style.display = 'none';

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Saved At</th>
        <th>PID</th>
        <th>Study</th>
        <th>W/S</th>
        <th>Mode/Type/Run</th>
        <th>Total</th>
        <th>Planning</th>
        <th>Social</th>
        <th>Mission</th>
      </tr>
    </thead>
    <tbody>
      ${items.slice(0, 50).map(item => `
        <tr>
          <td>${escapeHtml(formatDate(item.savedAt))}</td>
          <td>${escapeHtml(item.pid || 'anon')}</td>
          <td>${escapeHtml(item.studyId || '(empty)')}</td>
          <td>W${escapeHtml(item.weekNo ?? '-')} S${escapeHtml(item.sessionNo ?? '-')}</td>
          <td>${escapeHtml(item.mode || '-')} / ${escapeHtml(item.type || '-')} / ${escapeHtml(item.run || '-')}</td>
          <td>${escapeHtml(item.totalScore ?? 0)}</td>
          <td>${escapeHtml(item.planningScore ?? 0)}</td>
          <td>${escapeHtml(item.socialScore ?? 0)}</td>
          <td>${item.teamMissionDone ? 'ผ่าน' : 'ยังไม่ผ่าน'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  refs.tableWrap.appendChild(table);
}

function makeInfo(title, body) {
  const el = document.createElement('div');
  el.className = 'info';
  el.innerHTML = `
    <div class="info-title">${escapeHtml(title)}</div>
    <div class="info-body">${escapeHtml(String(body ?? '-'))}</div>
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}