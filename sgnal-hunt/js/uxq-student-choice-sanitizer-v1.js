/* CSAI2601 UX Quest • Student Choice Sanitizer v1
 * Last-resort student-facing text sanitizer.
 * Removes authoring/debug words such as ตัวลวง, TRAP, decoy from any visible option/card.
 * Does not touch data-choice or scoring.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const map={
    W7:['P1','P2','P3','CHECK'],W14:['IMPACT','SEVERITY','FIX','RETEST'],W6:['ENTRY','PATH','RECOVERY','CHECK'],
    W1:['TASK','GOAL','SIGNAL','PROOF'],W2:['EVIDENCE','ASSUME','USER','TEST'],W3:['MODEL','LOAD','FEEDBACK','REPAIR'],
    W4:['QUESTION','CLUE','NEED','OBSERVE'],W5:['INSIGHT','ROOT','HMW','CONCEPT'],W8:['CHAIN','MATCH','REVISE','RATIONALE'],
    W9:['PATTERN','STATE','RULE','CHECK'],W10:['MOBILE','A11Y','FOCUS','CHECK'],W11:['COLOR','TYPE','CONTRAST','SPACE'],
    W12:['STATE','COPY','RECOVERY','PREVENT'],W13:['TASK','LINK','ERROR','TEST'],W15:['STORY','EVIDENCE','PROOF','DEFENSE'],
    B1:['UX','HCD','PSY','PROOF'],B2:['PERSONA','PROBLEM','FLOW','WIRE'],B3:['PATTERN','RESP','A11Y','VISUAL'],B4:['STATE','PROTO','EVIDENCE','RETEST']
  };
  const clue={
    W7:['เด่นตาม goal หลัก','รองรับ hierarchy','ช่วย context/CTA','ตรวจว่าไม่แย่ง priority'],
    W14:['กระทบ task สูง','จัด severity จาก evidence','fix อิงหลักฐาน','retest เพื่อพิสูจน์'],
    W6:['entry point ชัด','happy path ต่อเนื่อง','มีทางกลับเมื่อพลาด','ตรวจว่าไม่หลุด flow']
  };
  const bad=/ตัวลวง|TRAP|trap|DECOY|decoy|distractor|DISTRACTOR/g;
  const letters=['A','B','C','D'];
  function tag(i){const list=map[node()]||map.W1;return list[i%list.length];}
  function help(i){const list=clue[node()]||['อ่านสถานการณ์','เทียบกับ goal','ตรวจหลักฐาน','ตัดสินใจจาก evidence'];return list[i%list.length];}
  function title(i){return `ตัวเลือก ${letters[i]||i+1} • ${tag(i)}`;}
  function sub(i){return `Clue: ${help(i)} — อ่านสถานการณ์ก่อนเลือก`;}
  function sanitizeOption(btn,i){
    const current=txt(btn);
    const label=tag(i);
    if(String(btn.getAttribute('data-mechanic-label')||'').match(bad)) btn.setAttribute('data-mechanic-label',label);
    if(String(btn.getAttribute('data-choice-tag')||'').match(bad)) btn.setAttribute('data-choice-tag',label);
    const b=$('b',btn), span=$('span',btn);
    if(b && (bad.test(txt(b)) || /^ตัวเลือก [A-D]/.test(txt(b))===false)) b.textContent=title(i);
    bad.lastIndex=0;
    if(span && (bad.test(txt(span)) || /^Clue:/.test(txt(span))===false)) span.textContent=sub(i);
    bad.lastIndex=0;
    if(bad.test(current)) btn.dataset.sanitized='1';
    bad.lastIndex=0;
  }
  function sanitizeCard(card,i){
    const lane=$('.uxqMiniLane,.uxqDragLane',card), head=$('strong,b',card), small=$('small,span',card);
    if(lane && bad.test(txt(lane))) lane.textContent=tag(i); bad.lastIndex=0;
    if(head && (bad.test(txt(head)) || /^ตัวเลือก [A-D]/.test(txt(head))===false)) head.textContent=title(i); bad.lastIndex=0;
    if(small && (bad.test(txt(small)) || /^Clue:/.test(txt(small))===false)) small.textContent=sub(i); bad.lastIndex=0;
    if(bad.test(txt(card))) card.dataset.sanitized='1'; bad.lastIndex=0;
  }
  function style(){
    if($('#uxq-choice-sanitizer-style'))return;
    const s=document.createElement('style'); s.id='uxq-choice-sanitizer-style'; s.textContent=`
      .question .option[data-sanitized="1"],.uxqMiniCard[data-sanitized="1"],.uxqDragCard[data-sanitized="1"]{outline:1px solid rgba(110,231,255,.22)}
      .question .option b,.uxqMiniCard strong,.uxqDragCard b{overflow:hidden;text-overflow:ellipsis}`;
    document.head.appendChild(s);
  }
  function apply(){
    style();
    $$('.question > .options .option[data-choice]').forEach(sanitizeOption);
    $$('.uxqMiniCard,.uxqDragCard').forEach(sanitizeCard);
  }
  let n=0;
  function run(){apply(); n+=1; if(n<50 && /ตัวลวง|TRAP|trap|decoy|distractor/i.test(txt(document.querySelector('.question')))) setTimeout(run,120);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  new MutationObserver(()=>{clearTimeout(run._t); run._t=setTimeout(run,40);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-mechanic-label','data-choice-tag']});
})();
