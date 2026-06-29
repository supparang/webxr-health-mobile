/* UX Quest • Anti-Guess Replay Coach v2
   Presentation-only learning support. It reads the finished result screen and
   local receipt, adds targeted replay guidance, and never intercepts mission
   flow, scoring, progression, identity, or data sync.
*/
(() => {
  'use strict';

  const stageGuide = {
    evidence: ['Evidence', 'เริ่มจากพฤติกรรมผู้ใช้ที่สังเกตได้จริง ไม่ใช่คำอธิบายที่ฟังดูสมเหตุผลอย่างเดียว'],
    hypothesis: ['Hypothesis', 'เชื่อมหลักฐานกับสิ่งที่ผู้ใช้อาจเข้าใจผิดหรือ friction ที่เป็นสาเหตุ'],
    fix: ['Fix', 'เลือกการปรับที่แก้ต้นเหตุ และทำให้ผู้ใช้รู้ action ถัดไปได้ชัด'],
    test: ['Test', 'ให้ความสำคัญกับ task success เวลา และความเข้าใจ มากกว่าความเห็นทั่วไป'],
    empathize: ['Empathize', 'เก็บบริบท พฤติกรรม และความรู้สึกก่อนตัดสินใจหา solution'],
    define: ['Define', 'เขียนโจทย์จาก user need และ barrier โดยยังไม่รีบล็อกวิธีแก้'],
    ideate: ['Ideate', 'เลือกแนวคิดที่พาผู้ใช้ไปถึงเป้าหมาย ไม่ใช่แค่แนวคิดที่น่าสนใจ'],
    prototype: ['Prototype', 'ทำต้นแบบเฉพาะ flow ที่เสี่ยง เพื่อเรียนรู้จากการใช้งานจริงได้เร็ว'],
    diagnose: ['Diagnose', 'แยกงานหลักออกจากข้อมูลหรือสิ่งรบกวนที่ทำให้ผู้ใช้คิดเกินจำเป็น'],
    prioritize: ['Prioritize', 'วาง action สำคัญและข้อมูลตัดสินใจก่อน ส่วนรองไม่ควรแข่งขันกัน'],
    reduce: ['Reduce load', 'ใช้ chunking, default ที่ปลอดภัย และ progressive disclosure เพื่อลดภาระ'],
    validate: ['Validate', 'ตรวจว่าผู้ใช้ทำงานและเข้าใจได้จริง ไม่ใช่เพียงชอบหน้าจอ'],
    process: ['UX process', 'เรียงหลักฐาน → need → prototype → test เพื่อไม่ข้ามขั้นของการเรียนรู้']
  };

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
      .uxq-replay-coach__focus{display:grid;gap:7px;border-top:1px solid rgba(181,205,255,.2);padding-top:10px}
      .uxq-replay-coach__focus-title{font-size:.78rem;font-weight:900;letter-spacing:.07em;color:#c6efff;text-transform:uppercase}
      .uxq-replay-coach__focus-row{padding:9px 10px;border-radius:12px;background:rgba(159,141,255,.13);color:#e7e2ff;font-size:.88rem;line-height:1.52}
      .uxq-replay-coach__focus-row b{color:#fff}
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

  function receiptMap(verified){
    try {
      const map = window.UXQSubmissionReceipt?.getLast?.()?.learningMap;
      if (!map?.available) return null;
      if (Number(map.verifiedAccuracy) !== Math.round(Number(verified))) return null;
      return map;
    } catch (error) {
      return null;
    }
  }

  function focusMarkup(map){
    const focus = Array.isArray(map?.focus) ? map.focus.slice(0, 3) : [];
    if (!focus.length) return '';

    const rows = focus.map((item) => {
      const [label, guide] = stageGuide[item.stageKey] || [item.stageKey || 'Reason Check', 'เชื่อมคำตอบกับพฤติกรรมผู้ใช้ จุดติดขัด และผลที่ต้องพิสูจน์'];
      const prefix = item.mainCorrect
        ? 'คำตอบหลักถูก แต่เหตุผลยังไม่ตรง'
        : 'เริ่มจากทบทวนคำตอบและเหตุผล';
      return `<div class="uxq-replay-coach__focus-row"><b>${label}</b> · ${prefix}<br>${guide}</div>`;
    }).join('');

    return `<div class="uxq-replay-coach__focus"><div class="uxq-replay-coach__focus-title">Focus for the next case</div>${rows}</div>`;
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
    const map = receiptMap(verified);
    const card = document.createElement('section');
    card.className = 'uxq-replay-coach';
    card.dataset.level = ready ? 'ready' : 'review';
    card.dataset.uxqReplayCoach = `${verified}|${evidence.current}/${evidence.total}|${(map?.focus || []).map(item => `${item.stageKey}:${item.count}`).join(',')}`;

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
      ${focusMarkup(map)}
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
    window.addEventListener('uxq:submission-receipt', decorate);
    const observer = new MutationObserver(decorate);
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
