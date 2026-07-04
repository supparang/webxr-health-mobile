/* UX Quest • W1 Week 1 Alignment v2
 * Loads before uxq-mission-engine-v3.js on W1 only.
 * CSAI2601 Week 1: UI/UX & Front-end Design.
 * Anti-guess revision: scenario-based near-miss distractors, paired evidence checks,
 * randomized answer positions and an upgraded core case bank.
 */
(() => {
  'use strict';

  if (!/w1-ux-crisis-casefile\.html/i.test(location.pathname)) return;

  const SCAN_KEY = 'uxq.w1.first-impression.v2';
  const MINI_STEPS = [2, 4, 6];
  const completedMini = new Set();
  let current;
  let bypassStart = false;
  let bypassNext = false;
  let observerStarted = false;

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const shuffle = (items) => {
    const next = Array.from(items || []);
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const STAGE_LABELS = {
    evidence: {
      label: '01 • First Impression Evidence',
      instruction: 'เริ่มจาก Task และพฤติกรรมจริง: ผู้ใช้ทำอะไร เห็นอะไร และติดตรงไหน ไม่ใช่จากความชอบของทีม'
    },
    hypothesis: {
      label: '02 • UX Impact',
      instruction: 'เชื่อมหลักฐานกับ friction ที่ผู้ใช้พบ เช่น ไม่เห็นสถานะ ไม่รู้ขั้นถัดไป หรือไม่มั่นใจว่าทำสำเร็จ'
    },
    fix: {
      label: '03 • UI/UX Fix',
      instruction: 'เลือกการแก้ที่ทำให้ hierarchy, feedback หรือ next step ชัดขึ้นและช่วยให้ task สำเร็จ'
    },
    test: {
      label: '04 • Task Success Test',
      instruction: 'วัด task success, เวลา, ความผิดพลาด และความมั่นใจของผู้ใช้ ไม่ใช่ถามเพียงว่าสวยหรือไม่'
    }
  };

  const START_SCAN = [
    {
      id: 'queue-confirmation',
      context: 'ระบบจองคิวคลินิกแสดงข้อความ “ระบบได้รับคำขอแล้ว” ไว้ท้ายหน้า หลังเลือกคิวพบว่า 7 จาก 10 คนย้อนกลับไปเปิดฟอร์มเดิม และ 4 คนถามเจ้าหน้าที่ว่าจองสำเร็จหรือยัง',
      prompt: 'ก่อนออกแบบใหม่ ทีมควรตั้งสมมติฐานใดเป็นลำดับแรก?',
      options: [
        { label: 'ผู้ใช้อาจไม่เห็นสถานะยืนยันที่รวมวัน เวลา สถานที่ และ action ถัดไป จึงไม่มั่นใจว่า task จบแล้ว', correct: true },
        { label: 'ผู้ใช้อาจต้องการเปรียบเทียบช่วงเวลานัดหลายแบบมากกว่าที่หน้าจอให้ไว้', correct: false },
        { label: 'ข้อความนโยบายการยกเลิกอาจยาวเกินไป จนผู้ใช้ไม่กล้ากดยืนยัน', correct: false },
        { label: 'ชื่อคลินิกอาจไม่ตรงกับคำที่ผู้ใช้ใช้เรียกบริการ จึงหาเมนูต่อไม่พบ', correct: false }
      ],
      evidencePrompt: 'หลักฐานเพิ่มข้อใดจะช่วยยืนยันสมมติฐานนี้ได้ดีที่สุด?',
      evidenceOptions: [
        { label: 'ผู้ใช้ส่งคำขอแล้วรอครู่หนึ่ง จากนั้นกดกลับไปที่ฟอร์มเดิมโดยไม่ได้เลื่อนลงไปเห็นข้อมูลสรุป', correct: true },
        { label: 'ผู้ใช้บอกว่าอยากให้มีไอคอนประกอบข้อความยืนยันมากขึ้น', correct: false },
        { label: 'ทีมงานต้องการใช้สีของคณะกับทุกปุ่มในหน้าเดียวกัน', correct: false },
        { label: 'ผู้ใช้บางคนเลือกช่วงเวลานัดในตอนเช้ามากกว่าตอนบ่าย', correct: false }
      ],
      feedback: 'ต้องแยก “ปัญหาเลือกเวลา” ออกจาก “ไม่มั่นใจว่ายืนยันสำเร็จแล้ว” โดยตามดูจังหวะหลังผู้ใช้กดส่งและสิ่งที่เขาพยายามทำต่อ'
    },
    {
      id: 'appointment-hierarchy',
      context: 'หน้าสรุปนัดมีการ์ดนโยบายยกเลิก การ์ดวันและเวลานัด ปุ่มเปลี่ยนคิว ปุ่มยกเลิก และปุ่มเพิ่มปฏิทินที่เด่นเท่ากัน ผู้ใช้ 3 คนเดินทางผิดวัน',
      prompt: 'หากต้องแก้เพียงจุดเดียวก่อน วิธีใดมีโอกาสลดความผิดพลาดของ task มากที่สุด?',
      options: [
        { label: 'ทำวัน เวลา สถานที่ และสถานะนัดเป็นข้อมูลหลักของหน้า แล้วลดน้ำหนักปุ่มเปลี่ยน/ยกเลิกให้เป็น action รอง', correct: true },
        { label: 'ทำปุ่มเพิ่มลงปฏิทินให้เด่นที่สุด เพราะผู้ใช้ทุกคนควรบันทึกนัดทันที', correct: false },
        { label: 'ย้ายการ์ดนโยบายไว้ด้านบนสุด เพื่อให้ผู้ใช้เห็นข้อกำหนดก่อนข้อมูลอื่น', correct: false },
        { label: 'รักษาขนาดและสีของทุกปุ่มให้เท่ากัน เพื่อไม่ให้ผู้ใช้กดผิดปุ่มใดปุ่มหนึ่ง', correct: false }
      ],
      evidencePrompt: 'ข้อสังเกตใดสนับสนุนว่า hierarchy คือคอขวดหลัก?',
      evidenceOptions: [
        { label: 'ผู้ใช้เห็นข้อความนโยบายและปุ่ม action ก่อน แต่หยุดค้นหาวันนัดหรือสับสนระหว่างคิวใหม่กับคิวเดิม', correct: true },
        { label: 'ผู้ใช้บอกว่าชอบสีพื้นหลังของหน้าสรุปมากกว่าหน้าเลือกคิว', correct: false },
        { label: 'ผู้ใช้บางคนชอบใช้ปฏิทินของโทรศัพท์มากกว่าปฏิทินบนเว็บ', correct: false },
        { label: 'ทีมงานมีรูปแบบไอคอนหลากหลายในหน้าบริการอื่น', correct: false }
      ],
      feedback: 'เมื่อผู้ใช้ทำ action ผิดเพราะข้อมูลตัดสินใจถูกกลบ ปัญหาไม่ใช่แค่ “ตัวอักษรเล็ก” แต่เป็นลำดับความสำคัญของข้อมูลและ action ทั้งหน้า'
    },
    {
      id: 'submission-state',
      context: 'ในระบบส่งเอกสาร ผู้ใช้กด Submit แล้ววงล้อโหลดหายไป แต่หน้าจอยังดูเหมือนฉบับร่างเดิม ผู้ใช้หลายคนกด Submit ซ้ำ 2–3 ครั้ง และไม่แน่ใจว่าไฟล์ใดถูกส่งแล้ว',
      prompt: 'แนวทางใดออกแบบ feedback/state ได้ครบที่สุดสำหรับจังหวะนี้?',
      options: [
        { label: 'แสดงสถานะส่งสำเร็จแบบคงอยู่ พร้อมรายการไฟล์ที่รับแล้ว เลขอ้างอิง และ next step เฉพาะกรณีที่ยังมีงานค้าง', correct: true },
        { label: 'ล็อกปุ่ม Submit ไว้ 5 วินาทีและแสดง toast สั้น ๆ ว่า “กำลังดำเนินการ”', correct: false },
        { label: 'พาผู้ใช้กลับหน้าแรกทันทีหลังส่ง เพื่อลดโอกาสที่ผู้ใช้จะกดซ้ำ', correct: false },
        { label: 'ส่งอีเมลสรุปภายหลัง โดยให้หน้าจอเดิมคงไว้เพื่อลดการเปลี่ยนแปลง UI', correct: false }
      ],
      evidencePrompt: 'พฤติกรรมใดทำให้ทีมควรให้ความสำคัญกับ state หลังส่งมากกว่าการเพิ่มคำอธิบายก่อนส่ง?',
      evidenceOptions: [
        { label: 'หลังวงล้อหาย ผู้ใช้สลับไปดูหน้าประวัติ กลับมาหน้าเดิม และกด Submit ซ้ำโดยไม่แก้ข้อมูล', correct: true },
        { label: 'ผู้ใช้ใช้เวลาอ่านคำแนะนำการแนบไฟล์ก่อนกดส่งต่างกันเล็กน้อย', correct: false },
        { label: 'ผู้ใช้บางคนเลือกถ่ายเอกสารเป็นไฟล์ PDF ขนาดใหญ่', correct: false },
        { label: 'ทีมมีแผนเปลี่ยนฟอนต์ของระบบในภาคการศึกษาหน้า', correct: false }
      ],
      feedback: 'หลักฐานที่สำคัญอยู่หลัง action: ผู้ใช้กำลังพยายามตรวจสอบ state เดิม ไม่ได้กำลังขาดคำอธิบายก่อนเริ่ม task'
    },
    {
      id: 'payment-confidence',
      context: 'ระบบชำระค่ากิจกรรมพาผู้ใช้กลับจากธนาคารมาที่ข้อความ “กำลังตรวจสอบ” โดยไม่มีเลขอ้างอิงหรือเวลาประมาณการ เหลือเวลาเพียง 20 นาทีก่อนหมดเขต และนักศึกษาหลายคนโทรถามว่าควรโอนซ้ำหรือไม่',
      prompt: 'ประสบการณ์แบบใดควรเป็นเป้าหมายของหน้ากลับจากธนาคาร?',
      options: [
        { label: 'ผู้ใช้แยกได้ว่ารายการอยู่สถานะใด เห็นเลขอ้างอิงและเวลาคาดการณ์ รู้ว่าควรรอหรือทำ action ใดต่อโดยไม่เสี่ยงจ่ายซ้ำ', correct: true },
        { label: 'ผู้ใช้กลับสู่ dashboard ให้เร็วที่สุด แม้ยังไม่เห็นรายละเอียดสถานะ เพื่อให้หน้าจอดูสะอาด', correct: false },
        { label: 'ผู้ใช้เห็นภาพเคลื่อนไหวยืนยันเด่นชัดก่อน แล้วค่อยแสดงข้อมูลรายการเมื่อเขาเปิดดูเอง', correct: false },
        { label: 'ผู้ใช้ได้รับข้อความทั่วไปว่าระบบกำลังดำเนินการ โดยไม่ต้องบอกเวลาเพื่อหลีกเลี่ยงความคาดหวัง', correct: false }
      ],
      evidencePrompt: 'ข้อมูลใดบอกว่าปัญหาหลักคือ confidence/recovery ไม่ใช่เพียงความเร็วของระบบ?',
      evidenceOptions: [
        { label: 'ผู้ใช้ถ่ายภาพหน้าจอไว้ โทรถามว่าต้องโอนซ้ำไหม และกลับเข้าระบบหลายครั้งทั้งที่ยังไม่มี error แจ้ง', correct: true },
        { label: 'ผู้ใช้บางคนใช้เครือข่ายมือถือแทน Wi-Fi ระหว่างชำระเงิน', correct: false },
        { label: 'ผู้ใช้ให้คะแนนความสวยของสีปุ่มแตกต่างกัน', correct: false },
        { label: 'ผู้ใช้ส่วนใหญ่เริ่มชำระเงินในช่วงเวลาใกล้กำหนดส่ง', correct: false }
      ],
      feedback: 'เมื่อผู้ใช้ไม่รู้ว่าควรรอ แก้ หรือทำซ้ำ เขาต้องการ state ที่ตรวจสอบได้และทางออกที่ปลอดภัย ไม่ใช่เพียงหน้าจอที่เร็วหรือสวยขึ้น'
    }
  ];

  const MINI_CHECKS = {
    2: [
      {
        id: 'date-hierarchy',
        context: 'วันและเวลานัดถูกวางเป็นข้อความรองใต้บัตรนโยบายและปุ่ม action ที่เด่นเท่ากัน ผู้ใช้มาผิดวันแม้ระบบบันทึกนัดถูกต้อง',
        prompt: 'ทีมควรบันทึก diagnosis ใน UX Audit อย่างไร?',
        options: [
          { label: 'เป็น UI hierarchy issue ที่สร้าง UX impact เพราะข้อมูลตัดสินใจถูกกลบจนผู้ใช้ทำ action ตามข้อมูลผิด', correct: true },
          { label: 'เป็น UX issue ล้วน ๆ เพราะตราบใดที่ข้อมูลมีอยู่ style ของข้อความไม่ส่งผลต่อผลลัพธ์', correct: false },
          { label: 'เป็น content issue จึงควรเพิ่มคำอธิบายการนัดหมายยาวขึ้นก่อนปรับ layout', correct: false },
          { label: 'เป็น visual consistency issue จึงควรทำการ์ดทุกส่วนให้มีขนาดและน้ำหนักเท่ากัน', correct: false }
        ],
        evidencePrompt: 'ข้อสังเกตใดทำให้ diagnosis นี้น่าเชื่อถือที่สุด?',
        evidenceOptions: [
          { label: 'ผู้ใช้เลื่อนผ่านข้อมูลนัดที่ไม่เด่น แล้วตัดสินใจจากปุ่ม action หรือข้อความรองที่เห็นก่อน', correct: true },
          { label: 'ผู้ใช้ขอให้เปลี่ยนภาพไอคอนปฏิทินเป็นแบบอื่น', correct: false },
          { label: 'ผู้ใช้บางคนชอบจัดเก็บนัดในสมุดส่วนตัว', correct: false },
          { label: 'ทีมใช้ card component หลายรูปแบบในหน้าที่ไม่เกี่ยวข้อง', correct: false }
        ],
        feedback: 'UI คือระดับองค์ประกอบและลำดับการมองเห็น แต่ต้องวิเคราะห์ผลกระทบที่เกิดกับ task ของผู้ใช้ด้วย จึงจะเป็น UX diagnosis ที่ครบ'
      },
      {
        id: 'status-hierarchy',
        context: 'หน้าติดตามคำร้องแสดง “กำลังดำเนินการ”, “รอเจ้าหน้าที่” และ “ต้องส่งข้อมูลเพิ่ม” ด้วยสีและตำแหน่งใกล้เคียงกัน ผู้ใช้บางคนส่งคำร้องใหม่แทนที่จะตอบข้อมูลเดิม',
        prompt: 'ข้อใดอธิบายปัญหาได้แม่นที่สุด?',
        options: [
          { label: 'state ของคำร้องไม่ถูกจัดลำดับตาม action ที่ผู้ใช้ต้องทำ จึงเกิด UX friction แม้ข้อความสถานะจะมีอยู่ครบ', correct: true },
          { label: 'จำนวนสถานะมากเกินไปเสมอ จึงควรยุบเหลือเพียง “สำเร็จ” และ “ไม่สำเร็จ”', correct: false },
          { label: 'ผู้ใช้ควรได้รับคู่มือคำย่อของสถานะก่อนเริ่มติดตามคำร้อง', correct: false },
          { label: 'ควรเพิ่มปุ่ม “ส่งคำร้องใหม่” ให้เด่นกว่าเดิมเพื่อให้ผู้ใช้ไม่ลังเล', correct: false }
        ],
        evidencePrompt: 'หลักฐานใดชี้ว่าปัญหาเกิดที่ hierarchy ของ state?',
        evidenceOptions: [
          { label: 'ผู้ใช้เปิดคำร้องเดิมแต่ไม่เห็นว่าต้องแนบข้อมูลเพิ่ม จึงกดสร้างคำร้องใหม่ทั้งที่ประเภทปัญหาเดิม', correct: true },
          { label: 'ผู้ใช้บางคนใช้คำว่า “เรื่อง” แทนคำว่า “คำร้อง” ระหว่างสนทนา', correct: false },
          { label: 'ผู้ใช้บอกว่าต้องการเปลี่ยนรูปไอคอนสถานะให้ทันสมัย', correct: false },
          { label: 'เจ้าหน้าที่อยากให้หน้า dashboard มีสีตามหน่วยงาน', correct: false }
        ],
        feedback: 'เมื่อ state มีผลต่อ action ถัดไป ระบบต้องทำให้ผู้ใช้เห็น “ตอนนี้อยู่ขั้นไหน และฉันต้องทำอะไร” ไม่ใช่เพียงแสดงชื่อสถานะทั้งหมด'
      }
    ],
    4: [
      {
        id: 'form-feedback',
        context: 'ผู้ใช้ส่งฟอร์มแล้ว แต่หน้าเดิมยังแสดงปุ่ม Submit และไม่มีรายการสิ่งที่ถูกบันทึก ผู้ใช้กดซ้ำเพราะกลัวข้อมูลหาย',
        prompt: 'วิธีแก้ใดตรงกับ UX problem มากที่สุด?',
        options: [
          { label: 'ออกแบบ feedback/state หลังส่งให้บอกสิ่งที่บันทึก เลขอ้างอิง และ action ถัดไป รวมทั้งทางกู้คืนเมื่อส่งไม่สมบูรณ์', correct: true },
          { label: 'เพิ่ม tooltip อธิบายความหมายของทุกช่องในฟอร์มก่อนผู้ใช้เริ่มกรอก', correct: false },
          { label: 'เพิ่มหน้า FAQ เพื่อให้ผู้ใช้ค้นหาว่าการส่งสำเร็จหรือไม่ภายหลัง', correct: false },
          { label: 'บังคับให้ผู้ใช้รอ 10 วินาทีก่อนกด Submit อีกครั้ง โดยไม่เปลี่ยนหน้าสรุป', correct: false }
        ],
        evidencePrompt: 'อะไรเป็นหลักฐานที่ควรใช้เลือกวิธีแก้นี้?',
        evidenceOptions: [
          { label: 'หลังส่ง ผู้ใช้กลับไปตรวจข้อมูลเดิมและกด Submit ซ้ำ ทั้งที่ไม่ได้แก้ไขช่องใดเลย', correct: true },
          { label: 'ผู้ใช้บอกว่าอยากให้ form ใช้ font ที่อ่านง่ายขึ้น', correct: false },
          { label: 'ผู้ใช้บางคนกรอกแบบฟอร์มช้ากว่าเพราะใช้มือถือหน้าจอเล็ก', correct: false },
          { label: 'ทีมสังเกตว่า FAQ มีจำนวนหน้าอ่านน้อยกว่าที่คาด', correct: false }
        ],
        feedback: 'จุดติดขัดเกิดหลัง action สำคัญ จึงต้องแก้ด้วย state และ recovery ที่ผู้ใช้มองเห็นในจังหวะนั้น ไม่ใช่เพิ่มเนื้อหาก่อนเริ่ม task'
      },
      {
        id: 'upload-feedback',
        context: 'ระบบอัปโหลดเอกสารรับไฟล์ได้ทีละไฟล์ แต่เมื่อไฟล์หนึ่งล้มเหลว หน้าจอยังมีรายการครบเหมือนเดิม ผู้ใช้ไม่รู้ว่าไฟล์ใดต้องอัปโหลดใหม่',
        prompt: 'ข้อใดเป็น UX response ที่ดีที่สุด?',
        options: [
          { label: 'แสดงสถานะรายไฟล์อย่างชัดเจน พร้อมเหตุผลที่ล้มเหลวและ action เฉพาะไฟล์ที่ต้องแก้หรืออัปโหลดใหม่', correct: true },
          { label: 'ซ่อนรายการไฟล์ที่อัปโหลดไม่สำเร็จ เพื่อให้หน้าจอดูสะอาดและผู้ใช้เริ่มใหม่ง่ายขึ้น', correct: false },
          { label: 'อนุญาตให้ผู้ใช้อัปโหลดทุกไฟล์ใหม่ทั้งหมดโดยไม่บอกว่าไฟล์ใดมีปัญหา', correct: false },
          { label: 'เพิ่มภาพเคลื่อนไหวระหว่างอัปโหลด เพื่อให้ผู้ใช้รู้สึกว่าระบบกำลังทำงาน', correct: false }
        ],
        evidencePrompt: 'หลักฐานใดชี้ว่าควรออกแบบระดับรายไฟล์?',
        evidenceOptions: [
          { label: 'ผู้ใช้เปิดรายการไฟล์ซ้ำและลองอัปโหลดใหม่แบบสุ่ม เพราะไม่สามารถระบุไฟล์ที่ล้มเหลวได้', correct: true },
          { label: 'ผู้ใช้มีขนาดไฟล์เอกสารแตกต่างกันระหว่างกลุ่มวิชา', correct: false },
          { label: 'ผู้ใช้บางคนชอบลากไฟล์ลงในพื้นที่อัปโหลดมากกว่ากดเลือกไฟล์', correct: false },
          { label: 'ทีมงานต้องการลดจำนวนสีที่ใช้ในหน้าอัปโหลด', correct: false }
        ],
        feedback: 'feedback ที่ดีไม่ใช่แค่บอกว่า “มีข้อผิดพลาด” แต่ต้องผูก state กับองค์ประกอบที่ผู้ใช้ต้องแก้ เพื่อให้ recovery ทำได้โดยไม่เดา'
      }
    ],
    6: [
      {
        id: 'primary-action',
        context: 'หน้าจอการจองมีปุ่ม “ยืนยันการจอง”, “ย้อนกลับ”, “บันทึกเป็นร่าง” และ “ยกเลิก” ขนาดและสีเท่ากัน ผู้ใช้เลือกย้อนกลับโดยไม่ตั้งใจและคิดว่าการจองหาย',
        prompt: 'แนวทางใดใช้หลัก UI และ UX ร่วมกันได้เหมาะที่สุด?',
        options: [
          { label: 'ทำ action หลักตามบริบทให้เด่น แยก destructive action ให้ห่างและมีการยืนยัน พร้อม feedback เมื่อผู้ใช้บันทึกหรือย้อนกลับ', correct: true },
          { label: 'ทำทุกปุ่มเป็น primary style เพื่อให้ผู้ใช้เห็นทุกทางเลือกพร้อมกัน', correct: false },
          { label: 'ซ่อนปุ่มย้อนกลับและยกเลิกทั้งหมด เพื่อให้ผู้ใช้ต้องยืนยันการจองเท่านั้น', correct: false },
          { label: 'เพิ่มข้อความอธิบายยาวก่อนปุ่มทุกปุ่ม โดยไม่เปลี่ยนลำดับหรือ state', correct: false }
        ],
        evidencePrompt: 'ข้อใดเป็นข้อมูลที่ทีมควรดูเพื่อยืนยันว่า action hierarchy คือปัญหา?',
        evidenceOptions: [
          { label: 'ผู้ใช้ลังเลระหว่างปุ่มที่หน้าตาเหมือนกัน กด action ผิด แล้วไม่เข้าใจว่า state ของการจองเปลี่ยนหรือไม่', correct: true },
          { label: 'ผู้ใช้บอกว่าชอบสีของปุ่มยืนยันน้อยกว่าสีของปุ่มย้อนกลับ', correct: false },
          { label: 'ทีมมี guideline ว่าทุกปุ่มต้องใช้ component เดียวกันเสมอ', correct: false },
          { label: 'ผู้ใช้บางคนทำการจองจากแท็บเล็ตแทนมือถือ', correct: false }
        ],
        feedback: 'Hierarchy ที่ดีไม่ใช่การลบทางเลือก แต่คือการทำให้ action สำคัญในจังหวะนั้นเด่น และปกป้อง user จาก action ที่ย้อนกลับยาก'
      },
      {
        id: 'schedule-action',
        context: 'หน้าตารางกิจกรรมทำให้ปุ่ม “ดูรายละเอียด”, “เช็กอิน”, “ยกเลิก”, และ “เพิ่มลงปฏิทิน” เด่นเท่ากัน ผู้เข้าร่วมบางคนไม่เช็กอินแม้ยืนอยู่หน้าห้องแล้ว',
        prompt: 'ข้อใดควรเป็นการปรับลำดับแรก?',
        options: [
          { label: 'ใช้บริบทเวลาและสถานที่ทำให้ “เช็กอินตอนนี้” เด่นเมื่อผู้ใช้อยู่ในช่วงเช็กอิน แล้วลด action ที่ไม่เกี่ยวกับจังหวะปัจจุบัน', correct: true },
          { label: 'ทำให้ปุ่มเพิ่มลงปฏิทินเด่นขึ้น เพราะช่วยให้ผู้ใช้วางแผนล่วงหน้าได้ดี', correct: false },
          { label: 'แสดง action ทั้งหมดด้วยสีเดียวกันเพื่อรักษาความสม่ำเสมอของ UI', correct: false },
          { label: 'ย้ายปุ่มเช็กอินไปไว้ในเมนูรายละเอียด เพื่อให้หน้าตารางสะอาดขึ้น', correct: false }
        ],
        evidencePrompt: 'หลักฐานใดสนับสนุนว่าระบบไม่ตอบ context ปัจจุบันของ user?',
        evidenceOptions: [
          { label: 'ผู้ใช้เปิดตารางขณะอยู่หน้าห้อง แต่ใช้เวลาค้นหาปุ่มเช็กอินและกดดูรายละเอียดก่อนทั้งที่ไม่ต้องการข้อมูลเพิ่ม', correct: true },
          { label: 'ผู้ใช้บางคนเพิ่มกิจกรรมลงปฏิทินล่วงหน้าหลายวัน', correct: false },
          { label: 'ผู้ใช้ให้คะแนนภาพประกอบในหน้าตารางต่างกัน', correct: false },
          { label: 'ทีมมีข่าวประชาสัมพันธ์หลายรายการในช่วงสัปดาห์นั้น', correct: false }
        ],
        feedback: 'Action ที่เหมาะไม่ใช่ action เด่นตลอดเวลา แต่เป็น action ที่เด่นเมื่อสอดคล้องกับ goal และ context ของผู้ใช้ในขณะนั้น'
      }
    ]
  };

  function addStyle(){
    if (document.getElementById('uxq-w1-alignment-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w1-alignment-style';
    style.textContent = `
      .uxq-w1-lens{margin:2px 0 4px;padding:15px;border-radius:17px;border:1px solid rgba(110,231,255,.36);background:linear-gradient(140deg,rgba(110,231,255,.10),rgba(155,140,255,.10));display:grid;gap:9px}
      .uxq-w1-lens__head{display:flex;gap:9px;align-items:center}.uxq-w1-lens__head strong{font-size:.96rem}.uxq-w1-lens__head span{font-size:.74rem;letter-spacing:.09em;font-weight:900;color:var(--uxq-accent);text-transform:uppercase}
      .uxq-w1-lens__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.uxq-w1-lens__grid div{padding:10px 11px;border-radius:12px;background:rgba(6,18,40,.35);border:1px solid rgba(181,205,255,.15)}.uxq-w1-lens__grid b{display:block;color:#fff;font-size:.85rem;margin-bottom:4px}.uxq-w1-lens__grid span{display:block;color:var(--uxq-muted);font-size:.78rem;line-height:1.45}
      .uxq-w1-stage-lens{margin:13px 0 0;padding:10px 12px;border-left:3px solid var(--uxq-accent);border-radius:0 12px 12px 0;background:rgba(110,231,255,.08);color:#dcecff;font-size:.86rem;line-height:1.5}.uxq-w1-stage-lens b{color:var(--uxq-accent)}
      .uxq-w1-coach{width:min(760px,100%);text-align:left;border:1px solid rgba(155,140,255,.48);border-radius:16px;padding:15px 16px;background:rgba(155,140,255,.10);display:grid;gap:8px}.uxq-w1-coach__kicker{font-size:.73rem;font-weight:900;letter-spacing:.1em;color:#c7bbff;text-transform:uppercase}.uxq-w1-coach h3{margin:0;font-size:1rem}.uxq-w1-coach p{margin:0;color:#dbe7ff;line-height:1.58}.uxq-w1-coach ul{margin:0;padding-left:20px;color:#dbe7ff;line-height:1.6;font-size:.9rem}
      .uxq-w1-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(2,9,24,.80);backdrop-filter:blur(8px)}.uxq-w1-modal__panel{width:min(790px,100%);max-height:min(92vh,900px);overflow:auto;border:1px solid rgba(110,231,255,.42);border-radius:22px;padding:clamp(18px,4vw,30px);background:linear-gradient(155deg,#132b56,#08152f);box-shadow:0 25px 70px rgba(0,0,0,.48)}.uxq-w1-modal__kicker{margin:0 0 8px;color:var(--uxq-accent);font-weight:900;font-size:.75rem;letter-spacing:.11em;text-transform:uppercase}.uxq-w1-modal h2{margin:0;font-size:clamp(1.35rem,3vw,2rem);line-height:1.12}.uxq-w1-modal__lede{margin:9px 0 0;color:var(--uxq-muted);line-height:1.62}.uxq-w1-case{margin:18px 0;padding:14px;border:1px solid rgba(155,140,255,.34);border-radius:16px;background:rgba(9,25,55,.38)}.uxq-w1-case__context{margin:0;color:#d9e6ff;line-height:1.58;font-size:.9rem}.uxq-w1-check{margin:13px 0 0;padding:14px;border:1px solid var(--uxq-line);background:rgba(4,14,32,.36);border-radius:15px}.uxq-w1-check legend{padding:0 4px;color:#fff;font-weight:800;line-height:1.45}.uxq-w1-check label{display:block;margin-top:9px;padding:10px 11px;border:1px solid rgba(181,205,255,.18);border-radius:11px;color:#dce8ff;cursor:pointer;line-height:1.45}.uxq-w1-check label:has(input:checked){border-color:rgba(110,231,255,.75);background:rgba(110,231,255,.10)}.uxq-w1-check input{margin-right:8px;accent-color:#6ee7ff}.uxq-w1-modal__error{margin:12px 0 0;color:#ffb0bb;font-weight:750}.uxq-w1-modal__result{margin-top:16px;padding:14px;border-radius:14px;border:1px solid rgba(119,233,164,.48);background:rgba(39,112,77,.16);color:#e4ffec;line-height:1.6}.uxq-w1-modal__result b{color:#a9f2bf}.uxq-w1-modal__actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      @media(max-width:760px){.uxq-w1-lens__grid{grid-template-columns:1fr}.uxq-w1-modal{padding:10px}.uxq-w1-modal__panel{border-radius:18px;padding:18px}.uxq-w1-check label{font-size:.92rem}.uxq-w1-case{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function safeStore(value){
    try { localStorage.setItem(SCAN_KEY, JSON.stringify(value)); return; } catch (error) {}
    try { sessionStorage.setItem(SCAN_KEY, JSON.stringify(value)); } catch (error) {}
  }

  function scanSummary(){
    try { return JSON.parse(localStorage.getItem(SCAN_KEY) || sessionStorage.getItem(SCAN_KEY) || 'null'); }
    catch (error) { return null; }
  }

  function optionGroup(name, prompt, options){
    return `<fieldset class="uxq-w1-check"><legend>${esc(prompt)}</legend>${shuffle(options).map((option, index) => `<label><input type="radio" name="${esc(name)}" value="${index}" data-correct="${option.correct ? '1' : '0'}">${esc(option.label)}</label>`).join('')}</fieldset>`;
  }

  function pairGroup(question, prefix){
    return `<section class="uxq-w1-case"><p class="uxq-w1-case__context">${esc(question.context)}</p>${optionGroup(`${prefix}_decision`, question.prompt, question.options)}${optionGroup(`${prefix}_evidence`, question.evidencePrompt, question.evidenceOptions)}</section>`;
  }

  function readPair(question, prefix, root){
    const decision = root.querySelector(`input[name="${prefix}_decision"]:checked`);
    const evidence = root.querySelector(`input[name="${prefix}_evidence"]:checked`);
    return { question, decision, evidence, complete:Boolean(decision && evidence), correct:Boolean(decision && evidence && decision.dataset.correct === '1' && evidence.dataset.correct === '1') };
  }

  function removeModal(){ document.querySelector('.uxq-w1-modal')?.remove(); }

  function openStartScan(){
    if (document.querySelector('.uxq-w1-modal')) return;
    addStyle();
    const cases = shuffle(START_SCAN).slice(0, 3);
    const modal = document.createElement('section');
    modal.className = 'uxq-w1-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'First Impression Scan');
    modal.innerHTML = `<div class="uxq-w1-modal__panel"><p class="uxq-w1-modal__kicker">Before the mission • Week 1</p><h2>First Impression Scan: Diagnose + Evidence</h2><p class="uxq-w1-modal__lede">นี่ไม่ใช่ข้อสอบท่องจำ เลือกทั้ง diagnosis ที่ “ดีที่สุด” และหลักฐานที่จะยืนยัน diagnosis นั้นให้ได้ จึงจะเริ่มคดี UX Detective ได้</p><form id="uxqW1ScanForm">${cases.map((item) => pairGroup(item, item.id)).join('')}<p class="uxq-w1-modal__error" id="uxqW1ScanError" hidden>เลือก Diagnosis และ Evidence ให้ครบทุกคดีก่อนตรวจคำตอบ</p><div class="uxq-w1-modal__actions"><button class="uxq-btn" type="submit">ตรวจ UX Lens <span aria-hidden="true">→</span></button><button class="uxq-btn uxq-btn--ghost" id="uxqW1ScanCancel" type="button">กลับไปอ่าน Briefing</button></div></form></div>`;
    document.body.appendChild(modal);
    document.getElementById('uxqW1ScanCancel')?.addEventListener('click', removeModal);
    document.getElementById('uxqW1ScanForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const answers = cases.map((item) => readPair(item, item.id, modal));
      const error = modal.querySelector('#uxqW1ScanError');
      if (answers.some((answer) => !answer.complete)) { error.hidden = false; return; }
      const score = answers.reduce((sum, answer) => sum + (answer.decision.dataset.correct === '1' ? 1 : 0) + (answer.evidence.dataset.correct === '1' ? 1 : 0), 0);
      const total = cases.length * 2;
      safeStore({ completedAt:new Date().toISOString(), score, total, caseIds:cases.map((item) => item.id) });
      const feedback = answers.filter((answer) => !answer.correct).map((answer) => `<li>${esc(answer.question.feedback)}</li>`);
      modal.querySelector('.uxq-w1-modal__panel').innerHTML = `<p class="uxq-w1-modal__kicker">Lens calibration complete</p><h2>คุณเชื่อม Diagnosis กับ Evidence ได้ ${score}/${total} จุด</h2><div class="uxq-w1-modal__result"><b>ใช้กติกานี้ระหว่างเล่น:</b><br>อย่าเลือกคำตอบที่ “ฟังดี” อย่างเดียว ให้ถามเสมอว่า <em>หลักฐานใดสนับสนุน และทางเลือกอื่นยังอธิบายพฤติกรรมได้หรือไม่</em>${feedback.length ? `<ul>${feedback.join('')}</ul>` : '<br>ดีมาก: คุณแยก diagnosis ออกจากหลักฐานยืนยันได้ครบในชุดคดีนี้'}</div><div class="uxq-w1-modal__actions"><button id="uxqW1StartAfterScan" class="uxq-btn" type="button">เริ่มคดี UX Detective <span aria-hidden="true">→</span></button></div>`;
      document.getElementById('uxqW1StartAfterScan')?.addEventListener('click', () => {
        removeModal();
        bypassStart = true;
        document.getElementById('uxqStart')?.click();
      });
    });
  }

  function currentQuestionNo(){
    const meter = document.querySelector('.uxq-hud .uxq-meter b');
    const matched = String(meter?.textContent || '').match(/(\d+)\s*\//);
    return matched ? Number(matched[1]) : 0;
  }

  function openMiniCheck(step){
    const mini = shuffle(MINI_CHECKS[step] || [])[0];
    if (!mini || document.querySelector('.uxq-w1-modal')) return;
    addStyle();
    const modal = document.createElement('section');
    modal.className = 'uxq-w1-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'UI หรือ UX Mini Check');
    const prefix = `mini${step}_${mini.id}`;
    modal.innerHTML = `<div class="uxq-w1-modal__panel"><p class="uxq-w1-modal__kicker">UI / UX Decision Checkpoint ${step}</p><h2>ตัดสินใจ + ยืนยันด้วยหลักฐาน</h2><p class="uxq-w1-modal__lede">อย่าเลือกเพียงคำที่ดูถูกต้อง เลือก diagnosis และหลักฐานที่ทำให้ diagnosis นั้นเป็นคำตอบที่ดีที่สุด</p><form id="uxqW1MiniForm">${pairGroup(mini, prefix)}<p class="uxq-w1-modal__error" id="uxqW1MiniError" hidden>เลือก Diagnosis และ Evidence ให้ครบก่อนดำเนินต่อ</p><div class="uxq-w1-modal__actions"><button class="uxq-btn" type="submit">ตรวจเหตุผล <span aria-hidden="true">→</span></button></div></form></div>`;
    document.body.appendChild(modal);
    document.getElementById('uxqW1MiniForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const answer = readPair(mini, prefix, modal);
      if (!answer.complete) { modal.querySelector('#uxqW1MiniError').hidden = false; return; }
      modal.querySelector('.uxq-w1-modal__panel').innerHTML = `<p class="uxq-w1-modal__kicker">Checkpoint feedback</p><h2>${answer.correct ? '✓ Diagnosis และ Evidence เชื่อมกัน' : '↺ คำตอบยังไม่อธิบายพฤติกรรมผู้ใช้ครบ'}</h2><div class="uxq-w1-modal__result"><b>เหตุผล:</b> ${esc(mini.feedback)}<br><br><b>ข้อจำ:</b> UI problem ต้องถูกอธิบายต่อให้ถึง UX impact และ Evidence ที่ยืนยันว่า user ทำ task ผิดพลาดหรือไม่มั่นใจจริง</div><div class="uxq-w1-modal__actions"><button id="uxqW1ContinueAfterMini" class="uxq-btn" type="button">กลับไปเก็บหลักฐานต่อ <span aria-hidden="true">→</span></button></div>`;
      document.getElementById('uxqW1ContinueAfterMini')?.addEventListener('click', () => {
        removeModal();
        bypassNext = true;
        document.getElementById('uxqNext')?.click();
      });
    });
  }

  function antiGuessOptions(stageKey, data){
    const service = String(data.service || 'ระบบนี้');
    const user = String(data.user || 'ผู้ใช้');
    const options = {
      evidence: [
        { label:`เปรียบเทียบ completion rate ของ ${service} ตามอุปกรณ์ โดยไม่ตามดูว่าผู้ใช้หยุดหรือย้อนกลับตรงใด`, description:'ได้ภาพรวมเชิงปริมาณ แต่ยังไม่เห็นกลไกที่ทำให้ task ล้มเหลว', rationale:'ช่วยบอกขนาดของปัญหาได้ แต่ไม่ชี้ต้นตอของพฤติกรรมในคดีนี้' },
        { label:`ถาม ${user} หลังจบงานว่าหน้าจอดูน่าเชื่อถือหรือไม่ โดยไม่ให้เล่าย้อนลำดับการตัดสินใจ`, description:'เก็บความรู้สึกหลังใช้', rationale:'ความรู้สึกมีประโยชน์ แต่ไม่แทนพฤติกรรมและจุดที่ผู้ใช้ทำ task ผิดพลาดจริง' },
        { label:'ดู heatmap การแตะรวมของหน้า เพื่อหาจุดยอดนิยม โดยไม่แยกผู้ใช้ที่ทำ task สำเร็จออกจากผู้ใช้ที่หลงทาง', description:'เห็นการกระจายการแตะ แต่ไม่มีบริบทของ goal', rationale:'การแตะเยอะอาจหมายถึงสนใจหรือสับสน จึงต้องเชื่อมกับ task และผลลัพธ์' }
      ],
      hypothesis: [
        { label:'ผู้ใช้อาจต้องการทางลัดไปหน้าประวัติหรือเมนูที่ใช้บ่อยกว่าเดิม', description:'เป็นแนวคิดที่เป็นไปได้ แต่ยังไม่อธิบายหลักฐานของคดีโดยตรง', rationale:'อาจช่วยบางคน แต่ยังไม่ใช่สาเหตุที่ evidence สนับสนุนมากที่สุด' },
        { label:'คำศัพท์ในระบบอาจไม่คุ้น จึงควรเปลี่ยนเป็นภาษาที่เป็นมิตรกว่า', description:'เป็นสมมติฐานด้านภาษา', rationale:'ต้องมี evidence ว่าผู้ใช้ตีความคำผิด ไม่ใช่เพียงเห็นว่ามีการย้อนกลับหรือกดซ้ำ' },
        { label:'ผู้ใช้อาจต้องการข้อมูลเปรียบเทียบมากขึ้นก่อนตัดสินใจ', description:'เป็นสมมติฐานด้านข้อมูลก่อน action', rationale:'หากคดีเกิดหลัง action หรือ state ไม่ชัด การเพิ่มข้อมูลก่อนตัดสินใจอาจไม่แก้ต้นเหตุ' }
      ],
      fix: [
        { label:'เพิ่ม microcopy อธิบายใต้ทุกองค์ประกอบ โดยคงลำดับข้อมูลและ state เดิมไว้', description:'ช่วยตีความบางจุด แต่ไม่จำเป็นต้องแก้คอขวด', rationale:'ข้อความเพิ่มขึ้นอาจยิ่งเพิ่ม cognitive load หาก hierarchy หรือ feedback หลักยังไม่ชัด' },
        { label:'ส่ง notification ผ่านอีกช่องทางหนึ่งหลัง user ออกจากหน้า โดยไม่ปรับจุดตัดสินใจใน flow เดิม', description:'เพิ่มการแจ้งเตือนภายนอก', rationale:'อาจช่วยติดตาม แต่ไม่ทำให้ user เข้าใจผลของ action ในขณะที่เขาต้องตัดสินใจ' },
        { label:'ย้ายรายละเอียดรองทั้งหมดเข้า accordion ก่อน แล้วคง primary action และ feedback เดิม', description:'ลดความรกเชิง visual', rationale:'อาจทำให้หน้าดูสะอาด แต่ยังไม่แน่ว่าแก้ cause ที่ทำให้ user หยุด กดซ้ำ หรือไม่มั่นใจ' }
      ],
      test: [
        { label:'ให้ผู้เชี่ยวชาญ UX ตรวจ heuristic ของหน้าจอใหม่ แล้วสรุปข้อเสนอแนะโดยไม่ให้ผู้ใช้ทำ task', description:'เป็น expert review ที่มีประโยชน์', rationale:'เหมาะเป็นข้อมูลเสริม แต่ยังไม่พิสูจน์ว่าผู้ใช้เป้าหมายทำ task สำเร็จจริง' },
        { label:'เปรียบเทียบจำนวน click และ page view ก่อน–หลัง โดยไม่ตรวจผลลัพธ์ของ task', description:'เก็บ analytics เชิงปริมาณ', rationale:'click มากหรือน้อยไม่ได้บอกว่าผู้ใช้เข้าใจ state หรือทำงานสำเร็จ' },
        { label:'ให้ผู้ใช้ดูภาพหน้าจอใหม่แบบนิ่ง แล้วถามว่าชอบหรือดูง่ายกว่าหรือไม่', description:'เก็บ preference หลังดู design', rationale:'ไม่แทนการให้ user ทำงานใน flow จริงและเผชิญเงื่อนไขที่ทำให้เกิด error' }
      ]
    };
    return options[stageKey] || [];
  }

  function strengthenCaseBank(bank){
    return (bank || []).map((data) => {
      const next = Object.assign({}, data, { stages:{} });
      Object.entries(data.stages || {}).forEach(([stageKey, stage]) => {
        const correct = (stage.options || []).find((item) => item.correct) || stage.options?.[0];
        next.stages[stageKey] = Object.assign({}, stage, {
          options: [correct, ...antiGuessOptions(stageKey, data)].filter(Boolean)
        });
      });
      return next;
    });
  }

  function decorateIntro(){
    const hero = document.querySelector('.uxq-hero');
    if (!hero || hero.querySelector('.uxq-w1-lens')) return;
    addStyle();
    const previous = scanSummary();
    const card = document.createElement('section');
    card.className = 'uxq-w1-lens';
    card.innerHTML = `<div class="uxq-w1-lens__head"><span>Week 1 Lens</span><strong>ก่อนแก้ UI ให้ตั้ง Diagnosis และหา Evidence ที่ยืนยันได้</strong></div><div class="uxq-w1-lens__grid"><div><b>1. Task</b><span>ผู้ใช้ต้องการทำอะไรให้สำเร็จ?</span></div><div><b>2. Competing diagnoses</b><span>มีคำอธิบายอื่นที่ฟังดีแต่หลักฐานยังไม่พอหรือไม่?</span></div><div><b>3. Evidence</b><span>พฤติกรรมใดทำให้เราเลือก diagnosis นี้ได้จริง?</span></div></div>${previous ? `<small class="uxq-small-note">First Impression Scan ล่าสุด: ${previous.score || 0}/${previous.total || 0} จุด • รอบใหม่สุ่มคดีและสลับตำแหน่งตัวเลือก</small>` : ''}`;
    const actions = hero.querySelector('.uxq-actions');
    if (actions) actions.insertAdjacentElement('beforebegin', card); else hero.appendChild(card);
  }

  function decorateMission(){
    const question = document.querySelector('.uxq-question');
    if (!question || question.querySelector('.uxq-w1-stage-lens')) return;
    const stage = String(document.querySelector('.uxq-stage')?.textContent || '').toLowerCase();
    let text = 'ก่อนตอบ: มอง Task → Evidence → competing diagnosis → ผลต่อ user';
    if (stage.includes('evidence')) text = 'Evidence Lens: เลือกสิ่งที่อธิบายทั้งพฤติกรรมและผลลัพธ์ของ task ไม่ใช่เพียง metric หรือความชอบ';
    else if (stage.includes('impact')) text = 'Hypothesis Lens: เลือกคำอธิบายที่ evidence สนับสนุนมากที่สุด แล้วตัดทางเลือกที่ฟังดีแต่ยังไม่มีหลักฐาน';
    else if (stage.includes('fix')) text = 'Fix Lens: วิธีแก้ต้องลด friction ที่พบ ไม่ใช่เพียงทำหน้าให้สะอาดหรือเพิ่ม feature';
    else if (stage.includes('test')) text = 'Task Success Lens: วัดว่าผู้ใช้ทำงานสำเร็จ เข้าใจ state และไปต่อได้ ไม่ใช่ถามแค่ชอบหรือไม่ชอบ';
    const hint = document.createElement('aside');
    hint.className = 'uxq-w1-stage-lens';
    hint.innerHTML = `<b>Week 1 UX Lens</b> • ${esc(text)}`;
    question.insertBefore(hint, question.firstChild);
  }

  function focusLabel(key){
    const map = {
      evidence: 'Evidence: กลับไปหาพฤติกรรมผู้ใช้จริง และเปรียบเทียบกับหลักฐานที่อาจฟังดีแต่ยังอธิบาย task failure ไม่ได้',
      hypothesis: 'Hypothesis: เลือกคำอธิบายที่ evidence สนับสนุนมากที่สุด ไม่เหมารวมผู้ใช้หรือรีบเสนอ solution',
      fix: 'Fix: ตรวจว่าวิธีแก้ลด friction ที่พบจริง หรือเพียงทำหน้าจอดูสะอาด/มี feature มากขึ้น',
      test: 'Test: วัด task success, เวลา, ความผิดพลาด และความเข้าใจ state ไม่ถามเพียงว่าชอบไหม'
    };
    return map[String(key || '').toLowerCase()] || 'กลับไปตรวจความเชื่อมโยงระหว่าง task, evidence, diagnosis และการตัดสินใจ';
  }

  function decorateResult(){
    const result = document.querySelector('.uxq-results');
    if (!result || result.querySelector('.uxq-w1-coach')) return;
    const receipt = window.UXQSubmissionReceipt?.getLast?.();
    const focus = Array.isArray(receipt?.learningMap?.focus) ? receipt.learningMap.focus : [];
    const card = document.createElement('section');
    card.className = 'uxq-w1-coach';
    const scan = scanSummary();
    const body = focus.length
      ? `<p>ก่อนส่งใบงาน UX First Impression Audit ให้กลับไปแก้ส่วนต่อไปนี้จากผลเกม:</p><ul>${focus.map((item) => `<li>${esc(focusLabel(item.stageKey))}</li>`).join('')}</ul>`
      : '<p>คุณเชื่อมคำตอบกับเหตุผลได้ดีแล้ว นำหลักคิดไปใช้กับระบบจริง โดยระบุ Task → Evidence → Diagnosis → UX impact → Quick redesign → Test plan ให้ครบ</p>';
    card.innerHTML = `<div class="uxq-w1-coach__kicker">Week 1 • Audit Transfer</div><h3>นำผลเกมกลับไปทำใบงาน UX First Impression Audit</h3>${body}${scan ? `<p>First Impression Scan: ${scan.score || 0}/${scan.total || 0} — ใช้คู่ Diagnosis + Evidence ประกอบการอธิบาย Value, Usability และ Experience</p>` : ''}`;
    const anchor = result.querySelector('.uxq-takeaway, .uxq-submission-receipt');
    if (anchor) anchor.insertAdjacentElement('afterend', card); else result.appendChild(card);
  }

  function decorate(){
    decorateIntro();
    decorateMission();
    decorateResult();
  }

  function attachEnhancements(){
    if (observerStarted) return;
    observerStarted = true;
    addStyle();
    document.addEventListener('click', (event) => {
      const start = event.target instanceof Element ? event.target.closest('#uxqStart') : null;
      if (start) {
        if (bypassStart) { bypassStart = false; completedMini.clear(); return; }
        event.preventDefault();
        event.stopImmediatePropagation();
        openStartScan();
        return;
      }
      const next = event.target instanceof Element ? event.target.closest('#uxqNext') : null;
      if (!next) return;
      if (bypassNext) { bypassNext = false; return; }
      const step = currentQuestionNo();
      if (!MINI_STEPS.includes(step) || completedMini.has(step)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      completedMini.add(step);
      openMiniCheck(step);
    }, true);
    const boot = () => {
      decorate();
      const observer = new MutationObserver(() => window.requestAnimationFrame(decorate));
      observer.observe(document.documentElement, { childList:true, subtree:true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
    else boot();
  }

  Object.defineProperty(window, 'UXQMissionEngine', {
    configurable: true,
    get: () => current,
    set: (engine) => {
      if (!engine || typeof engine.init !== 'function') { current = engine; return; }
      const init = engine.init.bind(engine);
      current = Object.freeze(Object.assign({}, engine, {
        init: (config) => {
          const enriched = Object.assign({}, config, {
            eyebrow: 'WEEK 1 • UI/UX & FRONT-END DESIGN',
            title: 'UX Detective: UI, UX และ First Impression',
            shortName: 'W1 UX DETECTIVE',
            intro: 'ฝึกมองให้ลึกกว่าคำว่า “สวย” หรือ “รก”: ตั้ง diagnosis ที่แข่งขันกัน หาหลักฐานที่แยก diagnosis เหล่านั้นออกจากกัน แล้วเลือกวิธีแก้และการทดสอบที่พิสูจน์ผลได้',
            format: '2 คดีสุ่ม • 4 ขั้นวิเคราะห์ • Diagnosis + Evidence checks • Reason Check',
            duration: '14–18 นาที',
            passText: '≥ 2★ ระดับความพร้อม • 3★ ต้องชนะ distractor ที่เป็นทางเลือกใกล้เคียงด้วยเหตุผลและหลักฐาน',
            correctLabel: 'วิเคราะห์ UI/UX จาก evidence และเปรียบเทียบ diagnosis ได้',
            retryLabel: 'กลับไปดู task, evidence และ diagnosis ที่แข่งขันกันก่อนเลือกวิธีแก้',
            badge: 'UX First Impression Analyst',
            recentLimit: Math.max(Number(config.recentLimit || 0), 6),
            bank: strengthenCaseBank(config.bank),
            bossBank: strengthenCaseBank(config.bossBank || config.bank),
            stageMeta: Object.assign({}, config.stageMeta || {}, STAGE_LABELS),
            takeaways: [
              'UI คือองค์ประกอบบนหน้าจอ แต่ UX คือผลที่องค์ประกอบนั้นมีต่อ task และความรู้สึกของผู้ใช้',
              'Evidence ที่ดีต้องอธิบายพฤติกรรมและผลลัพธ์ของ task ไม่ใช่เพียงความชอบหรือ metric ที่ไม่มีบริบท',
              'Diagnosis ที่ดีต้องชนะคำอธิบายทางเลือกด้วยหลักฐาน ไม่ใช่ฟังดูสมเหตุผลเพียงอย่างเดียว',
              'การทดสอบที่ดีวัด task success, เวลา, ความผิดพลาด และความมั่นใจของผู้ใช้'
            ]
          });
          const output = init(enriched);
          attachEnhancements();
          return output;
        }
      }));
    }
  });
})();
