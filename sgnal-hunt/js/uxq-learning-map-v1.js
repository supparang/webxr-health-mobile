/* UX Quest • Learning Map v1
   Presentation-only debrief based on the current device's receipt.
   It never changes mission flow, score, unlocks, progress, or submission.
*/
(() => {
  'use strict';

  const tips = {
    evidence: ['Evidence', 'เริ่มจากสิ่งที่ผู้ใช้ทำจริง จุดที่หยุด หรือความผิดพลาดที่สังเกตได้'],
    hypothesis: ['Hypothesis', 'เชื่อมหลักฐานกับสิ่งที่ผู้ใช้อาจเข้าใจผิดหรือ friction ที่น่าจะเป็นสาเหตุ'],
    fix: ['Fix', 'เลือกการปรับที่แก้สาเหตุและช่วยให้ผู้ใช้รู้ว่าต้องทำอะไรต่อ'],
    test: ['Test', 'ออกแบบงานทดสอบและเกณฑ์ที่วัด task success หรือความเข้าใจของผู้ใช้'],
    empathize: ['Empathize', 'เก็บบริบท พฤติกรรม และความรู้สึกก่อนรีบคิด solution'],
    define: ['Define', 'เขียนโจทย์จาก user need + barrier โดยยังไม่ล็อก solution'],
    ideate: ['Ideate', 'เลือกแนวคิดที่ช่วย need หลักและยังทดสอบกับผู้ใช้ได้'],
    prototype: ['Prototype', 'ทำต้นแบบเฉพาะ journey ที่เสี่ยงที่สุดเพื่อเรียนรู้ให้เร็ว'],
    diagnose: ['Diagnose', 'แยกงานหลักออกจากข้อมูลหรือสิ่งรบกวนที่ทำให้ผู้ใช้คิดเกินจำเป็น'],
    prioritize: ['Prioritize', 'จัดให้ action และข้อมูลสำคัญมาก่อน ส่วนรองไม่แข่งขันกัน'],
    reduce: ['Reduce load', 'ใช้ chunking, default ที่ปลอดภัย และ progressive disclosure เพื่อลดภาระ'],
    validate: ['Validate', 'วัดว่าผู้ใช้ทำงานและเข้าใจได้จริง ไม่ใช่เพียงชอบหน้าจอ'],
    process: ['UX process', 'เรียงลำดับจากหลักฐาน → need → prototype → test กับผู้ใช้จริง']
  };

  function addStyle(){
    if (document.getElementById('uxq-learning-map-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-learning-map-style';
    style.textContent = `
      .uxq-learning-map{width:min(760px,100%);border:1px solid rgba(155,140,255,.42);border-radius:17px;background:rgba(59,43,107,.20);padding:15px 16px;text-align:left;display:grid;gap:10px}
      .uxq-learning-map[data-state="mastered"]{border-color:rgba(119,233,164,.48);background:rgba(39,112,77,.14)}
      .uxq-learning-map__kicker{font-size:.74rem;font-weight:950;letter-spacing:.1em;color:#c7bfff;text-transform:uppercase}
      .uxq-learning-map__title{font-size:1rem;font-weight:900;color:#fff}
      .uxq-learning-map__lead{margin:0;color:#e4e8ff;line-height:1.58;font-size:.92rem}
      .uxq-learning-map__rows{display:grid;gap:8px}
      .uxq-learning-map__row{border-top:1px solid rgba(201,193,255,.18);padding-top:9px;display:grid;gap:3px}
      .uxq-learning-map__row b{color:#f4f1ff;font-size:.92rem}.uxq-learning-map__row span{color:#d8d3f6;font-size:.88rem;line-height:1.52}
      .uxq-learning-map__tag{display:inline-flex;align-items:center;width:max-content;border-radius:999px;padding:3px 8px;background:rgba(155,140,255,.24);color:#e9e5ff;font-size:.72rem;font-weight:850}
    `;
    document.head.appendChild(style);
  }

  function receipt(){
    try { return window.UXQSubmissionReceipt?.getLast?.() || null; }
    catch (error) { return null; }
  }

  function build(map){
    if (!map || typeof map !== 'object') return null;
    const focus = Array.isArray(map.focus) ? map.focus.slice(0, 3) : [];
    const verifiedAccuracy = Number(map.verifiedAccuracy || 0);
    const total = Number(map.total || 0);
    if (!total) return null;

    const card = document.createElement('section');
    const mastered = !focus.length && verifiedAccuracy >= 70;
    card.className = 'uxq-learning-map';
    card.dataset.state = mastered ? 'mastered' : 'review';
    card.dataset.uxqLearningMap = `${verifiedAccuracy}|${focus.map(item => `${item.stageKey}:${item.count}`).join('|')}`;

    const title = mastered
      ? 'Reasoning Map: ทุกจุดเชื่อมหลักฐานได้ดี'
      : 'Reasoning Map: จุดที่ควรเก็บหลักฐานเพิ่ม';
    const lead = mastered
      ? `Reason Check ${verifiedAccuracy}% — รอบต่อไปให้เปลี่ยนคดี เพื่อยืนยันว่าใช้หลักคิดเดิมกับสถานการณ์ใหม่ได้`
      : `Reason Check ${verifiedAccuracy}% — เลือกฝึกเฉพาะจุดด้านล่าง แล้วกลับไปพิสูจน์กับคดีใหม่ ไม่ต้องจำเฉลย`;

    const rows = focus.length
      ? focus.map((item) => {
          const [label, tip] = tips[item.stageKey] || [item.stageLabel || item.stageKey || 'Reason Check', 'ทบทวนความเชื่อมโยงระหว่างหลักฐาน ผู้ใช้ และการตัดสินใจ'];
          const issue = item.mainCorrect ? 'คำตอบหลักถูก แต่เหตุผลยังไม่ตรง' : 'ควรทบทวนทั้งคำตอบและเหตุผล';
          return `<div class="uxq-learning-map__row"><span class="uxq-learning-map__tag">${issue} · ${item.count} จุด</span><b>${label}</b><span>${tip}</span></div>`;
        }).join('')
      : '<div class="uxq-learning-map__row"><b>พร้อมรับคดีใหม่</b><span>ลองเปลี่ยนบริบทและอธิบายเหตุผลด้วยหลักฐานเดิมอย่างสม่ำเสมอ</span></div>';

    card.innerHTML = `<div class="uxq-learning-map__kicker">PERSONAL REASONING MAP</div><div class="uxq-learning-map__title">${title}</div><p class="uxq-learning-map__lead">${lead}</p><div class="uxq-learning-map__rows">${rows}</div>`;
    return card;
  }

  function decorate(){
    const root = document.querySelector('.uxq-results');
    const map = receipt()?.learningMap;
    if (!root || !map) return;
    const card = build(map);
    if (!card) return;
    const old = root.querySelector('.uxq-learning-map');
    if (old?.dataset.uxqLearningMap === card.dataset.uxqLearningMap) return;
    if (old) old.replaceWith(card);
    else {
      const coach = root.querySelector('.uxq-replay-coach');
      const takeaway = root.querySelector('.uxq-takeaway');
      (coach || takeaway || root.querySelector('.uxq-result-grid'))?.insertAdjacentElement('afterend', card);
    }
  }

  function boot(){
    addStyle();
    decorate();
    window.addEventListener('uxq:submission-receipt', decorate);
    new MutationObserver(decorate).observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
