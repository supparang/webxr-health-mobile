/* UX Quest • W1 Result Copy v1
 * Keeps the Week 1 completion screen aligned with UI/UX & Front-end Design.
 */
(() => {
  'use strict';
  if (!/w1-ux-crisis-casefile\.html/i.test(location.pathname)) return;

  function addStyle(){
    if (document.getElementById('uxq-w1-result-copy-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w1-result-copy-style';
    style.textContent = `
      .uxq-results h1{max-width:min(900px,100%);font-size:clamp(1.7rem,4.8vw,2.75rem);line-height:1.14;overflow-wrap:anywhere}
      .uxq-w1-result-subtitle{max-width:760px;color:#dceaff!important;font-size:1rem!important}
      @media(max-width:760px){.uxq-results h1{font-size:clamp(1.55rem,8vw,2.25rem)}.uxq-result-grid div{min-height:76px}.uxq-result-grid span{font-size:.68rem!important;line-height:1.25;display:block}}
    `;
    document.head.appendChild(style);
  }

  function replaceMetricLabels(result){
    const labels = {
      score: 'คะแนนภารกิจ',
      accuracy: 'คำตอบถูก',
      verified: 'ตรวจเหตุผล',
      'evidence calls': 'การตัดสินใจ UX',
      'best combo': 'ลำดับคิดต่อเนื่อง'
    };
    result.querySelectorAll('.uxq-result-grid span').forEach((item) => {
      const key = String(item.textContent || '').trim().toLowerCase();
      if (labels[key]) item.textContent = labels[key];
    });
  }

  function enhance(){
    const result = document.querySelector('.uxq-results');
    if (!result) return;
    addStyle();

    const passed = /MISSION CLEARED/i.test(String(result.querySelector('.uxq-kicker')?.textContent || ''));
    const title = result.querySelector('h1');
    if (title && (/Readiness/i.test(title.textContent) || /คุณเริ่มเห็น pattern/i.test(title.textContent))) {
      title.textContent = passed
        ? 'ผ่านภารกิจ UX First Impression แล้ว!'
        : 'คุณเริ่มเห็น UX Friction แล้ว — ลองคดีใหม่เพื่อทำให้เหตุผลชัดขึ้น';
    }

    const subtitle = title?.nextElementSibling;
    if (subtitle?.tagName === 'P') {
      subtitle.classList.add('uxq-w1-result-subtitle');
      if (passed && /ภารกิจถัดไปเปิดแล้ว/i.test(subtitle.textContent)) {
        subtitle.textContent = 'คุณใช้ Task → Friction → UX Impact → Quick Redesign → Test Plan ได้ครบแล้ว';
      }
    }

    replaceMetricLabels(result);

    const reason = result.querySelector('.uxq-guess-note b');
    if (reason && /Anti-guess/i.test(reason.textContent)) reason.textContent = 'ตรวจเหตุผล:';

    const badge = result.querySelector('.uxq-takeaway b');
    if (badge) {
      const raw = String(badge.textContent || '');
      if (/Evidence Architect|Badge unlocked/i.test(raw)) badge.textContent = 'Badge ที่ได้รับ: UX First Impression Analyst';
    }

    const next = [...result.querySelectorAll('a.uxq-btn')].find((item) => /w2-design-thinking-sprint\.html/i.test(item.getAttribute('href') || ''));
    if (next && !/UX Process/i.test(next.textContent)) next.textContent = 'เริ่ม W2 • UX Process →';
  }

  function boot(){
    enhance();
    const root = document.getElementById('uxqApp') || document.body;
    new MutationObserver(() => requestAnimationFrame(enhance)).observe(root, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
