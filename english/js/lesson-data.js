// lesson-data.js
// A2 question bank version
// 15 sessions x 15 items each
// difficulty bank per session: easy(5) / normal(5) / hard(5)

export const missionDB = [
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
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Tom: Hello!", choices: ["A: Hello!", "B: Good night.", "C: Thank you."], answer: "A" },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Jane: How are you?", choices: ["A: I am fine.", "B: It is blue.", "C: I am a desk."], answer: "A" },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Teacher: Good morning.", choices: ["A: Good morning.", "B: See you yesterday.", "C: Open the door."], answer: "A" },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Friend: Nice to meet you.", choices: ["A: Nice to meet you too.", "B: I like rice.", "C: My bag is black."], answer: "A" },
        { desc: "เลือกคำตอบที่เหมาะสม", question: "Guest: Thank you.", choices: ["A: You are welcome.", "B: I am hungry.", "C: It is Monday."], answer: "A" }
      ],
      normal: [
        { desc: "ตอบบทสนทนา", question: "Manager: Welcome to our office.", choices: ["A: Thank you. It is nice to be here.", "B: My office is a cat.", "C: I go to sleep."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Student: Sorry I am late.", choices: ["A: That is okay. Please sit down.", "B: I am a window.", "C: Late is green."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Colleague: Can I ask your name?", choices: ["A: Sure. My name is Mina.", "B: My name is Tuesday.", "C: I can ask the wall."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Host: Please come in.", choices: ["A: Thank you very much.", "B: Come in is yellow.", "C: I am a laptop."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Guide: Do you need help?", choices: ["A: Yes, please. I need some help.", "B: Help is a shoe.", "C: I eat notebooks."], answer: "A" }
      ],
      hard: [
        { desc: "ตอบบทสนทนา", question: "Interviewer: Please introduce yourself briefly.", choices: ["A: Sure. My name is Nida, and I am a computer science student.", "B: Briefly is my dog.", "C: I am on the table."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Visitor: Excuse me, is this seat free?", choices: ["A: Yes, you can sit here.", "B: The seat is orange juice.", "C: I sit in tomorrow."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Staff: Thank you for waiting.", choices: ["A: No problem. Thank you.", "B: Waiting is purple.", "C: I wait with a sandwich."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Coach: Are you ready to begin?", choices: ["A: Yes, I am ready.", "B: Begin is a pencil.", "C: I ready the window."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Team lead: Nice work today.", choices: ["A: Thank you. I learned a lot today.", "B: Work is my banana.", "C: Today is inside the car."], answer: "A" }
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
        { desc: "ฟังและเลือกคำตอบ", audioText: "What is your name?", choices: ["A: My name is Ben.", "B: I am a bag.", "C: Monday is big."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Where are you from?", choices: ["A: I am from Thailand.", "B: I am from lunch.", "C: I am from blue."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What do you study?", choices: ["A: I study computer science.", "B: I study a chair.", "C: I study the rain."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Do you like coding?", choices: ["A: Yes, I do.", "B: Yes, I banana.", "C: Coding is a desk."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Can you work in a team?", choices: ["A: Yes, I can.", "B: Team is a flower.", "C: I work in Tuesday."], answer: "A" }
      ],
      normal: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please tell me about yourself.", choices: ["A: I am a student and I like coding.", "B: I am inside a laptop.", "C: Myself is a window."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Why do you want this job?", choices: ["A: I want to learn and grow.", "B: The job is green.", "C: Because the chair is happy."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What is your strength?", choices: ["A: I am good at teamwork.", "B: My strength is orange.", "C: I am stronger than a table."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Do you have project experience?", choices: ["A: Yes, I worked on a university project.", "B: Experience is coffee.", "C: My project is sleeping."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Can you learn new skills quickly?", choices: ["A: Yes, I can learn quickly.", "B: Skills are blue.", "C: Quickly is a box."], answer: "A" }
      ],
      hard: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please describe a project you worked on at university.", choices: ["A: I built a web project with my team.", "B: My university is under the table.", "C: A project is my breakfast."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What do you want to do after graduation?", choices: ["A: I want to work as a software developer.", "B: Graduation is a sandwich.", "C: I want to become a pencil."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "How do you improve your English skills?", choices: ["A: I practice speaking and listening every day.", "B: English is on the wall.", "C: I improve by sleeping on books."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "What kind of company do you want to join?", choices: ["A: I want to join a company with a good team.", "B: The company is in my pocket.", "C: I join a company of shoes."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Can you explain your role in your last project?", choices: ["A: I worked on design and testing.", "B: My role was a chicken.", "C: Project roles are windows."], answer: "A" }
      ]
    }
  },

  {
    id: 6,
    type: "reading",
    title: "S6: Agile Team",
    bank: {
      easy: [
        { desc: "ตอบบทสนทนา", question: "Lead: What did you do today?", choices: ["A: I finished my task.", "B: I am a book.", "C: Today is green."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Lead: Do you need help?", choices: ["A: Yes, please.", "B: Help is a bag.", "C: I help the wall."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Lead: Are you ready?", choices: ["A: Yes, I am ready.", "B: Ready is a fish.", "C: I am readying the desk."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Lead: Can you test this page?", choices: ["A: Yes, I can test it.", "B: The page is rice.", "C: I test in tomorrow."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Lead: Did you join the meeting?", choices: ["A: Yes, I joined it.", "B: Meeting is a wall.", "C: I join the yellow."], answer: "A" }
      ],
      normal: [
        { desc: "ตอบบทสนทนา", question: "Scrum Master: What will you do next?", choices: ["A: I will fix the login bug.", "B: Next is a spoon.", "C: I will become a chair."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Teammate: Can you review my code?", choices: ["A: Sure, I can review it after lunch.", "B: Code is a flower.", "C: I review my shoe."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Manager: Is the feature ready?", choices: ["A: It is almost ready for testing.", "B: Ready is a table.", "C: The feature is sleeping."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Developer: There is a blocker.", choices: ["A: What blocker do you have?", "B: Blocker is my cat.", "C: I eat blockers."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Product Owner: Can we demo it tomorrow?", choices: ["A: Yes, we can prepare a demo.", "B: Tomorrow is a banana.", "C: Demo is under the sea."], answer: "A" }
      ],
      hard: [
        { desc: "ตอบบทสนทนา", question: "Scrum Master: What progress can you share with the team?", choices: ["A: I finished the first page and tested the form.", "B: Progress is in my shoe.", "C: The team is my breakfast."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Teammate: Are there any problems with the API?", choices: ["A: Yes, I still need access to the API documentation.", "B: API is an apple pie idea.", "C: Problems are sleeping outside."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Lead: What is your plan after this meeting?", choices: ["A: I will update the page and run more tests.", "B: Meetings are made of milk.", "C: I will plan the window."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Tester: Can you explain this bug?", choices: ["A: The button does not work on mobile.", "B: The bug is very delicious.", "C: I explain with a banana."], answer: "A" },
        { desc: "ตอบบทสนทนา", question: "Manager: Are we ready for the client demo?", choices: ["A: Yes, the main flow is working well now.", "B: The client is a pencil.", "C: Demo is under the chair."], answer: "A" }
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
        { desc: "ตอบลูกค้า", question: "Client: Can you help us?", choices: ["A: Yes, we can help you.", "B: Help is a cloud.", "C: I drink the client."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Is the app ready?", choices: ["A: It is almost ready.", "B: Ready is yellow.", "C: The app is my shoe."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Can we meet tomorrow?", choices: ["A: Yes, tomorrow is fine.", "B: Tomorrow is a sandwich.", "C: We meet in a banana."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Do you need more time?", choices: ["A: Yes, we need one more day.", "B: Time is a cat.", "C: One day is inside my bag."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Can you send the file?", choices: ["A: Yes, I will send it today.", "B: The file is eating.", "C: I send on the moon."], answer: "A" }
      ],
      normal: [
        { desc: "ตอบลูกค้า", question: "Client: When can you show the first version?", choices: ["A: We can show it next week.", "B: The first version is red.", "C: Next week is a keyboard."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Can you change the color of the page?", choices: ["A: Yes, we can change it.", "B: The page changes me.", "C: Color is a table."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Is this feature easy to use?", choices: ["A: Yes, it is simple and clear.", "B: Easy is a fish.", "C: The feature is asleep."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Do you understand our problem?", choices: ["A: Yes, we understand your main problem.", "B: The problem is green tea.", "C: I understand the wall."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Can we talk again on Friday?", choices: ["A: Yes, Friday afternoon is okay.", "B: Friday is a notebook.", "C: I talk to Friday every day."], answer: "A" }
      ],
      hard: [
        { desc: "ตอบลูกค้า", question: "Client: Can you explain the benefit of this feature?", choices: ["A: Yes, it saves time and makes the work easier.", "B: Benefit is a banana on the floor.", "C: The feature benefits the window."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: How long do you need to finish the update?", choices: ["A: We need about two more days.", "B: Update is my breakfast.", "C: Two days are inside the door."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Can your team test this on mobile too?", choices: ["A: Yes, we can test both web and mobile.", "B: Mobile is a flower.", "C: Testing is under the chair."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: What part of the system is ready now?", choices: ["A: The main page and login page are ready.", "B: Ready parts are invisible.", "C: The system is in my pocket."], answer: "A" },
        { desc: "ตอบลูกค้า", question: "Client: Can you send a short summary after this meeting?", choices: ["A: Yes, I will send a short summary today.", "B: Summary is a chair.", "C: I send the meeting to the summary."], answer: "A" }
      ]
    }
  },

  {
    id: 10,
    type: "listening",
    title: "S10: Global Team",
    bank: {
      easy: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please send the file today.", choices: ["A: Send the file today.", "B: Buy a file.", "C: Sleep today."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the meeting at ten.", choices: ["A: Join the meeting at ten.", "B: Sleep at ten.", "C: Eat the meeting."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Open the web page now.", choices: ["A: Open the web page now.", "B: Close the web page now.", "C: Draw the web page."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Check the email again.", choices: ["A: Check the email again.", "B: Delete the email.", "C: Cook the email."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Update the task board.", choices: ["A: Update the task board.", "B: Throw the task board.", "C: Paint the task board red."], answer: "A" }
      ],
      normal: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please share your screen during the meeting.", choices: ["A: Share your screen during the meeting.", "B: Break the screen.", "C: Hide the meeting."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the call five minutes early.", choices: ["A: Join five minutes early.", "B: Be five minutes late.", "C: End the call now."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Write a short summary after the class.", choices: ["A: Write a short summary after class.", "B: Delete the class.", "C: Sleep after class only."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please test the mobile version tonight.", choices: ["A: Test the mobile version tonight.", "B: Buy a mobile tonight.", "C: Throw away the version."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "We need to think about time zones.", choices: ["A: Think about time zones.", "B: Break the time zone.", "C: Time zones are shoes."], answer: "A" }
      ],
      hard: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please deploy the latest version to the test server before lunch.", choices: ["A: Deploy the latest version before lunch.", "B: Eat the server at lunch.", "C: Delete the latest version."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Move the meeting to three p m because the client is busy.", choices: ["A: Move the meeting to three p m.", "B: Cancel the client forever.", "C: The meeting is in the bag."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please send the documentation to the Singapore team.", choices: ["A: Send the documentation to the Singapore team.", "B: Travel to Singapore now.", "C: Hide the documentation."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "We need more testing on the mobile app before release.", choices: ["A: We need more testing before release.", "B: Release it now without testing.", "C: The app is testing us."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "The backend team will update the api after the maintenance window.", choices: ["A: The backend team will update the api later.", "B: The api will delete the backend team.", "C: The maintenance window is a pizza."], answer: "A" }
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
        { desc: "ตอบ HR", question: "HR: What job do you want?", choices: ["A: I want to be a developer.", "B: I want to be a spoon.", "C: I want to be inside the wall."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Do you have skills?", choices: ["A: Yes, I can code and design.", "B: My skill is pizza.", "C: Skills are sleeping."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Can you work in a team?", choices: ["A: Yes, I can work in a team.", "B: Teamwork is my notebook.", "C: I work in a team of chairs."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Do you learn quickly?", choices: ["A: Yes, I learn quickly.", "B: Learning is a window.", "C: Quickly is my bag."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Did you do a project?", choices: ["A: Yes, I did a university project.", "B: Project is a juice.", "C: I project the floor."], answer: "A" }
      ],
      normal: [
        { desc: "ตอบ HR", question: "HR: What role are you applying for?", choices: ["A: I am applying for a software developer role.", "B: I am applying for a banana role.", "C: I am a role of the desk."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: What technical skills do you have?", choices: ["A: I can use Python and JavaScript.", "B: I can use Monday and blue.", "C: I have technical apples."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Did you complete an internship?", choices: ["A: Yes, I had an internship last summer.", "B: Summer completed me.", "C: Internship is a chair."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: How do you improve yourself?", choices: ["A: I practice coding and study online.", "B: I improve by sleeping on books.", "C: Improvement is a fish."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Why do you want this job?", choices: ["A: I want to learn and grow in this role.", "B: The job is a sandwich.", "C: I want this job because it is purple."], answer: "A" }
      ],
      hard: [
        { desc: "ตอบ HR", question: "HR: What kind of company do you want to join?", choices: ["A: I want to join a company with a good team and learning culture.", "B: I want to join a company inside my pencil.", "C: Companies are made of oranges."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: How do your projects help your career?", choices: ["A: My projects help me practice real skills and teamwork.", "B: My career is under my laptop.", "C: Projects are sleeping in my bag."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: Can you describe one strength you have?", choices: ["A: I am good at communication and solving problems.", "B: My strength is a bus stop.", "C: I solve with sandwiches."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: What are you doing to improve your English?", choices: ["A: I practice speaking and listening every day.", "B: English is a yellow box.", "C: I improve English by hiding it."], answer: "A" },
        { desc: "ตอบ HR", question: "HR: What do you want to do after graduation?", choices: ["A: I want to work and keep learning in tech.", "B: Graduation is my breakfast.", "C: I want to become a chair of success."], answer: "A" }
      ]
    }
  },

  {
    id: 14,
    type: "listening",
    title: "S14: Remote Work",
    bank: {
      easy: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Turn on your camera.", choices: ["A: Turn on your camera.", "B: Turn off your homework.", "C: Eat the camera."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Share your screen now.", choices: ["A: Share your screen now.", "B: Break your screen now.", "C: Hide the screen in a bag."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the call early.", choices: ["A: Join the call early.", "B: Leave the call early.", "C: Draw the call."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Check your microphone.", choices: ["A: Check your microphone.", "B: Eat your microphone.", "C: Throw the microphone away."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Write a short note.", choices: ["A: Write a short note.", "B: Sleep on the note.", "C: Paint the note green."], answer: "A" }
      ],
      normal: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please turn on your camera during the demo.", choices: ["A: Turn on your camera during the demo.", "B: Turn off the demo forever.", "C: Put the camera in the box."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the online meeting five minutes early.", choices: ["A: Join five minutes early.", "B: Join fifty minutes late.", "C: Eat before the meeting only."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please update the task board before the meeting.", choices: ["A: Update the task board before the meeting.", "B: Delete the task board.", "C: Break the meeting."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Write a short summary after the call.", choices: ["A: Write a short summary after the call.", "B: Close the summary.", "C: Sleep during the call."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Test your internet connection before class.", choices: ["A: Test your internet connection before class.", "B: Turn off the internet before class.", "C: Throw the class away."], answer: "A" }
      ],
      hard: [
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please send a clear update to the team after the client meeting.", choices: ["A: Send a clear update after the client meeting.", "B: Sleep after the client meeting forever.", "C: Delete the client from the meeting."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Make sure your microphone and camera are ready before the presentation starts.", choices: ["A: Prepare your microphone and camera before the presentation.", "B: Hide the presentation under the camera.", "C: Break your microphone before the meeting."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Please write a short action list and share it with the team after the call.", choices: ["A: Write a short action list and share it after the call.", "B: Throw the action list into the call.", "C: Sleep instead of sharing the list."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Check the shared document carefully and leave your comments before tomorrow morning.", choices: ["A: Check the shared document and leave comments before tomorrow morning.", "B: Delete the comments tomorrow morning.", "C: Draw the shared document on the wall."], answer: "A" },
        { desc: "ฟังและเลือกคำตอบ", audioText: "Join the remote meeting on time and be ready to explain your progress clearly.", choices: ["A: Join on time and explain your progress clearly.", "B: Join late and hide your progress.", "C: Explain the meeting to your chair."], answer: "A" }
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
];
