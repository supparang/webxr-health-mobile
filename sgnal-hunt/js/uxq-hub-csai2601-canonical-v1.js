/* CSAI2601 canonical Mission Control — wired to uxq-csai2601-canonical-content-v1.js
 * Course path: W1-W15 + B1-B4. No B5.
 */
(() => {
  'use strict';

  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const FALLBACK_NODES = [
    { id:'W1', type:'week', title:'UX First Contact', missionTitle:'UX First Responder', focus:'เข้าใจ UI, UX และ Front-end Design', artifact:'UX First Impression Audit' },
    { id:'W2', type:'week', title:'Human-Centered Design', missionTitle:'Evidence Before Design', focus:'ออกแบบจากผู้ใช้ ไม่ใช่จากความชอบส่วนตัว', artifact:'UX Process Map / HCD Sprint Brief' },
    { id:'W3', type:'week', title:'Psychology for Interface Design', missionTitle:'Mind Load Rescue', focus:'จิตวิทยาผู้ใช้กับการออกแบบหน้าจอ', artifact:'Cognitive Load Repair Note' },
    { id:'B1', type:'boss', title:'Foundation Boss', missionTitle:'Cognitive Storm', focus:'UI/UX + HCD + Psychology Defense', artifact:'Foundation UX Defense Sheet' },
    { id:'W4', type:'week', title:'User Empathy & Research', missionTitle:'Empathy Detective', focus:'เข้าใจผู้ใช้ด้วยข้อมูลจริง', artifact:'Interview Note + Persona Lite' },
    { id:'W5', type:'week', title:'Define Problem & Ideation', missionTitle:'Problem Alchemist', focus:'จาก insight สู่แนวคิดออกแบบ', artifact:'Problem Statement + HMW + Concept Storyboard' },
    { id:'W6', type:'week', title:'Information Architecture & User Flow', missionTitle:'Flow Architect', focus:'โครงสร้างข้อมูลและเส้นทางผู้ใช้', artifact:'Sitemap + Main User Flow + Error Path' },
    { id:'W7', type:'week', title:'Wireframe, Grid & Visual Hierarchy', missionTitle:'Wireframe Rescue', focus:'วางหน้าจอให้ผู้ใช้เห็นสิ่งสำคัญก่อน', artifact:'Low-fi Wireframe 5 screens' },
    { id:'B2', type:'boss', title:'Flow & Wireframe Boss', missionTitle:'Flow Fortress', focus:'Research to Structure Defense', artifact:'Flow/Wireframe Defense Sheet' },
    { id:'W8', type:'week', title:'Midterm Studio', missionTitle:'Midterm Studio Checkpoint', focus:'Design Review & Blueprint', artifact:'Midterm UX Blueprint' },
    { id:'W9', type:'week', title:'Pattern Library & Design System', missionTitle:'Pattern Keeper', focus:'สร้างระบบออกแบบให้สม่ำเสมอ', artifact:'UI Kit Charter' },
    { id:'W10', type:'week', title:'Responsive Design & Accessibility', missionTitle:'Responsive Guardian', focus:'ออกแบบให้ใช้ได้หลายอุปกรณ์และเข้าถึงได้', artifact:'Responsive + Accessibility Plan' },
    { id:'W11', type:'week', title:'Color, Typography & Visual Accessibility', missionTitle:'Visual Signal Control', focus:'ภาษาภาพของอินเทอร์เฟซ', artifact:'Visual Style Guide' },
    { id:'B3', type:'boss', title:'Interface System Boss', missionTitle:'Design System Siege', focus:'Pattern, Responsive & Accessibility Defense', artifact:'Interface System Defense Sheet' },
    { id:'W12', type:'week', title:'Interaction Design & Component States', missionTitle:'Interaction Signal', focus:'อินเทอร์แอกชันที่ทำให้ผู้ใช้มั่นใจ', artifact:'Component State Spec' },
    { id:'W13', type:'week', title:'High-fidelity Prototype', missionTitle:'Prototype Builder', focus:'สร้างต้นแบบที่ทดสอบได้จริง', artifact:'Clickable Hi-fi Prototype' },
    { id:'W14', type:'week', title:'Evaluation & Iteration', missionTitle:'Evidence Lab', focus:'ทดสอบ ใช้หลักฐาน และปรับปรุง', artifact:'Usability Iteration Log' },
    { id:'B4', type:'boss', title:'Validation Boss', missionTitle:'Prototype Validation Defense', focus:'Prototype & Evaluation Defense', artifact:'Prototype Validation Defense Sheet' },
    { id:'W15', type:'week', title:'Final Studio & UX/UI Portfolio', missionTitle:'Portfolio Finalizer', focus:'สรุปงานเป็นกรณีศึกษา', artifact:'Final UX/UI Case Study Portfolio' }
  ];

  const PATHS = {
    w1: './w1-ux-crisis-casefile.html',
    w2: './w2-design-thinking-sprint.html',
    w3: './w3-cognitive-load-escape.html',
    b1: './b1-cognitive-storm.html',
    w4: './w4-user-insight-lab.html',
    w5: './w5-concept-forge.html',
    w6: './w6-flow-rescue.html',
    w7: './w7-wireframe-heist.html',
    b2: './b2-flow-fortress.html',
    w8: './w8-midterm-studio.html',
    w9: './w9-design-system-vault.html',
    w10: './w10-responsive-rescue.html',
    w11: './w11-contrast-cipher.html',
    b3: './b3-interface-system-boss.html',
    w12: './w12-component-command.html',
    w13: './w13-prototype-pulse.html',
    w14: './w14-validation-lab.html',
    b4: './b4-validation-boss.html',
    w15: './w15-portfolio-launch-studio.html'
  };

  const nodes = (CONTENT?.nodes && CONTENT.nodes.length ? CONTENT.nodes : FALLBACK_NODES)
    .map((node, index) => ({ ...node, key: String(node.id || '').toLowerCase(), order: Number(node.order || index + 1) }))
    .sort((a, b) => a.order - b.order);

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
  const starText = (value) => `${'★'.repeat(Math.max(0, Math.min(3, Number(value || 0))))}${'☆'.repeat(3 - Math.max(0, Math.min(3, Number(value || 0))))}`;

  function progress() {
    return window.UXQProgress?.get?.() || { missions: {} };
  }

  function missionRecord(progressData, key) {
    return progressData?.missions?.[key] || progressData?.missions?.[String(key).toUpperCase()] || {};
  }

  function passed(progressData, key) {
    return Number(missionRecord(progressData, key).bestStars || 0) >= 2;
  }

  function available(progressData, index) {
    if (index === 0) return true;
    return passed(progressData, nodes[index - 1]?.key);
  }

  function statusOf(progressData, node, index) {
    const record = missionRecord(progressData, node.key);
    const isPassed = passed(progressData, node.key);
    const isAvailable = available(progressData, index);
    return {
      isPassed,
      isAvailable,
      stars: Number(record.bestStars || 0),
      score: Number(record.bestScore || 0),
      attempts: Number(record.attempts || 0),
      label: isPassed ? 'ผ่านแล้ว' : isAvailable ? 'พร้อมเริ่ม' : 'ล็อกอยู่'
    };
  }

  function nextNode(progressData) {
    return nodes.find((node, index) => available(progressData, index) && !passed(progressData, node.key)) || nodes[nodes.length - 1] || null;
  }

  function card(node, index, progressData) {
    const boss = node.type === 'boss' || node.key.startsWith('b');
    const state = statusOf(progressData, node, index);
    const previous = nodes[index - 1];
    const url = state.isAvailable ? (PATHS[node.key] || '#') : '#';
    const typeLabel = boss ? 'BOSS GATE' : 'WEEKLY MISSION';
    const hint = state.isPassed
      ? `${starText(state.stars)} • เล่นซ้ำได้ด้วย case variant ใหม่`
      : state.isAvailable
        ? `${node.artifact ? `Artifact: ${node.artifact}` : 'ต้องผ่าน 2★ เพื่อไปต่อ'}`
        : `ต้องผ่าน ${previous?.id || 'ด่านก่อนหน้า'} ที่ 2★ ก่อน`;
    const desc = state.isAvailable
      ? `${node.focus || ''}${node.missionRounds?.length ? ` • ${node.missionRounds.slice(0, 3).join(' → ')}` : ''}`
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
      grid.innerHTML = `<div class="campaign-separator">CSAI2601 • 15 Weeks + 4 Boss Gates • ${total} nodes • canonical content ${esc(CONTENT?.version || 'fallback')}</div>` +
        nodes.map((node, index) => card(node, index, progressData)).join('');
      grid.querySelectorAll('a[aria-disabled="true"]').forEach((link) => {
        link.addEventListener('click', (event) => event.preventDefault());
      });
    }

    const next = nextNode(progressData);
    if (next) {
      const nextState = statusOf(progressData, next, nodes.indexOf(next));
      if ($('#nextTitle')) $('#nextTitle').textContent = `${next.id} • ${next.missionTitle || next.title}`;
      if ($('#nextDesc')) $('#nextDesc').textContent = `${next.focus || ''}${next.artifact ? ` • ส่งงาน: ${next.artifact}` : ''}`;
      if ($('#nextLink')) {
        $('#nextLink').href = PATHS[next.key] || '#';
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
