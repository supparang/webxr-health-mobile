CSAI2102 AI Quest — PATCH v3.2.2 Roadmap B2 Native

ปัญหา:
กดการ์ด B2 จากหน้ารวม Session/Roadmap ไม่เข้าเกม
เพราะ aiquest-session-roadmap เดิมเปิด Boss native เฉพาะ B1:
- if(id === 'b1') startMission('b1')
- B2 ถูก toast ว่า Boss นี้ยังไม่เปิดใน patch ปัจจุบัน

แก้:
1) แก้ aiquest-session-roadmap-v322.js
2) Boss native entry รองรับทั้ง B1 และ B2:
   if(id === 'b1' || id === 'b2') startMission(id)
3) card onclick ใน Roadmap preventDefault/stopPropagation แล้ว startByRoadmapId
4) expose AIQuestRoadmap.startByRoadmapId สำหรับ debug
5) B2 Submit Return Fix และ B2 Specific Bank ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?v=20260612-roadmapb2322

ทดสอบ:
- กดการ์ด B2 Search Arena Boss จาก Roadmap ต้องเข้าเกมทันที
- Console test:
  AIQuestRoadmap.startByRoadmapId('b2')
