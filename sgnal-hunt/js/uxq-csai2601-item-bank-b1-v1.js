// === /sgnal-hunt/js/uxq-csai2601-item-bank-b1-v1.js ===
// CSAI2601 UX Quest Boss Bank: B1 Foundation Boss pack 24.
(function () {
  'use strict';
  const BANK_VERSION = 'v20260708-b1-24cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const B1_CASES = [
    { id:'B1-C001', context:'ระบบบริการนักศึกษา', user:'นักศึกษาปี 2', issue:'หาเมนูสำคัญไม่เจอและไม่รู้ว่าส่งคำขอสำเร็จหรือยัง', concepts:['UI','UX','HCD','feedback'], evidence:'ผู้ใช้หยุดอยู่ที่เมนูและถามเพื่อนหลังส่งคำขอ', repair:'จัดเมนูตามงานหลักและเพิ่ม feedback หลังส่ง', misconception:'ทำปุ่มให้สีสดขึ้นอย่างเดียว' },
    { id:'B1-C002', context:'ระบบขอเอกสารออนไลน์', user:'นักศึกษาที่ต้องขอใบรับรอง', issue:'ขั้นตอนยาว ไม่มี progress และใช้คำที่ผู้ใช้ไม่เข้าใจ', concepts:['user goal','cognitive load','mental model'], evidence:'ผู้ใช้ย้อนกลับหลายครั้งและไม่รู้ว่าต้องเตรียมอะไร', repair:'แสดงขั้นตอนและ checklist เอกสาร', misconception:'เพิ่มคู่มือยาวด้านบน' },
    { id:'B1-C003', context:'แอปกิจกรรมมหาวิทยาลัย', user:'นักศึกษาที่เก็บชั่วโมงกิจกรรม', issue:'กิจกรรมสำคัญปนกับประกาศทั่วไปและสถานะสมัครไม่ชัด', concepts:['attention','priority','feedback'], evidence:'ผู้ใช้เลือกกิจกรรมผิดประเภทและถามว่าสมัครสำเร็จไหม', repair:'แยกประเภทกิจกรรมและแสดงสถานะหลังสมัคร', misconception:'เรียงกิจกรรมล่าสุดอย่างเดียว' },
    { id:'B1-C004', context:'หน้าแรก LMS', user:'นักศึกษาที่ต้องส่งงานหลายวิชา', issue:'งานด่วน ประกาศ และไฟล์เรียนแสดงปนกันจนผู้ใช้ไม่รู้ต้องทำอะไรก่อน', concepts:['UX','attention','cognitive load'], evidence:'ผู้ใช้หาปุ่มส่งงานนานและเปิดประกาศผิดเรื่อง', repair:'ทำ task list ตาม deadline และเน้นปุ่มส่งงาน', misconception:'เพิ่ม banner ประกาศให้ใหญ่ขึ้น' },
    { id:'B1-C005', context:'เว็บทุนการศึกษา', user:'นักศึกษาที่หาทุนที่สมัครได้', issue:'เงื่อนไขยาวและกระจายหลายหน้า ทำให้ผู้ใช้ไม่รู้ว่าตนเข้าเกณฑ์หรือไม่', concepts:['HCD','working memory','test idea'], evidence:'ผู้ใช้ต้องจดเงื่อนไขเองขณะเปรียบเทียบทุน', repair:'ทำ eligibility checklist และทดสอบกับผู้ใช้จริง', misconception:'รวม PDF ทุกทุนไว้หน้าเดียว' },
    { id:'B1-C006', context:'ระบบเลือกกลุ่มเรียน', user:'นักศึกษาที่จัดตารางเรียน', issue:'เวลาเรียนชนกันแต่ระบบเตือนหลังบันทึกเท่านั้น', concepts:['error prevention','feedback','task success'], evidence:'ผู้ใช้เลือกกลุ่มชนเวลาและต้องแก้ซ้ำ', repair:'เตือนทันทีเมื่อเลือกกลุ่มที่ชนเวลา', misconception:'ให้ผู้ใช้ตรวจตารางเองก่อนบันทึก' },
    { id:'B1-C007', context:'ระบบจองคิวอาจารย์', user:'นักศึกษาที่ต้องพบอาจารย์ที่ปรึกษา', issue:'ไม่เห็นเวลาว่างที่เหมาะสมและไม่รู้ต้องเตรียมข้อมูลอะไร', concepts:['user goal','HCD','cognitive load'], evidence:'ผู้ใช้เปิดหลายหน้าเพื่อเดาว่าควรเลือกเวลาใด', repair:'แสดงเวลาว่างเด่นและ checklist ก่อนพบอาจารย์', misconception:'ทำปฏิทินให้สวยขึ้นก่อน' },
    { id:'B1-C008', context:'เว็บห้องสมุด', user:'นักศึกษาที่ต้องยืมหรือจองหนังสือ', issue:'ไม่รู้สถานะหนังสือและปุ่มจองไม่เด่นกว่าปุ่มอื่น', concepts:['UI hierarchy','feedback','affordance'], evidence:'ผู้ใช้กดดูรายละเอียดซ้ำแต่ไม่จองสำเร็จ', repair:'แสดงสถานะชัดและเน้นปุ่มจองเมื่อพร้อมจอง', misconception:'เพิ่มไอคอนหนังสือให้ดูน่าใช้' },
    { id:'B1-C009', context:'ระบบแจ้งปัญหาในห้องเรียน', user:'นักศึกษาที่พบอุปกรณ์ใช้งานไม่ได้', issue:'หมวดปัญหาคล้ายกันและหลังแจ้งแล้วไม่รู้ว่าถูกส่งไปที่ใด', concepts:['categorization','feedback','HCD'], evidence:'ผู้ใช้เลือกหมวดผิดและไม่รู้ว่าจะติดตามผลอย่างไร', repair:'ใช้หมวดภาษาผู้ใช้และให้เลขติดตามสถานะ', misconception:'เพิ่มช่องพิมพ์รายละเอียดให้ยาวขึ้น' },
    { id:'B1-C010', context:'เว็บตารางสอบบนมือถือ', user:'นักศึกษาที่ต้องหาวันสอบ', issue:'ตารางเป็นภาพยาว ต้องซูมและจำข้อมูลระหว่างเลื่อน', concepts:['mobile UX','memory load','recognition'], evidence:'ผู้ใช้หาวิชาตนเองช้าและอ่านวันผิด', repair:'ทำตารางค้นหาได้และแสดงวิชาของผู้ใช้เป็นรายการ', misconception:'แปะภาพตารางให้เหมือนประกาศเดิม' },
    { id:'B1-C011', context:'ระบบอัปโหลดไฟล์งาน', user:'นักศึกษาที่ส่งงานก่อนกำหนด', issue:'หลังแนบไฟล์แล้วไม่เห็นชื่อไฟล์ล่าสุดและสถานะส่ง', concepts:['feedback','confidence','error prevention'], evidence:'ผู้ใช้ส่งซ้ำเพราะไม่แน่ใจว่าไฟล์ถูกบันทึกไหม', repair:'แสดงชื่อไฟล์ เวลา และสถานะส่งสำเร็จ', misconception:'ถ้าไม่มี error แปลว่าผู้ใช้เข้าใจแล้ว' },
    { id:'B1-C012', context:'ระบบสมัครชมรม', user:'นักศึกษาที่เลือกชมรมใหม่', issue:'ข้อมูลชมรมยาวแต่ไม่บอกก่อนว่ารับสมาชิกหรือเต็มแล้ว', concepts:['information scent','decision support','UI priority'], evidence:'ผู้ใช้อ่านรายละเอียดนานก่อนพบว่าสมัครไม่ได้', repair:'แสดงสถานะรับสมัครและข้อมูลตัดสินใจหลักก่อน', misconception:'รายละเอียดเยอะช่วยให้ตัดสินใจดีขึ้นเสมอ' },
    { id:'B1-C013', context:'เว็บบริการงานทะเบียน', user:'นักศึกษาที่ต้องเปลี่ยนข้อมูลส่วนตัว', issue:'เมนูใช้ชื่อฝ่ายงานภายใน ไม่ตรงกับภาษาปัญหาของนักศึกษา', concepts:['mental model','HCD','navigation'], evidence:'ผู้ใช้ไม่รู้ว่าต้องเข้าเมนูใดจากปัญหาของตน', repair:'จัดเมนูตามงานของผู้ใช้และทดสอบ tree test', misconception:'ใช้โครงสร้างองค์กรเป็นเมนู' },
    { id:'B1-C014', context:'ระบบจองห้องประชุม', user:'นักศึกษาทำงานกลุ่ม', issue:'ไม่เห็นช่วงเวลาว่างก่อนกรอกข้อมูลและสีในปฏิทินไม่มีคำอธิบาย', concepts:['flow','visual mapping','cognitive load'], evidence:'ผู้ใช้กรอกฟอร์มแล้วพบว่าเวลานั้นจองไม่ได้', repair:'ให้เลือกเวลาว่างก่อนและเพิ่ม legend', misconception:'ให้กรอกข้อมูลครบก่อนเลือกเวลา' },
    { id:'B1-C015', context:'หน้าแจ้งคะแนนรายวิชา', user:'นักศึกษาที่วางแผนปรับปรุงผลเรียน', issue:'คะแนนหลายส่วนแสดงพร้อมกันแต่ไม่บอกว่าควรปรับส่วนใดก่อน', concepts:['decision support','priority','UX'], evidence:'ผู้ใช้เห็นคะแนนแต่ไม่รู้ next action', repair:'เน้นส่วนเสี่ยงและเสนอสิ่งที่ควรทำต่อ', misconception:'ข้อมูลครบเท่ากับเข้าใจครบ' },
    { id:'B1-C016', context:'หน้า Download เอกสารเรียน', user:'นักศึกษาที่เตรียมก่อนเข้าเรียน', issue:'ไฟล์ชื่อคล้ายกัน ไม่มีป้ายล่าสุด และไม่แบ่งประเภทไฟล์', concepts:['recognition','visual cue','information architecture'], evidence:'ผู้ใช้ดาวน์โหลดไฟล์ผิดหรือไฟล์เก่า', repair:'ติดป้ายล่าสุด แยกประเภท และแสดงวันที่แก้ไข', misconception:'เรียงตามวันที่ก็พอ' },
    { id:'B1-C017', context:'ระบบขอใช้พื้นที่กิจกรรม', user:'นักศึกษาที่จัดกิจกรรมกลุ่ม', issue:'ฟอร์มถามหลายส่วนโดยไม่บอกว่าอะไรจำเป็นและทำไมต้องกรอก', concepts:['HCD','form UX','cognitive load'], evidence:'ผู้ใช้หยุดที่ช่องที่ไม่เข้าใจและกรอกข้อมูลไม่ครบ', repair:'จัดกลุ่มข้อมูลและบอกเหตุผลของช่องสำคัญ', misconception:'คัดลอกฟอร์มกระดาษทั้งหมด' },
    { id:'B1-C018', context:'ระบบติดตามโปรเจกต์รายวิชา', user:'นักศึกษาที่ทำงานกลุ่ม', issue:'สถานะงานใช้คำที่ไม่เข้าใจและไม่บอกขั้นตอนถัดไป', concepts:['language clarity','mental model','feedback'], evidence:'สมาชิกกลุ่มถามหัวหน้าซ้ำว่าต้องแก้อะไร', repair:'ใช้คำง่ายและแสดง next step ของแต่ละสถานะ', misconception:'คำศัพท์ระบบดูมืออาชีพกว่า' },
    { id:'B1-C019', context:'เว็บแนะแนวอาชีพ', user:'นักศึกษาที่หาที่ฝึกงาน', issue:'ประกาศฝึกงานแสดงเหมือนกันหมด ไม่มีตัวกรองสาขาและทักษะ', concepts:['filtering','attention','user goal'], evidence:'ผู้ใช้เปิดหลายประกาศที่ไม่ตรงสาขา', repair:'เพิ่มตัวกรองตามสาขา ทักษะ และระดับประสบการณ์', misconception:'รายการเยอะคือโอกาสมากขึ้นเสมอ' },
    { id:'B1-C020', context:'ระบบบันทึกการเข้าเรียน', user:'นักศึกษาที่ทำกิจกรรมในชั้นเรียน', issue:'หลังแตะปุ่มแล้วไม่มีข้อความยืนยันทันที', concepts:['feedback timing','confidence','system status'], evidence:'ผู้ใช้แตะซ้ำเพราะไม่แน่ใจว่าสำเร็จไหม', repair:'แสดงข้อความยืนยันทันทีและสถานะล่าสุด', misconception:'สีปุ่มเปลี่ยนเล็กน้อยก็พอ' },
    { id:'B1-C021', context:'แอปแผนที่อาคารเรียน', user:'นักศึกษาที่หาห้องเรียน', issue:'แสดงชื่ออาคารแต่ไม่บอกจุดเริ่มต้น landmark หรือเส้นทางถัดไป', concepts:['spatial mental model','context','task'], evidence:'ผู้ใช้รู้ชื่ออาคารแต่ยังเดินผิดทาง', repair:'เพิ่มจุดเริ่มต้น landmark และเส้นทางทีละขั้น', misconception:'แผนที่รวมทั้งหมดครบที่สุด' },
    { id:'B1-C022', context:'ฟอร์มประเมินรายวิชา', user:'นักศึกษาที่ต้องตอบหลายข้อ', issue:'คำถามซ้ำ ยาว และไม่บอกความคืบหน้า', concepts:['cognitive load','fatigue','progress'], evidence:'ผู้ใช้ตอบเร็วผิดปกติท้ายฟอร์มหรือออกก่อนจบ', repair:'จัดกลุ่มคำถาม ลดคำซ้ำ และแสดงจำนวนข้อที่เหลือ', misconception:'ถามละเอียดที่สุดคือได้ข้อมูลดีที่สุดเสมอ' },
    { id:'B1-C023', context:'ระบบจองที่นั่งอ่านหนังสือ', user:'นักศึกษาที่อ่านสอบ', issue:'เลือกที่นั่งแล้วไม่รู้ว่าโซนเงียบ มีปลั๊ก หรือคุยได้ไหม', concepts:['decision cue','information scent','UX'], evidence:'ผู้ใช้จองโซนผิดกับความต้องการ', repair:'แสดงป้ายโซนและคุณสมบัติที่ใช้ตัดสินใจ', misconception:'เลขที่นั่งเพียงอย่างเดียวพอใช้ได้' },
    { id:'B1-C024', context:'หน้าเริ่มต้นบทเรียนออนไลน์', user:'นักศึกษาที่เรียนด้วยตนเอง', issue:'ปุ่มเริ่ม เรียนต่อ ทบทวน และแบบฝึกหัดเด่นเท่ากันหมด', concepts:['primary action','attention','task flow'], evidence:'ผู้ใช้ลังเลและกดปุ่มไม่ตรงกับสถานะของตน', repair:'ทำปุ่มหลักตามสถานะผู้ใช้และลดน้ำหนักปุ่มรอง', misconception:'ปุ่มทุกอย่างเด่นเท่ากันเพื่อให้เลือกครบ' }
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
    b1.seedCases = uniqById(B1_CASES.concat(old));
    b1.itemBankVersion = BANK_VERSION;
    b1.minReplayCases = 36;
    b1.targetReplayCases = 40;
  }
  window.CSAI2601_UXQ_ITEM_BANK_B1_V1 = Object.freeze({ version:BANK_VERSION, B1_CASES, counts:{ B1:B1_CASES.length } });
})();
