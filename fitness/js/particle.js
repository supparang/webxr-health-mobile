// === fitness/js/particle.js (NEW — snap-to-target) ===
'use strict';

export function spawnHitParticle(parent, targetEl, score=0, type='normal') {
  if (!parent || !targetEl) return;

  const rectHost = parent.getBoundingClientRect();
  const rectT    = targetEl.getBoundingClientRect();

  const x = rectT.left - rectHost.left + rectT.width / 2;
  const y = rectT.top  - rectHost.top  + rectT.height / 2;

  const fx = document.createElement('div');
  fx.className = 'sb-fx-score';

  if (type === 'perfect') fx.classList.add('sb-perfect');
  if (type === 'good')    fx.classList.add('sb-good');
  if (type === 'miss')    fx.classList.add('sb-miss');

  fx.textContent =
    type === 'miss'
      ? 'MISS'
      : (score > 0 ? '+' + score : score);

  fx.style.left = x + 'px';
  fx.style.top  = y + 'px';

  parent.appendChild(fx);

  setTimeout(() => fx.remove(), 600);
}