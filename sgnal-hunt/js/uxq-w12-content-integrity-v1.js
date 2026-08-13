/* CSAI2601 UX Quest • W12 Content Integrity v3
 * PDF-aligned final content owner for W12 Interaction & Component States.
 * Canonical round order:
 *   1 State visibility -> 2 Error prevention -> 3 Actionable microcopy
 *   -> 4 Confirmation feedback -> 5 Recovery.
 *
 * IMPORTANT: Original data-choice/data-reason IDs are never changed, so scoring,
 * strict gates, analytics, and Sheet/Firebase progression remain untouched.
 */
(() => {
  'use strict';

  const qs = new URLSearchParams(location.search || '');
  const NODE = String(qs.get('node') || qs.get('id') || '').toUpperCase();
  if (NODE !== 'W12') return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

  const PACKS = {
    state: {
      prompt: 'ระหว่างระบบกำลังประมวลผล ผู้ใช้ควรเห็นสถานะใด',
      note: 'หลัก UX: ทำสถานะของระบบให้มองเห็นได้ทันเวลา เพื่อให้ผู้ใช้รู้ว่าคำสั่งถูกยอมรับแล้วและไม่ต้องเดา',
      choices: [
        'แสดงสถานะกำลังดำเนินการ และปิดคำสั่งที่ทำซ้ำได้ชั่วคราว',
        'ปล่อยปุ่มเดิมให้กดซ้ำได้จนกว่าผลลัพธ์จะปรากฏ',
        'ซ่อนสถานะทั้งหมดเพื่อให้หน้าจอดูสะอาดที่สุด',
        'เปลี่ยนสีปุ่มอย่างเดียวโดยไม่บอกว่าระบบกำลังทำอะไร'
      ],
      reasons: [
        'Feedback ที่มองเห็นได้ช่วยให้ผู้ใช้เข้าใจสถานะ ลดความไม่แน่ใจ และลดการกระทำซ้ำโดยไม่จำเป็น',
        'การให้กดซ้ำเพิ่มความเสี่ยงต่อรายการซ้ำและไม่ได้ช่วยอธิบายสถานะของระบบ',
        'การซ่อนสถานะทำให้ผู้ใช้ต้องเดาว่าระบบรับคำสั่งหรือยัง',
        'สีอย่างเดียวอาจไม่สื่อความหมายของสถานะและไม่ครอบคลุมผู้ใช้ทุกกลุ่ม'
      ]
    },
    prevention: {
      prompt: 'วิธีใดป้องกันข้อผิดพลาดก่อนเกิดปัญหาได้ตรงที่สุด',
      note: 'หลัก UX: ลดโอกาสทำสิ่งผิด พร้อมรักษาข้อมูลและเปิดทางให้ผู้ใช้แก้ได้เมื่อเกิดข้อผิดพลาด',
      choices: [
        'ปิดการส่งซ้ำระหว่างประมวลผล ตรวจข้อมูลสำคัญ และคงข้อมูลเดิมไว้หากส่งไม่สำเร็จ',
        'ล้างข้อมูลทันทีเมื่อผู้ใช้กดส่งครั้งแรก',
        'เปิดทุกคำสั่งไว้พร้อมกันเพื่อให้ผู้ใช้มีตัวเลือกมากที่สุด',
        'เพิ่มคำแนะนำยาวไว้ก่อนฟอร์ม แต่ไม่ตรวจข้อมูลหรือสถานะการส่ง'
      ],
      reasons: [
        'Error prevention ที่ดีลดโอกาสผิดตั้งแต่ต้น โดยไม่ทำให้ผู้ใช้สูญเสียงานเมื่อระบบมีปัญหา',
        'การล้างข้อมูลเพิ่มต้นทุนการกู้คืนและอาจทำให้ผู้ใช้ต้องทำงานซ้ำทั้งหมด',
        'การเปิดคำสั่งที่ขัดกันพร้อมกันเพิ่มโอกาสผิดและเพิ่มภาระการตัดสินใจ',
        'คำแนะนำอย่างเดียวไม่ทดแทน validation และ state ที่ป้องกันข้อผิดพลาดได้'
      ]
    },
    microcopy: {
      prompt: 'Microcopy ใดช่วยให้ผู้ใช้แก้ข้อผิดพลาดได้จริง',
      note: 'ข้อความควรชัด กระชับ ระบุสิ่งที่เกิดขึ้น และเสนอการกระทำที่ผู้ใช้ทำต่อได้',
      choices: [
        'ไฟล์เกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลงแล้วลองส่งอีกครั้ง',
        'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง',
        'ข้อมูลไม่ถูกต้อง โปรดตรวจสอบรายละเอียดทั้งหมด',
        'ส่งไม่สำเร็จ เนื่องจากผู้ใช้ดำเนินการไม่ถูกต้อง'
      ],
      reasons: [
        'ข้อความระบุปัญหา เงื่อนไข และวิธีแก้ที่ทำได้ทันที จึงช่วย recovery ได้จริง',
        'ข้อความกว้างไม่บอกสาเหตุหรือสิ่งที่ผู้ใช้ควรเปลี่ยน',
        'การให้ตรวจทุกอย่างโยนภาระวิเคราะห์กลับไปที่ผู้ใช้',
        'การกล่าวโทษผู้ใช้ไม่ได้ช่วยให้รู้ว่าต้องแก้อะไรหรือทำอย่างไรต่อ'
      ]
    },
    feedback: {
      prompt: 'Feedback หลังทำรายการแบบใดช่วยให้ผู้ใช้รู้ผลและขั้นตอนถัดไป',
      note: 'ผลลัพธ์ควรยืนยันสถานะ ให้หลักฐานอ้างอิงเมื่อเหมาะสม และบอก next step ที่ชัดเจน',
      choices: [
        'ยืนยันผลสำเร็จ แสดงข้อมูลอ้างอิงที่จำเป็น และบอกหรือให้ปุ่มไปขั้นตอนถัดไป',
        'ปิดหน้าต่างทันทีหลังส่งโดยไม่แสดงผลลัพธ์',
        'แสดงไอคอนถูกเพียงอย่างเดียวโดยไม่มีข้อความหรือรายละเอียด',
        'พากลับหน้าแรกทันทีโดยไม่บอกสถานะรายการ'
      ],
      reasons: [
        'ผู้ใช้ตรวจสอบได้ว่าระบบทำอะไรสำเร็จแล้ว และตัดสินใจขั้นต่อไปได้โดยไม่ต้องเดา',
        'การปิดหน้าต่างไม่ได้ยืนยันชัดว่ารายการสำเร็จหรือระบบหยุดทำงาน',
        'ไอคอนอย่างเดียวอาจคลุมเครือและไม่ให้ข้อมูลเพียงพอสำหรับงานสำคัญ',
        'การเปลี่ยนหน้าทันทีทำให้ผู้ใช้ขาดหลักฐานและความต่อเนื่องของ task'
      ]
    },
    recovery: {
      prompt: 'Recovery path ใดช่วยให้ผู้ใช้กลับไปทำงานต่อโดยเสียงานน้อยที่สุด',
      note: 'หลัก UX: เมื่อผิดพลาด ให้ผู้ใช้แก้เฉพาะจุด ลองใหม่ หรือย้อนกลับได้ โดยรักษางานที่ทำไว้เท่าที่เป็นไปได้',
      choices: [
        'คงข้อมูลเดิม ชี้จุดที่ต้องแก้ และให้ลองใหม่จากจุดนั้น',
        'ล้างแบบฟอร์มทั้งหมดแล้วให้เริ่มใหม่ตั้งแต่ต้น',
        'พากลับหน้าแรกโดยไม่บันทึกสิ่งที่กรอกไว้',
        'หยุด flow และให้ติดต่อผู้ดูแลระบบเป็นทางเลือกเดียว'
      ],
      reasons: [
        'การรักษางานเดิมและให้แก้เฉพาะจุดลดภาระซ้ำและช่วยให้ผู้ใช้ฟื้นจาก error ได้',
        'การเริ่มใหม่ทั้งหมดเพิ่มต้นทุนและความเสี่ยงที่ผู้ใช้จะเลิกทำ task',
        'การพากลับหน้าแรกทำลายบริบทและข้อมูลที่ผู้ใช้สร้างไว้',
        'การไม่มี self-recovery ทำให้ผู้ใช้พึ่งพาความช่วยเหลือแม้ในข้อผิดพลาดที่แก้เองได้'
      ]
    }
  };

  // Must match uxq-field-aware-questions-w8-w15-v1.js exactly.
  const ORDER = ['state', 'prevention', 'microcopy', 'feedback', 'recovery'];

  function roundSource() {
    return clean([
      $('.hud .meter b')?.textContent,
      $('.case .kicker')?.textContent,
      $('.case h1')?.textContent,
      $('.case > p')?.textContent
    ].join(' ')).toLowerCase();
  }

  function roundNumber() {
    const meter = clean($('.hud .meter b')?.textContent || '');
    const direct = meter.match(/^(\d+)\s*\/\s*\d+/);
    if (direct) return Number(direct[1] || 0);
    const text = roundSource();
    const m = text.match(/(?:รอบภารกิจ|progress|decision)\s*(\d+)|\b(\d+)\s*\/\s*5/);
    return Number((m && (m[1] || m[2])) || 0);
  }

  function packKey() {
    // Stage number is the canonical owner. Text matching is fallback only.
    const n = roundNumber();
    if (n >= 1 && n <= 5) return ORDER[n - 1];
    const text = roundSource();
    if (/microcopy|wording|ข้อความ/.test(text)) return 'microcopy';
    if (/feedback|success|receipt|next step|ยืนยันผล/.test(text)) return 'feedback';
    if (/recovery|recover|ทางกลับ|กู้คืน|ลองใหม่/.test(text)) return 'recovery';
    if (/prevent|double submit|dead end|ป้องกัน|กดซ้ำ/.test(text)) return 'prevention';
    return 'state';
  }

  function optionIndex(btn) {
    return Math.max(0, Array.from(btn.closest('.options')?.children || []).indexOf(btn));
  }

  function isCorrectChoice(btn) {
    return /^c\d*/i.test(String(btn.getAttribute('data-choice') || ''));
  }

  function wrongChoiceIndex(btn) {
    const id = String(btn.getAttribute('data-choice') || '');
    const m = id.match(/^d\d+-(\d+)/i);
    return m ? Number(m[1]) % 3 : Math.max(0, optionIndex(btn) - 1) % 3;
  }

  function isCorrectReason(btn) {
    const id = String(btn.getAttribute('data-reason') || '');
    return /-0$/.test(id) || /correct/i.test(id);
  }

  function wrongReasonIndex(btn) {
    const id = String(btn.getAttribute('data-reason') || '');
    const m = id.match(/-(\d+)$/);
    return m ? Math.max(0, Number(m[1]) - 1) % 3 : Math.max(0, optionIndex(btn) - 1) % 3;
  }

  function setText(btn, value) {
    const b = $('b', btn);
    const span = $('span', btn);
    if (b) {
      if (clean(b.textContent) !== value) b.textContent = value;
    } else if (clean(btn.textContent) !== value) {
      btn.textContent = value;
    }
    if (span && clean(span.textContent)) span.textContent = '';
    btn.removeAttribute('data-choice-tag');
    btn.removeAttribute('data-mechanic-label');
  }

  function applyQuestion() {
    const q = $('.question');
    if (!q || $('.feedback', q)) return;
    const p = PACKS[packKey()];
    if (!p) return;
    const prompt = $('.prompt', q);
    const instruction = $('.instruction', q);
    if (prompt && clean(prompt.textContent) !== p.prompt) prompt.textContent = p.prompt;
    if (instruction && clean(instruction.textContent) !== p.note) instruction.textContent = p.note;

    $$(':scope > .options .option[data-choice]', q).slice(0, 4).forEach(btn => {
      const value = isCorrectChoice(btn) ? p.choices[0] : p.choices[1 + wrongChoiceIndex(btn)];
      setText(btn, value);
    });
  }

  function applyReason() {
    const box = $('.verify');
    if (!box) return;
    const p = PACKS[packKey()];
    if (!p) return;
    const h = $('h3', box);
    const intro = $('p', box);
    const title = `ตรวจเหตุผล • ${p.prompt}`;
    if (h && clean(h.textContent) !== title) h.textContent = title;
    if (intro && clean(intro.textContent) !== p.note) intro.textContent = p.note;

    $$('.option[data-reason]', box).slice(0, 4).forEach(btn => {
      const value = isCorrectReason(btn) ? p.reasons[0] : p.reasons[1 + wrongReasonIndex(btn)];
      setText(btn, value);
    });
  }

  function style() {
    if ($('#uxqW12IntegrityStyleV3')) return;
    const s = document.createElement('style');
    s.id = 'uxqW12IntegrityStyleV3';
    s.textContent = `
      .question .option[data-choice],.verify .option[data-reason]{
        min-height:104px!important;max-height:none!important;overflow:visible!important;
        display:flex!important;align-items:center!important;white-space:normal!important;
      }
      .question .option[data-choice] b,.verify .option[data-reason] b{
        white-space:normal!important;overflow:visible!important;text-overflow:clip!important;
        line-height:1.42!important;font-size:.96rem!important;font-weight:800!important;
      }
      .question .option[data-choice] span,.verify .option[data-reason] span{display:none!important}
      .uxqFairnessBadge,.uxqChoiceStableBadge{display:none!important}
    `;
    document.head.appendChild(s);
  }

  function run() {
    style();
    applyQuestion();
    applyReason();
  }

  let timers = [];
  function settle() {
    timers.forEach(clearTimeout);
    timers = [0, 40, 120, 300, 700, 1300].map(ms => setTimeout(run, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle, { once:true });
  else settle();

  let observerTimer = 0;
  new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(settle, 25);
  }).observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener('click', settle, true);
  window.CSAI2601_UXQ_W12_CONTENT_INTEGRITY_V3 = Object.freeze({
    version:'20260813-W12-PDF-ALIGN-V3',
    order:Object.freeze(ORDER.slice()),
    concepts:Object.freeze(['system status visibility','error prevention','actionable microcopy','confirmation feedback','recovery'])
  });
})();
