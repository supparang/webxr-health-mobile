/* CSAI2601 UX Quest • Node Header Layout Final Authority v1.1
 * Final visual guard: learner profile and course brand remain separate blocks.
 * Also loads the final native Studio scroll guard in phase=studio.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  if (q.get('phase') === 'studio' && !document.querySelector('script[data-uxq-studio-scroll-final]')) {
    const script = document.createElement('script');
    script.src = './js/uxq-studio-scroll-final-authority-v1.js?v=studio-scroll-final-v1.1-20260731';
    script.async = false;
    script.dataset.uxqStudioScrollFinal = '1';
    document.head.appendChild(script);
  }

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const STYLE_ID = 'uxq-node-header-layout-final-authority-style';
  let queued = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #uxqStudentRuntimeBanner,
      #uxqActiveLearnerBanner{
        position:relative!important;inset:auto!important;top:auto!important;right:auto!important;
        bottom:auto!important;left:auto!important;transform:none!important;z-index:20!important;
        box-sizing:border-box!important;width:min(1280px,calc(100% - 48px))!important;
        margin:16px auto 22px!important;clear:both!important
      }
      #uxqStudentRuntimeBanner + #uxqCanonicalNode,
      #uxqActiveLearnerBanner + #uxqCanonicalNode{
        position:relative!important;inset:auto!important;transform:none!important;
        clear:both!important;padding-top:14px!important
      }
      #uxqCanonicalNode [data-uxq-course-brand-fixed='1']{
        position:relative!important;inset:auto!important;top:auto!important;right:auto!important;
        bottom:auto!important;left:auto!important;transform:none!important;z-index:1!important;
        margin-top:0!important;clear:both!important
      }
      @media(max-width:900px){
        #uxqStudentRuntimeBanner,#uxqActiveLearnerBanner{width:calc(100% - 24px)!important;margin:12px auto 18px!important}
        #uxqStudentRuntimeBanner + #uxqCanonicalNode,#uxqActiveLearnerBanner + #uxqCanonicalNode{padding-top:8px!important}
      }
      @media(max-width:520px){#uxqStudentRuntimeBanner,#uxqActiveLearnerBanner{width:calc(100% - 16px)!important}}
    `;
    document.head.appendChild(style);
  }

  function isCourseBrand(el) {
    if (!el || el === ROOT) return false;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/CSAI2601\s+UX\s+Quest/i.test(text)) return false;
    return el.querySelectorAll('*').length < 24;
  }

  function normalizeCourseBrand() {
    const candidates = Array.from(ROOT.querySelectorAll('header,nav,section,div'))
      .filter(isCourseBrand)
      .sort((a,b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    const brand = candidates[0];
    if (!brand) return;
    brand.dataset.uxqCourseBrandFixed = '1';
    ['position','top','right','bottom','left','transform','translate','inset','z-index'].forEach(name => brand.style.removeProperty(name));
    brand.style.setProperty('position','relative','important');
    brand.style.setProperty('inset','auto','important');
    brand.style.setProperty('transform','none','important');
    brand.style.setProperty('z-index','1','important');
    brand.style.setProperty('clear','both','important');

    let parent = brand.parentElement;
    for (let depth=0; parent && parent !== ROOT && depth<3; depth+=1, parent=parent.parentElement) {
      const cs = getComputedStyle(parent);
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky' || cs.transform !== 'none') {
        parent.dataset.uxqCourseBrandFixed = '1';
        parent.style.setProperty('position','relative','important');
        parent.style.setProperty('inset','auto','important');
        parent.style.setProperty('transform','none','important');
        parent.style.setProperty('z-index','1','important');
        parent.style.setProperty('clear','both','important');
      }
    }
  }

  function normalizeBanner() {
    ['uxqStudentRuntimeBanner','uxqActiveLearnerBanner'].forEach(id => {
      const banner = document.getElementById(id);
      if (!banner) return;
      banner.style.setProperty('position','relative','important');
      banner.style.setProperty('inset','auto','important');
      banner.style.setProperty('transform','none','important');
      banner.style.setProperty('z-index','20','important');
      banner.style.setProperty('clear','both','important');
    });
  }

  function apply() {
    queued = false;
    installStyle();
    normalizeBanner();
    normalizeCourseBrand();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, {once:true});
  else queue();
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  window.addEventListener('resize',queue,{passive:true});
  [100,300,700,1400,2800,5000].forEach(ms=>setTimeout(queue,ms));
})();