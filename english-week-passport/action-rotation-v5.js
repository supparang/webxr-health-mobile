(function () {
  "use strict";

  const rotation = window.EW_ROTATION;
  const VERSION = "2026-08-03-ACTION-ROTATION-V5";
  const assignment = rotation?.getAssignment();
  rotation?.installStageRandom("word_detective");

  const BODY = Object.freeze({
    raise:{id:"body01",command:"Raise both hands",thai:"ยกมือทั้งสองข้าง",type:"raise",choices:["ยกมือทั้งสองข้าง","ก้มตัวลง","กางแขนออก"]},
    wide:{id:"body02",command:"Stretch your arms wide",thai:"กางแขนออกด้านข้าง",type:"wide",choices:["แตะศีรษะ","กางแขนออกด้านข้าง","ยกเข่าขึ้น"]},
    head:{id:"body03",command:"Touch your head",thai:"แตะศีรษะ",type:"head",choices:["แตะศีรษะ","เอียงตัวไปขวา","นั่งลง"]}
  });
  const BODY_ORDERS = Object.freeze({
    P1:["raise","wide","head"],
    P2:["wide","head","raise"],
    P3:["head","raise","wide"],
    P4:["wide","raise","head"]
  });

  const AR_BANK = Object.freeze([
    {id:"ar01",level:"A2",clue:"I protect your online account.",answer:"password",options:[{word:"password",thai:"รหัสผ่าน"},{word:"passport",thai:"หนังสือเดินทาง"},{word:"medicine",thai:"ยา"},{word:"luggage",thai:"สัมภาระ"}]},
    {id:"ar02",level:"A2",clue:"I am the place where a traveler is going.",answer:"destination",options:[{word:"destination",thai:"จุดหมายปลายทาง"},{word:"keyboard",thai:"แป้นพิมพ์"},{word:"exercise",thai:"การออกกำลังกาย"},{word:"wildlife",thai:"สัตว์ป่า"}]},
    {id:"ar03",level:"A2",clue:"I help your body stay strong and active.",answer:"exercise",options:[{word:"exercise",thai:"การออกกำลังกาย"},{word:"pollution",thai:"มลพิษ"},{word:"software",thai:"ซอฟต์แวร์"},{word:"departure",thai:"การออกเดินทาง"}]},
    {id:"ar04",level:"A2+",clue:"I am the bags and cases you take on a journey.",answer:"luggage",options:[{word:"luggage",thai:"สัมภาระ"},{word:"feedback",thai:"ข้อมูลป้อนกลับ"},{word:"nutrition",thai:"โภชนาการ"},{word:"database",thai:"ฐานข้อมูล"}]},
    {id:"ar05",level:"A2+",clue:"I mean using materials again instead of throwing them away.",answer:"recycle",options:[{word:"recycle",thai:"นำกลับมาใช้ใหม่"},{word:"interview",thai:"การสัมภาษณ์"},{word:"hydration",thai:"การได้รับน้ำ"},{word:"schedule",thai:"กำหนดการ"}]},
    {id:"ar06",level:"A2+",clue:"I am a plan showing when activities will happen.",answer:"schedule",options:[{word:"schedule",thai:"กำหนดการ"},{word:"community",thai:"ชุมชน"},{word:"passport",thai:"หนังสือเดินทาง"},{word:"keyboard",thai:"แป้นพิมพ์"}]},
    {id:"ar07",level:"B1",clue:"I am information that helps you understand how well you performed.",answer:"feedback",options:[{word:"feedback",thai:"ข้อมูลป้อนกลับ"},{word:"departure",thai:"การออกเดินทาง"},{word:"medicine",thai:"ยา"},{word:"device",thai:"อุปกรณ์"}]},
    {id:"ar08",level:"B1",clue:"I describe a person who can be trusted to do what they promise.",answer:"reliable",options:[{word:"reliable",thai:"น่าเชื่อถือ"},{word:"creative",thai:"สร้างสรรค์"},{word:"healthy",thai:"สุขภาพดี"},{word:"confident",thai:"มั่นใจ"}]},
    {id:"ar09",level:"B1",clue:"I am a formal meeting in which a job applicant answers questions.",answer:"interview",options:[{word:"interview",thai:"การสัมภาษณ์"},{word:"itinerary",thai:"กำหนดการเดินทาง"},{word:"pollution",thai:"มลพิษ"},{word:"opportunity",thai:"โอกาส"}]},
    {id:"ar10",level:"B1+",clue:"I refer to meeting present needs without damaging the ability of future generations to meet theirs.",answer:"sustainability",options:[{word:"sustainability",thai:"ความยั่งยืน"},{word:"collaboration",thai:"การทำงานร่วมกัน"},{word:"cybersecurity",thai:"ความปลอดภัยไซเบอร์"},{word:"accommodation",thai:"ที่พัก"}]},
    {id:"ar11",level:"B1+",clue:"I mean working jointly with others to achieve a shared goal.",answer:"collaboration",options:[{word:"collaboration",thai:"การทำงานร่วมกัน"},{word:"responsibility",thai:"ความรับผิดชอบ"},{word:"conservation",thai:"การอนุรักษ์"},{word:"communication",thai:"การสื่อสาร"}]},
    {id:"ar12",level:"B1+",clue:"I am the protection of digital systems, networks, and information from attacks.",answer:"cybersecurity",options:[{word:"cybersecurity",thai:"ความปลอดภัยไซเบอร์"},{word:"biodiversity",thai:"ความหลากหลายทางชีวภาพ"},{word:"recommendation",thai:"ข้อเสนอแนะ"},{word:"achievement",thai:"ความสำเร็จ"}]}
  ]);

  const HAND_BANK = Object.freeze([
    {id:"hand01",level:"A2",prompt:"Pinch the word that means ‘อุปกรณ์’",answer:"device",options:[{word:"device",thai:"อุปกรณ์"},{word:"journey",thai:"การเดินทาง"},{word:"healthy",thai:"สุขภาพดี"},{word:"forest",thai:"ป่าไม้"}]},
    {id:"hand02",level:"A2",prompt:"Pinch the word that means ‘ปกป้อง’",answer:"protect",options:[{word:"protect",thai:"ปกป้อง"},{word:"borrow",thai:"ยืม"},{word:"depart",thai:"ออกเดินทาง"},{word:"collect",thai:"รวบรวม"}]},
    {id:"hand03",level:"A2",prompt:"Pinch the word that means ‘กำหนดการ’",answer:"schedule",options:[{word:"schedule",thai:"กำหนดการ"},{word:"ticket",thai:"ตั๋ว"},{word:"website",thai:"เว็บไซต์"},{word:"medicine",thai:"ยา"}]},
    {id:"hand04",level:"A2+",prompt:"Pinch the word that means ‘อาสาสมัคร’",answer:"volunteer",options:[{word:"volunteer",thai:"อาสาสมัคร"},{word:"passenger",thai:"ผู้โดยสาร"},{word:"manager",thai:"ผู้จัดการ"},{word:"visitor",thai:"ผู้มาเยือน"}]},
    {id:"hand05",level:"A2+",prompt:"Pinch the word that means ‘จุดหมายปลายทาง’",answer:"destination",options:[{word:"destination",thai:"จุดหมายปลายทาง"},{word:"direction",thai:"ทิศทาง"},{word:"departure",thai:"การออกเดินทาง"},{word:"decision",thai:"การตัดสินใจ"}]},
    {id:"hand06",level:"A2+",prompt:"Pinch the word that means ‘มั่นใจ’",answer:"confident",options:[{word:"confident",thai:"มั่นใจ"},{word:"careless",thai:"ประมาท"},{word:"silent",thai:"เงียบ"},{word:"ancient",thai:"โบราณ"}]},
    {id:"hand07",level:"B1",prompt:"Pinch the word meaning ‘information used to improve performance’",answer:"feedback",options:[{word:"feedback",thai:"ข้อมูลป้อนกลับ"},{word:"luggage",thai:"สัมภาระ"},{word:"hydration",thai:"การได้รับน้ำ"},{word:"software",thai:"ซอฟต์แวร์"}]},
    {id:"hand08",level:"B1",prompt:"Pinch the adjective meaning ‘able to be trusted’",answer:"reliable",options:[{word:"reliable",thai:"น่าเชื่อถือ"},{word:"creative",thai:"สร้างสรรค์"},{word:"available",thai:"พร้อมใช้"},{word:"comfortable",thai:"สะดวกสบาย"}]},
    {id:"hand09",level:"B1",prompt:"Pinch the noun meaning ‘a chance to do something useful’",answer:"opportunity",options:[{word:"opportunity",thai:"โอกาส"},{word:"responsibility",thai:"ความรับผิดชอบ"},{word:"achievement",thai:"ความสำเร็จ"},{word:"recommendation",thai:"ข้อเสนอแนะ"}]},
    {id:"hand10",level:"B1+",prompt:"Pinch the word meaning ‘the ability to continue without harming future resources’",answer:"sustainability",options:[{word:"sustainability",thai:"ความยั่งยืน"},{word:"biodiversity",thai:"ความหลากหลายทางชีวภาพ"},{word:"cybersecurity",thai:"ความปลอดภัยไซเบอร์"},{word:"collaboration",thai:"การทำงานร่วมกัน"}]},
    {id:"hand11",level:"B1+",prompt:"Pinch the word meaning ‘joint work toward a shared objective’",answer:"collaboration",options:[{word:"collaboration",thai:"การทำงานร่วมกัน"},{word:"communication",thai:"การสื่อสาร"},{word:"conservation",thai:"การอนุรักษ์"},{word:"accommodation",thai:"ที่พัก"}]},
    {id:"hand12",level:"B1+",prompt:"Pinch the word meaning ‘a duty to deal with something properly’",answer:"responsibility",options:[{word:"responsibility",thai:"ความรับผิดชอบ"},{word:"recommendation",thai:"ข้อเสนอแนะ"},{word:"achievement",thai:"ความสำเร็จ"},{word:"departure",thai:"การออกเดินทาง"}]}
  ]);

  function selectByLevels(bank, stageId) {
    return ["A2", "B1", "B1+"].map(level => {
      const pool = bank.filter(item => item.level === level);
      return rotation ? rotation.sample(pool, 1, `${stageId}:${level}`, assignment?.passportRotation)[0] : pool[0];
    });
  }

  const bodyOrder = BODY_ORDERS[assignment?.passportRotation] || BODY_ORDERS.P1;
  const bodyTasks = bodyOrder.map(key => BODY[key]);
  const arTasks = selectByLevels(AR_BANK, "action:ar");
  const handTasks = selectByLevels(HAND_BANK, "action:hand");

  function json(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  async function transformAndLoad(node, originalAppend) {
    try {
      const response = await fetch(node.src, { cache:"no-store" });
      if (!response.ok) throw new Error(`ACTION_ENGINE_${response.status}`);
      let source = await response.text();
      source = source.replace(/const BODY_TASKS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);\s*const AR_TASKS/, `const BODY_TASKS=Object.freeze(${json(bodyTasks)});\n  const AR_TASKS`);
      source = source.replace(/const AR_TASKS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);\s*const HAND_TASKS/, `const AR_TASKS=Object.freeze(${json(arTasks)});\n  const HAND_TASKS`);
      source = source.replace(/const HAND_TASKS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);\s*\n\s*const state/, `const HAND_TASKS=Object.freeze(${json(handTasks)});\n\n  const state`);
      source = source.replace("ACTION-DETECTIVE-V1", "ACTION-DETECTIVE-V5-ROTATED");
      const blob = new Blob([source], { type:"text/javascript" });
      const url = URL.createObjectURL(blob);
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => URL.revokeObjectURL(url);
      script.onerror = () => URL.revokeObjectURL(url);
      originalAppend(script);
    } catch (error) {
      console.error("Action rotation load failed", error);
      const root = document.getElementById("adlRoot");
      if (root) root.innerHTML = `<div class="adl-shell"><section class="adl-card adl-center"><div class="adl-hero">⚠️</div><h1>โหลด Action Detective ไม่สำเร็จ</h1><p class="adl-lead">${String(error.message || error)}</p><button onclick="location.reload()" class="adl-btn primary">โหลดใหม่</button></section></div>`;
    }
  }

  const originalAppend = document.body.appendChild.bind(document.body);
  document.body.appendChild = function (node) {
    const isEngine = node?.tagName === "SCRIPT" && /action-detective\.js(?:\?|$)/.test(node.src || "");
    if (!isEngine) return originalAppend(node);
    transformAndLoad(node, originalAppend);
    return node;
  };

  window.EW_ACTION_ROTATION = Object.freeze({
    version:VERSION,
    assignment,
    bodyItemIds:bodyTasks.map(item => item.id),
    arItemIds:arTasks.map(item => item.id),
    handItemIds:handTasks.map(item => item.id)
  });
}());