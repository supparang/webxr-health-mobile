// /herohealth/plate/data/plate-analyze-foods.js
'use strict';

export const FOODS = [
  // Group 1: Protein (ไทย mapping: หมู่ 1 โปรตีน)
  { id:'egg_boiled', nameTH:'ไข่ต้ม', emoji:'🥚', group:1, price:12, prepMin:1, allergens:['egg'], tags:['protein_high','quick','budget'], nutr:{protein:'high', carb:'low', veg:false, fruit:false, fat:'med', sugar:'low', processed:false, fried:false} },
  { id:'chicken_shred', nameTH:'อกไก่ฉีก', emoji:'🍗', group:1, price:25, prepMin:3, allergens:[], tags:['protein_high','lean'], nutr:{protein:'high', carb:'low', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'tofu', nameTH:'เต้าหู้', emoji:'🧈', group:1, price:15, prepMin:3, allergens:['soy'], tags:['protein_med','budget'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'milk', nameTH:'นมจืด', emoji:'🥛', group:1, price:15, prepMin:0, allergens:['milk'], tags:['protein_med','dairy'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'med', sugar:'low', processed:false, fried:false} },
  { id:'yogurt', nameTH:'โยเกิร์ต', emoji:'🥣', group:1, price:20, prepMin:0, allergens:['milk'], tags:['dairy'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'low', sugar:'med', processed:true, fried:false} },
  { id:'fried_sausage', nameTH:'ไส้กรอกทอด', emoji:'🌭', group:1, price:20, prepMin:2, allergens:[], tags:['processed','fried'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'high', sugar:'low', processed:true, fried:true} },

  // Group 2: Carb (ไทย mapping: หมู่ 2 คาร์โบไฮเดรต)
  { id:'rice', nameTH:'ข้าวสวย', emoji:'🍚', group:2, price:10, prepMin:1, allergens:[], tags:['carb','budget'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'brown_rice', nameTH:'ข้าวกล้อง', emoji:'🍚', group:2, price:15, prepMin:2, allergens:[], tags:['carb','fiber'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'bread_whole', nameTH:'ขนมปังโฮลวีต', emoji:'🍞', group:2, price:12, prepMin:1, allergens:['gluten'], tags:['carb','quick'], nutr:{protein:'low', carb:'med', veg:false, fruit:false, fat:'low', sugar:'low', processed:true, fried:false} },
  { id:'sweet_drink', nameTH:'น้ำหวาน', emoji:'🧃', group:2, price:15, prepMin:0, allergens:[], tags:['sugary'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'low', sugar:'high', processed:true, fried:false} },
  { id:'donut', nameTH:'โดนัท', emoji:'🍩', group:2, price:18, prepMin:0, allergens:['gluten','egg','milk'], tags:['sugary','fried'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'high', sugar:'high', processed:true, fried:true} },

  // Group 3: Vegetables (ไทย mapping: หมู่ 3 ผัก)
  { id:'cucumber', nameTH:'แตงกวา', emoji:'🥒', group:3, price:8, prepMin:1, allergens:[], tags:['veg','quick','budget'], nutr:{protein:'low', carb:'low', veg:true, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'carrot', nameTH:'แครอท', emoji:'🥕', group:3, price:10, prepMin:2, allergens:[], tags:['veg'], nutr:{protein:'low', carb:'low', veg:true, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'morning_glory', nameTH:'ผักบุ้งลวก', emoji:'🥬', group:3, price:12, prepMin:4, allergens:[], tags:['veg'], nutr:{protein:'low', carb:'low', veg:true, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },

  // Group 4: Fruits (ไทย mapping: หมู่ 4 ผลไม้)
  { id:'banana', nameTH:'กล้วย', emoji:'🍌', group:4, price:10, prepMin:0, allergens:[], tags:['fruit','quick','budget'], nutr:{protein:'low', carb:'med', veg:false, fruit:true, fat:'low', sugar:'med', processed:false, fried:false} },
  { id:'apple', nameTH:'แอปเปิล', emoji:'🍎', group:4, price:20, prepMin:0, allergens:[], tags:['fruit'], nutr:{protein:'low', carb:'med', veg:false, fruit:true, fat:'low', sugar:'med', processed:false, fried:false} },
  { id:'papaya', nameTH:'มะละกอ', emoji:'🍈', group:4, price:15, prepMin:1, allergens:[], tags:['fruit'], nutr:{protein:'low', carb:'low', veg:false, fruit:true, fat:'low', sugar:'med', processed:false, fried:false} },

  // Group 5: Fats (ไทย mapping: หมู่ 5 ไขมัน)
  { id:'avocado', nameTH:'อะโวคาโด', emoji:'🥑', group:5, price:35, prepMin:1, allergens:[], tags:['fat_good'], nutr:{protein:'low', carb:'low', veg:false, fruit:false, fat:'high', sugar:'low', processed:false, fried:false} },
  { id:'nuts_mix', nameTH:'ถั่วรวม', emoji:'🥜', group:5, price:20, prepMin:0, allergens:['nuts'], tags:['fat_good','snack'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'high', sugar:'low', processed:false, fried:false} }
];

export const FOODS_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));