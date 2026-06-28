/* UX Quest • Result Receipt UI v1
   A transparent client-side receipt for each attempt.
   It distinguishes local save, queued delivery and an unverified dispatch.
*/
(() => {
  'use strict';

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function receipt(){
    try { return window.UXQSubmissionReceipt?.getLast?.() || null; }
    catch (error) { return null; }
  }
  function meta(item){
    const state = item?.state || 'local_only';
    if (state === 'confirmed') return { tag: 'SYSTEM CONFIRMED', tone: 'good', title: 'ระบบยืนยันการบันทึกแล้ว', body: 'มีการตอบรับจากระบบปลายทางสำหรับรอบนี้แล้ว' };
    if (state === 'dispatched_unverified') return { tag: 'REQUEST DISPATCHED', tone: 'warn', title: 'ส่งคำขอไปยังระบบชั้นเรียนแล้ว', body: 'หน้านี้ยังยืนยันไม่ได้ว่า Apps Script หรือ Google Sheets บันทึกแถวข้อมูลสำเร็จ เพราะการส่งแบบ no-cors อ่านคำตอบจากปลายทางไม่ได้' };
    if (state === 'dispatching') return { tag: 'SAVING REQUEST', tone: 'warn', title: 'บันทึกในอุปกรณ์แล้ว กำลังส่งคำขอ', body: 'โปรดรอสักครู่ ระบบจะอัปเดตสถานะการส่งในหน้านี้' };
    if (state === 'queued') return { tag: 'QUEUED ON DEVICE', tone: 'bad', title: 'บันทึกในอุปกรณ์แล้ว รอส่งเมื่อเชื่อมต่อ', body: 'ระบบเก็บรอบนี้ไว้ในคิวของอุปกรณ์และจะลองส่งใหม่เมื่อกลับมาออนไลน์' };
    if (state === 'profile_incomplete') return { tag: 'SAVED ON DEVICE', tone: 'bad', title: 'บันทึกเฉพาะในอุปกรณ์นี้', body: 'ยังไม่ส่งเข้าระบบชั้นเรียน เพราะข้อมูลผู้เรียนยังไม่ครบ' };
    return { tag: 'SAVED ON DEVICE', tone: 'bad', title: 'บันทึกเฉพาะในอุปกรณ์นี้', body: 'ยังไม่ได้เปิดการเชื่อมต่อกับระบบชั้นเรียนสำหรับรอบนี้' };
  }
  function ensureStyle(){
    if (document.getElementById('uxq-result-receipt-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-result-receipt-style';
    style.textContent = `
      .uxq-submission-receipt{width:min(700px,100%);text-align:left;border:1px solid rgba(110,231,255,.32);border-radius:16px;background:rgba(9,28,56,.64);padding:14px 16px;display:grid;gap:8px}
      .uxq-submission-receipt[data-tone="good"]{border-color:rgba(119,233,164,.54);background:rgba(39,112,77,.16)}
      .uxq-submission-receipt[data-tone="warn"]{border-color:rgba(255,209,102,.54);background:rgba(101,73,18,.20)}
      .uxq-submission-receipt[data-tone="bad"]{border-color:rgba(255,151,166,.46);background:rgba(105,35,53,.18)}
      .uxq-submission-receipt__kicker{font-size:.73rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--uxq-accent,#6ee7ff)}
      .uxq-submission-receipt__title{font-weight:900;color:#fff;font-size:1rem}.uxq-submission-receipt__body{color:#d4e0fa;line-height:1.58;font-size:.9rem}
      .uxq-submission-receipt__codes{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}.uxq-submission-receipt__code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;color:#c8dcff;background:rgba(3,13,30,.48);border:1px solid rgba(181,205,255,.17);padding:6px 8px;border-radius:8px;word-break:break-all}
    `;
    document.head.appendChild(style);
  }
  function decorate(){
    const result = document.querySelector('.uxq-results');
    if (!result) return;
    const item = receipt();
    if (!item) return;
    const info = meta(item);
    const existing = result.querySelector('.uxq-submission-receipt');
    const card = document.createElement('section');
    card.className = 'uxq-submission-receipt';
    card.dataset.tone = info.tone;
    card.dataset.receiptId = item.receiptId || '';
    card.innerHTML = `
      <div class="uxq-submission-receipt__kicker">${esc(info.tag)}</div>
      <div class="uxq-submission-receipt__title">${esc(info.title)}</div>
      <div class="uxq-submission-receipt__body">${esc(info.body)}</div>
      <div class="uxq-submission-receipt__codes">
        ${item.attemptId ? `<span class="uxq-submission-receipt__code">Attempt: ${esc(item.attemptId)}</span>` : ''}
        ${item.eventId ? `<span class="uxq-submission-receipt__code">Event: ${esc(item.eventId)}</span>` : ''}
      </div>
    `;
    if (existing) existing.replaceWith(card);
    else {
      const anchor = result.querySelector('.uxq-takeaway');
      if (anchor) anchor.insertAdjacentElement('afterend', card);
      else result.appendChild(card);
    }
    const tag = document.querySelector('.uxq-top .uxq-mission-tag');
    if (tag) tag.textContent = info.tag;
  }
  function boot(){
    ensureStyle();
    decorate();
    const observer = new MutationObserver(() => { decorate(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('uxq:submission-receipt', () => window.setTimeout(decorate, 0));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
