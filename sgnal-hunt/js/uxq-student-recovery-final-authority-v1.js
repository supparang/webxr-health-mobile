/* CSAI2601 UX Quest • Student Recovery Final Authority v1
 * Front-end only. Never fabricates progress. Releases loading UI when Sheet restore fails.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search || '').get('contentPreview') === '1') return;

  const TIMEOUT_MS = 7000;
  let settled = false;

  const title = () => document.getElementById('nextTitle');
  const desc = () => document.getElementById('nextDesc');
  const link = () => document.getElementById('nextLink');

  function releaseLoading() {
    if (document.body) document.body.dataset.uxqCloudLoading = '0';
  }

  function previewHref() {
    const url = new URL('./csai2601-mission-control.html', location.href);
    url.searchParams.set('contentPreview','1');
    url.searchParams.set('v','content-preview-v10-20260728');
    return url.pathname + url.search;
  }

  function installActions() {
    let panel = document.getElementById('uxqStudentRecoveryActions');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'uxqStudentRecoveryActions';
    panel.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px';
    panel.innerHTML = `
      <button type="button" data-retry-sheet style="min-height:48px;border:0;border-radius:12px;font:inherit;font-weight:900;background:#6fe5f5;color:#06182c;cursor:pointer">ลองเชื่อมต่อ Sheet อีกครั้ง</button>
      <a href="${previewHref()}" style="min-height:48px;border:1px solid rgba(255,255,255,.35);border-radius:12px;display:grid;place-items:center;padding:10px;text-decoration:none;font-weight:900;color:#fff">เปิด Content Preview</a>`;
    const card = document.querySelector('.current-card');
    card?.appendChild(panel);
    panel.querySelector('[data-retry-sheet]')?.addEventListener('click', async () => {
      const button = panel.querySelector('[data-retry-sheet]');
      button.disabled = true;
      button.textContent = 'กำลังลองใหม่…';
      try {
        if (window.UXQMissionControlLoadRecoveryV1?.restore) await window.UXQMissionControlLoadRecoveryV1.restore();
        else location.reload();
      } finally {
        setTimeout(() => { button.disabled = false; button.textContent = 'ลองเชื่อมต่อ Sheet อีกครั้ง'; }, 1800);
      }
    });
    return panel;
  }

  function showFallback() {
    if (settled) return;
    settled = true;
    releaseLoading();
    if (title()) title().textContent = 'ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ';
    if (desc()) desc().textContent = 'ยังไม่ได้รับข้อมูลความก้าวหน้าทางการ ระบบจะไม่เดาหรือสร้างสถานะจากเครื่องนี้';
    if (link()) {
      link().textContent = 'รอข้อมูลจาก Google Sheet';
      link().href = '#';
      link().setAttribute('aria-disabled','true');
      link().onclick = event => event.preventDefault();
    }
    const progress = document.getElementById('progress');
    if (progress) progress.textContent = 'ยังไม่ได้รับความก้าวหน้าจาก Google Sheet';
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      if (/studio_progress_network/i.test(el.textContent || '')) {
        el.textContent = 'ดึงสถานะ Studio/Reflection ไม่สำเร็จ กรุณาลองเชื่อมต่ออีกครั้ง';
      }
    });
    installActions();
  }

  function checkSuccess() {
    const bodyLoading = document.body?.dataset.uxqCloudLoading === '1';
    const text = `${title()?.textContent || ''} ${desc()?.textContent || ''} ${link()?.textContent || ''}`;
    const stillLoading = /กำลังตรวจ|กำลังโหลด|studio_progress_network/i.test(text) || bodyLoading;
    if (!stillLoading) settled = true;
  }

  const started = Date.now();
  const timer = setInterval(() => {
    checkSuccess();
    if (settled) return clearInterval(timer);
    if (Date.now() - started >= TIMEOUT_MS) {
      clearInterval(timer);
      showFallback();
    }
  }, 300);

  window.addEventListener('offline', showFallback);
})();