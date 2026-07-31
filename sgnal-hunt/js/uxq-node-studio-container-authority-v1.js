/* CSAI2601 UX Quest • Node Studio Container Authority v9
 * Repairs phase=studio, enforces one clear action path, and preserves native
 * bidirectional browser scrolling. No wheel/touch interception.
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

  function missionConfirmed() {
    const sheet = window.UXQNodeSheetAuthority;
    if (sheet && sheet.nodeId === NODE) return sheet.missionPassed === true;
    return document.body.dataset.uxqSheetMission === '1' || document.body.dataset.uxqMissionPass === '1';
  }

  function restoreNativeScroll() {
    const html = document.documentElement;
    const body = document.body;

    if (html) {
      html.style.setProperty('overflow-x', 'hidden', 'important');
      html.style.setProperty('overflow-y', 'auto', 'important');
      html.style.setProperty('height', 'auto', 'important');
      html.style.setProperty('min-height', '100%', 'important');
      html.style.setProperty('max-height', 'none', 'important');
      html.style.setProperty('position', 'static', 'important');
      html.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      html.style.setProperty('overscroll-behavior-y', 'auto', 'important');
      html.style.setProperty('scroll-behavior', 'auto', 'important');
    }

    if (body) {
      body.style.setProperty('overflow-x', 'hidden', 'important');
      body.style.setProperty('overflow-y', 'visible', 'important');
      body.style.setProperty('height', 'auto', 'important');
      body.style.setProperty('min-height', '100vh', 'important');
      body.style.setProperty('max-height', 'none', 'important');
      body.style.setProperty('position', 'static', 'important');
      body.style.removeProperty('top');
      body.style.removeProperty('left');
      body.style.removeProperty('right');
      body.style.removeProperty('transform');
      body.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      body.style.setProperty('overscroll-behavior-y', 'auto', 'important');
    }

    [
      ROOT,
      ROOT.querySelector('.shell'),
      ROOT.querySelector('.panel'),
      ROOT.querySelector('.artifact[data-studio-practice-v1]'),
      document.getElementById('uxqStudentStudioFinalV2'),
      ...ROOT.querySelectorAll('#uxqStudentStudioFinalV2 .uxq-sv2__panel, #uxqStudentStudioFinalV2 .uxq-sv2__card')
    ].filter(Boolean).forEach(el => {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('position', 'relative', 'important');
      el.style.removeProperty('top');
      el.style.removeProperty('transform');
      el.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      el.style.setProperty('overscroll-behavior-y', 'auto', 'important');
    });
  }

  function installStyle() {
    if (document.getElementById('uxq-node-studio-container-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-node-studio-container-authority-style';
    style.textContent = `
      html{overflow-x:hidden!important;overflow-y:auto!important;height:auto!important;min-height:100%!important;max-height:none!important;position:static!important;touch-action:pan-y pinch-zoom!important;scroll-behavior:auto!important}
      body{overflow-x:hidden!important;overflow-y:visible!important;height:auto!important;min-height:100vh!important;max-height:none!important;position:static!important;touch-action:pan-y pinch-zoom!important}
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
      document.body.dataset.uxqMissionPass = '1';
      document.body.dataset.uxqRoutePhase = 'studio';
      restoreNativeScroll();
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
        restoreNativeScroll();
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
    document.body.dataset.uxqRoutePhase = 'studio';
    restoreNativeScroll();
    hideSummaryActions();
    build();
    [100,250,600,1200,2200,4000,7000].forEach(ms => setTimeout(() => {
      restoreNativeScroll();
      hideSummaryActions();
      build();
    }, ms));
    new MutationObserver(() => {
      restoreNativeScroll();
      hideSummaryActions();
      if (!document.getElementById('uxqStudentStudioFinalV2')) build();
    }).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', restoreNativeScroll, { passive:true });
    window.addEventListener('orientationchange', () => setTimeout(restoreNativeScroll, 120), { passive:true });
  }

  ['uxq-node-sheet-authority-ready','uxq-sheet-progress-restored','uxq-progress-updated'].forEach(name => window.addEventListener(name, build));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();