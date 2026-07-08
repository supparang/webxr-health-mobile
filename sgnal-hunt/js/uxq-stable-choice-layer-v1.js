/* CSAI2601 UX Quest • Stable Choice Layer v1
 * One stable final layer for visible choices.
 * Stops the card flicker caused by multiple late DOM rewriters by applying once per round
 * and then only re-checking on new round/case marks. No continuous text rewrite loop.
 * Keeps original data-choice untouched for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const map={
    W1:[['A','TASK','ดู task impact'],['B','GOAL','ดู goal ผู้ใช้'],['C','SIGNAL','ดู signal หลัก'],['D','PROOF','วัด proof ได้']],
    W2:[['A','EVID','หลักฐานผู้ใช้'],['B','ASSUME','สมมติฐานทีม'],['C','USER','เสียงผู้ใช้จริง'],['D','TEST','ทดสอบสั้น']],
    W3:[['A','MODEL','mental model'],['B','LOAD','ลด cognitive load'],['C','SIGNAL','feedback ชัด'],['D','REPAIR','repair แล้ว validate']],
    W4:[['A','QUESTION','คำถามไม่ชี้นำ'],['B','CLUE','clue จากพฤติกรรม'],['C','NEED','persona need'],['D','OBSERVE','observe ต่อ']],
    W5:[['A','INSIGHT','insight จริง'],['B','ROOT','root cause'],['C','HMW','HMW ไม่ล็อก'],['D','CONCEPT','concept ทดสอบได้']],
    W6:[['A','ENTRY','entry point'],['B','PATH','happy path'],['C','RECOVER','error recovery'],['D','TRAP','trap ที่หลอก']],
    W7:[['A','P1','เด่นอันดับแรก'],['B','P2','รองรับ hierarchy'],['C','P3','ช่วย CTA/context'],['D','TRAP','trap ที่ดูดี']],
    W8:[['A','CHAIN','chain หลัก'],['B','MATCH','mismatch'],['C','REVISE','revision'],['D','WHY','เหตุผลป้องกัน']],
    W9:[['A','PATTERN','component pattern'],['B','STATE','state/variant'],['C','RULE','system rule'],['D','TRAP','trap ซ้ำซ้อน']],
    W10:[['A','MOBILE','mobile task'],['B','A11Y','accessibility'],['C','FOCUS','focus/touch'],['D','CHECK','check หลังแก้']],
    W11:[['A','COLOR','color meaning'],['B','TYPE','type hierarchy'],['C','CONTRAST','contrast'],['D','SPACE','spacing group']],
    W12:[['A','STATE','component state'],['B','COPY','microcopy'],['C','RECOVER','recovery'],['D','PREVENT','prevent error']],
    W13:[['A','TASK','task flow'],['B','LINK','missing link'],['C','ERROR','error path'],['D','TEST','prototype test']],
    W14:[['A','HIGH','task failure'],['B','MID','severity signal'],['C','FIX','evidence-based fix'],['D','RETEST','retest proof']],
    W15:[['A','STORY','case story'],['B','EVID','evidence chain'],['C','PROOF','testing proof'],['D','DEFEND','defense']],
    B1:[['A','UX','UX friction'],['B','HCD','HCD evidence'],['C','PSY','psychology'],['D','PROOF','proof']],
    B2:[['A','PERSONA','persona chain'],['B','PROBLEM','problem'],['C','FLOW','flow'],['D','WIRE','wireframe']],
    B3:[['A','PATTERN','pattern'],['B','RESP','responsive'],['C','A11Y','a11y'],['D','VISUAL','visual']],
    B4:[['A','STATE','state'],['B','PROTO','prototype'],['C','EVID','evidence'],['D','RETEST','retest']]
  };
  function spec(i){const list=map[node()]||map.W1;return list[i%list.length];}
  function mark(){return [node(),text($('.top .pill')),text($('.hud .meter b')),$$('.question > .options .option[data-choice]').map(b=>b.dataset.choice).join(',')].join('|');}
  function title(i){const s=spec(i);return `การ์ด ${s[0]} • ${s[1]}`;}
  function clue(i){const s=spec(i);return `Clue: ${s[2]} — อ่านสถานการณ์ก่อนเลือก`;}
  function applyOption(btn,i){
    btn.dataset.stableChoice='1';
    btn.setAttribute('data-choice-tag',spec(i)[1]);
    btn.setAttribute('data-mechanic-label',spec(i)[1]);
    const b=$('b',btn), span=$('span',btn);
    if(b)b.textContent=title(i);
    if(span)span.textContent=clue(i);
  }
  function applyMini(card,i){
    card.dataset.stableChoice='1';
    const lane=$('.uxqMiniLane',card), strong=$('strong',card), small=$('small',card);
    if(lane)lane.textContent=spec(i)[1];
    if(strong)strong.textContent=title(i);
    if(small)small.textContent=clue(i);
  }
  function applyDrag(card,i){
    card.dataset.stableChoice='1';
    const lane=$('.uxqDragLane',card), b=$('b',card), small=$('small',card);
    if(lane)lane.textContent=spec(i)[1];
    if(b)b.textContent=title(i);
    if(small)small.textContent=clue(i);
  }
  function style(){
    if($('#uxq-stable-choice-style'))return;
    const s=document.createElement('style');s.id='uxq-stable-choice-style';s.textContent=`
      .question .option[data-stable-choice="1"],.uxqMiniCard[data-stable-choice="1"],.uxqDragCard[data-stable-choice="1"]{transform:none!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important;min-height:132px!important;max-height:154px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important;will-change:auto!important}
      .question .option[data-stable-choice="1"]:before{content:attr(data-choice-tag)!important;margin-bottom:0!important}.question .option[data-stable-choice="1"] b,.uxqMiniCard[data-stable-choice="1"] strong,.uxqDragCard[data-stable-choice="1"] b{font-size:1.04rem!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;min-height:1.35em!important;display:block!important}.question .option[data-stable-choice="1"] span,.uxqMiniCard[data-stable-choice="1"] small,.uxqDragCard[data-stable-choice="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.75em!important;max-height:2.75em!important;line-height:1.35!important;color:#b9c8e4!important}.uxqChoiceStableBadge{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(110,231,255,.32);border-radius:999px;background:rgba(110,231,255,.07);color:#bff3ff;padding:6px 9px;font-weight:900;font-size:.78rem;margin:6px 0 8px}`;
    document.head.appendChild(s);
  }
  let last='';
  function apply(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const m=mark();
    const hasCards=$$('.question > .options .option[data-choice],.uxqMiniCard,.uxqDragCard').length;
    if(!hasCards)return;
    if(last===m && q.dataset.stableChoiceApplied==='1')return;
    style();
    $$('.question > .options .option[data-choice]').forEach(applyOption);
    $$('.uxqMiniCard').forEach(applyMini);
    $$('.uxqDragCard').forEach(applyDrag);
    if(!q.querySelector('.uxqChoiceStableBadge')){
      const badge=document.createElement('div');badge.className='uxqChoiceStableBadge';badge.textContent='✅ ตัวเลือกล็อกนิ่ง ไม่ซ้ำ ไม่ใบ้จากความยาว';
      const anchor=q.querySelector('.uxqChallengeHud,.uxqAdaptiveBar,.student-ready-note');
      if(anchor)anchor.insertAdjacentElement('afterend',badge);else q.insertBefore(badge,q.firstChild);
    }
    q.dataset.stableChoiceApplied='1';
    last=m;
  }
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(apply,120);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  new MutationObserver(()=>{
    const m=mark();
    if(m!==last){schedule();}
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
