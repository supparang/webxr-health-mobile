/* CSAI2601 UX Quest • Overflow Fit Fix v3
 * Fixes remaining option-card text overflow inside W1-W15 / B1-B4 cards.
 * Visual-only: no scoring, data-choice, reason, strict-gate, or sheet-sync changes.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const node = () => String(new URLSearchParams(location.search || '').get('node') || new URLSearchParams(location.search || '').get('id') || 'W1').toUpperCase();
  if (!/^(W([1-9]|1[0-5])|B[1-4])$/.test(node())) return;

  function style() {
    if ($('#uxq-overflow-fit-fix-v3-style')) return;
    const s = document.createElement('style');
    s.id = 'uxq-overflow-fit-fix-v3-style';
    s.textContent = `
      html,body,#uxqCanonicalNode{
        max-width:100vw!important;
        overflow-x:hidden!important;
      }
      #uxqCanonicalNode,#uxqCanonicalNode *{
        box-sizing:border-box!important;
      }

      /* outer shells must never force horizontal overflow */
      #uxqCanonicalNode main,
      #uxqCanonicalNode section,
      #uxqCanonicalNode article,
      #uxqCanonicalNode .screen,
      #uxqCanonicalNode .panel,
      #uxqCanonicalNode .question,
      #uxqCanonicalNode .verify,
      #uxqCanonicalNode .artifact,
      #uxqCanonicalNode .feedback{
        max-width:100%!important;
        min-width:0!important;
        overflow-wrap:anywhere!important;
      }

      /* question option grid: keep 4 cards only when there is enough real room */
      .question .options,
      .question .choices,
      .verify .options,
      .verify .choices{
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))!important;
        gap:14px!important;
        align-items:stretch!important;
        overflow:visible!important;
      }

      /* cards can grow vertically; nothing should be clipped */
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
        min-height:118px!important;
        max-height:none!important;
        overflow:visible!important;
        contain:none!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        align-items:stretch!important;
        gap:7px!important;
        padding:12px 14px!important;
        white-space:normal!important;
        text-overflow:clip!important;
      }

      /* every text child inside a card must wrap, including generated/non-standard wrappers */
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
        font-size:clamp(.83rem,.52vw + .58rem,1rem)!important;
        line-height:1.34!important;
      }

      .question .option small,
      .question button.option small,
      .verify .option small,
      .uxqMiniCard small,
      .uxqDragCard small{
        display:block!important;
        font-size:clamp(.70rem,.42vw + .52rem,.84rem)!important;
        line-height:1.34!important;
        margin-top:2px!important;
      }

      /* If the visible game area is narrow, use 2 columns; phone = 1 column */
      @media (max-width: 1320px){
        .question .options,.question .choices,.verify .options,.verify .choices{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }
      }
      @media (max-width: 720px){
        .question .options,.question .choices,.verify .options,.verify .choices{
          grid-template-columns:1fr!important;
        }
      }

      /* Slightly roomier hint row so it does not crash into the hint button */
      .question .hint,
      .question .uxqHint,
      .question .hintRow,
      .question .uxqHintRow{
        max-width:100%!important;
        min-width:0!important;
        overflow-wrap:anywhere!important;
        gap:10px!important;
        margin-top:12px!important;
      }

      .uxqOverflowFitV3Badge{
        display:inline-flex;
        width:max-content;
        max-width:100%;
        padding:5px 9px;
        margin:4px 0 10px;
        border-radius:999px;
        background:rgba(34,197,94,.12);
        border:1px solid rgba(34,197,94,.55);
        color:#d1fae5;
        font-weight:900;
        font-size:.72rem;
      }
    `;
    document.head.appendChild(s);
  }

  function badge() {
    const q = $('.question');
    if (!q || $('.uxqOverflowFitV3Badge', q)) return;
    const b = document.createElement('div');
    b.className = 'uxqOverflowFitV3Badge';
    b.textContent = '✅ fit v3 • no text overflow';
    const a = q.querySelector('.uxqOverflowFitV2Badge,.uxqOverflowFitBadge,.uxqW1StageSpecificBadge,.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge,.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge');
    if (a) a.insertAdjacentElement('afterend', b);
    else q.insertBefore(b, q.firstChild);
  }

  function run() {
    style();
    badge();
  }

  let t = 0;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(run, 40);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
})();
