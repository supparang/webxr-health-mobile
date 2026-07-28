/* CSAI2601 UX Quest • Runtime Mode Authority v1
 * Explicit preview only with ?contentPreview=1. Default is Student Mode.
 * Preserves mode across node/mission-control links and removes legacy emoji dock.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const preview = params.get('contentPreview') === '1';
  window.UXQ_CONTENT_PREVIEW = preview;
  window.UXQ_STUDENT_MODE = !preview;
  document.documentElement.dataset.uxqMode = preview ? 'preview' : 'student';
  document.documentElement.dataset.uxqContentPreview = preview ? '1' : '0';
  if (document.body) {
    document.body.dataset.uxqMode = preview ? 'preview' : 'student';
    document.body.dataset.uxqContentPreview = preview ? '1' : '0';
  }

  const style = document.createElement('style');
  style.id = 'uxq-runtime-mode-authority-style';
  style.textContent = `
    [data-uxq-mode='preview'] [data-student-only],
    [data-uxq-mode='preview'] .sheet-status-card,
    [data-uxq-mode='preview'] [data-sheet-status],
    [data-uxq-mode='preview'] .studio-status-panel{display:none!important}
    [data-uxq-mode='student'] [data-preview-only],
    [data-uxq-mode='student'] .uxq-preview-profile{display:none!important}
  `;
  document.head.appendChild(style);

  const isCourseHref = href => /csai2601-(?:mission-control|canonical-node-clean-v1)\.html/i.test(href || '');

  function preserveMode(root = document) {
    root.querySelectorAll('a[href]').forEach(anchor => {
      const raw = anchor.getAttribute('href') || '';
      if (!raw || raw.startsWith('#') || !isCourseHref(raw)) return;
      try {
        const url = new URL(raw, location.href);
        if (url.origin !== location.origin) return;
        if (preview) {
          url.searchParams.set('contentPreview','1');
          url.searchParams.delete('studentMode');
        } else {
          url.searchParams.delete('contentPreview');
          url.searchParams.delete('studentMode');
        }
        anchor.href = url.pathname + url.search + url.hash;
      } catch (_) {}
    });
  }

  function removeLegacyDock(root = document) {
    root.querySelectorAll('nav,footer,div,section').forEach(el => {
      if (!el.isConnected) return;
      const text = String(el.textContent || '').replace(/\s+/g,'');
      const hasLegacyIcons = text.includes('👊') && (text.includes('🌼') || text.includes('🌸'));
      if (!hasLegacyIcons) return;
      const computed = getComputedStyle(el);
      const nearBottom = computed.position === 'fixed' || computed.position === 'sticky' || /dock|bottom|mobile-nav|tabbar/i.test(el.className || '');
      if (nearBottom) el.remove();
    });
  }

  function fixStudentCopy() {
    if (preview) return;
    document.querySelectorAll('[data-preview-only],.uxq-preview-profile').forEach(el => el.remove());
  }

  function fixPreviewResult() {
    if (!preview) return;
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = String(el.textContent || '').trim();
      if (/^ผ่านแล้ว[:：]?|คะแนนดีที่สุด|เล่นซ้ำเพื่อฝึก/i.test(text)) {
        const box = el.closest('.result-card,.completion-card,.mission-result,.result-summary') || el;
        if (/เล่นซ้ำเพื่อฝึก/i.test(text)) {
          el.textContent = 'ตรวจ Case ใหม่ →';
        } else if (box === el) {
          el.remove();
        } else {
          box.querySelectorAll('*').forEach(child => {
            const childText = String(child.textContent || '').trim();
            if (/^ผ่านแล้ว[:：]?|คะแนนดีที่สุด/i.test(childText)) child.remove();
          });
        }
      }
    });
  }

  function labelMissionControlLinks() {
    document.querySelectorAll('a[href*="csai2601-mission-control.html"]').forEach(anchor => {
      if (preview && /กลับ Mission Control/i.test(anchor.textContent || '')) anchor.textContent = 'กลับหน้าตรวจเนื้อหา';
    });
  }

  let queued = false;
  function apply() {
    queued = false;
    preserveMode();
    removeLegacyDock();
    fixStudentCopy();
    fixPreviewResult();
    labelMissionControlLinks();
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  window.addEventListener('pageshow',queue);

  window.UXQRuntimeModeAuthority = Object.freeze({
    version:'20260728-MODE-AUTHORITY-V1.1',
    preview,
    student:!preview,
    refresh:queue
  });
})();