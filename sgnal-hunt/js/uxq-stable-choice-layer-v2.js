/* CSAI2601 UX Quest • Stable Choice Layer v2
 * Removes student-visible debug words such as "ตัวลวง" / "TRAP".
 * Gives every visible choice a stable, meaningful focus label.
 * Re-applies only when the round changes or when bad/debug text reappears, so choices do not flicker.
 * data-choice stays untouched for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const cleanText=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const bad=/ตัวลวง|distractor|trap|decoy/i;
  const map={
    W1:[['A','TASK','ดูผลต่อ task หลัก'],['B','GOAL','โยงกับ goal ผู้ใช้'],['C','SIGNAL','จับ signal จากหลักฐาน'],['D','PROOF','พิสูจน์ได้ด้วย metric']],
    W2:[['A','EVIDENCE','หลักฐานจากผู้ใช้จริง'],['B','ASSUMPTION','แยกสิ่งที่ทีมกำลังเดา'],['C','USER','ฟังและสังเกตผู้ใช้'],['D','TEST','ออกแบบ small test']],
    W3:[['A','MODEL','ตรงกับ mental model'],['B','LOAD','ลดภาระความจำ/การคิด'],['C','FEEDBACK','ให้ feedback ชัด'],['D','REPAIR','แก้แล้ว validate ซ้ำ']],
    W4:[['A','QUESTION','คำถามไม่ชี้นำ'],['B','CLUE','clue จากพฤติกรรม'],['C','NEED','persona need ชัด'],['D','OBSERVE','ควร observe ต่อ']],
    W5:[['A','INSIGHT','insight จาก evidence'],['B','ROOT','root cause ชัด'],['C','HMW','HMW ไม่ล็อก solution'],['D','CONCEPT','concept ทดสอบได้']],
    W6:[['A','ENTRY','entry point ชัด'],['B','PATH','happy path ต่อเนื่อง'],['C','RECOVERY','มีทางกลับเมื่อพลาด'],['D','CHECK','ตรวจว่าไม่หลุด flow']],
    W7:[['A','P1','เด่นตาม goal หลัก'],['B','P2','รองรับ hierarchy'],['C','P3','ช่วย context/CTA'],['D','CHECK','ตรวจว่าไม่แย่ง priority']],
    W8:[['A','CHAIN','chain เชื่อมหลักฐาน'],['B','MATCH','จับ mismatch'],['C','REVISE','แก้ revision สำคัญ'],['D','RATIONALE','ให้เหตุผลป้องกันได้']],
    W9:[['A','PATTERN','pattern ใช้ซ้ำได้'],['B','STATE','state/variant ครบ'],['C','RULE','system rule ชัด'],['D','CHECK','ตรวจว่าไม่ทำให้ระบบบวม']],
    W10:[['A','MOBILE','เหมาะกับ mobile task'],['B','A11Y','accessibility ชัด'],['C','FOCUS','focus/touch ใช้ได้'],['D','CHECK','ตรวจผลหลังแก้']],
    W11:[['A','COLOR','สีสื่อความหมาย'],['B','TYPE','ลำดับ typography'],['C','CONTRAST','contrast อ่านได้'],['D','SPACE','spacing แบ่งกลุ่ม']],
    W12:[['A','STATE','component state'],['B','COPY','microcopy ช่วยตัดสินใจ'],['C','RECOVERY','ช่วยกู้คืนเมื่อ error'],['D','PREVENT','กันความผิดพลาดก่อนเกิด']],
    W13:[['A','TASK','prototype ทดสอบ task ได้'],['B','LINK','link/state ไม่ขาด'],['C','ERROR','มี error path'],['D','TEST','ใช้ validate ได้จริง']],
    W14:[['A','IMPACT','กระทบ task สูง'],['B','SEVERITY','จัด severity จาก evidence'],['C','FIX','fix อิงหลักฐาน'],['D','RETEST','retest เพื่อพิสูจน์']],
    W15:[['A','STORY','เล่า case story ชัด'],['B','EVIDENCE','evidence chain ครบ'],['C','PROOF','มี proof จาก test'],['D','DEFENSE','ป้องกัน decision ได้']],
    B1:[['A','UX','จับ UX friction'],['B','HCD','โยง HCD evidence'],['C','PSY','ใช้ psychology ให้ถูก'],['D','PROOF','พิสูจน์ผลได้']],
    B2:[['A','PERSONA','persona chain'],['B','PROBLEM','problem ชัด'],['C','FLOW','flow รองรับ task'],['D','WIREFRAME','wireframe ป้องกันได้']],
    B3:[['A','PATTERN','pattern system'],['B','RESPONSIVE','responsive task'],['C','A11Y','a11y ใช้ได้จริง'],['D','VISUAL','visual meaning ชัด']],
    B4:[['A','STATE','state/prototype'],['B','PROTO','prototype flow'],['C','EVIDENCE','evidence จาก test'],['D','RETEST','retest proof']]
  };
  function spec(i){const list=map[node()]||map.W1;return list[i%list.length];}
  function title(i){const s=spec(i);return `ตัวเลือก ${s[0]} • ${s[1]}`;}
  function clue(i){const s=spec(i);return `Clue: ${s[2]} — อ่านสถานการณ์ก่อนเลือก`;}
  function roundMark(){return [node(),cleanText($('.top .pill')),cleanText($('.hud .meter b')),$$('.question > .options .option[data-choice]').map(b=>b.dataset.choice).join(',')].join('|');}
  function optionTargets(){return $$('.question > .options .option[data-choice]');}
  function cardTargets(){return $$('.uxqMiniCard,.uxqDragCard');}
  function badVisible(){return bad.test([cleanText($('.question')), cleanText($('.uxqMiniArena')), cleanText($('.uxqDragArena'))].join(' '));}
  function applyOption(btn,i){
    btn.dataset.stableChoiceV2='1';
    btn.setAttribute('data-choice-tag',spec(i)[1]);
    btn.setAttribute('data-mechanic-label',spec(i)[1]);
    const b=$('b',btn), span=$('span',btn);
    if(b && cleanText(b)!==title(i)) b.textContent=title(i);
    if(span && cleanText(span)!==clue(i)) span.textContent=clue(i);
  }
  function applyCard(card,i){
    card.dataset.stableChoiceV2='1';
    const lane=$('.uxqMiniLane,.uxqDragLane',card);
    const head=$('strong,b',card);
    const small=$('small,span',card);
    if(lane)lane.textContent=spec(i)[1];
    if(head && cleanText(head)!==title(i))head.textContent=title(i);
    if(small && cleanText(small)!==clue(i))small.textContent=clue(i);
  }
  function style(){
    if($('#uxq-stable-choice-v2-style'))return;
    const s=document.createElement('style');s.id='uxq-stable-choice-v2-style';s.textContent=`
      .question .option[data-stable-choice-v2="1"],.uxqMiniCard[data-stable-choice-v2="1"],.uxqDragCard[data-stable-choice-v2="1"]{transform:none!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important;min-height:132px!important;max-height:154px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important;will-change:auto!important}
      .question .option[data-stable-choice-v2="1"]:before{content:attr(data-choice-tag)!important;margin-bottom:0!important}.question .option[data-stable-choice-v2="1"] b,.uxqMiniCard[data-stable-choice-v2="1"] strong,.uxqDragCard[data-stable-choice-v2="1"] b{font-size:1.04rem!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;min-height:1.35em!important;display:block!important}.question .option[data-stable-choice-v2="1"] span,.uxqMiniCard[data-stable-choice-v2="1"] small,.uxqDragCard[data-stable-choice-v2="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.75em!important;max-height:2.75em!important;line-height:1.35!important;color:#b9c8e4!important}.uxqChoiceStableBadge{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(110,231,255,.32);border-radius:999px;background:rgba(110,231,255,.07);color:#bff3ff;padding:6px 9px;font-weight:900;font-size:.78rem;margin:6px 0 8px}`;
    document.head.appendChild(s);
  }
  let last='';
  function apply(force=false){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const opts=optionTargets(); const cards=cardTargets(); if(opts.length+cards.length<1)return;
    const m=roundMark();
    if(!force && last===m && !badVisible()) return;
    style();
    opts.forEach(applyOption);
    cards.forEach((card,i)=>applyCard(card,i));
    if(!q.querySelector('.uxqChoiceStableBadge')){
      const badge=document.createElement('div'); badge.className='uxqChoiceStableBadge'; badge.textContent='✅ ตัวเลือกนิ่ง ไม่ซ้ำ และไม่มีคำว่า “ตัวลวง”';
      const anchor=q.querySelector('.uxqChallengeHud,.uxqAdaptiveBar,.student-ready-note');
      if(anchor)anchor.insertAdjacentElement('afterend',badge); else q.insertBefore(badge,q.firstChild);
    }
    last=m;
  }
  let t=0; function schedule(force=false){clearTimeout(t); t=setTimeout(()=>apply(force),120);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(true),{once:true}); else schedule(true);
  new MutationObserver(()=>{ if(badVisible() || roundMark()!==last) schedule(badVisible()); }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
