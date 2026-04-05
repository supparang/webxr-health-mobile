import { saveLastSummary, markZonePlayed } from './nutrition-storage.js';

function num(v, d = 0) {
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function normalizeSummary(ctx, raw = {}) {
  const summary = {
    gameId: raw.gameId || ctx?.gameId || 'game',
    gameTitle: raw.gameTitle || ctx?.gameId || 'Game',
    zone: raw.zone || ctx?.zone || 'nutrition',
    mode: raw.mode || ctx?.mode || 'solo',

    score: num(raw.score, 0),
    stars: num(raw.stars, 0),
    accuracy: num(raw.accuracy, 0),
    miss: num(raw.miss, 0),
    bestStreak: num(raw.bestStreak, 0),
    durationSec: num(raw.durationSec, num(ctx?.time, 0)),

    rank: raw.rank || '',
    success: !!raw.success,
    missionClear: num(raw.missionClear, 0),
    missionTotal: num(raw.missionTotal, 0),
    contribution: num(raw.contribution, 0),

    playerResult: raw.playerResult || null,
    opponentResult: raw.opponentResult || null,
    teamResult: raw.teamResult || null,

    badges: arr(raw.badges),
    rewards: arr(raw.rewards),
    coachFeedback: arr(raw.coachFeedback),
    nextAction: raw.nextAction || '',
    metrics: raw.metrics || {},
    research: raw.research || {}
  };

  return summary;
}

export function persistSummary(ctx, raw = {}) {
  const summary = normalizeSummary(ctx, raw);
  saveLastSummary(ctx, summary);
  markZonePlayed(ctx, {
    summary: {
      score: summary.score,
      stars: summary.stars,
      success: summary.success,
      mode: summary.mode
    }
  });
  return summary;
}

export function buildSummaryHtml(summary) {
  const feedback = summary.coachFeedback
    .slice(0, 3)
    .map((line) => `<li>${escapeHtml(String(line))}</li>`)
    .join('');

  const rewards = summary.rewards
    .slice(0, 4)
    .map((line) => `<span class="hnzs-chip">${escapeHtml(String(line))}</span>`)
    .join('');

  return `
    <div class="hnzs-summary-card">
      <div class="hnzs-summary-top">
        <div>
          <div class="hnzs-kicker">${escapeHtml(summary.mode.toUpperCase())}</div>
          <h2>${escapeHtml(summary.gameTitle)}</h2>
        </div>
        <div class="hnzs-score-pill">${summary.score}</div>
      </div>

      <div class="hnzs-summary-grid">
        <div><strong>Stars</strong><span>${summary.stars}</span></div>
        <div><strong>Accuracy</strong><span>${summary.accuracy}%</span></div>
        <div><strong>Miss</strong><span>${summary.miss}</span></div>
        <div><strong>Best Streak</strong><span>${summary.bestStreak}</span></div>
      </div>

      ${rewards ? `<div class="hnzs-chip-row">${rewards}</div>` : ''}
      ${feedback ? `<ul class="hnzs-feedback">${feedback}</ul>` : ''}
      ${summary.nextAction ? `<p class="hnzs-next">${escapeHtml(summary.nextAction)}</p>` : ''}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}