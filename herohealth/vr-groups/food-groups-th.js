/* === /herohealth/vr-groups/food-groups-th.js ===
   Thai Food Groups Canon (LOCKED) + examples + emoji sets
   ✅ ใช้ “บทท่องจำ” ตามที่ผู้ใช้กำหนด: ห้ามแปลผัน
*/

'use strict';

export const THAI_FOOD_GROUP_SONG = [
  'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน',
  'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน',
  'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง',
  'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ',
  'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน',
  'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย'
];

// Canonical 5 groups (ไทย)
export const THAI_FOOD_GROUPS = {
  1: {
    id: 1,
    labelTH: 'หมู่ 1',
    roleTH: 'โปรตีน ช่วยให้เติบโตแข็งแรง',
    songLineTH: THAI_FOOD_GROUP_SONG[1],
    // Emoji sets สำหรับเป้า (ปรับได้)
    emoji: ['🥛','🥚','🍗','🐟','🥜','🫘','🍖','🧀'],
    // ตัวอย่างอาหารไทย (ใช้ทำ tooltip/coach/บัตรความรู้)
    examplesTH: ['นม', 'ไข่', 'ไก่', 'ปลา', 'หมู', 'เต้าหู้', 'ถั่วลิสง', 'ถั่วเหลือง']
  },
  2: {
    id: 2,
    labelTH: 'หมู่ 2',
    roleTH: 'คาร์โบไฮเดรต ให้พลังงาน',
    songLineTH: THAI_FOOD_GROUP_SONG[2],
    emoji: ['🍚','🍞','🥔','🍠','🍜','🥖','🍙','🥨'],
    examplesTH: ['ข้าว', 'ขนมปัง', 'ก๋วยเตี๋ยว', 'เผือก', 'มัน', 'แป้ง', 'น้ำตาล', 'เส้นหมี่']
  },
  3: {
    id: 3,
    labelTH: 'หมู่ 3',
    roleTH: 'ผัก วิตามิน/แร่ธาตุ/ใยอาหาร',
    songLineTH: THAI_FOOD_GROUP_SONG[3],
    emoji: ['🥦','🥬','🥕','🌽','🥒','🍆','🫛','🍄'],
    examplesTH: ['คะน้า', 'ผักบุ้ง', 'กะหล่ำปลี', 'แตงกวา', 'แครอท', 'ฟักทอง', 'เห็ด', 'ถั่วฝักยาว']
  },
  4: {
    id: 4,
    labelTH: 'หมู่ 4',
    roleTH: 'ผลไม้ วิตามินและความสดชื่น',
    songLineTH: THAI_FOOD_GROUP_SONG[4],
    emoji: ['🍎','🍌','🍊','🍉','🍓','🍍','🥭','🍇'],
    examplesTH: ['กล้วย', 'ส้ม', 'มะม่วง', 'แตงโม', 'ฝรั่ง', 'สับปะรด', 'ชมพู่', 'องุ่น']
  },
  5: {
    id: 5,
    labelTH: 'หมู่ 5',
    roleTH: 'ไขมัน ให้ความอบอุ่นและพลังงานสำรอง',
    songLineTH: THAI_FOOD_GROUP_SONG[5],
    emoji: ['🥑','🫒','🧈','🥥','🧀','🌰','🥜','🍳'],
    examplesTH: ['น้ำมันพืช', 'กะทิ', 'เนย', 'ชีส', 'อะโวคาโด', 'งา', 'ถั่ว', 'ไขมันจากเนื้อสัตว์']
  }
};

// ของที่ “ไม่ใช่” 5 หมู่ (ใช้เป็น junk/decoy)
export const JUNK_EMOJI = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
export const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈'];

// helper
export function groupIds(){ return [1,2,3,4,5]; }
export function getGroup(id){ return THAI_FOOD_GROUPS[id] || THAI_FOOD_GROUPS[1]; }
