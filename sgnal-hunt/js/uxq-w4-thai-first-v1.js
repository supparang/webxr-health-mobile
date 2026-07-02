/* UX Quest • W4 Thai-first learner language
   Keeps only core UX vocabulary in English on first encounter, while replacing
   gameplay chrome and instructional wording with Thai for Thai undergraduates.
*/
(() => {
  'use strict';
  if (!/w4-user-insight-lab\.html/i.test(location.pathname)) return;

  document.documentElement.lang = 'th';
  document.title = 'UX Quest • W4 ห้องแล็บถอดรหัสผู้ใช้';

  const exact = new Map([
    ['Mission progress', 'ความคืบหน้าภารกิจ'],
    ['Score', 'คะแนน'],
    ['Verified', 'เหตุผลที่ผ่าน'],
    ['Clock', 'เวลา'],
    ['RESULT SECURED', 'บันทึกผลภารกิจแล้ว'],
    ['MISSION CLEARED', 'ผ่านภารกิจแล้ว'],
    ['CASEFILE REVIEW', 'ทบทวนคดี'],
    ['Anti-guess check:', 'ตรวจการเดา:'],
    ['score', 'คะแนน'],
    ['accuracy', 'ความถูกต้อง'],
    ['verified', 'เหตุผลผ่าน'],
    ['evidence calls', 'การตัดสินใจ'],
    ['best combo', 'คอมโบสูงสุด'],
    ['Badge unlocked:', 'ปลดล็อกรางวัล:'],
    ['Mission Control', 'ศูนย์ภารกิจ'],
    ['ออก', 'ออกจากภารกิจ'],
    ['Reason Check: ทำไมคำตอบนี้จึงน่าเชื่อ?', 'ตรวจเหตุผล: ทำไมคำตอบนี้จึงน่าเชื่อถือ?'],
    ['ติดตรงไหน? เปิด Hint ได้ 1 ครั้งต่อข้อ (−15 คะแนน)', 'ติดตรงไหน? ดูคำใบ้ได้ 1 ครั้งต่อข้อ (−15 คะแนน)'],
    ['ใช้ Hint', 'ดูคำใบ้'],
    ['เก็บหลักฐานต่อ', 'ทำข้อต่อไป'],
    ['สรุปผลภารกิจ', 'ดูสรุปผล'],
    ['เล่นอีกครั้งด้วยคดีใหม่', 'เล่นอีกครั้งด้วยคดีใหม่'],
    ['User Insight Lab', 'ห้องแล็บถอดรหัสผู้ใช้'],
    ['ACT II • USER INSIGHT LAB', 'ACT II • ห้องแล็บถอดรหัสผู้ใช้'],
    ['W4 INSIGHT LAB', 'W4 ห้องแล็บผู้ใช้']
  ]);

  const fragments = [
    ['Signal Scan:', 'สแกนเสียงผู้ใช้:'],
    ['Signal Filter:', 'แยกสิ่งที่เห็นจริง:'],
    ['Insight Lens:', 'สกัดความเข้าใจเชิงลึก:'],
    ['Define Lock:', 'ตั้งโจทย์ให้ตรงผู้ใช้:'],
    ['Boss Signal', 'ด่านบอส: ข้อมูลชนกัน'],
    ['Point of View / HMW', 'โจทย์ออกแบบ (HMW)'],
    ['Observation', 'สิ่งที่สังเกตได้ (Observation)'],
    ['Assumption', 'ข้อสันนิษฐาน'],
    ['Solution', 'แนวทางแก้'],
    ['Insight', 'ความเข้าใจเชิงลึก (Insight)'],
    ['visual', 'หน้าตา'],
    ['solution', 'แนวทางแก้'],
    ['task', 'งานที่ผู้ใช้ต้องทำ'],
    ['mental model', 'ความเข้าใจของผู้ใช้ต่อระบบ']
  ];

  function replaceText(text) {
    if (!text || !text.trim()) return text;
    let next = exact.has(text.trim()) ? text.replace(text.trim(), exact.get(text.trim())) : text;
    fragments.forEach(([from, to]) => { next = next.split(from).join(to); });
    return next;
  }

  function translate(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) return;
      const original = node.nodeValue;
      const next = replaceText(original);
      if (next !== original) node.nodeValue = next;
    });
  }

  function injectGlossary(){
    if (document.getElementById('uxq-w4-thai-glossary')) return;
    const hero = document.querySelector('.uxq-hero');
    if (!hero) return;
    const card = document.createElement('aside');
    card.id = 'uxq-w4-thai-glossary';
    card.style.cssText = 'border:1px solid rgba(142,252,242,.35);border-radius:16px;padding:13px 15px;background:rgba(65,223,207,.08);color:#e9ffff;line-height:1.55;font-size:.91rem';
    card.innerHTML = '<b style="display:block;color:#9bfff6;margin-bottom:5px">ศัพท์ UX ที่ต้องรู้ในด่านนี้</b><span><b>สิ่งที่สังเกตได้ (Observation)</b> = สิ่งที่เห็นหรือบันทึกได้จริง • <b>ความเข้าใจเชิงลึก (Insight)</b> = ความต้องการหรือแรงกังวลที่ซ่อนอยู่ • <b>HMW</b> = โจทย์ออกแบบที่ยังไม่ล็อกคำตอบ</span>';
    const actions = hero.querySelector('.uxq-actions');
    if (actions) actions.insertAdjacentElement('beforebegin', card);
    else hero.appendChild(card);
  }

  function apply(){
    translate();
    injectGlossary();
  }

  const observer = new MutationObserver(() => apply());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    }, { once:true });
  } else {
    apply();
    observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  }
})();