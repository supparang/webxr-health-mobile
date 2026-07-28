/* CSAI2601 UX Quest • Instructor Content Preview Mission Control v4
 * Student Sheet mode is the default.
 * Content Preview is enabled only with ?contentPreview=1.
 * Preview never writes progress and never changes official unlock status.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const previewMode = params.get('contentPreview') === '1';
  if (!previewMode) return;

  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function nodeCards() {
    return content.nodes.map(node => {
      const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
      url.searchParams.set('node', node.id);
      url.searchParams.set('contentPreview', '1');
      url.searchParams.set('replay', '1');
      url.searchParams.set('v', 'content-preview-v4-20260728');
      const concepts = (node.concepts || []).slice(0,5).join(' • ');
      const scenario = node.casePrompt || node.bossScenario || '';
      return `<article class="campaign-card" data-node-id="${esc(node.id.toLowerCase())}">
        <div class="campaign-card__meta"><span>${esc(node.id)}</span><span>${node.type === 'boss' ? 'BOSS GATE' : 'WEEKLY MISSION'}</span></div>
        <h3>${esc(node.missionTitle)}</h3>
        <p><strong>${esc(node.title)}</strong></p>
        <p>${esc(node.focus)}</p>
        <p>${esc(concepts)}</p>
        <p>${esc(scenario)}</p>
        <p><strong>Artifact:</strong> ${esc(node.artifact)}</p>
        <a class="campaign-launch" href="${url.pathname + url.search}">เปิดตรวจ ${esc(node.id)} →</a>
      </article>`;
    }).join('');
  }

  function applyPreview() {
    document.body.dataset.uxqContentPreview = '1';
    document.body.dataset.uxqCloudLoading = '0';

    const progress = document.getElementById('progress');
    if (progress) progress.textContent = 'โหมดตรวจเนื้อหา W1–W15 + B1–B4';

    const nextTitle = document.getElementById('nextTitle');
    const nextDesc = document.getElementById('nextDesc');
    const nextLink = document.getElementById('nextLink');
    if (nextTitle) nextTitle.textContent = 'ตรวจหน้าเกมและเนื้อหาครบ 19 Node';
    if (nextDesc) nextDesc.textContent = 'Content Preview ไม่เชื่อม ไม่อ่าน และไม่ส่ง Google Sheet';
    if (nextLink) {
      nextLink.href = './csai2601-canonical-node-clean-v1.html?node=W1&contentPreview=1&replay=1&v=content-preview-v4-20260728';
      nextLink.textContent = 'เริ่มตรวจ W1 →';
      nextLink.setAttribute('aria-disabled', 'false');
      nextLink.classList.remove('is-disabled');
    }

    const currentStatus = document.querySelector('.current-card__status span');
    if (currentStatus) currentStatus.textContent = 'CONTENT PREVIEW • ไม่ใช้ Google Sheet';

    const grid = document.getElementById('grid');
    if (grid) {
      grid.innerHTML = nodeCards();
      grid.dataset.contentPreviewRendered = '1';
    }
  }

  applyPreview();
  window.UXQContentPreviewMissionControl = Object.freeze({ version:'content-preview-v4-20260728', active:true, refresh:applyPreview });
})();