// /herohealth/plate/data/plate-analyze-scenarios.js
'use strict';

export const SCENARIOS = [
  {
    id:'scn01',
    title:'เร่งรีบก่อนเข้าเรียน',
    context:'มีเวลาไม่มาก ต้องกินให้พอและไม่ชนข้อห้าม',
    constraints:{ maxPrepMin:5, maxBudget:50, avoidAllergens:['milk'] },
    goals:['protein_high'],
    available:['egg_boiled','milk','brown_rice','banana','chicken_shred','yogurt','cucumber','fried_sausage','sweet_drink','apple'],
    reasonChips:[
      'ตัดนมเพราะแพ้นม',
      'เลือกโปรตีนที่เตรียมเร็ว',
      'คุมงบด้วยอาหารง่าย ๆ',
      'เลือกของหวานเพื่อพลังงานเร็ว'
    ],
    preferredReasons:[
      'ตัดนมเพราะแพ้นม',
      'เลือกโปรตีนที่เตรียมเร็ว',
      'คุมงบด้วยอาหารง่าย ๆ'
    ]
  },
  {
    id:'scn02',
    title:'มื้อเช้าคุมหวาน',
    context:'อยากอิ่มนานและไม่หวานจัด',
    constraints:{ maxPrepMin:10, maxBudget:60, avoidTags:['sugary'] },
    goals:['satiety','low_sugar'],
    available:['bread_whole','egg_boiled','banana','apple','yogurt','sweet_drink','donut','cucumber','tofu'],
    reasonChips:[
      'ลดเครื่องดื่มหวานเพื่อคุมระดับน้ำตาล',
      'เพิ่มโปรตีนเพื่ออิ่มนาน',
      'เลือกโดนัทเพราะกินเร็วที่สุด',
      'เพิ่มผักให้สมดุล'
    ],
    preferredReasons:[
      'ลดเครื่องดื่มหวานเพื่อคุมระดับน้ำตาล',
      'เพิ่มโปรตีนเพื่ออิ่มนาน',
      'เพิ่มผักให้สมดุล'
    ]
  },
  {
    id:'scn03',
    title:'ก่อนออกกำลังกาย',
    context:'มื้อก่อนออกกำลัง ต้องไม่หนักท้องเกิน',
    constraints:{ maxPrepMin:15, maxBudget:80, avoidTags:['fried'] },
    goals:['preworkout_easy_digest'],
    available:['rice','banana','bread_whole','egg_boiled','fried_sausage','sweet_drink','papaya','tofu','cucumber'],
    reasonChips:[
      'เลือกคาร์บพอดีและย่อยง่าย',
      'หลีกเลี่ยงของทอดก่อนออกกำลัง',
      'กินน้ำหวานเยอะ ๆ จะดีที่สุด',
      'เพิ่มผลไม้แทนน้ำหวาน'
    ],
    preferredReasons:[
      'เลือกคาร์บพอดีและย่อยง่าย',
      'หลีกเลี่ยงของทอดก่อนออกกำลัง',
      'เพิ่มผลไม้แทนน้ำหวาน'
    ]
  },
  {
    id:'scn04',
    title:'หลังออกกำลังกาย',
    context:'ต้องการฟื้นตัว กล้ามเนื้อได้โปรตีน และยังสมดุล',
    constraints:{ maxPrepMin:20, maxBudget:90 },
    goals:['protein_high','postworkout_recovery','include_veg'],
    available:['chicken_shred','egg_boiled','rice','brown_rice','cucumber','carrot','banana','sweet_drink','fried_sausage'],
    reasonChips:[
      'เพิ่มโปรตีนหลังออกกำลัง',
      'เติมผักเพื่อสมดุลจาน',
      'เลือกของทอดแทนโปรตีนหลัก',
      'คาร์บพอดีช่วยฟื้นตัว'
    ],
    preferredReasons:[
      'เพิ่มโปรตีนหลังออกกำลัง',
      'เติมผักเพื่อสมดุลจาน',
      'คาร์บพอดีช่วยฟื้นตัว'
    ]
  },
  {
    id:'scn05',
    title:'มื้อกลางวันงบจำกัด',
    context:'งบน้อย แต่อยากให้สมดุลที่สุด',
    constraints:{ maxPrepMin:10, maxBudget:40, noMicrowave:true },
    goals:['balanced_plate'],
    available:['rice','egg_boiled','tofu','cucumber','banana','sweet_drink','donut'],
    reasonChips:[
      'คุมงบก่อน แล้วค่อยเติมหมู่ให้ครบที่สุด',
      'เลือกของหวานเพราะถูกกว่า',
      'เลือกโปรตีนราคาประหยัด',
      'เพิ่มผัก/ผลไม้แม้ปริมาณไม่มาก'
    ],
    preferredReasons:[
      'คุมงบก่อน แล้วค่อยเติมหมู่ให้ครบที่สุด',
      'เลือกโปรตีนราคาประหยัด',
      'เพิ่มผัก/ผลไม้แม้ปริมาณไม่มาก'
    ]
  },
  {
    id:'scn06',
    title:'แพ้ถั่ว',
    context:'ต้องครบหมู่ แต่ห้ามมีถั่ว',
    constraints:{ maxPrepMin:10, maxBudget:70, avoidAllergens:['nuts'] },
    goals:['balanced_plate'],
    available:['nuts_mix','egg_boiled','tofu','rice','cucumber','apple','avocado','milk'],
    reasonChips:[
      'ตัดถั่วเพราะแพ้ถั่ว',
      'แทนไขมันดีด้วยอะโวคาโด',
      'เลือกถั่วเพราะไขมันดีเสมอ',
      'เติมโปรตีนจากไข่หรือเต้าหู้'
    ],
    preferredReasons:[
      'ตัดถั่วเพราะแพ้ถั่ว',
      'แทนไขมันดีด้วยอะโวคาโด',
      'เติมโปรตีนจากไข่หรือเต้าหู้'
    ]
  },
  {
    id:'scn07',
    title:'มื้อก่อนสอบ',
    context:'ต้องการพลังงานคงที่ ไม่ง่วง ไม่หวานจัด',
    constraints:{ maxPrepMin:10, maxBudget:70, avoidTags:['sugary'] },
    goals:['steady_energy','low_sugar'],
    available:['brown_rice','bread_whole','egg_boiled','banana','apple','sweet_drink','donut','cucumber','milk'],
    reasonChips:[
      'ลดน้ำตาลสูงเพื่อลดแกว่งของพลังงาน',
      'เลือกโปรตีนร่วมกับคาร์บพอดี',
      'โดนัทช่วยอ่านหนังสือดีที่สุด',
      'เพิ่มผัก/ผลไม้เพื่อสมดุล'
    ],
    preferredReasons:[
      'ลดน้ำตาลสูงเพื่อลดแกว่งของพลังงาน',
      'เลือกโปรตีนร่วมกับคาร์บพอดี',
      'เพิ่มผัก/ผลไม้เพื่อสมดุล'
    ]
  },
  {
    id:'scn08',
    title:'ของในบ้านเท่านั้น',
    context:'ไม่มีงบเพิ่ม ใช้ของที่มีให้ดีที่สุด',
    constraints:{ maxPrepMin:15, maxBudget:0 },
    goals:['best_possible_balance'],
    available:['rice','egg_boiled','banana','cucumber','sweet_drink'],
    reasonChips:[
      'ใช้ของที่มีและพยายามให้สมดุลที่สุด',
      'ลดน้ำหวานแม้มีอยู่ในบ้าน',
      'เลือกทุกอย่างที่กินง่ายไม่ต้องคิด',
      'เติมผักก่อนถ้ามี'
    ],
    preferredReasons:[
      'ใช้ของที่มีและพยายามให้สมดุลที่สุด',
      'ลดน้ำหวานแม้มีอยู่ในบ้าน',
      'เติมผักก่อนถ้ามี'
    ]
  }
];