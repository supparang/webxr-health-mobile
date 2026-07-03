/* UX Quest • W5 Mission Control extension
 * Adds W5 Concept Forge without changing the already-running W1–W4 hub controller.
 */
(() => {
  'use strict';

  const W5_HREF = './w5-concept-forge.html?v=20260704-w5-concept-v1';
  const ALL = ['w1', 'w2', 'w3', 'b1', 'w4', 'w5'];
  const $ = (id) => document.getElementById(id);
  const n = (value) => Number(value || 0);
  const passed = (progress, id) => n(progress?.missions?.[id]?.bestStars) >= 2;
  const stars = (value) => '★'.repeat(Math.max(0, n(value))) + '☆'.repeat(Math.max(0, 3 - n(value)));
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };

  function addStyle(){
    if ($('uxq-w5-hub-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w5-hub-style';
    style.textContent = `
      .w5-preview{border-color:rgba(117,232,255,.28)}
      .w5-preview.is-ready{border-color:rgba(117,232,255,.68);box-shadow:0 12px 30px rgba(66,158,255,.14)}
      .w5-preview.is-cleared{border-color:rgba(92,229,182,.62)}
      .w5-preview .w5-launch{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:9px 12px;border-radius:10px;background:rgba(117,232,255,.15);border:1px solid rgba(117,232,255,.55);color:#e6fbff;text-decoration:none;font-weight:850;font-size:.82rem}
      .w5-preview .w5-launch.is-disabled{opacity:.5;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function ensureCard(){
    const grid = document.querySelector('.up-next-grid');
    if (!grid || $('nodeW5')) return;
    grid.insertAdjacentHTML('beforeend', `
      <article class="boss-preview insight-preview w5-preview" id="nodeW5">
        <div class="boss-preview__top"><span class="stage-number">W5</span><span class="stage-state" id="w5State">ล็อกอยู่</span></div>
        <div class="boss-preview__body"><span class="boss-preview__icon" aria-hidden="true">✦</span><div><p class="compact-stage__type">ACT II • CONCEPT DESIGN</p><h3>Concept Forge: จาก Insight สู่แนวคิด</h3><p>นิยามปัญหา สร้าง HMW แตกไอเดีย วาง storyboard และเลือกต้นแบบที่ทดสอบได้จริง</p></div></div>
        <div class="boss-preview__footer"><span id="w5Note">ต้องผ่าน W4 ก่อน</span><a id="w5Launch" class="w5-launch is-disabled" href="#" aria-disabled="true">ล็อกอยู่</a></div>
      </article>
    `);
  }

  function render(){
    addStyle();
    ensureCard();
    const progress = window.UXQProgress?.get?.() || {};
    const item = progress.missions?.w5 || {};
    const w4Passed = passed(progress, 'w4');
    const w5Passed = passed(progress, 'w5');

    const completed = ALL.filter((id) => passed(progress, id)).length;
    const totalStars = ALL.reduce((sum, id) => sum + n(progress.missions?.[id]?.bestStars), 0);
    const bestScore = Math.max(0, ...ALL.map((id) => n(progress.missions?.[id]?.bestScore)));
    const mastery = Math.max(0, Math.min(3, Math.round((totalStars / 18) * 3)));

    setText('menuProgressText', `${completed}/6 ด่าน • ${stars(mastery)}`);
    setText('menuScoreText', `คะแนนสูงสุด ${bestScore}`);
    setText('actProgressText', `${completed}/6`);
    setText('heroStars', stars(mastery));
    setText('heroScore', String(bestScore));

    const node = $('nodeW5');
    const state = $('w5State');
    const note = $('w5Note');
    const launch = $('w5Launch');
    if (node) {
      node.classList.toggle('is-ready', w4Passed && !w5Passed);
      node.classList.toggle('is-cleared', w5Passed);
    }
    if (state) state.textContent = w5Passed ? 'ผ่านแล้ว' : (w4Passed ? 'พร้อมเริ่ม' : 'ล็อกอยู่');
    if (note) note.textContent = w5Passed ? `ผ่านแล้ว ${stars(item.bestStars)}` : (w4Passed ? 'W5 พร้อมเริ่มแล้ว' : 'ต้องผ่าน W4 ที่ 2★ ระดับความพร้อม');
    if (launch) {
      launch.href = w4Passed ? W5_HREF : '#';
      launch.textContent = w5Passed ? 'เล่นซ้ำ' : (w4Passed ? 'เริ่มภารกิจ' : 'ล็อกอยู่');
      launch.classList.toggle('is-disabled', !w4Passed);
      launch.setAttribute('aria-disabled', String(!w4Passed));
      launch.onclick = w4Passed ? null : (event) => event.preventDefault();
    }

    if (!w4Passed) return;
    setText('nowStatus', w5Passed ? 'ผ่าน W5 แล้ว' : 'พร้อมเริ่ม W5');
    setText('nowWeek', 'W5 • Concept Forge');
    setText('nowIcon', '✦');
    setText('w1Title', 'Concept Forge: จาก Insight สู่แนวคิด');
    setText('nowSummary', 'เปลี่ยน insight เป็น Problem Statement, HMW, ไอเดีย, Storyboard และต้นแบบที่ทดสอบได้จริง');
    setText('nowReward', w5Passed ? `ผ่านแล้ว ${stars(item.bestStars)} • เล่นซ้ำด้วยคดีใหม่ได้` : '★ 2 ระดับความพร้อม เพื่อยืนยันการสร้างแนวคิดจากหลักฐานผู้ใช้');
    const mainLaunch = $('nowLaunch');
    if (mainLaunch) {
      mainLaunch.href = W5_HREF;
      mainLaunch.setAttribute('aria-label', 'เปิด W5 Concept Forge');
    }
    setText('nowLaunchText', w5Passed ? 'เล่น W5 ทบทวน' : 'เริ่ม W5');
    const dot = $('nowStatusDot');
    if (dot) {
      dot.classList.toggle('is-complete', w5Passed);
      dot.classList.toggle('is-resume', !w5Passed);
    }
    setText('pathHint', w5Passed
      ? 'W4 และ W5 ผ่านแล้ว — เล่นซ้ำด้วยคดีใหม่เพื่อฝึกเปลี่ยน insight ให้เป็นแนวคิดที่ทดสอบได้'
      : 'ผ่าน W4 แล้ว — W5 Concept Forge เปิดให้เริ่มได้');
  }

  document.addEventListener('DOMContentLoaded', () => window.setTimeout(render, 0));
  window.addEventListener('uxq-progress-updated', () => window.setTimeout(render, 0));
})();
