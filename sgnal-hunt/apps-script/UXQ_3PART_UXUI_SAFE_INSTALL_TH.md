# CSAI2601 – ติดตั้งกฎปลดล็อก 3/3 ใน uxui แบบไม่แตะข้อมูลเดิม

**สถานะ: คู่มือเตรียมติดตั้งเท่านั้น ยังไม่ใช่การ Deploy จริง**

โครงการ Apps Script ที่ใช้งานจริงชื่อ `uxui` มี `UXQuestUnifiedReceiver-v4.2.gs` และ `UXQuestStudioConfirmationProductionPatch-v2.gs` อยู่แล้ว การแก้ต้องคง `doGet(e)`, `doPost(e)` ของเดิมเพียงชุดเดียว และไม่แทนที่ด้วยไฟล์ `UXQuestStudentReceiver-v4-Artifacts.gs` (ไฟล์นั้นเป็น Receiver แบบ standalone)

## ก่อนแก้: สำรองโดยไม่ลบหรือปรับค่าประวัตินักศึกษา

1. บันทึกเวอร์ชันการ Deploy เดิมของ `uxui` และสำรองโค้ดไว้
2. ทำสำเนา Google Sheets สำหรับทดสอบ **คนละไฟล์** กับชีตนักศึกษาจริง
3. ติดตั้งใน **STAGING** ก่อน; อย่า Deploy ใหม่ใน Production ก่อนทดสอบครบ
4. หากยังไม่ได้ยืนยันว่าเวอร์ชัน Google Apps Script ที่เปิดอยู่ตรงกับตัวอย่างนี้ ให้ตรวจจุดแทรกใน Editor ก่อนบันทึก

## จุดที่ 1 — เพิ่มไฟล์ใหม่ใน uxui/STAGING

สร้างไฟล์สคริปต์ `UXQuestThreePartWriteGate-v1.gs` และวางทั้งไฟล์จาก:

https://github.com/supparang/webxr-health-mobile/blob/feat/csai2601-enforce-three-part-unlock-20261021/sgnal-hunt/apps-script/UXQuestThreePartWriteGate-v1.gs

ไม่มี `doGet` และ `doPost` ในไฟล์นี้ จึงไม่ชนชื่อ Entry Point เดิม

## จุดที่ 2 — แทรกตัวตรวจใน Receiver เดิม

ในไฟล์ `UXQuestUnifiedReceiver-v4.2.gs` ให้ค้นหา *ภายใน* `function UXQ_receivePost_(e)` ช่วงต่อไปนี้:

~~~javascript
const sheet = UXQ_getAttemptsSheet_();
if (UXQ_hasEvent_(sheet, row.eventId, row.eventType)) {
  cache.put(cacheKey, '1', 21600);
  return UXQ_response_(row, true);
}

UXQ_appendRow_(sheet, row);
~~~

**แทรกโค้ดนี้หลังวงเล็บปีกกาปิดของการตรวจซ้ำและก่อน `UXQ_appendRow_` เท่านั้น**:

~~~javascript
// Validate new events only. Never edit or delete existing rows.
// Preserve the unified Receiver's eventId + eventType deduplication.
if (typeof UXQ_WG_check_ !== 'function') {
  return UXQ_json_({ok:false,error:'three_part_write_gate_not_installed'});
}
const gate = UXQ_WG_check_(sheet,row);
if (!gate.ok) {
  return UXQ_json_({
    ok:false,error:gate.error || 'three_part_node_locked',
    blockedBy:gate.blockedBy || '',
    missing:gate.missing || '',
    missionId:row.missionId
  });
}
~~~

ห้ามลบ `UXQ_appendRow_` เพราะยังต้องรับข้อมูลใหม่เมื่อผ่านเกณฑ์

## จุดที่ 3 — แก้เส้นทางอ่าน Studio ใน doGet

ติดตั้งไฟล์ `UXQuestStudioConfirmationProductionPatch-v2.gs` เวอร์ชันใหม่จาก:

https://github.com/supparang/webxr-health-mobile/blob/feat/csai2601-enforce-three-part-unlock-20261021/sgnal-hunt/apps-script/UXQuestStudioConfirmationProductionPatch-v2.gs

จากนั้นใน `UXQuestUnifiedReceiver-v4.2.gs` ให้ค้นหา `function doGet(e)` แล้วหา:

~~~javascript
const hasIdentity =
  Boolean(String(p.studentId || '').trim()) &&
  Boolean(String(p.section || '').trim());
~~~

**แทรกหลังบล็อก `hasIdentity` และก่อนเงื่อนไข `if (progressActions.indexOf(action) !== -1 || hasIdentity)`**:

~~~javascript
const studioResponse = UXQ_routeStudioConfirmationV2_(e);
if (studioResponse) return studioResponse;
~~~

ต้องอ่าน Studio ก่อน fallback เพราะคำขอ Studio ก็มี `studentId` และ `section`

## จุดที่ 4 — ทดสอบบนสำเนาชีต

- นักศึกษาใหม่ทำ W1 Mission ผ่าน 2 ดาว: บันทึกได้
- นักศึกษาคนเดียวกันส่ง W2 ก่อนส่ง Studio ของ W1: ถูกปฏิเสธ (`three_part_node_locked`)
- ส่ง Studio W1 แต่ Reflection ว่าง: W2 ยังคงล็อก
- ส่ง Studio + Reflection ที่เขียนจริง: W2 จึงเปิด
- บันทึกเหตุการณ์ซ้ำด้วย `eventId + eventType` เดิม: ไม่เกิดแถวซ้ำ
- ไม่เอาคะแนนและหลักฐานของนักศึกษาคนอื่น หรือ Section 101 ไปเปิด Section 201
- ลองกรณี timestamp ของเครื่องผู้เรียนไม่ตรงเวลา: **รายการ Studio ที่บันทึกลงชีตล่าสุด** ต้องกำหนดสถานะ Reflection ล่าสุด
- จำนวนแถวเดิมและข้อมูลเดิมบนชีต Production ต้องไม่เปลี่ยนขณะทดสอบ

ไม่ใช่แค่ดู HTTP `ok:true` เท่านั้น ต้องตรวจข้อความ `blockedBy`, `missing` และผล GET Studio ว่าตรงกับข้อมูลจำลองด้วย

## ลำดับนำขึ้นจริง

1. ทดสอบ STAGING ผ่าน
2. อัปเดตโค้ดฝั่ง `uxui` Production เป็น New version โดยรักษา Deployment ID และสิทธิ์เดิม
3. ยืนยัน Production GET Studio และการรับ POST โดยใช้วิธีทดสอบที่ไม่ทำลายข้อมูล
4. ค่อย Merge PR #170 เพื่อเปิดกฎใหม่ในหน้าเกม GitHub Pages
5. อัปเดตหน้าอาจารย์ `UXQuest-Teacher-Progress` แยกต่างหาก

**ห้าม Merge PR #170 ก่อนข้อ 1–3 สำเร็จ** มิฉะนั้นนักศึกษาอาจติดล็อก แม้มีงานครบอยู่แล้ว

ข้อมูลเก่าไม่ถูกแก้ ลบ ย้าย เขียนทับ หรือคำนวณคะแนนย้อนหลัง กฎใหม่นี้ใช้กับ **การส่งเหตุการณ์ใหม่** เท่านั้น ประวัติที่ส่งมาก่อนหน้านี้ยังใช้ตรวจย้อนหลังได้ แต่จะไม่นับข้อความ Reflection ที่ระบบเติมอัตโนมัติว่าเป็นการเขียนของนักศึกษา

**ข้อควรระวัง:** เอกสารนี้ทำจากไฟล์ `UXQuestUnifiedReceiver-v4.2-LATEST.gs` ที่เคยให้ไว้ ไม่ใช่การดึงโค้ดสดจาก Google Apps Script; หากโค้ด `uxui` เปลี่ยนภายหลัง ให้เทียบจุดแทรกก่อนทำตาม


## ผลตรวจเพิ่มเติม: ป้องกันข้อมูลเก่าจากการย้าย Section สูญหายจากการคำนวณ

Receiver v4.2 เดิมมีรายการ `UXQ_PROGRESS_SECTION_ALIASES` ที่ให้ **เฉพาะนักศึกษาบางคน** อ่านประวัติจาก Section เก่าได้ตามที่กำหนดไว้อย่างชัดเจน

โค้ด 3/3 ล่าสุดอ้างอิงรายการนี้เฉพาะนักศึกษาที่ได้รับการยกเว้นอยู่แล้ว ทั้งใน Studio Confirmation และ Write Gate จึงไม่ต้องย้าย แก้ หรือคัดลอกข้อมูลเก่าไป Section ใหม่ ทั้งนี้ **ไม่ใช่การรวม Section 101 และ 201 ทั้งชั้นเรียน**

คำเตือน: หน้า Private Teacher Progress โครงการแยกต่างหากยังกรอง Section แบบตรงตัว จึงอาจนับจำนวนต่างจาก Receiver ที่มีข้อยกเว้นเดิม ต้องตรวจข้อมูลก่อนใช้ตัดสินคะแนนรายบุคคล

การส่ง Studio ใช้ **แถวที่เพิ่มลงชีตล่าสุด** เป็นหลักฐาน Reflection ที่มีผลล่าสุด ไม่อิงเวลาในเครื่องนักศึกษาที่อาจคลาดเคลื่อน
