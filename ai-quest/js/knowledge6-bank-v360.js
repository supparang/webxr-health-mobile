
/*
  CSAI2102 AI Quest
  S6 Knowledge Base Forge — v3.6.0
  ------------------------------------------------------------
  Topic: Knowledge Representation / Knowledge Base
  Skills:
  - distinguish data, information, knowledge, rule, fact, ontology
  - choose representation
  - infer from facts/rules
  - debug consistency/conflict
*/
(function(){
  'use strict';

  const VERSION = 'v3.6.0-s6-knowledge-base-bank';

  function shuffle(arr){
    const a = (arr || []).slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function item(phase, family, prompt, answer, choices, explain, hint){
    return {
      id:`s6_${phase.toLowerCase().replace(/\W+/g,'_')}_${family}_${Math.random().toString(36).slice(2,7)}`,
      family,
      phase,
      prompt,
      answer,
      choices: shuffle([answer].concat(choices || []).filter(Boolean)).slice(0,4),
      explain,
      hint
    };
  }

  const CONCEPT = [
    item('Knowledge Concept','fact_rule_1','ข้อใดเป็น “fact” ใน knowledge base มากที่สุด?','fever(patient1)','if fever then check infection / patient table / prediction score','fact คือ statement ที่ระบุความจริงเฉพาะกรณี','มองหาข้อความที่บอกความจริง ไม่ใช่เงื่อนไข'),
    item('Knowledge Concept','fact_rule_2','ข้อใดเป็น “rule” มากที่สุด?','IF fever AND cough THEN possible_flu','patient1 has fever / temperature=38.5 / patient profile','rule มีรูปแบบเงื่อนไข → ข้อสรุป','มองหา IF…THEN'),
    item('Knowledge Concept','kb_db_1','Knowledge base ต่างจาก database อย่างไร?','KB เก็บ facts/rules เพื่อ reasoning ได้','DB reasoning ได้เสมอ / KB มีแต่ตัวเลข / DB ไม่มีข้อมูลจริง','KB เน้นความรู้และการอนุมาน ไม่ใช่แค่เก็บ record','คิดถึงระบบที่ถาม-ตอบหรืออนุมานได้'),
    item('Knowledge Concept','ontology_1','Ontology ใช้ทำอะไรใน AI?','กำหนดชนิดของสิ่งของและความสัมพันธ์ระหว่าง concepts','เก็บรูปภาพอย่างเดียว / สุ่มคำตอบ / เพิ่มความเร็ว CPU','ontology ช่วยจัดโครงสร้างความหมาย เช่น class, relation','มองหาคำว่า class/relation'),
    item('Knowledge Concept','symbolic_1','Symbolic AI เหมาะกับงานใดมากที่สุด?','งานที่ต้องอธิบายกฎและเหตุผลได้','งานที่มีภาพล้านภาพแต่ไม่ต้องอธิบาย / งานสุ่มตัวเลข / งานไม่มีความรู้ชัดเจน','symbolic AI เด่นเรื่อง explainability และ rules','มองหางานที่ต้องอธิบายเหตุผล'),
    item('Knowledge Concept','representation_1','ข้อใดเป็น knowledge representation?','semantic network แสดง concept และ relation','ไฟล์รูปเฉย ๆ / ค่า battery / click count','KR คือรูปแบบแทนความรู้ให้เครื่องใช้ reasoning ได้','มองหาการแทน concept/ความสัมพันธ์'),
    item('Knowledge Concept','inference_1','Inference หมายถึงอะไร?','สรุปความรู้ใหม่จาก facts/rules','ลบข้อมูลทั้งหมด / แค่เก็บข้อมูล / สุ่มผลลัพธ์','inference คือการอนุมานจากความรู้ที่มี','มองหาคำว่า infer/conclude'),
    item('Knowledge Concept','closed_world_1','Closed-world assumption คืออะไร?','สิ่งที่ไม่รู้ถือว่า false ในบางระบบ','สิ่งที่ไม่รู้ถือว่าจริงเสมอ / ห้ามมี rule / ห้ามมี fact','CWA ใช้บ่อยในฐานข้อมูล/ตรรกะบางแบบ','ถามว่า unknown ถูกตีความอย่างไร')
  ];

  const REPRESENT = [
    item('Representation Choice','repr_rule_1','โจทย์: “ถ้าฝนตก ถนนเปียก” ควรแทนแบบใด?','Rule: rain → wet_road','ตารางคะแนน / รูปภาพ / random forest เท่านั้น','ประโยคนี้เป็นเงื่อนไข จึงแทนด้วย rule ได้ชัด','มีคำว่า ถ้า…แล้ว…'),
    item('Representation Choice','repr_frame_1','ระบบแนะนำหนังที่มี object “Movie” พร้อม attributes เช่น genre/year/rating ควรใช้รูปแบบใด?','Frame / object attributes','BFS queue / sensor noise / cost frontier','frame เหมาะกับ object ที่มี slots/attributes','มองหา object + attributes'),
    item('Representation Choice','repr_semantic_1','ต้องแสดงว่า “dog is-a animal” และ “dog has-part tail” ควรใช้ใด?','Semantic network','UCS path / confusion matrix / raw database only','semantic network แสดง node และ relation','มี relation แบบ is-a / has-part'),
    item('Representation Choice','repr_logic_1','ต้องพิสูจน์ว่า “Socrates เป็น mortal” จากกฎและ fact ควรใช้ใด?','Logic / rule-based inference','image embedding only / timer event / UI layout','logic เหมาะกับการพิสูจน์ตามกฎ','มีการพิสูจน์/อนุมาน'),
    item('Representation Choice','repr_case_1','ระบบช่วยวินิจฉัยจากเคสเก่า ๆ ที่คล้ายกันควรใช้แนวคิดใด?','Case-based reasoning','A* heuristic only / CSS class / random answer','case-based reasoning ใช้กรณีคล้ายในอดีต','มองหาคำว่าเคสเก่า/คล้ายกัน'),
    item('Representation Choice','repr_ontology_1','ต้องรวมคำว่า lecturer, student, course, enrolls ในระบบมหาวิทยาลัย ควรเริ่มจากอะไร?','Ontology ของ domain','เปลี่ยนสีปุ่ม / สุ่มคะแนน / นับคลิก','ontology ช่วยจัด concept และ relation ใน domain','มี domain concepts หลายตัว')
  ];

  const INFER = [
    item('Inference Drill','infer_1','Facts: bird(tweety). Rule: bird(x) → animal(x). สรุปใดถูก?','animal(tweety)','bird(animal) / not animal(tweety) / fish(tweety)','แทน x=tweety ใน rule จะได้ animal(tweety)','ใช้ตัวแปร x แทน tweety'),
    item('Inference Drill','infer_2','Facts: fever(p1), cough(p1). Rule: fever(x) AND cough(x) → possible_flu(x). สรุปใดถูก?','possible_flu(p1)','possible_flu(p2) / no_flu(p1) / cough(fever)','มีทั้ง fever และ cough ของ p1 จึง trigger rule','ดูว่าครบเงื่อนไข AND หรือไม่'),
    item('Inference Drill','infer_3','Rule: high_score(x) → pass(x). Fact: high_score(student12). ข้อสรุปคือ?','pass(student12)','fail(student12) / high_score(pass) / pass(x) only','แทน x ด้วย student12','กฎหนึ่งข้อ + fact หนึ่งข้อ'),
    item('Inference Drill','infer_4','Rule: mammal(x) → warm_blooded(x). Fact: mammal(cat1). ข้อสรุปคือ?','warm_blooded(cat1)','mammal(warm) / cold_blooded(cat1) / bird(cat1)','ใช้ modus ponens','ถ้า P แล้ว Q, มี P จึงได้ Q'),
    item('Inference Drill','infer_5','ถ้า rule ต้องการ A AND B แต่มี fact แค่ A ข้อใดถูก?','ยังสรุปผลไม่ได้','สรุปได้ทันที / B เป็นจริงอัตโนมัติ / rule ถูกลบ','AND ต้องครบทุกเงื่อนไข','เช็กว่าเงื่อนไขครบไหม'),
    item('Inference Drill','infer_6','Forward chaining เริ่มจากอะไร?','เริ่มจาก facts แล้วใช้ rules เพื่อสร้าง conclusions','เริ่มจาก goal แล้วย้อนหา facts เท่านั้น / สุ่ม rule / ลบ facts','forward chaining เดินหน้า fact→conclusion','คำว่า forward = ไปข้างหน้า')
  ];

  const DEBUG = [
    item('Consistency Debug','debug_1','KB มี fact: bird(tweety), penguin(tweety). rule: penguin(x) → not fly(x). อีก rule: bird(x) → fly(x). ปัญหาคืออะไร?','เกิด conflict เรื่อง fly(tweety)','ไม่มี fact / ไม่มี rule / เป็น database เท่านั้น','กฎสองชุดสรุปผลตรงข้าม','หนึ่ง rule บอก fly อีก rule บอก not fly'),
    item('Consistency Debug','debug_2','ถ้า KB มี fact ซ้ำหลายครั้ง เช่น fever(p1) 5 แถว ควรทำอย่างไร?','deduplicate facts และเก็บ source/timestamp ถ้าจำเป็น','ปล่อยซ้ำเพื่อให้ฉลาดขึ้นเสมอ / ลบทุก fact / เปลี่ยนเป็น image','fact ซ้ำทำให้ report เพี้ยน ควร dedupe','เหมือนที่เรากันคำถามซ้ำในเกม'),
    item('Consistency Debug','debug_3','Rule: student(x) → can_enroll(x). Fact: student(12). แต่ระบบตอบไม่ได้ สาเหตุที่เป็นไปได้คือ?','ชื่อ predicate/format ไม่ตรง เช่น studentId vs student','AI ไม่มีประโยชน์ / ต้องใช้ VR เท่านั้น / ต้องลบ rule','ถ้า symbol ไม่ตรง inference จะไม่ match','ดูชื่อ predicate และ id format'),
    item('Consistency Debug','debug_4','ระบบ KB ตอบ “ไม่รู้” ทั้งที่มีข้อมูล ควรตรวจอะไรอันดับแรก?','ตรวจ facts, rules, predicate names และ matching','เปลี่ยนสี UI / เพิ่มเสียง / ปิดอินเทอร์เน็ต','reasoning ผิดมักมาจากข้อมูลหรือชื่อไม่ตรง','เริ่มจาก fact/rule/schema'),
    item('Consistency Debug','debug_5','กฎสองข้อให้ผลขัดแย้ง ควรเพิ่มอะไรใน KB?','priority / exception / conflict resolution','รูปพื้นหลัง / timer / random seed เท่านั้น','ต้องมีกลไกจัดการ exception/conflict','เช่น penguin เป็น exception ของ bird fly'),
    item('Consistency Debug','debug_6','ทำไมต้องเก็บ explanation trace ใน KB?','เพื่อบอกได้ว่าคำตอบมาจาก fact/rule ใด','เพื่อให้ไฟล์ใหญ่ขึ้น / เพื่อซ่อนเหตุผล / เพื่อสุ่มคะแนน','trace ทำให้ครู/ผู้ใช้ตรวจเหตุผลได้','เกี่ยวกับ explainable AI')
  ];

  const BOSS = [
    item('Knowledge Boss','boss_1','Boss Claim: “Knowledge base คือ database ธรรมดาเท่านั้น” ควรตอบอย่างไร?','ไม่ถูก เพราะ KB มี facts/rules และ reasoning ได้','ถูกเสมอ / KB คือรูปภาพ / KB ไม่ต้องมีความรู้','KB เน้นการแทนความรู้และอนุมาน','แยก DB กับ KB'),
    item('Knowledge Boss','boss_2','Boss Claim: “มี fact เดียวก็อนุมานได้ทุกอย่าง” ควรตอบอย่างไร?','ไม่ถูก ต้องมี rule และเงื่อนไขครบ','ถูก เพราะ AI เดาได้ / fact เดียวพอเสมอ / ไม่ต้องมี rule','inference ต้องอาศัยกฎ/ความสัมพันธ์','fact + rule → conclusion'),
    item('Knowledge Boss','boss_3','Boss Claim: “ถ้า rule เป็น IF A AND B THEN C มีแค่ A ก็สรุป C ได้” ถูกไหม?','ไม่ถูก ต้องมี A และ B ครบ','ถูก / แล้วแต่สีปุ่ม / ถ้ามี A มากพอ','AND ต้องครบทุกเงื่อนไข','คำว่า AND สำคัญ'),
    item('Knowledge Boss','boss_4','Boss Claim: “Ontology ไม่เกี่ยวกับความหมายของข้อมูล” ควรตอบอย่างไร?','ไม่ถูก ontology จัด concept/relation ของ domain','ถูก / ontology คือไฟล์รูป / ontology คือคะแนน','ontology ใช้แทนความหมายและความสัมพันธ์','class/relation/domain'),
    item('Knowledge Boss','boss_5','Boss Claim: “ระบบ rule-based อธิบายเหตุผลไม่ได้” ควรตอบอย่างไร?','ไม่ถูก rule-based มักอธิบาย trace ของ rule ได้','ถูกเสมอ / ต้องใช้ deep learning เท่านั้น / rule ไม่มีชื่อ','rule-based เด่นด้าน explainability','trace จาก fact/rule'),
    item('Knowledge Boss','boss_6','Boss Claim: “Conflict ใน KB ไม่ต้องแก้ เพราะ AI จะเลือกเอง” ควรตอบอย่างไร?','ไม่ถูก ต้องมี conflict resolution/priority/exception','ถูกเพราะ AI รู้เอง / ลบทุก rule / ให้ผู้ใช้เดา','KB ต้องจัดการความขัดแย้งอย่างชัดเจน','priority/exception')
  ];

  function take(list, n){
    const pool = shuffle(list);
    const out = [];
    for(let i=0;i<n;i++) out.push(pool[i % pool.length]);
    return out;
  }

  function counts(diff){
    if(diff === 'challenge') return {concept:5, repr:5, infer:5, debug:4, boss:4, time:155};
    if(diff === 'hard') return {concept:4, repr:4, infer:4, debug:4, boss:3, time:165};
    if(diff === 'easy') return {concept:3, repr:3, infer:3, debug:2, boss:2, time:180};
    return {concept:4, repr:4, infer:4, debug:3, boss:3, time:170};
  }

  function buildSession6Round(diff){
    const c = counts(diff || 'normal');
    const items = []
      .concat(take(CONCEPT,c.concept))
      .concat(take(REPRESENT,c.repr))
      .concat(take(INFER,c.infer))
      .concat(take(DEBUG,c.debug))
      .concat(take(BOSS,c.boss));

    return {
      version:VERSION,
      phases:['Knowledge Concept','Representation Choice','Inference Drill','Consistency Debug','Knowledge Boss'],
      items,
      counts:c,
      noRepeat:{bank:'s6-kb-forge', totalBank:CONCEPT.length+REPRESENT.length+INFER.length+DEBUG.length+BOSS.length}
    };
  }

  window.buildSession6Round = buildSession6Round;
  window.AIQUEST_S6_KB_BANK = {
    version:VERSION,
    counts:{
      concept:CONCEPT.length,
      representation:REPRESENT.length,
      inference:INFER.length,
      debug:DEBUG.length,
      boss:BOSS.length,
      total:CONCEPT.length+REPRESENT.length+INFER.length+DEBUG.length+BOSS.length
    },
    buildSession6Round
  };

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_S6_KB_BANK);
})();
