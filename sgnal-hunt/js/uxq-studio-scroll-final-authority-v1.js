/* CSAI2601 UX Quest • Studio Scroll Final Authority v1.1
 * Gives Studio its own native vertical scroll region and preserves the user's
 * position while late-rendered content is added. It never observes or rewrites
 * its own style mutations in a loop.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('phase') !== 'studio' || q.get('contentPreview') === '1') return;

  const STYLE_ID = 'uxq-studio-scroll-final-authority-style';
  let queued = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html,body{overflow-x:hidden!important;overflow-y:auto!important;height:auto!important;max-height:none!important;touch-action:pan-y pinch-zoom!important}
      #uxqCanonicalNode,#uxqCanonicalNode>.shell,#uxqCanonicalNode>.panel{height:auto!important;max-height:none!important;overflow:visible!important}
      body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
        height:auto!important;min-height:260px!important;max-height:calc(100dvh - 118px)!important;
        overflow-x:hidden!important;overflow-y:auto!important;
        -webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;
        touch-action:pan-y pinch-zoom!important;scrollbar-gutter:stable!important
      }
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__panel,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__card{
        height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important
      }
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__progress{top:0!important}
      @media(max-width:800px){
        body[data-uxq-route-phase='studio'] .artifact[data-studio-practice-v1]{
          width:calc(100% - 12px)!important;margin:8px auto!important;padding:12px!important;
          max-height:calc(100dvh - 78px)!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    installStyle();
    document.body.dataset.uxqRoutePhase = 'studio';

    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;

    const previousTop = artifact.scrollTop;
    artifact.style.setProperty('overflow-y','auto','important');
    artifact.style.setProperty('overflow-x','hidden','important');
    artifact.style.setProperty('max-height','calc(100dvh - 118px)','important');
    artifact.style.setProperty('-webkit-overflow-scrolling','touch','important');
    artifact.style.setProperty('touch-action','pan-y pinch-zoom','important');
    artifact.style.setProperty('overscroll-behavior-y','contain','important');

    // Late-rendered Studio fields must not pull a learner back to the top.
    if (previousTop > 0) {
      requestAnimationFrame(() => {
        const maxTop = Math.max(0, artifact.scrollHeight - artifact.clientHeight);
        artifact.scrollTop = Math.min(previousTop, maxTop);
      });
    }
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();

  // Observe only structural changes. Observing style/class caused a feedback loop
  // because this authority writes those same properties itself.
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',queue,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(queue,120),{passive:true});
  [100,300,700,1400,2600].forEach(ms=>setTimeout(queue,ms));
})();