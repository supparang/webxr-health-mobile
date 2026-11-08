import { validateGame, AGE_PRESETS } from "./game-schema.js";

const detectType = t =>
  /คำถาม|แบบทดสอบ|quiz|ถาม:/i.test(t)
    ? "quiz"
    : /เขาวงกต|หาทางออก|maze/i.test(t)
    ? "maze"
    : /หลบ|อุกกาบาต|สิ่งกีดขวาง|dodge/i.test(t)
    ? "dodge"
    : "adventure";

const detectTheme = t =>
  /อวกาศ|ดาวเคราะห์|ยานอวกาศ|space/i.test(t)
    ? "space"
    : /ปราสาท|อัศวิน|castle/i.test(t)
    ? "castle"
    : /ทะเล|มหาสมุทร|ปลา|ใต้น้ำ|ocean/i.test(t)
    ? "ocean"
    : "forest";

const detectPlayer = t =>
  ["กระต่าย", "แมว", "สุนัข", "หมี", "หุ่นยนต์", "ยานอวกาศ", "ปลา", "นักผจญภัย"].find(x => t.includes(x)) || "ผู้เล่น";

const number = (t, re, f) => {
  const m = t.match(re);
  return m ? Number(m[1]) : f;
};

export function parseCustomQuizQuestions(text) {
  const lines = String(text || "").split(/\r?\n/);
  const custom = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!/^(?:Q|ถาม|ข้อ\s*\d*)\s*:/i.test(line)) continue;
    const body = line.replace(/^(?:Q|ถาม|ข้อ\s*\d*)\s*:\s*/i, "");
    const parts = body.split("|").map(s => s.trim()).filter(Boolean);
    if (parts.length >= 5) {
      const q = parts[0];
      const rawChoices = parts.slice(1, 5);
      let correct = 0;
      const a = rawChoices.map((c, idx) => {
        if (c.endsWith("*") || c.startsWith("*")) {
          correct = idx;
          return c.replace(/^\*|\*$/g, "").trim();
        }
        return c;
      });
      const why = (parts[5] || "คำตอบที่ถูกต้องตามที่ผู้ออกแบบกำหนด").replace(/^(?:เฉลย|เพราะ)\s*:\s*/i, "");
      const hint = parts[6] ? parts[6].replace(/^(?:คำใบ้|hint)\s*:\s*/i, "") : "";
      custom.push({ q, a, correct, why, hint });
    }
  }
  return custom;
}

export function createGameFromThai(prompt, ageLevel = "p4") {
  if (typeof prompt !== "string" || !prompt.trim()) throw Error("กรุณาอธิบายเกม");
  if (prompt.length > 1000) throw Error("ข้อความยาวเกิน 1,000 ตัวอักษร");
  if (!Object.hasOwn(AGE_PRESETS, ageLevel)) throw Error("ระดับชั้นไม่ถูกต้อง");

  const t = prompt.trim();
  const p = AGE_PRESETS[ageLevel];

  const parsedDiff = number(
    t,
    /ความยาก\s*(\d+)/,
    /ยากพิเศษ|ยากมาก|ระดับบอส|มีบอส/.test(t)
      ? Math.max(4, p.difficulty)
      : /โหมดยาก|แบบยาก|ท้าทาย/.test(t)
      ? Math.max(3, p.difficulty)
      : p.difficulty
  );

  const rules = {
    difficulty: parsedDiff,
    timeLimit: number(t, /(\d+)\s*วินาที/, p.timeLimit),
    targetScore: number(t, /(?:เก็บ|สะสม|ทำ|ได้|เป้าหมาย)\D{0,25}?(\d+)\s*(?:ชิ้น|ดวง|เหรียญ|คะแนน|อัน|แต้ม)/, 10),
    enemyCount: number(t, /(?:ศัตรู|หมาป่า|อุปสรรค|ผู้พิทักษ์)\s*(\d+)\s*ตัว/, parsedDiff >= 4 ? 4 : parsedDiff >= 3 ? 3 : 2),
    levels: number(t, /(\d+)\s*(?:ด่าน|เวฟ|wave)/i, 1)
  };

  // Optional Freeform / Advanced Natural Language & Parameter parsing
  if (/อัญมณี|เพชร|gem/i.test(t)) rules.itemType = "gem";
  else if (/เหรียญ|ทอง|coin/i.test(t)) rules.itemType = "coin";
  else if (/แอปเปิ้ล|apple/i.test(t)) rules.itemType = "apple";
  else if (/ดาว|ดวงดาว|star/i.test(t)) rules.itemType = "star";
  else if (/แครอท|carrot/i.test(t)) rules.itemType = "carrot";

  const explicitGravity = t.match(/(?:gravity|แรงโน้มถ่วง|g)\s*=?\s*([0-9]+\.[0-9]+)/i);
  if (explicitGravity) rules.gravity = Number(explicitGravity[1]);
  else if (/แรงโน้มถ่วงต่ำ|ดวงจันทร์|ลอยตัว/.test(t)) rules.gravity = 0.28;
  else if (/แรงโน้มถ่วงสูง|ตัวหนัก/.test(t)) rules.gravity = 0.85;

  const explicitJump = t.match(/(?:jump|แรงกระโดด)\s*=?\s*(-?[0-9]+(?:\.[0-9]+)?)/i);
  if (explicitJump) rules.jumpPower = -Math.abs(Number(explicitJump[1]));
  else if (/กระโดดสูง|พลังกระโดด/.test(t)) {
    rules.jumpPower = -12.6;
    rules.powerUp = "jump";
  }

  const explicitSpeed = t.match(/(?:speed|ความเร็วผู้เล่น)\s*=?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (explicitSpeed) rules.playerSpeed = Number(explicitSpeed[1]);
  else if (/วิ่งเร็ว|ความเร็วแสง|สปีดสูง/.test(t)) {
    rules.playerSpeed = 4.6;
    rules.powerUp = rules.powerUp || "speed";
  }

  if (/ศัตรูเร็ว|ศัตรูไว|ศัตรูโหด/.test(t)) rules.enemySpeedMultiplier = 1.45;
  else if (/ศัตรูช้า/.test(t)) rules.enemySpeedMultiplier = 0.75;

  if (/เอาชีวิตรอด|อยู่รอดจนหมดเวลา|survival/i.test(t)) rules.winCondition = "survival";

  const customQuestions = parseCustomQuizQuestions(t);
  if (customQuestions.length > 0) {
    rules.customQuestions = customQuestions;
  }

  return validateGame({
    type: detectType(t),
    ageLevel,
    title: t.split(/\r?\n/)[0].slice(0, 60),
    theme: detectTheme(t),
    player: {
      name: detectPlayer(t),
      lives: number(t, /(\d+)\s*ชีวิต/, p.lives)
    },
    rules
  });
}
