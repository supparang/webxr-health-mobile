/* CSAI2601 UX Quest • Instructor Content Preview Mission Control v1 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  if (params.get('contentPreview') !== '1') return;

  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  document.body.dataset.uxqContentPreview = '1';
  document.body.dataset.uxqCloudLoading = '0';

  const progress = document.getElementById('progress');
  if (progress) progress.textContent = 'โหมดตรวจเนื้อหา W1–W15 + B1–B4';

  const nextTitle = document.getElementById('nextTitle');
  const nextDesc = document.getElementById('nextDesc');
  const nextLink = document.getElementById('nextLink');
  if (nextTitle) nextTitle.textContent = 'ตรวจหน้าเกมและเนื้อหาครบ 19 Node';
  if (nextDesc) nextDesc.textContent = 'โหมดนี้ไม่อ่าน/ไม่ส่งข้อมูล Google Sheet และไม่เปลี่ยนความก้าวหน้าทางการ';
  if (nextLink) {
    nextLink.href = './csai2601-canonical-node-clean-v1.html?node=W1&contentPreview=1&replay=1&v=content-preview-v1-20260728';
    nextLink.textContent = 'เริ่มตรวจ W1 →';
    nextLink.setAttribute('aria-disabled', 'false');
  }

  const grid = document.getElementById('grid');
  if (!grid) return;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  grid.innerHTML = content.nodes.map(node => {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    url.searchParams.set('node', node.id);
    url.searchParams.set('contentPreview', '1');
    url.searchParams.set('replay', '1');
    url.searchParams.set('v', 'content-preview-v1-20260728');
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

  const heading = document.querySelector('.up-next .section-heading');
  if (heading) {
    const note = document.createElement('p');
    note.textContent = 'CONTENT PREVIEW: เปิดได้ทุก Node เพื่อ QA หน้าเกม เนื้อหา Case, Concept, Mission, Reason Check และ Artifact โดยไม่ใช้ Apps Script';
    heading.appendChild(note);
  }
})();