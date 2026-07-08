// === /sgnal-hunt/js/uxq-csai2601-item-bank-w7-plus-v1.js ===
// CSAI2601 UX Quest W7 Plus Bank: +16 cases to reach 40 W7 variants.
(function () {
  'use strict';
  const PLUS_VERSION = 'v20260708-w7-plus-16cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const W7_PLUS_CASES = [
    { id:'W7-C025', context:'ระบบเลือกแหล่งเรียนรู้', issue:'วิดีโอ เอกสาร และแบบฝึกหัดแสดงเท่ากันจนผู้ใช้ไม่รู้เริ่มจากอะไร', goal:'เริ่มเรียนจากสื่อที่เหมาะกับระดับตน', priority:'ระดับผู้เรียน ลำดับเริ่มต้น และปุ่มเริ่มต้องเด่น', layout:'learning path cards + progress strip', cta:'เริ่มจากบทแนะนำ', mobile:'แสดงเส้นทางทีละขั้นก่อนรายการทั้งหมด', misconception:'แสดงสื่อทุกแบบใน grid เท่ากัน' },
    { id:'W7-C026', context:'ระบบจัดกลุ่มงานโปรเจกต์', issue:'สมาชิกใหม่ไม่เห็นบทบาทและงานแรกของตน', goal:'เริ่มช่วยทีมได้ทันที', priority:'บทบาท งานแรก และสิ่งที่ทีมรอต้องอยู่เหนือ board รวม', layout:'onboarding task card + team board', cta:'รับงานแรกของฉัน', mobile:'my first task card อยู่บนสุด', misconception:'เพิ่มช่องแชทให้คุยกันเอง' },
    { id:'W7-C027', context:'เว็บประกาศห้องสอบ', issue:'รหัสห้องเด่นแต่ข้อมูลอาคาร ชั้น และวิธีไปไม่ชัด', goal:'ไปถึงห้องสอบถูก', priority:'อาคาร ชั้น เวลา และเส้นทางต้องเด่นกว่ารหัสย่อย', layout:'exam location card + route shortcut', cta:'ดูเส้นทางไปห้องสอบ', mobile:'card วิชา + ปุ่มแผนที่ใต้ห้องสอบ', misconception:'ขยายรหัสห้องให้ใหญ่ขึ้น' },
    { id:'W7-C028', context:'ระบบรับคำปรึกษาออนไลน์', issue:'หัวข้อบริการกว้างและผู้ใช้ไม่แน่ใจว่าจะส่งคำขอได้ไหม', goal:'เลือกหัวข้อและส่งคำขออย่างมั่นใจ', priority:'ตัวอย่างปัญหา ความเป็นส่วนตัว และปุ่มส่งต้องชัด', layout:'friendly concern cards + privacy note', cta:'ส่งคำขอปรึกษา', mobile:'การ์ดหัวข้อพร้อมตัวอย่างสั้น', misconception:'ทำข้อความนโยบายให้ยาวขึ้นก่อน' },
    { id:'W7-C029', context:'หน้าเลือกช่องทางติดต่อคณะ', issue:'หลายช่องทางแต่ไม่มีคำแนะนำว่าควรใช้ช่องทางใด', goal:'เลือกช่องทางติดต่อถูกตามความเร่งด่วน', priority:'ประเภทเรื่อง ความเร่งด่วน และช่องทางแนะนำต้องเห็นพร้อมกัน', layout:'contact advisor cards', cta:'ใช้ช่องทางนี้', mobile:'เลือกเรื่องก่อนโชว์ช่องทาง', misconception:'แสดงเบอร์ติดต่อทั้งหมดไว้ด้านบน' },
    { id:'W7-C030', context:'ระบบรายงานความคืบหน้าโครงงาน', issue:'ช่องรายงานกว้างจนผู้ใช้ไม่รู้เขียนอะไร', goal:'สรุป progress, blocker, next step ได้ชัด', priority:'3 ช่องสรุปต้องเด่นและมีตัวอย่างสั้น', layout:'three-part progress form', cta:'ส่งสรุปความคืบหน้า', mobile:'แต่ละช่องเป็น card สั้น ๆ', misconception:'เพิ่มช่องรายละเอียดให้ยาวกว่าเดิม' },
    { id:'W7-C031', context:'ระบบค้นหาห้องเรียนว่าง', issue:'ห้องว่างไม่บอกจำนวนที่นั่ง อุปกรณ์ และกติกา', goal:'เลือกห้องที่เหมาะกับงานกลุ่ม', priority:'จำนวนคน อุปกรณ์ และเวลาว่างต้องอยู่ใน card ห้อง', layout:'room-fit cards + filters', cta:'จองห้องนี้', mobile:'filter chips ก่อนรายการห้อง', misconception:'แสดงห้องว่างทั้งหมดก่อน' },
    { id:'W7-C032', context:'เว็บกิจกรรมอบรมทักษะ', issue:'ชื่อกิจกรรมไม่บอกระดับความยากหรือผลลัพธ์หลังเรียน', goal:'เลือกอบรมที่เหมาะกับระดับตน', priority:'level, skill, outcome และเวลาต้องเด่น', layout:'skill event cards', cta:'สมัครอบรมนี้', mobile:'badge ระดับและทักษะใต้ชื่อกิจกรรม', misconception:'ทำโปสเตอร์กิจกรรมให้ใหญ่ขึ้น' },
    { id:'W7-C033', context:'ระบบนัดหมายห้องแล็บ', issue:'ผู้ใช้จองเวลาแล้วจึงรู้ว่าขาดเงื่อนไขก่อนใช้เครื่องมือ', goal:'เตรียมตัวก่อนจองห้องแล็บ', priority:'readiness checklist ต้องมาก่อนปุ่มยืนยัน', layout:'readiness gate + time slots', cta:'ตรวจความพร้อมและจอง', mobile:'checklist เป็น step ก่อนเลือกเวลา', misconception:'ให้เลือกเวลาให้เร็วที่สุดก่อน' },
    { id:'W7-C034', context:'ระบบเลือกแผนการเรียน', issue:'prerequisite ไม่แสดงเป็นเส้นทางที่เข้าใจง่าย', goal:'เลือกวิชาไม่ผิดลำดับ', priority:'วิชาที่ผ่านแล้ว วิชาถัดไป และคำเตือนต้องเด่น', layout:'course path map + warning cards', cta:'เพิ่มวิชานี้ในแผน', mobile:'timeline วิชาแทนแผนภาพใหญ่', misconception:'เพิ่มคำอธิบายรายวิชายาวขึ้น' },
    { id:'W7-C035', context:'ระบบประเมินกิจกรรมหลังเข้าร่วม', issue:'คำถามกว้างทำให้ feedback ใช้ปรับงานยาก', goal:'ให้ feedback ที่สะท้อนประสบการณ์จริง', priority:'task, pain point, suggestion ต้องแยกเป็นช่องชัด', layout:'experience feedback cards', cta:'ส่ง feedback', mobile:'เลือก tag ก่อนเติมข้อความสั้น', misconception:'เพิ่มจำนวนคำถามให้มากขึ้น' },
    { id:'W7-C036', context:'หน้าแนะนำบริการนักศึกษาใหม่', issue:'บริการจัดตามหน่วยงาน ไม่ใช่สถานการณ์ชีวิตนักศึกษา', goal:'หาบริการที่ต้องใช้ในช่วงเริ่มเรียน', priority:'สถานการณ์ เช่น ลงทะเบียน เอกสาร ห้องเรียน ต้องมาก่อนชื่อหน่วยงาน', layout:'student-life journey cards', cta:'เริ่มจากเรื่องนี้', mobile:'cards 1 คอลัมน์ตามสถานการณ์', misconception:'เรียงชื่อบริการตามฝ่ายงานให้เรียบร้อย' },
    { id:'W7-C037', context:'ระบบบันทึกคำถามในชั้นเรียน', issue:'ผู้ใช้ไม่รู้ว่าถามแบบส่วนตัวได้ไหมและคำถามจะถูกตอบเมื่อไร', goal:'กล้าถามและติดตามคำตอบได้', priority:'โหมดถามส่วนตัว สถานะคิว และปุ่มส่งต้องชัด', layout:'question composer + queue status', cta:'ส่งคำถาม', mobile:'composer อยู่ล่างพร้อมสถานะคำถามของฉัน', misconception:'เปิดช่องพิมพ์รวมอย่างเดียว' },
    { id:'W7-C038', context:'หน้าสรุปผลการเรียนรายสัปดาห์', issue:'คะแนนหลายส่วนไม่บอกว่าควรฝึกอะไรต่อ', goal:'รู้จุดที่ต้องฝึกต่อ', priority:'จุดอ่อน คำแนะนำฝึก และปุ่มเริ่มฝึกต้องเด่นกว่ากราฟรวม', layout:'improvement cards + score summary', cta:'เริ่มฝึกจุดนี้', mobile:'next practice card อยู่บนสุด', misconception:'ทำกราฟคะแนนให้ใหญ่ขึ้น' },
    { id:'W7-C039', context:'ระบบแนะนำกิจกรรมตามความสนใจ', issue:'กิจกรรมแนะนำไม่ตรงกับเวลาและเป้าหมายจริงของผู้ใช้', goal:'เจอกิจกรรมที่ไปได้จริง', priority:'ความสนใจ เวลาว่าง และระยะทางต้องอยู่ใน card แนะนำ', layout:'context-aware recommendation cards', cta:'สมัคร/บันทึกกิจกรรมนี้', mobile:'ปุ่มบันทึกและเวลาว่างเด่นใต้ชื่อกิจกรรม', misconception:'แนะนำกิจกรรมยอดนิยมก่อนเสมอ' },
    { id:'W7-C040', context:'ระบบค้นหาข่าวทุนและโอกาสพิเศษ', issue:'ข่าวทุน แข่งขัน อบรม และฝึกงานปนกันจนผู้ใช้พลาดเรื่องที่ตรงตน', goal:'หาโอกาสที่ตรงคุณสมบัติและ deadline', priority:'ประเภทข่าว คุณสมบัติ และ deadline ต้องเด่น', layout:'opportunity cards + eligibility chips', cta:'บันทึกข่าว/ตรวจคุณสมบัติ', mobile:'deadline badge และ eligibility chip บน card', misconception:'เรียงข่าวตามวันที่ล่าสุดอย่างเดียว' }
  ];

  function uniqById(list) {
    const seen = new Set();
    return (list || []).filter((item) => {
      const id = String(item && item.id || '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id); return true;
    });
  }

  const w7 = content.nodes.find((node) => String(node.id).toUpperCase() === 'W7');
  if (w7) {
    const old = Array.isArray(w7.seedCases) ? w7.seedCases : [];
    w7.seedCases = uniqById(W7_PLUS_CASES.concat(old));
    w7.itemBankPlusVersion = PLUS_VERSION;
    w7.targetReplayCases = 40;
  }
  window.CSAI2601_UXQ_ITEM_BANK_W7_PLUS_V1 = Object.freeze({ version:PLUS_VERSION, W7_PLUS_CASES, counts:{ W7Plus:W7_PLUS_CASES.length } });
})();
