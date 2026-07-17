/* CSAI2601 UX Quest • W12 Prompt No-Shake Authority v1
 * Visual single-owner patch for the W12 question heading.
 * Other legacy scripts may still rewrite the underlying text, but this layer
 * renders one stable heading from a data attribute so no visible flicker,
 * reflow, or text shaking can occur.
 */
(() => {
  'use strict';

  const qs = new URLSearchParams(location.search || '');
  const node = String(qs.get('node') || qs.get('id') || '').toUpperCase();
  if (node !== 'W12') return;

  const $ = (s, r = document) => r.querySelector(s);
  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();

  const PROMPTS = {
    state: 'ระหว่างระบบกำลังส่งข้อมูล ควรแสดงสถานะใด',
    prevention: 'วิธีใดป้องกันการส่งซ้ำหรือทางตันได้ตรงจุด',
    microcopy: 'Microcopy ใดช่วยให้ผู้ใช้แก้ข้อผิดพลาดได้ทันที',
    recovery: 'Recovery path ใดช่วยให้ผู้ใช้ไปต่อโดยไม่เริ่มใหม่',
    feedback: 'Feedback ใดทำให้ผู้ใช้รู้ผลและขั้นตอนถัดไป'
  };

  const ORDER = ['state', 'prevention', 'microcopy', 'recovery', 'feedback'];

  function roundSource() {
    return clean([
      $('.hud .meter b')?.textContent,
      $('.case .kicker')?.textContent,
      $('.case h1')?.textContent,
      $('.case > p')?.textContent
    ].join(' ')).toLowerCase();
  }

  function roundNumber() {
    const text = roundSource();
    const match = text.match(/(?:รอบภารกิจ|progress|decision)\s*(\d+)|\b(\d+)\s*\/\s*5/);
    return Number((match && (match[1] || match[2])) || 1);
  }

  function packKey() {
    const text = roundSource();
    if (/microcopy|wording|write useful|ข้อความ/.test(text)) return 'microcopy';
    if (/recovery|recover|ทางกลับ|กู้คืน|ลองใหม่/.test(text)) return 'recovery';
    if (/prevent|double submit|dead end|ป้องกัน|กดซ้ำ/.test(text)) return 'prevention';
    if (/feedback|success|receipt|next step|ยืนยันผล/.test(text)) return 'feedback';
    if (/state|loading|disabled|สถานะ/.test(text)) return 'state';
    return ORDER[Math.max(0, Math.min(4, roundNumber() - 1))] || 'state';
  }

  function installStyle() {
    if ($('#uxqW12PromptNoShakeStyleV1')) return;
    const style = document.createElement('style');
    style.id = 'uxqW12PromptNoShakeStyleV1';
    style.textContent = `
      body[data-uxq-node="W12"] .question .prompt[data-uxq-w12-visual-owner="true"] {
        position: relative !important;
        display: block !important;
        min-height: 1.55em !important;
        height: auto !important;
        overflow: visible !important;
        font-size: 0 !important;
        line-height: 0 !important;
        color: transparent !important;
        transform: none !important;
        animation: none !important;
        transition: none !important;
        contain: layout paint !important;
      }
      body[data-uxq-node="W12"] .question .prompt[data-uxq-w12-visual-owner="true"]::after {
        content: attr(data-uxq-w12-prompt) !important;
        display: block !important;
        min-height: 1.55em !important;
        color: #f4f7ff !important;
        font: inherit !important;
        font-size: clamp(1.45rem, 2.3vw, 2rem) !important;
        font-weight: 800 !important;
        line-height: 1.25 !important;
        letter-spacing: 0 !important;
        white-space: normal !important;
        transform: none !important;
        animation: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  let lastKey = '';
  function renderStablePrompt() {
    const prompt = $('.question .prompt');
    if (!prompt) return;

    document.body.setAttribute('data-uxq-node', 'W12');
    const key = packKey();
    const text = PROMPTS[key] || PROMPTS.state;

    prompt.setAttribute('data-uxq-w12-visual-owner', 'true');
    if (lastKey !== key || prompt.getAttribute('data-uxq-w12-prompt') !== text) {
      prompt.setAttribute('data-uxq-w12-prompt', text);
      lastKey = key;
    }
  }

  function run() {
    installStyle();
    renderStablePrompt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // Re-evaluate only around genuine player actions/round transitions.
  // The visible heading itself is CSS-owned, so mutations from older scripts
  // cannot produce visible text replacement or layout shaking.
  document.addEventListener('click', () => {
    requestAnimationFrame(run);
    setTimeout(run, 80);
    setTimeout(run, 260);
  }, true);

  window.addEventListener('uxq-round-changed', run);
  window.addEventListener('uxq-question-rendered', run);

  const root = $('#uxqCanonicalNode') || document.body;
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  }).observe(root, { childList: true, subtree: true });
})();
