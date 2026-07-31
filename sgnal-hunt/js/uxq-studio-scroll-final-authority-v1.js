/* CSAI2601 UX Quest • Studio Scroll Final Authority v1.4
 * Uses one native page scroll only. The Studio card never creates its own
 * scroll container, preventing trapped upward scrolling and nested-scroll bugs.
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
        overflow-x:hidden!important;
        overflow-y:auto!important;
        height:auto!important;
        min-height:100%!important;
        max-height:none!important;
        position:static!important;
        touch-action:pan-y pinch-zoom!important;
        overscroll-behavior-y:auto!important;
        scroll-behavior:auto!important
      }
      body{
        overflow-x:hidden!important;
        overflow-y:visible!important;
        height:auto!important;
        min-height:100vh!important;
        max-height:none!important;
        position:static!important;
        inset:auto!important;
        transform:none!important;
        touch-action:pan-y pinch-zoom!important;
        overscroll-behavior-y:auto!important
      }
      #uxqCanonicalNode,
      #uxqCanonicalNode .shell,
      #uxqCanonicalNode .panel,
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1],
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__panel,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__card{
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow:visible!important;
        position:relative!important;
        inset:auto!important;
        transform:none!important;
        touch-action:pan-y pinch-zoom!important;
        overscroll-behavior-y:auto!important;
        animation:none!important;
        transition:none!important
      }
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
        width:min(1120px,calc(100% - 28px))!important;
        margin:28px auto!important;
        padding:20px!important;
        scrollbar-gutter:auto!important
      }
      @media(max-width:800px){
        body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
          width:calc(100% - 12px)!important;
          margin:8px auto!important;
          padding:12px!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applyOnce() {
    document.body.dataset.uxqRoutePhase = 'studio';
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    const wizard = document.getElementById('uxqStudentStudioFinalV2');
    if (!artifact || !wizard) return false;

    installStyle();
    [document.documentElement, document.body, document.getElementById('uxqCanonicalNode'), artifact, wizard,
      ...wizard.querySelectorAll('.uxq-sv2__panel,.uxq-sv2__card')]
      .filter(Boolean)
      .forEach(el => {
        el.style.setProperty('height','auto','important');
        el.style.setProperty('max-height','none','important');
        el.style.setProperty('overflow-y', el === document.documentElement ? 'auto' : 'visible','important');
        el.style.setProperty('overflow-x','hidden','important');
        el.style.setProperty('touch-action','pan-y pinch-zoom','important');
        el.style.setProperty('overscroll-behavior-y','auto','important');
        el.style.removeProperty('top');
        el.style.removeProperty('bottom');
        el.style.removeProperty('transform');
      });

    document.body.dataset.uxqStudioScrollStable = 'page';
    return true;
  }

  function waitForStudio() {
    attempts += 1;
    if (applyOnce() || attempts >= 30) return;
    setTimeout(waitForStudio, Math.min(100 + attempts * 40, 500));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForStudio, {once:true});
  else waitForStudio();
})();