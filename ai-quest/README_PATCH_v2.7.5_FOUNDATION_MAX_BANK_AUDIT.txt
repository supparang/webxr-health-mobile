CSAI2102 AI Quest — PATCH v2.7.5 Foundation Max Bank Audit
===============================================================

เป้าหมาย
--------
ทำฐานก่อน S4 ให้แน่นที่สุด: S1, S2, B1, S3

สิ่งที่เพิ่ม/แก้
----------------
1. S1 Max Bank ใหม่
   - Card Rush: 94 items
   - Trick Cards: 74 items
   - Explain Strike: 80 items
   - Mini Boss: 64 items
   - มี no-repeat item/family window 8

2. S2 Quality Audit
   - ใช้ bank เดิมที่ใหญ่อยู่แล้ว
   - เพิ่ม wrapper ตรวจ/normalize boss reasoning options ให้เดายากขึ้น

3. B1 Quality Audit
   - ใช้ B1 bank 240 claims เดิม
   - normalize answer/distractor ให้เป็น concept reason ไม่ใช่เดาจากคำว่า ถูก/ไม่ถูก หรือข้อที่ยาวกว่า

4. S3 Max Bank + Trace Generator
   - State Space: 72 items
   - Graph Seeds: 60 maps
   - BFS/DFS Trace + Frontier + Maze Path: generated 240 tasks โดยประมาณ
   - Search Boss: 60 claims
   - รวม effective S3 bank ประมาณ 372 tasks

5. Foundation Quality Audit Tool
   - aiquest-foundation-quality-audit-v275.js
   - console ตรวจนับได้ด้วย AIQUEST_FOUNDATION_AUDIT_V275.counts()
   - reset history ได้ด้วย AIQUEST_FOUNDATION_AUDIT_V275.resetAll()

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy Apps Script เป็น version ใหม่
4. เปิด:
   /ai-quest/index.html?v=20260612-maxfound275

ตรวจสอบ
--------
Console:
AIQUEST_MISSION1_BANK.counts
AIQUEST_SESSION2_BANK.counts
AIQUEST_BOSS1_BANK.counts
AIQUEST_SEARCH3_BANK.counts
AIQUEST_FOUNDATION_AUDIT_V275.counts()

Production Checklist ต้องเป็น Server v2.7.5
