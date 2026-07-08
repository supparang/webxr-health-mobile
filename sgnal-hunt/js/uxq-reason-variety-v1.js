/* CSAI2601 UX Quest • Reason Variety Patch v1
   Makes visible Reason Check choices vary by node, case and round.
*/
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => String(el?.textContent || '').trim();
  const q = () => new URLSearchParams(location.search || '');
  const node = () => String(q().get('node') || q().get('id') || 'W1').toUpperCase();

  function hash(s) {
    let h = 0;
    String(s || '').split('').forEach((ch) => { h = ((h << 5) - h + ch.charCodeAt(0)) | 0; });
    return Math.abs(h);
  }
  function pick(list, seed, plus) { return list[(hash(seed) + (plus || 0)) % list.length]; }

  const good = [
    'ให้ผู้ใช้ทำภารกิจเดิม แล้วเทียบผลก่อนและหลังปรับ',
    'วัดจากพฤติกรรมจริง เช่น ทำสำเร็จเร็วขึ้น ผิดน้อยลง หรืออธิบายขั้นตอนต่อได้',
    'ใช้หลักฐานจาก task เดิม ไม่ใช่ความชอบส่วนตัว',
    'ตรวจว่าผู้ใช้ทำงานหลักได้ดีขึ้นจาก case นี้จริง',
    'พิสูจน์ด้วยผลลัพธ์ที่สังเกตได้จากการใช้งานจริง',
    'เชื่อมคำตอบกับหลักฐาน ผู้ใช้ เป้าหมาย และผลหลังแก้'
  ];
  const like = [
    'ถามว่าชอบภาพไหนมากกว่า แต่ไม่ได้ให้ทำภารกิจจริง',
    'ให้โหวตหน้าที่ดูดี โดยไม่ดูว่างานสำเร็จไหม',
    'ใช้ความสวยหรือความชอบแทนหลักฐานการใช้งาน',
    'ดูว่าแบบใหม่ถูกใจไหม แต่ไม่วัดพฤติกรรมผู้ใช้'
  ];
  const count = [
    'ดูแค่จำนวนคนเข้าหน้าแรก แต่ไม่รู้ว่าใช้งานสำเร็จไหม',
    'นับคนเห็นหน้าใหม่ โดยไม่ดูว่าทำ task ได้หรือไม่',
    'สรุปจากจำนวนการเข้าดู แทนการวัดการทำงานจริง',
    'ดูตัวเลขการเข้าหน้า แต่ไม่เห็นปัญหาระหว่างใช้งาน'
  ];
  const team = [
    'ให้ทีมตัดสินว่าแบบใหม่ดีขึ้น โดยไม่ทดสอบกับผู้ใช้',
    'เลือกตามความเห็นทีม มากกว่าหลักฐานจากผู้ใช้จริง',
    'ทีมรู้สึกว่าดีขึ้น แต่ยังไม่เห็นผลจากผู้ใช้',
    'ใช้มุมมองคนทำงานแทนมุมมองผู้ใช้'
  ];
  const other = [
    'เพิ่มคำอธิบายยาวขึ้น โดยไม่แก้จุดที่ผู้ใช้ติด',
    'ทำปุ่มให้เด่นขึ้น แต่ไม่แก้ลำดับงานหรือ feedback',
    'ลดข้อมูลจนผู้ใช้ขาดสิ่งที่ต้องใช้ตัดสินใจ',
    'คัดลอกรูปแบบจากที่อื่น โดยไม่ดู case นี้'
  ];

  function seed() {
    return [node(), txt($('.top .pill')), txt($('.case .kicker')), txt($('.case h1')), txt($('.case p:last-child'))].join('|');
  }

  function bucket(label) {
    const t = String(label || '').toLowerCase();
    if (/task|success|เวลา|ผิด|next|วัด|พิสูจน์|สำเร็จ|หลักฐาน/.test(t)) return 'good';
    if (/ชอบ|mockup|ดีไซน์|ภาพ|สวย/.test(t)) return 'like';
    if (/จำนวน|เข้า|คน|หน้าแรก|เว็บ/.test(t)) return 'count';
    if (/ทีม|ออกแบบ/.test(t)) return 'team';
    return 'other';
  }

  function apply() {
    const box = $('.verify');
    if (!box || box.dataset.reasonVariety === '1') return;
    const s = seed();
    $$('.verify .option', box).forEach((btn, i) => {
      const b = $('b', btn);
      const span = $('span', btn);
      const old = txt(b);
      const type = bucket(old);
      const list = type === 'good' ? good : type === 'like' ? like : type === 'count' ? count : type === 'team' ? team : other;
      if (b) b.textContent = pick(list, s, i);
      if (span) span.textContent = 'เลือกเหตุผลที่อธิบายคำตอบได้ตรงกับสถานการณ์นี้ที่สุด';
    });
    const h = $('h3', box);
    if (h) h.textContent = `ตรวจเหตุผล • ${node()}`;
    box.dataset.reasonVariety = '1';
  }

  let t = 0;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
