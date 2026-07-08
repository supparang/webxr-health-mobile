/* CSAI2601 UX Quest • Field-Aware Main Choices W2-W3 v1
 * Rewrites visible main question/options for W2 HCD and W3 Psychology according to selected case fields.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();
  const content = () => window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;

  function currentCaseId() {
    const m = text($('.top .pill')).match(/(W[23]-C\d{3})/i);
    return m ? m[1].toUpperCase() : '';
  }
  function currentStageIndex() {
    const m = text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/);
    return m ? Math.max(0, Number(m[1]) - 1) : 0;
  }
  function currentCase() {
    const id = currentCaseId();
    const node = (content()?.nodes || []).find((n) => String(n.id || '').toUpperCase() === nodeId());
    return (node?.seedCases || []).find((c) => String(c.id || '').toUpperCase() === id) || null;
  }
  function setText(el, value) { if (el && value) el.textContent = value; }
  function setOption(btn, label, helper) { const b = $('b', btn); const span = $('span', btn); if (b) b.textContent = label; if (span) span.textContent = helper || 'คิดจากหลักฐานใน case นี้'; }
  function option(prefix) { return $(`.options .option[data-choice^="${prefix}"]`); }
  function pack(items) { return items.map((x) => Array.isArray(x) ? x : [x, 'กับดัก: ไม่โยงกับหลักฐานผู้ใช้']); }

  function taskW2(c, s) { return [
    ['ข้อมูลใดเป็น evidence ที่ควรเริ่มจากผู้ใช้จริง', `สถานการณ์: ${c.context} • ผู้ใช้: ${c.user || 'ผู้ใช้หลัก'} • Risk: ${c.risk || ''}`, c.evidence || 'เก็บหลักฐานจากผู้ใช้จริงก่อนตัดสินใจออกแบบ', pack(['เริ่มวาด prototype ทันที','ถามทีมว่าคิดว่าผู้ใช้ต้องการอะไร','เลือกจากสิ่งที่ผู้บริหารอยากเห็น'])],
    ['ลำดับ HCD ใดเหมาะกับ case นี้', `สถานการณ์: ${c.context} • Risk: ${c.risk || ''}`, 'Empathize → Define → Ideate → Prototype → Test โดยใช้ evidence นำ design', pack(['Prototype → Test → ค่อยถามผู้ใช้','Ideate จากความชอบทีมก่อน','ข้าม Define เพราะมี solution แล้ว'])],
    ['Assumption trap คืออะไร', `สถานการณ์: ${c.context} • Misconception: ${c.misconception || ''}`, c.misconception || c.risk || 'ทีมเดา need ของผู้ใช้โดยไม่มีหลักฐาน', pack(['ถือว่าข้อมูลผู้ใช้ไม่จำเป็น','เลือกตาม UI ที่สวยกว่า','ทำตามระบบเดิมโดยไม่ถามผู้ใช้'])],
    ['ควรเลือก research target ใดก่อน', `สถานการณ์: ${c.context} • ผู้ใช้เกี่ยวข้อง: ${c.user || ''}`, `เริ่มจาก ${c.user || 'ผู้ใช้ที่ทำ task จริง'} เพราะเป็นคนเจอ friction โดยตรง`, pack(['ถามเฉพาะทีมพัฒนา','ถามเฉพาะผู้บริหาร','ถามคนที่ไม่เคยทำ task นี้'])],
    ['Small test ใดเหมาะกับการเริ่มตรวจ evidence', `สถานการณ์: ${c.context} • Evidence ที่ควรหา: ${c.evidence || ''}`, c.evidence || 'ให้ผู้ใช้ทำ task จริง สังเกตจุดติด และถามเหตุผลสั้น ๆ', pack(['ถามว่าชอบภาพไหน','ดูยอดเข้าหน้าเว็บอย่างเดียว','ให้ทีมโหวต solution'])]
  ][s] || null; }

  function taskW3(c, s) { return [
    ['ปัญหานี้เกี่ยวกับหลักจิตวิทยาข้อใด', `สถานการณ์: ${c.context} • Issue: ${c.issue || ''}`, c.concept ? `เกี่ยวกับ ${c.concept} เพราะ ${c.issue || 'ผู้ใช้รับรู้/ตัดสินใจผิด'}` : 'เกี่ยวกับ cognitive load / feedback / mental model จากพฤติกรรมผู้ใช้', pack(['เป็นแค่ปัญหาความสวย','เป็นปัญหาโค้ดเท่านั้น','ผู้ใช้ควรจำและอ่านเอง'])],
    ['ภาระความคิดของผู้ใช้เกิดจากอะไร', `สถานการณ์: ${c.context} • ผู้ใช้: ${c.user || ''}`, c.issue || 'ข้อมูล/ตัวเลือก/feedback ทำให้ผู้ใช้จำหรือเดามากเกินไป', pack(['เพราะผู้ใช้ไม่ตั้งใจ','เพราะสีไม่สดพอ','เพราะระบบมีข้อมูลครบเกินไปจึงดีแล้ว'])],
    ['Repair ใดช่วยลดภาระผู้ใช้', `สถานการณ์: ${c.context} • Repair: ${c.repair || ''}`, c.repair || 'ทำให้ผู้ใช้จำให้น้อยลง เห็น feedback ใกล้ action และเลือกง่ายขึ้น', pack(['เพิ่มคำอธิบายยาวทุกจุด','ซ่อน error เพื่อให้หน้าโล่ง','เพิ่มตัวเลือกให้ครบที่สุด'])],
    ['กับดักใดต้องหลีกเลี่ยง', `สถานการณ์: ${c.context} • Misconception: ${c.misconception || ''}`, c.misconception ? `หลีกเลี่ยง: ${c.misconception}` : 'อย่าโทษผู้ใช้หรือเพิ่ม load โดยไม่แก้ feedback/mental model', pack(['ใช้ศัพท์ระบบภายในต่อไป','แสดงทุกอย่างเท่ากัน','ให้ผู้ใช้ลองผิดลองถูกเอง'])],
    ['จะ validate repair อย่างไร', `สถานการณ์: ${c.context} • Concept: ${c.concept || ''}`, 'ให้ผู้ใช้ทำ task เดิมแล้ววัดว่าผิดน้อยลง เร็วขึ้น และอธิบาย next step ได้', pack(['ถามว่าชอบดีไซน์ใหม่ไหม','ดูแค่จำนวนคนเข้าหน้า','ให้ทีมตัดสินว่าเข้าใจง่ายขึ้น'])]
  ][s] || null; }

  function rewrite() {
    const node = nodeId();
    if (node !== 'W2' && node !== 'W3') return;
    const question = $('.question');
    if (!question || $('.verify') || $('.feedback')) return;
    const c = currentCase();
    if (!c) return;
    const stage = currentStageIndex();
    const task = node === 'W2' ? taskW2(c, stage) : taskW3(c, stage);
    if (!task) return;
    const mark = `${node}-${currentCaseId()}-${stage}`;
    if (question.dataset.fieldAwareW2W3 === mark) return;
    setText($('.prompt', question), task[0]);
    setText($('.instruction', question), task[1]);
    setOption(option(`c${stage}`), task[2], 'คำตอบนี้โยงกับ field เฉพาะของ case นี้โดยตรง');
    task[3].forEach((w, i) => setOption(option(`d${stage}-${i}`), w[0], w[1]));
    question.dataset.fieldAwareW2W3 = mark;
  }
  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(rewrite, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
