/* =========================================================
 * CSAI2601 UX Quest • Completed Node Exit Guard v2
 * Google Sheet is the sole authority.
 * Completed nodes must not reopen editable Mission/Studio forms.
 * replay=1 or practice=1 explicitly allows practice.
 * review=1 explicitly allows read-only review.
 * ========================================================= */
(() => {
  'use strict';

  const VERSION = '20260727-COMPLETED-NODE-EXIT-GUARD-V2-MOBILE';
  const params = new URLSearchParams(location.search || '');
  const node = String(params.get('node') || '').trim().toUpperCase();
  const nodeKey = node.toLowerCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(node)) return;
  if (params.get('replay') === '1' || params.get('practice') === '1' || params.get('review') === '1') return;

  let redirected = false;
  let observer = null;
  let intervalId = 0;

  function bool(value) {
    const text = String(value == null ? '' : value).trim().toLowerCase();
    return value === true || value === 1 || ['1','true','yes','passed','complete','completed','submitted','approved'].includes(text);
  }

  function directComplete() {
    const direct = window.UXQDirectStudioConfirmed;
    if (!direct || String(direct.nodeKey || '').toLowerCase() !== nodeKey) return false;
    return Boolean(direct.confirmed && direct.studioDone && direct.reflectionDone);
  }

  function progressComplete() {
    let progress = {};
    try { progress = window.UXQProgress?.get?.() || {}; } catch (_) {}
    const row = progress?.missions?.[nodeKey] || progress?.missions?.[node] || {};
    const mission = bool(row.completed || row.passed) || Number(row.bestStars || row.stars || 0) >= 2;
    const studio = bool(row.studioSubmitted || row.artifactSubmitted || row.submitted);
    const reflection = bool(row.reflectionSubmitted || row.hasReflection) || String(row.reflection || '').trim().length > 0;
    return mission && studio && reflection;
  }

  function trackerComplete() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) return false;
    const count = String(tracker.querySelector('.uxq-3part__count')?.textContent || tracker.textContent || '');
    const doneCards = tracker.querySelectorAll('.uxq-3part__item[data-state="done"], [data-state="done"]').length;
    return /3\s*\/\s*3/.test(count) && doneCards >= 3;
  }

  function pageAuthorityComplete() {
    const text = String(document.body?.innerText || '').replace(/\s+/g, ' ');
    const nodePattern = new RegExp(`Google Sheet\\s*ยืนยัน\\s*${node}\\s*แล้ว`, 'i');
    const completePattern = /ครบ(?:ทั้ง)?\s*3\s*ส่วน|Complete\s*3\s*\/\s*3|3\s*\/\s*3\s*ยืนยันจากระบบ/i;
    return nodePattern.test(text) && completePattern.test(text);
  }

  function isAuthoritativelyComplete() {
    return directComplete() || progressComplete() || trackerComplete() || pageAuthorityComplete();
  }

  function missionControlUrl() {
    const target = new URL('./csai2601-mission-control.html', location.href);
    ['studentId','studentName','section','classroom','courseId','sheet','api','sid','name','device'].forEach(key => {
      const value = params.get(key);
      if (value) target.searchParams.set(key, value);
    });
    target.searchParams.set('completed', node);
    target.searchParams.set('v', 'completed-exit-v2-20260727');
    return target.href;
  }

  function redirect() {
    if (redirected) return;
    redirected = true;
    if (observer) observer.disconnect();
    clearInterval(intervalId);
    document.documentElement.dataset.uxqCompletedExit = '1';
    location.replace(missionControlUrl());
  }

  function check() {
    if (!redirected && isAuthoritativelyComplete()) redirect();
  }

  function attach() {
    check();
    if (redirected) return;
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['data-state','data-complete','data-submitted']
    });
    intervalId = window.setInterval(check, 400);
  }

  [
    'uxq-direct-studio-confirmed','uxq-progress-updated','uxq-sheet-progress-restored',
    'uxq-cloud-progress-restored','uxq-progress-restored','uxq-three-part-updated',
    'uxq-studio-confirmed','uxq-reflection-confirmed'
  ].forEach(name => window.addEventListener(name, check));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once:true });
  else attach();

  window.UXQCompletedNodeExitGuardV1 = Object.freeze({ version:VERSION, node, check, isAuthoritativelyComplete });
})();