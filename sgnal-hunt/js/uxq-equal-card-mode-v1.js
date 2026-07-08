/* CSAI2601 UX Quest • Equal Card Mode v1
 * Hard-stop for the visual heuristic "long card = correct".
 * It makes all visible student cards use the same short title pattern and a clipped clue.
 * The original option buttons/data-choice remain unchanged for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const tags={W1:['TASK','GOAL','FEEDBACK','PROOF'],W2:['EVIDENCE','ASSUME','USER','TEST'],W3:['MODEL','LOAD','SIGNAL','REPAIR'],W4:['QUESTION','CLUE','PERSONA','OBSERVE'],W5:['INSIGHT','ROOT','HMW','CONCEPT'],W6:['ENTRY','TASK','RECOVER','TRAP'],W7:['P1','P2','P3','TRAP'],W8:['CHAIN','MATCH','REVISE','WHY'],W9:['PATTERN','STATE','RULE','TRAP'],W10:['MOBILE','A11Y','FOCUS','CHECK'],W11:['COLOR','TYPE','CONTRAST','SPACE'],W12:['STATE','COPY','RECOVER','PREVENT'],W13:['TASK','LINK','ERROR','TEST'],W14:['HIGH','MID','LOW','TRAP'],W15:['STORY','EVIDENCE','PROOF','DEFEND'],B1:['UX','HCD','PSY','PROOF'],B2:['PERSONA','PROBLEM','FLOW','WIRE'],B3:['PATTERN','RESP','A11Y','VISUAL'],B4:['STATE','PROTO','EVID','RETEST']};
  function short(s,max=42){s=text(s); if(s.length<=max)return s; const cut=s.slice(0,max+1); const pos=Math.max(cut.lastIndexOf(' '),cut.lastIndexOf('→'),cut.lastIndexOf('/'),cut.lastIndexOf(',')); return (pos>18?cut.slice(0,pos):cut.slice(0,max)).replace(/[,:;→\-/]+$/,'').trim()+'…';}
  function tag(i){const list=tags[node()]||tags.W1; return list[i%list.length];}
  function choiceLetter(i){return ['A','B','C','D'][i]||String(i+1);}
  function optionButtons(){return $$('.question > .options .option[data-choice]');}
  function sourceText(btn){return short(text($('b',btn))||text(btn),42);}
  function sourceSub(btn){return short(text($('span',btn))||'ตรวจหลักฐานใน case ก่อนเลือก',38);}
  function normalizeMini(){
    const arena=$('.uxqMiniArena'); if(!arena)return;
    const cards=$$('.uxqMiniCard',arena); const buttons=optionButtons(); if(cards.length<4||buttons.length<4)return;
    const mark=[node(),text($('.top .pill')),text($('.hud .meter b')),buttons.map(b=>b.dataset.choice).join(',')].join('|'); if(arena.dataset.equalCardMark===mark)return;
    cards.forEach((card,i)=>{const strong=$('strong',card); const small=$('small',card); const lane=$('.uxqMiniLane',card); if(lane)lane.textContent=tag(i); if(strong)strong.textContent=`การ์ด ${choiceLetter(i)} • ${tag(i)}`; if(small)small.textContent=`Clue: ${sourceText(buttons[i])}`; card.dataset.equalCard='1';});
    arena.dataset.equalCardMark=mark;
  }
  function normalizeDrag(){
    const arena=$('.uxqDragArena'); if(!arena)return;
    const cards=$$('.uxqDragCard',arena); const buttons=optionButtons(); if(cards.length<4||buttons.length<4)return;
    const mark=[node(),text($('.top .pill')),text($('.hud .meter b')),buttons.map(b=>b.dataset.choice).join(',')].join('|'); if(arena.dataset.equalCardMark===mark)return;
    cards.forEach((card,i)=>{const lane=$('.uxqDragLane',card); const b=$('b',card); const small=$('small',card); if(lane)lane.textContent=tag(i); if(b)b.textContent=`การ์ด ${choiceLetter(i)} • ${tag(i)}`; if(small)small.textContent=`Clue: ${sourceText(buttons[i])}`; card.dataset.equalCard='1';});
    const em=$('.uxqDropZone em',arena); if(em && /ลาก|แตะ/.test(text(em))) em.textContent='ลากหรือแตะการ์ดที่เลือกมาที่นี่';
    arena.dataset.equalCardMark=mark;
  }
  function normalizePlain(){
    const buttons=optionButtons(); if(buttons.length<4)return;
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const mark=[node(),text($('.top .pill')),text($('.hud .meter b')),buttons.map(b=>b.dataset.choice).join(',')].join('|'); if(q.dataset.equalPlainMark===mark)return;
    buttons.forEach((btn,i)=>{const b=$('b',btn); const span=$('span',btn); if(b)b.textContent=`การ์ด ${choiceLetter(i)} • ${tag(i)}`; if(span)span.textContent=`Clue: ${sourceText(btn)}`; btn.dataset.equalCard='1';});
    q.dataset.equalPlainMark=mark;
  }
  function style(){if($('#uxq-equal-card-mode-style'))return; const s=document.createElement('style'); s.id='uxq-equal-card-mode-style'; s.textContent=`
    .uxqMiniCard[data-equal-card="1"],.uxqDragCard[data-equal-card="1"]{min-height:126px!important;max-height:148px!important;overflow:hidden!important}
    .uxqMiniCard[data-equal-card="1"] strong,.uxqDragCard[data-equal-card="1"] b{font-size:1rem!important;line-height:1.25!important;min-height:1.3em!important;display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .uxqMiniCard[data-equal-card="1"] small,.uxqDragCard[data-equal-card="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.8em!important;max-height:2.8em!important;line-height:1.38!important}
    .question .option[data-equal-card="1"] b{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;min-height:1.3em!important}.question .option[data-equal-card="1"] span{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.7em!important;max-height:2.7em!important}`; document.head.appendChild(s);}
  let t=0; function apply(){clearTimeout(t); t=setTimeout(()=>{style(); normalizePlain(); normalizeMini(); normalizeDrag();},96);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply(); new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
