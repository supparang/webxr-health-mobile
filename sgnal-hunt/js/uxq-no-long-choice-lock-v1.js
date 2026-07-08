/* CSAI2601 UX Quest • No Long Choice Lock v1
 * Final visual lock: no visible choice/card may expose long answer text.
 * It targets the old mechanic option grid, mini-game cards, and drag/sort cards.
 * Original data-choice stays intact for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const tagMap={
    W1:['TASK','GOAL','SIGNAL','PROOF'],W2:['EVID','ASSUME','USER','TEST'],W3:['MODEL','LOAD','SIGNAL','REPAIR'],
    W4:['QUESTION','CLUE','NEED','OBSERVE'],W5:['INSIGHT','ROOT','HMW','CONCEPT'],W6:['ENTRY','PATH','RECOVER','TRAP'],
    W7:['P1','P2','P3','TRAP'],W8:['CHAIN','MATCH','REVISE','WHY'],W9:['PATTERN','STATE','RULE','TRAP'],
    W10:['MOBILE','A11Y','FOCUS','CHECK'],W11:['COLOR','TYPE','CONTRAST','SPACE'],W12:['STATE','COPY','RECOVER','PREVENT'],
    W13:['TASK','LINK','ERROR','TEST'],W14:['HIGH','MID','LOW','TRAP'],W15:['STORY','EVID','PROOF','DEFEND'],
    B1:['UX','HCD','PSY','PROOF'],B2:['PERSONA','PROBLEM','FLOW','WIRE'],B3:['PATTERN','RESP','A11Y','VISUAL'],B4:['STATE','PROTO','EVID','RETEST']
  };
  const clues={
    W1:['ดู task impact','ดู goal ผู้ใช้','ดู signal หลัก','วัด proof ได้'],
    W2:['หลักฐานผู้ใช้','สมมติฐานทีม','เสียงผู้ใช้จริง','ทดสอบสั้น'],
    W3:['mental model','ลด cognitive load','feedback ชัด','repair แล้ว validate'],
    W4:['คำถามไม่ชี้นำ','clue จากพฤติกรรม','persona need','observe ต่อ'],
    W5:['insight จริง','root cause','HMW ไม่ล็อก','concept ทดสอบได้'],
    W6:['entry point','happy path','error recovery','trap ที่หลอก'],
    W7:['เด่นอันดับแรก','รองรับ hierarchy','ช่วย CTA/context','trap ที่ดูดี'],
    W8:['chain หลัก','mismatch','revision','เหตุผลป้องกัน'],
    W9:['component pattern','state/variant','system rule','trap ซ้ำซ้อน'],
    W10:['mobile task','accessibility','focus/touch','check หลังแก้'],
    W11:['color meaning','type hierarchy','contrast','spacing group'],
    W12:['component state','microcopy','recovery','prevent error'],
    W13:['task flow','missing link','error path','prototype test'],
    W14:['task failure','medium signal','low impact','trap metric'],
    W15:['case story','evidence chain','testing proof','defense'],
    B1:['UX friction','HCD evidence','psychology','proof'],B2:['persona chain','problem','flow','wireframe'],B3:['pattern','responsive','a11y','visual'],B4:['state','prototype','evidence','retest']
  };
  function tags(){return tagMap[node()]||tagMap.W1;}
  function clue(i){const list=clues[node()]||clues.W1; return list[i%list.length];}
  function letter(i){return ['A','B','C','D'][i]||String(i+1);}
  function tag(i){return tags()[i%tags().length];}
  function hardPlain(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    $$('.question > .options .option[data-choice]').forEach((btn,i)=>{
      btn.dataset.noLongChoice='1';
      btn.setAttribute('data-mechanic-label',tag(i));
      btn.setAttribute('data-choice-tag',tag(i));
      const b=$('b',btn); const span=$('span',btn);
      const title=`การ์ด ${letter(i)} • ${tag(i)}`;
      const sub=`Clue: ${clue(i)} — อ่าน case ก่อนเลือก`;
      if(b && text(b)!==title) b.textContent=title;
      if(span && text(span)!==sub) span.textContent=sub;
    });
  }
  function hardMini(){
    $$('.uxqMiniCard').forEach((card,i)=>{
      card.dataset.noLongChoice='1';
      const lane=$('.uxqMiniLane',card); const strong=$('strong',card); const small=$('small',card);
      if(lane) lane.textContent=tag(i);
      if(strong) strong.textContent=`การ์ด ${letter(i)} • ${tag(i)}`;
      if(small) small.textContent=`Clue: ${clue(i)} — อ่าน case ก่อนเลือก`;
    });
  }
  function hardDrag(){
    $$('.uxqDragCard').forEach((card,i)=>{
      card.dataset.noLongChoice='1';
      const lane=$('.uxqDragLane',card); const b=$('b',card); const small=$('small',card);
      if(lane) lane.textContent=tag(i);
      if(b) b.textContent=`การ์ด ${letter(i)} • ${tag(i)}`;
      if(small) small.textContent=`Clue: ${clue(i)} — อ่าน case ก่อนเลือก`;
    });
  }
  function style(){
    if($('#uxq-no-long-choice-lock-style'))return;
    const s=document.createElement('style'); s.id='uxq-no-long-choice-lock-style'; s.textContent=`
      .question .option[data-no-long-choice="1"]{min-height:132px!important;max-height:154px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important}
      .question .option[data-no-long-choice="1"]:before{content:attr(data-choice-tag)!important;margin-bottom:0!important}
      .question .option[data-no-long-choice="1"] b{font-size:1.06rem!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;min-height:1.35em!important;display:block!important}
      .question .option[data-no-long-choice="1"] span{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.75em!important;max-height:2.75em!important;line-height:1.35!important;color:#b9c8e4!important}
      .uxqMiniCard[data-no-long-choice="1"],.uxqDragCard[data-no-long-choice="1"]{min-height:126px!important;max-height:148px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important}
      .uxqMiniCard[data-no-long-choice="1"] strong,.uxqDragCard[data-no-long-choice="1"] b{font-size:1.02rem!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;min-height:1.35em!important}
      .uxqMiniCard[data-no-long-choice="1"] small,.uxqDragCard[data-no-long-choice="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.75em!important;max-height:2.75em!important;line-height:1.35!important}`;
    document.head.appendChild(s);
  }
  let loops=0;
  function apply(){style(); hardPlain(); hardMini(); hardDrag(); loops+=1; if(loops<80) setTimeout(apply,120);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  new MutationObserver(()=>{clearTimeout(apply._t); apply._t=setTimeout(apply,30);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
