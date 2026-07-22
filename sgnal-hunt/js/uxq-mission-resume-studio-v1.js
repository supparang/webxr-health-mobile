/* CSAI2601 UX Quest • Mission-to-Studio Resume Controller v3
 * Opens Studio only after the Three-Part Tracker shows Google Sheet-confirmed mission completion.
 * Local progress may display attempts, but can never authorize official Studio access.
 */
(() => {
  'use strict';

  const VERSION = '20260722-MISSION-RESUME-STUDIO-V3';
  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const nodeKey = nodeId.toLowerCase();
  const replay = /^(1|true|yes)$/i.test(String(params.get('replay') || ''));
  const root = document.getElementById('uxqCanonicalNode') || document.body;
  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const node = CONTENT?.byId?.(nodeId) || (CONTENT?.nodes || []).find(item => String(item.id || '').toUpperCase() === nodeId);
  if (!node || replay) return;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function missionRecord() {
    try { return window.UXQProgress?.get?.()?.missions?.[nodeKey] || {}; }
    catch (_) { return {}; }
  }

  function sheetConfirmed() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    const first = tracker?.querySelector('.uxq-3part__item');
    const detail = String(first?.textContent || '');
    return Boolean(first?.dataset?.state === 'done' && /Google Sheet ยืนยัน mission_completed/i.test(detail));
  }

  function contextUrl(path, extras={}) {
    const url = new URL(path, location.href);
    ['device','studentId','studentName','section','sid','name'].forEach(key => {
      const value = params.get(key);
      if (value && !url.searchParams.has(key)) url.searchParams.set(key,value);
    });
    Object.entries(extras).forEach(([key,value]) => url.searchParams.set(key,String(value)));
    url.searchParams.set('v','mission-resume-studio-v3-20260722');
    return `${url.pathname}${url.search}`;
  }

  function replayUrl() {
    return contextUrl(location.href,{replay:'1'});
  }

  function missionControlUrl() {
    return contextUrl('./csai2601-mission-control.html');
  }

  function renderResume(record) {
    if (root.dataset.uxqMissionResumeStudio === '1') return;
    root.dataset.uxqMissionResumeStudio = '1';
    const stars = Math.max(Number(record.bestStars || 0), Number(record.lastResult?.stars || 0));
    const score = Math.max(Number(record.bestScore || 0), Number(record.lastResult?.score || 0));
    const fields = node.artifactChecklist || ['หลักฐานจากผู้ใช้','สิ่งที่ตัดสินใจออกแบบ/แก้ไข','วิธีพิสูจน์ผล'];

    root.innerHTML = `<div class="shell">
      <div class="top">
        <a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>CSAI2601 UX Quest</span></a>
        <span class="pill">Resume • ${esc(nodeId)}</span>
      </div>
      <section class="panel">
        <div class="results">
          <p class="kicker">SHEET-CONFIRMED MISSION • ${esc(nodeId)}</p>
          <div class="stars">${'★'.repeat(Math.max(0, Math.min(3, stars || 2)))}${'☆'.repeat(Math.max(0, 3 - Math.min(3, stars || 2)))}</div>
          <h1>${esc(nodeId)} ผ่าน Mission แล้ว</h1>
          <p>Google Sheet ยืนยัน mission_completed แล้ว จึงเปิด Studio Practice และ Weekly Reflection อย่างเป็นทางการ</p>
          <div class="result-grid">
            <div><b>${Number(score || 0)}</b><span>Cached Best Score</span></div>
            <div><b>${Number(stars || 2)}★</b><span>Cached Best Stars</span></div>
            <div><b>ยืนยันแล้ว</b><span>Mission</span></div>
            <div><b>เปิดแล้ว</b><span>Studio</span></div>
            <div><b>Sheet</b><span>Authority</span></div>
          </div>
          <section class="artifact" data-resume-studio-placeholder="1">
            <p class="kicker">Studio Practice • ${esc(nodeId)}</p>
            <h2>${esc(node.artifact || 'Studio Artifact')}</h2>
            <p>กำลังเปิดแบบฝึก Studio Practice และ Reflection จากผล Mission ที่ Google Sheet ยืนยันแล้ว</p>
            ${fields.slice(0,5).map((field,index) => `<label><b>${esc(field)}</b><textarea data-artifact-field="${index}" placeholder="เขียนจากหลักฐานและเหตุผล UX"></textarea></label>`).join('')}
          </section>
          <div class="actions">
            <a class="btn secondary" href="${replayUrl()}">เล่น Mission ซ้ำด้วย Case ใหม่</a>
            <a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a>
          </div>
        </div>
      </section>
    </div>`;
    window.dispatchEvent(new CustomEvent('uxq-mission-resume-studio', { detail:{ nodeId, record, authority:'sheet' } }));
  }

  let timer = 0;
  function check() {
    clearTimeout(timer);
    if (sheetConfirmed()) {
      renderResume(missionRecord());
      return;
    }
    timer = setTimeout(check, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once:true });
  else check();
  window.addEventListener('uxq-progress-updated', check);
  window.addEventListener('uxq-sheet-progress-restored', check);
  window.addEventListener('uxq-cloud-progress-restored', check);
  window.addEventListener('uxq-progress-restored', check);
  window.addEventListener('uxq-mission-completed', check);
  new MutationObserver(check).observe(root, { childList:true, subtree:true });

  window.UXQMissionResumeStudioV1 = Object.freeze({ version:VERSION, check, sheetConfirmed });
})();