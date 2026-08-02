/* CSAI2601 UX Quest • W3 Reason Contract v1
 * Aligns the visible W3 Reason Check with the correctness IDs already used by
 * the canonical player. The correct reason is always reason-...-0; this file
 * changes only the learner-facing wording so the displayed cognitive-UX task
 * and the assessed rationale are the same construct.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || '').trim().toUpperCase();
  if (nodeId !== 'W3') return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const VERSION = '20260802-W3-REASON-CONTRACT-V1';

  const STAGES = [
    {
      prompt:'เหตุผลใดอธิบายได้ตรงที่สุดว่าเหตุใดจึงเป็นปัญหา Cognitive UX',
      correct:'ผู้ใช้ต้องจำ เดา หรือประมวลผลมากเกินจำเป็น จึงเพิ่ม cognitive load และเสี่ยงทำ task ผิด',
      wrong:[
        'เพราะหน้าจอดูไม่ทันสมัย จึงถือว่าเป็น cognitive load',
        'เพราะทีมพัฒนาคิดว่าหน้านี้ควรแก้ก่อน',
        'เพราะระบบอื่นใช้หน้าตาแตกต่างจากระบบนี้'
      ]
    },
    {
      prompt:'เหตุผลใดแสดงว่า Task Flow ช่วยวิเคราะห์ปัญหานี้ได้จริง',
      correct:'Task Flow ทำให้เห็นลำดับ goal → action → decision → feedback และระบุตำแหน่งที่ผู้ใช้ติดหรือหลงทางได้',
      wrong:[
        'เพราะ Task Flow ทำให้หน้าจอดูสวยและเป็นระเบียบขึ้น',
        'เพราะ Task Flow ใช้แทนการเก็บหลักฐานจากผู้ใช้ได้ทั้งหมด',
        'เพราะยิ่งมีขั้นตอนมากยิ่งแสดงว่าระบบมีความสามารถสูง'
      ]
    },
    {
      prompt:'เหตุผลใดพิสูจน์ว่าองค์ประกอบนี้สร้าง Memory Burden',
      correct:'ระบบบังคับให้ผู้ใช้ recall ข้อมูลจากความจำแทนที่จะมองเห็นตัวเลือก สถานะ หรือคำแนะนำ ณ จุดตัดสินใจ',
      wrong:[
        'เพราะผู้ใช้ควรฝึกจำข้อมูลของระบบให้ได้เอง',
        'เพราะการซ่อนข้อมูลทำให้หน้าจอดูสะอาดกว่าเสมอ',
        'เพราะข้อมูลทั้งหมดควรอยู่ในคู่มือแทนหน้าจอ'
      ]
    },
    {
      prompt:'เหตุผลใดสนับสนุนแนวทาง Error Prevention ที่เลือก',
      correct:'แนวทางนี้ป้องกันความผิดพลาดก่อนเกิด ด้วย constraint, inline feedback หรือการทำให้ผลของ action ชัดเจน',
      wrong:[
        'เพราะซ่อนข้อความ error จะทำให้ผู้ใช้รู้สึกว่าระบบผิดพลาดน้อยลง',
        'เพราะให้ผู้ใช้ลองผิดลองถูกเองจะเรียนรู้ได้เร็วกว่า',
        'เพราะเพิ่มคำเตือนยาวทุกหน้าจะป้องกันข้อผิดพลาดได้เสมอ'
      ]
    },
    {
      prompt:'เหตุผลใดแสดงว่า Wireframe ที่แก้แล้วลด Cognitive Load จริง',
      correct:'แบบใหม่ลดสิ่งที่ต้องจำ จัดลำดับ action และ feedback ชัดขึ้น และสามารถตรวจด้วย task success, error และเวลาได้',
      wrong:[
        'เพราะแบบใหม่มีสีและภาพประกอบมากกว่าเดิม',
        'เพราะทีมออกแบบชอบแบบใหม่มากกว่า',
        'เพราะตัดข้อมูลออกให้มากที่สุดโดยไม่ต้องตรวจผลต่อ task'
      ]
    }
  ];

  function stageIndex() {
    const text = String(ROOT.querySelector('.hud .meter b')?.textContent || '');
    const match = text.match(/(\d+)\s*\/\s*\d+/);
    return match ? Math.max(0, Math.min(STAGES.length - 1, Number(match[1]) - 1)) : 0;
  }

  function setChoice(button, label, helper) {
    if (!button) return;
    const title = button.querySelector('b');
    const note = button.querySelector('span');
    if (title) title.textContent = label;
    if (note) note.textContent = helper;
  }

  function apply() {
    const verify = ROOT.querySelector('.verify');
    if (!verify) return false;
    const index = stageIndex();
    const contract = STAGES[index];
    if (!contract) return false;

    const mark = `${VERSION}-${index}`;
    if (verify.dataset.uxqW3ReasonContract === mark) return true;

    const prompt = verify.querySelector('p');
    if (prompt) prompt.textContent = contract.prompt;

    const buttons = Array.from(verify.querySelectorAll('[data-reason]'));
    const correct = buttons.find(button => /-0$/.test(String(button.dataset.reason || '')));
    const wrong = buttons.filter(button => button !== correct);

    setChoice(correct, contract.correct, 'เหตุผลนี้เชื่อมหลัก Cognitive UX กับพฤติกรรมและผลของ task โดยตรง');
    wrong.forEach((button, i) => {
      setChoice(button, contract.wrong[i] || contract.wrong[contract.wrong.length - 1], 'กับดัก: เหตุผลนี้ไม่พิสูจน์ผลต่อการรับรู้หรือการทำงานของผู้ใช้');
    });

    verify.dataset.uxqW3ReasonContract = mark;
    document.body.dataset.uxqW3ReasonContract = '1';
    return true;
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 20);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  new MutationObserver(schedule).observe(ROOT, { childList:true, subtree:true });

  window.UXQW3ReasonContractV1 = Object.freeze({ version:VERSION, apply });
})();
