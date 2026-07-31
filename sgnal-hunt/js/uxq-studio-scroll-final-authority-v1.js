/* CSAI2601 UX Quest • Studio Scroll Final Authority v1.5
 * The document is the only vertical scroll owner. Studio cards never create a
 * nested scroll container. Step navigation preserves the learner's viewport.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('phase') !== 'studio' || q.get('contentPreview') === '1') return;

  const STYLE_ID = 'uxq-studio-scroll-final-authority-style';
  let attempts = 0;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html{
        overflow-x:hidden!important;overflow-y:auto!important;
        height:auto!important;min-height:100%!important;max-height:none!important;
        position:static!important;touch-action:pan-y pinch-zoom!important;
        overscroll-behavior-y:auto!important;scroll-behavior:auto!important;
        scroll-padding-top:16px!important
      }
      body{
        overflow-x:hidden!important;overflow-y:visible!important;
        height:auto!important;min-height:100vh!important;max-height:none!important;
        position:static!important;inset:auto!important;transform:none!important;
        touch-action:pan-y pinch-zoom!important;overscroll-behavior-y:auto!important
      }
      #uxqCanonicalNode,#uxqCanonicalNode .shell,#uxqCanonicalNode .panel,
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1],
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__panel,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__card{
        height:auto!important;min-height:0!important;max-height:none!important;
        overflow:visible!important;position:relative!important;inset:auto!important;
        transform:none!important;touch-action:pan-y pinch-zoom!important;
        overscroll-behavior-y:auto!important;animation:none!important;transition:none!important
      }
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
        width:min(1120px,calc(100% - 28px))!important;
        margin:28px auto!important;padding:20px!important;scrollbar-gutter:auto!important
      }
      @media(max-width:800px){
        body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
          width:calc(100% - 12px)!important;margin:8px auto!important;padding:12px!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeElement(el, pageOwner = false) {
    if (!el) return;
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('min-height', pageOwner ? '100%' : '0', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('overflow-y', pageOwner ? 'auto' : 'visible', 'important');
    el.style.setProperty('overflow-x', 'hidden', 'important');
    el.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
    el.style.setProperty('overscroll-behavior-y', 'auto', 'important');
    el.style.setProperty('scroll-behavior', 'auto', 'important');
    el.style.removeProperty('top');
    el.style.removeProperty('bottom');
    el.style.removeProperty('left');
    el.style.removeProperty('right');
    el.style.removeProperty('transform');
  }

  function normalizePage() {
    installStyle();
    document.body.dataset.uxqRoutePhase = 'studio';
    normalizeElement(document.documentElement, true);
    normalizeElement(document.body, false);
    document.body.style.setProperty('min-height', '100vh', 'important');
  }

  function installStepGuard(wizard) {
    if (!wizard || wizard.dataset.uxqStepScrollGuard === '1') return;
    wizard.dataset.uxqStepScrollGuard = '1';
    wizard.addEventListener('click', event => {
      const button = event.target.closest('.uxq-sv2__prev,.uxq-sv2__next');
      if (!button || !wizard.contains(button)) return;
      const before = window.scrollY;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo({ top: before, left: 0, behavior: 'auto' });
      }));
    }, true);
  }

  function applyOnce() {
    normalizePage();
    const root = document.getElementById('uxqCanonicalNode');
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    const wizard = document.getElementById('uxqStudentStudioFinalV2');
    if (!artifact || !wizard) return false;

    [root, root?.querySelector('.shell'), root?.querySelector('.panel'), artifact, wizard,
      ...wizard.querySelectorAll('.uxq-sv2__panel,.uxq-sv2__card')]
      .filter(Boolean)
      .forEach(el => normalizeElement(el, false));

    installStepGuard(wizard);
    document.body.dataset.uxqStudioScrollStable = 'page-v1.5';
    return true;
  }

  function waitForStudio() {
    attempts += 1;
    if (applyOnce() || attempts >= 30) return;
    setTimeout(waitForStudio, Math.min(100 + attempts * 40, 500));
  }

  normalizePage();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForStudio, {once:true});
  else waitForStudio();
  ['uxq-studio-container-ready','uxq-studio-artifact-dispatched','uxq-node-sheet-authority-ready']
    .forEach(name => window.addEventListener(name, applyOnce));

  window.UXQStudioScrollFinalAuthorityV1 = Object.freeze({
    version: '20260731-STUDIO-SCROLL-FINAL-V1.5',
    refresh: applyOnce
  });
})();
