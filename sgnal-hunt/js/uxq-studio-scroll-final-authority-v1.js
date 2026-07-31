/* CSAI2601 UX Quest • Studio Scroll Final Authority v1.3
 * One-shot Studio scroll setup. No MutationObserver, resize listener, scroll
 * restoration loop, or repeated style writes after the Studio is ready.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('phase') !== 'studio' || q.get('contentPreview') === '1') return;

  const STYLE_ID = 'uxq-studio-scroll-final-authority-style';
  let attempts = 0;
  let completed = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html,body{
        overflow-x:hidden!important;
        overflow-y:auto!important;
        height:auto!important;
        min-height:100%!important;
        max-height:none!important;
        touch-action:pan-y pinch-zoom!important;
        scroll-behavior:auto!important
      }
      #uxqCanonicalNode,
      #uxqCanonicalNode>.shell,
      #uxqCanonicalNode>.panel{
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow:visible!important
      }
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
        height:auto!important;
        min-height:260px!important;
        max-height:calc(100dvh - 118px)!important;
        overflow-x:hidden!important;
        overflow-y:auto!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior-y:contain!important;
        touch-action:pan-y pinch-zoom!important;
        scrollbar-gutter:stable!important;
        animation:none!important;
        transition:none!important;
        transform:none!important
      }
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__panel,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__card{
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow:visible!important;
        animation:none!important;
        transition:none!important;
        transform:none!important
      }
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__progress{
        top:0!important;
        animation:none!important;
        transition:none!important
      }
      @media(max-width:800px){
        body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
          width:calc(100% - 12px)!important;
          margin:8px auto!important;
          padding:12px!important;
          max-height:calc(100dvh - 78px)!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function finish() {
    if (completed) return true;
    document.body.dataset.uxqRoutePhase = 'studio';
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    const wizard = document.getElementById('uxqStudentStudioFinalV2');
    if (!artifact || !wizard) return false;

    installStyle();
    artifact.style.setProperty('overflow-y','auto','important');
    artifact.style.setProperty('overflow-x','hidden','important');
    artifact.style.setProperty('max-height','calc(100dvh - 118px)','important');
    artifact.style.setProperty('-webkit-overflow-scrolling','touch','important');
    artifact.style.setProperty('touch-action','pan-y pinch-zoom','important');
    artifact.style.setProperty('overscroll-behavior-y','contain','important');
    artifact.style.setProperty('animation','none','important');
    artifact.style.setProperty('transition','none','important');
    artifact.style.setProperty('transform','none','important');
    completed = true;
    document.body.dataset.uxqStudioScrollStable = '1';
    return true;
  }

  function waitForStudio() {
    attempts += 1;
    if (finish() || attempts >= 30) return;
    setTimeout(waitForStudio, Math.min(100 + attempts * 40, 500));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForStudio, {once:true});
  } else {
    waitForStudio();
  }
})();