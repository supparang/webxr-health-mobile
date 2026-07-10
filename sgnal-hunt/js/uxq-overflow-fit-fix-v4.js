/* CSAI2601 UX Quest • Overflow Fit Fix v4
 * Final readable layout pass: avoid 4 narrow option cards in the visually narrow game area.
 * Visual-only: no scoring, data-choice, reason, strict-gate, or sheet-sync changes.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const node = () => String(new URLSearchParams(location.search || '').get('node') || new URLSearchParams(location.search || '').get('id') || 'W1').toUpperCase();
  if (!/^(W([1-9]|1[0-5])|B[1-4])$/.test(node())) return;

  function style() {
    if ($('#uxq-overflow-fit-fix-v4-style')) return;
    const s = document.createElement('style');
    s.id = 'uxq-overflow-fit-fix-v4-style';
    s.textContent = `
      html,body,#uxqCanonicalNode{max-width:100vw!important;overflow-x:hidden!important}
      #uxqCanonicalNode *{box-sizing:border-box!important}

      .question,.verify,.feedback,.artifact,.result,.summary{
        max-width:100%!important;
        min-width:0!important;
        overflow:visible!important;
        contain:none!important;
      }

      /* Always give options enough width on desktop/tablet. Four columns were too tight. */
      .question .options,
      .question .choices,
      .verify .options,
      .verify .choices{
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:14px!important;
        align-items:stretch!important;
        overflow:visible!important;
      }

      @media(max-width:720px){
        .question .options,
        .question .choices,
        .verify .options,
        .verify .choices{
          grid-template-columns:1fr!important;
        }
      }

      .question .option,
      .question button.option,
      .question [role="button"],
      .verify .option,
      .uxqMiniCard,
      .uxqDragCard{
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        height:auto!important;
        min-height:132px!important;
        max-height:none!important;
        overflow:visible!important;
        contain:none!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        align-items:stretch!important;
        gap:8px!important;
        padding:14px 16px!important;
        white-space:normal!important;
        text-overflow:clip!important;
      }

      .question .option *,
      .question button.option *,
      .question [role="button"] *,
      .verify .option *,
      .uxqMiniCard *,
      .uxqDragCard *{
        max-width:100%!important;
        min-width:0!important;
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        white-space:normal!important;
        overflow-wrap:anywhere!important;
        word-break:break-word!important;
        text-overflow:clip!important;
      }

      .question .option b,
      .question .option strong,
      .question button.option b,
      .question button.option strong,
      .verify .option b,
      .verify .option strong,
      .uxqMiniCard b,
      .uxqMiniCard strong,
      .uxqDragCard b,
      .uxqDragCard strong{
        display:block!important;
        font-size:clamp(.88rem,.45vw + .68rem,1rem)!important;
        line-height:1.36!important;
      }

      .question .option small,
      .question button.option small,
      .verify .option small,
      .uxqMiniCard small,
      .uxqDragCard small{
        display:block!important;
        font-size:clamp(.74rem,.32vw + .60rem,.86rem)!important;
        line-height:1.38!important;
        margin-top:4px!important;
        padding-bottom:2px!important;
      }

      /* Hint row: full width text + stable button */
      .question .hint,
      .question .uxqHint,
      .question .hintRow,
      .question .uxqHintRow{
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        overflow-wrap:anywhere!important;
        gap:12px!important;
        margin-top:14px!important;
        align-items:stretch!important;
      }

      .uxqOverflowFitV4Badge{
        display:inline-flex;
        width:max-content;
        max-width:100%;
        padding:5px 9px;
        margin:4px 0 10px;
        border-radius:999px;
        background:rgba(34,197,94,.13);
        border:1px solid rgba(34,197,94,.62);
        color:#d1fae5;
        font-weight:900;
        font-size:.72rem;
      }
    `;
    document.head.appendChild(s);
  }

  function badge() {
    const q = $('.question');
    if (!q || $('.uxqOverflowFitV4Badge', q)) return;
    const b = document.createElement('div');
    b.className = 'uxqOverflowFitV4Badge';
    b.textContent = '✅ fit v4 • roomy text cards';
    const a = q.querySelector('.uxqOverflowFitV3Badge,.uxqOverflowFitV2Badge,.uxqOverflowFitBadge,.uxqW1StageSpecificBadge,.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge,.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge');
    if (a) a.insertAdjacentElement('afterend', b);
    else q.insertBefore(b, q.firstChild);
  }

  function run() { style(); badge(); }
  let t = 0;
  function schedule() { clearTimeout(t); t = setTimeout(run, 40); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
})();
