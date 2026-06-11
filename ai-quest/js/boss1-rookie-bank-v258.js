/*
  CSAI2102 AI Quest
  PATCH v2.5.8 Boss B1 Full Experience Bank
  ------------------------------------------------------------
  Boss B1: Rookie AI Boss
  Static curated boss claims: 120
  No-repeat: itemId + familyId, recent window 5 boss attempts
  Adaptive: prioritizes misconception keys from S2 weak analysis
*/
(function(){
  'use strict';

  const VERSION = 'v2.5.8-boss1-full-bank';
  const RECENT_KEY = 'CSAI2102_AIQUEST_B1_RECENT_HISTORY_V258';
  const RECENT_WINDOW = 5;

  const BOSS1_CLAIMS = [
  {
    "id": "b1_claim_001",
    "familyId": "automation",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation",
    "claim": "มีคนกล่าวว่า: ระบบอัตโนมัติทุกระบบคือ AI",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องมีการใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_002",
    "familyId": "automation",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ระบบอัตโนมัติทุกระบบคือ AI” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องมีการใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_003",
    "familyId": "automation",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation",
    "claim": "Boss ใช้ข้ออ้างว่า “ระบบอัตโนมัติทุกระบบคือ AI” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องมีการใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_004",
    "familyId": "automation",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ระบบอัตโนมัติทุกระบบคือ AI” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องมีการใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_005",
    "familyId": "automation",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation",
    "claim": "คำถามสอบเร็ว: “ระบบอัตโนมัติทุกระบบคือ AI” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องมีการใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_006",
    "familyId": "automation",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ระบบอัตโนมัติทุกระบบคือ AI” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องมีการใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_007",
    "familyId": "rulebased",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased",
    "claim": "มีคนกล่าวว่า: ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_008",
    "familyId": "rulebased",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_009",
    "familyId": "rulebased",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased",
    "claim": "Boss ใช้ข้ออ้างว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_010",
    "familyId": "rulebased",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_011",
    "familyId": "rulebased",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased",
    "claim": "คำถามสอบเร็ว: “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_012",
    "familyId": "rulebased",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_013",
    "familyId": "sensor",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor",
    "claim": "มีคนกล่าวว่า: ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่เพียงพอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_014",
    "familyId": "sensor",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่เพียงพอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_015",
    "familyId": "sensor",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor",
    "claim": "Boss ใช้ข้ออ้างว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ควรโต้กลับอย่างไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่เพียงพอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_016",
    "familyId": "sensor",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ต้องแก้อย่างไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่เพียงพอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_017",
    "familyId": "sensor",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor",
    "claim": "คำถามสอบเร็ว: “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่เพียงพอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_018",
    "familyId": "sensor",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” จะเสี่ยงอย่างไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่เพียงพอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_019",
    "familyId": "robot_only",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "มีคนกล่าวว่า: Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_020",
    "familyId": "robot_only",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_021",
    "familyId": "robot_only",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "Boss ใช้ข้ออ้างว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_022",
    "familyId": "robot_only",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_023",
    "familyId": "robot_only",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "คำถามสอบเร็ว: “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_024",
    "familyId": "robot_only",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_025",
    "familyId": "goal_missing",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "มีคนกล่าวว่า: ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_026",
    "familyId": "goal_missing",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_027",
    "familyId": "goal_missing",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "Boss ใช้ข้ออ้างว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_028",
    "familyId": "goal_missing",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_029",
    "familyId": "goal_missing",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "คำถามสอบเร็ว: “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_030",
    "familyId": "goal_missing",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_031",
    "familyId": "peas_swap",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_swap",
    "claim": "มีคนกล่าวว่า: Performance measure คือ sensor ของ agent",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_032",
    "familyId": "peas_swap",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_swap",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Performance measure คือ sensor ของ agent” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_033",
    "familyId": "peas_swap",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_swap",
    "claim": "Boss ใช้ข้ออ้างว่า “Performance measure คือ sensor ของ agent” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_034",
    "familyId": "peas_swap",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_swap",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Performance measure คือ sensor ของ agent” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_035",
    "familyId": "peas_swap",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_swap",
    "claim": "คำถามสอบเร็ว: “Performance measure คือ sensor ของ agent” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_036",
    "familyId": "peas_swap",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_swap",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Performance measure คือ sensor ของ agent” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_037",
    "familyId": "actuator_confusion",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "actuator_confusion",
    "claim": "มีคนกล่าวว่า: Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_038",
    "familyId": "actuator_confusion",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "actuator_confusion",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_039",
    "familyId": "actuator_confusion",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "actuator_confusion",
    "claim": "Boss ใช้ข้ออ้างว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_040",
    "familyId": "actuator_confusion",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "actuator_confusion",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_041",
    "familyId": "actuator_confusion",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "actuator_confusion",
    "claim": "คำถามสอบเร็ว: “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_042",
    "familyId": "actuator_confusion",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "actuator_confusion",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_043",
    "familyId": "environment_user",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "environment_user",
    "claim": "มีคนกล่าวว่า: Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_044",
    "familyId": "environment_user",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "environment_user",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_045",
    "familyId": "environment_user",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "environment_user",
    "claim": "Boss ใช้ข้ออ้างว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_046",
    "familyId": "environment_user",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "environment_user",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_047",
    "familyId": "environment_user",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "environment_user",
    "claim": "คำถามสอบเร็ว: “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_048",
    "familyId": "environment_user",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "environment_user",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_049",
    "familyId": "component_vs_peas",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "component_vs_peas",
    "claim": "มีคนกล่าวว่า: PEAS คือรายชื่อ component ของระบบ เช่น database, model, server",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_050",
    "familyId": "component_vs_peas",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "component_vs_peas",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_051",
    "familyId": "component_vs_peas",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "component_vs_peas",
    "claim": "Boss ใช้ข้ออ้างว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_052",
    "familyId": "component_vs_peas",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "component_vs_peas",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_053",
    "familyId": "component_vs_peas",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "component_vs_peas",
    "claim": "คำถามสอบเร็ว: “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_054",
    "familyId": "component_vs_peas",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "component_vs_peas",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_055",
    "familyId": "observable_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_confusion",
    "claim": "มีคนกล่าวว่า: ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_056",
    "familyId": "observable_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_confusion",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_057",
    "familyId": "observable_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_confusion",
    "claim": "Boss ใช้ข้ออ้างว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ควรโต้กลับอย่างไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_058",
    "familyId": "observable_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_confusion",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ต้องแก้อย่างไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_059",
    "familyId": "observable_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_confusion",
    "claim": "คำถามสอบเร็ว: “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_060",
    "familyId": "observable_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_confusion",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” จะเสี่ยงอย่างไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_061",
    "familyId": "dynamic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_confusion",
    "claim": "มีคนกล่าวว่า: Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_062",
    "familyId": "dynamic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_confusion",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_063",
    "familyId": "dynamic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_confusion",
    "claim": "Boss ใช้ข้ออ้างว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_064",
    "familyId": "dynamic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_confusion",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_065",
    "familyId": "dynamic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_confusion",
    "claim": "คำถามสอบเร็ว: “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_066",
    "familyId": "dynamic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_confusion",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_067",
    "familyId": "stochastic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_confusion",
    "claim": "มีคนกล่าวว่า: Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_068",
    "familyId": "stochastic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_confusion",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_069",
    "familyId": "stochastic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_confusion",
    "claim": "Boss ใช้ข้ออ้างว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_070",
    "familyId": "stochastic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_confusion",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_071",
    "familyId": "stochastic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_confusion",
    "claim": "คำถามสอบเร็ว: “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_072",
    "familyId": "stochastic_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_confusion",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_073",
    "familyId": "multiagent_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_confusion",
    "claim": "มีคนกล่าวว่า: ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_074",
    "familyId": "multiagent_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_confusion",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_075",
    "familyId": "multiagent_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_confusion",
    "claim": "Boss ใช้ข้ออ้างว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_076",
    "familyId": "multiagent_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_confusion",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_077",
    "familyId": "multiagent_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_confusion",
    "claim": "คำถามสอบเร็ว: “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_078",
    "familyId": "multiagent_confusion",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_confusion",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_079",
    "familyId": "episodic_sequential",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "มีคนกล่าวว่า: การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_080",
    "familyId": "episodic_sequential",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_081",
    "familyId": "episodic_sequential",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "Boss ใช้ข้ออ้างว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_082",
    "familyId": "episodic_sequential",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_083",
    "familyId": "episodic_sequential",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "คำถามสอบเร็ว: “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_084",
    "familyId": "episodic_sequential",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_085",
    "familyId": "rationality",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rationality",
    "claim": "มีคนกล่าวว่า: Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_086",
    "familyId": "rationality",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rationality",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_087",
    "familyId": "rationality",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rationality",
    "claim": "Boss ใช้ข้ออ้างว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_088",
    "familyId": "rationality",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rationality",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_089",
    "familyId": "rationality",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rationality",
    "claim": "คำถามสอบเร็ว: “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_090",
    "familyId": "rationality",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rationality",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_091",
    "familyId": "bigdata_rational",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "มีคนกล่าวว่า: ข้อมูลเยอะทำให้ agent rational เสมอ",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_092",
    "familyId": "bigdata_rational",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_093",
    "familyId": "bigdata_rational",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "Boss ใช้ข้ออ้างว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_094",
    "familyId": "bigdata_rational",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_095",
    "familyId": "bigdata_rational",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "คำถามสอบเร็ว: “ข้อมูลเยอะทำให้ agent rational เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_096",
    "familyId": "bigdata_rational",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_097",
    "familyId": "learning_required",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "มีคนกล่าวว่า: Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_098",
    "familyId": "learning_required",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_099",
    "familyId": "learning_required",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "Boss ใช้ข้ออ้างว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_100",
    "familyId": "learning_required",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_101",
    "familyId": "learning_required",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "คำถามสอบเร็ว: “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_102",
    "familyId": "learning_required",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_103",
    "familyId": "prediction_action",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "มีคนกล่าวว่า: ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_104",
    "familyId": "prediction_action",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_105",
    "familyId": "prediction_action",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "Boss ใช้ข้ออ้างว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_106",
    "familyId": "prediction_action",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_107",
    "familyId": "prediction_action",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "คำถามสอบเร็ว: “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_108",
    "familyId": "prediction_action",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_109",
    "familyId": "ethics_safety",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "มีคนกล่าวว่า: ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_110",
    "familyId": "ethics_safety",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_111",
    "familyId": "ethics_safety",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "Boss ใช้ข้ออ้างว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_112",
    "familyId": "ethics_safety",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_113",
    "familyId": "ethics_safety",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "คำถามสอบเร็ว: “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_114",
    "familyId": "ethics_safety",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_115",
    "familyId": "explainability",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "มีคนกล่าวว่า: ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_116",
    "familyId": "explainability",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "ในกรณีศึกษา นักศึกษาสรุปว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ข้อสรุปนี้ถูกหรือไม่?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_117",
    "familyId": "explainability",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "Boss ใช้ข้ออ้างว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ควรโต้กลับอย่างไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_118",
    "familyId": "explainability",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "ระหว่างออกแบบระบบ มีทีมงานเข้าใจว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ต้องแก้อย่างไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_119",
    "familyId": "explainability",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "คำถามสอบเร็ว: “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_120",
    "familyId": "explainability",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "เมื่อนำไปใช้ใน Mini Project หากเชื่อว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” จะเสี่ยงอย่างไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับ misconception แล้วอธิบายด้วยคำว่า percept/action/goal/PEAS/environment/rationality ตามบริบท",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  }
];

  function profileKey(){
    try{
      const p = window.AIQuestStorage && AIQuestStorage.getProfile ? AIQuestStorage.getProfile() : {};
      return String((p.studentId || 'anon') + '_' + (p.section || '101')).replace(/[^\w-]/g,'_');
    }catch(error){
      return 'anon_101';
    }
  }

  function readHistory(){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      const key = profileKey();
      return Array.isArray(all[key]) ? all[key] : [];
    }catch(error){
      return [];
    }
  }

  function writeHistory(entry){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      const key = profileKey();
      const list = Array.isArray(all[key]) ? all[key] : [];
      list.unshift(entry);
      all[key] = list.slice(0, RECENT_WINDOW);
      localStorage.setItem(RECENT_KEY, JSON.stringify(all));
    }catch(error){}
  }

  function recentSets(){
    const itemIds = new Set();
    const familyIds = new Set();

    readHistory().slice(0, RECENT_WINDOW).forEach(round => {
      (round.itemIds || []).forEach(id => itemIds.add(id));
      (round.familyIds || []).forEach(id => familyIds.add(id));
    });

    return {itemIds, familyIds};
  }

  function shuffle(array){
    const a = array.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function difficultyRank(v){
    return {easy:1, normal:2, hard:3, challenge:4}[v || 'normal'] || 2;
  }

  function readWeakKeys(){
    const keys = [];
    ['CSAI2102_AIQUEST_S2_WEAK_MIS_V256','CSAI2102_AIQUEST_S2_WEAK_MIS_V258'].forEach(storageKey => {
      try{
        const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
        Object.entries(data.mis || {})
          .sort((a,b)=>Number(b[1])-Number(a[1]))
          .forEach(pair => {
            if(pair[0] && !keys.includes(pair[0])) keys.push(pair[0]);
          });
      }catch(error){}
    });
    return keys.slice(0, 6);
  }

  function scoreCandidate(item, recent, usedFamilies, difficulty, weakKeys){
    let score = 100;
    if(recent.itemIds.has(item.id)) score -= 70;
    if(recent.familyIds.has(item.familyId)) score -= 45;
    if(usedFamilies.has(item.familyId)) score -= 35;

    const dr = difficultyRank(difficulty);
    const ir = difficultyRank(item.difficulty || 'normal');
    if(difficulty !== 'challenge' && ir > dr + 1) score -= 30;
    score -= Math.abs(dr - ir) * 5;

    if(weakKeys.includes(item.key)) score += 35;
    score += Math.random() * 9;

    return score;
  }

  function pickPhase(phaseItems, count, difficulty, weakKeys, usedFamilies){
    const recent = recentSets();
    const pool = phaseItems.slice();
    const picked = [];

    for(let i=0;i<count;i++){
      if(!pool.length) break;
      pool.sort((a,b)=>scoreCandidate(b,recent,usedFamilies,difficulty,weakKeys)-scoreCandidate(a,recent,usedFamilies,difficulty,weakKeys));
      const bestScore = scoreCandidate(pool[0],recent,usedFamilies,difficulty,weakKeys);
      const top = pool.filter(item => scoreCandidate(item,recent,usedFamilies,difficulty,weakKeys) >= bestScore - 8).slice(0, 8);
      const chosen = shuffle(top)[0] || pool[0];
      picked.push(chosen);
      usedFamilies.add(chosen.familyId);
      pool.splice(pool.findIndex(item => item.id === chosen.id), 1);
    }

    return picked;
  }

  function buildBoss1Round(difficulty){
    const diff = difficulty || 'normal';
    const weakKeys = readWeakKeys();
    const usedFamilies = new Set();

    const phaseCounts = {
      easy:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':1,'Rationality Gate':1,'Final Attack':1},
      normal:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':2,'Rationality Gate':2,'Final Attack':2},
      hard:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':3,'Environment Gate':3,'Rationality Gate':2,'Final Attack':2},
      challenge:{'AI vs Automation':2,'Agent Foundation':3,'PEAS Gate':3,'Environment Gate':3,'Rationality Gate':3,'Final Attack':2}
    }[diff] || {'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':2,'Rationality Gate':2,'Final Attack':2};

    let claims = [];
    Object.keys(phaseCounts).forEach(phase => {
      claims = claims.concat(pickPhase(
        BOSS1_CLAIMS.filter(item => item.phase === phase),
        phaseCounts[phase],
        diff,
        weakKeys,
        usedFamilies
      ));
    });

    const itemIds = claims.map(item => item.id);
    const familyIds = claims.map(item => item.familyId);
    writeHistory({ts:new Date().toISOString(), difficulty:diff, itemIds, familyIds, weakKeys});

    return {
      version:VERSION,
      title:'B1: Rookie AI Boss',
      phases:['AI vs Automation','Agent Foundation','PEAS Gate','Environment Gate','Rationality Gate','Final Attack'],
      claims,
      weakKeys,
      noRepeat:{recentWindow:RECENT_WINDOW,itemIds,familyIds}
    };
  }

  function resetBoss1History(){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      delete all[profileKey()];
      localStorage.setItem(RECENT_KEY, JSON.stringify(all));
    }catch(error){}
  }

  window.AIQUEST_BOSS1_BANK = {
    VERSION,
    RECENT_KEY,
    RECENT_WINDOW,
    BOSS1_CLAIMS,
    buildBoss1Round,
    resetBoss1History,
    counts:{claims:BOSS1_CLAIMS.length,total:BOSS1_CLAIMS.length}
  };

  window.buildBoss1Round = buildBoss1Round;
  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_BOSS1_BANK.counts);
})();
