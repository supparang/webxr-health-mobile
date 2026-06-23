// === /sgnal-hunt/js/uxq-w1-data-v10.js ===
// UX Quest • W1 UX Detective • Diversity Content Engine V10
// 60 replay cores: 10 Smart Campus contexts × 6 distinct investigation formats.
// Each replay round draws 5 different formats. Tutorial is a separate 5-case scaffold.

(function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const TYPE_META = {
    'evidence-triage': {
      short: 'Evidence Triage',
      title: 'Evidence Triage',
      icon: '▣',
      description: 'จัดลำดับหลักฐานว่าอะไรขวาง User Goal มากที่สุด'
    },
    'goal-route': {
      short: 'Goal Route',
      title: 'Goal Route',
      icon: '↗',
      description: 'หาเส้นทางเริ่มต้นที่สอดคล้องกับเป้าหมายผู้ใช้'
    },
    'ui-ux-split': {
      short: 'UI / UX Split',
      title: 'UI / UX Split',
      icon: '⇄',
      description: 'แยกอาการบนหน้าจอออกจากผลกระทบต่อผู้ใช้'
    },
    'budget-tradeoff': {
      short: 'Trade-off',
      title: 'Budget Trade-off',
      icon: '◈',
      description: 'เลือกการแก้ภายใต้งบจำกัด ไม่แก้ทุกอย่างพร้อมกัน'
    },
    'ab-audit': {
      short: 'A/B Audit',
      title: 'Before / After Audit',
      icon: 'A/B',
      description: 'เปรียบเทียบสองแบบแล้วเลือกแบบที่ช่วย User Goal จริง'
    },
    'test-forecast': {
      short: 'Test Forecast',
      title: 'User Test Forecast',
      icon: '⌁',
      description: 'ทำนายผลทดสอบจากการแก้ UI ที่ต่างกัน'
    }
  };

  const CONTEXTS = [
    {
      id: 'document-request',
      service: 'Smart Campus Document Request',
      screenTitle: 'ขอเอกสารออนไลน์',
      person: 'พลอย • นักศึกษาปี 2 • ใช้ระบบครั้งแรก',
      goal: 'เริ่มส่งคำร้องขอใบรับรองการเป็นนักศึกษาให้สำเร็จ',
      quote: 'ฉันเข้ามาแล้ว แต่ไม่รู้ว่าต้องเริ่มตรงไหน และกลัวกดผิดคำร้อง',
      critical: 'เมนู “ขอเอกสาร” ถูกวางปนกับแบบฟอร์ม ข่าว และบริการรองโดยไม่มีจุดเริ่มต้นชัดเจน',
      symptomA: 'เมนูเริ่มคำร้องใช้คำกว้างว่า “บริการทั่วไป” และอยู่หลังเมนูข่าว',
      symptomB: 'ปุ่มส่งคำร้องเขียนว่า “ดำเนินการ” โดยไม่บอกว่าจะส่งจริง',
      impact: 'ผู้ใช้ใช้เวลาหาเส้นทางนานและไม่มั่นใจว่ากำลังทำคำร้องถูกประเภท',
      route: 'เริ่มคำร้อง > เลือกชนิดเอกสาร',
      wrongRouteA: 'ข่าวสาร > ประกาศล่าสุด',
      wrongRouteB: 'บัญชีผู้ใช้ > แก้ไขข้อมูลส่วนตัว',
      fixPrimary: 'เพิ่ม CTA “เริ่มขอเอกสาร” และจัดหมวดคำร้องให้เห็นก่อนข้อมูลรอง',
      fixSecondary: 'เปลี่ยนคำปุ่มเป็น “ส่งคำร้องขอเอกสาร” พร้อมบอกสิ่งที่จะเกิดหลังส่ง',
      superficial: 'เพิ่มภาพ Banner ของมหาวิทยาลัยบนหน้าแรก',
      processTrap: 'ให้ผู้ใช้โทรถามเจ้าหน้าที่ทุกครั้งก่อนเริ่มคำร้อง',
      testGood: { success: '88%', time: '0:48', confidence: '89%' },
      testBad: { success: '54%', time: '2:18', confidence: '42%' },
      metricLabel: 'Task success ของผู้ใช้ใหม่'
    },
    {
      id: 'tuition-payment',
      service: 'Tuition Payment Portal',
      screenTitle: 'ชำระค่าธรรมเนียมการศึกษา',
      person: 'เมย์ • นักศึกษาปี 2 • กำลังชำระเงินใกล้กำหนด',
      goal: 'ตรวจสอบยอดและชำระค่าธรรมเนียมให้ถูกต้องก่อนวันสุดท้าย',
      quote: 'ฉันเห็นยอดหลายส่วน แต่ไม่แน่ใจว่าต้องจ่ายอะไรตอนนี้ และปุ่มไปต่อจะพาไปไหน',
      critical: 'ยอดค้างชำระและวันสุดท้ายอยู่ท้ายหน้า ขณะที่ข่าวประชาสัมพันธ์ถูกวางเด่นกว่า',
      symptomA: 'ปุ่มเข้าสู่การชำระใช้คำว่า “ไปต่อ” และอยู่ห่างจากยอดที่ต้องจ่าย',
      symptomB: 'วันสุดท้ายชำระถูกวางใต้ข่าวกิจกรรมและส่วนลด',
      impact: 'ผู้ใช้พลาดข้อมูลการเงินสำคัญและลังเลก่อนเข้าสู่ขั้นตอนชำระเงิน',
      route: 'ยอดค้างชำระ > ไปชำระเงิน',
      wrongRouteA: 'ประวัติใบเสร็จ > ดาวน์โหลดเอกสารเก่า',
      wrongRouteB: 'ทุนการศึกษา > ข่าวทุนล่าสุด',
      fixPrimary: 'ย้ายยอดค้างชำระและวันสุดท้ายขึ้นเป็นส่วน “ต้องทำตอนนี้”',
      fixSecondary: 'เปลี่ยน CTA เป็น “ไปชำระเงิน” และวางชิดกับยอดรวม',
      superficial: 'เปลี่ยนพื้นหลังหน้าการเงินให้ใช้ภาพกราฟิกใหม่',
      processTrap: 'ให้ผู้ใช้ตรวจสอบยอดกับเจ้าหน้าที่ก่อนกดจ่ายทุกครั้ง',
      testGood: { success: '91%', time: '0:42', confidence: '92%' },
      testBad: { success: '57%', time: '2:31', confidence: '45%' },
      metricLabel: 'ผู้ใช้ที่ชำระได้ถูกยอดในครั้งแรก'
    },
    {
      id: 'course-registration',
      service: 'Course Registration',
      screenTitle: 'ลงทะเบียนรายวิชา',
      person: 'นนท์ • นักศึกษาปี 2 • ลงทะเบียนด้วยมือถือ',
      goal: 'ยืนยันรายวิชาที่เลือกโดยไม่ชนเวลาและไม่เกินหน่วยกิต',
      quote: 'ฉันเลือกวิชาแล้ว แต่ไม่เห็นสรุปตารางกับจำนวนหน่วยกิตก่อนกดยืนยัน',
      critical: 'ข้อมูลวิชาที่เลือกและผลกระทบต่อหน่วยกิตไม่ถูกสรุปก่อนผู้ใช้ยืนยัน',
      symptomA: 'ปุ่ม “ยืนยัน” อยู่ล่างสุดโดยไม่มีตารางสรุปรายวิชาที่เลือก',
      symptomB: 'คำเตือนชนเวลาเป็นข้อความเล็กสีจางใต้รายการวิชา',
      impact: 'ผู้ใช้ไม่มั่นใจว่าการลงทะเบียนถูกต้องและเสี่ยงยืนยันรายวิชาที่มีปัญหา',
      route: 'รายวิชาที่เลือก > ตรวจสอบตาราง > ยืนยันการลงทะเบียน',
      wrongRouteA: 'ผลการเรียน > ดูเกรดเทอมก่อน',
      wrongRouteB: 'คู่มือ > ดาวน์โหลดระเบียบการศึกษา',
      fixPrimary: 'เพิ่ม Registration Summary ที่รวมวิชา เวลาเรียน หน่วยกิต และคำเตือนก่อนยืนยัน',
      fixSecondary: 'เปลี่ยนปุ่มเป็น “ยืนยันการลงทะเบียน” และเชื่อมกับสรุปที่ตรวจสอบได้',
      superficial: 'เพิ่มไอคอนสีสันให้รายวิชาแต่ละหมวด',
      processTrap: 'ให้ผู้ใช้เปิด PDF ตารางเรียนอีกหน้าต่างก่อนยืนยันทุกครั้ง',
      testGood: { success: '90%', time: '0:55', confidence: '90%' },
      testBad: { success: '50%', time: '3:04', confidence: '39%' },
      metricLabel: 'การยืนยันรายวิชาโดยไม่เกิดข้อผิดพลาด'
    },
    {
      id: 'room-booking',
      service: 'Study Room Booking',
      screenTitle: 'จองห้องอ่านหนังสือ',
      person: 'มุก • นักศึกษาปี 2 • จองห้องให้ทีมก่อนเริ่มโครงงาน',
      goal: 'จองห้องอ่านหนังสือสำหรับทำงานกลุ่มในช่วงเวลาที่เลือก',
      quote: 'เลือกห้องกับเวลาแล้ว แต่ไม่แน่ใจว่าระบบจะจองห้องไหนให้จริง',
      critical: 'หน้าจอไม่มี Booking Summary ก่อนยืนยัน จึงทำให้ผู้ใช้ตรวจสอบห้อง วัน และเวลาไม่ได้',
      symptomA: 'ปุ่มจบขั้นตอนเขียนว่า “เสร็จสิ้น” และไม่บอกว่าเป็นการจอง',
      symptomB: 'รายละเอียดห้องกับเวลาถูกแยกคนละส่วนและไม่เคยแสดงรวมกัน',
      impact: 'ผู้ใช้กลัวจองผิดห้องหรือเวลาผิด จึงย้อนกลับไปเลือกซ้ำหลายครั้ง',
      route: 'ห้องว่าง > เลือกวันเวลา > ตรวจสอบการจอง > ยืนยัน',
      wrongRouteA: 'กฎการใช้ห้อง > อ่านข้อบังคับ',
      wrongRouteB: 'ประวัติการจอง > ดูรายการเก่า',
      fixPrimary: 'แสดง Booking Summary ที่รวมชื่อห้อง วัน เวลา และจำนวนผู้ใช้ก่อนยืนยัน',
      fixSecondary: 'เปลี่ยน CTA เป็น “ยืนยันการจองห้อง” และวางใต้ Summary',
      superficial: 'เพิ่มภาพบรรยากาศห้องอ่านหนังสือแบบเต็มจอ',
      processTrap: 'ให้ผู้ใช้แคปหน้าจอไปถามบรรณารักษ์ก่อนกดจอง',
      testGood: { success: '93%', time: '0:51', confidence: '94%' },
      testBad: { success: '49%', time: '2:46', confidence: '41%' },
      metricLabel: 'ผู้ใช้ที่จองห้องถูกครั้งแรก'
    },
    {
      id: 'repair-request',
      service: 'Campus Repair Service',
      screenTitle: 'แจ้งซ่อมอุปกรณ์',
      person: 'ต้น • นักศึกษาปี 2 • ต้องใช้ห้องเรียนภายในวันนี้',
      goal: 'แจ้งซ่อมโปรเจกเตอร์ที่เสียและติดตามสถานะงานซ่อมได้',
      quote: 'ฉันต้องแจ้งด่วน แต่ไม่รู้ว่าแบบฟอร์มไหนใช้กับอุปกรณ์ห้องเรียน และส่งแล้วใครรับเรื่อง',
      critical: 'จุดเริ่มแจ้งซ่อมอุปกรณ์ถูกกลืนกับเมนูอาคาร ไฟฟ้า และข่าวซ่อมบำรุง',
      symptomA: 'แบบฟอร์มแจ้งซ่อมใช้หัวข้อ “บริการสถานที่” ซึ่งไม่สื่อว่าใช้แจ้งโปรเจกเตอร์ได้',
      symptomB: 'หลังส่งไม่มีเลขงานหรือสถานะว่ากำลังส่งต่อช่าง',
      impact: 'ผู้ใช้เลือกช่องทางไม่ถูกและไม่มั่นใจว่างานเร่งด่วนได้รับการดำเนินการแล้ว',
      route: 'แจ้งซ่อม > อุปกรณ์ห้องเรียน > ส่งแจ้งเหตุเร่งด่วน',
      wrongRouteA: 'อาคารสถานที่ > รายงานความสะอาด',
      wrongRouteB: 'ข่าวซ่อมบำรุง > ตารางปิดอาคาร',
      fixPrimary: 'แยกทางลัด “แจ้งซ่อมอุปกรณ์ห้องเรียน” และระบุระดับความเร่งด่วน',
      fixSecondary: 'ยืนยันการส่งพร้อมเลขงานและสถานะส่งต่อเจ้าหน้าที่',
      superficial: 'เพิ่มภาพไอคอนเครื่องมือขนาดใหญ่บนหน้าแรก',
      processTrap: 'ให้ผู้ใช้โทรหาอาคารสถานที่หลังกรอกฟอร์มทุกครั้ง',
      testGood: { success: '89%', time: '0:47', confidence: '91%' },
      testBad: { success: '46%', time: '3:11', confidence: '35%' },
      metricLabel: 'การแจ้งซ่อมถูกหมวดและติดตามได้'
    },
    {
      id: 'activity-registration',
      service: 'Campus Activity Hub',
      screenTitle: 'ลงทะเบียนกิจกรรม',
      person: 'เจน • นักศึกษาปี 2 • ต้องสะสมชั่วโมงกิจกรรม',
      goal: 'สมัครกิจกรรมที่ยังมีที่ว่างและตรงกับวันที่สะดวก',
      quote: 'เห็นโปสเตอร์เยอะมาก แต่ไม่รู้ว่ากิจกรรมไหนสมัครได้แล้ว และกดสมัครตรงไหน',
      critical: 'สถานะที่ว่างและปุ่มสมัครถูกกลืนใต้โปสเตอร์ ทำให้ผู้ใช้แยกกิจกรรมที่ทำได้ตอนนี้ไม่ออก',
      symptomA: 'การ์ดกิจกรรมใช้คำว่า “รายละเอียด” เหมือนกันหมด แม้บางกิจกรรมเปิดสมัครแล้ว',
      symptomB: 'สถานะเต็ม/เหลือที่ว่างใช้สีอย่างเดียว ไม่มีข้อความกำกับ',
      impact: 'ผู้ใช้เสียเวลาเปิดข้อมูลทีละกิจกรรมและอาจสมัครไม่ทันกิจกรรมที่ต้องการ',
      route: 'กิจกรรมเปิดสมัคร > เลือกรอบ > ยืนยันการสมัคร',
      wrongRouteA: 'แกลเลอรี > ดูรูปกิจกรรมที่ผ่านมา',
      wrongRouteB: 'ประวัติชั่วโมง > ตรวจใบประกาศเดิม',
      fixPrimary: 'เพิ่มตัวกรอง “เปิดสมัคร / เหลือที่ว่าง” และ CTA สมัครบนการ์ดกิจกรรม',
      fixSecondary: 'แสดงสถานะจำนวนที่ว่างด้วยข้อความร่วมกับสัญลักษณ์',
      superficial: 'เพิ่มภาพโปสเตอร์แบบเลื่อนอัตโนมัติให้ใหญ่ขึ้น',
      processTrap: 'ให้ผู้ใช้ถามผู้จัดกิจกรรมผ่านแชตก่อนจึงจะเห็นปุ่มสมัคร',
      testGood: { success: '87%', time: '0:58', confidence: '88%' },
      testBad: { success: '52%', time: '2:39', confidence: '44%' },
      metricLabel: 'ผู้ใช้ที่พบกิจกรรมเปิดสมัครได้ทันเวลา'
    },
    {
      id: 'assignment-submission',
      service: 'Group Assignment Submission',
      screenTitle: 'ส่งงานกลุ่ม',
      person: 'ฟ้า • นักศึกษาปี 2 • ส่งงานก่อนหมดเขต',
      goal: 'ส่งไฟล์งานกลุ่มฉบับสุดท้ายให้ผู้สอนเห็นอย่างถูกต้อง',
      quote: 'อัปโหลดแล้ว แต่ไม่เห็นว่าไฟล์ไหนถูกส่ง เวลาไหน และอาจารย์จะเห็นหรือยัง',
      critical: 'ระบบแยก “บันทึกไฟล์” กับ “ส่งงาน” ไม่ชัด และไม่มีสถานะยืนยันไฟล์ฉบับสุดท้าย',
      symptomA: 'ปุ่มหลักเขียนว่า “บันทึก” แม้ผู้ใช้ต้องการส่งงานจริง',
      symptomB: 'รายชื่อไฟล์ไม่แสดงเวลาอัปโหลดหรือสถานะว่าเป็นฉบับที่ส่งแล้ว',
      impact: 'ผู้ใช้ส่งไฟล์ซ้ำหรือส่งผิดเวอร์ชัน เพราะไม่แน่ใจว่าอาจารย์เห็นไฟล์ใด',
      route: 'อัปโหลดไฟล์ > ตรวจสอบฉบับสุดท้าย > ส่งงานให้ผู้สอน',
      wrongRouteA: 'ไฟล์เก่า > เปิดฉบับร่างที่ผ่านมา',
      wrongRouteB: 'แชตกลุ่ม > ส่งข้อความหาเพื่อน',
      fixPrimary: 'แยกปุ่ม “บันทึกร่าง” กับ “ส่งงานให้ผู้สอน” และสรุปไฟล์ฉบับสุดท้าย',
      fixSecondary: 'แสดงชื่อไฟล์ เวลา และสถานะ “ส่งแล้ว” พร้อมหลักฐานการส่ง',
      superficial: 'เปลี่ยนไอคอนไฟล์ให้มีหลายสีตามชนิดเอกสาร',
      processTrap: 'ให้สมาชิกทุกคนส่งอีเมลยืนยันไฟล์หลังอัปโหลด',
      testGood: { success: '92%', time: '0:45', confidence: '93%' },
      testBad: { success: '48%', time: '2:57', confidence: '38%' },
      metricLabel: 'การส่งไฟล์ฉบับถูกต้องในครั้งแรก'
    },
    {
      id: 'advisor-appointment',
      service: 'Advisor Appointment',
      screenTitle: 'นัดอาจารย์ที่ปรึกษา',
      person: 'ไนซ์ • นักศึกษาปี 2 • ต้องการปรึกษาเรื่องแผนการเรียน',
      goal: 'เลือกวันและเวลานัดอาจารย์ที่ปรึกษาและยืนยันหัวข้อที่ต้องคุย',
      quote: 'ฉันเลือกเวลาไว้หลายรอบจนไม่แน่ใจว่าตอนนี้กำลังจะจองช่วงไหน',
      critical: 'ระบบไม่สรุปวัน เวลา อาจารย์ และหัวข้อที่เลือกก่อนกดนัดหมาย',
      symptomA: 'CTA เขียนว่า “ต่อไป” โดยไม่ระบุว่าจะยืนยันนัดหมาย',
      symptomB: 'เวลาที่เลือกปรากฏเป็นเพียงแถบสีในปฏิทิน ไม่มีข้อความสรุป',
      impact: 'ผู้ใช้กังวลว่านัดผิดช่วงหรือส่งหัวข้อไม่ครบ จึงย้อนกลับไปเลือกเวลาใหม่',
      route: 'เลือกอาจารย์ > เลือกวันเวลา > ตรวจสอบสรุป > ยืนยันนัด',
      wrongRouteA: 'ประวัติการนัด > ดูรายการเก่า',
      wrongRouteB: 'คู่มือการเรียน > อ่านข้อบังคับทั่วไป',
      fixPrimary: 'เพิ่ม Appointment Summary ที่รวมอาจารย์ วัน เวลา และหัวข้อก่อนยืนยัน',
      fixSecondary: 'เปลี่ยน CTA เป็น “ยืนยันเวลานัดหมาย” และบอกสิ่งที่จะเกิดหลังยืนยัน',
      superficial: 'เพิ่มรูปโปรไฟล์อาจารย์ให้ขนาดใหญ่ขึ้นในหน้าเลือกเวลา',
      processTrap: 'ให้ผู้ใช้ส่งข้อความถามอาจารย์ทุกครั้งหลังเลือกเวลาในระบบ',
      testGood: { success: '91%', time: '0:49', confidence: '92%' },
      testBad: { success: '53%', time: '2:24', confidence: '47%' },
      metricLabel: 'การนัดหมายถูกวันและเวลาที่เลือก'
    },
    {
      id: 'library-search',
      service: 'Library Digital Resources',
      screenTitle: 'ค้นหาบทความวิชาการ',
      person: 'ภพ • นักศึกษาปี 2 • กำลังทำรายงานกลุ่ม',
      goal: 'ค้นหาบทความวิชาการจากฐานข้อมูลที่เหมาะกับหัวข้อรายงาน',
      quote: 'ชื่อฐานข้อมูลเต็มหน้าไปหมด แต่ไม่รู้ว่าต้องเลือกอันไหนเพื่อเริ่มค้นบทความ',
      critical: 'หน้าแรกแสดงรายชื่อฐานข้อมูลจำนวนมากโดยไม่ช่วยผู้ใช้เลือกเส้นทางตามเป้าหมายค้นหา',
      symptomA: 'เมนูใช้ชื่อฐานข้อมูลเชิงเทคนิคโดยไม่มีคำอธิบายว่าเหมาะกับงานแบบใด',
      symptomB: 'คำค้นเริ่มต้นถูกซ่อนใต้รายการฐานข้อมูลยาวหลายคอลัมน์',
      impact: 'ผู้ใช้ไม่รู้ว่าจะเริ่มค้นจากที่ใดและอาจเลือกฐานข้อมูลที่ไม่เหมาะกับงาน',
      route: 'เลือกประเภทแหล่งข้อมูล > ค้นหาบทความ > กรองผลลัพธ์',
      wrongRouteA: 'อบรมห้องสมุด > ดูตารางกิจกรรม',
      wrongRouteB: 'ประวัติการยืม > ตรวจหนังสือที่เคยยืม',
      fixPrimary: 'เพิ่มจุดเริ่ม “ค้นหาบทความ” พร้อมคำอธิบายประเภทฐานข้อมูลตามงานที่ทำ',
      fixSecondary: 'จัดกลุ่มฐานข้อมูลตามสาขาและเพิ่มตัวอย่างการใช้แต่ละกลุ่ม',
      superficial: 'เพิ่มโลโก้ฐานข้อมูลทุกตัวให้ใหญ่และเคลื่อนไหวได้',
      processTrap: 'ให้ผู้ใช้ไปถามบรรณารักษ์ก่อนจึงจะเข้าหน้าค้นหาได้',
      testGood: { success: '86%', time: '1:02', confidence: '87%' },
      testBad: { success: '45%', time: '3:19', confidence: '36%' },
      metricLabel: 'ผู้ใช้ที่เริ่มค้นข้อมูลจากฐานที่เหมาะสม'
    },
    {
      id: 'internship-application',
      service: 'Internship Preparation Portal',
      screenTitle: 'เตรียมสมัครฝึกงาน',
      person: 'ไอซ์ • นักศึกษาปี 2 • เริ่มวางแผนฝึกงานล่วงหน้า',
      goal: 'ส่งความประสงค์ฝึกงานและรู้ว่าต้องเตรียมเอกสารอะไรต่อ',
      quote: 'หน้าเว็บมีข่าว บริษัท เอกสาร และประสบการณ์รุ่นพี่ แต่ไม่รู้ว่าเริ่มขั้นตอนไหนก่อน',
      critical: 'ขั้นตอนเริ่มต้นส่งความประสงค์ถูกกลืนอยู่ในเนื้อหาหลายหมวดและไม่มี checklist ต่อเนื่อง',
      symptomA: 'เมนู “บริษัทแนะนำ” เด่นกว่า “เริ่มส่งความประสงค์ฝึกงาน”',
      symptomB: 'หลังเลือกบริษัท ระบบไม่บอกว่าเอกสารใดต้องเตรียมต่อ',
      impact: 'ผู้ใช้ดูข้อมูลมากแต่ไม่สามารถเริ่มกระบวนการฝึกงานหรือวางแผนงานต่อได้',
      route: 'เริ่มความประสงค์ฝึกงาน > เลือกบริษัท > ดู checklist เอกสาร > ส่งข้อมูล',
      wrongRouteA: 'ประสบการณ์รุ่นพี่ > ดูบทสัมภาษณ์',
      wrongRouteB: 'ข่าวประชาสัมพันธ์ > อ่านประกาศเก่า',
      fixPrimary: 'เพิ่ม CTA “เริ่มความประสงค์ฝึกงาน” พร้อมขั้นตอนและ checklist ที่เห็นต่อเนื่อง',
      fixSecondary: 'แสดงสถานะเอกสารที่ต้องเตรียมและสิ่งที่ทำเสร็จแล้ว',
      superficial: 'เพิ่มวิดีโอแนะนำบริษัทหมุนอัตโนมัติบนหน้าแรก',
      processTrap: 'ให้ผู้ใช้ดาวน์โหลดคู่มือ PDF และทำ checklist ด้วยตนเองนอกระบบ',
      testGood: { success: '89%', time: '0:57', confidence: '90%' },
      testBad: { success: '47%', time: '3:08', confidence: '40%' },
      metricLabel: 'ผู้ใช้ที่เริ่มกระบวนการฝึกงานได้ครบขั้น'
    }
  ];

  const RESULT_UPLIFT = {
    'evidence-triage': { success: 30, time: '−1:18', confidence: 34 },
    'goal-route': { success: 35, time: '−1:31', confidence: 38 },
    'ui-ux-split': { success: 28, time: '−1:06', confidence: 31 },
    'budget-tradeoff': { success: 31, time: '−1:14', confidence: 35 },
    'ab-audit': { success: 33, time: '−1:22', confidence: 36 },
    'test-forecast': { success: 29, time: '−1:10', confidence: 33 }
  };

  function resultFor(context, type) {
    const base = context.testBad;
    const target = context.testGood;
    return {
      label: context.metricLabel,
      before: base,
      after: target,
      takeaway: `${context.fixPrimary} และ ${context.fixSecondary} ทำให้ผู้ใช้เดินจากเป้าหมายไปสู่การทำงานสำเร็จได้ชัดขึ้น`
    };
  }

  function typeSpecificObserve(context, type) {
    const common = {
      title: context.screenTitle,
      service: context.service,
      goal: context.goal,
      quote: context.quote,
      persona: context.person
    };

    if (type === 'evidence-triage') {
      return {
        ...common,
        kind: 'single',
        question: 'หลักฐานใดควรถูกแก้ก่อน เพราะขวาง User Goal โดยตรง?',
        options: [
          { id: 'critical', correct: true, label: context.critical },
          { id: 'noise-1', correct: false, label: `ผู้ใช้เสนอว่าอยากเห็น ${context.service} มีภาพประกอบและสีสันมากขึ้น` },
          { id: 'noise-2', correct: false, label: `มีคำขอให้เพิ่มบทความข่าวสารและคำแนะนำทั่วไปในหน้าแรก` }
        ]
      };
    }

    if (type === 'goal-route') {
      return {
        ...common,
        kind: 'single',
        question: 'เส้นทางใดตอบ User Goal ได้ตรงที่สุด?',
        options: [
          { id: 'correct', correct: true, label: context.route },
          { id: 'noise-1', correct: false, label: context.wrongRouteA },
          { id: 'noise-2', correct: false, label: context.wrongRouteB }
        ]
      };
    }

    if (type === 'ui-ux-split') {
      return {
        ...common,
        kind: 'multi',
        required: 2,
        question: 'เลือก “UI symptom” 2 ข้อ ก่อนแยกให้ชัดว่าอะไรคือผลกระทบ UX',
        options: [
          { id: 'ui-a', correct: true, label: context.symptomA },
          { id: 'ui-b', correct: true, label: context.symptomB },
          { id: 'ux-impact', correct: false, label: context.impact },
          { id: 'solution', correct: false, label: context.fixPrimary }
        ]
      };
    }

    if (type === 'budget-tradeoff') {
      return {
        ...common,
        kind: 'budget',
        budget: 6,
        required: 2,
        question: 'มี Design Energy 6 หน่วย เลือก 2 การแก้ที่ให้ผลต่อ User Goal สูงสุด',
        options: [
          { id: 'primary', correct: true, cost: 3, label: context.fixPrimary },
          { id: 'secondary', correct: true, cost: 3, label: context.fixSecondary },
          { id: 'surface', correct: false, cost: 2, label: context.superficial },
          { id: 'process', correct: false, cost: 3, label: context.processTrap }
        ]
      };
    }

    if (type === 'ab-audit') {
      return {
        ...common,
        kind: 'single',
        question: 'จาก User Goal นี้ แบบใดควรถูกนำไปทดสอบกับผู้ใช้ต่อ?',
        options: [
          { id: 'design-a', correct: false, label: `Design A: ${context.superficial} โดยคงโครงเดิมไว้` },
          { id: 'design-b', correct: true, label: `Design B: ${context.fixPrimary} พร้อม ${context.fixSecondary}` },
          { id: 'design-c', correct: false, label: `Design C: ${context.processTrap}` }
        ]
      };
    }

    return {
      ...common,
      kind: 'single',
      question: 'หลังปรับ UI ตามแนวทางนี้ ผล User Test ใด “น่าจะ” เกิดขึ้นมากที่สุด?',
      options: [
        { id: 'forecast-good', correct: true, label: `${context.metricLabel} เพิ่มขึ้น, เวลาในการทำงานลดลง และความมั่นใจสูงขึ้น` },
        { id: 'forecast-surface', correct: false, label: `คะแนนความสวยงามเพิ่มขึ้น แต่ Task success และเวลาทำงานเท่าเดิม` },
        { id: 'forecast-worse', correct: false, label: `ผู้ใช้ต้องอ่านข้อมูลมากขึ้น จึงใช้เวลานานขึ้นแม้มีฟีเจอร์เพิ่ม` }
      ]
    };
  }

  function diagnosisFor(context, type) {
    const prompts = {
      'evidence-triage': `เหตุใด “${context.critical}” จึงเป็นปัญหาที่ควรแก้ก่อน?`,
      'goal-route': 'เหตุใดเส้นทางที่เลือกจึงเหมาะกับ User Goal มากกว่าเส้นทางอื่น?',
      'ui-ux-split': 'ข้อใดเชื่อม UI symptom ไปสู่ UX impact ได้ถูกต้อง?',
      'budget-tradeoff': 'เหตุใดคู่การแก้ที่เลือกจึงคุ้มค่าในงบจำกัด?',
      'ab-audit': 'เหตุใด Design B จึงเหมาะกว่าการปรับแค่ภาพลักษณ์ของหน้าจอ?',
      'test-forecast': 'เหตุใดผล User Test ที่เลือกจึงสมเหตุผลตามการแก้ UI?'
    };

    const correctText = {
      'evidence-triage': `เพราะมันทำให้ผู้ใช้ไม่สามารถ ${context.goal} ได้อย่างตรงจุด`,
      'goal-route': `เพราะมันพาผู้ใช้เข้าสู่ขั้นที่ต้องทำเพื่อ ${context.goal} โดยไม่พาออกนอกงาน`,
      'ui-ux-split': `${context.symptomA} และ ${context.symptomB} เป็นอาการบน UI ที่นำไปสู่ผลคือ ${context.impact}`,
      'budget-tradeoff': `เพราะ ${context.fixPrimary} แก้จุดเริ่ม/โครงสร้าง ส่วน ${context.fixSecondary} ลดความไม่แน่ใจตอนตัดสินใจ`,
      'ab-audit': `เพราะ Design B ลดอุปสรรคต่อเป้าหมายก่อน ไม่ได้เพิ่มเพียงความสวยงามหรือข้อมูล`,
      'test-forecast': `เพราะการทำให้จุดเริ่ม การกระทำ และผลลัพธ์ชัดขึ้นลดการเดาและการย้อนกลับ`
    };

    return {
      prompt: prompts[type],
      correct: correctText[type],
      options: [
        { id: 'correct', correct: true, text: correctText[type] },
        { id: 'trap-surface', correct: false, text: 'เพราะหน้าจอที่ดูทันสมัยย่อมทำให้ผู้ใช้ใช้งานสำเร็จเสมอ' },
        { id: 'trap-more', correct: false, text: 'เพราะการเพิ่มข้อมูลและตัวเลือกจะทำให้ผู้ใช้มีอิสระมากขึ้นทุกกรณี' }
      ]
    };
  }

  function fixFor(context, type) {
    const choices = {
      'evidence-triage': [context.fixPrimary, context.fixSecondary, context.superficial],
      'goal-route': [context.fixPrimary, context.fixSecondary, context.processTrap],
      'ui-ux-split': [context.fixPrimary, context.fixSecondary, context.superficial],
      'budget-tradeoff': [context.fixPrimary, context.fixSecondary, context.processTrap],
      'ab-audit': [context.fixPrimary, context.fixSecondary, context.superficial],
      'test-forecast': [context.fixPrimary, context.fixSecondary, context.processTrap]
    }[type];

    return {
      prompt: 'เลือก Design Fix หนึ่งข้อที่ควรเริ่มทำก่อนในรอบนี้',
      options: [
        { id: 'fix-primary', correct: true, text: choices[0] },
        { id: 'fix-secondary', correct: false, text: choices[1] },
        { id: 'fix-trap', correct: false, text: choices[2] }
      ]
    };
  }

  function explainFor(context, type) {
    const positiveOne = `ผู้ใช้เข้าใจว่าจะเริ่ม ${context.goal} จากจุดใด`;
    const positiveTwo = `ผู้ใช้คาดเดาผลหลังการกดและตรวจสอบสิ่งที่เลือกได้`;
    const distractorOne = 'ผู้ใช้เห็นองค์ประกอบตกแต่งและข้อมูลทั่วไปมากขึ้น';
    const distractorTwo = 'ผู้ใช้ต้องพึ่งเจ้าหน้าที่เพื่อยืนยันทุกการกระทำ';

    return {
      prompt: `เลือก 2 ผลลัพธ์ที่แสดงว่าการแก้แบบ ${TYPE_META[type].short} ช่วยผู้ใช้จริง`,
      correct: [positiveOne, positiveTwo],
      choices: [positiveOne, positiveTwo, distractorOne, distractorTwo]
    };
  }

  function buildCore(context, type) {
    const id = `${context.id}--${type}`;
    return {
      id,
      coreId: id,
      contextId: context.id,
      service: context.service,
      type,
      typeMeta: TYPE_META[type],
      title: context[type === 'evidence-triage' ? 'critical' : 'goal-route'] ? `${TYPE_META[type].title}: ${context.screenTitle}` : context.screenTitle,
      observe: typeSpecificObserve(context, type),
      diagnosis: diagnosisFor(context, type),
      fix: fixFor(context, type),
      result: resultFor(context, type),
      explain: explainFor(context, type)
    };
  }

  const TYPES = Object.keys(TYPE_META);
  const REPLAY_CORES = CONTEXTS.flatMap((context) => TYPES.map((type) => buildCore(context, type)));

  // Tutorial deliberately uses five different formats and five different contexts.
  const TUTORIAL_IDS = [
    'document-request--goal-route',
    'tuition-payment--evidence-triage',
    'course-registration--ui-ux-split',
    'room-booking--budget-tradeoff',
    'repair-request--ab-audit'
  ];

  const BY_ID = new Map(REPLAY_CORES.map((core) => [core.id, core]));
  const TUTORIAL_CASES = TUTORIAL_IDS.map((id) => clone(BY_ID.get(id))).filter(Boolean).map((item) => ({ ...item, tutorial: true }));

  // 12 rounds × 5 formats = 60 cores exactly once per cycle.
  // Every round uses five different contexts as well as five different formats.
  const BALANCED_REPLAY_SCHEDULE = [
    [['goal-route', 2], ['ui-ux-split', 7], ['budget-tradeoff', 1], ['ab-audit', 9], ['test-forecast', 4]],
    [['evidence-triage', 7], ['ui-ux-split', 3], ['budget-tradeoff', 5], ['ab-audit', 2], ['test-forecast', 9]],
    [['evidence-triage', 0], ['goal-route', 7], ['budget-tradeoff', 2], ['ab-audit', 4], ['test-forecast', 6]],
    [['evidence-triage', 6], ['goal-route', 4], ['ui-ux-split', 0], ['ab-audit', 1], ['test-forecast', 2]],
    [['evidence-triage', 3], ['goal-route', 6], ['ui-ux-split', 2], ['budget-tradeoff', 0], ['test-forecast', 8]],
    [['evidence-triage', 9], ['goal-route', 8], ['ui-ux-split', 1], ['budget-tradeoff', 3], ['ab-audit', 5]],
    [['goal-route', 3], ['ui-ux-split', 8], ['budget-tradeoff', 7], ['ab-audit', 6], ['test-forecast', 1]],
    [['evidence-triage', 8], ['ui-ux-split', 5], ['budget-tradeoff', 9], ['ab-audit', 0], ['test-forecast', 7]],
    [['evidence-triage', 5], ['goal-route', 1], ['budget-tradeoff', 4], ['ab-audit', 3], ['test-forecast', 0]],
    [['evidence-triage', 4], ['goal-route', 9], ['ui-ux-split', 6], ['ab-audit', 7], ['test-forecast', 5]],
    [['evidence-triage', 1], ['goal-route', 5], ['ui-ux-split', 9], ['budget-tradeoff', 8], ['test-forecast', 3]],
    [['evidence-triage', 2], ['goal-route', 0], ['ui-ux-split', 4], ['budget-tradeoff', 6], ['ab-audit', 8]]
  ].map((round) => round.map(([type, contextIndex]) => ({ type, contextId: CONTEXTS[contextIndex].id })));

  window.UXQ_W1_DIVERSITY_V10 = {
    TYPE_META,
    TYPES,
    CONTEXTS,
    REPLAY_CORES,
    TUTORIAL_CASES,
    BALANCED_REPLAY_SCHEDULE,
    getById: (id) => clone(BY_ID.get(id))
  };
})();
