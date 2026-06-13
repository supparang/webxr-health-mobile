/*
  CSAI2102 AI Quest
  PATCH v3.0.4 Boss B1 240 + Strong No-repeat
*/
(function(){
  'use strict';
  const VERSION = 'v3.0.4-boss1-240-strong-norepeat';
  const RECENT_KEY = 'CSAI2102_AIQUEST_B1_RECENT_HISTORY_V259';
  const LEGACY_RECENT_KEY = 'CSAI2102_AIQUEST_B1_RECENT_HISTORY_V258';
  const ITEM_RECENT_WINDOW = 8;
  const FAMILY_HARD_WINDOW = 3;
  const FAMILY_SOFT_WINDOW = 8;
  const BOSS1_CLAIMS = [
  {
    "id": "b1_claim_001",
    "familyId": "automation_rule",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation_rule",
    "claim": "Boss Claim: “ระบบอัตโนมัติทุกระบบคือ AI”",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_002",
    "familyId": "automation_rule",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation_rule",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบอัตโนมัติทุกระบบคือ AI” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_003",
    "familyId": "automation_rule",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation_rule",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบอัตโนมัติทุกระบบคือ AI” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_004",
    "familyId": "automation_rule",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation_rule",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบอัตโนมัติทุกระบบคือ AI” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_005",
    "familyId": "automation_rule",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation_rule",
    "claim": "คำถามสอบเร็ว: “ระบบอัตโนมัติทุกระบบคือ AI” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_006",
    "familyId": "automation_rule",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "automation_rule",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบอัตโนมัติทุกระบบคือ AI” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ระบบอัตโนมัติอาจทำตามกฎตายตัวโดยไม่เรียนรู้หรือคาดการณ์จากข้อมูล",
    "why": "Automation ทำตาม rule ได้ แต่ AI ต้องใช้ข้อมูล/แบบจำลอง/การตัดสินใจตามเป้าหมาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_007",
    "familyId": "rulebased_many_rules",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased_many_rules",
    "claim": "Boss Claim: “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง”",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_008",
    "familyId": "rulebased_many_rules",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased_many_rules",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_009",
    "familyId": "rulebased_many_rules",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased_many_rules",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_010",
    "familyId": "rulebased_many_rules",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased_many_rules",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_011",
    "familyId": "rulebased_many_rules",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased_many_rules",
    "claim": "คำถามสอบเร็ว: “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_012",
    "familyId": "rulebased_many_rules",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "rulebased_many_rules",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้ามี if-else จำนวนมาก แปลว่าเป็น AI ขั้นสูง” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก if-else จำนวนมากอาจเป็น rule-based system ไม่ใช่ AI ที่เรียนรู้",
    "why": "จำนวนกฎไม่ใช่ตัวชี้วัด intelligence ต้องดูการปรับตัวและการตัดสินใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_013",
    "familyId": "timer_automation",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "timer_automation",
    "claim": "Boss Claim: “นาฬิกาปลุกที่ดังตามเวลาคือ intelligent agent”",
    "answer": "ไม่จำเป็น ส่วนใหญ่เป็น timer/automation ตามเงื่อนไขที่ตั้งไว้",
    "why": "การทำงานตามเวลาไม่ได้แปลว่ามี percept-action-goal reasoning",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_014",
    "familyId": "timer_automation",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "timer_automation",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “นาฬิกาปลุกที่ดังตามเวลาคือ intelligent agent” ควรแก้อย่างไร?",
    "answer": "ไม่จำเป็น ส่วนใหญ่เป็น timer/automation ตามเงื่อนไขที่ตั้งไว้",
    "why": "การทำงานตามเวลาไม่ได้แปลว่ามี percept-action-goal reasoning",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_015",
    "familyId": "timer_automation",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "timer_automation",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “นาฬิกาปลุกที่ดังตามเวลาคือ intelligent agent” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่จำเป็น ส่วนใหญ่เป็น timer/automation ตามเงื่อนไขที่ตั้งไว้",
    "why": "การทำงานตามเวลาไม่ได้แปลว่ามี percept-action-goal reasoning",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_016",
    "familyId": "timer_automation",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "timer_automation",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “นาฬิกาปลุกที่ดังตามเวลาคือ intelligent agent” ควร feedback อย่างไร?",
    "answer": "ไม่จำเป็น ส่วนใหญ่เป็น timer/automation ตามเงื่อนไขที่ตั้งไว้",
    "why": "การทำงานตามเวลาไม่ได้แปลว่ามี percept-action-goal reasoning",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_017",
    "familyId": "timer_automation",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "timer_automation",
    "claim": "คำถามสอบเร็ว: “นาฬิกาปลุกที่ดังตามเวลาคือ intelligent agent” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่จำเป็น ส่วนใหญ่เป็น timer/automation ตามเงื่อนไขที่ตั้งไว้",
    "why": "การทำงานตามเวลาไม่ได้แปลว่ามี percept-action-goal reasoning",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_018",
    "familyId": "timer_automation",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "timer_automation",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “นาฬิกาปลุกที่ดังตามเวลาคือ intelligent agent” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่จำเป็น ส่วนใหญ่เป็น timer/automation ตามเงื่อนไขที่ตั้งไว้",
    "why": "การทำงานตามเวลาไม่ได้แปลว่ามี percept-action-goal reasoning",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_019",
    "familyId": "threshold_system",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "threshold_system",
    "claim": "Boss Claim: “ระบบที่ใช้ threshold เช่น ถ้าเกินค่าแล้วแจ้งเตือน เป็น AI เสมอ”",
    "answer": "ไม่ถูก threshold rule อาจเป็น automation หรือ simple reflex ไม่ใช่ learning AI",
    "why": "ต้องดูว่าระบบเลือก action ตาม goal และข้อมูลมากกว่ากฎตายตัวหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_020",
    "familyId": "threshold_system",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "threshold_system",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบที่ใช้ threshold เช่น ถ้าเกินค่าแล้วแจ้งเตือน เป็น AI เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก threshold rule อาจเป็น automation หรือ simple reflex ไม่ใช่ learning AI",
    "why": "ต้องดูว่าระบบเลือก action ตาม goal และข้อมูลมากกว่ากฎตายตัวหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_021",
    "familyId": "threshold_system",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "threshold_system",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบที่ใช้ threshold เช่น ถ้าเกินค่าแล้วแจ้งเตือน เป็น AI เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก threshold rule อาจเป็น automation หรือ simple reflex ไม่ใช่ learning AI",
    "why": "ต้องดูว่าระบบเลือก action ตาม goal และข้อมูลมากกว่ากฎตายตัวหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_022",
    "familyId": "threshold_system",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "threshold_system",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบที่ใช้ threshold เช่น ถ้าเกินค่าแล้วแจ้งเตือน เป็น AI เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก threshold rule อาจเป็น automation หรือ simple reflex ไม่ใช่ learning AI",
    "why": "ต้องดูว่าระบบเลือก action ตาม goal และข้อมูลมากกว่ากฎตายตัวหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_023",
    "familyId": "threshold_system",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "threshold_system",
    "claim": "คำถามสอบเร็ว: “ระบบที่ใช้ threshold เช่น ถ้าเกินค่าแล้วแจ้งเตือน เป็น AI เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก threshold rule อาจเป็น automation หรือ simple reflex ไม่ใช่ learning AI",
    "why": "ต้องดูว่าระบบเลือก action ตาม goal และข้อมูลมากกว่ากฎตายตัวหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_024",
    "familyId": "threshold_system",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "threshold_system",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบที่ใช้ threshold เช่น ถ้าเกินค่าแล้วแจ้งเตือน เป็น AI เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก threshold rule อาจเป็น automation หรือ simple reflex ไม่ใช่ learning AI",
    "why": "ต้องดูว่าระบบเลือก action ตาม goal และข้อมูลมากกว่ากฎตายตัวหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_025",
    "familyId": "database_lookup",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "database_lookup",
    "claim": "Boss Claim: “ระบบที่ค้นฐานข้อมูลและแสดงคำตอบคือ AI เสมอ”",
    "answer": "ไม่ถูก การ lookup ข้อมูลอาจเป็น information system ธรรมดา",
    "why": "การมีข้อมูลหรือ database ไม่เท่ากับ intelligence",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_026",
    "familyId": "database_lookup",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "database_lookup",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบที่ค้นฐานข้อมูลและแสดงคำตอบคือ AI เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก การ lookup ข้อมูลอาจเป็น information system ธรรมดา",
    "why": "การมีข้อมูลหรือ database ไม่เท่ากับ intelligence",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_027",
    "familyId": "database_lookup",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "database_lookup",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบที่ค้นฐานข้อมูลและแสดงคำตอบคือ AI เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก การ lookup ข้อมูลอาจเป็น information system ธรรมดา",
    "why": "การมีข้อมูลหรือ database ไม่เท่ากับ intelligence",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_028",
    "familyId": "database_lookup",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "database_lookup",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบที่ค้นฐานข้อมูลและแสดงคำตอบคือ AI เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก การ lookup ข้อมูลอาจเป็น information system ธรรมดา",
    "why": "การมีข้อมูลหรือ database ไม่เท่ากับ intelligence",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_029",
    "familyId": "database_lookup",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "database_lookup",
    "claim": "คำถามสอบเร็ว: “ระบบที่ค้นฐานข้อมูลและแสดงคำตอบคือ AI เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก การ lookup ข้อมูลอาจเป็น information system ธรรมดา",
    "why": "การมีข้อมูลหรือ database ไม่เท่ากับ intelligence",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_030",
    "familyId": "database_lookup",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "database_lookup",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบที่ค้นฐานข้อมูลและแสดงคำตอบคือ AI เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก การ lookup ข้อมูลอาจเป็น information system ธรรมดา",
    "why": "การมีข้อมูลหรือ database ไม่เท่ากับ intelligence",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_031",
    "familyId": "random_not_ai",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "random_not_ai",
    "claim": "Boss Claim: “ระบบที่สุ่มคำตอบได้ถือว่าเป็น AI เพราะไม่ตายตัว”",
    "answer": "ไม่ถูก randomness ไม่เท่ากับ intelligence หรือ rationality",
    "why": "การสุ่มไม่มี goal-directed decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_032",
    "familyId": "random_not_ai",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "random_not_ai",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบที่สุ่มคำตอบได้ถือว่าเป็น AI เพราะไม่ตายตัว” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก randomness ไม่เท่ากับ intelligence หรือ rationality",
    "why": "การสุ่มไม่มี goal-directed decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_033",
    "familyId": "random_not_ai",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "random_not_ai",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบที่สุ่มคำตอบได้ถือว่าเป็น AI เพราะไม่ตายตัว” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก randomness ไม่เท่ากับ intelligence หรือ rationality",
    "why": "การสุ่มไม่มี goal-directed decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_034",
    "familyId": "random_not_ai",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "random_not_ai",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบที่สุ่มคำตอบได้ถือว่าเป็น AI เพราะไม่ตายตัว” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก randomness ไม่เท่ากับ intelligence หรือ rationality",
    "why": "การสุ่มไม่มี goal-directed decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_035",
    "familyId": "random_not_ai",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "random_not_ai",
    "claim": "คำถามสอบเร็ว: “ระบบที่สุ่มคำตอบได้ถือว่าเป็น AI เพราะไม่ตายตัว” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก randomness ไม่เท่ากับ intelligence หรือ rationality",
    "why": "การสุ่มไม่มี goal-directed decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_036",
    "familyId": "random_not_ai",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "AI vs Automation",
    "difficulty": "easy",
    "key": "random_not_ai",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบที่สุ่มคำตอบได้ถือว่าเป็น AI เพราะไม่ตายตัว” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก randomness ไม่เท่ากับ intelligence หรือ rationality",
    "why": "การสุ่มไม่มี goal-directed decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_037",
    "familyId": "sensor_agent",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor_agent",
    "claim": "Boss Claim: “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ”",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่พอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_038",
    "familyId": "sensor_agent",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor_agent",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่พอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_039",
    "familyId": "sensor_agent",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor_agent",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่พอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_040",
    "familyId": "sensor_agent",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor_agent",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่พอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_041",
    "familyId": "sensor_agent",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor_agent",
    "claim": "คำถามสอบเร็ว: “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่พอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_042",
    "familyId": "sensor_agent",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "sensor_agent",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้ามี sensor แปลว่าเป็น intelligent agent เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่เสมอ sensor เป็นแค่ช่องทางรับ percept ต้องมี action และ goal ด้วย",
    "why": "Sensor อย่างเดียวไม่พอ ต้องดู agent loop: perceive-decide-act",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_043",
    "familyId": "robot_only",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "Boss Claim: “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น”",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_044",
    "familyId": "robot_only",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_045",
    "familyId": "robot_only",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_046",
    "familyId": "robot_only",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_047",
    "familyId": "robot_only",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "คำถามสอบเร็ว: “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_048",
    "familyId": "robot_only",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "robot_only",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Agent ต้องเป็นหุ่นยนต์ที่จับต้องได้เท่านั้น” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก software agent ก็เป็น agent ได้ เช่น spam filter หรือ recommender",
    "why": "Agent คือสิ่งที่รับรู้และกระทำ ไม่จำเป็นต้องมีร่างกาย",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_049",
    "familyId": "goal_missing",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "Boss Claim: “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal”",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_050",
    "familyId": "goal_missing",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_051",
    "familyId": "goal_missing",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_052",
    "familyId": "goal_missing",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_053",
    "familyId": "goal_missing",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "คำถามสอบเร็ว: “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_054",
    "familyId": "goal_missing",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "goal_missing",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบที่ตอบสนอง input ได้ทุกระบบเป็น agent โดยไม่ต้องมี goal” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก การวิเคราะห์ agent ต้องดู goal หรือ performance measure",
    "why": "ถ้าไม่มีเป้าหมายจะประเมินความเหมาะสมของ action ไม่ได้",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_055",
    "familyId": "percept_action_loop",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "percept_action_loop",
    "claim": "Boss Claim: “Agent คือระบบที่มี output เท่านั้น ไม่จำเป็นต้องรับ percept”",
    "answer": "ไม่ถูก agent ต้องรับ percept จาก environment และเลือก action",
    "why": "agent loop ต้องมีการรับรู้และการกระทำสัมพันธ์กัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_056",
    "familyId": "percept_action_loop",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "percept_action_loop",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Agent คือระบบที่มี output เท่านั้น ไม่จำเป็นต้องรับ percept” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก agent ต้องรับ percept จาก environment และเลือก action",
    "why": "agent loop ต้องมีการรับรู้และการกระทำสัมพันธ์กัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_057",
    "familyId": "percept_action_loop",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "percept_action_loop",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Agent คือระบบที่มี output เท่านั้น ไม่จำเป็นต้องรับ percept” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก agent ต้องรับ percept จาก environment และเลือก action",
    "why": "agent loop ต้องมีการรับรู้และการกระทำสัมพันธ์กัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_058",
    "familyId": "percept_action_loop",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "percept_action_loop",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Agent คือระบบที่มี output เท่านั้น ไม่จำเป็นต้องรับ percept” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก agent ต้องรับ percept จาก environment และเลือก action",
    "why": "agent loop ต้องมีการรับรู้และการกระทำสัมพันธ์กัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_059",
    "familyId": "percept_action_loop",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "percept_action_loop",
    "claim": "คำถามสอบเร็ว: “Agent คือระบบที่มี output เท่านั้น ไม่จำเป็นต้องรับ percept” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก agent ต้องรับ percept จาก environment และเลือก action",
    "why": "agent loop ต้องมีการรับรู้และการกระทำสัมพันธ์กัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_060",
    "familyId": "percept_action_loop",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "easy",
    "key": "percept_action_loop",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Agent คือระบบที่มี output เท่านั้น ไม่จำเป็นต้องรับ percept” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก agent ต้องรับ percept จาก environment และเลือก action",
    "why": "agent loop ต้องมีการรับรู้และการกระทำสัมพันธ์กัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_061",
    "familyId": "software_agent",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "software_agent",
    "claim": "Boss Claim: “ถ้าไม่มี actuator แบบกายภาพ จะไม่ถือว่าเป็น agent”",
    "answer": "ไม่ถูก software agent มี actuator เป็นข้อความ คำแนะนำ ranking หรือ alert ได้",
    "why": "Action ไม่จำเป็นต้องเป็นการเคลื่อนที่ทางกายภาพ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_062",
    "familyId": "software_agent",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "software_agent",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้าไม่มี actuator แบบกายภาพ จะไม่ถือว่าเป็น agent” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก software agent มี actuator เป็นข้อความ คำแนะนำ ranking หรือ alert ได้",
    "why": "Action ไม่จำเป็นต้องเป็นการเคลื่อนที่ทางกายภาพ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_063",
    "familyId": "software_agent",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "software_agent",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้าไม่มี actuator แบบกายภาพ จะไม่ถือว่าเป็น agent” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก software agent มี actuator เป็นข้อความ คำแนะนำ ranking หรือ alert ได้",
    "why": "Action ไม่จำเป็นต้องเป็นการเคลื่อนที่ทางกายภาพ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_064",
    "familyId": "software_agent",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "software_agent",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้าไม่มี actuator แบบกายภาพ จะไม่ถือว่าเป็น agent” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก software agent มี actuator เป็นข้อความ คำแนะนำ ranking หรือ alert ได้",
    "why": "Action ไม่จำเป็นต้องเป็นการเคลื่อนที่ทางกายภาพ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_065",
    "familyId": "software_agent",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "software_agent",
    "claim": "คำถามสอบเร็ว: “ถ้าไม่มี actuator แบบกายภาพ จะไม่ถือว่าเป็น agent” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก software agent มี actuator เป็นข้อความ คำแนะนำ ranking หรือ alert ได้",
    "why": "Action ไม่จำเป็นต้องเป็นการเคลื่อนที่ทางกายภาพ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_066",
    "familyId": "software_agent",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "normal",
    "key": "software_agent",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้าไม่มี actuator แบบกายภาพ จะไม่ถือว่าเป็น agent” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก software agent มี actuator เป็นข้อความ คำแนะนำ ranking หรือ alert ได้",
    "why": "Action ไม่จำเป็นต้องเป็นการเคลื่อนที่ทางกายภาพ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_067",
    "familyId": "simple_reflex_agent",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "hard",
    "key": "simple_reflex_agent",
    "claim": "Boss Claim: “simple reflex agent ไม่ใช่ agent เพราะใช้กฎง่ายเกินไป”",
    "answer": "ไม่ถูก simple reflex agent ยังเป็น agent ได้ แต่ความสามารถจำกัด",
    "why": "Agent มีหลายชนิด ตั้งแต่ reflex ถึง learning/planning agent",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_068",
    "familyId": "simple_reflex_agent",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "hard",
    "key": "simple_reflex_agent",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “simple reflex agent ไม่ใช่ agent เพราะใช้กฎง่ายเกินไป” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก simple reflex agent ยังเป็น agent ได้ แต่ความสามารถจำกัด",
    "why": "Agent มีหลายชนิด ตั้งแต่ reflex ถึง learning/planning agent",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_069",
    "familyId": "simple_reflex_agent",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "hard",
    "key": "simple_reflex_agent",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “simple reflex agent ไม่ใช่ agent เพราะใช้กฎง่ายเกินไป” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก simple reflex agent ยังเป็น agent ได้ แต่ความสามารถจำกัด",
    "why": "Agent มีหลายชนิด ตั้งแต่ reflex ถึง learning/planning agent",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_070",
    "familyId": "simple_reflex_agent",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "hard",
    "key": "simple_reflex_agent",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “simple reflex agent ไม่ใช่ agent เพราะใช้กฎง่ายเกินไป” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก simple reflex agent ยังเป็น agent ได้ แต่ความสามารถจำกัด",
    "why": "Agent มีหลายชนิด ตั้งแต่ reflex ถึง learning/planning agent",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_071",
    "familyId": "simple_reflex_agent",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "hard",
    "key": "simple_reflex_agent",
    "claim": "คำถามสอบเร็ว: “simple reflex agent ไม่ใช่ agent เพราะใช้กฎง่ายเกินไป” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก simple reflex agent ยังเป็น agent ได้ แต่ความสามารถจำกัด",
    "why": "Agent มีหลายชนิด ตั้งแต่ reflex ถึง learning/planning agent",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_072",
    "familyId": "simple_reflex_agent",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Agent Foundation",
    "difficulty": "hard",
    "key": "simple_reflex_agent",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “simple reflex agent ไม่ใช่ agent เพราะใช้กฎง่ายเกินไป” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก simple reflex agent ยังเป็น agent ได้ แต่ความสามารถจำกัด",
    "why": "Agent มีหลายชนิด ตั้งแต่ reflex ถึง learning/planning agent",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_073",
    "familyId": "peas_p_sensor",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_p_sensor",
    "claim": "Boss Claim: “Performance measure คือ sensor ของ agent”",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_074",
    "familyId": "peas_p_sensor",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_p_sensor",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Performance measure คือ sensor ของ agent” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_075",
    "familyId": "peas_p_sensor",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_p_sensor",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Performance measure คือ sensor ของ agent” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_076",
    "familyId": "peas_p_sensor",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_p_sensor",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Performance measure คือ sensor ของ agent” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_077",
    "familyId": "peas_p_sensor",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_p_sensor",
    "claim": "คำถามสอบเร็ว: “Performance measure คือ sensor ของ agent” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_078",
    "familyId": "peas_p_sensor",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "easy",
    "key": "peas_p_sensor",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Performance measure คือ sensor ของ agent” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก Performance measure คือเกณฑ์วัดความสำเร็จ ส่วน sensor คือช่องทางรับข้อมูล",
    "why": "ใน PEAS ต้องแยก P กับ S ให้ชัด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_079",
    "familyId": "peas_actuator_robot",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_actuator_robot",
    "claim": "Boss Claim: “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น”",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_080",
    "familyId": "peas_actuator_robot",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_actuator_robot",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_081",
    "familyId": "peas_actuator_robot",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_actuator_robot",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_082",
    "familyId": "peas_actuator_robot",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_actuator_robot",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_083",
    "familyId": "peas_actuator_robot",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_actuator_robot",
    "claim": "คำถามสอบเร็ว: “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_084",
    "familyId": "peas_actuator_robot",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_actuator_robot",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Actuator ต้องเป็นแขนกล ล้อ หรือมอเตอร์เท่านั้น” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก actuator อาจเป็นข้อความ แจ้งเตือน การจัดอันดับ หรือคำแนะนำก็ได้",
    "why": "Actuator คือช่องทางที่ agent ส่ง action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_085",
    "familyId": "peas_environment_ui",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_environment_ui",
    "claim": "Boss Claim: “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น”",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_086",
    "familyId": "peas_environment_ui",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_environment_ui",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_087",
    "familyId": "peas_environment_ui",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_environment_ui",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_088",
    "familyId": "peas_environment_ui",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_environment_ui",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_089",
    "familyId": "peas_environment_ui",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_environment_ui",
    "claim": "คำถามสอบเร็ว: “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_090",
    "familyId": "peas_environment_ui",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_environment_ui",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Environment คือเฉพาะหน้าจอหรืออุปกรณ์ที่ผู้ใช้เห็น” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก environment คือโลก/บริบทที่ agent ทำงานอยู่ รวมถึงผู้ใช้ ข้อมูล กฎ และข้อจำกัด",
    "why": "Environment กว้างกว่า UI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_091",
    "familyId": "peas_component_list",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_component_list",
    "claim": "Boss Claim: “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server”",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_092",
    "familyId": "peas_component_list",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_component_list",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_093",
    "familyId": "peas_component_list",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_component_list",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_094",
    "familyId": "peas_component_list",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_component_list",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_095",
    "familyId": "peas_component_list",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_component_list",
    "claim": "คำถามสอบเร็ว: “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_096",
    "familyId": "peas_component_list",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_component_list",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “PEAS คือรายชื่อ component ของระบบ เช่น database, model, server” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่รายการชิ้นส่วนเทคโนโลยี",
    "why": "P/E/A/S มีความหมายเฉพาะ ไม่ใช่ architecture diagram",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_097",
    "familyId": "peas_goal_vs_performance",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_goal_vs_performance",
    "claim": "Boss Claim: “Performance measure คือ goal ที่เขียนกว้าง ๆ ได้โดยไม่ต้องวัดผล”",
    "answer": "ไม่ดีพอ Performance measure ควรเป็นเกณฑ์วัดความสำเร็จที่ตรวจได้",
    "why": "P ควรช่วยตัดสินว่า action ดีหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_098",
    "familyId": "peas_goal_vs_performance",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_goal_vs_performance",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Performance measure คือ goal ที่เขียนกว้าง ๆ ได้โดยไม่ต้องวัดผล” ควรแก้อย่างไร?",
    "answer": "ไม่ดีพอ Performance measure ควรเป็นเกณฑ์วัดความสำเร็จที่ตรวจได้",
    "why": "P ควรช่วยตัดสินว่า action ดีหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_099",
    "familyId": "peas_goal_vs_performance",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_goal_vs_performance",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Performance measure คือ goal ที่เขียนกว้าง ๆ ได้โดยไม่ต้องวัดผล” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ดีพอ Performance measure ควรเป็นเกณฑ์วัดความสำเร็จที่ตรวจได้",
    "why": "P ควรช่วยตัดสินว่า action ดีหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_100",
    "familyId": "peas_goal_vs_performance",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_goal_vs_performance",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Performance measure คือ goal ที่เขียนกว้าง ๆ ได้โดยไม่ต้องวัดผล” ควร feedback อย่างไร?",
    "answer": "ไม่ดีพอ Performance measure ควรเป็นเกณฑ์วัดความสำเร็จที่ตรวจได้",
    "why": "P ควรช่วยตัดสินว่า action ดีหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_101",
    "familyId": "peas_goal_vs_performance",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_goal_vs_performance",
    "claim": "คำถามสอบเร็ว: “Performance measure คือ goal ที่เขียนกว้าง ๆ ได้โดยไม่ต้องวัดผล” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ดีพอ Performance measure ควรเป็นเกณฑ์วัดความสำเร็จที่ตรวจได้",
    "why": "P ควรช่วยตัดสินว่า action ดีหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_102",
    "familyId": "peas_goal_vs_performance",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "normal",
    "key": "peas_goal_vs_performance",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Performance measure คือ goal ที่เขียนกว้าง ๆ ได้โดยไม่ต้องวัดผล” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ดีพอ Performance measure ควรเป็นเกณฑ์วัดความสำเร็จที่ตรวจได้",
    "why": "P ควรช่วยตัดสินว่า action ดีหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_103",
    "familyId": "peas_sensor_data",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "hard",
    "key": "peas_sensor_data",
    "claim": "Boss Claim: “Sensor คือข้อมูลทั้งหมดที่อยู่ใน database”",
    "answer": "ไม่เสมอ sensor คือช่องทางรับ percept; database อาจเป็นแหล่งข้อมูลหรือ memory",
    "why": "ต้องแยกช่องทางรับข้อมูลกับข้อมูลสะสม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_104",
    "familyId": "peas_sensor_data",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "hard",
    "key": "peas_sensor_data",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Sensor คือข้อมูลทั้งหมดที่อยู่ใน database” ควรแก้อย่างไร?",
    "answer": "ไม่เสมอ sensor คือช่องทางรับ percept; database อาจเป็นแหล่งข้อมูลหรือ memory",
    "why": "ต้องแยกช่องทางรับข้อมูลกับข้อมูลสะสม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_105",
    "familyId": "peas_sensor_data",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "hard",
    "key": "peas_sensor_data",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Sensor คือข้อมูลทั้งหมดที่อยู่ใน database” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่เสมอ sensor คือช่องทางรับ percept; database อาจเป็นแหล่งข้อมูลหรือ memory",
    "why": "ต้องแยกช่องทางรับข้อมูลกับข้อมูลสะสม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_106",
    "familyId": "peas_sensor_data",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "hard",
    "key": "peas_sensor_data",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Sensor คือข้อมูลทั้งหมดที่อยู่ใน database” ควร feedback อย่างไร?",
    "answer": "ไม่เสมอ sensor คือช่องทางรับ percept; database อาจเป็นแหล่งข้อมูลหรือ memory",
    "why": "ต้องแยกช่องทางรับข้อมูลกับข้อมูลสะสม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_107",
    "familyId": "peas_sensor_data",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "hard",
    "key": "peas_sensor_data",
    "claim": "คำถามสอบเร็ว: “Sensor คือข้อมูลทั้งหมดที่อยู่ใน database” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ sensor คือช่องทางรับ percept; database อาจเป็นแหล่งข้อมูลหรือ memory",
    "why": "ต้องแยกช่องทางรับข้อมูลกับข้อมูลสะสม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_108",
    "familyId": "peas_sensor_data",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "PEAS Gate",
    "difficulty": "hard",
    "key": "peas_sensor_data",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Sensor คือข้อมูลทั้งหมดที่อยู่ใน database” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่เสมอ sensor คือช่องทางรับ percept; database อาจเป็นแหล่งข้อมูลหรือ memory",
    "why": "ต้องแยกช่องทางรับข้อมูลกับข้อมูลสะสม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_109",
    "familyId": "observable_many_sensors",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_many_sensors",
    "claim": "Boss Claim: “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable”",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_110",
    "familyId": "observable_many_sensors",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_many_sensors",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ควรแก้อย่างไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_111",
    "familyId": "observable_many_sensors",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_many_sensors",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_112",
    "familyId": "observable_many_sensors",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_many_sensors",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ควร feedback อย่างไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_113",
    "familyId": "observable_many_sensors",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_many_sensors",
    "claim": "คำถามสอบเร็ว: “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_114",
    "familyId": "observable_many_sensors",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "observable_many_sensors",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้ามีกล้องหรือ sensor เยอะ environment ต้อง fully observable” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่เสมอ sensor อาจยังมี blind spot หรือไม่เห็น state สำคัญทั้งหมด",
    "why": "Fully observable คือ agent เห็นข้อมูลที่จำเป็นครบ ไม่ใช่แค่มี sensor มาก",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_115",
    "familyId": "dynamic_movement",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_movement",
    "claim": "Boss Claim: “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้”",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_116",
    "familyId": "dynamic_movement",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_movement",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_117",
    "familyId": "dynamic_movement",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_movement",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_118",
    "familyId": "dynamic_movement",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_movement",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_119",
    "familyId": "dynamic_movement",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_movement",
    "claim": "คำถามสอบเร็ว: “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_120",
    "familyId": "dynamic_movement",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "dynamic_movement",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Dynamic environment แปลว่า agent ต้องเคลื่อนที่ได้” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "why": "ตลาดหุ้นและ social feed เป็น dynamic แม้ agent เป็น software",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_121",
    "familyId": "stochastic_random_agent",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_random_agent",
    "claim": "Boss Claim: “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random”",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_122",
    "familyId": "stochastic_random_agent",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_random_agent",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_123",
    "familyId": "stochastic_random_agent",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_random_agent",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_124",
    "familyId": "stochastic_random_agent",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_random_agent",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_125",
    "familyId": "stochastic_random_agent",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_random_agent",
    "claim": "คำถามสอบเร็ว: “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_126",
    "familyId": "stochastic_random_agent",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "stochastic_random_agent",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Stochastic แปลว่า agent ทำงานแบบมั่วหรือ random” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก stochastic หมายถึงผลลัพธ์มีความไม่แน่นอน แม้ agent จะตัดสินใจอย่างมีเหตุผล",
    "why": "ความไม่แน่นอนของโลกไม่เท่ากับการทำงานมั่ว",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_127",
    "familyId": "multiagent_focus_one",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_focus_one",
    "claim": "Boss Claim: “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent”",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_128",
    "familyId": "multiagent_focus_one",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_focus_one",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_129",
    "familyId": "multiagent_focus_one",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_focus_one",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_130",
    "familyId": "multiagent_focus_one",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_focus_one",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_131",
    "familyId": "multiagent_focus_one",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_focus_one",
    "claim": "คำถามสอบเร็ว: “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_132",
    "familyId": "multiagent_focus_one",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "multiagent_focus_one",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้าเราสนใจ agent ตัวเดียว ระบบต้องเป็น single-agent” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/การกระทำกระทบกัน ก็เป็น multi-agent",
    "why": "ดูว่ามีผู้ตัดสินใจอื่นใน environment หรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_133",
    "familyId": "episodic_sequential",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "Boss Claim: “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ”",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_134",
    "familyId": "episodic_sequential",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_135",
    "familyId": "episodic_sequential",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_136",
    "familyId": "episodic_sequential",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_137",
    "familyId": "episodic_sequential",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "คำถามสอบเร็ว: “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_138",
    "familyId": "episodic_sequential",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "episodic_sequential",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “การตัดสินใจแต่ละครั้งไม่ต้องดูผลก่อนหน้าเสมอไป จึงเป็น episodic ทุกระบบ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก หลายงานเป็น sequential เพราะ action ก่อนหน้าส่งผลต่อสถานะถัดไป",
    "why": "เช่น recommendation, driving, learning path มัก sequential",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_139",
    "familyId": "discrete_continuous",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "discrete_continuous",
    "claim": "Boss Claim: “ถ้าระบบอยู่บนคอมพิวเตอร์ environment ต้องเป็น discrete เสมอ”",
    "answer": "ไม่ถูก บางปัญหามี state/action ต่อเนื่อง เช่น ความเร็ว อุณหภูมิ ตำแหน่ง",
    "why": "discrete/continuous ดูลักษณะ state/action ไม่ใช่อุปกรณ์",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_140",
    "familyId": "discrete_continuous",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "discrete_continuous",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้าระบบอยู่บนคอมพิวเตอร์ environment ต้องเป็น discrete เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก บางปัญหามี state/action ต่อเนื่อง เช่น ความเร็ว อุณหภูมิ ตำแหน่ง",
    "why": "discrete/continuous ดูลักษณะ state/action ไม่ใช่อุปกรณ์",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_141",
    "familyId": "discrete_continuous",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "discrete_continuous",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้าระบบอยู่บนคอมพิวเตอร์ environment ต้องเป็น discrete เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก บางปัญหามี state/action ต่อเนื่อง เช่น ความเร็ว อุณหภูมิ ตำแหน่ง",
    "why": "discrete/continuous ดูลักษณะ state/action ไม่ใช่อุปกรณ์",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_142",
    "familyId": "discrete_continuous",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "discrete_continuous",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้าระบบอยู่บนคอมพิวเตอร์ environment ต้องเป็น discrete เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก บางปัญหามี state/action ต่อเนื่อง เช่น ความเร็ว อุณหภูมิ ตำแหน่ง",
    "why": "discrete/continuous ดูลักษณะ state/action ไม่ใช่อุปกรณ์",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_143",
    "familyId": "discrete_continuous",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "discrete_continuous",
    "claim": "คำถามสอบเร็ว: “ถ้าระบบอยู่บนคอมพิวเตอร์ environment ต้องเป็น discrete เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก บางปัญหามี state/action ต่อเนื่อง เช่น ความเร็ว อุณหภูมิ ตำแหน่ง",
    "why": "discrete/continuous ดูลักษณะ state/action ไม่ใช่อุปกรณ์",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_144",
    "familyId": "discrete_continuous",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "discrete_continuous",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้าระบบอยู่บนคอมพิวเตอร์ environment ต้องเป็น discrete เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก บางปัญหามี state/action ต่อเนื่อง เช่น ความเร็ว อุณหภูมิ ตำแหน่ง",
    "why": "discrete/continuous ดูลักษณะ state/action ไม่ใช่อุปกรณ์",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_145",
    "familyId": "static_batch",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "static_batch",
    "claim": "Boss Claim: “งานวิเคราะห์ไฟล์ batch ทุกงานเป็น dynamic”",
    "answer": "ไม่ถูก ถ้าข้อมูลไม่เปลี่ยนระหว่างการตัดสินใจ อาจเป็น static",
    "why": "dynamic พิจารณาว่าโลกเปลี่ยนขณะ agent ตัดสินใจหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_146",
    "familyId": "static_batch",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "static_batch",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “งานวิเคราะห์ไฟล์ batch ทุกงานเป็น dynamic” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ถ้าข้อมูลไม่เปลี่ยนระหว่างการตัดสินใจ อาจเป็น static",
    "why": "dynamic พิจารณาว่าโลกเปลี่ยนขณะ agent ตัดสินใจหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_147",
    "familyId": "static_batch",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "static_batch",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “งานวิเคราะห์ไฟล์ batch ทุกงานเป็น dynamic” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ถ้าข้อมูลไม่เปลี่ยนระหว่างการตัดสินใจ อาจเป็น static",
    "why": "dynamic พิจารณาว่าโลกเปลี่ยนขณะ agent ตัดสินใจหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_148",
    "familyId": "static_batch",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "static_batch",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “งานวิเคราะห์ไฟล์ batch ทุกงานเป็น dynamic” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ถ้าข้อมูลไม่เปลี่ยนระหว่างการตัดสินใจ อาจเป็น static",
    "why": "dynamic พิจารณาว่าโลกเปลี่ยนขณะ agent ตัดสินใจหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_149",
    "familyId": "static_batch",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "static_batch",
    "claim": "คำถามสอบเร็ว: “งานวิเคราะห์ไฟล์ batch ทุกงานเป็น dynamic” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ถ้าข้อมูลไม่เปลี่ยนระหว่างการตัดสินใจ อาจเป็น static",
    "why": "dynamic พิจารณาว่าโลกเปลี่ยนขณะ agent ตัดสินใจหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_150",
    "familyId": "static_batch",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "normal",
    "key": "static_batch",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “งานวิเคราะห์ไฟล์ batch ทุกงานเป็น dynamic” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ถ้าข้อมูลไม่เปลี่ยนระหว่างการตัดสินใจ อาจเป็น static",
    "why": "dynamic พิจารณาว่าโลกเปลี่ยนขณะ agent ตัดสินใจหรือไม่",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_151",
    "familyId": "deterministic_uncertain",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "deterministic_uncertain",
    "claim": "Boss Claim: “ถ้า algorithm เหมือนเดิม ผลลัพธ์ environment ต้อง deterministic”",
    "answer": "ไม่เสมอ environment อาจมีความไม่แน่นอนจากโลกจริงหรือข้อมูลไม่ครบ",
    "why": "deterministic/stochastic ดูผลของ action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_152",
    "familyId": "deterministic_uncertain",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "deterministic_uncertain",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า algorithm เหมือนเดิม ผลลัพธ์ environment ต้อง deterministic” ควรแก้อย่างไร?",
    "answer": "ไม่เสมอ environment อาจมีความไม่แน่นอนจากโลกจริงหรือข้อมูลไม่ครบ",
    "why": "deterministic/stochastic ดูผลของ action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_153",
    "familyId": "deterministic_uncertain",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "deterministic_uncertain",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า algorithm เหมือนเดิม ผลลัพธ์ environment ต้อง deterministic” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่เสมอ environment อาจมีความไม่แน่นอนจากโลกจริงหรือข้อมูลไม่ครบ",
    "why": "deterministic/stochastic ดูผลของ action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_154",
    "familyId": "deterministic_uncertain",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "deterministic_uncertain",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า algorithm เหมือนเดิม ผลลัพธ์ environment ต้อง deterministic” ควร feedback อย่างไร?",
    "answer": "ไม่เสมอ environment อาจมีความไม่แน่นอนจากโลกจริงหรือข้อมูลไม่ครบ",
    "why": "deterministic/stochastic ดูผลของ action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_155",
    "familyId": "deterministic_uncertain",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "deterministic_uncertain",
    "claim": "คำถามสอบเร็ว: “ถ้า algorithm เหมือนเดิม ผลลัพธ์ environment ต้อง deterministic” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ environment อาจมีความไม่แน่นอนจากโลกจริงหรือข้อมูลไม่ครบ",
    "why": "deterministic/stochastic ดูผลของ action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_156",
    "familyId": "deterministic_uncertain",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Environment Gate",
    "difficulty": "hard",
    "key": "deterministic_uncertain",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า algorithm เหมือนเดิม ผลลัพธ์ environment ต้อง deterministic” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่เสมอ environment อาจมีความไม่แน่นอนจากโลกจริงหรือข้อมูลไม่ครบ",
    "why": "deterministic/stochastic ดูผลของ action ต่อ environment",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_157",
    "familyId": "rational_omniscient",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rational_omniscient",
    "claim": "Boss Claim: “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ”",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_158",
    "familyId": "rational_omniscient",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rational_omniscient",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_159",
    "familyId": "rational_omniscient",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rational_omniscient",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_160",
    "familyId": "rational_omniscient",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rational_omniscient",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_161",
    "familyId": "rational_omniscient",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rational_omniscient",
    "claim": "คำถามสอบเร็ว: “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_162",
    "familyId": "rational_omniscient",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "rational_omniscient",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Rational agent ต้องรู้คำตอบที่ดีที่สุดจริงเสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก rational agent เลือก action ที่คาดว่าดีที่สุดจาก percept และความรู้ที่มี",
    "why": "Rational ไม่ได้แปลว่า omniscient",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_163",
    "familyId": "bigdata_rational",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "Boss Claim: “ข้อมูลเยอะทำให้ agent rational เสมอ”",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_164",
    "familyId": "bigdata_rational",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_165",
    "familyId": "bigdata_rational",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_166",
    "familyId": "bigdata_rational",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_167",
    "familyId": "bigdata_rational",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "คำถามสอบเร็ว: “ข้อมูลเยอะทำให้ agent rational เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_168",
    "familyId": "bigdata_rational",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "normal",
    "key": "bigdata_rational",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ข้อมูลเยอะทำให้ agent rational เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ข้อมูลเยอะอาจช่วย แต่ต้องมี goal, model และ action selection ที่เหมาะสม",
    "why": "Big data ไม่ได้เท่ากับ good decision โดยอัตโนมัติ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_169",
    "familyId": "learning_required",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "Boss Claim: “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น”",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_170",
    "familyId": "learning_required",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_171",
    "familyId": "learning_required",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_172",
    "familyId": "learning_required",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_173",
    "familyId": "learning_required",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "คำถามสอบเร็ว: “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_174",
    "familyId": "learning_required",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "learning_required",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “Agent ทุกตัวต้องเรียนรู้จากข้อมูลเท่านั้น” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก agent อาจเป็น rule-based/simple reflex ได้ แต่ความสามารถต่างกัน",
    "why": "Agent และ machine learning เป็นคนละแนวคิดที่เกี่ยวข้องกัน",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_175",
    "familyId": "prediction_action",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "Boss Claim: “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ”",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_176",
    "familyId": "prediction_action",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_177",
    "familyId": "prediction_action",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_178",
    "familyId": "prediction_action",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_179",
    "familyId": "prediction_action",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "คำถามสอบเร็ว: “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_180",
    "familyId": "prediction_action",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "prediction_action",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้าระบบทำนายได้ก็ถือว่า action ดีเสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก prediction ต้องถูกนำไปใช้เลือก action ตาม performance measure",
    "why": "Prediction ไม่เท่ากับ decision ที่เหมาะสมเสมอ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_181",
    "familyId": "utility_tradeoff",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "utility_tradeoff",
    "claim": "Boss Claim: “ถ้า action ได้คะแนนด้านหนึ่งสูง ก็ rational เสมอ”",
    "answer": "ไม่เสมอ ต้องพิจารณา trade-off หลายเกณฑ์ เช่น ความปลอดภัย เวลา ค่าใช้จ่าย และความเป็นธรรม",
    "why": "Rationality ต้องดู performance measure ทั้งชุด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_182",
    "familyId": "utility_tradeoff",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "utility_tradeoff",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า action ได้คะแนนด้านหนึ่งสูง ก็ rational เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่เสมอ ต้องพิจารณา trade-off หลายเกณฑ์ เช่น ความปลอดภัย เวลา ค่าใช้จ่าย และความเป็นธรรม",
    "why": "Rationality ต้องดู performance measure ทั้งชุด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_183",
    "familyId": "utility_tradeoff",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "utility_tradeoff",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า action ได้คะแนนด้านหนึ่งสูง ก็ rational เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่เสมอ ต้องพิจารณา trade-off หลายเกณฑ์ เช่น ความปลอดภัย เวลา ค่าใช้จ่าย และความเป็นธรรม",
    "why": "Rationality ต้องดู performance measure ทั้งชุด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_184",
    "familyId": "utility_tradeoff",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "utility_tradeoff",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า action ได้คะแนนด้านหนึ่งสูง ก็ rational เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่เสมอ ต้องพิจารณา trade-off หลายเกณฑ์ เช่น ความปลอดภัย เวลา ค่าใช้จ่าย และความเป็นธรรม",
    "why": "Rationality ต้องดู performance measure ทั้งชุด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_185",
    "familyId": "utility_tradeoff",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "utility_tradeoff",
    "claim": "คำถามสอบเร็ว: “ถ้า action ได้คะแนนด้านหนึ่งสูง ก็ rational เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ ต้องพิจารณา trade-off หลายเกณฑ์ เช่น ความปลอดภัย เวลา ค่าใช้จ่าย และความเป็นธรรม",
    "why": "Rationality ต้องดู performance measure ทั้งชุด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_186",
    "familyId": "utility_tradeoff",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "utility_tradeoff",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า action ได้คะแนนด้านหนึ่งสูง ก็ rational เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่เสมอ ต้องพิจารณา trade-off หลายเกณฑ์ เช่น ความปลอดภัย เวลา ค่าใช้จ่าย และความเป็นธรรม",
    "why": "Rationality ต้องดู performance measure ทั้งชุด",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_187",
    "familyId": "limited_info",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "limited_info",
    "claim": "Boss Claim: “ถ้า agent ตัดสินใจผิด แปลว่าไม่ rational เสมอ”",
    "answer": "ไม่เสมอ หากข้อมูลจำกัด agent อาจ rational ตามสิ่งที่รู้ แต่ผลลัพธ์ยังผิดได้",
    "why": "ประเมิน rationality จาก expected outcome ตาม percept/knowledge",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_188",
    "familyId": "limited_info",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "limited_info",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า agent ตัดสินใจผิด แปลว่าไม่ rational เสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่เสมอ หากข้อมูลจำกัด agent อาจ rational ตามสิ่งที่รู้ แต่ผลลัพธ์ยังผิดได้",
    "why": "ประเมิน rationality จาก expected outcome ตาม percept/knowledge",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_189",
    "familyId": "limited_info",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "limited_info",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า agent ตัดสินใจผิด แปลว่าไม่ rational เสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่เสมอ หากข้อมูลจำกัด agent อาจ rational ตามสิ่งที่รู้ แต่ผลลัพธ์ยังผิดได้",
    "why": "ประเมิน rationality จาก expected outcome ตาม percept/knowledge",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_190",
    "familyId": "limited_info",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "limited_info",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า agent ตัดสินใจผิด แปลว่าไม่ rational เสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่เสมอ หากข้อมูลจำกัด agent อาจ rational ตามสิ่งที่รู้ แต่ผลลัพธ์ยังผิดได้",
    "why": "ประเมิน rationality จาก expected outcome ตาม percept/knowledge",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_191",
    "familyId": "limited_info",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "limited_info",
    "claim": "คำถามสอบเร็ว: “ถ้า agent ตัดสินใจผิด แปลว่าไม่ rational เสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่เสมอ หากข้อมูลจำกัด agent อาจ rational ตามสิ่งที่รู้ แต่ผลลัพธ์ยังผิดได้",
    "why": "ประเมิน rationality จาก expected outcome ตาม percept/knowledge",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_192",
    "familyId": "limited_info",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Rationality Gate",
    "difficulty": "hard",
    "key": "limited_info",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า agent ตัดสินใจผิด แปลว่าไม่ rational เสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่เสมอ หากข้อมูลจำกัด agent อาจ rational ตามสิ่งที่รู้ แต่ผลลัพธ์ยังผิดได้",
    "why": "ประเมิน rationality จาก expected outcome ตาม percept/knowledge",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_193",
    "familyId": "ethics_safety",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "Boss Claim: “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics”",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_194",
    "familyId": "ethics_safety",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_195",
    "familyId": "ethics_safety",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_196",
    "familyId": "ethics_safety",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_197",
    "familyId": "ethics_safety",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "คำถามสอบเร็ว: “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_198",
    "familyId": "ethics_safety",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "ethics_safety",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า agent ได้คะแนนสูงตาม performance measure ก็ไม่ต้องดู ethics” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก performance measure ควรคำนึงถึงความปลอดภัย ความเป็นธรรม และผลกระทบ",
    "why": "AI ที่ดีต้องคุมทั้งประสิทธิภาพและความรับผิดชอบ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_199",
    "familyId": "explainability",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "Boss Claim: “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก”",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_200",
    "familyId": "explainability",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_201",
    "familyId": "explainability",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_202",
    "familyId": "explainability",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_203",
    "familyId": "explainability",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "คำถามสอบเร็ว: “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_204",
    "familyId": "explainability",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "explainability",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบ AI ไม่จำเป็นต้องอธิบายเหตุผล เพราะขอแค่ตอบถูก” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ในบริบทสำคัญ ควรอธิบายเหตุผล/ข้อจำกัดเพื่อให้ตรวจสอบได้",
    "why": "Explainability ช่วยลดความเสี่ยงและสร้างความเข้าใจ",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_205",
    "familyId": "bias_fairness",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "bias_fairness",
    "claim": "Boss Claim: “ถ้า model accuracy สูง แปลว่าไม่มี bias”",
    "answer": "ไม่ถูก accuracy สูงโดยรวมอาจยังไม่เป็นธรรมกับบางกลุ่ม",
    "why": "ต้องดู fairness และ error แยกกลุ่ม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_206",
    "familyId": "bias_fairness",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "bias_fairness",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า model accuracy สูง แปลว่าไม่มี bias” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก accuracy สูงโดยรวมอาจยังไม่เป็นธรรมกับบางกลุ่ม",
    "why": "ต้องดู fairness และ error แยกกลุ่ม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_207",
    "familyId": "bias_fairness",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "bias_fairness",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า model accuracy สูง แปลว่าไม่มี bias” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก accuracy สูงโดยรวมอาจยังไม่เป็นธรรมกับบางกลุ่ม",
    "why": "ต้องดู fairness และ error แยกกลุ่ม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_208",
    "familyId": "bias_fairness",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "bias_fairness",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า model accuracy สูง แปลว่าไม่มี bias” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก accuracy สูงโดยรวมอาจยังไม่เป็นธรรมกับบางกลุ่ม",
    "why": "ต้องดู fairness และ error แยกกลุ่ม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_209",
    "familyId": "bias_fairness",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "bias_fairness",
    "claim": "คำถามสอบเร็ว: “ถ้า model accuracy สูง แปลว่าไม่มี bias” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก accuracy สูงโดยรวมอาจยังไม่เป็นธรรมกับบางกลุ่ม",
    "why": "ต้องดู fairness และ error แยกกลุ่ม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_210",
    "familyId": "bias_fairness",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "bias_fairness",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า model accuracy สูง แปลว่าไม่มี bias” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก accuracy สูงโดยรวมอาจยังไม่เป็นธรรมกับบางกลุ่ม",
    "why": "ต้องดู fairness และ error แยกกลุ่ม",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_211",
    "familyId": "privacy_data",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "privacy_data",
    "claim": "Boss Claim: “ใช้ข้อมูลมากที่สุดย่อมดีที่สุดเสมอ”",
    "answer": "ไม่ถูก ต้องคำนึงถึงความจำเป็น ความเป็นส่วนตัว ความยินยอม และความปลอดภัย",
    "why": "Data minimization และ privacy เป็นส่วนหนึ่งของ responsible AI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_212",
    "familyId": "privacy_data",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "privacy_data",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ใช้ข้อมูลมากที่สุดย่อมดีที่สุดเสมอ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ต้องคำนึงถึงความจำเป็น ความเป็นส่วนตัว ความยินยอม และความปลอดภัย",
    "why": "Data minimization และ privacy เป็นส่วนหนึ่งของ responsible AI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_213",
    "familyId": "privacy_data",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "privacy_data",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ใช้ข้อมูลมากที่สุดย่อมดีที่สุดเสมอ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ต้องคำนึงถึงความจำเป็น ความเป็นส่วนตัว ความยินยอม และความปลอดภัย",
    "why": "Data minimization และ privacy เป็นส่วนหนึ่งของ responsible AI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_214",
    "familyId": "privacy_data",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "privacy_data",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ใช้ข้อมูลมากที่สุดย่อมดีที่สุดเสมอ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ต้องคำนึงถึงความจำเป็น ความเป็นส่วนตัว ความยินยอม และความปลอดภัย",
    "why": "Data minimization และ privacy เป็นส่วนหนึ่งของ responsible AI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_215",
    "familyId": "privacy_data",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "privacy_data",
    "claim": "คำถามสอบเร็ว: “ใช้ข้อมูลมากที่สุดย่อมดีที่สุดเสมอ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ต้องคำนึงถึงความจำเป็น ความเป็นส่วนตัว ความยินยอม และความปลอดภัย",
    "why": "Data minimization และ privacy เป็นส่วนหนึ่งของ responsible AI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_216",
    "familyId": "privacy_data",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "privacy_data",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ใช้ข้อมูลมากที่สุดย่อมดีที่สุดเสมอ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ต้องคำนึงถึงความจำเป็น ความเป็นส่วนตัว ความยินยอม และความปลอดภัย",
    "why": "Data minimization และ privacy เป็นส่วนหนึ่งของ responsible AI",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_217",
    "familyId": "human_oversight",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "human_oversight",
    "claim": "Boss Claim: “ถ้า agent rational แล้วไม่ต้องมีมนุษย์กำกับ”",
    "answer": "ไม่ถูก งานสำคัญควรมี human oversight และ accountability",
    "why": "AI decision ควรตรวจสอบได้โดยเฉพาะ high-stakes context",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_218",
    "familyId": "human_oversight",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "human_oversight",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า agent rational แล้วไม่ต้องมีมนุษย์กำกับ” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก งานสำคัญควรมี human oversight และ accountability",
    "why": "AI decision ควรตรวจสอบได้โดยเฉพาะ high-stakes context",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_219",
    "familyId": "human_oversight",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "human_oversight",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า agent rational แล้วไม่ต้องมีมนุษย์กำกับ” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก งานสำคัญควรมี human oversight และ accountability",
    "why": "AI decision ควรตรวจสอบได้โดยเฉพาะ high-stakes context",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_220",
    "familyId": "human_oversight",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "human_oversight",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า agent rational แล้วไม่ต้องมีมนุษย์กำกับ” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก งานสำคัญควรมี human oversight และ accountability",
    "why": "AI decision ควรตรวจสอบได้โดยเฉพาะ high-stakes context",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_221",
    "familyId": "human_oversight",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "human_oversight",
    "claim": "คำถามสอบเร็ว: “ถ้า agent rational แล้วไม่ต้องมีมนุษย์กำกับ” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก งานสำคัญควรมี human oversight และ accountability",
    "why": "AI decision ควรตรวจสอบได้โดยเฉพาะ high-stakes context",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_222",
    "familyId": "human_oversight",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "human_oversight",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า agent rational แล้วไม่ต้องมีมนุษย์กำกับ” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก งานสำคัญควรมี human oversight และ accountability",
    "why": "AI decision ควรตรวจสอบได้โดยเฉพาะ high-stakes context",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_223",
    "familyId": "deployment_risk",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "normal",
    "key": "deployment_risk",
    "claim": "Boss Claim: “ถ้า prototype เล่นได้ แปลว่าพร้อม deploy จริงทันที”",
    "answer": "ไม่ถูก ต้องทดสอบความปลอดภัย ความเสถียร bias และผลกระทบก่อน deploy",
    "why": "งาน AI ต้องมี validation ก่อนใช้จริง",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_224",
    "familyId": "deployment_risk",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "normal",
    "key": "deployment_risk",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า prototype เล่นได้ แปลว่าพร้อม deploy จริงทันที” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ต้องทดสอบความปลอดภัย ความเสถียร bias และผลกระทบก่อน deploy",
    "why": "งาน AI ต้องมี validation ก่อนใช้จริง",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_225",
    "familyId": "deployment_risk",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "normal",
    "key": "deployment_risk",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า prototype เล่นได้ แปลว่าพร้อม deploy จริงทันที” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ต้องทดสอบความปลอดภัย ความเสถียร bias และผลกระทบก่อน deploy",
    "why": "งาน AI ต้องมี validation ก่อนใช้จริง",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_226",
    "familyId": "deployment_risk",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "normal",
    "key": "deployment_risk",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า prototype เล่นได้ แปลว่าพร้อม deploy จริงทันที” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ต้องทดสอบความปลอดภัย ความเสถียร bias และผลกระทบก่อน deploy",
    "why": "งาน AI ต้องมี validation ก่อนใช้จริง",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_227",
    "familyId": "deployment_risk",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "normal",
    "key": "deployment_risk",
    "claim": "คำถามสอบเร็ว: “ถ้า prototype เล่นได้ แปลว่าพร้อม deploy จริงทันที” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ต้องทดสอบความปลอดภัย ความเสถียร bias และผลกระทบก่อน deploy",
    "why": "งาน AI ต้องมี validation ก่อนใช้จริง",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_228",
    "familyId": "deployment_risk",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "normal",
    "key": "deployment_risk",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า prototype เล่นได้ แปลว่าพร้อม deploy จริงทันที” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ต้องทดสอบความปลอดภัย ความเสถียร bias และผลกระทบก่อน deploy",
    "why": "งาน AI ต้องมี validation ก่อนใช้จริง",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_229",
    "familyId": "feedback_loop",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "feedback_loop",
    "claim": "Boss Claim: “ระบบที่เรียนรู้จาก feedback ไม่มีทางแย่ลง”",
    "answer": "ไม่ถูก feedback loop อาจทำให้ bias หรือ error สะสมได้ถ้าออกแบบไม่ดี",
    "why": "ต้อง monitor data drift และ feedback quality",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_230",
    "familyId": "feedback_loop",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "feedback_loop",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ระบบที่เรียนรู้จาก feedback ไม่มีทางแย่ลง” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก feedback loop อาจทำให้ bias หรือ error สะสมได้ถ้าออกแบบไม่ดี",
    "why": "ต้อง monitor data drift และ feedback quality",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_231",
    "familyId": "feedback_loop",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "feedback_loop",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ระบบที่เรียนรู้จาก feedback ไม่มีทางแย่ลง” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก feedback loop อาจทำให้ bias หรือ error สะสมได้ถ้าออกแบบไม่ดี",
    "why": "ต้อง monitor data drift และ feedback quality",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_232",
    "familyId": "feedback_loop",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "feedback_loop",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ระบบที่เรียนรู้จาก feedback ไม่มีทางแย่ลง” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก feedback loop อาจทำให้ bias หรือ error สะสมได้ถ้าออกแบบไม่ดี",
    "why": "ต้อง monitor data drift และ feedback quality",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_233",
    "familyId": "feedback_loop",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "feedback_loop",
    "claim": "คำถามสอบเร็ว: “ระบบที่เรียนรู้จาก feedback ไม่มีทางแย่ลง” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก feedback loop อาจทำให้ bias หรือ error สะสมได้ถ้าออกแบบไม่ดี",
    "why": "ต้อง monitor data drift และ feedback quality",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_234",
    "familyId": "feedback_loop",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "feedback_loop",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ระบบที่เรียนรู้จาก feedback ไม่มีทางแย่ลง” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก feedback loop อาจทำให้ bias หรือ error สะสมได้ถ้าออกแบบไม่ดี",
    "why": "ต้อง monitor data drift และ feedback quality",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_235",
    "familyId": "accountability",
    "variantId": "direct",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "accountability",
    "claim": "Boss Claim: “ถ้า AI ตัดสินใจผิด ความรับผิดชอบอยู่ที่ AI เท่านั้น”",
    "answer": "ไม่ถูก ผู้พัฒนา/ผู้ใช้งาน/องค์กรยังต้องรับผิดชอบการออกแบบและการนำไปใช้",
    "why": "Responsible AI ต้องมี accountability",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_236",
    "familyId": "accountability",
    "variantId": "student",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "accountability",
    "claim": "นักศึกษาคนหนึ่งสรุปว่า “ถ้า AI ตัดสินใจผิด ความรับผิดชอบอยู่ที่ AI เท่านั้น” ควรแก้อย่างไร?",
    "answer": "ไม่ถูก ผู้พัฒนา/ผู้ใช้งาน/องค์กรยังต้องรับผิดชอบการออกแบบและการนำไปใช้",
    "why": "Responsible AI ต้องมี accountability",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_237",
    "familyId": "accountability",
    "variantId": "project",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "accountability",
    "claim": "ใน Mini Project มีทีมอธิบายว่า “ถ้า AI ตัดสินใจผิด ความรับผิดชอบอยู่ที่ AI เท่านั้น” ข้อสรุปนี้มีปัญหาอย่างไร?",
    "answer": "ไม่ถูก ผู้พัฒนา/ผู้ใช้งาน/องค์กรยังต้องรับผิดชอบการออกแบบและการนำไปใช้",
    "why": "Responsible AI ต้องมี accountability",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_238",
    "familyId": "accountability",
    "variantId": "debug",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "accountability",
    "claim": "Debug misconception: ถ้าระบบเชื่อว่า “ถ้า AI ตัดสินใจผิด ความรับผิดชอบอยู่ที่ AI เท่านั้น” ควร feedback อย่างไร?",
    "answer": "ไม่ถูก ผู้พัฒนา/ผู้ใช้งาน/องค์กรยังต้องรับผิดชอบการออกแบบและการนำไปใช้",
    "why": "Responsible AI ต้องมี accountability",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_239",
    "familyId": "accountability",
    "variantId": "exam",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "accountability",
    "claim": "คำถามสอบเร็ว: “ถ้า AI ตัดสินใจผิด ความรับผิดชอบอยู่ที่ AI เท่านั้น” คำตอบที่เหมาะสมที่สุดคืออะไร?",
    "answer": "ไม่ถูก ผู้พัฒนา/ผู้ใช้งาน/องค์กรยังต้องรับผิดชอบการออกแบบและการนำไปใช้",
    "why": "Responsible AI ต้องมี accountability",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  },
  {
    "id": "b1_claim_240",
    "familyId": "accountability",
    "variantId": "scenario",
    "type": "boss_claim",
    "phase": "Final Attack",
    "difficulty": "hard",
    "key": "accountability",
    "claim": "ระหว่างออกแบบ agent มีข้ออ้างว่า “ถ้า AI ตัดสินใจผิด ความรับผิดชอบอยู่ที่ AI เท่านั้น” ให้เลือกคำโต้แย้งที่ถูกต้องที่สุด",
    "answer": "ไม่ถูก ผู้พัฒนา/ผู้ใช้งาน/องค์กรยังต้องรับผิดชอบการออกแบบและการนำไปใช้",
    "why": "Responsible AI ต้องมี accountability",
    "hint": "จับคำสำคัญว่า misconception อยู่ที่ AI/Automation, Agent, PEAS, Environment, Rationality หรือ Responsible AI",
    "distractors": [
      "ถูก เพราะระบบดิจิทัลทุกระบบถือว่าเป็น AI ได้",
      "ถูก เพราะถ้ามี sensor หรือข้อมูล ก็เป็น intelligent agent โดยอัตโนมัติ",
      "ถูก เพราะระบบที่ทำงานเร็วหรืออัตโนมัติย่อมตัดสินใจได้ดี",
      "ไม่ต้องพิจารณา goal, performance measure หรือ environment"
    ]
  }
];
  function profileKey(){try{const p=window.AIQuestStorage&&AIQuestStorage.getProfile?AIQuestStorage.getProfile():{};return String((p.studentId||'anon')+'_'+(p.section||'101')).replace(/[^\w-]/g,'_');}catch(e){return 'anon_101';}}
  function readAll(key){try{const all=JSON.parse(localStorage.getItem(key)||'{}');const pk=profileKey();return Array.isArray(all[pk])?all[pk]:[];}catch(e){return [];}}
  function readHistory(){const p=readAll(RECENT_KEY);return p.length?p:readAll(LEGACY_RECENT_KEY);}
  function writeHistory(entry){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}');const pk=profileKey();const list=Array.isArray(all[pk])?all[pk]:[];list.unshift(entry);all[pk]=list.slice(0,ITEM_RECENT_WINDOW);localStorage.setItem(RECENT_KEY,JSON.stringify(all));}catch(e){}}
  function recentSets(){const h=readHistory();const itemIds=new Set(), familyHard=new Set(), familySoft=new Set();h.slice(0,ITEM_RECENT_WINDOW).forEach(r=>(r.itemIds||[]).forEach(id=>itemIds.add(id)));h.slice(0,FAMILY_HARD_WINDOW).forEach(r=>(r.familyIds||[]).forEach(id=>familyHard.add(id)));h.slice(0,FAMILY_SOFT_WINDOW).forEach(r=>(r.familyIds||[]).forEach(id=>familySoft.add(id)));return {itemIds,familyHard,familySoft};}
  function shuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function rank(v){return {easy:1,normal:2,hard:3,challenge:4}[v||'normal']||2;}
  function readWeakKeys(){const keys=[];['CSAI2102_AIQUEST_S2_WEAK_MIS_V256','CSAI2102_AIQUEST_S2_WEAK_MIS_V258','CSAI2102_AIQUEST_S2_WEAK_MIS_V259'].forEach(k=>{try{const d=JSON.parse(localStorage.getItem(k)||'{}');Object.entries(d.mis||{}).sort((a,b)=>Number(b[1])-Number(a[1])).forEach(p=>{if(p[0]&&!keys.includes(p[0]))keys.push(p[0]);});}catch(e){}});return keys.slice(0,8);}
  function itemScore(item,recent,used,diff,weak,allowHard){let s=100;const dr=rank(diff), ir=rank(item.difficulty||'normal');if(recent.itemIds.has(item.id))s-=120;if(!allowHard&&recent.familyHard.has(item.familyId))s-=100;if(recent.familySoft.has(item.familyId))s-=42;if(used.has(item.familyId))s-=85;if(diff!=='challenge'&&ir>dr+1)s-=28;s-=Math.abs(dr-ir)*5;if(weak.includes(item.key))s+=30;if(item.variantId==='scenario'||item.variantId==='project')s+=4;s+=Math.random()*8;return s;}
  function pickFromPhase(phaseItems,count,diff,weak,used){const recent=recentSets();const picked=[];let pool=phaseItems.slice();for(let i=0;i<count;i++){if(!pool.length)break;let candidates=pool.filter(it=>!recent.itemIds.has(it.id)&&!recent.familyHard.has(it.familyId)&&!used.has(it.familyId));let allowHard=false;if(!candidates.length)candidates=pool.filter(it=>!recent.itemIds.has(it.id)&&!used.has(it.familyId));if(!candidates.length){candidates=pool.filter(it=>!recent.itemIds.has(it.id));allowHard=true;}if(!candidates.length){candidates=pool;allowHard=true;}candidates.sort((a,b)=>itemScore(b,recent,used,diff,weak,allowHard)-itemScore(a,recent,used,diff,weak,allowHard));const best=candidates[0];const bestScore=itemScore(best,recent,used,diff,weak,allowHard);const top=candidates.filter(it=>itemScore(it,recent,used,diff,weak,allowHard)>=bestScore-7).slice(0,10);const chosen=shuffle(top)[0]||best;picked.push(chosen);used.add(chosen.familyId);pool.splice(pool.findIndex(it=>it.id===chosen.id),1);}return picked;}
  function phaseCountsFor(d){return {easy:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':1,'Rationality Gate':1,'Final Attack':1},normal:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':2,'Rationality Gate':2,'Final Attack':2},hard:{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':3,'Environment Gate':3,'Rationality Gate':2,'Final Attack':2},challenge:{'AI vs Automation':2,'Agent Foundation':3,'PEAS Gate':3,'Environment Gate':3,'Rationality Gate':3,'Final Attack':2}}[d||'normal']||{'AI vs Automation':2,'Agent Foundation':2,'PEAS Gate':2,'Environment Gate':2,'Rationality Gate':2,'Final Attack':2};}
  function buildBoss1Round(difficulty){const diff=difficulty||'normal';const weak=readWeakKeys();const used=new Set();const counts=phaseCountsFor(diff);let claims=[];Object.keys(counts).forEach(phase=>{claims=claims.concat(pickFromPhase(BOSS1_CLAIMS.filter(it=>it.phase===phase),counts[phase],diff,weak,used));});const itemIds=claims.map(it=>it.id), familyIds=claims.map(it=>it.familyId);writeHistory({ts:new Date().toISOString(),difficulty:diff,itemIds,familyIds,weakKeys:weak,policy:'itemWindow8-familyHard3-familySoft8-withinRunFamilyLock'});return {version:VERSION,title:'B1: Rookie AI Boss',phases:['AI vs Automation','Agent Foundation','PEAS Gate','Environment Gate','Rationality Gate','Final Attack'],claims,weakKeys:weak,noRepeat:{itemRecentWindow:ITEM_RECENT_WINDOW,familyHardWindow:FAMILY_HARD_WINDOW,familySoftWindow:FAMILY_SOFT_WINDOW,itemIds,familyIds,policy:'strong'}};}
  function resetBoss1History(){try{[RECENT_KEY,LEGACY_RECENT_KEY].forEach(k=>{const all=JSON.parse(localStorage.getItem(k)||'{}');delete all[profileKey()];localStorage.setItem(k,JSON.stringify(all));});}catch(e){}}
  function bankStats(){const byPhase={},byFamily={};BOSS1_CLAIMS.forEach(it=>{byPhase[it.phase]=(byPhase[it.phase]||0)+1;byFamily[it.familyId]=(byFamily[it.familyId]||0)+1;});return {claims:BOSS1_CLAIMS.length,total:BOSS1_CLAIMS.length,families:Object.keys(byFamily).length,variantsPerFamily:6,byPhase,recentPolicy:'item 8 attempts, family hard 3 attempts, family soft 8 attempts'};}
  window.AIQUEST_BOSS1_BANK={VERSION,RECENT_KEY,ITEM_RECENT_WINDOW,FAMILY_HARD_WINDOW,FAMILY_SOFT_WINDOW,BOSS1_CLAIMS,buildBoss1Round,resetBoss1History,counts:bankStats()};
  window.buildBoss1Round=buildBoss1Round;
  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_BOSS1_BANK.counts);
})();
