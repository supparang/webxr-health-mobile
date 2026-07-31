/* CSAI2601 UX Quest • Node Header Layout Final Authority v1.5
 * One-shot header normalization. Studio scrolling is delegated to one owner.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  if (q.get('phase') === 'studio' && !document.querySelector('script[data-uxq-studio-scroll-final]')) {
    const script = document.createElement('script');
    script.src = './js/uxq-studio-scroll-final-authority-v1.js?v=studio-scroll-final-v1.5-20260731';
    script.async = false;
    script.dataset.uxqStudioScrollFinal = '1';
    document.head.appendChild(script);
  }

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const STYLE_ID = 'uxq-node-header-layout-final-authority-style';
  let attempts = 0;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #uxqStudentRuntimeBanner,#uxqActiveLearnerBanner{
        position:relative!important;inset:auto!important;transform:none!important;z-index:20!important;
        box-sizing:border-box!important;width:min(1280px,calc(100% - 48px))!important;
        margin:16px auto 22px!important;clear:both!important;animation:none!important;transition:none!important
      }
      #uxqStudentRuntimeBanner + #uxqCanonicalNode,#uxqActiveLearnerBanner + #uxqCanonicalNode{
        position:relative!important;inset:auto!important;transform:none!important;
        clear:both!important;padding-top:14px!important;animation:none!important;transition:none!important
      }
      #uxqCanonicalNode [data-uxq-course-brand-fixed='1']{
        position:relative!important;inset:auto!important;transform:none!important;z-index:1!important;
        margin-top:0!important;clear:both!important;animation:none!important;transition:none!important
      }
      @media(max-width:900px){
        #uxqStudentRuntimeBanner,#uxqActiveLearnerBanner{width:calc(100% - 24px)!important;margin:12px auto 18px!important}
        #uxqStudentRuntimeBanner + #uxqCanonicalNode,#uxqActiveLearnerBanner + #uxqCanonicalNode{padding-top:8px!important}
      }
      @media(max-width:520px){#uxqStudentRuntimeBanner,#uxqActiveLearnerBanner{width:calc(100% - 16px)!important}}
    `;
    document.head.appendChild(style);
  }

  function findCourseBrand() {
    return Array.from(ROOT.querySelectorAll('header,nav,section,div'))
      .filter(el => /CSAI2601\s+UX\s+Quest/i.test(String(el.textContent || '').replace(/\s+/g,' ').trim()) && el.querySelectorAll('*').length < 24)
      .sort((a,b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] || null;
  }

  function applyOnce() {
    installStyle();
    const banner = document.getElementById('uxqStudentRuntimeBanner') || document.getElementById('uxqActiveLearnerBanner');
    const brand = findCourseBrand();
    if (!brand && attempts < 30) return false;

    [banner, brand].filter(Boolean).forEach((el,index) => {
      el.style.setProperty('position','relative','important');
      el.style.setProperty('inset','auto','important');
      el.style.setProperty('transform','none','important');
      el.style.setProperty('z-index',index === 0 ? '20' : '1','important');
      el.style.setProperty('clear','both','important');
      el.style.setProperty('animation','none','important');
      el.style.setProperty('transition','none','important');
    });
    if (brand) brand.dataset.uxqCourseBrandFixed = '1';
    document.body.dataset.uxqHeaderLayoutStable = '1';
    return true;
  }

  function waitForLayout() {
    attempts += 1;
    if (applyOnce() || attempts >= 30) return;
    setTimeout(waitForLayout, Math.min(100 + attempts * 40, 500));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForLayout, {once:true});
  else waitForLayout();
})();
