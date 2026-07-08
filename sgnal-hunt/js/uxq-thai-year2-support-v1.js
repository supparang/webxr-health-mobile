/* CSAI2601 UX Quest • Thai Year 2 Student Support v1
 * Thai-first wording for Thai Year 2 learners. English UX terms remain only as support terms.
 */
(() => {
  'use strict';

  const EXACT = new Map([
    ['STUDIO ARTIFACT', 'ใบงานหลังเล่น'],
    ['Studio Artifact', 'ใบงานหลังเล่น'],
    ['UX First Impression Audit', 'ใบงานตรวจ UX ครั้งแรก'],
    ['Screenshot/description', 'ภาพหน้าจอหรือคำอธิบายหน้าจอ'],
    ['User goal', 'เป้าหมายของผู้ใช้ (User goal)'],
    ['Friction', 'จุดติดขัดของผู้ใช้ (Friction)'],
    ['Impact', 'ผลกระทบต่อผู้ใช้ (Impact)'],
    ['Suggested fix', 'แนวทางแก้เบื้องต้น'],
    ['Test idea', 'วิธีทดสอบว่าแก้ดีขึ้นจริง'],
    ['Evidence', 'หลักฐานจากผู้ใช้'],
    ['Decision', 'สิ่งที่เลือกออกแบบ/แก้ไข'],
    ['Proof', 'วิธีพิสูจน์ผล'],
    ['Score', 'คะแนน'],
    ['Accuracy', 'ความถูกต้อง'],
    ['Reason', 'เหตุผล'],
    ['Hints', 'คำใบ้'],
    ['Time', 'เวลา']
  ]);

  const PARTIAL = [
    [/นำผลการเล่นไปเติมใบงาน\/portfolio ตามหัวข้อต่อไปนี้/g, 'นำผลจากเกมไปเขียนใบงานหรือแฟ้มสะสมงาน โดยตอบเป็นภาษาไทยได้'],
    [/เขียนสิ่งที่ตัดสินใจจากหลักฐาน ไม่ใช่แค่คำตอบที่เลือก/g, 'เขียนเป็นภาษาไทยสั้น ๆ ว่า เห็นปัญหาอะไร เลือกแก้อะไร และมีเหตุผลจากหลักฐานอะไร'],
    [/สิ่งที่ Dashboard\/ครูควรเห็นจากด่านนี้/g, 'ข้อมูลที่ครูจะใช้ดูพัฒนาการ'],
    [/WEEKLY MISSION/g, 'ภารกิจรายสัปดาห์'],
    [/BOSS GATE/g, 'ด่านสรุปความรู้'],
    [/Mission Round/g, 'รอบภารกิจ'],
    [/Boss Round/g, 'รอบบอส'],
    [/Reason Check/g, 'ตรวจเหตุผล'],
    [/Case:/g, 'สถานการณ์:'],
    [/Hint:/g, 'คำใบ้:']
  ];

  const FIELD_HINTS = new Map([
    ['ภาพหน้าจอหรือคำอธิบายหน้าจอ', 'อธิบายหน้าจอ/ระบบที่พบปัญหา เช่น หน้าแรกระบบลงทะเบียน ปุ่มยืนยันหาไม่เจอ'],
    ['เป้าหมายของผู้ใช้ (User goal)', 'ผู้ใช้ต้องการทำอะไรให้สำเร็จ เช่น ลงทะเบียนให้เสร็จ ตรวจสถานะ หรือส่งคำร้อง'],
    ['จุดติดขัดของผู้ใช้ (Friction)', 'ผู้ใช้ติดตรงไหน เช่น หาเมนูไม่เจอ ไม่รู้ว่ากดอะไรต่อ หรือระบบไม่บอกสถานะ'],
    ['ผลกระทบต่อผู้ใช้ (Impact)', 'ผลเสียคืออะไร เช่น เสียเวลา ส่งข้อมูลซ้ำ ทำงานไม่สำเร็จ หรือเข้าใจผิด'],
    ['แนวทางแก้เบื้องต้น', 'จะปรับอะไร เช่น จัดลำดับข้อมูลใหม่ ทำปุ่มหลักให้ชัด หรือเพิ่ม feedback หลังส่งข้อมูล'],
    ['วิธีทดสอบว่าแก้ดีขึ้นจริง', 'จะให้ผู้ใช้ลองทำ task ใด แล้ววัดอะไร เช่น ทำสำเร็จเร็วขึ้น ผิดน้อยลง หรืออธิบาย next step ได้']
  ]);

  function textNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  function translateText(value) {
    let out = value;
    const trimmed = value.trim();
    if (EXACT.has(trimmed)) out = value.replace(trimmed, EXACT.get(trimmed));
    PARTIAL.forEach(([pattern, replacement]) => { out = out.replace(pattern, replacement); });
    return out;
  }

  function apply() {
    textNodes(document.body).forEach((node) => {
      const next = translateText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });

    document.querySelectorAll('textarea').forEach((area) => {
      const label = area.closest('label')?.querySelector('b')?.textContent?.trim() || '';
      const hint = FIELD_HINTS.get(label) || 'ตอบเป็นภาษาไทยได้: เขียนจากหลักฐานผู้ใช้ → สิ่งที่เลือก → เหตุผล → วิธีพิสูจน์';
      area.placeholder = hint;
      area.lang = 'th';
    });

    document.querySelectorAll('.artifact').forEach((box) => {
      if (box.querySelector('[data-thai-year2-note]')) return;
      const note = document.createElement('p');
      note.setAttribute('data-thai-year2-note', '1');
      note.style.cssText = 'margin:0;padding:10px 12px;border:1px solid rgba(110,231,255,.28);border-radius:12px;background:rgba(110,231,255,.08);color:#dff7ff;line-height:1.55;font-weight:700';
      note.textContent = 'ตอบเป็นภาษาไทยได้เต็มที่ ใช้คำอังกฤษเฉพาะคำสำคัญ เช่น UX, User goal, Friction เพื่อฝึกศัพท์วิชาชีพ';
      const h2 = box.querySelector('h2');
      if (h2) h2.insertAdjacentElement('afterend', note);
      else box.prepend(note);
    });
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
