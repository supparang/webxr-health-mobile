/* CSAI2601 UX Quest • Reason Variety v4
 * Field-aware Reason Check for W5/W6/W7.
 * data-reason index 0 remains the correct reason from the player.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const node = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();
  const KEY = `csai2601.reason.v4.${node()}`;

  function h(s) { let x = 0; String(s || '').split('').forEach(c => { x = ((x << 5) - x + c.charCodeAt(0)) | 0; }); return Math.abs(x); }
  function seq() { const n = Number(sessionStorage.getItem(KEY) || 0) + 1; try { sessionStorage.setItem(KEY, String(n)); } catch(e) {} return n; }
  function choose(list, seed, add) { return list[(h(seed) + add) % list.length]; }
  function idx(btn) { const m = String(btn?.dataset?.reason || '').match(/-(\d+)$/); return m ? Number(m[1]) : -1; }

  function kind() {
    const k = [text($('.case .kicker')), text($('.case h1')), text($('.case p:last-child'))].join(' ').toLowerCase();
    if (/hmw|how might we|problem statement|root cause|insight/.test(k)) return 'define';
    if (/sitemap|navigation|happy path|error path|bottleneck|ia|flow/.test(k)) return 'flow';
    if (/wireframe|layout|hierarchy|priority|cta|mobile|grid/.test(k)) return 'wireframe';
    if (/research question|pain point|persona|interview|observation/.test(k)) return 'research';
    if (/friction|pain|ติดขัด|ปัญหา/.test(k)) return 'friction';
    if (/goal|need|เป้าหมาย|ผู้ใช้/.test(k)) return 'goal';
    if (/impact|ui|ux|feedback|ผลกระทบ|สับสน|ผิด/.test(k)) return 'impact';
    if (/proof|test|validate|evidence|วัด|ทดสอบ|พิสูจน์/.test(k)) return 'proof';
    return 'fix';
  }

  const OK = {
    research: [
      'เชื่อมคำถามวิจัยกับ pain point และ persona need ของผู้ใช้จริง',
      'ใช้ข้อมูลผู้ใช้เพื่อแยก evidence ออกจาก assumption ก่อนออกแบบ',
      'คำตอบนี้ช่วยให้รู้ว่าควรถามหรือสังเกตอะไรต่อ',
      'อธิบาย need ของ persona จากหลักฐาน ไม่ใช่เดาจากทีม',
      'เลือกวิธีเก็บข้อมูลที่ตอบปัญหาใน case นี้ได้ตรงที่สุด'
    ],
    define: [
      'เชื่อม insight → root cause → problem statement → HMW ได้ครบ',
      'HMW นี้เปิดทางให้คิดหลาย solution โดยไม่ล็อกคำตอบเร็วเกินไป',
      'problem statement บอกผู้ใช้ ความต้องการ และผลลัพธ์ที่ต้องการชัด',
      'root cause นี้อธิบายว่าทำไม insight จึงเกิดขึ้นจริง',
      'concept นี้ตอบ HMW และยังตรวจผลกับผู้ใช้ได้'
    ],
    flow: [
      'จัดกลุ่มข้อมูลตาม mental model และ journey ของผู้ใช้',
      'navigation นี้ช่วยให้ผู้ใช้เริ่มงานถูกจุดและเดิน flow ต่อได้',
      'happy path และ error path ครอบคลุมทั้งทางปกติและตอนติดขัด',
      'บอก bottleneck ที่ทำให้ผู้ใช้หลุดจาก flow ได้ตรงจุด',
      'IA นี้ลดการค้นหา ลดการย้อนกลับ และช่วยให้ task สำเร็จเร็วขึ้น'
    ],
    wireframe: [
      'จัด visual priority ให้ผู้ใช้เห็นสิ่งที่ต้องทำก่อน',
      'layout นี้รองรับ goal, content hierarchy และ primary CTA ชัด',
      'CTA นี้สัมพันธ์กับงานหลัก ไม่ใช่แค่ปุ่มที่ดูเด่น',
      'mobile layout ลดการเลื่อน/ซูมและคงลำดับข้อมูลสำคัญ',
      'wireframe นี้ทำให้ hierarchy, action และ feedback ตรวจได้ก่อนลงสีจริง'
    ],
    friction: ['ชี้จุดที่ผู้ใช้ติดจริง และทำให้งานหลักเดินต่อไม่ได้','โยงจากหลักฐานว่า friction นี้กระทบ task สำคัญ','ระบุอุปสรรคของผู้ใช้ ไม่ใช่ตัดสินจากหน้าตาอย่างเดียว','อธิบายว่าผู้ใช้เสียเวลา สับสน หรือทำผิดขั้นตอนตรงไหน'],
    goal: ['ผูกกับงานหลักที่ผู้ใช้ต้องทำให้สำเร็จจริง','จับ user goal จากสิ่งที่ผู้ใช้ต้องทำ ไม่ใช่สิ่งที่ทีมชอบ','บอกได้ว่าผู้ใช้ต้องรู้อะไรเพื่อไปขั้นตอนถัดไป','อธิบายผลลัพธ์ที่ผู้ใช้ต้องการในสถานการณ์นี้ได้'],
    impact: ['อธิบายผลกระทบต่อความเข้าใจ การตัดสินใจ หรือ task ของผู้ใช้','แยกได้ว่าปัญหาอยู่ที่ลำดับข้อมูล flow หรือ feedback','ชี้ว่าปัญหาทำให้ผู้ใช้สับสน ทำผิด หรือทำงานไม่สำเร็จอย่างไร','วิเคราะห์ชั้นปัญหาก่อนเลือกวิธีแก้'],
    fix: ['แก้จุดติดขัดหลักโดยไม่เพิ่มภาระใหม่ให้ผู้ใช้','เชื่อมหลักฐานกับสิ่งที่จะปรับในหน้าจอหรือ flow ได้','ช่วยให้ผู้ใช้ทำ task เดิมได้ง่ายและมั่นใจกว่าเดิม','แก้จาก root cause ไม่ใช่แต่งหน้าจอเฉย ๆ'],
    proof: ['ให้ผู้ใช้ทำ task เดิม แล้วเทียบผลก่อนและหลังปรับ','วัดจากพฤติกรรมจริง เช่น สำเร็จเร็วขึ้น ผิดน้อยลง หรืออธิบายขั้นตอนต่อได้','ใช้หลักฐานจาก case เดิม ไม่ใช่ความชอบส่วนตัว','พิสูจน์ด้วยผลลัพธ์ที่สังเกตได้จากการใช้งานจริง']
  };

  const BAD = [
    ['ถามว่าชอบภาพไหนมากกว่า โดยไม่ได้ให้ทำภารกิจจริง','ให้โหวตหน้าที่ดูดี แต่ไม่ดูว่างานสำเร็จไหม','ใช้ความสวยหรือความชอบแทนหลักฐานการใช้งาน','เลือกเพราะหน้าดูทันสมัยขึ้น'],
    ['ให้ทีมตัดสินว่าแบบใหม่ดีขึ้น โดยไม่ลองกับผู้ใช้','เลือกตามความเห็นทีม มากกว่าหลักฐานจากผู้ใช้จริง','ทีมรู้สึกว่าดีขึ้น แต่ยังไม่เห็นผลจากผู้ใช้','ใช้มุมมองคนทำงานแทนมุมมองผู้ใช้'],
    ['ดูแค่จำนวนคนเข้าหน้าแรก แต่ไม่รู้ว่าใช้งานสำเร็จไหม','นับคนเห็นหน้าใหม่ โดยไม่ดูว่าทำ task ได้หรือไม่','เพิ่มคำอธิบายยาวขึ้น โดยไม่แก้จุดที่ผู้ใช้ติด','คัดลอก pattern จากที่อื่นโดยไม่ดู case นี้']
  ];

  function seed(roundNo) { return [node(), roundNo, text($('.top .pill')), text($('.case .kicker')), text($('.case h1')), text($('.case p:last-child'))].join('|'); }

  function apply() {
    const box = $('.verify');
    if (!box || box.dataset.reasonVarietyV4 === '1') return;
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
    if (title) title.textContent = `ตรวจเหตุผล • ${node()} • ${k}`;
    box.dataset.reasonVarietyV4 = '1';
  }

  let t = 0;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 20); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
