/* CSAI2601 UX Quest • Studio & Reflection Read-only Review v1 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  if (params.get('review') !== '1') return;

  const VERSION = '20260726-STUDIO-REFLECTION-REVIEW-V1';
  let applied = false;

  function text(el) {
    return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function installStyle() {
    if (document.getElementById('uxq-review-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-review-style-v1';
    style.textContent = `
      body[data-uxq-review='1'] .uxq-review-hidden{display:none!important}
      .uxq-review-banner{margin:18px auto 14px;max-width:980px;padding:16px 18px;border:1px solid rgba(110,231,255,.48);border-radius:18px;background:linear-gradient(135deg,rgba(22,69,112,.92),rgba(35,38,104,.92));color:#eefbff;box-shadow:0 14px 36px rgba(0,0,0,.2)}
      .uxq-review-banner h2{margin:0 0 5px;font-size:1.25rem}.uxq-review-banner p{margin:0;color:#c8daf3;line-height:1.55}
      .uxq-review-banner a{display:inline-flex;margin-top:12px;padding:10px 14px;border-radius:11px;background:#6ee7ff;color:#071124;text-decoration:none;font-weight:900}
      .artifact[data-studio-practice-v1] input[readonly],.artifact[data-studio-practice-v1] textarea[readonly]{opacity:1!important;cursor:default!important;background:rgba(4,16,39,.72)!important;color:#eef6ff!important}
      .artifact[data-studio-practice-v1] select:disabled,.artifact[data-studio-practice-v1] input:disabled{opacity:.82!important}
    `;
    document.head.appendChild(style);
  }

  function missionControlUrl() {
    const url = new URL('./csai2601-mission-control.html', location.href);
    ['studentId','studentName','section','classroom','courseId','sheet','api','sid','name','device'].forEach(key => {
      const value = params.get(key);
      if (value) url.searchParams.set(key, value);
    });
    return url.href;
  }

  function hideMissionArea(artifact) {
    const candidates = [...document.querySelectorAll('section,article,div')];
    const mission = candidates.find(el => {
      if (artifact && el.contains(artifact)) return false;
      const t = text(el);
      return t.includes('PROGRESS') && t.includes('CORRECT') &&
        (t.includes('UX Problem Scanner') || t.includes('WEEKLY MISSION')) &&
        t.length < 14000;
    });
    if (mission) mission.classList.add('uxq-review-hidden');
  }

  function makeReadOnly(artifact) {
    artifact.querySelectorAll('textarea,input[type="text"],input[type="url"],input:not([type])').forEach(el => {
      el.readOnly = true;
      el.setAttribute('aria-readonly', 'true');
    });
    artifact.querySelectorAll('select,input[type="checkbox"],input[type="radio"]').forEach(el => {
      el.disabled = true;
    });
    artifact.querySelectorAll('button,a').forEach(el => {
      const t = text(el);
      if (/ส่ง Studio|ส่ง.*Reflection|Submit|สร้าง Master Figma Project/i.test(t)) {
        el.classList.add('uxq-review-hidden');
      }
    });
    const selfCheck = [...artifact.querySelectorAll('section,div,fieldset')].find(el => /Self-check ก่อนส่ง/i.test(text(el)) && text(el).length < 1200);
    if (selfCheck) selfCheck.classList.add('uxq-review-hidden');
  }

  function addBanner(artifact) {
    if (document.querySelector('.uxq-review-banner')) return;
    const node = String(params.get('node') || '').toUpperCase();
    const banner = document.createElement('section');
    banner.className = 'uxq-review-banner';
    banner.innerHTML = `<h2>ดู Studio Practice และ Weekly Reflection • ${node}</h2><p>หน้านี้เป็นโหมดอ่านอย่างเดียว ข้อมูลที่แสดงคือผลงานซึ่งส่งและยืนยันผ่าน Google Sheet แล้ว</p><a href="${missionControlUrl()}">← กลับ Mission Control</a>`;
    artifact.parentNode.insertBefore(banner, artifact);
  }

  function apply() {
    installStyle();
    document.body.dataset.uxqReview = '1';
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return false;
    hideMissionArea(artifact);
    makeReadOnly(artifact);
    addBanner(artifact);
    applied = true;
    setTimeout(() => artifact.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
    return true;
  }

  function boot() {
    if (apply()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (apply() || tries >= 30) clearInterval(timer);
    }, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.UXQStudioReflectionReviewV1 = Object.freeze({ version:VERSION, apply, get applied(){ return applied; } });
})();
