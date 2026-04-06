// === /herohealth/vr-hydration-v2/js/hydration.report.js ===
// Hydration V2 Mini Report + Teacher Analytics + Export Bundle + Multi-PID Comparison + Cohort Cards
// PATCH v20260320q-HYDRATION-V2-REPORT-COHORT

import { buildTeacherAnalytics } from './hydration.analytics.js';
import {
  buildResearchExportBundle,
  buildRecordsCsvRows,
  buildFamilyCsvRows,
  buildTrendCsvRows,
  buildComparisonCsvRows,
  toCsv,
  downloadTextFile
} from './hydration.export.js';

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
  refs.backBtn?.addEventListener('click', () => history.back());
  refs.printBtn?.addEventListener('click', () => window.print());

  const payload = readJson('HHA_HYDRATION_V2_REPORT_SOURCE', null);
  const history = readJson('HHA_HYDRATION_V2_RESEARCH_HISTORY', []);
  const summaryHistory = readJson('HHA_SUMMARY_HISTORY', []);

  if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
    refs.reportTitle.textContent = 'ยังไม่มีข้อมูลรายงาน';
    refs.reportLead.textContent = 'กลับไปที่ dashboard แล้วกดปุ่ม mini report ก่อน';
    refs.tableEmpty.style.display = '';
    return;
  }

  render(payload, history, summaryHistory);
}

function render(payload, history, summaryHistory) {
  const items = payload.items || [];
  const summary = payload.summary || {};
  const highlights = payload.highlights || {};
  const scopeType = payload.scopeType || 'filtered';
  const scopeValue = payload.scopeValue || 'all';

  const analytics = buildTeacherAnalytics({
    payload,
    history,
    summaryHistory,
    localStorageRef: window.localStorage
  });

  const exportBundle = buildResearchExportBundle({
    payload,
    history,
    summaryHistory,
    analytics
  });

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
    refs.statsGrid.appendChild(makeCard(label, value, sub));
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
    ['Recent Trend', highlights.recentTrend || '-'],
    ['Teacher Recommendation', analytics.recommendation || '-'],
    ['Boss Clear Rate', `${formatNumber(analytics.progression?.bossClearRate || 0)}%`]
  ].forEach(([title, body]) => {
    refs.highlightGrid.appendChild(makeInfo(title, body));
  });

  renderExportBar(exportBundle);
  renderTeacherAnalytics(analytics);
  renderCohortSummaryCards(analytics.comparison);
  renderComparisonSection(analytics.comparison);
  renderTable(items);
}

function renderExportBar(exportBundle) {
  const bar = document.createElement('section');
  bar.style.marginTop = '18px';
  bar.style.marginBottom = '18px';
  bar.style.display = 'flex';
  bar.style.flexWrap = 'wrap';
  bar.style.gap = '10px';

  bar.innerHTML = `
    <button type="button" class="btn-export" data-export="json">Export JSON Bundle</button>
    <button type="button" class="btn-export" data-export="records">Export Records CSV</button>
    <button type="button" class="btn-export" data-export="family">Export Family CSV</button>
    <button type="button" class="btn-export" data-export="trends">Export Trends CSV</button>
    <button type="button" class="btn-export" data-export="comparison">Export Comparison CSV</button>
  `;

  injectExportButtonStyle();

  bar.querySelector('[data-export="json"]')?.addEventListener('click', () => {
    downloadTextFile(
      buildFilename(exportBundle, 'bundle', 'json'),
      JSON.stringify(exportBundle, null, 2),
      'application/json;charset=utf-8'
    );
  });

  bar.querySelector('[data-export="records"]')?.addEventListener('click', () => {
    const csv = toCsv(buildRecordsCsvRows(exportBundle.records));
    downloadTextFile(
      buildFilename(exportBundle, 'records', 'csv'),
      csv,
      'text/csv;charset=utf-8'
    );
  });

  bar.querySelector('[data-export="family"]')?.addEventListener('click', () => {
    const csv = toCsv(buildFamilyCsvRows(exportBundle.familyRows));
    downloadTextFile(
      buildFilename(exportBundle, 'family-mastery', 'csv'),
      csv,
      'text/csv;charset=utf-8'
    );
  });

  bar.querySelector('[data-export="trends"]')?.addEventListener('click', () => {
    const csv = toCsv(buildTrendCsvRows(exportBundle.trendRows));
    downloadTextFile(
      buildFilename(exportBundle, 'trend-summary', 'csv'),
      csv,
      'text/csv;charset=utf-8'
    );
  });

  bar.querySelector('[data-export="comparison"]')?.addEventListener('click', () => {
    const csv = toCsv(buildComparisonCsvRows(exportBundle.comparisonRows));
    downloadTextFile(
      buildFilename(exportBundle, 'comparison', 'csv'),
      csv,
      'text/csv;charset=utf-8'
    );
  });

  refs.tableWrap.parentNode.insertBefore(bar, refs.tableWrap);
}

function renderTeacherAnalytics(analytics) {
  const weak = analytics.memoryStats?.weakFamilies || [];
  const strong = analytics.memoryStats?.strongFamilies || [];
  const trends = analytics.trends || {};
  const progression = analytics.progression || {};

  const wrapper = document.createElement('section');
  wrapper.style.marginTop = '18px';
  wrapper.style.display = 'grid';
  wrapper.style.gap = '12px';

  wrapper.innerHTML = `
    <div class="info">
      <div class="info-title">Teacher Analytics Summary</div>
      <div class="info-body">
        Trend: ${escapeHtml(String(trends.trendLabel || '-'))} •
        Avg Total(last5): ${escapeHtml(formatNumber(trends.avgTotal || 0))} •
        Avg Planning(last5): ${escapeHtml(formatNumber(trends.avgPlanning || 0))} •
        Avg Social(last5): ${escapeHtml(formatNumber(trends.avgSocial || 0))}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
      <div class="info">
        <div class="info-title">Weak Families</div>
        <div class="info-body">
          ${weak.length
            ? weak.map((row) => `• ${escapeHtml(row.family)} — mastery ${escapeHtml(formatNumber(row.mastery))}%`).join('<br/>')
            : '-'}
        </div>
      </div>

      <div class="info">
        <div class="info-title">Strong Families</div>
        <div class="info-body">
          ${strong.length
            ? strong.map((row) => `• ${escapeHtml(row.family)} — mastery ${escapeHtml(formatNumber(row.mastery))}%`).join('<br/>')
            : '-'}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
      ${makeInlineInfo('Latest Streak', progression.latestStreak || 0)}
      ${makeInlineInfo('Latest Today Runs', progression.latestTodayRuns || 0)}
      ${makeInlineInfo('Adaptive Support Count', progression.adaptiveSupportCount || 0)}
    </div>
  `;

  refs.tableWrap.parentNode.insertBefore(wrapper, refs.tableWrap);
}

function renderCohortSummaryCards(comparison = {}) {
  const rows = Array.isArray(comparison?.rows) ? comparison.rows : [];
  if (rows.length <= 1) return;

  const pidCount = rows.length;
  const avgTotalCohort = average(rows.map(x => Number(x.avgTotal || 0)));
  const avgStreakCohort = average(rows.map(x => Number(x.latestStreak || 0)));
  const bestRow = [...rows].sort((a, b) => Number(b.avgTotal || 0) - Number(a.avgTotal || 0))[0] || null;
  const lowestRow = [...rows].sort((a, b) => Number(a.avgTotal || 0) - Number(b.avgTotal || 0))[0] || null;

  const section = document.createElement('section');
  section.style.marginTop = '18px';
  section.style.display = 'grid';
  section.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
  section.style.gap = '12px';

  section.innerHTML = `
    ${makeComparisonCard('PID Count', pidCount, 'จำนวนผู้เล่นใน scope นี้')}
    ${makeComparisonCard('Cohort Avg Total', formatNumber(avgTotalCohort), 'ค่าเฉลี่ยคะแนนรวมของทั้งกลุ่ม')}
    ${makeComparisonCard('Cohort Avg Streak', formatNumber(avgStreakCohort), 'ค่าเฉลี่ย streak ล่าสุด')}
    ${makeComparisonCard(
      'Best / Lowest',
      bestRow && lowestRow
        ? `PID ${escapeHtml(bestRow.pid)} / PID ${escapeHtml(lowestRow.pid)}`
        : '-',
      bestRow && lowestRow
        ? `best ${formatNumber(bestRow.avgTotal)} • lowest ${formatNumber(lowestRow.avgTotal)}`
        : 'ยังไม่มีข้อมูลพอ'
    )}
  `;

  refs.tableWrap.parentNode.insertBefore(section, refs.tableWrap);
}

function renderComparisonSection(comparison = {}) {
  const rows = Array.isArray(comparison?.rows) ? comparison.rows : [];
  if (rows.length <= 1) return;

  const topRows = Array.isArray(comparison?.topRows) ? comparison.topRows : [];
  const supportRows = Array.isArray(comparison?.supportRows) ? comparison.supportRows : [];

  const section = document.createElement('section');
  section.style.marginTop = '18px';
  section.style.display = 'grid';
  section.style.gap = '12px';

  section.innerHTML = `
    <div class="info">
      <div class="info-title">Multi-PID Comparison</div>
      <div class="info-body">
        เปรียบเทียบหลาย PID ใน scope เดียวกันจากคะแนนเฉลี่ย, streak, boss clear rate และ weak family
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
      <div class="info">
        <div class="info-title">Top PIDs by Avg Total</div>
        <div class="info-body">
          ${topRows.length
            ? topRows.map((row, idx) =>
              `${idx + 1}. PID ${escapeHtml(row.pid)} — avg total ${escapeHtml(formatNumber(row.avgTotal))} • streak ${escapeHtml(row.latestStreak)}`
            ).join('<br/>')
            : '-'}
        </div>
      </div>

      <div class="info">
        <div class="info-title">PIDs Needing Support</div>
        <div class="info-body">
          ${supportRows.length
            ? supportRows.map((row, idx) =>
              `${idx + 1}. PID ${escapeHtml(row.pid)} — avg total ${escapeHtml(formatNumber(row.avgTotal))} • weak ${escapeHtml(row.weakFamily || '-')}`
            ).join('<br/>')
            : '-'}
        </div>
      </div>
    </div>
  `;

  const tableBox = document.createElement('div');
  tableBox.className = 'info';
  tableBox.innerHTML = `
    <div class="info-title">PID Comparison Table</div>
    <div class="info-body" style="overflow:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">PID</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Runs</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Avg Total</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Avg Planning</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Avg Social</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Streak</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Boss %</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Weak Family</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 12).map((row) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(row.pid)}</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(row.runs)}</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(formatNumber(row.avgTotal))}</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(formatNumber(row.avgPlanning))}</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(formatNumber(row.avgSocial))}</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(row.latestStreak)}</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(formatNumber(row.bossClearRate))}%</td>
              <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHtml(row.weakFamily || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  section.appendChild(tableBox);
  refs.tableWrap.parentNode.insertBefore(section, refs.tableWrap);
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

function buildFilename(bundle, suffix, ext) {
  const scopeType = bundle?.meta?.scopeType || 'filtered';
  const scopeValue = String(bundle?.meta?.scopeValue || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `hydration-v2-${scopeType}-${scopeValue}-${suffix}.${ext}`;
}

function injectExportButtonStyle() {
  if (document.getElementById('hydration-export-style')) return;

  const style = document.createElement('style');
  style.id = 'hydration-export-style';
  style.textContent = `
    .btn-export{
      min-height:40px;
      padding:10px 14px;
      border:none;
      border-radius:999px;
      background:linear-gradient(180deg,#4cc9ff,#1ca6df);
      color:#032033;
      font:900 13px/1 "Noto Sans Thai",system-ui,sans-serif;
      cursor:pointer;
      box-shadow:0 8px 18px rgba(0,0,0,.12);
    }
    .btn-export:hover{
      transform:translateY(-1px);
    }
  `;
  document.head.appendChild(style);
}

function makeCard(label, value, sub) {
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="label">${escapeHtml(label)}</div>
    <div class="value">${escapeHtml(String(value))}</div>
    <div class="sub">${escapeHtml(sub)}</div>
  `;
  return el;
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

function makeInlineInfo(title, body) {
  return `
    <div class="info">
      <div class="info-title">${escapeHtml(title)}</div>
      <div class="info-body">${escapeHtml(String(body ?? '-'))}</div>
    </div>
  `;
}

function makeComparisonCard(label, value, sub) {
  return `
    <article class="card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${typeof value === 'string' ? escapeHtml(value) : escapeHtml(String(value))}</div>
      <div class="sub">${escapeHtml(sub)}</div>
    </article>
  `;
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

function average(arr = []) {
  const nums = arr.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}