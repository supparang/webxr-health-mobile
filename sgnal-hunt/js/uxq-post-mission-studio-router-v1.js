/* CSAI2601 UX Quest • Post-Mission Studio Router v2
 * Authoritative routing after a passed Mission. A capture-phase click guard
 * prevents legacy Mission listeners from restarting the game.
 * Front-end only; Google Sheet remains the official completion authority.
 */
(() => {
  'use strict';

  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const KEY = NODE.toLowerCase();
  const STYLE_ID = 'uxq-post-mission-studio-router-v2-style';
  const PHASE_KEY = `csai2601.uxq.phase.${KEY}`;
  let queued = false;

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function missionRecord() {
    try { return window.UXQProgress?.get?.()?.missions?.[KEY] || {}; }
    catch (_) { return {}; }
  }

  function missionPassed() {
    const row = missionRecord();
    const history = Array.isArray(row.history) ? row.history : [];
    const results = [row.lastResult || {}, ...history];
    const stars = Math.max(number(row.bestStars), ...results.map(item => number(item?.stars)));
    return Boolean(row.completed || results.some(item => item?.passed === true) || stars >= 2);
  }

  function requestedPhase() {
    const current = new URLSearchParams(location.search || '').get('phase');
    if (current === 'studio' || current === 'reflection') return current;
    try { return sessionStorage.getItem(PHASE_KEY) || ''; }
    catch (_) { return ''; }
  }

  function studioUrl() {
    const url = new URL(location.href);
    url.searchParams.set('phase', 'studio');
    url.searchParams.set('v', 'unified-runtime-v8-20260729');
    return url.pathname + url.search + url.hash;
  }

  function enterStudio() {
    if (!missionPassed()) return;
    try { sessionStorage.setItem(PHASE_KEY, 'studio'); } catch (_) {}
    location.assign(studioUrl());
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body[data-uxq-route-phase='studio'] #uxqCanonicalNode .panel[data-uxq-mission-panel='1'],
      body[data-uxq-route-phase='studio'] #uxqCanonicalNode [data-uxq-mission-runtime='1']{
        display:none!important
      }
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1],
      body[data-uxq-route-phase='studio'] [data-studio-wizard],
      body[data-uxq-route-phase='studio'] .uxq-pr{
        display:block!important
      }
      body[data-uxq-route-phase='studio'] [data-uxq-replay-control='1'],
      body[data-uxq-route-phase='studio'] [data-uxq-mission-start-control='1']{
        display:none!important
      }
    `;
    document.head.appendChild(style);
  }

  function missionPanel() {
    const candidates = Array.from(ROOT.querySelectorAll('.panel'));
    return candidates.find(panel => panel.querySelector('.hero,.game,.results,.hud,.question')) || null;
  }

  function studioRoot() {
    return document.getElementById('uxqStudentStudioFinalV2')
      || ROOT.querySelector('.artifact[data-studio-practice-v1]')
      || ROOT.querySelector('[data-studio-wizard],.uxq-pr');
  }

  function markMissionPanel() {
    const panel = missionPanel();
    if (panel) panel.dataset.uxqMissionPanel = '1';
  }

  function isStudioCTA(control) {
    const text = String(control?.textContent || '').replace(/\s+/g, ' ').trim();
    return /ทำ\s*Studio Practice\s*ต่อ|ไปทำ\s*Studio Practice|เริ่มทำ\s*Studio Practice/i.test(text);
  }

  function normalizeStudioCTA() {
    if (!missionPassed()) return;
    ROOT.querySelectorAll('a,button').forEach(control => {
      if (!isStudioCTA(control)) return;
      control.dataset.uxqCleanStudioRoute = '1';
      control.setAttribute('role', 'button');
      control.setAttribute('aria-label', `ทำ Studio Practice ${NODE} ต่อ`);
      if (control.tagName === 'A') control.setAttribute('href', studioUrl());
    });
  }

  function suppressMissionReplayControls() {
    if (!missionPassed()) return;
    ROOT.querySelectorAll('a,button').forEach(control => {
      const text = String(control.textContent || '').replace(/\s+/g, ' ').trim();
      if (/เล่นซ้ำด้วย\s*case\s*ใหม่|เริ่ม\s*W\d+|เริ่ม\s*B\d+|เริ่ม\s*Mission/i.test(text)) {
        control.dataset.uxqReplayControl = '1';
      }
    });
  }

  function normalizePhase() {
    const studio = requestedPhase() === 'studio' && missionPassed();
    document.body.dataset.uxqRoutePhase = studio ? 'studio' : 'summary';
    if (!studio) return;
    markMissionPanel();
    window.UXQStudentStudioFinalAuthorityV2?.build?.();
    requestAnimationFrame(() => studioRoot()?.scrollIntoView({block:'start'}));
  }

  function captureStudioRoute(event) {
    const control = event.target?.closest?.('a,button');
    if (!control || !isStudioCTA(control) || !missionPassed()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    enterStudio();
  }

  function apply() {
    queued = false;
    installStyle();
    markMissionPanel();
    normalizeStudioCTA();
    suppressMissionReplayControls();
    normalizePhase();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener('click', captureStudioRoute, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, {once:true});
  else queue();

  new MutationObserver(queue).observe(ROOT, {childList:true, subtree:true, characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored'].forEach(name => window.addEventListener(name, queue));
  [100,350,800,1600,3000].forEach(ms => setTimeout(queue, ms));

  window.UXQPostMissionStudioRouterV1 = Object.freeze({
    version:'20260729-POST-MISSION-STUDIO-ROUTER-V2',
    enterStudio,
    refresh:queue
  });
})();