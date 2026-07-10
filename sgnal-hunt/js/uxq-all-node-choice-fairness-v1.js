/* CSAI2601 UX Quest • All-node Choice & Reason Fairness Guard v3
   v42: fixes the real issue reported in class testing.
   - main question prompt is stage-specific, not repeated generic text
   - main choices are short and balanced
   - Reason Check choices are stage-specific and not the same global template
   - scoring is preserved by keeping original data-choice / data-reason ids
*/
(() => {
  'use strict';

  const VERSION = 'v20260709-choice-reason-fairness-v42';
  const qs = new URLSearchParams(location.search);
  const NODE = String(qs.get('node') || qs.get('id') || 'W1').toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE)) return;

  const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const txt = (sel) => clean(document.querySelector(sel)?.textContent || '');
  const byData = (root, name) => Array.from(root.querySelectorAll(`[data-${name}]`)).filter(b => b.offsetParent !== null);

  const packs = [
    {
      key:'color', re:/color|สี|status color|status meaning|token/i,
      ask:'สีใดช่วยสื่อสถานะและลดการตัดสินใจผิด',
      note:'เลือกจากความหมายของสถานะ ไม่ใช่จากความสวย',
      choices:['กำหนดสีตามสถานะ','ใส่สีหลายแบบ','ใช้สีตามความชอบ','ใช้สีเดียวทุกสถานะ'],
      reasons:['เพราะสีต้องบอก error/success/warning ได้','เพราะยิ่งมีสีเยอะยิ่งดูเด่น','เพราะทีมชอบโทนนี้มากกว่า','เพราะใช้สีเดียวจะเรียบร้อยกว่า']
    },
    {
      key:'type', re:/typography|type|font|heading|ตัวอักษร|หัวข้อ/i,
      ask:'ตัวอักษรแบบใดช่วยให้ผู้ใช้เห็นลำดับข้อมูลก่อนหลัง',
      note:'มอง heading/body/status ไม่ใช่แค่ขนาดสวย',
      choices:['จัด heading ให้ชัด','ทำทุกข้อความเท่ากัน','ใช้ฟอนต์หลายแบบ','ลดช่องไฟให้แน่น'],
      reasons:['เพราะ hierarchy ช่วยให้สแกนงานสำคัญก่อน','เพราะเท่ากันหมดดูเป็นระเบียบ','เพราะหลายฟอนต์ทำให้ดูสนุก','เพราะแน่นขึ้นทำให้ใส่ข้อมูลได้มาก']
    },
    {
      key:'contrast', re:/contrast|readability|accessibility|อ่าน|คอนทราสต์/i,
      ask:'แนวทางใดช่วยให้อ่านและใช้งานได้จริง',
      note:'ตัดสินจาก readability และ accessibility',
      choices:['เพิ่ม contrast ให้อ่านได้','เลือกสีจางสวย','ลดตัวอักษรให้เล็ก','ใช้ภาพแทนข้อความ'],
      reasons:['เพราะอ่านชัดขึ้นและลด error ระหว่างทำ task','เพราะสีจางทำให้หน้าดูนุ่มกว่า','เพราะตัวเล็กทำให้ดูสะอาด','เพราะภาพสวยช่วยแทนเนื้อหาได้เสมอ']
    },
    {
      key:'spacing', re:/spacing|white space|ระยะห่าง|ช่องว่าง/i,
      ask:'ระยะห่างแบบใดช่วยลด cognitive load',
      note:'ดูการจัดกลุ่มและการอ่าน ไม่ใช่พื้นที่ว่างอย่างเดียว',
      choices:['จัดกลุ่มด้วย spacing','อัดข้อมูลให้เต็มหน้า','เว้นช่องว่างแบบสุ่ม','ซ่อนข้อมูลรองทั้งหมด'],
      reasons:['เพราะ spacing ช่วยแบ่งกลุ่มและนำสายตา','เพราะข้อมูลแน่นทำให้ครบกว่า','เพราะเว้นสุ่มทำให้ดูมีมิติ','เพราะซ่อนหมดจะทำให้หน้าโล่ง']
    },
    {
      key:'visual', re:/visual|style|signal|guide|สัญญาณภาพ/i,
      ask:'กติกาภาพแบบใดควรถูกบันทึกไว้ใน style guide',
      note:'เลือก rule ที่ใช้ซ้ำได้ทั้งระบบ',
      choices:['บันทึก visual rule','เลือกภาพที่ชอบที่สุด','ปรับทีละหน้าเอง','ใช้สีแทนทุกอย่าง'],
      reasons:['เพราะ rule ทำให้หน้าตาและความหมายสม่ำเสมอ','เพราะภาพที่ชอบทำให้ดูดีทันที','เพราะปรับทีละหน้าจะยืดหยุ่นกว่า','เพราะสีอย่างเดียวสื่อสารได้ครบ']
    },

    { key:'friction', re:/friction|pain|stuck|ติดขัด|สะดุด/i, ask:'หลักฐานใดชี้ว่าผู้ใช้ติดงานหลักจริง', note:'หาหลักฐานจาก task ไม่ใช่ความสวย', choices:['ชี้จุดที่ task สะดุด','เลือกจุดที่ดูไม่สวย','เลือกเสียงทีมดังสุด','เลือกที่แก้ง่ายสุด'], reasons:['เพราะผูกกับ task failure ของผู้ใช้','เพราะหน้าตาเก่าคือปัญหาหลัก','เพราะทีมเห็นตรงกันจึงพอแล้ว','เพราะแก้ง่ายจึงควรทำก่อน'] },
    { key:'goal', re:/goal|need|user goal|เป้าหมาย/i, ask:'เป้าหมายใดเป็นงานหลักของผู้ใช้ในสถานการณ์นี้', note:'ดูสิ่งที่ผู้ใช้ต้องทำให้สำเร็จ', choices:['จับงานหลักของผู้ใช้','เลือกสิ่งที่ผู้ใช้น่าชอบ','รวมทุก goal เท่ากัน','เลือกข้อมูลที่เยอะสุด'], reasons:['เพราะ goal ต้องผูกกับ outcome ที่ตรวจได้','เพราะความชอบคือเป้าหมายเสมอ','เพราะทุกเป้าหมายควรเด่นเท่ากัน','เพราะข้อมูลเยอะทำให้ตัดสินใจดีขึ้น'] },
    { key:'impact', re:/impact|failure|ผลกระทบ|task failure/i, ask:'ผลกระทบใดทำให้ task ของผู้ใช้ไม่สำเร็จ', note:'แยกผลต่อพฤติกรรมออกจากหน้าตา', choices:['แยกผลกระทบต่อ task','นับเป็น UI ทั้งหมด','ถือว่าโค้ดเร็วก็พอ','สรุปว่าเป็นความสวย'], reasons:['เพราะ impact ต้องชี้ผลต่อการทำงานจริง','เพราะทุกอย่างบนจอคือ UI เท่านั้น','เพราะถ้าเร็วขึ้นผู้ใช้จะเข้าใจเอง','เพราะหน้าสวยทำให้ UX ดีเสมอ'] },
    { key:'fix', re:/fix|repair|decision|choose|แก้|ปรับ/i, ask:'แนวแก้ใดลดปัญหาหลักและยังวัดผลได้', note:'fix ต้องโยงกับ friction ไม่ใช่เพิ่มของใหม่', choices:['เลือก fix ที่วัดผลได้','เพิ่มคำอธิบายทุกจุด','เลือกที่ทีมทำง่าย','ทำให้ทันสมัยก่อน'], reasons:['เพราะแก้จากสาเหตุและตรวจผลหลังปรับได้','เพราะข้อความเยอะช่วยให้เข้าใจแน่','เพราะทีมทำเร็วคือผลลัพธ์ที่ดี','เพราะความทันสมัยลด friction ได้เสมอ'] },
    { key:'proof', re:/proof|test|validate|retest|พิสูจน์|ทดสอบ|วัด/i, ask:'หลักฐานใดพิสูจน์ว่าหลังปรับแล้วดีขึ้นจริง', note:'วัดพฤติกรรม ไม่ใช่ถามชอบอย่างเดียว', choices:['วัด task success หลังใช้','ถามว่าชอบหรือไม่','ดูยอดเข้าหน้าเว็บ','ให้ทีมโหวตดีไซน์'], reasons:['เพราะ proof ต้องเห็น behavior และ outcome','เพราะชอบมากกว่าคือใช้งานดีเสมอ','เพราะ traffic สูงแปลว่า task สำเร็จ','เพราะทีมออกแบบตัดสินแทนผู้ใช้ได้'] },

    { key:'evidence', re:/evidence|หลักฐาน|classify|ข้อมูล/i, ask:'ข้อมูลใดใช้เป็น evidence ก่อนออกแบบได้จริง', note:'แยกหลักฐานออกจากความเห็น', choices:['จัด evidence ให้ตรงปัญหา','ใช้ความเห็นแทนข้อมูล','เลือกข้อมูลที่เยอะสุด','ข้ามข้อมูลที่ขัดแย้ง'], reasons:['เพราะ evidence ต้องตอบปัญหาและตรวจกลับได้','เพราะความเห็นเร็วกว่าเก็บข้อมูล','เพราะข้อมูลเยอะย่อมน่าเชื่อกว่า','เพราะข้อมูลขัดแย้งทำให้งานช้า'] },
    { key:'hcd', re:/HCD|human|process|กระบวนการ/i, ask:'ขั้นตอนใดทำให้การออกแบบเริ่มจากผู้ใช้จริง', note:'อย่าเริ่มจาก solution ก่อน evidence', choices:['เริ่มจากผู้ใช้จริง','เริ่มจากหน้าจอสวย','เริ่มจาก feature ใหม่','เริ่มจากสิ่งที่ทำง่าย'], reasons:['เพราะ HCD ต้องเข้าใจคนและบริบทก่อนตัดสินใจ','เพราะหน้าสวยช่วยให้คนชอบก่อน','เพราะ feature ใหม่ทำให้ระบบดูทันสมัย','เพราะงานง่ายช่วยให้เสร็จเร็ว'] },
    { key:'assumption', re:/assumption|สมมติฐาน|trap/i, ask:'ข้อความใดควรจัดเป็น assumption ที่ต้องตรวจสอบ', note:'จับสิ่งที่ทีมเดาเองก่อนใช้เป็นข้อสรุป', choices:['แยก assumption ออก','เชื่อเดาแรกของทีม','ใช้ตัวอย่างเดียวพอ','ข้ามการตรวจสอบ'], reasons:['เพราะ assumption ยังไม่ใช่หลักฐานจนกว่าจะตรวจ','เพราะทีมรู้ระบบดีที่สุด','เพราะตัวอย่างเดียวประหยัดเวลา','เพราะตรวจมากเกินทำให้งานช้า'] },
    { key:'research', re:/interview|question|ถาม|วิจัย/i, ask:'คำถามใดช่วยหา pain point โดยไม่ชี้นำ', note:'ถามให้เห็นพฤติกรรมและเหตุผล', choices:['ถามเพื่อหาเหตุผลจริง','ถามนำให้ตอบตามเรา','ถามกว้างจนจับไม่ได้','ถามเฉพาะความชอบ'], reasons:['เพราะคำถามดีต้องเปิดหลักฐานจากผู้ใช้','เพราะถามนำช่วยยืนยันไอเดียเร็ว','เพราะคำถามกว้างได้คำตอบเยอะ','เพราะความชอบคือ pain point หลัก'] },
    { key:'problem', re:/insight|root|problem|HMW|ปัญหา/i, ask:'กรอบปัญหาใดต่อจาก insight ได้เหมาะที่สุด', note:'อย่าข้าม root cause ไป solution', choices:['เขียนจาก root cause','เริ่มจาก solution','เขียนให้กว้างที่สุด','รวมหลายปัญหาในข้อเดียว'], reasons:['เพราะ problem frame ต้องชี้สาเหตุและขอบเขต','เพราะ solution ทำให้เห็นภาพเร็วกว่า','เพราะกว้างไว้ก่อนจะครอบคลุม','เพราะรวมหลายเรื่องช่วยประหยัดเวลา'] },

    { key:'flow', re:/flow|path|journey|IA|navigation|ขั้นตอน/i, ask:'ลำดับใดช่วยให้ผู้ใช้ไปถึงงานหลักได้ไม่หลงทาง', note:'ดู happy path และ error path', choices:['จัด flow ตาม task','ใส่ทุกเมนูหน้าแรก','ข้าม error path','จัดตามเมนูเดิม'], reasons:['เพราะ flow ต้องพาผู้ใช้ผ่านงานหลักได้ต่อเนื่อง','เพราะเมนูมากทำให้เลือกได้ครบ','เพราะ error path ไม่ค่อยเกิดจึงข้ามได้','เพราะของเดิมลดงานทีมได้'] },
    { key:'wireframe', re:/wireframe|layout|grid|card|priority|hierarchy/i, ask:'layout ใดช่วยให้ผู้ใช้เห็นสิ่งสำคัญก่อน', note:'จัดลำดับตาม goal และ context', choices:['จัด priority ตาม goal','ทำทุกส่วนเด่นเท่ากัน','ซ่อน CTA สำคัญ','เลือก layout ที่สวยสุด'], reasons:['เพราะ wireframe ต้องพาไปสู่ action หลัก','เพราะทุกส่วนสำคัญจึงต้องเด่นเท่ากัน','เพราะ CTA ไว้ท้ายหน้าจะดูสะอาด','เพราะ layout สวยทำให้ task สำเร็จ'] },
    { key:'cta', re:/CTA|button|action|ปุ่ม/i, ask:'CTA ใดควรเด่นที่สุดในรอบนี้', note:'เลือก action ที่ตอบ task ปัจจุบัน', choices:['วาง CTA ตามงานหลัก','เพิ่มหลายปุ่มพร้อมกัน','ทำปุ่มใหญ่ทุกปุ่ม','ย้าย CTA ไปท้ายหน้า'], reasons:['เพราะ CTA ต้องนำผู้ใช้ไป next step ที่ถูกต้อง','เพราะปุ่มหลายปุ่มเพิ่มทางเลือกเสมอ','เพราะปุ่มใหญ่ทุกปุ่มช่วยให้เห็นครบ','เพราะท้ายหน้าทำให้ดูเรียบร้อย'] },
    { key:'mobile', re:/mobile|responsive|touch|breakpoint/i, ask:'การปรับใดช่วยให้ใช้งานบนมือถือได้จริง', note:'ดู touch target และลำดับข้อมูล', choices:['เพิ่ม touch target สำคัญ','ย่อ desktop ลงมือถือ','ซ่อนขั้นตอนหลัก','ใช้ hover เป็นหลัก'], reasons:['เพราะ mobile ต้องแตะง่ายและไม่บังงานหลัก','เพราะย่อ desktop จะได้เหมือนกันทุกจอ','เพราะซ่อนขั้นตอนทำให้จอสั้นลง','เพราะ hover ช่วยประหยัดพื้นที่'] },

    { key:'pattern', re:/pattern|component|design system/i, ask:'กติกาใดทำให้ interface ทั้งระบบสม่ำเสมอ', note:'เลือก pattern ที่ใช้ซ้ำได้', choices:['ใช้ pattern สม่ำเสมอ','ทำปุ่มใหม่ทุกหน้า','เปลี่ยนชื่อ component','ใช้สีตามแต่ละทีม'], reasons:['เพราะ pattern ลดความสับสนข้ามหน้า','เพราะแต่ละหน้าควรมีเอกลักษณ์','เพราะชื่อหลากหลายช่วยจำง่าย','เพราะแต่ละทีมควรเลือกสีเอง'] },
    { key:'state', re:/state|feedback|loading|error/i, ask:'feedback ใดทำให้ผู้ใช้รู้สถานะของระบบ', note:'บอก state และ next step ให้ชัด', choices:['แสดง state ให้ชัด','ซ่อน feedback','ใช้ข้อความกำกวม','ไม่บอก next step'], reasons:['เพราะ state ชัดช่วยลดความลังเลและการกดซ้ำ','เพราะซ่อน feedback ทำให้หน้าไม่รก','เพราะข้อความกว้างใช้ได้หลายกรณี','เพราะผู้ใช้ควรเดา next step ได้เอง'] },
    { key:'copy', re:/microcopy|wording|copy|ข้อความ/i, ask:'ข้อความใดช่วยให้ผู้ใช้ตัดสินใจถูกตอนเกิดปัญหา', note:'เขียนสั้น ชัด และบอกทางออก', choices:['เขียน copy ช่วยตัดสินใจ','เขียนยาวทุกจุด','ใช้ศัพท์เทคนิค','ไม่อธิบาย error'], reasons:['เพราะ microcopy ต้องบอกปัญหาและทางแก้ถัดไป','เพราะยิ่งยาวยิ่งครบถ้วน','เพราะศัพท์เทคนิคทำให้ดูแม่น','เพราะ error ไม่ควรทำให้ผู้ใช้กังวล'] },
    { key:'prototype', re:/prototype|link|interaction/i, ask:'prototype ควรเชื่อมอะไรเพื่อทดสอบ task ได้จริง', note:'อย่าทดสอบเฉพาะหน้าสวย', choices:['เชื่อมลิงก์ตาม task','เชื่อมเฉพาะหน้าหลัก','ไม่ทำ error path','ปล่อยปุ่มบางจุดว่าง'], reasons:['เพราะ prototype ต้องให้ผู้ใช้ทำ task ได้ครบเส้นทาง','เพราะหน้าหลักพอให้เห็นภาพรวม','เพราะ error path ทำทีหลังได้','เพราะปุ่มว่างไม่กระทบการสาธิต'] },
    { key:'severity', re:/severity|evaluation|finding|priority/i, ask:'ควรจัดลำดับปัญหาจากหลักฐานใด', note:'ดู impact และจำนวนผู้ใช้ที่ได้รับผล', choices:['จัด severity ตาม impact','แก้สิ่งที่ง่ายก่อน','แก้ตามความชอบ','ไม่วาง retest'], reasons:['เพราะ severity ต้องสะท้อนผลต่อ task และความเสี่ยง','เพราะง่ายก่อนจะทำให้เสร็จเร็ว','เพราะความชอบบอกความสำคัญได้','เพราะแก้แล้วไม่จำเป็นต้องทดสอบซ้ำ'] },
    { key:'portfolio', re:/portfolio|defense|rationale/i, ask:'คำอธิบายใดทำให้ portfolio ป้องกันคำถามได้', note:'เล่าจาก evidence ไป decision', choices:['อธิบายด้วย evidence','โชว์ภาพอย่างเดียว','เล่า feature ทั้งหมด','ข้ามข้อจำกัด'], reasons:['เพราะ defense ต้องเชื่อม evidence กับ decision','เพราะภาพสวยอธิบายได้เอง','เพราะ feature มากแปลว่างานดี','เพราะข้อจำกัดทำให้งานดูอ่อน'] },
    { key:'rag', re:/RAG|citation|retrieval|source|hallucination/i, ask:'วิธีใดลดความเสี่ยงจากคำตอบ GenAI/RAG', note:'ตรวจ source และ citation ก่อนใช้', choices:['ตรวจ source กับ citation','เชื่อคำตอบที่ลื่น','ไม่ตรวจ retrieval','ใช้เอกสารเก่าเงียบ ๆ'], reasons:['เพราะต้องยืนยันว่า answer ตรงกับ evidence จริง','เพราะคำตอบลื่นมักน่าเชื่อถือกว่า','เพราะ retrieval ทำงานอัตโนมัติอยู่แล้ว','เพราะเอกสารเก่าช่วยให้ตอบเร็ว'] }
  ];

  const fallback = {
    ask:'เลือกคำตอบที่ตรงกับหลักฐานและงานของรอบนี้',
    note:'ตัดสินจาก context, task และผลที่ตรวจได้',
    choices:['เลือกจากหลักฐานจริง','เลือกตามความชอบ','เลือกตามทีม','เลือกที่เร็วสุด'],
    reasons:['เพราะเชื่อม evidence กับ task outcome','เพราะความชอบคือหลักฐานพอแล้ว','เพราะทีมทำงานกับระบบทุกวัน','เพราะเร็วที่สุดมักดีที่สุด']
  };

  function stageText(scope=document) {
    return [
      txt('.hud .meter b'), txt('.case .kicker'), txt('.case h1'), txt('.case p'),
      scope.querySelector?.('p')?.textContent || '', txt('.question .hint')
    ].map(clean).join(' • ');
  }
  function currentPack(scope=document) {
    const all = stageText(scope);
    return packs.find(p => p.re.test(all)) || fallback;
  }
  function optionIndex(button) {
    return Math.max(0, Array.from(button.closest('.options')?.children || []).indexOf(button));
  }
  function isCorrectChoice(button) { return /^c\d*/i.test(String(button.dataset.choice || button.getAttribute('data-choice') || '')); }
  function distractorIndex(button) {
    const m = String(button.dataset.choice || button.getAttribute('data-choice') || '').match(/^d\d+-(\d+)/i);
    return m ? Number(m[1]) : Math.max(0, optionIndex(button)-1);
  }
  function isCorrectReason(button) {
    const id = String(button.dataset.reason || button.getAttribute('data-reason') || '');
    return /-0$/.test(id);
  }
  function reasonWrongIndex(button) {
    const m = String(button.dataset.reason || button.getAttribute('data-reason') || '').match(/-(\d+)$/);
    const raw = m ? Number(m[1]) : optionIndex(button);
    return Math.max(0, raw - 1);
  }
  function setButton(button, label, sub='') {
    const choice = button.getAttribute('data-choice');
    const reason = button.getAttribute('data-reason');
    const letter = String.fromCharCode(65 + optionIndex(button));
    button.innerHTML = `<span class="uxqFairLetter">${letter}</span><span class="uxqFairText"></span>${sub ? '<span class="uxqFairSub"></span>' : ''}`;
    button.querySelector('.uxqFairText').textContent = label;
    const subEl = button.querySelector('.uxqFairSub');
    if (subEl) subEl.textContent = sub;
    if (choice) button.setAttribute('data-choice', choice);
    if (reason) button.setAttribute('data-reason', reason);
  }
  function applyQuestion() {
    const q = document.querySelector('.question');
    if (!q || q.dataset.uxqFairQuestion === VERSION) return;
    if (q.querySelector('.feedback')) return;
    const pack = currentPack(q);
    const prompt = q.querySelector('.prompt');
    const ins = q.querySelector('.instruction');
    if (prompt) prompt.textContent = pack.ask;
    if (ins) ins.textContent = pack.note;
    const buttons = byData(q, 'choice').slice(0,4);
    if (buttons.length === 4) {
      buttons.forEach((b) => {
        const label = isCorrectChoice(b) ? pack.choices[0] : pack.choices[1 + (distractorIndex(b) % 3)];
        setButton(b, label);
      });
      badge(q, 'choice fairness: stage-specific');
    }
    q.dataset.uxqFairQuestion = VERSION;
  }
  function applyVerify() {
    const v = document.querySelector('.verify');
    if (!v || v.dataset.uxqFairVerify === VERSION) return;
    const pack = currentPack(v);
    const h = v.querySelector('h3');
    const p = v.querySelector('p');
    if (h) h.textContent = 'ตรวจเหตุผลเฉพาะรอบนี้';
    if (p) p.textContent = pack.ask.replace(/^เลือก|^หลักฐาน|^วิธี|^แนวทาง/, 'ทำไม') || pack.ask;
    const buttons = byData(v, 'reason').slice(0,4);
    if (buttons.length === 4) {
      buttons.forEach((b) => {
        const label = isCorrectReason(b) ? pack.reasons[0] : pack.reasons[1 + (reasonWrongIndex(b) % 3)];
        setButton(b, label);
      });
      badge(v, 'reason fairness: no repeated template');
    }
    v.dataset.uxqFairVerify = VERSION;
  }
  function badge(scope, text) {
    if (scope.querySelector('.uxqFairnessBadge')) return;
    const d = document.createElement('div');
    d.className = 'uxqFairnessBadge';
    d.textContent = `✅ ${text}`;
    const target = scope.querySelector('.prompt, h3, h2') || scope.firstElementChild;
    target?.parentElement?.insertBefore(d, target.nextSibling);
  }
  function css() {
    if (document.getElementById('uxqChoiceReasonFairnessV42CSS')) return;
    const s = document.createElement('style');
    s.id = 'uxqChoiceReasonFairnessV42CSS';
    s.textContent = `
      .uxqFairnessBadge{display:inline-flex;align-items:center;margin:.45rem 0 .75rem;padding:.34rem .68rem;border:1px solid rgba(94,234,212,.55);background:rgba(20,184,166,.14);color:#bbf7d0;border-radius:999px;font-weight:900;font-size:.78rem}
      .option .uxqFairLetter{display:inline-grid;place-items:center;min-width:1.85rem;height:1.5rem;margin-right:.55rem;border:1px solid rgba(103,232,249,.65);background:rgba(8,145,178,.22);color:#a5f3fc;border-radius:999px;font-weight:1000;font-size:.76rem;line-height:1}
      .option .uxqFairText{display:inline;line-height:1.32;overflow-wrap:anywhere}
      .option .uxqFairSub{display:block;margin-top:.45rem;color:#a9b9d9;font-size:.82rem;line-height:1.35}
      .question>.options .option,.verify .options .option{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;min-height:5.2rem!important;display:block!important}
      .verify .options .option{min-height:5.8rem!important}
    `;
    document.head.appendChild(s);
  }
  function run() { css(); applyQuestion(); applyVerify(); }
  function boot() {
    run();
    let t = 0;
    const schedule = () => { clearTimeout(t); t = setTimeout(run, 40); };
    new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true, characterData:true });
    window.addEventListener('click', () => setTimeout(run, 80), true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
