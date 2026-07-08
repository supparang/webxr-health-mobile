/* CSAI2601 UX Quest • Reason Variety v2
   Uses data-reason index. Index 0 is the correct reason from the player.
*/
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const node = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();

  function h(s) { let x = 0; String(s || '').split('').forEach(c => { x = ((x << 5) - x + c.charCodeAt(0)) | 0; }); return Math.abs(x); }
  function choose(list, seed, add) { return list[(h(seed) + add) % list.length]; }

  const ok = [
    'ทำ task เดิม แล้วเทียบผลก่อนและหลังปรับ',
    'วัดจากพฤติกรรมจริง เช่น สำเร็จเร็วขึ้น ผิดน้อยลง หรืออธิบายขั้นตอนต่อได้',
    'ใช้หลักฐานจาก case เดิม ไม่ใช่ความชอบส่วนตัว',
    'ตรวจว่าผู้ใช้ทำงานหลักได้ดีขึ้นจากสถานการณ์นี้จริง',
    'พิสูจน์ด้วยผลลัพธ์ที่สังเกตได้จากการใช้งานจริง',
    'เชื่อมหลักฐาน ผู้ใช้ เป้าหมาย และผลหลังแก้เข้าด้วยกัน'
  ];
  const d1 = [
    'ถามว่าชอบภาพไหนมากกว่า โดยไม่ได้ให้ทำภารกิจจริง',
    'ให้โหวตหน้าที่ดูดี แต่ไม่ดูว่างานสำเร็จไหม',
    'ใช้ความสวยหรือความชอบแทนหลักฐานการใช้งาน',
    'ดูว่าแบบใหม่ถูกใจไหม แต่ไม่วัดพฤติกรรมผู้ใช้'
  ];
  const d2 = [
    'ให้ทีมตัดสินว่าแบบใหม่ดีขึ้น โดยไม่ลองกับผู้ใช้',
    'เลือกตามความเห็นทีม มากกว่าหลักฐานจากผู้ใช้จริง',
    'ทีมรู้สึกว่าดีขึ้น แต่ยังไม่เห็นผลจากผู้ใช้',
    'ใช้มุมมองคนทำงานแทนมุมมองผู้ใช้'
  ];
  const d3 = [
    'ดูแค่จำนวนคนเข้าหน้าแรก แต่ไม่รู้ว่าใช้งานสำเร็จไหม',
    'นับคนเห็นหน้าใหม่ โดยไม่ดูว่าทำ task ได้หรือไม่',
    'สรุปจากจำนวนการเข้าดู แทนการวัดการทำงานจริง',
    'เพิ่มคำอธิบายยาวขึ้น โดยไม่แก้จุดที่ผู้ใช้ติด'
  ];

  function idx(btn) {
    const m = String(btn?.dataset?.reason || '').match(/-(\d+)$/);
    return m ? Number(m[1]) : -1;
  }
  function list(n) { return n === 0 ? ok : n === 1 ? d1 : n === 2 ? d2 : d3; }
  function seed() { return [node(), text($('.top .pill')), text($('.case .kicker')), text($('.case h1')), text($('.case p:last-child'))].join('|'); }

  function apply() {
    const box = $('.verify');
    if (!box || box.dataset.reasonVarietyV2 === '1') return;
    const s = seed();
    $$('.verify .option', box).forEach((btn, i) => {
      const n = idx(btn);
      const b = $('b', btn);
      const small = $('span', btn);
      if (b) b.textContent = choose(list(n), s, i + Math.max(0, n));
      if (small) small.textContent = n === 0 ? 'เหตุผลนี้โยงกับหลักฐานและผลลัพธ์ของผู้ใช้' : 'เหตุผลนี้ยังไม่พอพิสูจน์ผลจากผู้ใช้จริง';
    });
    const title = $('h3', box);
    if (title) title.textContent = `ตรวจเหตุผล • ${node()}`;
    box.dataset.reasonVarietyV2 = '1';
  }

  let t = 0;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
