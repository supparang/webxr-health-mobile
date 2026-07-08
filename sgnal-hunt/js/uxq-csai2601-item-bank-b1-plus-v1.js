// === /sgnal-hunt/js/uxq-csai2601-item-bank-b1-plus-v1.js ===
// CSAI2601 UX Quest B1 Plus Bank: +16 boss cases to reach 40 B1 variants.
(function () {
  'use strict';
  const PLUS_VERSION = 'v20260708-b1-plus-16cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const B1_PLUS_CASES = [
    { id:'B1-C025', context:'ระบบเลือกหัวข้อโปรเจกต์', user:'นักศึกษาที่เลือกหัวข้องานครั้งแรก', issue:'หัวข้อยาวเท่ากันหมดและไม่บอกระดับความยากหรือผลลัพธ์ที่ต้องทำ', concepts:['HCD','information hierarchy','decision support'], evidence:'ผู้ใช้เลือกจากชื่อที่ดูน่าสนใจแต่ไม่รู้ภาระงานจริง', repair:'แสดง keyword ระดับความยาก ตัวอย่างผลลัพธ์ และทดสอบกับผู้ใช้ใหม่', misconception:'ข้อความยาวแปลว่าให้ข้อมูลครบ' },
    { id:'B1-C026', context:'หน้าเลือกบริการนักศึกษา', user:'นักศึกษาที่ไม่รู้ชื่อหน่วยงาน', issue:'เมนูใช้ชื่อฝ่ายงานแทนปัญหาที่ผู้ใช้พบ', concepts:['mental model','navigation','HCD'], evidence:'ผู้ใช้มีปัญหาแต่ไม่รู้ว่าต้องกดฝ่ายใด', repair:'จัดเมนูจากภาษาปัญหาของผู้ใช้และทดสอบ tree test', misconception:'ชื่อฝ่ายงานถูกต้องที่สุดจึงควรใช้' },
    { id:'B1-C027', context:'ระบบจัดการงานกลุ่ม', user:'สมาชิกกลุ่มโปรเจกต์', issue:'สถานะงานใช้สีใกล้กันและไม่บอกว่าใครต้องทำอะไรต่อ', concepts:['visual discrimination','feedback','team UX'], evidence:'สมาชิกกลุ่มไม่รู้ว่างานใดรอตนเอง', repair:'ใช้ label คู่กับสีและแสดง owner / next step', misconception:'ใช้สีหลายสีพอแล้ว' },
    { id:'B1-C028', context:'หน้าแนะนำระบบใหม่', user:'นักศึกษาที่เข้าระบบครั้งแรก', issue:'เปิดมาด้วยคำอธิบายยาวก่อนให้ลองทำงานจริง', concepts:['progressive disclosure','cognitive load','task'], evidence:'ผู้ใช้เลื่อนผ่านคู่มือและยังทำ task แรกไม่ได้', repair:'ให้เริ่มจาก task สั้น ๆ แล้วเปิดคำอธิบายเมื่อจำเป็น', misconception:'คู่มือยาวช่วยให้ใช้เป็นทันที' },
    { id:'B1-C029', context:'ระบบจองอุปกรณ์เรียน', user:'นักศึกษาที่ต้องยืมอุปกรณ์', issue:'เห็นรายการอุปกรณ์จำนวนมากก่อนรู้ว่าอะไรเหมาะกับงานของตน', concepts:['user goal','decision support','HCD'], evidence:'ผู้ใช้เลือกจากชื่ออุปกรณ์แทนงานที่ต้องทำ', repair:'ถามงานที่ต้องทำก่อนแนะนำอุปกรณ์ที่เหมาะ', misconception:'รายการครบช่วยตัดสินใจได้เอง' },
    { id:'B1-C030', context:'หน้าผลการค้นหารายวิชา', user:'นักศึกษาที่เลือกวิชาเสรี', issue:'ผลลัพธ์เรียงยาวโดยไม่เน้นวันเวลา จำนวนที่นั่ง และเงื่อนไข', concepts:['attention priority','UI hierarchy','task success'], evidence:'ผู้ใช้เปิดหลายวิชาที่ชนตารางหรือที่นั่งเต็ม', repair:'เน้นข้อมูลตัดสินใจและเพิ่มตัวกรองที่ใช้จริง', misconception:'เรียงตามชื่อวิชาก็เป็นระบบที่สุด' },
    { id:'B1-C031', context:'ระบบแจ้งกำหนดส่งงาน', user:'นักศึกษาที่มีงานหลายวิชา', issue:'ข้อความแจ้งเตือนใช้รูปแบบเดียวกันทุกงาน', concepts:['salience','attention','cognitive load'], evidence:'ผู้ใช้พลาดงานด่วนเพราะแจ้งเตือนดูเหมือนงานทั่วไป', repair:'แยกงานด่วน งานใกล้ครบกำหนด และงานที่ส่งแล้ว', misconception:'แจ้งเตือนเท่ากันทำให้ไม่ลำเอียง' },
    { id:'B1-C032', context:'ระบบนัดหมายงานแนะแนว', user:'นักศึกษาที่ต้องเลือกหัวข้อปรึกษา', issue:'หัวข้อปรึกษาเป็นคำกว้างและไม่มีตัวอย่างสถานการณ์', concepts:['recognition','mental model','HCD'], evidence:'ผู้ใช้ไม่รู้ว่าปัญหาของตนอยู่หัวข้อใด', repair:'เพิ่มตัวอย่างสถานการณ์ใต้แต่ละหัวข้อ', misconception:'คำสั้นทำให้หน้าโล่งและเข้าใจง่าย' },
    { id:'B1-C033', context:'หน้าเลือกห้องสอบ', user:'นักศึกษาที่ตรวจสถานที่สอบ', issue:'รหัสห้องเด่นกว่าชื่ออาคาร ชั้น และวิธีไป', concepts:['spatial cue','context','UX'], evidence:'ผู้ใช้รู้รหัสห้องแต่ยังหาห้องไม่เจอ', repair:'แสดงอาคาร ชั้น และจุดสังเกตควบคู่กัน', misconception:'รหัสห้องเป็นข้อมูลหลักเสมอ' },
    { id:'B1-C034', context:'หน้าแบบฝึกหัดออนไลน์', user:'นักศึกษาที่ทำแบบฝึกหัดหลังเรียน', issue:'เฉลยแสดงข้อมูลเยอะจนไม่รู้ว่าตนผิดตรงไหน', concepts:['feedback focus','learning UX','cognitive load'], evidence:'ผู้ใช้อ่านเฉลยแต่ยังอธิบายจุดผิดไม่ได้', repair:'ชี้จุดผิดหลักและให้เหตุผลสั้นก่อนรายละเอียด', misconception:'เฉลยละเอียดที่สุดช่วยเรียนรู้ดีที่สุดเสมอ' },
    { id:'B1-C035', context:'ระบบจองเวลาใช้ห้องแล็บ', user:'นักศึกษาที่เลือกเวลาปฏิบัติ', issue:'เวลาว่างและเวลาที่เต็มแสดงคล้ายกันมาก', concepts:['perceptual contrast','visual mapping','error prevention'], evidence:'ผู้ใช้เลือกเวลาที่ใช้งานไม่ได้โดยไม่ตั้งใจ', repair:'ทำสถานะต่างกันชัดด้วย label และน้ำหนักภาพ', misconception:'สีอ่อนเข้มพอแยกได้แล้ว' },
    { id:'B1-C036', context:'หน้าเลือกแหล่งเรียนรู้', user:'นักศึกษาที่ต้องเลือกวิดีโอหรือเอกสาร', issue:'สื่อทุกแบบแสดงเท่ากันโดยไม่บอกว่าควรเริ่มจากอะไร', concepts:['learning path cue','decision support','UX'], evidence:'ผู้ใช้เลือกสื่อยากเกินไปหรือเริ่มจากเนื้อหายากก่อน', repair:'แนะนำลำดับเริ่มต้นและระดับความยาก', misconception:'ผู้ใช้ควรเลือกสื่อเองทั้งหมด' },
    { id:'B1-C037', context:'ระบบรายงานปัญหาการเรียน', user:'นักศึกษาที่ต้องขอความช่วยเหลือจากผู้สอน', issue:'มีช่องพิมพ์ใหญ่แต่ไม่ช่วยให้เล่าว่าปัญหาเกิดที่ไหน', concepts:['scaffolding','form UX','HCD'], evidence:'ผู้ใช้เขียนกว้างเกินไปจนผู้สอนช่วยต่อยาก', repair:'แบ่งช่องเป็นสิ่งที่พบ จุดที่เกิด และสิ่งที่ต้องการให้ช่วย', misconception:'ช่องว่างใหญ่พอให้ผู้ใช้เขียนเอง' },
    { id:'B1-C038', context:'ระบบรับข้อมูลบริการ', user:'นักศึกษาที่ส่งคำขอทั่วไป', issue:'หลังส่งข้อมูลแล้วไม่บอกว่าจะได้ผลกลับทางใดหรือเมื่อไร', concepts:['next step feedback','system status','confidence'], evidence:'ผู้ใช้ถามซ้ำว่าต้องรอหรือทำอะไรต่อ', repair:'ยืนยันช่องทาง ระยะเวลา และขั้นตอนถัดไป', misconception:'ระบบทำงานเบื้องหลังแล้วไม่ต้องบอกผู้ใช้' },
    { id:'B1-C039', context:'หน้าเลือกช่องทางรับบริการ', user:'นักศึกษาที่ต้องเลือกบริการหนึ่งอย่าง', issue:'มีหลายช่องทางแต่ไม่อธิบายว่าแต่ละช่องทางเหมาะกับกรณีใด', concepts:['decision load','information scent','user goal'], evidence:'ผู้ใช้เลือกช่องทางผิดและต้องเริ่มใหม่', repair:'จัดกลุ่มช่องทางพร้อมคำแนะนำสั้นตามกรณีใช้งาน', misconception:'ตัวเลือกยิ่งเยอะยิ่งดีเสมอ' },
    { id:'B1-C040', context:'ระบบค้นหารายวิชา', user:'นักศึกษาที่จำข้อมูลวิชาไม่ได้ครบ', issue:'ต้องจำข้อมูลเฉพาะจึงจะค้นหาเจอและผลลัพธ์ไม่ช่วยยืนยันว่าใช่วิชาที่ต้องการ', concepts:['recognition','feedback','task success'], evidence:'ผู้ใช้ค้นหลายครั้งและยังไม่มั่นใจว่าเลือกวิชาถูก', repair:'ให้ค้นจากหลายคำและแสดงข้อมูลยืนยันที่เกี่ยวกับ task', misconception:'ผู้ใช้ควรจำรหัสหรือข้อมูลเฉพาะเอง' }
  ];

  function uniqById(list) {
    const seen = new Set();
    return (list || []).filter((item) => {
      const id = String(item && item.id || '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id); return true;
    });
  }

  const b1 = content.nodes.find((node) => String(node.id).toUpperCase() === 'B1');
  if (b1) {
    const old = Array.isArray(b1.seedCases) ? b1.seedCases : [];
    b1.seedCases = uniqById(B1_PLUS_CASES.concat(old));
    b1.itemBankPlusVersion = PLUS_VERSION;
    b1.targetReplayCases = 40;
  }
  window.CSAI2601_UXQ_ITEM_BANK_B1_PLUS_V1 = Object.freeze({ version:PLUS_VERSION, B1_PLUS_CASES, counts:{ B1Plus:B1_PLUS_CASES.length } });
})();
