(() => {
  'use strict';

  const KEY = 'herohealth_learning_platform_rc2';
  const SUMMARY_ROUTE = './game-summary.html';
  const RELEASE = '20260805-OVERALL-SUMMARY-GATE-FIREBASE-BYPASS-R2';

  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function authorityMode() {
    const query = new URLSearchParams(location.search);
    const explicit = String(query.get('authority') || '').toLowerCase();
    if (explicit) return explicit;
    try {
      const stored = String(localStorage.getItem('HH_AUTHORITY_MODE') || sessionStorage.getItem('HH_AUTHORITY_MODE') || '').toLowerCase();
      if (stored) return stored;
    } catch (_) {}
    const state = readState();
    return String(state?.firebaseAuthority?.mode || state?.authorityMode || '').toLowerCase();
  }

  // Firebase Passport owns its own completion hydration and Post-test gate.
  // The legacy summary page is Sheet-authoritative and must never intercept
  // a Firebase session, otherwise the learner is sent to Google Sheet loading.
  if (['firebase', 'dual'].includes(authorityMode())) {
    console.info('[HeroHealth] Legacy Sheet summary gate bypassed for Firebase', RELEASE);
    return;
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
