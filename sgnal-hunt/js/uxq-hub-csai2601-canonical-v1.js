/* CSAI2601 UX Quest • Mission Control Sheet Authority v5
 * Google Sheet restore response is the only source used to render official
 * completion, unlock state and next mission.
 * localStorage/UXQProgress is not consulted for official Mission Control state.
 */
(() => {
  'use strict';

  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const VERSION = 'sheet-authority-v5-20260714';
  const NODE_ICONS = {
    W1:'🔎', W2:'🧭', W3:'🧠', W4:'🕵️', W5:'💡', W6:'🗺️', W7:'📐',
    W8:'🧩', W9:'🧱', W10:'📱', W11:'🎨', W12:'⚡', W13:'🔗', W14:'🧪', W15:'🏁',
    B1:'👹', B2:'🐉', B3:'🛡️', B4:'🔥'
  };
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const FALLBACK_NODES = ORDER.map((key, index) => {
    const id = key.toUpperCase();
    return { id, key, order:index + 1, type:key.startsWith('b') ? 'boss' : 'week', title:id, missionTitle:id, focus:'CSAI2601 canonical mission', artifact:'Studio Artifact' };
  });
  const nodes = (CONTENT?.nodes?.length ? CONTENT.nodes : FALLBACK_NODES)
    .map((node, index) => ({ ...node, key:String(node.id || '').toLowerCase(), order:Number(node.order || index + 1) }))
    .sort((a, b) => a.order - b.order);

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
  const nodeIcon = node => NODE_ICONS[String(node?.id || '').toUpperCase()] || 'UX';
  const stars = value => {
    const n = Math.max(0, Math.min(3, Number(value || 0)));
    return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
  };
  const launchUrl = node => `./csai2601-canonical-node-clean-v1.html?node=${encodeURIComponent(String(node.id || '').toUpperCase())}&v=${encodeURIComponent(VERSION)}`;

  let snapshot = null;

  function normalizedMission(raw) {
    const remote = raw || {};
    const passed = Boolean(remote.completed || remote.passed || Number(remote.bestStars || remote.stars || 0) >= 2);
    return {
      passed,
      stars:Number(remote.bestStars || remote.stars || 0),
      score:Number(remote.bestScore || remote.score || 0),
      attempts:Number(remote.attempts || 0)
    };
  }

  function missionRecord(key) {
    return normalizedMission(snapshot?.missions?.[String(key || '').toLowerCase()]);
  }

  function passed(key) {
    return missionRecord(key).passed;
  }

  function canonicalNextKey() {
    const apiNext = String(snapshot?.nextMission || '').trim().toLowerCase();
    return ORDER.includes(apiNext) ? apiNext : (ORDER.find(key => !passed(key)) || '');
  }

  function available(key) {
    if (!snapshot?.ok) return false;
    const index = ORDER.indexOf(key);
    if (index < 0) return false;
    if (index === 0) return true;
    if (passed(key)) return true;
    return key === canonicalNextKey();
  }

  function stateOf(node) {
    const record = missionRecord(node.key);
    const isPassed = record.passed;
    const isAvailable = available(node.key);
    return {
      ...record,
      isPassed,
      isAvailable,
      label:isPassed ? 'ผ่านแล้ว' : isAvailable ? 'พร้อมเริ่ม' : 'ล็อกอยู่'
    };
  }

  function card(node) {
    const boss = node.type === 'boss' || node.key.startsWith('b');
    const state = stateOf(node);
    const index = ORDER.indexOf(node.key);
    const previousId = index > 0 ? ORDER[index - 1].toUpperCase() : '';
    const url = state.isAvailable ? launchUrl(node) : '#';
    const hint = state.isPassed
      ? `${stars(state.stars)} • ${state.attempts || 1} attempt${state.attempts === 1 ? '' : 's'} • เล่นซ้ำได้`
      : state.isAvailable
        ? (node.artifact ? `Artifact: ${node.artifact}` : 'ต้องผ่าน 2★ เพื่อไปต่อ')
        : `ต้องผ่าน ${previousId || 'ด่านก่อนหน้า'} จาก Sheet ก่อน`;
    const rounds = Array.isArray(node.missionRounds) ? node.missionRounds.slice(0, 3).join(' → ') : '';
    const desc = state.isAvailable
      ? `${node.focus || ''}${rounds ? ` • ${rounds}` : ''}`
      : 'ล็อกตามลำดับ Canonical Path โดยใช้หลักฐาน mission_completed จาก Google Sheet';

    return `<article class="${boss ? 'boss-preview' : 'compact-stage'} campaign-preview ${state.isAvailable ? 'is-ready' : 'is-locked'} ${state.isPassed ? 'is-cleared' : ''}" data-node="${esc(node.id)}">
      <div class="${boss ? 'boss-preview__top' : 'compact-stage__top'}">
        <span class="stage-number">${esc(node.id)}</span><span class="stage-state">${esc(state.label)}</span>
      </div>
      <div class="${boss ? 'boss-preview__body' : 'compact-stage__content'}">
        <span class="${boss ? 'boss-preview__icon' : 'compact-stage__icon'}" aria-hidden="true">${nodeIcon(node)}</span>
        <div><p class="compact-stage__type">${boss ? 'BOSS GATE' : 'WEEKLY MISSION'}</p><h3>${esc(node.missionTitle || node.title)}</h3><p>${esc(desc)}</p></div>
      </div>
      <div class="${boss ? 'boss-preview__footer' : 'compact-stage__footer'}">
        <span>${esc(hint)}</span>
        <a class="campaign-launch ${state.isAvailable ? '' : 'is-disabled'}" href="${esc(url)}" aria-disabled="${state.isAvailable ? 'false' : 'true'}">${state.isPassed ? 'เล่นซ้ำ' : state.isAvailable ? 'เริ่มภารกิจ' : 'ล็อกอยู่'}</a>
      </div>
    </article>`;
  }

  function renderLoading(message) {
    if ($('#progress')) $('#progress').textContent = 'กำลังดึงจาก Sheet…';
    if ($('#nextTitle')) $('#nextTitle').textContent = message || 'กำลังตรวจความก้าวหน้าจาก Google Sheet';
    if ($('#nextDesc')) $('#nextDesc').textContent = 'ระบบยังไม่ปลดล็อกด่านจนกว่าจะได้รับคำตอบจาก Sheet';
    if ($('#nextLink')) {
      $('#nextLink').href = '#';
      $('#nextLink').textContent = 'กำลังโหลด…';
      $('#nextLink').setAttribute('aria-disabled', 'true');
    }
    const grid = $('#grid');
    if (grid) grid.innerHTML = '<div class="campaign-separator">Google Sheet เป็นแหล่งข้อมูลหลัก • กำลังโหลดสถานะผู้เรียน</div>';
  }

  function drawFromSheet(result) {
    snapshot = result && result.ok ? result : null;
    if (!snapshot) {
      renderLoading('ยังไม่ได้รับสถานะจาก Google Sheet');
      return;
    }

    const canonicalPassed = Array.isArray(snapshot?.diagnostics?.canonicalPassedMissionIds)
      ? snapshot.diagnostics.canonicalPassedMissionIds.map(value => String(value).toLowerCase())
      : ORDER.filter(key => passed(key));
    const completed = canonicalPassed.length;
    const nextKey = canonicalNextKey();
    const next = nodes.find(node => node.key === nextKey) || null;

    if ($('#progress')) $('#progress').textContent = `${completed}/${ORDER.length} ด่าน • Sheet`;
    const grid = $('#grid');
    if (grid) {
      grid.innerHTML = `<div class="campaign-separator">CSAI2601 • Sheet Authority v5 • ${completed}/${ORDER.length} nodes • policy ${esc(snapshot?.diagnostics?.policy || 'mission_completed_contiguous')}</div>` + nodes.map(card).join('');
      grid.querySelectorAll('a[aria-disabled="true"]').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    }

    if (next) {
      if ($('#nextTitle')) $('#nextTitle').textContent = `${next.id} • ${next.missionTitle || next.title}`;
      if ($('#nextDesc')) $('#nextDesc').textContent = `${next.focus || ''}${next.artifact ? ` • ส่งงาน: ${next.artifact}` : ''}`;
      if ($('.current-card__icon')) $('.current-card__icon').textContent = nodeIcon(next);
      if ($('#nextLink')) {
        $('#nextLink').href = launchUrl(next);
        $('#nextLink').textContent = 'เริ่มภารกิจ →';
        $('#nextLink').setAttribute('aria-disabled', 'false');
      }
    } else {
      if ($('#nextTitle')) $('#nextTitle').textContent = 'ผ่านครบทุกด่านแล้ว';
      if ($('#nextDesc')) $('#nextDesc').textContent = 'สถานะยืนยันจาก Google Sheet';
      if ($('#nextLink')) {
        $('#nextLink').href = '#';
        $('#nextLink').textContent = 'ครบ 19/19 ด่าน';
        $('#nextLink').setAttribute('aria-disabled', 'true');
      }
    }

    document.body.dataset.uxqCloudLoading = '0';
  }

  function boot() {
    renderLoading();
    window.addEventListener('uxq-sheet-progress-restored', event => drawFromSheet(event.detail));
    // Intentionally do not listen to uxq-progress-updated or storage events.
    // Official Mission Control UI must only change after a Sheet restore response.
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.UXQMissionControlSheetAuthority = Object.freeze({ drawFromSheet, version:VERSION });
})();