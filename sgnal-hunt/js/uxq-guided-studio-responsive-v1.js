/* CSAI2601 UX Quest • Guided Studio Responsive Layout v1
 * Styles all W1-W15 + B1-B4 via body[data-device-mode].
 * Presentation only; no progress, validation, submit, Sheet or Apps Script changes.
 */
(() => {
  'use strict';

  function install() {
    if (document.getElementById('uxq-guided-responsive-style-v1')) return;
    const s = document.createElement('style');
    s.id = 'uxq-guided-responsive-style-v1';
    s.textContent = `
      body[data-device-mode] .artifact[data-guided-all19='1']{max-width:1180px;margin-inline:auto}

      /* MOBILE: compact, one task at a time */
      body[data-device-mode='mobile'] .shell{padding-inline:8px!important}
      body[data-device-mode='mobile'] .artifact[data-guided-all19='1']{padding:11px!important;gap:9px!important;border-radius:17px!important}
      body[data-device-mode='mobile'] .artifact[data-guided-all19='1'] .studio-head{gap:3px!important}
      body[data-device-mode='mobile'] .artifact[data-guided-all19='1'] .studio-head h2{font-size:1.16rem!important;line-height:1.16!important}
      body[data-device-mode='mobile'] .artifact[data-guided-all19='1'] .studio-head>p{font-size:.77rem!important;line-height:1.4!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      body[data-device-mode='mobile'] .artifact[data-guided-all19='1'] .studio-meta{gap:4px!important}
      body[data-device-mode='mobile'] .artifact[data-guided-all19='1'] .studio-meta span{font-size:.61rem!important;padding:4px 6px!important}
      body[data-device-mode='mobile'] .uxq-gs{gap:9px!important}
      body[data-device-mode='mobile'] .uxq-gs__progress{top:3px!important;padding:8px!important;border-radius:12px!important}
      body[data-device-mode='mobile'] .uxq-gs__progressTop b{font-size:.8rem!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      body[data-device-mode='mobile'] .uxq-gs__progressTop span{font-size:.64rem!important}
      body[data-device-mode='mobile'] .uxq-gs__bar{height:6px!important;margin-top:6px!important}
      body[data-device-mode='mobile'] .uxq-gs__dots{margin-top:6px!important;grid-template-columns:repeat(var(--steps),24px)!important;gap:4px!important}
      body[data-device-mode='mobile'] .uxq-gs__dot{font-size:.52rem!important;padding:3px 1px!important}
      body[data-device-mode='mobile'] .uxq-gs__panel.is-active{gap:8px!important}
      body[data-device-mode='mobile'] .uxq-gs__brief,body[data-device-mode='mobile'] .uxq-gs__figma{padding:10px!important;gap:7px!important;border-radius:12px!important}
      body[data-device-mode='mobile'] .uxq-gs__brief h3,body[data-device-mode='mobile'] .uxq-gs__figma h3{font-size:.98rem!important;line-height:1.25!important}
      body[data-device-mode='mobile'] .uxq-gs__brief p,body[data-device-mode='mobile'] .uxq-gs__brief li,body[data-device-mode='mobile'] .uxq-gs__figma p,body[data-device-mode='mobile'] .uxq-gs__figma li{font-size:.8rem!important;line-height:1.43!important}
      body[data-device-mode='mobile'] .uxq-gs__brief ol,body[data-device-mode='mobile'] .uxq-gs__brief ul,body[data-device-mode='mobile'] .uxq-gs__figma ol{gap:4px!important;padding-left:1.08rem!important}
      body[data-device-mode='mobile'] .uxq-gs__artifact{gap:5px!important}
      body[data-device-mode='mobile'] .uxq-gs__artifact article{padding:8px!important;border-radius:10px!important}
      body[data-device-mode='mobile'] .uxq-gs__artifact b{font-size:.78rem!important;margin-bottom:2px!important}
      body[data-device-mode='mobile'] .uxq-gs__artifact small{font-size:.7rem!important;line-height:1.35!important}
      body[data-device-mode='mobile'] .uxq-gs__quality{padding:8px!important;gap:4px!important}
      body[data-device-mode='mobile'] .uxq-gs__quality b{font-size:.76rem!important}
      body[data-device-mode='mobile'] .uxq-gs__quality p{font-size:.72rem!important;line-height:1.4!important}
      body[data-device-mode='mobile'] .uxq-gs__panel .studio-field{gap:4px!important}
      body[data-device-mode='mobile'] .uxq-gs__panel .studio-field>b{font-size:.84rem!important}
      body[data-device-mode='mobile'] .uxq-gs__panel textarea{min-height:104px!important;max-height:210px!important;padding:10px!important;font-size:.93rem!important;border-radius:12px!important}
      body[data-device-mode='mobile'] .uxq-gs__url input{min-height:44px!important;font-size:.9rem!important}
      body[data-device-mode='mobile'] .uxq-gs__open,body[data-device-mode='mobile'] .uxq-gs__verify{min-height:42px!important;padding:8px 10px!important;font-size:.79rem!important}
      body[data-device-mode='mobile'] .uxq-gs__fieldState{padding:7px 8px!important;font-size:.69rem!important}
      body[data-device-mode='mobile'] .studio-checks{padding:9px!important;gap:4px!important}
      body[data-device-mode='mobile'] .studio-check{padding:5px 0!important;grid-template-columns:23px 1fr!important;gap:7px!important}
      body[data-device-mode='mobile'] .studio-check input{width:20px!important;height:20px!important}
      body[data-device-mode='mobile'] .studio-check span{font-size:.78rem!important;line-height:1.38!important}
      body[data-device-mode='mobile'] .uxq-gs__nav{bottom:5px!important;padding:5px!important;gap:6px!important}
      body[data-device-mode='mobile'] .uxq-gs__nav button{min-height:41px!important;font-size:.79rem!important}
      body[data-device-mode='mobile'] .uxq-3part{padding:9px!important;margin:8px 0!important}
      body[data-device-mode='mobile'] .uxq-3part__item{padding:6px 3px!important}

      /* TABLET: broad single column with compact two-column summaries */
      body[data-device-mode='tablet'] .artifact[data-guided-all19='1']{max-width:900px;padding:18px!important}
      body[data-device-mode='tablet'] .uxq-gs__artifact{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);align-items:start}
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.uxq-gs__brief,
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.uxq-gs__figma{grid-column:1}
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.studio-field,
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.studio-checks,
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.studio-validation,
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.actions,
      body[data-device-mode='tablet'] .uxq-gs__panel.is-active>.uxq-gs__fieldProgress{grid-column:2;grid-row:1 / span 3}
      body[data-device-mode='tablet'] .uxq-gs__panel textarea{min-height:180px!important}
      body[data-device-mode='tablet'] .uxq-gs__nav{max-width:620px;margin-inline:auto;width:100%}

      /* PC: workspace + guidance side by side */
      body[data-device-mode='pc'] .shell{max-width:1380px!important}
      body[data-device-mode='pc'] .artifact[data-guided-all19='1']{padding:22px!important}
      body[data-device-mode='pc'] .uxq-gs__progress{position:sticky;top:10px}
      body[data-device-mode='pc'] .uxq-gs__panel.is-active{display:grid!important;grid-template-columns:minmax(310px,.78fr) minmax(0,1.35fr);gap:18px!important;align-items:start;min-height:350px}
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__brief,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__figma{grid-column:1;position:sticky;top:112px}
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.studio-field,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.studio-checks,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.studio-validation,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.actions,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__fieldProgress{grid-column:2}
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__artifact{grid-column:1 / -1}
      body[data-device-mode='pc'] .uxq-gs__panel textarea{min-height:230px!important;max-height:440px!important}
      body[data-device-mode='pc'] .uxq-gs__artifact{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      body[data-device-mode='pc'] .uxq-gs__fieldProgress{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      body[data-device-mode='pc'] .uxq-gs__nav{max-width:680px;margin-inline:auto;width:100%}
      body[data-device-mode='pc'] .uxq-gs__figmaActions{grid-template-columns:1fr 1fr!important}

      .uxq-device-badge{position:fixed;left:12px;bottom:12px;z-index:9997;padding:5px 8px;border:1px solid rgba(110,231,255,.25);border-radius:999px;background:rgba(5,18,42,.82);color:#9cb4d7;font-size:.62rem;pointer-events:none;opacity:.64}
      body[data-device-mode='mobile'] .uxq-device-badge{display:none}
    `;
    document.head.appendChild(s);
  }

  function badge() {
    let el = document.getElementById('uxqDeviceModeBadge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'uxqDeviceModeBadge';
      el.className = 'uxq-device-badge';
      document.body.appendChild(el);
    }
    const mode = document.body.dataset.deviceMode || 'auto';
    const source = document.body.dataset.deviceSource || 'auto';
    el.textContent = `${mode.toUpperCase()} • ${source}`;
  }

  function apply() { install(); if (document.body) badge(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  window.addEventListener('uxq-device-mode-changed',apply);
  window.UXQGuidedStudioResponsiveV1 = Object.freeze({apply,version:'20260722-GUIDED-RESPONSIVE-V1'});
})();