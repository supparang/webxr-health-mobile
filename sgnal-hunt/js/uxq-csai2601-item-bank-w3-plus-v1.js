// === /sgnal-hunt/js/uxq-csai2601-item-bank-w3-plus-v1.js ===
// CSAI2601 UX Quest W3 Plus Bank: +16 cases to reach 40 W3 variants.
(function () {
  'use strict';
  const PLUS_VERSION = 'v20260708-w3-plus-16cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const W3_PLUS_CASES = [
    { id:'W3-C025', context:'หน้าค้นหาข่าวทุน', user:'นักศึกษาที่ต้องหาข่าวเฉพาะตน', issue:'รายการข่าวคล้ายกันและไม่มีตัวช่วยแยกประเภท', concept:'recognition cue', repair:'เพิ่มป้ายประเภทและตัวกรองที่ผู้ใช้เข้าใจ', misconception:'หัวข้อข่าวเยอะทำให้เลือกได้เอง' },
    { id:'W3-C026', context:'ระบบเลือกหัวข้อโครงงาน', user:'นักศึกษาที่ต้องเลือกหัวข้อ', issue:'หัวข้อแสดงเป็นข้อความยาวเท่ากันทั้งหมด', concept:'information hierarchy', repair:'แยก keyword ระดับความยาก และผลลัพธ์ที่ต้องทำ', misconception:'ข้อความยาวแปลว่าให้ข้อมูลครบ' },
    { id:'W3-C027', context:'หน้าแนะนำระบบใหม่', user:'นักศึกษาที่เข้าครั้งแรก', issue:'เปิดมาด้วยคำอธิบายยาวก่อนให้ลองทำงานจริง', concept:'progressive disclosure', repair:'ให้เริ่มจาก task สั้น ๆ แล้วค่อยเปิดคำอธิบายเมื่อจำเป็น', misconception:'คู่มือยาวช่วยให้ใช้เป็นทันที' },
    { id:'W3-C028', context:'ระบบจัดการงานกลุ่ม', user:'สมาชิกกลุ่มโปรเจกต์', issue:'สถานะงานทุกชิ้นใช้สีใกล้กันและอ่านยาก', concept:'visual discrimination', repair:'ใช้ label คู่กับสีและจัดกลุ่มสถานะ', misconception:'ใช้สีหลายสีพอแล้ว' },
    { id:'W3-C029', context:'ระบบจองอุปกรณ์เรียน', user:'นักศึกษาที่ต้องยืมอุปกรณ์', issue:'เห็นรายการเยอะก่อนรู้ว่าอุปกรณ์ใดเหมาะกับงานของตน', concept:'decision support', repair:'ถามงานที่ต้องทำก่อนแนะนำอุปกรณ์', misconception:'รายการครบช่วยตัดสินใจได้เอง' },
    { id:'W3-C030', context:'หน้าผลการค้นหารายวิชา', user:'นักศึกษาที่เลือกวิชาเสรี', issue:'ผลลัพธ์เรียงยาวโดยไม่เน้นวันเวลาและที่นั่ง', concept:'attention priority', repair:'เน้นข้อมูลที่ใช้ตัดสินใจ เช่น เวลา ที่นั่ง และเงื่อนไข', misconception:'เรียงตามชื่อวิชาก็เป็นระบบที่สุด' },
    { id:'W3-C031', context:'ระบบแจ้งกำหนดส่งงาน', user:'นักศึกษาที่มีงานหลายวิชา', issue:'ข้อความแจ้งเตือนใช้รูปแบบเดียวกันทุกงาน', concept:'salience', repair:'แยกงานด่วน งานใกล้ครบกำหนด และงานที่ส่งแล้ว', misconception:'แจ้งเตือนเท่ากันทำให้ไม่ลำเอียง' },
    { id:'W3-C032', context:'หน้าเลือกบริการนักศึกษา', user:'นักศึกษาที่ไม่รู้ชื่อหน่วยงาน', issue:'เมนูใช้ชื่อฝ่ายงานแทนปัญหาที่ผู้ใช้พบ', concept:'mental model', repair:'จัดเมนูจากภาษาปัญหาของผู้ใช้', misconception:'ชื่อฝ่ายงานถูกต้องที่สุดจึงควรใช้' },
    { id:'W3-C033', context:'ระบบนัดหมายงานแนะแนว', user:'นักศึกษาที่ต้องเลือกหัวข้อปรึกษา', issue:'หัวข้อปรึกษาเป็นคำกว้างและไม่มีตัวอย่าง', concept:'recognition', repair:'เพิ่มตัวอย่างสถานการณ์ใต้แต่ละหัวข้อ', misconception:'คำสั้นทำให้หน้าโล่งและเข้าใจง่าย' },
    { id:'W3-C034', context:'หน้าเลือกห้องสอบ', user:'นักศึกษาที่ตรวจสถานที่สอบ', issue:'รหัสห้องเด่นกว่าชื่ออาคารและวิธีไป', concept:'spatial cue', repair:'แสดงอาคาร ชั้น และจุดสังเกตควบคู่กัน', misconception:'รหัสห้องเป็นข้อมูลหลักเสมอ' },
    { id:'W3-C035', context:'ระบบติดตามคำขอทั่วไป', user:'นักศึกษาที่รอผลจากระบบ', issue:'สถานะสั้นเกินไปและไม่บอกว่าต้องทำอะไรต่อ', concept:'next step clarity', repair:'แสดงสถานะพร้อมการกระทำถัดไป', misconception:'สถานะยิ่งสั้นยิ่งดี' },
    { id:'W3-C036', context:'หน้าแบบฝึกหัดออนไลน์', user:'นักศึกษาที่ทำแบบฝึกหัดหลังเรียน', issue:'เฉลยแสดงทันทีพร้อมข้อมูลเยอะจนไม่รู้ว่าผิดตรงไหน', concept:'feedback focus', repair:'ชี้จุดผิดหลักและให้เหตุผลสั้นก่อนรายละเอียด', misconception:'เฉลยละเอียดที่สุดช่วยเรียนรู้ดีที่สุดเสมอ' },
    { id:'W3-C037', context:'ระบบจองเวลาใช้ห้องแล็บ', user:'นักศึกษาที่ต้องเลือกเวลาปฏิบัติ', issue:'เวลาว่างและเวลาที่เต็มแสดงคล้ายกันมาก', concept:'perceptual contrast', repair:'ทำสถานะต่างกันชัดด้วย label และน้ำหนักภาพ', misconception:'สีอ่อนเข้มพอแยกได้แล้ว' },
    { id:'W3-C038', context:'หน้าเลือกแหล่งเรียนรู้', user:'นักศึกษาที่ต้องเลือกวิดีโอหรือเอกสาร', issue:'เนื้อหาทุกแบบแสดงเท่ากันโดยไม่บอกว่าเริ่มจากอะไร', concept:'learning path cue', repair:'แนะนำลำดับเริ่มต้นและระดับความยาก', misconception:'ผู้ใช้ควรเลือกสื่อเองทั้งหมด' },
    { id:'W3-C039', context:'ระบบรายงานปัญหาการเรียน', user:'นักศึกษาที่ต้องส่งปัญหาให้ผู้สอน', issue:'ช่องพิมพ์ใหญ่แต่ไม่ช่วยให้เล่าว่าปัญหาเกิดที่ไหน', concept:'scaffolding', repair:'แบ่งช่องเป็นสิ่งที่พบ จุดที่เกิด และสิ่งที่ต้องการให้ช่วย', misconception:'ช่องว่างใหญ่พอให้ผู้ใช้เขียนเอง' },
    { id:'W3-C040', context:'หน้าเริ่มต้นบทเรียนออนไลน์', user:'นักศึกษาที่เรียนด้วยตนเอง', issue:'มีปุ่มหลายปุ่ม เช่น เริ่ม เรียนต่อ ทบทวน และแบบฝึกหัด เด่นเท่ากัน', concept:'primary action', repair:'ทำปุ่มหลักตามสถานะผู้ใช้และลดน้ำหนักปุ่มรอง', misconception:'ปุ่มทุกอย่างเด่นเท่ากันเพื่อให้เลือกได้ครบ' }
  ];

  function uniqById(list) {
    const seen = new Set();
    return (list || []).filter((item) => {
      const id = String(item && item.id || '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id); return true;
    });
  }

  const w3 = content.nodes.find((node) => String(node.id).toUpperCase() === 'W3');
  if (w3) {
    const old = Array.isArray(w3.seedCases) ? w3.seedCases : [];
    w3.seedCases = uniqById(W3_PLUS_CASES.concat(old));
    w3.itemBankPlusVersion = PLUS_VERSION;
    w3.targetReplayCases = 40;
  }
  window.CSAI2601_UXQ_ITEM_BANK_W3_PLUS_V1 = Object.freeze({ version:PLUS_VERSION, W3_PLUS_CASES, counts:{ W3Plus:W3_PLUS_CASES.length } });
})();
