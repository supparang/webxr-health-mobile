// === /sgnal-hunt/js/uxq-w1-data.js ===
// UX Quest • W1 UX Detective
// V6 — 5 tutorial cores + 60 replay cores + 720 meaningful replay scenarios
// CSAI2601 • Year 2 • W1 scope only: UI/UX fundamentals and user-centred thinking

(function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const SKILL_META = {
    'entry-navigation': 'Entry & Navigation',
    'information-label': 'Information Label',
    'cta-action-clarity': 'CTA & Action Clarity',
    'feedback-system-status': 'Feedback & System Status',
    'information-priority': 'Information Priority',
    'confirmation-predictability': 'Confirmation & Predictability'
  };

  const EVIDENCE_VARIANTS = [
    {
      key: 'first-use',
      title: 'USER QUOTE',
      personaSuffix: 'ใช้ระบบครั้งแรก',
      lead: 'ฉันเพิ่งใช้ระบบนี้ครั้งแรกและ'
    },
    {
      key: 'time-pressure',
      title: 'TIME PRESSURE',
      personaSuffix: 'กำลังรีบทำภารกิจให้ทันเวลา',
      lead: 'ฉันกำลังรีบและ'
    },
    {
      key: 'mobile-context',
      title: 'MOBILE CONTEXT',
      personaSuffix: 'กำลังใช้มือถือระหว่างเดินทาง',
      lead: 'ฉันเปิดจากมือถือและ'
    },
    {
      key: 'support-ticket',
      title: 'SUPPORT TICKET',
      personaSuffix: 'รายงานปัญหาผ่านศูนย์ช่วยเหลือ',
      lead: 'ฉันไม่อยากกดผิด เพราะ'
    }
  ];

  const DECISION_VARIANTS = [
    {
      key: 'surface',
      label: 'Surface Trap',
      note: 'มีตัวลวงที่เน้นความสวยงาม แต่ไม่แก้ User Goal'
    },
    {
      key: 'feature',
      label: 'Feature Trap',
      note: 'มีตัวลวงที่เพิ่มฟีเจอร์หรือข้อมูล แต่เพิ่มภาระผู้ใช้'
    },
    {
      key: 'process',
      label: 'Process Trap',
      note: 'มีตัวลวงที่โยนภาระให้ผู้ใช้หรือเจ้าหน้าที่แทนการแก้ UI'
    }
  ];

  const RESULT_SEEDS = [
    { success: 44, time: '2:24', confidence: 39 },
    { success: 48, time: '2:48', confidence: 33 },
    { success: 52, time: '2:06', confidence: 45 },
    { success: 56, time: '1:54', confidence: 48 },
    { success: 46, time: '3:02', confidence: 37 },
    { success: 50, time: '2:18', confidence: 42 }
  ];

  const CONTEXTS = [
    {
      id: 'document-request',
      service: 'Smart Campus Document Request',
      screenTitle: 'แบบฟอร์มขอเอกสาร',
      screenSubtitle: 'เลือกชนิดเอกสาร กรอกข้อมูล และติดตามสถานะคำร้องออนไลน์',
      person: 'พลอย • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มส่งคำร้องขอเอกสาร',
        menuItems: ['ขอเอกสาร', 'บริการทุน', 'แบบฟอร์ม', 'กิจกรรม', 'ติดต่อเจ้าหน้าที่'],
        title: 'เริ่มต้นไม่ถูก'
      },
      label: {
        unclear: 'ดำเนินการ',
        clear: 'ส่งคำร้องขอเอกสาร',
        action: 'ส่งคำร้องขอเอกสาร',
        title: 'ปุ่มไม่บอกผลลัพธ์'
      },
      cta: {
        current: 'ดำเนินการ',
        clear: 'ส่งคำร้องขอเอกสาร',
        action: 'ส่งคำร้องขอเอกสาร',
        title: 'ปุ่มหลักไม่เด่น'
      },
      feedback: {
        action: 'ส่งคำร้องขอเอกสาร',
        nextStep: 'ใช้เลขติดตามเพื่อตรวจสอบสถานะ',
        title: 'ส่งแล้วหรือยัง?'
      },
      priority: {
        urgent: 'กำหนดรับเอกสารที่เลือก',
        secondary: 'ข่าวประชาสัมพันธ์และบริการทั่วไป',
        title: 'ข้อมูลสำคัญถูกกลืนหาย'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกชนิดเอกสาร',
        summary: 'ชนิดเอกสาร จำนวนชุด และวิธีรับเอกสาร',
        finalVerb: 'ส่งคำร้อง',
        confirmLabel: 'ยืนยันการส่งคำร้อง',
        noiseName: 'รายการแบบฟอร์มอื่น',
        noiseDetail: 'เอกสารประกอบและแบบฟอร์มที่ไม่เกี่ยวกับคำร้องนี้',
        title: 'ยืนยันโดยไม่เห็นสรุป'
      }
    },
    {
      id: 'tuition-payment',
      service: 'Tuition Payment Portal',
      screenTitle: 'ชำระค่าธรรมเนียมการศึกษา',
      screenSubtitle: 'ตรวจสอบยอดค้างชำระ เลือกช่องทาง และบันทึกหลักฐานการชำระเงิน',
      person: 'เมย์ • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มชำระค่าธรรมเนียม',
        menuItems: ['ยอดค้างชำระ', 'ใบเสร็จ', 'ผ่อนชำระ', 'ทุนการศึกษา', 'ติดต่อการเงิน'],
        title: 'หาเส้นทางชำระเงินไม่เจอ'
      },
      label: {
        unclear: 'ไปต่อ',
        clear: 'ไปชำระเงิน',
        action: 'เข้าสู่ขั้นตอนชำระเงิน',
        title: 'ไปต่อคือไปไหน?'
      },
      cta: {
        current: 'ต่อไป',
        clear: 'ยืนยันการชำระเงิน',
        action: 'ยืนยันการชำระเงิน',
        title: 'ปุ่มจ่ายเงินไม่ชัด'
      },
      feedback: {
        action: 'ชำระค่าธรรมเนียม',
        nextStep: 'เก็บใบเสร็จและตรวจสอบสถานะการชำระ',
        title: 'ระบบรับชำระแล้วหรือยัง?'
      },
      priority: {
        urgent: 'วันสุดท้ายชำระค่าธรรมเนียม',
        secondary: 'ข่าวกิจกรรมและบทความประชาสัมพันธ์',
        title: 'วันสุดท้ายชำระเงินไม่เด่น'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกยอดเงินและช่องทางชำระ',
        summary: 'ยอดเงิน ค่าธรรมเนียม และช่องทางชำระ',
        finalVerb: 'ชำระ',
        confirmLabel: 'ยืนยันการชำระเงิน',
        noiseName: 'ประวัติใบเสร็จ',
        noiseDetail: 'ข้อมูลการชำระเงินในภาคการศึกษาก่อนหน้า',
        title: 'ยอดชำระไม่ถูกสรุปก่อนจ่าย'
      }
    },
    {
      id: 'course-registration',
      service: 'Course Registration',
      screenTitle: 'ลงทะเบียนรายวิชา',
      screenSubtitle: 'ค้นหารายวิชา ตรวจสอบตารางเรียน และยืนยันการลงทะเบียน',
      person: 'นนท์ • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มลงทะเบียนรายวิชา',
        menuItems: ['ค้นหารายวิชา', 'ตารางเรียน', 'รายวิชาที่เลือก', 'ผลการเรียน', 'คู่มือการลงทะเบียน'],
        title: 'เริ่มลงทะเบียนไม่ถูก'
      },
      label: {
        unclear: 'ทำต่อ',
        clear: 'ยืนยันการลงทะเบียน',
        action: 'ยืนยันการลงทะเบียนรายวิชา',
        title: 'ทำต่อแต่ไม่รู้ทำอะไร'
      },
      cta: {
        current: 'ยืนยัน',
        clear: 'ยืนยันการลงทะเบียน',
        action: 'ยืนยันรายวิชาที่เลือก',
        title: 'ปุ่มยืนยันไม่บอกผล'
      },
      feedback: {
        action: 'ลงทะเบียนรายวิชา',
        nextStep: 'ตรวจสอบตารางเรียนและสถานะรายวิชา',
        title: 'ลงทะเบียนสำเร็จหรือยัง?'
      },
      priority: {
        urgent: 'กำหนดเปิดลงทะเบียนรายวิชา',
        secondary: 'ข่าวประชาสัมพันธ์และคำแนะนำทั่วไป',
        title: 'กำหนดเปิดลงทะเบียนถูกซ่อน'
      },
      confirmation: {
        selectionArea: 'รายการรายวิชาที่เลือก',
        summary: 'รหัสวิชา ชื่อวิชา วันเวลาเรียน และผลต่อหน่วยกิต',
        finalVerb: 'ลงทะเบียน',
        confirmLabel: 'ยืนยันการลงทะเบียน',
        noiseName: 'รายวิชาแนะนำ',
        noiseDetail: 'รายวิชาที่ระบบแนะนำสำหรับภาคเรียนถัดไป',
        title: 'ยืนยันวิชาโดยไม่เห็นสรุป'
      }
    },
    {
      id: 'room-booking',
      service: 'Study Room Booking',
      screenTitle: 'จองห้องอ่านหนังสือ',
      screenSubtitle: 'เลือกห้อง วันที่ และช่วงเวลาสำหรับการทำงานกลุ่ม',
      person: 'มุก • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มจองห้องอ่านหนังสือ',
        menuItems: ['ห้องเดี่ยว', 'ห้องกลุ่ม', 'ตารางว่าง', 'กฎการใช้ห้อง', 'ติดต่อห้องสมุด'],
        title: 'เริ่มจองห้องไม่ถูก'
      },
      label: {
        unclear: 'เลือกต่อ',
        clear: 'ไปเลือกวันและเวลา',
        action: 'เลือกวันและเวลาจองห้อง',
        title: 'เลือกต่อไม่รู้ไปขั้นไหน'
      },
      cta: {
        current: 'เสร็จสิ้น',
        clear: 'ยืนยันการจองห้อง',
        action: 'ยืนยันการจองห้อง',
        title: 'ปุ่มยืนยันการจองไม่เด่น'
      },
      feedback: {
        action: 'จองห้องอ่านหนังสือ',
        nextStep: 'เก็บรหัสการจองและตรวจสอบเวลาที่จอง',
        title: 'จองห้องแล้วหรือยัง?'
      },
      priority: {
        urgent: 'เวลาจองห้องที่ใกล้ที่สุด',
        secondary: 'ข่าวห้องสมุดและกิจกรรมส่งเสริมการอ่าน',
        title: 'เวลาจองถูกวางเป็นข้อมูลรอง'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกวันและเวลา',
        summary: 'ชื่อห้อง วันที่ เวลา และจำนวนผู้ใช้',
        finalVerb: 'จอง',
        confirmLabel: 'ยืนยันการจองห้อง',
        noiseName: 'รายการห้องอ่านหนังสือ',
        noiseDetail: 'ชื่อห้อง ความจุ และอุปกรณ์ในแต่ละห้อง',
        title: 'จองห้องแต่ไม่เห็นสรุป'
      }
    },
    {
      id: 'repair-report',
      service: 'Campus Repair Service',
      screenTitle: 'แจ้งซ่อมอุปกรณ์และห้องเรียน',
      screenSubtitle: 'รายงานปัญหา ติดตามงานซ่อม และติดต่อเจ้าหน้าที่',
      person: 'ต้น • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มแจ้งซ่อมอุปกรณ์',
        menuItems: ['อุปกรณ์ห้องเรียน', 'ระบบไฟฟ้า', 'เครื่องปรับอากาศ', 'ติดตามงานซ่อม', 'ติดต่อช่าง'],
        title: 'แจ้งซ่อมไม่รู้เริ่มตรงไหน'
      },
      label: {
        unclear: 'ส่งเรื่อง',
        clear: 'ส่งคำร้องแจ้งซ่อม',
        action: 'เปิดคำร้องแจ้งซ่อม',
        title: 'ส่งเรื่องไม่ชัดว่าจบหรือยัง'
      },
      cta: {
        current: 'ดำเนินการ',
        clear: 'ส่งแจ้งเหตุเร่งด่วน',
        action: 'ส่งแจ้งเหตุเร่งด่วน',
        title: 'แจ้งเหตุเร่งด่วนแต่ปุ่มเหมือนปุ่มรอง'
      },
      feedback: {
        action: 'แจ้งซ่อมอุปกรณ์',
        nextStep: 'ติดตามเลขงานซ่อมและเวลาที่คาดว่าจะดำเนินการ',
        title: 'แจ้งซ่อมแล้วใครรับเรื่อง?'
      },
      priority: {
        urgent: 'สถานะงานซ่อมอุปกรณ์ที่กำลังใช้งานไม่ได้',
        secondary: 'ข่าวอาคารสถานที่และคู่มือทั่วไป',
        title: 'สถานะงานเร่งด่วนถูกกลืนหาย'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกสถานที่และอุปกรณ์ที่เสีย',
        summary: 'อาคาร ห้อง อุปกรณ์ และระดับความเร่งด่วน',
        finalVerb: 'เปิดคำร้องแจ้งซ่อม',
        confirmLabel: 'ยืนยันการแจ้งซ่อม',
        noiseName: 'คู่มือดูแลอุปกรณ์',
        noiseDetail: 'เอกสารแนะนำการใช้งานอุปกรณ์ทั่วไป',
        title: 'แจ้งซ่อมโดยไม่ตรวจสอบรายละเอียด'
      }
    },
    {
      id: 'activity-registration',
      service: 'Campus Activity Hub',
      screenTitle: 'ลงทะเบียนกิจกรรมมหาวิทยาลัย',
      screenSubtitle: 'ค้นหากิจกรรม สะสมชั่วโมง และตรวจสอบประวัติการเข้าร่วม',
      person: 'เจน • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มลงทะเบียนกิจกรรม',
        menuItems: ['กิจกรรมวันนี้', 'ชมรม', 'ชั่วโมงกิจกรรม', 'ประกาศผล', 'ติดต่อผู้จัด'],
        title: 'สมัครกิจกรรมไม่รู้ทางเข้า'
      },
      label: {
        unclear: 'ยืนยัน',
        clear: 'ยืนยันการสมัครกิจกรรม',
        action: 'สมัครเข้าร่วมกิจกรรม',
        title: 'ยืนยันอะไร?'
      },
      cta: {
        current: 'เสร็จสิ้น',
        clear: 'ลงทะเบียนเข้าร่วมกิจกรรม',
        action: 'ลงทะเบียนกิจกรรม',
        title: 'ปุ่มสมัครกิจกรรมดูไม่ใช่จุดจบ'
      },
      feedback: {
        action: 'สมัครกิจกรรม',
        nextStep: 'ตรวจสอบสถานะการสมัครและรายละเอียดกิจกรรม',
        title: 'สมัครกิจกรรมแล้วมีชื่อหรือไม่?'
      },
      priority: {
        urgent: 'กำหนดปิดรับสมัครกิจกรรม',
        secondary: 'ภาพกิจกรรมเก่าและข่าวชมรมทั่วไป',
        title: 'กำหนดปิดรับสมัครไม่เด่น'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกกิจกรรมและรอบเวลา',
        summary: 'ชื่อกิจกรรม วันที่ รอบเวลา และจำนวนชั่วโมงกิจกรรม',
        finalVerb: 'สมัคร',
        confirmLabel: 'ยืนยันการสมัครกิจกรรม',
        noiseName: 'ประวัติกิจกรรมเดิม',
        noiseDetail: 'กิจกรรมและชั่วโมงที่เคยสะสมในอดีต',
        title: 'สมัครกิจกรรมโดยไม่เห็นข้อมูลสุดท้าย'
      }
    },
    {
      id: 'assignment-submission',
      service: 'Group Project Submission',
      screenTitle: 'ส่งงานกลุ่ม',
      screenSubtitle: 'อัปโหลดไฟล์ ตรวจสอบสมาชิก และยืนยันการส่งงานให้ผู้สอน',
      person: 'ฟ้า • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มส่งงานกลุ่ม',
        menuItems: ['งานที่ต้องส่ง', 'ไฟล์กลุ่ม', 'คะแนน', 'ประกาศรายวิชา', 'ติดต่อผู้สอน'],
        title: 'เริ่มส่งงานกลุ่มไม่ถูก'
      },
      label: {
        unclear: 'บันทึก',
        clear: 'ส่งงานให้ผู้สอน',
        action: 'ส่งไฟล์งานให้ผู้สอน',
        title: 'บันทึกไม่เท่ากับส่งงาน'
      },
      cta: {
        current: 'ยืนยัน',
        clear: 'ส่งงานให้ผู้สอน',
        action: 'ส่งงานกลุ่มให้ผู้สอน',
        title: 'ปุ่มส่งงานไม่ชัด'
      },
      feedback: {
        action: 'ส่งงานกลุ่ม',
        nextStep: 'ตรวจสอบชื่อไฟล์ เวลา และสถานะการส่งงาน',
        title: 'ส่งไฟล์แล้วหรือยัง?'
      },
      priority: {
        urgent: 'กำหนดส่งงานกลุ่มคืนนี้',
        secondary: 'ข้อความแชตและไฟล์ฉบับร่างก่อนหน้า',
        title: 'กำหนดส่งงานกลุ่มไม่เด่น'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกไฟล์งาน',
        summary: 'ชื่อไฟล์ ขนาดไฟล์ เวลาส่ง และสมาชิกกลุ่ม',
        finalVerb: 'ส่งงาน',
        confirmLabel: 'ยืนยันการส่งงาน',
        noiseName: 'ไฟล์เก่าของกลุ่ม',
        noiseDetail: 'เอกสารฉบับร่างและไฟล์ที่อัปโหลดก่อนหน้า',
        title: 'ส่งงานโดยไม่เห็นสรุปไฟล์'
      }
    },
    {
      id: 'advisor-appointment',
      service: 'Advisor Appointment',
      screenTitle: 'นัดหมายอาจารย์ที่ปรึกษา',
      screenSubtitle: 'เลือกวัน เวลา และหัวข้อที่ต้องการเข้าพบอาจารย์',
      person: 'ไนซ์ • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มนัดหมายอาจารย์ที่ปรึกษา',
        menuItems: ['ตารางอาจารย์', 'นัดหมายใหม่', 'ประวัติการนัด', 'คำถามที่พบบ่อย', 'ติดต่อภาควิชา'],
        title: 'นัดอาจารย์ไม่รู้จะเริ่มที่ไหน'
      },
      label: {
        unclear: 'ต่อไป',
        clear: 'ยืนยันเวลานัดหมาย',
        action: 'ยืนยันเวลานัดหมาย',
        title: 'ต่อไปไม่รู้ว่ากำลังยืนยันอะไร'
      },
      cta: {
        current: 'บันทึก',
        clear: 'ยืนยันเวลานัดหมาย',
        action: 'ยืนยันเวลานัดหมาย',
        title: 'ปุ่มนัดหมายไม่เด่น'
      },
      feedback: {
        action: 'นัดหมายอาจารย์ที่ปรึกษา',
        nextStep: 'ตรวจสอบวันเวลาและหัวข้อที่นัดหมาย',
        title: 'นัดแล้วหรือยัง?'
      },
      priority: {
        urgent: 'เวลานัดอาจารย์ที่ใกล้ที่สุด',
        secondary: 'ประกาศภาควิชาและข่าวการศึกษา',
        title: 'เวลานัดถูกซ่อนไว้ท้ายหน้า'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกวันและเวลา',
        summary: 'วัน เวลา อาจารย์ และหัวข้อที่นัดหมาย',
        finalVerb: 'นัดหมาย',
        confirmLabel: 'ยืนยันเวลานัดหมาย',
        noiseName: 'ประวัติการนัด',
        noiseDetail: 'ข้อมูลการเข้าพบอาจารย์ในอดีต',
        title: 'นัดอาจารย์แต่ไม่เห็นสรุปเวลา'
      }
    },
    {
      id: 'library-resources',
      service: 'Library Digital Resources',
      screenTitle: 'ฐานข้อมูลห้องสมุด',
      screenSubtitle: 'ค้นหาบทความ หนังสืออิเล็กทรอนิกส์ และขอความช่วยเหลือจากบรรณารักษ์',
      person: 'ภพ • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มค้นหาบทความวิชาการ',
        menuItems: ['ฐานข้อมูลไทย', 'ฐานข้อมูลต่างประเทศ', 'E-book', 'วารสาร', 'อบรมการค้นข้อมูล'],
        title: 'เข้าใช้ฐานข้อมูลไม่เจอ'
      },
      label: {
        unclear: 'ค้นต่อ',
        clear: 'ค้นหาบทความ',
        action: 'ค้นหาบทความในฐานข้อมูล',
        title: 'ค้นต่อไม่ชัดว่าจะค้นที่ไหน'
      },
      cta: {
        current: 'เริ่มต้น',
        clear: 'ค้นหาบทความ',
        action: 'เริ่มค้นหาบทความ',
        title: 'ปุ่มค้นหาหลักไม่เด่น'
      },
      feedback: {
        action: 'ส่งคำขอรับความช่วยเหลือจากบรรณารักษ์',
        nextStep: 'ตรวจสอบคิวช่วยเหลือและช่องทางตอบกลับ',
        title: 'ส่งคำขอแล้วไม่มีสถานะ'
      },
      priority: {
        urgent: 'กำหนดคืนหนังสือที่ใกล้ที่สุด',
        secondary: 'บทความแนะนำและข่าวกิจกรรมห้องสมุด',
        title: 'วันคืนหนังสือถูกกลืนหาย'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกฐานข้อมูลและคำค้น',
        summary: 'ฐานข้อมูล คำค้น และตัวกรองผลลัพธ์',
        finalVerb: 'เริ่มค้นหา',
        confirmLabel: 'ยืนยันการค้นหา',
        noiseName: 'รายการหนังสือยอดนิยม',
        noiseDetail: 'หนังสือและบทความที่ผู้ใช้อื่นนิยมเปิดอ่าน',
        title: 'ค้นหาข้อมูลโดยไม่เห็นสรุปเงื่อนไข'
      }
    },
    {
      id: 'scholarship-application',
      service: 'Scholarship Portal',
      screenTitle: 'สมัครทุนการศึกษา',
      screenSubtitle: 'ค้นหาทุน เตรียมเอกสาร และติดตามผลการพิจารณา',
      person: 'โม • นักศึกษาปี 2',
      entry: {
        action: 'เริ่มยื่นสมัครทุนการศึกษา',
        menuItems: ['ทุนเรียนดี', 'ทุนกิจกรรม', 'ทุนฉุกเฉิน', 'ประกาศผล', 'ดาวน์โหลดแบบฟอร์ม'],
        title: 'หาเส้นทางสมัครทุนไม่เจอ'
      },
      label: {
        unclear: 'จัดการคำร้อง',
        clear: 'ส่งใบสมัครทุน',
        action: 'ส่งใบสมัครทุนการศึกษา',
        title: 'จัดการคำร้องคืออะไร?'
      },
      cta: {
        current: 'เสร็จสิ้น',
        clear: 'ส่งใบสมัครทุน',
        action: 'ส่งใบสมัครทุนการศึกษา',
        title: 'ปุ่มส่งใบสมัครไม่เด่น'
      },
      feedback: {
        action: 'ส่งใบสมัครทุนการศึกษา',
        nextStep: 'ตรวจสอบสถานะใบสมัครและเอกสารที่ต้องแก้ไข',
        title: 'ส่งใบสมัครแล้วหรือยัง?'
      },
      priority: {
        urgent: 'กำหนดปิดรับสมัครทุน',
        secondary: 'ข่าวกิจกรรมและประสบการณ์ผู้ได้รับทุนเดิม',
        title: 'วันปิดรับสมัครทุนไม่เด่น'
      },
      confirmation: {
        selectionArea: 'ส่วนเลือกทุนและแนบเอกสาร',
        summary: 'ชื่อทุน เอกสารที่แนบ และข้อมูลติดต่อ',
        finalVerb: 'ส่งใบสมัคร',
        confirmLabel: 'ยืนยันการส่งใบสมัคร',
        noiseName: 'ประกาศผลทุนเก่า',
        noiseDetail: 'รายชื่อผู้ได้รับทุนจากปีการศึกษาก่อนหน้า',
        title: 'ส่งใบสมัครโดยไม่เห็นสรุป'
      }
    }
  ];

  const FAMILY_BUILDERS = {
    'entry-navigation': buildEntryCore,
    'information-label': buildLabelCore,
    'cta-action-clarity': buildCtaCore,
    'feedback-system-status': buildFeedbackCore,
    'information-priority': buildPriorityCore,
    'confirmation-predictability': buildConfirmationCore
  };

  function commonCore({ coreId, skill, context, title, goal, quoteStem, target, noise1, noise2, diagnosis, fixes, explain, resultText }) {
    return {
      coreId,
      skill,
      service: context.service,
      title,
      goal,
      quoteStem,
      person: context.person,
      suspectId: 'target',
      screen: {
        heading: context.screenTitle,
        subheading: context.screenSubtitle,
        areas: [
          { id: 'target', name: target.name, detail: target.detail },
          { id: 'noise-1', name: noise1.name, detail: noise1.detail },
          { id: 'noise-2', name: noise2.name, detail: noise2.detail }
        ]
      },
      diagnosis,
      fixes,
      explain,
      resultText
    };
  }

  function buildEntryCore(context) {
    const info = context.entry;

    return commonCore({
      coreId: `core-${context.id}-entry`,
      skill: 'entry-navigation',
      context,
      title: info.title,
      goal: `นักศึกษาต้องการ${info.action}ให้สำเร็จ`,
      quoteStem: `ต้องการ${info.action} แต่ไม่รู้ว่าควรเริ่มจากเมนูไหน`,
      target: {
        name: 'เมนูบริการหลายหมวด',
        detail: info.menuItems
      },
      noise1: {
        name: 'ข่าวและประกาศ',
        detail: 'ข่าวประชาสัมพันธ์ กิจกรรม และกำหนดการทั่วไป'
      },
      noise2: {
        name: 'บัญชีผู้ใช้',
        detail: 'ชื่อผู้ใช้ รหัสนักศึกษา และการตั้งค่าบัญชี'
      },
      diagnosis: {
        prompt: `เหตุใดผู้ใช้จึงเริ่ม${info.action}ได้ยากที่สุด?`,
        principle: 'ผู้ใช้ควรมองเห็นจุดเริ่มต้นของงานสำคัญอย่างชัดเจน',
        correctText: `เมนูมีหลายทางเลือก แต่ยังไม่ชี้ชัดว่าผู้ใช้ควรเริ่ม "${info.action}" จากจุดใด`
      },
      fixes: {
        correctText: `เพิ่มปุ่มเริ่มต้น "${info.action}" ให้เด่นด้านบน และจัดเมนูรองเป็นหมวดบริการ`
      },
      explain: {
        prompt: 'ผลลัพธ์ใดสะท้อนว่า Design Fix นี้ช่วยผู้ใช้ทำเป้าหมายได้ดีขึ้นจริง?',
        correct: [
          'ผู้ใช้เริ่มต้นงานได้เร็วขึ้น',
          `ผู้ใช้หาเส้นทาง "${info.action}" ได้ง่ายขึ้น`
        ]
      },
      resultText: `เมื่อผู้ใช้เห็นจุดเริ่มต้น "${info.action}" ชัดเจน เขาสามารถเริ่มงานได้ทันทีโดยไม่ต้องอ่านทุกเมนู`
    });
  }

  function buildLabelCore(context) {
    const info = context.label;

    return commonCore({
      coreId: `core-${context.id}-label`,
      skill: 'information-label',
      context,
      title: info.title,
      goal: `นักศึกษาต้องการ${info.action}โดยไม่ต้องเดาว่าปุ่มทำอะไร`,
      quoteStem: `เห็นปุ่ม "${info.unclear}" แต่ไม่แน่ใจว่ากดแล้วจะ${info.action}หรือไม่`,
      target: {
        name: `ปุ่ม "${info.unclear}"`,
        detail: `คำบนปุ่มไม่บอกชัดว่าผู้ใช้จะ${info.action}`
      },
      noise1: {
        name: 'ข้อความเงื่อนไข',
        detail: 'รายละเอียด ระเบียบ และข้อกำหนดการใช้บริการ'
      },
      noise2: {
        name: 'ช่องทางติดต่อ',
        detail: 'ข้อมูลติดต่อเจ้าหน้าที่และคำถามที่พบบ่อย'
      },
      diagnosis: {
        prompt: `อะไรทำให้ผู้ใช้ไม่มั่นใจว่าปุ่ม "${info.unclear}" จะทำอะไรต่อ?`,
        principle: 'คำบนปุ่มควรบอกการกระทำและผลลัพธ์ให้เข้าใจได้ทันที',
        correctText: `คำว่า "${info.unclear}" กว้างเกินไป ผู้ใช้จึงคาดเดาไม่ได้ว่ากดแล้วจะ${info.action}`
      },
      fixes: {
        correctText: `เปลี่ยนคำบนปุ่มเป็น "${info.clear}" เพื่อบอกการกระทำแก่ผู้ใช้โดยตรง`
      },
      explain: {
        prompt: 'เหตุใดการตั้งชื่อปุ่มให้ชัดจึงช่วยให้ผู้ใช้ทำงานสำเร็จ?',
        correct: [
          'ผู้ใช้คาดเดาผลลัพธ์หลังการกดได้',
          'ผู้ใช้ตัดสินใจเลือกการกระทำได้มั่นใจขึ้น'
        ]
      },
      resultText: `เมื่อปุ่มบอกชัดว่า "${info.clear}" ผู้ใช้คาดเดาผลลัพธ์ของการกดได้ก่อนตัดสินใจ`
    });
  }

  function buildCtaCore(context) {
    const info = context.cta;

    return commonCore({
      coreId: `core-${context.id}-cta`,
      skill: 'cta-action-clarity',
      context,
      title: info.title,
      goal: `นักศึกษาต้องการ${info.action}หลังทำขั้นตอนก่อนหน้าครบ`,
      quoteStem: `ต้องการ${info.action} แต่ปุ่ม "${info.current}" ดูไม่เหมือนจุดที่ควรกดต่อ`,
      target: {
        name: `ปุ่มหลัก "${info.current}"`,
        detail: 'ปุ่มหลักดูคล้ายปุ่มรอง อยู่ไกลจากงานที่ผู้ใช้กำลังทำ และไม่เด่นพอ'
      },
      noise1: {
        name: 'ข้อความอธิบายบริการ',
        detail: 'คำอธิบายขั้นตอนและข้อมูลทั่วไปของบริการ'
      },
      noise2: {
        name: 'ศูนย์ช่วยเหลือ',
        detail: 'คำถามที่พบบ่อยและช่องทางติดต่อเจ้าหน้าที่'
      },
      diagnosis: {
        prompt: `อะไรทำให้ผู้ใช้ไม่กล้ากด "${info.current}" เพื่อ${info.action}?`,
        principle: 'การกระทำหลักควรเด่น ชัด และสัมพันธ์กับงานที่ผู้ใช้กำลังทำ',
        correctText: `ปุ่มหลักไม่สื่อความหมายและไม่โดดเด่นพอ ผู้ใช้จึงไม่รู้ว่ากดแล้วจะ${info.action}`
      },
      fixes: {
        correctText: `ใช้ปุ่มหลัก "${info.clear}" วางใกล้งานที่ทำ และแยกจากปุ่มรองอย่างชัดเจน`
      },
      explain: {
        prompt: 'ผลลัพธ์ใดบอกว่าปุ่มหลักใหม่ช่วยผู้ใช้ได้จริง?',
        correct: [
          'ผู้ใช้แยกปุ่มหลักกับปุ่มรองได้ง่ายขึ้น',
          `ผู้ใช้เข้าใจว่ากดแล้วจะ${info.action}`
        ]
      },
      resultText: `เมื่อปุ่มหลักเด่นและชื่อปุ่มบอกว่า "${info.clear}" ผู้ใช้กล้าตัดสินใจทำงานต่อมากขึ้น`
    });
  }

  function buildFeedbackCore(context) {
    const info = context.feedback;

    return commonCore({
      coreId: `core-${context.id}-feedback`,
      skill: 'feedback-system-status',
      context,
      title: info.title,
      goal: `นักศึกษาต้องการรู้ว่าระบบรับการ${info.action}แล้วและต้องทำอะไรต่อ`,
      quoteStem: `เพิ่ง${info.action} แต่หน้าจอเงียบจนไม่รู้ว่าระบบรับเรื่องแล้วหรือยัง`,
      target: {
        name: 'หน้าจอหลังผู้ใช้กดส่ง',
        detail: `ไม่มีสถานะกำลังดำเนินการ ไม่มีข้อความยืนยัน และผู้ใช้ไม่รู้ว่าต้อง${info.nextStep}`
      },
      noise1: {
        name: 'พื้นที่แนบข้อมูล',
        detail: 'ช่องสำหรับแนบเอกสารหรือรายละเอียดเพิ่มเติม'
      },
      noise2: {
        name: 'คำถามที่พบบ่อย',
        detail: 'ข้อมูลทั่วไปเกี่ยวกับขั้นตอนและเงื่อนไขบริการ'
      },
      diagnosis: {
        prompt: 'อะไรคือปัญหาหลักที่ทำให้ผู้ใช้ไม่มั่นใจว่าระบบดำเนินการสำเร็จหรือไม่?',
        principle: 'ระบบควรบอกสถานะของการทำงานให้ผู้ใช้เข้าใจได้',
        correctText: 'ระบบไม่แสดงสถานะหรือผลลัพธ์หลังผู้ใช้กดส่ง จึงไม่รู้ว่าควรรอ ทำซ้ำ หรือทำอะไรต่อ'
      },
      fixes: {
        correctText: `แสดงสถานะกำลังดำเนินการ ตามด้วยข้อความยืนยัน พร้อมข้อมูลว่า "${info.nextStep}"`
      },
      explain: {
        prompt: 'หลังเพิ่มสถานะและข้อความยืนยัน ผู้ใช้ได้รับประโยชน์อะไรจริง?',
        correct: [
          'ผู้ใช้รู้ว่าระบบรับคำสั่งแล้ว',
          `ผู้ใช้รู้ว่าต้อง${info.nextStep}`
        ]
      },
      resultText: 'ผู้ใช้เห็นว่าระบบกำลังทำงาน รู้ว่าการกระทำสำเร็จ และรู้ว่าต้องทำอะไรต่อไป'
    });
  }

  function buildPriorityCore(context) {
    const info = context.priority;

    return commonCore({
      coreId: `core-${context.id}-priority`,
      skill: 'information-priority',
      context,
      title: info.title,
      goal: `นักศึกษาต้องการเห็น${info.urgent}ก่อนตัดสินใจทำงาน`,
      quoteStem: `ต้องการเห็น${info.urgent} แต่ข้อมูลสำคัญกลับอยู่ล่างสุดของหน้า`,
      target: {
        name: info.urgent,
        detail: `ข้อมูลสำคัญถูกวางไว้ท้ายหน้า หลัง${info.secondary}`
      },
      noise1: {
        name: 'การ์ดโปรไฟล์ผู้ใช้',
        detail: 'ชื่อ รูปโปรไฟล์ และข้อความต้อนรับผู้ใช้'
      },
      noise2: {
        name: 'ข่าวชุมชนและกิจกรรม',
        detail: 'ข่าวประชาสัมพันธ์และข้อความจากผู้ใช้คนอื่น'
      },
      diagnosis: {
        prompt: `เหตุใดผู้ใช้จึงพลาด "${info.urgent}" แม้ข้อมูลอยู่ในหน้าเดียวกัน?`,
        principle: 'ข้อมูลที่สำคัญต่อเป้าหมายผู้ใช้ต้องถูกจัดลำดับให้มองเห็นก่อน',
        correctText: 'ข้อมูลที่ผู้ใช้ต้องใช้เร่งด่วนถูกวางไว้เป็นเรื่องรอง จึงไม่เด่นเมื่อเทียบกับข้อมูลสำคัญน้อยกว่า'
      },
      fixes: {
        correctText: `ย้าย "${info.urgent}" ขึ้นส่วนบนของหน้า และแยกเป็นข้อมูลเร่งด่วนที่ผู้ใช้เห็นทันที`
      },
      explain: {
        prompt: 'การจัดลำดับข้อมูลใหม่ช่วยผู้ใช้ตามเป้าหมายอย่างไร?',
        correct: [
          'ผู้ใช้เห็นงานที่ต้องทำก่อนเรื่องรอง',
          'ผู้ใช้ตัดสินใจจัดการงานสำคัญได้เร็วขึ้น'
        ]
      },
      resultText: 'เมื่อข้อมูลเร่งด่วนปรากฏก่อน ผู้ใช้สามารถตัดสินใจและทำงานสำคัญได้ทันเวลา'
    });
  }

  function buildConfirmationCore(context) {
    const info = context.confirmation;

    return commonCore({
      coreId: `core-${context.id}-confirmation`,
      skill: 'confirmation-predictability',
      context,
      title: info.title,
      goal: `นักศึกษาต้องการตรวจสอบข้อมูลก่อน${info.finalVerb}ให้ถูกต้อง`,
      quoteStem: `กำลังจะ${info.finalVerb} แต่ไม่แน่ใจว่าระบบจะทำรายการตามข้อมูลที่เลือกจริงหรือไม่`,
      target: {
        name: info.selectionArea,
        detail: `ผู้ใช้เลือกข้อมูลแล้ว แต่ระบบยังไม่สรุปว่า "${info.summary}" ก่อนยืนยัน`
      },
      noise1: {
        name: info.noiseName,
        detail: info.noiseDetail
      },
      noise2: {
        name: 'ข้อมูลติดต่อเจ้าหน้าที่',
        detail: 'เบอร์โทร อีเมล และเวลาทำการ'
      },
      diagnosis: {
        prompt: `อะไรทำให้ผู้ใช้ไม่มั่นใจว่าจะ${info.finalVerb}ได้ถูกต้อง?`,
        principle: 'ก่อนยืนยันงานสำคัญ ระบบควรทำให้ผู้ใช้เห็นสิ่งที่จะเกิดขึ้นอย่างชัดเจน',
        correctText: `ระบบยังไม่สรุป "${info.summary}" ให้ผู้ใช้ตรวจสอบก่อนยืนยัน`
      },
      fixes: {
        correctText: `เพิ่ม Summary ก่อนยืนยัน เพื่อให้ผู้ใช้ตรวจสอบ "${info.summary}" แล้วค่อยกด "${info.confirmLabel}"`
      },
      explain: {
        prompt: 'เหตุใด Summary ก่อนยืนยันจึงช่วยให้ผู้ใช้ทำงานสำเร็จมากขึ้น?',
        correct: [
          'ผู้ใช้ตรวจสอบรายละเอียดสำคัญก่อนยืนยันได้',
          `ผู้ใช้รู้ว่าระบบกำลังจะ${info.finalVerb}อะไรให้ตนเอง`
        ]
      },
      resultText: 'ผู้ใช้ตรวจสอบสิ่งที่เลือกได้ก่อนยืนยัน จึงลดความผิดพลาดและมั่นใจว่าการทำรายการถูกต้อง'
    });
  }

  function distractorPack(skill, variantKey) {
    const packs = {
      'entry-navigation': {
        surface: {
          diagnosis: ['หน้าเว็บควรมีสีมากขึ้นเพื่อดึงดูดสายตา', 'ผู้ใช้ควรอ่านข่าวประชาสัมพันธ์ก่อนเริ่มทุกครั้ง'],
          fixes: ['เพิ่ม Banner หลายภาพในหน้าแรก', 'เพิ่มเอฟเฟกต์เคลื่อนไหวให้ทุกเมนู'],
          explain: ['หน้าเว็บดูมีสีสันขึ้น', 'ผู้ใช้เห็นภาพประชาสัมพันธ์มากขึ้น']
        },
        feature: {
          diagnosis: ['มีบริการไม่มากพอจึงทำให้ผู้ใช้สับสน', 'ผู้ใช้ควรได้เห็นทุกเมนูพร้อมกันเสมอ'],
          fixes: ['เพิ่มเมนูทุกหน่วยงานลงในหน้าแรก', 'เพิ่มรายการบริการที่คล้ายกันให้เลือกมากขึ้น'],
          explain: ['ผู้ใช้มีเมนูให้เลือกมากกว่าเดิม', 'หน้าแรกมีข้อมูลครบทุกเรื่อง']
        },
        process: {
          diagnosis: ['ผู้ใช้ควรติดต่อเจ้าหน้าที่ก่อนเริ่มใช้ระบบ', 'ผู้ใช้ควรจำขั้นตอนจากคู่มือด้วยตนเอง'],
          fixes: ['ให้ผู้ใช้โทรสอบถามก่อนเริ่มทุกครั้ง', 'บังคับให้ผู้ใช้เปิดคู่มือยาวก่อนเข้าสู่บริการ'],
          explain: ['ผู้ใช้ต้องพึ่งเจ้าหน้าที่มากขึ้น', 'ผู้ใช้ใช้เวลาอ่านคู่มือนานขึ้น']
        }
      },
      'information-label': {
        surface: {
          diagnosis: ['ปุ่มควรมีสีสดขึ้นเพื่อให้ดูสวยกว่าเดิม', 'หน้าจอควรใช้ไอคอนมากกว่าข้อความ'],
          fixes: ['ตัดคำบนปุ่มออกและใช้ไอคอนอย่างเดียว', 'เปลี่ยนพื้นหลังปุ่มให้มีไล่สีมากขึ้น'],
          explain: ['ปุ่มมีสีสันมากขึ้น', 'หน้าเว็บดูทันสมัยขึ้น']
        },
        feature: {
          diagnosis: ['ผู้ใช้ควรมีปุ่มหลายปุ่มเพื่อเลือกเอง', 'ปุ่มควรใส่ข้อความทุกขั้นตอนพร้อมกัน'],
          fixes: ['เพิ่มปุ่มย่อยหลายปุ่มที่ความหมายใกล้กัน', 'ใส่ข้อความบนปุ่มยาวมากเพื่อครอบคลุมทุกกรณี'],
          explain: ['ผู้ใช้เห็นปุ่มจำนวนมากขึ้น', 'ผู้ใช้มีคำให้เลือกมากขึ้น']
        },
        process: {
          diagnosis: ['ผู้ใช้ควรเรียนรู้ศัพท์ของระบบก่อนใช้งาน', 'ควรให้เจ้าหน้าที่อธิบายปุ่มทุกครั้ง'],
          fixes: ['บังคับให้ผู้ใช้ดูวิดีโอคู่มือก่อนกดปุ่ม', 'ย้ายคำอธิบายปุ่มไปอยู่ในคู่มือภายนอก'],
          explain: ['ผู้ใช้ต้องจำศัพท์ของระบบมากขึ้น', 'ผู้ใช้ใช้เวลาเปิดคู่มือมากขึ้น']
        }
      },
      'cta-action-clarity': {
        surface: {
          diagnosis: ['ปุ่มหลักยังไม่เด่นเพราะไม่มีภาพประกอบ', 'หน้าจอควรตกแต่งปุ่มทั้งหมดให้เหมือนกัน'],
          fixes: ['ทำให้ทุกปุ่มมีสีเดียวกันและขนาดเท่ากัน', 'เพิ่มแอนิเมชันให้ทุกปุ่มเคลื่อนไหวพร้อมกัน'],
          explain: ['ปุ่มทุกปุ่มดูสนุกขึ้น', 'หน้าจอมีการเคลื่อนไหวมากขึ้น']
        },
        feature: {
          diagnosis: ['ผู้ใช้ควรเห็นปุ่มทุกขั้นตอนพร้อมกัน', 'ควรเพิ่มตัวเลือกการกระทำให้มากขึ้น'],
          fixes: ['เพิ่มปุ่ม ยืนยัน ดำเนินการ บันทึก ต่อไป พร้อมกัน', 'เพิ่มเมนูทางลัดหลายตำแหน่งในหน้าเดียว'],
          explain: ['ผู้ใช้มีตัวเลือกการกดมากขึ้น', 'ผู้ใช้เห็นปุ่มหลากหลายขึ้น']
        },
        process: {
          diagnosis: ['ผู้ใช้ควรถามเจ้าหน้าที่ก่อนกดปุ่มสำคัญ', 'ผู้ใช้ควรทดลองกดทุกปุ่มเพื่อเรียนรู้'],
          fixes: ['ให้ผู้ใช้โทรยืนยันกับเจ้าหน้าที่ก่อนดำเนินการ', 'ซ่อนปุ่มหลักไว้จนผู้ใช้ผ่านแบบทดสอบคู่มือ'],
          explain: ['ผู้ใช้ต้องรอความช่วยเหลือเพิ่มขึ้น', 'ผู้ใช้ทำงานได้ช้าลง']
        }
      },
      'feedback-system-status': {
        surface: {
          diagnosis: ['หน้าจอเงียบเพราะยังไม่มีภาพหรือแอนิเมชันสวยพอ', 'ควรใช้สีพื้นหลังใหม่หลังผู้ใช้กดส่ง'],
          fixes: ['เปลี่ยนพื้นหลังหน้าเว็บเป็นสีใหม่ทันทีหลังส่ง', 'แสดง Pop-up เคลื่อนไหวแต่ไม่บอกสถานะ'],
          explain: ['ผู้ใช้เห็นแอนิเมชันมากขึ้น', 'หน้าเว็บมีสีหลังส่ง']
        },
        feature: {
          diagnosis: ['ควรเพิ่มเมนูบริการมากขึ้นหลังส่ง', 'ควรเพิ่มข่าวประชาสัมพันธ์ในหน้าสำเร็จ'],
          fixes: ['แสดงรายการบริการทั้งหมดหลังผู้ใช้กดส่ง', 'เพิ่มกล่องข่าวหลายกล่องแทนสถานะงาน'],
          explain: ['ผู้ใช้เห็นข้อมูลทั่วไปมากขึ้น', 'หน้าเว็บมีเนื้อหามากขึ้น']
        },
        process: {
          diagnosis: ['ผู้ใช้ควรโทรถามเจ้าหน้าที่ว่าส่งสำเร็จหรือไม่', 'ผู้ใช้ควรลองกดส่งซ้ำเพื่อความมั่นใจ'],
          fixes: ['ให้ผู้ใช้ติดต่อเจ้าหน้าที่ทุกครั้งหลังส่ง', 'ซ่อนผลลัพธ์แล้วส่งให้เจ้าหน้าที่ตรวจสอบแทน'],
          explain: ['ผู้ใช้ต้องพึ่งเจ้าหน้าที่มากขึ้น', 'ผู้ใช้ต้องรอนานขึ้น']
        }
      },
      'information-priority': {
        surface: {
          diagnosis: ['ข้อมูลไม่เด่นเพราะการ์ดไม่ได้ตกแต่งมากพอ', 'ควรเพิ่มภาพประกอบให้ข่าวทุกชิ้น'],
          fixes: ['เพิ่มภาพและพื้นหลังตกแต่งให้ข้อมูลรอง', 'ทำให้ทุกการ์ดมีขนาดใหญ่เท่ากัน'],
          explain: ['หน้าจอมีภาพประกอบมากขึ้น', 'ทุกส่วนดูเด่นเท่ากัน']
        },
        feature: {
          diagnosis: ['ผู้ใช้ควรได้เห็นข้อมูลทุกประเภทพร้อมกัน', 'ควรเพิ่มข่าวและการ์ดข้อมูลในส่วนบน'],
          fixes: ['เพิ่มข่าวประชาสัมพันธ์หลายรายการไว้ด้านบน', 'เพิ่มการ์ดข้อมูลรองให้มากขึ้นในหน้าแรก'],
          explain: ['ผู้ใช้เห็นข่าวมากขึ้น', 'หน้าแรกมีข้อมูลครบทุกเรื่อง']
        },
        process: {
          diagnosis: ['ผู้ใช้ควรจำกำหนดการเองจากปฏิทินส่วนตัว', 'เจ้าหน้าที่ควรโทรแจ้งกำหนดทุกคน'],
          fixes: ['ย้ายข้อมูลสำคัญไปอยู่ในเอกสาร PDF แยก', 'ให้ผู้ใช้โทรสอบถามกำหนดจากเจ้าหน้าที่'],
          explain: ['ผู้ใช้ต้องค้นหาข้อมูลจากภายนอก', 'ผู้ใช้ต้องพึ่งเจ้าหน้าที่มากขึ้น']
        }
      },
      'confirmation-predictability': {
        surface: {
          diagnosis: ['หน้าสรุปไม่สวยพอจึงทำให้ผู้ใช้ลังเล', 'ควรเพิ่มรูปภาพก่อนกดยืนยัน'],
          fixes: ['เพิ่ม Banner ขนาดใหญ่เหนือปุ่มยืนยัน', 'เพิ่มภาพตกแต่งโดยไม่สรุปข้อมูลที่เลือก'],
          explain: ['หน้าจอมีภาพมากขึ้น', 'ปุ่มมีเอฟเฟกต์สวยขึ้น']
        },
        feature: {
          diagnosis: ['ผู้ใช้ควรได้เห็นตัวเลือกเพิ่มขึ้นก่อนยืนยัน', 'ควรเพิ่มรายการที่เกี่ยวข้องหลายรายการ'],
          fixes: ['เพิ่มตัวเลือกใหม่อีกหลายตัวในหน้ายืนยัน', 'เพิ่มรายการแนะนำจนผลสรุปถูกเลื่อนลง'],
          explain: ['ผู้ใช้เห็นรายการมากขึ้น', 'หน้าจอมีทางเลือกเพิ่มขึ้น']
        },
        process: {
          diagnosis: ['ผู้ใช้ควรจำข้อมูลที่เลือกเองก่อนกดยืนยัน', 'เจ้าหน้าที่ควรตรวจสอบแทนทุกครั้ง'],
          fixes: ['บังคับให้ผู้ใช้โทรยืนยันกับเจ้าหน้าที่ก่อนกด', 'ไม่แสดงข้อมูลสรุปแต่ให้ผู้ใช้ดาวน์โหลดคู่มือ'],
          explain: ['ผู้ใช้ต้องจำรายละเอียดเอง', 'ผู้ใช้ต้องพึ่งเจ้าหน้าที่มากขึ้น']
        }
      }
    };

    return packs[skill][variantKey];
  }

  function buildEvidence(core, evidenceVariant) {
    const sentence = core.quoteStem.replace(/[.。]$/, '');

    const text = evidenceVariant.key === 'support-ticket'
      ? `Ticket จากผู้ใช้: "${evidenceVariant.lead}${sentence}"`
      : `"${evidenceVariant.lead}${sentence}"`;

    return {
      title: evidenceVariant.title,
      text,
      persona: `${core.person} • ${evidenceVariant.personaSuffix}`
    };
  }

  function metricsFor(coreIndex, evidenceIndex, decisionIndex) {
    const seed = RESULT_SEEDS[(coreIndex + evidenceIndex) % RESULT_SEEDS.length];
    const beforeSuccess = Math.max(35, seed.success - (decisionIndex * 2));
    const beforeConfidence = Math.max(28, seed.confidence - (evidenceIndex * 2));
    const afterSuccess = Math.min(94, beforeSuccess + 40 + evidenceIndex);
    const afterConfidence = Math.min(94, beforeConfidence + 43 + decisionIndex);

    return {
      before: {
        success: beforeSuccess,
        time: seed.time,
        confidence: beforeConfidence
      },
      after: {
        success: afterSuccess,
        time: ['0:48', '0:54', '0:58', '0:44', '1:02', '0:51'][(coreIndex + decisionIndex) % 6],
        confidence: afterConfidence
      }
    };
  }

  function materializeScenario(core, evidenceIndex, decisionIndex, coreIndex) {
    const evidenceVariant = EVIDENCE_VARIANTS[evidenceIndex];
    const decisionVariant = DECISION_VARIANTS[decisionIndex];
    const distractors = distractorPack(core.skill, decisionVariant.key);
    const evidence = buildEvidence(core, evidenceVariant);

    return {
      id: `${core.coreId}--${evidenceVariant.key}--${decisionVariant.key}`,
      coreId: core.coreId,
      scenarioKey: `${evidenceVariant.key}:${decisionVariant.key}`,
      isTutorial: false,
      skill: core.skill,
      skillLabel: SKILL_META[core.skill],
      service: core.service,
      title: core.title,
      goal: core.goal,
      evidence,
      quote: evidence.text,
      persona: evidence.persona,
      suspectId: core.suspectId,
      screen: clone(core.screen),
      diagnosis: {
        prompt: core.diagnosis.prompt,
        principle: core.diagnosis.principle,
        options: [
          { id: 'diagnosis-correct', correct: true, text: core.diagnosis.correctText },
          { id: `diagnosis-${decisionVariant.key}-1`, correct: false, text: distractors.diagnosis[0] },
          { id: `diagnosis-${decisionVariant.key}-2`, correct: false, text: distractors.diagnosis[1] }
        ]
      },
      fixes: [
        { id: 'fix-correct', correct: true, text: core.fixes.correctText },
        { id: `fix-${decisionVariant.key}-1`, correct: false, text: distractors.fixes[0] },
        { id: `fix-${decisionVariant.key}-2`, correct: false, text: distractors.fixes[1] }
      ],
      result: {
        text: core.resultText,
        ...metricsFor(coreIndex, evidenceIndex, decisionIndex)
      },
      explain: {
        prompt: core.explain.prompt,
        choices: [
          ...core.explain.correct,
          ...distractors.explain
        ],
        correct: [...core.explain.correct]
      }
    };
  }

  const REPLAY_CORE_CASES = CONTEXTS.flatMap((context) =>
    Object.entries(FAMILY_BUILDERS).map(([skill, builder]) => builder(context, skill))
  );

  const TUTORIAL_CORE_SPECS = [
    ['entry-navigation', 'document-request'],
    ['cta-action-clarity', 'room-booking'],
    ['feedback-system-status', 'assignment-submission'],
    ['information-priority', 'scholarship-application'],
    ['confirmation-predictability', 'advisor-appointment']
  ];

  const CONTEXT_BY_ID = new Map(CONTEXTS.map((context) => [context.id, context]));

  const TUTORIAL_CASES = TUTORIAL_CORE_SPECS.map(([skill, contextId], index) => {
    const core = FAMILY_BUILDERS[skill](CONTEXT_BY_ID.get(contextId));
    const scenario = materializeScenario(core, 0, 0, index);

    return {
      ...scenario,
      id: `tutorial-${index + 1}-${scenario.id}`,
      coreId: `tutorial-${index + 1}-${core.coreId}`,
      isTutorial: true,
      title: `Tutorial: ${scenario.title}`
    };
  });

  const REPLAY_SCENARIOS = REPLAY_CORE_CASES.flatMap((core, coreIndex) =>
    EVIDENCE_VARIANTS.flatMap((_, evidenceIndex) =>
      DECISION_VARIANTS.map((_, decisionIndex) =>
        materializeScenario(core, evidenceIndex, decisionIndex, coreIndex)
      )
    )
  );

  window.UXQ_W1_SKILL_META = SKILL_META;
  window.UXQ_W1_TUTORIAL_CASES = TUTORIAL_CASES;
  window.UXQ_W1_REPLAY_CORE_CASES = REPLAY_CORE_CASES.map((core) => ({
    coreId: core.coreId,
    skill: core.skill,
    service: core.service,
    title: core.title
  }));
  window.UXQ_W1_REPLAY_SCENARIOS = REPLAY_SCENARIOS;
  window.UXQ_W1_CASE_BANK = [
    ...TUTORIAL_CASES,
    ...REPLAY_SCENARIOS
  ];

  // Backward-compatible globals for older scripts.
  window.UXQ_W1_FIRST_RUN = TUTORIAL_CASES;
  window.UXQ_W1_CASES = TUTORIAL_CASES;
})();
