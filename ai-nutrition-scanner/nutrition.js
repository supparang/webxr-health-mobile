/* All values are fictional illustrative fixtures, NOT validated Thai food nutrition data. */
export const FOODS=Object.freeze([
  {id:"kaprao",name:"ข้าวกะเพราไก่ไข่ดาว",defaultGrams:300,per100:{kcal:195,protein:9.2,carb:21.4,fat:8.1,sugar:2.1,sodium:450}},
  {id:"khao-man-kai",name:"ข้าวมันไก่",defaultGrams:300,per100:{kcal:181,protein:8.6,carb:23.2,fat:6.0,sugar:1.5,sodium:350}},
  {id:"pad-thai",name:"ผัดไทยกุ้งสด",defaultGrams:250,per100:{kcal:190,protein:7.1,carb:23.4,fat:7.6,sugar:6.3,sodium:490}},
  {id:"som-tam",name:"ส้มตำไทย",defaultGrams:180,per100:{kcal:88,protein:2.7,carb:16.5,fat:1.9,sugar:9.2,sodium:720}},
  {id:"tom-yum",name:"ต้มยำกุ้งน้ำใส",defaultGrams:250,per100:{kcal:42,protein:4.5,carb:3.5,fat:1.0,sugar:1.1,sodium:590}},
  {id:"fried-rice",name:"ข้าวผัดหมู",defaultGrams:300,per100:{kcal:187,protein:7.3,carb:25.1,fat:6.6,sugar:1.9,sodium:420}},
  {id:"rice-omelette",name:"ข้าวไข่เจียว",defaultGrams:250,per100:{kcal:234,protein:8.6,carb:22.5,fat:12.2,sugar:1.0,sodium:310}},
  {id:"fruit",name:"ผลไม้รวม",defaultGrams:180,per100:{kcal:61,protein:0.7,carb:15.5,fat:0.2,sugar:10.6,sodium:4}}
]);
export const NUTRIENT_META=[["protein","โปรตีน","กรัม"],["carb","คาร์โบไฮเดรต","กรัม"],["fat","ไขมัน","กรัม"],["sugar","น้ำตาล","กรัม"],["sodium","โซเดียม","มก."]];
export function foodById(id){return FOODS.find(food=>food.id===id)||null;}
export function nutritionFor(food,grams){if(!food)throw Error("Unknown food");const weight=Number(grams);if(!Number.isFinite(weight)||weight<=0||weight>2000)throw Error("น้ำหนักต้องอยู่ระหว่าง 1–2,000 กรัม");const ratio=weight/100;return Object.fromEntries(Object.entries(food.per100).map(([key,value])=>[key,Math.round(value*ratio*10)/10]));}
export const SOURCE="ILLUSTRATIVE_FIXTURE_NOT_VALIDATED";