/* CSAI2601 UX Quest • Post-Mission Studio Router v3
 * Routes a passed Mission directly into Studio Practice without restarting the
 * Mission. Hides only Mission-specific elements, never their shared parent.
 * Front-end only; Google Sheet remains the official completion authority.
 */
(() => {
  'use strict';

  const initial = new URLSearchParams(location.search || '');
  if (initial.get('contentPreview') === '1' || /^content-preview/i.test(initial.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(initial.get('node') || initial.get('id') || 'W1').trim().toUpperCase();
  const KEY = NODE.toLowerCase();
  const PHASE_KEY = `csai2601.uxq.phase.${KEY}`;
  const STYLE_ID = 'uxq-post-mission-studio-router-v3-style';
  const FALLBACK_ID = 'uxqStudioRouteFallback';
  let queued = false;
  let studioAttempts = 0;

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
    const phase = new URLSearchParams(location.search || '').get('phase');
    if (phase === 'studio' || phase === 'reflection') return phase;
    try { return sessionStorage.getItem(PHASE_KEY) || ''; }
    catch (_) { return ''; }
  }

  function studioUrl() {
    const url = new URL(location.href);
    url.searchParams.set('phase', 'studio');
    url.searchParams.set('v', 'unified-runtime-v9-20260729');
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
      body[data-uxq-route-phase='studio'] [data-uxq-mission-only='1']{display:none!important}
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1],
      body[data-uxq-route-phase='studio'] [data-studio-wizard],
      body[data-uxq-route-phase='studio'] .uxq-pr{
        display:grid!important;
        visibility:visible!important;
        opacity:1!important
      }
      body[data-uxq-route-phase='studio'] #uxqStudioRouteFallback{
        width:min(920px,calc(100% - 24px));margin:28px auto;padding:22px;
        border:1px solid rgba(110,231,255,.35);border-radius:20px;
        background:linear-gradient(145deg,rgba(18,52,94,.9),rgba(24,25,76,.92));
        color:#eef6ff;text-align:center
      }
      #uxqStudioRouteFallback h2{margin:0 0 8px;font-size:clamp(1.35rem,3vw,1.8rem)}
      #uxqStudioRouteFallback p{margin:0;color:#b8c8e2;line-height:1.6}
      #uxqStudioRouteFallback button{margin-top:14px;min-height:46px;padding:10px 16px;border:0;border-radius:12px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;font-weight:900;cursor:pointer}
      body[data-uxq-route-phase='studio'] [data-uxq-replay-control='1'],
      body[data-uxq-route-phase='studio'] [data-uxq-mission-start-control='1']{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function studioRoot() {
    return document.getElementById('uxqStudentStudioFinalV2')
      || ROOT.querySelector('.artifact[data-studio-practice-v1]')
      || ROOT.querySelector('[data-studio-wizard],.uxq-pr');
  }

  function missionPanel() {
    const candidates = Array.from(ROOT.querySelectorAll('.panel'));
    return candidates.find(panel => panel.querySelector('.hero,.game,.results,.hud,.question')) || null;
  }

  function markMissionOnlyElements() {
    const panel = missionPanel();
    if (!panel) return;
    const studio = studioRoot();
    const candidates = panel.querySelectorAll('.hero,.game,.results,.hud');
    candidates.forEach(el => {
      if (studio && (el === studio || el.contains(studio) || studio.contains(el))) return;
      el.dataset.uxqMissionOnly = '1';
    });
    panel.querySelectorAll('a,button').forEach(control => {
      const text = String(control.textContent || '').replace(/\s+/g,' ').trim();
      if (/เล่นซ้ำด้วย\s*case\s*ใหม่|เริ่ม\s*W\d+|เริ่ม\s*B\d+|เริ่ม\s*Mission/i.test(text)) {
        control.dataset.uxqMissionOnly = '1';
        control.dataset.uxqReplayControl = '1';
      }
    });
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
      control.setAttribute('aria-label', `ทำ Studio Practice ${NODE} ต่อ`);
      if (control.tagName === 'A') control.setAttribute('href', studioUrl());
    });
  }

  function fallback() {
    let card = document.getElementById(FALLBACK_ID);
    if (card) return card;
    card = document.createElement('section');
    card.id = FALLBACK_ID;
    card.innerHTML = `<h2>กำลังเปิด Studio Practice • ${NODE}</h2><p>กำลังเตรียมแบบฝึกและข้อมูล Project โดยไม่เริ่ม Mission ใหม่</p><button type="button">ลองเปิด Studio อีกครั้ง</button>`;
    card.querySelector('button').addEventListener('click', () => ensureStudio(true));
    const shell = ROOT.querySelector('.shell') || ROOT;
    shell.appendChild(card);
    return card;
  }

  function ensureStudio(force = false) {
    if (requestedPhase() !== 'studio' || !missionPassed()) return;
    document.body.dataset.uxqMissionPass = '1';
    document.body.dataset.uxqRoutePhase = 'studio';

    window.UXQStudentStudioFinalAuthorityV2?.build?.();
    markMissionOnlyElements();

    const studio = studioRoot();
    if (studio) {
      studio.removeAttribute('hidden');
      studio.style.removeProperty('display');
      document.getElementById(FALLBACK_ID)?.remove();
      requestAnimationFrame(() => studio.scrollIntoView({block:'start'}));
      return;
    }

    studioAttempts += 1;
    fallback();
    if (force || studioAttempts < 12) {
      setTimeout(() => {
        window.UXQStudentStudioFinalAuthorityV2?.build?.();
        queue();
      }, Math.min(250 + studioAttempts * 120, 1200));
    }
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
    normalizeStudioCTA();
    const studioPhase = requestedPhase() === 'studio' && missionPassed();
    document.body.dataset.uxqRoutePhase = studioPhase ? 'studio' : 'summary';
    if (studioPhase) ensureStudio();
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
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(name => window.addEventListener(name, queue));
  [100,350,800,1500,2600,4200].forEach(ms => setTimeout(queue, ms));

  window.UXQPostMissionStudioRouterV1 = Object.freeze({
    version:'20260729-POST-MISSION-STUDIO-ROUTER-V3',
    enterStudio,
    refresh:queue,
    ensureStudio
  });
})();