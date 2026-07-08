/* CSAI2601 UX Quest • Field-Aware Main Choices W8-W15 v1
 * Rewrites visible main question/options for W8-W15 according to the selected case fields.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();
  const content = () => window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;

  function currentCaseId() {
    const m = text($('.top .pill')).match(/(W(?:[8-9]|1[0-5])-C\d{3})/i);
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
  function taskW8(c, s) { return [
    ['Evidence chain ขาดตรงไหน', `สถานการณ์: ${c.context} • ${c.evidenceChain || c.issue}`, c.evidenceChain || 'เชื่อม Problem → Persona → Flow → Wireframe ให้ครบ', pack(['ดู final UI ก่อนโดยไม่ย้อน evidence','เลือกตามความสวยของ wireframe','ตัด persona ออกเพราะเสียเวลา'])],
    ['Mismatch ใดกระทบ blueprint มากที่สุด', `สถานการณ์: ${c.context} • Mismatch: ${c.mismatch || c.issue}`, c.mismatch || c.issue, pack(['แก้สีปุ่มก่อนเสมอ','เพิ่มหน้าจอให้ครบโดยไม่แก้ flow','ใช้ความเห็นทีมแทนหลักฐาน'])],
    ['ควรจัดลำดับ critique อย่างไร', `สถานการณ์: ${c.context} • Priority: ${c.critiquePriority || ''}`, c.critiquePriority || 'แก้จุดที่กระทบ task success ก่อน', pack(['แก้สิ่งที่ทำง่ายก่อน','แก้จุดที่ดูไม่สวยก่อน','แก้ตามคนพูดดังที่สุด'])],
    ['Revision plan ใดเหมาะที่สุด', `สถานการณ์: ${c.context} • Revision: ${c.revision || ''}`, c.revision || 'ระบุ before/after และ evidence ที่คาดว่าจะดีขึ้น', pack(['แก้ทั้งหมดพร้อมกันโดยไม่วัดผล','เปลี่ยน theme สีใหม่','เพิ่มคำอธิบายยาว ๆ ทุกจุด'])],
    ['Rationale ใดใช้ป้องกันงานได้', `สถานการณ์: ${c.context}`, c.rationale || 'อธิบาย decision จาก evidence และผลต่อผู้ใช้', pack(['เพราะทีมชอบแบบนี้','เพราะดูทันสมัยกว่า','เพราะ competitor ทำแบบนี้'])]
  ][s] || null; }
  function taskW9(c, s) { return [
    ['Component ใดควรรวมเป็น pattern', `สถานการณ์: ${c.context} • ${c.inconsistency || c.issue}`, `รวม ${c.component || 'component'} ที่ทำหน้าที่เดียวกันให้เหลือ pattern เดียวพร้อม variant ที่มีเหตุผล`, pack(['สร้างปุ่มใหม่ทุกหน้า','เปลี่ยนสีตามความชอบ','ไม่ต้องรวมเพราะนักออกแบบจำได้'])],
    ['State ใดต้องกำหนดให้ครบ', `สถานการณ์: ${c.context} • States: ${c.state || ''}`, c.state || 'default/focus/error/success/disabled/loading ตามบริบท', pack(['มีแค่ default ก็พอ','ใช้สีเดียวทุก state','ซ่อน error state ไว้ท้ายหน้า'])],
    ['Naming convention ใดเหมาะกว่า', `สถานการณ์: ${c.context}`, c.naming || 'ตั้งชื่อ pattern ตาม role-purpose-state', pack(['ตั้งชื่อตามคนทำ','ตั้งชื่อตามสีที่เห็น','ตั้งชื่อไม่ซ้ำก็พอ'])],
    ['System rule ใดลดความสับสน', `สถานการณ์: ${c.context}`, c.systemRule || 'ลด variant ซ้ำและกำหนด meaning ของ component', pack(['ทำ component ให้หลากหลายที่สุด','ให้แต่ละหน้าตัดสินเอง','เพิ่ม decoration ให้ทุกปุ่ม'])],
    ['Consistency ช่วยผู้ใช้อย่างไร', `สถานการณ์: ${c.context}`, 'ทำให้ผู้ใช้จำ pattern ได้ ลดการเรียนรู้ซ้ำ และเข้าใจ state ตรงกัน', pack(['ช่วยนักออกแบบเท่านั้น','ทำให้หน้าเหมือนกันจนน่าเบื่อ','ไม่เกี่ยวกับ usability'])]
  ][s] || null; }
  function taskW10(c, s) { return [
    ['Responsive issue ใดต้องแก้ก่อน', `สถานการณ์: ${c.context} • ${c.responsiveIssue || c.issue}`, c.responsiveIssue || c.issue, pack(['แก้สี brand ก่อน','เพิ่ม animation ก่อน','ปล่อยให้ผู้ใช้ซูมเอง'])],
    ['Accessibility issue ใดกระทบ task', `สถานการณ์: ${c.context} • ${c.a11yIssue || ''}`, c.a11yIssue || 'contrast/focus/label/touch target ที่ทำให้ใช้ไม่ได้จริง', pack(['ถือว่า a11y เฉพาะผู้พิการเท่านั้น','สนใจเฉพาะ desktop','ซ่อน label เพราะดูโล่ง'])],
    ['Breakpoint ควรเลือกจากอะไร', `สถานการณ์: ${c.context}`, c.breakpoint || 'เลือกจากจุดที่เนื้อหาเริ่มอ่าน/ใช้ยาก', pack(['เลือกตามรุ่นมือถือยอดนิยมเท่านั้น','ใช้ desktop layout ทุกขนาด','เลือกตามความสวยของ mockup'])],
    ['Fix ใดแก้ touch/reading problem', `สถานการณ์: ${c.context}`, c.fix || 'เพิ่ม touch target, เปลี่ยนตารางเป็น card, เพิ่ม contrast/focus', pack(['ลด font ให้ใส่ข้อมูลครบ','ซ่อน error เพื่อให้หน้าโล่ง','ให้ผู้ใช้หมุนจอเอง'])],
    ['ควร check อะไรก่อนผ่าน', `สถานการณ์: ${c.context}`, c.check || 'ทดสอบ task บน mobile + keyboard + contrast', pack(['ถามว่าชอบสีไหม','ดูแค่จำนวนคนเข้าเว็บ','ให้ทีมดู screenshot'])]
  ][s] || null; }
  function taskW11(c, s) { return [
    ['Color meaning ใดต้องแก้', `สถานการณ์: ${c.context} • ${c.colorIssue || c.issue}`, c.colorIssue || c.issue, pack(['ใช้สีเดียวแทนทุกสถานะ','เลือกสีตามความชอบ','ใช้สีอย่างเดียวแทนข้อความ'])],
    ['Type hierarchy ใดช่วยอ่าน', `สถานการณ์: ${c.context} • ${c.typographyIssue || ''}`, c.typographyIssue || 'แยก heading/body/status/warning ให้ชัด', pack(['ใช้ font size เดียวทั้งหน้า','ทำทุกอย่าง bold','ใส่ข้อความยาวในป้ายเล็ก'])],
    ['Contrast ใดควรตรวจ', `สถานการณ์: ${c.context}`, c.contrast || 'ตรวจข้อความสำคัญ ปุ่ม และ status ให้มองเห็นได้', pack(['ตรวจเฉพาะ logo','ให้สีสวยมาก่อนอ่านได้','ไม่ต้องตรวจถ้าดูด้วยตาแล้วโอเค'])],
    ['Spacing scale ช่วยอะไร', `สถานการณ์: ${c.context}`, c.spacing || 'ช่วยแบ่งกลุ่มข้อมูลและลด cognitive load', pack(['ใส่ช่องว่างเท่าไรก็ได้','บีบทุกอย่างให้เห็นครบ','ใช้ spacing เพื่อความสวยเท่านั้น'])],
    ['Visual decision ใดป้องกันได้', `สถานการณ์: ${c.context}`, c.visualDecision || 'กำหนด token/scale/meaning ก่อนทำ hi-fi', pack(['เลือกตาม mood วันนั้น','คัดลอกสีจากเว็บดัง','ใช้ภาพสวยแทน hierarchy'])]
  ][s] || null; }
  function taskW12(c, s) { return [
    ['State ใดจำเป็นที่สุด', `สถานการณ์: ${c.context} • ${c.stateIssue || c.issue}`, c.stateIssue || c.issue, pack(['มีแค่หน้าปกติก็พอ','รอให้ผู้ใช้เดาเอง','ใช้ alert เดียวทุกกรณี'])],
    ['จะ prevent ปัญหานี้อย่างไร', `สถานการณ์: ${c.context}`, c.prevention || 'กัน double submit / dead end ด้วย state ที่ชัด', pack(['เพิ่มปุ่มหลายอัน','ปล่อยให้กดซ้ำได้','ซ่อนสถานะระหว่างโหลด'])],
    ['Microcopy ใดช่วยผู้ใช้', `สถานการณ์: ${c.context}`, c.microcopy || 'บอกปัญหา เหตุผล และวิธีแก้สั้น ๆ', pack(['เกิดข้อผิดพลาด','ลองใหม่อีกครั้งโดยไม่บอกเหตุผล','ใช้ศัพท์เทคนิคระบบ'])],
    ['Confirmation feedback ใดเหมาะ', `สถานการณ์: ${c.context}`, c.feedback || 'บอกว่าสำเร็จ/กำลังทำ/ผิดพลาด และ next step', pack(['ไม่มี feedback หลังคลิก','โชว์ popup สวยแต่ไม่มีสถานะ','บอกแค่ OK'])],
    ['Recovery path ใดควรมี', `สถานการณ์: ${c.context}`, c.recovery || 'ให้กลับไปแก้/ลองใหม่โดยไม่เริ่มใหม่ทั้งหมด', pack(['ล้างข้อมูลทั้งหมด','ส่งกลับหน้าแรก','บอกให้ติดต่อ admin อย่างเดียว'])]
  ][s] || null; }
  function taskW13(c, s) { return [
    ['Prototype นี้ควรทดสอบ task ใด', `สถานการณ์: ${c.context}`, c.task || 'ทดสอบ main flow ที่คลิกได้จริง', pack(['ดูภาพสวยเฉย ๆ','ทดสอบทุกอย่างพร้อมกัน','ถามว่าชอบ prototype ไหม'])],
    ['Missing link ใดต้องแก้', `สถานการณ์: ${c.context} • ${c.missingLink || c.issue}`, c.missingLink || c.issue, pack(['ปล่อย dead end ไว้ก่อน','ใช้ภาพแทน link','ให้ผู้ทดสอบจินตนาการเอง'])],
    ['Interaction state ใดขาด', `สถานการณ์: ${c.context}`, c.interaction || 'state หลังคลิก/overlay/modal ต้องทำงานและย้อนกลับได้', pack(['ทำเฉพาะหน้าปกติ','ไม่ต้องทำ state เพราะยังเป็น prototype','ใช้ screenshot แทนการโต้ตอบ'])],
    ['Error path ควรตรวจอย่างไร', `สถานการณ์: ${c.context}`, c.errorPath || 'ให้ผู้ใช้เจอ error และกลับไปแก้ได้', pack(['ไม่มี error path ใน prototype','ล็อกไว้ที่หน้าผิดพลาด','ให้เริ่มใหม่เท่านั้น'])],
    ['Rationale ใดป้องกัน prototype', `สถานการณ์: ${c.context}`, c.rationale || 'prototype ต้องโยง task, flow และข้อจำกัดที่ทดสอบได้', pack(['เพราะดูเหมือนแอปจริง','เพราะทำเร็ว','เพราะใช้สีตรง brand'])]
  ][s] || null; }
  function taskW14(c, s) { return [
    ['Evidence ใดควรอ่านก่อน', `สถานการณ์: ${c.context} • ${c.evidence || c.issue}`, c.evidence || c.issue, pack(['ความเห็นทีม','ความชอบภาพรวม','จำนวนคนเปิดหน้า'])],
    ['Finding นี้จัดประเภทอย่างไร', `สถานการณ์: ${c.context}`, c.finding || 'จัดจาก task failure / wording / time / blocker', pack(['จัดจากความสวย','จัดตามความยากของทีม','จัดตามสีของหน้าจอ'])],
    ['Severity ควรให้ระดับใด', `สถานการณ์: ${c.context}`, c.severity || 'สูงถ้าทำให้ task ไม่สำเร็จ กลางถ้าทำให้ช้า/สับสน', pack(['สูงเพราะทีมไม่ชอบ','ต่ำเพราะแก้ยาก','วัดจากความสวยเท่านั้น'])],
    ['Fix ใด evidence-based', `สถานการณ์: ${c.context}`, c.fix || 'แก้ flow/wording/state ตาม finding', pack(['เปลี่ยน theme ทั้งหมด','เพิ่ม FAQ ยาว','แก้สิ่งที่ทีมทำง่ายก่อน'])],
    ['Retest ใดพิสูจน์ผล', `สถานการณ์: ${c.context}`, c.retest || 'ให้ทำ task เดิมแล้วเทียบ success/time/error', pack(['ถามว่าชอบแบบใหม่ไหม','ดูยอดเข้าหน้าเว็บ','ให้ทีมโหวต'])]
  ][s] || null; }
  function taskW15(c, s) { return [
    ['Narrative case study ควรเริ่มอย่างไร', `สถานการณ์: ${c.context}`, c.narrative || 'เริ่มจาก problem/user/evidence ก่อน final UI', pack(['เริ่มจากภาพ final UI','เริ่มจากเครื่องมือที่ใช้','เริ่มจากสีที่เลือก'])],
    ['Evidence gap ใดต้องเติม', `สถานการณ์: ${c.context} • ${c.evidenceGap || c.issue}`, c.evidenceGap || c.issue, pack(['เติมภาพสวยเพิ่ม','เติมคำชมจากเพื่อน','เติม logo ให้เด่นขึ้น'])],
    ['Portfolio story order ใดเหมาะ', `สถานการณ์: ${c.context}`, c.storyOrder || 'Problem → User → Evidence → Decision → Design → Test → Iteration', pack(['Final UI → สี → icon → จบ','Tools → screens → ข้อความยาว','โชว์ทุกหน้าจอแบบไม่มีเรื่องเล่า'])],
    ['Testing proof ใดควรใช้', `สถานการณ์: ${c.context}`, c.proof || 'ใช้ usability finding / before-after / task result', pack(['ใช้ยอด like','ถามว่าชอบภาพไหน','ใช้ความเห็นทีมอย่างเดียว'])],
    ['Presentation defense ใดน่าเชื่อถือ', `สถานการณ์: ${c.context}`, c.defense || 'อธิบาย decision จาก evidence และผลต่อ user outcome', pack(['เพราะส่วนตัวชอบ','เพราะดู modern','เพราะอยากให้เหมือนแอปดัง'])]
  ][s] || null; }

  const map = { W8:taskW8, W9:taskW9, W10:taskW10, W11:taskW11, W12:taskW12, W13:taskW13, W14:taskW14, W15:taskW15 };
  function rewrite() {
    const node = nodeId();
    if (!map[node]) return;
    const question = $('.question');
    if (!question || $('.verify') || $('.feedback')) return;
    const c = currentCase();
    if (!c) return;
    const stage = currentStageIndex();
    const task = map[node](c, stage);
    if (!task) return;
    const mark = `${node}-${currentCaseId()}-${stage}`;
    if (question.dataset.fieldAwareW8W15 === mark) return;
    setText($('.prompt', question), task[0]);
    setText($('.instruction', question), task[1]);
    setOption(option(`c${stage}`), task[2], 'คำตอบนี้โยงกับ field เฉพาะของ case นี้โดยตรง');
    task[3].forEach((w, i) => setOption(option(`d${stage}-${i}`), w[0], w[1]));
    question.dataset.fieldAwareW8W15 = mark;
  }
  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(rewrite, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
