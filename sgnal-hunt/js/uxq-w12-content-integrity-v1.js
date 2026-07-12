/* CSAI2601 UX Quest • W12 Content Integrity v2
 * Final W12-only content owner.
 * Uses the visible round title/progress—not rewritten option text—to select
 * stage-specific choices and Reason Check text. Original data IDs remain
 * untouched for scoring, strict gate, analytics, and Sheet sync.
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
      prompt: 'ระหว่างระบบกำลังส่งข้อมูล ควรแสดงสถานะใด',
      note: 'เลือกสถานะที่ยืนยันว่าระบบรับคำสั่งแล้วและป้องกันการกดซ้ำ',
      choices: [
        'แสดงกำลังส่งและปิดปุ่มส่งไว้ชั่วคราว',
        'ปล่อยปุ่มส่งให้กดซ้ำได้จนกว่าจะสำเร็จ',
        'ซ่อนสถานะทั้งหมดเพื่อให้หน้าจอดูสะอาด',
        'เปลี่ยนสีปุ่มอย่างเดียวโดยไม่บอกความหมาย'
      ],
      reasons: [
        'ผู้ใช้รู้ว่าระบบกำลังทำงานและไม่สร้างรายการซ้ำ',
        'การกดซ้ำช่วยยืนยันว่าระบบได้รับคำสั่งแน่นอน',
        'การซ่อนสถานะช่วยลดข้อมูลที่รบกวนผู้ใช้',
        'สีที่เปลี่ยนเพียงอย่างเดียวสื่อสถานะได้ครบ'
      ]
    },
    prevention: {
      prompt: 'วิธีใดป้องกันการส่งซ้ำหรือทางตันได้ตรงจุด',
      note: 'ป้องกันก่อนเกิดปัญหา โดยยังคงบอกสถานะและทางไปต่ออย่างชัดเจน',
      choices: [
        'ปิดปุ่มระหว่างส่งและคงข้อมูลไว้หากส่งไม่สำเร็จ',
        'ล้างข้อมูลทันทีเมื่อผู้ใช้กดปุ่มส่งครั้งแรก',
        'เปิดปุ่มทุกคำสั่งไว้เพื่อให้ผู้ใช้เลือกได้มากขึ้น',
        'แสดงคำแนะนำยาวก่อนฟอร์มโดยไม่ตรวจข้อมูล'
      ],
      reasons: [
        'ลดรายการซ้ำและยังเปิดทางให้แก้ไขเมื่อเกิดข้อผิดพลาด',
        'การล้างข้อมูลทันทีทำให้ระบบเริ่มต้นใหม่ได้สะอาด',
        'การเปิดทุกคำสั่งช่วยให้ผู้ใช้ควบคุมระบบได้มากขึ้น',
        'คำแนะนำยาวช่วยป้องกันข้อผิดพลาดได้ทุกกรณี'
      ]
    },
    microcopy: {
      prompt: 'Microcopy ใดช่วยให้ผู้ใช้แก้ข้อผิดพลาดได้ทันที',
      note: 'ข้อความควรบอกสิ่งที่ผิด สาเหตุที่เกี่ยวข้อง และวิธีแก้ที่ทำได้',
      choices: [
        'ไฟล์เกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลง',
        'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งภายหลัง',
        'ข้อมูลไม่ถูกต้อง โปรดตรวจสอบรายละเอียดทั้งหมด',
        'ส่งไม่สำเร็จ เพราะผู้ใช้ดำเนินการไม่ถูกต้อง'
      ],
      reasons: [
        'ระบุปัญหาและแนวแก้ที่ผู้ใช้ลงมือทำได้ทันที',
        'ข้อความกว้างสามารถนำกลับมาใช้ได้กับทุกข้อผิดพลาด',
        'ให้ผู้ใช้ตรวจรายละเอียดเองช่วยลดข้อความบนหน้าจอ',
        'การระบุว่าผู้ใช้ทำผิดทำให้สาเหตุชัดเจนขึ้น'
      ]
    },
    recovery: {
      prompt: 'Recovery path ใดช่วยให้ผู้ใช้ไปต่อโดยไม่เริ่มใหม่',
      note: 'รักษางานที่ทำไว้ ให้แก้เฉพาะจุด และมีคำสั่งลองใหม่ที่ชัดเจน',
      choices: [
        'เก็บข้อมูลเดิมและให้แก้เฉพาะช่องที่มีปัญหา',
        'ล้างแบบฟอร์มทั้งหมดแล้วให้กรอกใหม่ตั้งแต่ต้น',
        'พากลับหน้าแรกโดยไม่บันทึกสิ่งที่กรอกไว้',
        'ปิดหน้าต่างและให้ผู้ใช้กลับมาลองในภายหลัง'
      ],
      reasons: [
        'ลดงานซ้ำและช่วยให้ผู้ใช้ฟื้นจากข้อผิดพลาดต่อได้',
        'การเริ่มใหม่ทั้งหมดช่วยป้องกันข้อมูลเดิมปะปน',
        'การกลับหน้าแรกเปิดโอกาสให้เลือกเส้นทางใหม่เอง',
        'การปิดหน้าต่างช่วยหยุดปัญหาไม่ให้เกิดซ้ำทันที'
      ]
    },
    feedback: {
      prompt: 'Feedback ใดทำให้ผู้ใช้รู้ผลและขั้นตอนถัดไป',
      note: 'ผลลัพธ์ควรยืนยันสถานะ มีหลักฐานอ้างอิง และบอกทางดำเนินการต่อ',
      choices: [
        'แสดงผลสำเร็จ เลขอ้างอิง และปุ่มไปขั้นตอนถัดไป',
        'ปิดหน้าต่างทันทีหลังส่งโดยไม่แสดงผลลัพธ์',
        'แสดงไอคอนถูกเพียงอย่างเดียวโดยไม่มีรายละเอียด',
        'พากลับหน้าแรกทันทีโดยไม่บอกสถานะรายการ'
      ],
      reasons: [
        'ผู้ใช้ตรวจสอบผลย้อนหลังและตัดสินใจขั้นต่อไปได้',
        'หน้าต่างที่ปิดลงแสดงว่าระบบดำเนินการเสร็จแล้ว',
        'ไอคอนที่คุ้นเคยเพียงพอสำหรับยืนยันทุกสถานการณ์',
        'การกลับหน้าแรกเร็วช่วยลดขั้นตอนหลังส่งข้อมูล'
      ]
    }
  };

  const ORDER = ['state', 'prevention', 'microcopy', 'recovery', 'feedback'];

  function roundSource() {
    return clean([
      $('.hud .meter b')?.textContent,
      $('.case .kicker')?.textContent,
      $('.case h1')?.textContent,
      $('.case > p')?.textContent
    ].join(' ')).toLowerCase();
  }

  function roundNumber() {
    const text = roundSource();
    const m = text.match(/(?:รอบภารกิจ|progress|decision)\s*(\d+)|\b(\d+)\s*\/\s*5/);
    return Number((m && (m[1] || m[2])) || 0);
  }

  function packKey() {
    const text = roundSource();
    if (/microcopy|wording|write useful|ข้อความ/.test(text)) return 'microcopy';
    if (/recovery|recover|ทางกลับ|กู้คืน|ลองใหม่/.test(text)) return 'recovery';
    if (/prevent|double submit|dead end|ป้องกัน|กดซ้ำ/.test(text)) return 'prevention';
    if (/feedback|success|receipt|next step|ยืนยันผล/.test(text)) return 'feedback';
    if (/state|loading|disabled|สถานะ/.test(text)) return 'state';
    return ORDER[Math.max(0, Math.min(4, roundNumber() - 1))] || 'state';
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
    if ($('#uxqW12IntegrityStyleV2')) return;
    const s = document.createElement('style');
    s.id = 'uxqW12IntegrityStyleV2';
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
})();