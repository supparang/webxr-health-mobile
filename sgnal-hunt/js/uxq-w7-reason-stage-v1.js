/* CSAI2601 UX Quest • W7 Reason Stage v1.1
 * Fixes W7 Reason Check directly.
 * Round 1-5 now use stage-specific reasons, close-call distractors, and balanced wording.
 * Re-applies when Student Ready UI neutralizes reason subtitles back to generic text.
 * It changes only visible text; data-reason/correctness remains untouched for scoring.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  if(node()!=='W7')return;
  const GENERIC=/อ่านสถานการณ์|เลือกคำตอบที่มีเหตุผล|เลือกเหตุผลที่อธิบาย/i;
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function roundNo(){const m=text($('.hud .meter b')).match(/(\d+)\s*\/\s*\d+/);return m?Number(m[1]):1;}
  function idx(btn){const m=String(btn?.dataset?.reason||'').match(/-(\d+)$/);return m?Number(m[1]):-1;}
  const stages={
    1:{name:'visual priority',prompt:'เหตุผลใดอธิบาย visual priority จากหลักฐานได้ดีที่สุด',ok:['priority ต้องเริ่มจากสิ่งที่ช่วยผู้ใช้ตัดสินใจแรก','ลำดับภาพควรอิง goal และสถานะที่ผู้ใช้ต้องเห็นก่อน','สิ่งที่เด่นควรกระทบ task หลัก ไม่ใช่แค่สวยเด่น'],near:['เน้นภาพนำสายตาได้ แต่ยังไม่บอกว่าช่วย task อย่างไร','ทำทุกปุ่มให้เด่นเท่ากัน แต่ priority ของหน้าจะหาย','ย้ายข้อมูลรองออกได้ แต่ต้องระวัง context ที่จำเป็น']},
    2:{name:'layout decision',prompt:'เหตุผลใดอธิบาย layout ที่รองรับ goal และ content hierarchy ได้ดีที่สุด',ok:['layout ต้องช่วยให้ผู้ใช้เทียบข้อมูลสำคัญได้เร็ว','grid หรือ card ควรแสดงสถานะ เงื่อนไข และ action ใกล้กัน','layout ที่ดีลดการย้อนกลับไปหาเงื่อนไขก่อนเลือก'],near:['ขยาย CTA ช่วยเห็นปุ่ม แต่ยังไม่แก้โครงสร้างข้อมูลทั้งหน้า','ใช้ card สวยขึ้นได้ แต่ต้องดูว่าข้อมูลเปรียบเทียบครบไหม','ใส่คำแนะนำยาวขึ้นอาจช่วยอ่าน แต่กินพื้นที่รายการหลัก']},
    3:{name:'primary CTA',prompt:'เหตุผลใดอธิบาย primary CTA ที่ตรงกับ goal และ context ที่สุด',ok:['CTA ควรอยู่หลังข้อมูลที่จำเป็นต่อการตัดสินใจ','ปุ่มหลักต้องเชื่อมกับ task ปัจจุบัน ไม่แข่งกับปุ่มรอง','CTA ที่ดีทำให้ผู้ใช้รู้ action ถัดไปโดยไม่เสีย context'],near:['ทำ CTA ใหญ่ขึ้นช่วยเห็นชัด แต่ถ้ากลบเงื่อนไขยังเสี่ยงผิด','ย้ายข้อมูลรองออกหมดทำให้โล่ง แต่ผู้ใช้อาจขาดหลักฐานก่อนกด','ใช้ภาพนำสายตาได้ แต่ไม่แทนการบอก action หลัก']},
    4:{name:'mobile layout',prompt:'เหตุผลใดอธิบาย CTA และ mobile layout ที่ลด friction ได้ดีที่สุด',ok:['บนมือถือ CTA ควรแตะง่ายและอยู่ใกล้ข้อมูลที่ใช้ตัดสินใจ','mobile layout ต้องลดการเลื่อนกลับไปกลับมาระหว่างข้อมูลกับปุ่ม','touch target และลำดับข้อมูลต้องช่วยให้เลือกได้โดยไม่ซูม'],near:['ตรึงปุ่มตลอดเวลาอาจช่วย แต่ถ้าบังข้อมูลสำคัญจะเพิ่ม friction','ย้ายข้อมูลรองลงท้ายหน้าอาจโล่ง แต่ทำให้ต้องเลื่อนหา context','ใช้ภาพใหญ่บนมือถืออาจดึงดูด แต่แย่งพื้นที่จาก action']},
    5:{name:'hierarchy trap',prompt:'เหตุผลใดจับ hierarchy trap จากหลักฐานได้ดีที่สุด',ok:['trap คือทำให้สิ่งเด่นที่สุดไม่ใช่สิ่งที่ช่วยตัดสินใจจริง','ต้องแยกความเด่นทางภาพออกจากผลต่อ task completion','hierarchy ที่ถูกต้องต้องรักษา context ที่จำเป็นก่อน action'],near:['ถ้าขยาย CTA อย่างเดียว ผู้ใช้อาจกดเร็วแต่ยังไม่เข้าใจเงื่อนไข','ถ้าซ่อนข้อมูลรองหมด หน้าอาจโล่งแต่การตัดสินใจอ่อนลง','ถ้าใช้ภาพใหญ่ก่อน ผู้ใช้อาจมองก่อนแต่ยังไม่รู้ next step']}
  };
  function stage(){return stages[Math.max(1,Math.min(5,roundNo()))]||stages[1];}
  function choose(list,seed,offset,used){for(let k=0;k<list.length;k++){const s=list[(h(seed)+offset+k)%list.length]; const key=s.toLowerCase(); if(!used.has(key)){used.add(key);return s;}} return list[offset%list.length];}
  function subtitleNodes(btn){return $$('span,small',btn);}
  function needsFix(){const box=$('.verify'); if(!box)return false; return GENERIC.test($$('.verify .option span,.verify .option small',box).map(text).join(' '));}
  function apply(){
    const box=$('.verify'); if(!box)return;
    const st=stage();
    const mark=`${roundNo()}|${text($('.top .pill'))}|${$$('.verify .option',box).map(o=>o.dataset.reason||'').join(',')}`;
    if(box.dataset.w7ReasonStageMark===mark&&!needsFix())return;
    const seed=[roundNo(),text($('.top .pill')),text($('.case h1')),text($('.case p:last-child'))].join('|');
    const used=new Set();
    $$('.verify .option',box).forEach((btn,i)=>{
      const n=idx(btn); const correct=n===0; const b=$('b',btn); const subs=subtitleNodes(btn); const list=correct?st.ok:st.near;
      if(b)b.textContent=choose(list,seed,i+n+3,used);
      const sub=correct?'โยงกับ goal, context และ task impact ของรอบนี้':'ยังใกล้เคียง แต่หลักฐานของรอบนี้ยังไม่พอ';
      if(subs.length)subs[subs.length-1].textContent=sub;
      btn.dataset.w7ReasonStage='1';
    });
    const title=$('h3',box); if(title)title.textContent=`ตรวจเหตุผล • W7 • ${st.name}`;
    const p=$('p',box); if(p)p.textContent=st.prompt;
    box.dataset.w7ReasonStageMark=mark;
  }
  function style(){if($('#uxq-w7-reason-stage-style'))return; const s=document.createElement('style');s.id='uxq-w7-reason-stage-style';s.textContent=`.verify .option[data-w7-reason-stage="1"]{min-height:128px!important;display:grid!important;align-content:start!important;gap:8px!important}.verify .option[data-w7-reason-stage="1"] b{font-size:1.02rem!important;line-height:1.32!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:4em!important;max-height:4em!important}.verify .option[data-w7-reason-stage="1"] span,.verify .option[data-w7-reason-stage="1"] small{color:#b9c8e4!important;line-height:1.35!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.7em!important;max-height:2.7em!important}`; document.head.appendChild(s);}
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(()=>{style();apply();},70);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule(); new MutationObserver(()=>{if(needsFix())schedule();else schedule();}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
