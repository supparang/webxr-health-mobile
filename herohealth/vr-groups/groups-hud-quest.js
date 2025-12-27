(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const $ = (id)=> DOC.getElementById(id);

  const E = {
    goalTitle: $('hud-goal-title'),
    goalVal: $('hud-goal-val'),
    goalBar: $('hud-goal-bar'),

    miniLine: $('hud-mini-line'),
    miniTitle: $('hud-mini-title'),
    miniVal: $('hud-mini-val'),
    miniBar: $('hud-mini-bar'),
    miniTimer: $('hud-mini-timer')
  };

  function pct(n,d){
    d = Math.max(1, d|0);
    n = Math.max(0, n|0);
    return Math.max(0, Math.min(100, (n/d)*100));
  }

  function apply(q){
    q = q || {};

    // GOAL
    if (E.goalTitle) E.goalTitle.textContent = q.goalTitle || q.title || '—';
    if (E.goalVal) E.goalVal.textContent = (q.goalNow ?? 0) + '/' + (q.goalNeed ?? 0);
    if (E.goalBar) E.goalBar.style.width = pct(q.goalNow, q.goalNeed).toFixed(1) + '%';

    // MINI
    const hasMini = !!q.miniTitle;
    if (E.miniLine) E.miniLine.classList.toggle('mini-urgent', !!q.miniUrgent);

    if (!hasMini){
      if (E.miniTitle) E.miniTitle.textContent = '—';
      if (E.miniVal) E.miniVal.textContent = '0/0';
      if (E.miniBar) E.miniBar.style.width = '0%';
      if (E.miniTimer) E.miniTimer.textContent = '';
      return;
    }

    if (E.miniTitle) E.miniTitle.textContent = q.miniTitle || '—';
    if (E.miniVal) E.miniVal.textContent = (q.miniNow ?? 0) + '/' + (q.miniNeed ?? 0);
    if (E.miniBar) E.miniBar.style.width = pct(q.miniNow, q.miniNeed).toFixed(1) + '%';

    if (E.miniTimer){
      if (typeof q.miniLeftSec === 'number'){
        E.miniTimer.textContent = 'เหลือ ' + (q.miniLeftSec|0) + 's';
      } else {
        E.miniTimer.textContent = '';
      }
    }
  }

  root.addEventListener('quest:update', (ev)=> apply(ev.detail || {}), { passive:true });

  // init blank
  apply({ goalTitle:'—', goalNow:0, goalNeed:0, miniTitle:'—', miniNow:0, miniNeed:0 });
})(window);