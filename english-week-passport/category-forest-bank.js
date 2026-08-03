(function () {
  "use strict";

  const base = window.EW_WORD_BANK;
  if (!base) throw new Error("EW_WORD_BANK_REQUIRED");

  const CATEGORIES = Object.freeze(["Travel", "Technology", "Environment", "Health"]);
  const STRICT_ITEMS = Object.freeze([
    { id:"cf01", zone:"category_forest", type:"category", prompt:"คำว่า “passport” อยู่ในหมวดใด", visual:"🛂", answer:"Travel", explanation:"passport คือเอกสารประจำตัวที่ใช้สำหรับการเดินทางระหว่างประเทศ" },
    { id:"cf02", zone:"category_forest", type:"category", prompt:"คำว่า “keyboard” อยู่ในหมวดใด", visual:"⌨️", answer:"Technology", explanation:"keyboard เป็นอุปกรณ์สำหรับป้อนข้อมูลเข้าสู่คอมพิวเตอร์" },
    { id:"cf03", zone:"category_forest", type:"category", prompt:"คำว่า “recycle” อยู่ในหมวดใด", visual:"♻️", answer:"Environment", explanation:"recycle คือการนำวัสดุกลับมาใช้ใหม่เพื่อลดขยะและผลกระทบต่อสิ่งแวดล้อม" },
    { id:"cf04", zone:"category_forest", type:"category", prompt:"คำว่า “exercise” อยู่ในหมวดใด", visual:"🏃", answer:"Health", explanation:"exercise คือการออกกำลังกายเพื่อเสริมสร้างสุขภาพ" },
    { id:"cf05", zone:"category_forest", type:"category", prompt:"คำว่า “boarding pass” อยู่ในหมวดใด", visual:"✈️", answer:"Travel", explanation:"boarding pass คือบัตรที่ใช้ยืนยันสิทธิ์ขึ้นเครื่องบิน" },
    { id:"cf06", zone:"category_forest", type:"category", prompt:"คำว่า “password” อยู่ในหมวดใด", visual:"🔐", answer:"Technology", explanation:"password ใช้ยืนยันตัวตนและปกป้องบัญชีดิจิทัล" },
    { id:"cf07", zone:"category_forest", type:"category", prompt:"คำว่า “pollution” อยู่ในหมวดใด", visual:"🏭", answer:"Environment", explanation:"pollution หมายถึงมลพิษที่ทำให้สิ่งแวดล้อมเสื่อมโทรม" },
    { id:"cf08", zone:"category_forest", type:"category", prompt:"คำว่า “hydration” อยู่ในหมวดใด", visual:"💧", answer:"Health", explanation:"hydration คือการได้รับน้ำอย่างเพียงพอเพื่อให้ร่างกายทำงานได้ดี" },
    { id:"cf09", zone:"category_forest", type:"category", prompt:"คำว่า “destination” อยู่ในหมวดใด", visual:"📍", answer:"Travel", explanation:"destination คือจุดหมายปลายทางของการเดินทาง" },
    { id:"cf10", zone:"category_forest", type:"category", prompt:"คำว่า “smartphone” อยู่ในหมวดใด", visual:"📱", answer:"Technology", explanation:"smartphone เป็นอุปกรณ์เทคโนโลยีสำหรับการสื่อสารและใช้งานแอปพลิเคชัน" },
    { id:"cf11", zone:"category_forest", type:"category", prompt:"คำว่า “wildlife” อยู่ในหมวดใด", visual:"🦋", answer:"Environment", explanation:"wildlife หมายถึงสัตว์ป่าที่เป็นส่วนหนึ่งของระบบนิเวศและสิ่งแวดล้อม" },
    { id:"cf12", zone:"category_forest", type:"category", prompt:"คำว่า “medicine” อยู่ในหมวดใด", visual:"💊", answer:"Health", explanation:"medicine คือยาที่ใช้รักษาหรือบรรเทาอาการเจ็บป่วย" }
  ]);

  const strictById = Object.fromEntries(STRICT_ITEMS.map(item => [item.id, item]));
  const originalQuestionsForZone = base.questionsForZone.bind(base);
  const originalAssessment = base.assessment.bind(base);
  const originalFinalBoss = base.finalBoss.bind(base);

  function shuffle(values) {
    return base.shuffle ? base.shuffle(values) : values.slice().sort(() => Math.random() - 0.5);
  }

  function strictClone(item) {
    return { ...item, options: shuffle(CATEGORIES) };
  }

  function replaceCategoryItem(item) {
    const replacement = item && strictById[item.id];
    return replacement ? strictClone(replacement) : item;
  }

  function questionsForZone(zone, count) {
    if (zone !== "category_forest") return originalQuestionsForZone(zone, count);
    const limit = Math.min(Number(count || 10), STRICT_ITEMS.length);
    return shuffle(STRICT_ITEMS).slice(0, limit).map(strictClone);
  }

  function assessment(formId) {
    return originalAssessment(formId).map(replaceCategoryItem);
  }

  function finalBoss(count) {
    return originalFinalBoss(count).map(replaceCategoryItem);
  }

  const revisedItems = (base.items || []).map(replaceCategoryItem);
  window.EW_WORD_BANK = Object.freeze({
    ...base,
    items: revisedItems,
    questionsForZone,
    assessment,
    finalBoss,
    categoryForestPolicy: Object.freeze({
      version: "2026-08-03-CATEGORY-STRICT-V2",
      categories: CATEGORIES,
      itemCount: STRICT_ITEMS.length,
      rule: "four-fixed-unambiguous-portals"
    })
  });
}());
