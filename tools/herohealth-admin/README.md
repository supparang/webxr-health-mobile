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

## 5. Deploy Firestore Rules โดยไม่ต้องเปิด Firebase Console

Rules authority สำหรับ HeroHealth อยู่ที่:

```text
herohealth/firebase/roster-binding-progress-sandbox.rules
```

ไฟล์นี้อนุญาต Sandbox IDs `990014–990017` และ Teacher Custom Claim ตามนโยบายปัจจุบัน

รัน:

```bash
npm run deploy-rules
```

สคริปต์จะ:

1. ตรวจว่า `service-account.json` เป็นโปรเจกต์ `herohealth-learning`
2. ตรวจว่า Rules มี `990014–990017` ครบ
3. ตรวจ Teacher Custom Claim rule
4. ใช้ Firebase CLI deploy เฉพาะ `firestore:rules`
5. ไม่ deploy Functions, Hosting หรือ Storage

หาก Service Account อยู่ที่อื่น:

```bash
npm run deploy-rules -- --service-account=/absolute/path/key.json
```

เมื่อขึ้น:

```text
✅ Deploy Firestore Rules สำเร็จ
```

ให้เปิด HeroHealth Passport หรือ Student Sandbox Diagnostic ใหม่ แล้วทดสอบ `990015` ต่อทันที

## ความปลอดภัย

- ห้ามนำ `service-account.json` ขึ้น GitHub
- ห้ามวาง private key ในหน้าเว็บหรือ JavaScript ฝั่ง browser
- ห้ามใช้ client-side workaround เพื่อข้าม Firestore Rules
- หากสงสัยว่าคีย์รั่ว ให้ revoke/delete key ใน Google Cloud/Firebase IAM แล้วสร้างใหม่
