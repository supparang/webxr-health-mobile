/* UX Quest • Result Integrity v1
 * Makes result messaging, badge state and unlock state agree with the actual score.
 * This is presentation-only: it never changes stars, progression or analytics.
 */
(() => {
  'use strict';

  const $ = (selector, root) => (root || document).querySelector(selector);
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const toPercent = (value) => {
    const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : 0;
  };
  const starsFrom = (value) => (String(value || '').match(/★/g) || []).length;

  function addStyle(){
    if (document.getElementById('uxq-result-integrity-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-result-integrity-style';
    style.textContent = '.uxq-result-integrity-note{width:min(760px,100%);padding:10px 13px;border-radius:13px;border:1px solid rgba(181,205,255,.22);background:rgba(5,15,35,.28);text-align:left;color:#dce8ff;font-size:.86rem;line-height:1.5}.uxq-result-integrity-note[data-state="cleared"]{border-color:rgba(119,233,164,.42);background:rgba(39,112,77,.10)}.uxq-result-integrity-note[data-state="review"]{border-color:rgba(255,209,102,.42);background:rgba(255,209,102,.07)}.uxq-result-integrity-note b{color:#fff}';
    document.head.appendChild(style);
  }

  function metric(root, labels){
    const wanted = Array.isArray(labels) ? labels : [labels];
    const card = [...root.querySelectorAll('.uxq-result-grid div')].find((node) => wanted.includes(normalize(node.querySelector('span')?.textContent)));
    return card?.querySelector('b')?.textContent || '';
  }

  function badgeText(root, passed, verified){
    const node = $('.uxq-takeaway b', root);
    if (!node) return;
    const raw = String(node.textContent || '').trim();
    const title = $('h1', root)?.textContent || '';
    const alreadyClear = /badge\s+(ที่ปลดล็อก|ยังไม่ปลดล็อก)|badge unlocked/i.test(raw);
    const currentName = (raw.match(/(?:Badge unlocked:|Badge ที่ได้รับ:|Badge ที่ปลดล็อก:)\s*(.+)$/i) || [])[1] || '';
    const eligible = passed && verified >= 55;
    let next;

    if (!eligible) {
      next = passed
        ? 'Badge ยังไม่ปลดล็อก — ผ่านภารกิจแล้ว แต่ต้องมี Reason Check อย่างน้อย 55%'
        : 'Badge ยังไม่ปลดล็อก — ต้องผ่านภารกิจที่ 2★ และมี Reason Check อย่างน้อย 55%';
    } else if (/Badge ยังไม่ปลดล็อก/i.test(raw)) {
      next = 'Badge ผ่านเกณฑ์แล้ว — รีเฟรชผลรอบนี้อีกครั้งเพื่อรับข้อมูล Badge ล่าสุด';
    } else if (currentName && !/Casefile Rookie|Insight Scout/i.test(currentName)) {
      next = `Badge ที่ปลดล็อก: ${currentName}`;
    } else {
      next = starsFrom($('.uxq-results__stars', root)?.textContent) === 3
        ? 'Badge ที่ปลดล็อก: Evidence Architect'
        : 'Badge ที่ปลดล็อก: Mission Mastery';
    }

    if (node.textContent !== next && (alreadyClear || /Badge unlocked/i.test(raw) || /Casefile Rookie|Insight Scout/i.test(raw) || title)) node.textContent = next;
  }

  function statusNote(root, passed, stars, verified){
    const state = passed ? 'cleared' : 'review';
    const expected = passed
      ? `ผลลัพธ์สอดคล้องกัน: ผ่าน ${stars}★ • Reason Check ${verified}% • ด่านถัดไปจึงเปิดได้`
      : `ผลลัพธ์สอดคล้องกัน: ยังไม่ผ่านเกณฑ์ปลดล็อก • ${stars}★ • Reason Check ${verified}%`;
    let note = $('.uxq-result-integrity-note', root);
    if (!note) {
      note = document.createElement('p');
      note.className = 'uxq-result-integrity-note';
      const grid = $('.uxq-result-grid', root);
      if (grid) grid.insertAdjacentElement('afterend', note); else root.appendChild(note);
    }
    note.dataset.state = state;
    const html = `<b>Result Integrity</b> • ${expected}`;
    if (note.innerHTML !== html) note.innerHTML = html;
  }

  function decorate(){
    const root = $('.uxq-results');
    if (!root) return;
    addStyle();
    const stars = starsFrom($('.uxq-results__stars', root)?.textContent);
    const passed = /MISSION CLEARED/i.test(String($('.uxq-kicker', root)?.textContent || '')) && stars >= 2;
    const verified = toPercent(metric(root, ['verified', 'ตรวจเหตุผล']));
    const key = `${passed}|${stars}|${verified}`;
    if (root.dataset.uxqIntegrity !== key) root.dataset.uxqIntegrity = key;
    badgeText(root, passed, verified);
    statusNote(root, passed, stars, verified);
    window.dispatchEvent(new CustomEvent('uxq:result-integrity', { detail:{ passed, stars, verified } }));
  }

  function boot(){
    decorate();
    const observer = new MutationObserver(() => requestAnimationFrame(decorate));
    observer.observe(document.documentElement, { childList:true, subtree:true });
    window.addEventListener('uxq:submission-receipt', () => setTimeout(decorate, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
