import {validateGame,AGE_PRESETS} from "./game-schema.js";
const detectType=t=>/คำถาม|แบบทดสอบ|quiz/i.test(t)?"quiz":/เขาวงกต|หาทางออก|maze/i.test(t)?"maze":/หลบ|อุกกาบาต|สิ่งกีดขวาง|dodge/i.test(t)?"dodge":"adventure";
const detectTheme=t=>/อวกาศ|ดาวเคราะห์|ยานอวกาศ/.test(t)?"space":/ปราสาท|อัศวิน/.test(t)?"castle":/ทะเล|มหาสมุทร|ปลา/.test(t)?"ocean":"forest";
const detectPlayer=t=>["กระต่าย","แมว","สุนัข","หมี","หุ่นยนต์","ยานอวกาศ","ปลา","นักผจญภัย"].find(x=>t.includes(x))||"ผู้เล่น";
const number=(t,re,f)=>{const m=t.match(re);return m?Number(m[1]):f;};
export function createGameFromThai(prompt,ageLevel="p4"){
 if(typeof prompt!=="string"||!prompt.trim())throw Error("กรุณาอธิบายเกม");
 if(prompt.length>1000)throw Error("ข้อความยาวเกิน 1,000 ตัวอักษร");
 if(!Object.hasOwn(AGE_PRESETS,ageLevel))throw Error("ระดับชั้นไม่ถูกต้อง");
 const t=prompt.trim(),p=AGE_PRESETS[ageLevel];
 return validateGame({type:detectType(t),ageLevel,title:t.slice(0,60),theme:detectTheme(t),player:{name:detectPlayer(t),lives:number(t,/(\d+)\s*ชีวิต/,p.lives)},rules:{difficulty:p.difficulty,timeLimit:number(t,/(\d+)\s*วินาที/,p.timeLimit),targetScore:number(t,/(?:เก็บ|สะสม)\D{0,25}?(\d+)\s*(?:ชิ้น|ดวง|เหรียญ|คะแนน|อัน)/,10),enemyCount:number(t,/(?:ศัตรู|หมาป่า|อุปสรรค)\s*(\d+)\s*ตัว/,2),levels:number(t,/(\d+)\s*ด่าน/,1)}});
}
