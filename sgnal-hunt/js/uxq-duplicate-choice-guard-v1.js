/* CSAI2601 UX Quest • Duplicate Choice Guard v1
 * Final safety guard against duplicate visible choices in the same round.
 * It rewrites duplicate visible labels/clues only; data-choice and correctness are untouched.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const repair={
    W1:['task impact','goal fit','signal proof','test metric'],W2:['user evidence','assumption trap','behavior clue','small test'],W3:['mental model','cognitive load','feedback signal','repair check'],W4:['research question','behavior clue','persona need','observation'],W5:['insight','root cause','HMW','concept'],W6:['entry','happy path','recovery','trap'],W7:['priority one','hierarchy clue','CTA context','visual trap'],W8:['chain','mismatch','revision','rationale'],W9:['pattern','state','rule','system trap'],W10:['mobile','a11y','focus/touch','check'],W11:['color meaning','type hierarchy','contrast','spacing'],W12:['state','microcopy','recovery','prevention'],W13:['task flow','link','error path','prototype'],W14:['task failure','severity signal','fix','retest'],W15:['story','evidence','proof','defense'],B1:['UX friction','HCD evidence','psychology','proof'],B2:['persona','problem','flow','wireframe'],B3:['pattern','responsive','a11y','visual'],B4:['state','prototype','evidence','retest']
  };
  function norm(s){return text(s).toLowerCase().replace(/[\s•:;,.!?()\-–—]+/g,'');}
  function label(i){return ['A','B','C','D'][i]||String(i+1);}
  function tip(i){const list=repair[node()]||repair.W1;return list[i%list.length];}
  function uniqCards(selector,titleSel,subSel){
    const cards=$$(selector); if(cards.length<2)return;
    const seen=new Map();
    cards.forEach((card,i)=>{
      const title=$(titleSel,card); const sub=$(subSel,card);
      const key=norm((title?title.textContent:'')+' '+(sub?sub.textContent:''));
      if(!key)return;
      if(seen.has(key)){
        if(title)title.textContent=`การ์ด ${label(i)} • ${tip(i)}`;
        if(sub)sub.textContent=`Clue เฉพาะ: ${tip(i)} — ตรวจหลักฐานใน case`;
        card.dataset.duplicateRepaired='1';
      } else seen.set(key,i);
    });
  }
  function uniqPlain(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const buttons=$$('.question > .options .option[data-choice]'); if(buttons.length<2)return;
    const seen=new Map();
    buttons.forEach((btn,i)=>{
      const b=$('b',btn); const span=$('span',btn);
      const key=norm((b?b.textContent:'')+' '+(span?span.textContent:''));
      if(!key)return;
      if(seen.has(key)){
        if(b)b.textContent=`การ์ด ${label(i)} • ${tip(i)}`;
        if(span)span.textContent=`Clue เฉพาะ: ${tip(i)} — ตรวจหลักฐานใน case`;
        btn.dataset.duplicateRepaired='1';
      } else seen.set(key,i);
    });
  }
  function badge(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback')||q.querySelector('[data-duplicate-guard-badge]'))return;
    const b=document.createElement('div'); b.setAttribute('data-duplicate-guard-badge','1'); b.className='uxqDuplicateGuardBadge'; b.textContent='🧩 ตัวเลือกถูกตรวจไม่ให้ซ้ำในรอบนี้';
    const note=q.querySelector('.student-ready-note,.uxqAdaptiveBar,.uxqChallengeHud'); if(note) note.insertAdjacentElement('afterend',b); else q.insertBefore(b,q.firstChild);
  }
  function style(){if($('#uxq-duplicate-choice-guard-style'))return; const s=document.createElement('style'); s.id='uxq-duplicate-choice-guard-style'; s.textContent=`.uxqDuplicateGuardBadge{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(110,231,255,.32);border-radius:999px;background:rgba(110,231,255,.07);color:#bff3ff;padding:6px 9px;font-weight:900;font-size:.78rem;margin:6px 0 8px}.option[data-duplicate-repaired="1"],.uxqMiniCard[data-duplicate-repaired="1"],.uxqDragCard[data-duplicate-repaired="1"]{outline:1px solid rgba(110,231,255,.28)}`; document.head.appendChild(s);}
  function apply(){style(); uniqPlain(); uniqCards('.uxqMiniCard','strong','small'); uniqCards('.uxqDragCard','b','small'); badge();}
  let loops=0; function run(){apply(); loops+=1; if(loops<80)setTimeout(run,120);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true}); else run(); new MutationObserver(()=>{clearTimeout(run._t); run._t=setTimeout(apply,30);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
