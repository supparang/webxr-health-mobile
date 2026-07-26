/* CSAI2601 UX Quest • W1 Workflow Final Authority v1
 * Removes duplicated Project/Figma fields from the Studio form, keeps the
 * Master Figma panel as the single visible project authority, aligns displayed
 * stars with the actual cached mission record, and clarifies the combined
 * Studio + Reflection submission flow.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  if (nodeId !== 'W1') return;

  const STYLE_ID = 'uxq-w1-workflow-final-authority-v1-style';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .artifact[data-studio-practice-v1] label[data-uxq-duplicate-project-field='1']{display:none!important}
      .artifact[data-studio-practice-v1] [data-save-status]{max-width:520px;line-height:1.45;overflow-wrap:anywhere}
      .results .stars[data-uxq-authoritative-stars='1']{letter-spacing:.08em}
      .uxq-w1-gate-note{margin:12px auto 0;max-width:760px;padding:11px 13px;border-radius:13px;border:1px solid rgba(250,204,21,.42);background:rgba(250,204,21,.08);color:#ffe8a8;line-height:1.5;text-align:left}
    `;
    document.head.appendChild(style);
  }

  function missionRecord() {
    try { return window.UXQProgress?.get?.()?.missions?.w1 || {}; }
    catch (_) { return {}; }
  }

  function realStars() {
    const record = missionRecord();
    const last = record.lastResult || {};
    return Math.max(0, Math.min(3, Number(record.bestStars || 0), Number(last.stars || 0)));
  }

  function reasonPercent() {
    const text = String(ROOT.textContent || '');
    const match = text.match(/(?:ตรวจเหตุผล|Reason(?:\s*Check)?)\D{0,30}(\d{1,3})\s*%/i);
    return match ? Math.max(0, Math.min(100, Number(match[1] || 0))) : null;
  }

  function hideDuplicateStudioFields() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    ['projectId','figmaUrl','evidenceUrl'].forEach(key => {
      artifact.querySelectorAll(`[data-studio-key='${key}']`).forEach(field => {
        const label = field.closest('label');
        if (label) {
          label.dataset.uxqDuplicateProjectField = '1';
          label.setAttribute('aria-hidden','true');
        }
        field.hidden = true;
      });
    });
  }

  function clarifySubmit() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    const button = artifact.querySelector('[data-studio-submit]');
    if (button) button.textContent = 'ส่ง Studio Practice และ Weekly Reflection';
    const status = artifact.querySelector('[data-save-status]');
    if (status && /linked mission attempt|mission-attempt|mission-/i.test(status.textContent || '')) {
      status.textContent = 'ส่งคำขอสำเร็จแล้ว ระบบกำลังรอ Google Sheet ยืนยัน Studio Practice และ Weekly Reflection';
    }
  }

  function alignMissionResult() {
    const stars = realStars();
    const starBox = ROOT.querySelector('.results .stars');
    if (starBox) {
      starBox.textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
      starBox.dataset.uxqAuthoritativeStars = '1';
      starBox.setAttribute('aria-label',`${stars} จาก 3 ดาว`);
    }

    const gridValues = ROOT.querySelectorAll('.result-grid > div');
    gridValues.forEach(cell => {
      const label = String(cell.querySelector('span')?.textContent || '');
      if (/Cached Best Stars/i.test(label)) {
        const value = cell.querySelector('b');
        if (value) value.textContent = `${stars}★`;
      }
    });

    const reason = reasonPercent();
    const unlockPassed = stars >= 2 && (reason == null || reason >= 70);
    const heading = ROOT.querySelector('.results > h1');
    const lead = heading?.nextElementSibling;
    if (!heading || !starBox) return;

    if (!unlockPassed) {
      heading.textContent = 'W1 เล่น Mission แล้ว • ยังไม่ผ่านเกณฑ์ปลดล็อก';
      if (lead?.tagName === 'P') {
        lead.textContent = reason == null
          ? `ผลทางการปัจจุบัน ${stars}/3 ดาว ต้องได้อย่างน้อย 2/3 ดาวและผ่าน Reason Check จึงจะไปต่อได้`
          : `ผลทางการปัจจุบัน ${stars}/3 ดาว • Reason Check ${reason}% ต้องได้อย่างน้อย 70% จึงจะไปต่อได้`;
      }
      let note = ROOT.querySelector('.uxq-w1-gate-note');
      if (!note) {
        note = document.createElement('div');
        note.className = 'uxq-w1-gate-note';
        starBox.insertAdjacentElement('afterend',note);
      }
      note.textContent = 'สถานะนี้หมายถึงเล่นจบแล้ว แต่ยังไม่ผ่านเกณฑ์เหตุผลและการปลดล็อก โปรดเล่น Case ใหม่และเลือกเหตุผลที่เชื่อมโยงกับหลักฐานผู้ใช้';
    } else {
      const note = ROOT.querySelector('.uxq-w1-gate-note');
      if (note) note.remove();
    }
  }

  function enforceThreePartLanguage() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) return;
    const foot = tracker.querySelector('.uxq-3part__foot');
    if (foot && !/3\/3/.test(tracker.textContent || '')) {
      foot.textContent = 'ต้องให้ Google Sheet ยืนยันครบทั้ง Mission, Studio Practice และ Weekly Reflection จึงถือว่า W1 สมบูรณ์และพร้อมปลดล็อก W2';
    }
  }

  function apply() {
    installStyle();
    hideDuplicateStudioFields();
    clarifySubmit();
    alignMissionResult();
    enforceThreePartLanguage();
  }

  let timer = 0;
  function schedule(delay = 60) {
    clearTimeout(timer);
    timer = setTimeout(apply, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(50), { once:true });
  } else schedule(50);

  new MutationObserver(() => schedule(80)).observe(ROOT,{childList:true,subtree:true,characterData:true});
  ['uxq-progress-updated','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(name => {
    window.addEventListener(name,() => schedule(30));
  });
  [250,800,1800,3500].forEach(ms => setTimeout(apply,ms));

  window.UXQW1WorkflowFinalAuthorityV1 = Object.freeze({apply,version:'20260726-W1-WORKFLOW-FINAL-V1'});
})();