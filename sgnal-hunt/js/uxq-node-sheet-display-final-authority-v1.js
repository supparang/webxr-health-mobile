/* CSAI2601 UX Quest • Node Sheet Display Final Authority v4.1
 * Google Sheet is authoritative. Keeps one clear next action and explains
 * the remaining three-part requirement without implying Reflection is done.
 * v4.1: reconcile stale Mission labels/counts with Node Sheet Authority.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const IN_STUDIO = q.get('phase') === 'studio';
  const STYLE_ID = 'uxq-node-sheet-display-final-style-v4';
  let queued = false;

  const studioUrl = () => {
    const u = new URL(location.href);
    u.searchParams.set('phase', 'studio');
    u.searchParams.set('v', 'node-sheet-final-v4-1-20260809');
    return u.pathname + u.search + u.hash;
  };

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-uxq-reflection-primary='1']{
        background:linear-gradient(90deg,#6ee7ff,#79eda5)!important;
        color:#071124!important;
        border-color:transparent!important;
        box-shadow:0 12px 28px rgba(74,222,128,.18)!important;
        font-weight:950!important;
        min-height:64px!important;
        padding:14px 24px!important;
      }
      [data-uxq-mission-control-secondary='1']{
        background:transparent!important;
        color:#f3f7ff!important;
        border:1px solid rgba(148,203,255,.35)!important;
        box-shadow:none!important;
        font-weight:800!important;
      }
      [data-uxq-reflection-note='1']{
        margin-top:10px!important;
        color:#d8e7ff!important;
        font-weight:800!important;
      }
    `;
    document.head.appendChild(style);
  }

  function leafText(pattern, replacement) {
    ROOT.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const value = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (pattern.test(value)) el.textContent = typeof replacement === 'function' ? replacement(value) : replacement;
    });
  }

  function studioConfirmed() {
    const authority = window.UXQNodeSheetAuthority || {};
    const node = authority.studio || authority.node || authority.status || {};
    if (authority.studioSubmitted === true) return true;
    if (node.studioSubmitted === true || node.artifactSubmitted === true || node.submitted === true) return true;
    if (document.body.dataset.uxqSheetStudio === '1') return true;
    const pageText = String(ROOT.textContent || '');
    return /Studio Practice\s*(?:ยืนยันแล้ว|✓)|ยืนยันแล้ว\s*Google Sheet พบ Studio Artifact|2\/3\s*ยืนยันจากระบบ/i.test(pageText);
  }

  function reflectionConfirmed() {
    const authority = window.UXQNodeSheetAuthority || {};
    const node = authority.studio || authority.node || authority.status || {};
    if (authority.reflectionSubmitted === true) return true;
    if (node.reflectionSubmitted === true || node.hasReflection === true) return true;
    if (document.body.dataset.uxqSheetReflection === '1') return true;
    return /Reflection\s*(?:ยืนยันแล้ว|✓)|3\/3\s*ยืนยันจากระบบ/i.test(String(ROOT.textContent || ''));
  }

  function removeGeneratedLargeCTA() {
    document.getElementById('uxqSheetStudioPrimaryCTA')?.remove();
    ROOT.querySelectorAll('.uxq-sheet-studio-cta').forEach(el => el.remove());
    ROOT.querySelectorAll('a,button').forEach(control => {
      const label = String(control.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^ทำ\s*Studio Practice\s*[•·-]\s*[WB]\d+$/i.test(label)) return;
      if (control.closest('#uxqStudentStudioFinalV2,.artifact[data-studio-practice-v1]')) return;
      const wrapper = control.closest('.uxq-final-primary-action,#uxqRuntimeNextCard,.uxq-runtime-next-card');
      if (wrapper) wrapper.remove();
      else control.remove();
    });
  }

  function normalizeActions() {
    ROOT.querySelectorAll('a,button').forEach(control => {
      if (control.closest('#uxqStudentStudioFinalV2,.artifact[data-studio-practice-v1]')) return;
      const label = String(control.textContent || '').replace(/\s+/g, ' ').trim();

      if (/^ทำ\s*Studio Practice\s*ต่อ/i.test(label) || /^เปิด\s*Studio Practice$/i.test(label)) {
        if (control.tagName === 'A') control.href = studioUrl();
        control.onclick = event => {
          event.preventDefault();
          location.assign(studioUrl());
        };
      }

      if (/เขียน\s*Weekly Reflection/i.test(label)) {
        control.dataset.uxqReflectionPrimary = '1';
        control.removeAttribute('aria-disabled');
        control.disabled = false;
      }

      if (/กลับ\s*Mission Control/i.test(label)) {
        control.dataset.uxqMissionControlSecondary = '1';
      }

      if (/เล่น\s*Mission\s*ซ้ำ|เล่นซ้ำเพื่อฝึกเพิ่มเติม/i.test(label) && IN_STUDIO) {
        control.remove();
      }
    });
  }

  function patchThreePartTracker() {
    const authority = window.UXQNodeSheetAuthority || {};
    if (!authority.missionPassed) return;

    const studio = studioConfirmed();
    const reflection = reflectionConfirmed();
    const confirmedCount = 1 + Number(studio) + Number(reflection);

    /* Reconcile stale Mission text generated before Sheet authority arrived. */
    leafText(/^ยังไม่ได้เล่น$/i, 'ผ่านแล้ว');
    leafText(/^เล่นแล้ว\s*•\s*ยังไม่ผ่าน$/i, 'ผ่านแล้ว');
    leafText(/เริ่ม Mission และทำให้ได้อย่างน้อย 2\/3 ดาว/i, 'Google Sheet ยืนยัน mission_completed');
    leafText(/มีคะแนนสะสม.*เกณฑ์ผ่าน.*Studio Practice จะเปิด/i, 'Google Sheet ยืนยัน Mission ผ่านแล้ว • ทำ Studio Practice ต่อได้ทันที');
    leafText(/ผ่านในเครื่อง\s*•\s*รอ Sheet/i, 'ผ่านแล้ว • Google Sheet ยืนยัน mission_completed');

    /* Count must reflect Sheet truth, not whichever card rendered first. */
    leafText(/^\d\/3\s*ยืนยันจากระบบ$/i, `${confirmedCount}/3 ยืนยันจากระบบ`);
    leafText(/^ระบบยืนยันแล้ว\s*\d\/3\s*ส่วน$/i, `ระบบยืนยันแล้ว ${confirmedCount}/3 ส่วน`);

    const tracker = Array.from(ROOT.querySelectorAll('section,article,div')).find(el => {
      const value = String(el.textContent || '').replace(/\s+/g, ' ');
      return /ตรวจความครบ 3 ส่วน/i.test(value) && /Mission\s*\/\s*Game/i.test(value);
    });

    if (tracker) {
      const cards = tracker.querySelectorAll('.uxq-3part__item');
      const missionCard = cards[0];
      const studioCard = cards[1];
      const reflectionCard = cards[2];

      if (missionCard) {
        missionCard.dataset.state = 'done';
        const status = missionCard.querySelector('span');
        const detail = missionCard.querySelector('small');
        if (status) status.textContent = 'ผ่านแล้ว';
        if (detail) detail.textContent = 'Google Sheet ยืนยัน mission_completed';
      }

      if (studio && studioCard) {
        studioCard.dataset.state = 'done';
        const status = studioCard.querySelector('span');
        const detail = studioCard.querySelector('small');
        if (status) status.textContent = 'ยืนยันแล้ว';
        if (detail) detail.textContent = 'Google Sheet พบ Studio Artifact';
      }

      if (reflection && reflectionCard) {
        reflectionCard.dataset.state = 'done';
        const status = reflectionCard.querySelector('span');
        const detail = reflectionCard.querySelector('small');
        if (status) status.textContent = 'ยืนยันแล้ว';
        if (detail) detail.textContent = 'Google Sheet พบ Weekly Reflection';
      }

      const count = tracker.querySelector('.uxq-3part__count');
      if (count) count.textContent = `${confirmedCount}/3 ยืนยันจากระบบ`;
    }
  }

  function setReflectionReady() {
    if (reflectionConfirmed()) return;

    leafText(/^พร้อมเขียน$/i, 'ยังไม่ได้ส่ง');
    leafText(/^ยังไม่เปิด$/i, 'ยังไม่ได้ส่ง');
    leafText(/Studio Practice ยืนยันแล้ว\s*•\s*เขียน Weekly Reflection ต่อได้ทันที/i,
      'Studio Practice ยืนยันแล้ว • กรุณาเขียน Weekly Reflection เพื่อให้ครบ 3/3');
    leafText(/เล่นและผ่าน Mission เพื่อเปิด Reflection/i,
      'Studio Practice ยืนยันแล้ว • กรุณาเขียน Weekly Reflection เพื่อให้ครบ 3/3');
    leafText(/ต้องเห็น 3\/3 จึงถือว่าส่งครบ.*$/i,
      'Mission และ Studio Practice ผ่านแล้ว • เหลือเพียง Weekly Reflection เมื่อส่งแล้ว W นี้จะครบ 3/3');
    leafText(/ขั้นตอนถัดไป:\s*Studio Practice/i, 'ขั้นตอนถัดไป: Weekly Reflection');
    leafText(/ขั้นตอนถัดไป:\s*Weekly Reflection/i, 'ขั้นตอนถัดไป: Weekly Reflection');

    const tracker = Array.from(ROOT.querySelectorAll('section,article,div')).find(el => {
      const value = String(el.textContent || '').replace(/\s+/g, ' ');
      return /ตรวจความครบ 3 ส่วน/i.test(value) && /2\/3\s*ยืนยันจากระบบ/i.test(value);
    });
    if (tracker && !tracker.querySelector('[data-uxq-reflection-note]')) {
      const note = document.createElement('p');
      note.dataset.uxqReflectionNote = '1';
      note.textContent = 'เหลือ 1 ขั้นตอน: เขียน Weekly Reflection แล้วรอ Google Sheet ยืนยัน จึงจะครบ 3/3';
      tracker.appendChild(note);
    }
  }

  function apply() {
    queued = false;
    installStyle();
    const authority = window.UXQNodeSheetAuthority;
    if (!authority || !authority.missionPassed) return;

    document.body.dataset.uxqSheetMission = '1';
    removeGeneratedLargeCTA();
    normalizeActions();
    patchThreePartTracker();

    if (studioConfirmed()) {
      document.body.dataset.uxqSheetStudio = '1';
      setReflectionReady();
    }

    if (reflectionConfirmed()) {
      document.body.dataset.uxqSheetReflection = '1';
    }

    const boxes = Array.from(ROOT.querySelectorAll('*')).filter(el => /1\.\s*Mission\s*\/\s*Game/i.test(el.textContent || ''));
    boxes.forEach(box => {
      const host = box.closest('section,article,div') || box.parentElement;
      if (!host) return;
      host.style.borderColor = '#33d69f';
      host.querySelectorAll('*').forEach(el => {
        if (!el.children.length && /(ยังไม่ผ่าน|ยังไม่ได้เล่น)/i.test(el.textContent || '')) el.textContent = 'ผ่านแล้ว';
      });
    });
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener('uxq-node-sheet-authority-ready', queue);
  ['uxq-sheet-progress-restored','uxq-progress-updated','uxq-three-part-updated','uxq-three-part-sheet-confirmed'].forEach(name => window.addEventListener(name, queue));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once: true });
  else queue();
  new MutationObserver(queue).observe(ROOT, { childList: true, subtree: true, characterData: true });
  [100,300,800,1600,3000,5000].forEach(ms => setTimeout(queue, ms));
})();
