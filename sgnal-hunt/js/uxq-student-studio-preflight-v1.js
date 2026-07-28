/* CSAI2601 UX Quest • Student Studio Preflight v1
 * Runs before the final student wizard.
 * Restores real canonical controls from legacy wrappers and prevents 1/3 from
 * being misread as 3/3 because explanatory copy also contains the string 3/3.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const preview = params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '');
  if (preview || !/csai2601-canonical-node-clean-v1\.html/i.test(location.pathname)) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const FINAL_ID = 'uxqStudentStudioFinalV1';
  let queued = false;

  function appendUnique(artifact,node) {
    if (!node || node.closest('#' + FINAL_ID)) return;
    if (node.parentElement !== artifact) artifact.appendChild(node);
  }

  function restoreControls() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact || artifact.querySelector('#' + FINAL_ID)) return false;

    const moved = new Set();
    artifact.querySelectorAll('[data-studio-key]').forEach(field => {
      let control = field.closest('label.studio-field,.studio-field,label') || field;
      if (control.closest('#' + FINAL_ID) || moved.has(control)) return;
      moved.add(control);
      appendUnique(artifact,control);
    });

    ['.studio-checks','.studio-validation','.actions'].forEach(selector => {
      artifact.querySelectorAll(selector).forEach(node => {
        if (node.closest('#' + FINAL_ID) || moved.has(node)) return;
        moved.add(node);
        appendUnique(artifact,node);
      });
    });
    return moved.size > 0;
  }

  function officialCount() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) return null;
    const match = String(tracker.textContent || '').match(/([0-3])\s*\/\s*3/);
    return match ? Number(match[1]) : null;
  }

  function alignResult() {
    const count = officialCount();
    if (count == null) return;
    const results = ROOT.querySelector('.results');
    const heading = results?.querySelector('h1');
    if (!heading) return;

    if (count < 3) {
      heading.textContent = `${NODE_ID} ผ่าน Mission แล้ว`;
      const lead = heading.nextElementSibling;
      if (lead?.tagName === 'P') {
        lead.textContent = `ระบบยืนยันแล้ว ${count}/3 ส่วน • ต้องทำ Studio Practice และ Weekly Reflection ให้ครบก่อนจึงถือว่า ${NODE_ID} สมบูรณ์`;
      }
      results.querySelectorAll('*').forEach(el => {
        if (el.children.length) return;
        const text = String(el.textContent || '');
        if (/ปลดล็อกด่านถัดไปได้แล้ว/i.test(text)) {
          el.textContent = 'Mission ผ่านแล้ว แต่ยังไม่ปลดล็อกด่านถัดไปจนกว่าระบบจะยืนยันครบ 3/3 ส่วน';
        }
      });
    } else if (/ผ่าน Mission แล้ว|W\d+ ผ่านแล้ว/i.test(heading.textContent || '')) {
      heading.textContent = `${NODE_ID} สมบูรณ์แล้ว`;
    }
  }

  function apply() {
    queued = false;
    restoreControls();
    alignResult();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();
  new MutationObserver(queue).observe(ROOT,{childList:true,subtree:true,characterData:true});
  [80,180,350,700,1200,2200,4000].forEach(ms => setTimeout(apply,ms));
  ['uxq-progress-updated','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(name => window.addEventListener(name,queue));

  window.UXQStudentStudioPreflightV1 = Object.freeze({version:'20260728-STUDENT-STUDIO-PREFLIGHT-V1',restoreControls,alignResult,officialCount});
})();