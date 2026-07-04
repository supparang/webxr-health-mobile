/* UX Quest • W1 Result Copy v2
 * Keeps Week 1 results truthful: no unlocked badge or readiness claim on a failed run.
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
      if (labels[key] && item.textContent !== labels[key]) item.textContent = labels[key];
    });
  }

  function metric(result, candidates){
    const names = Array.isArray(candidates) ? candidates : [candidates];
    const cards = [...result.querySelectorAll('.uxq-result-grid div')];
    const card = cards.find((node) => names.includes(String(node.querySelector('span')?.textContent || '').trim().toLowerCase()));
    return card?.querySelector('b')?.textContent || '';
  }

  function enhance(){
    const result = document.querySelector('.uxq-results');
    if (!result) return;
    addStyle();

    const passed = /MISSION CLEARED/i.test(String(result.querySelector('.uxq-kicker')?.textContent || ''));
    const verified = Number(String(metric(result, ['verified', 'ตรวจเหตุผล'])).replace(/[^0-9.]/g, '')) || 0;
    const title = result.querySelector('h1');
    if (title && (/Readiness|คุณเริ่มเห็น pattern/i.test(title.textContent))) {
      title.textContent = passed
        ? 'ผ่านภารกิจ UX First Impression แล้ว!'
        : 'คุณเริ่มเห็น UX Friction แล้ว — ลองคดีใหม่เพื่อทำให้เหตุผลชัดขึ้น';
    }

    const subtitle = title?.nextElementSibling;
    if (subtitle?.tagName === 'P') {
      subtitle.classList.add('uxq-w1-result-subtitle');
      const next = passed
        ? 'คุณใช้ Task → Evidence → Diagnosis → UX Impact → Quick Redesign → Test Plan ได้ครบแล้ว'
        : 'ผลรอบนี้ยังไม่ผ่านเกณฑ์ปลดล็อก W2 — เล่นคดีใหม่และใช้หลักฐานยืนยันคำตอบให้มากขึ้น';
      if (subtitle.textContent !== next) subtitle.textContent = next;
    }

    replaceMetricLabels(result);

    const reason = result.querySelector('.uxq-guess-note b');
    if (reason && /Anti-guess/i.test(reason.textContent) && reason.textContent !== 'ตรวจเหตุผล:') reason.textContent = 'ตรวจเหตุผล:';

    const badge = result.querySelector('.uxq-takeaway b');
    if (badge) {
      const nextBadge = passed && verified >= 55
        ? 'Badge ที่ปลดล็อก: UX First Impression Analyst'
        : (passed
          ? 'ผ่านภารกิจแล้ว แต่ Badge UX First Impression Analyst ยังไม่ปลดล็อก — ต้องมี Reason Check อย่างน้อย 55%'
          : 'Badge ยังไม่ปลดล็อก — ต้องผ่านภารกิจที่ 2★ และมี Reason Check อย่างน้อย 55%');
      if (badge.textContent !== nextBadge) badge.textContent = nextBadge;
    }

    const next = [...result.querySelectorAll('a.uxq-btn')].find((item) => /w2-design-thinking-sprint\.html/i.test(item.getAttribute('href') || ''));
    if (next && next.textContent !== 'เริ่ม W2 • UX Process →') next.textContent = 'เริ่ม W2 • UX Process →';
  }

  function boot(){
    enhance();
    new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.getElementById('uxqApp') || document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
