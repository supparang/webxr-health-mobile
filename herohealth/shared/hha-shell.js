/* /herohealth/shared/hha-shell.js */

export function hhaRenderPills(items = [], className = 'brief-pill') {
  return items
    .filter(Boolean)
    .map(text => `<div class="${className}">${text}</div>`)
    .join('');
}

export function hhaRenderRewardGrid(cards = [], className = 'reward-grid') {
  if (!cards.length) return '';
  return `
    <div class="${className}">
      ${cards.map(card => `
        <div class="reward-chip">
          <span class="k">${card.k}</span>
          <span class="v">${card.v}</span>
        </div>
      `).join('')}
    </div>
  `;
}

export function hhaRenderActionButtons(buttons = [], wrapClass = 'summary-actions') {
  return `
    <div class="${wrapClass}">
      ${buttons.map(btn => `
        <button id="${btn.id}" class="${btn.className}" type="button">
          ${btn.label}
        </button>
      `).join('')}
    </div>
  `;
}

export function hhaRenderSummaryShell({
  title = 'Summary',
  starsText = '',
  rankHtml = '',
  resultPill = '',
  intro = '',
  rewardGridHtml = '',
  rewardBadgesHtml = '',
  statsPillsHtml = '',
  body = [],
  actionsHtml = ''
} = {}) {
  return `
    <div class="summary-card hha-summary-shell">
      <h2 class="summary-title hha-summary-title">${title}</h2>
      ${starsText ? `<div class="summary-stars hha-summary-stars">${starsText}</div>` : ''}
      ${rankHtml || ''}
      ${resultPill ? `<div class="result-pill">${resultPill}</div>` : ''}
      ${intro ? `<p class="summary-text hha-copy">${intro}</p>` : ''}
      ${rewardGridHtml || ''}
      ${rewardBadgesHtml ? `<div class="reward-badges">${rewardBadgesHtml}</div>` : ''}
      ${statsPillsHtml ? `<div class="brief-stats">${statsPillsHtml}</div>` : ''}
      ${body.map(t => `<p class="summary-text hha-copy">${t}</p>`).join('')}
      ${actionsHtml || ''}
    </div>
  `;
}