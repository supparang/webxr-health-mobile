// /herohealth/plate/data/plate-analyze-foods.js (MVP)
export const FOODS = [
  { id:'rice', nameTH:'ข้าวสวย', group:2, price:10, prepMin:1, allergens:[], tags:['carb','budget'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'brown_rice', nameTH:'ข้าวกล้อง', group:2, price:15, prepMin:2, allergens:[], tags:['carb','fiber'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'bread_whole', nameTH:'ขนมปังโฮลวีต', group:2, price:12, prepMin:1, allergens:['gluten'], tags:['carb','quick'], nutr:{protein:'low', carb:'med', veg:false, fruit:false, fat:'low', sugar:'low', processed:true, fried:false} },

  { id:'egg_boiled', nameTH:'ไข่ต้ม', group:1, price:12, prepMin:1, allergens:['egg'], tags:['protein_high','quick','budget'], nutr:{protein:'high', carb:'low', veg:false, fruit:false, fat:'med', sugar:'low', processed:false, fried:false} },
  { id:'chicken_shred', nameTH:'อกไก่ฉีก', group:1, price:25, prepMin:3, allergens:[], tags:['protein_high','lean'], nutr:{protein:'high', carb:'low', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'tofu', nameTH:'เต้าหู้', group:1, price:15, prepMin:3, allergens:['soy'], tags:['protein_med','budget'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'milk', nameTH:'นมจืด', group:1, price:15, prepMin:0, allergens:['milk'], tags:['protein_med','dairy'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'med', sugar:'low', processed:false, fried:false} },
  { id:'yogurt', nameTH:'โยเกิร์ต', group:1, price:20, prepMin:0, allergens:['milk'], tags:['dairy'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'low', sugar:'med', processed:true, fried:false} },

  { id:'cucumber', nameTH:'แตงกวา', group:3, price:8, prepMin:1, allergens:[], tags:['veg','quick','budget'], nutr:{protein:'low', carb:'low', veg:true, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'carrot', nameTH:'แครอท', group:3, price:10, prepMin:2, allergens:[], tags:['veg'], nutr:{protein:'low', carb:'low', veg:true, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },
  { id:'morning_glory', nameTH:'ผักบุ้งลวก', group:3, price:12, prepMin:4, allergens:[], tags:['veg'], nutr:{protein:'low', carb:'low', veg:true, fruit:false, fat:'low', sugar:'low', processed:false, fried:false} },

  { id:'banana', nameTH:'กล้วย', group:4, price:10, prepMin:0, allergens:[], tags:['fruit','quick','budget'], nutr:{protein:'low', carb:'med', veg:false, fruit:true, fat:'low', sugar:'med', processed:false, fried:false} },
  { id:'apple', nameTH:'แอปเปิล', group:4, price:20, prepMin:0, allergens:[], tags:['fruit'], nutr:{protein:'low', carb:'med', veg:false, fruit:true, fat:'low', sugar:'med', processed:false, fried:false} },
  { id:'papaya', nameTH:'มะละกอ', group:4, price:15, prepMin:1, allergens:[], tags:['fruit'], nutr:{protein:'low', carb:'low', veg:false, fruit:true, fat:'low', sugar:'med', processed:false, fried:false} },

  { id:'avocado', nameTH:'อะโวคาโด', group:5, price:35, prepMin:1, allergens:[], tags:['fat_good'], nutr:{protein:'low', carb:'low', veg:false, fruit:false, fat:'high', sugar:'low', processed:false, fried:false} },
  { id:'nuts_mix', nameTH:'ถั่วรวม', group:5, price:20, prepMin:0, allergens:['nuts'], tags:['fat_good','snack'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'high', sugar:'low', processed:false, fried:false} },

  { id:'fried_sausage', nameTH:'ไส้กรอกทอด', group:1, price:20, prepMin:2, allergens:[], tags:['processed','fried'], nutr:{protein:'med', carb:'low', veg:false, fruit:false, fat:'high', sugar:'low', processed:true, fried:true} },
  { id:'sweet_drink', nameTH:'น้ำหวาน', group:2, price:15, prepMin:0, allergens:[], tags:['sugary'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'low', sugar:'high', processed:true, fried:false} },
  { id:'donut', nameTH:'โดนัท', group:2, price:18, prepMin:0, allergens:['gluten','egg','milk'], tags:['sugary','fried'], nutr:{protein:'low', carb:'high', veg:false, fruit:false, fat:'high', sugar:'high', processed:true, fried:true} }
];