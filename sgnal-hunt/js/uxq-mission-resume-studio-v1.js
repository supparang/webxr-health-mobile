/* CSAI2601 UX Quest • Mission-to-Studio Resume Controller v1
 * Passed mission from official restored progress opens Studio Practice directly.
 * Replay remains optional via ?replay=1.
 */
(() => {
  'use strict';

  const VERSION = '20260721-MISSION-RESUME-STUDIO-V1';
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

  function isPassed(record) {
    return Boolean(
      record.completed || record.passed ||
      Number(record.bestStars || 0) >= 2 ||
      Number(record.lastResult?.stars || 0) >= 2 ||
      record.lastResult?.passed
    );
  }

  function replayUrl() {
    const url = new URL(location.href);
    url.searchParams.set('replay', '1');
    url.searchParams.set('v', 'mission-resume-studio-v1-20260721');
    return `${url.pathname}${url.search}`;
  }

  function missionControlUrl() {
    return './csai2601-mission-control.html?v=mission-resume-studio-v1-20260721';
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
          <p class="kicker">MISSION COMPLETE • ${esc(nodeId)}</p>
          <div class="stars">${'★'.repeat(Math.max(0, Math.min(3, stars)))}${'☆'.repeat(Math.max(0, 3 - Math.min(3, stars)))}</div>
          <h1>${esc(nodeId)} ผ่าน Mission แล้ว</h1>
          <p>Google Sheet/Progress ยืนยันผล Mission แล้ว จึงไม่ต้องตอบเกมซ้ำ ให้ทำ Studio Practice และ Weekly Reflection ต่อได้ทันที</p>
          <div class="result-grid">
            <div><b>${Number(score || 0)}</b><span>Best Score</span></div>
            <div><b>${Number(stars || 0)}★</b><span>Best Stars</span></div>
            <div><b>ผ่านแล้ว</b><span>Mission</span></div>
            <div><b>ต่อเลย</b><span>Studio</span></div>
            <div><b>Sheet</b><span>Authority</span></div>
          </div>
          <section class="artifact" data-resume-studio-placeholder="1">
            <p class="kicker">Studio Practice • ${esc(nodeId)}</p>
            <h2>${esc(node.artifact || 'Studio Artifact')}</h2>
            <p>กำลังเปิดแบบฝึก Studio Practice และ Reflection จากผล Mission ที่ผ่านแล้ว</p>
            ${fields.slice(0,5).map((field,index) => `<label><b>${esc(field)}</b><textarea data-artifact-field="${index}" placeholder="เขียนจากหลักฐานและเหตุผล UX"></textarea></label>`).join('')}
          </section>
          <div class="actions">
            <a class="btn secondary" href="${replayUrl()}">เล่น Mission ซ้ำด้วย case ใหม่</a>
            <a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a>
          </div>
        </div>
      </section>
    </div>`;
    window.dispatchEvent(new CustomEvent('uxq-mission-resume-studio', { detail:{ nodeId, record } }));
  }

  let timer = 0;
  let attempts = 0;
  function check() {
    clearTimeout(timer);
    attempts += 1;
    const record = missionRecord();
    if (isPassed(record)) {
      renderResume(record);
      return;
    }
    if (attempts < 40) timer = setTimeout(check, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once:true });
  else check();
  window.addEventListener('uxq-cloud-progress-restored', check);
  window.addEventListener('uxq-progress-restored', check);

  window.UXQMissionResumeStudioV1 = Object.freeze({ version:VERSION, check, isPassed });
})();