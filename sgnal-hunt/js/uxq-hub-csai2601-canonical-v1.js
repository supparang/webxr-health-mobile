/* CSAI2601 canonical Mission Control — rendered from uxq-csai2601-canonical-content-v1.js
 * Course path: W1-W15 + B1-B4. No B5.
 * All nodes launch through clean canonical student build with cache-busted logo/static packs.
 */
(() => {
  'use strict';

  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const VERSION = 'clean-v37-logo-static-20260709';
  const FALLBACK_NODES = [
    'W1','W2','W3','B1','W4','W5','W6','W7','B2','W8','W9','W10','W11','B3','W12','W13','W14','B4','W15'
  ].map((id, index) => ({ id, order:index + 1, type:id.startsWith('B') ? 'boss' : 'week', title:id, missionTitle:id, focus:'CSAI2601 canonical mission', artifact:'Studio Artifact' }));

  const nodes = (CONTENT?.nodes && CONTENT.nodes.length ? CONTENT.nodes : FALLBACK_NODES)
    .map((node, index) => ({ ...node, key:String(node.id || '').toLowerCase(), order:Number(node.order || index + 1) }))
    .sort((a, b) => a.order - b.order);

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
  const stars = (value) => {
    const n = Math.max(0, Math.min(3, Number(value || 0)));
    return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
  };
  const launchUrl = (node) => `./csai2601-canonical-node-clean-v1.html?node=${encodeURIComponent(String(node.id || '').toUpperCase())}&v=${encodeURIComponent(VERSION)}`;

  function progress() { return window.UXQProgress?.get?.() || { missions:{} }; }
  function missionRecord(progressData, key) { return progressData?.missions?.[key] || progressData?.missions?.[String(key).toUpperCase()] || {}; }
  function passed(progressData, key) { return Number(missionRecord(progressData, key).bestStars || 0) >= 2; }
  function available(progressData, index) { return index === 0 || passed(progressData, nodes[index - 1]?.key); }
  function statusOf(progressData, node, index) {
    const record = missionRecord(progressData, node.key);
    const isPassed = passed(progressData, node.key);
    const isAvailable = available(progressData, index);
    return {
      isPassed,
      isAvailable,
      stars:Number(record.bestStars || 0),
      score:Number(record.bestScore || 0),
      attempts:Number(record.attempts || 0),
      label:isPassed ? 'ผ่านแล้ว' : isAvailable ? 'พร้อมเริ่ม' : 'ล็อกอยู่'
    };
  }
  function nextNode(progressData) {
    return nodes.find((node, index) => available(progressData, index) && !passed(progressData, node.key)) || nodes[nodes.length - 1] || null;
  }

  function card(node, index, progressData) {
    const boss = node.type === 'boss' || node.key.startsWith('b');
    const state = statusOf(progressData, node, index);
    const previous = nodes[index - 1];
    const url = state.isAvailable ? launchUrl(node) : '#';
    const typeLabel = boss ? 'BOSS GATE' : 'WEEKLY MISSION';
    const hint = state.isPassed
      ? `${stars(state.stars)} • เล่นซ้ำได้ด้วย case variant ใหม่`
      : state.isAvailable
        ? `${node.artifact ? `Artifact: ${node.artifact}` : 'ต้องผ่าน 2★ เพื่อไปต่อ'}`
        : `ต้องผ่าน ${previous?.id || 'ด่านก่อนหน้า'} ที่ 2★ ก่อน`;
    const rounds = Array.isArray(node.missionRounds) ? node.missionRounds.slice(0, 3).join(' → ') : '';
    const desc = state.isAvailable
      ? `${node.focus || ''}${rounds ? ` • ${rounds}` : ''}`
      : 'ปลดล็อกตามลำดับเพื่อรักษาเส้นทางเรียนรู้จากหลักฐานไปสู่ prototype และ evaluation';

    return `<article class="${boss ? 'boss-preview' : 'compact-stage'} campaign-preview ${state.isAvailable ? 'is-ready' : 'is-locked'} ${state.isPassed ? 'is-cleared' : ''}" data-node="${esc(node.id)}">
      <div class="${boss ? 'boss-preview__top' : 'compact-stage__top'}">
        <span class="stage-number">${esc(node.id)}</span>
        <span class="stage-state">${esc(state.label)}</span>
      </div>
      <div class="${boss ? 'boss-preview__body' : 'compact-stage__content'}">
        <span class="${boss ? 'boss-preview__icon' : 'compact-stage__icon'}">${boss ? '⚔' : '◌'}</span>
        <div>
          <p class="compact-stage__type">${typeLabel}</p>
          <h3>${esc(node.missionTitle || node.title)}</h3>
          <p>${esc(desc)}</p>
        </div>
      </div>
      <div class="${boss ? 'boss-preview__footer' : 'compact-stage__footer'}">
        <span>${esc(hint)}</span>
        <a class="campaign-launch ${state.isAvailable ? '' : 'is-disabled'}" href="${esc(url)}" aria-disabled="${state.isAvailable ? 'false' : 'true'}">${state.isPassed ? 'เล่นซ้ำ' : state.isAvailable ? 'เริ่มภารกิจ' : 'ล็อกอยู่'}</a>
      </div>
    </article>`;
  }

  function draw() {
    const grid = $('#grid') || $('.up-next-grid');
    const progressData = progress();
    const done = nodes.filter((node) => passed(progressData, node.key)).length;
    const total = nodes.length;
    const progressText = `${done}/${total} ด่าน`;
    if ($('#progress')) $('#progress').textContent = progressText;

    if (grid) {
      grid.innerHTML = `<div class="campaign-separator">CSAI2601 • 15 Weeks + 4 Boss Gates • ${total} nodes • canonical player ${esc(CONTENT?.version || 'fallback')}</div>` +
        nodes.map((node, index) => card(node, index, progressData)).join('');
      grid.querySelectorAll('a[aria-disabled="true"]').forEach((link) => link.addEventListener('click', (event) => event.preventDefault()));
    }

    const next = nextNode(progressData);
    if (next) {
      const nextState = statusOf(progressData, next, nodes.indexOf(next));
      if ($('#nextTitle')) $('#nextTitle').textContent = `${next.id} • ${next.missionTitle || next.title}`;
      if ($('#nextDesc')) $('#nextDesc').textContent = `${next.focus || ''}${next.artifact ? ` • ส่งงาน: ${next.artifact}` : ''}`;
      if ($('#nextLink')) {
        $('#nextLink').href = launchUrl(next);
        $('#nextLink').textContent = nextState.isPassed ? 'เล่นซ้ำ →' : 'เริ่มภารกิจ →';
      }
    }
  }

  function boot() {
    draw();
    window.addEventListener('uxq-progress-updated', draw);
    window.addEventListener('storage', draw);
    window.addEventListener('csai2601:uxq-content-ready', draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
