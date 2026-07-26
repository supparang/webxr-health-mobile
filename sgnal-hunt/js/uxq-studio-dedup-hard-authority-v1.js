/* CSAI2601 UX Quest • Studio dedup hard authority v1
 * Keeps only one visible Project/Figma UI while preserving canonical hidden fields.
 * Also enforces the final submit label after late legacy rewrites.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const STYLE_ID = 'uxq-studio-dedup-hard-authority-v1-style';
  const HIDDEN_KEYS = new Set(['projectId','figmaUrl','evidenceUrl']);
  const FINAL_LABEL = 'ส่ง Studio Practice และ Weekly Reflection';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .artifact[data-studio-practice-v1] label[data-uxq-dedup-hidden="1"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .artifact[data-studio-practice-v1] [data-studio-key="projectId"],
      .artifact[data-studio-practice-v1] [data-studio-key="figmaUrl"],
      .artifact[data-studio-practice-v1] [data-studio-key="evidenceUrl"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function enforce() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;

    artifact.querySelectorAll('[data-studio-key]').forEach(field => {
      if (!HIDDEN_KEYS.has(field.dataset.studioKey)) return;
      field.hidden = true;
      field.setAttribute('aria-hidden','true');
      const wrapper = field.closest('label,.studio-field');
      if (wrapper) wrapper.dataset.uxqDedupHidden = '1';
    });

    artifact.querySelectorAll('[data-studio-submit],[data-save-artifact]').forEach(button => {
      if (button.textContent.trim() !== FINAL_LABEL) button.textContent = FINAL_LABEL;
      button.setAttribute('aria-label', FINAL_LABEL);
    });

    const status = artifact.querySelector('[data-save-status]');
    if (status && /linked mission attempt|mission-[a-z0-9-]{20,}/i.test(status.textContent || '')) {
      status.textContent = 'ส่งคำขอสำเร็จแล้ว ระบบกำลังรอ Google Sheet ยืนยัน Studio Practice และ Weekly Reflection';
    }
  }

  let timer = 0;
  function schedule(delay = 30) {
    clearTimeout(timer);
    timer = setTimeout(enforce, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(40), { once:true });
  } else schedule(40);

  new MutationObserver(() => schedule(20)).observe(ROOT, { childList:true, subtree:true, characterData:true });
  [100,300,700,1200,2000,4000].forEach(ms => setTimeout(enforce, ms));
  setInterval(enforce, 1000);

  window.UXQStudioDedupHardAuthorityV1 = Object.freeze({ enforce });
})();
