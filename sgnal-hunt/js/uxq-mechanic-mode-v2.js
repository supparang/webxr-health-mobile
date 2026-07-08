/* CSAI2601 UX Quest • Mechanic Mode v2
 * Distinct mission mood without leaking answer logic through labels.
 * Student-facing option labels are neutral A/B/C/D only.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const nodeId=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const mechanics={
    W1:{icon:'🔎',mode:'SCAN',title:'Friction Scan',mission:'สแกนจุดติดขัดที่ทำให้ task สะดุด',action:'เลือกหลักฐานที่ชี้ friction หลัก'},
    W2:{icon:'🧭',mode:'LAB',title:'Evidence Lab',mission:'คัดหลักฐานผู้ใช้ก่อนทีมรีบออกแบบ',action:'เลือก evidence / assumption ที่น่าเชื่อถือ'},
    W3:{icon:'🧠',mode:'DIAGNOSE',title:'Psychology Diagnosis',mission:'วินิจฉัย mental model, attention, memory, feedback',action:'เลือกหลักจิตวิทยาและ repair ที่ตรง'},
    W4:{icon:'🕵️',mode:'DETECT',title:'Research Detective',mission:'จับ pain point และ persona need จากข้อมูลผู้ใช้',action:'เลือกคำถาม/หลักฐานที่ไม่ชี้นำ'},
    W5:{icon:'💡',mode:'DEFINE',title:'HMW Studio',mission:'ต่อ chain จาก insight ไป HMW และ concept',action:'เลือก node ที่ทำให้ problem definition แข็งแรง'},
    W6:{icon:'🗺️',mode:'FLOW',title:'Flow Arrange',mission:'ต่อเส้นทาง IA / happy path / error path ให้ผู้ใช้ไม่หลุด',action:'เลือก card ที่ควรอยู่ตำแหน่งถัดไปใน flow'},
    W7:{icon:'📐',mode:'SORT',title:'Priority Sort',mission:'จัดลำดับ visual hierarchy และ CTA ใน wireframe',action:'เลือก element ที่ควรเด่นที่สุดตอนนี้'},
    W8:{icon:'🧩',mode:'REVIEW',title:'Blueprint Review',mission:'ตรวจ chain problem-persona-flow-wireframe',action:'เลือก mismatch หรือ revision ที่ควรแก้ก่อน'},
    W9:{icon:'🧱',mode:'SYSTEM',title:'Pattern Matrix',mission:'รวม component, state, variant และ naming ให้เป็นระบบ',action:'เลือก pattern/state rule ที่ถูก'},
    W10:{icon:'📱',mode:'AUDIT',title:'Responsive/A11y Audit',mission:'ตรวจ mobile layout, touch target, focus, contrast',action:'เลือก issue/fix ที่กระทบ task มากที่สุด'},
    W11:{icon:'🎨',mode:'SIGNAL',title:'Visual Signal Tuning',mission:'ปรับสี typography spacing และ contrast ให้สื่อความหมาย',action:'เลือก visual decision ที่อ่านและเข้าใจได้จริง'},
    W12:{icon:'⚡',mode:'STATE',title:'Interaction State Machine',mission:'เลือก state, feedback, microcopy และ recovery หลัง action',action:'เลือก state หรือ microcopy ที่ทำให้ผู้ใช้มั่นใจ'},
    W13:{icon:'🔗',mode:'LINK',title:'Prototype Link Check',mission:'ตรวจ prototype link, modal, error path และ task flow',action:'เลือก link/state ที่ต้องแก้เพื่อให้ทดสอบได้จริง'},
    W14:{icon:'🧪',mode:'RANK',title:'Severity Ranking',mission:'อ่าน test evidence แล้วจัด severity/fix/retest',action:'เลือก finding หรือ fix ที่ควรจัดลำดับก่อน'},
    W15:{icon:'🏁',mode:'DEFEND',title:'Portfolio Defense',mission:'จัด story evidence-decision-design-test ให้ป้องกันงานได้',action:'เลือก proof หรือ narrative ที่ทำให้ case study น่าเชื่อถือ'},
    B1:{icon:'👹',mode:'BOSS',title:'Foundation Boss Battle',mission:'รวม UI/UX + HCD + Psychology ในสถานการณ์เดียว',action:'เลือกคำตอบที่เชื่อมหลายชั้น'},
    B2:{icon:'🐉',mode:'BOSS',title:'Flow/Wireframe Boss Battle',mission:'ป้องกัน evidence → problem → flow → wireframe',action:'เลือก chain defense ที่แน่นที่สุด'},
    B3:{icon:'🛡️',mode:'BOSS',title:'Interface System Boss Battle',mission:'สู้ด้วย design system + responsive + accessibility',action:'เลือก system decision ที่ครบทั้ง consistency และ usability'},
    B4:{icon:'🔥',mode:'BOSS',title:'Validation Boss Battle',mission:'พิสูจน์ prototype ด้วย test evidence และ iteration',action:'เลือก state/prototype/fix/retest ที่ป้องกันได้ครบ'}
  };
  function style(){
    if($('#uxq-mechanic-v2-style'))return;
    const s=document.createElement('style');s.id='uxq-mechanic-v2-style';s.textContent=`
      .uxqMechanicPanel{border:1px solid rgba(255,209,102,.38);border-radius:18px;background:linear-gradient(135deg,rgba(255,209,102,.11),rgba(110,231,255,.08));padding:12px;margin:0 0 14px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.uxqMechanicIcon{font-size:1.8rem;line-height:1}.uxqMechanicPanel b{display:block;color:#fff}.uxqMechanicPanel span{display:block;color:#d6e5ff;line-height:1.45;font-size:.9rem}.uxqMechanicBadge{border:1px solid rgba(255,209,102,.55);border-radius:999px;color:#ffe7a6;padding:6px 9px;font-weight:950;font-size:.76rem;background:rgba(255,209,102,.08)}.question[data-mechanic-mode] .options{gap:12px}.question[data-mechanic-mode] .option{position:relative;overflow:hidden}.question[data-mechanic-mode] .option:before{content:attr(data-mechanic-label);display:inline-flex;border:1px solid rgba(110,231,255,.35);border-radius:999px;padding:4px 7px;margin-bottom:8px;color:#8fe9ff;background:rgba(110,231,255,.08);font-size:.72rem;font-weight:900;letter-spacing:.04em}.question[data-mechanic-mode="FLOW"] .options{grid-template-columns:1fr}.question[data-mechanic-mode="FLOW"] .option{min-height:92px;border-left:6px solid rgba(110,231,255,.65)}.question[data-mechanic-mode="SORT"] .options,.question[data-mechanic-mode="RANK"] .options{grid-template-columns:repeat(4,minmax(0,1fr))}.question[data-mechanic-mode="SORT"] .option,.question[data-mechanic-mode="RANK"] .option{min-height:150px}.question[data-mechanic-mode="BOSS"]{border-color:rgba(255,95,130,.45)}.uxqMechanicTrack{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.uxqMechanicTrack i{font-style:normal;border:1px solid rgba(197,215,255,.22);border-radius:999px;padding:4px 7px;color:#cfe0ff;background:rgba(5,15,35,.35);font-size:.73rem;font-weight:800}@media(max-width:760px){.uxqMechanicPanel{grid-template-columns:auto 1fr}.uxqMechanicBadge{grid-column:1/-1;width:max-content}.question[data-mechanic-mode="SORT"] .options,.question[data-mechanic-mode="RANK"] .options{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(s);
  }
  function current(){return mechanics[nodeId()]||mechanics.W1;}
  function stageNo(){const m=text($('.hud .meter b')).match(/^(\d+)\s*\/\s*(\d+)/);return m?[Number(m[1]),Number(m[2])]:[1,5];}
  function neutralLabel(i){return ['A','B','C','D'][i]||String(i+1);}
  function inject(){
    style();
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const m=current(); const [a,b]=stageNo(); const mark=`${nodeId()}-${a}-${text($('.top .pill'))}`;
    if(q.dataset.mechanicV2Mark===mark)return;
    q.dataset.mechanicMode=m.mode; q.dataset.mechanicV2Mark=mark;
    const old=$('.uxqMechanicPanel',q); if(old)old.remove();
    const panel=document.createElement('section'); panel.className='uxqMechanicPanel';
    panel.innerHTML=`<div class="uxqMechanicIcon">${m.icon}</div><div><b>${m.title}</b><span>${m.mission}</span><div class="uxqMechanicTrack"><i>${m.action}</i><i>Round ${a}/${b}</i></div></div><div class="uxqMechanicBadge">${m.mode}</div>`;
    q.insertBefore(panel,q.firstChild);
    $$('.question > .options .option[data-choice]').forEach((btn,i)=>btn.setAttribute('data-mechanic-label',neutralLabel(i)));
    const prompt=$('.prompt',q); if(prompt&&!prompt.dataset.mechanicPromptV2){prompt.textContent=`${m.icon} ${m.action}`;prompt.dataset.mechanicPromptV2='1';}
  }
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(inject,25);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
