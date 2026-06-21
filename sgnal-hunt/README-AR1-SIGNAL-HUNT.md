# UX Quest — AR-1 Signal Hunt Pilot

## สิ่งที่เพิ่มจาก Unit 1
- `ar/ar1-signal-hunt.html` — เกม AR Field Ops เล่นได้จริง
- โหมด Camera AR, Mock AR, Virtual Campus PC
- QR Mission Cards 4 สถานี: A–D
- Soft AR: กล้องเป็นพื้นหลัง + Portal overlay; ไม่พึ่ง WebXR/Hand Tracking
- 4 Station mini challenges + Team War Room + Individual Explain Check
- Field Score, Friction Pulse, 1–3 ดาว, DXP, Badge, Field Insight Token
- Local demo dashboard: `teacher/ar1-fieldops-dashboard.html`

## วิธีเปิด
1. เปิด `index.html` แล้วกด **ทดลอง AR Pilot**
2. หรือเปิด `ar/ar1-signal-hunt.html?preview=1`
3. สำหรับ Camera AR ให้ใช้ GitHub Pages / HTTPS หรือ `localhost` เพราะ browser จะไม่อนุญาตกล้องจาก `file://`
4. หาก QR scan ไม่รองรับ ให้ใช้ปุ่มเลือก Station ได้ทันที คะแนนเท่ากัน

## QR Mission Cards
เปิด `ar/ar1-mission-cards.html` แล้วพิมพ์หรือวางบนจอที่จุดกิจกรรมทั้ง 4 Station

## สถานะการใช้สอน
- Pilot นี้เป็น **AR Field Ops เสริมหลัง Week 3**
- ใช้ Mock/Virtual ได้ผลลัพธ์เท่ากันกับ Camera AR
- ยังไม่ได้เชื่อม Google Sheets / Apps Script; dashboard ใช้ LocalStorage ของ browser เพื่อทดสอบ gameplay ก่อน

## ลำดับต่อไป
1. ทดสอบ UX / pacing ของ AR-1 กับกลุ่มนักศึกษา
2. เชื่อม Student Context Bridge + Apps Script result receiver
3. สร้าง B1 Cognitive Storm รับ Field Insight Token
4. ขยาย AR-2 หลัง Week 7 เมื่อ AR-1 ผ่าน pilot criteria
