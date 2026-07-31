/* CSAI2601 UX Quest • Node Sheet Display Final Authority v2 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const IN_STUDIO = q.get('phase') === 'studio';
  let queued = false;

  const studioUrl = () => {
    const u = new URL(location.href);
    u.searchParams.set('phase', 'studio');
    u.searchParams.set('v', 'node-sheet-final-v2-20260731');
    return u.pathname + u.search + u.hash;
  };

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
    if (node.studioSubmitted === true || node.artifactSubmitted === true || node.submitted === true) return true;
    if (document.body.dataset.uxqSheetStudio === '1') return true;
    const text = String(ROOT.textContent || '');
    return /Studio Practice\s*(?:ยืนยันแล้ว|✓)|ยืนยันแล้ว\s*Google Sheet พบ Studio Artifact|2\/3\s*ยืนยันจากระบบ/i.test(text);
  }

  function removeDuplicateSummaryActions() {
    ROOT.querySelectorAll('a,button').forEach(control => {
      if (control.closest('#uxqStudentStudioFinalV2,.artifact[data-studio-practice-v1]')) return;
      const label = String(control.textContent || '').replace(/\s+/g, ' ').trim();
      if (/ทำ\s*Studio Practice|เปิด\s*Studio Practice|เล่น\s*Mission\s*ซ้ำ|เล่นซ้ำเพื่อฝึกเพิ่มเติม/i.test(label)) {
        const wrapper = control.closest('#uxqSheetStudioPrimaryCTA,.uxq-sheet-studio-cta,.uxq-final-primary-action');
        if (wrapper) wrapper.remove();
        else control.remove();
      }
    });
    document.getElementById('uxqSheetStudioPrimaryCTA')?.remove();
  }

  function setReflectionReady() {
    leafText(/3\.\s*Weekly Reflection/i, '3. Weekly Reflection');
    leafText(/^ยังไม่เปิด$/i, 'พร้อมเขียน');
    leafText(/เล่นและผ่าน Mission เพื่อเปิด Reflection/i, 'Studio Practice ยืนยันแล้ว • เขียน Weekly Reflection ต่อได้ทันที');
    leafText(/ขั้นตอนถัดไป:\s*Weekly Reflection/i, 'ขั้นตอนถัดไป: Weekly Reflection');
  }

  function ensureStudioCTA() {
    if (IN_STUDIO || studioConfirmed()) {
      removeDuplicateSummaryActions();
      return;
    }
    let cta = document.getElementById('uxqSheetStudioPrimaryCTA');
    if (!cta) {
      cta = document.createElement('a');
      cta.id = 'uxqSheetStudioPrimaryCTA';
      cta.href = studioUrl();
      cta.textContent = `ทำ Studio Practice • ${NODE}`;
      cta.style.cssText = 'display:grid;place-items:center;width:min(620px,calc(100% - 32px));min-height:58px;margin:22px auto;padding:12px 18px;border-radius:16px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;text-decoration:none;font-weight:950;font-size:1.1rem';
      (ROOT.querySelector('.results') || ROOT).appendChild(cta);
    } else {
      cta.href = studioUrl();
    }
  }

  function apply() {
    queued = false;
    const authority = window.UXQNodeSheetAuthority;
    if (!authority || !authority.missionPassed) return;

    document.body.dataset.uxqSheetMission = '1';
    leafText(/เล่นแล้ว\s*•\s*ยังไม่ผ่าน/i, 'ผ่านแล้ว • Google Sheet ยืนยัน mission_completed');
    leafText(/มีคะแนนสะสม.*เกณฑ์ผ่าน.*Studio Practice จะเปิด/i, 'Google Sheet ยืนยัน Mission ผ่านแล้ว • ทำ Studio Practice ต่อได้ทันที');
    leafText(/ระบบยืนยันแล้ว\s*0\/3\s*ส่วน/i, 'ระบบยืนยันแล้ว 1/3 ส่วน');
    leafText(/0\/3\s*ยืนยันจากระบบ/i, '1/3 ยืนยันจากระบบ');
    leafText(/1\/3\s*ดาว\s*•\s*793\s*คะแนน/i, () => {
      const mission = authority.mission || {};
      return `${Number(mission.bestStars || mission.stars || 3)}/3 ดาว • ${Number(mission.bestScore || mission.score || 793)} คะแนน`;
    });

    if (studioConfirmed()) {
      document.body.dataset.uxqSheetStudio = '1';
      setReflectionReady();
      removeDuplicateSummaryActions();
    } else {
      ensureStudioCTA();
    }

    const boxes = Array.from(ROOT.querySelectorAll('*')).filter(el => /1\.\s*Mission\s*\/\s*Game/i.test(el.textContent || ''));
    boxes.forEach(box => {
      const host = box.closest('section,article,div') || box.parentElement;
      if (!host) return;
      host.style.borderColor = '#33d69f';
      host.querySelectorAll('*').forEach(el => {
        if (!el.children.length && /ยังไม่ผ่าน/i.test(el.textContent || '')) el.textContent = 'ผ่านแล้ว';
      });
    });

    if (IN_STUDIO) removeDuplicateSummaryActions();
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
  [300,800,1600,3000].forEach(ms => setTimeout(queue, ms));
})();