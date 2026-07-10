/* CSAI2601 UX Quest • W1 Hard Override v8
 * Scope: W1 only.
 * Direct inline layout override for the real player DOM.
 * Fixes dense-grid v7 not winning against earlier responsive/two-column rules.
 * No content/scoring changes: preserves choice ids, correctness, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const NODE = String(params.get('node') || params.get('id') || '').toUpperCase();
  if (NODE !== 'W1') return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function injectStyle(){
    let s = $('#uxq-w1-hard-override-v8-style');
    if (!s) {
      s = document.createElement('style');
      s.id = 'uxq-w1-hard-override-v8-style';
      document.head.appendChild(s);
    }
    s.textContent = `
      body .question .options, body .verify .options{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(135px,1fr))!important;
        gap:8px!important;
        align-items:start!important;
        margin-top:10px!important;
      }
      body .question .option, body .verify .option{
        min-height:58px!important;
        height:auto!important;
        max-height:none!important;
        padding:9px 10px!important;
        border-radius:13px!important;
        display:block!important;
        overflow:hidden!important;
      }
      body .question .option b, body .verify .option b{
        display:block!important;
        font-size:.88rem!important;
        line-height:1.22!important;
        margin:0!important;
        padding:0!important;
        white-space:normal!important;
        overflow-wrap:break-word!important;
      }
      body .question .option span, body .verify .option span{
        display:none!important;
      }
      body .question{padding:14px 16px!important;}
      body .question .prompt{font-size:1.25rem!important;line-height:1.28!important;margin:0 0 6px!important;}
      body .question .instruction{font-size:.92rem!important;line-height:1.45!important;margin:0 0 8px!important;}
      body .question .hint{padding:8px 10px!important;line-height:1.35!important;}
      body .question .utility{margin-top:10px!important;}
      @media(max-width:640px){body .question .options, body .verify .options{grid-template-columns:1fr!important;}}
      .uxqW1DenseBadge{display:none!important;}
      .uxqW1HardBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 8px;border-radius:999px;background:rgba(255,209,102,.12);border:1px solid rgba(255,209,102,.58);color:#fff0b0;font-weight:950;font-size:.72rem}
    `;
    // Keep this style as the last style block so it wins against observer-injected CSS.
    document.head.appendChild(s);
  }

  function inlineOverride(){
    const q = $('.question');
    if (!q) return;
    q.style.setProperty('padding','14px 16px','important');
    $$('.question .options, .verify .options').forEach((el)=>{
      el.style.setProperty('display','grid','important');
      el.style.setProperty('grid-template-columns','repeat(4,minmax(135px,1fr))','important');
      el.style.setProperty('gap','8px','important');
      el.style.setProperty('align-items','start','important');
      el.style.setProperty('margin-top','10px','important');
    });
    $$('.question .option, .verify .option').forEach((el)=>{
      el.style.setProperty('min-height','58px','important');
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('padding','9px 10px','important');
      el.style.setProperty('display','block','important');
      el.style.setProperty('overflow','hidden','important');
      el.style.setProperty('border-radius','13px','important');
      const b = el.querySelector('b,strong');
      if (b) {
        b.style.setProperty('font-size','.88rem','important');
        b.style.setProperty('line-height','1.22','important');
        b.style.setProperty('margin','0','important');
        b.style.setProperty('white-space','normal','important');
        b.style.setProperty('overflow-wrap','break-word','important');
      }
      el.querySelectorAll('span,small,p').forEach((x)=>x.style.setProperty('display','none','important'));
    });
    const old = $('.uxqW1HardBadge', q);
    if (!old) {
      const b = document.createElement('div');
      b.className = 'uxqW1HardBadge';
      b.textContent = '✅ W1 hard compact • 4-card override';
      const anchor = q.querySelector('.uxqW1DenseBadge,.uxqW1AutoBadge,.uxqW1CompactBadge,.uxqW1NoSubtextBadge,.uxqW1NoSpoilerBadge');
      if (anchor) anchor.insertAdjacentElement('afterend', b); else q.insertBefore(b, q.firstChild);
    }
  }

  let t=0;
  function run(){ clearTimeout(t); t=setTimeout(()=>{ injectStyle(); inlineOverride(); }, 15); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
  new MutationObserver(run).observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true });
})();
