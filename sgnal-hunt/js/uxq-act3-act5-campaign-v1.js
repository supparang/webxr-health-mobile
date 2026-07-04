/* UX Quest • Act III–V Campaign Missions v1
 * Implements W7, B3, W9–W14 and B5 as replayable, evidence-led missions.
 * Each route uses 3 rotating casefiles, four near-miss decisions per stage,
 * Reason Check, a Studio Artifact and a truthful result layer.
 */
(() => {
  'use strict';

  const path = String(location.pathname || '').toLowerCase();
  const missionId =
    path.includes('w7-wireframe-heist') ? 'w7' :
    path.includes('b3-ux-blueprint-gauntlet') ? 'b3' :
    path.includes('w9-design-system-vault') ? 'w9' :
    path.includes('w10-responsive-rescue') ? 'w10' :
    path.includes('w11-contrast-cipher') ? 'w11' :
    path.includes('b4-design-system-siege') ? 'b4' :
    path.includes('w12-component-command') ? 'w12' :
    path.includes('w13-prototype-pulse') ? 'w13' :
    path.includes('w14-validation-lab') ? 'w14' :
    path.includes('b5-ux-launch-defense') ? 'b5' : '';
  if (!missionId || !window.UXQMissionEngine) return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const shuffle = (items) => {
    const next = Array.from(items || []);
    for (let index = next.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(Math.random() * (index + 1));
      [next[index], next[pick]] = [next[pick], next[index]];
    }
    return next;
  };
  const miss = (label, description, rationale) => ({ label, description, rationale, correct:false });

  /* A continuing project world lets students see the same user problem evolve
     from low-fidelity layout through the final case-study defense. */
  const CASEFILES = [
    {
      id:'grant-mobile',
      title:'คดีทุนเร่งด่วนบนมือถือ',
      service:'ระบบขอทุนการศึกษา',
      user:'พิม นักศึกษาที่ทำงานพิเศษและกรอกเอกสารเป็นช่วง ๆ บนมือถือ',
      goal:'เห็นว่าเอกสารใดขาด รู้กำหนดส่ง และส่งคำขอได้โดยไม่กลัวข้อมูลหาย',
      constraint:'มีเวลาสั้นระหว่างเดินทางและสัญญาณอินเทอร์เน็ตไม่เสถียร',
      evidence:'ผู้ใช้ถ่ายภาพหน้าจอสถานะ กลับไปเริ่มหน้าแรกหลายครั้ง และส่งไฟล์ซ้ำเมื่อไม่เห็นการยืนยัน',
      keyInfo:'สถานะเอกสาร กำหนดส่ง และสิ่งที่ต้องทำต่อ',
      action:'ส่งเอกสารที่ขาดและยืนยันคำขอ',
      noise:'ข่าวทุนเก่า ลิงก์หลายหน่วยงาน และปุ่มรองที่มีน้ำหนักเท่ากัน',
      components:'status chip, checklist, upload row, primary action และ receipt',
      state:'กำลังส่ง • รับไฟล์แล้ว • ต้องแก้ไฟล์ • ส่งสำเร็จ',
      responsive:'มือถือเริ่มจากสถานะและงานค้าง, tablet เปรียบเทียบเอกสารได้, desktop เปิดรายละเอียดรองข้างรายการ',
      access:'label ของไฟล์ชัด, error บอกไฟล์ที่ผิด, สีสถานะมีข้อความร่วม และ contrast อ่านได้ในแดด',
      visual:'หัวข้อสถานะเด่นกว่า meta, body text 16px, metadata 14px และสีแดงไม่ใช้เป็นสัญญาณเดียว',
      prototype:'wireframe 3 หน้าจอ: dashboard งานค้าง → upload เฉพาะไฟล์ → receipt พร้อม next step',
      test:'ให้ผู้ใช้ใหม่ 5 คนค้นหาไฟล์ที่ขาด ส่งไฟล์ และบอกได้ว่าคำขออยู่สถานะใด',
      outcome:'ลดการส่งซ้ำและทำให้ผู้ใช้มั่นใจว่าคำขอเสร็จหรือยัง'
    },
    {
      id:'library-seat',
      title:'คดีเลือกที่นั่งห้องสมุด',
      service:'ระบบจองที่นั่งห้องสมุด',
      user:'บาส นักศึกษาที่ต้องหามุมอ่านหนังสือเงียบก่อนสอบในเวลาจำกัด',
      goal:'เปรียบเทียบโซนที่ว่าง ระดับเสียง และระยะเดิน แล้วจองที่นั่งที่พร้อมใช้จริง',
      constraint:'ใช้โทรศัพท์ระหว่างเดินเข้าห้องสมุดและต้องตัดสินใจเร็ว',
      evidence:'ผู้ใช้เปิดดูภาพโซนหลายครั้ง โทรถามเพื่อนว่ามีที่ว่างไหม และเดินไปถึงโซนที่เต็มหรือเสียงดังเกินคาด',
      keyInfo:'จำนวนที่ว่าง ระดับเสียง เวลาเดินถึง และช่วงเวลาจอง',
      action:'เลือกโซนและยืนยันการจองที่นั่ง',
      noise:'ภาพประชาสัมพันธ์ขนาดใหญ่ รีวิวที่ยาว และเมนูบริการที่ไม่เกี่ยวกับการจอง',
      components:'availability badge, zone card, compare control, booking button และ confirmation',
      state:'กำลังเลือก • เหลือที่นั่งน้อย • จองแล้ว • ที่นั่งถูกเปลี่ยน',
      responsive:'มือถือเน้น filter และ compare สองโซน, tablet แสดง card สามโซน, desktop เปิดแผนที่รายละเอียดคู่กับ card',
      access:'filter ใช้คีย์บอร์ดได้, ระดับเสียงไม่สื่อด้วยสีล้วน, card มีชื่อและสถานะที่ screen reader อ่านได้',
      visual:'ชื่อโซนและจำนวนที่ว่างมี hierarchy สูง, ตัวเลือกเปรียบเทียบไม่แข่งกับปุ่มจอง, type scale ชัด',
      prototype:'wireframe เปรียบเทียบ 3 โซน → ดูเงื่อนไข → ยืนยันและรับหมายเลขที่นั่ง',
      test:'ให้ผู้ใช้เลือกที่นั่งตามภารกิจสามแบบ แล้วตรวจเหตุผล เวลา และการจองผิดโซน',
      outcome:'ลดการเดินไปเจอที่เต็มและช่วยให้เลือกพื้นที่ตรงงานที่ต้องทำ'
    },
    {
      id:'clinic-queue',
      title:'คดีจองคิวคลินิกมหาวิทยาลัย',
      service:'ระบบจองคิวคลินิกนักศึกษา',
      user:'ต้น นักศึกษาที่มีเวลาเพียงช่วงเปลี่ยนคาบและต้องจองนัดจากมือถือ',
      goal:'หาเวลาว่าง ตรวจวัน เวลา สถานที่ และรู้ว่าต้องไปทำอะไรหลังจอง',
      constraint:'อ่านปฏิทินบนจอเล็กและกังวลว่าจะพลาดเวลาเรียน',
      evidence:'ผู้ใช้เลือกคิวแล้วกลับไปเปิดปฏิทินเดิม ถามเจ้าหน้าที่ว่าจองสำเร็จหรือยัง และบางคนมาผิดวัน',
      keyInfo:'วัน เวลา สถานที่ สถานะนัด และขั้นตอนก่อนเข้ารับบริการ',
      action:'เลือกคิวและยืนยันนัดหมาย',
      noise:'นโยบายยกเลิกยาว ปุ่มเปลี่ยนคิว/ยกเลิกที่เด่นเท่าปุ่มยืนยัน และข้อมูลบริการรอง',
      components:'time slot, appointment summary, status banner, change/cancel action และ reminder',
      state:'กำลังยืนยัน • จองสำเร็จ • รอเอกสาร • เปลี่ยนคิวแล้ว',
      responsive:'มือถือแสดงเวลาที่เลือกและปุ่มยืนยันคงที่, tablet เปรียบเทียบช่วงเวลา, desktop เปิดรายละเอียดบริการด้านข้าง',
      access:'ปฏิทินมี label วัน/เวลา, error ระบุ slot ที่ใช้ไม่ได้, action สำคัญไม่อาศัยสีอย่างเดียว',
      visual:'วันและเวลานัดเป็นข้อมูลระดับหนึ่ง, primary action มีน้ำหนักชัด, policy เปิดอ่านเพิ่มได้',
      prototype:'wireframe เลือกเวลา → summary ตรวจวัน/เวลา → receipt พร้อมสถานที่และ next step',
      test:'ให้ผู้ใช้จองคิวจำลองแล้วบอกวัน เวลา สถานที่ และสิ่งที่ต้องเตรียมได้ถูกต้อง',
      outcome:'ลดการมาผิดวันและลดการถามซ้ำว่าจองสำเร็จหรือไม่'
    }
  ];

  const phase = {
    evidence: (c) => ({
      label:`ใช้หลักฐานที่ ${c.evidence}`,
      description:'เริ่มจากพฤติกรรมที่สังเกตได้และผลต่อ task',
      rationale:'หลักฐานนี้เชื่อมสิ่งที่ผู้ใช้ทำ จุดที่ติดขัด และผลเสียที่ระบบต้องรับผิดชอบ',
      misses:[
        miss(`ดูเฉพาะยอดเปิด ${c.service} แล้วสรุปว่าหน้าใดควรถูกแก้ก่อน`, 'ใช้ traffic แทนบริบทของ task', 'ยอดเปิดไม่บอกว่าผู้ใช้ทำงานสำเร็จหรือหยุดตรงใด'),
        miss('ให้ทีมภายในโหวตว่าหน้าจอใดดูเก่าที่สุด แล้วเลือกเปลี่ยนหน้านั้นก่อน', 'ใช้รสนิยมทีมเป็นจุดตั้งต้น', 'สิ่งที่ดูเก่าอาจไม่ใช่สิ่งที่ทำให้ผู้ใช้ทำงานล้มเหลว'),
        miss('เลือก feature ที่มีคนขอมากที่สุดโดยไม่ดูว่าเป็นสาเหตุของคดีนี้หรือไม่', 'ใช้จำนวนคำขอแทนเหตุผล', 'คำขอมากอาจเป็นอาการ ไม่ใช่คอขวดของ task')
      ]
    }),
    frame: (c) => ({
      label:`ช่วย ${c.user} ให้ ${c.goal} ภายใต้ข้อจำกัดว่า ${c.constraint} โดยยังไม่ล็อกวิธีแก้`,
      description:'ระบุผู้ใช้ เป้าหมาย และ barrier ก่อนเลือก solution',
      rationale:'โจทย์เปิดทางให้ทีมเปรียบเทียบทางเลือกที่ลด friction ได้จริง',
      misses:[
        miss('เราจะทำหน้าใหม่ให้สวยและทันสมัยที่สุดได้อย่างไร?', 'เริ่มจากภาพลักษณ์ของ solution', 'ยังไม่ระบุ task หรืออุปสรรคของผู้ใช้'),
        miss('เราจะลดจำนวนขั้นตอนทั้งหมดให้เหลือน้อยที่สุดได้อย่างไร?', 'มองจำนวน click ก่อนความเสี่ยง', 'บางขั้นจำเป็นต่อความมั่นใจหรือป้องกัน error'),
        miss('เราจะเพิ่มฟีเจอร์ที่ผู้ใช้เคยขอให้ครบทุกอย่างได้อย่างไร?', 'ใช้จำนวน feature เป็นเป้าหมาย', 'ความครบไม่ได้รับประกันว่า task สำคัญจะง่ายขึ้น')
      ]
    }),
    structure: (c) => ({
      label:`จัด ${c.keyInfo} และ action “${c.action}” ให้อยู่ในเส้นทางเดียวกัน แล้วลดน้ำหนัก ${c.noise}`,
      description:'จัดโครงสร้างตาม task และ mental model ของผู้ใช้',
      rationale:'ข้อมูลตัดสินใจและ action สำคัญต้องพบในจังหวะเดียวกัน ไม่โยนภาระจำให้ผู้ใช้',
      misses:[
        miss(`รวม ${c.noise} และข้อมูลสำคัญไว้หน้าเดียวโดยทำทุกส่วนเด่นเท่ากัน`, 'ให้ข้อมูลครบแต่ไม่จัดลำดับ', 'เมื่อทุกอย่างเด่นเท่ากัน ผู้ใช้ต้องคัดกรองเอง'),
        miss('ซ่อนข้อมูลตัดสินใจไว้ในเมนู “เพิ่มเติม” เพื่อให้หน้าหลักดูโล่ง', 'ลดความรกด้วยการซ่อน', 'อาจทำให้ผู้ใช้หาเงื่อนไขสำคัญไม่ทันก่อน action'),
        miss('ใช้ชื่อเมนูตามโครงสร้างหน่วยงานหลังบ้านเพื่อให้ทีมดูแลง่าย', 'ใช้ภาษาองค์กรแทนภาษา user', 'ผู้ใช้ใหม่อาจไม่รู้ว่าต้องเริ่มจากเมนูใด')
      ]
    }),
    priority: (c) => ({
      label:`ยก ${c.keyInfo} และ action “${c.action}” เป็นระดับแรก พร้อมทำ ${c.noise} เป็นข้อมูลรองที่เปิดดูได้เมื่อจำเป็น`,
      description:'ใช้ visual hierarchy เพื่อช่วย user ตัดสินใจในจังหวะที่ต้องทำงาน',
      rationale:'การทำให้ task สำคัญเด่นไม่ใช่การลบข้อมูล แต่เป็นการให้ข้อมูลรองไม่แข่งขันกับ goal ปัจจุบัน',
      misses:[
        miss('ทำทุกปุ่มเป็น primary style เพื่อให้ทุกทางเลือกได้รับความเป็นธรรม', 'ความเด่นเท่ากัน', 'ทุก action เด่นเท่ากันทำให้ผู้ใช้ต้องเดาว่าอะไรควรกดก่อน'),
        miss('ให้ข้อความนโยบายและรายละเอียดรองอยู่เหนือ action หลักเสมอ', 'ข้อมูลครบก่อนเป้าหมาย', 'รายละเอียดอาจสำคัญ แต่ไม่ควรกลบ task ที่ user ต้องทำตอนนี้'),
        miss('ย้าย action หลักเข้าเมนูย่อยเพื่อให้หน้าจอสะอาดขึ้น', 'ลด visual clutter ด้วยการซ่อน', 'ผู้ใช้จะหา action สำคัญไม่เจอในสถานการณ์เร่งด่วน')
      ]
    }),
    wireframe: (c) => ({
      label:`ทำ ${c.prototype}`,
      description:'ต้นแบบครอบคลุม decision point ที่เสี่ยงที่สุดของ flow',
      rationale:'wireframe ทำให้ทีมทดสอบลำดับข้อมูล action และ state ได้ก่อนลงทุน visual รายละเอียด',
      misses:[
        miss('ทำหน้า landing ที่สวยที่สุดก่อน แล้วค่อยตัดสินใจว่าจะเชื่อม flow อย่างไร', 'ลงทุน visual ก่อน flow', 'ยังไม่ได้พิสูจน์ว่าผู้ใช้ไปถึงเป้าหมายได้'),
        miss('พัฒนาระบบเต็มและเชื่อมข้อมูลจริงให้ครบก่อนทดลองกับผู้ใช้', 'เรียนรู้หลังลงทุนสูง', 'เสี่ยงสร้างสิ่งผิดครบชุดก่อนเห็น error จริง'),
        miss('ทำสไลด์อธิบายแนวคิดให้ผู้ใช้ดู แล้วถามว่าชอบหรือไม่', 'ทดสอบจากคำบอกเล่า', 'ผู้ใช้ไม่ได้ทำ task จึงไม่พบจุดตัดสินใจและ state จริง')
      ]
    }),
    system: (c) => ({
      label:`ทำ inventory ของ ${c.components} แล้วกำหนด token ร่วมสำหรับ spacing, type, สี และสถานะก่อนเพิ่มหน้าจอใหม่`,
      description:'สร้างกฎที่ทำให้ pattern เดิมมีพฤติกรรมและภาษาภาพสอดคล้องกัน',
      rationale:'design system ลดความคลาดเคลื่อนของการตัดสินใจ ไม่ใช่แค่รวม component ให้ดูเหมือนกัน',
      misses:[
        miss('คัดลอก component จากแอปยอดนิยมให้มากที่สุด แล้วค่อยตัดส่วนเกินภายหลัง', 'ยืม solution โดยไม่ดู task', 'component ที่คุ้นอาจไม่ตรงกับข้อมูลและ state ของบริการนี้'),
        miss('ใช้สีใหม่ทุกหน้าจอเพื่อให้แต่ละ feature มีเอกลักษณ์', 'เพิ่มความต่างเชิง visual', 'ทำให้ผู้ใช้ต้องเรียนรู้ความหมายของสีและปุ่มใหม่ทุกครั้ง'),
        miss('ให้แต่ละทีมออกแบบ card และ button ของตนเองเพื่อทำงานได้เร็ว', 'ให้ความเร็วระยะสั้นเหนือ consistency', 'เพิ่มหนี้ของระบบและทำให้ user พบ pattern ไม่สม่ำเสมอ')
      ]
    }),
    responsive: (c) => ({
      label:`ออกแบบ responsive behavior ให้ ${c.responsive}`,
      description:'เปลี่ยนลำดับและการเปิดเผยข้อมูลตามบริบท ไม่ใช่ย่อ desktop ลงอย่างเดียว',
      rationale:'ผู้ใช้แต่ละหน้าจอมีพื้นที่ ความสนใจ และความเร่งด่วนต่างกัน แต่ต้องยังทำ task เดิมได้สำเร็จ',
      misses:[
        miss('ย่อทุก column ของ desktop ให้แคบลงเท่าหน้าจอมือถือโดยคงลำดับเดิม', 'scale layout โดยไม่ออกแบบ priority ใหม่', 'ข้อมูลและ action สำคัญอาจเล็กหรือถูกดันออกนอกบริบท'),
        miss('ซ่อนทุกข้อมูลรองจากมือถือโดยไม่บอกว่าจะเปิดดูได้ที่ใด', 'ลดข้อมูลด้วยการตัดทิ้ง', 'ผู้ใช้อาจต้องใช้ข้อมูลนั้นเพื่อตัดสินใจหรือกู้คืน error'),
        miss('บังคับใช้ desktop view บนมือถือเพื่อรักษาความครบของระบบ', 'ให้ความครบมาก่อน usability', 'เพิ่มการซูม เลื่อน และ cognitive load บนจอเล็ก')
      ]
    }),
    access: (c) => ({
      label:`กำหนดให้ ${c.access}`,
      description:'ทำให้ user รับรู้สถานะและทำ action ได้แม้ไม่ใช้การมองสี เมาส์ หรือหน้าจอขนาดใหญ่',
      rationale:'accessibility เป็นเงื่อนไขของ task success ไม่ใช่ชั้นตกแต่งหลังงานเสร็จ',
      misses:[
        miss('ใช้สีแดง/เขียวเป็นตัวบอก error และ success โดยไม่เพิ่มข้อความหรือสัญลักษณ์', 'พึ่งสีอย่างเดียว', 'ผู้ใช้บางคนแยกสีไม่ได้หรือใช้งานในสภาพแสงไม่เหมาะ'),
        miss('เพิ่มข้อความเล็กใต้ field ทุกช่องโดยไม่ปรับ label, focus หรือ error state', 'เพิ่มเนื้อหาแต่ไม่ทำ interaction เข้าถึงได้', 'ผู้ใช้ยังไม่รู้ว่าจะกรอกอะไรหรือแก้จุดใดเมื่อผิด'),
        miss('ทดสอบเฉพาะบนจอใหญ่และเมาส์ เพราะเป็นอุปกรณ์ที่ทีมออกแบบใช้', 'ใช้บริบททีมแทนผู้ใช้', 'ไม่ครอบคลุมการใช้งานจริงและอุปกรณ์ที่หลากหลาย')
      ]
    }),
    visual: (c) => ({
      label:`ใช้กติกา visual ว่า ${c.visual}`,
      description:'Color และ typography ทำหน้าที่จัดลำดับความสำคัญและอ่านข้อมูลได้ ไม่ใช่เพียงสร้างบรรยากาศ',
      rationale:'การตัดสินใจด้าน visual ต้องผูกกับความสามารถในการสแกน ตีความ และเลือก action ที่ถูกต้อง',
      misses:[
        miss('ใช้สีแบรนด์เต็มความอิ่มทุกองค์ประกอบเพื่อให้หน้าดูมีพลัง', 'ใช้สีเพื่ออารมณ์มากกว่าลำดับ', 'เมื่อทุกอย่างมีน้ำหนักสูง ไม่มีอะไรช่วยนำสายตา'),
        miss('ลดขนาดข้อความ meta และ label ให้เล็กที่สุดเพื่อเพิ่มพื้นที่ว่าง', 'ให้พื้นที่มาก่อน legibility', 'ข้อมูลรองยังอาจสำคัญต่อการตรวจสอบและตัดสินใจ'),
        miss('ใช้คู่สีที่ดูเข้ากันจาก mockup โดยไม่ตรวจ contrast ในสภาพใช้งานจริง', 'เลือกจากรสนิยม visual', 'สวยในจอของทีมไม่ได้แปลว่าอ่านได้สำหรับผู้ใช้ทุกคน')
      ]
    }),
    state: (c) => ({
      label:`ออกแบบ state ของ ${c.components} ให้บอก “${c.state}” พร้อม action ที่ผู้ใช้ทำต่อได้`,
      description:'component ต้องสื่อสถานะ ความผิดพลาด และทางกู้คืนเฉพาะจุด',
      rationale:'feedback ที่ดีตอบทั้งสิ่งที่ระบบรับรู้แล้ว สิ่งที่ยังค้าง และสิ่งที่ user ต้องทำต่อ',
      misses:[
        miss('แสดง toast กลาง ๆ ว่า “เกิดข้อผิดพลาด” โดยไม่ระบุองค์ประกอบหรือวิธีแก้', 'feedback กว้างเกินไป', 'ผู้ใช้ไม่รู้ว่าอะไรผิดและต้องเริ่มแก้จากจุดใด'),
        miss('ปิดปุ่มทั้งหมดระหว่างระบบทำงานโดยไม่แสดงสถานะหรือเวลาคาดการณ์', 'ป้องกันการกดซ้ำแบบเงียบ', 'ผู้ใช้จะไม่มั่นใจว่าระบบรับ action แล้วหรือค้างอยู่'),
        miss('เมื่อเกิด error ให้ผู้ใช้กลับหน้าแรกเพื่อเริ่ม task ใหม่ทั้งหมด', 'recovery ที่ทิ้ง context', 'ทำให้ผู้ใช้สูญเสียงานและต้องจำสิ่งที่ทำไว้')
      ]
    }),
    prototype: (c) => ({
      label:`สร้าง prototype ที่ให้ผู้ใช้เดิน ${c.prototype} และเห็น feedback/state ในจุดที่ตัดสินใจ`,
      description:'prototype ต้องตอบสมมติฐานเรื่อง flow และ feedback ก่อนขัดเกลา animation หรือภาพจริง',
      rationale:'interaction ที่ดีพิสูจน์ได้จากการที่ user เข้าใจผลของ action และไปต่อโดยไม่หลงทาง',
      misses:[
        miss('ทำ motion และภาพประกอบครบทุกหน้าให้สมจริงก่อนเชื่อม action หลัก', 'ขัดเกลาผิวก่อน interaction', 'ยังไม่รู้ว่าลำดับ action และ feedback ช่วย task หรือไม่'),
        miss('ใช้ animation เดียวกันกับทุก action เพื่อให้รู้สึกต่อเนื่อง', 'ทำ motion เป็นของตกแต่ง', 'motion ต้องสื่อการเปลี่ยนแปลงที่มีความหมาย ไม่ใช่ทำให้ทุกอย่างเคลื่อนไหว'),
        miss('ให้ผู้ใช้ดู prototype แบบวิดีโอโดยไม่กดหรือเลือกเอง', 'สังเกตจากการรับชม', 'ไม่เห็น decision error และจังหวะที่ผู้ใช้คาดหวัง feedback')
      ]
    }),
    validate: (c) => ({
      label:`${c.test} พร้อมบันทึกเวลา ความผิดพลาด และเหตุผลที่ผู้ใช้ยังลังเล`,
      description:'วัด task success พร้อมข้อมูลเชิงคุณภาพเพื่อปรับรอบถัดไป',
      rationale:'ผลการทดสอบต้องบอกได้ว่า design ช่วยผู้ใช้จริงหรือไม่ และควรแก้อะไรต่อ',
      misses:[
        miss('ให้ทีมออกแบบโหวตว่าแนวทางใดดูเป็นระเบียบกว่า แล้วใช้ผลโหวตเป็นเกณฑ์ผ่าน', 'ใช้รสนิยมภายใน', 'ทีมมี mental model ของระบบอยู่แล้วและไม่แทนผู้ใช้เป้าหมาย'),
        miss('นับจำนวน click และ page view หลังปล่อย โดยไม่ตรวจว่าผู้ใช้ทำ task สำเร็จหรือไม่', 'วัด activity แทน outcome', 'click มากหรือน้อยไม่ได้บอกว่า user เข้าใจหรือจบงานได้'),
        miss('ถามหลังจบว่า “ชอบไหม” โดยไม่ให้ผู้ใช้ทำภารกิจภายใต้เงื่อนไขจริง', 'วัด preference', 'ความชอบไม่แทนความสามารถในการตัดสินใจและกู้คืนจาก error')
      ]
    }),
    defense: (c) => ({
      label:`ป้องกันการตัดสินใจด้วย ${c.evidence} → การออกแบบที่ทำให้ ${c.action} ชัดขึ้น → เกณฑ์พิสูจน์จาก ${c.test}`,
      description:'เชื่อมหลักฐาน การตัดสินใจ และผลที่ต้องพิสูจน์เป็นเส้นเดียวกัน',
      rationale:'Design defense ที่ดีไม่ยึดความชอบ แต่ยอมให้ข้อเสนอถูกตรวจสอบจากพฤติกรรมผู้ใช้',
      misses:[
        miss('ป้องกันแนวทางด้วยการบอกว่าทีมใช้เวลาทำ prototype นานที่สุด', 'ใช้ต้นทุนเป็นเหตุผล', 'เวลาที่ลงทุนไม่พิสูจน์ว่าแนวทางแก้ปัญหาของผู้ใช้'),
        miss('บอกว่า design คล้ายผลิตภัณฑ์ที่ได้รับความนิยมจึงน่าจะใช้ได้', 'อ้างความนิยม', 'บริบท user, task และข้อจำกัดอาจต่างกันโดยสิ้นเชิง'),
        miss('ยืนยันว่าหน้าจอดูทันสมัยขึ้นจึงควรอนุมัติ', 'ใช้ aesthetic เป็นเกณฑ์หลัก', 'ความทันสมัยไม่บอกว่าผู้ใช้ทำงานสำเร็จหรือเข้าใจ state')
      ]
    }),
    portfolio: (c) => ({
      label:`เล่า case study เป็น ${c.evidence} → need/decision → ${c.prototype} → ผลทดสอบจาก ${c.test} → สิ่งที่จะ iterate ต่อ`,
      description:'portfolio แสดงเหตุผล กระบวนการ และการเรียนรู้ ไม่ใช่เพียงภาพสุดท้าย',
      rationale:'ผู้ชมต้องตรวจได้ว่าการตัดสินใจออกแบบมาจาก user evidence และเปลี่ยนตามผลทดสอบอย่างไร',
      misses:[
        miss('เรียงภาพ high-fidelity สวยที่สุดก่อน แล้วใส่คำอธิบายสั้น ๆ ว่าระบบใช้งานง่าย', 'โชว์ผลลัพธ์โดยไม่แสดงเหตุผล', 'ไม่ทำให้ผู้ชมเห็น problem, decision และ evidence ของการเปลี่ยนแปลง'),
        miss('อธิบายเครื่องมือและจำนวนชั่วโมงทำงานเป็นแกนกลางของการนำเสนอ', 'โฟกัสกระบวนการผลิต', 'ไม่ตอบว่าดีไซน์ช่วยผู้ใช้และพิสูจน์ผลอย่างไร'),
        miss('สรุปว่า “ผู้ใช้ชอบมาก” โดยไม่แสดง task, sample หรือข้อจำกัดของการทดสอบ', 'สรุปผลเกินหลักฐาน', 'ขาดความน่าเชื่อถือและไม่บอกสิ่งที่ควรปรับต่อ')
      ]
    })
  };

  const missions = {
    w7:{
      title:'Wireframe Heist: Grid, Layout & Hierarchy', subtitle:'W7 • Wireframe & Visual Hierarchy', tag:'ACT III • WIREFRAME HEIST',
      intro:'กู้ task สำคัญจากหน้าจอที่ข้อมูลชนกัน จัด grid, hierarchy และ low-fidelity wireframe เพื่อให้ผู้ใช้เห็นสิ่งที่ต้องทำก่อน',
      requires:'b2', nextHref:'./b3-ux-blueprint-gauntlet.html', nextLabel:'เข้าสู่ B3 • UX Blueprint Gauntlet', badge:'Wireframe Priority Architect',
      stages:[['frame','Task Target','ระบุ goal และ constraint ก่อนวาดกล่องหรือเลือกสี','อย่าวาด layout ก่อนรู้ว่า user ต้องทำอะไรให้สำเร็จ'],['structure','Grid & Grouping','จัดข้อมูลที่ต้องใช้ตัดสินใจให้อยู่ใกล้กัน','Grid ต้องลดการสแกนและการจำ ไม่ใช่เพียงแบ่งช่องให้สวย'],['priority','Visual Hierarchy','เลือกสิ่งที่ต้องเด่นที่สุดในจังหวะนี้','ทุกอย่างเด่นเท่ากันเท่ากับไม่มี hierarchy'],['wireframe','Low-fidelity Wireframe','เลือกขอบเขต wireframe ที่พิสูจน์ flow สำคัญได้','ทดสอบ task ก่อนขัดเกลา visual'],['validate','Task Validation','เลือกแผนทดสอบที่ตรวจ user flow จริง','ความชอบไม่แทน task success']],
      artifact:{title:'Wireframe Decision Card',lead:'นำผลเกมไปวาด low-fidelity wireframe ที่อธิบายลำดับข้อมูลและ action ได้',fields:[['task','Task หลักและ user context','ใครต้องทำอะไร และมีข้อจำกัดอะไร'],['priority','ข้อมูล/Action ที่ต้องเด่นก่อน','ระบุ hierarchy และข้อมูลที่ลดน้ำหนัก'],['flow','Wireframe flow 3 หน้าจอ','Entry → Decision → Confirmation / State']]}
    },
    b3:{
      title:'UX Blueprint Gauntlet', subtitle:'B3 • Midterm Design Defense', tag:'MIDTERM BOSS • BLUEPRINT GAUNTLET',
      intro:'บอสกลางภาค: ใช้หลักฐานจริงสร้าง blueprint ตั้งแต่ insight จนถึง wireframe แล้วป้องกันเหตุผลต่อเงื่อนไขที่เปลี่ยนเร็ว',
      requires:'w7', nextHref:'./w9-design-system-vault.html', nextLabel:'ปลดล็อก W9 • Design System Vault', badge:'Blueprint Defense Strategist', boss:true,
      stages:[['evidence','Signal Scan','เลือกหลักฐานที่บอกว่าผู้ใช้ติดจริง','อย่าเริ่มจาก screen ที่ทีมไม่ชอบ'],['frame','Blueprint Frame','ตั้งโจทย์ที่ไม่ล็อก solution','ต้องมี user + goal + barrier'],['priority','Priority Break','จัดสิ่งสำคัญก่อนสิ่งสวย','hierarchy ต้องช่วย decision'],['wireframe','Wireframe Seal','เลือก prototype ที่พิสูจน์ flow เสี่ยง','ต้นแบบที่ดีทำให้ user ลงมือทำได้'],['defense','Defense Countermeasure','ป้องกัน design ด้วย evidence → decision → proof','คำอธิบายต้องตรวจสอบได้'],['validate','Proof Gate','เลือกเกณฑ์ที่อนุญาตให้เดินหน้าต่อได้','วัด user outcome ไม่ใช่ทีมเห็นตรงกัน']],
      artifact:{title:'Midterm Blueprint Defense',lead:'บันทึก blueprint สำหรับการนำเสนอ midterm: ไม่ใช่แค่ wireframe แต่ต้องมีเหตุผลและเกณฑ์พิสูจน์',fields:[['evidence','Evidence ที่นำไปใช้','พฤติกรรม/คำพูด/ข้อมูลที่ชี้ปัญหา'],['blueprint','Blueprint decision','Task → hierarchy → wireframe ที่เลือก'],['proof','เกณฑ์พิสูจน์และความเสี่ยง','จะวัดอะไร และหากไม่ผ่านจะปรับอะไร']]}
    },
    w9:{
      title:'Design System Vault', subtitle:'W9 • Pattern Library & UI Kit', tag:'ACT IV • DESIGN SYSTEM VAULT',
      intro:'หยุดแก้ UI เป็นรายหน้า: ทำ inventory, token, pattern และ state rule เพื่อให้ระบบใช้ซ้ำได้โดยไม่ทำ user ต้องเรียนรู้ใหม่ทุกหน้าจอ',
      requires:'b3', nextHref:'./w10-responsive-rescue.html', nextLabel:'ไปต่อ W10 • Responsive Rescue', badge:'Design System Steward',
      stages:[['system','Component Inventory','เลือกสิ่งที่ต้องทำให้เป็น pattern ร่วม','เริ่มจาก component ที่มีผลต่อ task และ state'],['system','Token Rule','เลือกกติกา token ที่ทำให้ตัดสินใจสม่ำเสมอ','token ไม่ใช่แค่ชุดสี'],['structure','Pattern Consistency','จัด pattern ตาม mental model และ task','ชื่อและ action ต้องคงความหมาย'],['state','State Contract','กำหนด state ของ component ให้แก้ error ได้','component ต้องบอก next action'],['validate','Governance Check','ทดสอบว่ากฎลด inconsistency ได้จริง','ตรวจกับ flow ไม่ใช่เพียง component gallery']],
      artifact:{title:'UI Kit Charter',lead:'สร้างกติกา UI Kit ที่จะใช้ต่อในงานกลุ่มและ prototype',fields:[['inventory','Component ที่ต้องทำเป็น shared pattern','เช่น button, card, status, form row'],['tokens','Token / rule ที่ตกลงร่วมกัน','spacing, type, color, elevation, state'],['guardrail','Guardrail การใช้ pattern','เมื่อไรใช้ primary/secondary/destructive และจะตรวจอะไร']]}
    },
    w10:{
      title:'Responsive Rescue', subtitle:'W10 • Responsive & Accessible Web', tag:'ACT IV • RESPONSIVE RESCUE',
      intro:'ช่วย user ทำ task เดิมให้สำเร็จบนมือถือ tablet และ desktop โดยจัด navigation ใหม่ตาม context และผูก accessibility เข้ากับ flow ตั้งแต่ต้น',
      requires:'w9', nextHref:'./w11-contrast-cipher.html', nextLabel:'ไปต่อ W11 • Contrast Cipher', badge:'Responsive Route Planner',
      stages:[['frame','Context Target','ระบุ user goal และ context ของหน้าจอ','responsive เริ่มจากบริบท ไม่ใช่ breakpoint'],['structure','Navigation Route','จัด navigation ให้ task หลักหาเจอ','อย่าซ่อน task สำคัญเพื่อให้หน้าโล่ง'],['responsive','Responsive Behavior','เลือก behavior ที่ปรับ priority ตามจอ','ย่อ desktop ไม่ใช่ responsive design'],['access','Accessible Route','ทำให้ flow ใช้ได้โดยไม่พึ่งสีหรือเมาส์','accessibility คือการรักษา task success'],['validate','Multi-device Test','ทดสอบ task เดียวบนบริบทต่างกัน','ต้องสังเกต error และ recovery']],
      artifact:{title:'Responsive & Accessibility Plan',lead:'แปลงผลเกมเป็นแผนออกแบบ responsive screen set ที่ตรวจสอบได้',fields:[['route','Task + navigation route','ผู้ใช้เริ่มจากไหน ทำอะไร และจบอย่างไร'],['breakpoint','Responsive behavior','มือถือ/Tablet/Desktop เปลี่ยนข้อมูลและ action อย่างไร'],['access','Accessibility guardrails','label, focus, contrast, error, keyboard/screen reader']]}
    },
    w11:{
      title:'Contrast Cipher', subtitle:'W11 • Color, Typography & Visual Accessibility', tag:'ACT IV • CONTRAST CIPHER',
      intro:'ถอดรหัสหน้าจอที่ “ดูดีแต่ตัดสินใจยาก” ด้วย color, typography, contrast และ visual hierarchy ที่ใช้ได้ในบริบทจริง',
      requires:'w10', nextHref:'./b4-design-system-siege.html', nextLabel:'เข้าสู่ B4 • Design System Siege', badge:'Visual Accessibility Analyst',
      stages:[['evidence','Readability Signal','เลือกหลักฐานที่บอกว่า user อ่านหรือแยกสถานะผิด','อย่าตัดสินจาก mockup ของทีม'],['visual','Typography & Hierarchy','ใช้ type และ spacing เพื่อทำให้ลำดับอ่านชัด','ตัวอักษรเล็กไม่เท่ากับหน้าจอสะอาด'],['visual','Color Meaning','ใช้สีเพื่อสื่อความหมายและ priority อย่างปลอดภัย','สีไม่ใช่สัญญาณเดียว'],['access','Contrast & Inclusion','เลือกเกณฑ์เข้าถึงได้ในสถานการณ์จริง','คนใช้ไม่ได้มีเพียงคนที่เห็นจอแบบทีม'],['validate','Visual Audit','ทดสอบว่าผู้ใช้สแกนและตีความได้','ต้องดู task และ state ไม่ใช่แค่ความชอบ']],
      artifact:{title:'Visual Accessibility Board',lead:'สรุปกติกา color, typography และ contrast สำหรับใช้ตรวจ screen ในงานกลุ่ม',fields:[['hierarchy','Visual hierarchy rule','อะไรอ่านก่อน อะไรเป็น metadata และอะไรเป็น action'],['color','Color/contrast decision','สีใดมีความหมายและมี text/icon อะไรร่วม'],['audit','Audit task','ให้ผู้ใช้หา/อ่าน/ตีความอะไรเพื่อพิสูจน์ว่าใช้ได้']]}
    },
    b4:{
      title:'Design System Siege', subtitle:'B4 • Design System Defense', tag:'BOSS GATE • W9–W11',
      intro:'บอสระบบภาพ: ป้องกัน pattern, responsive behavior และ visual accessibility ภายใต้ข้อจำกัดของบริการที่มีหลายหน้าจอและหลาย user context',
      requires:'w11', nextHref:'./w12-component-command.html', nextLabel:'ปลดล็อก W12 • Component Command', badge:'System Defense Commander', boss:true,
      stages:[['evidence','System Failure Scan','เลือก evidence ที่เชื่อม inconsistency กับ task failure','อย่ามอง system เป็นเรื่องความสวย'],['system','System Countermeasure','เลือก pattern/token rule ที่แก้ต้นเหตุ','กติกาต้องใช้ซ้ำได้ใน flow'],['responsive','Responsive Pressure','เลือก responsive behavior ภายใต้ context เปลี่ยน','อย่าบังคับ layout เดียวกับทุกจอ'],['access','Accessibility Seal','เลือกสิ่งที่ทำให้ user ทุกคนไปต่อได้','state และ error ต้องเข้าถึงได้'],['defense','System Defense','เชื่อม evidence → system decision → proof','คำว่า consistent ต้องพิสูจน์จาก user outcome']],
      artifact:{title:'Design System Defense Note',lead:'สรุปเหตุผลของ pattern library, responsive rule และ visual accessibility เพื่อใช้ใน review design system',fields:[['evidence','Evidence ของ system problem','จุดที่ user สับสนเพราะ pattern ไม่สม่ำเสมอ'],['system','System rule ที่ใช้แก้','component/token/behavior ที่กำหนด'],['proof','Proof plan','flow ไหน จะทดสอบกับใคร และเกณฑ์อะไร']]}
    },
    w12:{
      title:'Component Command', subtitle:'W12 • Components, Forms & States', tag:'ACT V • COMPONENT COMMAND',
      intro:'สั่งการ component ให้ช่วย user ไม่ใช่เพิ่มภาระ: ออกแบบ input, card, icon และ feedback state เพื่อป้องกัน error และทำ recovery ได้เร็ว',
      requires:'b4', nextHref:'./w13-prototype-pulse.html', nextLabel:'ไปต่อ W13 • Prototype Pulse', badge:'Component State Engineer',
      stages:[['system','Component Boundary','เลือก component ที่ควรใช้ซ้ำตาม task และ state','component ที่ดีมีความหมายและ behavior ชัด'],['state','Validation State','ออกแบบ validation ให้บอกปัญหาก่อน user ส่งผิด','error ต้องเฉพาะ field และแก้ได้'],['state','Feedback State','ทำให้ user รู้ผลของ action และ next step','อย่าให้ระบบเงียบหลัง action สำคัญ'],['structure','Recovery Path','จัด recovery โดยรักษา context และงานที่ user ทำไว้','อย่าผลัก user กลับไปเริ่มใหม่'],['validate','State Specification Test','ทดสอบ component ใน flow ที่มี error จริง','ต้องดูว่า user กู้คืนได้ไม่ใช่แค่เห็นข้อความ']],
      artifact:{title:'Component State Sheet',lead:'สร้าง specification ของ component สำคัญพร้อม normal/loading/error/success states',fields:[['component','Component + task ที่รองรับ','เช่น upload row สำหรับเอกสารทุน'],['states','State ทั้งหมดที่ต้องออกแบบ','default/loading/error/success/empty/disabled'],['recovery','Recovery rule','เมื่อผิด user เห็นอะไร แก้อะไร และข้อมูลใดยังอยู่']]}
    },
    w13:{
      title:'Prototype Pulse', subtitle:'W13 • Hi-fi Prototype & Microinteraction', tag:'ACT V • PROTOTYPE PULSE',
      intro:'ทำ prototype ที่มี pulse: ทุก trigger ต้องมี feedback ที่ช่วย user เข้าใจ state ไม่ใช่ animation ที่ทำให้รอนานหรือ distract จาก task',
      requires:'w12', nextHref:'./w14-validation-lab.html', nextLabel:'ไปต่อ W14 • Validation Lab', badge:'Prototype Feedback Designer',
      stages:[['frame','Interaction Intent','ระบุ action และ user expectation ก่อนออกแบบ motion','microinteraction ต้องตอบ goal ของ task'],['prototype','Feedback Motion','เลือก motion ที่สื่อการเปลี่ยน state ได้พอดี','motion คือ feedback ไม่ใช่ decoration'],['state','State Continuity','รักษา context ระหว่าง loading, success และ error','user ต้องรู้ว่าเกิดอะไรกับงานเดิม'],['prototype','Hi-fi Scope','เลือก prototype scope ที่ทดสอบ decision และ feedback ได้','ไม่จำเป็นต้อง animate ทุกองค์ประกอบ'],['validate','Interaction Test','ให้ user ทำ task และอธิบายผลของ action','ตรวจ comprehension ไม่ใช่แค่ความสนุกของ motion']],
      artifact:{title:'Prototype Interaction Map',lead:'กำหนด trigger → feedback → state → next action สำหรับ clickable prototype',fields:[['trigger','Trigger / user action','ผู้ใช้กด/กรอก/เลือกอะไร'],['feedback','Feedback & microinteraction','ระบบตอบอย่างไร ระยะเวลาเท่าไร และสื่อ state อะไร'],['next','State / next action','หลัง feedback ผู้ใช้รู้หรือทำอะไรต่อได้']]}
    },
    w14:{
      title:'Validation Lab', subtitle:'W14 • Heuristic, Walkthrough & Usability Test', tag:'ACT V • VALIDATION LAB',
      intro:'เข้าสู่แล็บตรวจหลักฐาน: หา issue จาก heuristic และ cognitive walkthrough จัดลำดับตามผลกระทบ แล้วทดสอบ iteration กับ user จริง',
      requires:'w13', nextHref:'./b5-ux-launch-defense.html', nextLabel:'เข้าสู่ B5 • UX Launch Defense', badge:'Iteration Evidence Lead',
      stages:[['evidence','Heuristic Signal','ระบุ issue จากพฤติกรรมและหลักการใช้งาน','อย่าใช้ checklist แทนการคิดถึง task'],['evidence','Cognitive Walkthrough','เดินตาม user goal, action, feedback และ recovery','ถามว่า user รู้ไหมว่าต้องทำอะไรและเกิดอะไรขึ้น'],['priority','Issue Prioritization','จัดลำดับ issue ตาม severity ต่อ task และความถี่','อย่าแก้สิ่งที่เห็นง่ายก่อนสิ่งที่กระทบ outcome'],['validate','Usability Test Plan','กำหนด task/user/measure ที่ตรวจ iteration ได้','การถามว่าชอบไหมไม่เพียงพอ'],['prototype','Iteration Decision','เลือกการปรับที่ตอบ evidence แล้วทดสอบซ้ำได้','แก้ให้เฉพาะ cause ไม่ใช่เปลี่ยนทั้งหน้า']],
      artifact:{title:'Usability Iteration Log',lead:'บันทึก issue → evidence → priority → change → retest เพื่อใช้ใน final portfolio',fields:[['issue','Issue และ evidence','ผู้ใช้ทำอะไร ติดตรงไหน และผลคืออะไร'],['priority','Priority decision','severity/frequency/impact ต่อ task'],['iteration','Change + retest','จะเปลี่ยนอะไรและพิสูจน์ผลอย่างไร']]}
    },
    b5:{
      title:'UX Launch Defense', subtitle:'B5 • Final Design Studio', tag:'FINAL BOSS • UX LAUNCH DEFENSE',
      intro:'บอสสุดท้าย: นำ evidence, design system, prototype และผลการทดสอบมาป้องกัน UX/UI case study อย่างเป็นมืออาชีพ พร้อมระบุข้อจำกัดและรอบที่ควรพัฒนาต่อ',
      requires:'w14', nextHref:'./index.html', nextLabel:'กลับ Mission Control • Campaign Complete', badge:'UX Launch Defender', boss:true,
      stages:[['evidence','Evidence Ledger','เลือกหลักฐานที่สมควรขึ้นเวที final defense','อย่าเลือกเพียงคำชมหรือภาพสวย'],['frame','Design Decision','เชื่อม user need กับ decision สำคัญ','ทุก feature ต้องตอบ friction ที่ระบุได้'],['prototype','Prototype Proof','เลือก prototype flow ที่แสดง value ของ solution','โชว์ decision point ไม่ใช่เพียงหน้าจอ'],['validate','Validation Verdict','ใช้ผล usability เพื่อบอกสิ่งที่ยืนยันและข้อจำกัด','ผลทดสอบต้องโปร่งใสและนำไป iterate ได้'],['defense','Final Defense','ตอบคำถามวิพากษ์ด้วย evidence → decision → proof','ป้องกันอย่างมีเหตุผล ไม่ปกป้องด้วยรสนิยม'],['portfolio','Portfolio Launch','จัด narrative case study ให้ผู้ชมตรวจเหตุผลได้','portfolio ต้องเล่ากระบวนการ ไม่ใช่ gallery ภาพ']],
      artifact:{title:'Final UX Case Study Defense',lead:'เตรียม final portfolio/presentation ที่เชื่อม user evidence ถึงผล iteration ได้ครบ',fields:[['problem','Problem → evidence → user need','สรุปปัญหาโดยไม่กล่าวเกินหลักฐาน'],['decision','Design system + prototype decision','สิ่งที่เปลี่ยนและเหตุผล'],['proof','Validation + next iteration','ผลที่พิสูจน์ได้ ข้อจำกัด และแผนรอบต่อไป']]}
    }
  };

  const spec = missions[missionId];
  if (!spec) return;

  function makeStage(entry, c){
    const [phaseKey, label, prompt, hint] = entry;
    const lens = phase[phaseKey];
    const answer = lens(c);
    return {
      label,
      prompt:`${prompt}\n\nเลือกทางเลือกที่อธิบาย “${c.service} ในคดีนี้” ได้ดีที่สุด ไม่ใช่คำตอบที่ฟังดีในภาพรวม`,
      hint,
      options:shuffle([{ label:answer.label, description:answer.description, correct:true, rationale:answer.rationale }, ...answer.misses])
    };
  }

  function makeCase(c){
    const stages = {};
    spec.stages.forEach((entry) => { stages[entry[0] + '_' + entry[1].toLowerCase().replace(/[^a-z0-9]+/g,'_')] = makeStage(entry, c); });
    return {
      id:`${missionId}-${c.id}`,
      title:`${spec.title} • ${c.title}`,
      tag:spec.tag,
      service:c.service,
      user:c.user,
      symptom:c.evidence,
      stages
    };
  }

  const bank = CASEFILES.map(makeCase);
  const stageKeys = spec.stages.map((entry) => entry[0] + '_' + entry[1].toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  const stageMeta = Object.fromEntries(spec.stages.map((entry) => {
    const key = entry[0] + '_' + entry[1].toLowerCase().replace(/[^a-z0-9]+/g,'_');
    return [key, { label:entry[1], instruction:entry[3] }];
  }));

  const config = {
    id:missionId,
    eyebrow:spec.tag,
    title:spec.title,
    subtitle:spec.subtitle,
    intro:spec.intro,
    format:`3 casefiles • ${stageKeys.length} decision stages • near-miss distractors • Reason Check`,
    duration:spec.boss ? '15–22 นาที' : '12–18 นาที',
    passText:'≥ 2★ เพื่อปลดล็อก • 3★ ต้องมี Accuracy ≥84% และ Reason Check ≥75%',
    correctLabel:'ตัดสินใจจากหลักฐานและอธิบายเหตุผลได้',
    retryLabel:'กลับไปดู user goal, evidence และผลต่อ task ก่อนเลือกใหม่',
    badge:spec.badge,
    bank,
    bossBank:spec.boss ? bank : undefined,
    caseCount:spec.boss ? 1 : 2,
    stages:stageKeys,
    stageMeta,
    threeStarAccuracy:84,
    threeStarVerified:75,
    recentLimit:spec.boss ? 9 : 7,
    requires:spec.requires,
    nextHref:spec.nextHref,
    nextLabel:spec.nextLabel,
    takeaways:[
      'ตัดสินใจจาก user goal, evidence และ task outcome ไม่ใช่จากสิ่งที่ดูสวยหรือทำง่ายสำหรับทีม',
      'ตัวลวงที่ดีมักมีส่วนถูกบางส่วน แต่ยังไม่อธิบายบริบทหรือไม่ลด friction หลักของคดี',
      'การผ่าน 2★ คือสิทธิ์ไปต่อ ส่วน 3★ คือหลักฐานว่าคุณใช้เหตุผลซ้ำได้กับคดีใหม่'
    ]
  };

  window.UXQFutureMissionSpec = Object.freeze({ missionId, title:spec.title, artifact:spec.artifact, stageKeys, caseIds:bank.map((item) => item.id) });

  function addStyle(){
    if ($('#uxq-future-campaign-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-future-campaign-style';
    style.textContent = `
      .uxq-future-brief{width:min(780px,100%);display:grid;gap:10px;margin:14px auto 0;padding:15px 16px;border:1px solid rgba(110,231,255,.38);border-radius:17px;background:linear-gradient(145deg,rgba(110,231,255,.10),rgba(155,140,255,.10));text-align:left}.uxq-future-brief__eyebrow{font-size:.73rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#74efff}.uxq-future-brief b{color:#fff}.uxq-future-brief p{margin:0;color:#dbe9ff;line-height:1.55}.uxq-future-brief__rule{padding:9px 10px;border-radius:11px;background:rgba(6,16,36,.34);color:#cfe1ff;font-size:.88rem}.uxq-future-studio{width:min(780px,100%);margin:18px auto 0;padding:18px;border-radius:18px;border:1px solid rgba(155,140,255,.55);background:linear-gradient(145deg,rgba(54,42,112,.36),rgba(8,24,52,.70));text-align:left;display:grid;gap:12px}.uxq-future-studio__eyebrow{font-size:.74rem;font-weight:950;color:#d8caff;letter-spacing:.1em;text-transform:uppercase}.uxq-future-studio h2{margin:0;color:#fff;font-size:1.18rem}.uxq-future-studio p{margin:0;color:#dce9ff;line-height:1.55}.uxq-future-studio label{display:grid;gap:6px;font-weight:850;color:#eef5ff}.uxq-future-studio textarea{min-height:82px;resize:vertical;border:1px solid rgba(181,205,255,.3);border-radius:12px;padding:10px 11px;background:rgba(3,13,31,.5);color:#eff7ff;font:inherit;line-height:1.5}.uxq-future-studio textarea:focus{outline:2px solid rgba(110,231,255,.52);outline-offset:2px}.uxq-future-studio__actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.uxq-future-studio button{border:1px solid rgba(155,140,255,.7);border-radius:11px;padding:10px 12px;background:#9b8cff;color:#10162d;font:inherit;font-weight:950;cursor:pointer}.uxq-future-studio small{color:#aeeecf;font-weight:800}.uxq-future-replay{width:min(780px,100%);margin:14px auto 0;padding:13px 15px;border:1px solid rgba(255,209,102,.46);border-radius:15px;background:rgba(255,209,102,.08);text-align:left;color:#fff0c5;line-height:1.55}.uxq-future-replay b{color:#fff}.uxq-future-replay ul{margin:7px 0 0;padding-left:19px;color:#dceaff}@media(max-width:720px){.uxq-future-studio,.uxq-future-brief{border-radius:14px;padding:14px}.uxq-future-studio textarea{min-height:92px}}
    `;
    document.head.appendChild(style);
  }

  function storageKey(){ return `uxq.future.studio.${missionId}.v1`; }
  function readStudio(){ try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); } catch (error) { return {}; } }
  function writeStudio(value){ try { localStorage.setItem(storageKey(), JSON.stringify(value)); return true; } catch (error) { return false; } }

  function renderBrief(){
    const hero = $('.uxq-hero');
    if (!hero || $('.uxq-future-brief', hero)) return;
    const brief = document.createElement('section');
    brief.className = 'uxq-future-brief';
    brief.innerHTML = `<div class="uxq-future-brief__eyebrow">Campaign mission rule</div><b>${esc(spec.title)}</b><p>${esc(spec.intro)}</p><div class="uxq-future-brief__rule"><b>Challenge rule:</b> ตัวเลือกทุกข้ออาจฟังดูดีบางส่วน ให้เลือกสิ่งที่เชื่อม <em>user goal → friction → decision → proof</em> ได้ตรงที่สุด และใช้ Reason Check ยืนยันเหตุผล</div>`;
    const actions = $('.uxq-actions', hero);
    if (actions) actions.insertAdjacentElement('beforebegin', brief); else hero.appendChild(brief);
  }

  function renderStudio(){
    const result = $('.uxq-results');
    if (!result || $('.uxq-future-studio', result)) return;
    const saved = readStudio();
    const artifact = spec.artifact;
    const box = document.createElement('section');
    box.className = 'uxq-future-studio';
    box.innerHTML = `<div class="uxq-future-studio__eyebrow">Studio Artifact • ${esc(missionId.toUpperCase())}</div><h2>${esc(artifact.title)}</h2><p>${esc(artifact.lead)}</p>${artifact.fields.map(([key,label,placeholder]) => `<label>${esc(label)}<textarea data-field="${esc(key)}" placeholder="${esc(placeholder)}">${esc(saved[key] || '')}</textarea></label>`).join('')}<div class="uxq-future-studio__actions"><button type="button" data-save-studio>บันทึก Studio Note ในอุปกรณ์นี้</button><small data-save-status aria-live="polite">Studio Note ยังไม่ถูกส่งไปตัดสินคะแนนอัตโนมัติ</small></div>`;
    const receipt = $('.uxq-submission-receipt', result);
    const coach = $('.uxq-replay-coach', result);
    (coach || receipt || result.lastElementChild)?.insertAdjacentElement('afterend', box);
    $('[data-save-studio]', box)?.addEventListener('click', () => {
      const values = {};
      box.querySelectorAll('textarea[data-field]').forEach((field) => { values[field.dataset.field] = field.value.trim(); });
      const ok = writeStudio({ savedAt:new Date().toISOString(), values, ...values });
      const status = $('[data-save-status]', box);
      status.textContent = ok ? 'บันทึก Studio Note ในอุปกรณ์นี้แล้ว — นำไปใช้ต่อในใบงาน/ชิ้นงานได้' : 'ยังบันทึกไม่ได้ในอุปกรณ์นี้ โปรดคัดลอกข้อความเก็บไว้';
    });
  }

  function renderReplay(){
    const result = $('.uxq-results');
    if (!result || $('.uxq-future-replay', result)) return;
    const notice = document.createElement('section');
    notice.className = 'uxq-future-replay';
    notice.innerHTML = `<b>Replay Challenge:</b> รอบต่อไปคดีและตำแหน่งคำตอบจะสลับ ให้พยายามอธิบายก่อนเลือกว่า (1) user กำลังพยายามทำอะไร (2) friction อยู่ตรงไหน (3) ทางเลือกใดลด friction และ (4) จะพิสูจน์ผลอย่างไร<ul><li>2★ = ผ่านเพื่อเดินทางต่อ</li><li>3★ = ใช้เหตุผลได้สม่ำเสมอกับคดีใหม่</li></ul>`;
    result.appendChild(notice);
  }

  function decorate(){
    addStyle();
    renderBrief();
    renderStudio();
    renderReplay();
  }

  UXQMissionEngine.init(config);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { decorate(); new MutationObserver(() => requestAnimationFrame(decorate)).observe(document.documentElement, {childList:true,subtree:true}); }, {once:true});
  else { decorate(); new MutationObserver(() => requestAnimationFrame(decorate)).observe(document.documentElement, {childList:true,subtree:true}); }
})();
