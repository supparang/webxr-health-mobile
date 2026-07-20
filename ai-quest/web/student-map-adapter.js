(function(global){
  'use strict';

  function setCardState(card, state) {
    card.dataset.state = state;
    card.classList.remove('is-locked','is-available','is-passed','is-current');

    if (state === 'passed') card.classList.add('is-passed');
    if (state === 'available') card.classList.add('is-available');
    if (state === 'current') card.classList.add('is-current');
    if (state === 'locked') card.classList.add('is-locked');

    card.disabled = state === 'locked';
    card.setAttribute('aria-disabled', state === 'locked' ? 'true' : 'false');

    var status = card.querySelector('[data-role="status"]');
    if (status) {
      status.textContent =
        state === 'passed' ? 'ผ่านแล้ว' :
        state === 'current' ? 'พร้อมเรียนต่อ' :
        state === 'available' ? 'เปิดแล้ว' : 'ล็อก';
    }
  }

  global.AIQ3RenderMap = function(progress) {
    progress = progress || {};
    var completed = new Set(progress.completedNodes || []);
    var unlocked = new Set(progress.unlockedNodes || []);
    var current = progress.currentNode || 'S1';

    document.querySelectorAll('[data-aiq-node]').forEach(function(card){
      var node = String(card.dataset.aiqNode || '').toUpperCase();
      var state =
        completed.has(node) ? 'passed' :
        node === current ? 'current' :
        unlocked.has(node) ? 'available' : 'locked';
      setCardState(card, state);
    });

    var pct = document.querySelector('[data-role="course-progress"]');
    if (pct) pct.textContent = Number(progress.courseProgressPct || 0) + '%';
  };
})(window);
