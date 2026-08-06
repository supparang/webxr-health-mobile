# HeroHealth Local Admin Tool

เครื่องมือนี้ใช้ตั้ง Firebase Custom Claim สำหรับบัญชีครู โดยรันบนเครื่อง Mac และไม่ต้องเปิด Google Cloud Free Trial หรือ Billing

## 1. ดาวน์โหลด Service Account

Firebase Console > Project settings > Service accounts > Generate new private key

เก็บไฟล์ JSON เป็น:

```text
tools/herohealth-admin/service-account.json
```

ไฟล์นี้ถูกระบุใน `.gitignore` แล้ว ห้าม commit หรือส่งให้บุคคลอื่น

## 2. ติดตั้งและรัน

จากโฟลเดอร์ repository:

```bash
cd tools/herohealth-admin
npm install
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

หากไฟล์ Service Account อยู่ที่อื่น:

```bash
npm run set-teacher -- --uid=USER_UID --service-account=/absolute/path/key.json
```

## 3. หลังตั้งสิทธิ์สำเร็จ

ออกจากระบบ HeroHealth Firebase Teacher Console แล้วเข้าสู่ระบบใหม่ เพื่อให้ Firebase ออก ID token ใหม่ที่มี Claims:

```json
{
  "heroHealthTeacher": true,
  "heroHealthRole": "teacher"
}
```

## ความปลอดภัย

- ห้ามนำ `service-account.json` ขึ้น GitHub
- ห้ามวาง private key ในหน้าเว็บหรือ JavaScript ฝั่ง browser
- หากสงสัยว่าคีย์รั่ว ให้ลบคีย์นั้นจาก Firebase/Google Cloud IAM และสร้างใหม่ทันที
