export function hhaSetText(el, text = '') {
  if (!el) return;
  el.textContent = text == null ? '' : String(text);
}

export function hhaSetTimerChip(chipEl, valueEl, sec = 0, hide = false) {
  if (!chipEl || !valueEl) return;

  if (hide) {
    chipEl.classList.add('hidden');
    chipEl.classList.remove('is-warn', 'is-danger');
    valueEl.textContent = '0';
    return;
  }

  chipEl.classList.remove('hidden');
  valueEl.textContent = String(Math.max(0, Math.ceil(sec)));
  chipEl.classList.remove('is-warn', 'is-danger');

  if (sec <= 3) chipEl.classList.add('is-danger');
  else if (sec <= 6) chipEl.classList.add('is-warn');
}

export function hhaSetDirectorChip(el, label = 'AI ปกติ', mode = 'normal') {
  if (!el) return;
  el.textContent = label || 'AI ปกติ';
  el.classList.remove('is-assist', 'is-challenge');

  if (mode === 'assist') el.classList.add('is-assist');
  else if (mode === 'challenge') el.classList.add('is-challenge');
}

export function hhaSetCoachHint(el, text = 'พร้อมช่วยเสมอ', mood = 'normal') {
  if (!el) return;
  el.textContent = text || 'พร้อมช่วยเสมอ';
  el.classList.remove('is-good', 'is-warn', 'is-alert');

  if (mood === 'good') el.classList.add('is-good');
  else if (mood === 'warn') el.classList.add('is-warn');
  else if (mood === 'alert') el.classList.add('is-alert');
}

export function hhaSetActiveButtons(buttonMap = {}, activeKey = '') {
  Object.keys(buttonMap || {}).forEach(key => {
    const el = buttonMap[key];
    if (!el) return;
    el.classList.toggle('active', key === activeKey);
  });
}

export function hhaSetDisabledPhase(buttonMap = {}, disabled = false) {
  Object.keys(buttonMap || {}).forEach(key => {
    const el = buttonMap[key];
    if (!el) return;
    el.classList.toggle('is-disabled-phase', !!disabled);
  });
}

export function hhaShake(node, className = 'shake', durationMs = 380) {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);

  setTimeout(() => {
    node.classList.remove(className);
  }, durationMs);
}

export function hhaSpawnFloatingScore(container, {
  x = 0,
  y = 0,
  text = '+10',
  kind = 'good',
  className = 'floating-score',
  lifeMs = 860
} = {}) {
  if (!container) return null;

  const pop = document.createElement('div');
  pop.className = `${className} ${kind}`;
  pop.textContent = text;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  container.appendChild(pop);
  setTimeout(() => pop.remove(), lifeMs);
  return pop;
}

export function hhaShowBurst(container, {
  text = 'Combo!',
  className = 'combo-burst',
  lifeMs = 820
} = {}) {
  if (!container) return null;

  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;

  container.appendChild(node);
  setTimeout(() => node.remove(), lifeMs);
  return node;
}

export function hhaShowPhaseFlash(container, {
  title = 'Phase Clear!',
  sub = '',
  className = 'phase-flash',
  cardClassName = 'phase-flash-card',
  titleClassName = 'phase-flash-title',
  subClassName = 'phase-flash-sub',
  lifeMs = 760
} = {}) {
  if (!container) return null;

  const wrap = document.createElement('div');
  wrap.className = className;
  wrap.innerHTML = `
    <div class="${cardClassName}">
      <div class="${titleClassName}">${title}</div>
      ${sub ? `<div class="${subClassName}">${sub}</div>` : ''}
    </div>
  `;

  container.appendChild(wrap);
  setTimeout(() => wrap.remove(), lifeMs);
  return wrap;
}

export function hhaSpawnIconBurst(container, {
  count = 10,
  icons = ['⭐', '✨'],
  className = 'win-burst',
  itemClassName = 'win-star',
  leftRange = [10, 90],
  topRange = [45, 70],
  staggerMs = 40,
  lifeMs = 1100
} = {}) {
  if (!container) return null;

  const wrap = document.createElement('div');
  wrap.className = className;

  for (let i = 0; i < count; i++) {
    const n = document.createElement('div');
    n.className = itemClassName;
    n.textContent = icons[i % icons.length];
    n.style.left = `${leftRange[0] + Math.random() * (leftRange[1] - leftRange[0])}%`;
    n.style.top = `${topRange[0] + Math.random() * (topRange[1] - topRange[0])}%`;
    n.style.animationDelay = `${(i * staggerMs) / 1000}s`;
    wrap.appendChild(n);
  }

  container.appendChild(wrap);
  setTimeout(() => wrap.remove(), lifeMs);
  return wrap;
}

export function hhaBuildSummaryRank(rank = 'C') {
  const cls = `summary-rank rank-${String(rank).toLowerCase()}`;
  return `<div class="${cls}">${rank}</div>`;
}

export function hhaBuildRewardBadges(allBadges = [], newly = []) {
  if (!allBadges.length) {
    return '<div class="reward-badge">ยังไม่มี badge</div>';
  }

  const newIds = new Set((newly || []).map(x => x.id));

  return allBadges.map(b => `
    <div class="reward-badge ${newIds.has(b.id) ? 'is-new' : ''}">
      <span>${b.emoji}</span> ${b.label}
    </div>
  `).join('');
}