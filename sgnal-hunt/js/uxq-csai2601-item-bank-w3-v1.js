// === /sgnal-hunt/js/uxq-csai2601-item-bank-w3-v1.js ===
// CSAI2601 UX Quest Item Bank: W3 Psychology for Interface Design.
(function () {
  'use strict';
  const BANK_VERSION = 'v20260708-w3-24cases-safe';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const W3_CASES = [
    { id:'W3-C001', context:'ฟอร์มสมัครกิจกรรม', user:'นักศึกษาที่สมัครกิจกรรมครั้งแรก', issue:'ข้อความแจ้งเตือนอยู่ไกลจากช่องที่ต้องแก้', concept:'feedback', repair:'แสดงคำแนะนำใกล้จุดที่ต้องแก้', misconception:'รวมคำเตือนทั้งหมดไว้ท้ายหน้า' },
    { id:'W3-C002', context:'เมนูตั้งค่าการเรียน', user:'นักศึกษาที่ต้องปรับข้อมูลรายวิชา', issue:'ชื่อเมนูไม่ตรงกับคำที่ผู้ใช้คุ้นเคย', concept:'mental model', repair:'ใช้คำที่ผู้ใช้เข้าใจและจัดตามงานจริง', misconception:'ใช้คำตามโครงสร้างระบบภายใน' },
    { id:'W3-C003', context:'หน้าเลือกช่องทางรับบริการ', user:'นักศึกษาที่ต้องเลือกบริการหนึ่งอย่าง', issue:'มีตัวเลือกหลายแบบแต่ไม่มีคำแนะนำว่าควรเลือกอะไร', concept:'decision load', repair:'จัดกลุ่มตัวเลือกและเน้นตัวเลือกหลัก', misconception:'ตัวเลือกยิ่งเยอะยิ่งดีเสมอ' },
    { id:'W3-C004', context:'ระบบค้นหารายวิชา', user:'นักศึกษาที่จำข้อมูลวิชาไม่ได้ครบ', issue:'ต้องจำข้อมูลเฉพาะจึงจะค้นหาเจอ', concept:'recognition over recall', repair:'ให้ค้นจากชื่อ วันเรียน หรือหมวดวิชาได้', misconception:'ผู้ใช้ควรจำข้อมูลเอง' },
    { id:'W3-C005', context:'ระบบเลือกเวลาพบอาจารย์', user:'นักศึกษาที่ต้องเลือกเวลาว่าง', issue:'ตารางแน่นและไม่มีเวลาที่เลือกได้เด่นชัด', concept:'attention', repair:'เน้นเวลาที่เลือกได้และลดสิ่งรบกวน', misconception:'แสดงทั้งหมดคือครบที่สุด' },
    { id:'W3-C006', context:'หน้าแนบไฟล์งาน', user:'นักศึกษาที่ส่งงาน', issue:'หลังแนบไฟล์แล้วไม่เห็นชื่อไฟล์ล่าสุด', concept:'system feedback', repair:'แสดงชื่อไฟล์และเวลาที่แนบล่าสุด', misconception:'ไม่มีข้อความเตือนแปลว่าเสร็จแล้ว' },
    { id:'W3-C007', context:'ระบบแจ้งปัญหาในห้องเรียน', user:'นักศึกษาที่พบอุปกรณ์ใช้งานไม่ได้', issue:'หมวดปัญหามีชื่อคล้ายกันจนเลือกยาก', concept:'categorization', repair:'ใช้หมวดภาษาผู้ใช้พร้อมตัวอย่างสั้น ๆ', misconception:'หมวดละเอียดมากยิ่งดี' },
    { id:'W3-C008', context:'เว็บห้องสมุด', user:'นักศึกษาที่ต้องจองหนังสือ', issue:'ปุ่มหลักและปุ่มรองเด่นเท่ากัน', concept:'visual attention', repair:'ทำปุ่มหลักให้ชัดและลดน้ำหนักปุ่มรอง', misconception:'ปุ่มเท่ากันทำให้หน้าดูเป็นระเบียบ' },
    { id:'W3-C009', context:'หน้าเลือกกลุ่มเรียน', user:'นักศึกษาที่จัดตารางเรียน', issue:'ระบบบอกปัญหาหลังจากกดบันทึกเท่านั้น', concept:'error prevention', repair:'เตือนทันทีเมื่อเลือกข้อมูลที่ขัดกัน', misconception:'แจ้งท้ายสุดทำให้ขั้นตอนสั้นกว่า' },
    { id:'W3-C010', context:'เว็บทุนการศึกษา', user:'นักศึกษาที่เช็กสิทธิ์สมัคร', issue:'เงื่อนไขยาวและต้องจำหลายข้อพร้อมกัน', concept:'working memory', repair:'ทำ checklist และสรุปว่าเข้าเกณฑ์หรือไม่', misconception:'ให้ผู้ใช้อ่านเองทั้งหมดครบถ้วนที่สุด' },
    { id:'W3-C011', context:'ระบบบันทึกการเข้าเรียน', user:'นักศึกษาที่ทำกิจกรรมในชั้นเรียน', issue:'หลังแตะปุ่มแล้วไม่มีข้อความยืนยันทันที', concept:'feedback timing', repair:'แสดงข้อความยืนยันทันที', misconception:'สีปุ่มเปลี่ยนเล็กน้อยก็พอ' },
    { id:'W3-C012', context:'หน้าแรก LMS', user:'นักศึกษาที่มีงานหลายรายวิชา', issue:'งานด่วน งานเก่า และประกาศแสดงปนกันหมด', concept:'priority', repair:'จัดลำดับตามความเร่งด่วนและแยกงานที่ต้องทำ', misconception:'แสดงทุกอย่างล่าสุดเท่ากันคือยุติธรรม' },
    { id:'W3-C013', context:'หน้าเอกสารประกอบการเรียน', user:'นักศึกษาที่เตรียมก่อนเข้าเรียน', issue:'ไฟล์ชื่อคล้ายกันและไม่มีป้ายบอกไฟล์ล่าสุด', concept:'visual cue', repair:'ติดป้ายล่าสุดและแยกประเภทไฟล์', misconception:'เรียงตามวันที่ก็เพียงพอ' },
    { id:'W3-C014', context:'ระบบสมัครชมรม', user:'นักศึกษาที่เลือกชมรมใหม่', issue:'ข้อมูลชมรมยาวมากและไม่บอกสถานะรับสมัครก่อน', concept:'information scent', repair:'แสดงสถานะรับสมัครและข้อมูลตัดสินใจหลักก่อน', misconception:'รายละเอียดเยอะช่วยให้ตัดสินใจดีขึ้นเสมอ' },
    { id:'W3-C015', context:'ระบบจองห้องประชุม', user:'นักศึกษาทำงานกลุ่ม', issue:'ปฏิทินมีสีหลายแบบแต่ไม่มีคำอธิบายความหมาย', concept:'visual mapping', repair:'เพิ่มคำอธิบายสีและใช้ข้อความช่วย', misconception:'สีสวยทำให้เข้าใจเอง' },
    { id:'W3-C016', context:'เว็บตารางเรียนบนมือถือ', user:'นักศึกษาที่ดูตารางบนจอเล็ก', issue:'ต้องซูมและจำข้อมูลระหว่างเลื่อนไปมา', concept:'memory load', repair:'ทำตารางเป็นรายการค้นหาได้', misconception:'ภาพตารางเหมือนเอกสารเดิมจึงดีที่สุด' },
    { id:'W3-C017', context:'ระบบขอเอกสารการเรียน', user:'นักศึกษาที่ทำรายการหลายขั้นตอน', issue:'หลายหน้าแต่ไม่มีตัวบอกว่าถึงขั้นตอนไหนแล้ว', concept:'orientation', repair:'แสดงขั้นตอน 1-2-3 และสิ่งที่เสร็จแล้ว', misconception:'แต่ละหน้าสั้นจึงไม่ต้องบอกความคืบหน้า' },
    { id:'W3-C018', context:'แอปแผนที่อาคารเรียน', user:'นักศึกษาที่หาห้องเรียน', issue:'แสดงชื่ออาคารแต่ไม่บอกจุดเริ่มต้นและทิศทาง', concept:'spatial mental model', repair:'เพิ่มจุดเริ่มต้น landmark และเส้นทางถัดไป', misconception:'แผนที่รวมทั้งหมดครบที่สุด' },
    { id:'W3-C019', context:'หน้าแจ้งคะแนนรายวิชา', user:'นักศึกษาที่วางแผนปรับปรุงผลเรียน', issue:'คะแนนหลายส่วนแสดงพร้อมกันแต่ไม่บอกว่าควรดูส่วนใดก่อน', concept:'decision support', repair:'เน้นส่วนที่ต้องปรับและเสนอ next action สั้น ๆ', misconception:'ข้อมูลครบเท่ากับเข้าใจครบ' },
    { id:'W3-C020', context:'ระบบรับข้อมูลบริการ', user:'นักศึกษาที่ส่งคำขอทั่วไป', issue:'หลังส่งข้อมูลแล้วไม่บอกว่าจะได้ผลกลับทางใด', concept:'next step feedback', repair:'ยืนยันช่องทางและขั้นตอนถัดไป', misconception:'ระบบทำงานเบื้องหลังแล้วไม่ต้องบอกผู้ใช้' },
    { id:'W3-C021', context:'ฟอร์มประเมินรายวิชา', user:'นักศึกษาที่ต้องตอบหลายข้อ', issue:'คำถามซ้ำและยาวจนผู้ใช้เหนื่อยก่อนจบ', concept:'cognitive load', repair:'จัดกลุ่มคำถาม ลดคำซ้ำ และแสดงจำนวนข้อที่เหลือ', misconception:'ถามละเอียดที่สุดจะได้ข้อมูลดีที่สุดเสมอ' },
    { id:'W3-C022', context:'ระบบติดตามโปรเจกต์รายวิชา', user:'นักศึกษาที่ทำงานกลุ่ม', issue:'สถานะงานใช้คำที่ผู้ใช้ไม่เข้าใจ', concept:'language clarity', repair:'ใช้คำง่ายพร้อมขั้นตอนถัดไปของแต่ละสถานะ', misconception:'คำศัพท์ระบบดูเป็นมืออาชีพกว่า' },
    { id:'W3-C023', context:'เว็บแนะแนวอาชีพ', user:'นักศึกษาที่หาที่ฝึกงาน', issue:'ประกาศจำนวนมากแสดงเหมือนกันหมด', concept:'filtering / attention', repair:'เพิ่มตัวกรองสาขา ทักษะ และระดับประสบการณ์', misconception:'รายการเยอะทำให้โอกาสมากขึ้นเสมอ' },
    { id:'W3-C024', context:'ระบบจองที่นั่งอ่านหนังสือ', user:'นักศึกษาที่อ่านสอบ', issue:'ไม่รู้ว่าโซนนั้นเงียบ มีปลั๊ก หรือคุยได้ไหม', concept:'decision cue', repair:'แสดงป้ายโซนและคุณสมบัติที่ใช้ตัดสินใจ', misconception:'เลขที่นั่งเพียงอย่างเดียวพอใช้ได้' }
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
    w3.seedCases = uniqById(W3_CASES.concat(old));
    w3.itemBankVersion = BANK_VERSION;
    w3.minReplayCases = 24;
    w3.targetReplayCases = 24;
  }
  window.CSAI2601_UXQ_ITEM_BANK_W3_V1 = Object.freeze({ version:BANK_VERSION, W3_CASES, counts:{ W3:W3_CASES.length } });
})();
