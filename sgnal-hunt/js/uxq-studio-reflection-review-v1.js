/* CSAI2601 UX Quest • Studio & Reflection Read-only Review v5
 * Completed nodes render directly from uxq_student_studio_progress data.
 * No dependency on Mission DOM or Studio Artifact creation.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  if (params.get('review') !== '1') return;

  const VERSION = '20260727-STUDIO-REFLECTION-REVIEW-V5-SHEET-DIRECT';
  const nodeId = String(params.get('node') || 'W1').trim().toUpperCase();
  let applied = false;
  let timer = 0;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function missionControlUrl() {
    const url = new URL('./csai2601-mission-control.html', location.href);
    ['studentId','studentName','section','classroom','courseId','sheet','api','sid','name','device'].forEach(key => {
      const value = params.get(key);
      if (value) url.searchParams.set(key, value);
    });
    url.searchParams.set('v', 'review-sheet-direct-v5-20260727');
    return url.href;
  }

  function installStyle() {
    if (document.getElementById('uxq-review-style-v5')) return;
    const style = document.createElement('style');
    style.id = 'uxq-review-style-v5';
    style.textContent = `
      body[data-uxq-review-ready='1']{overflow:auto!important;background:#061126!important}
      body[data-uxq-review-ready='1'] > :not(#uxqReviewOverlay):not(script):not(style){display:none!important}
      #uxqReviewOverlay{display:block!important;position:relative!important;z-index:2147483000!important;min-height:100vh!important;width:100%!important;padding:24px 14px 56px!important;background:#061126!important;color:#eef6ff!important;box-sizing:border-box!important;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important}
      #uxqReviewOverlay *{box-sizing:border-box}
      .uxq-review-shell{width:min(980px,100%);margin:0 auto}
      .uxq-review-banner,.uxq-review-card{border:1px solid rgba(110,231,255,.36);border-radius:18px;background:rgba(15,34,71,.96);box-shadow:0 14px 38px rgba(0,0,0,.22)}
      .uxq-review-banner{padding:18px 20px;margin-bottom:16px;background:linear-gradient(135deg,rgba(22,69,112,.96),rgba(35,38,104,.96))}
      .uxq-review-banner__top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
      .uxq-review-banner h1{margin:0 0 6px;font-size:clamp(1.35rem,4vw,2rem)}
      .uxq-review-banner p,.uxq-review-muted{margin:0;color:#bfd0eb;line-height:1.6}
      .uxq-review-badge{display:inline-flex;padding:7px 11px;border-radius:999px;background:rgba(52,211,153,.16);border:1px solid rgba(52,211,153,.42);color:#9ff4d1;font-weight:900;white-space:nowrap}
      .uxq-review-link{display:inline-flex;margin-top:14px;padding:10px 14px;border-radius:11px;background:#6ee7ff;color:#071124;text-decoration:none;font-weight:900}
      .uxq-review-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .uxq-review-card{padding:18px}.uxq-review-card h2{margin:0 0 14px;font-size:1.2rem}
      .uxq-review-row{display:grid;gap:5px;margin:0 0 13px}.uxq-review-row:last-child{margin-bottom:0}
      .uxq-review-row b{font-size:.86rem;color:#9fb8df}.uxq-review-value{padding:11px 12px;border:1px solid rgba(181,205,255,.2);border-radius:12px;background:rgba(4,16,39,.72);color:#eef6ff;line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap}
      .uxq-review-value a{color:#6ee7ff;font-weight:800}
      .uxq-review-reflection{grid-column:1/-1}
      .uxq-review-footer{margin-top:18px;text-align:center}
      .uxq-review-error{width:min(720px,100%);margin:12vh auto 0;padding:26px;border:1px solid rgba(248,113,113,.45);border-radius:18px;background:rgba(30,41,70,.96);text-align:center}
      @media(max-width:700px){.uxq-review-grid{grid-template-columns:1fr}.uxq-review-reflection{grid-column:auto}#uxqReviewOverlay{padding:16px 12px 42px}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let overlay = document.getElementById('uxqReviewOverlay');
    if (!overlay) {
      overlay = document.createElement('main');
      overlay.id = 'uxqReviewOverlay';
      overlay.setAttribute('aria-label', 'Studio and Reflection review');
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function linkValue(url) {
    const value = String(url || '').trim();
    if (!/^https?:\/\//i.test(value)) return value ? esc(value) : '—';
    return `<a href="${esc(value)}" target="_blank" rel="noopener">เปิดลิงก์ผลงาน ↗</a><br><span class="uxq-review-muted">${esc(value)}</span>`;
  }

  function renderFromData(detail) {
    if (applied || !detail) return false;
    const row = detail.studio || detail.studioData?.nodes?.[String(nodeId).toLowerCase()] || {};
    const projectId = String(row.projectId || '').trim();
    const figmaUrl = String(row.figmaUrl || '').trim();
    const reflection = String(row.reflection || '').trim();
    const submittedAt = String(row.latestSubmittedAt || '').trim();
    const status = String(row.reviewStatus || row.status || 'submitted').trim();

    if (!(row.submitted || row.artifactSubmitted || row.studioSubmitted) || !reflection) return false;

    installStyle();
    const overlay = ensureOverlay();
    const backUrl = missionControlUrl();
    overlay.innerHTML = `
      <div class="uxq-review-shell">
        <section class="uxq-review-banner">
          <div class="uxq-review-banner__top">
            <div><h1>Studio Practice และ Weekly Reflection • ${esc(nodeId)}</h1><p>ผลงานที่ Google Sheet ยืนยันแล้ว แสดงแบบอ่านอย่างเดียว</p></div>
            <span class="uxq-review-badge">✓ Complete 3/3</span>
          </div>
          <a class="uxq-review-link" href="${backUrl}">← กลับ Mission Control</a>
        </section>
        <section class="uxq-review-grid">
          <article class="uxq-review-card">
            <h2>Studio Practice</h2>
            <div class="uxq-review-row"><b>Master Project ID</b><div class="uxq-review-value">${esc(projectId || '—')}</div></div>
            <div class="uxq-review-row"><b>Figma / Evidence</b><div class="uxq-review-value">${linkValue(figmaUrl)}</div></div>
          </article>
          <article class="uxq-review-card">
            <h2>ข้อมูลการส่ง</h2>
            <div class="uxq-review-row"><b>สถานะ</b><div class="uxq-review-value">${esc(status || 'submitted')}</div></div>
            <div class="uxq-review-row"><b>ส่งล่าสุด</b><div class="uxq-review-value">${esc(submittedAt || '—')}</div></div>
          </article>
          <article class="uxq-review-card uxq-review-reflection">
            <h2>Weekly Reflection</h2>
            <div class="uxq-review-value">${esc(reflection)}</div>
          </article>
        </section>
        <div class="uxq-review-footer"><a class="uxq-review-link" href="${backUrl}">กลับ Mission Control</a></div>
      </div>`;

    document.body.dataset.uxqReviewReady = '1';
    document.documentElement.dataset.uxqReviewReady = '1';
    applied = true;
    clearTimeout(timer);
    window.scrollTo({ top:0, behavior:'auto' });
    return true;
  }

  function showFallback(message) {
    if (applied) return;
    installStyle();
    const overlay = ensureOverlay();
    const backUrl = missionControlUrl();
    overlay.innerHTML = `<section class="uxq-review-error"><h1>ยังโหลดผลงาน Review ไม่สำเร็จ</h1><p>${esc(message || 'ไม่พบข้อมูล Studio Practice และ Weekly Reflection จาก Google Sheet')}</p><a class="uxq-review-link" href="${backUrl}">กลับ Mission Control</a></section>`;
    document.body.dataset.uxqReviewReady = '1';
  }

  function boot() {
    if (renderFromData(window.UXQDirectStudioConfirmed)) return;
    timer = setTimeout(() => showFallback('ระบบยังไม่ได้รับข้อมูลผลงานจาก Google Sheet ภายในเวลาที่กำหนด กรุณากลับ Mission Control แล้วลองอีกครั้ง'), 18000);
  }

  window.addEventListener('uxq-direct-studio-confirmed', event => renderFromData(event.detail));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.UXQStudioReflectionReviewV1 = Object.freeze({ version:VERSION, renderFromData, get applied(){ return applied; } });
})();