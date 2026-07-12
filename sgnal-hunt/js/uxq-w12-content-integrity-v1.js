/* CSAI2601 UX Quest • W12 Content Integrity v1
 * Final W12-only presentation layer.
 * Restores stage-specific, balanced choices and Reason Check text while
 * preserving original data-choice/data-reason IDs for scoring and analytics.
 */
(() => {
  'use strict';

  const qs = new URLSearchParams(location.search || '');
  const node = String(qs.get('node') || qs.get('id') || '').toUpperCase();
  if (node !== 'W12') return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

  const STAGES = {
    state: {
      match: /state|loading|disabled|สถานะ|กดซ้ำ/i,
      prompt: 'State ใดควรเกิดขึ้นระหว่างที่ระบบกำลังส่งข้อมูล',
      note: 'เลือก state ที่บอกว่าระบบกำลังทำงานและป้องกันการส่งซ้ำ',
      choices: [
        'แสดง loading และปิดปุ่มส่งชั่วคราว',
        'ปล่อยปุ่มส่งให้กดได้ตามเดิม',
        'ซ่อนสถานะจนกว่าระบบจะเสร็จ',
        'เปลี่ยนสีปุ่มโดยไม่บอกความหมาย'
      ],
      reasons: [
        'ช่วยยืนยันว่าระบบรับคำสั่งแล้วและกันการส่งซ้ำ',
        'ผู้ใช้ควรกดซ้ำได้เพื่อเพิ่มความมั่นใจ',
        'การไม่แสดงสถานะทำให้หน้าจอดูสะอาดกว่า',
        'สีที่เปลี่ยนเพียงอย่างเดียวบอกสถานะได้ครบ'
      ]
    },
    feedback: {
      match: /feedback|success|receipt|ผลลัพธ์|ยืนยัน/i,
      prompt: 'Feedback ใดช่วยให้ผู้ใช้รู้ว่ารายการเสร็จสมบูรณ์',
      note: 'บอกผลลัพธ์ที่เกิดขึ้น พร้อมหลักฐานและขั้นตอนถัดไป',
      choices: [
        'แสดงผลสำเร็จ เลขอ้างอิง และทางไปต่อ',
        'ปิดหน้าต่างทันทีโดยไม่แสดงข้อความ',
        'แสดงเพียงไอคอนถูกโดยไม่มีรายละเอียด',
        'พากลับหน้าแรกโดยไม่บอกผลรายการ'
      ],
      reasons: [
        'ผู้ใช้ตรวจผลย้อนหลังได้และรู้ว่าควรทำอะไรต่อ',
        'หน้าต่างที่หายไปแปลว่าระบบทำงานสำเร็จแล้ว',
        'ไอคอนเดียวเพียงพอสำหรับทุกสถานการณ์',
        'กลับหน้าแรกเร็วช่วยลดขั้นตอนของระบบ'
      ]
    },
    microcopy: {
      match: /microcopy|wording|ข้อความ|error message/i,
      prompt: 'Microcopy ใดช่วยให้ผู้ใช้แก้ข้อผิดพลาดได้ตรงจุด',
      note: 'ข้อความควรบอกสิ่งที่ผิดและวิธีแก้ โดยไม่กล่าวโทษผู้ใช้',
      choices: [
        'ไฟล์เกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลง',
        'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง',
        'ข้อมูลไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง',
        'คำขอล้มเหลว เนื่องจากผู้ใช้ทำไม่ถูกต้อง'
      ],
      reasons: [
        'ระบุสาเหตุและวิธีแก้ที่ผู้ใช้ลงมือทำได้ทันที',
        'ข้อความกว้างใช้ซ้ำได้จึงเหมาะกับทุก error',
        'การให้ผู้ใช้ตรวจเองช่วยลดงานเขียนข้อความ',
        'การระบุว่าผู้ใช้ผิดทำให้สาเหตุชัดเจนที่สุด'
      ]
    },
    recovery: {
      match: /recovery|ลองใหม่|แก้ไข|ทางกลับ|กู้คืน/i,
      prompt: 'Recovery path ใดช่วยให้ผู้ใช้ไปต่อโดยไม่เริ่มใหม่ทั้งหมด',
      note: 'รักษาข้อมูลที่กรอกไว้และให้แก้เฉพาะจุดที่เกิดปัญหา',
      choices: [
        'เก็บข้อมูลเดิมไว้และให้แก้เฉพาะช่องที่ผิด',
        'ล้างแบบฟอร์มทั้งหมดแล้วให้กรอกใหม่',
        'พากลับหน้าแรกโดยไม่เก็บข้อมูลเดิม',
        'ปิดหน้าต่างและให้ผู้ใช้ลองภายหลัง'
      ],
      reasons: [
        'ลดงานซ้ำและช่วยให้ผู้ใช้ฟื้นจาก error ได้ต่อเนื่อง',
        'เริ่มใหม่ทั้งหมดทำให้ข้อมูลสะอาดและปลอดภัยกว่า',
        'กลับหน้าแรกช่วยให้ผู้ใช้เลือกเส้นทางใหม่เอง',
        'ปิดหน้าต่างช่วยหยุดความผิดพลาดไม่ให้ลุกลาม'
      ]
    },
    prevention: {
      match: /prevention|prevent|ป้องกัน|ก่อนเกิด/i,
      prompt: 'แนวทางใดช่วยป้องกันข้อผิดพลาดก่อนที่ผู้ใช้จะส่งข้อมูล',
      note: 'ป้องกันด้วยข้อจำกัดและ feedback ใกล้จุดที่ผู้ใช้ตัดสินใจ',
      choices: [
        'ตรวจข้อมูลทันทีและปิดคำสั่งที่ยังใช้ไม่ได้',
        'รอให้ส่งก่อนแล้วค่อยแสดงข้อผิดพลาดรวม',
        'เพิ่มคู่มือยาวไว้ด้านล่างของหน้า',
        'เปิดทุกคำสั่งไว้เพื่อให้ผู้ใช้มีทางเลือก'
      ],
      reasons: [
        'ผู้ใช้แก้ได้ก่อนส่งและไม่ต้องย้อนกลับหลายขั้น',
        'รวม error หลังส่งช่วยให้ระบบตรวจเพียงครั้งเดียว',
        'คู่มือที่ยาวทำให้ครอบคลุมข้อผิดพลาดทุกแบบ',
        'คำสั่งที่เปิดทั้งหมดทำให้ผู้ใช้ควบคุมระบบได้มากขึ้น'
      ]
    }
  };

  const FALLBACK = STAGES.feedback;

  function contextText(scope = document) {
    return clean([
      $('.hud .meter b')?.textContent,
      $('.case .kicker')?.textContent,
      $('.case h1')?.textContent,
      $('.case p')?.textContent,
      $('.question .prompt')?.textContent,
      $('.question .instruction')?.textContent,
      scope?.textContent
    ].join(' '));
  }

  function stage(scope = document) {
    const text = contextText(scope);
    return Object.values(STAGES).find(s => s.match.test(text)) || FALLBACK;
  }

  function optionIndex(btn) {
    return Math.max(0, Array.from(btn.closest('.options')?.children || []).indexOf(btn));
  }

  function isCorrectChoice(btn) {
    return /^c\d*/i.test(String(btn.dataset.choice || btn.getAttribute('data-choice') || ''));
  }

  function wrongChoiceIndex(btn) {
    const id = String(btn.dataset.choice || btn.getAttribute('data-choice') || '');
    const m = id.match(/^d\d+-(\d+)/i);
    return m ? Number(m[1]) % 3 : Math.max(0, optionIndex(btn) - 1) % 3;
  }

  function isCorrectReason(btn) {
    return /-0$/.test(String(btn.dataset.reason || btn.getAttribute('data-reason') || ''));
  }

  function wrongReasonIndex(btn) {
    const id = String(btn.dataset.reason || btn.getAttribute('data-reason') || '');
    const m = id.match(/-(\d+)$/);
    return m ? Math.max(0, Number(m[1]) - 1) % 3 : Math.max(0, optionIndex(btn) - 1) % 3;
  }

  function writeButton(btn, text) {
    const b = $('b', btn);
    const span = $('span', btn);
    if (b) b.textContent = text;
    else btn.textContent = text;
    if (span) span.textContent = '';
    btn.removeAttribute('data-choice-tag');
    btn.removeAttribute('data-mechanic-label');
  }

  function applyQuestion() {
    const q = $('.question');
    if (!q || $('.feedback', q) || $('.verify', q)) return;
    const s = stage(q);
    const key = `${s.prompt}|${$$('[data-choice]', q).map(b => b.dataset.choice).join(',')}`;
    if (q.dataset.w12Integrity === key) return;

    const prompt = $('.prompt', q);
    const instruction = $('.instruction', q);
    if (prompt) prompt.textContent = s.prompt;
    if (instruction) instruction.textContent = s.note;

    const buttons = $$('[data-choice]', q).filter(b => b.offsetParent !== null).slice(0, 4);
    buttons.forEach(btn => {
      const label = isCorrectChoice(btn) ? s.choices[0] : s.choices[1 + wrongChoiceIndex(btn)];
      writeButton(btn, label);
    });
    q.dataset.w12Integrity = key;
  }

  function applyReason() {
    const box = $('.verify');
    if (!box) return;
    const s = stage(box);
    const key = `${s.prompt}|${$$('[data-reason]', box).map(b => b.dataset.reason).join(',')}`;
    if (box.dataset.w12Integrity === key) return;

    const h = $('h3', box);
    const p = $('p', box);
    if (h) h.textContent = 'ตรวจเหตุผลจากสถานการณ์นี้';
    if (p) p.textContent = `เหตุผลใดสนับสนุนคำตอบเรื่อง “${s.prompt}” ได้ตรงที่สุด`;

    const buttons = $$('[data-reason]', box).filter(b => b.offsetParent !== null).slice(0, 4);
    buttons.forEach(btn => {
      const label = isCorrectReason(btn) ? s.reasons[0] : s.reasons[1 + wrongReasonIndex(btn)];
      writeButton(btn, label);
    });
    box.dataset.w12Integrity = key;
  }

  function style() {
    if ($('#uxqW12IntegrityStyle')) return;
    const el = document.createElement('style');
    el.id = 'uxqW12IntegrityStyle';
    el.textContent = `
      .question .option[data-choice], .verify .option[data-reason]{
        min-height:96px!important;max-height:none!important;overflow:visible!important;
        display:flex!important;align-items:center!important;white-space:normal!important;
      }
      .question .option[data-choice] b, .verify .option[data-reason] b{
        white-space:normal!important;overflow:visible!important;text-overflow:clip!important;
        line-height:1.45!important;font-size:.96rem!important;
      }
      .question .option[data-choice] span, .verify .option[data-reason] span{display:none!important}
      .uxqFairnessBadge,.uxqChoiceStableBadge{display:none!important}
    `;
    document.head.appendChild(el);
  }

  function run() {
    style();
    applyQuestion();
    applyReason();
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('click', () => setTimeout(run, 50), true);
})();