export const CREATION_LEVELS = {
  p1: {
    label: "ป.1–ป.3",
    title: "🧸 Visual Creator (เลือกภาพแล้วสร้างเกม)",
    goal: "เลือกภาพและทดลองเล่น — ปลูกฝังการสังเกตและความคิดสร้างสรรค์",
    score: 5,
    levels: 1,
    help: "เริ่มจากเลือกเกมที่ชอบ เลือกตัวละครและฉาก แล้วกดสร้างเกมได้ทันที!",
    quizCount: 3,
    badge: "🌱 ผู้สร้างตัวจิ๋ว",
    creatorMode: "visual"
  },
  p4: {
    label: "ป.4–ป.6",
    title: "🛠️ Block & Rule Designer (นักออกแบบเกมรุ่นเยาว์)",
    goal: "กำหนดเป้าหมาย ตัวแปร และภารกิจ — เข้าใจความสัมพันธ์ของกติกาเกม",
    score: 10,
    levels: 2,
    help: "เลือกพลังพิเศษ ของสะสม และปรับความท้าทาย เพื่อสร้างเกมให้เพื่อนเล่นผ่าน",
    quizCount: 4,
    badge: "⚡ นักออกแบบเกม",
    creatorMode: "blocks"
  },
  m1: {
    label: "ม.1–ม.3",
    title: "🧩 Logic & Experiment Lab (ห้องทดลองตรรกะและเงื่อนไข)",
    goal: "วางกฎ ทดสอบเงื่อนไข และตั้งสมมติฐาน — พัฒนาทักษะ Computational Thinking",
    score: 15,
    levels: 3,
    help: "กำหนดเงื่อนไขชนะ/แพ้ ทดลองปรับความเร็วและเวลา แล้วสังเกตผลลัพธ์",
    quizCount: 5,
    badge: "🧪 นักเขียนตรรกะ",
    creatorMode: "logic"
  },
  m4: {
    label: "ม.4–ม.6",
    title: "📊 Engine & Systems Architect (วิเคราะห์ระบบและสมดุลเกม)",
    goal: "วิเคราะห์ความสมดุล ปรับฟิสิกส์ และ Game Schema — เรียนรู้สถาปัตยกรรม Game Engine",
    score: 20,
    levels: 4,
    help: "ปรับพารามิเตอร์ฟิสิกส์ (แรงโน้มถ่วง, สปีด) และคำนวณ Game Balancing Index",
    quizCount: 6,
    badge: "📐 สถาปนิกเกม",
    creatorMode: "engine"
  }
};

export const GENRES = [
  {type:"adventure", icon:"🐰", name:"ผจญภัย", description:"วิ่ง กระโดด เก็บของ", text:"สร้างเกมกระต่ายผจญภัยในป่า"},
  {type:"maze", icon:"🧩", name:"เขาวงกต", description:"หาทางออกและผ่านด่าน", text:"สร้างเกมเขาวงกตในปราสาท"},
  {type:"quiz", icon:"🧠", name:"ตอบคำถาม", description:"ตอบคำถามและอ่านเฉลย", text:"สร้างเกมตอบคำถามวิทยาศาสตร์"},
  {type:"dodge", icon:"🚀", name:"หลบสิ่งกีดขวาง", description:"หลบอุกกาบาตและเก็บคะแนน", text:"สร้างเกมยานอวกาศหลบอุกกาบาต"}
];

export function exampleFor(type, age) {
  const p = CREATION_LEVELS[age] || CREATION_LEVELS.p4;
  const genre = GENRES.find(g => g.type === type) || GENRES[0];
  if (type === "quiz") return genre.text;
  if (type === "maze") return genre.text + " มี " + p.levels + " ด่าน";
  return genre.text + " เก็บ " + p.score + " คะแนน มี " + (age === "p1" ? 5 : age === "m4" ? 2 : 3) + " ชีวิต และมี " + p.levels + " ด่าน";
}
