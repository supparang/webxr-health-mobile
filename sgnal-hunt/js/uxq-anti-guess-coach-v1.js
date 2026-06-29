/* UX Quest • Anti-Guess Replay Coach v1
   Presentation-only learning support. It reads the finished result screen,
   adds a targeted replay plan, and never intercepts game flow, scoring, or data sync.
*/
(() => {
  'use strict';

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const parsePercent = (value) => {
    const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : null;
  };
  const parseFraction = (value) => {
    const match = String(value || '').match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
  };

  function addStyle(){
    if (document.getElementById('uxq-anti-guess-coach-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-anti-guess-coach-style';
    style.textContent = `
      .uxq-replay-coach{width:min(760px,100%);border:1px solid rgba(110,231,255,.38);border-radius:17px;background:rgba(8,42,73,.38);padding:15px 16px;text-align:left;display:grid;gap:9px}
      .uxq-replay-coach[data-level="ready"]{border-color:rgba(119,233,164,.48);background:rgba(39,112,77,.14)}
      .uxq-replay-coach__kicker{font-size:.74rem;font-weight:950;letter-spacing:.1em;color:#6ee7ff;text-transform:uppercase}
      .uxq-replay-coach__title{font-size:1rem;font-weight:900;color:#fff}
      .uxq-replay-coach__body{margin:0;color:#dbeafe;line-height:1.6;font-size:.92rem}
      .uxq-replay-coach details{border-top:1px solid rgba(181,205,255,.2);padding-top:10px;color:#dbeafe;font-size:.9rem;line-height:1.58}
      .uxq-replay-coach summary{cursor:pointer;color:#baf4ff;font-weight:850}
      .uxq-replay-coach ol{margin:9px 0 0;padding-left:22px}
      .uxq-replay-coach li+li{margin-top:5px}
    `;
    document.head.appendChild(style);
  }

  function metric(root, label){
    const cards = [...root.querySelectorAll('.uxq-result-grid div')];
    const card = cards.find((node) => normalize(node.querySelector('span')?.textContent) === label);
    return card?.querySelector('b')?.textContent?.trim() || '';
  }

  function buildCard(root){
    const verifiedText = metric(root, 'verified');
    const evidenceText = metric(root, 'evidence calls');
    const verified = parsePercent(verifiedText);
    const evidence = parseFraction(evidenceText);
    if (verified == null || !evidence?.total) return null;

    const need = Math.ceil(evidence.total * 0.70);
    const approximateVerified = Math.round((verified / 100) * evidence.total);
    const remaining = Math.max(0, need - approximateVerified);
    const ready = verified >= 70;
    const card = document.createElement('section');
    card.className = 'uxq-replay-coach';
    card.dataset.level = ready ? 'ready' : 'review';
    card.dataset.uxqReplayCoach = `${verified}|${evidence.current}/${evidence.total}`;

    const title = ready
      ? 'Reasoning pattern แข็งแรงแล้ว'
      : `อีกประมาณ ${remaining || 1} Reason Check จะถึงเส้น 3★`;
    const body = ready
      ? 'คุณไม่ได้เพียงเลือกคำตอบถูก แต่เชื่อมคำตอบกับหลักฐานได้สม่ำเสมอแล้ว รอบถัดไปเปลี่ยนคดีเพื่อยืนยันว่าใช้หลักคิดเดิมกับบริบทใหม่ได้จริง'
      : 'รอบนี้ผ่าน Readiness แล้ว เป้าหมายรอบถัดไปคือเลือกเหตุผลที่อธิบาย “พฤติกรรมผู้ใช้ + จุดติดขัด + ผลที่เกิดขึ้น” โดยตรง ไม่เลือกข้อความที่ดูดีแต่ยังไม่ชี้สาเหตุ';

    card.innerHTML = `
      <div class="uxq-replay-coach__kicker">REPLAY COACH</div>
      <div class="uxq-replay-coach__title">${title}</div>
      <p class="uxq-replay-coach__body">${body}</p>
      <details>
        <summary>เช็ก 3 จุดก่อนเลือก Reason Check</summary>
        <ol>
          <li><b>Behavior:</b> เหตุผลกล่าวถึงสิ่งที่ผู้ใช้ทำ สับสน หรือหยุดตรงไหนจริงหรือไม่</li>
          <li><b>Friction:</b> เหตุผลชี้จุดติดขัดของ flow, label, information หรือ policy หรือไม่</li>
          <li><b>Test:</b> เหตุผลช่วยให้ทีมรู้ว่าจะพิสูจน์หรือปรับอะไรต่อได้หรือไม่</li>
        </ol>
      </details>`;
    return card;
  }

  function decorate(){
    const root = document.querySelector('.uxq-results');
    if (!root) return;
    const card = buildCard(root);
    if (!card) return;
    const old = root.querySelector('.uxq-replay-coach');
    if (old?.dataset.uxqReplayCoach === card.dataset.uxqReplayCoach) return;
    if (old) old.replaceWith(card);
    else {
      const receipt = root.querySelector('.uxq-submission-receipt');
      const takeaway = root.querySelector('.uxq-takeaway');
      (receipt || takeaway || root.querySelector('.uxq-result-grid'))?.insertAdjacentElement('afterend', card);
    }
  }

  function boot(){
    addStyle();
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
