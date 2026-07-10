/* CSAI2601 UX Quest • W2-W7 Balanced Compact v1
 * Scope: W2-W7 only.
 * Goal: apply the final W1 readable-card standard to foundation missions.
 * - no tiny/over-compressed cards
 * - no option subtext clues
 * - balanced 2-column/4-card layout
 * - clamp long text inside cards
 * - does not change data-choice, scoring, reason, sheet sync
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const NODE = String(params.get('node') || params.get('id') || '').toUpperCase();
  if (!/^W[2-7]$/.test(NODE)) return;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const badges = {
    W2:'✅ W2 HCD Lab • balanced choices',
    W3:'✅ W3 Psychology • balanced choices',
    W4:'✅ W4 Research • balanced choices',
    W5:'✅ W5 Define/HMW • balanced choices',
    W6:'✅ W6 Flow Map • balanced choices',
    W7:'✅ W7 Wireframe • balanced choices'
  };

  const titles = {
    W2:['HCD Evidence Lab','เลือกหลักฐานที่โยงผู้ใช้ → ปัญหา → ทดลอง'],
    W3:['Psychology Signal','วิเคราะห์ attention, memory, load และ feedback'],
    W4:['Research Detective','แยกหลักฐานจริงออกจาก assumption'],
    W5:['Problem/HMW Studio','นิยามปัญหาและโจทย์ How Might We'],
    W6:['Flow Mapper','จัดเส้นทางงานให้ผู้ใช้ไปต่อได้'],
    W7:['Wireframe Forge','จัด priority, layout, CTA และ mobile']
  };

  function injectStyle(){
    let st = $('#uxq-w2-w7-balanced-compact-v1-style');
    if(!st){ st = document.createElement('style'); st.id = 'uxq-w2-w7-balanced-compact-v1-style'; document.head.appendChild(st); }
    st.textContent = `
      body .shell{width:min(1180px,100%)!important;}
      body .question{padding:18px 20px!important;border-radius:20px!important;}
      body .question .options, body .verify .options{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:12px!important;
        align-items:stretch!important;
        margin-top:14px!important;
      }
      body .question .option, body .verify .option{
        min-height:104px!important;
        height:auto!important;
        max-height:none!important;
        padding:14px!important;
        border-radius:16px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
        overflow:hidden!important;
        background:linear-gradient(150deg,rgba(8,24,52,.78),rgba(5,15,35,.78))!important;
      }
      body .question .option b, body .verify .option b,
      body .question .option strong, body .verify .option strong{
        display:-webkit-box!important;
        -webkit-line-clamp:3!important;
        -webkit-box-orient:vertical!important;
        overflow:hidden!important;
        font-size:clamp(.88rem,1.02vw,.98rem)!important;
        line-height:1.3!important;
        margin:0!important;
        padding:0!important;
        overflow-wrap:break-word!important;
      }
      body .question .option span, body .verify .option span,
      body .question .option small, body .verify .option small,
      body .question .option p, body .verify .option p{
        display:none!important;
      }
      body .question .prompt{font-size:1.34rem!important;line-height:1.3!important;margin:0 0 7px!important;}
      body .question .instruction{font-size:.95rem!important;line-height:1.5!important;margin:0 0 10px!important;}
      body .question .hint{padding:10px 12px!important;line-height:1.38!important;min-height:0!important;}
      body .question .utility{margin-top:12px!important;align-items:stretch!important;}
      body .question .btn{min-height:44px!important;padding:10px 14px!important;}
      .uxqW2W7BalancedBadge{display:inline-flex;width:max-content;max-width:100%;padding:6px 10px;margin:6px 0 10px;border-radius:999px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.58);color:#d8ffe7;font-weight:950;font-size:.74rem;box-shadow:0 0 0 1px rgba(255,255,255,.04) inset;}
      .uxqW2W7Panel{border:1px solid rgba(110,231,255,.35)!important;background:linear-gradient(135deg,rgba(12,54,86,.58),rgba(39,31,83,.48))!important;}
      @media(max-width:980px){
        body .question .options, body .verify .options{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
        body .question .option, body .verify .option{min-height:96px!important;}
      }
      @media(max-width:640px){
        body .question .options, body .verify .options{grid-template-columns:1fr!important;}
        body .question .option, body .verify .option{min-height:auto!important;}
      }
    `;
  }

  function cleanSpoilerText(){
    $$('.question .option, .verify .option').forEach((card) => {
      card.querySelectorAll('span, small, p').forEach((x) => x.style.setProperty('display','none','important'));
      const b = card.querySelector('b,strong');
      if(!b) return;
      let text = String(b.textContent || '').replace(/\s+/g,' ').trim();
      text = text
        .replace(/^เลือกคำตอบที่ตรงกับหน้าที่ของข้อนี้ที่สุด\s*/,'')
        .replace(/^อ่านสถานการณ์\s*แล้วเลือกคำตอบที่มีเหตุผลจากหลักฐานมากที่สุด\s*/,'')
        .replace(/\s*โดยเชื่อมจากหลักฐาน\s*→\s*decision\s*→\s*สิ่งที่จะปรับ.*$/,'')
        .replace(/\s*และต้องรู้ next step อะไร$/,'')
        .replace(/\s*อย่างไร$/,'')
        .trim();
      if(text.length > 86) text = text.slice(0, 84).trim() + '…';
      if(text) b.textContent = text;
    });
  }

  function decorate(){
    const q = $('.question');
    if(!q) return;
    q.classList.add('uxqW2W7Panel');
    q.style.setProperty('padding','18px 20px','important');

    const existing = $('.uxqW2W7BalancedBadge', q);
    if(!existing){
      const badge = document.createElement('div');
      badge.className = 'uxqW2W7BalancedBadge';
      badge.textContent = badges[NODE] || '✅ balanced choices';
      q.insertBefore(badge, q.firstChild);
    }

    const panelTitle = $('.uxqMechanicPanel strong', q);
    const panelText = $('.uxqMechanicPanel span', q);
    if(panelTitle && titles[NODE]) panelTitle.textContent = titles[NODE][0];
    if(panelText && titles[NODE]) panelText.textContent = titles[NODE][1];

    $$('.question .options,.verify .options').forEach(el=>{
      el.style.setProperty('display','grid','important');
      el.style.setProperty('grid-template-columns','repeat(4,minmax(0,1fr))','important');
      el.style.setProperty('gap','12px','important');
      el.style.setProperty('align-items','stretch','important');
      el.style.setProperty('margin-top','14px','important');
    });
    $$('.question .option,.verify .option').forEach(el=>{
      el.style.setProperty('min-height','104px','important');
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('padding','14px','important');
      el.style.setProperty('overflow','hidden','important');
      const b = el.querySelector('b,strong');
      if(b){
        b.style.setProperty('display','-webkit-box','important');
        b.style.setProperty('-webkit-line-clamp','3','important');
        b.style.setProperty('-webkit-box-orient','vertical','important');
        b.style.setProperty('overflow','hidden','important');
        b.style.setProperty('font-size','.94rem','important');
        b.style.setProperty('line-height','1.3','important');
      }
    });
    cleanSpoilerText();
  }

  let timer = 0;
  function run(){ clearTimeout(timer); timer = setTimeout(()=>{ injectStyle(); decorate(); }, 20); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
  new MutationObserver(run).observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true});
})();
