// /english/js/lesson-data.js
// A2 question bank version
// 15 sessions x 15 items each
// difficulty bank per session: easy(5) / normal(5) / hard(5)

function toLegacyChoices(correct, distractors = []) {
  const letters = ["A", "B", "C"];
  const raw = [correct, ...distractors].slice(0, 3);
  return raw.map((text, index) => `${letters[index]}. ${String(text || "").trim()}`);
}

function normalizeMissionItem(item, sessionType = "") {
  if (!item || typeof item !== "object") return item;

  const type = item.type || sessionType;
  const isChoiceMission = type === "reading" || type === "listening";

  if (
    isChoiceMission &&
    item.correct &&
    Array.isArray(item.distractors) &&
    item.distractors.length >= 2
  ) {
    return {
      ...item,
      choices: toLegacyChoices(item.correct, item.distractors),
      answer: "A"
    };
  }

  return item;
}

function normalizeMissionGroup(group) {
  if (!group || typeof group !== "object") return group;

  const bank = group.bank || {};

  return {
    ...group,
    bank: {
      easy: Array.isArray(bank.easy)
        ? bank.easy.map(item => normalizeMissionItem(item, group.type))
        : [],
      normal: Array.isArray(bank.normal)
        ? bank.normal.map(item => normalizeMissionItem(item, group.type))
        : [],
      hard: Array.isArray(bank.hard)
        ? bank.hard.map(item => normalizeMissionItem(item, group.type))
        : []
    }
  };
}

function normalizeMissionBank(list = []) {
  return list.map(normalizeMissionGroup);
}

export const missionDB = normalizeMissionBank([
  {
    id: 1,
    type: "speaking",
    title: "S1: Introduction",
    bank: {
      easy: [
        { desc: 'พูดตาม: "My name is Anna"', exactPhrase: "my name is anna", failMsg: "พูดชื่อให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "I am a student"', exactPhrase: "i am a student", failMsg: "พูดประโยคสั้น ๆ ให้ชัด" },
        { desc: 'พูดตาม: "I am from Thailand"', exactPhrase: "i am from thailand", failMsg: "ลองพูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "I study computer science"', exactPhrase: "i study computer science", failMsg: "ลองพูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "I like coding"', exactPhrase: "i like coding", failMsg: "พูดให้ชัดอีกครั้ง" }
      ],
      normal: [
        { desc: 'พูดตาม: "My name is Anna and I am a student"', exactPhrase: "my name is anna and i am a student", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "I am from Thailand and I study English"', exactPhrase: "i am from thailand and i study english", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "I study computer science at university"', exactPhrase: "i study computer science at university", failMsg: "พยายามพูดให้ครบ" },
        { desc: 'พูดตาม: "I want to be a developer"', exactPhrase: "i want to be a developer", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "I enjoy learning new skills"', exactPhrase: "i enjoy learning new skills", failMsg: "พูดให้ครบประโยค" }
      ],
      hard: [
        { desc: 'พูดตาม: "Hello, my name is Anna and I study computer science"', exactPhrase: "hello my name is anna and i study computer science", failMsg: "พูดให้ชัดและครบ" },
        { desc: 'พูดตาม: "I am a university student and I enjoy coding"', exactPhrase: "i am a university student and i enjoy coding", failMsg: "พูดให้ชัดและครบ" },
        { desc: 'พูดตาม: "I come from Thailand and I want to work in tech"', exactPhrase: "i come from thailand and i want to work in tech", failMsg: "พูดให้ครบอีกครั้ง" },
        { desc: 'พูดตาม: "I am interested in web development and design"', exactPhrase: "i am interested in web development and design", failMsg: "ลองพูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "In the future, I want to build useful apps"', exactPhrase: "in the future i want to build useful apps", failMsg: "พูดให้ครบประโยค" }
      ]
    }
  },

  {
    id: 2,
    type: "reading",
    title: "S2: Greetings",
    bank: {
      easy: [
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Tom: Hello!", correct: "Hello!", distractors: ["Good night.", "Thank you."] },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Jane: How are you?", correct: "I am fine.", distractors: ["It is blue.", "I am a desk."] },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Teacher: Good morning.", correct: "Good morning.", distractors: ["See you yesterday.", "Open the door."] },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Friend: Nice to meet you.", correct: "Nice to meet you too.", distractors: ["I like rice.", "My bag is black."] },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Guest: Thank you.", correct: "You are welcome.", distractors: ["I am hungry.", "It is Monday."] }
      ],
      normal: [
        { desc: "ตอบบทสนทนา", question: "Manager: Welcome to our office.", correct: "Thank you. It is nice to be here.", distractors: ["My office is a cat.", "I go to sleep."] },
        { desc: "ตอบบทสนทนา", question: "Student: Sorry I am late.", correct: "That is okay. Please sit down.", distractors: ["I am a window.", "Late is green."] },
        { desc: "ตอบบทสนทนา", question: "Colleague: Can I ask your name?", correct: "Sure. My name is Mina.", distractors: ["My name is Tuesday.", "I can ask the wall."] },
        { desc: "ตอบบทสนทนา", question: "Host: Please come in.", correct: "Thank you very much.", distractors: ["Come in is yellow.", "I am a laptop."] },
        { desc: "ตอบบทสนทนา", question: "Guide: Do you need help?", correct: "Yes, please. I need some help.", distractors: ["Help is a shoe.", "I eat notebooks."] }
      ],
      hard: [
        { desc: "ตอบบทสนทนา", question: "Interviewer: Please introduce yourself briefly.", correct: "Sure. My name is Nida, and I am a computer science student.", distractors: ["Briefly is my dog.", "I am on the table."] },
        { desc: "ตอบบทสนทนา", question: "Visitor: Excuse me, is this seat free?", correct: "Yes, you can sit here.", distractors: ["The seat is orange juice.", "I sit in tomorrow."] },
        { desc: "ตอบบทสนทนา", question: "Staff: Thank you for waiting.", correct: "No problem. Thank you.", distractors: ["Waiting is purple.", "I wait with a sandwich."] },
        { desc: "ตอบบทสนทนา", question: "Coach: Are you ready to begin?", correct: "Yes, I am ready.", distractors: ["Begin is a pencil.", "I ready the window."] },
        { desc: "ตอบบทสนทนา", question: "Team lead: Nice work today.", correct: "Thank you. I learned a lot today.", distractors: ["Work is my banana.", "Today is inside the car."] }
      ]
    }
  },

  {
    id: 3,
    type: "writing",
    title: "S3: Tech Words",
    bank: {
      easy: [
        { desc: "พิมพ์คำเทคโนโลยี 1 คำ", prompt: "SYSTEM: Type one tech word.\nYOU:", keywords: ["code", "app", "web", "data", "bug"], minMatch: 1, starter: "Starter: code", failMsg: "ลองพิมพ์คำสั้น ๆ เช่น code หรือ app" },
        { desc: "พิมพ์ชื่ออุปกรณ์", prompt: "SYSTEM: Type one device for study.\nYOU:", keywords: ["laptop", "computer", "tablet", "phone"], minMatch: 1, starter: "Starter: laptop", failMsg: "ลองพิมพ์ laptop หรือ computer" },
        { desc: "พิมพ์ชื่อภาษา", prompt: "SYSTEM: Type one programming language.\nYOU:", keywords: ["python", "java", "javascript", "c++"], minMatch: 1, starter: "Starter: python", failMsg: "ลองพิมพ์ python หรือ java" },
        { desc: "พิมพ์คำเกี่ยวกับอินเทอร์เน็ต", prompt: "SYSTEM: Type one internet word.\nYOU:", keywords: ["browser", "website", "internet", "online"], minMatch: 1, starter: "Starter: browser", failMsg: "ลองพิมพ์ browser หรือ website" },
        { desc: "พิมพ์คำเกี่ยวกับงานทีม", prompt: "SYSTEM: Type one teamwork word.\nYOU:", keywords: ["team", "meeting", "task", "project"], minMatch: 1, starter: "Starter: team", failMsg: "ลองพิมพ์ team หรือ project" }
      ],
      normal: [
        { desc: "พิมพ์ 2 คำเกี่ยวกับ coding", prompt: "SYSTEM: Type two words about coding.\nYOU:", keywords: ["code", "bug", "test", "function", "script"], minMatch: 2, starter: "Starter: code test", failMsg: "ลองพิมพ์ 2 คำ เช่น code test" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ web", prompt: "SYSTEM: Type two words about web.\nYOU:", keywords: ["web", "page", "html", "css", "site"], minMatch: 2, starter: "Starter: html css", failMsg: "ลองพิมพ์ 2 คำ เช่น html css" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ data", prompt: "SYSTEM: Type two words about data.\nYOU:", keywords: ["data", "table", "chart", "database", "file"], minMatch: 2, starter: "Starter: data file", failMsg: "ลองพิมพ์ 2 คำ เช่น data file" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ project", prompt: "SYSTEM: Type two words about project work.\nYOU:", keywords: ["team", "project", "plan", "deadline", "meeting"], minMatch: 2, starter: "Starter: team meeting", failMsg: "ลองพิมพ์ 2 คำ เช่น team meeting" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ AI", prompt: "SYSTEM: Type two simple AI words.\nYOU:", keywords: ["ai", "model", "data", "prompt", "chatbot"], minMatch: 2, starter: "Starter: ai model", failMsg: "ลองพิมพ์ 2 คำ เช่น ai model" }
      ],
      hard: [
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ coding", prompt: "SYSTEM: Write a short sentence about coding.\nYOU:", keywords: ["i", "like", "coding", "code", "learn"], minMatch: 3, starter: "Starter: I like coding.", failMsg: "ลองพิมพ์ประโยคสั้น เช่น I like coding" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ web", prompt: "SYSTEM: Write a short sentence about web design.\nYOU:", keywords: ["web", "design", "page", "html", "css"], minMatch: 3, starter: "Starter: I design web pages.", failMsg: "ลองพิมพ์ เช่น I design web pages" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ data", prompt: "SYSTEM: Write a short sentence about data.\nYOU:", keywords: ["data", "is", "important", "useful", "analysis"], minMatch: 3, starter: "Starter: Data is useful.", failMsg: "ลองพิมพ์ เช่น data is useful" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ team", prompt: "SYSTEM: Write a short sentence about teamwork.\nYOU:", keywords: ["team", "work", "together", "help", "project"], minMatch: 3, starter: "Starter: Our team works together.", failMsg: "ลองพิมพ์ เช่น our team works together" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ AI", prompt: "SYSTEM: Write a short sentence about AI.\nYOU:", keywords: ["ai", "helps", "people", "learn", "work"], minMatch: 3, starter: "Starter: AI helps people learn.", failMsg: "ลองพิมพ์ เช่น ai helps people learn" }
      ]
    }
  },

  {
    id: 4,
    type: "speaking",
    title: "S4: Daily Work",
    bank: {
      easy: [
        { desc: 'พูดตาม: "I check my email"', exactPhrase: "i check my email", failMsg: "ลองพูดอีกครั้ง" },
        { desc: 'พูดตาม: "I join the meeting"', exactPhrase: "i join the meeting", failMsg: "ลองพูดอีกครั้ง" },
        { desc: 'พูดตาม: "I write the report"', exactPhrase: "i write the report", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "I finish my task"', exactPhrase: "i finish my task", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "I help my team"', exactPhrase: "i help my team", failMsg: "พูดให้ชัดอีกครั้ง" }
      ],
      normal: [
        { desc: 'พูดตาม: "I check my email every morning"', exactPhrase: "i check my email every morning", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "I join the team meeting at nine"', exactPhrase: "i join the team meeting at nine", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "I write a short report after class"', exactPhrase: "i write a short report after class", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "I finish my task before lunch"', exactPhrase: "i finish my task before lunch", failMsg: "พยายามพูดให้ครบ" },
        { desc: 'พูดตาม: "I help my team with testing"', exactPhrase: "i help my team with testing", failMsg: "พูดให้ชัดอีกครั้ง" }
      ],
      hard: [
        { desc: 'พูดตาม: "Every morning I check my email and plan my work"', exactPhrase: "every morning i check my email and plan my work", failMsg: "พูดให้ครบอีกครั้ง" },
        { desc: 'พูดตาม: "I join the team meeting and share my progress"', exactPhrase: "i join the team meeting and share my progress", failMsg: "พยายามพูดให้ครบ" },
        { desc: 'พูดตาม: "After class I write a report about my project"', exactPhrase: "after class i write a report about my project", failMsg: "พูดให้ชัดและครบ" },
        { desc: 'พูดตาม: "I try to finish my task before the deadline"', exactPhrase: "i try to finish my task before the deadline", failMsg: "ลองพูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "I often help my team when there is a bug"', exactPhrase: "i often help my team when there is a bug", failMsg: "พยายามพูดให้ครบ" }
      ]
    }
  },

  {
    id: 5,
    type: "listening",
    title: "S5: Final Interview",
    bank: {
      easy: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "What is your name?", correct: "My name is Ben.", distractors: ["I am a bag.", "Monday is big."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Where are you from?", correct: "I am from Thailand.", distractors: ["I am from lunch.", "I am from blue."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What do you study?", correct: "I study computer science.", distractors: ["I study a chair.", "I study the rain."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Do you like coding?", correct: "Yes, I do.", distractors: ["Yes, I banana.", "Coding is a desk."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Can you work in a team?", correct: "Yes, I can.", distractors: ["Team is a flower.", "I work in Tuesday."] }
      ],
      normal: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please tell me about yourself.", correct: "I am a student and I like coding.", distractors: ["I am inside a laptop.", "Myself is a window."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Why do you want this job?", correct: "I want to learn and grow.", distractors: ["The job is green.", "Because the chair is happy."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What is your strength?", correct: "I am good at teamwork.", distractors: ["My strength is orange.", "I am stronger than a table."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Do you have project experience?", correct: "Yes, I worked on a university project.", distractors: ["Experience is coffee.", "My project is sleeping."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Can you learn new skills quickly?", correct: "Yes, I can learn quickly.", distractors: ["Skills are blue.", "Quickly is a box."] }
      ],
      hard: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please describe a project you worked on at university.", correct: "I built a web project with my team.", distractors: ["My university is under the table.", "A project is my breakfast."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What do you want to do after graduation?", correct: "I want to work as a software developer.", distractors: ["Graduation is a sandwich.", "I want to become a pencil."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "How do you improve your English skills?", correct: "I practice speaking and listening every day.", distractors: ["English is on the wall.", "I improve by sleeping on books."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What kind of company do you want to join?", correct: "I want to join a company with a good team.", distractors: ["The company is in my pocket.", "I join a company of shoes."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Can you explain your role in your last project?", correct: "I worked on design and testing.", distractors: ["My role was a chicken.", "Project roles are windows."] }
      ]
    }
  },

  {
    id: 6,
    type: "reading",
    title: "S6: Agile Team",
    bank: {
      easy: [
        { desc: "ตอบบทสนทนา", question: "Lead: What did you do today?", correct: "I finished my task.", distractors: ["I am a book.", "Today is green."] },
        { desc: "ตอบบทสนทนา", question: "Lead: Do you need help?", correct: "Yes, please.", distractors: ["Help is a bag.", "I help the wall."] },
        { desc: "ตอบบทสนทนา", question: "Lead: Are you ready?", correct: "Yes, I am ready.", distractors: ["Ready is a fish.", "I am readying the desk."] },
        { desc: "ตอบบทสนทนา", question: "Lead: Can you test this page?", correct: "Yes, I can test it.", distractors: ["The page is rice.", "I test in tomorrow."] },
        { desc: "ตอบบทสนทนา", question: "Lead: Did you join the meeting?", correct: "Yes, I joined it.", distractors: ["Meeting is a wall.", "I join the yellow."] }
      ],
      normal: [
        { desc: "ตอบบทสนทนา", question: "Scrum Master: What will you do next?", correct: "I will fix the login bug.", distractors: ["Next is a spoon.", "I will become a chair."] },
        { desc: "ตอบบทสนทนา", question: "Teammate: Can you review my code?", correct: "Sure, I can review it after lunch.", distractors: ["Code is a flower.", "I review my shoe."] },
        { desc: "ตอบบทสนทนา", question: "Manager: Is the feature ready?", correct: "It is almost ready for testing.", distractors: ["Ready is a table.", "The feature is sleeping."] },
        { desc: "ตอบบทสนทนา", question: "Developer: There is a blocker.", correct: "What blocker do you have?", distractors: ["Blocker is my cat.", "I eat blockers."] },
        { desc: "ตอบบทสนทนา", question: "Product Owner: Can we demo it tomorrow?", correct: "Yes, we can prepare a demo.", distractors: ["Tomorrow is a banana.", "Demo is under the sea."] }
      ],
      hard: [
        { desc: "ตอบบทสนทนา", question: "Scrum Master: What progress can you share with the team?", correct: "I finished the first page and tested the form.", distractors: ["Progress is in my shoe.", "The team is my breakfast."] },
        { desc: "ตอบบทสนทนา", question: "Teammate: Are there any problems with the API?", correct: "Yes, I still need access to the API documentation.", distractors: ["API is an apple pie idea.", "Problems are sleeping outside."] },
        { desc: "ตอบบทสนทนา", question: "Lead: What is your plan after this meeting?", correct: "I will update the page and run more tests.", distractors: ["Meetings are made of milk.", "I will plan the window."] },
        { desc: "ตอบบทสนทนา", question: "Tester: Can you explain this bug?", correct: "The button does not work on mobile.", distractors: ["The bug is very delicious.", "I explain with a banana."] },
        { desc: "ตอบบทสนทนา", question: "Manager: Are we ready for the client demo?", correct: "Yes, the main flow is working well now.", distractors: ["The client is a pencil.", "Demo is under the chair."] }
      ]
    }
  },

  {
    id: 7,
    type: "writing",
    title: "S7: Bug Report",
    bank: {
      easy: [
        { desc: "พิมพ์ชื่อปัญหา", prompt: "SYSTEM: Type one simple bug word.\nYOU:", keywords: ["bug", "error", "problem", "issue"], minMatch: 1, starter: "Starter: bug", failMsg: "ลองพิมพ์ bug หรือ error" },
        { desc: "พิมพ์ชื่ออาการ", prompt: "SYSTEM: Type one result word.\nYOU:", keywords: ["crash", "slow", "broken", "fail"], minMatch: 1, starter: "Starter: crash", failMsg: "ลองพิมพ์ crash หรือ slow" },
        { desc: "พิมพ์คำเกี่ยวกับปุ่ม", prompt: "SYSTEM: Type one UI word.\nYOU:", keywords: ["button", "screen", "page", "form"], minMatch: 1, starter: "Starter: button", failMsg: "ลองพิมพ์ button หรือ screen" },
        { desc: "พิมพ์คำเกี่ยวกับระบบ", prompt: "SYSTEM: Type one system word.\nYOU:", keywords: ["login", "server", "api", "app"], minMatch: 1, starter: "Starter: login", failMsg: "ลองพิมพ์ login หรือ app" },
        { desc: "พิมพ์คำเกี่ยวกับ testing", prompt: "SYSTEM: Type one test word.\nYOU:", keywords: ["test", "check", "click", "open"], minMatch: 1, starter: "Starter: test", failMsg: "ลองพิมพ์ test หรือ check" }
      ],
      normal: [
        { desc: "พิมพ์ 2 คำอธิบายบั๊ก", prompt: "SYSTEM: Type two words for a bug.\nYOU:", keywords: ["login", "bug", "button", "error", "screen"], minMatch: 2, starter: "Starter: login error", failMsg: "ลองพิมพ์ 2 คำ เช่น login error" },
        { desc: "พิมพ์ 2 คำอธิบายผลลัพธ์", prompt: "SYSTEM: Type two words for the result.\nYOU:", keywords: ["page", "crash", "not", "open", "slow"], minMatch: 2, starter: "Starter: page crash", failMsg: "ลองพิมพ์ 2 คำ เช่น page crash" },
        { desc: "พิมพ์ 2 คำอธิบายการทดสอบ", prompt: "SYSTEM: Type two words for testing.\nYOU:", keywords: ["click", "test", "mobile", "browser", "login"], minMatch: 2, starter: "Starter: mobile test", failMsg: "ลองพิมพ์ 2 คำ เช่น mobile test" },
        { desc: "พิมพ์ 2 คำอธิบายหน้า UI", prompt: "SYSTEM: Type two words about the page.\nYOU:", keywords: ["form", "page", "button", "input", "screen"], minMatch: 2, starter: "Starter: form input", failMsg: "ลองพิมพ์ 2 คำ เช่น form input" },
        { desc: "พิมพ์ 2 คำอธิบาย severity", prompt: "SYSTEM: Type two words about severity.\nYOU:", keywords: ["high", "low", "serious", "minor", "critical"], minMatch: 2, starter: "Starter: high critical", failMsg: "ลองพิมพ์ 2 คำ เช่น high serious" }
      ],
      hard: [
        { desc: "พิมพ์ประโยคบั๊กสั้น ๆ", prompt: "SYSTEM: Write a short bug sentence.\nYOU:", keywords: ["login", "button", "does", "not", "work"], minMatch: 3, starter: "Starter: The login button does not work.", failMsg: "ลองพิมพ์เช่น login button does not work" },
        { desc: "พิมพ์ประโยคผลลัพธ์สั้น ๆ", prompt: "SYSTEM: Write a short result sentence.\nYOU:", keywords: ["page", "crash", "after", "click", "submit"], minMatch: 3, starter: "Starter: The page crashes after submit.", failMsg: "ลองพิมพ์เช่น page crashes after click" },
        { desc: "พิมพ์ประโยคการทดสอบสั้น ๆ", prompt: "SYSTEM: Write a short testing sentence.\nYOU:", keywords: ["i", "tested", "on", "mobile", "browser"], minMatch: 3, starter: "Starter: I tested it on mobile.", failMsg: "ลองพิมพ์เช่น i tested on mobile" },
        { desc: "พิมพ์ประโยค expected result", prompt: "SYSTEM: Write the expected result.\nYOU:", keywords: ["page", "should", "open", "work", "correctly"], minMatch: 3, starter: "Starter: The page should open correctly.", failMsg: "ลองพิมพ์เช่น page should open correctly" },
        { desc: "พิมพ์ประโยค severity", prompt: "SYSTEM: Write a short severity sentence.\nYOU:", keywords: ["this", "is", "a", "high", "issue"], minMatch: 3, starter: "Starter: This is a high issue.", failMsg: "ลองพิมพ์เช่น this is a high issue" }
      ]
    }
  },

  {
    id: 8,
    type: "speaking",
    title: "S8: Presentation",
    bank: {
      easy: [
        { desc: 'พูดตาม: "This is our app"', exactPhrase: "this is our app", failMsg: "พูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "It helps students"', exactPhrase: "it helps students", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "We built this project"', exactPhrase: "we built this project", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "The design is simple"', exactPhrase: "the design is simple", failMsg: "พูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "The system is useful"', exactPhrase: "the system is useful", failMsg: "พูดให้ชัดอีกครั้ง" }
      ],
      normal: [
        { desc: 'พูดตาม: "This is our app for university students"', exactPhrase: "this is our app for university students", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "It helps students manage their tasks"', exactPhrase: "it helps students manage their tasks", failMsg: "พยายามพูดให้ครบ" },
        { desc: 'พูดตาม: "We built this project with our team"', exactPhrase: "we built this project with our team", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "The design is simple and easy to use"', exactPhrase: "the design is simple and easy to use", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "The system is useful for daily study"', exactPhrase: "the system is useful for daily study", failMsg: "พูดให้ครบ" }
      ],
      hard: [
        { desc: 'พูดตาม: "This is our app, and it helps students plan their work"', exactPhrase: "this is our app and it helps students plan their work", failMsg: "พูดให้ครบอีกครั้ง" },
        { desc: 'พูดตาม: "We built this project to solve a real problem"', exactPhrase: "we built this project to solve a real problem", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "The design is simple, clean, and easy to understand"', exactPhrase: "the design is simple clean and easy to understand", failMsg: "พูดให้ชัดและครบ" },
        { desc: 'พูดตาม: "Our team tested the system before the final presentation"', exactPhrase: "our team tested the system before the final presentation", failMsg: "พยายามพูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "We hope this app can help many students in the future"', exactPhrase: "we hope this app can help many students in the future", failMsg: "พูดให้ครบประโยค" }
      ]
    }
  },

  {
    id: 9,
    type: "reading",
    title: "S9: Client Meeting",
    bank: {
      easy: [
        { desc: "ตอบลูกค้า", question: "Client: Can you help us?", correct: "Yes, we can help you.", distractors: ["Help is a cloud.", "I drink the client."] },
        { desc: "ตอบลูกค้า", question: "Client: Is the app ready?", correct: "It is almost ready.", distractors: ["Ready is yellow.", "The app is my shoe."] },
        { desc: "ตอบลูกค้า", question: "Client: Can we meet tomorrow?", correct: "Yes, tomorrow is fine.", distractors: ["Tomorrow is a sandwich.", "We meet in a banana."] },
        { desc: "ตอบลูกค้า", question: "Client: Do you need more time?", correct: "Yes, we need one more day.", distractors: ["Time is a cat.", "One day is inside my bag."] },
        { desc: "ตอบลูกค้า", question: "Client: Can you send the file?", correct: "Yes, I will send it today.", distractors: ["The file is eating.", "I send on the moon."] }
      ],
      normal: [
        { desc: "ตอบลูกค้า", question: "Client: When can you show the first version?", correct: "We can show it next week.", distractors: ["The first version is red.", "Next week is a keyboard."] },
        { desc: "ตอบลูกค้า", question: "Client: Can you change the color of the page?", correct: "Yes, we can change it.", distractors: ["The page changes me.", "Color is a table."] },
        { desc: "ตอบลูกค้า", question: "Client: Is this feature easy to use?", correct: "Yes, it is simple and clear.", distractors: ["Easy is a fish.", "The feature is asleep."] },
        { desc: "ตอบลูกค้า", question: "Client: Do you understand our problem?", correct: "Yes, we understand your main problem.", distractors: ["The problem is green tea.", "I understand the wall."] },
        { desc: "ตอบลูกค้า", question: "Client: Can we talk again on Friday?", correct: "Yes, Friday afternoon is okay.", distractors: ["Friday is a notebook.", "I talk to Friday every day."] }
      ],
      hard: [
        { desc: "ตอบลูกค้า", question: "Client: Can you explain the benefit of this feature?", correct: "Yes, it saves time and makes the work easier.", distractors: ["Benefit is a banana on the floor.", "The feature benefits the window."] },
        { desc: "ตอบลูกค้า", question: "Client: How long do you need to finish the update?", correct: "We need about two more days.", distractors: ["Update is my breakfast.", "Two days are inside the door."] },
        { desc: "ตอบลูกค้า", question: "Client: Can your team test this on mobile too?", correct: "Yes, we can test both web and mobile.", distractors: ["Mobile is a flower.", "Testing is under the chair."] },
        { desc: "ตอบลูกค้า", question: "Client: What part of the system is ready now?", correct: "The main page and login page are ready.", distractors: ["Ready parts are invisible.", "The system is in my pocket."] },
        { desc: "ตอบลูกค้า", question: "Client: Can you send a short summary after this meeting?", correct: "Yes, I will send a short summary today.", distractors: ["Summary is a chair.", "I send the meeting to the summary."] }
      ]
    }
  },

  {
    id: 10,
    type: "listening",
    title: "S10: Global Team",
    bank: {
      easy: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please send the file today.", correct: "Send the file today.", distractors: ["Buy a file.", "Sleep today."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the meeting at ten.", correct: "Join the meeting at ten.", distractors: ["Sleep at ten.", "Eat the meeting."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Open the web page now.", correct: "Open the web page now.", distractors: ["Close the web page now.", "Draw the web page."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Check the email again.", correct: "Check the email again.", distractors: ["Delete the email.", "Cook the email."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Update the task board.", correct: "Update the task board.", distractors: ["Throw the task board.", "Paint the task board red."] }
      ],
      normal: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please share your screen during the meeting.", correct: "Share your screen during the meeting.", distractors: ["Break the screen.", "Hide the meeting."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the call five minutes early.", correct: "Join five minutes early.", distractors: ["Be five minutes late.", "End the call now."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Write a short summary after the class.", correct: "Write a short summary after class.", distractors: ["Delete the class.", "Sleep after class only."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please test the mobile version tonight.", correct: "Test the mobile version tonight.", distractors: ["Buy a mobile tonight.", "Throw away the version."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "We need to think about time zones.", correct: "Think about time zones.", distractors: ["Break the time zone.", "Time zones are shoes."] }
      ],
      hard: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please deploy the latest version to the test server before lunch.", correct: "Deploy the latest version before lunch.", distractors: ["Eat the server at lunch.", "Delete the latest version."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Move the meeting to three p m because the client is busy.", correct: "Move the meeting to three p m.", distractors: ["Cancel the client forever.", "The meeting is in the bag."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please send the documentation to the Singapore team.", correct: "Send the documentation to the Singapore team.", distractors: ["Travel to Singapore now.", "Hide the documentation."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "We need more testing on the mobile app before release.", correct: "We need more testing before release.", distractors: ["Release it now without testing.", "The app is testing us."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "The backend team will update the api after the maintenance window.", correct: "The backend team will update the api later.", distractors: ["The api will delete the backend team.", "The maintenance window is a pizza."] }
      ]
    }
  },

  {
    id: 11,
    type: "writing",
    title: "S11: Data and AI",
    bank: {
      easy: [
        { desc: "พิมพ์คำ AI 1 คำ", prompt: "SYSTEM: Type one AI word.\nYOU:", keywords: ["ai", "model", "data", "chatbot", "prompt"], minMatch: 1, starter: "Starter: ai", failMsg: "ลองพิมพ์ ai หรือ model" },
        { desc: "พิมพ์คำ data 1 คำ", prompt: "SYSTEM: Type one data word.\nYOU:", keywords: ["data", "table", "file", "chart", "label"], minMatch: 1, starter: "Starter: data", failMsg: "ลองพิมพ์ data หรือ table" },
        { desc: "พิมพ์คำ machine learning 1 คำ", prompt: "SYSTEM: Type one machine learning word.\nYOU:", keywords: ["training", "testing", "prediction", "accuracy"], minMatch: 1, starter: "Starter: training", failMsg: "ลองพิมพ์ training หรือ testing" },
        { desc: "พิมพ์คำ ethics 1 คำ", prompt: "SYSTEM: Type one ethics word.\nYOU:", keywords: ["privacy", "fairness", "bias", "safety"], minMatch: 1, starter: "Starter: privacy", failMsg: "ลองพิมพ์ privacy หรือ fairness" },
        { desc: "พิมพ์คำ deployment 1 คำ", prompt: "SYSTEM: Type one deployment word.\nYOU:", keywords: ["deploy", "monitor", "server", "update"], minMatch: 1, starter: "Starter: deploy", failMsg: "ลองพิมพ์ deploy หรือ server" }
      ],
      normal: [
        { desc: "พิมพ์ 2 คำเกี่ยวกับ AI", prompt: "SYSTEM: Type two AI words.\nYOU:", keywords: ["ai", "model", "prompt", "chatbot", "data"], minMatch: 2, starter: "Starter: ai model", failMsg: "ลองพิมพ์ 2 คำ เช่น ai model" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ data", prompt: "SYSTEM: Type two data words.\nYOU:", keywords: ["data", "table", "chart", "label", "file"], minMatch: 2, starter: "Starter: data chart", failMsg: "ลองพิมพ์ 2 คำ เช่น data chart" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ learning", prompt: "SYSTEM: Type two learning words.\nYOU:", keywords: ["training", "testing", "prediction", "accuracy"], minMatch: 2, starter: "Starter: training testing", failMsg: "ลองพิมพ์ 2 คำ เช่น training testing" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ ethics", prompt: "SYSTEM: Type two ethics words.\nYOU:", keywords: ["privacy", "fairness", "bias", "safety"], minMatch: 2, starter: "Starter: privacy fairness", failMsg: "ลองพิมพ์ 2 คำ เช่น privacy fairness" },
        { desc: "พิมพ์ 2 คำเกี่ยวกับ deployment", prompt: "SYSTEM: Type two deployment words.\nYOU:", keywords: ["deploy", "monitor", "server", "update"], minMatch: 2, starter: "Starter: deploy server", failMsg: "ลองพิมพ์ 2 คำ เช่น deploy server" }
      ],
      hard: [
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ AI", prompt: "SYSTEM: Write a short sentence about AI.\nYOU:", keywords: ["ai", "helps", "people", "work", "learn"], minMatch: 3, starter: "Starter: AI helps people work faster.", failMsg: "ลองพิมพ์เช่น AI helps people work" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ data", prompt: "SYSTEM: Write a short sentence about data.\nYOU:", keywords: ["data", "is", "important", "for", "analysis"], minMatch: 3, starter: "Starter: Data is important for analysis.", failMsg: "ลองพิมพ์เช่น data is important" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ training", prompt: "SYSTEM: Write a short sentence about model training.\nYOU:", keywords: ["training", "needs", "data", "for", "accuracy"], minMatch: 3, starter: "Starter: Training needs data for accuracy.", failMsg: "ลองพิมพ์เช่น training needs data" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ ethics", prompt: "SYSTEM: Write a short sentence about AI ethics.\nYOU:", keywords: ["privacy", "fairness", "is", "important", "ai"], minMatch: 3, starter: "Starter: Privacy and fairness are important in AI.", failMsg: "ลองพิมพ์เช่น privacy is important in ai" },
        { desc: "พิมพ์ประโยคสั้นเกี่ยวกับ deployment", prompt: "SYSTEM: Write a short sentence about deployment.\nYOU:", keywords: ["we", "deploy", "and", "monitor", "system"], minMatch: 3, starter: "Starter: We deploy and monitor the system.", failMsg: "ลองพิมพ์เช่น we deploy and monitor the system" }
      ]
    }
  },

  {
    id: 12,
    type: "speaking",
    title: "S12: Product Demo",
    bank: {
      easy: [
        { desc: 'พูดตาม: "This is our product"', exactPhrase: "this is our product", failMsg: "พูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "It is easy to use"', exactPhrase: "it is easy to use", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "Our app helps students"', exactPhrase: "our app helps students", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "The design is simple"', exactPhrase: "the design is simple", failMsg: "พูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "We tested the app"', exactPhrase: "we tested the app", failMsg: "พูดให้ชัดอีกครั้ง" }
      ],
      normal: [
        { desc: 'พูดตาม: "This is our product for university students"', exactPhrase: "this is our product for university students", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "It is easy to use and easy to learn"', exactPhrase: "it is easy to use and easy to learn", failMsg: "พยายามพูดให้ครบ" },
        { desc: 'พูดตาม: "Our app helps students manage their tasks"', exactPhrase: "our app helps students manage their tasks", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "The design is simple and clear for users"', exactPhrase: "the design is simple and clear for users", failMsg: "พูดให้ชัดอีกครั้ง" },
        { desc: 'พูดตาม: "We tested the app before the demo"', exactPhrase: "we tested the app before the demo", failMsg: "พูดให้ครบ" }
      ],
      hard: [
        { desc: 'พูดตาม: "This is our product, and it helps students plan their work"', exactPhrase: "this is our product and it helps students plan their work", failMsg: "พูดให้ครบอีกครั้ง" },
        { desc: 'พูดตาม: "It is easy to use because the design is simple and clean"', exactPhrase: "it is easy to use because the design is simple and clean", failMsg: "พูดให้ครบประโยค" },
        { desc: 'พูดตาม: "Our app helps students organize tasks and deadlines"', exactPhrase: "our app helps students organize tasks and deadlines", failMsg: "พูดให้ชัดและครบ" },
        { desc: 'พูดตาม: "We tested the main features before the final presentation"', exactPhrase: "we tested the main features before the final presentation", failMsg: "พยายามพูดใหม่อีกครั้ง" },
        { desc: 'พูดตาม: "We hope this product can support students in the future"', exactPhrase: "we hope this product can support students in the future", failMsg: "พูดให้ครบประโยค" }
      ]
    }
  },

  {
    id: 13,
    type: "reading",
    title: "S13: Career Path",
    bank: {
      easy: [
        { desc: "ตอบ HR", question: "HR: What job do you want?", correct: "I want to be a developer.", distractors: ["I want to be a spoon.", "I want to be inside the wall."] },
        { desc: "ตอบ HR", question: "HR: Do you have skills?", correct: "Yes, I can code and design.", distractors: ["My skill is pizza.", "Skills are sleeping."] },
        { desc: "ตอบ HR", question: "HR: Can you work in a team?", correct: "Yes, I can work in a team.", distractors: ["Teamwork is my notebook.", "I work in a team of chairs."] },
        { desc: "ตอบ HR", question: "HR: Do you learn quickly?", correct: "Yes, I learn quickly.", distractors: ["Learning is a window.", "Quickly is my bag."] },
        { desc: "ตอบ HR", question: "HR: Did you do a project?", correct: "Yes, I did a university project.", distractors: ["Project is a juice.", "I project the floor."] }
      ],
      normal: [
        { desc: "ตอบ HR", question: "HR: What role are you applying for?", correct: "I am applying for a software developer role.", distractors: ["I am applying for a banana role.", "I am a role of the desk."] },
        { desc: "ตอบ HR", question: "HR: What technical skills do you have?", correct: "I can use Python and JavaScript.", distractors: ["I can use Monday and blue.", "I have technical apples."] },
        { desc: "ตอบ HR", question: "HR: Did you complete an internship?", correct: "Yes, I had an internship last summer.", distractors: ["Summer completed me.", "Internship is a chair."] },
        { desc: "ตอบ HR", question: "HR: How do you improve yourself?", correct: "I practice coding and study online.", distractors: ["I improve by sleeping on books.", "Improvement is a fish."] },
        { desc: "ตอบ HR", question: "HR: Why do you want this job?", correct: "I want to learn and grow in this role.", distractors: ["The job is a sandwich.", "I want this job because it is purple."] }
      ],
      hard: [
        { desc: "ตอบ HR", question: "HR: What kind of company do you want to join?", correct: "I want to join a company with a good team and learning culture.", distractors: ["I want to join a company inside my pencil.", "Companies are made of oranges."] },
        { desc: "ตอบ HR", question: "HR: How do your projects help your career?", correct: "My projects help me practice real skills and teamwork.", distractors: ["My career is under my laptop.", "Projects are sleeping in my bag."] },
        { desc: "ตอบ HR", question: "HR: Can you describe one strength you have?", correct: "I am good at communication and solving problems.", distractors: ["My strength is a bus stop.", "I solve with sandwiches."] },
        { desc: "ตอบ HR", question: "HR: What are you doing to improve your English?", correct: "I practice speaking and listening every day.", distractors: ["English is a yellow box.", "I improve English by hiding it."] },
        { desc: "ตอบ HR", question: "HR: What do you want to do after graduation?", correct: "I want to work and keep learning in tech.", distractors: ["Graduation is my breakfast.", "I want to become a chair of success."] }
      ]
    }
  },

  {
    id: 14,
    type: "listening",
    title: "S14: Remote Work",
    bank: {
      easy: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Turn on your camera.", correct: "Turn on your camera.", distractors: ["Turn off your homework.", "Eat the camera."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Share your screen now.", correct: "Share your screen now.", distractors: ["Break your screen now.", "Hide the screen in a bag."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the call early.", correct: "Join the call early.", distractors: ["Leave the call early.", "Draw the call."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Check your microphone.", correct: "Check your microphone.", distractors: ["Eat your microphone.", "Throw the microphone away."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Write a short note.", correct: "Write a short note.", distractors: ["Sleep on the note.", "Paint the note green."] }
      ],
      normal: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please turn on your camera during the demo.", correct: "Turn on your camera during the demo.", distractors: ["Turn off the demo forever.", "Put the camera in the box."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the online meeting five minutes early.", correct: "Join five minutes early.", distractors: ["Join fifty minutes late.", "Eat before the meeting only."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please update the task board before the meeting.", correct: "Update the task board before the meeting.", distractors: ["Delete the task board.", "Break the meeting."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Write a short summary after the call.", correct: "Write a short summary after the call.", distractors: ["Close the summary.", "Sleep during the call."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Test your internet connection before class.", correct: "Test your internet connection before class.", distractors: ["Turn off the internet before class.", "Throw the class away."] }
      ],
      hard: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please send a clear update to the team after the client meeting.", correct: "Send a clear update after the client meeting.", distractors: ["Sleep after the client meeting forever.", "Delete the client from the meeting."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Make sure your microphone and camera are ready before the presentation starts.", correct: "Prepare your microphone and camera before the presentation.", distractors: ["Hide the presentation under the camera.", "Break your microphone before the meeting."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please write a short action list and share it with the team after the call.", correct: "Write a short action list and share it after the call.", distractors: ["Throw the action list into the call.", "Sleep instead of sharing the list."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Check the shared document carefully and leave your comments before tomorrow morning.", correct: "Check the shared document and leave comments before tomorrow morning.", distractors: ["Delete the comments tomorrow morning.", "Draw the shared document on the wall."] },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the remote meeting on time and be ready to explain your progress clearly.", correct: "Join on time and explain your progress clearly.", distractors: ["Join late and hide your progress.", "Explain the meeting to your chair."] }
      ]
    }
  },

  {
    id: 15,
    type: "writing",
    title: "S15: Graduation Final",
    bank: {
      easy: [
        { desc: "พิมพ์เป้าหมาย 1 คำ", prompt: "SYSTEM: Type one future goal word.\nYOU:", keywords: ["work", "job", "study", "master", "developer"], minMatch: 1, starter: "Starter: work", failMsg: "ลองพิมพ์ work หรือ developer" },
        { desc: "พิมพ์ skill 1 คำ", prompt: "SYSTEM: Type one skill word.\nYOU:", keywords: ["coding", "teamwork", "english", "design", "testing"], minMatch: 1, starter: "Starter: coding", failMsg: "ลองพิมพ์ coding หรือ teamwork" },
        { desc: "พิมพ์ project 1 คำ", prompt: "SYSTEM: Type one project word.\nYOU:", keywords: ["app", "web", "system", "ai", "mobile"], minMatch: 1, starter: "Starter: app", failMsg: "ลองพิมพ์ app หรือ system" },
        { desc: "พิมพ์ thank you 1 คำ", prompt: "SYSTEM: Type one thank word.\nYOU:", keywords: ["thank", "thanks", "grateful"], minMatch: 1, starter: "Starter: thank", failMsg: "ลองพิมพ์ thank หรือ thanks" },
        { desc: "พิมพ์ dream 1 คำ", prompt: "SYSTEM: Type one dream word.\nYOU:", keywords: ["future", "dream", "goal", "success"], minMatch: 1, starter: "Starter: goal", failMsg: "ลองพิมพ์ dream หรือ goal" }
      ],
      normal: [
        { desc: "พิมพ์เป้าหมายสั้น ๆ", prompt: "SYSTEM: Write a short future goal.\nYOU:", keywords: ["i", "want", "to", "work", "developer"], minMatch: 3, starter: "Starter: I want to work as a developer.", failMsg: "ลองพิมพ์เช่น i want to work" },
        { desc: "พิมพ์ skill ที่ชอบ", prompt: "SYSTEM: Write a short skill sentence.\nYOU:", keywords: ["i", "like", "coding", "teamwork", "design"], minMatch: 3, starter: "Starter: I like coding and teamwork.", failMsg: "ลองพิมพ์เช่น i like coding" },
        { desc: "พิมพ์ project ที่อยากทำ", prompt: "SYSTEM: Write a short dream project sentence.\nYOU:", keywords: ["i", "want", "build", "app", "system"], minMatch: 3, starter: "Starter: I want to build an app.", failMsg: "ลองพิมพ์เช่น i want build app" },
        { desc: "พิมพ์แผนเรียนต่อ", prompt: "SYSTEM: Write a short study plan.\nYOU:", keywords: ["i", "want", "study", "more", "english", "ai"], minMatch: 3, starter: "Starter: I want to study more English and AI.", failMsg: "ลองพิมพ์เช่น i want study more" },
        { desc: "พิมพ์ thank you message สั้น ๆ", prompt: "SYSTEM: Write a short thank you message.\nYOU:", keywords: ["thank", "you", "teacher", "friends", "support"], minMatch: 3, starter: "Starter: Thank you, teacher and friends, for your support.", failMsg: "ลองพิมพ์ thank you message สั้น ๆ" }
      ],
      hard: [
        { desc: "พิมพ์ประโยคเป้าหมายหลังจบการศึกษา", prompt: "SYSTEM: Write a short sentence about your goal after graduation.\nYOU:", keywords: ["after", "graduation", "i", "want", "work", "developer"], minMatch: 3, starter: "Starter: After graduation, I want to work as a developer.", failMsg: "ลองพิมพ์เช่น after graduation i want work as a developer" },
        { desc: "พิมพ์ประโยคเกี่ยวกับ skill สำคัญ", prompt: "SYSTEM: Write a short sentence about an important skill.\nYOU:", keywords: ["coding", "english", "teamwork", "important", "career"], minMatch: 3, starter: "Starter: Coding and teamwork are important for my career.", failMsg: "ลองพิมพ์เช่น coding is important for my career" },
        { desc: "พิมพ์ประโยคเกี่ยวกับ project ในฝัน", prompt: "SYSTEM: Write a short sentence about your dream project.\nYOU:", keywords: ["i", "want", "build", "useful", "app", "students"], minMatch: 3, starter: "Starter: I want to build a useful app for students.", failMsg: "ลองพิมพ์เช่น i want to build a useful app" },
        { desc: "พิมพ์ประโยคแผนการเรียนรู้ต่อ", prompt: "SYSTEM: Write a short sentence about your learning plan.\nYOU:", keywords: ["i", "will", "learn", "more", "ai", "english"], minMatch: 3, starter: "Starter: I will learn more AI and English.", failMsg: "ลองพิมพ์เช่น i will learn more ai and english" },
        { desc: "พิมพ์ประโยคขอบคุณปิดท้าย", prompt: "SYSTEM: Write a short final thank you sentence.\nYOU:", keywords: ["thank", "you", "for", "support", "future"], minMatch: 3, starter: "Starter: Thank you for your support in my journey.", failMsg: "ลองพิมพ์เช่น thank you for your support" }
      ]
    }
  }
]);

function hashSeed(input) {
  const str = String(input ?? "");
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(seed) {
  const make = hashSeed(seed);
  return mulberry32(make());
}

export function pickAdaptiveMissionItem(
  sessionId,
  mode = "normal",
  aiState = { pressure: 0, support: 0 },
  seed = `${sessionId}-${Date.now()}`
) {
  const mission = missionDB.find((m) => m.id === sessionId);
  if (!mission) return null;

  let targetDiff = mode;
  if (aiState?.support >= 2) targetDiff = "easy";
  else if (aiState?.pressure >= 2) targetDiff = "hard";

  const bank = mission.bank?.[targetDiff] || mission.bank?.normal || [];
  if (!bank.length) return null;

  const rng = seededRng(seed);
  const randomIndex = Math.floor(rng() * bank.length);

  return {
    ...bank[randomIndex],
    _sessionId: sessionId,
    _sessionType: mission.type,
    _selectedDifficulty: targetDiff
  };
}
