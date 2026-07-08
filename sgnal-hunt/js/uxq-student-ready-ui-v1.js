/* CSAI2601 UX Quest • Student Ready UI v1
 * Purpose: make the canonical node page classroom-ready for Thai Year 2 students.
 * - Do not reveal rationale / misconception / wrong-cue text before students choose.
 * - Hide teacher/backend evidence from the student screen.
 * - Use Thai-first labels and reduce raw technical data.
 */
(() => {
  'use strict';

  const HINT_MAIN = 'อ่านสถานการณ์ แล้วเลือกคำตอบที่มีเหตุผลจากหลักฐานมากที่สุด';
  const HINT_REASON = 'เลือกเหตุผลที่อธิบายคำตอบได้ตรงกับสถานการณ์ที่สุด';

  function txt(el) { return (el?.textContent || '').trim(); }
  function setText(el, value) { if (el && txt(el) !== value) el.textContent = value; }

  function relabelMeters() {
    document.querySelectorAll('.meter small').forEach((el) => {
      const t = txt(el).toLowerCase();
      if (t === 'progress') setText(el, 'ความคืบหน้า');
      else if (t === 'correct') setText(el, 'ตอบถูก');
      else if (t === 'reason') setText(el, 'เหตุผลผ่าน');
      else if (t === 'hints') setText(el, 'คำใบ้');
      else if (t === 'score') setText(el, 'คะแนน');
      else if (t === 'accuracy') setText(el, 'ความถูกต้อง');
      else if (t === 'time') setText(el, 'เวลา');
    });

    document.querySelectorAll('.result-grid span').forEach((el) => {
      const t = txt(el).toLowerCase();
      if (t === 'score') setText(el, 'คะแนน');
      else if (t === 'accuracy') setText(el, 'ความถูกต้อง');
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
        if (!/w\d+|b\d+/i.test(t)) setText(el, 'พร้อมเรียน');
      }
    });

    document.querySelectorAll('.brief b').forEach((el) => {
      const t = txt(el).toLowerCase();
      if (t === 'concept') setText(el, 'เรียนเรื่อง');
      else if (t === 'case') setText(el, 'สถานการณ์');
      else if (t === 'artifact') setText(el, 'ใบงาน');
    });

    document.querySelectorAll('.kicker').forEach((el) => {
      const t = txt(el);
      if (t === 'Studio Artifact' || t === 'STUDIO ARTIFACT') setText(el, 'ใบงานหลังเล่น');
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
      guide.innerHTML = '<b>วิธีเล่นสำหรับนักศึกษาปี 2</b><span>อ่านสถานการณ์ → เลือกคำตอบ → ตรวจเหตุผล → สรุปเป็นใบงานสั้น ๆ ด้วยภาษาไทย</span>';
      const actions = hero.querySelector('.actions');
      if (actions) hero.insertBefore(guide, actions);
      else hero.appendChild(guide);
    }

    const question = document.querySelector('.question');
    if (question && !question.querySelector('[data-student-ready-note]')) {
      const note = document.createElement('p');
      note.setAttribute('data-student-ready-note', '1');
      note.className = 'student-ready-note';
      note.textContent = 'ยังไม่เฉลยเหตุผลใต้ตัวเลือก ให้ตัดสินจากสถานการณ์และหลักฐานก่อน';
      const options = question.querySelector('.options');
      if (options) question.insertBefore(note, options);
      else question.appendChild(note);
    }
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
      @media(min-width:760px){.result-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
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
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 20);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
