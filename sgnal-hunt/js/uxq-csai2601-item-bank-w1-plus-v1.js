// === /sgnal-hunt/js/uxq-csai2601-item-bank-w1-plus-v1.js ===
// CSAI2601 UX Quest W1 Plus Bank: +16 cases to reach 40 W1 variants.

(function () {
  'use strict';

  const PLUS_VERSION = 'v20260708-w1-plus-16cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const W1_PLUS_CASES = [
    { id:'W1-C025', context:'เว็บตารางสอบ', user:'นักศึกษาที่วางแผนอ่านหนังสือ', friction:'ตารางสอบเป็นภาพยาว ต้องซูมและเลื่อนหลายครั้งบนมือถือ', misconception:'แปะภาพจากเอกสารเดิมเร็วที่สุดจึงพอใช้ได้', proofIdea:'วัดเวลาค้นหาวันสอบของรายวิชาที่กำหนดบนมือถือ' },
    { id:'W1-C026', context:'ระบบลงทะเบียนฝึกงาน', user:'นักศึกษาที่เตรียมยื่นเอกสารฝึกงาน', friction:'สถานะเอกสารใช้รหัสที่ผู้ใช้ไม่เข้าใจ', misconception:'ใช้รหัสสถานะสะดวกกับเจ้าหน้าที่จึงควรใช้ต่อ', proofIdea:'วัดว่าผู้ใช้ตีความสถานะและ next step ได้ถูกต้อง' },
    { id:'W1-C027', context:'หน้าแจ้งเตือนในแอปมหาวิทยาลัย', user:'นักศึกษาที่ได้รับแจ้งเตือนหลายเรื่อง', friction:'แจ้งเตือนสำคัญกับทั่วไปปนกันจนพลาด deadline', misconception:'แจ้งทุกอย่างเท่ากันเพื่อความเป็นกลาง', proofIdea:'วัดว่าผู้ใช้แยกงานด่วนและงานทั่วไปได้' },
    { id:'W1-C028', context:'ระบบจองสนามกีฬา', user:'นักศึกษาที่จองเล่นกีฬาหลังเลิกเรียน', friction:'เลือกสนามได้แต่ไม่รู้เงื่อนไขการใช้อุปกรณ์', misconception:'รายละเอียดเงื่อนไขเอาไว้หน้าท้ายสุดเพื่อไม่ให้หน้าแรกแน่น', proofIdea:'วัดว่าผู้ใช้จองได้ตรงเงื่อนไขโดยไม่ต้องถามเจ้าหน้าที่' },
    { id:'W1-C029', context:'ระบบขอใช้รถมหาวิทยาลัย', user:'นักศึกษาที่ทำกิจกรรมภายนอก', friction:'ฟอร์มถามข้อมูลหลายส่วนโดยไม่บอกว่าอะไรจำเป็น', misconception:'เก็บข้อมูลให้ครบไว้ก่อนเพราะอาจต้องใช้', proofIdea:'วัดจำนวนช่องที่กรอกผิดหลังแยก required field' },
    { id:'W1-C030', context:'เว็บศูนย์ภาษา', user:'นักศึกษาที่ต้องสมัครสอบวัดระดับ', friction:'ไม่รู้ว่าควรเลือก placement test หรือ exit test', misconception:'ใช้ชื่ออังกฤษทางการทั้งหมดเพื่อความถูกต้อง', proofIdea:'วัดอัตราการเลือกประเภทสอบถูกจากสถานการณ์' },
    { id:'W1-C031', context:'ระบบขอรหัส Wi-Fi', user:'นักศึกษาที่เข้าใช้อินเทอร์เน็ตในมหาวิทยาลัย', friction:'กดขอรหัสแล้วไม่รู้ว่ารหัสจะส่งไปทางไหน', misconception:'ระบบส่งรหัสแล้วถือว่าเสร็จ ไม่ต้องบอกช่องทาง', proofIdea:'วัดว่าผู้ใช้รู้ว่าต้องไปดูรหัสที่ใดหลังส่งคำขอ' },
    { id:'W1-C032', context:'หน้าเลือกวิชาเสรี', user:'นักศึกษาปี 2 ที่เลือกวิชาเสรีครั้งแรก', friction:'ไม่มีตัวกรองตามวัน เวลา หรือจำนวนที่นั่ง', misconception:'รายการวิชาครบแล้ว ผู้ใช้ค้นเองได้', proofIdea:'วัดเวลาค้นหาวิชาที่ไม่ชนตารางและยังมีที่นั่ง' },
    { id:'W1-C033', context:'ระบบติดตามโปรเจกต์รายวิชา', user:'นักศึกษาที่ต้องส่ง milestone', friction:'ไม่รู้ว่า milestone ไหนผ่านแล้วและอันไหนต้องแก้', misconception:'แสดงรายการไฟล์ที่ส่งก็เพียงพอ', proofIdea:'วัดว่าผู้ใช้บอก milestone ที่ต้องแก้ได้ถูกต้อง' },
    { id:'W1-C034', context:'เว็บแนะแนวอาชีพ', user:'นักศึกษาที่อยากหาที่ฝึกงาน', friction:'ประกาศฝึกงานไม่มีป้ายบอกสาขาหรือทักษะที่ต้องใช้', misconception:'ลงประกาศตามบริษัทล่าสุดทำให้หน้าอัปเดตที่สุด', proofIdea:'วัดอัตราการเลือกประกาศที่ตรงสาขาและทักษะ' },
    { id:'W1-C035', context:'ระบบจองที่นั่งอ่านหนังสือ', user:'นักศึกษาที่ต้องอ่านสอบ', friction:'เลือกที่นั่งแล้วไม่รู้ว่าอยู่โซนเงียบหรือโซนคุยได้', misconception:'ใช้เลขที่นั่งอย่างเดียวเพราะประหยัดพื้นที่หน้าจอ', proofIdea:'วัดว่าผู้ใช้จองที่นั่งตรงความต้องการได้' },
    { id:'W1-C036', context:'แอปติดตามรถรับส่งมหาวิทยาลัย', user:'นักศึกษาที่รอรถไปเรียน', friction:'แสดงตำแหน่งรถแต่ไม่บอกเวลาประมาณถึงป้าย', misconception:'แผนที่ real-time ดูทันสมัยพอแล้ว', proofIdea:'วัดว่าผู้ใช้ตัดสินใจรอหรือเดินไปตึกเรียนได้ดีขึ้นหรือไม่' },
    { id:'W1-C037', context:'เว็บงานทะเบียน', user:'นักศึกษาที่ต้องเปลี่ยนข้อมูลส่วนตัว', friction:'เมนูเปลี่ยนข้อมูลอยู่ใต้หัวข้อที่ชื่อไม่ตรงกับภาษาผู้ใช้', misconception:'ใช้คำตามโครงสร้างหน่วยงานภายในดีที่สุด', proofIdea:'วัดอัตราการหาเมนูถูกโดยไม่ต้องถามเพื่อน' },
    { id:'W1-C038', context:'ระบบแจ้งผลทุนการศึกษา', user:'นักศึกษาที่รอผลอนุมัติ', friction:'สถานะแสดงว่า “รอตรวจสอบ” แต่ไม่บอกว่าต้องทำอะไรต่อหรือไม่', misconception:'ใช้คำสถานะสั้น ๆ เพื่อให้หน้าสะอาด', proofIdea:'วัดว่าผู้ใช้เข้าใจว่าต้องทำอะไรต่อหรือแค่รอ' },
    { id:'W1-C039', context:'ฟอร์มสมัครเข้าร่วมแข่งขัน', user:'นักศึกษาที่สมัครเป็นทีม', friction:'เพิ่มสมาชิกทีมแล้วไม่รู้ว่าสมาชิกได้รับคำเชิญหรือยัง', misconception:'บันทึกชื่อในฟอร์มถือว่าเพียงพอ', proofIdea:'วัดว่าหัวหน้าทีมบอกสถานะสมาชิกแต่ละคนได้ถูกต้อง' },
    { id:'W1-C040', context:'หน้า Download เอกสารประกอบการเรียน', user:'นักศึกษาที่ต้องโหลดไฟล์ก่อนเรียน', friction:'ไฟล์หลายชื่อคล้ายกันและไม่บอกว่าไฟล์ไหนล่าสุด', misconception:'เรียงตามวันที่อัปโหลดก็พอ ผู้ใช้ดูเองได้', proofIdea:'วัดอัตราการโหลดไฟล์ถูกและเวลาค้นหาไฟล์ล่าสุด' }
  ];

  function uniqById(list) {
    const seen = new Set();
    return (list || []).filter((item) => {
      const id = String(item && item.id || '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  const w1 = content.nodes.find((node) => String(node.id).toUpperCase() === 'W1');
  if (w1) {
    const old = Array.isArray(w1.seedCases) ? w1.seedCases : [];
    w1.seedCases = uniqById(W1_PLUS_CASES.concat(old));
    w1.itemBankPlusVersion = PLUS_VERSION;
    w1.targetReplayCases = 40;
  }

  window.CSAI2601_UXQ_ITEM_BANK_W1_PLUS_V1 = Object.freeze({
    version: PLUS_VERSION,
    W1_PLUS_CASES,
    counts: { W1Plus: W1_PLUS_CASES.length }
  });

  window.dispatchEvent(new CustomEvent('csai2601:item-bank-w1-plus-ready', {
    detail: { version: PLUS_VERSION, counts: { W1Plus: W1_PLUS_CASES.length } }
  }));
})();
