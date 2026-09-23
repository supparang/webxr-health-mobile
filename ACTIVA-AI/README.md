# ACTIVA-AI Prototype V0.1

ต้นแบบเชิงวิจัยของระบบตรวจสอบหลักฐานการเข้าร่วมกิจกรรมของบุคลากรแบบหลายแหล่ง (Multi-Source Evidence Verification)

## สิ่งที่ทำได้ใน V0.1
- Login แบบบัญชีทดลอง
- จัดการกิจกรรม
- กำหนด Evidence Policy รายกิจกรรม
- Dynamic Event QR แบบ expiring token
- Check-in / Check-out
- Staff Verification
- Evidence Matrix และ rule-based consistency checks
- Human Review
- Audit Trail
- ส่งออก research dataset เป็น CSV/JSON

## บัญชีทดลอง
- ADM001 ผู้ดูแลระบบ
- ORG001 ผู้จัดกิจกรรม
- STF001 เจ้าหน้าที่ตรวจสอบ
- P001 ผู้เข้าร่วม

รหัสผ่านในต้นแบบใช้คำว่า demo หรือค่าใดก็ได้ เพราะ V0.1 ยังไม่เชื่อมระบบยืนยันตัวตนจริง

## การเปิดใช้งาน
เปิดไฟล์ ACTIVA-AI/index.html ผ่าน GitHub Pages หรือ static web server

## ข้อจำกัดสำคัญ
V0.1 เป็น research prototype:
- ใช้ localStorage แทนฐานข้อมูลกลาง
- token signature เป็นกลไกจำลอง ไม่ใช่ cryptographic signing สำหรับ production
- rule-based flags ไม่ใช่ AI risk probability
- ยังไม่มี production authentication, authorization, encryption-at-rest, server-side audit protection หรือ institutional SSO

## Roadmap
V0.2:
- PostgreSQL + server-side API
- signed QR token ฝั่งเซิร์ฟเวอร์
- ground-truth workflow
- anomaly/risk model
- XAI explanation
- model/version logging

V0.3:
- แบบประเมิน SEM: SQ, ET, EX, PR, PU, TR, BI
- dashboard งานวิจัย
- export สำหรับ PLS-SEM/CB-SEM
