(() => {
  'use strict';

  const KEY = 'herohealth_learning_platform_rc2';
  const SUMMARY_ROUTE = './game-summary.html';

  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function allZonesComplete(state) {
    return ['hygiene', 'nutrition', 'fitness'].every(id => state?.completed?.[id] === true);
  }

  function summaryComplete(state) {
    return state?.completed?.gameSummary === true;
  }

  function queryForProfile(state) {
    const p = state?.profile || {};
    const q = new URLSearchParams();
    if (p.studentId) q.set('studentId', p.studentId);
    if (p.fullName) q.set('fullName', p.fullName);
    if (p.section) q.set('section', p.section);
    if (state?.group || p.group) q.set('group', state.group || p.group);
    q.set('return', location.href);
    return q.toString();
  }

  function openSummary() {
    const state = readState();
    if (!allZonesComplete(state)) {
      alert('ยังเล่นเกมไม่ครบทุกฐาน กรุณากลับไปทำภารกิจที่ยังไม่ครบ');
      return;
    }
    location.href = `${SUMMARY_ROUTE}?${queryForProfile(state)}`;
  }

  function patchPosttestButton() {
    const state = readState();
    if (!allZonesComplete(state) || summaryComplete(state) || state?.completed?.posttest) return;

    document.querySelectorAll('button').forEach(btn => {
      const label = (btn.textContent || '').trim();
      const onclick = btn.getAttribute('onclick') || '';
      if (label.includes('Post-test') || onclick.includes("openRoute('posttest')") || onclick.includes('openRoute(\'posttest\')')) {
        btn.textContent = 'ดูสรุปการเล่นทั้งหมด';
        btn.removeAttribute('onclick');
        btn.onclick = openSummary;
      }
    });

    document.querySelectorAll('p.muted').forEach(node => {
      if ((node.textContent || '').trim() === 'ทำ Post-test') {
        node.textContent = 'ตรวจสรุปผลการเล่นทั้งหมดก่อนทำ Post-test';
      }
    });
  }

  function installRouteGuard() {
    if (!window.HH || window.HH.__summaryGateInstalled) return;
    const original = window.HH.openRoute?.bind(window.HH);
    window.HH.openRoute = function(id) {
      const state = readState();
      if (id === 'summary') return openSummary();
      if (id === 'posttest' && allZonesComplete(state) && !summaryComplete(state)) return openSummary();
      return original ? original(id) : undefined;
    };
    window.HH.__summaryGateInstalled = true;
  }

  function apply() {
    installRouteGuard();
    patchPosttestButton();
  }

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('storage', apply);
  apply();
})();
