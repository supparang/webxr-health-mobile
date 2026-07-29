/* CSAI2601 UX Quest • Post-Mission Studio Router v1
 * Prevents a passed Mission from being rendered/started again when the learner
 * chooses Studio Practice. Front-end routing only; Google Sheet remains the
 * official authority for completion and unlocking.
 */
(() => {
  'use strict';

  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const KEY = NODE.toLowerCase();
  const STYLE_ID = 'uxq-post-mission-studio-router-v1-style';
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
    if (new URLSearchParams(location.search || '').get('phase') === 'studio') return 'studio';
    try { return sessionStorage.getItem(PHASE_KEY) === 'studio' ? 'studio' : ''; }
    catch (_) { return ''; }
  }

  function setStudioPhase() {
    try { sessionStorage.setItem(PHASE_KEY, 'studio'); } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.set('phase', 'studio');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
    document.body.dataset.uxqRoutePhase = 'studio';
    apply();
    requestAnimationFrame(() => {
      const studio = studioRoot();
      studio?.scrollIntoView({behavior:'smooth', block:'start'});
      window.UXQStudentStudioFinalAuthorityV2?.build?.();
    });
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body[data-uxq-route-phase='studio'] #uxqCanonicalNode > .shell > .panel,
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

  function replaceStudioCTA() {
    if (!missionPassed()) return;
    const controls = Array.from(ROOT.querySelectorAll('a,button'));
    controls.forEach(control => {
      const text = String(control.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/ทำ\s*Studio Practice\s*ต่อ|ไปทำ\s*Studio Practice/i.test(text)) return;
      if (control.dataset.uxqCleanStudioRoute === '1') return;

      const replacement = document.createElement('button');
      replacement.type = 'button';
      replacement.className = control.className;
      replacement.textContent = 'ทำ Studio Practice ต่อ →';
      replacement.dataset.uxqCleanStudioRoute = '1';
      replacement.setAttribute('aria-label', `ทำ Studio Practice ${NODE} ต่อ`);
      replacement.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setStudioPhase();
      }, true);
      control.replaceWith(replacement);
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
    if (studio) {
      markMissionPanel();
      window.UXQStudentStudioFinalAuthorityV2?.build?.();
    }
  }

  function apply() {
    queued = false;
    installStyle();
    markMissionPanel();
    replaceStudioCTA();
    suppressMissionReplayControls();
    normalizePhase();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, {once:true});
  else queue();

  new MutationObserver(queue).observe(ROOT, {childList:true, subtree:true, characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored'].forEach(name => window.addEventListener(name, queue));
  [150,500,1100,2200].forEach(ms => setTimeout(queue, ms));

  window.UXQPostMissionStudioRouterV1 = Object.freeze({
    version:'20260729-POST-MISSION-STUDIO-ROUTER-V1',
    enterStudio:setStudioPhase,
    refresh:queue
  });
})();