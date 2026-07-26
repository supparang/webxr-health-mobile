/* CSAI2601 UX Quest • Studio & Reflection Read-only Review v4
 * Completed nodes use a body-level review overlay.
 * The overlay lives outside #uxqCanonicalNode so later player renders cannot delete it.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  if (params.get('review') !== '1') return;

  const VERSION = '20260726-STUDIO-REFLECTION-REVIEW-V4-BODY-OVERLAY';
  let applied = false;
  let bootTimer = 0;

  const text = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();

  function missionControlUrl() {
    const url = new URL('./csai2601-mission-control.html', location.href);
    ['studentId','studentName','section','classroom','courseId','sheet','api','sid','name','device'].forEach(key => {
      const value = params.get(key);
      if (value) url.searchParams.set(key, value);
    });
    url.searchParams.set('v', 'review-overlay-v4-20260726');
    return url.href;
  }

  function installStyle() {
    if (document.getElementById('uxq-review-style-v4')) return;
    const style = document.createElement('style');
    style.id = 'uxq-review-style-v4';
    style.textContent = `
      body[data-uxq-review-ready='1']{overflow:auto!important;background:#061126!important}
      body[data-uxq-review-ready='1'] > :not(#uxqReviewOverlay):not(script):not(style){display:none!important}
      #uxqReviewOverlay{display:block!important;position:relative!important;z-index:2147483000!important;min-height:100vh!important;width:100%!important;padding:28px 16px 56px!important;background:#061126!important;color:#eef6ff!important;box-sizing:border-box!important;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important}
      #uxqReviewOverlay *{box-sizing:border-box}
      .uxq-review-shell{width:min(1040px,100%);margin:0 auto}
      .uxq-review-banner{margin:0 0 18px;padding:18px 20px;border:1px solid rgba(110,231,255,.48);border-radius:18px;background:linear-gradient(135deg,rgba(22,69,112,.96),rgba(35,38,104,.96));box-shadow:0 16px 42px rgba(0,0,0,.24)}
      .uxq-review-banner__top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
      .uxq-review-banner h1{margin:0 0 6px;font-size:clamp(1.35rem,3vw,2rem)}
      .uxq-review-banner p{margin:0;color:#c8daf3;line-height:1.6}
      .uxq-review-badge{display:inline-flex;padding:7px 11px;border-radius:999px;background:rgba(52,211,153,.16);border:1px solid rgba(52,211,153,.42);color:#9ff4d1;font-weight:900;white-space:nowrap}
      .uxq-review-link{display:inline-flex;margin-top:14px;padding:10px 14px;border-radius:11px;background:#6ee7ff;color:#071124;text-decoration:none;font-weight:900}
      .uxq-review-content{display:block!important;margin:0!important;max-width:none!important;width:100%!important}
      .uxq-review-content input[readonly],.uxq-review-content textarea[readonly]{opacity:1!important;cursor:default!important;background:rgba(4,16,39,.78)!important;color:#eef6ff!important}
      .uxq-review-content select:disabled,.uxq-review-content input:disabled{opacity:.84!important;cursor:default!important}
      .uxq-review-hidden{display:none!important}
      .uxq-review-footer{margin-top:18px;display:flex;justify-content:center}
      .uxq-review-footer a{display:inline-flex;padding:12px 18px;border-radius:12px;background:#6ee7ff;color:#071124;text-decoration:none;font-weight:900}
      .uxq-review-error{width:min(760px,100%);margin:12vh auto 0;padding:28px;border:1px solid rgba(248,113,113,.45);border-radius:18px;background:rgba(30,41,70,.96);text-align:center}
      .uxq-review-error h1{margin:0 0 10px}.uxq-review-error p{color:#c8daf3;line-height:1.6}
    `;
    document.head.appendChild(style);
  }

  function makeReadOnly(artifact) {
    artifact.classList.add('uxq-review-content');

    artifact.querySelectorAll('textarea,input[type="text"],input[type="url"],input:not([type])').forEach(el => {
      el.readOnly = true;
      el.setAttribute('aria-readonly', 'true');
      el.tabIndex = -1;
    });

    artifact.querySelectorAll('select,input[type="checkbox"],input[type="radio"]').forEach(el => {
      el.disabled = true;
      el.tabIndex = -1;
    });

    artifact.querySelectorAll('button,a').forEach(el => {
      const label = text(el);
      if (/ส่ง Studio|ส่ง.*Reflection|Submit|สร้าง Master Figma Project|เล่น Mission|เล่นซ้ำ|Self-check/i.test(label)) {
        el.classList.add('uxq-review-hidden');
      }
    });

    artifact.querySelectorAll('[data-studio-check]').forEach(el => {
      const container = el.closest('label,li,div,section,fieldset');
      if (container && /Self-check/i.test(text(container))) container.classList.add('uxq-review-hidden');
    });

    [...artifact.querySelectorAll('section,div,fieldset')].forEach(el => {
      const label = text(el);
      if (/Self-check ก่อนส่ง/i.test(label) && label.length < 1600) el.classList.add('uxq-review-hidden');
    });

    artifact.querySelectorAll('input').forEach(el => {
      if (/figma|project|evidence/i.test(String(el.name || el.id || el.placeholder || ''))) {
        el.readOnly = true;
        el.setAttribute('aria-readonly', 'true');
      }
    });

    artifact.querySelectorAll('*').forEach(el => {
      if (/^W1\s*•?\s*CREATE$/i.test(text(el))) el.classList.add('uxq-review-hidden');
    });
  }

  function ensureOverlay() {
    let overlay = document.getElementById('uxqReviewOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('main');
    overlay.id = 'uxqReviewOverlay';
    overlay.setAttribute('aria-label', 'Studio and Reflection review');
    document.body.appendChild(overlay);
    return overlay;
  }

  function buildOverlay(artifact) {
    const overlay = ensureOverlay();
    const node = String(params.get('node') || '').toUpperCase();
    const backUrl = missionControlUrl();

    overlay.innerHTML = `
      <div class="uxq-review-shell">
        <section class="uxq-review-banner">
          <div class="uxq-review-banner__top">
            <div>
              <h1>Studio Practice และ Weekly Reflection • ${node}</h1>
              <p>Node นี้เสร็จสมบูรณ์แล้ว ข้อมูลด้านล่างเป็นผลงานที่ Google Sheet ยืนยัน และเปิดดูแบบอ่านอย่างเดียว</p>
            </div>
            <span class="uxq-review-badge">✓ Complete 3/3</span>
          </div>
          <a class="uxq-review-link" href="${backUrl}">← กลับ Mission Control</a>
        </section>
        <section class="uxq-review-slot"></section>
        <div class="uxq-review-footer"><a href="${backUrl}">กลับ Mission Control</a></div>
      </div>`;

    overlay.querySelector('.uxq-review-slot').appendChild(artifact);
    document.body.dataset.uxqReviewReady = '1';
    document.documentElement.dataset.uxqReviewReady = '1';
    return true;
  }

  function apply() {
    if (applied) return true;
    installStyle();
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return false;

    makeReadOnly(artifact);
    buildOverlay(artifact);
    applied = true;
    clearInterval(bootTimer);
    requestAnimationFrame(() => window.scrollTo({ top:0, behavior:'auto' }));
    return true;
  }

  function showFallback() {
    if (applied) return;
    installStyle();
    const overlay = ensureOverlay();
    const backUrl = missionControlUrl();
    overlay.innerHTML = `<section class="uxq-review-error"><h1>ยังโหลดผลงาน Review ไม่สำเร็จ</h1><p>ไม่พบ Studio Practice ที่ยืนยันแล้วภายในเวลาที่กำหนด ข้อมูลเดิมใน Google Sheet ไม่ได้ถูกลบ</p><a class="uxq-review-link" href="${backUrl}">กลับ Mission Control</a></section>`;
    document.body.dataset.uxqReviewReady = '1';
  }

  function boot() {
    if (apply()) return;
    let tries = 0;
    bootTimer = setInterval(() => {
      tries += 1;
      if (apply()) return;
      if (tries >= 60) {
        clearInterval(bootTimer);
        showFallback();
      }
    }, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.addEventListener('uxq-mission-resume-studio', apply);
  window.addEventListener('uxq-studio-practice-ready', apply);
  window.UXQStudioReflectionReviewV1 = Object.freeze({ version:VERSION, apply, get applied(){ return applied; } });
})();