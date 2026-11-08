import { createGameFromThai } from "./thai-game-planner.js?v=3.4.0";
import { validateGame } from "./game-schema.js?v=3.4.0";
import { mountAdventure } from "./adventure-engine.js?v=3.4.0";
import { mountMaze } from "./maze-engine.js?v=3.4.0";
import { mountQuiz } from "./quiz-engine.js?v=3.4.0";
import { mountDodge } from "./dodge-engine.js?v=3.4.0";
import { CREATION_LEVELS, GENRES, exampleFor } from "./creation-presets.js";
import { sound } from "./sound.js?v=3.4.0";

const prompt = document.querySelector("#prompt");
const age = document.querySelector("#ageLevel");
const out = document.querySelector("#output");
const status = document.querySelector("#status");
const canvas = document.querySelector("#gameCanvas");
const quizPanel = document.querySelector("#quizPanel");
const controls = document.querySelector("#gameControls");
let active = null, selectedType = "adventure", freeformMode = false;

const modeGuidedBtn = document.querySelector("#modeGuidedBtn");
const modeFreeformBtn = document.querySelector("#modeFreeformBtn");
const freeformPanel = document.querySelector("#freeformPanel");
const freeformGradeTitle = document.querySelector("#freeformGradeTitle");
const freeformGradeMission = document.querySelector("#freeformGradeMission");
const freeformSyntaxContent = document.querySelector("#freeformSyntaxContent");
const freeformJsonDetails = document.querySelector("#freeformJsonDetails");
const clearPromptBtn = document.querySelector("#clearPromptBtn");
const freeformJsonInput = document.querySelector("#freeformJsonInput");
const runFreeformJsonBtn = document.querySelector("#runFreeformJsonBtn");

const FREEFORM_GRADE_SPECS = {
  p1: {
    title: "🌱 โหมดเด็กเก่ง ป.1–ป.3: นักแต่งประโยคสร้างเกม (Storyteller Prompt)",
    mission: "🎯 <strong>ภารกิจท้าทาย ป.1–ป.3:</strong> ลองพิมพ์แต่งประโยคสร้างเกมด้วยตัวเองโดยไม่ต้องกดรูปภาพ! ให้มีครบทั้ง <strong>ตัวละคร + ฉาก + จำนวนคะแนน</strong>",
    label: "✏️ แต่งประโยคสร้างเกมของหนูเอง:",
    placeholder: "เช่น สร้างเกมแมวผจญภัยในทะเล เก็บดวงดาว 5 ดวง มี 5 ชีวิต",
    samplePrompt: "สร้างเกมแมวผจญภัยในทะเล เก็บดวงดาว 5 ดวง มี 5 ชีวิต",
    showJsonEditor: false,
    openJsonEditor: false,
    syntaxHtml: `
      <div>• <strong>เลือกแนวเกม:</strong> พิมพ์คำว่า <code>ผจญภัย</code>, <code>เขาวงกต</code>, <code>หลบอุกกาบาต</code> หรือ <code>ตอบคำถาม</code></div>
      <div>• <strong>เลือกฮีโร่:</strong> พิมพ์ชื่อ <code>กระต่าย</code>, <code>แมว</code>, <code>หมี</code> หรือ <code>หุ่นยนต์</code></div>
      <div>• <strong>เลือกฉาก:</strong> พิมพ์ว่า <code>ในป่า</code>, <code>ในอวกาศ</code>, <code>ในปราสาท</code> หรือ <code>ในทะเล</code></div>
      <div>• <strong>เลือกของสะสม:</strong> พิมพ์ว่า <code>เก็บแครอท 5 ชิ้น</code>, <code>เก็บดวงดาว 8 ดวง</code> หรือ <code>เก็บแอปเปิ้ล 6 ชิ้น</code></div>
      <div>• <strong>ปลดล็อกโหมดยากสำหรับน้องเก่ง:</strong> พิมพ์ต่อท้ายว่า <code>โหมดยาก</code>, <code>ท้าทาย</code> หรือ <code>ยากพิเศษ มีบอส 3 ด่าน</code>!</div>
    `
  },
  p4: {
    title: "⚡ โหมดเด็กเก่ง ป.4–ป.6: นักเขียนสคริปต์กติกา & แต่งโจทย์ควิซ (Rule & Quest Scripter)",
    mission: "🎯 <strong>ภารกิจท้าทาย ป.4–ป.6:</strong> เขียนคำสั่งกำหนด <strong>ไอเทมสะสม + พลังพิเศษ + จำนวนด่าน</strong> ด้วยตัวเอง หรือลอง <strong>แต่งโจทย์เกมตอบคำถามของคุณเอง</strong> อย่างน้อย 2 ข้อ!",
    label: "🛠️ เขียนสคริปต์กติกาเกมหรือแต่งโจทย์ควิซเอง:",
    placeholder: "เช่น สร้างเกมหมีผจญภัยในปราสาท เก็บเหรียญทอง 15 เหรียญ มี 3 ชีวิต 3 ด่าน กระโดดสูง วิ่งเร็ว",
    samplePrompt: "สร้างเกมหมีผจญภัยในปราสาท เก็บเหรียญทอง 15 เหรียญ มี 3 ชีวิต 3 ด่าน กระโดดสูง วิ่งเร็ว",
    showJsonEditor: false,
    openJsonEditor: false,
    syntaxHtml: `
      <div>• <strong>แนวเกม & ฉาก:</strong> <code>ผจญภัย / เขาวงกต / หลบอุกกาบาต / ตอบคำถาม</code> + <code>ในป่า / ในอวกาศ / ในปราสาท / ในทะเล</code></div>
      <div>• <strong>ของสะสม & พลังพิเศษ:</strong> <code>เก็บอัญมณี / เก็บเหรียญทอง / เก็บดวงดาว 15 ชิ้น</code> + <code>วิ่งเร็ว</code>, <code>กระโดดสูง</code></div>
      <div>• <strong>ระดับด่าน & ชีวิต:</strong> <code>มี 3 ชีวิต</code>, <code>3 ด่าน</code>, <code>ศัตรู 3 ตัว</code></div>
      <div style="margin-top:6px">• <strong>แต่งโจทย์เกมตอบคำถามเอง (ใส่ * หลังคำตอบที่ถูก):</strong><br>
      <code style="display:block;background:#0f172a;padding:6px 8px;border-radius:6px;margin-top:4px;color:#7dd3fc">สร้างเกมตอบคำถามของฉันเอง<br>ถาม: ดาวเคราะห์ใดใหญ่ที่สุด? | โลก | ดาวอังคาร | ดาวพฤหัสบดี* | ดาวพุธ | เฉลย: ดาวพฤหัสบดีใหญ่ที่สุดในระบบสุริยะ</code></div>
    `
  },
  m1: {
    title: "🧪 โหมดเด็กเก่ง ม.1–ม.3: นักโค้ดตรรกะและพารามิเตอร์ (Logic & Parameter Coder)",
    mission: "🎯 <strong>ภารกิจท้าทาย ม.1–ม.3:</strong> เขียนคำสั่งควบคุมตรรกะเงื่อนไขชนะ (<code>เอาชีวิตรอด</code> หรือ <code>สะสมแต้ม</code>), ความเร็วศัตรู, เวลาจำกัด และกำหนดค่าตัวแปร <code>speed=</code>, <code>jump=</code> ด้วยตัวเอง!",
    label: "🧪 เขียนคำสั่งตรรกะและพารามิเตอร์เกม:",
    placeholder: "เช่น สร้างเกมหุ่นยนต์ผจญภัยในอวกาศ เก็บอัญมณี 20 ชิ้น มี 3 ชีวิต 3 ด่าน ศัตรู 4 ตัว ศัตรูเร็ว เวลา 45 วินาที speed=4.5 jump=-12.5 เอาชีวิตรอด",
    samplePrompt: "สร้างเกมหุ่นยนต์ผจญภัยในอวกาศ เก็บอัญมณี 20 ชิ้น มี 3 ชีวิต 3 ด่าน ศัตรู 4 ตัว ศัตรูเร็ว เวลา 45 วินาที speed=4.5 jump=-12.5",
    showJsonEditor: true,
    openJsonEditor: false,
    syntaxHtml: `
      <div>• <strong>เงื่อนไขชนะ (Win Condition):</strong> พิมพ์ <code>เอาชีวิตรอด</code> (รอดจนหมดเวลา) หรือ <code>เก็บ ... คะแนน</code></div>
      <div>• <strong>ตัวแปรพารามิเตอร์:</strong> <code>speed=4.5</code> (ความเร็วผู้เล่น), <code>jump=-12.5</code> (แรงกระโดด), <code>ศัตรูเร็ว</code> / <code>ศัตรูช้า</code></div>
      <div>• <strong>ควบคุมความท้าทาย:</strong> <code>ศัตรู 5 ตัว</code>, <code>เวลา 45 วินาที</code>, <code>ความยาก 4</code>, <code>4 ด่าน</code></div>
      <div>• <strong>แต่งข้อสอบเชิงตรรกะเอง:</strong> พิมพ์บรรทัด <code>ถาม: โจทย์ | ช้อยส์1 | ช้อยส์2* | ช้อยส์3 | ช้อยส์4 | เฉลย: ... | คำใบ้: ...</code></div>
    `
  },
  m4: {
    title: "👑 โหมดเด็กเก่ง ม.4–ม.6: สถาปนิกฟิสิกส์และโค้ดเอนจิน JSON (Engine & JSON Architect)",
    mission: "🎯 <strong>ภารกิจท้าทาย ม.4–ม.6:</strong> เขียนสคริปต์จำลองฟิสิกส์ขั้นสูง (<code>g=0.28</code>, <code>jump=-13.2</code>, <code>speed=5.0</code>) หรือเขียนโค้ด <strong>Raw Game JSON Schema</strong> โดยตรงเพื่อออกแบบด่านระดับบอส!",
    label: "👑 สคริปต์สถาปัตยกรรมเกมและพารามิเตอร์ฟิสิกส์:",
    placeholder: "เช่น สร้างเกมหุ่นยนต์ผจญภัยในอวกาศ เก็บอัญมณี 25 ชิ้น มี 2 ชีวิต 4 ด่าน ศัตรู 5 ตัว ศัตรูเร็ว เวลา 45 วินาที ความยาก 5 g=0.28 jump=-13.0 speed=4.8",
    samplePrompt: "สร้างเกมหุ่นยนต์ผจญภัยในอวกาศ เก็บอัญมณี 25 ชิ้น มี 2 ชีวิต 4 ด่าน ศัตรู 5 ตัว ศัตรูเร็ว เวลา 45 วินาที ความยาก 5 g=0.28 jump=-13.0 speed=4.8",
    showJsonEditor: true,
    openJsonEditor: true,
    syntaxHtml: `
      <div>• <strong>พารามิเตอร์ฟิสิกส์ (Physics Engine):</strong> <code>g=0.28</code> (แรงโน้มถ่วงดวงจันทร์) ถึง <code>g=0.85</code> (แรงโน้มถ่วงสูง), <code>jump=-13.2</code>, <code>speed=5.0</code></div>
      <div>• <strong>ระบบเอนจิน ม.4–ม.6:</strong> ผจญภัยมี <strong>บอสประจำด่าน (👑)</strong> | เขาวงกตมี <strong>หมอก Fog of War & เรดาร์ (📡)</strong> | หลบอุกกาบาตมี <strong>มิสไซล์นำวิถี (🎯) & อุกกาบาตแตกตัว (💥)</strong></div>
      <div>• <strong>Direct JSON Architecture:</strong> แก้ไขฟิลด์ <code>rules.gravity</code>, <code>rules.enemySpeedMultiplier</code>, <code>rules.winCondition</code>, <code>rules.customQuestions</code> ในกล่องโค้ดด้านล่างแล้วกดคอมไพล์ได้ทันที</div>
    `
  }
};

const targetInput = document.querySelector("#targetInput");
const livesInput = document.querySelector("#livesInput");
const levelsInput = document.querySelector("#levelsInput");
const clamp = (value, min, max, fallback) =>
  Number.isFinite(Number(value)) && value !== "" ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;

const workspace = document.querySelector("#ageWorkspace");
const numericPanel = document.querySelector("#numericPanel");
const promptLabel = document.querySelector("#promptLabel");

// Multi-grade state choices
const choices = {
  theme: "forest",
  score: 5,
  p1Difficulty: 1,
  challengeTier: "normal",
  enemyCount: 2,
  timeLimit: 90,
  character: "กระต่าย",
  item: "carrot",
  powerUp: "none",
  enemySpeedMultiplier: 1.0,
  winCondition: "score",
  lossCondition: "lives",
  gravity: 0.52,
  jumpImpulse: -10.2,
  playerSpeed: 3.3,
  hypothesis: "",
  testRuns: 0,
  testWins: 0
};

const nextToDesign = document.querySelector("#nextToDesign");
const steps = document.querySelector("#learningSteps");
const chooseStep = document.querySelector("#chooseStep");
const designStep = document.querySelector("#designStep");
const gameArea = document.querySelector("#gameArea");
const editGame = document.querySelector("#editGame");
const backToChoose = document.querySelector("#backToChoose");
let beginnerStep = "choose";

function setBeginnerStep(step, { scroll = false } = {}) {
  beginnerStep = step;
  const beginner = age.value === "p1";
  steps.hidden = !beginner;
  nextToDesign.hidden = !beginner || step !== "choose";
  chooseStep.hidden = beginner && step !== "choose";
  designStep.hidden = beginner && step !== "design";
  document.querySelector("#designActions").hidden = beginner && step !== "design";
  document.querySelector("#learningGoal").hidden = beginner && step === "play";
  gameArea.hidden = beginner && step !== "play";
  status.hidden = beginner && step !== "play";
  if (beginner && step !== "play") status.textContent = "";
  backToChoose.hidden = !beginner;
  editGame.hidden = !beginner;

  for (const el of steps.querySelectorAll("[data-step]")) {
    if (beginner && el.dataset.step === step) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  }
  if (scroll) {
    (step === "choose" ? chooseStep : step === "design" ? designStep : gameArea).scrollIntoView({ behavior: "auto", block: "start" });
  }
}

nextToDesign.addEventListener("click", () => {
  sound.playClick();
  setBeginnerStep("design", { scroll: true });
});
editGame.addEventListener("click", () => {
  sound.playClick();
  setBeginnerStep("design", { scroll: true });
});
backToChoose.addEventListener("click", () => {
  sound.playClick();
  setBeginnerStep("choose", { scroll: true });
});

const completion = document.querySelector("#completionPanel");
const completionText = document.querySelector("#completionText");
const restartButton = document.querySelector("#restart");

function handleGameStatus(message) {
  const ended = /ชนะแล้ว|แพ้แล้ว|เกมจบ/.test(message);
  const beginner = age.value === "p1";
  completion.hidden = !(beginner && ended);
  controls.hidden = beginner && ended;
  restartButton.hidden = beginner && ended;

  if (ended) {
    choices.testRuns++;
    if (message.includes("ชนะ")) choices.testWins++;
    updateTestAnalyticsDisplay();
  }

  completionText.textContent = message.includes("ชนะ")
    ? "ยอดเยี่ยม! ทำภารกิจสำเร็จแล้ว 🎉"
    : "ลองอีกครั้งนะ! ฝึกฝนแล้วจะเก่งขึ้น 💪";
  status.textContent = beginner && ended ? "" : message;
}

const themes = [
  ["forest", "🌳 ป่า"],
  ["space", "🌌 อวกาศ"],
  ["castle", "🏰 ปราสาท"],
  ["ocean", "🌊 ทะเล"]
];
const themeThai = { forest: "ป่า", space: "อวกาศ", castle: "ปราสาท", ocean: "ทะเล" };

const preview = document.querySelector("#designPreview");
const previewCharacter = document.querySelector("#previewCharacter");
const previewTheme = document.querySelector("#previewTheme");
const previewScore = document.querySelector("#previewScore");

const characterEmoji = { "กระต่าย": "🐰", "แมว": "🐱", "หมี": "🐻", "หุ่นยนต์": "🤖" };
const themeEmoji = { forest: "🌳", space: "🌌", castle: "🏰", ocean: "🌊" };
const itemEmoji = { carrot: "🥕", star: "⭐", coin: "🪙", apple: "🍎", gem: "💎" };

function updatePreview() {
  preview.hidden = age.value !== "p1";
  previewCharacter.textContent = characterEmoji[choices.character] || "🐰";
  previewTheme.textContent = (themeEmoji[choices.theme] || "🌳") + " " + themeThai[choices.theme];
  previewScore.textContent = (itemEmoji[choices.item] || "⭐") + " เป้าหมาย " + choices.score + " คะแนน";
}

function addText(parent, tag, value, className = "") {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  parent.append(el);
  return el;
}

function addChoices(parent, title, key, options, onChange) {
  addText(parent, "p", title, "task");
  const group = document.createElement("div");
  group.className = "choices";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", title);

  for (const [value, label] of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(choices[key] === value));
    button.addEventListener("click", () => {
      sound.playClick();
      choices[key] = value;
      for (const b of group.children) b.setAttribute("aria-pressed", String(b === button));
      if (onChange) onChange(value);
      updatePrompt();
    });
    group.append(button);
  }
  parent.append(group);
  return group;
}

function addNumber(parent, label, key, min, max, onChange) {
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(choices[key]);
  input.dataset.rule = key;
  input.addEventListener("change", () => {
    choices[key] = clamp(input.value, min, max, choices[key]);
    input.value = choices[key];
    if (onChange) onChange(choices[key]);
    updatePrompt();
  });
  field.append(input);
  parent.append(field);
  return input;
}

// Analytics and computational thinking displays
let balanceIndexEl = null;
let pseudoCodeEl = null;
let testAnalyticsEl = null;

function calculateBalanceIndex() {
  const lives = clamp(livesInput.value, 1, 10, 3);
  const target = clamp(targetInput.value, 1, 100, 10);
  const enemies = choices.enemyCount || 2;
  const speed = choices.enemySpeedMultiplier || 1.0;
  const time = choices.timeLimit || 60;
  const index = ((enemies * speed) / Math.max(1, lives)) * ((target / Math.max(15, time)) * 10);
  return Number(index.toFixed(2));
}

function updateBalanceDisplay() {
  if (!balanceIndexEl) return;
  const idx = calculateBalanceIndex();
  let rating = "⚖️ สมดุลกำลังดี (Balanced)";
  let color = "#27ae60";
  if (idx < 1.8) {
    rating = "😊 ง่าย เหมาะกับผู้เริ่มต้น (Casual)";
    color = "#2980b9";
  } else if (idx > 5.0) {
    rating = "🔥 ยากมาก เสี่ยงไม่ผ่าน (Hardcore / Unbalanced)";
    color = "#c0392b";
  } else if (idx > 3.5) {
    rating = "⚡ ท้าทายสูง (Challenging)";
    color = "#d35400";
  }
  balanceIndexEl.innerHTML = `
    <strong>ดัชนีความสมดุลเกม: <span style="color:${color};font-size:18px">${idx}</span></strong>
    <div style="font-size:13px;color:#555;margin-top:3px">${rating}</div>
  `;
}

function updatePseudoCodeDisplay() {
  if (!pseudoCodeEl) return;
  const win = choices.winCondition === "survival" ? "timer <= 0" : "score >= target_score";
  const loss = choices.lossCondition === "time" ? "timer <= 0" : "player.lives <= 0";
  pseudoCodeEl.textContent =
`// ตรรกะของเกม (Game Logic Schema)
WHEN game.tick():
  IF player.collect(item): score += 1
  IF player.collide(enemy): player.lives -= 1
  IF ${win}: WIN_STAGE()
  IF ${loss}: GAME_OVER()`;
}

function updateTestAnalyticsDisplay() {
  if (!testAnalyticsEl) return;
  const rate = choices.testRuns > 0 ? Math.round((choices.testWins / choices.testRuns) * 100) : 0;
  testAnalyticsEl.textContent = `ทดสอบเล่นแล้ว: ${choices.testRuns} รอบ | ชนะ: ${choices.testWins} รอบ (Win Rate: ${rate}%)`;
}

function renderWorkspace() {
  const level = age.value;
  workspace.replaceChildren();

  const titles = {
    p1: "🧸 เลือกภาพแล้วสร้างเกม",
    p4: "🛠️ นักออกแบบเกมรุ่นเยาว์ (Creative Designer)",
    m1: "🧪 ห้องทดลองกฎของเกม (Logic & Experiment Lab)",
    m4: "📊 ห้องวิเคราะห์และปรับสมดุลเกม (Engine Architecture)"
  };
  addText(workspace, "h3", titles[level]);

  if (level === "p1") {
    // Grade P1: Tangible visual creator
    addText(workspace, "p", "ไม่ต้องพิมพ์! เลือกภาพ ฉาก และเป้าหมาย แล้วกดสร้างเกม");
    addChoices(workspace, "เลือกตัวละคร", "character", [
      ["กระต่าย", "🐰 กระต่าย"],
      ["แมว", "🐱 แมว"],
      ["หมี", "🐻 หมี"],
      ["หุ่นยนต์", "🤖 หุ่นยนต์"]
    ]);
    addChoices(workspace, "เลือกฉาก", "theme", themes);
    addChoices(workspace, "เก็บกี่คะแนนดี?", "score", [
      [3, "⭐ 3 คะแนน"],
      [5, "⭐⭐ 5 คะแนน"],
      [10, "🏆 10 คะแนน"]
    ]);
    addChoices(workspace, "ระดับความท้าทาย (สำหรับน้องเก่ง!)", "p1Difficulty", [
      [1, "🌱 ปกติ (เริ่มต้นสนุก)"],
      [3, "🔥 ท้าทาย (ซูเปอร์สตาร์!)"],
      [4, "👑 ยากพิเศษ (มีบอส!)"]
    ]);
  } else if (level === "p4") {
    // Grade P4: Creative Designer with Modifiers, Power-ups & Items
    addText(workspace, "p", "เลือกฉาก ของสะสม และพลังพิเศษ เพื่อสร้างเกมที่สนุกและท้าทาย");
    addChoices(workspace, "เลือกฉาก", "theme", themes);

    addChoices(workspace, "ของสะสมในเกม", "item", [
      ["carrot", "🥕 แครอท"],
      ["star", "⭐ ดวงดาว"],
      ["coin", "🪙 เหรียญทอง"],
      ["apple", "🍎 แอปเปิ้ล"],
      ["gem", "💎 อัญมณี"]
    ]);

    addChoices(workspace, "พลังพิเศษของฮีโร่", "powerUp", [
      ["none", "🚶 ความเร็วปกติ"],
      ["speed", "⚡ วิ่งเร็วขึ้น"],
      ["jump", "🦘 กระโดดสูงพิเศษ"]
    ]);

    addChoices(workspace, "โหมดความท้าทาย (สำหรับเด็กเก่ง ป.4–ป.6)", "challengeTier", [
      ["normal", "⚡ มาตรฐาน ป.4–ป.6"],
      ["hard", "🔥 ท้าทายพิเศษ (ศัตรูบิน/ผู้พิทักษ์)"],
      ["boss", "👑 ยากพิเศษ (ปราบบอสประจำด่าน!)"]
    ]);

    addText(workspace, "p", "ภารกิจ: สร้างเกมให้เพื่อนเล่นจนจบอย่างน้อย 1 รอบ และปรับด่านให้สมดุล", "task");
  } else if (level === "m1") {
    // Grade M1: Logic, Rules & Computational Thinking
    addText(workspace, "p", "ตั้งสมมติฐาน ออกแบบเงื่อนไขการชนะ/แพ้ และทดลองเปรียบเทียบผล");
    addChoices(workspace, "เลือกฉาก", "theme", themes);

    addChoices(workspace, "โหมดความท้าทาย (สำหรับเด็กเก่ง ม.1–ม.3)", "challengeTier", [
      ["normal", "🧪 มาตรฐาน ม.1–ม.3"],
      ["hard", "🔥 ท้าทายเข้มข้น (มีบอส/มิสไซล์)"],
      ["boss", "👑 ฮาร์ดคอร์ (บอสเร็ว + หมอกปริศนา!)"]
    ], () => updateBalanceDisplay());

    addChoices(workspace, "เงื่อนไขการชนะ (Win Condition)", "winCondition", [
      ["score", "🏆 สะสมคะแนนครบตามเป้าหมาย"],
      ["survival", "⏱️ เอาชีวิตรอดจนหมดเวลา"]
    ], () => updatePseudoCodeDisplay());

    addChoices(workspace, "ความเร็วศัตรู (Enemy Speed)", "enemySpeedMultiplier", [
      [0.8, "🐢 ช้า (0.8x)"],
      [1.0, "🚶 ปกติ (1.0x)"],
      [1.4, "🏃 เร็วขึ้น (1.4x)"]
    ], () => updateBalanceDisplay());

    addNumber(workspace, "จำนวนศัตรู (0–5 ตัว)", "enemyCount", 0, 5, () => updateBalanceDisplay());
    addNumber(workspace, "เวลาเป้าหมาย (15–300 วินาที)", "timeLimit", 15, 300, () => updateBalanceDisplay());

    // Pseudo-code visualizer
    const codeBox = document.createElement("pre");
    codeBox.style.background = "#1b2434";
    codeBox.style.color = "#74c0fc";
    codeBox.style.padding = "10px";
    codeBox.style.borderRadius = "8px";
    codeBox.style.fontSize = "13px";
    codeBox.style.margin = "10px 0";
    pseudoCodeEl = codeBox;
    updatePseudoCodeDisplay();
    workspace.append(pseudoCodeEl);

    const label = document.createElement("label");
    label.textContent = "สมมติฐานการออกแบบ:";
    const note = document.createElement("input");
    note.id = "designHypothesis";
    note.placeholder = "เช่น ถ้าเพิ่มความเร็วศัตรู โอกาสชนะจะลดลงเหลือ 30%";
    note.value = choices.hypothesis;
    note.addEventListener("input", (e) => { choices.hypothesis = e.target.value; });
    label.append(note);
    workspace.append(label);

    const analyticsBox = document.createElement("div");
    analyticsBox.style.background = "#eef4fd";
    analyticsBox.style.padding = "8px 12px";
    analyticsBox.style.borderRadius = "8px";
    analyticsBox.style.fontWeight = "bold";
    analyticsBox.style.color = "#18457c";
    analyticsBox.style.margin = "8px 0";
    testAnalyticsEl = analyticsBox;
    updateTestAnalyticsDisplay();
    workspace.append(testAnalyticsEl);

    addText(workspace, "p", "ภารกิจ: ทดลอง 2 ชุดกติกา แล้วเปรียบเทียบผล", "task");
  } else {
    // Grade M4: Engine Architecture & Game Balancing
    addText(workspace, "p", "วิเคราะห์ระบบ: ปรับแต่งฟิสิกส์ (Physics Engine) และควบคุมสมดุลเกม (Balancing)");
    addChoices(workspace, "สภาพแวดล้อม", "theme", themes);

    addChoices(workspace, "แรงโน้มถ่วง (Gravity Constant g)", "gravity", [
      [0.28, "🌑 แรงโน้มถ่วงต่ำ (Moon g=0.28)"],
      [0.52, "🌍 มาตรฐาน (Earth g=0.52)"],
      [0.85, "🪐 แรงโน้มถ่วงสูง (Heavy g=0.85)"]
    ]);

    addChoices(workspace, "แรงกระโดดฮีโร่ (Jump Impulse)", "jumpImpulse", [
      [-8.5, "เตี้ย (-8.5)"],
      [-10.2, "มาตรฐาน (-10.2)"],
      [-12.8, "สูงพิเศษ (-12.8)"]
    ]);

    addChoices(workspace, "ระดับความโหดของเอนจิน (ม.4–ม.6 Challenge Tier)", "challengeTier", [
      ["normal", "📐 มาตรฐาน ม.4–ม.6"],
      ["hard", "🔥 ฮาร์ดคอร์ (Hardcore)"],
      ["boss", "💀 ระดับฝันร้าย (บอสคู่ & นรกอุกกาบาต!)"]
    ], () => updateBalanceDisplay());

    addNumber(workspace, "จำนวนศัตรู (0–10 ตัว)", "enemyCount", 0, 10, () => updateBalanceDisplay());
    addNumber(workspace, "เวลาเป้าหมาย (15–300 วินาที)", "timeLimit", 15, 300, () => updateBalanceDisplay());

    // Live Game Balance Index Gauge
    const balanceCard = document.createElement("div");
    balanceCard.style.background = "#ffffff";
    balanceCard.style.border = "2px solid #b8d4f6";
    balanceCard.style.padding = "10px 14px";
    balanceCard.style.borderRadius = "10px";
    balanceCard.style.margin = "10px 0";
    balanceIndexEl = balanceCard;
    updateBalanceDisplay();
    workspace.append(balanceIndexEl);

    const label = document.createElement("label");
    label.textContent = "สมมติฐานการวิเคราะห์:";
    const note = document.createElement("input");
    note.id = "designHypothesis";
    note.placeholder = "เช่น การปรับ g=0.28 ช่วยชดเชยศัตรูที่หนาแน่นขึ้น";
    note.value = choices.hypothesis;
    note.addEventListener("input", (e) => { choices.hypothesis = e.target.value; });
    label.append(note);
    workspace.append(label);

    const analyticsBox = document.createElement("div");
    analyticsBox.style.background = "#eef4fd";
    analyticsBox.style.padding = "8px 12px";
    analyticsBox.style.borderRadius = "8px";
    analyticsBox.style.fontWeight = "bold";
    analyticsBox.style.color = "#18457c";
    analyticsBox.style.margin = "8px 0";
    testAnalyticsEl = analyticsBox;
    updateTestAnalyticsDisplay();
    workspace.append(testAnalyticsEl);

    addText(workspace, "p", "ภารกิจ: เปรียบเทียบคะแนนและอัตราความสมดุลก่อน–หลังปรับกฎ", "task");
  }

  numericPanel.hidden = level === "p1";
  promptLabel.textContent = level === "p1"
    ? "คำสั่งที่ระบบสร้างให้ (ไม่ต้องพิมพ์)"
    : level === "p4"
    ? "อธิบายเกม (แก้ไขได้)"
    : "คำสั่งออกแบบเกม (แก้ไขและทดลองได้)";
  prompt.readOnly = level === "p1";
}

function updatePrompt() {
  const level = age.value;
  const base = exampleFor(selectedType, level);

  if (level === "p1") {
    const kind = selectedType === "adventure"
      ? "สร้างเกม" + choices.character + "ผจญภัย"
      : base.replace(/ เก็บ \d+ คะแนน.*$/, "");
    prompt.value = kind + " ฉาก" + themeThai[choices.theme] +
      (selectedType === "adventure" || selectedType === "dodge" ? " เก็บ " + choices.score + " คะแนน" : "");
  } else {
    let suffix = " ฉาก" + themeThai[choices.theme];
    if (level === "p4" && choices.powerUp !== "none") {
      suffix += choices.powerUp === "speed" ? " มีพลังวิ่งเร็ว" : " มีพลังกระโดดสูง";
    }
    if (level === "m1" || level === "m4") {
      suffix += " ศัตรู " + choices.enemyCount + " ตัว มีเวลา " + choices.timeLimit + " วินาที";
    }
    prompt.value = base + suffix;
  }

  updatePreview();
  updateBalanceDisplay();
  for (const b of document.querySelectorAll(".genre-card")) {
    b.setAttribute("aria-pressed", String(b.dataset.genre === selectedType));
  }
}

function refreshAge() {
  const p = CREATION_LEVELS[age.value] || CREATION_LEVELS.p4;
  document.body.dataset.age = age.value;
  document.querySelector("#learningGoal").textContent = "เป้าหมายการเรียนรู้: " + p.goal;
  document.querySelector("#ageHelp").textContent = p.help;

  targetInput.value = p.score;
  livesInput.value = age.value === "p1" ? 5 : age.value === "m4" ? 2 : 3;
  levelsInput.value = p.levels;

  const beginner = age.value === "p1";
  choices.score = p.score;
  choices.p1Difficulty = 1;
  choices.challengeTier = "normal";
  choices.enemyCount = age.value === "m4" ? 3 : 2;
  choices.timeLimit = age.value === "m4" ? 45 : age.value === "m1" ? 60 : 90;
  choices.theme = "forest";
  choices.character = "กระต่าย";
  choices.item = "carrot";
  choices.powerUp = "none";
  choices.enemySpeedMultiplier = 1.0;
  choices.winCondition = "score";
  choices.lossCondition = "lives";
  choices.gravity = 0.52;
  choices.jumpImpulse = -10.2;
  choices.playerSpeed = 3.3;

  renderWorkspace();
  setBeginnerStep("choose");

  gameArea.dataset.ready = "false";
  completion.hidden = true;
  status.textContent = "";
  targetInput.disabled = beginner;
  livesInput.disabled = beginner;
  levelsInput.disabled = beginner;

  updatePrompt();
}

for (const [i, b] of [...document.querySelectorAll(".genre-card")].entries()) {
  b.dataset.genre = GENRES[i].type;
  b.addEventListener("click", () => {
    sound.playClick();
    selectedType = b.dataset.genre;
    updatePrompt();
    if (age.value === "p1") setBeginnerStep("design", { scroll: true });
  });
}

age.addEventListener("change", () => {
  sound.playClick();
  refreshAge();
  if (freeformMode) renderFreeformGradeStudio({ updateSample: true });
});

// Sync numeric input adjustments with balancing display
[targetInput, livesInput, levelsInput].forEach(inp => {
  inp.addEventListener("input", () => {
    updateBalanceDisplay();
  });
});

refreshAge();

function renderFreeformGradeStudio({ updateSample = false } = {}) {
  const spec = FREEFORM_GRADE_SPECS[age.value] || FREEFORM_GRADE_SPECS.p4;
  if (freeformGradeTitle) freeformGradeTitle.textContent = spec.title;
  if (freeformGradeMission) freeformGradeMission.innerHTML = spec.mission;
  if (freeformSyntaxContent) freeformSyntaxContent.innerHTML = spec.syntaxHtml;
  if (freeformJsonDetails) {
    freeformJsonDetails.hidden = !spec.showJsonEditor;
    freeformJsonDetails.open = Boolean(spec.openJsonEditor);
  }
  prompt.readOnly = false;
  promptLabel.textContent = spec.label;
  prompt.placeholder = spec.placeholder;
  if (updateSample && spec.samplePrompt) {
    prompt.value = spec.samplePrompt;
  }
  document.querySelector("#designActions").hidden = false;
  try {
    const previewGame = createGameFromThai(prompt.value || spec.samplePrompt, age.value);
    if (freeformJsonInput) freeformJsonInput.value = JSON.stringify(previewGame, null, 2);
  } catch {}
}

function setFreeformMode(enabled) {
  freeformMode = Boolean(enabled);
  document.body.dataset.freeform = String(freeformMode);
  if (freeformPanel) freeformPanel.hidden = !freeformMode;

  if (modeGuidedBtn && modeFreeformBtn) {
    modeGuidedBtn.setAttribute("aria-pressed", String(!freeformMode));
    modeFreeformBtn.setAttribute("aria-pressed", String(freeformMode));
    modeGuidedBtn.style.background = !freeformMode ? "#3458db" : "#f0f4ff";
    modeGuidedBtn.style.color = !freeformMode ? "#ffffff" : "#1e293b";
    modeGuidedBtn.style.borderColor = !freeformMode ? "#2546b8" : "#cbd5e1";

    modeFreeformBtn.style.background = freeformMode ? "#0f172a" : "#f0f4ff";
    modeFreeformBtn.style.color = freeformMode ? "#38bdf8" : "#1e293b";
    modeFreeformBtn.style.borderColor = freeformMode ? "#38bdf8" : "#cbd5e1";
  }

  if (freeformMode) {
    renderFreeformGradeStudio({ updateSample: true });
  } else {
    refreshAge();
  }
}

if (modeGuidedBtn) {
  modeGuidedBtn.addEventListener("click", () => {
    sound.playClick();
    setFreeformMode(false);
  });
}
if (modeFreeformBtn) {
  modeFreeformBtn.addEventListener("click", () => {
    sound.playClick();
    setFreeformMode(true);
  });
}
if (clearPromptBtn) {
  clearPromptBtn.addEventListener("click", () => {
    sound.playClick();
    prompt.value = "";
    prompt.focus();
    status.textContent = "🧹 ล้างหน้ากระดาษแล้ว — พิมพ์ออกแบบเกมของคุณจากศูนย์ได้เลย!";
  });
}
if (runFreeformJsonBtn && freeformJsonInput) {
  runFreeformJsonBtn.addEventListener("click", () => {
    try {
      sound.playClick();
      const parsed = JSON.parse(freeformJsonInput.value);
      const valid = validateGame(parsed);
      mountGameInstance(valid);
      status.textContent = "⚡ คอมไพล์และรันโค้ด Game JSON สำเร็จ!";
      gameArea.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      status.textContent = "❌ โค้ด JSON ไม่ถูกต้อง: " + err.message;
    }
  });
}

document.querySelector("#generate").addEventListener("click", () => {
  try {
    sound.playClick();
    const game = createGameFromThai(prompt.value, age.value);

    if (!freeformMode) {
      if (game.type === selectedType && age.value !== "p1") {
        const p = CREATION_LEVELS[age.value] || CREATION_LEVELS.p4;
        game.rules.targetScore = clamp(targetInput.value, 1, 100, p.score);
        game.player.lives = clamp(livesInput.value, 1, 10, 3);
        game.rules.levels = clamp(levelsInput.value, 1, 10, p.levels);
        if (age.value === "m1" || age.value === "m4") {
          game.rules.enemyCount = choices.enemyCount;
          game.rules.timeLimit = choices.timeLimit;
          game.rules.enemySpeedMultiplier = choices.enemySpeedMultiplier;
          game.rules.winCondition = choices.winCondition;
          game.rules.hypothesis = choices.hypothesis;
        }
        if (age.value === "m4") {
          game.rules.gravity = choices.gravity;
          game.rules.jumpPower = choices.jumpImpulse;
          game.rules.playerSpeed = choices.playerSpeed;
        }
        if (age.value === "p4") {
          game.rules.itemType = choices.item;
          game.rules.powerUp = choices.powerUp;
          if (choices.powerUp === "speed") game.rules.playerSpeed = 4.4;
          if (choices.powerUp === "jump") game.rules.jumpPower = -12.4;
          if (choices.challengeTier === "hard") {
            game.rules.difficulty = 4;
            game.rules.enemyCount = Math.max(3, game.rules.enemyCount);
          } else if (choices.challengeTier === "boss") {
            game.rules.difficulty = 5;
            game.rules.enemyCount = Math.max(4, game.rules.enemyCount);
          }
        }
        if (age.value === "m1") {
          if (choices.challengeTier === "hard") {
            game.rules.difficulty = 4;
            game.rules.enemyCount = Math.max(4, game.rules.enemyCount);
          } else if (choices.challengeTier === "boss") {
            game.rules.difficulty = 5;
            game.rules.enemyCount = Math.max(5, game.rules.enemyCount);
            game.rules.enemySpeedMultiplier = Math.max(1.25, game.rules.enemySpeedMultiplier || 1.0);
          }
        }
        if (age.value === "m4") {
          if (choices.challengeTier === "hard") {
            game.rules.difficulty = 5;
            game.rules.enemyCount = Math.max(5, game.rules.enemyCount);
          } else if (choices.challengeTier === "boss") {
            game.rules.difficulty = 5;
            game.rules.enemyCount = Math.max(6, game.rules.enemyCount);
            game.rules.enemySpeedMultiplier = Math.max(1.35, game.rules.enemySpeedMultiplier || 1.0);
          }
        }
      }

      if (age.value === "p1" && game.type === selectedType) {
        game.rules.targetScore = choices.score;
        if (selectedType === "adventure") game.player.name = choices.character;
        game.rules.itemType = choices.item;
        if (choices.p1Difficulty >= 3) {
          game.rules.difficulty = choices.p1Difficulty;
          game.rules.levels = choices.p1Difficulty >= 4 ? 3 : 2;
          game.rules.enemyCount = choices.p1Difficulty >= 4 ? 4 : 3;
        }
      }

      game.theme = choices.theme;
    }

    if (freeformJsonInput) {
      freeformJsonInput.value = JSON.stringify(game, null, 2);
    }
    mountGameInstance(game);
  } catch (e) {
    out.textContent = "";
    status.textContent = e.message;
    active?.destroy();
    active = null;
    canvas.hidden = true;
    quizPanel.hidden = true;
    controls.hidden = true;
  }
});

function mountGameInstance(game) {
  out.textContent = JSON.stringify(game, null, 2);

  active?.destroy();
  active = null;
  canvas.dataset.completionUi = age.value === "p1" ? "external" : "canvas";
  completion.hidden = true;
  quizPanel.hidden = true;
  quizPanel.replaceChildren();
  controls.hidden = true;
  document.querySelector("#restart").hidden = false;

  if (game.type === "adventure" || game.type === "maze" || game.type === "dodge") {
    active = game.type === "maze"
      ? mountMaze(canvas, game, handleGameStatus)
      : game.type === "dodge"
      ? mountDodge(canvas, game, handleGameStatus)
      : mountAdventure(canvas, game, handleGameStatus);

    canvas.hidden = false;
    controls.hidden = false;
    for (const b of controls.querySelectorAll("[data-control]")) {
      b.hidden = game.type === "maze"
        ? b.dataset.control === "jump"
        : !["left", "right", ...(game.type === "adventure" ? ["jump"] : [])].includes(b.dataset.control);
    }
    status.textContent = "🎮 เกมพร้อมเล่น — ใช้ลูกศรหรือปุ่มบนจอ";
  } else if (game.type === "quiz") {
    canvas.hidden = true;
    active = mountQuiz(quizPanel, game, prompt.value, handleGameStatus);
    status.textContent = "🧠 เลือกคำตอบเพื่อเริ่มเล่น";
  } else {
    canvas.hidden = true;
    status.textContent = "สร้าง JSON สำเร็จ — Game Engine ประเภทนี้อยู่ระหว่างพัฒนา";
  }

  gameArea.dataset.ready = "true";
  if (age.value === "p1") setBeginnerStep("play", { scroll: true });
}

function restartCurrentGame() {
  sound.playClick();
  completion.hidden = true;
  restartButton.hidden = false;
  if (canvas.hidden === false) controls.hidden = false;
  active?.restart();
}

// Sound Toggle listener
const soundToggle = document.querySelector("#soundToggle");
if (soundToggle) {
  soundToggle.addEventListener("click", () => {
    sound.enabled = !sound.enabled;
    soundToggle.textContent = sound.enabled ? "🔊 เสียง: เปิด" : "🔇 เสียง: ปิด";
    soundToggle.style.background = sound.enabled ? "#eef3fc" : "#f1f3f5";
    soundToggle.style.color = sound.enabled ? "#24476b" : "#718096";
    if (sound.enabled) sound.playClick();
  });
}

restartButton.addEventListener("click", restartCurrentGame);
document.querySelector("#playAgain").addEventListener("click", restartCurrentGame);
document.querySelector("#createAnother").addEventListener("click", () => {
  sound.playClick();
  active?.destroy();
  active = null;
  completion.hidden = true;
  status.textContent = "";
  gameArea.dataset.ready = "false";
  setBeginnerStep("choose", { scroll: true });
});

for (const button of document.querySelectorAll("[data-control]")) {
  const control = button.dataset.control;
  const release = () => active?.setTouch(control, false);
  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    active?.setTouch(control, true);
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

// --- Share, Export & Import System ---
const copyShareBtn = document.querySelector("#copyShareLink");
const exportBtn = document.querySelector("#exportGameJson");
const importInp = document.querySelector("#importGameJson");
const shareStatus = document.querySelector("#shareStatus");

const shareLinkContainer = document.querySelector("#shareLinkContainer");
const shareUrlInput = document.querySelector("#shareUrlInput");
const openShareUrl = document.querySelector("#openShareUrl");

function getExportData() {
  try {
    const parsed = JSON.parse(out.textContent || "{}");
    if (parsed && parsed.type) return parsed;
  } catch {}

  // Fallback: build on the fly from current workspace
  try {
    const game = createGameFromThai(prompt.value, age.value);
    if (age.value !== "p1") {
      const p = CREATION_LEVELS[age.value] || CREATION_LEVELS.p4;
      game.rules.targetScore = clamp(targetInput.value, 1, 100, p.score);
      game.player.lives = clamp(livesInput.value, 1, 10, 3);
      game.rules.levels = clamp(levelsInput.value, 1, 10, p.levels);
      if (age.value === "m1" || age.value === "m4") {
        game.rules.enemyCount = choices.enemyCount;
        game.rules.timeLimit = choices.timeLimit;
      }
      if (age.value === "p4") {
        game.rules.itemType = choices.item;
        game.rules.powerUp = choices.powerUp;
      }
      if (age.value === "m4") {
        game.rules.gravity = choices.gravity;
        game.rules.jumpPower = choices.jumpImpulse;
      }
    } else {
      game.rules.targetScore = choices.score;
      if (selectedType === "adventure") game.player.name = choices.character;
      game.rules.itemType = choices.item;
    }
    game.theme = choices.theme;
    return game;
  } catch {
    return null;
  }
}

if (copyShareBtn) {
  copyShareBtn.addEventListener("click", () => {
    sound.playClick();
    const data = getExportData();
    if (!data || !data.type) {
      if (shareStatus) shareStatus.textContent = "กรุณาระบุข้อมูลเกมให้ถูกต้องก่อนแชร์ครับ";
      return;
    }
    const jsonStr = JSON.stringify(data);
    const encoded = encodeURIComponent(jsonStr);
    const shareUrl = `${window.location.origin}${window.location.pathname}#game=${encoded}`;

    if (shareUrlInput) shareUrlInput.value = shareUrl;
    if (openShareUrl) openShareUrl.href = shareUrl;
    if (shareLinkContainer) shareLinkContainer.hidden = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        if (shareStatus) shareStatus.textContent = "✅ คัดลอกลิงก์แชร์สำเร็จแล้ว! ส่งให้เพื่อนเปิดเล่นได้ทันที 🚀";
      }).catch(() => fallbackCopy(shareUrl));
    } else {
      fallbackCopy(shareUrl);
    }
  });
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  if (shareStatus) shareStatus.textContent = "✅ คัดลอกลิงก์แชร์สำเร็จแล้ว! ส่งให้เพื่อนเปิดเล่นได้ทันที 🚀";
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    sound.playClick();
    const data = getExportData();
    if (!data || !data.type) {
      if (shareStatus) shareStatus.textContent = "กรุณากด 'สร้างและเล่นเกม' ก่อนดาวน์โหลดครับ";
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-${data.type}-${data.ageLevel || "custom"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (shareStatus) shareStatus.textContent = "💾 ดาวน์โหลดไฟล์เกมเรียบร้อยแล้ว!";
  });
}

if (importInp) {
  importInp.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const game = JSON.parse(evt.target?.result);
        launchValidatedGame(game);
        saveGameToLibrary(game, "เกมของเพื่อน 👥");
        if (shareStatus) shareStatus.textContent = `📂 นำเข้าและบันทึกเกม "${game.title || game.type}" ลงเครื่องเรียบร้อยแล้ว!`;
        document.querySelector("#gameArea")?.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        if (shareStatus) shareStatus.textContent = "❌ ไฟล์เกมไม่ถูกต้อง";
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
}

// --- Local Games Library (บันทึกเกมบนเครื่อง) ---
const SAVED_GAMES_KEY = "kids_game_library_v1";
const saveCurrentGameBtn = document.querySelector("#saveCurrentGameBtn");
const savedGamesList = document.querySelector("#savedGamesList");

function getSavedGames() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_GAMES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveGameToLibrary(game, source = "ฉันสร้างเอง") {
  if (!game || !game.type) return;
  const list = getSavedGames();
  const id = Date.now().toString();
  const item = {
    id,
    title: game.title || `เกม${game.type}`,
    type: game.type,
    ageLevel: game.ageLevel || age.value,
    theme: game.theme || "forest",
    character: game.player?.name || "กระต่าย",
    targetScore: game.rules?.targetScore || 10,
    lives: game.player?.lives || 3,
    levels: game.rules?.levels || 1,
    source,
    savedAt: new Date().toLocaleDateString("th-TH"),
    fullData: game
  };

  const existingIdx = list.findIndex(g => g.title === item.title && g.type === item.type);
  if (existingIdx >= 0) {
    list[existingIdx] = item;
  } else {
    list.unshift(item);
  }

  const trimmed = list.slice(0, 20);
  try {
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(trimmed));
  } catch {}
  renderSavedGamesList();
}

function deleteSavedGame(id) {
  const list = getSavedGames().filter(g => g.id !== id);
  try {
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(list));
  } catch {}
  renderSavedGamesList();
}

function renderSavedGamesList() {
  if (!savedGamesList) return;
  const list = getSavedGames();
  savedGamesList.replaceChildren();

  if (list.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.style.gridColumn = "1 / -1";
    emptyP.style.color = "#8c9ba5";
    emptyP.style.fontSize = "13px";
    emptyP.style.margin = "8px 0";
    emptyP.textContent = "ยังไม่มีเกมที่บันทึกไว้ในเครื่อง — ลองกด '⭐ บันทึกเกมนี้ลงเครื่อง' หรือกด '📂 นำเข้าเกมเพื่อน' ได้เลย!";
    savedGamesList.append(emptyP);
    return;
  }

  const genreIcons = { adventure: "🐰", maze: "🧩", dodge: "🚀", quiz: "🧠" };

  for (const item of list) {
    const card = document.createElement("div");
    card.style.background = "#ffffff";
    card.style.border = "1.5px solid #d0e1fd";
    card.style.borderRadius = "10px";
    card.style.padding = "10px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.justifyContent = "space-between";
    card.style.boxShadow = "0 2px 6px rgba(52,88,219,0.06)";

    const top = document.createElement("div");
    const titleH = document.createElement("strong");
    titleH.style.display = "block";
    titleH.style.fontSize = "14px";
    titleH.style.color = "#183f69";
    titleH.style.marginBottom = "4px";
    titleH.textContent = `${genreIcons[item.type] || "🎮"} ${item.title}`;
    top.append(titleH);

    const meta = document.createElement("div");
    meta.style.fontSize = "12px";
    meta.style.color = "#555";
    meta.style.lineHeight = "1.4";
    meta.innerHTML = `
      <span>ระดับ ${item.ageLevel?.toUpperCase() || "P4"} | 🎯 ${item.targetScore} แต้ม</span><br>
      <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;background:${item.source.includes("เพื่อน") ? "#e8f4fd;color:#1b6ec2" : "#e6f4ea;color:#137333"};margin-top:4px">
        ${item.source} (${item.savedAt})
      </span>
    `;
    top.append(meta);
    card.append(top);

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.alignItems = "center";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "12px";
    btnRow.style.width = "100%";
    btnRow.style.boxSizing = "border-box";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.innerHTML = "<span>▶️</span> <span>เล่นเกม</span>";
    playBtn.style.flex = "1 1 auto";
    playBtn.style.width = "auto";
    playBtn.style.minWidth = "0";
    playBtn.style.padding = "8px 12px";
    playBtn.style.fontSize = "13px";
    playBtn.style.fontWeight = "bold";
    playBtn.style.background = "#2563eb";
    playBtn.style.color = "#ffffff";
    playBtn.style.margin = "0";
    playBtn.style.minHeight = "38px";
    playBtn.style.height = "38px";
    playBtn.style.borderRadius = "8px";
    playBtn.style.border = "0";
    playBtn.style.cursor = "pointer";
    playBtn.style.display = "inline-flex";
    playBtn.style.alignItems = "center";
    playBtn.style.justifyContent = "center";
    playBtn.style.gap = "6px";
    playBtn.style.whiteSpace = "nowrap";
    playBtn.addEventListener("click", () => {
      sound.playClick();
      launchValidatedGame(item.fullData);
      if (shareStatus) shareStatus.textContent = `▶️ กำลังเล่นเกม "${item.title}" จากคลังในเครื่อง`;
      document.querySelector("#gameArea")?.scrollIntoView({ behavior: "smooth" });
    });
    btnRow.append(playBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.title = "ลบเกมนี้ออกจากคลัง";
    delBtn.style.flex = "0 0 42px";
    delBtn.style.width = "42px";
    delBtn.style.minWidth = "42px";
    delBtn.style.maxWidth = "42px";
    delBtn.style.minHeight = "38px";
    delBtn.style.height = "38px";
    delBtn.style.padding = "0";
    delBtn.style.fontSize = "15px";
    delBtn.style.background = "#fee2e2";
    delBtn.style.color = "#dc2626";
    delBtn.style.margin = "0";
    delBtn.style.borderRadius = "8px";
    delBtn.style.border = "1px solid #fca5a5";
    delBtn.style.cursor = "pointer";
    delBtn.style.display = "inline-flex";
    delBtn.style.alignItems = "center";
    delBtn.style.justifyContent = "center";
    delBtn.addEventListener("click", () => {
      sound.playClick();
      deleteSavedGame(item.id);
    });
    btnRow.append(delBtn);

    card.append(btnRow);
    savedGamesList.append(card);
  }
}

if (saveCurrentGameBtn) {
  saveCurrentGameBtn.addEventListener("click", () => {
    sound.playClick();
    const data = getExportData();
    if (!data || !data.type) {
      if (shareStatus) shareStatus.textContent = "กรุณากด 'สร้างและเล่นเกม' ก่อนบันทึกครับ";
      return;
    }
    saveGameToLibrary(data, "ฉันสร้างเอง 🎨");
    if (shareStatus) shareStatus.textContent = `⭐ บันทึกเกม "${data.title || data.type}" ลงในคลังเกมของเครื่องเรียบร้อยแล้ว!`;
  });
}

// Initial render of saved games library
renderSavedGamesList();

function launchValidatedGame(game) {
  if (!game || !game.type) return;
  if (game.ageLevel && age.value !== game.ageLevel) {
    age.value = game.ageLevel;
    refreshAge();
  }
  selectedType = game.type;
  if (game.theme) choices.theme = game.theme;
  if (game.player?.name) choices.character = game.player.name;
  if (game.rules?.targetScore) {
    choices.score = game.rules.targetScore;
    targetInput.value = game.rules.targetScore;
  }
  if (game.player?.lives) livesInput.value = game.player.lives;
  if (game.rules?.levels) levelsInput.value = game.rules.levels;
  if (game.rules?.enemyCount) choices.enemyCount = game.rules.enemyCount;
  if (game.rules?.timeLimit) choices.timeLimit = game.rules.timeLimit;
  if (game.rules?.itemType) choices.item = game.rules.itemType;
  if (game.rules?.powerUp) choices.powerUp = game.rules.powerUp;
  if (game.rules?.gravity) choices.gravity = game.rules.gravity;

  updatePrompt();
  mountGameInstance(game);
}

function loadGameData(game) {
  launchValidatedGame(game);
}

// Check URL Hash on load
if (typeof window !== "undefined") {
  const hash = window.location.hash;
  if (hash.startsWith("#game=")) {
    try {
      const raw = decodeURIComponent(hash.slice(6));
      const game = JSON.parse(raw);
      setTimeout(() => {
        launchValidatedGame(game);
        saveGameToLibrary(game, "ลิงก์จากเพื่อน 👥");
        if (shareStatus) shareStatus.textContent = "🎮 กำลังเล่นเกมที่เพื่อนแชร์มาให้ และบันทึกไว้ในคลังเครื่องแล้ว!";
      }, 100);
    } catch {}
  }
}
