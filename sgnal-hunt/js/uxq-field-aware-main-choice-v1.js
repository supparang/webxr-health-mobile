/* CSAI2601 UX Quest • Field-Aware Main Choices v1
 * Rewrites visible main question/options for W4-W7 according to the selected case fields.
 * Does not change correctness IDs; it only changes what students read.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();
  const content = () => window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const escText = (v) => String(v == null ? '' : v).trim();

  function currentCaseId() {
    const pill = text($('.top .pill'));
    const m = pill.match(/(W[4-7]-C\d{3}|W[4-7]-C\d{2}|W[4-7]-C\d{1})/i);
    return m ? m[1].toUpperCase() : '';
  }

  function currentStageIndex() {
    const hud = text($('.hud .meter b'));
    const m = hud.match(/^(\d+)\s*\/\s*\d+/);
    return m ? Math.max(0, Number(m[1]) - 1) : 0;
  }

  function currentCase() {
    const id = currentCaseId();
    const node = (content()?.nodes || []).find((n) => String(n.id || '').toUpperCase() === nodeId());
    return (node?.seedCases || []).find((c) => String(c.id || '').toUpperCase() === id) || null;
  }

  function setText(el, value) { if (el && value) el.textContent = value; }
  function setOption(btn, label, helper) {
    const b = $('b', btn); const span = $('span', btn);
    if (b) b.textContent = label;
    if (span) span.textContent = helper || 'คิดจากหลักฐานใน case นี้';
  }

  function optionByPrefix(prefix) {
    return $(`.options .option[data-choice^="${prefix}"]`);
  }
  function allChoiceButtons() { return $$('.question > .options .option[data-choice]'); }

  function applyW4(c, stage) {
    const tasks = [
      {
        prompt:'ควรถามคำถามวิจัยแบบใดเพื่อเข้าใจผู้ใช้จริง',
        instruction:`สถานการณ์: ${c.context} • ข้อมูลที่พบ: ${c.data || c.issue || c.friction || 'ยังมีข้อมูลผู้ใช้น้อย'} • ต้องเริ่มจากคำถามที่ไม่ชี้นำ`,
        correct:`ถามว่า “ตอนทำงานนี้ติดตรงไหน/ตัดสินใจอย่างไร” เพื่อหา pain point จากพฤติกรรมจริง`,
        wrong:[
          ['ถามว่า “ชอบหน้าจอแบบใหม่ไหม”', 'กับดัก: preference ไม่ใช่ evidence'],
          ['ถามทีมว่าคิดว่าผู้ใช้ต้องการอะไร', 'กับดัก: team assumption'],
          ['ถามนำว่า “เมนูนี้น่าจะใช้ง่ายขึ้นใช่ไหม”', 'กับดัก: leading question']
        ]
      },
      {
        prompt:'Pain point ใดควรดึงออกมาจากข้อมูลนี้',
        instruction:`สถานการณ์: ${c.context} • ข้อมูลผู้ใช้: ${c.data || c.issue || c.friction || ''}`,
        correct:`ผู้ใช้ติดเพราะ ${c.data || c.issue || c.friction || 'งานหลักไม่ลื่นไหล'} และต้องการทางไปต่อที่ชัดเจน`,
        wrong:[['สีหรือความสวยของหน้าเป็นปัญหาหลักเสมอ','กับดัก: UI-only'],['ปัญหาคือผู้ใช้ไม่ตั้งใจอ่านเอง','กับดัก: blame user'],['เลือก pain point ตามสิ่งที่ทีมแก้ง่ายที่สุด','กับดัก: team convenience']]
      },
      {
        prompt:'Persona need ที่ใช้ตัดสินใจออกแบบควรเป็นแบบใด',
        instruction:`สถานการณ์: ${c.context} • ผู้ใช้: ${c.user || 'ผู้ใช้หลักของระบบ'}`,
        correct:`ผู้ใช้ต้องการทำงานหลักให้สำเร็จเร็วขึ้น พร้อมรู้สถานะและขั้นตอนถัดไป`,
        wrong:[['ผู้ใช้ต้องการหน้าที่ดูทันสมัยที่สุด','กับดัก: aesthetic goal'],['ผู้ใช้ควรอ่านทุกอย่างก่อนใช้ระบบ','กับดัก: reader burden'],['ผู้ใช้ทุกกลุ่มมี need เหมือนกันหมด','กับดัก: one persona fits all']]
      },
      {
        prompt:'ข้อใดเป็น evidence ไม่ใช่ assumption',
        instruction:`สถานการณ์: ${c.context} • ต้องแยกข้อมูลจริงออกจากการเดาของทีม`,
        correct:`ข้อมูลจากการสังเกต/สัมภาษณ์ที่บอกว่า ${c.data || c.issue || c.friction || 'ผู้ใช้ติดใน task จริง'}`,
        wrong:[['ทีมคิดว่าผู้ใช้น่าจะชอบแบบนี้','กับดัก: assumption'],['คู่แข่งทำแบบนี้จึงต้องทำตาม','กับดัก: copy bias'],['หน้าจอดูเก่าจึงต้องเป็นปัญหาใหญ่สุด','กับดัก: visual bias']]
      },
      {
        prompt:'ควรเก็บข้อมูลต่ออย่างไรให้เอาไปออกแบบได้',
        instruction:`สถานการณ์: ${c.context} • เป้าหมายคือได้ insight ที่ใช้ตัดสินใจ`,
        correct:`ให้ผู้ใช้ทำ task จริง แล้วถามเหตุผล/สังเกตจุดติดขัดระหว่างทาง`,
        wrong:[['ส่งแบบสอบถามความชอบหน้าจออย่างเดียว','กับดัก: preference only'],['ถามเฉพาะผู้บริหาร','กับดัก: wrong user'],['อ่าน log จำนวนเข้าเว็บอย่างเดียว','กับดัก: traffic only']]
      }
    ];
    return tasks[stage] || tasks[0];
  }

  function applyW5(c, stage) {
    const tasks = [
      { prompt:'Insight ใดควรใช้ตั้งต้นการออกแบบ', instruction:`สถานการณ์: ${c.context} • Insight: ${c.insight || c.friction || ''}`, correct:`ใช้ insight ว่า ${c.insight || c.friction || 'ผู้ใช้ติดในงานหลัก'} เพราะสะท้อนพฤติกรรม/ความต้องการจริง`, wrong:[['ผู้ใช้ชอบหน้าสวย จึงควรแต่ง UI ก่อน','กับดัก: preference'],['ทีมอยากทำฟีเจอร์นี้ จึงเริ่มจากฟีเจอร์','กับดัก: solution-first'],['เลือกสิ่งที่ทำเร็วที่สุดแม้ไม่ตรงปัญหา','กับดัก: easy fix']] },
      { prompt:'Root cause ที่ควรแก้คืออะไร', instruction:`สถานการณ์: ${c.context} • Root cause: ${c.rootCause || c.friction || ''}`, correct:`แก้ที่สาเหตุหลักคือ ${c.rootCause || c.friction || 'ลำดับข้อมูล/flow ไม่ตรงกับการตัดสินใจของผู้ใช้'}`, wrong:[['แก้สีปุ่มให้สดขึ้นก่อน','กับดัก: visual-only'],['เพิ่มข้อความยาวทุกจุด','กับดัก: cognitive load'],['โยนให้ผู้ใช้อ่านคู่มือเอง','กับดัก: blame user']] },
      { prompt:'Problem statement ใดเฉพาะเจาะจงพอ', instruction:`สถานการณ์: ${c.context} • ต้องระบุ user + need + why`, correct:c.problemStatement || `ผู้ใช้ต้องการแก้ ${c.friction || c.issue || 'ปัญหาใน task'} เพื่อทำงานหลักได้สำเร็จ`, wrong:[['ระบบนี้ใช้งานยาก ควรทำให้ดีขึ้น','กับดัก: กว้างเกินไป'],['ควรทำแอปใหม่ที่สวยกว่าเดิม','กับดัก: solution-first'],['ทุกคนอยากใช้ระบบที่ง่ายและเร็ว','กับดัก: ไม่ระบุกลุ่มผู้ใช้/บริบท']] },
      { prompt:'HMW ใดเปิดทางให้คิดหลายวิธี', instruction:`สถานการณ์: ${c.context} • HMW: ${c.hmw || ''}`, correct:c.hmw || `เราจะช่วยให้ผู้ใช้ทำงานหลักสำเร็จได้ง่ายขึ้นอย่างไร`, wrong:[['เราจะเพิ่มปุ่มสีแดงตรงกลางได้อย่างไร','กับดัก: ล็อก solution'],['เราจะทำให้ผู้ใช้ชอบหน้าจอมากขึ้นอย่างไร','กับดัก: preference'],['เราจะบังคับให้ผู้ใช้อ่านคู่มือก่อนใช้ได้อย่างไร','กับดัก: เพิ่มภาระผู้ใช้']] },
      { prompt:'Concept direction ใดตรงกับ HMW และ root cause', instruction:`สถานการณ์: ${c.context} • Concept: ${c.concept || ''}`, correct:`เลือกแนวคิด ${c.concept || 'solution ที่แก้ root cause'} เพราะตอบ insight และทดสอบผลได้`, wrong:[['เลือกแนวคิดที่ดูทันสมัยที่สุด','กับดัก: style-first'],['เลือกแนวคิดที่ทีมทำง่ายแม้ไม่แก้ root cause','กับดัก: team convenience'],['เพิ่มเนื้อหาทั้งหมดในหน้าเดียว','กับดัก: information overload']] }
    ];
    return tasks[stage] || tasks[0];
  }

  function applyW6(c, stage) {
    const tasks = [
      { prompt:'ควรจัดกลุ่ม sitemap อย่างไร', instruction:`สถานการณ์: ${c.context} • Issue: ${c.issue || ''}`, correct:c.group || `จัดกลุ่มข้อมูลตาม journey และ mental model ของผู้ใช้`, wrong:[['จัดตามชื่อหน่วยงานภายในทั้งหมด','กับดัก: organization-first'],['รวมทุกเมนูไว้หน้าแรกเพื่อให้ครบ','กับดัก: no priority'],['เรียงตามตัวอักษรอย่างเดียว','กับดัก: ไม่ตอบ task']] },
      { prompt:'Navigation entry point ใดช่วยให้เริ่มงานถูกจุด', instruction:`สถานการณ์: ${c.context} • Navigation: ${c.nav || ''}`, correct:c.nav || `เริ่มจากงานที่ผู้ใช้ต้องทำ ไม่ใช่ชื่อระบบ`, wrong:[['เริ่มจากเมนูที่ทีมใช้บ่อยที่สุด','กับดัก: team view'],['เริ่มจากข่าวประชาสัมพันธ์ก่อน','กับดัก: content-first'],['ซ่อนทางเริ่มไว้ใต้เมนูเพิ่มเติม','กับดัก: hidden primary task']] },
      { prompt:'Happy path ที่เหมาะสมควรเป็นอย่างไร', instruction:`สถานการณ์: ${c.context} • Happy path: ${c.happyPath || ''}`, correct:c.happyPath || `เริ่มจากเลือกเป้าหมาย → ทำ action หลัก → ยืนยัน → เห็นสถานะ`, wrong:[['ให้กรอกข้อมูลก่อนรู้ว่าใช้ได้ไหม','กับดัก: premature form'],['ให้เปิดหลายหน้าเพื่อเปรียบเทียบเอง','กับดัก: fragmented flow'],['จบที่การส่งข้อมูลโดยไม่มีสถานะ','กับดัก: missing feedback']] },
      { prompt:'Error path ใดจำเป็นที่สุด', instruction:`สถานการณ์: ${c.context} • Error path: ${c.errorPath || ''}`, correct:c.errorPath || `เมื่อทำต่อไม่ได้ ต้องบอกเหตุผลและเสนอทางเลือกถัดไป`, wrong:[['แจ้ง error รวมท้ายหน้าโดยไม่บอกช่องผิด','กับดัก: vague error'],['ให้เริ่มใหม่ตั้งแต่ต้นทุกครั้ง','กับดัก: recovery failure'],['ซ่อนข้อผิดพลาดไว้ใน log','กับดัก: no user feedback']] },
      { prompt:'Bottleneck ใดควรแก้ก่อนใน flow', instruction:`สถานการณ์: ${c.context} • Bottleneck: ${c.bottleneck || ''}`, correct:c.bottleneck || `จุดที่ทำให้ผู้ใช้หลุดจาก flow หรือย้อนกลับหลายครั้ง`, wrong:[['จุดที่ทีมแก้ง่ายที่สุด','กับดัก: team convenience'],['จุดที่ดูไม่สวยที่สุด','กับดัก: visual bias'],['จุดที่มีคนเห็นมากที่สุดแต่ไม่กระทบ task','กับดัก: traffic bias']] }
    ];
    return tasks[stage] || tasks[0];
  }

  function applyW7(c, stage) {
    const tasks = [
      { prompt:'Visual priority ใดควรเด่นที่สุดใน wireframe', instruction:`สถานการณ์: ${c.context} • Goal: ${c.goal || ''} • Priority: ${c.priority || ''}`, correct:c.priority || `สิ่งที่พาผู้ใช้ไปสู่ action หลักต้องเด่นก่อนข้อมูลรอง`, wrong:[['รูป/banner ต้องใหญ่ที่สุดเสมอ','กับดัก: decoration-first'],['ทุกส่วนต้องเด่นเท่ากัน','กับดัก: no hierarchy'],['ข้อมูลฝ่ายงานต้องมาก่อน goal ผู้ใช้','กับดัก: organization-first']] },
      { prompt:'Layout ใดเหมาะกับ goal และ content hierarchy', instruction:`สถานการณ์: ${c.context} • Layout: ${c.layout || ''}`, correct:c.layout || `layout ที่จัดลำดับข้อมูลจากงานหลักไปข้อมูลรอง`, wrong:[['วางทุกอย่างเป็น grid เท่ากันหมด','กับดัก: flat hierarchy'],['เอาข่าว/ภาพไว้ก่อน action หลัก','กับดัก: wrong priority'],['ใช้ layout desktop เดิมบนมือถือ','กับดัก: not responsive']] },
      { prompt:'Primary CTA ควรเป็นอะไร', instruction:`สถานการณ์: ${c.context} • CTA: ${c.cta || ''}`, correct:c.cta || `ปุ่มหลักที่ทำให้ผู้ใช้ไปขั้นตอนถัดไปของ task`, wrong:[['ดูรายละเอียดเพิ่มเติม','กับดัก: weak CTA'],['แชร์หน้านี้','กับดัก: not primary task'],['อ่านข่าวทั้งหมด','กับดัก: secondary content']] },
      { prompt:'บนมือถือควรปรับ wireframe อย่างไร', instruction:`สถานการณ์: ${c.context} • Mobile: ${c.mobile || ''}`, correct:c.mobile || `เรียงสิ่งสำคัญก่อน ลดตารางกว้าง และทำ CTA แตะง่าย`, wrong:[['ย่อ desktop ทั้งหน้าให้เล็กลง','กับดัก: shrink desktop'],['ซ่อน CTA ไว้ท้ายหน้ายาว','กับดัก: hidden action'],['คงตารางกว้างให้ผู้ใช้ซูมเอง','กับดัก: mobile friction']] },
      { prompt:'กับดัก hierarchy ใดต้องหลีกเลี่ยง', instruction:`สถานการณ์: ${c.context} • Misconception: ${c.misconception || ''}`, correct:`หลีกเลี่ยง: ${c.misconception || 'ทำทุกอย่างเด่นเท่ากัน'} เพราะไม่ช่วยให้ผู้ใช้เห็น action หลัก`, wrong:[['เน้นเฉพาะความสวยโดยไม่ดู task','กับดัก: style-first'],['เลือกตามสิ่งที่ทีมอยากโชว์','กับดัก: team agenda'],['เพิ่มข้อมูลทั้งหมดเพื่อให้ครบ','กับดัก: overload']] }
    ];
    return tasks[stage] || tasks[0];
  }

  function taskFor(node, c, stage) {
    if (node === 'W4') return applyW4(c, stage);
    if (node === 'W5') return applyW5(c, stage);
    if (node === 'W6') return applyW6(c, stage);
    if (node === 'W7') return applyW7(c, stage);
    return null;
  }

  function rewrite() {
    const node = nodeId();
    if (!/^W[4-7]$/.test(node)) return;
    const question = $('.question');
    if (!question || question.dataset.fieldAwareMain === `${node}-${currentCaseId()}-${currentStageIndex()}`) return;
    if ($('.verify') || $('.feedback')) return;
    const c = currentCase();
    if (!c) return;
    const stage = currentStageIndex();
    const task = taskFor(node, c, stage);
    if (!task) return;

    setText($('.prompt', question), task.prompt);
    setText($('.instruction', question), task.instruction);
    const correct = optionByPrefix(`c${stage}`);
    if (correct) setOption(correct, task.correct, 'คำตอบนี้โยงกับ field เฉพาะของ case นี้โดยตรง');
    (task.wrong || []).forEach((item, i) => {
      const wrong = optionByPrefix(`d${stage}-${i}`);
      if (wrong) setOption(wrong, item[0], item[1]);
    });
    question.dataset.fieldAwareMain = `${node}-${currentCaseId()}-${stage}`;
  }

  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(rewrite, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
