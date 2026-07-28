/* CSAI2601 UX Quest • Instructor Content Preview Mission Control v5
 * Preview is a self-contained curriculum QA mode.
 * - Optional local learner profile for navigation testing.
 * - No Apps Script, no Google Sheet read/write, no official progress changes.
 * - Renders all W1–W15 + B1–B4 from canonical content.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const studentMode = params.get('studentMode') === '1';
  const previewMode = !studentMode && params.get('contentPreview') !== '0';
  if (!previewMode) return;

  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const VERSION = 'content-preview-v5-20260728';
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function profile() {
    try { return window.UXQIdentity?.get?.() || {}; } catch (_) { return {}; }
  }

  function profileComplete(p) {
    return Boolean(p && p.studentId && p.studentName && p.section);
  }

  function nodeHref(nodeId) {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    const p = profile();
    url.searchParams.set('node', nodeId);
    url.searchParams.set('contentPreview', '1');
    url.searchParams.set('replay', '1');
    url.searchParams.set('v', VERSION);
    if (p.studentId) url.searchParams.set('studentId', p.studentId);
    if (p.studentName) url.searchParams.set('studentName', p.studentName);
    if (p.section) url.searchParams.set('section', p.section);
    return url.pathname + url.search;
  }

  function nodeCards() {
    return content.nodes.map(node => {
      const concepts = (node.concepts || []).slice(0, 6).join(' • ');
      const scenario = node.casePrompt || node.bossScenario || '';
      const typeLabel = node.type === 'boss' ? 'BOSS GATE' : 'WEEKLY MISSION';
      return `<article class="campaign-card" data-node-id="${esc(node.id.toLowerCase())}">
        <div class="campaign-card__meta"><span>${esc(node.id)}</span><span>${typeLabel}</span></div>
        <h3>${esc(node.missionTitle)}</h3>
        <p class="campaign-card__title"><strong>${esc(node.title)}</strong></p>
        <p>${esc(node.focus)}</p>
        <p><strong>Concept:</strong> ${esc(concepts)}</p>
        <p><strong>Case:</strong> ${esc(scenario)}</p>
        <p><strong>Artifact:</strong> ${esc(node.artifact)}</p>
        <a class="campaign-launch" href="${nodeHref(node.id)}">เปิดตรวจ ${esc(node.id)} →</a>
      </article>`;
    }).join('');
  }

  function ensureProfileCard() {
    let card = document.getElementById('uxqPreviewProfile');
    if (!card) {
      card = document.createElement('section');
      card.id = 'uxqPreviewProfile';
      card.className = 'uxq-preview-profile';
      const overview = document.querySelector('.overview-grid');
      overview?.parentNode?.insertBefore(card, overview);
    }

    const p = profile();
    const detail = profileComplete(p)
      ? `${esc(p.studentName)} • ${esc(p.studentId)} • Section ${esc(p.section)}`
      : 'ยังไม่ได้ตั้ง Profile สำหรับการทดสอบเส้นทาง';

    card.innerHTML = `
      <div class="uxq-preview-profile__copy">
        <span class="eyebrow">LOCAL TEST PROFILE</span>
        <strong>${detail}</strong>
        <small>ใช้เฉพาะทดสอบการแสดงชื่อและการส่งต่อ URL ใน Content Preview ไม่ใช่ข้อมูลความก้าวหน้าทางการ</small>
      </div>
      <div class="uxq-preview-profile__actions">
        <button type="button" data-profile-edit>${profileComplete(p) ? 'แก้ไข Profile' : 'ตั้งค่า Profile'}</button>
        ${profileComplete(p) ? '<button type="button" data-profile-clear class="is-secondary">ล้าง Profile</button>' : ''}
      </div>`;

    card.querySelector('[data-profile-edit]')?.addEventListener('click', async () => {
      await window.UXQIdentity?.open?.({ title: 'ตั้งค่า Profile สำหรับทดสอบ Content Preview', allowGuest:false });
      ensureProfileCard();
      renderGrid();
    });
    card.querySelector('[data-profile-clear]')?.addEventListener('click', () => {
      window.UXQIdentity?.clear?.();
      ensureProfileCard();
      renderGrid();
    });
  }

  function ensurePreviewStyles() {
    if (document.getElementById('uxq-preview-v5-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-preview-v5-style';
    style.textContent = `
      .uxq-preview-profile{margin:16px 0 20px;padding:16px 18px;border:1px solid rgba(116,224,255,.32);border-radius:18px;background:rgba(8,25,55,.72);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .uxq-preview-profile__copy{display:grid;gap:5px;min-width:0}.uxq-preview-profile__copy strong{font-size:1rem;color:#f3f7ff}.uxq-preview-profile__copy small{color:#aebddd;line-height:1.5}
      .uxq-preview-profile__actions{display:flex;gap:9px;flex-wrap:wrap}.uxq-preview-profile button{min-height:42px;padding:9px 14px;border:1px solid rgba(112,220,255,.5);border-radius:12px;background:#6fe5f5;color:#06182c;font:inherit;font-weight:900}.uxq-preview-profile button.is-secondary{background:transparent;color:#eaf3ff}
      body[data-uxq-content-preview="1"] [data-sheet-status],body[data-uxq-content-preview="1"] .sheet-status-card,body[data-uxq-content-preview="1"] .studio-status-panel{display:none!important}
      @media(max-width:640px){.uxq-preview-profile{margin:12px 14px 18px;padding:14px}.uxq-preview-profile__actions,.uxq-preview-profile button{width:100%}.campaign-card{overflow-wrap:anywhere}.campaign-card p{line-height:1.55}}
    `;
    document.head.appendChild(style);
  }

  function renderGrid() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = nodeCards();
    grid.dataset.contentPreviewRendered = '1';
  }

  function removeSheetCopy() {
    document.querySelectorAll('.section-heading p, .up-next > p, [data-content-preview-note]').forEach(el => {
      const text = String(el.textContent || '');
      if (/Google Sheet|กำลังโหลดสถานะ Mission|Apps Script/i.test(text)) el.remove();
    });
    const heading = document.querySelector('.up-next .section-heading');
    if (heading && !heading.querySelector('[data-preview-note-v5]')) {
      const note = document.createElement('p');
      note.dataset.previewNoteV5 = '1';
      note.textContent = 'เปิดตรวจได้ทุก Node เพื่อ QA หน้าเกม เนื้อหา Case, Concept, Mission, Reason Check, Studio/Artifact และ Weekly Reflection';
      heading.appendChild(note);
    }
  }

  function applyPreview() {
    ensurePreviewStyles();
    document.body.dataset.uxqContentPreview = '1';
    document.body.dataset.uxqCloudLoading = '0';

    const progress = document.getElementById('progress');
    if (progress) progress.textContent = 'Content Preview • 19 Node • ไม่ใช้ Sheet';

    const currentStatus = document.querySelector('.current-card__status span');
    if (currentStatus) currentStatus.textContent = 'CONTENT PREVIEW • LOCAL QA MODE';

    const nextTitle = document.getElementById('nextTitle');
    const nextDesc = document.getElementById('nextDesc');
    const nextLink = document.getElementById('nextLink');
    if (nextTitle) nextTitle.textContent = 'ตรวจหน้าเกมและเนื้อหาครบ 19 Node';
    if (nextDesc) nextDesc.textContent = 'ตรวจ W1–W15 และ B1–B4 โดยไม่อ่านหรือส่ง Google Sheet';
    if (nextLink) {
      nextLink.href = nodeHref('W1');
      nextLink.textContent = 'เริ่มตรวจ W1 →';
      nextLink.setAttribute('aria-disabled', 'false');
      nextLink.classList.remove('is-disabled');
    }

    ensureProfileCard();
    removeSheetCopy();
    renderGrid();
  }

  applyPreview();
  window.addEventListener('uxq-profile-updated', () => {
    ensureProfileCard();
    renderGrid();
  });

  const observer = new MutationObserver(() => {
    removeSheetCopy();
    const grid = document.getElementById('grid');
    if (grid && grid.dataset.contentPreviewRendered !== '1') renderGrid();
  });
  observer.observe(document.body, { childList:true, subtree:true });

  window.UXQContentPreviewMissionControl = Object.freeze({ version:VERSION, active:true, refresh:applyPreview });
})();