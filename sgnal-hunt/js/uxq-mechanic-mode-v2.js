/* CSAI2601 UX Quest • Mechanic Mode v2.3
 * W7 master-reading layout for W1-W15 and B1-B4.
 * - One mission identity strip only.
 * - Stage-specific prompt derived from the current learning focus.
 * - Main choices show decision text only before answering.
 * - Deep explanation remains available in feedback / Reason Check.
 * - W1 rounds use their own goal / impact / fix / proof prompts.
 * - Hint labels are normalized so decorative bulb icons do not duplicate.
 * Presentation only: answer truth, scoring, progress, gates and Sheet sync stay unchanged.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const nodeId=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const mechanics={
    W1:{icon:'🔎',action:'เลือกหลักฐานที่ชี้จุดติดขัดหลัก'},
    W2:{icon:'🧭',action:'เลือกหลักฐานผู้ใช้ที่น่าเชื่อถือ'},
    W3:{icon:'🧠',action:'เลือกหลักจิตวิทยาและแนวแก้ที่ตรง'},
    W4:{icon:'🕵️',action:'เลือกคำถามหรือหลักฐานที่ไม่ชี้นำ'},
    W5:{icon:'💡',action:'เลือกขั้นที่ทำให้ Problem Definition แข็งแรง'},
    W6:{icon:'🗺️',action:'เลือกขั้นถัดไปที่ทำให้ Flow เดินต่อ'},
    W7:{icon:'📐',action:'เลือกการจัดลำดับที่ช่วยให้ตัดสินใจได้'},
    W8:{icon:'🧩',action:'เลือกจุดไม่สอดคล้องที่ต้องแก้ก่อน'},
    W9:{icon:'🧱',action:'เลือกกฎของ Pattern หรือ State ที่ตรง'},
    W10:{icon:'📱',action:'เลือก Issue หรือ Fix ที่กระทบ Task มากที่สุด'},
    W11:{icon:'🎨',action:'เลือก Visual Decision ที่สื่อความหมายชัด'},
    W12:{icon:'⚡',action:'เลือก State หรือ Microcopy ที่ช่วยให้มั่นใจ'},
    W13:{icon:'🔗',action:'เลือก Link หรือ State ที่ทำให้ทดสอบ Task ได้'},
    W14:{icon:'🧪',action:'เลือก Finding หรือ Fix ที่ควรทำก่อน'},
    W15:{icon:'🏁',action:'เลือก Proof ที่ทำให้ Case Study น่าเชื่อถือ'},
    B1:{icon:'👹',action:'เลือกคำตอบที่เชื่อม UX, Evidence และ Psychology'},
    B2:{icon:'🐉',action:'เลือก Chain จาก Evidence ถึง Wireframe ที่แน่นที่สุด'},
    B3:{icon:'🛡️',action:'เลือก System Decision ที่ครบและใช้งานได้'},
    B4:{icon:'🔥',action:'เลือก Validation Chain ที่พิสูจน์ผลได้'}
  };

  function style(){
    if($('#uxq-mechanic-v2-style'))return;
    const s=document.createElement('style');
    s.id='uxq-mechanic-v2-style';
    s.textContent=`
      .uxqMechanicPanel{display:none!important}
      [data-w7-authority]{display:none!important}
      .question .options:first-of-type{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
      .question .options:first-of-type .option{min-height:112px!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;padding:18px!important;overflow:visible!important}
      .question .options:first-of-type .option:before{display:none!important;content:none!important}
      .question .options:first-of-type .option>b{font-size:1rem!important;line-height:1.48!important}
      .question:not(.has-feedback) .options:first-of-type .option>span,
      .question:not(.has-feedback) .options:first-of-type .option>small,
      .question:not(.has-feedback) .options:first-of-type .option>p{display:none!important}
      .question>.prompt{margin:0 0 8px!important;line-height:1.25!important}
      .question>.instruction{margin:0 0 14px!important}
      .uxqMissionIdentity{margin:0!important;border-left:0!important;border-right:0!important;border-radius:0!important;padding:10px 16px!important;background:linear-gradient(90deg,rgba(110,231,255,.10),rgba(155,140,255,.10))!important}
      .uxqMissionIdentity .miIcon{font-size:1.25rem!important}
      .uxqMissionIdentity b{font-size:.96rem!important}
      .uxqMissionIdentity span{font-size:.84rem!important;line-height:1.3!important}
      .uxqMissionIdentity small{font-size:.76rem!important;margin-top:2px!important}
      @media(max-width:900px){
        .question .options:first-of-type{grid-template-columns:1fr!important}
        .question .options:first-of-type .option{min-height:0!important}
      }
    `;
    document.head.appendChild(s);
  }

  function current(){return mechanics[nodeId()]||mechanics.W1;}
  function stageNo(){
    const raw=text($('.hud .meter b'))+' '+text($('.case h1'));
    const m=raw.match(/(?:^|\s)([1-5])\s*\/\s*5|(?:ข้อ|รอบภารกิจ|รอบบอส)\s*([1-5])/i);
    return Math.max(1,Number((m&&(m[1]||m[2]))||1));
  }
  function focusText(){return (text($('.case .kicker'))+' '+text($('.case h1'))).toLowerCase();}
  function w1StagePrompt(){
    const map={
      1:'เลือกหลักฐานที่ชี้จุดติดขัดหลักของผู้ใช้',
      2:'เลือกเป้าหมายหลักที่ผู้ใช้ต้องทำให้สำเร็จ',
      3:'เลือกกรอบปัญหา UI, UX หรือ Feedback ให้ตรงชั้น',
      4:'เลือกแนวทางแก้ที่สัมพันธ์กับ Friction หลัก',
      5:'เลือกวิธีทดสอบที่พิสูจน์ว่า UX ดีขึ้นจริง'
    };
    return map[stageNo()]||map[1];
  }
  function stagePrompt(){
    if(nodeId()==='W1')return w1StagePrompt();
    const f=focusText();
    const rules=[
      [/extract insight|insight/, 'เลือก Insight ที่อธิบายความหมายเบื้องหลังสิ่งที่สังเกตได้'],
      [/root cause/, 'เลือก Root Cause ที่อธิบายว่าทำไมปัญหาจึงเกิด'],
      [/problem statement|write problem/, 'เลือก Problem Statement ที่ระบุผู้ใช้ บริบท และผลกระทบชัด'],
      [/\bhmw\b|how might we/, 'เลือก HMW ที่เปิดทางเลือกโดยไม่ซ่อน Solution ไว้แล้ว'],
      [/concept/, 'เลือก Concept ที่ตอบ Problem และยังนำไปทดสอบได้'],
      [/classify evidence|evidence/, 'เลือกหลักฐานผู้ใช้ที่นำไปใช้ตัดสินใจได้'],
      [/assumption/, 'เลือก Assumption ที่ต้องตรวจสอบก่อนออกแบบ'],
      [/diagnose|cognitive|memory|attention|mental model/, 'เลือกหลักจิตวิทยาที่อธิบายพฤติกรรมในสถานการณ์นี้'],
      [/research question/, 'เลือก Research Question ที่ไม่ชี้นำและตอบได้จากผู้ใช้จริง'],
      [/pain point|persona need/, 'เลือก Pain Point หรือ Need ที่มีหลักฐานรองรับ'],
      [/sitemap|group|information architecture/, 'เลือกการจัดกลุ่มที่ตรงกับ Mental Model ของผู้ใช้'],
      [/navigation|happy path|error path|flow/, 'เลือกขั้นถัดไปที่ทำให้ผู้ใช้เดินงานต่อได้'],
      [/visual priority|hierarchy/, 'เลือกข้อมูลที่ควรเด่นตามเป้าหมายการตัดสินใจ'],
      [/wireframe|layout/, 'เลือกโครงหน้าจอที่รองรับลำดับงานของผู้ใช้'],
      [/primary cta|cta/, 'เลือก CTA ที่ตรงกับ Next Step ของผู้ใช้'],
      [/mobile|responsive/, 'เลือกการปรับจอเล็กที่ยังรักษา Task Order'],
      [/prototype|link/, 'เลือกการเชื่อมที่ทำให้ทดสอบ Task ได้จริง'],
      [/severity|retest|validation|test/, 'เลือก Finding หรือ Fix ที่พิสูจน์ผลได้'],
      [/boss|identify problem/, 'เลือกคำตอบที่เชื่อมหลายชั้นและมีหลักฐานรองรับ']
    ];
    for(const [re,label] of rules){if(re.test(f))return label;}
    return current().action;
  }

  function removeDuplicatePanel(q){$$('.uxqMechanicPanel',q).forEach(el=>el.remove());}
  function simplifyMainChoices(q){
    const main=$$('.options',q)[0];
    if(!main)return;
    $$('.option[data-choice],button.option,.option',main).forEach(btn=>{
      $$(':scope > span,:scope > small,:scope > p',btn).forEach(el=>el.remove());
    });
  }
  function markFeedbackState(q){q.classList.toggle('has-feedback',!!q.querySelector('.feedback,.verify'));}
  function normalizeHint(){
    const hint=$('.hint');
    if(!hint)return;
    const cleaned=text(hint).replace(/^(?:💡\s*)+/u,'');
    if(hint.textContent!==cleaned)hint.textContent=cleaned;
  }

  function inject(){
    style();
    const q=$('.question');
    if(!q)return;
    removeDuplicatePanel(q);
    simplifyMainChoices(q);
    markFeedbackState(q);
    normalizeHint();
    const prompt=$(':scope > .prompt',q);
    const wanted=`${current().icon} ${stagePrompt()}`;
    if(prompt && prompt.textContent!==wanted)prompt.textContent=wanted;
    if(prompt)prompt.dataset.masterReadingPrompt=`${nodeId()}-${stageNo()}`;
  }

  let t=0;
  function schedule(){clearTimeout(t);t=setTimeout(inject,25);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();