/* CSAI2601 UX Quest • Choice Stabilizer Final v1
 * Final student-facing choice stabilizer.
 * Neutral labels only (A/B/C/D), no P1/P2/TRAP/CHECK hints, no continuous rewrite loop.
 * Keeps data-choice untouched for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const bad=/ตัวลวง|TRAP|trap|decoy|distractor|PRIORITY\s*[123]|P[123]\b|CHECK\b/i;
  const letters=['A','B','C','D'];
  function label(i){return letters[i]||String(i+1);}
  function safeTitle(raw,i){
    raw=text(raw);
    if(!raw || bad.test(raw) || /^ตัวเลือก\s+[A-D]/i.test(raw) || /^การ์ด\s+[A-D]/i.test(raw)) return `แนวทาง ${label(i)}`;
    return raw;
  }
  function safeSub(raw){
    raw=text(raw);
    if(!raw || bad.test(raw)) return 'อ่านสถานการณ์ แล้วเลือกคำตอบที่มีเหตุผลจากหลักฐานมากที่สุด';
    return raw;
  }
  function setOption(btn,i){
    btn.dataset.choiceStableFinal='1';
    btn.setAttribute('data-mechanic-label',label(i));
    btn.setAttribute('data-choice-tag',label(i));
    const b=$('b',btn), span=$('span',btn);
    if(b) b.textContent=safeTitle(b.textContent,i);
    if(span) span.textContent=safeSub(span.textContent);
  }
  function setMini(card,i){
    card.dataset.choiceStableFinal='1';
    const lane=$('.uxqMiniLane,.uxqDragLane',card);
    const head=$('strong,b',card);
    const small=$('small,span',card);
    if(lane) lane.textContent=label(i);
    if(head) head.textContent=safeTitle(head.textContent,i);
    if(small) small.textContent=safeSub(small.textContent);
  }
  function style(){
    if($('#uxq-choice-stabilizer-final-style'))return;
    const s=document.createElement('style'); s.id='uxq-choice-stabilizer-final-style'; s.textContent=`
      .question .option[data-choice-stable-final="1"],.uxqMiniCard[data-choice-stable-final="1"],.uxqDragCard[data-choice-stable-final="1"]{transform:none!important;will-change:auto!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important;min-height:132px!important;max-height:154px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important}
      .question .option[data-choice-stable-final="1"]:before{content:attr(data-choice-tag)!important;margin-bottom:0!important}
      .question .option[data-choice-stable-final="1"] b,.uxqMiniCard[data-choice-stable-final="1"] strong,.uxqDragCard[data-choice-stable-final="1"] b{font-size:1.03rem!important;line-height:1.28!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.6em!important;max-height:2.6em!important}
      .question .option[data-choice-stable-final="1"] span,.uxqMiniCard[data-choice-stable-final="1"] small,.uxqDragCard[data-choice-stable-final="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.7em!important;max-height:2.7em!important;line-height:1.35!important;color:#b9c8e4!important}
      .uxqChoiceFinalBadge{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(110,231,255,.32);border-radius:999px;background:rgba(110,231,255,.07);color:#bff3ff;padding:6px 9px;font-weight:900;font-size:.78rem;margin:6px 0 8px}`;
    document.head.appendChild(s);
  }
  function mark(){return [text($('.top .pill')),text($('.hud .meter b')),$$('.question > .options .option[data-choice]').map(x=>x.dataset.choice).join(',')].join('|');}
  let last='';
  function apply(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const options=$$('.question > .options .option[data-choice]');
    const cards=$$('.uxqMiniCard,.uxqDragCard');
    if(options.length+cards.length===0)return;
    const m=mark()+'|'+options.length+'|'+cards.length;
    if(last===m && q.dataset.choiceStableFinal==='1')return;
    style();
    options.forEach(setOption);
    cards.forEach(setMini);
    if(!q.querySelector('.uxqChoiceFinalBadge')){
      const badge=document.createElement('div'); badge.className='uxqChoiceFinalBadge'; badge.textContent='✅ ตัวเลือกนิ่ง: A/B/C/D ไม่มีคำใบ้จาก label';
      const anchor=q.querySelector('.uxqChallengeHud,.uxqAdaptiveBar,.student-ready-note');
      if(anchor) anchor.insertAdjacentElement('afterend',badge); else q.insertBefore(badge,q.firstChild);
    }
    q.dataset.choiceStableFinal='1';
    last=m;
  }
  let t=0; function schedule(){clearTimeout(t);t=setTimeout(apply,140);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  new MutationObserver(()=>{ if(mark()!==last) schedule(); }).observe(document.documentElement,{childList:true,subtree:true});
})();
