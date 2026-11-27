export const PROVENANCE = Object.freeze({
  ILLUSTRATIVE_DEMO: 'ILLUSTRATIVE_FIXTURE_NOT_VALIDATED',
  AI_CLASSIFICATION_ONLY: 'AI_CLASSIFICATION_ONLY_NO_UNVERIFIED_NUTRIENTS',
  USER_GDA_LABEL: 'USER_ENTERED_GDA_LABEL',
});

export const UNKNOWN_DISH_ID = 'unknown';

export const DAILY_REFERENCE_TH = Object.freeze({
  kcal: 2000,
  proteinG: 50,
  carbsG: 300,
  fatG: 65,
  sodiumMg: 2000,
  sugarG: 24,
  fiberG: 25,
});

export const AGE_GOAL_PROFILES = Object.freeze({
  child_p1_p3: Object.freeze({
    id: 'child_p1_p3',
    labelTh: 'เด็กประถมต้น (ป.1–ป.3)',
    kcal: 1400,
    proteinG: 30,
    sodiumMg: 1200,
    sugarG: 16,
  }),
  child_p4_p6: Object.freeze({
    id: 'child_p4_p6',
    labelTh: 'เด็กประถมปลาย (ป.4–ป.6)',
    kcal: 1700,
    proteinG: 40,
    sodiumMg: 1500,
    sugarG: 20,
  }),
  teen_m1_m6: Object.freeze({
    id: 'teen_m1_m6',
    labelTh: 'วัยรุ่น / มัธยม (ม.1–ม.6)',
    kcal: 2000,
    proteinG: 55,
    sodiumMg: 2000,
    sugarG: 24,
  }),
  adult: Object.freeze({
    id: 'adult',
    labelTh: 'ผู้ใหญ่ทั่วไป (Thai RDI)',
    kcal: 2000,
    proteinG: 50,
    sodiumMg: 2000,
    sugarG: 24,
  }),
});

export const ALLERGEN_LABELS = Object.freeze({
  peanut: 'ถั่วลิสง',
  shellfish: 'กุ้ง / อาหารทะเล',
  egg: 'ไข่',
  dairy: 'นม / ผลิตภัณฑ์นม',
  soy_gluten: 'ถั่วเหลือง / กลูเตน',
});

export const MEAL_TYPES = Object.freeze([
  { id: 'breakfast', labelTh: 'มื้อเช้า', shortTh: 'เช้า' },
  { id: 'lunch', labelTh: 'มื้อกลางวัน', shortTh: 'กลางวัน' },
  { id: 'dinner', labelTh: 'มื้อเย็น', shortTh: 'เย็น' },
  { id: 'snack', labelTh: 'ของว่าง', shortTh: 'ของว่าง' },
]);

export const FOOD_GROUP_LABELS = Object.freeze({
  1: 'หมู่ 1 โปรตีน',
  2: 'หมู่ 2 คาร์โบไฮเดรต',
  3: 'หมู่ 3 เกลือแร่/ผัก',
  4: 'หมู่ 4 วิตามิน/ผลไม้',
  5: 'หมู่ 5 ไขมัน',
});

export const DISH_CATEGORIES = Object.freeze([
  { id: 'all', labelTh: 'ทั้งหมด' },
  { id: 'single_dish', labelTh: 'อาหารจานเดียว' },
  { id: 'soup_salad', labelTh: 'ต้ม / แกง / ยำ' },
  { id: 'noodle', labelTh: 'เมนูเส้น' },
  { id: 'side_healthy', labelTh: 'กับข้าว / เครื่องเคียง' },
  { id: 'dessert_drink', labelTh: 'ของหวาน / เครื่องดื่ม' },
]);

/**
 * Illustrative Thai food fixtures for software demo & educational prototyping.
 * Values are NOT validated clinical/Thai FCD records and must always carry
 * PROVENANCE.ILLUSTRATIVE_DEMO when displayed or exported.
 */
export const THAI_FOOD_CATALOG = Object.freeze([
  {
    id: 'pad_krapow_gai',
    nameTh: 'ข้าวผัดกะเพราไก่ไข่ดาว',
    nameEn: 'Stir-fried Holy Basil Chicken with Rice & Fried Egg',
    categoryGroup: 'single_dish',
    categoryTh: 'อาหารจานเดียว',
    servingLabel: '1 จาน',
    servingGrams: 380,
    sampleImage: './assets/pad-krapow-gai.jpg',
    keywords: ['krapow', 'kaprao', 'basil', 'กะเพรา', 'กระเพรา', 'ไข่ดาว'],
    foodGroups: [1, 2, 3, 5],
    allergens: ['egg', 'soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 590,
      proteinG: 28,
      carbsG: 66,
      fatG: 23,
      sodiumMg: 1180,
      sugarG: 6,
      fiberG: 2.8,
    }),
    healthTipsTh: [
      'อุดมด้วยโปรตีนจากอกไก่และไข่ แต่ซอสผัดและน้ำมันทอดไข่มักเพิ่มโซเดียมและไขมัน',
      'เพิ่มแตงกวาหรือผักลวกเคียงเพื่อเพิ่มใยอาหารและความอิ่ม',
    ],
    healthierSwapTh: 'สั่ง "ผัดน้ำมันน้อย + ไข่ต้ม" ช่วยลดพลังงานลงได้ราว 90–120 kcal และลดไขมันอิ่มตัว',
  },
  {
    id: 'som_tum_thai',
    nameTh: 'ส้มตำไทย',
    nameEn: 'Thai Green Papaya Salad',
    categoryGroup: 'soup_salad',
    categoryTh: 'ยำ / สลัดไทย',
    servingLabel: '1 จาน',
    servingGrams: 220,
    sampleImage: './assets/som-tum-thai.jpg',
    keywords: ['somtum', 'som_tum', 'som-tum', 'papaya', 'ส้มตำ', 'ตำไทย'],
    foodGroups: [1, 3, 4, 5],
    allergens: ['peanut', 'shellfish'],
    illustrativeNutrients: Object.freeze({
      kcal: 165,
      proteinG: 6,
      carbsG: 25,
      fatG: 5,
      sodiumMg: 920,
      sugarG: 14,
      fiberG: 4.5,
    }),
    healthTipsTh: [
      'พลังงานต่ำและได้ใยอาหารจากมะละกอดิบ ถั่วฝักยาว และมะเขือเทศ',
      'ระวังโซเดียมจากน้ำปลาและน้ำตาลปี๊บในน้ำยำ รวมถึงถั่วลิสงและกุ้งแห้งสำหรับผู้แพ้อาหาร',
    ],
    healthierSwapTh: 'สั่ง "หวานน้อย-น้ำปลาน้อย" และจับคู่กับอกไก่ย่างไม่ติดหนังเพื่อเสริมโปรตีนให้ครบมื้อ',
  },
  {
    id: 'tom_yum_kung',
    nameTh: 'ต้มยำกุ้งน้ำใส',
    nameEn: 'Clear Spicy & Sour Shrimp Soup',
    categoryGroup: 'soup_salad',
    categoryTh: 'ต้ม / แกง',
    servingLabel: '1 ถ้วย',
    servingGrams: 300,
    sampleImage: './assets/tom-yum-kung.jpg',
    keywords: ['tomyum', 'tom_yum', 'tom-yum', 'shrimp', 'ต้มยำ', 'กุ้ง'],
    foodGroups: [1, 3],
    allergens: ['shellfish'],
    illustrativeNutrients: Object.freeze({
      kcal: 135,
      proteinG: 17,
      carbsG: 9,
      fatG: 3.2,
      sodiumMg: 1290,
      sugarG: 4,
      fiberG: 2.2,
    }),
    healthTipsTh: [
      'ต้มยำน้ำใสให้โปรตีนสูง ไขมันต่ำ และได้สมุนไพรอย่างข่า ตะไคร้ ใบมะกรูด',
      'น้ำซุปมีโซเดียมค่อนข้างสูง แนะนำให้ตักเนื้อกุ้งและเห็ดทานเป็นหลัก ไม่ซดน้ำซุปจนหมดถ้วย',
    ],
    healthierSwapTh: 'เลือกต้มยำน้ำใสแทนน้ำข้น (งดนมข้นจืด/น้ำพริกเผาเพิ่ม) ช่วยลดไขมันและน้ำตาลได้มาก',
  },
  {
    id: 'khao_man_gai',
    nameTh: 'ข้าวมันไก่',
    nameEn: 'Thai Hainanese Chicken Rice',
    categoryGroup: 'single_dish',
    categoryTh: 'อาหารจานเดียว',
    servingLabel: '1 จาน',
    servingGrams: 360,
    sampleImage: null,
    keywords: ['khaomangai', 'khao_man_gai', 'chicken_rice', 'ข้าวมันไก่'],
    foodGroups: [1, 2, 3, 5],
    allergens: ['soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 615,
      proteinG: 26,
      carbsG: 68,
      fatG: 25,
      sodiumMg: 1120,
      sugarG: 5,
      fiberG: 1.8,
    }),
    healthTipsTh: [
      'ไขมันส่วนใหญ่มาจากข้าวที่หุงด้วยมันไก่และหนังไก่ รวมถึงโซเดียมในน้ำจิ้มเต้าเจี้ยว',
      'เพิ่มแตงกวาและจิ้มน้ำจิ้มแต่พอดีเพื่อคุมโซเดียม',
    ],
    healthierSwapTh: 'สั่ง "ไก่ไม่หนัง + ข้าวสวยแทนข้าวมันครึ่งหนึ่ง" ลดไขมันได้เกือบครึ่งจาน',
  },
  {
    id: 'pad_thai_kung',
    nameTh: 'ผัดไทยกุ้งสด',
    nameEn: 'Pad Thai with Fresh Shrimp',
    categoryGroup: 'noodle',
    categoryTh: 'เมนูเส้น',
    servingLabel: '1 จาน',
    servingGrams: 340,
    sampleImage: null,
    keywords: ['padthai', 'pad_thai', 'ผัดไทย'],
    foodGroups: [1, 2, 3, 5],
    allergens: ['peanut', 'shellfish', 'egg', 'soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 545,
      proteinG: 20,
      carbsG: 72,
      fatG: 19,
      sodiumMg: 1050,
      sugarG: 16,
      fiberG: 3.1,
    }),
    healthTipsTh: [
      'ให้พลังงานจากเส้นจันท์และน้ำตาลปี๊บในซอสมะขามค่อนข้างสูง',
      'บีบมะนาวและทานคู่ถั่วงอก-ใบกุยช่ายสดช่วยเพิ่มวิตามินและชะลอการดูดซึมน้ำตาล',
    ],
    healthierSwapTh: 'งดเติมน้ำตาลทรายเพิ่มบนโต๊ะ และขอเพิ่มถั่วงอกสด/เต้าหู้แข็งแทนเส้นบางส่วน',
  },
  {
    id: 'kaeng_khiao_wan_gai',
    nameTh: 'แกงเขียวหวานไก่ (พร้อมข้าวสวย)',
    nameEn: 'Thai Green Curry with Chicken & Rice',
    categoryGroup: 'soup_salad',
    categoryTh: 'ต้ม / แกง',
    servingLabel: '1 ชุด',
    servingGrams: 400,
    sampleImage: null,
    keywords: ['greencurry', 'green_curry', 'kaeng', 'เขียวหวาน', 'แกงเขียวหวาน'],
    foodGroups: [1, 2, 3, 5],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 560,
      proteinG: 24,
      carbsG: 62,
      fatG: 24,
      sodiumMg: 1140,
      sugarG: 9,
      fiberG: 3.6,
    }),
    healthTipsTh: [
      'น้ำกะทิให้ไขมันอิ่มตัวค่อนข้างสูง แต่ได้ใยอาหารจากมะเขือเปราะและใบโหระพา',
      'เน้นตักเนื้อไก่และผัก หลีกเลี่ยงการราดน้ำแกงชุ่มข้าว',
    ],
    healthierSwapTh: 'จับคู่กับข้าวกล้องและตักน้ำแกงแต่พอดี ช่วยเพิ่มใยอาหารและลดไขมันอิ่มตัว',
  },
  {
    id: 'khao_khai_jiao',
    nameTh: 'ข้าวไข่เจียว',
    nameEn: 'Thai Omelette over Jasmine Rice',
    categoryGroup: 'single_dish',
    categoryTh: 'อาหารจานเดียว',
    servingLabel: '1 จาน',
    servingGrams: 300,
    sampleImage: null,
    keywords: ['omelette', 'khai_jiao', 'ไข่เจียว'],
    foodGroups: [1, 2, 5],
    allergens: ['egg'],
    illustrativeNutrients: Object.freeze({
      kcal: 470,
      proteinG: 14,
      carbsG: 54,
      fatG: 22,
      sodiumMg: 640,
      sugarG: 2,
      fiberG: 1.0,
    }),
    healthTipsTh: [
      'ไข่เจียวที่ทอดน้ำมันท่วมจะดูดซับน้ำมันมาก ทำให้สัดส่วนไขมันสูงและขาดผัก',
      'ควรเพิ่มผักสับลงในไข่ (เช่น หอมใหญ่ มะเขือเทศ ชะอม) หรือทานคู่ต้มจืด',
    ],
    healthierSwapTh: 'เปลี่ยนเป็นไข่เจียวหม้อทอดไร้น้ำมัน หรือไข่ตุ๋นทรงเครื่อง ลดน้ำมันได้ชัดเจน',
  },
  {
    id: 'kuay_tiao_nam_sai',
    nameTh: 'ก๋วยเตี๋ยวเส้นเล็กน้ำใส',
    nameEn: 'Clear Broth Rice Noodle Soup',
    categoryGroup: 'noodle',
    categoryTh: 'เมนูเส้น',
    servingLabel: '1 ชาม',
    servingGrams: 420,
    sampleImage: null,
    keywords: ['noodle', 'kuay_tiao', 'ก๋วยเตี๋ยว', 'เส้นเล็ก', 'น้ำใส'],
    foodGroups: [1, 2, 3, 5],
    allergens: ['soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 365,
      proteinG: 18,
      carbsG: 52,
      fatG: 9,
      sodiumMg: 1480,
      sugarG: 5,
      fiberG: 2.5,
    }),
    healthTipsTh: [
      'พลังงานและไขมันค่อนข้างสมดุล เหมาะเป็นมื้อเบาๆ ที่ไม่หนักท้อง',
      'จุดที่ต้องระวังคือโซเดียมในน้ำซุปและเครื่องปรุงพวงบนโต๊ะ',
    ],
    healthierSwapTh: 'ชิมก่อนปรุง ลดกระเทียมเจียว และเหลือน้ำซุปไว้ครึ่งชามช่วยลดโซเดียมลงได้มาก',
  },
  {
    id: 'pad_see_ew_moo',
    nameTh: 'ผัดซีอิ๊วหมู',
    nameEn: 'Stir-fried Soy Sauce Flat Noodles with Pork',
    categoryGroup: 'noodle',
    categoryTh: 'เมนูเส้น',
    servingLabel: '1 จาน',
    servingGrams: 360,
    sampleImage: null,
    keywords: ['padseeew', 'pad_see_ew', 'ผัดซีอิ๊ว', 'เส้นใหญ่'],
    foodGroups: [1, 2, 3, 5],
    allergens: ['egg', 'soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 580,
      proteinG: 21,
      carbsG: 68,
      fatG: 24,
      sodiumMg: 1260,
      sugarG: 10,
      fiberG: 3.2,
    }),
    healthTipsTh: [
      'ได้ผักคะน้าและโปรตีนจากหมูและไข่ แต่น้ำมันผัดเส้นใหญ่และซีอิ๊วเพิ่มไขมันและโซเดียมสูง',
      'ควรลดการเติมน้ำตาลและพริกน้ำปลาเพิ่มบนโต๊ะ',
    ],
    healthierSwapTh: 'เลือกเส้นหมี่แทนเส้นใหญ่และสั่งเพิ่มผักคะน้า จะช่วยลดน้ำมันเคลือบเส้นได้มาก',
  },
  {
    id: 'pla_nueng_manao',
    nameTh: 'ปลานึ่งมะนาว',
    nameEn: 'Steamed Fish with Lime & Chili',
    categoryGroup: 'side_healthy',
    categoryTh: 'กับข้าว / สุขภาพ',
    servingLabel: '1 ที่',
    servingGrams: 280,
    sampleImage: null,
    keywords: ['steamed_fish', 'pla_nueng', 'ปลานึ่ง', 'มะนาว'],
    foodGroups: [1, 3],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 230,
      proteinG: 32,
      carbsG: 8,
      fatG: 7.5,
      sodiumMg: 890,
      sugarG: 5,
      fiberG: 1.9,
    }),
    healthTipsTh: [
      'เมนูโปรตีนคุณภาพสูง ไขมันดี และใช้วิธีนึ่งจึงไม่เพิ่มน้ำมันจากการทอด',
      'ทานคู่ข้าวกล้องและผักลวกจะได้มื้อที่ครบทั้ง 5 หมู่อย่างสมดุล',
    ],
    healthierSwapTh: 'ตักน้ำราดแต่พอประมาณเพื่อคุมโซเดียม และเพิ่มผักกะหล่ำปลีหรือขึ้นฉ่ายรองจาน',
  },
  {
    id: 'jok_moo_sai_khai',
    nameTh: 'โจ๊กหมูใส่ไข่',
    nameEn: 'Thai Pork Congee with Soft-boiled Egg',
    categoryGroup: 'single_dish',
    categoryTh: 'อาหารจานเดียว',
    servingLabel: '1 ชาม',
    servingGrams: 350,
    sampleImage: null,
    keywords: ['jok', 'congee', 'porridge', 'โจ๊ก'],
    foodGroups: [1, 2, 3],
    allergens: ['egg', 'soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 290,
      proteinG: 16,
      carbsG: 42,
      fatG: 6.5,
      sodiumMg: 1090,
      sugarG: 2,
      fiberG: 1.4,
    }),
    healthTipsTh: [
      'ย่อยง่ายและให้พลังงานพอเหมาะสำหรับมื้อเช้า มีขิงซอยและต้นหอมช่วยเพิ่มกลิ่นหอม',
      'งดเติมซีอิ๊วขาวเพิ่มและลดปาท่องโก๋เพื่อไม่ให้โซเดียมและไขมันพุ่งสูง',
    ],
    healthierSwapTh: 'เพิ่มไข่ลวกหรือเต้าหู้ขาวแทนปาท่องโก๋ ช่วยให้อิ่มนานขึ้นโดยไม่เพิ่มน้ำมัน',
  },
  {
    id: 'larb_moo',
    nameTh: 'ลาบหมู',
    nameEn: 'Spicy Minced Pork Salad (Larb)',
    categoryGroup: 'soup_salad',
    categoryTh: 'ยำ / สลัดไทย',
    servingLabel: '1 จาน',
    servingGrams: 180,
    sampleImage: null,
    keywords: ['larb', 'laab', 'ลาบ', 'ลาบหมู'],
    foodGroups: [1, 3],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 245,
      proteinG: 23,
      carbsG: 11,
      fatG: 12,
      sodiumMg: 980,
      sugarG: 3,
      fiberG: 2.4,
    }),
    healthTipsTh: [
      'โปรตีนสูงและได้สมุนไพรสดอย่างหอมแดง สะระแหน่ ต้นหอม และผักชีฝรั่ง',
      'ทานคู่ผักสด เช่น กะหล่ำปลี ถั่วฝักยาว และแตงกวา ช่วยเพิ่มใยอาหารได้ดี',
    ],
    healthierSwapTh: 'เลือกเนื้อหมูสันในหรืออกไก่สับไม่ติดมันและลดน้ำปลา จะได้เมนูโปรตีนคลีนขึ้นมาก',
  },
  {
    id: 'gai_yang',
    nameTh: 'ไก่ย่าง (ส่วนสะโพก/อก)',
    nameEn: 'Thai Grilled Chicken',
    categoryGroup: 'side_healthy',
    categoryTh: 'กับข้าว / เครื่องเคียง',
    servingLabel: '1 ชิ้นกลาง',
    servingGrams: 150,
    sampleImage: null,
    keywords: ['gai_yang', 'grilled_chicken', 'ไก่ย่าง'],
    foodGroups: [1, 5],
    allergens: ['soy_gluten'],
    illustrativeNutrients: Object.freeze({
      kcal: 255,
      proteinG: 29,
      carbsG: 4,
      fatG: 13.5,
      sodiumMg: 620,
      sugarG: 3,
      fiberG: 0,
    }),
    healthTipsTh: [
      'จับคู่กับส้มตำและผักสดได้ดีมาก ช่วยเติมโปรตีนให้มื้อส้มตำสมดุลขึ้น',
      'ลอกหนังไก่หรือส่วนที่ไหม้เกรียมออกช่วยลดไขมันอิ่มตัวและสารก่อมะเร็งจากการปิ้งย่าง',
    ],
    healthierSwapTh: 'เลือกส่วนอกไก่ย่างไม่ติดหนังและจิ้มน้ำจิ้มแจ่วแต่น้อย',
  },
  {
    id: 'sticky_rice',
    nameTh: 'ข้าวเหนียวนึ่ง',
    nameEn: 'Steamed Thai Sticky Rice',
    categoryGroup: 'side_healthy',
    categoryTh: 'เครื่องเคียง',
    servingLabel: '1 กระติ๊บเล็ก',
    servingGrams: 120,
    sampleImage: null,
    keywords: ['sticky_rice', 'khao_niao', 'ข้าวเหนียว'],
    foodGroups: [2],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 210,
      proteinG: 4,
      carbsG: 46,
      fatG: 0.4,
      sodiumMg: 10,
      sugarG: 0.5,
      fiberG: 1.2,
    }),
    healthTipsTh: [
      'ให้พลังงานและคาร์โบไฮเดรตเข้มข้นกว่าข้าวสวยในปริมาตรเท่ากัน เพราะเม็ดข้าวแน่นกว่า',
      'เหมาะสำหรับทานคู่ส้มตำ-ไก่ย่างในปริมาณพอดี (ประมาณ 1 กำปั้น)',
    ],
    healthierSwapTh: 'สลับเป็นข้าวเหนียวดำ/ข้าวเหนียวกล้อง หรือลดเหลือครึ่งกระติ๊บเพื่อคุมระดับน้ำตาลในเลือด',
  },
  {
    id: 'steamed_jasmine_rice',
    nameTh: 'ข้าวสวย (ข้าวหอมมะลิ)',
    nameEn: 'Steamed Jasmine Rice',
    categoryGroup: 'side_healthy',
    categoryTh: 'เครื่องเคียง',
    servingLabel: '1 ถ้วย (2 ทัพพี)',
    servingGrams: 160,
    sampleImage: null,
    keywords: ['rice', 'jasmine_rice', 'ข้าวสวย', 'ข้าวเปล่า'],
    foodGroups: [2],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 205,
      proteinG: 4.2,
      carbsG: 45,
      fatG: 0.5,
      sodiumMg: 5,
      sugarG: 0.2,
      fiberG: 0.8,
    }),
    healthTipsTh: [
      'เป็นแหล่งคาร์โบไฮเดรตหลักของมื้ออาหาร ปราศจากโซเดียมและไขมัน',
      'ควรจัดสัดส่วนร่วมกับผักครึ่งจานและโปรตีนหนึ่งในสี่จาน (สูตร 2:1:1)',
    ],
    healthierSwapTh: 'เปลี่ยนเป็นข้าวกล้องหรือข้าวไรซ์เบอร์รี ช่วยเพิ่มใยอาหารและวิตามินบี',
  },
  {
    id: 'boiled_egg',
    nameTh: 'ไข่ต้ม',
    nameEn: 'Boiled Egg',
    categoryGroup: 'side_healthy',
    categoryTh: 'เครื่องเคียง',
    servingLabel: '1 ฟอง',
    servingGrams: 55,
    sampleImage: null,
    keywords: ['egg', 'boiled_egg', 'ไข่ต้ม'],
    foodGroups: [1, 5],
    allergens: ['egg'],
    illustrativeNutrients: Object.freeze({
      kcal: 75,
      proteinG: 6.5,
      carbsG: 0.6,
      fatG: 5,
      sodiumMg: 65,
      sugarG: 0.4,
      fiberG: 0,
    }),
    healthTipsTh: [
      'แหล่งโปรตีนสมบูรณ์และโคลีนคุณภาพดี ไม่ใช้น้ำมันในการปรุง',
      'เสริมคู่กับสลัด โจ๊ก หรือผัดผักเพื่อเพิ่มความอิ่มได้ดีมาก',
    ],
    healthierSwapTh: 'เลือกไข่ต้มแทนไข่ดาวทอดน้ำมัน ช่วยประหยัดพลังงานได้ราว 60–90 kcal ต่อฟอง',
  },
  {
    id: 'banana_fresh',
    nameTh: 'กล้วยหอม / กล้วยน้ำว้าสด',
    nameEn: 'Fresh Banana',
    categoryGroup: 'dessert_drink',
    categoryTh: 'ผลไม้ / ของว่าง',
    servingLabel: '1 ลูกกลาง',
    servingGrams: 110,
    sampleImage: null,
    keywords: ['banana', 'กล้วย', 'กล้วยหอม', 'กล้วยน้ำว้า'],
    foodGroups: [4],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 105,
      proteinG: 1.3,
      carbsG: 26,
      fatG: 0.3,
      sodiumMg: 2,
      sugarG: 13,
      fiberG: 3.0,
    }),
    healthTipsTh: [
      'อุดมด้วยโพแทสเซียมและใยอาหาร เหมาะเป็นของว่างก่อนออกกำลังกายหรือแทนขนมหวาน',
      'น้ำตาลเป็นน้ำตาลธรรมชาติ แต่ผู้ที่คุมน้ำตาลควรจำกัดที่ 1 ลูกต่อครั้ง',
    ],
    healthierSwapTh: 'ทานผลไม้สดทั้งลูกแทนน้ำผลไม้ปั่นหรือขนมเบเกอรีเพื่อให้ได้ใยอาหารเต็มที่',
  },
  {
    id: 'mango_sticky_rice',
    nameTh: 'ข้าวเหนียวมะม่วง',
    nameEn: 'Mango Sticky Rice',
    categoryGroup: 'dessert_drink',
    categoryTh: 'ของหวานไทย',
    servingLabel: '1 จานเล็ก',
    servingGrams: 240,
    sampleImage: null,
    keywords: ['mango', 'ข้าวเหนียวมะม่วง', 'มะม่วง'],
    foodGroups: [2, 4, 5],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 430,
      proteinG: 5.5,
      carbsG: 76,
      fatG: 12,
      sodiumMg: 260,
      sugarG: 34,
      fiberG: 3.4,
    }),
    healthTipsTh: [
      'มะม่วงสุกมีวิตามินเอและซีสูง แต่ข้าวเหนียวมูนและกะทิราดมีน้ำตาลและคาร์โบไฮเดรตสูงมาก',
      'เหมาะสำหรับการแบ่งทานกับเพื่อนหรือลดปริมาณข้าวเหนียวลงครึ่งหนึ่ง',
    ],
    healthierSwapTh: 'ทานมะม่วงสุกสดมากขึ้น ลดข้าวเหนียวมูนเหลือครึ่งส่วน และราดกะทิแค่เล็กน้อย',
  },
  {
    id: 'thai_iced_tea',
    nameTh: 'ชาไทยเย็น (หวานปกติ)',
    nameEn: 'Thai Iced Tea (Regular Sweetness)',
    categoryGroup: 'dessert_drink',
    categoryTh: 'เครื่องดื่ม',
    servingLabel: '1 แก้ว (16 ออนซ์)',
    servingGrams: 350,
    sampleImage: null,
    keywords: ['cha_thai', 'thai_tea', 'ชาไทย', 'ชาเย็น'],
    foodGroups: [2, 5],
    allergens: ['dairy'],
    illustrativeNutrients: Object.freeze({
      kcal: 280,
      proteinG: 3.5,
      carbsG: 44,
      fatG: 9.5,
      sodiumMg: 140,
      sugarG: 36,
      fiberG: 0,
    }),
    healthTipsTh: [
      'น้ำตาลจากนมข้นหวานและน้ำเชื่อมใน 1 แก้วสูงกว่าเกณฑ์แนะนำต่อวัน (ไม่เกิน 24 กรัม/วัน)',
      'มีครีมเทียมหรือนมข้นจืดซึ่งเพิ่มไขมันอิ่มตัวได้',
    ],
    healthierSwapTh: 'สั่ง "หวาน 25% ใช้นมสดไขมันต่ำแทนครีมเทียม" ช่วยลดน้ำตาลลงได้เกินครึ่ง',
  },
  {
    id: 'drinking_water',
    nameTh: 'น้ำเปล่า / ชาไม่หวาน',
    nameEn: 'Plain Water / Unsweetened Tea',
    categoryGroup: 'dessert_drink',
    categoryTh: 'เครื่องดื่ม',
    servingLabel: '1 แก้ว (250 มล.)',
    servingGrams: 250,
    sampleImage: null,
    keywords: ['water', 'น้ำเปล่า', 'น้ำดื่ม', 'ชาจืด'],
    foodGroups: [],
    allergens: [],
    illustrativeNutrients: Object.freeze({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      sodiumMg: 5,
      sugarG: 0,
      fiberG: 0,
    }),
    healthTipsTh: [
      'เครื่องดื่มที่ดีที่สุดสำหรับทุกมื้อ ไม่มีน้ำตาลและพลังงานส่วนเกิน',
      'ช่วยลดความเข้มข้นของโซเดียมและส่งเสริมระบบขับถ่ายตลอดวัน',
    ],
    healthierSwapTh: 'ดื่มน้ำเปล่าแทนเครื่องดื่มรสหวานวันละ 1 แก้ว ลดพลังงานได้ ~250 kcal/วัน',
  },
]);

/**
 * Sample Thai packaged food barcodes for Demo / Barcode scanner testing.
 * Always explicitly labeled as illustrative fixture unless user edits from physical GDA pack.
 */
export const PACKAGED_BARCODE_CATALOG = Object.freeze([
  {
    barcode: '8850123456012',
    productNameTh: 'นมโคแท้จืด UHT (กล่อง 225 มล.)',
    servingLabel: '1 กล่อง',
    servingsPerPack: 1,
    allergens: ['dairy'],
    gda: Object.freeze({ kcal: 140, sugarG: 10, fatG: 7, sodiumMg: 95, proteinG: 7 }),
  },
  {
    barcode: '8850123456029',
    productNameTh: 'ชาเขียวรสน้ำผึ้งมะนาว (ขวด 420 มล.)',
    servingLabel: '1 ขวด',
    servingsPerPack: 1,
    allergens: [],
    gda: Object.freeze({ kcal: 150, sugarG: 36, fatG: 0, sodiumMg: 75, proteinG: 0 }),
  },
  {
    barcode: '8850123456036',
    productNameTh: 'มันฝรั่งทอดกรอบรสดั้งเดิม (ซอง 48 ก.)',
    servingLabel: '1 ซอง',
    servingsPerPack: 1,
    allergens: [],
    gda: Object.freeze({ kcal: 260, sugarG: 1, fatG: 16, sodiumMg: 290, proteinG: 3 }),
  },
  {
    barcode: '8850123456043',
    productNameTh: 'โยเกิร์ตธรรมชาติไขมันต่ำ (ถ้วย 135 ก.)',
    servingLabel: '1 ถ้วย',
    servingsPerPack: 1,
    allergens: ['dairy'],
    gda: Object.freeze({ kcal: 110, sugarG: 11, fatG: 2, sodiumMg: 70, proteinG: 5 }),
  },
]);

export const ALLOWED_VISION_FOOD_IDS = Object.freeze([
  ...THAI_FOOD_CATALOG.map((item) => item.id),
  UNKNOWN_DISH_ID,
]);

export function getDishById(foodId) {
  if (!foodId || foodId === UNKNOWN_DISH_ID) return null;
  return THAI_FOOD_CATALOG.find((item) => item.id === foodId) || null;
}

export function lookupBarcodeFixture(barcode) {
  const clean = String(barcode || '').replace(/\D+/g, '');
  if (!clean) return null;
  return PACKAGED_BARCODE_CATALOG.find((item) => item.barcode === clean) || null;
}

export function searchDishes(query = '', categoryGroup = 'all') {
  const q = String(query || '').trim().toLowerCase();
  return THAI_FOOD_CATALOG.filter((dish) => {
    if (categoryGroup && categoryGroup !== 'all' && dish.categoryGroup !== categoryGroup) {
      return false;
    }
    if (!q) return true;
    const haystack = [dish.nameTh, dish.nameEn, dish.categoryTh, ...(dish.keywords || [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function resolveGoalProfile(settings = {}) {
  const presetKey = settings.profileId && AGE_GOAL_PROFILES[settings.profileId] ? settings.profileId : 'adult';
  const base = AGE_GOAL_PROFILES[presetKey];

  let kcal = Number(settings.customKcal) > 0 && settings.profileId === 'custom' ? Number(settings.customKcal) : base.kcal;
  let proteinG =
    Number(settings.customProteinG) > 0 && settings.profileId === 'custom'
      ? Number(settings.customProteinG)
      : base.proteinG;
  let sodiumMg =
    Number(settings.customSodiumMg) > 0 && settings.profileId === 'custom'
      ? Number(settings.customSodiumMg)
      : base.sodiumMg;
  let sugarG =
    Number(settings.customSugarG) > 0 && settings.profileId === 'custom'
      ? Number(settings.customSugarG)
      : base.sugarG;

  kcal = Math.min(4500, Math.max(800, Math.round(kcal)));
  proteinG = Math.min(250, Math.max(15, Math.round(proteinG)));
  sodiumMg = Math.min(4000, Math.max(800, Math.round(sodiumMg)));
  sugarG = Math.min(100, Math.max(8, Math.round(sugarG)));

  const focusLowSodium = Boolean(settings.focusLowSodium);
  const focusLowSugar = Boolean(settings.focusLowSugar);
  const focusHighProtein = Boolean(settings.focusHighProtein);

  if (focusLowSodium && settings.profileId !== 'custom') {
    sodiumMg = Math.min(sodiumMg, 1500);
  }
  if (focusLowSugar && settings.profileId !== 'custom') {
    sugarG = Math.min(sugarG, 16);
  }
  if (focusHighProtein && settings.profileId !== 'custom') {
    proteinG = Math.round(proteinG * 1.25);
  }

  const allergens = Array.isArray(settings.allergens)
    ? settings.allergens.filter((a) => Boolean(ALLERGEN_LABELS[a]))
    : [];

  return {
    profileId: settings.profileId === 'custom' ? 'custom' : presetKey,
    labelTh: settings.profileId === 'custom' ? 'กำหนดเป้าหมายเอง' : base.labelTh,
    kcal,
    proteinG,
    sodiumMg,
    sugarG,
    focusLowSodium,
    focusLowSugar,
    focusHighProtein,
    allergens,
  };
}

export function clampPortionMultiplier(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.round(Math.min(4, Math.max(0.25, num)) * 100) / 100;
}

export function evaluateNutrientLevel(metric, value, goalProfile = null) {
  if (!Number.isFinite(value)) return 'low';
  const sodiumDaily = goalProfile?.sodiumMg || DAILY_REFERENCE_TH.sodiumMg;
  const sugarDaily = goalProfile?.sugarG || DAILY_REFERENCE_TH.sugarG;

  if (metric === 'sodiumMg') {
    if (value >= sodiumDaily * 0.5) return 'high';
    if (value >= sodiumDaily * 0.3) return 'moderate';
    return 'low';
  }
  if (metric === 'sugarG') {
    if (value >= sugarDaily * 0.7) return 'high';
    if (value >= sugarDaily * 0.35) return 'moderate';
    return 'low';
  }
  if (metric === 'fatG') {
    if (value >= 22) return 'high';
    if (value >= 12) return 'moderate';
    return 'low';
  }
  return 'low';
}

export function scaleNutrition(dish, multiplier = 1, goalProfile = null) {
  if (!dish || !dish.illustrativeNutrients) return null;
  const factor = clampPortionMultiplier(multiplier);
  const base = dish.illustrativeNutrients;

  const kcal = Math.round(base.kcal * factor);
  const proteinG = Math.round(base.proteinG * factor * 10) / 10;
  const carbsG = Math.round(base.carbsG * factor * 10) / 10;
  const fatG = Math.round(base.fatG * factor * 10) / 10;
  const sodiumMg = Math.round(base.sodiumMg * factor);
  const sugarG = Math.round(base.sugarG * factor * 10) / 10;
  const fiberG = Math.round(base.fiberG * factor * 10) / 10;
  const estimatedGrams = Math.round(dish.servingGrams * factor);

  const macroCalories = proteinG * 4 + carbsG * 4 + fatG * 9;
  const proteinPct = macroCalories > 0 ? Math.round(((proteinG * 4) / macroCalories) * 100) : 0;
  const carbsPct = macroCalories > 0 ? Math.round(((carbsG * 4) / macroCalories) * 100) : 0;
  const macroShares =
    macroCalories > 0
      ? {
          proteinPct,
          carbsPct,
          fatPct: Math.max(0, 100 - proteinPct - carbsPct),
        }
      : { proteinPct: 0, carbsPct: 0, fatPct: 0 };

  return {
    multiplier: factor,
    estimatedGrams,
    kcal,
    proteinG,
    carbsG,
    fatG,
    sodiumMg,
    sugarG,
    fiberG,
    macroShares,
    levels: {
      sodium: evaluateNutrientLevel('sodiumMg', sodiumMg, goalProfile),
      sugar: evaluateNutrientLevel('sugarG', sugarG, goalProfile),
      fat: evaluateNutrientLevel('fatG', fatG, goalProfile),
    },
    provenance: PROVENANCE.ILLUSTRATIVE_DEMO,
  };
}

/**
 * Aggregates a multi-dish meal tray (e.g., Som Tum + Sticky Rice + Grilled Chicken).
 */
export function scaleComboNutrition(items = [], goalProfile = null) {
  if (!Array.isArray(items) || items.length === 0) return null;

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSodium = 0;
  let totalSugar = 0;
  let totalFiber = 0;
  let totalGrams = 0;
  let validDishCount = 0;

  const foodGroupsSet = new Set();
  const matchedAllergensSet = new Set();
  const userAllergens = new Set(goalProfile?.allergens || []);
  const tips = [];
  const swaps = [];

  for (const item of items) {
    const dish = getDishById(item.foodId);
    if (!dish) continue;
    validDishCount += 1;
    const scaled = scaleNutrition(dish, item.portionMultiplier, goalProfile);
    totalKcal += scaled.kcal;
    totalProtein += scaled.proteinG;
    totalCarbs += scaled.carbsG;
    totalFat += scaled.fatG;
    totalSodium += scaled.sodiumMg;
    totalSugar += scaled.sugarG;
    totalFiber += scaled.fiberG;
    totalGrams += scaled.estimatedGrams;

    for (const g of dish.foodGroups) foodGroupsSet.add(g);
    for (const a of dish.allergens || []) {
      if (userAllergens.has(a)) matchedAllergensSet.add(a);
    }
    if (tips.length < 3 && dish.healthTipsTh?.[0]) {
      tips.push(`${dish.nameTh}: ${dish.healthTipsTh[0]}`);
    }
    if (swaps.length < 2 && dish.healthierSwapTh) {
      swaps.push(`${dish.nameTh}: ${dish.healthierSwapTh}`);
    }
  }

  if (validDishCount === 0) return null;

  totalProtein = Math.round(totalProtein * 10) / 10;
  totalCarbs = Math.round(totalCarbs * 10) / 10;
  totalFat = Math.round(totalFat * 10) / 10;
  totalSugar = Math.round(totalSugar * 10) / 10;
  totalFiber = Math.round(totalFiber * 10) / 10;

  const macroCalories = totalProtein * 4 + totalCarbs * 4 + totalFat * 9;
  const proteinPct = macroCalories > 0 ? Math.round(((totalProtein * 4) / macroCalories) * 100) : 0;
  const carbsPct = macroCalories > 0 ? Math.round(((totalCarbs * 4) / macroCalories) * 100) : 0;
  const macroShares =
    macroCalories > 0
      ? { proteinPct, carbsPct, fatPct: Math.max(0, 100 - proteinPct - carbsPct) }
      : { proteinPct: 0, carbsPct: 0, fatPct: 0 };

  return {
    estimatedGrams: totalGrams,
    kcal: totalKcal,
    proteinG: totalProtein,
    carbsG: totalCarbs,
    fatG: totalFat,
    sodiumMg: totalSodium,
    sugarG: totalSugar,
    fiberG: totalFiber,
    macroShares,
    levels: {
      sodium: evaluateNutrientLevel('sodiumMg', totalSodium, goalProfile),
      sugar: evaluateNutrientLevel('sugarG', totalSugar, goalProfile),
      fat: evaluateNutrientLevel('fatG', totalFat, goalProfile),
    },
    foodGroups: Array.from(foodGroupsSet).sort((a, b) => a - b),
    matchedAllergens: Array.from(matchedAllergensSet),
    tips,
    swaps,
    provenance: PROVENANCE.ILLUSTRATIVE_DEMO,
  };
}

export function detectTrayAllergens(items = [], goalProfile = null) {
  const userAllergens = new Set(goalProfile?.allergens || []);
  if (userAllergens.size === 0) return [];
  const found = new Set();
  for (const item of items) {
    const dish = getDishById(item.foodId);
    if (!dish) continue;
    for (const a of dish.allergens || []) {
      if (userAllergens.has(a)) found.add(a);
    }
  }
  return Array.from(found);
}

export function evaluateGdaLabel(input = {}, goalProfile = null) {
  const servings = clampPortionMultiplier(input.servingsEaten ?? 1);
  const clampNonNeg = (val, max) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(max, n);
  };

  const kcal = Math.round(clampNonNeg(input.kcal, 5000) * servings);
  const sugarG = Math.round(clampNonNeg(input.sugarG, 500) * servings * 10) / 10;
  const fatG = Math.round(clampNonNeg(input.fatG, 300) * servings * 10) / 10;
  const sodiumMg = Math.round(clampNonNeg(input.sodiumMg, 10000) * servings);
  const proteinG = Math.round(clampNonNeg(input.proteinG, 300) * servings * 10) / 10;
  const carbsG = Math.max(0, Math.round(((kcal - proteinG * 4 - fatG * 9) / 4) * 10) / 10);

  const refKcal = goalProfile?.kcal || DAILY_REFERENCE_TH.kcal;
  const refSugar = goalProfile?.sugarG || DAILY_REFERENCE_TH.sugarG;
  const refSodium = goalProfile?.sodiumMg || DAILY_REFERENCE_TH.sodiumMg;

  return {
    productNameTh: String(input.productNameTh || '').trim().slice(0, 80) || 'ผลิตภัณฑ์จากฉลาก GDA',
    barcode: String(input.barcode || '').replace(/\D+/g, '').slice(0, 20),
    servingsEaten: servings,
    kcal,
    proteinG,
    carbsG,
    fatG,
    sodiumMg,
    sugarG,
    fiberG: 0,
    rdiPct: {
      kcal: Math.round((kcal / refKcal) * 100),
      sugar: Math.round((sugarG / refSugar) * 100),
      fat: Math.round((fatG / DAILY_REFERENCE_TH.fatG) * 100),
      sodium: Math.round((sodiumMg / refSodium) * 100),
    },
    levels: {
      sodium: evaluateNutrientLevel('sodiumMg', sodiumMg, goalProfile),
      sugar: evaluateNutrientLevel('sugarG', sugarG, goalProfile),
      fat: evaluateNutrientLevel('fatG', fatG, goalProfile),
    },
    provenance: input.fromFixture ? PROVENANCE.ILLUSTRATIVE_DEMO : PROVENANCE.USER_GDA_LABEL,
  };
}

const DEMO_VISIBLE_COMPONENTS = Object.freeze({
  pad_krapow_gai: ['ไก่สับผัดกะเพรา', 'ข้าวสวย', 'ไข่ดาว'],
  som_tum_thai: ['มะละกอดิบ', 'มะเขือเทศ', 'ถั่วฝักยาว', 'ถั่วลิสงคั่ว'],
  tom_yum_kung: ['กุ้งสด', 'เห็ดฟาง', 'ตะไคร้-ใบมะกรูด', 'น้ำซุปใส'],
});

export function demoClassifyImage({ filename = '', presetId = null } = {}) {
  if (presetId === 'not_food_demo') {
    return {
      outcome: 'not_food',
      foodId: UNKNOWN_DISH_ID,
      confidence: 0.94,
      suggestedPortionMultiplier: 1,
      reasonTh: 'ภาพตัวอย่างนี้ถูกจำลองเป็นวัตถุที่ไม่ใช่อาหาร เพื่อทดสอบการแจ้งเตือนอย่างปลอดภัย',
      visibleComponentsTh: [],
      provenance: PROVENANCE.ILLUSTRATIVE_DEMO,
    };
  }

  if (presetId) {
    const presetDish = getDishById(presetId);
    if (presetDish) {
      return {
        outcome: 'matched',
        foodId: presetDish.id,
        confidence: 0.92,
        suggestedPortionMultiplier: 1,
        reasonTh: `โหมดทดลองตรวจพบภาพตัวอย่าง "${presetDish.nameTh}" (กรุณาตรวจสอบและปรับปริมาณ หรือเพิ่มเมนูร่วมในจานได้)`,
        visibleComponentsTh: DEMO_VISIBLE_COMPONENTS[presetDish.id] || [],
        provenance: PROVENANCE.ILLUSTRATIVE_DEMO,
      };
    }
  }

  const normalized = String(filename || '').toLowerCase();
  for (const dish of THAI_FOOD_CATALOG) {
    if (dish.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return {
        outcome: 'matched',
        foodId: dish.id,
        confidence: 0.84,
        suggestedPortionMultiplier: 1,
        reasonTh: `โหมดทดลองจับคู่จากชื่อไฟล์ได้ใกล้เคียง "${dish.nameTh}" — กรุณาตรวจสอบเมนูจริงด้วยตนเอง`,
        visibleComponentsTh: DEMO_VISIBLE_COMPONENTS[dish.id] || [],
        provenance: PROVENANCE.ILLUSTRATIVE_DEMO,
      };
    }
  }

  return {
    outcome: 'uncertain',
    foodId: UNKNOWN_DISH_ID,
    confidence: 0.38,
    suggestedPortionMultiplier: 1,
    reasonTh:
      'โหมดทดลองไม่ได้ส่งภาพไปยังโมเดล AI จริง จึงไม่สามารถอ่านภาพอัปโหลดทั่วไปอัตโนมัติได้ กรุณาค้นหา/เลือกเมนูด้านล่างด้วยตนเอง หรือสลับไปโหมด AI Vision (Server)',
    visibleComponentsTh: [],
    provenance: PROVENANCE.ILLUSTRATIVE_DEMO,
  };
}

export function getLocalDateKey(isoString = new Date().toISOString()) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildMealRecord({
  id,
  mode = 'demo',
  foodId = UNKNOWN_DISH_ID,
  customFoodName = '',
  portionMultiplier = 1,
  items = null,
  gdaData = null,
  mealType = 'lunch',
  note = '',
  scanOutcome = 'matched',
  confidence = null,
  timestamp = new Date().toISOString(),
} = {}) {
  const validMealType = MEAL_TYPES.some((m) => m.id === mealType) ? mealType : 'lunch';
  const safeNote = String(note || '').trim().slice(0, 140);
  const safeConfidence = Number.isFinite(Number(confidence))
    ? Math.round(Number(confidence) * 100) / 100
    : null;

  // Packaged GDA label mode (user-copied or sample fixture)
  if (mode === 'gda' && gdaData) {
    const evaluated = evaluateGdaLabel(gdaData);
    return {
      id: id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      dateKey: getLocalDateKey(timestamp),
      mode: 'gda',
      provenance: evaluated.provenance,
      scanOutcome: 'gda_label',
      confidence: null,
      foodId: evaluated.barcode ? `barcode_${evaluated.barcode}` : 'gda_custom',
      foodNameTh: evaluated.productNameTh,
      servingLabel: '1 หน่วยบริโภค',
      portionMultiplier: evaluated.servingsEaten,
      estimatedGrams: null,
      items: [],
      mealType: validMealType,
      note: safeNote,
      nutrients: {
        kcal: evaluated.kcal,
        proteinG: evaluated.proteinG,
        carbsG: evaluated.carbsG,
        fatG: evaluated.fatG,
        sodiumMg: evaluated.sodiumMg,
        sugarG: evaluated.sugarG,
        fiberG: 0,
      },
    };
  }

  const normalizedMode = mode === 'ai' ? 'ai' : 'demo';

  // Normalize single-dish or multi-dish tray into items array
  const normalizedItems =
    Array.isArray(items) && items.length > 0
      ? items.map((entry) => {
          const d = getDishById(entry.foodId);
          const mult = clampPortionMultiplier(entry.portionMultiplier);
          const customName = String(entry.customFoodName || '').trim().slice(0, 80);
          return {
            foodId: d ? d.id : UNKNOWN_DISH_ID,
            foodNameTh: d ? d.nameTh : customName || 'เมนูไม่ระบุชื่อ',
            portionMultiplier: mult,
            estimatedGrams: d ? Math.round(d.servingGrams * mult) : null,
          };
        })
      : [
          (() => {
            const d = getDishById(foodId);
            const mult = clampPortionMultiplier(portionMultiplier);
            const customName = String(customFoodName || '').trim().slice(0, 80);
            return {
              foodId: d ? d.id : UNKNOWN_DISH_ID,
              foodNameTh: d ? d.nameTh : customName || 'เมนูไม่ระบุชื่อ',
              portionMultiplier: mult,
              estimatedGrams: d ? Math.round(d.servingGrams * mult) : null,
            };
          })(),
        ];

  const primary = normalizedItems[0];
  const combinedName = normalizedItems.map((it) => it.foodNameTh).join(' + ');
  const totalGrams = normalizedItems.reduce(
    (sum, it) => (it.estimatedGrams ? sum + it.estimatedGrams : sum),
    0
  );

  // SAFETY INVARIANT:
  // AI mode MUST NEVER attach, display, or export unverified illustrative nutrient fixtures.
  const comboNutrients =
    normalizedMode === 'demo' ? scaleComboNutrition(normalizedItems) : null;

  const provenance =
    normalizedMode === 'ai'
      ? PROVENANCE.AI_CLASSIFICATION_ONLY
      : PROVENANCE.ILLUSTRATIVE_DEMO;

  return {
    id: id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    dateKey: getLocalDateKey(timestamp),
    mode: normalizedMode,
    provenance,
    scanOutcome,
    confidence: safeConfidence,
    foodId: normalizedItems.length === 1 ? primary.foodId : 'combo_meal',
    foodNameTh: combinedName,
    servingLabel: normalizedItems.length === 1 ? getDishById(primary.foodId)?.servingLabel || '1 ที่' : `${normalizedItems.length} รายการ`,
    portionMultiplier: normalizedItems.length === 1 ? primary.portionMultiplier : 1,
    estimatedGrams: totalGrams > 0 ? totalGrams : null,
    items: normalizedItems,
    mealType: validMealType,
    note: safeNote,
    nutrients: comboNutrients,
  };
}

export function updateMealRecord(existing, updates = {}) {
  if (!existing) return null;
  const nextMealType = MEAL_TYPES.some((m) => m.id === updates.mealType)
    ? updates.mealType
    : existing.mealType;
  const nextNote =
    updates.note !== undefined ? String(updates.note).trim().slice(0, 140) : existing.note || '';
  const nextPortion =
    updates.portionMultiplier !== undefined
      ? clampPortionMultiplier(updates.portionMultiplier)
      : existing.portionMultiplier || 1;
  const nextName =
    updates.foodNameTh !== undefined && String(updates.foodNameTh).trim()
      ? String(updates.foodNameTh).trim().slice(0, 120)
      : existing.foodNameTh;

  // Enforce AI mode invariant on edits too
  if (existing.mode === 'ai') {
    const updatedItems = Array.isArray(existing.items) && existing.items.length === 1
      ? [{ ...existing.items[0], foodNameTh: nextName, portionMultiplier: nextPortion }]
      : existing.items || [];
    return {
      ...existing,
      foodNameTh: nextName,
      portionMultiplier: nextPortion,
      items: updatedItems,
      mealType: nextMealType,
      note: nextNote,
      nutrients: null,
      provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
    };
  }

  // Recompute nutrients proportionally when portion changes
  let nextNutrients = existing.nutrients;
  let nextGrams = existing.estimatedGrams;
  let nextItems = existing.items || [];

  const prevPortion = existing.portionMultiplier || 1;
  if (existing.mode === 'demo' && existing.items?.length === 1 && getDishById(existing.items[0].foodId)) {
    const dish = getDishById(existing.items[0].foodId);
    const scaled = scaleNutrition(dish, nextPortion);
    nextNutrients = scaled;
    nextGrams = scaled.estimatedGrams;
    nextItems = [{ ...existing.items[0], foodNameTh: nextName, portionMultiplier: nextPortion, estimatedGrams: scaled.estimatedGrams }];
  } else if (existing.nutrients && prevPortion > 0 && nextPortion !== prevPortion) {
    const ratio = nextPortion / prevPortion;
    nextNutrients = {
      ...existing.nutrients,
      kcal: Math.round((existing.nutrients.kcal || 0) * ratio),
      proteinG: Math.round((existing.nutrients.proteinG || 0) * ratio * 10) / 10,
      carbsG: Math.round((existing.nutrients.carbsG || 0) * ratio * 10) / 10,
      fatG: Math.round((existing.nutrients.fatG || 0) * ratio * 10) / 10,
      sodiumMg: Math.round((existing.nutrients.sodiumMg || 0) * ratio),
      sugarG: Math.round((existing.nutrients.sugarG || 0) * ratio * 10) / 10,
      fiberG: Math.round((existing.nutrients.fiberG || 0) * ratio * 10) / 10,
    };
    if (nextGrams) nextGrams = Math.round(nextGrams * ratio);
  }

  return {
    ...existing,
    foodNameTh: nextName,
    portionMultiplier: nextPortion,
    estimatedGrams: nextGrams,
    items: nextItems,
    mealType: nextMealType,
    note: nextNote,
    nutrients: nextNutrients,
  };
}

export function summarizeDailyRecords(
  records = [],
  targetDateKey = getLocalDateKey(),
  goalProfile = null
) {
  const goal = goalProfile || resolveGoalProfile();
  const dayRecords = records.filter((rec) => rec && rec.dateKey === targetDateKey);
  const totals = {
    totalCount: dayRecords.length,
    demoEstimatedCount: 0,
    gdaLabelCount: 0,
    aiClassificationOnlyCount: 0,
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    sodiumMg: 0,
    sugarG: 0,
    fiberG: 0,
  };

  for (const rec of dayRecords) {
    if (rec.mode === 'ai' || !rec.nutrients) {
      totals.aiClassificationOnlyCount += 1;
      continue;
    }
    if (rec.mode === 'gda') {
      totals.gdaLabelCount += 1;
    } else {
      totals.demoEstimatedCount += 1;
    }
    totals.kcal += rec.nutrients.kcal || 0;
    totals.proteinG += rec.nutrients.proteinG || 0;
    totals.carbsG += rec.nutrients.carbsG || 0;
    totals.fatG += rec.nutrients.fatG || 0;
    totals.sodiumMg += rec.nutrients.sodiumMg || 0;
    totals.sugarG += rec.nutrients.sugarG || 0;
    totals.fiberG += rec.nutrients.fiberG || 0;
  }

  totals.proteinG = Math.round(totals.proteinG * 10) / 10;
  totals.carbsG = Math.round(totals.carbsG * 10) / 10;
  totals.fatG = Math.round(totals.fatG * 10) / 10;
  totals.sugarG = Math.round(totals.sugarG * 10) / 10;
  totals.fiberG = Math.round(totals.fiberG * 10) / 10;

  totals.rdiPct = {
    kcal: Math.min(200, Math.round((totals.kcal / goal.kcal) * 100)),
    protein: Math.min(200, Math.round((totals.proteinG / goal.proteinG) * 100)),
    sodium: Math.min(200, Math.round((totals.sodiumMg / goal.sodiumMg) * 100)),
    sugar: Math.min(200, Math.round((totals.sugarG / goal.sugarG) * 100)),
  };

  return totals;
}

export function summarizeSevenDayTrend(records = [], endDate = new Date()) {
  const base = new Date(endDate);
  base.setHours(12, 0, 0, 0);
  const buckets = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - offset);
    const dateKey = getLocalDateKey(d.toISOString());
    const daySummary = summarizeDailyRecords(records, dateKey);
    const shortLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    buckets.push({
      dateKey,
      shortLabel,
      kcal: daySummary.kcal,
      proteinG: daySummary.proteinG,
      sodiumMg: daySummary.sodiumMg,
      sugarG: daySummary.sugarG,
      totalCount: daySummary.totalCount,
      aiCount: daySummary.aiClassificationOnlyCount,
    });
  }

  return buckets;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function recordsToCsv(records = []) {
  const headers = [
    'timestamp',
    'date',
    'meal_type',
    'mode',
    'provenance',
    'scan_outcome',
    'confidence',
    'food_id',
    'food_name_th',
    'portion_multiplier',
    'estimated_grams',
    'kcal_illustrative',
    'protein_g_illustrative',
    'carbs_g_illustrative',
    'fat_g_illustrative',
    'sodium_mg_illustrative',
    'sugar_g_illustrative',
    'fiber_g_illustrative',
    'note',
  ];

  const rows = [headers.join(',')];

  for (const rec of records) {
    // Enforce invariant even on externally loaded records: AI mode NEVER exports nutrient fixtures
    const allowNutrients = rec.mode !== 'ai' && rec.nutrients;
    const cells = [
      rec.timestamp,
      rec.dateKey,
      rec.mealType,
      rec.mode,
      rec.provenance,
      rec.scanOutcome,
      rec.confidence ?? '',
      rec.foodId,
      rec.foodNameTh,
      rec.portionMultiplier,
      rec.estimatedGrams ?? '',
      allowNutrients ? rec.nutrients.kcal : '',
      allowNutrients ? rec.nutrients.proteinG : '',
      allowNutrients ? rec.nutrients.carbsG : '',
      allowNutrients ? rec.nutrients.fatG : '',
      allowNutrients ? rec.nutrients.sodiumMg : '',
      allowNutrients ? rec.nutrients.sugarG : '',
      allowNutrients ? rec.nutrients.fiberG : '',
      rec.note || '',
    ];
    rows.push(cells.map(escapeCsvCell).join(','));
  }

  return `\uFEFF${rows.join('\r\n')}`;
}
