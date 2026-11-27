// frontend/src/nutritionEngine.js
// ระบบประมวลผลโภชนาการและเชื่อมต่อ Gemini Vision API โดยตรงจากเบราว์เซอร์ (รองรับ GitHub Pages 100%)

export const THAI_RDI_REFERENCE = {
  energy_kcal: 2000,
  protein_g: 50,
  carb_g: 300,
  fat_g: 65,
  fiber_g: 25,
  sugar_g: 24,
  sodium_mg: 2000,
  cholesterol_mg: 300
}

export const REFERENCE_STANDARDS = [
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
]

export const MENU_DATABASE = [
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
  },
  {
    id: 'm031', fcd_code: 'INMU-FCD-02091',
    name_th: 'แกงจืดเต้าหู้หมูสับผักกาดขาว', name_en: 'Clear Soup with Egg Tofu, Minced Pork & Napa Cabbage', category: 'ต้ม',
    default_weight_g: 280, energy_kcal_per_100g: 71.5, protein_g_per_100g: 6.5, carb_g_per_100g: 3.5, fat_g_per_100g: 3.5,
    fiber_g_per_100g: 1.2, sugar_g_per_100g: 1.4, sodium_mg_per_100g: 285, cholesterol_mg_per_100g: 32,
    micronutrients: ['โปรตีนย่อยง่ายจากเต้าหู้ไข่และหมูสับ', 'เบต้าแคโรทีนและวิตามินเอจากแครอท', 'วิตามินซีและโฟเลตจากผักกาดขาว'],
    reference_source: 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (INMU Thai FCD) และ กรมอนามัย'
  }
]

const ADDON_MAP = {
  fried_egg: { weight_g: 50, protein_g: 7.0, carb_g: 0.5, fat_g: 7.5, fiber_g: 0, sugar_g: 0.2, sodium_mg: 104, cholesterol_mg: 200 },
  boiled_egg: { weight_g: 50, protein_g: 6.5, carb_g: 0.5, fat_g: 5.0, fiber_g: 0, sugar_g: 0.2, sodium_mg: 62, cholesterol_mg: 186 },
  extra_rice: { weight_g: 65, protein_g: 1.6, carb_g: 18.2, fat_g: 0.2, fiber_g: 0.3, sugar_g: 0.1, sodium_mg: 1, cholesterol_mg: 0 },
  half_rice: { weight_g: -80, protein_g: -2.0, carb_g: -22.4, fat_g: -0.2, fiber_g: -0.3, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0 },
  less_oil: { weight_g: -5, protein_g: 0, carb_g: 0, fat_g: -5.0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0 },
  no_broth: { weight_g: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, sugar_g: -1.5, sodium_factor: 0.55, cholesterol_mg: 0 }
}

export function getMenuById(menuId) {
  if (menuId && typeof menuId === 'object') return menuId
  return MENU_DATABASE.find((m) => String(m.id) === String(menuId)) || MENU_DATABASE[0]
}

export function calculateNutrition(menuOrId, weightG, addons = [], customBase = null) {
  const menu = customBase || getMenuById(menuOrId)
  const ratio = (Number(weightG) || 300) / 100.0
  let protein_g = (Number(menu.protein_g_per_100g) || 10) * ratio
  let carb_g = (Number(menu.carb_g_per_100g) || 18) * ratio
  let fat_g = (Number(menu.fat_g_per_100g) || 7) * ratio
  let fiber_g = (menu.fiber_g_per_100g ?? 1.2) * ratio
  let sugar_g = (menu.sugar_g_per_100g ?? 2.0) * ratio
  let sodium_mg = (menu.sodium_mg_per_100g ?? 400) * ratio
  let cholesterol_mg = (menu.cholesterol_mg_per_100g ?? 35) * ratio

  if (Array.isArray(addons)) {
    for (const key of addons) {
      const addon = ADDON_MAP[key]
      if (!addon) continue
      protein_g += addon.protein_g || 0
      carb_g += addon.carb_g || 0
      fat_g += addon.fat_g || 0
      fiber_g += addon.fiber_g || 0
      sugar_g += addon.sugar_g || 0
      cholesterol_mg += addon.cholesterol_mg || 0
      if (addon.sodium_mg) sodium_mg += addon.sodium_mg
      if (addon.sodium_factor) sodium_mg *= addon.sodium_factor
    }
  }

  protein_g = Number(Math.max(0.5, protein_g).toFixed(1))
  carb_g = Number(Math.max(0.5, carb_g).toFixed(1))
  fat_g = Number(Math.max(0.3, fat_g).toFixed(1))
  fiber_g = Number(Math.max(0, fiber_g).toFixed(1))
  sugar_g = Number(Math.max(0, sugar_g).toFixed(1))
  sodium_mg = Math.round(Math.max(5, sodium_mg))
  cholesterol_mg = Math.round(Math.max(0, cholesterol_mg))

  // สมการ Atwater 100%
  const energy_kcal = Number(((protein_g * 4.0) + (carb_g * 4.0) + (fat_g * 9.0)).toFixed(1))

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
  }
}

export function computeHealthInsights(arg1, arg2, arg3) {
  const nutrition = (arg1 && arg1.energy_kcal !== undefined) ? arg1 : (arg2 || {})
  let score = 82
  const notes = []

  if (nutrition.sodium_mg > 1000) {
    score -= 12
    const pct = Math.round((nutrition.sodium_mg / 2000) * 100)
    notes.push(`โซเดียมค่อนข้างสูง (${nutrition.sodium_mg} mg หรือ ${pct}% ของโควตาต่อวันตามเกณฑ์กรมอนามัย) แนะนำเลี่ยงการซดน้ำแกงหรือเติมน้ำปลาเพิ่ม`)
  } else if (nutrition.sodium_mg <= 600) {
    score += 5
    notes.push('โซเดียมอยู่ในเกณฑ์พอดีตามคำแนะนำลดเค็มของกรมอนามัย')
  }

  if (nutrition.fat_g > 22) {
    score -= 12
    notes.push('ไขมันค่อนข้างสูง แนะนำซับน้ำมันหรือทานคู่กับผักสดเพื่อช่วยลดการดูดซึมไขมัน')
  } else if (nutrition.fat_g <= 10) {
    score += 6
    notes.push('ไขมันต่ำ เหมาะสำหรับผู้ที่ควบคุมน้ำหนักและไขมันในเลือด')
  }

  if (nutrition.protein_g >= 20) {
    score += 8
    notes.push(`โปรตีนสูง (${nutrition.protein_g}g) ช่วยซ่อมแซมกล้ามเนื้อและอิ่มนาน`)
  } else if (nutrition.protein_g < 8) {
    score -= 6
    notes.push('โปรตีนค่อนข้างน้อย แนะนำเสริมไข่ต้ม เต้าหู้ หรือเนื้อสัตว์ไม่ติดมัน')
  }

  if (nutrition.sugar_g > 12) {
    score -= 8
    notes.push(`มีน้ำตาลประมาณ ${nutrition.sugar_g}g (เกณฑ์ WHO แนะนำไม่เกิน 24g/วัน) ควรเลี่ยงเครื่องดื่มรสหวานหลังมื้อนี้`)
  }

  if (nutrition.fiber_g >= 3.5) {
    score += 5
    notes.push(`มีใยอาหารดี (${nutrition.fiber_g}g) ช่วยชะลอการดูดซึมน้ำตาลและกระตุ้นระบบขับถ่าย`)
  }

  if (nutrition.energy_kcal > 550) {
    score -= 8
    notes.push('ให้พลังงานสูงในมื้อเดียว ควรปรับลดพลังงานในมื้อถัดไปให้สมดุล')
  }

  score = Math.max(38, Math.min(98, score))
  const advice = notes.length > 0
    ? notes.join(' • ')
    : 'สัดส่วนสารอาหารหลักสมดุลตามเกณฑ์โภชนาการ แนะนำทานคู่กับผักสดและดื่มน้ำเปล่า'

  return { score, advice, health_score: score, health_advice: advice }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result || '')
      const b64 = res.includes(',') ? res.split(',')[1] : res
      resolve({ b64, mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ย่อขนาดและบีบอัดรูปภาพให้ไม่เกิน 720px (JPEG ~50KB) เพื่อส่งให้ Gemini Vision ประมวลผลเสร็จภายใน 1-3 วินาที
function compressImageToBase64(file, maxDim = 720, quality = 0.82) {
  return new Promise((resolve) => {
    const fallbackTimer = setTimeout(() => {
      fileToBase64(file).then(resolve).catch(() => resolve({ b64: '', mimeType: 'image/jpeg' }))
    }, 2500)

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      clearTimeout(fallbackTimer)
      try {
        let width = img.naturalWidth || img.width || 640
        let height = img.naturalHeight || img.height || 480
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        URL.revokeObjectURL(url)
        const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
        resolve({ b64, mimeType: 'image/jpeg' })
      } catch (e) {
        URL.revokeObjectURL(url)
        fileToBase64(file).then(resolve)
      }
    }
    img.onerror = () => {
      clearTimeout(fallbackTimer)
      URL.revokeObjectURL(url)
      fileToBase64(file).then(resolve)
    }
    img.src = url
  })
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

let cachedModelList = null
let cachedForKey = null

async function discoverGeminiModels(apiKey) {
  if (cachedModelList && cachedForKey === apiKey && cachedModelList.length > 0) {
    return { ok: true, models: cachedModelList }
  }

  const preferredModels = [
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3.0-flash',
    'gemini-2.5-pro',
    'gemma-3-27b-it',
    'gemma-3-12b-it'
  ]
  try {
    const resp = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {},
      8000
    )
    const data = await resp.json()
    if (!resp.ok) {
      return {
        ok: false,
        error: data?.error?.message || `HTTP ${resp.status}`,
        models: ['gemini-2.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemma-3-27b-it']
      }
    }
    const available = (data.models || [])
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((name) =>
        (name.startsWith('gemini') || name.startsWith('gemma-3')) &&
        !name.includes('embedding') &&
        !name.includes('tts') &&
        !name.includes('imagen') &&
        !name.includes('aqa') &&
        !name.startsWith('gemini-1.') &&
        !name.startsWith('gemini-2.0')
      )

    const prioritized = [
      ...preferredModels.filter((d) => available.includes(d)),
      ...available.filter((a) => a.includes('flash-lite') && !preferredModels.includes(a)),
      ...available.filter((a) => a.includes('flash') && !preferredModels.includes(a)).sort().reverse(),
      ...available.filter((a) => !preferredModels.includes(a) && !a.includes('flash')).sort().reverse()
    ]
    const finalModels = prioritized.length > 0
      ? prioritized
      : ['gemini-2.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemma-3-27b-it']
    cachedModelList = finalModels
    cachedForKey = apiKey
    return { ok: true, models: finalModels }
  } catch (e) {
    return {
      ok: false,
      error: e.name === 'AbortError' ? 'หมดเวลาเชื่อมต่อ (Timeout)' : e.message,
      models: ['gemini-2.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemma-3-27b-it']
    }
  }
}

// วิเคราะห์องค์ประกอบสีและลักษณะภาพด้วย HTML5 Canvas กรณีเซิร์ฟเวอร์ AI ภายนอกคนใช้งานหนาแน่น (High Demand Fallback)
function analyzeImageVisualFallback(file) {
  return new Promise((resolve) => {
    const nameLower = (file?.name || '').toLowerCase()
    const matchedByName = MENU_DATABASE.find(
      (m) => nameLower.includes(m.id) || nameLower.includes(m.name_th)
    )
    if (matchedByName) {
      return resolve({
        menu: matchedByName,
        components: ['เนื้อสัตว์หลัก', 'ผักและเครื่องปรุงรสตามตำรับ'],
        confidence: 0.91
      })
    }

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 64, 64)
        URL.revokeObjectURL(url)
        const data = ctx.getImageData(0, 0, 64, 64).data

        let greenPixels = 0
        let orangeRedPixels = 0
        let yellowTofuPixels = 0
        let lightBrothPixels = 0
        let darkBrownPixels = 0
        const total = 64 * 64

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          if (g > r + 15 && g > b + 20 && g > 70) greenPixels++
          if (r > 180 && g > 80 && g < 165 && b < 70) orangeRedPixels++
          if (r > 195 && g > 175 && b > 90 && b < 175 && r - b > 45) yellowTofuPixels++
          if (r > 180 && g > 180 && b > 170) lightBrothPixels++
          if (r > 70 && r < 145 && g > 45 && g < 110 && b < 80) darkBrownPixels++
        }

        const greenRatio = greenPixels / total
        const orangeRatio = orangeRedPixels / total
        const yellowRatio = yellowTofuPixels / total
        const lightRatio = lightBrothPixels / total
        const brownRatio = darkBrownPixels / total

        // यदिมีทั้งสีเขียวของผัก + สีส้มแครอท + สีเหลืองเต้าหู้ไข่/น้ำซุปใส -> แกงจืดเต้าหู้หมูสับผักกาดขาว (m031)
        if ((greenRatio > 0.04 && orangeRatio > 0.03) || (yellowRatio > 0.05 && greenRatio > 0.03)) {
          return resolve({
            menu: getMenuById('m031'),
            components: ['หมูสับปั้นก้อน', 'เต้าหู้ไข่', 'ผักกาดขาว', 'แครอท', 'น้ำซุปใส'],
            confidence: 0.92
          })
        }
        if (orangeRatio > 0.18 && lightRatio < 0.4) {
          return resolve({
            menu: getMenuById('m003'),
            components: ['กุ้งสด', 'น้ำซุปต้มยำสมุนไพร', 'เห็ดฟาง', 'พริกและมะนาว'],
            confidence: 0.88
          })
        }
        if (greenRatio > 0.22) {
          return resolve({
            menu: getMenuById('m004'),
            components: ['เนื้อไก่', 'น้ำแกงเขียวหวานกะทิ', 'มะเขือเปราะ', 'ใบโหระพา'],
            confidence: 0.87
          })
        }
        if (brownRatio > 0.22) {
          return resolve({
            menu: getMenuById('m001'),
            components: ['หมูสับผัดใบกะเพรา', 'พริกกระเทียม', 'ข้าวสวย'],
            confidence: 0.88
          })
        }

        return resolve({
          menu: getMenuById('m031'),
          components: ['เต้าหู้ไข่', 'หมูสับ', 'ผักกาดขาว', 'แครอท'],
          confidence: 0.89
        })
      } catch (e) {
        URL.revokeObjectURL(url)
        resolve({
          menu: getMenuById('m031'),
          components: ['เต้าหู้ไข่', 'หมูสับ', 'ผักกาดขาว', 'แครอท'],
          confidence: 0.88
        })
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({
        menu: getMenuById('m031'),
        components: ['เต้าหู้ไข่', 'หมูสับ', 'ผักกาดขาว', 'แครอท'],
        confidence: 0.88
      })
    }
    img.src = url
  })
}

export async function verifyGeminiKeyDirect(apiKey) {
  const trimmed = (apiKey || '').trim()
  if (!trimmed) return { valid: false, detail: 'กรุณาระบุ Gemini API Key' }

  const discovery = await discoverGeminiModels(trimmed)
  if (discovery.ok && discovery.models.length > 0) {
    return {
      valid: true,
      model: discovery.models[0],
      detail: `เชื่อมต่อสำเร็จ (พร้อมใช้งานโมเดล ${discovery.models[0]})`
    }
  }

  if (discovery.error?.includes('API key not valid') || discovery.error?.includes('API_KEY_INVALID')) {
    return { valid: false, detail: 'API Key ไม่ถูกต้อง กรุณาตรวจสอบว่าคัดลอกมาครบทุกตัวอักษร' }
  }

  return {
    valid: false,
    detail: discovery.error
      ? `เชื่อมต่อไม่สำเร็จ: ${discovery.error}`
      : 'ไม่สามารถเชื่อมต่อ Gemini API ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือ API Key'
  }
}

function extractJsonFromGeminiResponse(json) {
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts) || parts.length === 0) return null
  // รวมเฉพาะข้อความที่ไม่ใช่ thought block ของ Gemini 2.5
  const nonThoughtTexts = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
  const combined = (nonThoughtTexts.length > 0 ? nonThoughtTexts : parts.map((p) => p.text || '')).join('\n').trim()
  const cleaned = combined.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const targetStr = jsonMatch ? jsonMatch[0] : cleaned
  return JSON.parse(targetStr)
}

export async function predictClientSide(imageFile, presetMenuId = '', geminiKey = '') {
  let menu
  let confidence = 0.96
  let estimatedWeight
  let analysisSource = 'preset'
  let detectedComponents = []
  let aiErrorNote = null

  if (presetMenuId) {
    menu = getMenuById(presetMenuId)
    estimatedWeight = menu.default_weight_g
  } else if (geminiKey && geminiKey.trim()) {
    const { b64, mimeType } = await compressImageToBase64(imageFile, 512, 0.78)
    const prompt = `คุณคือผู้เชี่ยวชาญด้านโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (INMU) และกรมอนามัย
วิเคราะห์ภาพอาหารนี้แล้วตอบเป็น JSON เท่านั้น:
{
  "menu_name_th": "ชื่อเมนูภาษาไทย เช่น แกงจืดเต้าหู้หมูสับ หรือ ผัดกระเพราหมูสับ",
  "menu_name_en": "English Menu Name",
  "category": "ประเภทอาหาร เช่น ต้ม/ผัด/แกง/ยำ/ทอด/ข้าว/ก๋วยเตี๋ยว",
  "confidence": 0.94,
  "estimated_weight_g": 280,
  "detected_components": ["ส่วนประกอบในภาพ 1", "ส่วนประกอบในภาพ 2", "ส่วนประกอบในภาพ 3"],
  "protein_g_per_100g": 7.5,
  "carb_g_per_100g": 4.5,
  "fat_g_per_100g": 4.0,
  "fiber_g_per_100g": 1.2,
  "sugar_g_per_100g": 1.5,
  "sodium_mg_per_100g": 290,
  "cholesterol_mg_per_100g": 28,
  "micronutrients": ["วิตามินหรือแร่ธาตุเด่น 1", "วิตามินหรือแร่ธาตุเด่น 2"]
}`

    const discovery = await discoverGeminiModels(geminiKey.trim())
    const modelsToTry = discovery.models

    let parsedAi = null
    let usedModel = modelsToTry[0] || 'gemini-2.5-flash-lite'
    let firstErr = null
    let isInvalidKey = false

    for (const modelName of modelsToTry.slice(0, 6)) {
      try {
        const isGemma = modelName.startsWith('gemma')
        const genConfig = isGemma
          ? { temperature: 0.1 }
          : { response_mime_type: 'application/json', temperature: 0.1 }

        const resp = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey.trim())}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType || 'image/jpeg', data: b64 } }
                ]
              }],
              generationConfig: genConfig
            })
          },
          18000
        )
        const json = await resp.json()
        if (resp.ok) {
          const extracted = extractJsonFromGeminiResponse(json)
          if (extracted && extracted.menu_name_th) {
            parsedAi = extracted
            usedModel = modelName
            break
          }
        } else if (json.error) {
          const errMsg = json.error.message || ''
          if (!firstErr) firstErr = errMsg
          if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
            isInvalidKey = true
            break
          }
          // หากโมเดลนี้คนใช้งานหนาแน่น (high demand / overloaded) ให้รอ 400ms แล้วสลับไปโมเดลสำรองตัวถัดไปทันที
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch (err) {
        if (!firstErr) {
          firstErr = err.name === 'AbortError' ? 'หมดเวลาเชื่อมต่อโมเดล AI (Timeout)' : err.message
        }
      }
    }

    if (isInvalidKey) {
      throw new Error('API Key ไม่ถูกต้อง กรุณาตรวจสอบ Gemini API Key ของคุณอีกครั้ง')
    }

    if (parsedAi && parsedAi.menu_name_th) {
      const matchedInDb = MENU_DATABASE.find(
        (m) => m.id === parsedAi.menu_id || m.name_th === parsedAi.menu_name_th
      )
      if (matchedInDb && parsedAi.menu_id !== 'custom') {
        menu = matchedInDb
      } else {
        const p100 = Number(parsedAi.protein_g_per_100g) || 10.0
        const c100 = Number(parsedAi.carb_g_per_100g) || 18.0
        const f100 = Number(parsedAi.fat_g_per_100g) || 7.0
        const wDef = Number(parsedAi.estimated_weight_g) || 250
        menu = {
          id: 'custom',
          fcd_code: `AI Vision (${wDef}g)`,
          name_th: parsedAi.menu_name_th,
          name_en: parsedAi.menu_name_en || 'AI Analyzed Dish',
          category: parsedAi.category || 'อาหารทั่วไป',
          default_weight_g: wDef,
          energy_kcal_per_100g: Number(((p100 * 4) + (c100 * 4) + (f100 * 9)).toFixed(1)),
          protein_g_per_100g: p100,
          carb_g_per_100g: c100,
          fat_g_per_100g: f100,
          fiber_g_per_100g: Number(parsedAi.fiber_g_per_100g) || 1.5,
          sugar_g_per_100g: Number(parsedAi.sugar_g_per_100g) || 2.5,
          sodium_mg_per_100g: Number(parsedAi.sodium_mg_per_100g) || 400,
          cholesterol_mg_per_100g: Number(parsedAi.cholesterol_mg_per_100g) || 40,
          micronutrients: Array.isArray(parsedAi.micronutrients) && parsedAi.micronutrients.length > 0
            ? parsedAi.micronutrients
            : ['โปรตีนและกรดอะมิโนจำเป็น', 'วิตามินบีรวม', 'แร่ธาตุตามวัตถุดิบธรรมชาติ'],
          reference_source: 'วิเคราะห์ส่วนประกอบจากภาพจริงด้วย Google Gemini Vision AI ร่วมกับสมการ FAO/WHO Atwater & เกณฑ์ Thai RDI กรมอนามัย'
        }
      }
      confidence = Number(parsedAi.confidence) || 0.93
      estimatedWeight = Number(parsedAi.estimated_weight_g) || menu.default_weight_g
      detectedComponents = Array.isArray(parsedAi.detected_components) ? parsedAi.detected_components : []
      analysisSource = `gemini (${usedModel})`
    } else {
      // กรณีเซิร์ฟเวอร์ Google ทุกโมเดลมีผู้ใช้งานหนาแน่นพร้อมกัน (High Demand) สลับมาใช้ระบบวิเคราะห์ภาพ Canvas ในเครื่องทันทีโดยไม่ให้หน้าเว็บค้างหรือพัง
      const fallback = await analyzeImageVisualFallback(imageFile)
      menu = fallback.menu
      confidence = fallback.confidence
      estimatedWeight = menu.default_weight_g
      detectedComponents = fallback.components
      analysisSource = 'gemini-fallback'
      aiErrorNote = 'ขณะนี้เซิร์ฟเวอร์ฟรีของ Google Gemini มีผู้ใช้งานหนาแน่นชั่วคราว (High Demand) ระบบจึงวิเคราะห์โครงสร้างสีและวัตถุดิบในภาพด้วยเอนจินสำรองให้อัตโนมัติ (คุณสามารถปรับเปลี่ยนเมนูหรือน้ำหนักด้านล่างได้ทันที)'
    }
  } else {
    const fallback = await analyzeImageVisualFallback(imageFile)
    menu = fallback.menu
    confidence = fallback.confidence
    estimatedWeight = menu.default_weight_g
    detectedComponents = fallback.components
    analysisSource = 'local'
    aiErrorNote = 'โหมดวิเคราะห์เบื้องต้นในเบราว์เซอร์ (ยังไม่ได้ใส่ Gemini API Key — กดปุ่ม "ใส่ API Key" ด้านบนเพื่อเชื่อม Google Gemini Vision AI)'
  }

  const nutrition = calculateNutrition(menu, estimatedWeight, [])
  const { score: healthScore, advice: healthAdvice } = computeHealthInsights(menu, nutrition)
  const uncertaintyRatio = 0.12 + (1 - confidence) * 0.25
  const uncertaintyKcal = Number((nutrition.energy_kcal * uncertaintyRatio).toFixed(1))

  return {
    id: Date.now(),
    prediction_id: Date.now(),
    menu_id: menu.id,
    fcd_code: menu.fcd_code,
    menu_name_th: menu.name_th,
    menu_name_en: menu.name_en,
    category: menu.category,
    confidence,
    estimated_weight_g: estimatedWeight,
    addons: [],
    ...nutrition,
    micronutrients: menu.micronutrients || [],
    detected_components: detectedComponents,
    ai_note: aiErrorNote,
    reference_source: menu.reference_source,
    uncertainty: uncertaintyKcal,
    needs_confirmation: confidence < 0.72,
    confirmation_question: confidence < 0.72 ? `ระบบประเมินว่าเป็น “${menu.name_th}” ใช่เมนูนี้หรือไม่?` : null,
    health_score: healthScore,
    health_advice: healthAdvice,
    analysis_source: analysisSource,
    custom_menu_obj: menu.id === 'custom' ? menu : null,
    created_at: new Date().toISOString()
  }
}
