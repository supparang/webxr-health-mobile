/* CSAI2601 UX Quest • Mobile Final Polish v1
 * Presentation-only layer. No Sheet, Apps Script, unlock, or completion logic changes.
 */
(() => {
  'use strict';
  const mq = window.matchMedia('(max-width: 760px)');

  function style() {
    if (document.getElementById('uxq-mobile-final-polish-v1')) return;
    const s = document.createElement('style');
    s.id = 'uxq-mobile-final-polish-v1';
    s.textContent = `
    @media(max-width:760px){
      body.uxq-hub-page .hub-shell{padding:8px 10px 24px!important}
      body.uxq-hub-page .hub-topbar{margin-bottom:10px!important}
      body.uxq-hub-page .hub-brand__mark{width:48px!important;height:48px!important;border-radius:15px!important}
      body.uxq-hub-page .hub-brand__copy strong{font-size:1.02rem!important}
      body.uxq-hub-page .hub-brand__copy small{font-size:.7rem!important}
      body.uxq-hub-page .profile-card,body.uxq-hub-page .learner-profile{padding:13px!important;border-radius:18px!important}
      body.uxq-hub-page .profile-card button,body.uxq-hub-page .learner-profile button{min-height:42px!important;padding:9px 12px!important;font-size:.82rem!important}
      body.uxq-hub-page .act-intro{padding:2px 2px 0!important}
      body.uxq-hub-page .act-intro .eyebrow{font-size:.65rem!important}
      body.uxq-hub-page .act-intro h1{font-size:1.7rem!important;line-height:1.02!important;margin:.3rem 0!important}
      body.uxq-hub-page .act-intro__lede{font-size:.82rem!important;line-height:1.42!important;margin:0!important}
      body.uxq-hub-page .current-card{margin-top:10px!important;padding:11px!important}
      body.uxq-hub-page .current-card__status{font-size:.62rem!important}
      body.uxq-hub-page .current-card__main{margin-top:6px!important}
      body.uxq-hub-page .current-card h2{font-size:1rem!important}
      body.uxq-hub-page .current-card p{font-size:.74rem!important;line-height:1.35!important}
      body.uxq-hub-page .current-card__cta{min-height:42px!important;font-size:.82rem!important}

      #uxqStudioOverview{padding:10px!important;margin:10px 0!important}
      #uxqStudioOverview .uxq-mobile-friendly-error{padding:10px!important;border-radius:12px!important}
      #uxqStudioOverview .uxq-mobile-friendly-error strong{font-size:.92rem!important}
      #uxqStudioOverview .uxq-mobile-friendly-error p{font-size:.76rem!important;line-height:1.42!important}
      #uxqStudioOverview .uxq-mobile-retry{min-height:42px!important;padding:8px!important;font-size:.8rem!important}

      .up-next{margin-top:12px!important}
      .up-next .section-heading{margin-bottom:6px!important}
      .up-next .section-heading .eyebrow{font-size:.62rem!important}
      .up-next .section-heading h2{font-size:1rem!important;line-height:1.28!important;margin:.25rem 0!important}
      .up-next .section-heading p:not(.eyebrow){font-size:.74rem!important;line-height:1.4!important;margin:.2rem 0!important}
      .up-next-grid{gap:8px!important}
      .campaign-preview{padding:10px!important;border-radius:16px!important}
      .campaign-preview .compact-stage__top,.campaign-preview .boss-preview__top{margin-bottom:7px!important}
      .campaign-preview .stage-number,.campaign-preview .stage-state{font-size:.65rem!important;padding:5px 8px!important}
      .campaign-preview .compact-stage__content,.campaign-preview .boss-preview__body{gap:9px!important}
      .campaign-preview .compact-stage__icon,.campaign-preview .boss-preview__icon{width:42px!important;height:42px!important;min-width:42px!important;font-size:1.45rem!important}
      .campaign-preview .compact-stage__type{font-size:.62rem!important;letter-spacing:.08em!important;margin-bottom:2px!important}
      .campaign-preview h3{font-size:1.02rem!important;line-height:1.18!important;margin:0!important}
      .campaign-preview p{display:none!important}
      .campaign-preview .compact-stage__footer,.campaign-preview .boss-preview__footer{margin-top:8px!important;gap:6px!important}
      .campaign-preview .compact-stage__footer>span,.campaign-preview .boss-preview__footer>span{font-size:.68rem!important;line-height:1.3!important}
      .campaign-preview .node-next-note,.campaign-preview .three-part-lock-note{display:none!important}
      .campaign-preview .studio-node-status{margin-top:7px!important}
      .campaign-preview .campaign-launch{min-height:40px!important;padding:8px!important;font-size:.76rem!important}
      .campaign-preview[data-mobile-role='next']{opacity:.5!important;max-height:145px!important;overflow:hidden!important}
      .campaign-preview[data-mobile-role='future']{display:none!important}
      .up-next-grid.is-expanded .campaign-preview[data-mobile-role='future']{display:block!important}
      .uxq-mobile-path-toggle{position:sticky!important;bottom:10px!important;z-index:6!important;background:#102345!important;box-shadow:0 8px 24px rgba(0,0,0,.35)!important}
      #progress,.hub-menu__panel{display:none!important}
      [style*='position: fixed'][style*='right'],[style*='position:fixed'][style*='right']{display:none!important}
    }`;
    document.head.appendChild(s);
  }

  function cleanHeadings() {
    const heading = document.querySelector('.up-next .section-heading');
    if (!heading) return;
    const paragraphs = Array.from(heading.querySelectorAll('p')).filter(p => !p.classList.contains('eyebrow'));
    paragraphs.forEach(p => {
      const t = p.textContent || '';
      if (/Mission ผ่าน|mission_completed|ครบ 3\/3/i.test(t)) {
        p.textContent = 'ทำ Node ปัจจุบันให้ครบ Mission + Studio + Reflection เพื่อปลดล็อกด่านถัดไป';
      }
    });
  }

  function hideFloating() {
    document.querySelectorAll('body *').forEach(el => {
      if (el.closest('.hub-shell')) return;
      const t = String(el.textContent || '').trim();
      if (/Mission\s*19\/19.*Studio\/Reflection|Course Complete\s*\d+\/19/i.test(t)) {
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') el.style.display = 'none';
      }
    });
  }

  function simplifyCurrentCard() {
    const current = document.querySelector('.campaign-preview[data-mobile-role="current"]');
    if (!current) return;
    const footerText = current.querySelector('.compact-stage__footer>span,.boss-preview__footer>span');
    if (footerText) footerText.textContent = 'Mission ผ่านแล้ว • เหลือ Studio Practice และ Reflection';
    const link = current.querySelector('.campaign-launch');
    if (link) link.textContent = 'ทำ Studio Practice';
  }

  function apply() {
    style();
    if (!mq.matches) return;
    cleanHeadings();
    hideFloating();
    simplifyCurrentCard();
  }

  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(apply, 120); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();
  window.addEventListener('uxq-three-part-course-progress', schedule);
  window.addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(document.body, {childList:true, subtree:true});
  window.UXQMobileFinalPolishV1 = Object.freeze({apply, version:'20260721-MOBILE-FINAL-POLISH-V1'});
})();