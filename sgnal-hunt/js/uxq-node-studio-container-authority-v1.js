/* CSAI2601 UX Quest • Node Studio Container Authority v8
 * Repairs phase=studio, enforces one clear action path, and guarantees
 * bidirectional page scrolling even when legacy runtimes install scroll locks.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  if (!document.querySelector('script[data-uxq-sheet-display-final]')) {
    const script = document.createElement('script');
    script.src = './js/uxq-node-sheet-display-final-authority-v1.js?v=node-sheet-display-final-v4-20260731';
    script.async = false;
    script.dataset.uxqSheetDisplayFinal = '1';
    document.head.appendChild(script);
  }

  if (q.get('phase') !== 'studio') return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  let running = false;
  let attempts = 0;
  let touchY = null;
  let recoveryInstalled = false;

  function missionConfirmed() {
    const sheet = window.UXQNodeSheetAuthority;
    if (sheet && sheet.nodeId === NODE) return sheet.missionPassed === true;
    return document.body.dataset.uxqSheetMission === '1' || document.body.dataset.uxqMissionPass === '1';
  }

  function scroller() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function isEditable(target) {
    return Boolean(target && target.closest && target.closest('textarea,input,select,[contenteditable="true"]'));
  }

  function restoreScroll() {
    const html = document.documentElement;
    const body = document.body;

    if (html) {
      html.style.setProperty('overflow-x', 'hidden', 'important');
      html.style.setProperty('overflow-y', 'scroll', 'important');
      html.style.setProperty('height', 'auto', 'important');
      html.style.setProperty('min-height', '100%', 'important');
      html.style.setProperty('max-height', 'none', 'important');
      html.style.setProperty('position', 'relative', 'important');
      html.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      html.style.setProperty('overscroll-behavior-y', 'auto', 'important');
      html.style.setProperty('scroll-behavior', 'auto', 'important');
    }

    if (body) {
      body.style.setProperty('overflow', 'visible', 'important');
      body.style.setProperty('height', 'auto', 'important');
      body.style.setProperty('min-height', '100vh', 'important');
      body.style.setProperty('max-height', 'none', 'important');
      body.style.setProperty('position', 'relative', 'important');
      body.style.removeProperty('top');
      body.style.removeProperty('left');
      body.style.removeProperty('right');
      body.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      body.style.setProperty('overscroll-behavior-y', 'auto', 'important');
    }

    [ROOT,
      ROOT.querySelector('.shell'),
      ROOT.querySelector('.panel'),
      ROOT.querySelector('.artifact[data-studio-practice-v1]'),
      document.getElementById('uxqStudentStudioFinalV2')
    ].filter(Boolean).forEach(el => {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('position', 'relative', 'important');
      el.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      el.style.setProperty('overscroll-behavior-y', 'auto', 'important');
    });
  }

  function installInputScrollRecovery() {
    if (recoveryInstalled) return;
    recoveryInstalled = true;

    window.addEventListener('wheel', event => {
      if (isEditable(event.target)) return;
      const root = scroller();
      if (!root || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      root.scrollTop += event.deltaY;
    }, { capture: true, passive: false });

    window.addEventListener('touchstart', event => {
      if (isEditable(event.target)) {
        touchY = null;
        return;
      }
      touchY = event.touches && event.touches[0] ? event.touches[0].clientY : null;
    }, { capture: true, passive: true });

    window.addEventListener('touchmove', event => {
      if (touchY == null || isEditable(event.target)) return;
      const point = event.touches && event.touches[0];
      if (!point) return;
      const delta = touchY - point.clientY;
      touchY = point.clientY;
      if (!delta) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const root = scroller();
      if (root) root.scrollTop += delta;
    }, { capture: true, passive: false });

    window.addEventListener('touchend', () => { touchY = null; }, { capture: true, passive: true });
    window.addEventListener('touchcancel', () => { touchY = null; }, { capture: true, passive: true });
  }

  function installStyle() {
    if (document.getElementById('uxq-node-studio-container-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-node-studio-container-authority-style';
    style.textContent = `
      html{overflow-x:hidden!important;overflow-y:scroll!important;height:auto!important;max-height:none!important;position:relative!important;touch-action:pan-y pinch-zoom!important;scroll-behavior:auto!important}
      body{overflow:visible!important;height:auto!important;min-height:100vh!important;max-height:none!important;position:relative!important;touch-action:pan-y pinch-zoom!important}
      body[data-uxq-route-phase='studio'] #uxqCanonicalNode{overflow:visible!important;height:auto!important;max-height:none!important;min-height:100vh!important;position:relative!important}
      body[data-uxq-route-phase='studio'] .results{display:none!important}
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{display:grid!important;visibility:visible!important;opacity:1!important;width:min(1120px,calc(100% - 28px));margin:28px auto;padding:20px;border:1px solid rgba(110,231,255,.34);border-radius:22px;background:linear-gradient(145deg,rgba(12,38,77,.98),rgba(22,25,77,.98));box-shadow:0 20px 50px rgba(0,0,0,.28);min-height:220px;height:auto!important;max-height:none!important;overflow:visible!important;position:relative!important;touch-action:pan-y pinch-zoom!important}
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__panel,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__card{height:auto!important;max-height:none!important;overflow:visible!important;position:relative!important;touch-action:pan-y pinch-zoom!important}
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1][data-uxq-building='1']::before{content:'กำลังเตรียม Studio Practice…';display:grid;place-items:center;min-height:170px;color:#d9e8ff;font-weight:900;font-size:1.1rem}
      body[data-uxq-route-phase='studio'] [data-uxq-summary-only='1']{display:none!important;visibility:hidden!important;pointer-events:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 button,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 a{pointer-events:auto!important}
    `;
    document.head.appendChild(style);
  }

  function hideSummaryActions() {
    document.querySelectorAll('a,button').forEach(control => {
      if (control.closest('#uxqStudentStudioFinalV2,.artifact[data-studio-practice-v1]')) return;
      const label = String(control.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^ทำ\s*Studio Practice(?:\s*[•·-]\s*[WB]\d+)?$/i.test(label) &&
          !/เล่น\s*Mission\s*ซ้ำ|เล่นซ้ำเพื่อฝึกเพิ่มเติม/i.test(label)) return;
      control.dataset.uxqSummaryOnly = '1';
      control.setAttribute('aria-hidden', 'true');
      control.tabIndex = -1;
      const wrapper = control.closest('.uxq-final-primary-action,#uxqRuntimeNextCard,.uxq-runtime-next-card,.actions,.result-actions,.hero-actions');
      if (wrapper && !wrapper.closest('#uxqStudentStudioFinalV2,.artifact[data-studio-practice-v1]')) wrapper.dataset.uxqSummaryOnly = '1';
    });
  }

  function ensureArtifact() {
    let artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (artifact) return artifact;
    artifact = document.createElement('section');
    artifact.className = 'artifact';
    artifact.dataset.studioPracticeV1 = '1';
    artifact.dataset.uxqBuilding = '1';
    artifact.setAttribute('aria-label', `Studio Practice ${NODE}`);
    (ROOT.querySelector('.shell,.panel') || ROOT).appendChild(artifact);
    return artifact;
  }

  function build() {
    if (running || !missionConfirmed()) return;
    running = true;
    attempts += 1;
    try {
      installStyle();
      installInputScrollRecovery();
      document.body.dataset.uxqMissionPass = '1';
      document.body.dataset.uxqRoutePhase = 'studio';
      restoreScroll();
      hideSummaryActions();
      const artifact = ensureArtifact();
      try { window.UXQStudentStudioFinalAuthorityV2?.build?.(); } catch (error) { console.error('[UXQ Studio builder]', error); }
      const wizard = document.getElementById('uxqStudentStudioFinalV2');
      if (wizard) {
        artifact.dataset.uxqBuilding = '0';
        artifact.removeAttribute('hidden');
        artifact.style.setProperty('display', 'grid', 'important');
        wizard.removeAttribute('hidden');
        wizard.style.setProperty('display', 'grid', 'important');
        document.getElementById('uxqStudioRouteFallback')?.remove();
        restoreScroll();
        hideSummaryActions();
        return;
      }
    } finally {
      running = false;
    }
    if (attempts < 40) setTimeout(build, Math.min(180 + attempts * 70, 900));
  }

  function boot() {
    installStyle();
    installInputScrollRecovery();
    document.body.dataset.uxqRoutePhase = 'studio';
    restoreScroll();
    hideSummaryActions();
    build();
    [100,250,600,1200,2200,4000,7000].forEach(ms => setTimeout(() => { restoreScroll(); hideSummaryActions(); build(); }, ms));
    new MutationObserver(() => {
      restoreScroll();
      hideSummaryActions();
      if (!document.getElementById('uxqStudentStudioFinalV2')) build();
    }).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', restoreScroll, { passive:true });
    window.addEventListener('orientationchange', () => setTimeout(restoreScroll, 120), { passive:true });
  }

  ['uxq-node-sheet-authority-ready','uxq-sheet-progress-restored','uxq-progress-updated'].forEach(name => window.addEventListener(name, build));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();