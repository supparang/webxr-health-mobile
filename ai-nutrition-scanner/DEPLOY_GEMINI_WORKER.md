# คู่มือเปิดใช้งาน Gemini Vision AI กลาง (ตั้งค่าครั้งเดียว ใช้ได้ทุกเครื่อง)

คู่มือนี้ช่วยให้คุณใส่ `GEMINI_API_KEY` **แค่ครั้งเดียวบน Cloudflare Workers** (ฟรี 100,000 requests/วัน) แล้วมือถือ/คอมพิวเตอร์ทุกเครื่องที่เปิดเว็บ `ai-nutrition-scanner` บน GitHub Pages จะสแกนรูปอาหารทุกชนิดได้ทันที **โดยไม่ต้องกรอก API Key บนเครื่องผู้ใช้ และไม่ต้องมี Login รายบุคคล**

---

## ขั้นตอนที่ 1: ขอ Gemini API Key (ฟรี)
1. ไปที่ Google AI Studio (`https://aistudio.google.com/apikey`)
2. กด **Create API key** แล้วคัดลอกเก็บไว้ (ห้ามนำ Key นี้ไปวางในไฟล์ HTML/JS บน GitHub)

---

## ขั้นตอนที่ 2: Deploy Cloudflare Worker (ใช้เวลา ~3 นาที)
เปิด Terminal ในโฟลเดอร์ `ai-nutrition-scanner/worker`:

```bash
cd ai-nutrition-scanner/worker

# 1. ล็อกอิน Cloudflare ครั้งแรก
npx wrangler login

# 2. บันทึก Gemini API Key เป็น Secret ฝั่งเซิร์ฟเวอร์ (ตั้งค่าครั้งเดียว)
npx wrangler secret put GEMINI_API_KEY

# 3. (แนะนำสำหรับงานวิจัย/ห้องเรียน) ตั้งรหัสรอบทดลองแทน Login รายบุคคล
#    เช่น พิมพ์ NUTRI2026 — ถ้าอยากเปิดให้ใช้โดยไม่ต้องกรอกรหัส ข้ามขั้นนี้ได้
npx wrangler secret put STUDY_ACCESS_CODE

# 4. Deploy Worker ขึ้นระบบจริง
npx wrangler deploy
```

หลังรันคำสั่งสุดท้าย Wrangler จะแสดง URL ของ Backend เช่น:
`https://nutrilens-th-api.<your-subdomain>.workers.dev`

ทดสอบว่าพร้อมใช้งาน:
```bash
curl https://nutrilens-th-api.<your-subdomain>.workers.dev/api/health
# จะได้ {"ok":true,"aiConfigured":true,"provider":"gemini","model":"gemini-2.5-flash","openVocabulary":true,...}
```

---

## ขั้นตอนที่ 3: ผูก URL กลางเข้ากับหน้าเว็บ GitHub Pages (แก้ 1 บรรทัด)
เปิดไฟล์ [`ai-nutrition-scanner/config.js`](./config.js) แล้วใส่ URL Worker (เป็น URL สาธารณะ ไม่ใช่ Secret):

```js
export const APP_CONFIG = Object.freeze({
  DEFAULT_AI_API_BASE: 'https://nutrilens-th-api.<your-subdomain>.workers.dev',
});
```

จากนั้น `git commit` และ `git push` ขึ้น `main` — ทุกเครื่องที่เปิดหน้าเว็บ GitHub Pages จะเห็นสถานะ **`Gemini AI พร้อมใช้งาน`** และสแกนอาหารทุกชนิดได้ทันที!

---

## วิธีส่งลิงก์ / QR Code ให้ผู้เข้าร่วมวิจัย A / B / C (ไม่ต้องมี Login)
สามารถฝังกลุ่มทดลอง, รหัสผู้เข้าร่วม และรหัสรอบทดลองลงในลิงก์ได้เลย เช่น:

- ระบบ A: `https://supparang.github.io/webxr-health-mobile/ai-nutrition-scanner/?arm=A&pid=P01&code=NUTRI2026&lock=1`
- ระบบ B: `https://supparang.github.io/webxr-health-mobile/ai-nutrition-scanner/?arm=B&pid=P01&code=NUTRI2026&lock=1`
- ระบบ C: `https://supparang.github.io/webxr-health-mobile/ai-nutrition-scanner/?arm=C&pid=P01&code=NUTRI2026&lock=1`

*(หรือหากยังไม่ได้แก้ `config.js` สามารถทดสอบส่ง `?api=https://nutrilens-th-api.<your-subdomain>.workers.dev` ผ่าน URL ได้ทันทีเช่นกัน)*

---

## การควบคุมงบประมาณและความปลอดภัยที่มีให้แล้ว
- **Secret Isolation**: `GEMINI_API_KEY` อยู่ใน Cloudflare Secrets เท่านั้น ไม่มีวันหลุดไปยังเบราว์เซอร์
- **Study Access Code**: กันบุคคลภายนอกเข้ามายิง API โดยไม่ต้องทำระบบสมัครสมาชิก/รหัสผ่าน
- **Rate Limit**: จำกัดเริ่มต้น 15 ครั้ง/นาทีต่อ IP (ปรับได้ใน `worker/wrangler.toml` ที่ `RATE_LIMIT_MAX_PER_MIN`)
- **CORS Allowlist**: จำกัดโดเมนที่เรียกใช้ได้ใน `ALLOWED_ORIGINS`
- **Magic-Byte & 5 MB Guard**: ตรวจลายเซ็นไฟล์ JPEG/PNG/WebP จริงก่อนส่งให้ Gemini เสมอ
