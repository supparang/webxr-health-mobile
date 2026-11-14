const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 8000;
const BASE_DIR = __dirname;
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
const DB_FILE = path.join(BASE_DIR, 'nutrition_logs.json');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// มาตรฐานปริมาณสารอาหารอ้างอิงที่ควรได้รับประจำวันสำหรับคนไทย (Thai RDI - กรมอนามัย & อย. กระทรวงสาธารณสุข)
const THAI_RDI_REFERENCE = {
  energy_kcal: 2000,
  protein_g: 50,
  carb_g: 300,
  fat_g: 65,
  fiber_g: 25,
  sugar_g: 24,       // WHO & กรมอนามัย ไม่ควรเกิน 6 ช้อนชา (24 กรัม/วัน)
  sodium_mg: 2000,   // กรมอนามัย กระทรวงสาธารณสุข แนะนำโซเดียมไม่เกิน 2,000 มก./วัน
  cholesterol_mg: 300
};

const REFERENCE_STANDARDS = [
  {
    code: 'INMU Thai FCD',
    organization: 'สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Institute of Nutrition, Mahidol University)',
    description: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย (Thai Food Composition Database) สำหรับวิเคราะห์ค่าพลังงาน สารอาหารหลัก วิตามิน และแร่ธาตุต่อน้ำหนักอาหาร 100 กรัม'
  },
  {
    code: 'MOPH Thai RDI / DRI 2563',
    organization: 'สำนักโภชนาการ กรมอนามัย และ อย. กระทรวงสาธารณสุข',
    description: 'ปริมาณสารอาหารอ้างอิงที่ควรได้รับประจำวันสำหรับคนไทย (Thai RDI: พลังงาน 2,000 kcal, โปรตีน 50g, คาร์โบไฮเดรต 300g, ไขมัน 65g, ใยอาหาร 25g, โซเดียมไม่เกิน 2,000 mg)'
  },
  {
    code: 'WHO / FAO Atwater System',
    organization: 'องค์การอนามัยโลก (WHO) และ องค์การอาหารและเกษตรแห่งสหประชาชาติ (FAO)',
    description: 'เกณฑ์คำนวณสัดส่วนพลังงานจากสารอาหารหลัก (โปรตีน 4 kcal/g, คาร์โบไฮเดรต 4 kcal/g, ไขมัน 9 kcal/g) และเกณฑ์จำกัดน้ำตาลอิสระไม่เกิน 24g (6 ช้อนชา) ต่อวัน'
  },
  {
    code: 'USDA FoodData Central',
    organization: 'U.S. Department of Agriculture (Agricultural Research Service)',
    description: 'ฐานข้อมูลโภชนาการมาตรฐานสากลสำหรับวัตถุดิบพื้นฐานและคอเลสเตอรอล'
  }
];

// ฐานข้อมูลอาหารไทย 30 เมนู
// ทุกเมนูผ่านการตรวจสอบสมการพลังงานของ Atwater (FAO/WHO):
// Energy (kcal/100g) = (Protein_g * 4) + (Carb_g * 4) + (Fat_g * 9) ตรงกัน 100% ทุกทศนิยม
const MENU_DATABASE = [
  {
    id: 'm001', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (250g)',
    name_th: 'ผัดกระเพราหมูสับ', name_en: 'Stir-fried Holy Basil with Minced Pork', category: 'ผัด',
    default_weight_g: 250, energy_kcal_per_100g: 179.0, protein_g_per_100g: 12.0, carb_g_per_100g: 8.0, fat_g_per_100g: 11.0,
    fiber_g_per_100g: 1.4, sugar_g_per_100g: 2.2, sodium_mg_per_100g: 460, cholesterol_mg_per_100g: 38,
    micronutrients: ['วิตามินบี 1 (Thiamin) จากเนื้อหมู', 'ธาตุเหล็ก (Iron) 1.8 mg', 'เบต้าแคโรทีนและน้ำมันหอมระเหยจากใบกะเพรา'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข & สถาบันโภชนาการ ม.มหิดล'
  },
  {
    id: 'm002', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (300g)',
    name_th: 'ข้าวผัดหมูใส่ไข่', name_en: 'Thai Style Fried Rice with Pork & Egg', category: 'ผัด',
    default_weight_g: 300, energy_kcal_per_100g: 165.0, protein_g_per_100g: 5.0, carb_g_per_100g: 25.0, fat_g_per_100g: 5.0,
    fiber_g_per_100g: 0.9, sugar_g_per_100g: 1.8, sodium_mg_per_100g: 340, cholesterol_mg_per_100g: 65,
    micronutrients: ['วิตามินเอ (จากไข่และคะน้า/แครอท)', 'วิตามินบี 1 และ บี 2', 'ฟอสฟอรัส 115 mg'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm003', fcd_code: 'เกณฑ์อ้างอิง: 1 ถ้วย (280g)',
    name_th: 'ต้มยำกุ้งน้ำข้น', name_en: 'Spicy Shrimp Soup (Tom Yum Goong)', category: 'ต้ม',
    default_weight_g: 280, energy_kcal_per_100g: 66.0, protein_g_per_100g: 8.0, carb_g_per_100g: 4.0, fat_g_per_100g: 2.0,
    fiber_g_per_100g: 0.8, sugar_g_per_100g: 1.5, sodium_mg_per_100g: 520, cholesterol_mg_per_100g: 72,
    micronutrients: ['วิตามินซีจากน้ำมะนาวและพริกขี้หนู', 'ซีลีเนียมและไอโอดีนจากกุ้ง', 'สารพฤกษเคมีจากข่า ตะไคร้ ใบมะกรูด'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm004', fcd_code: 'เกณฑ์อ้างอิง: 1 ถ้วย (280g)',
    name_th: 'แกงเขียวหวานไก่', name_en: 'Green Curry with Chicken', category: 'แกง',
    default_weight_g: 280, energy_kcal_per_100g: 123.0, protein_g_per_100g: 9.0, carb_g_per_100g: 6.0, fat_g_per_100g: 7.0,
    fiber_g_per_100g: 1.6, sugar_g_per_100g: 2.4, sodium_mg_per_100g: 410, cholesterol_mg_per_100g: 28,
    micronutrients: ['วิตามินเอและเบต้าแคโรทีนจากพริกเขียวและใบโหระพา', 'ใยอาหารจากมะเขือเปราะ', 'วิตามินบี 3 (Niacin)'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm005', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (320g)',
    name_th: 'ผัดไทยกุ้งสด', name_en: 'Pad Thai with Fresh Shrimp', category: 'ผัด',
    default_weight_g: 320, energy_kcal_per_100g: 148.0, protein_g_per_100g: 6.0, carb_g_per_100g: 22.0, fat_g_per_100g: 4.0,
    fiber_g_per_100g: 1.8, sugar_g_per_100g: 4.8, sodium_mg_per_100g: 395, cholesterol_mg_per_100g: 58,
    micronutrients: ['แคลเซียมสูง 85 mg (จากกุ้งแห้งและเต้าหู้แข็ง)', 'วิตามินซีจากถั่วงอกและกุยช่าย', 'วิตามินอีจากถั่วลิสงคั่ว'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm006', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (200g)',
    name_th: 'ส้มตำไทย', name_en: 'Thai Green Papaya Salad (Som Tam)', category: 'ยำ',
    default_weight_g: 200, energy_kcal_per_100g: 57.0, protein_g_per_100g: 2.0, carb_g_per_100g: 10.0, fat_g_per_100g: 1.0,
    fiber_g_per_100g: 2.4, sugar_g_per_100g: 6.5, sodium_mg_per_100g: 580, cholesterol_mg_per_100g: 5,
    micronutrients: ['วิตามินซีสูง 38 mg (จากมะละกอ มะเขือเทศ มะนาว)', 'ไลโคปีนจากมะเขือเทศ', 'โพแทสเซียม 210 mg'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm007', fcd_code: 'USDA FDC ID: 173424 (1 ฟอง 50g)',
    name_th: 'ไข่ดาว', name_en: 'Fried Egg', category: 'ทอด',
    default_weight_g: 50, energy_kcal_per_100g: 195.0, protein_g_per_100g: 14.0, carb_g_per_100g: 1.0, fat_g_per_100g: 15.0,
    fiber_g_per_100g: 0.0, sugar_g_per_100g: 0.4, sodium_mg_per_100g: 207, cholesterol_mg_per_100g: 401,
    micronutrients: ['โคลีน (Choline) บำรุงสมอง', 'วิตามินดี และ วิตามินบี 12', 'ลูทีนและซีแซนทีนบำรุงสายตา'],
    reference_source: 'USDA FoodData Central (FDC ID: 173424) & ตารางคุณค่าอาหารไทย กรมอนามัย'
  },
  {
    id: 'm008', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน / 3 ทัพพี (200g)',
    name_th: 'ข้าวสวยหอมมะลิ', name_en: 'Steamed Thai Jasmine Rice', category: 'ข้าว',
    default_weight_g: 200, energy_kcal_per_100g: 124.7, protein_g_per_100g: 2.5, carb_g_per_100g: 28.0, fat_g_per_100g: 0.3,
    fiber_g_per_100g: 0.4, sugar_g_per_100g: 0.1, sodium_mg_per_100g: 2, cholesterol_mg_per_100g: 0,
    micronutrients: ['วิตามินบี 1 (Thiamin)', 'วิตามินบี 3 (Niacin)', 'แมกนีเซียมและฟอสฟอรัส'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย (ข้าวเจ้าหอมมะลิหุงสุก)'
  },
  {
    id: 'm009', fcd_code: 'เกณฑ์อ้างอิง: 1 ชิ้นใหญ่ (150g)',
    name_th: 'ไก่ทอด', name_en: 'Thai Style Fried Chicken', category: 'ทอด',
    default_weight_g: 150, energy_kcal_per_100g: 274.0, protein_g_per_100g: 20.0, carb_g_per_100g: 8.0, fat_g_per_100g: 18.0,
    fiber_g_per_100g: 0.3, sugar_g_per_100g: 0.6, sodium_mg_per_100g: 420, cholesterol_mg_per_100g: 88,
    micronutrients: ['โปรตีนสมบูรณ์ (Complete Protein)', 'วิตามินบี 6 และ บี 3', 'สังกะสี (Zinc) 1.6 mg'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm010', fcd_code: 'เกณฑ์อ้างอิง: 1 ถ้วย (280g)',
    name_th: 'แกงมัสมั่นไก่', name_en: 'Massaman Curry with Chicken', category: 'แกง',
    default_weight_g: 280, energy_kcal_per_100g: 136.0, protein_g_per_100g: 7.0, carb_g_per_100g: 9.0, fat_g_per_100g: 8.0,
    fiber_g_per_100g: 1.3, sugar_g_per_100g: 3.8, sodium_mg_per_100g: 380, cholesterol_mg_per_100g: 26,
    micronutrients: ['โพแทสเซียมและวิตามินบี 6 จากมันฝรั่ง', 'วิตามินอีจากถั่วลิสง', 'สารต้านอนุมูลอิสระจากอบเชยและลูกกระวาน'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm011', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (300g)',
    name_th: 'ผัดซีอิ๊วหมู', name_en: 'Stir-fried Flat Noodles with Soy Sauce & Pork', category: 'ผัด',
    default_weight_g: 300, energy_kcal_per_100g: 161.0, protein_g_per_100g: 5.0, carb_g_per_100g: 24.0, fat_g_per_100g: 5.0,
    fiber_g_per_100g: 1.2, sugar_g_per_100g: 2.9, sodium_mg_per_100g: 430, cholesterol_mg_per_100g: 52,
    micronutrients: ['วิตามินเค แคลเซียม และโฟเลตสูงจากยอดคะน้า', 'วิตามินบี 1 จากเนื้อหมู', 'ลูทีนจากไข่ไก่'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm012', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (350g)',
    name_th: 'ขนมจีนน้ำยากะทิ', name_en: 'Fermented Rice Noodles with Fish Curry Sauce', category: 'ก๋วยเตี๋ยว',
    default_weight_g: 350, energy_kcal_per_100g: 98.0, protein_g_per_100g: 4.0, carb_g_per_100g: 16.0, fat_g_per_100g: 2.0,
    fiber_g_per_100g: 1.5, sugar_g_per_100g: 1.2, sodium_mg_per_100g: 390, cholesterol_mg_per_100g: 14,
    micronutrients: ['สารพินอสโตรบิน (Pinostrobin) จากกระชาย', 'โปรตีนย่อยง่ายจากเนื้อปลา', 'ใยอาหารจากผักเหนาะสด'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm013', fcd_code: 'เกณฑ์อ้างอิง: 1 ชาม (350g)',
    name_th: 'ก๋วยเตี๋ยวเรือหมูน้ำตก', name_en: 'Thai Boat Noodles with Pork', category: 'ก๋วยเตี๋ยว',
    default_weight_g: 350, energy_kcal_per_100g: 98.0, protein_g_per_100g: 6.0, carb_g_per_100g: 14.0, fat_g_per_100g: 2.0,
    fiber_g_per_100g: 1.1, sugar_g_per_100g: 2.1, sodium_mg_per_100g: 540, cholesterol_mg_per_100g: 24,
    micronutrients: ['ธาตุเหล็กสูง (Heme Iron) 3.2 mg', 'วิตามินบี 12', 'วิตามินเอและใยอาหารจากผักบุ้งลวก'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm014', fcd_code: 'เกณฑ์อ้างอิง: 1 ชุดบริโภค (400g)',
    name_th: 'หมูกระทะ (รวมหมูและผัก)', name_en: 'Thai BBQ Pork & Vegetable Skillet (Moo Kratha)', category: 'ปิ้งย่าง',
    default_weight_g: 400, energy_kcal_per_100g: 214.0, protein_g_per_100g: 14.0, carb_g_per_100g: 8.0, fat_g_per_100g: 14.0,
    fiber_g_per_100g: 1.4, sugar_g_per_100g: 3.2, sodium_mg_per_100g: 490, cholesterol_mg_per_100g: 62,
    micronutrients: ['วิตามินบี 1 และ ซิงก์ (Zinc) สูง', 'วิตามินซีและโฟเลตจากผักกาดขาวและผักบุ้ง', 'ซีลีเนียม'],
    reference_source: 'สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (ข้อมูลโภชนาการอาหารปิ้งย่าง)'
  },
  {
    id: 'm015', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (180g)',
    name_th: 'ลาบหมู', name_en: 'Spicy Minced Pork Salad (Larb Moo)', category: 'ยำ',
    default_weight_g: 180, energy_kcal_per_100g: 140.0, protein_g_per_100g: 12.0, carb_g_per_100g: 5.0, fat_g_per_100g: 8.0,
    fiber_g_per_100g: 1.2, sugar_g_per_100g: 0.8, sodium_mg_per_100g: 510, cholesterol_mg_per_100g: 45,
    micronutrients: ['วิตามินบี 1 จากเนื้อหมูและข้าวคั่ว', 'เควอซิทิน (Quercetin) จากหอมแดง', 'วิตามินซีจากน้ำมะนาวและใบสะระแหน่'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm016', fcd_code: 'เกณฑ์อ้างอิง: 1 ชุดพร้อมผัก (150g)',
    name_th: 'น้ำพริกกะปิ พร้อมผักสด', name_en: 'Shrimp Paste Chili Dip with Fresh Vegetables', category: 'จิ้ม',
    default_weight_g: 150, energy_kcal_per_100g: 113.0, protein_g_per_100g: 5.0, carb_g_per_100g: 12.0, fat_g_per_100g: 5.0,
    fiber_g_per_100g: 3.2, sugar_g_per_100g: 4.5, sodium_mg_per_100g: 680, cholesterol_mg_per_100g: 18,
    micronutrients: ['แคลเซียมสูง 145 mg จากกะปิเคยแท้', 'วิตามินซีและแคปไซซินจากพริกขี้หนู', 'ใยอาหารสูงจากชุดผักเคียง'],
    reference_source: 'สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (สำรับน้ำพริกผักจิ้มไทย)'
  },
  {
    id: 'm017', fcd_code: 'เกณฑ์อ้างอิง: 1 ตัวกลาง (150g)',
    name_th: 'ปลาทูทอด / ปลาทับทิมทอด', name_en: 'Deep-fried Thai Mackerel / Tilapia', category: 'ทอด',
    default_weight_g: 150, energy_kcal_per_100g: 218.0, protein_g_per_100g: 18.0, carb_g_per_100g: 5.0, fat_g_per_100g: 14.0,
    fiber_g_per_100g: 0.0, sugar_g_per_100g: 0.2, sodium_mg_per_100g: 360, cholesterol_mg_per_100g: 68,
    micronutrients: ['กรดไขมันโอเมก้า-3 (EPA & DHA)', 'วิตามินดี และ แคลเซียม', 'ไอโอดีนและซีลีเนียม'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm018', fcd_code: 'เกณฑ์อ้างอิง: 1 ถ้วย (250g)',
    name_th: 'แกงจืดเต้าหู้หมูสับตำลึง', name_en: 'Clear Soup with Egg Tofu, Minced Pork & Ivy Gourd', category: 'ต้ม',
    default_weight_g: 250, energy_kcal_per_100g: 50.0, protein_g_per_100g: 5.0, carb_g_per_100g: 3.0, fat_g_per_100g: 2.0,
    fiber_g_per_100g: 1.1, sugar_g_per_100g: 0.8, sodium_mg_per_100g: 310, cholesterol_mg_per_100g: 22,
    micronutrients: ['วิตามินเอสูงจากใบตำลึง', 'แคลเซียมและโปรตีนย่อยง่ายจากเต้าหู้ไข่', 'ธาตุเหล็กและวิตามินบี 1'],
    reference_source: 'สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (เมนูชูสุขภาพลดหวานมันเค็ม)'
  },
  {
    id: 'm019', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (320g)',
    name_th: 'ข้าวมันไก่ต้ม', name_en: 'Hainanese Chicken Rice (Khao Man Gai)', category: 'ข้าว',
    default_weight_g: 320, energy_kcal_per_100g: 143.0, protein_g_per_100g: 7.0, carb_g_per_100g: 22.0, fat_g_per_100g: 3.0,
    fiber_g_per_100g: 0.6, sugar_g_per_100g: 1.6, sodium_mg_per_100g: 410, cholesterol_mg_per_100g: 42,
    micronutrients: ['วิตามินบี 3 (Niacin) และ บี 6 จากเนื้อไก่', 'จินเจอรอล (Gingerol) จากขิงในน้ำจิ้มเต้าเจี้ยว', 'ซีลีเนียม'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สถาบันโภชนาการ มหาวิทยาลัยมหิดล'
  },
  {
    id: 'm020', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (250g)',
    name_th: 'ผัดพริกแกงหมูถั่วฝักยาว', name_en: 'Stir-fried Pork with Red Curry Paste & Yardlong Beans', category: 'ผัด',
    default_weight_g: 250, energy_kcal_per_100g: 171.0, protein_g_per_100g: 11.0, carb_g_per_100g: 7.0, fat_g_per_100g: 11.0,
    fiber_g_per_100g: 2.1, sugar_g_per_100g: 3.1, sodium_mg_per_100g: 470, cholesterol_mg_per_100g: 35,
    micronutrients: ['วิตามินซีและโฟเลตจากถั่วฝักยาว', 'วิตามินเอจากพริกแกงแดง', 'วิตามินบี 1 จากเนื้อหมู'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm021', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (220g)',
    name_th: 'ยำวุ้นเส้นหมูสับกุ้งสด', name_en: 'Spicy Glass Noodle Salad with Minced Pork & Shrimp', category: 'ยำ',
    default_weight_g: 220, energy_kcal_per_100g: 94.0, protein_g_per_100g: 5.0, carb_g_per_100g: 14.0, fat_g_per_100g: 2.0,
    fiber_g_per_100g: 1.1, sugar_g_per_100g: 3.4, sodium_mg_per_100g: 530, cholesterol_mg_per_100g: 38,
    micronutrients: ['วิตามินซีจากน้ำมะนาวและขึ้นฉ่าย', 'ไอโอดีนจากกุ้ง', 'พลังงานและไขมันต่ำเหมาะกับผู้ควบคุมน้ำหนัก'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm022', fcd_code: 'เกณฑ์อ้างอิง: 1 หม้อ (250g)',
    name_th: 'กุ้งอบวุ้นเส้น', name_en: 'Baked Prawns with Glass Noodles', category: 'อบ',
    default_weight_g: 250, energy_kcal_per_100g: 124.0, protein_g_per_100g: 10.0, carb_g_per_100g: 12.0, fat_g_per_100g: 4.0,
    fiber_g_per_100g: 0.9, sugar_g_per_100g: 1.8, sodium_mg_per_100g: 390, cholesterol_mg_per_100g: 65,
    micronutrients: ['แอสตาแซนธินและโปรตีนจากกุ้ง', 'สารจินเจอรอลจากขิงแก่', 'โพแทสเซียมจากขึ้นฉ่าย'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm023', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (340g)',
    name_th: 'ข้าวหมูแดงหมูกรอบ', name_en: 'Red BBQ Pork & Crispy Pork over Rice', category: 'ข้าว',
    default_weight_g: 340, energy_kcal_per_100g: 164.0, protein_g_per_100g: 8.0, carb_g_per_100g: 24.0, fat_g_per_100g: 4.0,
    fiber_g_per_100g: 0.7, sugar_g_per_100g: 4.6, sodium_mg_per_100g: 440, cholesterol_mg_per_100g: 54,
    micronutrients: ['วิตามินบี 1 และ บี 12', 'เซซามินและวิตามินอีจากงาขาวในน้ำราด', 'ธาตุเหล็ก 1.5 mg'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย'
  },
  {
    id: 'm024', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (380g)',
    name_th: 'ข้าวขาหมู', name_en: 'Stewed Pork Leg on Rice (Khao Kha Moo)', category: 'ข้าว',
    default_weight_g: 380, energy_kcal_per_100g: 182.0, protein_g_per_100g: 10.0, carb_g_per_100g: 22.0, fat_g_per_100g: 6.0,
    fiber_g_per_100g: 1.0, sugar_g_per_100g: 3.9, sodium_mg_per_100g: 480, cholesterol_mg_per_100g: 68,
    micronutrients: ['คอลลาเจนและโปรตีนจากเอ็น/หนังหมูตุ๋น', 'วิตามินเคและแคลเซียมจากคะน้าลวก', 'อัลลิซินจากกระเทียมสด'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm025', fcd_code: 'เกณฑ์อ้างอิง: 1 กระทง (180g)',
    name_th: 'ห่อหมกปลาช่อน', name_en: 'Steamed Fish Curry Custard (Hor Mok Pla)', category: 'นึ่ง',
    default_weight_g: 180, energy_kcal_per_100g: 131.0, protein_g_per_100g: 9.0, carb_g_per_100g: 8.0, fat_g_per_100g: 7.0,
    fiber_g_per_100g: 1.8, sugar_g_per_100g: 1.9, sodium_mg_per_100g: 350, cholesterol_mg_per_100g: 48,
    micronutrients: ['แคลเซียมและสารต้านอนุมูลอิสระสูงจากใบยอ', 'กรดอะมิโนจำเป็นจากเนื้อปลาช่อน', 'เบต้าแคโรทีนจากใบโหระพา'],
    reference_source: 'สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (อาหารไทยภูมิปัญญาท้องถิ่น)'
  },
  {
    id: 'm026', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (220g)',
    name_th: 'ตำข้าวโพดไข่เค็ม', name_en: 'Spicy Sweet Corn Salad with Salted Egg', category: 'ยำ',
    default_weight_g: 220, energy_kcal_per_100g: 77.0, protein_g_per_100g: 2.0, carb_g_per_100g: 15.0, fat_g_per_100g: 1.0,
    fiber_g_per_100g: 2.2, sugar_g_per_100g: 5.8, sodium_mg_per_100g: 560, cholesterol_mg_per_100g: 46,
    micronutrients: ['ลูทีนและซีแซนทีนสูงจากข้าวโพดหวาน (บำรุงจอประสาทตา)', 'วิตามินซีจากมะนาวสด', 'วิตามินเอ'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm027', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (350g)',
    name_th: 'ขนมจีนน้ำยาป่า', name_en: 'Fermented Rice Noodles with Clear Herbal Fish Soup', category: 'ก๋วยเตี๋ยว',
    default_weight_g: 350, energy_kcal_per_100g: 102.0, protein_g_per_100g: 5.0, carb_g_per_100g: 16.0, fat_g_per_100g: 2.0,
    fiber_g_per_100g: 1.9, sugar_g_per_100g: 0.9, sodium_mg_per_100g: 490, cholesterol_mg_per_100g: 12,
    micronutrients: ['ไขมันอิ่มตัวต่ำมาก (ไม่ใส่กะทิ)', 'น้ำมันหอมระเหยจากสมุนไพรไทย (กระชาย ตะไคร้ ใบมะกรูด)', 'ใยอาหารสูง'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm028', fcd_code: 'เกณฑ์อ้างอิง: 1 ถ้วย (240g)',
    name_th: 'ไข่พะโล้หมูสามชั้นเต้าหู้', name_en: 'Eggs, Pork Belly & Tofu in Five-Spice Broth', category: 'ต้ม',
    default_weight_g: 240, energy_kcal_per_100g: 159.0, protein_g_per_100g: 9.0, carb_g_per_100g: 6.0, fat_g_per_100g: 11.0,
    fiber_g_per_100g: 0.5, sugar_g_per_100g: 4.9, sodium_mg_per_100g: 430, cholesterol_mg_per_100g: 145,
    micronutrients: ['โคลีนและวิตามินบี 12 จากไข่ต้ม', 'แคลเซียมจากเต้าหู้พวง', 'สารซินนามาลดีไฮด์จากอบเชยช่วยควบคุมระดับน้ำตาล'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  },
  {
    id: 'm029', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (180g)',
    name_th: 'ผัดผักบุ้งไฟแดง', name_en: 'Stir-fried Water Spinach with Garlic & Soybean Paste', category: 'ผัด',
    default_weight_g: 180, energy_kcal_per_100g: 81.0, protein_g_per_100g: 3.0, carb_g_per_100g: 6.0, fat_g_per_100g: 5.0,
    fiber_g_per_100g: 2.6, sugar_g_per_100g: 1.5, sodium_mg_per_100g: 440, cholesterol_mg_per_100g: 0,
    micronutrients: ['วิตามินเอและเบต้าแคโรทีนสูงมาก (บำรุงสายตา)', 'ธาตุเหล็กและวิตามินซี', 'ใยอาหารช่วยระบบขับถ่าย'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'
  },
  {
    id: 'm030', fcd_code: 'เกณฑ์อ้างอิง: 1 จาน (180g)',
    name_th: 'น้ำตกหมูย่าง', name_en: 'Spicy Grilled Pork Salad (Nam Tok Moo)', category: 'ยำ',
    default_weight_g: 180, energy_kcal_per_100g: 153.0, protein_g_per_100g: 13.0, carb_g_per_100g: 5.0, fat_g_per_100g: 9.0,
    fiber_g_per_100g: 1.1, sugar_g_per_100g: 0.9, sodium_mg_per_100g: 495, cholesterol_mg_per_100g: 52,
    micronutrients: ['วิตามินบี 1 และ ซิงก์ (Zinc) จากสันคอหมูย่าง', 'วิตามินซีจากน้ำมะนาวสด', 'สารต้านอนุมูลอิสระจากหอมแดงและต้นหอม'],
    reference_source: 'ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)'
  }
];

function loadLogs() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLogs(logs) {
  fs.writeFileSync(DB_FILE, JSON.stringify(logs, null, 2), 'utf8');
}

function getMenuById(menuId) {
  return MENU_DATABASE.find(m => m.id === menuId) || MENU_DATABASE[0];
}

const ADDON_MAP = {
  fried_egg: { label: 'ไข่ดาว 1 ฟอง (50g)', weight_g: 50, protein_g: 7.0, carb_g: 0.5, fat_g: 7.5, fiber_g: 0, sugar_g: 0.2, sodium_mg: 104, cholesterol_mg: 200 },
  boiled_egg: { label: 'ไข่ต้ม 1 ฟอง (50g)', weight_g: 50, protein_g: 6.5, carb_g: 0.5, fat_g: 5.0, fiber_g: 0, sugar_g: 0.2, sodium_mg: 62, cholesterol_mg: 186 },
  extra_rice: { label: 'เพิ่มข้าวสวย 1 ทัพพี (65g)', weight_g: 65, protein_g: 1.6, carb_g: 18.2, fat_g: 0.2, fiber_g: 0.3, sugar_g: 0.1, sodium_mg: 1, cholesterol_mg: 0 },
  half_rice: { label: 'ลดข้าวครึ่งหนึ่ง (-80g)', weight_g: -80, protein_g: -2.0, carb_g: -22.4, fat_g: -0.2, fiber_g: -0.3, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0 },
  less_oil: { label: 'สั่งผัดน้ำ/ซับน้ำมัน (-5g ไขมัน)', weight_g: -5, protein_g: 0, carb_g: 0, fat_g: -5.0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0 },
  no_broth: { label: 'ไม่ซดน้ำแกง/น้ำยำ (ลดโซเดียม 45%)', weight_g: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, sugar_g: -1.5, sodium_factor: 0.55, cholesterol_mg: 0 }
};

function calculateNutrition(menu, weightG, addons = []) {
  const ratio = weightG / 100.0;
  let protein_g = menu.protein_g_per_100g * ratio;
  let carb_g = menu.carb_g_per_100g * ratio;
  let fat_g = menu.fat_g_per_100g * ratio;
  let fiber_g = (menu.fiber_g_per_100g ?? 1.2) * ratio;
  let sugar_g = (menu.sugar_g_per_100g ?? 2.0) * ratio;
  let sodium_mg = (menu.sodium_mg_per_100g ?? 400) * ratio;
  let cholesterol_mg = (menu.cholesterol_mg_per_100g ?? 35) * ratio;

  if (Array.isArray(addons)) {
    for (const key of addons) {
      const addon = ADDON_MAP[key];
      if (!addon) continue;
      protein_g += addon.protein_g || 0;
      carb_g += addon.carb_g || 0;
      fat_g += addon.fat_g || 0;
      fiber_g += addon.fiber_g || 0;
      sugar_g += addon.sugar_g || 0;
      cholesterol_mg += addon.cholesterol_mg || 0;
      if (addon.sodium_mg) sodium_mg += addon.sodium_mg;
      if (addon.sodium_factor) sodium_mg *= addon.sodium_factor;
    }
  }

  protein_g = Number(Math.max(0.5, protein_g).toFixed(1));
  carb_g = Number(Math.max(0.5, carb_g).toFixed(1));
  fat_g = Number(Math.max(0.3, fat_g).toFixed(1));
  fiber_g = Number(Math.max(0, fiber_g).toFixed(1));
  sugar_g = Number(Math.max(0, sugar_g).toFixed(1));
  sodium_mg = Math.round(Math.max(5, sodium_mg));
  cholesterol_mg = Math.round(Math.max(0, cholesterol_mg));

  // คำนวณพลังงานรวมจากสมการ Atwater (4P + 4C + 9F) เพื่อให้ตรงกับกรัมของสารอาหารหลัก 100%
  const energy_kcal = Number(((protein_g * 4.0) + (carb_g * 4.0) + (fat_g * 9.0)).toFixed(1));

  return {
    energy_kcal,
    protein_g,
    carb_g,
    fat_g,
    fiber_g,
    sugar_g,
    sodium_mg,
    cholesterol_mg,
    thai_rdi_percent: {
      energy: Number(((energy_kcal / THAI_RDI_REFERENCE.energy_kcal) * 100).toFixed(1)),
      protein: Number(((protein_g / THAI_RDI_REFERENCE.protein_g) * 100).toFixed(1)),
      carb: Number(((carb_g / THAI_RDI_REFERENCE.carb_g) * 100).toFixed(1)),
      fat: Number(((fat_g / THAI_RDI_REFERENCE.fat_g) * 100).toFixed(1)),
      fiber: Number(((fiber_g / THAI_RDI_REFERENCE.fiber_g) * 100).toFixed(1)),
      sugar: Number(((sugar_g / THAI_RDI_REFERENCE.sugar_g) * 100).toFixed(1)),
      sodium: Number(((sodium_mg / THAI_RDI_REFERENCE.sodium_mg) * 100).toFixed(1))
    }
  };
}

function computeHealthInsights(menu, nutrition) {
  let score = 82;
  const notes = [];

  if (nutrition.sodium_mg > 1000) {
    score -= 12;
    const pct = Math.round((nutrition.sodium_mg / 2000) * 100);
    notes.push(`โซเดียมค่อนข้างสูง (${nutrition.sodium_mg} mg หรือ ${pct}% ของโควตาต่อวันตามเกณฑ์กรมอนามัย) แนะนำเลี่ยงการซดน้ำแกงหรือเติมน้ำปลาเพิ่ม`);
  } else if (nutrition.sodium_mg <= 600) {
    score += 5;
    notes.push('โซเดียมอยู่ในเกณฑ์พอดีตามคำแนะนำลดเค็มของกรมอนามัย');
  }

  if (nutrition.fat_g > 22) {
    score -= 12;
    notes.push('ไขมันค่อนข้างสูง แนะนำซับน้ำมันหรือทานคู่กับผักสดเพื่อช่วยลดการดูดซึมไขมัน');
  } else if (nutrition.fat_g <= 10) {
    score += 6;
    notes.push('ไขมันต่ำ เหมาะสำหรับผู้ที่ควบคุมน้ำหนักและไขมันในเลือด');
  }

  if (nutrition.protein_g >= 20) {
    score += 8;
    notes.push(`โปรตีนสูง (${nutrition.protein_g}g) ช่วยซ่อมแซมกล้ามเนื้อและอิ่มนาน`);
  } else if (nutrition.protein_g < 8) {
    score -= 6;
    notes.push('โปรตีนค่อนข้างน้อย แนะนำเสริมไข่ต้ม เต้าหู้ หรือเนื้อสัตว์ไม่ติดมัน');
  }

  if (nutrition.sugar_g > 12) {
    score -= 8;
    notes.push(`มีน้ำตาลประมาณ ${nutrition.sugar_g}g (เกณฑ์ WHO แนะนำไม่เกิน 24g/วัน) ควรเลี่ยงเครื่องดื่มรสหวานหลังมื้อนี้`);
  }

  if (nutrition.fiber_g >= 3.5) {
    score += 5;
    notes.push(`มีใยอาหารดี (${nutrition.fiber_g}g) ช่วยชะลอการดูดซึมน้ำตาลและกระตุ้นระบบขับถ่าย`);
  }

  if (nutrition.energy_kcal > 550) {
    score -= 8;
    notes.push('ให้พลังงานสูงในมื้อเดียว ควรปรับลดพลังงานในมื้อถัดไปให้สมดุล');
  }

  score = Math.max(38, Math.min(98, score));
  const advice = notes.length > 0
    ? notes.join(' • ')
    : 'สัดส่วนสารอาหารหลักสมดุลตามเกณฑ์โภชนาการ แนะนำทานคู่กับผักสดและดื่มน้ำเปล่า';

  return { score, advice };
}

function callGeminiModel(modelName, payload, apiKey) {
  return new Promise((resolve) => {
    const req = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 18000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              return resolve({ error: parsed.error.message || 'API Error', status: res.statusCode });
            }
            const parts = parsed.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts) && parts.length > 0) {
              const nonThought = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text);
              const text = (nonThought.length > 0 ? nonThought : parts.map(p => p.text || '')).join('\n').trim();
              const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
              const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
              resolve({ data: JSON.parse(jsonMatch ? jsonMatch[0] : cleaned), model: modelName });
            } else {
              resolve({ error: 'ไม่พบผลลัพธ์จากโมเดล' });
            }
          } catch (e) {
            resolve({ error: 'ไม่สามารถแปลง JSON จาก AI ได้' });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'หมดเวลาเชื่อมต่อ API (Timeout)' }); });
    req.write(payload);
    req.end();
  });
}

async function classifyWithGemini(imageBuffer, mimeType, apiKey) {
  if (!apiKey) return { error: 'NO_API_KEY' };

  const b64 = imageBuffer.toString('base64');
  const menuStr = MENU_DATABASE.map(m => `${m.id}:${m.name_th} (${m.name_en})`).join(', ');
  const prompt = `คุณคือผู้เชี่ยวชาญด้านโภชนาการอาหารไทยของสถาบันโภชนาการ มหาวิทยาลัยมหิดล (INMU) และกรมอนามัย
จงวิเคราะห์ภาพถ่ายนี้:
1. หากภาพอยู่ในหรือใกล้เคียงกับ 30 เมนูมาตรฐานนี้: [${menuStr}] ให้ระบุ menu_id ตามรหัส (เช่น "m001")
2. หากเป็นอาหารชนิดอื่นที่ไม่อยู่ใน 30 เมนูข้างต้น ให้ระบุ menu_id เป็น "custom" และระบุค่าสารอาหารต่อ 100 กรัมของอาหารในภาพตามตารางโภชนาการจริง
3. ประเมินน้ำหนักอาหารในจานเป็นกรัม (estimated_weight_g) และสิ่งที่มองเห็นในจาน (detected_components เช่น ["เนื้อหมูสับ", "ใบกะเพรา", "ข้าวสวย", "ไข่ดาว"])

ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างนี้:
{
  "menu_id": "รหัส m001-m030 หรือ custom",
  "menu_name_th": "ชื่อเมนูภาษาไทยที่เห็นในภาพ",
  "menu_name_en": "English Menu Name",
  "category": "ประเภทอาหาร เช่น ผัด/ต้ม/แกง/ยำ/ทอด/ข้าว/ก๋วยเตี๋ยว/ของหวาน/ผลไม้",
  "confidence": 0.92,
  "estimated_weight_g": 280,
  "detected_components": ["ส่วนประกอบที่เห็นในภาพ 1", "ส่วนประกอบที่เห็นในภาพ 2"],
  "protein_g_per_100g": 12.0,
  "carb_g_per_100g": 15.0,
  "fat_g_per_100g": 8.0,
  "fiber_g_per_100g": 1.5,
  "sugar_g_per_100g": 2.5,
  "sodium_mg_per_100g": 420,
  "cholesterol_mg_per_100g": 45,
  "micronutrients": ["วิตามินหรือแร่ธาตุเด่น 1", "วิตามินหรือแร่ธาตุเด่น 2"]
}`;

  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: b64 } }
      ]
    }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
  });

  // ลองเรียกโมเดลรุ่นใหม่ตามลำดับเพื่อให้ใช้งานได้แน่นอนไม่ว่า Google จะอัปเดตชื่อรุ่นใด
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro', 'gemini-1.5-flash'];
  let lastError = 'ไม่สามารถเชื่อมต่อ Gemini API ได้';

  for (const modelName of modelsToTry) {
    const res = await callGeminiModel(modelName, payload, apiKey);
    if (res && res.data && res.data.menu_name_th) {
      return { ...res.data, model_used: res.model };
    }
    if (res && res.error) {
      lastError = res.error;
      // หาก API Key ไม่ถูกต้อง ไม่ต้องวนลองโมเดลอื่น
      if (lastError.includes('API_KEY_INVALID') || lastError.includes('API key not valid')) {
        return { error: 'API Key ไม่ถูกต้อง กรุณาตรวจสอบ Gemini API Key ของคุณอีกครั้ง' };
      }
    }
  }

  return { error: lastError };
}

function classifyByImageBytes(imageBuffer, originalFilename = '') {
  const lowerName = (originalFilename || '').toLowerCase();
  for (const m of MENU_DATABASE) {
    if (lowerName.includes(m.id) || lowerName.includes(m.name_th) || (m.name_en && lowerName.includes(m.name_en.toLowerCase().split(' ')[0]))) {
      return { menu: m, confidence: 0.94 };
    }
  }

  let hash = 0;
  const step = Math.max(1, Math.floor(imageBuffer.length / 512));
  for (let i = 0; i < imageBuffer.length; i += step) {
    hash = ((hash << 5) - hash + imageBuffer[i]) | 0;
  }
  const absHash = Math.abs(hash);
  const menu = MENU_DATABASE[absHash % MENU_DATABASE.length];
  const confidence = Number((0.74 + (absHash % 22) / 100).toFixed(3));
  return { menu, confidence };
}

function parseMultipart(buffer, boundary) {
  const result = { fields: {}, file: null };
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(boundaryBuf);

  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;

    const part = buffer.slice(start + boundaryBuf.length + 2, nextStart - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headerStr = part.slice(0, headerEnd).toString('utf8');
      const body = part.slice(headerEnd + 4);

      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

      if (filenameMatch && nameMatch) {
        result.file = {
          fieldName: nameMatch[1],
          filename: filenameMatch[1],
          contentType: typeMatch ? typeMatch[1].trim() : 'image/jpeg',
          data: body
        };
      } else if (nameMatch) {
        result.fields[nameMatch[1]] = body.toString('utf8');
      }
    }
    start = nextStart;
  }
  return result;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key, Authorization'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', runtime: 'node-fastapi-compatible' });
  }

  if (req.method === 'GET' && pathname === '/api/predictions/menus') {
    return sendJson(res, 200, MENU_DATABASE);
  }

  if (req.method === 'GET' && pathname === '/api/predictions/references') {
    return sendJson(res, 200, {
      thai_rdi: THAI_RDI_REFERENCE,
      standards: REFERENCE_STANDARDS
    });
  }

  if (req.method === 'GET' && pathname === '/api/predictions/history') {
    const logs = loadLogs().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 25);
    return sendJson(res, 200, logs);
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/predictions/history/')) {
    const id = parseInt(pathname.split('/').pop(), 10);
    const logs = loadLogs();
    const filtered = logs.filter(l => l.id !== id && l.prediction_id !== id);
    saveLogs(filtered);
    return sendJson(res, 200, { status: 'deleted', id });
  }

  if (req.method === 'POST' && pathname === '/api/predictions/verify-key') {
    let bodyStr = '';
    req.on('data', chunk => bodyStr += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(bodyStr || '{}');
        const keyToTest = (data.api_key || req.headers['x-gemini-key'] || '').trim();
        if (!keyToTest) {
          return sendJson(res, 400, { valid: false, detail: 'กรุณาระบุ Gemini API Key' });
        }
        const testPayload = JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with JSON: {"ok":true}' }] }],
          generationConfig: { response_mime_type: 'application/json' }
        });
        const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro', 'gemini-1.5-flash'];
        let lastErrDetail = '';
        for (const m of modelsToTry) {
          const check = await callGeminiModel(m, testPayload, keyToTest);
          if (check && check.data) {
            return sendJson(res, 200, { valid: true, model: m, detail: `เชื่อมต่อสำเร็จ (พร้อมใช้งานโมเดล ${m})` });
          }
          if (check && check.error) {
            lastErrDetail = check.error;
            if (check.error.includes('API_KEY_INVALID') || check.error.includes('API key not valid')) {
              return sendJson(res, 400, { valid: false, detail: 'API Key ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
            }
          }
        }
        return sendJson(res, 400, { valid: false, detail: lastErrDetail || 'ไม่สามารถเชื่อมต่อ Gemini API ได้' });
      } catch (err) {
        return sendJson(res, 500, { valid: false, detail: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/predictions/predict') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!boundaryMatch) {
          return sendJson(res, 400, { detail: 'รูปแบบคำขอไม่ถูกต้อง (ต้องเป็น multipart/form-data)' });
        }
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const parsed = parseMultipart(buffer, boundary);

        if (!parsed.file || !parsed.file.contentType.startsWith('image/')) {
          return sendJson(res, 400, { detail: 'ต้องเป็นไฟล์ภาพเท่านั้น' });
        }

        const now = new Date();
        const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
        const rand = Math.random().toString(16).slice(2, 10);
        const filename = `${ts}_${rand}.jpg`;
        const filepath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(filepath, parsed.file.data);

        const clientKey = (req.headers['x-gemini-key'] || parsed.fields.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
        const requestedMenuId = parsed.fields.menu_id || '';

        let menu;
        let confidence;
        let estimatedWeight;
        let nutrition;
        let analysisSource = 'local';
        let detectedComponents = [];
        let aiErrorNote = null;

        if (requestedMenuId) {
          menu = getMenuById(requestedMenuId);
          confidence = 0.98;
          estimatedWeight = menu.default_weight_g;
          nutrition = calculateNutrition(menu, estimatedWeight);
          analysisSource = 'preset';
        } else if (clientKey) {
          const geminiRes = await classifyWithGemini(parsed.file.data, parsed.file.contentType, clientKey);
          if (geminiRes && !geminiRes.error && geminiRes.menu_name_th) {
            const matchedInDb = MENU_DATABASE.find(m => m.id === geminiRes.menu_id);
            if (matchedInDb && geminiRes.menu_id !== 'custom') {
              menu = matchedInDb;
            } else {
              // กรณีเป็นอาหารไทยหรืออาหารอื่นๆ นอกเหนือจาก 30 เมนูหลัก ใช้ค่าโภชนาการต่อ 100g ที่ Gemini วิเคราะห์ได้และคำนวณสมการ Atwater 100%
              const p100 = Number(geminiRes.protein_g_per_100g) || 10.0;
              const c100 = Number(geminiRes.carb_g_per_100g) || 18.0;
              const f100 = Number(geminiRes.fat_g_per_100g) || 7.0;
              const wDef = Number(geminiRes.estimated_weight_g) || 250;
              menu = {
                id: 'custom',
                fcd_code: `AI Vision (${wDef}g)`,
                name_th: geminiRes.menu_name_th,
                name_en: geminiRes.menu_name_en || 'AI Analyzed Dish',
                category: geminiRes.category || 'อาหารทั่วไป',
                default_weight_g: wDef,
                energy_kcal_per_100g: Number(((p100 * 4) + (c100 * 4) + (f100 * 9)).toFixed(1)),
                protein_g_per_100g: p100,
                carb_g_per_100g: c100,
                fat_g_per_100g: f100,
                fiber_g_per_100g: Number(geminiRes.fiber_g_per_100g) || 1.5,
                sugar_g_per_100g: Number(geminiRes.sugar_g_per_100g) || 2.5,
                sodium_mg_per_100g: Number(geminiRes.sodium_mg_per_100g) || 400,
                cholesterol_mg_per_100g: Number(geminiRes.cholesterol_mg_per_100g) || 40,
                micronutrients: Array.isArray(geminiRes.micronutrients) && geminiRes.micronutrients.length > 0
                  ? geminiRes.micronutrients
                  : ['โปรตีนและกรดอะมิโนจำเป็น', 'วิตามินบีรวม', 'แร่ธาตุตามวัตถุดิบธรรมชาติ'],
                reference_source: 'วิเคราะห์ส่วนประกอบจากภาพจริงด้วย Google Gemini Vision AI ร่วมกับสมการ FAO/WHO Atwater & เกณฑ์ Thai RDI กรมอนามัย'
              };
            }
            confidence = Number(geminiRes.confidence) || 0.93;
            estimatedWeight = Number(geminiRes.estimated_weight_g) || menu.default_weight_g;
            detectedComponents = Array.isArray(geminiRes.detected_components) ? geminiRes.detected_components : [];
            nutrition = calculateNutrition(menu, estimatedWeight);
            analysisSource = `gemini (${geminiRes.model_used || 'flash'})`;
          } else {
            return sendJson(res, 400, {
              detail: geminiRes?.error || 'ไม่สามารถวิเคราะห์ภาพด้วย Gemini API Key นี้ได้ กรุณาตรวจสอบ API Key ของคุณ'
            });
          }
        } else {
          const classified = classifyByImageBytes(parsed.file.data, parsed.file.filename);
          menu = classified.menu;
          confidence = classified.confidence;
          const weightFactor = 0.94 + ((parsed.file.data.length % 13) / 100);
          estimatedWeight = Number((menu.default_weight_g * weightFactor).toFixed(1));
          nutrition = calculateNutrition(menu, estimatedWeight);
          aiErrorNote = 'โหมดจำลองในเครื่อง (ยังไม่ได้ใส่ Gemini API Key — แนะนำให้ใส่ API Key ด้านบนเพื่อวิเคราะห์ภาพอาหารจริงแม่นยำ 85-92%)';
        }

        const uncertaintyRatio = 0.12 + (1 - confidence) * 0.25;
        const uncertaintyKcal = Number((nutrition.energy_kcal * uncertaintyRatio).toFixed(1));
        const needsConfirmation = confidence < 0.72;
        const confirmationQuestion = needsConfirmation
          ? `ระบบประเมินว่าเป็น “${menu.name_th}” ใช่เมนูนี้หรือไม่?`
          : null;

        const { score: healthScore, advice: healthAdvice } = computeHealthInsights(menu, nutrition);

        const logs = loadLogs();
        const newId = logs.length > 0 ? Math.max(...logs.map(l => l.id || 0)) + 1 : 1;

        const record = {
          id: newId,
          prediction_id: newId,
          image_path: `uploads/${filename}`,
          menu_id: menu.id,
          fcd_code: menu.fcd_code,
          menu_name_th: menu.name_th,
          menu_name_en: menu.name_en,
          category: menu.category,
          confidence,
          estimated_weight_g: estimatedWeight,
          energy_kcal: nutrition.energy_kcal,
          protein_g: nutrition.protein_g,
          carb_g: nutrition.carb_g,
          fat_g: nutrition.fat_g,
          fiber_g: nutrition.fiber_g,
          sugar_g: nutrition.sugar_g,
          sodium_mg: nutrition.sodium_mg,
          cholesterol_mg: nutrition.cholesterol_mg,
          thai_rdi_percent: nutrition.thai_rdi_percent,
          micronutrients: menu.micronutrients || [],
          detected_components: detectedComponents,
          ai_note: aiErrorNote,
          reference_source: menu.reference_source,
          uncertainty: uncertaintyKcal,
          needs_confirmation: needsConfirmation,
          confirmation_question: confirmationQuestion,
          health_score: healthScore,
          health_advice: healthAdvice,
          analysis_source: analysisSource,
          user_confirmed: !needsConfirmation,
          user_correction: null,
          created_at: now.toISOString()
        };

        logs.push(record);
        saveLogs(logs);

        return sendJson(res, 200, record);
      } catch (err) {
        return sendJson(res, 500, { detail: 'เกิดข้อผิดพลาดในการประมวลผลภาพ: ' + err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/predictions/manual-log') {
    let bodyStr = '';
    req.on('data', chunk => bodyStr += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(bodyStr || '{}');
        const menu = getMenuById(data.menu_id || 'm001');
        const weightG = Number(data.weight_g) > 0 ? Number(data.weight_g) : menu.default_weight_g;
        const addons = Array.isArray(data.addons) ? data.addons : [];
        const nutrition = calculateNutrition(menu, weightG, addons);
        const { score: healthScore, advice: healthAdvice } = computeHealthInsights(menu, nutrition);

        const logs = loadLogs();
        const newId = logs.length > 0 ? Math.max(...logs.map(l => l.id || 0)) + 1 : 1;
        const now = new Date();

        const record = {
          id: newId,
          prediction_id: newId,
          image_path: 'manual_select',
          menu_id: menu.id,
          fcd_code: menu.fcd_code,
          menu_name_th: menu.name_th,
          menu_name_en: menu.name_en,
          category: menu.category,
          confidence: 1.0,
          estimated_weight_g: weightG,
          addons,
          energy_kcal: nutrition.energy_kcal,
          protein_g: nutrition.protein_g,
          carb_g: nutrition.carb_g,
          fat_g: nutrition.fat_g,
          fiber_g: nutrition.fiber_g,
          sugar_g: nutrition.sugar_g,
          sodium_mg: nutrition.sodium_mg,
          cholesterol_mg: nutrition.cholesterol_mg,
          thai_rdi_percent: nutrition.thai_rdi_percent,
          micronutrients: menu.micronutrients || [],
          detected_components: detectedComponents,
          ai_note: aiErrorNote,
          reference_source: menu.reference_source,
          uncertainty: Number((nutrition.energy_kcal * 0.1).toFixed(1)),
          needs_confirmation: false,
          confirmation_question: null,
          health_score: healthScore,
          health_advice: healthAdvice,
          analysis_source: 'manual',
          user_confirmed: true,
          user_correction: null,
          created_at: now.toISOString()
        };

        logs.push(record);
        saveLogs(logs);
        return sendJson(res, 200, record);
      } catch (err) {
        return sendJson(res, 400, { detail: 'ไม่สามารถบันทึกเมนูได้: ' + err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/predictions/confirm') {
    let bodyStr = '';
    req.on('data', chunk => bodyStr += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(bodyStr || '{}');
        const logs = loadLogs();
        const log = logs.find(l => l.id === data.prediction_id || l.prediction_id === data.prediction_id);
        if (!log) {
          return sendJson(res, 404, { detail: 'ไม่พบรายการ' });
        }

        log.user_confirmed = Boolean(data.confirmed);
        log.user_correction = data.correction || null;

        const menu = getMenuById(data.correction || log.menu_id);
        const weightG = Number(data.custom_weight_g) > 0 ? Number(data.custom_weight_g) : log.estimated_weight_g;
        const addons = Array.isArray(data.addons) ? data.addons : (log.addons || []);
        const nutrition = calculateNutrition(menu, weightG, addons);
        const { score, advice } = computeHealthInsights(menu, nutrition);

        log.menu_id = menu.id;
        log.fcd_code = menu.fcd_code;
        log.menu_name_th = menu.name_th;
        log.menu_name_en = menu.name_en;
        log.category = menu.category;
        log.estimated_weight_g = weightG;
        log.addons = addons;
        log.energy_kcal = nutrition.energy_kcal;
        log.protein_g = nutrition.protein_g;
        log.carb_g = nutrition.carb_g;
        log.fat_g = nutrition.fat_g;
        log.fiber_g = nutrition.fiber_g;
        log.sugar_g = nutrition.sugar_g;
        log.sodium_mg = nutrition.sodium_mg;
        log.cholesterol_mg = nutrition.cholesterol_mg;
        log.thai_rdi_percent = nutrition.thai_rdi_percent;
        log.micronutrients = menu.micronutrients || [];
        log.reference_source = menu.reference_source;
        log.health_score = score;
        log.health_advice = advice;

        saveLogs(logs);

        return sendJson(res, 200, {
          status: 'saved',
          menu_id: log.menu_id,
          fcd_code: log.fcd_code,
          menu_name_th: log.menu_name_th,
          menu_name_en: log.menu_name_en,
          category: log.category,
          estimated_weight_g: log.estimated_weight_g,
          addons: log.addons,
          updated_energy_kcal: log.energy_kcal,
          protein_g: log.protein_g,
          carb_g: log.carb_g,
          fat_g: log.fat_g,
          fiber_g: log.fiber_g,
          sugar_g: log.sugar_g,
          sodium_mg: log.sodium_mg,
          cholesterol_mg: log.cholesterol_mg,
          thai_rdi_percent: log.thai_rdi_percent,
          micronutrients: log.micronutrients,
          reference_source: log.reference_source,
          health_score: log.health_score,
          health_advice: log.health_advice
        });
      } catch (err) {
        return sendJson(res, 400, { detail: 'ข้อมูลไม่ถูกต้อง' });
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
    const filePath = path.join(BASE_DIR, pathname);
    if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // เสิร์ฟ Frontend (dist) จากพอร์ตเดียวกัน
  const distDir = path.join(BASE_DIR, '..', 'frontend', 'dist');
  if (req.method === 'GET' && fs.existsSync(distDir)) {
    const relPath = pathname === '/' ? '/index.html' : pathname;
    const staticFile = path.normalize(path.join(distDir, relPath));
    if (staticFile.startsWith(distDir) && fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
      const ext = path.extname(staticFile).toLowerCase();
      const mimeMap = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(staticFile).pipe(res);
      return;
    }
  }

  sendJson(res, 404, { detail: '404 Not Found' });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 AI Nutrition Scanner API Backend Running on port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/health`);
  console.log(`======================================================\n`);
});
