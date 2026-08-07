# HeroHealth Local Admin Tool

เครื่องมือนี้ใช้ดูแลงาน Firebase Admin ของ HeroHealth บนเครื่อง Mac/PC โดยไม่ต้องเปิด Firebase Console ตลอดเวลา

## 1. Service Account

ใช้ Service Account ของโปรเจกต์:

```text
herohealth-learning
```

วางไฟล์ JSON เป็น:

```text
tools/herohealth-admin/service-account.json
```

ไฟล์นี้ถูกระบุใน `.gitignore` แล้ว ห้าม commit หรือส่งให้บุคคลอื่น

## 2. ติดตั้ง dependencies

จากโฟลเดอร์ repository:

```bash
cd tools/herohealth-admin
npm install
```

## 3. ตั้ง Teacher Custom Claim

```bash
npm run set-teacher
```

ค่าเริ่มต้นจะตั้งสิทธิ์ให้ UID:

```text
5y8Y499FzyZYK7aJaCf3SHjnaMD2
```

หากต้องการใช้ UID อื่น:

```bash
npm run set-teacher -- --uid=USER_UID
```

หลังตั้งสิทธิ์ ให้ Logout/Login Teacher Console ใหม่เพื่อรับ ID token ที่มี:

```json
{
  "heroHealthTeacher": true,
  "heroHealthRole": "teacher"
}
```

## 4. Seed Sandbox Students

รหัส QA ที่ระบบรองรับ:

```text
990014
990015
990016
990017
```

หากต้อง seed ใหม่:

```bash
npm run seed-sandbox-students
```

## 5. Additive Firestore Rules Repair โดยไม่ต้องเปิด Firebase Console

ใช้เมื่อ Sandbox เช่น `990015–990017` มีข้อมูลอยู่แล้ว แต่ browser ได้ `Missing or insufficient permissions` หรือ Teacher claim เป็น TRUE แต่ Production read ถูกปฏิเสธ

รัน:

```bash
npm run deploy-rules
```

คำสั่งนี้ **ไม่เอาไฟล์ rules ใน repo ไปทับ Production ทั้งชุด** แต่ทำงานแบบ additive ดังนี้:

1. ใช้ Service Account อ่าน Firestore Rules ที่กำลังใช้งานจริงจาก Firebase Rules API
2. สำรอง source เดิมไว้ใน temporary directory ของเครื่องก่อนทุกครั้ง
3. เติมเฉพาะ match blocks สำหรับ Sandbox IDs `990014–990017`
4. เติม Teacher read access สำหรับ `students`, `studentProgress`, `studentAssessments`
5. คง Production learner read/write rules เดิมทั้งหมดไว้
6. สร้าง ruleset ใหม่เพื่อให้ Firebase validate syntax/semantics ก่อน
7. เมื่อ validation ผ่าน จึงสลับ Firestore release ไป ruleset ใหม่
8. ถ้า validation หรือ publish ล้มเหลว จะไม่แก้ source เดิมใน repo และจะแสดง ruleset เดิม/backup ให้ตรวจได้

สคริปต์ใช้ marker:

```text
HEROHEALTH_ADDITIVE_ACCESS_R2
```

จึงไม่เติม block ซ้ำหากเคย repair แล้ว

หาก Service Account อยู่ที่อื่น:

```bash
npm run deploy-rules -- --service-account=/absolute/path/key.json
```

เมื่อสำเร็จจะขึ้น:

```text
✅ HeroHealth Firestore Rules additive patch สำเร็จ
```

จากนั้นให้เปิด HeroHealth Student Sandbox Diagnostic หรือ Passport ใหม่ แล้วทดสอบ `990015` ต่อทันที

## 6. Rules examples ใน repo

ไฟล์ต่อไปนี้เป็น reference/test rules เท่านั้น ไม่ควร deploy ทับ live Production โดยตรง:

```text
herohealth/firebase/roster-binding-progress-sandbox.rules
herohealth/firebase/teacher-participant-report.rules.example
```

Production rules authority คือ ruleset ที่ถูก release อยู่บน Firebase; `deploy-rules` จะอ่าน source นั้นก่อนแล้ว patch แบบ additive

## ความปลอดภัย

- ห้ามนำ `service-account.json` ขึ้น GitHub
- ห้ามวาง private key ในหน้าเว็บหรือ JavaScript ฝั่ง browser
- ห้ามใช้ client-side workaround เพื่อข้าม Firestore Rules
- ห้าม deploy sandbox example rules ทับ Production ทั้งชุด
- หากสงสัยว่าคีย์รั่ว ให้ revoke/delete key ใน Google Cloud/Firebase IAM แล้วสร้างใหม่
