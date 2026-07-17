/* CSAI2601 UX Quest • W1 Final Content Integrity Authority v1.1
 * Final visible-content authority for W1 only.
 * Preserves answer IDs/correctness and rewrites only learner-facing text.
 * Uses idempotent DOM writes to prevent MutationObserver feedback loops.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const node = String(params.get('node') || params.get('id') || 'W1').toUpperCase();
  if (node !== 'W1') return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const setText = (element, value) => {
    if (!element) return false;
    const wanted = String(value == null ? '' : value);
    if (element.textContent === wanted) return false;
    element.textContent = wanted;
    return true;
  };

  const STAGES = {
    1: {
      prompt: '🔎 เลือกหลักฐานที่ชี้จุดติดขัดหลักของผู้ใช้',
      instruction: 'พิจารณาว่าข้อใดระบุอุปสรรคที่ทำให้งานหลักของผู้ใช้สะดุด ไม่ใช่เพียงความเห็นเรื่องหน้าตา',
      hint: 'มองหาพฤติกรรมที่หยุด ย้อนกลับ สับสน หรือทำงานต่อไม่ได้',
      choices: {
        correct: 'เลือกจุดที่ผู้ใช้หยุด สับสน หรือย้อนกลับระหว่างทำงานหลัก',
        wrong: [
          'ปรับสีและภาพให้เด่นขึ้นก่อน เพราะหน้าดูไม่ทันสมัย',
          'เลือกจุดที่ทีมพูดถึงบ่อยที่สุดเป็นปัญหาหลัก',
          'เลือกจุดที่แก้ได้เร็วที่สุดเพื่อให้ทีมส่งงานทัน'
        ]
      },
      reasonQuestion: 'เหตุผลใดพิสูจน์ว่านี่คือ friction หลัก',
      reasons: {
        correct: 'มีหลักฐานว่าผู้ใช้ติดในขั้นตอนสำคัญจนงานหลักเดินต่อไม่ได้',
        wrong: [
          'หน้าจอดูเก่า จึงควรเป็นปัญหาหลัก',
          'ทีมคาดว่าจุดนี้น่าจะมีปัญหามากที่สุด',
          'ระบบอื่นออกแบบต่างออกไป จึงแปลว่าหน้านี้ผิด'
        ]
      }
    },
    2: {
      prompt: '🎯 เลือกเป้าหมายหลักที่ผู้ใช้ต้องทำให้สำเร็จ',
      instruction: 'เป้าหมายต้องบอกผลลัพธ์ของงานและสิ่งที่ผู้ใช้ต้องรู้เพื่อดำเนินขั้นตอนต่อไป',
      hint: 'ถามว่า เมื่อจบรอบนี้ ผู้ใช้ต้องทำอะไรสำเร็จและรู้ next step ใด',
      choices: {
        correct: 'กำหนดผลลัพธ์ของงานที่ผู้ใช้ต้องทำสำเร็จ พร้อมเงื่อนไขว่าต้องรู้อะไรต่อ',
        wrong: [
          'กำหนดสิ่งที่ผู้ใช้น่าจะชอบมากที่สุดจากหน้าตา',
          'เลือกข้อมูลที่มีจำนวนมากที่สุดบนหน้าเป็นเป้าหมายหลัก',
          'รวมทุกเป้าหมายให้สำคัญเท่ากันเพื่อไม่ต้องจัดลำดับ'
        ]
      },
      reasonQuestion: 'เหตุผลใดแสดงว่าเป้าหมายนี้เป็น user goal จริง',
      reasons: {
        correct: 'เป้าหมายผูกกับ task outcome ที่ผู้ใช้ต้องทำให้สำเร็จในสถานการณ์นี้',
        wrong: [
          'เป็นสิ่งที่ผู้ใช้น่าจะชอบมากที่สุด',
          'เป็นข้อมูลที่ปรากฏบนหน้าจอมากที่สุด',
          'การรวมทุกอย่างไว้หน้าแรกจะครอบคลุมกว่า'
        ]
      }
    },
    3: {
      prompt: '🧭 เลือกกรอบปัญหา UI, UX หรือ Feedback ให้ตรงชั้น',
      instruction: 'แยกปัญหาการมองเห็นและลำดับภาพ ออกจาก flow ของงานและการตอบกลับของระบบ',
      hint: 'UI = มองเห็นและลำดับภาพ • UX = task สำเร็จหรือไม่ • Feedback = ระบบตอบกลับชัดหรือไม่',
      choices: {
        correct: 'แยกว่าปัญหาอยู่ที่การมองเห็นและลำดับภาพ, flow ของงาน หรือ feedback ของระบบ แล้วแก้ให้ตรงชั้น',
        wrong: [
          'รวมปัญหาทั้งหมดเป็น UI เพื่อให้ทีมใช้มาตรฐานเดียวกัน',
          'เริ่มแก้ performance เพราะเวลาตอบสนองที่ดีอาจลดความสับสน',
          'เริ่มจากความสวยงาม เพราะรูปแบบที่ดีช่วยลดภาระเรียนรู้'
        ]
      },
      reasonQuestion: 'เหตุผลใดอธิบายการจัดชั้นปัญหาได้ถูกต้อง',
      reasons: {
        correct: 'การแยกชั้นทำให้เลือกวิธีแก้ตรงกับสาเหตุที่ทำให้ task ล้มเหลว',
        wrong: [
          'ทุกปัญหาบนหน้าจอควรจัดเป็น UI ทั้งหมด',
          'ถ้าโค้ดเร็วขึ้น ผู้ใช้จะเข้าใจเอง',
          'UX เป็นเรื่องกว้าง จึงไม่จำเป็นต้องแยกประเภท'
        ]
      }
    },
    4: {
      prompt: '🛠️ เลือกแนวทางแก้ที่สัมพันธ์กับ friction หลัก',
      instruction: 'แนวทางแก้ต้องลดจุดติดขัดโดยตรง ไม่เพิ่มภาระใหม่ และสามารถตรวจผลหลังปรับได้',
      hint: 'เชื่อมให้ครบ: evidence → friction → design decision → expected improvement',
      choices: {
        correct: 'วางข้อมูลที่ใช้ตัดสินใจไว้ใกล้ action หลัก พร้อม feedback ชัดเจนเพื่อลดการย้อนหาระหว่างงาน',
        wrong: [
          'แบ่งข้อมูลเป็นหลายชั้นเพื่อให้แต่ละหน้าสั้น แม้ผู้ใช้ต้องสลับหน้าบ่อย',
          'คงโครงเดิมแล้วเพิ่มคำอธิบายทุกจุดที่ผู้ใช้เคยลังเล',
          'แสดงภาพรวมก่อน แล้วซ่อนรายละเอียดไว้จนผู้ใช้พร้อมตัดสินใจ'
        ]
      },
      reasonQuestion: 'เหตุผลใดยืนยันว่าแนวทางแก้นี้ตรงกับ friction',
      reasons: {
        correct: 'ลดจุดติดขัดหลักและกำหนดผลที่ตรวจสอบหลังปรับได้',
        wrong: [
          'ทำให้หน้าดูสวยและทันสมัยขึ้น',
          'ทีมทำได้เร็วและกระทบระบบเดิมน้อย',
          'เพิ่มคำอธิบายมากขึ้นจึงน่าจะช่วยผู้ใช้ได้'
        ]
      }
    },
    5: {
      prompt: '🧪 เลือกวิธีทดสอบที่พิสูจน์ว่า UX ดีขึ้นจริง',
      instruction: 'ใช้ task เดิมเปรียบเทียบก่อน–หลัง และวัดพฤติกรรมที่สัมพันธ์กับ friction โดยตรง',
      hint: 'วัด task success, เวลา, error และความเข้าใจ next step ก่อน–หลัง',
      choices: {
        correct: 'ให้ผู้ใช้ทำ task เดิมก่อน–หลังการปรับ แล้ววัด task success, เวลา, error และความเข้าใจขั้นตอนถัดไป',
        wrong: [
          'ถามทีมออกแบบว่าหน้าใหม่ดูดีขึ้นหรือไม่',
          'วัดจำนวนคนเปิดหน้าเว็บหลังเปลี่ยนดีไซน์เพียงอย่างเดียว',
          'ให้ผู้ใช้เลือกภาพหน้าจอที่ชอบมากที่สุดโดยไม่ทำ task'
        ]
      },
      reasonQuestion: 'เหตุผลใดแสดงว่าวิธีทดสอบนี้พิสูจน์ UX ได้จริง',
      reasons: {
        correct: 'วัด user outcome ที่สัมพันธ์กับ friction และเปรียบเทียบผลก่อน–หลังได้',
        wrong: [
          'ทีมออกแบบเห็นว่าหน้าใหม่ดูดีขึ้น',
          'จำนวนผู้เข้าชมเพิ่มขึ้นหลังปรับหน้า',
          'ผู้ใช้บอกว่าชอบดีไซน์ใหม่มากกว่า'
        ]
      }
    }
  };

  function stageNumber() {
    const hud = clean($('.hud .meter b'));
    const title = clean($('.case h1'));
    const match = `${hud} ${title}`.match(/(?:^|\s)([1-5])\s*\/\s*5|(?:ข้อ|รอบภารกิจ|รอบบอส)\s*([1-5])/i);
    return Math.max(1, Math.min(5, Number(match && (match[1] || match[2]) || 1)));
  }

  function optionIndexFromId(id) {
    const match = String(id || '').match(/^d([0-4])-(\d+)$/i);
    return match ? Number(match[2]) : -1;
  }

  function applyMainChoices(stageNo, stage, question) {
    const main = question.querySelector('.options');
    if (!main) return;
    $$('.option[data-choice]', main).forEach(button => {
      const id = String(button.dataset.choice || '');
      const label = $('b', button);
      if (!label) return;
      if (id === `c${stageNo - 1}`) {
        setText(label, stage.choices.correct);
      } else {
        const index = optionIndexFromId(id);
        if (index >= 0 && stage.choices.wrong[index]) setText(label, stage.choices.wrong[index]);
      }
      $$(':scope > span,:scope > small,:scope > p', button).forEach(el => el.remove());
    });
  }

  function applyReasonChoices(stage, verify) {
    if (!verify) return;
    const question = $(':scope > p', verify);
    setText(question, stage.reasonQuestion);
    $$('.option[data-reason]', verify).forEach(button => {
      const id = String(button.dataset.reason || '');
      const label = $('b', button);
      if (!label) return;
      const match = id.match(/reason-w1-stage-[1-5]-(\d+)$/i);
      const index = match ? Number(match[1]) : -1;
      if (index === 0) setText(label, stage.reasons.correct);
      else if (index > 0 && stage.reasons.wrong[index - 1]) setText(label, stage.reasons.wrong[index - 1]);
      $$(':scope > span,:scope > small,:scope > p', button).forEach(el => el.remove());
    });
  }

  function normalizeHint(stage) {
    setText($('.hint'), `คำใบ้ระดับ 1: ${stage.hint}`);
  }

  function apply() {
    const question = $('.question');
    if (!question) return;
    const number = stageNumber();
    const stage = STAGES[number];
    if (!stage) return;

    setText($(':scope > .prompt', question), stage.prompt);
    setText($(':scope > .instruction', question), stage.instruction);
    applyMainChoices(number, stage, question);
    applyReasonChoices(stage, $('.verify', question));
    normalizeHint(stage);

    const marker = `stage-${number}`;
    if (question.dataset.w1ContentIntegrity !== marker) question.dataset.w1ContentIntegrity = marker;
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 40);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode') || document.body, { childList: true, subtree: true });

  window.UXQW1ContentIntegrityFinal = Object.freeze({ version: 'v1.1', apply });
})();