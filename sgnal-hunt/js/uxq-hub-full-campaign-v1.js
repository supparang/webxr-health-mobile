/* UX Quest • Full CSAI2601 Campaign Hub v1
 * Extends Mission Control from W1 through the five boss gates.
 */
(() => {
  'use strict';

  const NODES = [
    { id:'w6', label:'W6', act:'ACT II • INFORMATION ARCHITECTURE', title:'Flow Rescue: IA, Sitemap & User Flow', desc:'จัดโครงสร้างข้อมูล หา bottleneck และซ่อม task flow ให้ผู้ใช้ไปถึงเป้าหมาย', icon:'↝', prereq:'w5', href:'./w6-flow-rescue.html?v=20260704-w6-flow-v1', built:true },
    { id:'b2', label:'B2', act:'BOSS GATE • W4–W6', title:'Flow Fortress: The Decision Siege', desc:'รวม Insight, HMW, IA และ User Flow ในคดีที่มีความกดดันและเงื่อนไขเปลี่ยนเร็ว', icon:'⚔', prereq:'w6', href:'./b2-flow-fortress.html?v=20260704-b2-flow-v1', built:true, boss:true },
    { id:'w7', label:'W7', act:'ACT III • WIREFRAME & HIERARCHY', title:'Wireframe Heist', desc:'จัด Grid, Layout และ Visual Hierarchy ให้ task สำคัญเด่นขึ้นก่อน', icon:'▦', prereq:'b2', href:'./w7-wireframe-heist.html', built:false },
    { id:'b3', label:'B3', act:'MIDTERM BOSS • WEEK 8', title:'UX Blueprint Gauntlet', desc:'ด่านกลางภาค: วิเคราะห์และปกป้อง Blueprint ตั้งแต่ user insight จนถึง wireframe', icon:'◆', prereq:'w7', href:'./b3-ux-blueprint-gauntlet.html', built:false, boss:true },
    { id:'w9', label:'W9', act:'ACT IV • DESIGN SYSTEM', title:'Design System Vault', desc:'สร้าง Pattern Library, UI Kit และกติกาความสม่ำเสมอของหน้าจอ', icon:'◫', prereq:'b3', href:'./w9-design-system-vault.html', built:false },
    { id:'w10', label:'W10', act:'ACT IV • RESPONSIVE & ACCESSIBLE WEB', title:'Responsive Rescue', desc:'ออกแบบ Navigation และ Responsive Layout ที่เข้าถึงได้ในหลายหน้าจอ', icon:'⌁', prereq:'w9', href:'./w10-responsive-rescue.html', built:false },
    { id:'w11', label:'W11', act:'ACT IV • VISUAL ACCESSIBILITY', title:'Contrast Cipher', desc:'ใช้ Color, Typography และ Contrast เพื่อให้ข้อมูลอ่านง่ายและตัดสินใจได้', icon:'◐', prereq:'w10', href:'./w11-contrast-cipher.html', built:false },
    { id:'b4', label:'B4', act:'BOSS GATE • W9–W11', title:'Design System Siege', desc:'รวม UI system, responsive behavior และ visual accessibility ในคดีออกแบบจริง', icon:'✹', prereq:'w11', href:'./b4-design-system-siege.html', built:false, boss:true },
    { id:'w12', label:'W12', act:'ACT V • COMPONENTS & STATES', title:'Component Command', desc:'ออกแบบ Forms, Cards, Icons และ Feedback States ที่ช่วยป้องกัน error', icon:'▣', prereq:'b4', href:'./w12-component-command.html', built:false },
    { id:'w13', label:'W13', act:'ACT V • PROTOTYPE', title:'Prototype Pulse', desc:'สร้าง High-fidelity Prototype และ Microinteraction ที่สื่อ feedback ได้ชัด', icon:'◌', prereq:'w12', href:'./w13-prototype-pulse.html', built:false },
    { id:'w14', label:'W14', act:'ACT V • EVALUATION & ITERATION', title:'Validation Lab', desc:'ใช้ Heuristic, Cognitive Walkthrough และ Usability Test เพื่อปรับรอบใหม่', icon:'✓', prereq:'w13', href:'./w14-validation-lab.html', built:false },
    { id:'b5', label:'B5', act:'FINAL BOSS • WEEK 15', title:'UX Launch Defense', desc:'Final Design Studio: นำเสนอ Portfolio, อธิบายเหตุผล และปกป้องการตัดสินใจออกแบบ', icon:'★', prereq:'w14', href:'./b5-ux-launch-defense.html', built:false, boss:true }
  ];

  const $ = (id) => document.getElementById(id);
  const n = (v) => Number(v || 0);
  const passed = (progress, id) => n(progress?.missions?.[id]?.bestStars) >= 2;
  const stars = (value) => '★'.repeat(Math.max(0, n(value))) + '☆'.repeat(Math.max(0, 3 - n(value)));
  const esc = (value) => String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function addStyle(){
    if ($('uxq-full-campaign-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-full-campaign-style';
    style.textContent = `
      .campaign-preview{position:relative}.campaign-preview.is-ready{border-color:rgba(117,232,255,.72);box-shadow:0 13px 34px rgba(66,158,255,.16)}.campaign-preview.is-cleared{border-color:rgba(92,229,182,.7)}.campaign-preview.is-boss{background:linear-gradient(145deg,rgba(41,29,80,.82),rgba(13,31,62,.92))}.campaign-preview .campaign-launch{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:9px 12px;border-radius:10px;background:rgba(117,232,255,.15);border:1px solid rgba(117,232,255,.55);color:#e6fbff;text-decoration:none;font-weight:850;font-size:.82rem}.campaign-preview .campaign-launch.is-disabled{opacity:.5;pointer-events:none}.campaign-preview .campaign-build-note{font-size:.75rem;color:#ffdca0}.campaign-separator{grid-column:1/-1;margin:8px 0 0;padding:11px 13px;border-left:3px solid rgba(155,140,255,.8);background:rgba(155,140,255,.08);color:#d9d1ff;font-size:.86rem;font-weight:800;border-radius:0 12px 12px 0}
      @media(max-width:760px){.campaign-preview .compact-stage__footer{align-items:flex-start;flex-direction:column}.campaign-preview .campaign-launch{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function cardMarkup(node){
    const cls = node.boss ? 'boss-preview campaign-preview campaign-preview--boss' : 'compact-stage compact-stage--locked campaign-preview';
    const body = node.boss
      ? `<div class="boss-preview__body"><span class="boss-preview__icon" aria-hidden="true">${esc(node.icon)}</span><div><p class="compact-stage__type">${esc(node.act)}</p><h3>${esc(node.title)}</h3><p>${esc(node.desc)}</p></div></div>`
      : `<div class="compact-stage__content"><span class="compact-stage__icon" aria-hidden="true">${esc(node.icon)}</span><div><p class="compact-stage__type">${esc(node.act)}</p><h3>${esc(node.title)}</h3><p>${esc(node.desc)}</p></div></div>`;
    return `<article class="${cls}" id="node-${esc(node.id)}"><div class="${node.boss ? 'boss-preview__top' : 'compact-stage__top'}"><span class="stage-number">${esc(node.label)}</span><span class="stage-state" id="${esc(node.id)}State">ล็อกอยู่</span></div>${body}<div class="${node.boss ? 'boss-preview__footer' : 'compact-stage__footer'}"><span id="${esc(node.id)}Note">ต้องผ่าน ${esc(node.prereq).toUpperCase()} ก่อน</span><a id="${esc(node.id)}Launch" class="campaign-launch is-disabled" href="#" aria-disabled="true">ล็อกอยู่</a></div></article>`;
  }

  function ensureCards(){
    const grid = document.querySelector('.up-next-grid');
    if (!grid || $('uxq-full-campaign-anchor')) return;
    const anchor = document.createElement('div');
    anchor.id = 'uxq-full-campaign-anchor';
    anchor.className = 'campaign-separator';
    anchor.textContent = 'CSAI2601 Campaign Map • ด่านที่ยังล็อกจะเปิดตาม mastery ของด่านก่อนหน้า';
    grid.appendChild(anchor);
    NODES.forEach((node) => grid.insertAdjacentHTML('beforeend', cardMarkup(node)));
  }

  function labelFor(node){ return node.boss ? `ด่านบอส ${node.label}` : node.label; }

  function renderNode(node, progress){
    const completed = passed(progress, node.id);
    const ready = passed(progress, node.prereq);
    const item = progress?.missions?.[node.id] || {};
    const card = $('node-' + node.id);
    const state = $(node.id + 'State');
    const note = $(node.id + 'Note');
    const launch = $(node.id + 'Launch');
    if (card) {
      card.classList.toggle('is-ready', ready && !completed && node.built);
      card.classList.toggle('is-cleared', completed);
    }
    if (state) state.textContent = completed ? 'ผ่านแล้ว' : (ready ? (node.built ? 'พร้อมเริ่ม' : 'กำลังสร้าง') : 'ล็อกอยู่');
    if (note) {
      note.textContent = completed ? `ผ่านแล้ว ${stars(item.bestStars)}` : (ready ? (node.built ? `${labelFor(node)} พร้อมเริ่มแล้ว` : 'ปลดล็อกตามเส้นทางแล้ว • กำลังสร้างด่านนี้') : `ต้องผ่าน ${node.prereq.toUpperCase()} ที่ 2★ ระดับความพร้อม`);
    }
    if (launch) {
      launch.href = ready && node.built ? node.href : '#';
      launch.textContent = completed ? (node.built ? 'เล่นซ้ำ' : 'ผ่านแล้ว') : (ready ? (node.built ? 'เริ่มภารกิจ' : 'กำลังสร้าง') : 'ล็อกอยู่');
      launch.classList.toggle('is-disabled', !(ready && node.built));
      launch.setAttribute('aria-disabled', String(!(ready && node.built)));
      launch.onclick = ready && node.built ? null : (event) => event.preventDefault();
    }
  }

  function setCurrent(progress){
    const next = NODES.find((node) => passed(progress, node.prereq) && !passed(progress, node.id) && node.built);
    if (!next) return;
    const launch = $('nowLaunch');
    if (!launch) return;
    $('nowStatus').textContent = 'พร้อมเริ่มภารกิจ';
    $('nowWeek').textContent = `${next.label} • ${next.title}`;
    $('nowIcon').textContent = next.icon;
    $('w1Title').textContent = next.title;
    $('nowSummary').textContent = next.desc;
    $('nowReward').textContent = '★ 2 ระดับความพร้อม เพื่อปลดล็อกด่านถัดไป';
    $('nowLaunchText').textContent = 'เริ่มภารกิจ';
    launch.href = next.href;
    launch.setAttribute('aria-label', `เปิด ${next.label} ${next.title}`);
    $('pathHint').textContent = `ปลดล็อก ${next.label} แล้ว — ${next.desc}`;
  }

  function render(){
    addStyle(); ensureCards();
    const progress = window.UXQProgress?.get?.() || {};
    NODES.forEach((node) => renderNode(node, progress));
    const allIds = window.UXQProgress?.MISSION_IDS || [];
    const completed = allIds.filter((id) => passed(progress, id)).length;
    const totalStars = allIds.reduce((sum, id) => sum + n(progress?.missions?.[id]?.bestStars), 0);
    const mastery = Math.max(0, Math.min(3, Math.round((totalStars / Math.max(1, allIds.length * 3)) * 3)));
    if ($('menuProgressText')) $('menuProgressText').textContent = `${completed}/${allIds.length} ด่าน • ${stars(mastery)}`;
    if ($('actProgressText')) $('actProgressText').textContent = `${completed}/${allIds.length}`;
    if ($('heroStars')) $('heroStars').textContent = stars(mastery);
    const eyebrow = document.querySelector('.act-intro__eyebrow');
    if (eyebrow) eyebrow.textContent = 'ACT I → ACT V • UX/UI DESIGN CAMPAIGN';
    const title = $('actTitle');
    if (title) title.textContent = 'เข้าใจผู้ใช้ → สร้างระบบ → พิสูจน์คุณค่าด้วยผู้ใช้จริง';
    setCurrent(progress);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 0));
  window.addEventListener('uxq-progress-updated', () => setTimeout(render, 0));
})();
