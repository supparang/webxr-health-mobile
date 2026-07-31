/* CSAI2601 UX Quest • Node Sheet Display Final Authority v3
 * Google Sheet is authoritative. This authority never creates a second
 * post-mission CTA; the canonical Quest Progress action is the only launcher.
 */
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
    u.searchParams.set('v', 'node-sheet-final-v3-20260731');
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
    const pageText = String(ROOT.textContent || '');
    return /Studio Practice\s*(?:ยืนยันแล้ว|✓)|ยืนยันแล้ว\s*Google Sheet พบ Studio Artifact|2\/3\s*ยืนยันจากระบบ/i.test(pageText);
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

  function normalizeCanonicalStudioAction() {
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
      if (/เล่น\s*Mission\s*ซ้ำ|เล่นซ้ำเพื่อฝึกเพิ่มเติม/i.test(label) && IN_STUDIO) {
        control.remove();
      }
    });
  }

  function setReflectionReady() {
    leafText(/3\.\s*Weekly Reflection/i, '3. Weekly Reflection');
    leafText(/^ยังไม่เปิด$/i, 'พร้อมเขียน');
    leafText(/เล่นและผ่าน Mission เพื่อเปิด Reflection/i, 'Studio Practice ยืนยันแล้ว • เขียน Weekly Reflection ต่อได้ทันที');
    leafText(/ขั้นตอนถัดไป:\s*Weekly Reflection/i, 'ขั้นตอนถัดไป: Weekly Reflection');
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

    removeGeneratedLargeCTA();
    normalizeCanonicalStudioAction();

    if (studioConfirmed()) {
      document.body.dataset.uxqSheetStudio = '1';
      setReflectionReady();
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
  [100,300,800,1600,3000].forEach(ms => setTimeout(queue, ms));
})();