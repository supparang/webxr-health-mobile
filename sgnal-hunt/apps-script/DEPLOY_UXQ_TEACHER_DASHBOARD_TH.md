# UX Quest: เปิดใช้ Teacher Action Dashboard (ภาษาไทย)

เอกสารนี้ใช้กับ Apps Script ที่รับผลจาก UX Quest และเป็นตัวที่ deploy อยู่จริง

## ไฟล์ที่ต้องนำไปวางใน Apps Script

1. `UXQ_ANTI_GUESS_DASHBOARD_PATCH.gs`  
   ต้องมีอยู่ก่อน เพราะ `uxqGetTeacherActionView()` เรียก `uxqGetTeacherView()` จากไฟล์นี้

2. `UXQ_TEACHER_ACTION_DASHBOARD_PATCH.gs`  
   เวอร์ชันล่าสุดรองรับชื่อไทยและ W4:
   - listen → ฟังสัญญาณผู้ใช้
   - separate → แยกสิ่งที่เห็นจริง
   - insight → สกัดความเข้าใจเชิงลึก

3. `UXQ_TEACHER_ACTION_DASHBOARD_COMPONENT.html`

4. `UXQ_TEACHER_ACTION_DASHBOARD_CLIENT.html`

## จุดที่ต้อง include ในหน้า Teacher Dashboard หลัก

ใส่บรรทัดนี้ในไฟล์ HTML หน้า Dashboard หลัก ตรงตำแหน่งที่ต้องการแสดงแดชบอร์ด:

```html
<?!= include('UXQ_TEACHER_ACTION_DASHBOARD_COMPONENT'); ?>
```

> ต้องมีฟังก์ชัน `include(name)` ใน Code.gs อยู่แล้ว โดยปกติใช้รูปแบบนี้:

```javascript
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
```

## ขั้นตอน deploy

1. เปิด Apps Script ที่เชื่อมกับ URL receiver ของ UX Quest
2. วาง/อัปเดตไฟล์ทั้ง 4 รายการ
3. กด Save
4. Deploy → Manage deployments → เลือก Web app เดิม → Edit
5. เลือก **New version** แล้วกด Deploy
6. เปิด Teacher Dashboard ใหม่แบบ hard refresh

## เช็กรายการหลัง deploy

- [ ] W1 แสดงชื่อ “นักสืบปัญหา UX”
- [ ] W2 แสดงชื่อ “คิดเชิงออกแบบ”
- [ ] W3 แสดงชื่อ “ลดภาระความคิด”
- [ ] B1 แสดงชื่อ “บอสพายุความสับสน”
- [ ] W4 แสดงชื่อ “ห้องแล็บถอดรหัสผู้ใช้”
- [ ] กด “ดูเหตุผล” แล้วเห็นคำตอบ/เหตุผลของผู้เรียนรายบุคคล
- [ ] กลุ่ม “รูปแบบที่พบในชั้นเรียน” ไม่มีรายชื่อผู้เรียน
- [ ] W4 stage แสดงไทย: ฟังสัญญาณผู้ใช้ / แยกสิ่งที่เห็นจริง / สกัดความเข้าใจเชิงลึก
- [ ] ลองเล่นจริงอย่างน้อย 1 รอบด้วย `?classroom=1&section=101`
- [ ] ผลการเล่นใหม่ขึ้นใน Dashboard

## ข้อควรระวัง

- การอัปเดตไฟล์ใน GitHub ไม่ทำให้ Apps Script ที่ deploy อยู่เปลี่ยนเอง
- ห้ามใช้ `fresh=1` กับการทดสอบเส้นทางที่ต้องการเก็บความก้าวหน้า W1 → W4 เพราะจะล้างเฉพาะข้อมูลในเบราว์เซอร์
- Patch นี้เป็น read-only สำหรับแดชบอร์ด: ไม่แก้คะแนน ดาว หรือการปลดล็อกของผู้เรียน
