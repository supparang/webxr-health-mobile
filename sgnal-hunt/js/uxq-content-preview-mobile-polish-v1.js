/* CSAI2601 Content Preview • Mobile QA Polish v1 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search || '').get('contentPreview') !== '1') return;

  const style = document.createElement('style');
  style.id = 'uxq-content-preview-mobile-polish-v1';
  style.textContent = `
    body[data-uxq-mode='preview'] .hub-shell{max-width:1120px!important;margin:auto!important;padding:14px!important}
    body[data-uxq-mode='preview'] .overview-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(300px,.8fr)!important;gap:16px!important;align-items:start!important}
    body[data-uxq-mode='preview'] .act-intro h1{font-size:clamp(2rem,6vw,3.6rem)!important;line-height:1.08!important;margin:.25rem 0 .65rem!important}
    body[data-uxq-mode='preview'] .act-intro__lede{font-size:clamp(1rem,2.2vw,1.2rem)!important;line-height:1.55!important}
    body[data-uxq-mode='preview'] .current-card{min-height:0!important;padding:20px!important;border-radius:24px!important}
    body[data-uxq-mode='preview'] .current-card__main{gap:14px!important;align-items:center!important}
    body[data-uxq-mode='preview'] .current-card__icon{width:64px!important;height:64px!important;font-size:1.8rem!important}
    body[data-uxq-mode='preview'] .current-card h2{font-size:clamp(1.45rem,4vw,2.05rem)!important;line-height:1.22!important;margin:0!important}
    body[data-uxq-mode='preview'] .current-card p{font-size:1rem!important;line-height:1.5!important}
    body[data-uxq-mode='preview'] .current-card__cta{min-height:52px!important;padding:12px 16px!important;font-size:1.05rem!important}
    body[data-uxq-mode='preview'] .up-next{margin-top:24px!important}
    body[data-uxq-mode='preview'] .section-heading h2{font-size:clamp(1.7rem,5vw,2.7rem)!important;line-height:1.18!important}
    body[data-uxq-mode='preview'] .up-next-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))!important;gap:14px!important}
    body[data-uxq-mode='preview'] .campaign-card{padding:16px!important;border-radius:18px!important;display:grid!important;gap:9px!important;align-content:start!important;min-height:0!important}
    body[data-uxq-mode='preview'] .campaign-card h3{font-size:1.28rem!important;line-height:1.25!important;margin:0!important}
    body[data-uxq-mode='preview'] .campaign-card p{font-size:.94rem!important;line-height:1.5!important;margin:0!important}
    body[data-uxq-mode='preview'] .campaign-card__title{font-size:1rem!important}
    body[data-uxq-mode='preview'] .campaign-launch{margin-top:auto!important;min-height:44px!important;padding:10px 12px!important;font-size:.98rem!important}
    @media(max-width:720px){
      body[data-uxq-mode='preview'] .hub-shell{padding:10px!important}
      body[data-uxq-mode='preview'] .overview-grid{grid-template-columns:1fr!important}
      body[data-uxq-mode='preview'] .act-intro h1{font-size:2.15rem!important}
      body[data-uxq-mode='preview'] .current-card{padding:16px!important}
      body[data-uxq-mode='preview'] .current-card__main{grid-template-columns:auto 1fr!important}
      body[data-uxq-mode='preview'] .current-card__icon{width:54px!important;height:54px!important;font-size:1.5rem!important}
      body[data-uxq-mode='preview'] .current-card h2{font-size:1.55rem!important}
      body[data-uxq-mode='preview'] .section-heading h2{font-size:1.75rem!important}
      body[data-uxq-mode='preview'] .up-next-grid{grid-template-columns:1fr!important}
    }
  `;
  document.head.appendChild(style);

  const removeDock = () => window.UXQRuntimeModeAuthority?.refresh?.();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',removeDock,{once:true});
  else removeDock();
})();