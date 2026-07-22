# HeroHealth Learning Platform — Phase 1 Production Prototype

## สิ่งที่มีในชุดนี้
- Student Portal
- Hero Passport
- Mission Flow: Pre-test → 3 Zones → Post-test → Reflection
- Station Rotation สำหรับกลุ่ม A–C
- Classroom Screen พร้อมตัวจับเวลา
- Teacher Control สำหรับเริ่ม/พัก/เปลี่ยนฐาน
- Config กลางสำหรับผูก path เกมเดิม

## วิธีเปิด
1. แตก ZIP
2. เปิด `index.html` ผ่าน local web server
3. ตัวอย่าง:
   - Python: `python3 -m http.server 8080`
   - เข้า `http://localhost:8080`

## จุดที่ต้องแก้เพื่อเชื่อมเกมจริง
แก้เฉพาะ `data/platform-config.js`

```js
gameUrl: "../hygiene/hub.html"
gameUrl: "../nutrition/hub.html"
gameUrl: "../fitness/hub.html"
```

ให้ตรงกับ path ใน repo จริง

## สถานะข้อมูล
ต้นแบบนี้ใช้ localStorage สำหรับ UI prototype เท่านั้น  
ยังไม่ใช้เป็นข้อมูลทางการ และยังไม่ปลดล็อกด้วยข้อมูลจาก Google Sheet

## Production Contract ที่ควรใช้เมื่อเชื่อม Backend
- identity = studentId + section
- Google Sheet/backend เป็น source of truth
- localStorage ใช้เฉพาะ profile cache, draft และ unsynced queue
- เกมต้องส่ง `session_start`, `game_complete`, `station_complete`
- Platform อ่านสถานะที่ผ่านการยืนยันจาก backend ก่อนปลดล็อกภารกิจถัดไป
- ทุก event มี `eventId`, `clientTs`, `serverTs`, `version`, `deviceId`
- รองรับ duplicate guard, offline queue และ retry

## ลำดับงานต่อ
1. ใส่ path repo จริง
2. เชื่อม callback จากเกมกลับ Platform
3. ทำ Classroom Mode ในเกมให้จบใน 3–4 นาที
4. QA บนมือถือและ PC
5. เชื่อม Google Sheet/Backend เป็นขั้นตอนสุดท้าย
