/* CSAI2601 UX Quest • Studio PC Polish v1
 * Fixes oversized empty space, narrow brief cards, broken self-check rows,
 * validation overflow, and secondary replay emphasis on desktop/tablet.
 */
(() => {
  'use strict';

  function install() {
    if (document.getElementById('uxq-studio-pc-polish-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-studio-pc-polish-v1';
    style.textContent = `
      /* Shared Studio frame */
      body[data-device-mode='pc'] .artifact[data-guided-all19='1'],
      body[data-device-mode='tablet'] .artifact[data-guided-all19='1']{
        width:min(1180px,calc(100vw - 48px))!important;
        max-width:1180px!important;
        box-sizing:border-box!important;
      }

      /* PC: balanced workspace, no tiny left card floating in a wide empty panel */
      body[data-device-mode='pc'] .uxq-gs__panel.is-active{
        grid-template-columns:minmax(360px,.95fr) minmax(460px,1.35fr)!important;
        gap:22px!important;
        min-height:0!important;
      }
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__brief,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__figma{
        width:100%!important;
        max-width:none!important;
        position:static!important;
        top:auto!important;
        align-self:stretch!important;
      }
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.studio-field,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.studio-checks,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.studio-validation,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.actions,
      body[data-device-mode='pc'] .uxq-gs__panel.is-active>.uxq-gs__fieldProgress{
        width:100%!important;
        min-width:0!important;
      }
      body[data-device-mode='pc'] .uxq-gs__brief,
      body[data-device-mode='pc'] .uxq-gs__figma{
        padding:20px!important;
        border-radius:16px!important;
      }
      body[data-device-mode='pc'] .uxq-gs__artifact{
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:10px!important;
      }
      body[data-device-mode='pc'] .uxq-gs__artifact article{
        min-height:112px!important;
      }
      body[data-device-mode='pc'] .uxq-gs__panel textarea{
        min-height:190px!important;
        max-height:320px!important;
        resize:vertical!important;
      }

      /* Step 1 should use the full width instead of leaving a dead right column */
      body[data-device-mode='pc'] .uxq-gs__panel.is-active:first-of-type,
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='1'].is-active{
        grid-template-columns:1fr!important;
      }
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='1'].is-active>.uxq-gs__brief,
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='1'].is-active>.uxq-gs__artifact{
        grid-column:1!important;
      }

      /* Review / submit step: readable two-column composition */
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='8'].is-active{
        grid-template-columns:minmax(360px,.9fr) minmax(500px,1.3fr)!important;
      }
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='8'].is-active>.uxq-gs__figma,
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='8'].is-active>.uxq-gs__brief{
        grid-column:1!important;
        grid-row:1 / span 3!important;
      }
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='8'].is-active>.studio-checks,
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='8'].is-active>.studio-validation,
      body[data-device-mode='pc'] .uxq-gs__panel[data-step='8'].is-active>.actions{
        grid-column:2!important;
      }

      /* Fix broken vertical checkbox labels */
      body[data-device-mode='pc'] .studio-checks,
      body[data-device-mode='tablet'] .studio-checks{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:7px!important;
        padding:16px!important;
        width:100%!important;
        box-sizing:border-box!important;
      }
      body[data-device-mode='pc'] .studio-check,
      body[data-device-mode='tablet'] .studio-check{
        display:grid!important;
        grid-template-columns:26px minmax(0,1fr)!important;
        align-items:start!important;
        justify-content:start!important;
        gap:10px!important;
        width:100%!important;
        padding:8px 10px!important;
        margin:0!important;
        box-sizing:border-box!important;
        text-align:left!important;
      }
      body[data-device-mode='pc'] .studio-check input,
      body[data-device-mode='tablet'] .studio-check input{
        width:20px!important;
        height:20px!important;
        margin:1px 0 0!important;
        justify-self:start!important;
      }
      body[data-device-mode='pc'] .studio-check span,
      body[data-device-mode='tablet'] .studio-check span{
        display:block!important;
        width:auto!important;
        max-width:none!important;
        min-width:0!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:anywhere!important;
        line-height:1.45!important;
        text-align:left!important;
      }

      /* Validation should be concise and not become a giant red wall */
      body[data-device-mode='pc'] .studio-validation,
      body[data-device-mode='tablet'] .studio-validation{
        max-height:190px!important;
        overflow:auto!important;
        padding:14px 16px!important;
        border-radius:14px!important;
        font-size:.86rem!important;
        line-height:1.48!important;
      }
      body[data-device-mode='pc'] .studio-validation ul,
      body[data-device-mode='tablet'] .studio-validation ul{
        margin:7px 0 0!important;
        padding-left:1.15rem!important;
      }

      /* Bottom navigation and secondary actions */
      body[data-device-mode='pc'] .uxq-gs__nav{
        max-width:none!important;
        width:100%!important;
        display:grid!important;
        grid-template-columns:1fr 1fr!important;
        gap:12px!important;
      }
      body[data-device-mode='pc'] .results>.actions,
      body[data-device-mode='tablet'] .results>.actions{
        display:flex!important;
        justify-content:center!important;
        align-items:center!important;
        flex-wrap:wrap!important;
        gap:10px!important;
        margin-top:14px!important;
      }
      body[data-device-mode='pc'] .results>.actions .btn,
      body[data-device-mode='tablet'] .results>.actions .btn{
        min-height:42px!important;
        padding:9px 16px!important;
        font-size:.84rem!important;
      }
      body[data-device-mode='pc'] .results>.actions .btn:first-child,
      body[data-device-mode='tablet'] .results>.actions .btn:first-child{
        opacity:.72!important;
        background:transparent!important;
        border-style:dashed!important;
      }

      /* Tablet keeps one clear column when a two-column composition becomes cramped */
      @media (max-width:1100px){
        body[data-device-mode='tablet'] .uxq-gs__panel.is-active{
          display:grid!important;
          grid-template-columns:1fr!important;
          gap:14px!important;
        }
        body[data-device-mode='tablet'] .uxq-gs__panel.is-active>*{
          grid-column:1!important;
          grid-row:auto!important;
          width:100%!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else install();
  window.addEventListener('uxq-device-mode-changed', install);
  window.UXQStudioPCPolishV1 = Object.freeze({ install, version:'20260722-STUDIO-PC-POLISH-V1' });
})();