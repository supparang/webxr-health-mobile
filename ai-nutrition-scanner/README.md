# 🥗 AI Nutrition Scanner (Thai Food Nutrition & Clinical Insights)

ระบบประเมินพลังงานและสารอาหารจากภาพอาหารไทยด้วย **Google Gemini Vision AI** ร่วมกับฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย (**INMU Thai FCD & สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข**)

---

## ✨ ฟีเจอร์หลัก (Key Features)

1. **📸 วิเคราะห์ภาพถ่ายอาหารจริงด้วย Gemini Vision AI (`gemini-2.0-flash` / `gemini-1.5-flash`)**
   - รองรับทั้ง 30 เมนูอาหารไทยมาตรฐาน และอาหารทั่วไปทุกชนิด (`custom`)
   - แสดงส่วนประกอบในจานที่ AI มองเห็นจากภาพจริง (`detected_components`)
   - รองรับการถ่ายผ่านกล้องเว็บแคม/มือถือ, อัปโหลดไฟล์รูป, ปุ่มเมนูตัวอย่างด่วน 6 เมนู และแท็บค้นหาเมนูโดยตรง

2. **📚 ข้อมูลโภชนาการแม่นยำตามหลักวิชาการ 100%**
   - สมการพลังงานมาตรฐานสากล **FAO/WHO Atwater System**: $\text{พลังงาน (kcal)} = (\text{โปรตีน}\times 4) + (\text{คาร์โบไฮเดรต}\times 4) + (\text{ไขมัน}\times 9)$ ตรงกันทุกทศนิยม 100%
   - แสดงค่า **พลังงาน, โปรตีน, คาร์โบไฮเดรต, ไขมัน, โซเดียม (mg), น้ำตาล (g), ใยอาหาร (g), คอเลสเตอรอล (mg)** และ **วิตามิน/แร่ธาตุเด่น**
   - เทียบสัดส่วนร้อยละของปริมาณที่แนะนำต่อวัน (**% Thai RDI** ตามประกาศกระทรวงสาธารณสุข / กรมอนามัย และเกณฑ์น้ำตาล WHO)

3. **⚖️ เครื่องมือดูแลสุขภาพเฉพาะบุคคล**
   - **BMR & TDEE Calculator**: คำนวณพลังงานที่ควรได้รับต่อวันด้วยสมการ *Mifflin-St Jeor*
   - **Quick Portion & Add-ons**: ปรับขนาดจาน (`ครึ่งจาน 0.6x`, `จานปกติ 1.0x`, `พิเศษ 1.3x`) และกดเพิ่ม/ลดท็อปปิ้ง (`+ไข่ดาว`, `+ไข่ต้ม`, `ลดข้าวครึ่งหนึ่ง`, `ผัดน้ำ`, `ไม่ซดน้ำแกง ลดโซเดียม 45%`)
   - **สัญญาณไฟจราจร (หวาน-มัน-เค็ม)**, **โหมดแจ้งเตือนโรคประจำตัว (NCDs)**, **แนะนำเมนูทางเลือกสุขภาพ (Smart Healthy Swap)** และ **ส่งออกรายงานเป็นไฟล์ CSV (Excel)**

---

## 🚀 วิธีรันใช้งาน (Quick Start)

### วิธีที่ 1: รันด้วย Node.js (เสิร์ฟทั้ง Backend API + Frontend ในพอร์ตเดียว)
```bash
cd ai-nutrition-scanner
npm run build
npm start
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:8000`

### วิธีที่ 2: รันแยก Backend (Python FastAPI) และ Frontend (Vite Dev Server)
**Backend:**
```bash
cd ai-nutrition-scanner/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
**Frontend:**
```bash
cd ai-nutrition-scanner/frontend
npm install
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`
