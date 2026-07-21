/* CSAI2601 UX Quest • Mission Control Sheet Authority v5.1
 * Google Sheet mission_completed controls official unlock only.
 * Full node completion is calculated separately from Mission + Studio + Reflection.
 */
(() => {
  'use strict';

  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const VERSION = 'sheet-authority-v5.1-20260721';
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
    const missionPassed = Boolean(remote.completed || remote.passed || Number(remote.bestStars || remote.stars || 0) >= 2);
    return {
      missionPassed,
      passed:missionPassed,
      stars:Number(remote.bestStars || remote.stars || 0),
      score:Number(remote.bestScore || remote.score || 0),
      attempts:Number(remote.attempts || 0)
    };
  }

  function missionRecord(key) {
    return normalizedMission(snapshot?.missions?.[String(key || '').toLowerCase()]);
  }
  function passed(key) { return missionRecord(key).missionPassed; }
  function canonicalNextKey() {
    const apiNext = String(snapshot?.nextMission || '').trim().toLowerCase();
    return ORDER.includes(apiNext) ? apiNext : (ORDER.find(key => !passed(key)) || '');
  }
  function available(key) {
    if (!snapshot?.ok) return false;
    const index = ORDER.indexOf(key);
    if (index < 0) return false;
    if (index === 0 || passed(key)) return true;
    return key === canonicalNextKey();
  }
  function stateOf(node) {
    const record = missionRecord(node.key);
    const isPassed = record.missionPassed;
    const isAvailable = available(node.key);
    return { ...record, isPassed, isAvailable, label:isPassed ? 'Mission ผ่าน' : isAvailable ? 'พร้อมเริ่ม Mission' : 'ล็อกอยู่' };
  }

  function card(node) {
    const boss = node.type === 'boss' || node.key.startsWith('b');
    const state = stateOf(node);
    const index = ORDER.indexOf(node.key);
    const previousId = index > 0 ? ORDER[index - 1].toUpperCase() : '';
    const url = state.isAvailable ? launchUrl(node) : '#';
    const hint = state.isPassed
      ? `${stars(state.stars)} • ${state.attempts || 1} attempt${state.attempts === 1 ? '' : 's'} • รอตรวจ Studio/Reflection`
      : state.isAvailable
        ? (node.artifact ? `Artifact: ${node.artifact}` : 'ต้องผ่าน 2★ เพื่อไปต่อ')
        : `ต้องผ่าน ${previousId || 'ด่านก่อนหน้า'} จาก Sheet ก่อน`;
    const rounds = Array.isArray(node.missionRounds) ? node.missionRounds.slice(0, 3).join(' → ') : '';
    const desc = state.isAvailable
      ? `${node.focus || ''}${rounds ? ` • ${rounds}` : ''}`
      : 'ล็อกตามลำดับ Canonical Path โดยใช้ mission_completed จาก Google Sheet';

    return `<article class="${boss ? 'boss-preview' : 'compact-stage'} campaign-preview ${state.isAvailable ? 'is-ready' : 'is-locked'} ${state.isPassed ? 'is-cleared' : ''}" data-node="${esc(node.id)}" data-node-id="${esc(node.key)}" data-mission-passed="${state.isPassed ? '1' : '0'}">
      <div class="${boss ? 'boss-preview__top' : 'compact-stage__top'}">
        <span class="stage-number">${esc(node.id)}</span><span class="stage-state">${esc(state.label)}</span>
      </div>
      <div class="${boss ? 'boss-preview__body' : 'compact-stage__content'}">
        <span class="${boss ? 'boss-preview__icon' : 'compact-stage__icon'}" aria-hidden="true">${nodeIcon(node)}</span>
        <div><p class="compact-stage__type">${boss ? 'BOSS GATE' : 'WEEKLY MISSION'}</p><h3>${esc(node.missionTitle || node.title)}</h3><p>${esc(desc)}</p></div>
      </div>
      <div class="${boss ? 'boss-preview__footer' : 'compact-stage__footer'}">
        <span>${esc(hint)}</span>
        <a class="campaign-launch ${state.isAvailable ? '' : 'is-disabled'}" href="${esc(url)}" aria-disabled="${state.isAvailable ? 'false' : 'true'}">${state.isPassed ? 'ทำ Studio ต่อ' : state.isAvailable ? 'เริ่ม Mission' : 'ล็อกอยู่'}</a>
      </div>
    </article>`;
  }

  function renderLoading(message) {
    if ($('#progress')) $('#progress').textContent = 'กำลังดึง Mission จาก Sheet…';
    if ($('#nextTitle')) $('#nextTitle').textContent = message || 'กำลังตรวจความก้าวหน้าจาก Google Sheet';
    if ($('#nextDesc')) $('#nextDesc').textContent = 'ระบบยังไม่ปลดล็อกจนกว่าจะได้รับสถานะ Mission จาก Sheet';
    if ($('#nextLink')) { $('#nextLink').href = '#'; $('#nextLink').textContent = 'กำลังโหลด…'; $('#nextLink').setAttribute('aria-disabled', 'true'); }
    const grid = $('#grid');
    if (grid) grid.innerHTML = '<div class="campaign-separator">Google Sheet เป็นแหล่งข้อมูลหลัก • กำลังโหลดสถานะ Mission</div>';
  }

  function drawFromSheet(result) {
    snapshot = result && result.ok ? result : null;
    window.UXQMissionSheetSnapshot = snapshot;
    if (!snapshot) { renderLoading('ยังไม่ได้รับสถานะจาก Google Sheet'); return; }

    const canonicalPassed = Array.isArray(snapshot?.diagnostics?.canonicalPassedMissionIds)
      ? snapshot.diagnostics.canonicalPassedMissionIds.map(value => String(value).toLowerCase())
      : ORDER.filter(key => passed(key));
    const missionCompleted = canonicalPassed.length;
    const nextKey = canonicalNextKey();
    const next = nodes.find(node => node.key === nextKey) || null;

    if ($('#progress')) $('#progress').textContent = `Mission ${missionCompleted}/${ORDER.length} • รอรวม Studio/Reflection`;
    const grid = $('#grid');
    if (grid) {
      grid.innerHTML = `<div class="campaign-separator">Mission ผ่าน ${missionCompleted}/${ORDER.length} • การปลดล็อกใช้ mission_completed • การจบ Node ต้องครบ 3/3</div>` + nodes.map(card).join('');
      grid.querySelectorAll('a[aria-disabled="true"]').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    }

    if (next) {
      if ($('#nextTitle')) $('#nextTitle').textContent = `${next.id} • ${next.missionTitle || next.title}`;
      if ($('#nextDesc')) $('#nextDesc').textContent = `Mission ถัดไปตาม Sheet${next.artifact ? ` • หลังผ่านต้องส่ง ${next.artifact} และ Reflection` : ''}`;
      if ($('.current-card__icon')) $('.current-card__icon').textContent = nodeIcon(next);
      if ($('#nextLink')) { $('#nextLink').href = launchUrl(next); $('#nextLink').textContent = 'เริ่ม Mission →'; $('#nextLink').setAttribute('aria-disabled', 'false'); }
    } else {
      if ($('#nextTitle')) $('#nextTitle').textContent = 'Mission ผ่านครบ 19/19';
      if ($('#nextDesc')) $('#nextDesc').textContent = 'ยังต้องตรวจ Studio Practice และ Reflection ก่อนถือว่าจบหลักสูตร';
      if ($('#nextLink')) { $('#nextLink').href = '#'; $('#nextLink').textContent = 'กำลังตรวจความครบ 3 ส่วน…'; $('#nextLink').setAttribute('aria-disabled', 'true'); }
    }

    document.body.dataset.uxqCloudLoading = '0';
    window.dispatchEvent(new CustomEvent('uxq-mission-control-sheet-snapshot', { detail:{ snapshot, missionCompleted, order:ORDER.slice(), nodes:nodes.slice() } }));
  }

  function boot() {
    renderLoading();
    window.addEventListener('uxq-sheet-progress-restored', event => drawFromSheet(event.detail));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.UXQMissionControlSheetAuthority = Object.freeze({ drawFromSheet, version:VERSION, getSnapshot:() => snapshot, order:ORDER.slice() });
})();