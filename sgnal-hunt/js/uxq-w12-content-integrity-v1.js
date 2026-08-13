/* CSAI2601 UX Quest • W12 Content Integrity v4
 * Canonical owner for W12 Interaction Design, Micro-interactions & Content.
 * Canonical round order:
 *   1 Trigger/Rule -> 2 Feedback -> 3 Prevention -> 4 Microcopy -> 5 Recovery
 *
 * Original data-choice/data-reason IDs are never changed, so correctness,
 * scoring, analytics, progress and Sheet/Firebase writes remain untouched.
 */
(() => {
  'use strict';
  const qs = new URLSearchParams(location.search || '');
  const NODE = String(qs.get('node') || qs.get('id') || '').toUpperCase();
  if (NODE !== 'W12') return;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clean = v => String(v == null ? '' : v).replace(/\s+/g,' ').trim();

  const PACKS = Object.freeze({
    trigger:{
      prompt:'Trigger และ Rule ของ interaction นี้ควรกำหนดอย่างไร',
      note:'เริ่มจากสิ่งที่ผู้ใช้ทำ (trigger) แล้วกำหนดกฎ/behavior ที่ระบบต้องตอบสนองอย่างชัดเจน',
      choices:[
        'ระบุ trigger จาก action ของผู้ใช้ แล้วกำหนด rule ว่าระบบจะเปลี่ยน state/ทำอะไรต่อ',
        'เริ่มจาก animation ที่ดูน่าสนใจแล้วค่อยหาว่าจะใช้เมื่อใด',
        'ใช้ action เดียวให้ทุกสถานการณ์แม้ผลลัพธ์ต่างกัน',
        'ซ่อนกฎการทำงานไว้และให้ผู้ใช้เรียนรู้จากการลองผิดลองถูก'
      ],
      reasons:[
        'Interaction ที่ดีเชื่อม Trigger → Rule → Result จึงคาดเดาพฤติกรรมระบบและทดสอบได้',
        'Animation เป็นผลทางภาพ ไม่ใช่จุดตั้งต้นของ interaction logic',
        'สถานการณ์ต่างกันอาจต้อง rule/state ต่างกันเพื่อหลีกเลี่ยงความสับสน',
        'การให้ผู้ใช้เดากฎเพิ่ม cognitive burden และ error'
      ]
    },
    feedback:{
      prompt:'Feedback แบบใดควรเกิดหลัง action นี้',
      note:'Feedback ต้องเกิดทันเวลา มองเห็นได้ และบอกสถานะ/ผลลัพธ์ที่ผู้ใช้ใช้ตัดสินใจขั้นต่อไปได้',
      choices:[
        'แสดงสถานะที่ตรงกับ action เช่น กำลังดำเนินการ/สำเร็จ/ไม่สำเร็จ พร้อม next step เมื่อจำเป็น',
        'ไม่แสดงอะไรจนกว่าระบบทำงานเสร็จทั้งหมด',
        'เปลี่ยนสีเพียงอย่างเดียวโดยไม่บอกความหมาย',
        'แสดง animation ยาวเพื่อยืนยันว่าระบบทันสมัย'
      ],
      reasons:[
        'Timely feedback ทำให้ผู้ใช้รู้ว่าระบบรับ action แล้ว ลดความไม่แน่ใจและการทำซ้ำ',
        'การเงียบระหว่างทำงานทำให้ผู้ใช้เดาสถานะและอาจกดซ้ำ',
        'สีอย่างเดียวอาจตีความไม่ตรงและไม่ครอบคลุม accessibility',
        'Motion ควรมีหน้าที่สื่อ behavior ไม่ใช่เพิ่มเวลารอโดยไม่มีข้อมูล'
      ]
    },
    prevention:{
      prompt:'วิธีใดป้องกัน duplicate action หรือ error ได้ตรงที่สุด',
      note:'ป้องกันข้อผิดพลาดก่อนเกิด โดยไม่ทำให้ผู้ใช้สูญเสียข้อมูลหรือทางไปต่อ',
      choices:[
        'ปิด action ที่ทำซ้ำได้ระหว่างประมวลผล ตรวจข้อมูลสำคัญ และรักษาข้อมูลเดิมหากเกิด error',
        'ปล่อยให้กดซ้ำได้เพื่อให้ผู้ใช้มั่นใจว่าระบบรับคำสั่ง',
        'ล้างข้อมูลทันทีเมื่อเริ่มส่งเพื่อป้องกันข้อมูลเก่า',
        'เพิ่มคำอธิบายยาว ๆ แต่ไม่เปลี่ยน state หรือ validation'
      ],
      reasons:[
        'Error prevention ลดโอกาสผิดตั้งแต่ต้นและยังรักษาความต่อเนื่องของ task',
        'การกดซ้ำเพิ่มความเสี่ยงต่อรายการซ้ำ',
        'การล้างข้อมูลทำให้ recovery แพงและเพิ่มงานซ้ำ',
        'คำอธิบายอย่างเดียวไม่ทดแทน state/validation ที่ป้องกัน error'
      ]
    },
    microcopy:{
      prompt:'Microcopy ใดช่วยให้ผู้ใช้เข้าใจและแก้ปัญหาได้จริง',
      note:'ข้อความควรกระชับ บอกสิ่งที่เกิดขึ้น และเสนอ action ที่ทำต่อได้',
      choices:[
        '“ไฟล์เกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลงแล้วลองส่งอีกครั้ง”',
        '“เกิดข้อผิดพลาด”',
        '“ข้อมูลไม่ถูกต้อง โปรดตรวจสอบทุกอย่าง”',
        '“ส่งไม่สำเร็จเพราะผู้ใช้ดำเนินการผิด”'
      ],
      reasons:[
        'ข้อความระบุปัญหา เงื่อนไข และวิธีแก้ที่ผู้ใช้ลงมือทำได้ทันที',
        'ข้อความกว้างไม่บอกสาเหตุหรือ next action',
        'การให้ตรวจทุกอย่างโยนภาระวิเคราะห์กลับไปที่ผู้ใช้',
        'การกล่าวโทษผู้ใช้ไม่ช่วย recovery'
      ]
    },
    recovery:{
      prompt:'Recovery path ใดช่วยให้ผู้ใช้กลับไปทำ task ต่อได้',
      note:'รักษางานที่ทำไว้ ให้แก้เฉพาะจุด และมี retry/alternative path ที่ชัดเจน',
      choices:[
        'คงข้อมูลเดิม ชี้จุดที่ต้องแก้ และให้ลองใหม่จากจุดนั้นโดยไม่เริ่มใหม่ทั้งหมด',
        'ล้างข้อมูลทั้งหมดแล้วให้เริ่มใหม่',
        'พากลับหน้าแรกโดยไม่บอกว่าเกิดอะไรขึ้น',
        'ให้ติดต่อผู้ดูแลระบบเป็นทางเลือกเดียว'
      ],
      reasons:[
        'Recovery ที่ดีลดงานซ้ำ รักษาบริบท และช่วยให้ผู้ใช้กลับสู่ task ได้เร็ว',
        'การเริ่มใหม่เพิ่ม cost และ frustration โดยไม่จำเป็น',
        'การกลับหน้าแรกทำให้สูญเสีย context และไม่แก้ปัญหาเดิม',
        'การพึ่งผู้ดูแลเพียงอย่างเดียวไม่ใช่ self-recovery สำหรับ error ที่แก้ได้'
      ]
    }
  });

  const ORDER = ['trigger','feedback','prevention','microcopy','recovery'];

  function stageIndex() {
    const meter = clean($('.hud .meter b')?.textContent || '');
    const m = meter.match(/(\d+)\s*\/\s*5/);
    return Math.max(0, Math.min(4, Number(m?.[1] || 1) - 1));
  }
  const pack = () => PACKS[ORDER[stageIndex()]] || PACKS.trigger;
  const isCorrectChoice = btn => /^c\d*/i.test(String(btn.getAttribute('data-choice') || ''));
  const wrongChoiceIndex = btn => {
    const m = String(btn.getAttribute('data-choice') || '').match(/^d\d+-(\d+)/i);
    return m ? Number(m[1]) % 3 : 0;
  };
  const isCorrectReason = btn => {
    const id = String(btn.getAttribute('data-reason') || '');
    return /-0$/.test(id) || /correct/i.test(id);
  };
  const wrongReasonIndex = btn => {
    const m = String(btn.getAttribute('data-reason') || '').match(/-(\d+)$/);
    return m ? Math.max(0, Number(m[1]) - 1) % 3 : 0;
  };
  function setOption(btn, value) {
    const b = $('b',btn), span = $('span',btn);
    if (b && clean(b.textContent) !== value) b.textContent = value;
    else if (!b && clean(btn.textContent) !== value) btn.textContent = value;
    if (span && clean(span.textContent)) span.textContent = '';
  }
  function applyQuestion() {
    const q = $('.question');
    if (!q || $('.feedback',q)) return;
    const p = pack();
    const prompt = $('.prompt',q), instruction = $('.instruction',q);
    if (prompt && clean(prompt.textContent) !== p.prompt) prompt.textContent = p.prompt;
    if (instruction && clean(instruction.textContent) !== p.note) instruction.textContent = p.note;
    $$(':scope > .options .option[data-choice]',q).slice(0,4).forEach(btn => {
      setOption(btn, isCorrectChoice(btn) ? p.choices[0] : p.choices[1 + wrongChoiceIndex(btn)]);
    });
  }
  function applyReason() {
    const box = $('.verify');
    if (!box) return;
    const p = pack();
    const h = $('h3',box), intro = $('p',box);
    if (h) h.textContent = `Reason Check • ${p.prompt}`;
    if (intro) intro.textContent = p.note;
    $$('.option[data-reason]',box).slice(0,4).forEach(btn => {
      setOption(btn, isCorrectReason(btn) ? p.reasons[0] : p.reasons[1 + wrongReasonIndex(btn)]);
    });
  }
  function run(){ applyQuestion(); applyReason(); }
  let timer=0;
  function settle(){ clearTimeout(timer); timer=setTimeout(run,20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle,{once:true}); else settle();
  new MutationObserver(settle).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',settle,true);
  window.CSAI2601_UXQ_W12_CANONICAL_ORDER = Object.freeze(ORDER.slice());
})();