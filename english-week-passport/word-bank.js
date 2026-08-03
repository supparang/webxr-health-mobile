(function () {
  "use strict";

  const items = [
    { id:"wm01", zone:"word_match", type:"meaning", prompt:"คำว่า “journey” หมายถึงข้อใด", visual:"🧳", options:["การเดินทาง","การแข่งขัน","การประชุม","การซ่อมแซม"], answer:"การเดินทาง", explanation:"journey หมายถึง การเดินทาง โดยเฉพาะการเดินทางที่มีระยะหรือมีเรื่องราว" },
    { id:"wm02", zone:"word_match", type:"meaning", prompt:"คำว่า “healthy” หมายถึงข้อใด", visual:"🥗", options:["มีสุขภาพดี","มีราคาแพง","มีชื่อเสียง","มีความเร่งด่วน"], answer:"มีสุขภาพดี", explanation:"healthy ใช้อธิบายคน อาหาร หรือพฤติกรรมที่ส่งเสริมสุขภาพ" },
    { id:"wm03", zone:"word_match", type:"meaning", prompt:"คำว่า “environment” หมายถึงข้อใด", visual:"🌱", options:["สิ่งแวดล้อม","การศึกษา","การคมนาคม","ความปลอดภัย"], answer:"สิ่งแวดล้อม", explanation:"environment คือสิ่งแวดล้อมหรือสภาพแวดล้อมรอบตัว" },
    { id:"wm04", zone:"word_match", type:"meaning", prompt:"คำว่า “device” หมายถึงข้อใด", visual:"📱", options:["อุปกรณ์","เอกสาร","สถานที่","กิจกรรม"], answer:"อุปกรณ์", explanation:"device หมายถึงอุปกรณ์หรือเครื่องมือ โดยเฉพาะอุปกรณ์อิเล็กทรอนิกส์" },
    { id:"wm05", zone:"word_match", type:"meaning", prompt:"คำว่า “volunteer” หมายถึงข้อใด", visual:"🙋", options:["อาสาสมัคร","ผู้จัดการ","ผู้โดยสาร","ผู้แข่งขัน"], answer:"อาสาสมัคร", explanation:"volunteer คือผู้ที่ช่วยงานด้วยความสมัครใจ" },
    { id:"wm06", zone:"word_match", type:"meaning", prompt:"คำว่า “creative” หมายถึงข้อใด", visual:"🎨", options:["สร้างสรรค์","เงียบสงบ","รอบคอบ","เป็นทางการ"], answer:"สร้างสรรค์", explanation:"creative หมายถึงมีความคิดใหม่และสร้างสิ่งที่น่าสนใจ" },
    { id:"wm07", zone:"word_match", type:"meaning", prompt:"คำว่า “protect” หมายถึงข้อใด", visual:"🛡️", options:["ปกป้อง","เปรียบเทียบ","จัดเตรียม","ค้นหา"], answer:"ปกป้อง", explanation:"protect หมายถึงทำให้คนหรือสิ่งของปลอดภัยจากอันตราย" },
    { id:"wm08", zone:"word_match", type:"meaning", prompt:"คำว่า “community” หมายถึงข้อใด", visual:"🏘️", options:["ชุมชน","ห้องเรียน","การแข่งขัน","เทคโนโลยี"], answer:"ชุมชน", explanation:"community คือกลุ่มคนที่อยู่ร่วมกันหรือมีความสนใจร่วมกัน" },
    { id:"wm09", zone:"word_match", type:"meaning", prompt:"คำว่า “improve” หมายถึงข้อใด", visual:"📈", options:["พัฒนาให้ดีขึ้น","หยุดชั่วคราว","แบ่งออกเป็นส่วน","ลดความสำคัญ"], answer:"พัฒนาให้ดีขึ้น", explanation:"improve หมายถึงทำให้ดีขึ้นหรือมีคุณภาพมากขึ้น" },
    { id:"wm10", zone:"word_match", type:"meaning", prompt:"คำว่า “opportunity” หมายถึงข้อใด", visual:"🚪", options:["โอกาส","อุปสรรค","คำเตือน","กฎระเบียบ"], answer:"โอกาส", explanation:"opportunity คือสถานการณ์ที่เปิดโอกาสให้ทำสิ่งที่ต้องการ" },
    { id:"wm11", zone:"word_match", type:"meaning", prompt:"คำว่า “schedule” หมายถึงข้อใด", visual:"🗓️", options:["กำหนดการ","คะแนน","พจนานุกรม","เครื่องแบบ"], answer:"กำหนดการ", explanation:"schedule คือแผนเวลา กำหนดการ หรือตารางกิจกรรม" },
    { id:"wm12", zone:"word_match", type:"meaning", prompt:"คำว่า “confident” หมายถึงข้อใด", visual:"💪", options:["มั่นใจ","กังวล","เหนื่อยล้า","สับสน"], answer:"มั่นใจ", explanation:"confident หมายถึงเชื่อมั่นในความสามารถของตนเอง" },

    { id:"cf01", zone:"category_forest", type:"category", prompt:"คำว่า “passport” อยู่ในหมวดใด", visual:"🛂", options:["Travel","Health","Technology","Environment"], answer:"Travel", explanation:"passport เป็นเอกสารสำคัญสำหรับการเดินทางระหว่างประเทศ" },
    { id:"cf02", zone:"category_forest", type:"category", prompt:"คำว่า “keyboard” อยู่ในหมวดใด", visual:"⌨️", options:["Technology","Food","Travel","Health"], answer:"Technology", explanation:"keyboard เป็นอุปกรณ์สำหรับป้อนข้อมูลเข้าสู่คอมพิวเตอร์" },
    { id:"cf03", zone:"category_forest", type:"category", prompt:"คำว่า “recycle” อยู่ในหมวดใด", visual:"♻️", options:["Environment","Career","Food","Travel"], answer:"Environment", explanation:"recycle เกี่ยวข้องกับการนำวัสดุกลับมาใช้ใหม่เพื่อลดขยะ" },
    { id:"cf04", zone:"category_forest", type:"category", prompt:"คำว่า “nutrition” อยู่ในหมวดใด", visual:"🍎", options:["Health","Technology","Travel","Career"], answer:"Health", explanation:"nutrition หมายถึงโภชนาการและสารอาหารที่ร่างกายต้องการ" },
    { id:"cf05", zone:"category_forest", type:"category", prompt:"คำว่า “interview” อยู่ในหมวดใด", visual:"🧑‍💼", options:["Career","Environment","Food","Travel"], answer:"Career", explanation:"interview เป็นขั้นตอนสำคัญในการสมัครงานหรือการคัดเลือก" },
    { id:"cf06", zone:"category_forest", type:"category", prompt:"คำว่า “boarding pass” อยู่ในหมวดใด", visual:"✈️", options:["Travel","Health","Technology","Environment"], answer:"Travel", explanation:"boarding pass เป็นเอกสารสำหรับขึ้นเครื่องบิน" },
    { id:"cf07", zone:"category_forest", type:"category", prompt:"คำว่า “password” อยู่ในหมวดใด", visual:"🔐", options:["Technology","Food","Health","Travel"], answer:"Technology", explanation:"password ใช้ยืนยันตัวตนและปกป้องบัญชีดิจิทัล" },
    { id:"cf08", zone:"category_forest", type:"category", prompt:"คำว่า “pollution” อยู่ในหมวดใด", visual:"🏭", options:["Environment","Career","Food","Travel"], answer:"Environment", explanation:"pollution หมายถึงมลพิษที่ส่งผลต่อสิ่งแวดล้อม" },
    { id:"cf09", zone:"category_forest", type:"category", prompt:"คำว่า “exercise” อยู่ในหมวดใด", visual:"🏃", options:["Health","Technology","Travel","Career"], answer:"Health", explanation:"exercise คือการออกกำลังกายเพื่อเสริมสร้างสุขภาพ" },
    { id:"cf10", zone:"category_forest", type:"category", prompt:"คำว่า “resume” อยู่ในหมวดใด", visual:"📄", options:["Career","Environment","Food","Travel"], answer:"Career", explanation:"resume คือเอกสารสรุปประวัติการศึกษาและประสบการณ์เพื่อสมัครงาน" },
    { id:"cf11", zone:"category_forest", type:"category", prompt:"คำว่า “ingredient” อยู่ในหมวดใด", visual:"🥣", options:["Food","Technology","Travel","Career"], answer:"Food", explanation:"ingredient หมายถึงส่วนประกอบหรือวัตถุดิบในการทำอาหาร" },
    { id:"cf12", zone:"category_forest", type:"category", prompt:"คำว่า “destination” อยู่ในหมวดใด", visual:"📍", options:["Travel","Health","Food","Technology"], answer:"Travel", explanation:"destination คือจุดหมายปลายทางของการเดินทาง" },

    { id:"sc01", zone:"sentence_city", type:"context", prompt:"Students should ___ enough water during hot weather.", visual:"💧", options:["drink","build","repair","borrow"], answer:"drink", explanation:"drink water เป็นกลุ่มคำที่ใช้ตามธรรมชาติ หมายถึงดื่มน้ำ" },
    { id:"sc02", zone:"sentence_city", type:"context", prompt:"Please ___ your password private.", visual:"🔒", options:["keep","grow","catch","paint"], answer:"keep", explanation:"keep something private หมายถึงเก็บสิ่งนั้นเป็นความลับ" },
    { id:"sc03", zone:"sentence_city", type:"context", prompt:"We should ___ plastic waste to protect the environment.", visual:"♻️", options:["reduce","invite","print","measure"], answer:"reduce", explanation:"reduce waste หมายถึงลดปริมาณขยะ" },
    { id:"sc04", zone:"sentence_city", type:"context", prompt:"The guide will ___ the museum tour at 10 a.m.", visual:"🏛️", options:["begin","boil","hide","cancel"], answer:"begin", explanation:"begin the tour หมายถึงเริ่มการนำชม" },
    { id:"sc05", zone:"sentence_city", type:"context", prompt:"You need to ___ the application form before Friday.", visual:"📝", options:["submit","throw","climb","mix"], answer:"submit", explanation:"submit a form หมายถึงส่งแบบฟอร์มอย่างเป็นทางการ" },
    { id:"sc06", zone:"sentence_city", type:"context", prompt:"This app helps students ___ new vocabulary.", visual:"📚", options:["practice","damage","escape","refuse"], answer:"practice", explanation:"practice vocabulary หมายถึงฝึกใช้หรือทบทวนคำศัพท์" },
    { id:"sc07", zone:"sentence_city", type:"context", prompt:"Our team will ___ ideas before choosing the best one.", visual:"💡", options:["share","melt","lock","deliver"], answer:"share", explanation:"share ideas หมายถึงแลกเปลี่ยนความคิดร่วมกัน" },
    { id:"sc08", zone:"sentence_city", type:"context", prompt:"Always ___ both sides before crossing the road.", visual:"🚸", options:["check","collect","cook","design"], answer:"check", explanation:"check both sides เป็นคำแนะนำด้านความปลอดภัยก่อนข้ามถนน" },
    { id:"sc09", zone:"sentence_city", type:"context", prompt:"The school will ___ an English competition next week.", visual:"🏆", options:["organize","freeze","repair","discover"], answer:"organize", explanation:"organize a competition หมายถึงจัดการแข่งขัน" },
    { id:"sc10", zone:"sentence_city", type:"context", prompt:"Can you ___ this word in a sentence?", visual:"💬", options:["use","plant","close","wash"], answer:"use", explanation:"use a word in a sentence หมายถึงนำคำไปใช้ในประโยค" },
    { id:"sc11", zone:"sentence_city", type:"context", prompt:"The weather report will help us ___ our trip.", visual:"🌦️", options:["plan","taste","fold","translate"], answer:"plan", explanation:"plan a trip หมายถึงวางแผนการเดินทาง" },
    { id:"sc12", zone:"sentence_city", type:"context", prompt:"Good teamwork can ___ difficult problems.", visual:"🤝", options:["solve","borrow","cover","arrive"], answer:"solve", explanation:"solve problems หมายถึงแก้ปัญหา" },

    { id:"wd01", zone:"word_detective", type:"clue", prompt:"I protect a computer from dangerous programs. What am I?", visual:"🛡️", options:["antivirus","speaker","printer","charger"], answer:"antivirus", explanation:"antivirus เป็นซอฟต์แวร์ที่ตรวจจับและป้องกันโปรแกรมอันตราย" },
    { id:"wd02", zone:"word_detective", type:"clue", prompt:"I am a place where planes arrive and depart. What am I?", visual:"✈️", options:["airport","library","factory","stadium"], answer:"airport", explanation:"airport คือสนามบินสำหรับการเดินทางทางอากาศ" },
    { id:"wd03", zone:"word_detective", type:"clue", prompt:"I am the ability to create new and useful ideas. What am I?", visual:"💡", options:["creativity","gravity","privacy","difficulty"], answer:"creativity", explanation:"creativity คือความสามารถในการสร้างแนวคิดใหม่และมีคุณค่า" },
    { id:"wd04", zone:"word_detective", type:"clue", prompt:"I am information that helps you understand how well you performed. What am I?", visual:"📊", options:["feedback","password","luggage","medicine"], answer:"feedback", explanation:"feedback คือข้อมูลสะท้อนกลับเพื่อช่วยพัฒนาผลงาน" },
    { id:"wd05", zone:"word_detective", type:"clue", prompt:"I happen when the air, water, or land becomes dirty and unsafe.", visual:"🌫️", options:["pollution","celebration","transportation","education"], answer:"pollution", explanation:"pollution คือภาวะมลพิษในอากาศ น้ำ หรือดิน" },
    { id:"wd06", zone:"word_detective", type:"clue", prompt:"I am a formal meeting where someone answers questions for a job.", visual:"🧑‍💼", options:["interview","festival","journey","exercise"], answer:"interview", explanation:"interview คือการสัมภาษณ์เพื่อประเมินผู้สมัคร" },
    { id:"wd07", zone:"word_detective", type:"clue", prompt:"I describe someone who can be trusted to do what they promise.", visual:"✅", options:["reliable","careless","silent","ancient"], answer:"reliable", explanation:"reliable หมายถึงน่าเชื่อถือและไว้วางใจได้" },
    { id:"wd08", zone:"word_detective", type:"clue", prompt:"I am a plan showing when activities will happen.", visual:"🗓️", options:["schedule","dictionary","uniform","message"], answer:"schedule", explanation:"schedule คือกำหนดการหรือตารางเวลา" },
    { id:"wd09", zone:"word_detective", type:"clue", prompt:"I am the place a traveler is going to.", visual:"📍", options:["destination","direction","decision","description"], answer:"destination", explanation:"destination คือจุดหมายปลายทาง" },
    { id:"wd10", zone:"word_detective", type:"clue", prompt:"I am a person who freely helps without being paid.", visual:"🙋", options:["volunteer","customer","passenger","director"], answer:"volunteer", explanation:"volunteer คืออาสาสมัครที่ช่วยงานด้วยความสมัครใจ" },
    { id:"wd11", zone:"word_detective", type:"clue", prompt:"I mean making something better than it was before.", visual:"📈", options:["improvement","movement","agreement","announcement"], answer:"improvement", explanation:"improvement หมายถึงการพัฒนาให้ดีขึ้น" },
    { id:"wd12", zone:"word_detective", type:"clue", prompt:"I am a chance to do something useful or successful.", visual:"🚪", options:["opportunity","emergency","responsibility","instruction"], answer:"opportunity", explanation:"opportunity คือโอกาสที่จะทำหรือบรรลุบางสิ่ง" }
  ];

  const assessmentA = ["wm01","wm03","wm04","cf01","cf03","cf04","sc01","sc03","wd01","wd04"];
  const assessmentB = ["wm02","wm05","wm09","cf02","cf08","cf10","sc02","sc09","wd07","wd09"];
  const byId = Object.fromEntries(items.map(item => [item.id, item]));

  function clone(item) {
    return { ...item, options: [...item.options] };
  }

  function shuffle(array, randomFn) {
    const out = [...array];
    const rnd = randomFn || Math.random;
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function questionsForZone(zone, count) {
    const pool = items.filter(item => item.zone === zone).map(clone);
    return shuffle(pool).slice(0, Math.min(count || 10, pool.length)).map(q => ({ ...q, options: shuffle(q.options) }));
  }

  function assessment(formId) {
    const ids = formId === "B" ? assessmentB : assessmentA;
    return shuffle(ids.map(id => clone(byId[id]))).map(q => ({ ...q, options: shuffle(q.options) }));
  }

  function finalBoss(count) {
    return shuffle(items.map(clone)).slice(0, Math.min(count || 20, items.length)).map(q => ({ ...q, options: shuffle(q.options) }));
  }

  window.EW_WORD_BANK = Object.freeze({ items, questionsForZone, assessment, finalBoss, shuffle });
}());
