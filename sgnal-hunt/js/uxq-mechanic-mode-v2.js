/* CSAI2601 UX Quest • Mechanic Mode v2.1
 * W7 master-reading layout for W1-W15 and B1-B4.
 * Keeps mission identity and learning prompts, but removes the duplicated
 * mechanic panel and secondary choice clutter that increased cognitive load.
 * Presentation only: answer truth, scoring, progress, gates and Sheet sync stay unchanged.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const nodeId=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const mechanics={
    W1:{icon:'🔎',mode:'SCAN',action:'เลือกหลักฐานที่ชี้ friction หลัก'},
    W2:{icon:'🧭',mode:'LAB',action:'เลือก evidence / assumption ที่น่าเชื่อถือ'},
    W3:{icon:'🧠',mode:'DIAGNOSE',action:'เลือกหลักจิตวิทยาและ repair ที่ตรง'},
    W4:{icon:'🕵️',mode:'DETECT',action:'เลือกคำถามหรือหลักฐานที่ไม่ชี้นำ'},
    W5:{icon:'💡',mode:'DEFINE',action:'เลือก node ที่ทำให้ problem definition แข็งแรง'},
    W6:{icon:'🗺️',mode:'FLOW',action:'เลือก card ที่ควรอยู่ตำแหน่งถัดไปใน flow'},
    W7:{icon:'📐',mode:'SORT',action:'เลือก element ที่ควรเด่นที่สุดตอนนี้'},
    W8:{icon:'🧩',mode:'REVIEW',action:'เลือก mismatch หรือ revision ที่ควรแก้ก่อน'},
    W9:{icon:'🧱',mode:'SYSTEM',action:'เลือก pattern หรือ state rule ที่ตรง'},
    W10:{icon:'📱',mode:'AUDIT',action:'เลือก issue หรือ fix ที่กระทบ task มากที่สุด'},
    W11:{icon:'🎨',mode:'SIGNAL',action:'เลือก visual decision ที่อ่านและเข้าใจได้จริง'},
    W12:{icon:'⚡',mode:'STATE',action:'เลือก state หรือ microcopy ที่ทำให้ผู้ใช้มั่นใจ'},
    W13:{icon:'🔗',mode:'LINK',action:'เลือก link หรือ state ที่ต้องแก้เพื่อให้ทดสอบได้'},
    W14:{icon:'🧪',mode:'RANK',action:'เลือก finding หรือ fix ที่ควรจัดลำดับก่อน'},
    W15:{icon:'🏁',mode:'DEFEND',action:'เลือก proof หรือ narrative ที่ทำให้ case study น่าเชื่อถือ'},
    B1:{icon:'👹',mode:'BOSS',action:'เลือกคำตอบที่เชื่อมหลายชั้น'},
    B2:{icon:'🐉',mode:'BOSS',action:'เลือก chain defense ที่แน่นที่สุด'},
    B3:{icon:'🛡️',mode:'BOSS',action:'เลือก system decision ที่ครบทั้ง consistency และ usability'},
    B4:{icon:'🔥',mode:'BOSS',action:'เลือก state, prototype, fix และ retest ที่ป้องกันได้ครบ'}
  };

  function style(){
    if($('#uxq-mechanic-v2-style'))return;
    const s=document.createElement('style');
    s.id='uxq-mechanic-v2-style';
    s.textContent=`
      /* Production uses one mission identity strip only. */
      .uxqMechanicPanel{display:none!important}
      [data-w7-authority]{display:none!important}
      .question[data-mechanic-mode] .options{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
      .question[data-mechanic-mode] .option{min-height:132px!important;border-left-width:1px!important;overflow:visible!important}
      .question[data-mechanic-mode] .option:before{display:none!important;content:none!important}
      .question[data-mechanic-mode]>.prompt{margin-top:0!important}
      .uxqMissionIdentity{margin:0!important;border-left:0!important;border-right:0!important;border-radius:0!important;padding:11px 16px!important;background:linear-gradient(90deg,rgba(110,231,255,.10),rgba(155,140,255,.10))!important}
      .uxqMissionIdentity .miIcon{font-size:1.35rem!important}
      .uxqMissionIdentity b{font-size:.98rem!important}
      .uxqMissionIdentity span{font-size:.86rem!important;line-height:1.35!important}
      .uxqMissionIdentity small{font-size:.78rem!important;margin-top:2px!important}
      @media(max-width:900px){
        .question[data-mechanic-mode] .options{grid-template-columns:1fr!important}
        .question[data-mechanic-mode] .option{min-height:0!important}
      }
    `;
    document.head.appendChild(s);
  }

  function current(){return mechanics[nodeId()]||mechanics.W1;}
  function neutralLabel(i){return ['A','B','C','D'][i]||String(i+1);}

  function removeDuplicatePanel(q){
    $$('.uxqMechanicPanel',q).forEach(el=>el.remove());
  }

  function simplifyMainChoices(q){
    const groups=$$('.options',q);
    const main=groups[0];
    if(!main)return;
    $$('.option[data-choice],button.option',main).forEach((btn,i)=>{
      btn.setAttribute('data-mechanic-label',neutralLabel(i));
      /* W7 is easier to scan because main cards show one decision statement only.
         Remove only secondary display copy; button value/click logic is untouched. */
      $$(':scope > span',btn).forEach(span=>span.remove());
    });
  }

  function inject(){
    style();
    const q=$('.question');
    if(!q)return;
    const m=current();
    const mark=`${nodeId()}-${text($('.hud .meter b'))}`;
    removeDuplicatePanel(q);
    q.dataset.mechanicMode=m.mode;
    q.dataset.mechanicV2Mark=mark;
    simplifyMainChoices(q);
    const prompt=$(':scope > .prompt',q);
    if(prompt && !prompt.dataset.masterReadingPrompt){
      prompt.textContent=`${m.icon} ${m.action}`;
      prompt.dataset.masterReadingPrompt='1';
    }
  }

  let t=0;
  function schedule(){clearTimeout(t);t=setTimeout(inject,25);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
