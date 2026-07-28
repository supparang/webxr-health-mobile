/* CSAI2601 UX Quest • Mobile Studio Final Authority v1
 * Front-end only. Fixes duplicate field headings, oversized mobile typography,
 * overflowing controls, and unrelated legacy fixed emoji navigation.
 */
(() => {
  'use strict';

  const STYLE_ID = 'uxq-mobile-studio-final-authority-v1-style';
  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html,body{max-width:100%;overflow-x:hidden!important}
      #uxqCanonicalNode,.node-shell,.artifact,.uxq-pr{min-width:0!important;max-width:100%!important}

      /* Production wizard already renders the field title in its panel header. */
      .uxq-pr__panel>.studio-field>b,
      .uxq-pr__panel>.studio-field>strong,
      .uxq-pr__panel>.studio-field>label:first-child{display:none!important}

      .uxq-pr__panel,.uxq-pr__brief,.uxq-pr__figma,.uxq-pr__review,
      .uxq-pr__panel .studio-field,.uxq-pr__panel textarea,
      .uxq-pr__panel input,.uxq-pr__panel button,.uxq-pr__panel a{box-sizing:border-box!important;min-width:0!important;max-width:100%!important}

      .uxq-pr h3{font-size:clamp(1.15rem,5vw,1.45rem)!important;line-height:1.25!important;overflow-wrap:anywhere}
      .uxq-pr h4{font-size:1rem!important;line-height:1.35!important}
      .uxq-pr p,.uxq-pr li,.uxq-pr label,.uxq-pr .studio-field,
      .uxq-pr input,.uxq-pr textarea,.uxq-pr button,.uxq-pr a{font-size:clamp(.94rem,4.1vw,1.05rem)!important;line-height:1.55!important}
      .uxq-pr__brief,.uxq-pr__figma,.uxq-pr__review{padding:14px!important;border-radius:16px!important}
      .uxq-pr__deliverable{padding:11px!important}
      .uxq-pr__cards span{font-size:.9rem!important;padding:10px!important}
      .uxq-pr__panel textarea{width:100%!important;min-height:128px!important;max-height:240px!important;padding:13px!important;resize:vertical!important}
      .uxq-pr__panel input{width:100%!important;min-height:50px!important;padding:11px 13px!important}
      .uxq-pr__button,.uxq-pr__nav button{width:100%!important;min-height:48px!important;padding:11px 13px!important;text-align:center!important}
      .uxq-pr__figmaActions{grid-template-columns:1fr!important}
      .uxq-pr__top{align-items:flex-start!important}

      /* Choice chips must wrap cleanly instead of becoming giant blocks. */
      .uxq-pr__panel .choice-grid,.uxq-pr__panel .option-grid,
      .uxq-pr__panel [class*='chips'],.uxq-pr__panel [class*='choices']{
        display:flex!important;flex-wrap:wrap!important;gap:8px!important
      }
      .uxq-pr__panel .choice-grid>* ,.uxq-pr__panel .option-grid>*,
      .uxq-pr__panel [class*='chips']>*,.uxq-pr__panel [class*='choices']>*{
        flex:0 1 auto!important;width:auto!important;max-width:100%!important;
        min-height:44px!important;padding:9px 12px!important;font-size:.96rem!important;
        line-height:1.25!important;white-space:normal!important;overflow-wrap:anywhere!important
      }

      @media(max-width:600px){
        body{padding-bottom:18px!important}
        .artifact{padding-inline:10px!important}
        .uxq-pr{gap:11px!important;margin-top:10px!important}
        .uxq-pr__panel.is-active{gap:11px!important}
        .uxq-pr__progress{position:static!important;padding:9px!important}
        .uxq-pr__nav{position:static!important;padding:0!important;background:transparent!important}
        .uxq-pr__cards{grid-template-columns:1fr!important}
        .uxq-pr__figma h3{font-size:1.28rem!important}
      }
    `;
    document.head.appendChild(style);
  }

  const norm = value => String(value || '').replace(/\s+/g,' ').trim().toLowerCase();

  function removeDuplicateFieldTitles(root) {
    root.querySelectorAll('.uxq-pr__panel').forEach(panel => {
      const heading = panel.querySelector(':scope > .uxq-pr__brief h3, :scope > .uxq-pr__figma h3, :scope > .uxq-pr__review h3');
      if (!heading) return;
      const title = norm(heading.textContent);
      panel.querySelectorAll(':scope > .studio-field > b, :scope > .studio-field > strong, :scope > .studio-field > label:first-child').forEach(label => {
        if (!title || norm(label.textContent) === title || /^\d+\)/.test(norm(label.textContent))) {
          label.hidden = true;
          label.setAttribute('aria-hidden','true');
        }
      });
    });
  }

  function removeRepeatedVisibleHeadings(root) {
    const seen = new Map();
    root.querySelectorAll('h2,h3,h4').forEach(el => {
      const text = norm(el.textContent);
      if (!text) return;
      const rect = el.getBoundingClientRect();
      const key = `${text}|${Math.round(rect.left/20)}`;
      const previous = seen.get(key);
      if (previous && Math.abs(el.offsetTop - previous.offsetTop) < 360) {
        el.hidden = true;
        el.setAttribute('aria-hidden','true');
      } else {
        seen.set(key,el);
      }
    });
  }

  function removeLegacyEmojiNav(root) {
    root.querySelectorAll('nav,footer,div').forEach(el => {
      const text = String(el.textContent || '').replace(/\s/g,'');
      if (!(text.includes('👊') && text.includes('🌼'))) return;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky' || el.matches('nav,footer')) {
        el.remove();
      }
    });
  }

  function apply() {
    installStyle();
    const root = document.getElementById('uxqCanonicalNode') || document.body;
    removeDuplicateFieldTitles(root);
    removeRepeatedVisibleHeadings(root);
    removeLegacyEmojiNav(document.body);
  }

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',queue,{passive:true});
})();