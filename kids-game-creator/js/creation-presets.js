export const CREATION_LEVELS={
 p1:{label:"ป.1–ป.3",goal:"เลือกภาพและทดลองเล่น",score:5,levels:1,help:"เริ่มจากเลือกเกมที่ชอบ แล้วกดสร้างเกม",quizCount:3},
 p4:{label:"ป.4–ป.6",goal:"กำหนดเป้าหมายและจำนวนด่าน",score:10,levels:2,help:"ลองปรับคะแนน จำนวนชีวิต หรือด่าน",quizCount:4},
 m1:{label:"ม.1–ม.3",goal:"วางกฎและทดสอบเงื่อนไข",score:15,levels:3,help:"ทดลองเปลี่ยนกฎ แล้วสังเกตผล",quizCount:5},
 m4:{label:"ม.4–ม.6",goal:"วิเคราะห์ความสมดุลของเกม",score:20,levels:4,help:"ปรับคะแนน ชีวิต และด่านเพื่อเปรียบเทียบความยาก",quizCount:6}
};
export const GENRES=[
 {type:"adventure",icon:"🐰",name:"ผจญภัย",description:"วิ่ง กระโดด เก็บของ",text:"สร้างเกมกระต่ายผจญภัยในป่า"},
 {type:"maze",icon:"🧩",name:"เขาวงกต",description:"หาทางออกและผ่านด่าน",text:"สร้างเกมเขาวงกตในปราสาท"},
 {type:"quiz",icon:"🧠",name:"ตอบคำถาม",description:"ตอบคำถามและอ่านเฉลย",text:"สร้างเกมตอบคำถามวิทยาศาสตร์"},
 {type:"dodge",icon:"🚀",name:"หลบสิ่งกีดขวาง",description:"หลบอุกกาบาตและเก็บคะแนน",text:"สร้างเกมยานอวกาศหลบอุกกาบาต"}
];
export function exampleFor(type,age){
 const p=CREATION_LEVELS[age]||CREATION_LEVELS.p4;
 const genre=GENRES.find(g=>g.type===type)||GENRES[0];
 if(type==="quiz")return genre.text;
 if(type==="maze")return genre.text+" มี "+p.levels+" ด่าน";
 return genre.text+" เก็บ "+p.score+" คะแนน มี "+(age==="p1"?5:age==="m4"?2:3)+" ชีวิต และมี "+p.levels+" ด่าน";
}
