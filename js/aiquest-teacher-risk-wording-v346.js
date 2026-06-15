
(function(){
  'use strict';

  const VERSION = 'v3.4.6-teacher-risk-wording-polish';

  function txt(el){
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim();
  }

  function teacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){ return false; }
  }

  function replaceTextNode(node){
    if(!node || node.nodeType !== 3) return;
    let s = node.nodeValue || '';
    const original = s;

    s = s
      .replace(/\bRisk Students\s*\/\s*Students to Support\b/g, 'Students to Review / Support')
      .replace(/\bRisk Students\b/g, 'Students to Review')
      .replace(/\bRisk\b/g, 'Review Focus')
      .replace(/Misconception:\s*automation/gi, 'Focus: automation')
      .replace(/Misconception:\s*sensor/gi, 'Focus: sensor')
      .replace(/Misconception:\s*rulebased/gi, 'Focus: rule-based')
      .replace(/Misconception:\s*calculator/gi, 'Focus: calculator')
      .replace(/Misconception:\s*peas_swap/gi, 'Focus: PEAS order')
      .replace(/ควรระวังว่า/gi, 'ควรทบทวนว่า')
      .replace(/ตาราง Risk Students/gi, 'ตาราง Students to Review')
      .replace(/ความเสี่ยง/gi, 'จุดทบทวน')
      .replace(/ผิดพลาด/gi, 'ควรทบทวน');

    if(s !== original) node.nodeValue = s;
  }

  function walkText(root){
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let n;
    while((n = walker.nextNode())) replaceTextNode(n);
  }

  function polishBadges(){
    if(!teacher()) return;

    Array.from(document.querySelectorAll('span, div, td, button')).forEach(el=>{
      const t=txt(el);
      if(/^Focus:\s*/i.test(t)){
        el.style.background='rgba(59,130,246,.16)';
        el.style.border='1px solid rgba(59,130,246,.28)';
        el.style.color='#bfdbfe';
        el.title='จุดทบทวนเพื่อพัฒนาต่อ ไม่ใช่สถานะตก/ผิดรุนแรง';
      }
      if(/^Review Focus$/i.test(t)){
        el.title='หัวข้อที่ควรทบทวนเพิ่มเติม';
      }
      if(t.includes('Students to Review')){
        el.title='นักศึกษาที่ควรได้รับคำแนะนำ/แบบฝึกเพิ่ม ไม่ใช่ผู้เรียนที่ตก';
      }
    });
  }

  function addReviewLegend(){
    if(!teacher()) return;

    const host = Array.from(document.querySelectorAll('section, div, article'))
      .find(el => txt(el).includes('Students to Review') || txt(el).includes('Phase Analytics'));

    if(!host || document.getElementById('teacherReviewLegendV333')) return;

    const legend=document.createElement('div');
    legend.id='teacherReviewLegendV333';
    legend.style.margin='10px 0';
    legend.style.padding='10px 12px';
    legend.style.borderRadius='14px';
    legend.style.background='rgba(59,130,246,.10)';
    legend.style.border='1px solid rgba(59,130,246,.22)';
    legend.className='muted';
    legend.innerHTML='<b>Review Focus:</b> แสดงหัวข้อที่ควรทบทวนเพิ่มเติมจากข้อมูลการเล่น ไม่ได้หมายความว่านักศึกษาตกหรือมีปัญหารุนแรง';

    host.insertAdjacentElement('beforebegin', legend);
  }

  function polishTeachingDecision(){
    if(!teacher()) return;

    Array.from(document.querySelectorAll('section, div, article')).forEach(el=>{
      const t=txt(el);
      if(!t.includes('Teaching Decision')) return;
      if(el.__riskWordingV333) return;

      const note=document.createElement('div');
      note.id='teacherRiskWordingNoteV333';
      note.style.marginTop='10px';
      note.style.padding='10px 12px';
      note.style.borderRadius='14px';
      note.style.background='rgba(14,165,233,.10)';
      note.style.border='1px solid rgba(14,165,233,.22)';
      note.className='muted';
      note.innerHTML='<b>คำแนะนำการสอน:</b> ใช้ Review Focus เพื่อเลือกตัวอย่างเสริม/แบบฝึกสั้น ๆ โดยไม่ต้องตีความว่าเป็นความเสี่ยงรุนแรง';

      el.appendChild(note);
      el.__riskWordingV333=true;
    });
  }

  function cleanDuplicateLegend(){
    const items=Array.from(document.querySelectorAll('#teacherReviewLegendV333, #teacherRiskWordingNoteV333'));
    const byId={};
    items.forEach(el=>{
      if(byId[el.id]) el.remove();
      else byId[el.id]=el;
    });
  }

  function refresh(){
    if(!teacher()) return;
    walkText(document.body);
    polishBadges();
    addReviewLegend();
    polishTeachingDecision();
    cleanDuplicateLegend();
  }

  window.AIQUEST_TEACHER_RISK_WORDING = {
    version: VERSION,
    refresh,
    walkText,
    polishBadges
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 450));
  }else{
    setTimeout(refresh, 450);
  }

  if(!window.__AIQUEST_TEACHER_RISK_WORDING_OBSERVER_V333){
    window.__AIQUEST_TEACHER_RISK_WORDING_OBSERVER_V333 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_TEACHER_RISK_WORDING_TIMER_V333);
      window.__AIQUEST_TEACHER_RISK_WORDING_TIMER_V333 = setTimeout(refresh, 260);
    });
    window.__AIQUEST_TEACHER_RISK_WORDING_OBSERVER_V333.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_RISK_WORDING);
})();
