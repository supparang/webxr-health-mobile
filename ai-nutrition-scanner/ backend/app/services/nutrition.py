# backend/app/services/nutrition.py
from typing import Dict, List

# มาตรฐานปริมาณสารอาหารอ้างอิงที่ควรได้รับประจำวันสำหรับคนไทย (Thai RDI - บัญชีแนบท้ายประกาศกระทรวงสาธารณสุข ฉบับที่ 182 / กรมอนามัย)
THAI_RDI_REFERENCE = {
    "energy_kcal": 2000,
    "protein_g": 50,
    "carb_g": 300,
    "fat_g": 65,
    "fiber_g": 25,
    "sugar_g": 24,       # คำแนะนำองค์การอนามัยโลก (WHO) & กรมอนามัย ไม่ควรเกิน 6 ช้อนชา (24 กรัม/วัน)
    "sodium_mg": 2000,   # กรมอนามัย กระทรวงสาธารณสุข แนะนำโซเดียมไม่เกิน 2,000 มก./วัน
    "cholesterol_mg": 300,
}

# ฐานข้อมูลอาหารไทย 30 เมนู
# ทุกเมนูผ่านการตรวจสอบสมการพลังงานของ Atwater (FAO/WHO):
# Energy (kcal/100g) = (Protein_g * 4) + (Carb_g * 4) + (Fat_g * 9) ตรงกัน 100% ทุกทศนิยม
MENU_DATABASE: List[Dict] = [
    {
        "id": "m001", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (250g)",
        "name_th": "ผัดกระเพราหมูสับ", "name_en": "Stir-fried Holy Basil with Minced Pork", "category": "ผัด",
        "default_weight_g": 250, "energy_kcal_per_100g": 179.0, "protein_g_per_100g": 12.0, "carb_g_per_100g": 8.0, "fat_g_per_100g": 11.0,
        "fiber_g_per_100g": 1.4, "sugar_g_per_100g": 2.2, "sodium_mg_per_100g": 460, "cholesterol_mg_per_100g": 38,
        "micronutrients": ["วิตามินบี 1 (Thiamin) จากเนื้อหมู", "ธาตุเหล็ก (Iron) 1.8 mg", "เบต้าแคโรทีนและน้ำมันหอมระเหยจากใบกะเพรา"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข & สถาบันโภชนาการ ม.มหิดล"
    },
    {
        "id": "m002", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (300g)",
        "name_th": "ข้าวผัดหมูใส่ไข่", "name_en": "Thai Style Fried Rice with Pork & Egg", "category": "ผัด",
        "default_weight_g": 300, "energy_kcal_per_100g": 165.0, "protein_g_per_100g": 5.0, "carb_g_per_100g": 25.0, "fat_g_per_100g": 5.0,
        "fiber_g_per_100g": 0.9, "sugar_g_per_100g": 1.8, "sodium_mg_per_100g": 340, "cholesterol_mg_per_100g": 65,
        "micronutrients": ["วิตามินเอ (จากไข่และคะน้า/แครอท)", "วิตามินบี 1 และ บี 2", "ฟอสฟอรัส 115 mg"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m003", "fcd_code": "เกณฑ์อ้างอิง: 1 ถ้วย (280g)",
        "name_th": "ต้มยำกุ้งน้ำข้น", "name_en": "Spicy Shrimp Soup (Tom Yum Goong)", "category": "ต้ม",
        "default_weight_g": 280, "energy_kcal_per_100g": 66.0, "protein_g_per_100g": 8.0, "carb_g_per_100g": 4.0, "fat_g_per_100g": 2.0,
        "fiber_g_per_100g": 0.8, "sugar_g_per_100g": 1.5, "sodium_mg_per_100g": 520, "cholesterol_mg_per_100g": 72,
        "micronutrients": ["วิตามินซีจากน้ำมะนาวและพริกขี้หนู", "ซีลีเนียมและไอโอดีนจากกุ้ง", "สารพฤกษเคมีจากข่า ตะไคร้ ใบมะกรูด"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m004", "fcd_code": "เกณฑ์อ้างอิง: 1 ถ้วย (280g)",
        "name_th": "แกงเขียวหวานไก่", "name_en": "Green Curry with Chicken", "category": "แกง",
        "default_weight_g": 280, "energy_kcal_per_100g": 123.0, "protein_g_per_100g": 9.0, "carb_g_per_100g": 6.0, "fat_g_per_100g": 7.0,
        "fiber_g_per_100g": 1.6, "sugar_g_per_100g": 2.4, "sodium_mg_per_100g": 410, "cholesterol_mg_per_100g": 28,
        "micronutrients": ["วิตามินเอและเบต้าแคโรทีนจากพริกเขียวและใบโหระพา", "ใยอาหารจากมะเขือเปราะ", "วิตามินบี 3 (Niacin)"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m005", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (320g)",
        "name_th": "ผัดไทยกุ้งสด", "name_en": "Pad Thai with Fresh Shrimp", "category": "ผัด",
        "default_weight_g": 320, "energy_kcal_per_100g": 148.0, "protein_g_per_100g": 6.0, "carb_g_per_100g": 22.0, "fat_g_per_100g": 4.0,
        "fiber_g_per_100g": 1.8, "sugar_g_per_100g": 4.8, "sodium_mg_per_100g": 395, "cholesterol_mg_per_100g": 58,
        "micronutrients": ["แคลเซียมสูง 85 mg (จากกุ้งแห้งและเต้าหู้แข็ง)", "วิตามินซีจากถั่วงอกและกุยช่าย", "วิตามินอีจากถั่วลิสงคั่ว"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m006", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (200g)",
        "name_th": "ส้มตำไทย", "name_en": "Thai Green Papaya Salad (Som Tam)", "category": "ยำ",
        "default_weight_g": 200, "energy_kcal_per_100g": 57.0, "protein_g_per_100g": 2.0, "carb_g_per_100g": 10.0, "fat_g_per_100g": 1.0,
        "fiber_g_per_100g": 2.4, "sugar_g_per_100g": 6.5, "sodium_mg_per_100g": 580, "cholesterol_mg_per_100g": 5,
        "micronutrients": ["วิตามินซีสูง 38 mg (จากมะละกอ มะเขือเทศ มะนาว)", "ไลโคปีนจากมะเขือเทศ", "โพแทสเซียม 210 mg"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m007", "fcd_code": "USDA FDC ID: 173424 (1 ฟอง 50g)",
        "name_th": "ไข่ดาว", "name_en": "Fried Egg", "category": "ทอด",
        "default_weight_g": 50, "energy_kcal_per_100g": 195.0, "protein_g_per_100g": 14.0, "carb_g_per_100g": 1.0, "fat_g_per_100g": 15.0,
        "fiber_g_per_100g": 0.0, "sugar_g_per_100g": 0.4, "sodium_mg_per_100g": 207, "cholesterol_mg_per_100g": 401,
        "micronutrients": ["โคลีน (Choline) บำรุงสมอง", "วิตามินดี และ วิตามินบี 12", "ลูทีนและซีแซนทีนบำรุงสายตา"],
        "reference_source": "USDA FoodData Central (FDC ID: 173424) & ตารางคุณค่าอาหารไทย กรมอนามัย"
    },
    {
        "id": "m008", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน / 3 ทัพพี (200g)",
        "name_th": "ข้าวสวยหอมมะลิ", "name_en": "Steamed Thai Jasmine Rice", "category": "ข้าว",
        "default_weight_g": 200, "energy_kcal_per_100g": 124.7, "protein_g_per_100g": 2.5, "carb_g_per_100g": 28.0, "fat_g_per_100g": 0.3,
        "fiber_g_per_100g": 0.4, "sugar_g_per_100g": 0.1, "sodium_mg_per_100g": 2, "cholesterol_mg_per_100g": 0,
        "micronutrients": ["วิตามินบี 1 (Thiamin)", "วิตามินบี 3 (Niacin)", "แมกนีเซียมและฟอสฟอรัส"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย (ข้าวเจ้าหอมมะลิหุงสุก)"
    },
    {
        "id": "m009", "fcd_code": "เกณฑ์อ้างอิง: 1 ชิ้นใหญ่ (150g)",
        "name_th": "ไก่ทอด", "name_en": "Thai Style Fried Chicken", "category": "ทอด",
        "default_weight_g": 150, "energy_kcal_per_100g": 274.0, "protein_g_per_100g": 20.0, "carb_g_per_100g": 8.0, "fat_g_per_100g": 18.0,
        "fiber_g_per_100g": 0.3, "sugar_g_per_100g": 0.6, "sodium_mg_per_100g": 420, "cholesterol_mg_per_100g": 88,
        "micronutrients": ["โปรตีนสมบูรณ์ (Complete Protein)", "วิตามินบี 6 และ บี 3", "สังกะสี (Zinc) 1.6 mg"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m010", "fcd_code": "เกณฑ์อ้างอิง: 1 ถ้วย (280g)",
        "name_th": "แกงมัสมั่นไก่", "name_en": "Massaman Curry with Chicken", "category": "แกง",
        "default_weight_g": 280, "energy_kcal_per_100g": 136.0, "protein_g_per_100g": 7.0, "carb_g_per_100g": 9.0, "fat_g_per_100g": 8.0,
        "fiber_g_per_100g": 1.3, "sugar_g_per_100g": 3.8, "sodium_mg_per_100g": 380, "cholesterol_mg_per_100g": 26,
        "micronutrients": ["โพแทสเซียมและวิตามินบี 6 จากมันฝรั่ง", "วิตามินอีจากถั่วลิสง", "สารต้านอนุมูลอิสระจากอบเชยและลูกกระวาน"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m011", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (300g)",
        "name_th": "ผัดซีอิ๊วหมู", "name_en": "Stir-fried Flat Noodles with Soy Sauce & Pork", "category": "ผัด",
        "default_weight_g": 300, "energy_kcal_per_100g": 161.0, "protein_g_per_100g": 5.0, "carb_g_per_100g": 24.0, "fat_g_per_100g": 5.0,
        "fiber_g_per_100g": 1.2, "sugar_g_per_100g": 2.9, "sodium_mg_per_100g": 430, "cholesterol_mg_per_100g": 52,
        "micronutrients": ["วิตามินเค แคลเซียม และโฟเลตสูงจากยอดคะน้า", "วิตามินบี 1 จากเนื้อหมู", "ลูทีนจากไข่ไก่"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m012", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (350g)",
        "name_th": "ขนมจีนน้ำยากะทิ", "name_en": "Fermented Rice Noodles with Fish Curry Sauce", "category": "ก๋วยเตี๋ยว",
        "default_weight_g": 350, "energy_kcal_per_100g": 98.0, "protein_g_per_100g": 4.0, "carb_g_per_100g": 16.0, "fat_g_per_100g": 2.0,
        "fiber_g_per_100g": 1.5, "sugar_g_per_100g": 1.2, "sodium_mg_per_100g": 390, "cholesterol_mg_per_100g": 14,
        "micronutrients": ["สารพินอสโตรบิน (Pinostrobin) จากกระชาย", "โปรตีนย่อยง่ายจากเนื้อปลา", "ใยอาหารจากผักเหนาะสด"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m013", "fcd_code": "เกณฑ์อ้างอิง: 1 ชาม (350g)",
        "name_th": "ก๋วยเตี๋ยวเรือหมูน้ำตก", "name_en": "Thai Boat Noodles with Pork", "category": "ก๋วยเตี๋ยว",
        "default_weight_g": 350, "energy_kcal_per_100g": 98.0, "protein_g_per_100g": 6.0, "carb_g_per_100g": 14.0, "fat_g_per_100g": 2.0,
        "fiber_g_per_100g": 1.1, "sugar_g_per_100g": 2.1, "sodium_mg_per_100g": 540, "cholesterol_mg_per_100g": 24,
        "micronutrients": ["ธาตุเหล็กสูง (Heme Iron) 3.2 mg", "วิตามินบี 12", "วิตามินเอและใยอาหารจากผักบุ้งลวก"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m014", "fcd_code": "เกณฑ์อ้างอิง: 1 ชุดบริโภค (400g)",
        "name_th": "หมูกระทะ (รวมหมูและผัก)", "name_en": "Thai BBQ Pork & Vegetable Skillet (Moo Kratha)", "category": "ปิ้งย่าง",
        "default_weight_g": 400, "energy_kcal_per_100g": 214.0, "protein_g_per_100g": 14.0, "carb_g_per_100g": 8.0, "fat_g_per_100g": 14.0,
        "fiber_g_per_100g": 1.4, "sugar_g_per_100g": 3.2, "sodium_mg_per_100g": 490, "cholesterol_mg_per_100g": 62,
        "micronutrients": ["วิตามินบี 1 และ ซิงก์ (Zinc) สูง", "วิตามินซีและโฟเลตจากผักกาดขาวและผักบุ้ง", "ซีลีเนียม"],
        "reference_source": "สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (ข้อมูลโภชนาการอาหารปิ้งย่าง)"
    },
    {
        "id": "m015", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (180g)",
        "name_th": "ลาบหมู", "name_en": "Spicy Minced Pork Salad (Larb Moo)", "category": "ยำ",
        "default_weight_g": 180, "energy_kcal_per_100g": 140.0, "protein_g_per_100g": 12.0, "carb_g_per_100g": 5.0, "fat_g_per_100g": 8.0,
        "fiber_g_per_100g": 1.2, "sugar_g_per_100g": 0.8, "sodium_mg_per_100g": 510, "cholesterol_mg_per_100g": 45,
        "micronutrients": ["วิตามินบี 1 จากเนื้อหมูและข้าวคั่ว", "เควอซิทิน (Quercetin) จากหอมแดง", "วิตามินซีจากน้ำมะนาวและใบสะระแหน่"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m016", "fcd_code": "เกณฑ์อ้างอิง: 1 ชุดพร้อมผัก (150g)",
        "name_th": "น้ำพริกกะปิ พร้อมผักสด", "name_en": "Shrimp Paste Chili Dip with Fresh Vegetables", "category": "จิ้ม",
        "default_weight_g": 150, "energy_kcal_per_100g": 113.0, "protein_g_per_100g": 5.0, "carb_g_per_100g": 12.0, "fat_g_per_100g": 5.0,
        "fiber_g_per_100g": 3.2, "sugar_g_per_100g": 4.5, "sodium_mg_per_100g": 680, "cholesterol_mg_per_100g": 18,
        "micronutrients": ["แคลเซียมสูง 145 mg จากกะปิเคยแท้", "วิตามินซีและแคปไซซินจากพริกขี้หนู", "ใยอาหารสูงจากชุดผักเคียง"],
        "reference_source": "สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (สำรับน้ำพริกผักจิ้มไทย)"
    },
    {
        "id": "m017", "fcd_code": "เกณฑ์อ้างอิง: 1 ตัวกลาง (150g)",
        "name_th": "ปลาทูทอด / ปลาทับทิมทอด", "name_en": "Deep-fried Thai Mackerel / Tilapia", "category": "ทอด",
        "default_weight_g": 150, "energy_kcal_per_100g": 218.0, "protein_g_per_100g": 18.0, "carb_g_per_100g": 5.0, "fat_g_per_100g": 14.0,
        "fiber_g_per_100g": 0.0, "sugar_g_per_100g": 0.2, "sodium_mg_per_100g": 360, "cholesterol_mg_per_100g": 68,
        "micronutrients": ["กรดไขมันโอเมก้า-3 (EPA & DHA)", "วิตามินดี และ แคลเซียม", "ไอโอดีนและซีลีเนียม"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m018", "fcd_code": "เกณฑ์อ้างอิง: 1 ถ้วย (250g)",
        "name_th": "แกงจืดเต้าหู้หมูสับตำลึง", "name_en": "Clear Soup with Egg Tofu, Minced Pork & Ivy Gourd", "category": "ต้ม",
        "default_weight_g": 250, "energy_kcal_per_100g": 50.0, "protein_g_per_100g": 5.0, "carb_g_per_100g": 3.0, "fat_g_per_100g": 2.0,
        "fiber_g_per_100g": 1.1, "sugar_g_per_100g": 0.8, "sodium_mg_per_100g": 310, "cholesterol_mg_per_100g": 22,
        "micronutrients": ["วิตามินเอสูงจากใบตำลึง", "แคลเซียมและโปรตีนย่อยง่ายจากเต้าหู้ไข่", "ธาตุเหล็กและวิตามินบี 1"],
        "reference_source": "สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (เมนูชูสุขภาพลดหวานมันเค็ม)"
    },
    {
        "id": "m019", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (320g)",
        "name_th": "ข้าวมันไก่ต้ม", "name_en": "Hainanese Chicken Rice (Khao Man Gai)", "category": "ข้าว",
        "default_weight_g": 320, "energy_kcal_per_100g": 143.0, "protein_g_per_100g": 7.0, "carb_g_per_100g": 22.0, "fat_g_per_100g": 3.0,
        "fiber_g_per_100g": 0.6, "sugar_g_per_100g": 1.6, "sodium_mg_per_100g": 410, "cholesterol_mg_per_100g": 42,
        "micronutrients": ["วิตามินบี 3 (Niacin) และ บี 6 จากเนื้อไก่", "จินเจอรอล (Gingerol) จากขิงในน้ำจิ้มเต้าเจี้ยว", "ซีลีเนียม"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สถาบันโภชนาการ มหาวิทยาลัยมหิดล"
    },
    {
        "id": "m020", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (250g)",
        "name_th": "ผัดพริกแกงหมูถั่วฝักยาว", "name_en": "Stir-fried Pork with Red Curry Paste & Yardlong Beans", "category": "ผัด",
        "default_weight_g": 250, "energy_kcal_per_100g": 171.0, "protein_g_per_100g": 11.0, "carb_g_per_100g": 7.0, "fat_g_per_100g": 11.0,
        "fiber_g_per_100g": 2.1, "sugar_g_per_100g": 3.1, "sodium_mg_per_100g": 470, "cholesterol_mg_per_100g": 35,
        "micronutrients": ["วิตามินซีและโฟเลตจากถั่วฝักยาว", "วิตามินเอจากพริกแกงแดง", "วิตามินบี 1 จากเนื้อหมู"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m021", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (220g)",
        "name_th": "ยำวุ้นเส้นหมูสับกุ้งสด", "name_en": "Spicy Glass Noodle Salad with Minced Pork & Shrimp", "category": "ยำ",
        "default_weight_g": 220, "energy_kcal_per_100g": 94.0, "protein_g_per_100g": 5.0, "carb_g_per_100g": 14.0, "fat_g_per_100g": 2.0,
        "fiber_g_per_100g": 1.1, "sugar_g_per_100g": 3.4, "sodium_mg_per_100g": 530, "cholesterol_mg_per_100g": 38,
        "micronutrients": ["วิตามินซีจากน้ำมะนาวและขึ้นฉ่าย", "ไอโอดีนจากกุ้ง", "พลังงานและไขมันต่ำเหมาะกับผู้ควบคุมน้ำหนัก"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m022", "fcd_code": "เกณฑ์อ้างอิง: 1 หม้อ (250g)",
        "name_th": "กุ้งอบวุ้นเส้น", "name_en": "Baked Prawns with Glass Noodles", "category": "อบ",
        "default_weight_g": 250, "energy_kcal_per_100g": 124.0, "protein_g_per_100g": 10.0, "carb_g_per_100g": 12.0, "fat_g_per_100g": 4.0,
        "fiber_g_per_100g": 0.9, "sugar_g_per_100g": 1.8, "sodium_mg_per_100g": 390, "cholesterol_mg_per_100g": 65,
        "micronutrients": ["แอสตาแซนธินและโปรตีนจากกุ้ง", "สารจินเจอรอลจากขิงแก่", "โพแทสเซียมจากขึ้นฉ่าย"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m023", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (340g)",
        "name_th": "ข้าวหมูแดงหมูกรอบ", "name_en": "Red BBQ Pork & Crispy Pork over Rice", "category": "ข้าว",
        "default_weight_g": 340, "energy_kcal_per_100g": 164.0, "protein_g_per_100g": 8.0, "carb_g_per_100g": 24.0, "fat_g_per_100g": 4.0,
        "fiber_g_per_100g": 0.7, "sugar_g_per_100g": 4.6, "sodium_mg_per_100g": 440, "cholesterol_mg_per_100g": 54,
        "micronutrients": ["วิตามินบี 1 และ บี 12", "เซซามินและวิตามินอีจากงาขาวในน้ำราด", "ธาตุเหล็ก 1.5 mg"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทยจานเดียว สำนักโภชนาการ กรมอนามัย"
    },
    {
        "id": "m024", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (380g)",
        "name_th": "ข้าวขาหมู", "name_en": "Stewed Pork Leg on Rice (Khao Kha Moo)", "category": "ข้าว",
        "default_weight_g": 380, "energy_kcal_per_100g": 182.0, "protein_g_per_100g": 10.0, "carb_g_per_100g": 22.0, "fat_g_per_100g": 6.0,
        "fiber_g_per_100g": 1.0, "sugar_g_per_100g": 3.9, "sodium_mg_per_100g": 480, "cholesterol_mg_per_100g": 68,
        "micronutrients": ["คอลลาเจนและโปรตีนจากเอ็น/หนังหมูตุ๋น", "วิตามินเคและแคลเซียมจากคะน้าลวก", "อัลลิซินจากกระเทียมสด"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m025", "fcd_code": "เกณฑ์อ้างอิง: 1 กระทง (180g)",
        "name_th": "ห่อหมกปลาช่อน", "name_en": "Steamed Fish Curry Custard (Hor Mok Pla)", "category": "นึ่ง",
        "default_weight_g": 180, "energy_kcal_per_100g": 131.0, "protein_g_per_100g": 9.0, "carb_g_per_100g": 8.0, "fat_g_per_100g": 7.0,
        "fiber_g_per_100g": 1.8, "sugar_g_per_100g": 1.9, "sodium_mg_per_100g": 350, "cholesterol_mg_per_100g": 48,
        "micronutrients": ["แคลเซียมและสารต้านอนุมูลอิสระสูงจากใบยอ", "กรดอะมิโนจำเป็นจากเนื้อปลาช่อน", "เบต้าแคโรทีนจากใบโหระพา"],
        "reference_source": "สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (อาหารไทยภูมิปัญญาท้องถิ่น)"
    },
    {
        "id": "m026", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (220g)",
        "name_th": "ตำข้าวโพดไข่เค็ม", "name_en": "Spicy Sweet Corn Salad with Salted Egg", "category": "ยำ",
        "default_weight_g": 220, "energy_kcal_per_100g": 77.0, "protein_g_per_100g": 2.0, "carb_g_per_100g": 15.0, "fat_g_per_100g": 1.0,
        "fiber_g_per_100g": 2.2, "sugar_g_per_100g": 5.8, "sodium_mg_per_100g": 560, "cholesterol_mg_per_100g": 46,
        "micronutrients": ["ลูทีนและซีแซนทีนสูงจากข้าวโพดหวาน (บำรุงจอประสาทตา)", "วิตามินซีจากมะนาวสด", "วิตามินเอ"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m027", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (350g)",
        "name_th": "ขนมจีนน้ำยาป่า", "name_en": "Fermented Rice Noodles with Clear Herbal Fish Soup", "category": "ก๋วยเตี๋ยว",
        "default_weight_g": 350, "energy_kcal_per_100g": 102.0, "protein_g_per_100g": 5.0, "carb_g_per_100g": 16.0, "fat_g_per_100g": 2.0,
        "fiber_g_per_100g": 1.9, "sugar_g_per_100g": 0.9, "sodium_mg_per_100g": 490, "cholesterol_mg_per_100g": 12,
        "micronutrients": ["ไขมันอิ่มตัวต่ำมาก (ไม่ใส่กะทิ)", "น้ำมันหอมระเหยจากสมุนไพรไทย (กระชาย ตะไคร้ ใบมะกรูด)", "ใยอาหารสูง"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m028", "fcd_code": "เกณฑ์อ้างอิง: 1 ถ้วย (240g)",
        "name_th": "ไข่พะโล้หมูสามชั้นเต้าหู้", "name_en": "Eggs, Pork Belly & Tofu in Five-Spice Broth", "category": "ต้ม",
        "default_weight_g": 240, "energy_kcal_per_100g": 159.0, "protein_g_per_100g": 9.0, "carb_g_per_100g": 6.0, "fat_g_per_100g": 11.0,
        "fiber_g_per_100g": 0.5, "sugar_g_per_100g": 4.9, "sodium_mg_per_100g": 430, "cholesterol_mg_per_100g": 145,
        "micronutrients": ["โคลีนและวิตามินบี 12 จากไข่ต้ม", "แคลเซียมจากเต้าหู้พวง", "สารซินนามาลดีไฮด์จากอบเชยช่วยควบคุมระดับน้ำตาล"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
    {
        "id": "m029", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (180g)",
        "name_th": "ผัดผักบุ้งไฟแดง", "name_en": "Stir-fried Water Spinach with Garlic & Soybean Paste", "category": "ผัด",
        "default_weight_g": 180, "energy_kcal_per_100g": 81.0, "protein_g_per_100g": 3.0, "carb_g_per_100g": 6.0, "fat_g_per_100g": 5.0,
        "fiber_g_per_100g": 2.6, "sugar_g_per_100g": 1.5, "sodium_mg_per_100g": 440, "cholesterol_mg_per_100g": 0,
        "micronutrients": ["วิตามินเอและเบต้าแคโรทีนสูงมาก (บำรุงสายตา)", "ธาตุเหล็กและวิตามินซี", "ใยอาหารช่วยระบบขับถ่าย"],
        "reference_source": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข"
    },
    {
        "id": "m030", "fcd_code": "เกณฑ์อ้างอิง: 1 จาน (180g)",
        "name_th": "น้ำตกหมูย่าง", "name_en": "Spicy Grilled Pork Salad (Nam Tok Moo)", "category": "ยำ",
        "default_weight_g": 180, "energy_kcal_per_100g": 153.0, "protein_g_per_100g": 13.0, "carb_g_per_100g": 5.0, "fat_g_per_100g": 9.0,
        "fiber_g_per_100g": 1.1, "sugar_g_per_100g": 0.9, "sodium_mg_per_100g": 495, "cholesterol_mg_per_100g": 52,
        "micronutrients": ["วิตามินบี 1 และ ซิงก์ (Zinc) จากสันคอหมูย่าง", "วิตามินซีจากน้ำมะนาวสด", "สารต้านอนุมูลอิสระจากหอมแดงและต้นหอม"],
        "reference_source": "ฐานข้อมูลคุณค่าทางโภชนาการอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Thai FCD)"
    },
]


def get_menu_by_id(menu_id: str) -> dict:
    for menu in MENU_DATABASE:
        if menu["id"] == menu_id:
            return menu
    return MENU_DATABASE[0]


def calculate_nutrition(menu: dict, weight_g: float) -> dict:
    ratio = weight_g / 100.0
    protein_g = round(menu["protein_g_per_100g"] * ratio, 1)
    carb_g = round(menu["carb_g_per_100g"] * ratio, 1)
    fat_g = round(menu["fat_g_per_100g"] * ratio, 1)
    # คำนวณพลังงานรวมจากสมการ Atwater (4P + 4C + 9F) เพื่อให้ตรงกับกรัมของสารอาหารหลักหลังปัดเศษ 100%
    energy_kcal = round((protein_g * 4.0) + (carb_g * 4.0) + (fat_g * 9.0), 1)
    fiber_g = round(menu.get("fiber_g_per_100g", 1.2) * ratio, 1)
    sugar_g = round(menu.get("sugar_g_per_100g", 2.0) * ratio, 1)
    sodium_mg = round(menu.get("sodium_mg_per_100g", 400) * ratio, 0)
    cholesterol_mg = round(menu.get("cholesterol_mg_per_100g", 35) * ratio, 0)

    return {
        "energy_kcal": energy_kcal,
        "protein_g": protein_g,
        "carb_g": carb_g,
        "fat_g": fat_g,
        "fiber_g": fiber_g,
        "sugar_g": sugar_g,
        "sodium_mg": sodium_mg,
        "cholesterol_mg": cholesterol_mg,
        "thai_rdi_percent": {
            "energy": round((energy_kcal / THAI_RDI_REFERENCE["energy_kcal"]) * 100, 1),
            "protein": round((protein_g / THAI_RDI_REFERENCE["protein_g"]) * 100, 1),
            "carb": round((carb_g / THAI_RDI_REFERENCE["carb_g"]) * 100, 1),
            "fat": round((fat_g / THAI_RDI_REFERENCE["fat_g"]) * 100, 1),
            "fiber": round((fiber_g / THAI_RDI_REFERENCE["fiber_g"]) * 100, 1),
            "sugar": round((sugar_g / THAI_RDI_REFERENCE["sugar_g"]) * 100, 1),
            "sodium": round((sodium_mg / THAI_RDI_REFERENCE["sodium_mg"]) * 100, 1),
        }
    }
