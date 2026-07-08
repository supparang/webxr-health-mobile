/* CSAI2601 UX Quest • Reason Variety v3
   Fix: correct reason is varied by question kind, not one repeated generic answer.
   data-reason index 0 remains the correct reason from the player.
*/
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const node = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();
  const KEY = `csai2601.reason.v3.${node()}`;

  function h(s) { let x = 0; String(s || '').split('').forEach(c => { x = ((x << 5) - x + c.charCodeAt(0)) | 0; }); return Math.abs(x); }
  function seq() { const n = Number(sessionStorage.getItem(KEY) || 0) + 1; try { sessionStorage.setItem(KEY, String(n)); } catch(e) {} return n; }
  function choose(list, seed, add) { return list[(h(seed) + add) % list.length]; }
  function idx(btn) { const m = String(btn?.dataset?.reason || '').match(/-(\d+)$/); return m ? Number(m[1]) : -1; }

  function kind() {
    const k = [text($('.case .kicker')), text($('.case h1')), text($('.case p:last-child'))].join(' ').toLowerCase();
    if (/friction|pain|ติดขัด|ปัญหา/.test(k)) return 'friction';
    if (/goal|need|เป้าหมาย|ผู้ใช้/.test(k)) return 'goal';
    if (/impact|ui|ux|feedback|ผลกระทบ|สับสน|ผิด/.test(k)) return 'impact';
    if (/proof|test|validate|evidence|วัด|ทดสอบ|พิสูจน์/.test(k)) return 'proof';
    if (/fix|repair|แก้|ปรับ/.test(k)) return 'fix';
    return 'fix';
  }

  const OK = {
    friction: [
      'ชี้จุดที่ผู้ใช้ติดจริง และทำให้งานหลักเดินต่อไม่ได้',
      'โยงจากหลักฐานว่า friction นี้กระทบ task สำคัญ',
      'ระบุอุปสรรคของผู้ใช้ ไม่ใช่ตัดสินจากหน้าตาอย่างเดียว',
      'อธิบายว่าผู้ใช้เสียเวลา สับสน หรือทำผิดขั้นตอนตรงไหน',
      'จับปัญหาจากพฤติกรรมผู้ใช้ใน case นี้โดยตรง'
    ],
    goal: [
      'ผูกกับงานหลักที่ผู้ใช้ต้องทำให้สำเร็จจริง',
      'จับ user goal จากสิ่งที่ผู้ใช้ต้องทำ ไม่ใช่สิ่งที่ทีมชอบ',
      'บอกได้ว่าผู้ใช้ต้องรู้อะไรเพื่อไปขั้นตอนถัดไป',
      'แยกเป้าหมายผู้ใช้ออกจากความสวยหรือฟีเจอร์เสริม',
      'อธิบายผลลัพธ์ที่ผู้ใช้ต้องการในสถานการณ์นี้ได้'
    ],
    impact: [
      'อธิบายผลกระทบต่อความเข้าใจ การตัดสินใจ หรือ task ของผู้ใช้',
      'แยกได้ว่าปัญหาอยู่ที่ลำดับข้อมูล flow หรือ feedback',
      'ชี้ว่าปัญหาทำให้ผู้ใช้สับสน ทำผิด หรือทำงานไม่สำเร็จอย่างไร',
      'วิเคราะห์ชั้นปัญหาก่อนเลือกวิธีแก้',
      'โยงผลกระทบกับพฤติกรรมผู้ใช้ ไม่ใช่แค่ลักษณะหน้าจอ'
    ],
    fix: [
      'แก้จุดติดขัดหลักโดยไม่เพิ่มภาระใหม่ให้ผู้ใช้',
      'เชื่อมหลักฐานกับสิ่งที่จะปรับในหน้าจอหรือ flow ได้',
      'ช่วยให้ผู้ใช้ทำ task เดิมได้ง่ายและมั่นใจกว่าเดิม',
      'แก้จาก root cause ไม่ใช่แต่งหน้าจอเฉย ๆ',
      'เลือกวิธีที่ลด friction และตรวจผลหลังปรับได้'
    ],
    proof: [
      'ให้ผู้ใช้ทำ task เดิม แล้วเทียบผลก่อนและหลังปรับ',
      'วัดจากพฤติกรรมจริง เช่น สำเร็จเร็วขึ้น ผิดน้อยลง หรืออธิบายขั้นตอนต่อได้',
      'ใช้หลักฐานจาก case เดิม ไม่ใช่ความชอบส่วนตัว',
      'ตรวจว่าผู้ใช้ทำงานหลักได้ดีขึ้นจากสถานการณ์นี้จริง',
      'พิสูจน์ด้วยผลลัพธ์ที่สังเกตได้จากการใช้งานจริง'
    ]
  };

  const BAD = [
    ['ถามว่าชอบภาพไหนมากกว่า โดยไม่ได้ให้ทำภารกิจจริง','ให้โหวตหน้าที่ดูดี แต่ไม่ดูว่างานสำเร็จไหม','ใช้ความสวยหรือความชอบแทนหลักฐานการใช้งาน','ดูว่าแบบใหม่ถูกใจไหม แต่ไม่วัดพฤติกรรมผู้ใช้'],
    ['ให้ทีมตัดสินว่าแบบใหม่ดีขึ้น โดยไม่ลองกับผู้ใช้','เลือกตามความเห็นทีม มากกว่าหลักฐานจากผู้ใช้จริง','ทีมรู้สึกว่าดีขึ้น แต่ยังไม่เห็นผลจากผู้ใช้','ใช้มุมมองคนทำงานแทนมุมมองผู้ใช้'],
    ['ดูแค่จำนวนคนเข้าหน้าแรก แต่ไม่รู้ว่าใช้งานสำเร็จไหม','นับคนเห็นหน้าใหม่ โดยไม่ดูว่าทำ task ได้หรือไม่','สรุปจากจำนวนการเข้าดู แทนการวัดการทำงานจริง','เพิ่มคำอธิบายยาวขึ้น โดยไม่แก้จุดที่ผู้ใช้ติด']
  ];

  function seed(roundNo) { return [node(), roundNo, text($('.top .pill')), text($('.case .kicker')), text($('.case h1')), text($('.case p:last-child'))].join('|'); }

  function apply() {
    const box = $('.verify');
    if (!box || box.dataset.reasonVarietyV3 === '1') return;
    const k = kind();
    const roundNo = seq();
    const s = seed(roundNo);
    $$('.verify .option', box).forEach((btn, i) => {
      const n = idx(btn);
      const b = $('b', btn);
      const small = $('span', btn);
      const list = n === 0 ? (OK[k] || OK.fix) : (BAD[Math.max(0, n - 1)] || BAD[2]);
      if (b) b.textContent = choose(list, s, i + Math.max(0, n));
      if (small) small.textContent = n === 0 ? `เหตุผลนี้ตรงกับชนิดข้อ: ${k}` : 'เหตุผลนี้ยังไม่พอพิสูจน์จากผู้ใช้จริง';
    });
    const title = $('h3', box);
    if (title) title.textContent = `ตรวจเหตุผล • ${node()} • ${kind()}`;
    box.dataset.reasonVarietyV3 = '1';
  }

  let t = 0;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
