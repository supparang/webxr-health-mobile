// === /sgnal-hunt/js/uxq-csai2601-item-bank-w7-v1.js ===
// CSAI2601 UX Quest Item Bank: W7 Wireframe, Grid & Visual Hierarchy pack 24.
(function () {
  'use strict';
  const BANK_VERSION = 'v20260708-w7-24cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const W7_CASES = [
    { id:'W7-C001', context:'หน้าแรกบริการนักศึกษา', issue:'ประกาศ ข่าว เมนูด่วน และสถานะคำร้องปนกันจนผู้ใช้ไม่เห็นสิ่งที่ต้องทำ', goal:'ตรวจสถานะคำร้องเร็ว', priority:'สถานะคำร้องและปุ่ม action ต้องเด่นกว่าข่าวทั่วไป', layout:'card task-first + secondary news', cta:'ดูสถานะ/ดำเนินการต่อ', mobile:'เรียง task card ก่อน feed ข่าว', misconception:'ทำ banner ข่าวให้ใหญ่ขึ้น' },
    { id:'W7-C002', context:'หน้าเลือกวิชาเสรี', issue:'รายชื่อวิชายาวและข้อมูลเวลา หน่วยกิต ที่นั่งไม่อยู่ในจุดเดียวกัน', goal:'เปรียบเทียบวิชาได้เร็ว', priority:'เวลาเรียน ที่นั่ง และเงื่อนไขต้องอ่านใน card เดียว', layout:'comparison cards with filter top', cta:'เพิ่มในแผนเรียน', mobile:'ใช้ card stack แทนตารางกว้าง', misconception:'เรียงชื่อวิชาตามตัวอักษรอย่างเดียว' },
    { id:'W7-C003', context:'หน้าสมัครกิจกรรม', issue:'ผู้ใช้ไม่เห็นเงื่อนไขและปุ่มสมัครทันที', goal:'สมัครกิจกรรมที่ตรงเงื่อนไข', priority:'สถานะรับสมัคร ชั่วโมงกิจกรรม เวลา และ CTA ต้องอยู่เหนือรายละเอียด', layout:'hero summary + sticky CTA', cta:'สมัครกิจกรรมนี้', mobile:'CTA fixed bottom หลังอ่าน summary', misconception:'ใส่รูปกิจกรรมใหญ่ก่อนข้อมูลสมัคร' },
    { id:'W7-C004', context:'ระบบคำร้องออนไลน์', issue:'ผู้ใช้เริ่มฟอร์มโดยไม่รู้เอกสารที่ต้องเตรียม', goal:'ส่งคำร้องครบในครั้งเดียว', priority:'checklist เอกสารและขั้นตอนต้องมาก่อนช่องกรอก', layout:'stepper + checklist panel', cta:'เริ่มคำร้องเมื่อพร้อม', mobile:'แสดง checklist เป็น accordion สั้น', misconception:'ขยายช่องอัปโหลดให้เยอะขึ้น' },
    { id:'W7-C005', context:'ระบบจองห้องประชุม', issue:'กรอกข้อมูลก่อนรู้ว่าห้องว่างหรือไม่', goal:'จองห้องให้ตรงวันเวลา', priority:'เวลาว่างและเงื่อนไขห้องต้องมาก่อนฟอร์มรายละเอียด', layout:'availability calendar + room cards', cta:'เลือกเวลานี้', mobile:'แสดง slot ว่างเป็นรายการ', misconception:'ทำฟอร์มให้สวยขึ้นแต่ยังเริ่มจากกรอกข้อมูล' },
    { id:'W7-C006', context:'เว็บทุนการศึกษา', issue:'เงื่อนไขทุนยาวและผู้ใช้ไม่รู้ว่าตนมีสิทธิ์ไหม', goal:'หาทุนที่สมัครได้', priority:'eligibility result, deadline, documents ต้องอยู่หน้าแรกของ card', layout:'eligibility cards + checklist', cta:'ตรวจสิทธิ์/เตรียมเอกสาร', mobile:'ใช้ progress checklist ทีละหมวด', misconception:'รวม PDF ทุกทุนไว้ด้านบน' },
    { id:'W7-C007', context:'หน้าแรก LMS', issue:'งานด่วนถูกกลบด้วยประกาศและไฟล์เรียน', goal:'รู้ว่างานใดต้องทำก่อน', priority:'deadline และปุ่มส่งงานต้องเด่นกว่าประกาศทั่วไป', layout:'today task board + course sections', cta:'ส่งงานนี้', mobile:'task list เต็มความกว้างก่อนประกาศ', misconception:'ทำประกาศให้ใหญ่ขึ้นทุกเรื่อง' },
    { id:'W7-C008', context:'ระบบจองคิวอาจารย์', issue:'ไม่เห็นเวลาว่างและรายการเตรียมตัวพร้อมกัน', goal:'จองเวลาพบอาจารย์อย่างมั่นใจ', priority:'หัวข้อปรึกษา เวลา และ checklist เตรียมตัวต้องอยู่ใกล้กัน', layout:'appointment card + prep sidebar', cta:'ยืนยันเวลานี้', mobile:'แสดง prep checklist หลังเลือกเวลา', misconception:'เพิ่มปฏิทินใหญ่เต็มจอ' },
    { id:'W7-C009', context:'เว็บห้องสมุด', issue:'สถานะหนังสือไม่เด่นและปุ่มจองน้ำหนักเท่าปุ่มรอง', goal:'จองหนังสือที่ใช้ได้', priority:'สถานะพร้อมยืมและปุ่มจองต้องอยู่เหนือรายละเอียดบรรณานุกรม', layout:'book status card + primary CTA', cta:'จองหนังสือ', mobile:'status badge + CTA ใต้ชื่อหนังสือ', misconception:'เพิ่มรูปปกหนังสือให้ใหญ่ขึ้น' },
    { id:'W7-C010', context:'ระบบอัปโหลดงาน', issue:'หลังแนบไฟล์แล้วไม่เห็นหลักฐานการส่งชัดเจน', goal:'มั่นใจว่าส่งไฟล์ถูก', priority:'ชื่อไฟล์ เวลา และสถานะส่งต้องเด่นหลัง action', layout:'upload card + receipt block', cta:'ส่งไฟล์/แทนที่ไฟล์', mobile:'receipt อยู่ใต้ปุ่มส่งทันที', misconception:'ซ่อนประวัติส่งไว้ท้ายหน้า' },
    { id:'W7-C011', context:'เว็บตารางสอบมือถือ', issue:'ภาพตารางยาวต้องซูมและอ่านยาก', goal:'หาวันสอบของวิชาตนเอง', priority:'ค้นหารายวิชา วัน เวลา ห้อง ต้องอ่านง่ายเป็นรายการ', layout:'search first + exam list cards', cta:'เพิ่มเตือน/ดูห้องสอบ', mobile:'เลิกใช้ตารางภาพ ใช้ card รายวิชา', misconception:'ทำภาพตารางให้คมขึ้น' },
    { id:'W7-C012', context:'ระบบแจ้งปัญหาในห้องเรียน', issue:'หมวดปัญหาไม่ตรงภาษาผู้ใช้และปุ่มส่งไม่เด่น', goal:'แจ้งปัญหาได้ถูกหมวด', priority:'เลือกสิ่งที่เสีย ห้อง และปุ่มส่งต้องชัด', layout:'issue category tiles + location field', cta:'ส่งเรื่องแจ้งปัญหา', mobile:'tiles สั้น 2 คอลัมน์พร้อมตัวอย่าง', misconception:'เพิ่มช่องพิมพ์ยาวแทนหมวด' },
    { id:'W7-C013', context:'หน้า Download เอกสารเรียน', issue:'ไฟล์ชื่อคล้ายกันและไม่มีป้ายเวอร์ชันล่าสุด', goal:'โหลดไฟล์ที่ต้องใช้จริง', priority:'ป้ายล่าสุด ประเภทไฟล์ และสัปดาห์ต้องเด่น', layout:'file cards grouped by week', cta:'ดาวน์โหลดไฟล์ล่าสุด', mobile:'grouped cards แทนรายการยาว', misconception:'เรียงไฟล์ตามวันที่อย่างเดียว' },
    { id:'W7-C014', context:'ระบบติดตามโปรเจกต์รายวิชา', issue:'สมาชิกไม่เห็นงานของตนและ next step', goal:'รู้ว่างานใดต้องทำต่อ', priority:'งานของฉัน owner status และ next step ต้องอยู่แถวบน', layout:'kanban lite + my tasks', cta:'อัปเดตงานของฉัน', mobile:'my task cards ก่อน board รวม', misconception:'แสดงทุก task เท่ากันทั้งหมด' },
    { id:'W7-C015', context:'เว็บแนะแนวอาชีพ', issue:'ประกาศฝึกงานจำนวนมากแต่ไม่ตรงทักษะ', goal:'เจอประกาศที่เหมาะกับตน', priority:'filter สาขา ทักษะ ที่ตั้ง และระดับต้องมาก่อนรายการ', layout:'filter rail + job cards', cta:'บันทึกประกาศ/สมัคร', mobile:'filter chips ด้านบน', misconception:'เพิ่มประกาศยอดนิยมก่อนประกาศที่ตรงผู้ใช้' },
    { id:'W7-C016', context:'ระบบจองที่นั่งอ่านหนังสือ', issue:'ไม่เห็นโซนเงียบ ปลั๊กไฟ และกติกาก่อนจอง', goal:'เลือกที่นั่งเหมาะกับการอ่าน', priority:'คุณสมบัติโซนต้องชัดก่อนเลขที่นั่ง', layout:'zone cards + seat map', cta:'จองที่นั่งนี้', mobile:'เลือกโซนก่อนเปิดแผนผังที่นั่ง', misconception:'แสดงเลขที่นั่งให้ใหญ่ขึ้น' },
    { id:'W7-C017', context:'หน้าเลือกบริการนักศึกษา', issue:'เมนูเป็นชื่อหน่วยงานไม่ตรงปัญหาผู้ใช้', goal:'ไปยังบริการที่ถูกต้อง', priority:'สถานการณ์/ปัญหาของผู้ใช้ต้องเป็น entry point', layout:'problem-first service cards', cta:'เริ่มทำรายการนี้', mobile:'search + popular task cards', misconception:'เรียงชื่อฝ่ายงานให้เรียบร้อยขึ้น' },
    { id:'W7-C018', context:'ระบบเลือกหัวข้อโครงงาน', issue:'หัวข้อยาวแต่ไม่บอกระดับความยากและทักษะที่ใช้', goal:'เลือกหัวข้อที่เหมาะกับตน', priority:'ระดับ ทักษะ และตัวอย่างผลลัพธ์ต้องอยู่ใน card', layout:'project fit cards', cta:'เลือกหัวข้อนี้/ดูตัวอย่าง', mobile:'badge ระดับและทักษะใต้ชื่อหัวข้อ', misconception:'ทำชื่อหัวข้อให้น่าสนใจขึ้นเท่านั้น' },
    { id:'W7-C019', context:'ระบบนัดหมายงานแนะแนว', issue:'หัวข้อปรึกษากว้างและไม่มีตัวอย่าง', goal:'เลือกหัวข้อปรึกษาถูก', priority:'ตัวอย่างสถานการณ์ต้องอยู่ใต้หัวข้อ', layout:'guided concern cards', cta:'เลือกหัวข้อนี้', mobile:'cards พร้อมตัวอย่าง 1 บรรทัด', misconception:'ลดหัวข้อให้สั้นลงอย่างเดียว' },
    { id:'W7-C020', context:'แอปแผนที่อาคารเรียน', issue:'ชื่ออาคารเด่นแต่จุดเริ่มต้นและเส้นทางไม่ชัด', goal:'เดินไปห้องเรียนถูก', priority:'จุดเริ่มต้น landmark และขั้นตอนถัดไปต้องเด่น', layout:'route step cards + mini map', cta:'เริ่มนำทาง', mobile:'ขั้นตอนทีละ step มาก่อนแผนที่รวม', misconception:'แสดงแผนที่รวมใหญ่ขึ้น' },
    { id:'W7-C021', context:'หน้าแบบฝึกหัดออนไลน์', issue:'เฉลยเยอะจนไม่รู้ว่าตนผิดตรงไหน', goal:'รู้จุดผิดและลองใหม่ได้', priority:'จุดผิดหลัก เหตุผลสั้น และปุ่มลองใหม่ต้องเด่น', layout:'feedback focus card', cta:'ลองใหม่ด้วย hint', mobile:'feedback 1 ข้อความก่อนรายละเอียด', misconception:'แสดงเฉลยทั้งหมดทันที' },
    { id:'W7-C022', context:'ระบบรายงานปัญหาการเรียน', issue:'ช่องพิมพ์ใหญ่แต่ไม่ช่วยเล่าปัญหาเป็นขั้น', goal:'ขอความช่วยเหลือได้ชัด', priority:'สิ่งที่พบ จุดที่เกิด และสิ่งที่ต้องการให้ช่วยต้องแยกช่อง', layout:'guided form sections', cta:'ส่งให้ผู้สอน', mobile:'ทีละ section พร้อมตัวอย่างสั้น', misconception:'ทำช่องพิมพ์ให้ใหญ่ขึ้น' },
    { id:'W7-C023', context:'ระบบแจ้งเตือนงานใกล้ครบกำหนด', issue:'แจ้ง deadline แต่ไม่ช่วยจัดลำดับงาน', goal:'รู้ว่าควรเริ่มงานใดก่อน', priority:'deadline, effort, status และ priority ต้องเห็นร่วมกัน', layout:'priority task cards', cta:'เริ่มงานนี้', mobile:'cards เรียงตามความเร่งด่วน', misconception:'ส่งแจ้งเตือนถี่ขึ้น' },
    { id:'W7-C024', context:'หน้าเริ่มต้นบทเรียนออนไลน์', issue:'ปุ่มเริ่ม เรียนต่อ ทบทวน และแบบฝึกเด่นเท่ากัน', goal:'ไปต่อจากสถานะล่าสุด', priority:'primary action ต้องเปลี่ยนตามสถานะผู้เรียน', layout:'contextual hero action + secondary links', cta:'เรียนต่อจากจุดล่าสุด', mobile:'ปุ่มหลักเต็มความกว้างและปุ่มรองเป็น link', misconception:'ทำทุกปุ่มให้เด่นเท่ากัน' }
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
    w7.seedCases = uniqById(W7_CASES.concat(old));
    w7.itemBankVersion = BANK_VERSION;
    w7.minReplayCases = 24;
    w7.targetReplayCases = 40;
  }
  window.CSAI2601_UXQ_ITEM_BANK_W7_V1 = Object.freeze({ version:BANK_VERSION, W7_CASES, counts:{ W7:W7_CASES.length } });
})();
