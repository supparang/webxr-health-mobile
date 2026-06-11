/*
  CSAI2102 AI Quest
  PATCH v2.6.6 Session 2 Expanded Bank + No-repeat Engine
  ------------------------------------------------------------
  Static curated items:
  - Agent or Not: 60
  - PEAS Builder: 70
  - Environment Classifier: 60
  - Rational Agent Boss: 30
  - Reflection / Transfer Prompts: 20
  Total: 240

  No-repeat:
  - itemId recent lock
  - familyId recent lock
  - recent window: 5 rounds
  - least-recently-seen fallback
  - family lock within one run
*/
(function(){
  'use strict';

  const VERSION = 'v2.6.6-session2-expanded-bank-norepeat';
  const RECENT_KEY = 'CSAI2102_AIQUEST_S2_RECENT_HISTORY_V255';
  const RECENT_WINDOW = 5;

  const AGENT_CARDS = [
  {
    "id": "s2_agent_001",
    "familyId": "traffic_route",
    "type": "agent",
    "difficulty": "easy",
    "label": "ระบบแนะนำเส้นทางที่ปรับตามสภาพจราจรแบบ real-time",
    "answer": "Agent",
    "hint": "รับ percept จาก traffic แล้วเลือก action เป็นเส้นทางเพื่อบรรลุ goal",
    "why": "มีข้อมูลจราจร/ตำแหน่งและเลือก route ตามเป้าหมายเวลา/ความปลอดภัย",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_002",
    "familyId": "calculator",
    "type": "agent",
    "difficulty": "easy",
    "label": "เครื่องคิดเลขที่คำนวณตามสูตรที่ผู้ใช้กด",
    "answer": "Not Agent",
    "hint": "มี goal-directed decision หรือแค่คำนวณตามคำสั่ง?",
    "why": "เป็นโปรแกรมคำนวณตามคำสั่ง ไม่ได้เลือก action จาก environment",
    "misconception": "calculator"
  },
  {
    "id": "s2_agent_003",
    "familyId": "robot_vacuum",
    "type": "agent",
    "difficulty": "easy",
    "label": "หุ่นยนต์ดูดฝุ่นที่ตรวจจับสิ่งกีดขวางและเปลี่ยนเส้นทาง",
    "answer": "Agent",
    "hint": "มี sensor, percept และ action ต่อ environment",
    "why": "รับรู้สิ่งกีดขวางและเลือกการเคลื่อนที่เพื่อทำความสะอาด",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_004",
    "familyId": "latest_sort_shop",
    "type": "agent",
    "difficulty": "easy",
    "label": "เว็บร้านค้าที่เรียงสินค้าตามวันที่เพิ่มล่าสุดเสมอ",
    "answer": "Not Agent",
    "hint": "เรียงตาม rule ตายตัวหรือปรับตามเป้าหมาย/ผู้ใช้?",
    "why": "เป็น rule-based sorting ตายตัว ไม่ได้มี rational action selection",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_005",
    "familyId": "flood_warning",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบแจ้งเตือนน้ำท่วมที่วิเคราะห์ระดับน้ำและแนะนำเส้นทางปลอดภัย",
    "answer": "Agent",
    "hint": "มี goal ด้านความปลอดภัยและเลือก recommendation",
    "why": "รับข้อมูลน้ำ/พื้นที่แล้วแนะนำ action เพื่อหลีกเลี่ยงความเสี่ยง",
    "misconception": "database"
  },
  {
    "id": "s2_agent_006",
    "familyId": "vending_machine",
    "type": "agent",
    "difficulty": "easy",
    "label": "เครื่องขายน้ำอัตโนมัติที่ปล่อยน้ำเมื่อหยอดเหรียญครบ",
    "answer": "Not Agent",
    "hint": "ตอบตามเงื่อนไขตายตัวหรือมี rational decision?",
    "why": "เป็น automation/rule-based มากกว่า intelligent agent",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_007",
    "familyId": "spam_filter",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบคัดกรองอีเมลสแปมที่เรียนรู้จากตัวอย่างอีเมล",
    "answer": "Agent",
    "hint": "มี percept เป็นอีเมลและ action เป็นการ classify",
    "why": "รับข้อความอีเมลแล้วเลือก label เพื่อบรรลุ goal ลด spam",
    "misconception": "software_agent"
  },
  {
    "id": "s2_agent_008",
    "familyId": "alarm_clock",
    "type": "agent",
    "difficulty": "easy",
    "label": "นาฬิกาปลุกที่ดังทุกวันเวลา 07:00 ตามที่ตั้งไว้",
    "answer": "Not Agent",
    "hint": "มีการตัดสินใจตาม environment หรือเป็น timer?",
    "why": "ทำงานตามเวลาที่ตั้งไว้ ไม่มี goal-directed reasoning",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_009",
    "familyId": "health_sleep",
    "type": "agent",
    "difficulty": "normal",
    "label": "แอปสุขภาพที่ดูข้อมูลการนอนและแนะนำเวลานอนให้เหมาะกับผู้ใช้",
    "answer": "Agent",
    "hint": "รับข้อมูลผู้ใช้และแนะนำ action เพื่อ goal สุขภาพ",
    "why": "เป็น software agent ได้ถ้าใช้ข้อมูลและ goal เพื่อเลือกคำแนะนำ",
    "misconception": "app_all_ai"
  },
  {
    "id": "s2_agent_010",
    "familyId": "motion_light",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบเปิดไฟเมื่อมีคนเดินผ่านด้วย motion sensor อย่างเดียว",
    "answer": "Maybe Agent",
    "hint": "มีแค่ sensor+rule หรือมี goal หลายเงื่อนไข?",
    "why": "ถ้าแค่เปิด/ปิดตาม sensor คือ simple reflex; ถ้าปรับตามพลังงาน/บริบทอาจเป็น agent",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_011",
    "familyId": "attendance_scan",
    "type": "agent",
    "difficulty": "easy",
    "label": "ระบบบันทึกเวลาเข้าเรียนด้วยการสแกนบัตร",
    "answer": "Not Agent",
    "hint": "บันทึกข้อมูลอย่างเดียวหรือเลือก action ตาม goal?",
    "why": "เป็นระบบบันทึกตาม input ไม่ใช่ intelligent agent",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_012",
    "familyId": "adaptive_tutor",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบติวเตอร์ที่ปรับโจทย์ตามข้อผิดพลาดของผู้เรียน",
    "answer": "Agent",
    "hint": "รับผลตอบและเลือกโจทย์ถัดไปตาม goal การเรียนรู้",
    "why": "มี percept เป็น performance ผู้เรียนและ action เป็นโจทย์/feedback",
    "misconception": "adaptive"
  },
  {
    "id": "s2_agent_013",
    "familyId": "fixed_slideshow",
    "type": "agent",
    "difficulty": "easy",
    "label": "สไลด์โชว์ที่เปลี่ยนหน้าอัตโนมัติทุก 10 วินาที",
    "answer": "Not Agent",
    "hint": "มี reasoning หรือแค่ timer?",
    "why": "เป็น automation ตามเวลา",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_014",
    "familyId": "stock_bot",
    "type": "agent",
    "difficulty": "hard",
    "label": "บอทเทรดหุ้นที่ประเมินความเสี่ยงก่อนส่งคำสั่งซื้อขาย",
    "answer": "Agent",
    "hint": "มี environment, goal และ action ที่มีผลต่อโลก",
    "why": "รับข้อมูลตลาดและเลือก action ภายใต้ performance measure",
    "misconception": "rationality"
  },
  {
    "id": "s2_agent_015",
    "familyId": "weather_app_static",
    "type": "agent",
    "difficulty": "normal",
    "label": "แอปพยากรณ์อากาศที่แสดงค่าจากฐานข้อมูลล่าสุดเท่านั้น",
    "answer": "Maybe Agent",
    "hint": "แสดงข้อมูลเฉย ๆ หรือแนะนำ action?",
    "why": "ถ้าแสดงข้อมูลเฉย ๆ อาจไม่ใช่ agent; ถ้าวางแผน/เตือน/แนะนำอาจเป็น agent",
    "misconception": "database"
  },
  {
    "id": "s2_agent_016",
    "familyId": "recommend_video",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบแนะนำวิดีโอที่ปรับตามประวัติการดูและเวลาที่ผู้ใช้สนใจ",
    "answer": "Agent",
    "hint": "recommendation คือ action ที่เลือกเพื่อ goal",
    "why": "รับ percept จากพฤติกรรมและเลือกวิดีโอเพื่อเพิ่มความเกี่ยวข้อง",
    "misconception": "recommendation"
  },
  {
    "id": "s2_agent_017",
    "familyId": "qr_menu",
    "type": "agent",
    "difficulty": "easy",
    "label": "เมนูอาหาร QR ที่แสดงรายการอาหารทั้งหมดเหมือนเดิมทุกครั้ง",
    "answer": "Not Agent",
    "hint": "แสดงข้อมูลคงที่หรือเลือก action?",
    "why": "เป็น information display ไม่ใช่ agent",
    "misconception": "database"
  },
  {
    "id": "s2_agent_018",
    "familyId": "smart_irrigation",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบรดน้ำต้นไม้อัจฉริยะที่ดูความชื้น ดิน อากาศ และเลือกปริมาณน้ำ",
    "answer": "Agent",
    "hint": "มี sensor และเลือก actuator ตาม goal",
    "why": "รับ percept หลายอย่างและเลือก action เพื่อให้ต้นไม้เหมาะสม",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_019",
    "familyId": "fire_alarm_simple",
    "type": "agent",
    "difficulty": "normal",
    "label": "เครื่องตรวจควันแล้วส่งเสียงเตือนทันทีเมื่อเกิน threshold",
    "answer": "Maybe Agent",
    "hint": "เป็น simple reflex หรือมี reasoning เพิ่ม?",
    "why": "ถ้า threshold ตายตัวคือ reflex; ถ้าประเมินหลายสัญญาณและเลือก response อาจเป็น agent",
    "misconception": "threshold"
  },
  {
    "id": "s2_agent_020",
    "familyId": "essay_feedback",
    "type": "agent",
    "difficulty": "hard",
    "label": "ระบบตรวจเรียงความที่ให้ feedback ตามจุดอ่อนของงานเขียน",
    "answer": "Agent",
    "hint": "รับข้อความและเลือก feedback เพื่อ goal การพัฒนา",
    "why": "มี percept เป็นงานเขียนและ action เป็น feedback/recommendation",
    "misconception": "nlp_agent"
  },
  {
    "id": "s2_agent_021",
    "familyId": "random_quote",
    "type": "agent",
    "difficulty": "easy",
    "label": "เว็บสุ่มคำคมโดยใช้ random number",
    "answer": "Not Agent",
    "hint": "random ไม่ใช่ learning หรือ rational action",
    "why": "การสุ่มอย่างเดียวไม่ทำให้เป็น intelligent agent",
    "misconception": "random"
  },
  {
    "id": "s2_agent_022",
    "familyId": "face_unlock",
    "type": "agent",
    "difficulty": "normal",
    "label": "ระบบปลดล็อกใบหน้าที่ประเมินภาพก่อนอนุญาตเข้าใช้งาน",
    "answer": "Agent",
    "hint": "classification + action ภายใต้ security goal",
    "why": "รับภาพเป็น percept และเลือกอนุญาต/ปฏิเสธตาม performance measure",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_023",
    "familyId": "static_rules_chatbot",
    "type": "agent",
    "difficulty": "normal",
    "label": "แชตบอต FAQ ที่ตอบตาม keyword ตายตัวทุกครั้ง",
    "answer": "Maybe Agent",
    "hint": "rule-based มากหรือมี understanding/goal-directed choice?",
    "why": "อาจเป็น simple reflex agent แต่ไม่จำเป็นต้องเป็น learning AI",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_024",
    "familyId": "hospital_triage",
    "type": "agent",
    "difficulty": "hard",
    "label": "ระบบคัดกรองผู้ป่วยที่ประเมินอาการและจัดลำดับความเร่งด่วน",
    "answer": "Agent",
    "hint": "มี goal ด้านความปลอดภัยและเลือก priority/action",
    "why": "รับข้อมูลอาการและเลือก triage action",
    "misconception": "highstakes"
  },
  {
    "id": "s2_agent_025",
    "familyId": "excel_formula",
    "type": "agent",
    "difficulty": "easy",
    "label": "ไฟล์ Excel ที่คำนวณเกรดจากสูตร IF ที่กำหนดไว้",
    "answer": "Not Agent",
    "hint": "สูตรตายตัวหรือมี agent decision?",
    "why": "เป็น rule/formula ตามเงื่อนไข ไม่ใช่ intelligent agent",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_026",
    "familyId": "adaptive_game_enemy",
    "type": "agent",
    "difficulty": "normal",
    "label": "ศัตรูในเกมที่ปรับกลยุทธ์ตามพฤติกรรมผู้เล่น",
    "answer": "Agent",
    "hint": "รับ percept จากผู้เล่นและเลือก action เพื่อ challenge",
    "why": "มี goal และ action selection",
    "misconception": "game_agent"
  },
  {
    "id": "s2_agent_027",
    "familyId": "auto_door",
    "type": "agent",
    "difficulty": "easy",
    "label": "ประตูอัตโนมัติที่เปิดเมื่อ sensor ตรวจพบคน",
    "answer": "Maybe Agent",
    "hint": "sensor+rule อย่างเดียวอาจเป็น reflex",
    "why": "ถ้าทำแค่เปิด/ปิดตาม sensor คือ simple reflex/automation",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_028",
    "familyId": "drone_delivery",
    "type": "agent",
    "difficulty": "hard",
    "label": "โดรนส่งของที่ปรับเส้นทางตามลม แบตเตอรี่ และพื้นที่ห้ามบิน",
    "answer": "Agent",
    "hint": "planning + action ภายใต้ constraints",
    "why": "รับ percept หลายชนิดและเลือก route/action",
    "misconception": "planning"
  },
  {
    "id": "s2_agent_029",
    "familyId": "static_news_feed",
    "type": "agent",
    "difficulty": "easy",
    "label": "เว็บข่าวที่เรียงข่าวตามเวลาล่าสุดโดยไม่มี personalization",
    "answer": "Not Agent",
    "hint": "sorting rule ไม่ใช่ intelligent action selection",
    "why": "เป็น rule-based ordering",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_030",
    "familyId": "fraud_detection",
    "type": "agent",
    "difficulty": "hard",
    "label": "ระบบตรวจจับธุรกรรมผิดปกติและระงับรายการที่เสี่ยง",
    "answer": "Agent",
    "hint": "รับ transaction เป็น percept และเลือก action",
    "why": "มี classification/decision ภายใต้ goal ลด fraud",
    "misconception": "classification"
  },
  {
    "id": "s2_agent_031",
    "familyId": "traffic_route_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "แพลตฟอร์มแนะนำเส้นทางที่ปรับตามสภาพจราจรแบบ real-time",
    "answer": "Agent",
    "hint": "รับ percept จาก traffic แล้วเลือก action เป็นเส้นทางเพื่อบรรลุ goal",
    "why": "มีข้อมูลจราจร/ตำแหน่งและเลือก route ตามเป้าหมายเวลา/ความปลอดภัย",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_032",
    "familyId": "calculator_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: เครื่องคิดเลขที่คำนวณตามสูตรที่ผู้ใช้กด",
    "answer": "Not Agent",
    "hint": "มี goal-directed decision หรือแค่คำนวณตามคำสั่ง?",
    "why": "เป็นโปรแกรมคำนวณตามคำสั่ง ไม่ได้เลือก action จาก environment",
    "misconception": "calculator"
  },
  {
    "id": "s2_agent_033",
    "familyId": "robot_vacuum_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: หุ่นยนต์ดูดฝุ่นที่ตรวจจับสิ่งกีดขวางและเปลี่ยนเส้นทาง",
    "answer": "Agent",
    "hint": "มี sensor, percept และ action ต่อ environment",
    "why": "รับรู้สิ่งกีดขวางและเลือกการเคลื่อนที่เพื่อทำความสะอาด",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_034",
    "familyId": "latest_sort_shop_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: เว็บร้านค้าที่เรียงสินค้าตามวันที่เพิ่มล่าสุดเสมอ",
    "answer": "Not Agent",
    "hint": "เรียงตาม rule ตายตัวหรือปรับตามเป้าหมาย/ผู้ใช้?",
    "why": "เป็น rule-based sorting ตายตัว ไม่ได้มี rational action selection",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_035",
    "familyId": "flood_warning_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มแจ้งเตือนน้ำท่วมที่วิเคราะห์ระดับน้ำและแนะนำเส้นทางปลอดภัย",
    "answer": "Agent",
    "hint": "มี goal ด้านความปลอดภัยและเลือก recommendation",
    "why": "รับข้อมูลน้ำ/พื้นที่แล้วแนะนำ action เพื่อหลีกเลี่ยงความเสี่ยง",
    "misconception": "database"
  },
  {
    "id": "s2_agent_036",
    "familyId": "vending_machine_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: เครื่องขายน้ำอัตโนมัติที่ปล่อยน้ำเมื่อหยอดเหรียญครบ",
    "answer": "Not Agent",
    "hint": "ตอบตามเงื่อนไขตายตัวหรือมี rational decision?",
    "why": "เป็น automation/rule-based มากกว่า intelligent agent",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_037",
    "familyId": "spam_filter_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มคัดกรองอีเมลสแปมที่เรียนรู้จากตัวอย่างอีเมล",
    "answer": "Agent",
    "hint": "มี percept เป็นอีเมลและ action เป็นการ classify",
    "why": "รับข้อความอีเมลแล้วเลือก label เพื่อบรรลุ goal ลด spam",
    "misconception": "software_agent"
  },
  {
    "id": "s2_agent_038",
    "familyId": "alarm_clock_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: นาฬิกาปลุกที่ดังทุกวันเวลา 07:00 ตามที่ตั้งไว้",
    "answer": "Not Agent",
    "hint": "มีการตัดสินใจตาม environment หรือเป็น timer?",
    "why": "ทำงานตามเวลาที่ตั้งไว้ ไม่มี goal-directed reasoning",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_039",
    "familyId": "health_sleep_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "กรณีศึกษา: แอปสุขภาพที่ดูข้อมูลการนอนและแนะนำเวลานอนให้เหมาะกับผู้ใช้",
    "answer": "Agent",
    "hint": "รับข้อมูลผู้ใช้และแนะนำ action เพื่อ goal สุขภาพ",
    "why": "เป็น software agent ได้ถ้าใช้ข้อมูลและ goal เพื่อเลือกคำแนะนำ",
    "misconception": "app_all_ai"
  },
  {
    "id": "s2_agent_040",
    "familyId": "motion_light_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มเปิดไฟเมื่อมีคนเดินผ่านด้วย motion sensor อย่างเดียว",
    "answer": "Maybe Agent",
    "hint": "มีแค่ sensor+rule หรือมี goal หลายเงื่อนไข?",
    "why": "ถ้าแค่เปิด/ปิดตาม sensor คือ simple reflex; ถ้าปรับตามพลังงาน/บริบทอาจเป็น agent",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_041",
    "familyId": "attendance_scan_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "แพลตฟอร์มบันทึกเวลาเข้าเรียนด้วยการสแกนบัตร",
    "answer": "Not Agent",
    "hint": "บันทึกข้อมูลอย่างเดียวหรือเลือก action ตาม goal?",
    "why": "เป็นระบบบันทึกตาม input ไม่ใช่ intelligent agent",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_042",
    "familyId": "adaptive_tutor_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มติวเตอร์ที่ปรับโจทย์ตามข้อผิดพลาดของผู้เรียน",
    "answer": "Agent",
    "hint": "รับผลตอบและเลือกโจทย์ถัดไปตาม goal การเรียนรู้",
    "why": "มี percept เป็น performance ผู้เรียนและ action เป็นโจทย์/feedback",
    "misconception": "adaptive"
  },
  {
    "id": "s2_agent_043",
    "familyId": "fixed_slideshow_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: สไลด์โชว์ที่เปลี่ยนหน้าอัตโนมัติทุก 10 วินาที",
    "answer": "Not Agent",
    "hint": "มี reasoning หรือแค่ timer?",
    "why": "เป็น automation ตามเวลา",
    "misconception": "automation"
  },
  {
    "id": "s2_agent_044",
    "familyId": "stock_bot_v",
    "type": "agent",
    "difficulty": "hard",
    "label": "กรณีศึกษา: บอทเทรดหุ้นที่ประเมินความเสี่ยงก่อนส่งคำสั่งซื้อขาย",
    "answer": "Agent",
    "hint": "มี environment, goal และ action ที่มีผลต่อโลก",
    "why": "รับข้อมูลตลาดและเลือก action ภายใต้ performance measure",
    "misconception": "rationality"
  },
  {
    "id": "s2_agent_045",
    "familyId": "weather_app_static_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "กรณีศึกษา: แอปพยากรณ์อากาศที่แสดงค่าจากฐานข้อมูลล่าสุดเท่านั้น",
    "answer": "Maybe Agent",
    "hint": "แสดงข้อมูลเฉย ๆ หรือแนะนำ action?",
    "why": "ถ้าแสดงข้อมูลเฉย ๆ อาจไม่ใช่ agent; ถ้าวางแผน/เตือน/แนะนำอาจเป็น agent",
    "misconception": "database"
  },
  {
    "id": "s2_agent_046",
    "familyId": "recommend_video_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มแนะนำวิดีโอที่ปรับตามประวัติการดูและเวลาที่ผู้ใช้สนใจ",
    "answer": "Agent",
    "hint": "recommendation คือ action ที่เลือกเพื่อ goal",
    "why": "รับ percept จากพฤติกรรมและเลือกวิดีโอเพื่อเพิ่มความเกี่ยวข้อง",
    "misconception": "recommendation"
  },
  {
    "id": "s2_agent_047",
    "familyId": "qr_menu_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: เมนูอาหาร QR ที่แสดงรายการอาหารทั้งหมดเหมือนเดิมทุกครั้ง",
    "answer": "Not Agent",
    "hint": "แสดงข้อมูลคงที่หรือเลือก action?",
    "why": "เป็น information display ไม่ใช่ agent",
    "misconception": "database"
  },
  {
    "id": "s2_agent_048",
    "familyId": "smart_irrigation_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มรดน้ำต้นไม้อัจฉริยะที่ดูความชื้น ดิน อากาศ และเลือกปริมาณน้ำ",
    "answer": "Agent",
    "hint": "มี sensor และเลือก actuator ตาม goal",
    "why": "รับ percept หลายอย่างและเลือก action เพื่อให้ต้นไม้เหมาะสม",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_049",
    "familyId": "fire_alarm_simple_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "กรณีศึกษา: เครื่องตรวจควันแล้วส่งเสียงเตือนทันทีเมื่อเกิน threshold",
    "answer": "Maybe Agent",
    "hint": "เป็น simple reflex หรือมี reasoning เพิ่ม?",
    "why": "ถ้า threshold ตายตัวคือ reflex; ถ้าประเมินหลายสัญญาณและเลือก response อาจเป็น agent",
    "misconception": "threshold"
  },
  {
    "id": "s2_agent_050",
    "familyId": "essay_feedback_v",
    "type": "agent",
    "difficulty": "hard",
    "label": "แพลตฟอร์มตรวจเรียงความที่ให้ feedback ตามจุดอ่อนของงานเขียน",
    "answer": "Agent",
    "hint": "รับข้อความและเลือก feedback เพื่อ goal การพัฒนา",
    "why": "มี percept เป็นงานเขียนและ action เป็น feedback/recommendation",
    "misconception": "nlp_agent"
  },
  {
    "id": "s2_agent_051",
    "familyId": "random_quote_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: เว็บสุ่มคำคมโดยใช้ random number",
    "answer": "Not Agent",
    "hint": "random ไม่ใช่ learning หรือ rational action",
    "why": "การสุ่มอย่างเดียวไม่ทำให้เป็น intelligent agent",
    "misconception": "random"
  },
  {
    "id": "s2_agent_052",
    "familyId": "face_unlock_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "แพลตฟอร์มปลดล็อกใบหน้าที่ประเมินภาพก่อนอนุญาตเข้าใช้งาน",
    "answer": "Agent",
    "hint": "classification + action ภายใต้ security goal",
    "why": "รับภาพเป็น percept และเลือกอนุญาต/ปฏิเสธตาม performance measure",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_053",
    "familyId": "static_rules_chatbot_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "กรณีศึกษา: แชตบอต FAQ ที่ตอบตาม keyword ตายตัวทุกครั้ง",
    "answer": "Maybe Agent",
    "hint": "rule-based มากหรือมี understanding/goal-directed choice?",
    "why": "อาจเป็น simple reflex agent แต่ไม่จำเป็นต้องเป็น learning AI",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_054",
    "familyId": "hospital_triage_v",
    "type": "agent",
    "difficulty": "hard",
    "label": "แพลตฟอร์มคัดกรองผู้ป่วยที่ประเมินอาการและจัดลำดับความเร่งด่วน",
    "answer": "Agent",
    "hint": "มี goal ด้านความปลอดภัยและเลือก priority/action",
    "why": "รับข้อมูลอาการและเลือก triage action",
    "misconception": "highstakes"
  },
  {
    "id": "s2_agent_055",
    "familyId": "excel_formula_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: ไฟล์ Excel ที่คำนวณเกรดจากสูตร IF ที่กำหนดไว้",
    "answer": "Not Agent",
    "hint": "สูตรตายตัวหรือมี agent decision?",
    "why": "เป็น rule/formula ตามเงื่อนไข ไม่ใช่ intelligent agent",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_056",
    "familyId": "adaptive_game_enemy_v",
    "type": "agent",
    "difficulty": "normal",
    "label": "กรณีศึกษา: ศัตรูในเกมที่ปรับกลยุทธ์ตามพฤติกรรมผู้เล่น",
    "answer": "Agent",
    "hint": "รับ percept จากผู้เล่นและเลือก action เพื่อ challenge",
    "why": "มี goal และ action selection",
    "misconception": "game_agent"
  },
  {
    "id": "s2_agent_057",
    "familyId": "auto_door_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: ประตูอัตโนมัติที่เปิดเมื่อ sensor ตรวจพบคน",
    "answer": "Maybe Agent",
    "hint": "sensor+rule อย่างเดียวอาจเป็น reflex",
    "why": "ถ้าทำแค่เปิด/ปิดตาม sensor คือ simple reflex/automation",
    "misconception": "sensor"
  },
  {
    "id": "s2_agent_058",
    "familyId": "drone_delivery_v",
    "type": "agent",
    "difficulty": "hard",
    "label": "กรณีศึกษา: โดรนส่งของที่ปรับเส้นทางตามลม แบตเตอรี่ และพื้นที่ห้ามบิน",
    "answer": "Agent",
    "hint": "planning + action ภายใต้ constraints",
    "why": "รับ percept หลายชนิดและเลือก route/action",
    "misconception": "planning"
  },
  {
    "id": "s2_agent_059",
    "familyId": "static_news_feed_v",
    "type": "agent",
    "difficulty": "easy",
    "label": "กรณีศึกษา: เว็บข่าวที่เรียงข่าวตามเวลาล่าสุดโดยไม่มี personalization",
    "answer": "Not Agent",
    "hint": "sorting rule ไม่ใช่ intelligent action selection",
    "why": "เป็น rule-based ordering",
    "misconception": "rulebased"
  },
  {
    "id": "s2_agent_060",
    "familyId": "fraud_detection_v",
    "type": "agent",
    "difficulty": "hard",
    "label": "แพลตฟอร์มตรวจจับธุรกรรมผิดปกติและระงับรายการที่เสี่ยง",
    "answer": "Agent",
    "hint": "รับ transaction เป็น percept และเลือก action",
    "why": "มี classification/decision ภายใต้ goal ลด fraud",
    "misconception": "classification"
  }
];

  const PEAS_ITEMS = [
  {
    "id": "s2_peas_001",
    "familyId": "autonomous_car",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "รถยนต์ไร้คนขับในเมือง",
    "choices": [
      {
        "text": "P=ปลอดภัย ถึงจุดหมายเร็ว ใช้พลังงานเหมาะสม ไม่ละเมิดกฎจราจร, E=ถนน รถคันอื่น คนเดินเท้า สัญญาณไฟ สภาพอากาศ, A=พวงมาลัย เบรก คันเร่ง ไฟเลี้ยว, S=กล้อง LiDAR GPS radar speed sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=กล้อง LiDAR GPS radar speed sensor, E=พวงมาลัย เบรก คันเร่ง ไฟเลี้ยว, A=ถนน รถคันอื่น คนเดินเท้า สัญญาณไฟ สภาพอากาศ, S=ปลอดภัย ถึงจุดหมายเร็ว ใช้พลังงานเหมาะสม ไม่ละเมิดกฎจราจร",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_002",
    "familyId": "autonomous_car",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "รถยนต์ไร้คนขับในเมือง (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ปลอดภัย ถึงจุดหมายเร็ว ใช้พลังงานเหมาะสม ไม่ละเมิดกฎจราจร, E=ถนน รถคันอื่น คนเดินเท้า สัญญาณไฟ สภาพอากาศ, A=พวงมาลัย เบรก คันเร่ง ไฟเลี้ยว, S=กล้อง LiDAR GPS radar speed sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=พวงมาลัย เบรก คันเร่ง ไฟเลี้ยว, E=กล้อง LiDAR GPS radar speed sensor, A=ปลอดภัย ถึงจุดหมายเร็ว ใช้พลังงานเหมาะสม ไม่ละเมิดกฎจราจร, S=ถนน รถคันอื่น คนเดินเท้า สัญญาณไฟ สภาพอากาศ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_003",
    "familyId": "registration_chatbot",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "แชตบอตให้คำปรึกษาการลงทะเบียนเรียน",
    "choices": [
      {
        "text": "P=ตอบถูก เข้าใจคำถาม แนะนำรายวิชาถูกเงื่อนไข ลดเวลารอ, E=นักศึกษา หลักสูตร เงื่อนไขรายวิชา ปฏิทินการศึกษา, A=ข้อความตอบกลับ ลิงก์/คำแนะนำ รายการวิชาที่เสนอ, S=ข้อความผู้ใช้ โปรไฟล์นักศึกษา ประวัติผลการเรียน",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อความผู้ใช้ โปรไฟล์นักศึกษา ประวัติผลการเรียน, E=ข้อความตอบกลับ ลิงก์/คำแนะนำ รายการวิชาที่เสนอ, A=นักศึกษา หลักสูตร เงื่อนไขรายวิชา ปฏิทินการศึกษา, S=ตอบถูก เข้าใจคำถาม แนะนำรายวิชาถูกเงื่อนไข ลดเวลารอ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_004",
    "familyId": "registration_chatbot",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "แชตบอตให้คำปรึกษาการลงทะเบียนเรียน (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ตอบถูก เข้าใจคำถาม แนะนำรายวิชาถูกเงื่อนไข ลดเวลารอ, E=นักศึกษา หลักสูตร เงื่อนไขรายวิชา ปฏิทินการศึกษา, A=ข้อความตอบกลับ ลิงก์/คำแนะนำ รายการวิชาที่เสนอ, S=ข้อความผู้ใช้ โปรไฟล์นักศึกษา ประวัติผลการเรียน",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อความตอบกลับ ลิงก์/คำแนะนำ รายการวิชาที่เสนอ, E=ข้อความผู้ใช้ โปรไฟล์นักศึกษา ประวัติผลการเรียน, A=ตอบถูก เข้าใจคำถาม แนะนำรายวิชาถูกเงื่อนไข ลดเวลารอ, S=นักศึกษา หลักสูตร เงื่อนไขรายวิชา ปฏิทินการศึกษา",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_005",
    "familyId": "robot_vacuum",
    "type": "peas",
    "difficulty": "easy",
    "scenario": "หุ่นยนต์ดูดฝุ่นในบ้าน",
    "choices": [
      {
        "text": "P=ทำความสะอาดครอบคลุม ชนสิ่งของน้อย ใช้เวลา/พลังงานเหมาะสม, E=พื้นห้อง เฟอร์นิเจอร์ ฝุ่น คน/สัตว์เลี้ยง สิ่งกีดขวาง, A=ล้อ มอเตอร์ดูดฝุ่น แปรง, S=sensor ระยะ กล้อง bumper dust sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=sensor ระยะ กล้อง bumper dust sensor, E=ล้อ มอเตอร์ดูดฝุ่น แปรง, A=พื้นห้อง เฟอร์นิเจอร์ ฝุ่น คน/สัตว์เลี้ยง สิ่งกีดขวาง, S=ทำความสะอาดครอบคลุม ชนสิ่งของน้อย ใช้เวลา/พลังงานเหมาะสม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_006",
    "familyId": "robot_vacuum",
    "type": "peas",
    "difficulty": "easy",
    "scenario": "หุ่นยนต์ดูดฝุ่นในบ้าน (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ทำความสะอาดครอบคลุม ชนสิ่งของน้อย ใช้เวลา/พลังงานเหมาะสม, E=พื้นห้อง เฟอร์นิเจอร์ ฝุ่น คน/สัตว์เลี้ยง สิ่งกีดขวาง, A=ล้อ มอเตอร์ดูดฝุ่น แปรง, S=sensor ระยะ กล้อง bumper dust sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ล้อ มอเตอร์ดูดฝุ่น แปรง, E=sensor ระยะ กล้อง bumper dust sensor, A=ทำความสะอาดครอบคลุม ชนสิ่งของน้อย ใช้เวลา/พลังงานเหมาะสม, S=พื้นห้อง เฟอร์นิเจอร์ ฝุ่น คน/สัตว์เลี้ยง สิ่งกีดขวาง",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_007",
    "familyId": "health_food",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำอาหารสุขภาพสำหรับนักเรียน",
    "choices": [
      {
        "text": "P=แนะนำเหมาะสม ปลอดภัย เข้าใจง่าย ส่งเสริมสุขภาพ, E=นักเรียน ภาวะสุขภาพ เมนูอาหาร ข้อจำกัดการแพ้อาหาร, A=คำแนะนำ รายการอาหาร แจ้งเตือน, S=ข้อมูลสุขภาพ พฤติกรรม แบบสอบถาม ประวัติอาหาร",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อมูลสุขภาพ พฤติกรรม แบบสอบถาม ประวัติอาหาร, E=คำแนะนำ รายการอาหาร แจ้งเตือน, A=นักเรียน ภาวะสุขภาพ เมนูอาหาร ข้อจำกัดการแพ้อาหาร, S=แนะนำเหมาะสม ปลอดภัย เข้าใจง่าย ส่งเสริมสุขภาพ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_008",
    "familyId": "health_food",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำอาหารสุขภาพสำหรับนักเรียน (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำเหมาะสม ปลอดภัย เข้าใจง่าย ส่งเสริมสุขภาพ, E=นักเรียน ภาวะสุขภาพ เมนูอาหาร ข้อจำกัดการแพ้อาหาร, A=คำแนะนำ รายการอาหาร แจ้งเตือน, S=ข้อมูลสุขภาพ พฤติกรรม แบบสอบถาม ประวัติอาหาร",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=คำแนะนำ รายการอาหาร แจ้งเตือน, E=ข้อมูลสุขภาพ พฤติกรรม แบบสอบถาม ประวัติอาหาร, A=แนะนำเหมาะสม ปลอดภัย เข้าใจง่าย ส่งเสริมสุขภาพ, S=นักเรียน ภาวะสุขภาพ เมนูอาหาร ข้อจำกัดการแพ้อาหาร",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_009",
    "familyId": "spam_filter",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบกรองอีเมลสแปม",
    "choices": [
      {
        "text": "P=ลด spam ไม่พลาดอีเมลสำคัญ อธิบายเหตุผลได้, E=กล่องอีเมล ผู้ส่ง เนื้อหา ลิงก์ แนบไฟล์, A=ติดป้าย spam ย้ายโฟลเดอร์ แจ้งเตือน, S=หัวข้อ เนื้อหา metadata ประวัติผู้ส่ง",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=หัวข้อ เนื้อหา metadata ประวัติผู้ส่ง, E=ติดป้าย spam ย้ายโฟลเดอร์ แจ้งเตือน, A=กล่องอีเมล ผู้ส่ง เนื้อหา ลิงก์ แนบไฟล์, S=ลด spam ไม่พลาดอีเมลสำคัญ อธิบายเหตุผลได้",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_010",
    "familyId": "spam_filter",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบกรองอีเมลสแปม (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ลด spam ไม่พลาดอีเมลสำคัญ อธิบายเหตุผลได้, E=กล่องอีเมล ผู้ส่ง เนื้อหา ลิงก์ แนบไฟล์, A=ติดป้าย spam ย้ายโฟลเดอร์ แจ้งเตือน, S=หัวข้อ เนื้อหา metadata ประวัติผู้ส่ง",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ติดป้าย spam ย้ายโฟลเดอร์ แจ้งเตือน, E=หัวข้อ เนื้อหา metadata ประวัติผู้ส่ง, A=ลด spam ไม่พลาดอีเมลสำคัญ อธิบายเหตุผลได้, S=กล่องอีเมล ผู้ส่ง เนื้อหา ลิงก์ แนบไฟล์",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_011",
    "familyId": "drone_delivery",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "โดรนส่งของในมหาวิทยาลัย",
    "choices": [
      {
        "text": "P=ส่งถูกที่ ปลอดภัย ใช้แบตคุ้ม หลีกเลี่ยงพื้นที่ห้ามบิน, E=อาคาร คนเดิน ลม สิ่งกีดขวาง พื้นที่ห้ามบิน, A=ใบพัด กลไกปล่อยของ ไฟสัญญาณ, S=GPS กล้อง IMU battery sensor wind sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=GPS กล้อง IMU battery sensor wind sensor, E=ใบพัด กลไกปล่อยของ ไฟสัญญาณ, A=อาคาร คนเดิน ลม สิ่งกีดขวาง พื้นที่ห้ามบิน, S=ส่งถูกที่ ปลอดภัย ใช้แบตคุ้ม หลีกเลี่ยงพื้นที่ห้ามบิน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_012",
    "familyId": "drone_delivery",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "โดรนส่งของในมหาวิทยาลัย (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ส่งถูกที่ ปลอดภัย ใช้แบตคุ้ม หลีกเลี่ยงพื้นที่ห้ามบิน, E=อาคาร คนเดิน ลม สิ่งกีดขวาง พื้นที่ห้ามบิน, A=ใบพัด กลไกปล่อยของ ไฟสัญญาณ, S=GPS กล้อง IMU battery sensor wind sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ใบพัด กลไกปล่อยของ ไฟสัญญาณ, E=GPS กล้อง IMU battery sensor wind sensor, A=ส่งถูกที่ ปลอดภัย ใช้แบตคุ้ม หลีกเลี่ยงพื้นที่ห้ามบิน, S=อาคาร คนเดิน ลม สิ่งกีดขวาง พื้นที่ห้ามบิน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_013",
    "familyId": "adaptive_tutor",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบติวเตอร์ปรับโจทย์ตามผู้เรียน",
    "choices": [
      {
        "text": "P=เพิ่มความเข้าใจ ลดข้อผิดพลาด ให้โจทย์เหมาะระดับ, E=ผู้เรียน บทเรียน ประวัติคำตอบ เวลาเรียน, A=โจทย์ถัดไป feedback คำใบ้ คะแนน, S=คำตอบ เวลาใช้ คะแนน pattern ข้อผิดพลาด",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=คำตอบ เวลาใช้ คะแนน pattern ข้อผิดพลาด, E=โจทย์ถัดไป feedback คำใบ้ คะแนน, A=ผู้เรียน บทเรียน ประวัติคำตอบ เวลาเรียน, S=เพิ่มความเข้าใจ ลดข้อผิดพลาด ให้โจทย์เหมาะระดับ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_014",
    "familyId": "adaptive_tutor",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบติวเตอร์ปรับโจทย์ตามผู้เรียน (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=เพิ่มความเข้าใจ ลดข้อผิดพลาด ให้โจทย์เหมาะระดับ, E=ผู้เรียน บทเรียน ประวัติคำตอบ เวลาเรียน, A=โจทย์ถัดไป feedback คำใบ้ คะแนน, S=คำตอบ เวลาใช้ คะแนน pattern ข้อผิดพลาด",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=โจทย์ถัดไป feedback คำใบ้ คะแนน, E=คำตอบ เวลาใช้ คะแนน pattern ข้อผิดพลาด, A=เพิ่มความเข้าใจ ลดข้อผิดพลาด ให้โจทย์เหมาะระดับ, S=ผู้เรียน บทเรียน ประวัติคำตอบ เวลาเรียน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_015",
    "familyId": "fraud_detection",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบตรวจจับธุรกรรมการเงินผิดปกติ",
    "choices": [
      {
        "text": "P=ลด fraud ลด false alarm รักษาความปลอดภัย, E=บัญชี ผู้ใช้ ร้านค้า ธุรกรรม เวลา สถานที่, A=อนุมัติ ระงับ แจ้งเตือน ขอ verification, S=จำนวนเงิน เวลา location device ประวัติธุรกรรม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=จำนวนเงิน เวลา location device ประวัติธุรกรรม, E=อนุมัติ ระงับ แจ้งเตือน ขอ verification, A=บัญชี ผู้ใช้ ร้านค้า ธุรกรรม เวลา สถานที่, S=ลด fraud ลด false alarm รักษาความปลอดภัย",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_016",
    "familyId": "fraud_detection",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบตรวจจับธุรกรรมการเงินผิดปกติ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ลด fraud ลด false alarm รักษาความปลอดภัย, E=บัญชี ผู้ใช้ ร้านค้า ธุรกรรม เวลา สถานที่, A=อนุมัติ ระงับ แจ้งเตือน ขอ verification, S=จำนวนเงิน เวลา location device ประวัติธุรกรรม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=อนุมัติ ระงับ แจ้งเตือน ขอ verification, E=จำนวนเงิน เวลา location device ประวัติธุรกรรม, A=ลด fraud ลด false alarm รักษาความปลอดภัย, S=บัญชี ผู้ใช้ ร้านค้า ธุรกรรม เวลา สถานที่",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_017",
    "familyId": "traffic_light",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบควบคุมไฟจราจรอัจฉริยะ",
    "choices": [
      {
        "text": "P=ลดรถติด ลดอุบัติเหตุ ให้รถฉุกเฉินผ่านเร็ว, E=ทางแยก รถ คนข้ามถนน รถฉุกเฉิน เวลาเร่งด่วน, A=ไฟแดงไฟเขียว สัญญาณเตือน ป้ายแนะนำ, S=กล้อง loop detector GPS รถฉุกเฉิน sensor คนข้าม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=กล้อง loop detector GPS รถฉุกเฉิน sensor คนข้าม, E=ไฟแดงไฟเขียว สัญญาณเตือน ป้ายแนะนำ, A=ทางแยก รถ คนข้ามถนน รถฉุกเฉิน เวลาเร่งด่วน, S=ลดรถติด ลดอุบัติเหตุ ให้รถฉุกเฉินผ่านเร็ว",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_018",
    "familyId": "traffic_light",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบควบคุมไฟจราจรอัจฉริยะ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ลดรถติด ลดอุบัติเหตุ ให้รถฉุกเฉินผ่านเร็ว, E=ทางแยก รถ คนข้ามถนน รถฉุกเฉิน เวลาเร่งด่วน, A=ไฟแดงไฟเขียว สัญญาณเตือน ป้ายแนะนำ, S=กล้อง loop detector GPS รถฉุกเฉิน sensor คนข้าม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ไฟแดงไฟเขียว สัญญาณเตือน ป้ายแนะนำ, E=กล้อง loop detector GPS รถฉุกเฉิน sensor คนข้าม, A=ลดรถติด ลดอุบัติเหตุ ให้รถฉุกเฉินผ่านเร็ว, S=ทางแยก รถ คนข้ามถนน รถฉุกเฉิน เวลาเร่งด่วน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_019",
    "familyId": "recommend_video",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำวิดีโอออนไลน์",
    "choices": [
      {
        "text": "P=แนะนำตรงใจ เพิ่มการเรียนรู้/ความพึงพอใจ ลดเนื้อหาไม่เหมาะสม, E=ผู้ใช้ วิดีโอ ประวัติการดู เวลา อุปกรณ์, A=รายการแนะนำ การจัดอันดับ แจ้งเตือน, S=คลิก watch time like dislike search history",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=คลิก watch time like dislike search history, E=รายการแนะนำ การจัดอันดับ แจ้งเตือน, A=ผู้ใช้ วิดีโอ ประวัติการดู เวลา อุปกรณ์, S=แนะนำตรงใจ เพิ่มการเรียนรู้/ความพึงพอใจ ลดเนื้อหาไม่เหมาะสม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_020",
    "familyId": "recommend_video",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำวิดีโอออนไลน์ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำตรงใจ เพิ่มการเรียนรู้/ความพึงพอใจ ลดเนื้อหาไม่เหมาะสม, E=ผู้ใช้ วิดีโอ ประวัติการดู เวลา อุปกรณ์, A=รายการแนะนำ การจัดอันดับ แจ้งเตือน, S=คลิก watch time like dislike search history",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=รายการแนะนำ การจัดอันดับ แจ้งเตือน, E=คลิก watch time like dislike search history, A=แนะนำตรงใจ เพิ่มการเรียนรู้/ความพึงพอใจ ลดเนื้อหาไม่เหมาะสม, S=ผู้ใช้ วิดีโอ ประวัติการดู เวลา อุปกรณ์",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_021",
    "familyId": "essay_feedback",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบ feedback เรียงความภาษาอังกฤษ",
    "choices": [
      {
        "text": "P=ชี้จุดอ่อนถูกต้อง ช่วยพัฒนาการเขียน ลด feedback ผิด, E=นักศึกษา เรียงความ rubric หัวข้อ assignment, A=feedback คะแนนย่อย คำแนะนำปรับปรุง, S=ข้อความ essay rubric metadata ประวัติการแก้",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อความ essay rubric metadata ประวัติการแก้, E=feedback คะแนนย่อย คำแนะนำปรับปรุง, A=นักศึกษา เรียงความ rubric หัวข้อ assignment, S=ชี้จุดอ่อนถูกต้อง ช่วยพัฒนาการเขียน ลด feedback ผิด",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_022",
    "familyId": "essay_feedback",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบ feedback เรียงความภาษาอังกฤษ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ชี้จุดอ่อนถูกต้อง ช่วยพัฒนาการเขียน ลด feedback ผิด, E=นักศึกษา เรียงความ rubric หัวข้อ assignment, A=feedback คะแนนย่อย คำแนะนำปรับปรุง, S=ข้อความ essay rubric metadata ประวัติการแก้",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=feedback คะแนนย่อย คำแนะนำปรับปรุง, E=ข้อความ essay rubric metadata ประวัติการแก้, A=ชี้จุดอ่อนถูกต้อง ช่วยพัฒนาการเขียน ลด feedback ผิด, S=นักศึกษา เรียงความ rubric หัวข้อ assignment",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_023",
    "familyId": "smart_irrigation",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบรดน้ำต้นไม้อัจฉริยะ",
    "choices": [
      {
        "text": "P=ต้นไม้แข็งแรง ประหยัดน้ำ ป้องกันดินแฉะ, E=ดิน อากาศ แสง พืช ฤดูกาล แหล่งน้ำ, A=วาล์วน้ำ ปั๊มน้ำ ตารางรดน้ำ แจ้งเตือน, S=soil moisture temperature humidity light sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=soil moisture temperature humidity light sensor, E=วาล์วน้ำ ปั๊มน้ำ ตารางรดน้ำ แจ้งเตือน, A=ดิน อากาศ แสง พืช ฤดูกาล แหล่งน้ำ, S=ต้นไม้แข็งแรง ประหยัดน้ำ ป้องกันดินแฉะ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_024",
    "familyId": "smart_irrigation",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบรดน้ำต้นไม้อัจฉริยะ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ต้นไม้แข็งแรง ประหยัดน้ำ ป้องกันดินแฉะ, E=ดิน อากาศ แสง พืช ฤดูกาล แหล่งน้ำ, A=วาล์วน้ำ ปั๊มน้ำ ตารางรดน้ำ แจ้งเตือน, S=soil moisture temperature humidity light sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=วาล์วน้ำ ปั๊มน้ำ ตารางรดน้ำ แจ้งเตือน, E=soil moisture temperature humidity light sensor, A=ต้นไม้แข็งแรง ประหยัดน้ำ ป้องกันดินแฉะ, S=ดิน อากาศ แสง พืช ฤดูกาล แหล่งน้ำ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_025",
    "familyId": "hospital_triage",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบคัดกรองผู้ป่วยเบื้องต้น",
    "choices": [
      {
        "text": "P=จัดลำดับเร่งด่วนถูก ลดความเสี่ยง ลดเวลารอ, E=ผู้ป่วย อาการ ประวัติสุขภาพ ทรัพยากรโรงพยาบาล, A=ระดับ triage แจ้งเตือน ส่งต่อ แนะนำขั้นต่อไป, S=อาการ vital signs แบบสอบถาม ประวัติผู้ป่วย",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=อาการ vital signs แบบสอบถาม ประวัติผู้ป่วย, E=ระดับ triage แจ้งเตือน ส่งต่อ แนะนำขั้นต่อไป, A=ผู้ป่วย อาการ ประวัติสุขภาพ ทรัพยากรโรงพยาบาล, S=จัดลำดับเร่งด่วนถูก ลดความเสี่ยง ลดเวลารอ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_026",
    "familyId": "hospital_triage",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบคัดกรองผู้ป่วยเบื้องต้น (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=จัดลำดับเร่งด่วนถูก ลดความเสี่ยง ลดเวลารอ, E=ผู้ป่วย อาการ ประวัติสุขภาพ ทรัพยากรโรงพยาบาล, A=ระดับ triage แจ้งเตือน ส่งต่อ แนะนำขั้นต่อไป, S=อาการ vital signs แบบสอบถาม ประวัติผู้ป่วย",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ระดับ triage แจ้งเตือน ส่งต่อ แนะนำขั้นต่อไป, E=อาการ vital signs แบบสอบถาม ประวัติผู้ป่วย, A=จัดลำดับเร่งด่วนถูก ลดความเสี่ยง ลดเวลารอ, S=ผู้ป่วย อาการ ประวัติสุขภาพ ทรัพยากรโรงพยาบาล",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_027",
    "familyId": "warehouse_robot",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "หุ่นยนต์คลังสินค้าหยิบของ",
    "choices": [
      {
        "text": "P=หยิบถูกชิ้น เร็ว ปลอดภัย ลดชน ใช้พลังงานเหมาะสม, E=ชั้นวางสินค้า พนักงาน หุ่นยนต์อื่น กล่อง ทางเดิน, A=ล้อ แขนกล gripper สัญญาณไฟ, S=กล้อง RFID lidar encoder force sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=กล้อง RFID lidar encoder force sensor, E=ล้อ แขนกล gripper สัญญาณไฟ, A=ชั้นวางสินค้า พนักงาน หุ่นยนต์อื่น กล่อง ทางเดิน, S=หยิบถูกชิ้น เร็ว ปลอดภัย ลดชน ใช้พลังงานเหมาะสม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_028",
    "familyId": "warehouse_robot",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "หุ่นยนต์คลังสินค้าหยิบของ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=หยิบถูกชิ้น เร็ว ปลอดภัย ลดชน ใช้พลังงานเหมาะสม, E=ชั้นวางสินค้า พนักงาน หุ่นยนต์อื่น กล่อง ทางเดิน, A=ล้อ แขนกล gripper สัญญาณไฟ, S=กล้อง RFID lidar encoder force sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ล้อ แขนกล gripper สัญญาณไฟ, E=กล้อง RFID lidar encoder force sensor, A=หยิบถูกชิ้น เร็ว ปลอดภัย ลดชน ใช้พลังงานเหมาะสม, S=ชั้นวางสินค้า พนักงาน หุ่นยนต์อื่น กล่อง ทางเดิน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_029",
    "familyId": "library_recommender",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำหนังสือห้องสมุด",
    "choices": [
      {
        "text": "P=แนะนำตรงความสนใจ ส่งเสริมการอ่าน หาหนังสือได้เร็ว, E=ผู้ใช้ หนังสือ หมวดหมู่ ประวัติยืม ความพร้อมของเล่ม, A=รายการแนะนำ จองหนังสือ แจ้งเตือน, S=ประวัติยืม search rating profile หนังสือ",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ประวัติยืม search rating profile หนังสือ, E=รายการแนะนำ จองหนังสือ แจ้งเตือน, A=ผู้ใช้ หนังสือ หมวดหมู่ ประวัติยืม ความพร้อมของเล่ม, S=แนะนำตรงความสนใจ ส่งเสริมการอ่าน หาหนังสือได้เร็ว",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_030",
    "familyId": "library_recommender",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำหนังสือห้องสมุด (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำตรงความสนใจ ส่งเสริมการอ่าน หาหนังสือได้เร็ว, E=ผู้ใช้ หนังสือ หมวดหมู่ ประวัติยืม ความพร้อมของเล่ม, A=รายการแนะนำ จองหนังสือ แจ้งเตือน, S=ประวัติยืม search rating profile หนังสือ",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=รายการแนะนำ จองหนังสือ แจ้งเตือน, E=ประวัติยืม search rating profile หนังสือ, A=แนะนำตรงความสนใจ ส่งเสริมการอ่าน หาหนังสือได้เร็ว, S=ผู้ใช้ หนังสือ หมวดหมู่ ประวัติยืม ความพร้อมของเล่ม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_031",
    "familyId": "exam_proctor",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบเฝ้าระวังสอบออนไลน์",
    "choices": [
      {
        "text": "P=ตรวจพฤติกรรมเสี่ยง ลด false alarm เคารพความเป็นส่วนตัว, E=ผู้สอบ กล้อง ไมค์ หน้าจอ กฎการสอบ, A=แจ้งเตือน flag report ขอ verification, S=video audio screen activity face gaze logs",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=video audio screen activity face gaze logs, E=แจ้งเตือน flag report ขอ verification, A=ผู้สอบ กล้อง ไมค์ หน้าจอ กฎการสอบ, S=ตรวจพฤติกรรมเสี่ยง ลด false alarm เคารพความเป็นส่วนตัว",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_032",
    "familyId": "exam_proctor",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบเฝ้าระวังสอบออนไลน์ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ตรวจพฤติกรรมเสี่ยง ลด false alarm เคารพความเป็นส่วนตัว, E=ผู้สอบ กล้อง ไมค์ หน้าจอ กฎการสอบ, A=แจ้งเตือน flag report ขอ verification, S=video audio screen activity face gaze logs",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แจ้งเตือน flag report ขอ verification, E=video audio screen activity face gaze logs, A=ตรวจพฤติกรรมเสี่ยง ลด false alarm เคารพความเป็นส่วนตัว, S=ผู้สอบ กล้อง ไมค์ หน้าจอ กฎการสอบ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_033",
    "familyId": "energy_home",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบจัดการพลังงานในบ้าน",
    "choices": [
      {
        "text": "P=ลดค่าไฟ คงความสบาย ปลอดภัย ใช้พลังงานเหมาะสม, E=บ้าน อุปกรณ์ไฟฟ้า คนอยู่บ้าน ราคาไฟ อากาศ, A=เปิดปิดอุปกรณ์ ปรับแอร์ แจ้งเตือน, S=smart meter temperature motion sensor schedule",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=smart meter temperature motion sensor schedule, E=เปิดปิดอุปกรณ์ ปรับแอร์ แจ้งเตือน, A=บ้าน อุปกรณ์ไฟฟ้า คนอยู่บ้าน ราคาไฟ อากาศ, S=ลดค่าไฟ คงความสบาย ปลอดภัย ใช้พลังงานเหมาะสม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_034",
    "familyId": "energy_home",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบจัดการพลังงานในบ้าน (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ลดค่าไฟ คงความสบาย ปลอดภัย ใช้พลังงานเหมาะสม, E=บ้าน อุปกรณ์ไฟฟ้า คนอยู่บ้าน ราคาไฟ อากาศ, A=เปิดปิดอุปกรณ์ ปรับแอร์ แจ้งเตือน, S=smart meter temperature motion sensor schedule",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=เปิดปิดอุปกรณ์ ปรับแอร์ แจ้งเตือน, E=smart meter temperature motion sensor schedule, A=ลดค่าไฟ คงความสบาย ปลอดภัย ใช้พลังงานเหมาะสม, S=บ้าน อุปกรณ์ไฟฟ้า คนอยู่บ้าน ราคาไฟ อากาศ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_035",
    "familyId": "plant_disease",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบวิเคราะห์โรคพืชจากภาพใบไม้",
    "choices": [
      {
        "text": "P=จำแนกโรคถูก แนะนำดูแลเหมาะ ลดความเสียหาย, E=พืช ใบไม้ โรค สภาพแวดล้อม เกษตรกร, A=ผลวิเคราะห์ คำแนะนำ แจ้งเตือน, S=ภาพใบไม้ ข้อมูลพื้นที่ อากาศ ประวัติการปลูก",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ภาพใบไม้ ข้อมูลพื้นที่ อากาศ ประวัติการปลูก, E=ผลวิเคราะห์ คำแนะนำ แจ้งเตือน, A=พืช ใบไม้ โรค สภาพแวดล้อม เกษตรกร, S=จำแนกโรคถูก แนะนำดูแลเหมาะ ลดความเสียหาย",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_036",
    "familyId": "plant_disease",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบวิเคราะห์โรคพืชจากภาพใบไม้ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=จำแนกโรคถูก แนะนำดูแลเหมาะ ลดความเสียหาย, E=พืช ใบไม้ โรค สภาพแวดล้อม เกษตรกร, A=ผลวิเคราะห์ คำแนะนำ แจ้งเตือน, S=ภาพใบไม้ ข้อมูลพื้นที่ อากาศ ประวัติการปลูก",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ผลวิเคราะห์ คำแนะนำ แจ้งเตือน, E=ภาพใบไม้ ข้อมูลพื้นที่ อากาศ ประวัติการปลูก, A=จำแนกโรคถูก แนะนำดูแลเหมาะ ลดความเสียหาย, S=พืช ใบไม้ โรค สภาพแวดล้อม เกษตรกร",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_037",
    "familyId": "campus_security",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบรักษาความปลอดภัยในมหาวิทยาลัย",
    "choices": [
      {
        "text": "P=ตรวจเหตุผิดปกติเร็ว ลดแจ้งเตือนผิด ปลอดภัย, E=พื้นที่มหาวิทยาลัย คน รถ เหตุการณ์ กลางวันกลางคืน, A=แจ้งเตือน ล็อกประตู ส่งเจ้าหน้าที่, S=กล้อง access log motion sensor sound sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=กล้อง access log motion sensor sound sensor, E=แจ้งเตือน ล็อกประตู ส่งเจ้าหน้าที่, A=พื้นที่มหาวิทยาลัย คน รถ เหตุการณ์ กลางวันกลางคืน, S=ตรวจเหตุผิดปกติเร็ว ลดแจ้งเตือนผิด ปลอดภัย",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_038",
    "familyId": "campus_security",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบรักษาความปลอดภัยในมหาวิทยาลัย (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ตรวจเหตุผิดปกติเร็ว ลดแจ้งเตือนผิด ปลอดภัย, E=พื้นที่มหาวิทยาลัย คน รถ เหตุการณ์ กลางวันกลางคืน, A=แจ้งเตือน ล็อกประตู ส่งเจ้าหน้าที่, S=กล้อง access log motion sensor sound sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แจ้งเตือน ล็อกประตู ส่งเจ้าหน้าที่, E=กล้อง access log motion sensor sound sensor, A=ตรวจเหตุผิดปกติเร็ว ลดแจ้งเตือนผิด ปลอดภัย, S=พื้นที่มหาวิทยาลัย คน รถ เหตุการณ์ กลางวันกลางคืน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_039",
    "familyId": "career_advisor",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำอาชีพให้นักศึกษา",
    "choices": [
      {
        "text": "P=แนะนำเหมาะกับทักษะ ความสนใจ และตลาดงาน, E=นักศึกษา หลักสูตร ทักษะ ประสบการณ์ ตลาดงาน, A=รายการอาชีพ แผนพัฒนาทักษะ คอร์สแนะนำ, S=แบบสอบถาม portfolio เกรด skill profile",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แบบสอบถาม portfolio เกรด skill profile, E=รายการอาชีพ แผนพัฒนาทักษะ คอร์สแนะนำ, A=นักศึกษา หลักสูตร ทักษะ ประสบการณ์ ตลาดงาน, S=แนะนำเหมาะกับทักษะ ความสนใจ และตลาดงาน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_040",
    "familyId": "career_advisor",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำอาชีพให้นักศึกษา (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำเหมาะกับทักษะ ความสนใจ และตลาดงาน, E=นักศึกษา หลักสูตร ทักษะ ประสบการณ์ ตลาดงาน, A=รายการอาชีพ แผนพัฒนาทักษะ คอร์สแนะนำ, S=แบบสอบถาม portfolio เกรด skill profile",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=รายการอาชีพ แผนพัฒนาทักษะ คอร์สแนะนำ, E=แบบสอบถาม portfolio เกรด skill profile, A=แนะนำเหมาะกับทักษะ ความสนใจ และตลาดงาน, S=นักศึกษา หลักสูตร ทักษะ ประสบการณ์ ตลาดงาน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_041",
    "familyId": "parking_assistant",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำที่จอดรถอัจฉริยะ",
    "choices": [
      {
        "text": "P=หาที่จอดเร็ว ลดวนรถ ลดความแออัด, E=ลานจอด รถ ช่องว่าง เวลา การจราจรภายใน, A=แนะนำช่องจอด ป้ายบอกทาง แจ้งเตือน, S=camera occupancy sensor GPS entry logs",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=camera occupancy sensor GPS entry logs, E=แนะนำช่องจอด ป้ายบอกทาง แจ้งเตือน, A=ลานจอด รถ ช่องว่าง เวลา การจราจรภายใน, S=หาที่จอดเร็ว ลดวนรถ ลดความแออัด",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_042",
    "familyId": "parking_assistant",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำที่จอดรถอัจฉริยะ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=หาที่จอดเร็ว ลดวนรถ ลดความแออัด, E=ลานจอด รถ ช่องว่าง เวลา การจราจรภายใน, A=แนะนำช่องจอด ป้ายบอกทาง แจ้งเตือน, S=camera occupancy sensor GPS entry logs",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แนะนำช่องจอด ป้ายบอกทาง แจ้งเตือน, E=camera occupancy sensor GPS entry logs, A=หาที่จอดเร็ว ลดวนรถ ลดความแออัด, S=ลานจอด รถ ช่องว่าง เวลา การจราจรภายใน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_043",
    "familyId": "waste_sorting",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแยกขยะอัจฉริยะ",
    "choices": [
      {
        "text": "P=แยกถูกประเภท ลดปนเปื้อน ให้ feedback ผู้ใช้, E=ขยะ ถังขยะ ผู้ใช้ ประเภทวัสดุ, A=เปิดช่องถัง แสดงคำแนะนำ แจ้งเตือน, S=กล้อง weight sensor barcode material sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=กล้อง weight sensor barcode material sensor, E=เปิดช่องถัง แสดงคำแนะนำ แจ้งเตือน, A=ขยะ ถังขยะ ผู้ใช้ ประเภทวัสดุ, S=แยกถูกประเภท ลดปนเปื้อน ให้ feedback ผู้ใช้",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_044",
    "familyId": "waste_sorting",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแยกขยะอัจฉริยะ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แยกถูกประเภท ลดปนเปื้อน ให้ feedback ผู้ใช้, E=ขยะ ถังขยะ ผู้ใช้ ประเภทวัสดุ, A=เปิดช่องถัง แสดงคำแนะนำ แจ้งเตือน, S=กล้อง weight sensor barcode material sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=เปิดช่องถัง แสดงคำแนะนำ แจ้งเตือน, E=กล้อง weight sensor barcode material sensor, A=แยกถูกประเภท ลดปนเปื้อน ให้ feedback ผู้ใช้, S=ขยะ ถังขยะ ผู้ใช้ ประเภทวัสดุ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_045",
    "familyId": "access_control",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบควบคุมสิทธิ์เข้าอาคาร",
    "choices": [
      {
        "text": "P=ให้คนที่ได้รับอนุญาตเข้า ป้องกันการแอบอ้าง, E=ประตู ผู้ใช้ บัตร ใบหน้า เวลา พื้นที่, A=ปลดล็อก ปฏิเสธ แจ้งเตือน บันทึกเหตุการณ์, S=card reader camera face embedding access log",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=card reader camera face embedding access log, E=ปลดล็อก ปฏิเสธ แจ้งเตือน บันทึกเหตุการณ์, A=ประตู ผู้ใช้ บัตร ใบหน้า เวลา พื้นที่, S=ให้คนที่ได้รับอนุญาตเข้า ป้องกันการแอบอ้าง",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_046",
    "familyId": "access_control",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบควบคุมสิทธิ์เข้าอาคาร (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ให้คนที่ได้รับอนุญาตเข้า ป้องกันการแอบอ้าง, E=ประตู ผู้ใช้ บัตร ใบหน้า เวลา พื้นที่, A=ปลดล็อก ปฏิเสธ แจ้งเตือน บันทึกเหตุการณ์, S=card reader camera face embedding access log",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ปลดล็อก ปฏิเสธ แจ้งเตือน บันทึกเหตุการณ์, E=card reader camera face embedding access log, A=ให้คนที่ได้รับอนุญาตเข้า ป้องกันการแอบอ้าง, S=ประตู ผู้ใช้ บัตร ใบหน้า เวลา พื้นที่",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_047",
    "familyId": "call_center",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบจัดคิว call center อัจฉริยะ",
    "choices": [
      {
        "text": "P=จับคู่ผู้ใช้กับเจ้าหน้าที่เหมาะ ลดเวลารอ แก้ปัญหาเร็ว, E=ลูกค้า เจ้าหน้าที่ ปัญหา queue SLA, A=จัดคิว โอนสาย ส่ง script แนะนำ, S=เสียง ข้อความ ประวัติลูกค้า ประเภทปัญหา",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=เสียง ข้อความ ประวัติลูกค้า ประเภทปัญหา, E=จัดคิว โอนสาย ส่ง script แนะนำ, A=ลูกค้า เจ้าหน้าที่ ปัญหา queue SLA, S=จับคู่ผู้ใช้กับเจ้าหน้าที่เหมาะ ลดเวลารอ แก้ปัญหาเร็ว",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_048",
    "familyId": "call_center",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบจัดคิว call center อัจฉริยะ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=จับคู่ผู้ใช้กับเจ้าหน้าที่เหมาะ ลดเวลารอ แก้ปัญหาเร็ว, E=ลูกค้า เจ้าหน้าที่ ปัญหา queue SLA, A=จัดคิว โอนสาย ส่ง script แนะนำ, S=เสียง ข้อความ ประวัติลูกค้า ประเภทปัญหา",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=จัดคิว โอนสาย ส่ง script แนะนำ, E=เสียง ข้อความ ประวัติลูกค้า ประเภทปัญหา, A=จับคู่ผู้ใช้กับเจ้าหน้าที่เหมาะ ลดเวลารอ แก้ปัญหาเร็ว, S=ลูกค้า เจ้าหน้าที่ ปัญหา queue SLA",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_049",
    "familyId": "translation_app",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบแปลภาษาแบบปรับตามบริบท",
    "choices": [
      {
        "text": "P=แปลถูกตามบริบท รักษาความหมายและโทนภาษา, E=ข้อความ ผู้ใช้ ภาษา วัฒนธรรม บริบทการสนทนา, A=ข้อความแปล คำแนะนำคำศัพท์ ตัวเลือกสำนวน, S=ข้อความต้นทาง ภาษาเป้าหมาย บริบท ประวัติการแก้",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อความต้นทาง ภาษาเป้าหมาย บริบท ประวัติการแก้, E=ข้อความแปล คำแนะนำคำศัพท์ ตัวเลือกสำนวน, A=ข้อความ ผู้ใช้ ภาษา วัฒนธรรม บริบทการสนทนา, S=แปลถูกตามบริบท รักษาความหมายและโทนภาษา",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_050",
    "familyId": "translation_app",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบแปลภาษาแบบปรับตามบริบท (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แปลถูกตามบริบท รักษาความหมายและโทนภาษา, E=ข้อความ ผู้ใช้ ภาษา วัฒนธรรม บริบทการสนทนา, A=ข้อความแปล คำแนะนำคำศัพท์ ตัวเลือกสำนวน, S=ข้อความต้นทาง ภาษาเป้าหมาย บริบท ประวัติการแก้",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อความแปล คำแนะนำคำศัพท์ ตัวเลือกสำนวน, E=ข้อความต้นทาง ภาษาเป้าหมาย บริบท ประวัติการแก้, A=แปลถูกตามบริบท รักษาความหมายและโทนภาษา, S=ข้อความ ผู้ใช้ ภาษา วัฒนธรรม บริบทการสนทนา",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_051",
    "familyId": "fitness_coach",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบโค้ชออกกำลังกายส่วนบุคคล",
    "choices": [
      {
        "text": "P=แนะนำท่าปลอดภัย เหมาะระดับ บรรลุเป้าหมายสุขภาพ, E=ผู้ใช้ อุปกรณ์ เวลา เป้าหมายสุขภาพ ข้อจำกัดร่างกาย, A=แผนฝึก feedback แจ้งเตือน ปรับระดับ, S=heart rate motion sensor profile workout history",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=heart rate motion sensor profile workout history, E=แผนฝึก feedback แจ้งเตือน ปรับระดับ, A=ผู้ใช้ อุปกรณ์ เวลา เป้าหมายสุขภาพ ข้อจำกัดร่างกาย, S=แนะนำท่าปลอดภัย เหมาะระดับ บรรลุเป้าหมายสุขภาพ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_052",
    "familyId": "fitness_coach",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบโค้ชออกกำลังกายส่วนบุคคล (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำท่าปลอดภัย เหมาะระดับ บรรลุเป้าหมายสุขภาพ, E=ผู้ใช้ อุปกรณ์ เวลา เป้าหมายสุขภาพ ข้อจำกัดร่างกาย, A=แผนฝึก feedback แจ้งเตือน ปรับระดับ, S=heart rate motion sensor profile workout history",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แผนฝึก feedback แจ้งเตือน ปรับระดับ, E=heart rate motion sensor profile workout history, A=แนะนำท่าปลอดภัย เหมาะระดับ บรรลุเป้าหมายสุขภาพ, S=ผู้ใช้ อุปกรณ์ เวลา เป้าหมายสุขภาพ ข้อจำกัดร่างกาย",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_053",
    "familyId": "news_moderation",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบคัดกรองข่าวปลอม",
    "choices": [
      {
        "text": "P=ลดข่าวปลอม อธิบายความเสี่ยง ไม่ปิดกั้นเกินไป, E=ข่าว ผู้ใช้ แหล่งข่าว เวลา บริบทสังคม, A=flag คะแนนความน่าเชื่อถือ คำเตือน, S=ข้อความข่าว แหล่งที่มา metadata fact database",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ข้อความข่าว แหล่งที่มา metadata fact database, E=flag คะแนนความน่าเชื่อถือ คำเตือน, A=ข่าว ผู้ใช้ แหล่งข่าว เวลา บริบทสังคม, S=ลดข่าวปลอม อธิบายความเสี่ยง ไม่ปิดกั้นเกินไป",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_054",
    "familyId": "news_moderation",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบคัดกรองข่าวปลอม (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ลดข่าวปลอม อธิบายความเสี่ยง ไม่ปิดกั้นเกินไป, E=ข่าว ผู้ใช้ แหล่งข่าว เวลา บริบทสังคม, A=flag คะแนนความน่าเชื่อถือ คำเตือน, S=ข้อความข่าว แหล่งที่มา metadata fact database",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=flag คะแนนความน่าเชื่อถือ คำเตือน, E=ข้อความข่าว แหล่งที่มา metadata fact database, A=ลดข่าวปลอม อธิบายความเสี่ยง ไม่ปิดกั้นเกินไป, S=ข่าว ผู้ใช้ แหล่งข่าว เวลา บริบทสังคม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_055",
    "familyId": "scholarship_match",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบจับคู่ทุนการศึกษากับนักศึกษา",
    "choices": [
      {
        "text": "P=แนะนำทุนตรงเงื่อนไข ลดพลาดโอกาส อธิบายเหตุผล, E=นักศึกษา ทุน เกณฑ์คุณสมบัติ กำหนดเวลา, A=รายการทุน แจ้งเตือน checklist เอกสาร, S=profile เกรด รายได้ ความสนใจ deadline",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=profile เกรด รายได้ ความสนใจ deadline, E=รายการทุน แจ้งเตือน checklist เอกสาร, A=นักศึกษา ทุน เกณฑ์คุณสมบัติ กำหนดเวลา, S=แนะนำทุนตรงเงื่อนไข ลดพลาดโอกาส อธิบายเหตุผล",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_056",
    "familyId": "scholarship_match",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบจับคู่ทุนการศึกษากับนักศึกษา (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำทุนตรงเงื่อนไข ลดพลาดโอกาส อธิบายเหตุผล, E=นักศึกษา ทุน เกณฑ์คุณสมบัติ กำหนดเวลา, A=รายการทุน แจ้งเตือน checklist เอกสาร, S=profile เกรด รายได้ ความสนใจ deadline",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=รายการทุน แจ้งเตือน checklist เอกสาร, E=profile เกรด รายได้ ความสนใจ deadline, A=แนะนำทุนตรงเงื่อนไข ลดพลาดโอกาส อธิบายเหตุผล, S=นักศึกษา ทุน เกณฑ์คุณสมบัติ กำหนดเวลา",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_057",
    "familyId": "disaster_response",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบช่วยตัดสินใจรับมือภัยพิบัติ",
    "choices": [
      {
        "text": "P=ลดความสูญเสีย จัดทรัพยากรเหมาะ แจ้งเตือนทันเวลา, E=พื้นที่เสี่ยง ประชาชน เส้นทาง ทรัพยากร หน่วยกู้ภัย, A=คำสั่งอพยพ แนะนำเส้นทาง จัดสรรทรัพยากร, S=sensor ภัยพิบัติ แผนที่ รายงานประชาชน weather data",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=sensor ภัยพิบัติ แผนที่ รายงานประชาชน weather data, E=คำสั่งอพยพ แนะนำเส้นทาง จัดสรรทรัพยากร, A=พื้นที่เสี่ยง ประชาชน เส้นทาง ทรัพยากร หน่วยกู้ภัย, S=ลดความสูญเสีย จัดทรัพยากรเหมาะ แจ้งเตือนทันเวลา",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_058",
    "familyId": "disaster_response",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบช่วยตัดสินใจรับมือภัยพิบัติ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ลดความสูญเสีย จัดทรัพยากรเหมาะ แจ้งเตือนทันเวลา, E=พื้นที่เสี่ยง ประชาชน เส้นทาง ทรัพยากร หน่วยกู้ภัย, A=คำสั่งอพยพ แนะนำเส้นทาง จัดสรรทรัพยากร, S=sensor ภัยพิบัติ แผนที่ รายงานประชาชน weather data",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=คำสั่งอพยพ แนะนำเส้นทาง จัดสรรทรัพยากร, E=sensor ภัยพิบัติ แผนที่ รายงานประชาชน weather data, A=ลดความสูญเสีย จัดทรัพยากรเหมาะ แจ้งเตือนทันเวลา, S=พื้นที่เสี่ยง ประชาชน เส้นทาง ทรัพยากร หน่วยกู้ภัย",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_059",
    "familyId": "music_recommender",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำเพลงตามอารมณ์และกิจกรรม",
    "choices": [
      {
        "text": "P=แนะนำเพลงตรงอารมณ์ ไม่ซ้ำเกินไป เพิ่มความพึงพอใจ, E=ผู้ใช้ เพลง playlist เวลา กิจกรรม, A=playlist เพลงแนะนำ ลำดับเพลง, S=การฟัง skip like เวลา activity sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=การฟัง skip like เวลา activity sensor, E=playlist เพลงแนะนำ ลำดับเพลง, A=ผู้ใช้ เพลง playlist เวลา กิจกรรม, S=แนะนำเพลงตรงอารมณ์ ไม่ซ้ำเกินไป เพิ่มความพึงพอใจ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_060",
    "familyId": "music_recommender",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบแนะนำเพลงตามอารมณ์และกิจกรรม (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำเพลงตรงอารมณ์ ไม่ซ้ำเกินไป เพิ่มความพึงพอใจ, E=ผู้ใช้ เพลง playlist เวลา กิจกรรม, A=playlist เพลงแนะนำ ลำดับเพลง, S=การฟัง skip like เวลา activity sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=playlist เพลงแนะนำ ลำดับเพลง, E=การฟัง skip like เวลา activity sensor, A=แนะนำเพลงตรงอารมณ์ ไม่ซ้ำเกินไป เพิ่มความพึงพอใจ, S=ผู้ใช้ เพลง playlist เวลา กิจกรรม",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_061",
    "familyId": "course_planner",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบวางแผนรายวิชาลงทะเบียน",
    "choices": [
      {
        "text": "P=แนะนำแผนที่ไม่ชนเวลา ตรง prerequisite และจบตามแผน, E=นักศึกษา รายวิชา prerequisite ตารางเรียน หลักสูตร, A=แผนลงทะเบียน แจ้งเตือน ความเสี่ยงจบช้า, S=transcript ตารางเรียน ความสนใจ prerequisite data",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=transcript ตารางเรียน ความสนใจ prerequisite data, E=แผนลงทะเบียน แจ้งเตือน ความเสี่ยงจบช้า, A=นักศึกษา รายวิชา prerequisite ตารางเรียน หลักสูตร, S=แนะนำแผนที่ไม่ชนเวลา ตรง prerequisite และจบตามแผน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_062",
    "familyId": "course_planner",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบวางแผนรายวิชาลงทะเบียน (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำแผนที่ไม่ชนเวลา ตรง prerequisite และจบตามแผน, E=นักศึกษา รายวิชา prerequisite ตารางเรียน หลักสูตร, A=แผนลงทะเบียน แจ้งเตือน ความเสี่ยงจบช้า, S=transcript ตารางเรียน ความสนใจ prerequisite data",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แผนลงทะเบียน แจ้งเตือน ความเสี่ยงจบช้า, E=transcript ตารางเรียน ความสนใจ prerequisite data, A=แนะนำแผนที่ไม่ชนเวลา ตรง prerequisite และจบตามแผน, S=นักศึกษา รายวิชา prerequisite ตารางเรียน หลักสูตร",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_063",
    "familyId": "clinic_appointment",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบนัดหมายคลินิกอัจฉริยะ",
    "choices": [
      {
        "text": "P=จัดเวลานัดเหมาะ ลดรอ จัดลำดับความเร่งด่วน, E=ผู้ป่วย แพทย์ ห้องตรวจ ตารางเวลา อาการ, A=เวลานัด แจ้งเตือน จัดคิว ส่งต่อ, S=อาการ availability ประวัติการนัด vital signs",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=อาการ availability ประวัติการนัด vital signs, E=เวลานัด แจ้งเตือน จัดคิว ส่งต่อ, A=ผู้ป่วย แพทย์ ห้องตรวจ ตารางเวลา อาการ, S=จัดเวลานัดเหมาะ ลดรอ จัดลำดับความเร่งด่วน",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_064",
    "familyId": "clinic_appointment",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบนัดหมายคลินิกอัจฉริยะ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=จัดเวลานัดเหมาะ ลดรอ จัดลำดับความเร่งด่วน, E=ผู้ป่วย แพทย์ ห้องตรวจ ตารางเวลา อาการ, A=เวลานัด แจ้งเตือน จัดคิว ส่งต่อ, S=อาการ availability ประวัติการนัด vital signs",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=เวลานัด แจ้งเตือน จัดคิว ส่งต่อ, E=อาการ availability ประวัติการนัด vital signs, A=จัดเวลานัดเหมาะ ลดรอ จัดลำดับความเร่งด่วน, S=ผู้ป่วย แพทย์ ห้องตรวจ ตารางเวลา อาการ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_065",
    "familyId": "smart_museum",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบนำชมพิพิธภัณฑ์ส่วนบุคคล",
    "choices": [
      {
        "text": "P=แนะนำเส้นทางชมตรงความสนใจ ลดแออัด, E=ผู้ชม นิทรรศการ เวลา คนหนาแน่น ความสนใจ, A=เส้นทางนำชม คำอธิบาย แจ้งเตือน, S=ตำแหน่งในอาคาร profile dwell time crowd sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=ตำแหน่งในอาคาร profile dwell time crowd sensor, E=เส้นทางนำชม คำอธิบาย แจ้งเตือน, A=ผู้ชม นิทรรศการ เวลา คนหนาแน่น ความสนใจ, S=แนะนำเส้นทางชมตรงความสนใจ ลดแออัด",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_066",
    "familyId": "smart_museum",
    "type": "peas",
    "difficulty": "normal",
    "scenario": "ระบบนำชมพิพิธภัณฑ์ส่วนบุคคล (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำเส้นทางชมตรงความสนใจ ลดแออัด, E=ผู้ชม นิทรรศการ เวลา คนหนาแน่น ความสนใจ, A=เส้นทางนำชม คำอธิบาย แจ้งเตือน, S=ตำแหน่งในอาคาร profile dwell time crowd sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=เส้นทางนำชม คำอธิบาย แจ้งเตือน, E=ตำแหน่งในอาคาร profile dwell time crowd sensor, A=แนะนำเส้นทางชมตรงความสนใจ ลดแออัด, S=ผู้ชม นิทรรศการ เวลา คนหนาแน่น ความสนใจ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_067",
    "familyId": "water_quality",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบเฝ้าระวังคุณภาพน้ำ",
    "choices": [
      {
        "text": "P=ตรวจเสี่ยงเร็ว ลดมลพิษ แจ้งเตือนทันเวลา, E=แหล่งน้ำ โรงงาน ชุมชน ฝน ฤดูกาล, A=แจ้งเตือน แนะนำตรวจซ้ำ ปรับระบบบำบัด, S=pH turbidity temperature chemical sensor weather",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=pH turbidity temperature chemical sensor weather, E=แจ้งเตือน แนะนำตรวจซ้ำ ปรับระบบบำบัด, A=แหล่งน้ำ โรงงาน ชุมชน ฝน ฤดูกาล, S=ตรวจเสี่ยงเร็ว ลดมลพิษ แจ้งเตือนทันเวลา",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_068",
    "familyId": "water_quality",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบเฝ้าระวังคุณภาพน้ำ (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=ตรวจเสี่ยงเร็ว ลดมลพิษ แจ้งเตือนทันเวลา, E=แหล่งน้ำ โรงงาน ชุมชน ฝน ฤดูกาล, A=แจ้งเตือน แนะนำตรวจซ้ำ ปรับระบบบำบัด, S=pH turbidity temperature chemical sensor weather",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แจ้งเตือน แนะนำตรวจซ้ำ ปรับระบบบำบัด, E=pH turbidity temperature chemical sensor weather, A=ตรวจเสี่ยงเร็ว ลดมลพิษ แจ้งเตือนทันเวลา, S=แหล่งน้ำ โรงงาน ชุมชน ฝน ฤดูกาล",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  },
  {
    "id": "s2_peas_069",
    "familyId": "mental_health_screen",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบคัดกรองความเสี่ยงสุขภาพจิตเบื้องต้น",
    "choices": [
      {
        "text": "P=แนะนำช่วยเหลือเหมาะ ปลอดภัย ลด false negative, E=ผู้ใช้ แบบประเมิน บริบทชีวิต ผู้เชี่ยวชาญ, A=คำแนะนำระดับความเสี่ยง ส่งต่อ แจ้งเตือน, S=แบบสอบถาม ข้อความ mood log sleep data",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=แบบสอบถาม ข้อความ mood log sleep data, E=คำแนะนำระดับความเสี่ยง ส่งต่อ แจ้งเตือน, A=ผู้ใช้ แบบประเมิน บริบทชีวิต ผู้เชี่ยวชาญ, S=แนะนำช่วยเหลือเหมาะ ปลอดภัย ลด false negative",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=ใช้ AI รุ่นล่าสุด, E=อินเทอร์เน็ต, A=ผู้ใช้, S=หน้าจอ",
        "correct": false,
        "misconception": "tech_focus"
      },
      {
        "text": "P=หน้าตาสวยและเร็ว, E=server, A=database, S=keyboard",
        "correct": false,
        "misconception": "ui_speed_focus"
      }
    ]
  },
  {
    "id": "s2_peas_070",
    "familyId": "mental_health_screen",
    "type": "peas",
    "difficulty": "hard",
    "scenario": "ระบบคัดกรองความเสี่ยงสุขภาพจิตเบื้องต้น (เวอร์ชันประยุกต์)",
    "choices": [
      {
        "text": "P=แนะนำช่วยเหลือเหมาะ ปลอดภัย ลด false negative, E=ผู้ใช้ แบบประเมิน บริบทชีวิต ผู้เชี่ยวชาญ, A=คำแนะนำระดับความเสี่ยง ส่งต่อ แจ้งเตือน, S=แบบสอบถาม ข้อความ mood log sleep data",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "P=คำแนะนำระดับความเสี่ยง ส่งต่อ แจ้งเตือน, E=แบบสอบถาม ข้อความ mood log sleep data, A=แนะนำช่วยเหลือเหมาะ ปลอดภัย ลด false negative, S=ผู้ใช้ แบบประเมิน บริบทชีวิต ผู้เชี่ยวชาญ",
        "correct": false,
        "misconception": "peas_swap"
      },
      {
        "text": "P=มีข้อมูลจำนวนมาก, E=algorithm, A=model, S=cloud",
        "correct": false,
        "misconception": "component_vs_peas"
      },
      {
        "text": "P=ทำงานอัตโนมัติ, E=มือถือ, A=นักศึกษา, S=ปุ่มกด",
        "correct": false,
        "misconception": "automation"
      }
    ]
  }
];

  const ENV_ITEMS = [
  {
    "id": "s2_env_001",
    "familyId": "chess",
    "type": "env",
    "difficulty": "easy",
    "stem": "เกมหมากรุกสำหรับ AI มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Fully observable, deterministic, sequential, static, discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Partially observable เพราะไม่เห็นความคิดคู่แข่ง",
        "correct": false,
        "misconception": "observable_confusion"
      },
      {
        "text": "Stochastic เพราะผู้เล่นอาจผิดพลาด",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Continuous เพราะมีหลายตำแหน่ง",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_002",
    "familyId": "chess_applied",
    "type": "env",
    "difficulty": "easy",
    "stem": "ถ้าวิเคราะห์กรณี 'เกมหมากรุกสำหรับ AI' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Partially observable เพราะไม่เห็นความคิดคู่แข่ง",
        "correct": false,
        "misconception": "observable_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_003",
    "familyId": "self_driving",
    "type": "env",
    "difficulty": "normal",
    "stem": "รถยนต์ไร้คนขับบนถนนจริง มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีกล้องจำนวนมาก",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "Static เพราะถนนอยู่กับที่",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะรถตัดสินใจคันเดียว",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_004",
    "familyId": "self_driving_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'รถยนต์ไร้คนขับบนถนนจริง' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีกล้องจำนวนมาก",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_005",
    "familyId": "video_recommender",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบแนะนำวิดีโอออนไลน์ มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable และ sequential เพราะไม่รู้ความชอบทั้งหมดและคำแนะนำก่อนหน้าส่งผลต่อครั้งถัดไป",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีประวัติการดูครบ",
        "correct": false,
        "misconception": "episodic_sequential"
      },
      {
        "text": "Episodic เพราะแต่ละคำแนะนำไม่เกี่ยวข้อง",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Deterministic เสมอเพราะ algorithm เหมือนเดิม",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_006",
    "familyId": "video_recommender_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแนะนำวิดีโอออนไลน์' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีประวัติการดูครบ",
        "correct": false,
        "misconception": "episodic_sequential"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_007",
    "familyId": "batch_csv",
    "type": "env",
    "difficulty": "easy",
    "stem": "ระบบวิเคราะห์ข้อสอบจากไฟล์ CSV แบบ batch มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Episodic/static ได้มากกว่างานที่ต้องโต้ตอบ real-time",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Dynamic เสมอเพราะข้อมูลเป็นดิจิทัล",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "Multi-agent เพราะมีนักศึกษาหลายคนในไฟล์",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Continuous เพราะคะแนนมีหลายค่า",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_008",
    "familyId": "batch_csv_applied",
    "type": "env",
    "difficulty": "easy",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบวิเคราะห์ข้อสอบจากไฟล์ CSV แบบ batch' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Dynamic เสมอเพราะข้อมูลเป็นดิจิทัล",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_009",
    "familyId": "stock_trading",
    "type": "env",
    "difficulty": "hard",
    "stem": "บอทเทรดหุ้น real-time มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีราคาตลาด",
        "correct": false,
        "misconception": "observable_confusion"
      },
      {
        "text": "Static เพราะตลาดเปิดตามเวลา",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะบอทอยู่ในบัญชีเดียว",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_010",
    "familyId": "stock_trading_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'บอทเทรดหุ้น real-time' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีราคาตลาด",
        "correct": false,
        "misconception": "observable_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_011",
    "familyId": "robot_vacuum",
    "type": "env",
    "difficulty": "normal",
    "stem": "หุ่นยนต์ดูดฝุ่นในบ้านที่มีคนเดินไปมา มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, single/multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี sensor รอบตัว",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "Deterministic เพราะห้องเดิม",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Static เพราะบ้านไม่เคลื่อนที่",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_012",
    "familyId": "robot_vacuum_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'หุ่นยนต์ดูดฝุ่นในบ้านที่มีคนเดินไปมา' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี sensor รอบตัว",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_013",
    "familyId": "crossword",
    "type": "env",
    "difficulty": "easy",
    "stem": "เกม crossword ดิจิทัลเล่นคนเดียว มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Fully observable, deterministic, sequential, static, discrete, single-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Partially observable เพราะยังไม่รู้คำตอบ",
        "correct": false,
        "misconception": "agent_knowledge_confusion"
      },
      {
        "text": "Stochastic เพราะเดาคำได้หลายแบบ",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Dynamic เพราะเวลาเดิน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_014",
    "familyId": "crossword_applied",
    "type": "env",
    "difficulty": "easy",
    "stem": "ถ้าวิเคราะห์กรณี 'เกม crossword ดิจิทัลเล่นคนเดียว' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Partially observable เพราะยังไม่รู้คำตอบ",
        "correct": false,
        "misconception": "agent_knowledge_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_015",
    "familyId": "medical_triage",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบคัดกรองผู้ป่วยฉุกเฉิน มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีแบบฟอร์มอาการ",
        "correct": false,
        "misconception": "highstakes_env"
      },
      {
        "text": "Deterministic เพราะมี guideline",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Static เพราะโรงพยาบาลอยู่ที่เดิม",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_016",
    "familyId": "medical_triage_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบคัดกรองผู้ป่วยฉุกเฉิน' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีแบบฟอร์มอาการ",
        "correct": false,
        "misconception": "highstakes_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_017",
    "familyId": "email_spam",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบกรองสแปมใน inbox มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential ได้เมื่อ feedback ผู้ใช้ส่งผลต่อ model",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นข้อความทั้งหมด",
        "correct": false,
        "misconception": "data_not_full_observable"
      },
      {
        "text": "Static เพราะอีเมลเป็นไฟล์",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เท่านั้นเพราะไม่มีผู้ส่ง",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_018",
    "familyId": "email_spam_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบกรองสแปมใน inbox' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นข้อความทั้งหมด",
        "correct": false,
        "misconception": "data_not_full_observable"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_019",
    "familyId": "maze_static",
    "type": "env",
    "difficulty": "easy",
    "stem": "agent เดินในเขาวงกตที่แผนที่ชัดและไม่เปลี่ยน มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Fully observable, deterministic, sequential, static, discrete, single-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Partially observable เสมอเพราะ agent ต้องเดิน",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "Stochastic เพราะมีหลายทาง",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Dynamic เพราะ agent เคลื่อนที่",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_020",
    "familyId": "maze_static_applied",
    "type": "env",
    "difficulty": "easy",
    "stem": "ถ้าวิเคราะห์กรณี 'agent เดินในเขาวงกตที่แผนที่ชัดและไม่เปลี่ยน' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Partially observable เสมอเพราะ agent ต้องเดิน",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_021",
    "familyId": "warehouse_multi_robot",
    "type": "env",
    "difficulty": "hard",
    "stem": "คลังสินค้าที่มีหุ่นยนต์หลายตัวเดินพร้อมกัน มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous/discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Single-agent เพราะแต่ละตัวมี controller ของตัวเอง",
        "correct": false,
        "misconception": "multiagent_confusion"
      },
      {
        "text": "Static เพราะคลังสินค้าไม่เปลี่ยน",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Deterministic เพราะระบบกำหนด route",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_022",
    "familyId": "warehouse_multi_robot_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'คลังสินค้าที่มีหุ่นยนต์หลายตัวเดินพร้อมกัน' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Single-agent เพราะแต่ละตัวมี controller ของตัวเอง",
        "correct": false,
        "misconception": "multiagent_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_023",
    "familyId": "weather_alert",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบแจ้งเตือนสภาพอากาศรุนแรง มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Deterministic เพราะมี sensor",
        "correct": false,
        "misconception": "stochastic_confusion"
      },
      {
        "text": "Fully observable เพราะมีดาวเทียม",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Static เพราะพื้นที่พยากรณ์เดิม",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_024",
    "familyId": "weather_alert_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแจ้งเตือนสภาพอากาศรุนแรง' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Deterministic เพราะมี sensor",
        "correct": false,
        "misconception": "stochastic_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_025",
    "familyId": "quiz_app",
    "type": "env",
    "difficulty": "easy",
    "stem": "แอปทำ quiz ที่สุ่มคำถามจากคลังและให้คะแนนทันที มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Fully observable ต่อ state ของ quiz, episodic/sequential ตาม design, static, discrete",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Dynamic เพราะข้อสอบอยู่บนมือถือ",
        "correct": false,
        "misconception": "continuous_confusion"
      },
      {
        "text": "Continuous เพราะคะแนนมีทศนิยม",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Multi-agent เพราะมีนักเรียนหลายคน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_026",
    "familyId": "quiz_app_applied",
    "type": "env",
    "difficulty": "easy",
    "stem": "ถ้าวิเคราะห์กรณี 'แอปทำ quiz ที่สุ่มคำถามจากคลังและให้คะแนนทันที' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Dynamic เพราะข้อสอบอยู่บนมือถือ",
        "correct": false,
        "misconception": "continuous_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_027",
    "familyId": "language_chatbot",
    "type": "env",
    "difficulty": "hard",
    "stem": "แชตบอตสนทนาภาษา มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, discrete/continuous text, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นข้อความผู้ใช้",
        "correct": false,
        "misconception": "llm_env"
      },
      {
        "text": "Episodic เพราะตอบทีละข้อความไม่เกี่ยวกัน",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Deterministic เพราะ prompt เดิมผลเหมือนเดิมเสมอ",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_028",
    "familyId": "language_chatbot_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'แชตบอตสนทนาภาษา' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นข้อความผู้ใช้",
        "correct": false,
        "misconception": "llm_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_029",
    "familyId": "smart_home",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบ smart home คุมไฟ/แอร์ขณะมีคนอยู่บ้าน มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Static เพราะบ้านอยู่ที่เดิม",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "Fully observable เพราะมี IoT",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะมีระบบเดียว",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_030",
    "familyId": "smart_home_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบ smart home คุมไฟ/แอร์ขณะมีคนอยู่บ้าน' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Static เพราะบ้านอยู่ที่เดิม",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_031",
    "familyId": "factory_qc",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบตรวจคุณภาพสินค้าในสายพาน มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential/dynamic, continuous/discrete ตาม sensor",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะกล้องเห็นสินค้า",
        "correct": false,
        "misconception": "observable_confusion"
      },
      {
        "text": "Static เพราะสินค้าวิ่งตามสายพาน",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เสมอเพราะไม่มีคนเกี่ยวข้อง",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_032",
    "familyId": "factory_qc_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบตรวจคุณภาพสินค้าในสายพาน' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะกล้องเห็นสินค้า",
        "correct": false,
        "misconception": "observable_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_033",
    "familyId": "portfolio_advisor",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบแนะนำ portfolio การลงทุนรายบุคคล มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Deterministic เพราะมีสูตรทางการเงิน",
        "correct": false,
        "misconception": "financial_env"
      },
      {
        "text": "Fully observable เพราะมีข้อมูลราคา",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Episodic เพราะคำแนะนำแต่ละครั้งแยกกัน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_034",
    "familyId": "portfolio_advisor_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแนะนำ portfolio การลงทุนรายบุคคล' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Deterministic เพราะมีสูตรทางการเงิน",
        "correct": false,
        "misconception": "financial_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_035",
    "familyId": "traffic_signal",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบไฟจราจรอัจฉริยะที่แยกเมือง มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีกล้องทุกแยก",
        "correct": false,
        "misconception": "multiagent_confusion"
      },
      {
        "text": "Static เพราะถนนไม่ขยับ",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะคุมไฟเครื่องเดียว",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_036",
    "familyId": "traffic_signal_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบไฟจราจรอัจฉริยะที่แยกเมือง' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีกล้องทุกแยก",
        "correct": false,
        "misconception": "multiagent_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_037",
    "familyId": "plant_disease",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบวิเคราะห์โรคพืชจากภาพ มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, episodic/sequential ถ้ามีการติดตาม, static ต่อภาพเดียว, discrete label",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นภาพใบไม้",
        "correct": false,
        "misconception": "image_env"
      },
      {
        "text": "Deterministic เพราะภาพเดียวควรตอบเดียว",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Dynamic เสมอเพราะพืชโต",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_038",
    "familyId": "plant_disease_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบวิเคราะห์โรคพืชจากภาพ' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นภาพใบไม้",
        "correct": false,
        "misconception": "image_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_039",
    "familyId": "game_npc",
    "type": "env",
    "difficulty": "normal",
    "stem": "NPC ในเกมต่อสู้กับผู้เล่น มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially/Fully observable ตามเกม, stochastic/sequential, dynamic, discrete/continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Single-agent เพราะ NPC เป็น AI",
        "correct": false,
        "misconception": "multiagent_confusion"
      },
      {
        "text": "Static เพราะอยู่ในเกม",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Episodic เพราะแต่ละการโจมตีไม่เกี่ยวกัน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_040",
    "familyId": "game_npc_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'NPC ในเกมต่อสู้กับผู้เล่น' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Single-agent เพราะ NPC เป็น AI",
        "correct": false,
        "misconception": "multiagent_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_041",
    "familyId": "translation",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบแปลภาษาแบบ sentence-by-sentence มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable ต่อความหมายเต็ม, stochastic, episodic/sequential ตามบริบท, static ต่อ input, discrete text",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นประโยค",
        "correct": false,
        "misconception": "nlp_env"
      },
      {
        "text": "Deterministic เพราะ dictionary ตายตัว",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Continuous เพราะภาษาไม่มีขอบเขต",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_042",
    "familyId": "translation_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแปลภาษาแบบ sentence-by-sentence' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็นประโยค",
        "correct": false,
        "misconception": "nlp_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_043",
    "familyId": "delivery_route",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบวางแผนส่งพัสดุในเมือง มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี map",
        "correct": false,
        "misconception": "planning_env"
      },
      {
        "text": "Static เพราะ route คำนวณก่อนออก",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะรถของบริษัทเดียว",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_044",
    "familyId": "delivery_route_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบวางแผนส่งพัสดุในเมือง' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี map",
        "correct": false,
        "misconception": "planning_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_045",
    "familyId": "recommend_books",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบแนะนำหนังสือห้องสมุด มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีประวัติยืม",
        "correct": false,
        "misconception": "recommend_env"
      },
      {
        "text": "Episodic เพราะการแนะนำครั้งก่อนข้อไม่ส่งผล",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Deterministic เสมอเพราะ query เดิม",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_046",
    "familyId": "recommend_books_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแนะนำหนังสือห้องสมุด' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีประวัติยืม",
        "correct": false,
        "misconception": "recommend_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_047",
    "familyId": "water_quality",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบเฝ้าระวังคุณภาพน้ำ มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี sensor",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "Static เพราะแม่น้ำอยู่ที่เดิม",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Deterministic เพราะวัดค่า pH ได้",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_048",
    "familyId": "water_quality_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบเฝ้าระวังคุณภาพน้ำ' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี sensor",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_049",
    "familyId": "exam_proctor",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบคุมสอบออนไลน์ มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous/discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะกล้องเปิด",
        "correct": false,
        "misconception": "privacy_env"
      },
      {
        "text": "Deterministic เพราะมีกฎสอบ",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะนักศึกษาทำคนเดียว",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_050",
    "familyId": "exam_proctor_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบคุมสอบออนไลน์' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะกล้องเปิด",
        "correct": false,
        "misconception": "privacy_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_051",
    "familyId": "job_match",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบจับคู่งานกับผู้สมัคร มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี resume",
        "correct": false,
        "misconception": "data_not_full_observable"
      },
      {
        "text": "Episodic เพราะแต่ละงานแยกกัน",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Static เพราะ profile ไม่เปลี่ยน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_052",
    "familyId": "job_match_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบจับคู่งานกับผู้สมัคร' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี resume",
        "correct": false,
        "misconception": "data_not_full_observable"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_053",
    "familyId": "parking",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบแนะนำที่จอดรถ real-time มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, discrete/continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี sensor ช่องจอด",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "Static เพราะลานจอดอยู่ที่เดิม",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Single-agent เพราะผู้ใช้เลือกเอง",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_054",
    "familyId": "parking_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแนะนำที่จอดรถ real-time' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมี sensor ช่องจอด",
        "correct": false,
        "misconception": "dynamic_confusion"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_055",
    "familyId": "disaster",
    "type": "env",
    "difficulty": "hard",
    "stem": "ระบบช่วยอพยพภัยพิบัติ มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, continuous, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีแผนที่",
        "correct": false,
        "misconception": "disaster_env"
      },
      {
        "text": "Deterministic เพราะมีแผนอพยพ",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Static เพราะพื้นที่เดิม",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_056",
    "familyId": "disaster_applied",
    "type": "env",
    "difficulty": "hard",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบช่วยอพยพภัยพิบัติ' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะมีแผนที่",
        "correct": false,
        "misconception": "disaster_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_057",
    "familyId": "music",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบแนะนำเพลงตามอารมณ์ มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic, sequential, dynamic, discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็น playlist",
        "correct": false,
        "misconception": "recommend_env"
      },
      {
        "text": "Episodic เพราะเพลงแต่ละเพลงไม่เกี่ยวกัน",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Deterministic เพราะ genre ชัดเจน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_058",
    "familyId": "music_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบแนะนำเพลงตามอารมณ์' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Fully observable เพราะเห็น playlist",
        "correct": false,
        "misconception": "recommend_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  },
  {
    "id": "s2_env_059",
    "familyId": "course_plan",
    "type": "env",
    "difficulty": "normal",
    "stem": "ระบบวางแผนลงทะเบียนเรียน มี environment แบบใดเด่นที่สุด?",
    "choices": [
      {
        "text": "Partially observable, stochastic ในพฤติกรรมผู้เรียน, sequential, dynamic, discrete, multi-agent",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Static เพราะหลักสูตรไม่เปลี่ยน",
        "correct": false,
        "misconception": "education_env"
      },
      {
        "text": "Fully observable เพราะมี transcript",
        "correct": false,
        "misconception": "stochastic_dynamic_confusion"
      },
      {
        "text": "Episodic เพราะแต่ละเทอมแยกกัน",
        "correct": false,
        "misconception": "agent_count_confusion"
      }
    ]
  },
  {
    "id": "s2_env_060",
    "familyId": "course_plan_applied",
    "type": "env",
    "difficulty": "normal",
    "stem": "ถ้าวิเคราะห์กรณี 'ระบบวางแผนลงทะเบียนเรียน' สำหรับออกแบบ agent ควรระวังคำอธิบายใด?",
    "choices": [
      {
        "text": "ต้องพิจารณาว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม",
        "correct": true,
        "misconception": ""
      },
      {
        "text": "Static เพราะหลักสูตรไม่เปลี่ยน",
        "correct": false,
        "misconception": "education_env"
      },
      {
        "text": "มี sensor เยอะจึง fully observable เสมอ",
        "correct": false,
        "misconception": "sensor_full_observable"
      },
      {
        "text": "ถ้าเป็น software ต้องเป็น static environment เสมอ",
        "correct": false,
        "misconception": "software_static_confusion"
      }
    ]
  }
];

  const BOSS_CLAIMS = [
  {
    "id": "s2_boss_001",
    "familyId": "sensor_agent",
    "type": "boss",
    "difficulty": "easy",
    "claim": "ถ้าระบบมี sensor ก็เป็น intelligent agent แน่นอน",
    "counter": "ไม่เสมอไป sensor เป็นเพียงช่องทางรับ percept ต้องดูว่าระบบเลือก action เพื่อบรรลุ goal หรือไม่",
    "hint": "sensor อยู่ใน S ของ PEAS แต่ไม่ใช่ทั้งหมดของ agent",
    "why": "agent ต้องมี percept, action, goal/performance measure และการตัดสินใจ",
    "key": "sensor"
  },
  {
    "id": "s2_boss_002",
    "familyId": "performance_sensor",
    "type": "boss",
    "difficulty": "easy",
    "claim": "Performance measure คือสิ่งที่ agent ใช้รับข้อมูลจากโลก",
    "counter": "ไม่ใช่ Performance measure คือเกณฑ์วัดความสำเร็จ ส่วนสิ่งที่รับข้อมูลคือ Sensors",
    "hint": "แยก P กับ S ใน PEAS",
    "why": "P ใช้วัดผลว่า agent ทำดีไหม ส่วน S คือช่องทางรับ percept",
    "key": "peas_swap"
  },
  {
    "id": "s2_boss_003",
    "familyId": "rational_best",
    "type": "boss",
    "difficulty": "normal",
    "claim": "Rational agent ต้องเลือก action ที่ดีที่สุดจริงเสมอ",
    "counter": "ไม่จำเป็นต้องดีที่สุดจริง แต่ควรเลือก action ที่คาดว่าจะดีที่สุดจาก percept และความรู้ที่มีในขณะนั้น",
    "hint": "rational ไม่ได้แปลว่า omniscient",
    "why": "rationality ขึ้นกับข้อมูล/ความรู้ที่ agent มี",
    "key": "rationality"
  },
  {
    "id": "s2_boss_004",
    "familyId": "dynamic_move",
    "type": "boss",
    "difficulty": "normal",
    "claim": "ถ้า environment เป็น dynamic แปลว่า agent ต้องเคลื่อนที่ได้เท่านั้น",
    "counter": "ไม่ใช่ dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "hint": "dynamic คือสภาพแวดล้อมเปลี่ยน ไม่ใช่ตัว agent ขยับ",
    "why": "ตลาดหุ้นหรือ traffic เป็น dynamic แม้ agent เป็น software",
    "key": "dynamic_confusion"
  },
  {
    "id": "s2_boss_005",
    "familyId": "bigdata_rational",
    "type": "boss",
    "difficulty": "normal",
    "claim": "Agent ที่ใช้ข้อมูลเยอะย่อมเป็น rational agent เสมอ",
    "counter": "ไม่เสมอ ข้อมูลเยอะช่วยได้ แต่ rationality ขึ้นกับ action ที่คาดว่าดีที่สุดตาม goal/evidence",
    "hint": "ข้อมูลเยอะไม่พอ ต้องมี goal และการตัดสินใจที่เหมาะสม",
    "why": "big data ไม่ได้เท่ากับ rational decision โดยอัตโนมัติ",
    "key": "bigdata_rational"
  },
  {
    "id": "s2_boss_006",
    "familyId": "agent_robot",
    "type": "boss",
    "difficulty": "easy",
    "claim": "agent ต้องเป็นหุ่นยนต์หรือมีร่างกายเท่านั้น",
    "counter": "ไม่ถูก agent อาจเป็นซอฟต์แวร์ได้ เช่น recommender หรือ spam filter",
    "hint": "agent = สิ่งที่รับ percept และกระทำ action",
    "why": "software agent เป็น agent ได้",
    "key": "robot_only"
  },
  {
    "id": "s2_boss_007",
    "familyId": "actuator_output",
    "type": "boss",
    "difficulty": "normal",
    "claim": "Actuator ต้องเป็นแขนกลหรือล้อเท่านั้น",
    "counter": "ไม่ถูก actuator คือช่องทางที่ agent ใช้กระทำ อาจเป็นข้อความ คำแนะนำ หรือการจัดอันดับ",
    "hint": "ดู action ของ agent ไม่ใช่รูปร่างอุปกรณ์",
    "why": "software actuator เช่น message, ranking, alert",
    "key": "actuator_confusion"
  },
  {
    "id": "s2_boss_008",
    "familyId": "observable_sensor",
    "type": "boss",
    "difficulty": "normal",
    "claim": "ถ้ามีกล้องหลายตัว environment ต้อง fully observable",
    "counter": "ไม่เสมอ camera/sensor อาจยังมี blind spot และไม่รู้สถานะภายในทั้งหมด",
    "hint": "fully observable คือเห็น state ที่เกี่ยวข้องครบ",
    "why": "sensor มากไม่ได้แปลว่าเห็นครบ",
    "key": "observable_confusion"
  },
  {
    "id": "s2_boss_009",
    "familyId": "stochastic_random",
    "type": "boss",
    "difficulty": "normal",
    "claim": "stochastic แปลว่า agent ทำงานมั่วหรือ random",
    "counter": "ไม่ใช่ stochastic หมายถึงผลลัพธ์ของ environment มีความไม่แน่นอน",
    "hint": "แยก randomness ของ environment กับความผิดพลาดของ agent",
    "why": "agent อาจ rational ใน stochastic environment",
    "key": "stochastic_confusion"
  },
  {
    "id": "s2_boss_010",
    "familyId": "episodic_memory",
    "type": "boss",
    "difficulty": "hard",
    "claim": "episodic แปลว่า agent ไม่มี memory เสมอ",
    "counter": "ไม่เสมอ episodic หมายถึงแต่ละ episode ไม่ส่งผลต่อ episode ถัดไปใน task structure",
    "hint": "ดูความสัมพันธ์ระหว่างการตัดสินใจ",
    "why": "memory และ episodic ไม่ใช่คำเดียวกัน",
    "key": "episodic_confusion"
  },
  {
    "id": "s2_boss_011",
    "familyId": "peas_component",
    "type": "boss",
    "difficulty": "easy",
    "claim": "PEAS คือรายการ component ของระบบเท่านั้น",
    "counter": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่แค่ชื่ออุปกรณ์",
    "hint": "P/E/A/S มีหน้าที่ต่างกัน",
    "why": "component เช่น database/model ไม่ได้แทน PEAS โดยตรง",
    "key": "component_vs_peas"
  },
  {
    "id": "s2_boss_012",
    "familyId": "rule_agent",
    "type": "boss",
    "difficulty": "hard",
    "claim": "ระบบ rule-based ไม่สามารถเป็น agent ได้เลย",
    "counter": "ไม่ถูก simple reflex agent อาจ rule-based ได้ แต่ไม่จำเป็นต้องเป็น learning AI",
    "hint": "agent กับ learning AI คนละระดับแนวคิด",
    "why": "rule-based agent มีได้ แต่ความสามารถจำกัด",
    "key": "rulebased"
  },
  {
    "id": "s2_boss_013",
    "familyId": "ai_agent_same",
    "type": "boss",
    "difficulty": "normal",
    "claim": "AI และ intelligent agent เป็นคำเดียวกันทุกกรณี",
    "counter": "ไม่ถูก agent เป็นกรอบมองระบบที่รับรู้และกระทำ ส่วน AI กว้างกว่าและมีหลายวิธี",
    "hint": "อย่าสลับคำว่า AI กับ agent",
    "why": "agent เป็นหนึ่งใน framework สำคัญของ AI",
    "key": "ai_agent_confusion"
  },
  {
    "id": "s2_boss_014",
    "familyId": "static_software",
    "type": "boss",
    "difficulty": "normal",
    "claim": "ถ้าเป็น software environment ต้อง static",
    "counter": "ไม่ถูก software agent อาจอยู่ใน dynamic environment เช่น market หรือ social feed",
    "hint": "dynamic ดูว่า environment เปลี่ยนระหว่างตัดสินใจไหม",
    "why": "software ก็เจอ dynamic environment ได้",
    "key": "software_static_confusion"
  },
  {
    "id": "s2_boss_015",
    "familyId": "single_multi",
    "type": "boss",
    "difficulty": "hard",
    "claim": "ถ้าเราสนใจ agent ตัวเดียว task ต้องเป็น single-agent",
    "counter": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/action ส่งผลต่อกันก็เป็น multi-agent",
    "hint": "ดูว่ามี decision makers อื่นไหม",
    "why": "traffic, game, market มัก multi-agent",
    "key": "multiagent_confusion"
  },
  {
    "id": "s2_boss_016",
    "familyId": "sensor_agent_v",
    "type": "boss",
    "difficulty": "easy",
    "claim": "มีนักศึกษากล่าวว่า: ถ้าระบบมี sensor ก็เป็น intelligent agent แน่นอน",
    "counter": "ไม่เสมอไป sensor เป็นเพียงช่องทางรับ percept ต้องดูว่าระบบเลือก action เพื่อบรรลุ goal หรือไม่",
    "hint": "sensor อยู่ใน S ของ PEAS แต่ไม่ใช่ทั้งหมดของ agent",
    "why": "agent ต้องมี percept, action, goal/performance measure และการตัดสินใจ",
    "key": "sensor"
  },
  {
    "id": "s2_boss_017",
    "familyId": "performance_sensor_v",
    "type": "boss",
    "difficulty": "easy",
    "claim": "มีนักศึกษากล่าวว่า: Performance measure คือสิ่งที่ agent ใช้รับข้อมูลจากโลก",
    "counter": "ไม่ใช่ Performance measure คือเกณฑ์วัดความสำเร็จ ส่วนสิ่งที่รับข้อมูลคือ Sensors",
    "hint": "แยก P กับ S ใน PEAS",
    "why": "P ใช้วัดผลว่า agent ทำดีไหม ส่วน S คือช่องทางรับ percept",
    "key": "peas_swap"
  },
  {
    "id": "s2_boss_018",
    "familyId": "rational_best_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: Rational agent ต้องเลือก action ที่ดีที่สุดจริงเสมอ",
    "counter": "ไม่จำเป็นต้องดีที่สุดจริง แต่ควรเลือก action ที่คาดว่าจะดีที่สุดจาก percept และความรู้ที่มีในขณะนั้น",
    "hint": "rational ไม่ได้แปลว่า omniscient",
    "why": "rationality ขึ้นกับข้อมูล/ความรู้ที่ agent มี",
    "key": "rationality"
  },
  {
    "id": "s2_boss_019",
    "familyId": "dynamic_move_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: ถ้า environment เป็น dynamic แปลว่า agent ต้องเคลื่อนที่ได้เท่านั้น",
    "counter": "ไม่ใช่ dynamic หมายถึง environment เปลี่ยนระหว่างที่ agent กำลังตัดสินใจ",
    "hint": "dynamic คือสภาพแวดล้อมเปลี่ยน ไม่ใช่ตัว agent ขยับ",
    "why": "ตลาดหุ้นหรือ traffic เป็น dynamic แม้ agent เป็น software",
    "key": "dynamic_confusion"
  },
  {
    "id": "s2_boss_020",
    "familyId": "bigdata_rational_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: Agent ที่ใช้ข้อมูลเยอะย่อมเป็น rational agent เสมอ",
    "counter": "ไม่เสมอ ข้อมูลเยอะช่วยได้ แต่ rationality ขึ้นกับ action ที่คาดว่าดีที่สุดตาม goal/evidence",
    "hint": "ข้อมูลเยอะไม่พอ ต้องมี goal และการตัดสินใจที่เหมาะสม",
    "why": "big data ไม่ได้เท่ากับ rational decision โดยอัตโนมัติ",
    "key": "bigdata_rational"
  },
  {
    "id": "s2_boss_021",
    "familyId": "agent_robot_v",
    "type": "boss",
    "difficulty": "easy",
    "claim": "มีนักศึกษากล่าวว่า: agent ต้องเป็นหุ่นยนต์หรือมีร่างกายเท่านั้น",
    "counter": "ไม่ถูก agent อาจเป็นซอฟต์แวร์ได้ เช่น recommender หรือ spam filter",
    "hint": "agent = สิ่งที่รับ percept และกระทำ action",
    "why": "software agent เป็น agent ได้",
    "key": "robot_only"
  },
  {
    "id": "s2_boss_022",
    "familyId": "actuator_output_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: Actuator ต้องเป็นแขนกลหรือล้อเท่านั้น",
    "counter": "ไม่ถูก actuator คือช่องทางที่ agent ใช้กระทำ อาจเป็นข้อความ คำแนะนำ หรือการจัดอันดับ",
    "hint": "ดู action ของ agent ไม่ใช่รูปร่างอุปกรณ์",
    "why": "software actuator เช่น message, ranking, alert",
    "key": "actuator_confusion"
  },
  {
    "id": "s2_boss_023",
    "familyId": "observable_sensor_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: ถ้ามีกล้องหลายตัว environment ต้อง fully observable",
    "counter": "ไม่เสมอ camera/sensor อาจยังมี blind spot และไม่รู้สถานะภายในทั้งหมด",
    "hint": "fully observable คือเห็น state ที่เกี่ยวข้องครบ",
    "why": "sensor มากไม่ได้แปลว่าเห็นครบ",
    "key": "observable_confusion"
  },
  {
    "id": "s2_boss_024",
    "familyId": "stochastic_random_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: stochastic แปลว่า agent ทำงานมั่วหรือ random",
    "counter": "ไม่ใช่ stochastic หมายถึงผลลัพธ์ของ environment มีความไม่แน่นอน",
    "hint": "แยก randomness ของ environment กับความผิดพลาดของ agent",
    "why": "agent อาจ rational ใน stochastic environment",
    "key": "stochastic_confusion"
  },
  {
    "id": "s2_boss_025",
    "familyId": "episodic_memory_v",
    "type": "boss",
    "difficulty": "hard",
    "claim": "มีนักศึกษากล่าวว่า: episodic แปลว่า agent ไม่มี memory เสมอ",
    "counter": "ไม่เสมอ episodic หมายถึงแต่ละ episode ไม่ส่งผลต่อ episode ถัดไปใน task structure",
    "hint": "ดูความสัมพันธ์ระหว่างการตัดสินใจ",
    "why": "memory และ episodic ไม่ใช่คำเดียวกัน",
    "key": "episodic_confusion"
  },
  {
    "id": "s2_boss_026",
    "familyId": "peas_component_v",
    "type": "boss",
    "difficulty": "easy",
    "claim": "มีนักศึกษากล่าวว่า: PEAS คือรายการ component ของระบบเท่านั้น",
    "counter": "ไม่ถูก PEAS เป็นกรอบวิเคราะห์ task environment ไม่ใช่แค่ชื่ออุปกรณ์",
    "hint": "P/E/A/S มีหน้าที่ต่างกัน",
    "why": "component เช่น database/model ไม่ได้แทน PEAS โดยตรง",
    "key": "component_vs_peas"
  },
  {
    "id": "s2_boss_027",
    "familyId": "rule_agent_v",
    "type": "boss",
    "difficulty": "hard",
    "claim": "มีนักศึกษากล่าวว่า: ระบบ rule-based ไม่สามารถเป็น agent ได้เลย",
    "counter": "ไม่ถูก simple reflex agent อาจ rule-based ได้ แต่ไม่จำเป็นต้องเป็น learning AI",
    "hint": "agent กับ learning AI คนละระดับแนวคิด",
    "why": "rule-based agent มีได้ แต่ความสามารถจำกัด",
    "key": "rulebased"
  },
  {
    "id": "s2_boss_028",
    "familyId": "ai_agent_same_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: AI และ intelligent agent เป็นคำเดียวกันทุกกรณี",
    "counter": "ไม่ถูก agent เป็นกรอบมองระบบที่รับรู้และกระทำ ส่วน AI กว้างกว่าและมีหลายวิธี",
    "hint": "อย่าสลับคำว่า AI กับ agent",
    "why": "agent เป็นหนึ่งใน framework สำคัญของ AI",
    "key": "ai_agent_confusion"
  },
  {
    "id": "s2_boss_029",
    "familyId": "static_software_v",
    "type": "boss",
    "difficulty": "normal",
    "claim": "มีนักศึกษากล่าวว่า: ถ้าเป็น software environment ต้อง static",
    "counter": "ไม่ถูก software agent อาจอยู่ใน dynamic environment เช่น market หรือ social feed",
    "hint": "dynamic ดูว่า environment เปลี่ยนระหว่างตัดสินใจไหม",
    "why": "software ก็เจอ dynamic environment ได้",
    "key": "software_static_confusion"
  },
  {
    "id": "s2_boss_030",
    "familyId": "single_multi_v",
    "type": "boss",
    "difficulty": "hard",
    "claim": "มีนักศึกษากล่าวว่า: ถ้าเราสนใจ agent ตัวเดียว task ต้องเป็น single-agent",
    "counter": "ไม่ถูก ถ้ามี agent อื่นที่มีเป้าหมาย/action ส่งผลต่อกันก็เป็น multi-agent",
    "hint": "ดูว่ามี decision makers อื่นไหม",
    "why": "traffic, game, market มัก multi-agent",
    "key": "multiagent_confusion"
  }
];

  const REFLECTION_PROMPTS = [
  {
    "id": "s2_ref_001",
    "familyId": "agent",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "ยกตัวอย่างระบบ agent ในชีวิตจริงและอธิบาย percept/action/goal"
  },
  {
    "id": "s2_ref_002",
    "familyId": "peas",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "เลือกหนึ่งระบบแล้วเขียน PEAS ให้ครบ 4 ส่วน"
  },
  {
    "id": "s2_ref_003",
    "familyId": "environment",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "เปรียบเทียบ environment แบบ static กับ dynamic จากตัวอย่างจริง"
  },
  {
    "id": "s2_ref_004",
    "familyId": "rationality",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "อธิบายว่า rational agent ต่างจาก agent ที่เดาถูกโดยบังเอิญอย่างไร"
  },
  {
    "id": "s2_ref_005",
    "familyId": "misconception",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "ข้อใดที่คุณเคยเข้าใจผิดเกี่ยวกับ agent และแก้ความเข้าใจอย่างไร"
  },
  {
    "id": "s2_ref_006",
    "familyId": "project",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "นำแนวคิด intelligent agent ไปใช้กับ Mini Project ของคุณได้อย่างไร"
  },
  {
    "id": "s2_ref_007",
    "familyId": "sensor",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "sensor ต่างจาก intelligence อย่างไร"
  },
  {
    "id": "s2_ref_008",
    "familyId": "automation",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "ระบบ automation ใดที่ยังไม่ใช่ intelligent agent เพราะอะไร"
  },
  {
    "id": "s2_ref_009",
    "familyId": "software_agent",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "ยกตัวอย่าง software agent ที่ไม่มีหุ่นยนต์แต่เป็น agent ได้"
  },
  {
    "id": "s2_ref_010",
    "familyId": "performance",
    "type": "reflection",
    "difficulty": "normal",
    "prompt": "เขียน performance measure ที่ดีสำหรับ agent 1 ระบบ"
  },
  {
    "id": "s2_ref_011",
    "familyId": "agent",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "ยกตัวอย่างระบบ agent ในชีวิตจริงและอธิบาย percept/action/goal"
  },
  {
    "id": "s2_ref_012",
    "familyId": "peas",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "เลือกหนึ่งระบบแล้วเขียน PEAS ให้ครบ 4 ส่วน"
  },
  {
    "id": "s2_ref_013",
    "familyId": "environment",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "เปรียบเทียบ environment แบบ static กับ dynamic จากตัวอย่างจริง"
  },
  {
    "id": "s2_ref_014",
    "familyId": "rationality",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "อธิบายว่า rational agent ต่างจาก agent ที่เดาถูกโดยบังเอิญอย่างไร"
  },
  {
    "id": "s2_ref_015",
    "familyId": "misconception",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "ข้อใดที่คุณเคยเข้าใจผิดเกี่ยวกับ agent และแก้ความเข้าใจอย่างไร"
  },
  {
    "id": "s2_ref_016",
    "familyId": "project",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "นำแนวคิด intelligent agent ไปใช้กับ Mini Project ของคุณได้อย่างไร"
  },
  {
    "id": "s2_ref_017",
    "familyId": "sensor",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "sensor ต่างจาก intelligence อย่างไร"
  },
  {
    "id": "s2_ref_018",
    "familyId": "automation",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "ระบบ automation ใดที่ยังไม่ใช่ intelligent agent เพราะอะไร"
  },
  {
    "id": "s2_ref_019",
    "familyId": "software_agent",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "ยกตัวอย่าง software agent ที่ไม่มีหุ่นยนต์แต่เป็น agent ได้"
  },
  {
    "id": "s2_ref_020",
    "familyId": "performance",
    "type": "reflection",
    "difficulty": "challenge",
    "prompt": "เขียน performance measure ที่ดีสำหรับ agent 1 ระบบ"
  }
];

  const COUNTER_DISTRACTORS = [
    'ใช่เสมอ เพราะถ้ามีอุปกรณ์ดิจิทัลก็ถือว่าเป็น AI แล้ว',
    'ใช่เสมอ เพราะระบบอัตโนมัติทุกระบบคือ intelligent agent',
    'ไม่จำเป็นต้องมี goal หรือ performance measure ก็เป็น agent ได้',
    'ถ้าใช้คำว่า smart หรือ AI ในชื่อระบบ ก็ถือว่าเป็น rational agent แล้ว',
    'ถ้ามีข้อมูลมาก ระบบจะ rational เสมอ',
    'ถ้าเป็น software environment ต้อง static เสมอ'
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
    const history = readHistory().slice(0, RECENT_WINDOW);
    const itemIds = new Set();
    const familyIds = new Set();

    history.forEach(round => {
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

  function difficultyRank(value){
    return {easy:1, normal:2, hard:3, challenge:4}[value || 'normal'] || 2;
  }

  function difficultyFit(item, target){
    const t = difficultyRank(target);
    const r = difficultyRank(item.difficulty || 'normal');
    if(target === 'challenge') return true;
    if(target === 'easy') return r <= 2;
    if(target === 'normal') return r <= 3;
    return r <= t + 1;
  }

  function scoreCandidate(item, recent, usedFamilies, target){
    let score = 100;

    if(recent.itemIds.has(item.id)) score -= 70;
    if(recent.familyIds.has(item.familyId)) score -= 45;
    if(usedFamilies.has(item.familyId)) score -= 35;
    if(!difficultyFit(item, target)) score -= 25;

    const targetRank = difficultyRank(target);
    const itemRank = difficultyRank(item.difficulty || 'normal');
    score -= Math.abs(targetRank - itemRank) * 4;

    score += Math.random() * 10;
    return score;
  }

  function smartPick(items, n, target, usedFamilies){
    const recent = recentSets();
    const picked = [];
    const pool = items.slice();

    for(let i=0;i<n;i++){
      if(!pool.length) break;

      pool.sort((a,b) => scoreCandidate(b, recent, usedFamilies, target) - scoreCandidate(a, recent, usedFamilies, target));
      const bestScore = scoreCandidate(pool[0], recent, usedFamilies, target);
      const nearBest = pool.filter(item => scoreCandidate(item, recent, usedFamilies, target) >= bestScore - 8).slice(0, 8);
      const chosen = shuffle(nearBest)[0] || pool[0];

      picked.push(chosen);
      usedFamilies.add(chosen.familyId);
      pool.splice(pool.findIndex(item => item.id === chosen.id), 1);
    }

    return picked;
  }

  function buildSession2Round(difficulty){
    const diff = difficulty || 'normal';
    const counts = {
      easy:{agent:5, peas:3, env:3, boss:3},
      normal:{agent:7, peas:4, env:4, boss:4},
      hard:{agent:8, peas:5, env:5, boss:5},
      challenge:{agent:9, peas:5, env:5, boss:5}
    }[diff] || {agent:7, peas:4, env:4, boss:4};

    const usedFamilies = new Set();

    const agent = smartPick(AGENT_CARDS, counts.agent, diff, usedFamilies);
    const peas = smartPick(PEAS_ITEMS, counts.peas, diff, usedFamilies);
    const env = smartPick(ENV_ITEMS, counts.env, diff, usedFamilies);
    const boss = smartPick(BOSS_CLAIMS, counts.boss, diff, usedFamilies);
    const reflection = smartPick(REFLECTION_PROMPTS, 3, diff, usedFamilies);

    const itemIds = []
      .concat(agent, peas, env, boss, reflection)
      .map(item => item.id);

    const familyIds = []
      .concat(agent, peas, env, boss, reflection)
      .map(item => item.familyId);

    writeHistory({
      ts:new Date().toISOString(),
      difficulty:diff,
      itemIds,
      familyIds
    });

    return {
      version: VERSION,
      title:'Session 2: Intelligent Agent',
      phases:['Agent or Not','PEAS Builder','Environment Classifier','Rational Agent Boss'],
      agent,
      peas,
      env,
      boss,
      reflectionPrompts:reflection,
      distractors: COUNTER_DISTRACTORS.slice(),
      noRepeat:{
        recentWindow: RECENT_WINDOW,
        itemIds,
        familyIds
      }
    };
  }

  function resetSession2History(){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      delete all[profileKey()];
      localStorage.setItem(RECENT_KEY, JSON.stringify(all));
    }catch(error){}
  }

  window.AIQUEST_SESSION2_BANK = {
    VERSION,
    RECENT_KEY,
    RECENT_WINDOW,
    AGENT_CARDS,
    PEAS_ITEMS,
    ENV_ITEMS,
    BOSS_CLAIMS,
    REFLECTION_PROMPTS,
    COUNTER_DISTRACTORS,
    buildSession2Round,
    resetSession2History,
    counts:{
      agent:AGENT_CARDS.length,
      peas:PEAS_ITEMS.length,
      env:ENV_ITEMS.length,
      boss:BOSS_CLAIMS.length,
      reflection:REFLECTION_PROMPTS.length,
      total:AGENT_CARDS.length + PEAS_ITEMS.length + ENV_ITEMS.length + BOSS_CLAIMS.length + REFLECTION_PROMPTS.length
    }
  };

  window.buildSession2Round = buildSession2Round;

  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_SESSION2_BANK.counts);
})();
