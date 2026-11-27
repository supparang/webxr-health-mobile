# NutriLens TH — AI Nutrition Scanner (`ai-nutrition-scanner`)

Mobile-first Thai food nutrition scanner, GDA label logger, multi-dish meal planner, and 7-day tracker built as an isolated PWA module (zero changes to HeroHealth production runtime).

## Key Features
- **Mobile-first Thai UI & Client-side Auto-Compression**: Camera capture (`capture="environment"`), file upload/drag-and-drop, automatic browser Canvas image resize/compression for large phone photos (up to 25 MB raw → optimized JPEG), plus 3 real sample Thai dish presets.
- **Multi-dish / Combo Meal Tray (อาหารหลายเมนูใน 1 มื้อ)**: Combine scanned main dishes with Thai sides (e.g., ส้มตำไทย + ข้าวเหนียวนึ่ง + ไก่ย่าง) from a searchable 20-dish Thai catalog + custom entry, with per-item portion multipliers (`0.25×`–`4×`).
- **Barcode & Thai GDA Label Helper (บาร์โค้ด / ฉลากหวาน มัน เค็ม)**: Live camera barcode scanning (`BarcodeDetector` API where supported), manual EAN-13 lookup with 4 Thai packaged sample fixtures, interactive 4-capsule Thai GDA preview (`พลังงาน / น้ำตาล / ไขมัน / โซเดียม`), and direct user-entered label logging (`USER_ENTERED_GDA_LABEL`).
- **Age-Band Personal Goals & Allergen Alerts (ตั้งเป้าหมายตามวัยและสารก่อภูมิแพ้)**: Presets for ป.1–ป.3, ป.4–ป.6, ม.1–ม.6, Thai RDI Adult, and custom targets; optional Low-Sodium / Low-Sugar / High-Protein focus toggles; instant allergen alerts (`ถั่วลิสง`, `กุ้ง/อาหารทะเล`, `ไข่`, `นม`, `ถั่วเหลือง/กลูเตน`).
- **7-Day Trend SVG Chart, Inline History Edit, CSV Export & Offline PWA**: Local-only `localStorage` persistence, inline editing of saved meals, 7-day responsive SVG bar chart with goal threshold line, UTF-8 BOM CSV export (with formula-injection escaping), and offline-ready PWA (`manifest.webmanifest` + `sw.js`).
- **3-Arm Controlled Study Mode (ระบบ A / B / C สำหรับงานวิจัย)**:
  - **ระบบ A (Photo-Only)**: ใช้ภาพถ่ายอย่างเดียว (0 คำถาม) เพื่อวัดเวลาและความแม่นยำพื้นฐาน
  - **ระบบ B (Uncertainty-Adaptive)**: คำนวณความไม่แน่นอนและปัจจัยซ่อนเร้นอาหารไทย (น้ำมัน, ความหวาน, น้ำซุป, ไข่, หนังสัตว์, น้ำจิ้ม) เพื่อเลือกถามเฉพาะ **0–3 ข้อ** ที่กระทบโภชนาการมากที่สุด พร้อมตัวปรับค่าแบบตรวจสอบได้ (`initial_*` vs `final_*`)
  - **ระบบ C (Fixed Questionnaire)**: ถามชุดคำถามมาตรฐานคงที่ **5 ข้อทุกมื้อ** เพื่อควบคุมตัวแปรเปรียบเทียบ
  - รองรับ URL ล็อกเงื่อนไขสำหรับผู้เข้าร่วมทดลอง เช่น `?arm=B&pid=P01&session=S1&lock=1`, ตารางสรุปเปรียบเทียบ A/B/C แบบเรียลไทม์, แบบประเมินสั้น 1–5 ท้ายมื้อ, และส่งออก **Research CSV (A/B/C)** พร้อมคอลัมน์ Telemetry ครบถ้วนสำหรับ SPSS/R/Python
- **Structured AI Vision Server Mode (`server.mjs` + `vision.mjs`)**:
  - Pure Node.js 22 ESM HTTP server (zero external npm dependencies).
  - Magic-byte signature verification for JPEG/PNG/WebP, 5 MB payload guard, OpenAI Responses API **strict JSON Schema** (`additionalProperties: false`), explicit `matched` / `uncertain` / `not_food` outcomes, and safe refusal/error handling.
  - **Scientific Safety Invariant**: AI Vision mode **never** displays or exports unverified illustrative nutrient fixtures; it saves confirmed dish names, portions, and provenance (`AI_CLASSIFICATION_ONLY_NO_UNVERIFIED_NUTRIENTS`) until verified Thai FCD records are integrated.

## Running Locally

### 1. Static Demo / PWA Mode (no API key required)
```bash
python3 -m http.server 5500 --directory ai-nutrition-scanner
# Open http://127.0.0.1:5500/
```

### 2. Full Server Mode (Demo + GDA + `/api/analyze` AI Vision Gateway)
```bash
cd ai-nutrition-scanner
export OPENAI_API_KEY="sk-..."   # Optional
export OPENAI_MODEL="gpt-4.1-mini"
npm start
# Open http://127.0.0.1:8787/
```

## Automated Tests & QA
```bash
cd ai-nutrition-scanner
npm test
```

Playwright browser smoke test (Desktop 1280×800, Mobile 390×844, Compact Mobile 320×568):
```bash
cd ai-nutrition-scanner
npm run qa:browser
```

## Scientific & Deployment Notes
- GitHub Pages serves static files only and cannot run `/api/analyze`. The UI detects static hosting via `/api/health` automatically.
- Demo nutrient values are **illustrative fixtures for prototyping and educational UI testing**, not validated clinical measurements. See [`data/THAI_FCD_INTEGRATION.md`](./data/THAI_FCD_INTEGRATION.md) for the Thai FCD integration plan.
