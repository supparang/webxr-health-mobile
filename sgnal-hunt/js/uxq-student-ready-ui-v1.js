/* CSAI2601 UX Quest • Student Ready UI v2
 * Make the player feel like a game loop, not a long worksheet.
 * - Hide answer rationale / misconception before choice.
 * - Hide teacher/backend evidence.
 * - Convert the long artifact form into a 3-minute mission debrief with quick chips.
 */
(() => {
  'use strict';

  const HINT_MAIN = 'อ่านสถานการณ์ แล้วเลือกคำตอบที่มีเหตุผลจากหลักฐานมากที่สุด';
  const HINT_REASON = 'เลือกเหตุผลที่อธิบายคำตอบได้ตรงกับสถานการณ์ที่สุด';
  const CHIP_GROUPS = [
    {
      title: 'เลือกปัญหาที่เห็น',
      target: 0,
      chips: ['หาเมนูไม่เจอ', 'ไม่รู้ขั้นตอนถัดไป', 'ระบบไม่บอกสถานะ', 'ข้อมูลเยอะเกินไป', 'ปุ่มสำคัญไม่เด่น']
    },
    {
      title: 'เลือกเหตุผล UX',
      target: 1,
      chips: ['ทำงานหลักไม่สำเร็จ', 'เสียเวลา', 'เข้าใจผิด', 'ต้องเดาเอง', 'เกิดความกังวล']
    },
    {
      title: 'เลือกแนวทางแก้',
      target: 2,
      chips: ['จัดลำดับข้อมูลใหม่', 'ทำปุ่มหลักให้ชัด', 'เพิ่ม feedback หลังส่งข้อมูล', 'ลดข้อมูลที่ไม่จำเป็น', 'ให้ผู้ใช้ลองทำ task เดิม']
    }
  ];

  function txt(el) { return (el?.textContent || '').trim(); }
  function setText(el, value) { if (el && txt(el) !== value) el.textContent = value; }

  function relabelMeters() {
    document.querySelectorAll('.meter small').forEach((el) => {
      const t = txt(el).toLowerCase();
      if (t === 'progress') setText(el, 'ด่าน');
      else if (t === 'correct') setText(el, 'ตอบถูก');
      else if (t === 'reason') setText(el, 'เหตุผล');
      else if (t === 'hints') setText(el, 'คำใบ้');
      else if (t === 'score') setText(el, 'คะแนน');
      else if (t === 'accuracy') setText(el, 'ถูกต้อง');
      else if (t === 'time') setText(el, 'เวลา');
    });

    document.querySelectorAll('.result-grid span').forEach((el) => {
      const t = txt(el).toLowerCase();
      if (t === 'score') setText(el, 'คะแนน');
      else if (t === 'accuracy') setText(el, 'ถูกต้อง');
      else if (t === 'reason') setText(el, 'เหตุผล');
      else if (t === 'hints') setText(el, 'คำใบ้');
      else if (t === 'time') setText(el, 'เวลา');
    });
  }

  function neutralizeOptionHints() {
    document.querySelectorAll('.question .options .option span').forEach((span) => {
      const inVerify = !!span.closest('.verify');
      const inFeedback = !!span.closest('.feedback');
      if (inFeedback) return;
      const neutral = inVerify ? HINT_REASON : HINT_MAIN;
      if (txt(span) !== neutral) span.textContent = neutral;
      span.removeAttribute('title');
    });
  }

  function hideStudentIrrelevantData() {
    document.querySelectorAll('.takeaway').forEach((el) => {
      el.setAttribute('hidden', 'hidden');
      el.style.display = 'none';
    });

    document.querySelectorAll('.pill').forEach((el) => {
      const t = txt(el);
      if (/^case\s+/i.test(t)) setText(el, 'สถานการณ์ฝึก');
      if (/canonical|v1\.|v=|202607/i.test(t)) {
        if (!/w\d+|b\d+/i.test(t)) setText(el, 'พร้อมเล่น');
      }
    });

    document.querySelectorAll('.brief b').forEach((el) => {
      const t = txt(el).toLowerCase();
      if (t === 'concept') setText(el, 'เรียนเรื่อง');
      else if (t === 'case') setText(el, 'สถานการณ์');
      else if (t === 'artifact') setText(el, 'ภารกิจหลังเล่น');
    });

    document.querySelectorAll('.kicker').forEach((el) => {
      const t = txt(el);
      if (t === 'Studio Artifact' || t === 'STUDIO ARTIFACT') setText(el, 'ภารกิจหลังเล่น');
      if (/weekly mission/i.test(t)) setText(el, t.replace(/WEEKLY MISSION/i, 'ภารกิจรายสัปดาห์'));
      if (/boss gate/i.test(t)) setText(el, t.replace(/BOSS GATE/i, 'ด่านสรุปความรู้'));
    });
  }

  function addStudentGuide() {
    const hero = document.querySelector('.hero');
    if (hero && !hero.querySelector('[data-student-ready-guide]')) {
      const guide = document.createElement('div');
      guide.setAttribute('data-student-ready-guide', '1');
      guide.className = 'student-ready-guide';
      guide.innerHTML = '<b>วิธีเล่น</b><span>อ่านสถานการณ์ → เลือกคำตอบ → ตรวจเหตุผล → เก็บดาว → ไปด่านถัดไป</span>';
      const actions = hero.querySelector('.actions');
      if (actions) hero.insertBefore(guide, actions);
      else hero.appendChild(guide);
    }

    const question = document.querySelector('.question');
    if (question && !question.querySelector('[data-student-ready-note]')) {
      const note = document.createElement('p');
      note.setAttribute('data-student-ready-note', '1');
      note.className = 'student-ready-note';
      note.textContent = 'ยังไม่เฉลยเหตุผลใต้ตัวเลือก ลองตัดสินใจจากหลักฐานก่อน';
      const options = question.querySelector('.options');
      if (options) question.insertBefore(note, options);
      else question.appendChild(note);
    }
  }

  function chipButton(text, target) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'uxq-quick-chip';
    btn.textContent = text;
    btn.addEventListener('click', () => {
      const area = document.querySelector(`.artifact textarea[data-debrief-index="${target}"]`);
      if (!area) return;
      const value = area.value.trim();
      area.value = value ? `${value}, ${text}` : text;
      area.dispatchEvent(new Event('input', { bubbles: true }));
      area.focus();
    });
    return btn;
  }

  function makeChipRow(group) {
    const wrap = document.createElement('div');
    wrap.className = 'uxq-chip-row';
    const label = document.createElement('b');
    label.textContent = group.title;
    wrap.appendChild(label);
    const chips = document.createElement('div');
    chips.className = 'uxq-chip-list';
    group.chips.forEach((chip) => chips.appendChild(chipButton(chip, group.target)));
    wrap.appendChild(chips);
    return wrap;
  }

  function transformArtifact() {
    const artifact = document.querySelector('.artifact');
    if (!artifact || artifact.dataset.studentDebriefReady === '1') return;
    artifact.dataset.studentDebriefReady = '1';

    const kicker = artifact.querySelector('.kicker');
    if (kicker) kicker.textContent = 'สรุปภารกิจ 3 นาที';
    const h2 = artifact.querySelector('h2');
    if (h2) h2.textContent = 'เก็บดาวแล้ว สรุปสั้น ๆ เพื่อไปต่อ';

    const intro = artifact.querySelector('p:not(.kicker)');
    if (intro) intro.textContent = 'เลือกชิปช่วยตอบได้ แล้วเติมเป็นประโยคสั้น ๆ ไม่ต้องเขียนยาว';

    if (!artifact.querySelector('[data-playful-debrief]')) {
      const banner = document.createElement('div');
      banner.className = 'uxq-debrief-banner';
      banner.setAttribute('data-playful-debrief', '1');
      banner.innerHTML = '<span>ภารกิจสั้น</span><b>ตอบ 3 ช่องพอ: ปัญหา → เหตุผล → วิธีแก้</b>';
      if (h2) h2.insertAdjacentElement('afterend', banner);
      else artifact.prepend(banner);
    }

    const labels = Array.from(artifact.querySelectorAll('label'));
    const config = [
      {
        title: '1) ปัญหาที่เห็น',
        placeholder: 'เช่น ผู้ใช้หาปุ่มยืนยันไม่เจอ ทำให้ลงทะเบียนไม่สำเร็จ'
      },
      {
        title: '2) ทำไมเป็นปัญหา UX',
        placeholder: 'เช่น เพราะทำให้ผู้ใช้ทำงานหลักไม่สำเร็จ ไม่ใช่แค่หน้าจอไม่สวย'
      },
      {
        title: '3) จะแก้อย่างไร + ทดสอบยังไง',
        placeholder: 'เช่น ทำปุ่มหลักให้ชัด แล้วให้ผู้ใช้ลองทำ task เดิม วัดว่าทำสำเร็จเร็วขึ้นไหม'
      }
    ];

    labels.forEach((label, index) => {
      const b = label.querySelector('b');
      const area = label.querySelector('textarea');
      if (!area) return;
      if (index < 3) {
        label.classList.add('uxq-main-debrief-field');
        if (b) b.textContent = config[index].title;
        area.placeholder = config[index].placeholder;
        area.dataset.debriefIndex = String(index);
        area.rows = 2;
      } else {
        label.classList.add('uxq-extra-field');
        label.style.display = 'none';
      }
    });

    if (!artifact.querySelector('[data-chip-panel]')) {
      const panel = document.createElement('div');
      panel.className = 'uxq-chip-panel';
      panel.setAttribute('data-chip-panel', '1');
      CHIP_GROUPS.forEach((group) => panel.appendChild(makeChipRow(group)));
      const firstLabel = artifact.querySelector('label');
      if (firstLabel) artifact.insertBefore(panel, firstLabel);
      else artifact.appendChild(panel);
    }

    const actions = artifact.querySelector('.actions');
    if (actions && !actions.querySelector('[data-toggle-extra]')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn secondary';
      toggle.setAttribute('data-toggle-extra', '1');
      toggle.textContent = 'เขียนเพิ่ม';
      toggle.addEventListener('click', () => {
        const extras = artifact.querySelectorAll('.uxq-extra-field');
        const open = toggle.dataset.open === '1';
        extras.forEach((el) => { el.style.display = open ? 'none' : 'block'; });
        toggle.dataset.open = open ? '0' : '1';
        toggle.textContent = open ? 'เขียนเพิ่ม' : 'ซ่อนส่วนเพิ่ม';
      });
      actions.prepend(toggle);
    }

    const saveBtn = artifact.querySelector('[data-save-artifact]');
    if (saveBtn) saveBtn.textContent = 'บันทึกสรุป';
  }

  function injectStyle() {
    if (document.getElementById('uxq-student-ready-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-student-ready-ui-style';
    style.textContent = `
      .takeaway{display:none!important}
      .student-ready-guide{border:1px solid rgba(110,231,255,.28);border-radius:16px;background:rgba(110,231,255,.08);padding:13px 14px;line-height:1.55;color:#dff7ff;display:grid;gap:3px}
      .student-ready-guide b{color:#fff;font-weight:950}.student-ready-guide span{color:#cfe9ff}
      .student-ready-note{margin:14px 0 0;padding:10px 12px;border:1px solid rgba(255,209,102,.35);border-radius:13px;background:rgba(255,209,102,.08);color:#ffe8ad;line-height:1.5;font-weight:800}
      .option span{font-size:.92rem!important;color:#b9c8e4!important}
      .option b{font-size:clamp(1.02rem,3.8vw,1.24rem)!important}
      .result-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .artifact{gap:12px!important}
      .uxq-debrief-banner{display:grid;gap:4px;border:1px solid rgba(255,209,102,.35);border-radius:15px;background:linear-gradient(135deg,rgba(255,209,102,.16),rgba(110,231,255,.08));padding:12px 13px;color:#fff;line-height:1.45}
      .uxq-debrief-banner span{color:#ffe08a;font-size:.82rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}.uxq-debrief-banner b{font-size:1.05rem}
      .uxq-chip-panel{display:grid;gap:10px;border:1px solid rgba(110,231,255,.24);border-radius:16px;background:rgba(110,231,255,.06);padding:12px}
      .uxq-chip-row{display:grid;gap:7px}.uxq-chip-row>b{color:#eaf7ff}.uxq-chip-list{display:flex;gap:7px;flex-wrap:wrap}
      .uxq-quick-chip{border:1px solid rgba(181,205,255,.28);border-radius:999px;background:rgba(255,255,255,.08);color:#f2fbff;padding:8px 10px;font-weight:800;cursor:pointer}
      .uxq-quick-chip:active{transform:scale(.98)}
      .uxq-main-debrief-field{border:1px solid rgba(181,205,255,.18);border-radius:16px;background:rgba(5,15,35,.28);padding:11px;display:grid!important;gap:7px}
      .uxq-main-debrief-field b{font-size:1.05rem}.uxq-main-debrief-field textarea{min-height:70px!important}.uxq-extra-field{opacity:.9}
      @media(min-width:760px){.result-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.uxq-chip-panel{grid-template-columns:1fr 1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  let timer = 0;
  function apply() {
    injectStyle();
    relabelMeters();
    neutralizeOptionHints();
    hideStudentIrrelevantData();
    addStudentGuide();
    transformArtifact();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 20);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
