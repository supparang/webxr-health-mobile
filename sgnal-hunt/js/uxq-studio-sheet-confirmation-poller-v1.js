/* CSAI2601 UX Quest • Studio Sheet Confirmation Poller v1
 * Re-checks Google Sheet after Studio + Reflection submission until the
 * Three-Part tracker is confirmed or the bounded polling window expires.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const DELAYS = [2500, 5000, 8000, 12000, 16000, 20000];
  let runToken = 0;
  let timers = [];

  function statusEl() {
    return ROOT.querySelector('.artifact[data-studio-practice-v1] [data-save-status]');
  }

  function setStatus(text, tone = '') {
    const el = statusEl();
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone;
  }

  function confirmedCount() {
    const badge = document.querySelector('#uxqThreePartCompletion .uxq-3part__count');
    const text = String(badge?.textContent || '');
    const match = text.match(/(\d+)\s*\/\s*3/);
    return match ? Number(match[1]) : 0;
  }

  function isConfirmed() {
    if (confirmedCount() >= 3) return true;
    const items = Array.from(document.querySelectorAll('#uxqThreePartCompletion .uxq-3part__item'));
    return items.length >= 3 && items.every(item => item.dataset.state === 'done');
  }

  function forceRead() {
    try { window.UXQThreePartCompletionV1?.loadServerStatus?.(true); } catch (_) {}
  }

  function clearPolling() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function finishIfConfirmed() {
    if (!isConfirmed()) return false;
    clearPolling();
    setStatus('บันทึกสำเร็จแล้ว • Google Sheet ยืนยัน Studio Practice และ Weekly Reflection ครบถ้วน', 'ok');
    window.dispatchEvent(new CustomEvent('uxq-three-part-sheet-confirmed', {
      detail:{ confirmed:true, count:3 }
    }));
    return true;
  }

  function start() {
    clearPolling();
    const token = ++runToken;
    setStatus('ส่งคำขอสำเร็จแล้ว • กำลังตรวจการยืนยันจาก Google Sheet…');

    let elapsed = 0;
    DELAYS.forEach((delay, index) => {
      elapsed += delay;
      timers.push(setTimeout(() => {
        if (token !== runToken || finishIfConfirmed()) return;
        setStatus(`กำลังรอ Google Sheet ยืนยัน… ตรวจครั้งที่ ${index + 1}/${DELAYS.length}`);
        forceRead();
        setTimeout(() => {
          if (token !== runToken) return;
          if (finishIfConfirmed()) return;
          if (index === DELAYS.length - 1) {
            setStatus('ยังไม่พบการยืนยันจาก Google Sheet • โปรดรอสักครู่แล้วกดตรวจสถานะอีกครั้ง', 'error');
            ensureRetryButton();
          }
        }, 1400);
      }, elapsed));
    });
  }

  function ensureRetryButton() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    const actions = artifact?.querySelector('.actions');
    if (!actions || actions.querySelector('[data-check-sheet-status]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn secondary';
    button.dataset.checkSheetStatus = '1';
    button.textContent = 'ตรวจสถานะจาก Google Sheet';
    actions.appendChild(button);
  }

  document.addEventListener('click', event => {
    const retry = event.target.closest?.('[data-check-sheet-status]');
    if (!retry) return;
    retry.remove();
    forceRead();
    start();
  });

  window.addEventListener('uxq-studio-artifact-dispatched', start);
  window.addEventListener('uxq-progress-updated', finishIfConfirmed);
  window.addEventListener('uxq-sheet-progress-restored', finishIfConfirmed);
  window.addEventListener('uxq-three-part-updated', finishIfConfirmed);

  const observer = new MutationObserver(() => finishIfConfirmed());
  observer.observe(ROOT, { childList:true, subtree:true, characterData:true });

  window.UXQStudioSheetConfirmationPollerV1 = Object.freeze({ start, forceRead, isConfirmed });
})();