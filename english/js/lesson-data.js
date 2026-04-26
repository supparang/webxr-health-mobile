// === /english/js/lesson-data.js ===
// PATCH v20260424j-LESSON-DATA-A2-B1PLUS-600
// English Quest / TechPath VR
// ✅ 15 sessions
// ✅ each S has one main route type
// ✅ every 3 sessions = boss: S3, S6, S9, S12, S15
// ✅ difficulty: easy / normal / hard / challenge
// ✅ CEFR: A2 / A2+ / B1 / B1+
// ✅ 10 items per difficulty per session
// ✅ total: 15 × 4 × 10 = 600 generated items
// ✅ keeps legacy export names: missionDB, pickAdaptiveMissionItem

const DATA_VERSION = "v20260424j-LESSON-DATA-A2-B1PLUS-600";

export const DIFFICULTY_META = {
  easy: {
    key: "easy",
    label: "Easy",
    cefr: "A2",
    passScore: 65,
    itemCount: 10
  },
  normal: {
    key: "normal",
    label: "Normal",
    cefr: "A2+",
    passScore: 72,
    itemCount: 10
  },
  hard: {
    key: "hard",
    label: "Hard",
    cefr: "B1",
    passScore: 78,
    itemCount: 10
  },
  challenge: {
    key: "challenge",
    label: "Challenge",
    cefr: "B1+",
    passScore: 84,
    itemCount: 10
  }
};

export const DIFFICULTY_ORDER = ["easy", "normal", "hard", "challenge"];

export const SESSION_ROUTES = [
  {
    id: 1,
    sid: "S1",
    type: "speaking",
    title: "S1: Introduction",
    theme: "self-introduction as a CS/AI student",
    boss: false
  },
  {
    id: 2,
    sid: "S2",
    type: "listening",
    title: "S2: Academic Background",
    theme: "academic background and university projects",
    boss: false
  },
  {
    id: 3,
    sid: "S3",
    type: "boss",
    title: "S3: Boss 1 — Intro + Academic Challenge",
    theme: "introduction, study background, and basic tech roles",
    boss: true,
    bossNo: 1
  },
  {
    id: 4,
    sid: "S4",
    type: "reading",
    title: "S4: Tech Jobs and Roles",
    theme: "technology jobs and responsibilities",
    boss: false
  },
  {
    id: 5,
    sid: "S5",
    type: "writing",
    title: "S5: Emails and Chat",
    theme: "workplace email and chat messages",
    boss: false
  },
  {
    id: 6,
    sid: "S6",
    type: "boss",
    title: "S6: Boss 2 — Workplace Communication",
    theme: "daily work, emails, meetings, and teamwork",
    boss: true,
    bossNo: 2
  },
  {
    id: 7,
    sid: "S7",
    type: "speaking",
    title: "S7: Explaining a System",
    theme: "explaining how a system works",
    boss: false
  },
  {
    id: 8,
    sid: "S8",
    type: "reading",
    title: "S8: Problems and Bugs",
    theme: "bug reports and problem descriptions",
    boss: false
  },
  {
    id: 9,
    sid: "S9",
    type: "boss",
    title: "S9: Boss 3 — Team Stand-up Mission",
    theme: "scrum, bug fixing, and project progress",
    boss: true,
    bossNo: 3
  },
  {
    id: 10,
    sid: "S10",
    type: "listening",
    title: "S10: Client Communication",
    theme: "client requests and project updates",
    boss: false
  },
  {
    id: 11,
    sid: "S11",
    type: "writing",
    title: "S11: Data and AI Communication",
    theme: "data, AI, ethics, and deployment",
    boss: false
  },
  {
    id: 12,
    sid: "S12",
    type: "boss",
    title: "S12: Boss 4 — Portfolio + AI Mission",
    theme: "portfolio, AI explanation, and client demo",
    boss: true,
    bossNo: 4
  },
  {
    id: 13,
    sid: "S13",
    type: "speaking",
    title: "S13: Job Interview",
    theme: "job interview for CS/AI students",
    boss: false
  },
  {
    id: 14,
    sid: "S14",
    type: "speaking",
    title: "S14: Project Pitch",
    theme: "project pitching and presentation",
    boss: false
  },
  {
    id: 15,
    sid: "S15",
    type: "finalBoss",
    title: "S15: Final Boss — Capstone Career Mission",
    theme: "final career and capstone mission",
    boss: true,
    bossNo: 5
  }
];

const BOSS_SKILL_CYCLE = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "speaking",
  "listening",
  "reading",
  "writing",
  "speaking",
  "writing"
];

const NAMES = [
  "Anna",
  "Ben",
  "Mina",
  "Krit",
  "Nina",
  "Mark",
  "Ploy",
  "Jay",
  "Emma",
  "Leo"
];

const ROLES = [
  "student",
  "developer",
  "designer",
  "tester",
  "team member",
  "project leader",
  "AI learner",
  "web developer",
  "data assistant",
  "intern"
];

function cleanText(v) {
  return String(v == null ? "" : v).trim();
}

function normalizeDifficulty(v = "normal") {
  const raw = cleanText(v).toLowerCase();

  if (["easy", "e", "a2"].includes(raw)) return "easy";
  if (["normal", "medium", "n", "a2+"].includes(raw)) return "normal";
  if (["hard", "h", "b1"].includes(raw)) return "hard";
  if (["challenge", "expert", "x", "b1+"].includes(raw)) return "challenge";

  return "normal";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLegacyChoices(correct, distractors = []) {
  const letters = ["A", "B", "C"];
  const raw = [correct, ...distractors].slice(0, 3);
  return raw.map((text, index) => `${letters[index]}. ${cleanText(text)}`);
}

function makeChoiceItemBase({ correct, distractors = [] }) {
  return {
    correct,
    distractors,
    choices: toLegacyChoices(correct, distractors),
    answer: "A"
  };
}

function getSkillForRoute(route, index) {
  if (route.type === "boss" || route.type === "finalBoss") {
    return BOSS_SKILL_CYCLE[(index - 1) % BOSS_SKILL_CYCLE.length];
  }

  return route.type;
}

function getBossPhase(index) {
  if (index <= 3) return "warmup";
  if (index <= 7) return "battle";
  return "finish";
}

function speakingTarget(route, diff, index) {
  const name = NAMES[(index - 1) % NAMES.length];

  const map = {
    easy: [
      `My name is ${name}.`,
      `I am a computer science student.`,
      `I study artificial intelligence.`,
      `I like coding.`,
      `I can build a simple app.`,
      `I work with my team.`,
      `I test the web page.`,
      `I want to learn English.`,
      `I use data in my project.`,
      `I am ready to present.`
    ],
    normal: [
      `My name is ${name}, and I study computer science.`,
      `I am learning artificial intelligence for my future career.`,
      `I can write simple code and test my program.`,
      `My project is a web app for students.`,
      `I use English to explain my technology project.`,
      `I can work with a team and share ideas.`,
      `I want to become a software developer.`,
      `I can describe a bug in simple English.`,
      `Our system helps users find information faster.`,
      `I can present my project clearly.`
    ],
    hard: [
      `My name is ${name}. I study AI because I want to solve real problems with technology.`,
      `A good developer should write clear code, test it, and communicate with the team.`,
      `My application helps users save time by organizing information clearly.`,
      `I can describe a bug, explain the problem, and suggest a possible solution.`,
      `Artificial intelligence can help users make better decisions from data.`,
      `I am interested in this career because I like building useful digital tools.`,
      `In my project, users can log in, save data, and view a simple dashboard.`,
      `I want to improve my English because many technology documents are written in English.`,
      `My team tested the main features before the final presentation.`,
      `I can present my skills, my project, and my learning goal in English.`
    ],
    challenge: [
      `My name is ${name}. I am a CS and AI student, and I want to build applications that support real users.`,
      `My project solves a simple but important problem by using data, a clear interface, and useful feedback.`,
      `Communication is important for developers because a good idea must be explained clearly to users and teammates.`,
      `In my future job, I want to design AI tools that are helpful, safe, and easy for people to understand.`,
      `When I find a bug, I check the steps, test the feature, and explain the issue to my team clearly.`,
      `This system collects user input, processes the data, and shows useful feedback on a dashboard.`,
      `I chose this project because it connects programming skills with a real need in education or business.`,
      `A strong portfolio should show the problem, the solution, the technology, and the result of the project.`,
      `During a project pitch, I should explain the user problem, the main feature, and the value of the solution.`,
      `I can introduce myself, explain my skills, and present my final project with confidence.`
    ]
  };

  return map[diff][index - 1];
}

function makeSpeakingItem(route, diff, index) {
  const meta = DIFFICULTY_META[diff];
  const target = speakingTarget(route, diff, index);

  return {
    id: `${route.sid}-SP-${diff.toUpperCase()}-${pad2(index)}`,
    type: "speaking",
    skill: "speaking",
    difficulty: diff,
    cefr: meta.cefr,
    desc: `พูดตามระดับ ${meta.cefr}`,
    prompt: "Say the sentence clearly.",
    target,
    exactPhrase: target
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    passScore: meta.passScore,
    failMsg: "พูดให้ชัดและครบประโยคอีกครั้ง",
    points: diff === "challenge" ? 20 : diff === "hard" ? 15 : 10
  };
}

function listeningScript(route, diff, index) {
  const name = NAMES[(index - 1) % NAMES.length];

  const map = {
    easy: [
      `${name} studies computer science.`,
      `${name} likes coding.`,
      `${name} uses a laptop for class.`,
      `${name} joins a team meeting.`,
      `${name} checks the project file.`,
      `${name} tests a web page.`,
      `${name} sends an email today.`,
      `${name} opens the task board.`,
      `${name} writes a short note.`,
      `${name} is ready for class.`
    ],
    normal: [
      `${name} is a computer science student. The project is a simple web app for students.`,
      `${name} studies AI and wants to build useful applications.`,
      `${name} joins a team meeting and shares project progress.`,
      `${name} checks the mobile version before the client demo.`,
      `${name} writes a short summary after the online meeting.`,
      `${name} explains that the login page is almost ready for testing.`,
      `${name} sends the documentation to the team before lunch.`,
      `${name} uses a task board to organize work and deadlines.`,
      `${name} practices English to prepare for a job interview.`,
      `${name} presents a simple project idea to classmates.`
    ],
    hard: [
      `${name} is explaining a university project. The app helps students organize data, check progress, and solve a small problem.`,
      `${name} reports that the login button works on desktop, but it still needs more testing on mobile devices.`,
      `${name} asks the team to review the API documentation before starting the next development task.`,
      `${name} explains that the dashboard shows user progress and helps teachers understand learning results.`,
      `${name} tells the client that the main flow is ready, but the team needs two more days for testing.`,
      `${name} says that communication is important because developers must explain technical problems clearly.`,
      `${name} describes a bug, gives the steps to reproduce it, and suggests checking the browser console.`,
      `${name} wants to improve English because many software documents and tutorials use technical English.`,
      `${name} prepares a project pitch that explains the problem, solution, and benefit for users.`,
      `${name} says that AI can support learning, but developers should test the output carefully.`
    ],
    challenge: [
      `${name} is presenting a CS and AI project. The system collects user input, analyzes simple data, and shows useful feedback on a dashboard.`,
      `${name} explains that the team improved the user interface after testing the first prototype with students.`,
      `${name} reports that the model gives useful suggestions, but the team still needs to check privacy and fairness.`,
      `${name} tells the client that the current version supports the main workflow, while advanced analytics will be added later.`,
      `${name} explains that the project is valuable because it connects programming skills with a real educational need.`,
      `${name} says the team used feedback from users to redesign the form, reduce confusion, and improve task completion.`,
      `${name} describes how the system receives data, processes it, and displays results in a clear visual dashboard.`,
      `${name} explains that a good project presentation should include the user problem, main feature, evidence, and next step.`,
      `${name} discusses how AI can help users make decisions, but human review is still important for safety and accuracy.`,
      `${name} summarizes the final project by explaining the problem, the solution, the technology, and the expected impact.`
    ]
  };

  return map[diff][index - 1];
}

function makeListeningItem(route, diff, index) {
  const meta = DIFFICULTY_META[diff];
  const audioText = listeningScript(route, diff, index);

  const correctByDiff = {
    easy: "A simple study or technology action",
    normal: "A university technology project or teamwork task",
    hard: "A project update, bug report, or technical explanation",
    challenge: "A detailed CS/AI project explanation with user value"
  };

  return {
    id: `${route.sid}-LI-${diff.toUpperCase()}-${pad2(index)}`,
    type: "listening",
    skill: "listening",
    difficulty: diff,
    cefr: meta.cefr,
    desc: `ฟังแล้วเลือกคำตอบ ระดับ ${meta.cefr}`,
    audioText,
    question: "What is the main idea?",
    ...makeChoiceItemBase({
      correct: correctByDiff[diff],
      distractors: [
        "A restaurant order",
        "A sports activity"
      ]
    }),
    passScore: meta.passScore,
    points: diff === "challenge" ? 20 : diff === "hard" ? 15 : 10
  };
}

function readingPassage(route, diff, index) {
  const map = {
    easy: [
      "A student is learning coding. The student writes simple programs and tests them.",
      "A web page has a button. The user clicks the button to open a form.",
      "A team has a project. They meet every week and share tasks.",
      "A student uses a laptop to study English and technology.",
      "The app is simple. It helps users save notes.",
      "A developer checks a bug on a web page.",
      "The teacher asks students to send a short file.",
      "A student wants to be a software developer.",
      "The team uses data in a small project.",
      "The project is ready for a short demo."
    ],
    normal: [
      "Mina is a CS student. She is building a web app for her class project. The app helps students save notes and check tasks.",
      "A small team is preparing a demo. One student designs the page, one student tests the form, and one student writes the report.",
      "The login page works on a computer, but it does not work well on a phone. The team needs to test it again.",
      "A client asks for a simple dashboard. The team will show the first version next week.",
      "A student writes an email to explain the project progress and ask for feedback.",
      "The app helps users organize tasks. It shows deadlines, progress, and short reminders.",
      "A developer reads the API document before connecting the app to the server.",
      "The team uses online meetings because some members study from home.",
      "A student practices English to explain technical words in a job interview.",
      "The project pitch explains the problem, the solution, and the benefit for users."
    ],
    hard: [
      "A software team is testing a new feature. The login button works on a computer, but it does not work well on a mobile phone. The team needs to check the design and fix the bug.",
      "An AI project can help users find information faster. The system receives a question, searches the data, and gives a short answer. However, the developer must test the answer carefully.",
      "The client wants a dashboard that is easy to understand. The team decides to show charts, progress numbers, and a short summary on the main page.",
      "A student portfolio should show more than screenshots. It should explain the problem, the technology, the role of the student, and the result of the project.",
      "During a stand-up meeting, each team member explains what they did yesterday, what they will do today, and what problems they have.",
      "The team found a serious bug in the mobile version. The page opens correctly, but the submit button does not send data to the server.",
      "A project report should describe the user problem, the design process, the test result, and what the team learned.",
      "The developer uses English when reading documentation, asking questions online, and writing comments for teammates.",
      "A good client message should be polite, clear, and specific. It should explain what is finished and what still needs work.",
      "The AI tool gives useful suggestions, but students should review the output and check whether it is correct."
    ],
    challenge: [
      "A capstone project should connect technical skills with a real user need. A strong team explains the problem clearly, designs a useful solution, tests it with users, and presents evidence that the system works.",
      "The team developed an AI learning assistant for students. It collects answers, identifies weak topics, and recommends practice tasks. The main challenge is to make the feedback useful without confusing beginners.",
      "A client meeting is not only about showing features. Developers must listen carefully, ask follow-up questions, confirm requirements, and explain what can be delivered within the project timeline.",
      "A bug report is more useful when it includes clear steps, the expected result, the actual result, the device, and screenshots. This information helps the team reproduce and fix the problem faster.",
      "A project pitch should persuade the audience that the problem is real and the solution is practical. It should avoid too many technical details and focus on user value.",
      "Remote teamwork requires clear communication. Team members should update tasks, respect time zones, write short summaries, and make sure decisions are recorded after meetings.",
      "AI systems can support decision making, but developers must consider accuracy, privacy, fairness, and user trust. A useful system should explain its output in a simple way.",
      "A portfolio interview gives students a chance to show not only what they built but also how they solved problems, worked with others, and improved from feedback.",
      "A dashboard is effective when users can understand key information quickly. Good design uses clear labels, simple charts, and enough context for users to make decisions.",
      "In the final presentation, students should explain the user problem, the solution, the technology, testing results, limitations, and future improvements."
    ]
  };

  return map[diff][index - 1];
}

function makeReadingItem(route, diff, index) {
  const meta = DIFFICULTY_META[diff];
  const passage = readingPassage(route, diff, index);

  const correctByDiff = {
    easy: "A simple technology learning task",
    normal: "A CS project or teamwork situation",
    hard: "A technical problem or project explanation",
    challenge: "A detailed project, AI, or professional communication idea"
  };

  return {
    id: `${route.sid}-RE-${diff.toUpperCase()}-${pad2(index)}`,
    type: "reading",
    skill: "reading",
    difficulty: diff,
    cefr: meta.cefr,
    desc: `อ่านข้อความแล้วเลือกคำตอบ ระดับ ${meta.cefr}`,
    passage,
    question: "What is the passage mainly about?",
    ...makeChoiceItemBase({
      correct: correctByDiff[diff],
      distractors: [
        "A food menu",
        "A travel story"
      ]
    }),
    passScore: meta.passScore,
    points: diff === "challenge" ? 20 : diff === "hard" ? 15 : 10
  };
}

function writingPrompt(route, diff, index) {
  const map = {
    easy: [
      {
        prompt: "SYSTEM: Write one simple sentence about your study.\nYOU:",
        starter: "Starter: I study computer science.",
        keywords: ["i", "study", "computer", "science"]
      },
      {
        prompt: "SYSTEM: Write one simple sentence about coding.\nYOU:",
        starter: "Starter: I like coding.",
        keywords: ["i", "like", "coding", "code"]
      },
      {
        prompt: "SYSTEM: Write one sentence about your team.\nYOU:",
        starter: "Starter: I work with my team.",
        keywords: ["i", "work", "team"]
      },
      {
        prompt: "SYSTEM: Write one sentence about an app.\nYOU:",
        starter: "Starter: This app is useful.",
        keywords: ["app", "is", "useful"]
      },
      {
        prompt: "SYSTEM: Write one sentence about data.\nYOU:",
        starter: "Starter: Data is important.",
        keywords: ["data", "is", "important"]
      },
      {
        prompt: "SYSTEM: Write one sentence about a bug.\nYOU:",
        starter: "Starter: The button has a bug.",
        keywords: ["bug", "button"]
      },
      {
        prompt: "SYSTEM: Write one sentence about English.\nYOU:",
        starter: "Starter: I learn English.",
        keywords: ["i", "learn", "english"]
      },
      {
        prompt: "SYSTEM: Write one sentence about your project.\nYOU:",
        starter: "Starter: My project is a web app.",
        keywords: ["project", "web", "app"]
      },
      {
        prompt: "SYSTEM: Write one sentence about your goal.\nYOU:",
        starter: "Starter: I want to be a developer.",
        keywords: ["i", "want", "developer"]
      },
      {
        prompt: "SYSTEM: Write one thank-you sentence.\nYOU:",
        starter: "Starter: Thank you for your help.",
        keywords: ["thank", "you", "help"]
      }
    ],
    normal: [
      {
        prompt: "SYSTEM: Write two sentences about your CS/AI project.\nYOU:",
        starter: "Starter: I am building a web app. It helps students manage tasks.",
        keywords: ["web", "app", "students", "tasks"]
      },
      {
        prompt: "SYSTEM: Write a short workplace chat message.\nYOU:",
        starter: "Starter: I finished the login page. Please check it today.",
        keywords: ["finished", "login", "check"]
      },
      {
        prompt: "SYSTEM: Write a short email to ask for feedback.\nYOU:",
        starter: "Starter: Could you please check my project and give feedback?",
        keywords: ["please", "check", "feedback"]
      },
      {
        prompt: "SYSTEM: Write two sentences about a bug.\nYOU:",
        starter: "Starter: The button does not work. I will test it again.",
        keywords: ["button", "does", "not", "work", "test"]
      },
      {
        prompt: "SYSTEM: Write a short project update.\nYOU:",
        starter: "Starter: The main page is ready. We still need to test the form.",
        keywords: ["main", "page", "ready", "test"]
      },
      {
        prompt: "SYSTEM: Write two sentences about AI.\nYOU:",
        starter: "Starter: AI can help people learn. We should check the answer carefully.",
        keywords: ["ai", "help", "learn", "check"]
      },
      {
        prompt: "SYSTEM: Write a short message after a meeting.\nYOU:",
        starter: "Starter: Thank you for the meeting. I will update the task board.",
        keywords: ["meeting", "update", "task"]
      },
      {
        prompt: "SYSTEM: Write two sentences about your skill.\nYOU:",
        starter: "Starter: I can use Python. I want to improve my English.",
        keywords: ["python", "improve", "english"]
      },
      {
        prompt: "SYSTEM: Write a short client reply.\nYOU:",
        starter: "Starter: Yes, we can update the design and send it tomorrow.",
        keywords: ["update", "design", "send"]
      },
      {
        prompt: "SYSTEM: Write a short portfolio sentence.\nYOU:",
        starter: "Starter: My portfolio shows my web app and AI project.",
        keywords: ["portfolio", "web", "ai", "project"]
      }
    ],
    hard: [
      {
        prompt: "SYSTEM: Write a short paragraph about your project problem and solution.\nYOU:",
        starter: "Starter: Our project helps students manage deadlines. It solves the problem of missed tasks.",
        keywords: ["project", "problem", "solution", "students"]
      },
      {
        prompt: "SYSTEM: Write a bug report with the problem and expected result.\nYOU:",
        starter: "Starter: The login button does not work on mobile. The page should open correctly after login.",
        keywords: ["login", "mobile", "should", "correctly"]
      },
      {
        prompt: "SYSTEM: Write a short email to a client about project progress.\nYOU:",
        starter: "Starter: The main flow is ready for testing. We need two more days to finish the update.",
        keywords: ["main", "flow", "testing", "update"]
      },
      {
        prompt: "SYSTEM: Write a short explanation of how your system works.\nYOU:",
        starter: "Starter: The system collects user input, saves data, and shows progress on a dashboard.",
        keywords: ["system", "collects", "data", "dashboard"]
      },
      {
        prompt: "SYSTEM: Write a short job interview answer about your strength.\nYOU:",
        starter: "Starter: My strength is teamwork because I can communicate and solve problems with others.",
        keywords: ["strength", "teamwork", "communicate", "problems"]
      },
      {
        prompt: "SYSTEM: Write a short paragraph about AI and data.\nYOU:",
        starter: "Starter: AI uses data to make predictions. Developers should test the results carefully.",
        keywords: ["ai", "data", "predictions", "test"]
      },
      {
        prompt: "SYSTEM: Write a project pitch paragraph.\nYOU:",
        starter: "Starter: Our app solves a real student problem. It helps users plan tasks and check progress.",
        keywords: ["app", "solves", "problem", "progress"]
      },
      {
        prompt: "SYSTEM: Write a summary after an online meeting.\nYOU:",
        starter: "Starter: We discussed the design and testing plan. I will update the task board today.",
        keywords: ["discussed", "design", "testing", "update"]
      },
      {
        prompt: "SYSTEM: Write a short reflection about learning English for tech.\nYOU:",
        starter: "Starter: English helps me read documents, explain projects, and prepare for my career.",
        keywords: ["english", "documents", "projects", "career"]
      },
      {
        prompt: "SYSTEM: Write a short portfolio description.\nYOU:",
        starter: "Starter: This project shows my skills in web development, testing, and teamwork.",
        keywords: ["project", "skills", "development", "teamwork"]
      }
    ],
    challenge: [
      {
        prompt: "SYSTEM: Write a B1+ project explanation with problem, solution, and benefit.\nYOU:",
        starter: "Starter: Our project addresses missed deadlines by giving students a clear task dashboard, reminders, and progress feedback.",
        keywords: ["problem", "solution", "benefit", "dashboard", "feedback"]
      },
      {
        prompt: "SYSTEM: Write a B1+ client update with progress, limitation, and next step.\nYOU:",
        starter: "Starter: The main workflow is complete, but mobile testing is still in progress. We will send an updated version after reviewing the results.",
        keywords: ["workflow", "testing", "progress", "updated", "results"]
      },
      {
        prompt: "SYSTEM: Write a B1+ bug report summary.\nYOU:",
        starter: "Starter: The form works on desktop, but it fails on mobile after users press submit. The team should check the input validation and API request.",
        keywords: ["desktop", "mobile", "submit", "validation", "api"]
      },
      {
        prompt: "SYSTEM: Write a B1+ explanation of an AI feature.\nYOU:",
        starter: "Starter: The AI feature analyzes user answers and recommends practice tasks, but the system should explain suggestions clearly to build trust.",
        keywords: ["ai", "analyzes", "recommends", "explain", "trust"]
      },
      {
        prompt: "SYSTEM: Write a B1+ portfolio paragraph.\nYOU:",
        starter: "Starter: My portfolio demonstrates my ability to identify user needs, design a practical solution, test features, and communicate results.",
        keywords: ["portfolio", "user", "solution", "test", "communicate"]
      },
      {
        prompt: "SYSTEM: Write a B1+ project pitch introduction.\nYOU:",
        starter: "Starter: Many students lose track of assignments, so our app provides a simple planning tool that shows priorities, deadlines, and progress.",
        keywords: ["students", "assignments", "planning", "deadlines", "progress"]
      },
      {
        prompt: "SYSTEM: Write a B1+ reflection on teamwork.\nYOU:",
        starter: "Starter: Effective teamwork requires clear roles, regular updates, and respectful feedback, especially when a project has a short deadline.",
        keywords: ["teamwork", "roles", "updates", "feedback", "deadline"]
      },
      {
        prompt: "SYSTEM: Write a B1+ interview answer about career goals.\nYOU:",
        starter: "Starter: I want to work as a developer because I enjoy solving problems, learning new tools, and creating products that help people.",
        keywords: ["developer", "solving", "learning", "products", "people"]
      },
      {
        prompt: "SYSTEM: Write a B1+ explanation of ethical AI.\nYOU:",
        starter: "Starter: Ethical AI should protect privacy, reduce bias, and provide useful explanations so users can understand and trust the system.",
        keywords: ["ethical", "privacy", "bias", "explanations", "trust"]
      },
      {
        prompt: "SYSTEM: Write a B1+ final learning statement.\nYOU:",
        starter: "Starter: This course helped me practice English for real technology situations, from teamwork and bug reports to interviews and project presentations.",
        keywords: ["course", "english", "technology", "interviews", "presentations"]
      }
    ]
  };

  return map[diff][index - 1];
}

function makeWritingItem(route, diff, index) {
  const meta = DIFFICULTY_META[diff];
  const data = writingPrompt(route, diff, index);

  return {
    id: `${route.sid}-WR-${diff.toUpperCase()}-${pad2(index)}`,
    type: "writing",
    skill: "writing",
    difficulty: diff,
    cefr: meta.cefr,
    desc: `เขียนตามภารกิจ ระดับ ${meta.cefr}`,
    prompt: data.prompt,
    starter: data.starter,
    keywords: data.keywords,
    minMatch:
      diff === "easy"
        ? 2
        : diff === "normal"
          ? 3
          : diff === "hard"
            ? 4
            : 5,
    minWords:
      diff === "easy"
        ? 5
        : diff === "normal"
          ? 10
          : diff === "hard"
            ? 18
            : 25,
    modelAnswer: data.starter.replace(/^Starter:\s*/i, ""),
    passScore: meta.passScore,
    failMsg: "ลองเขียนให้ครบตามคำสำคัญและระดับภาษาที่กำหนด",
    points: diff === "challenge" ? 20 : diff === "hard" ? 15 : 10
  };
}

function makeItem(route, diff, index) {
  const skill = getSkillForRoute(route, index);

  let item;

  if (skill === "speaking") {
    item = makeSpeakingItem(route, diff, index);
  } else if (skill === "listening") {
    item = makeListeningItem(route, diff, index);
  } else if (skill === "reading") {
    item = makeReadingItem(route, diff, index);
  } else if (skill === "writing") {
    item = makeWritingItem(route, diff, index);
  } else {
    item = makeReadingItem(route, diff, index);
  }

  return {
    ...item,
    _dataVersion: DATA_VERSION,
    _sessionId: route.id,
    _sid: route.sid,
    _sessionType: route.type,
    _routeType: route.type,
    _title: route.title,
    _theme: route.theme,
    _index: index,
    boss: !!route.boss,
    bossNo: route.bossNo || 0,
    bossPhase: route.boss ? getBossPhase(index) : "",
    comboRequired: !!route.boss && index >= 8
  };
}

function buildBankForRoute(route) {
  const bank = {};

  DIFFICULTY_ORDER.forEach((diff) => {
    bank[diff] = [];

    for (let i = 1; i <= 10; i++) {
      bank[diff].push(makeItem(route, diff, i));
    }
  });

  return bank;
}

function normalizeMissionGroup(group) {
  if (!group || typeof group !== "object") return group;

  const bank = group.bank || {};

  const normalizedBank = {
    easy: Array.isArray(bank.easy) ? bank.easy : [],
    normal: Array.isArray(bank.normal) ? bank.normal : [],
    hard: Array.isArray(bank.hard) ? bank.hard : [],
    challenge: Array.isArray(bank.challenge) ? bank.challenge : []
  };

  return {
    ...group,
    skill: group.type,
    sid: group.sid || `S${group.id}`,
    cefrRange: "A2-B1+",
    difficultyOrder: DIFFICULTY_ORDER,
    bank: normalizedBank,
    banks: normalizedBank
  };
}

function normalizeMissionBank(list = []) {
  return list.map(normalizeMissionGroup);
}

export const missionDB = normalizeMissionBank(
  SESSION_ROUTES.map((route) => ({
    ...route,
    skill: route.type,
    cefrRange: "A2-B1+",
    difficultyOrder: DIFFICULTY_ORDER,
    bank: buildBankForRoute(route)
  }))
);

export const LESSON_DATA = missionDB;
export const LESSON_SESSIONS = missionDB;

export const lessonData = {
  version: DATA_VERSION,
  cefrRange: "A2-B1+",
  difficultyOrder: DIFFICULTY_ORDER,
  difficultyMeta: DIFFICULTY_META,
  routes: SESSION_ROUTES,
  sessions: missionDB
};

export default missionDB;

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

function resolveAdaptiveDifficulty(mode = "normal", aiState = {}) {
  let targetDiff = normalizeDifficulty(mode);

  const support = Number(aiState?.support || 0);
  const pressure = Number(aiState?.pressure || 0);
  const accuracy = Number(aiState?.accuracy || aiState?.lastAccuracy || 0);
  const streak = Number(aiState?.streak || aiState?.correctStreak || 0);
  const wrongStreak = Number(aiState?.wrongStreak || 0);

  if (support >= 2 || wrongStreak >= 2 || accuracy < 55) {
    targetDiff = "easy";
  } else if (pressure >= 3 || accuracy >= 90 || streak >= 3) {
    targetDiff = "challenge";
  } else if (pressure >= 2 || accuracy >= 80 || streak >= 2) {
    targetDiff = "hard";
  }

  return targetDiff;
}

export function pickAdaptiveMissionItem(
  sessionId,
  mode = "normal",
  aiState = { pressure: 0, support: 0 },
  seed = `${sessionId}-${Date.now()}`
) {
  const numericId = Number(String(sessionId).replace(/^S/i, "")) || 1;
  const sid = `S${Math.max(1, Math.min(15, numericId))}`;

  const mission =
    missionDB.find((m) => m.id === numericId || m.sid === sid) ||
    missionDB[0];

  if (!mission) return null;

  const targetDiff = resolveAdaptiveDifficulty(mode, aiState);
  const bank =
    mission.bank?.[targetDiff] ||
    mission.bank?.normal ||
    mission.bank?.easy ||
    [];

  if (!bank.length) return null;

  const rng = seededRng(seed);
  const randomIndex = Math.floor(rng() * bank.length);
  const item = bank[randomIndex];

  return {
    ...item,
    _sessionId: mission.id,
    _sid: mission.sid,
    _sessionType: mission.type,
    _selectedDifficulty: targetDiff,
    _selectedCEFR: DIFFICULTY_META[targetDiff].cefr,
    _dataVersion: DATA_VERSION
  };
}

export function validateMissionDB() {
  const issues = [];
  let total = 0;

  missionDB.forEach((session) => {
    if (!session.id) issues.push(`${session.sid || "unknown"} missing id`);
    if (!session.type) issues.push(`${session.sid || "unknown"} missing type`);
    if (!session.bank) issues.push(`${session.sid || "unknown"} missing bank`);

    DIFFICULTY_ORDER.forEach((diff) => {
      const items = session.bank?.[diff];

      if (!Array.isArray(items)) {
        issues.push(`${session.sid}.${diff} is not an array`);
        return;
      }

      total += items.length;

      if (items.length !== 10) {
        issues.push(`${session.sid}.${diff} has ${items.length} items, expected 10`);
      }

      items.forEach((item, index) => {
        if (!item.id) issues.push(`${session.sid}.${diff}[${index}] missing id`);
        if (!item.skill && !item.type) issues.push(`${session.sid}.${diff}[${index}] missing skill/type`);
        if (!item.cefr) issues.push(`${session.sid}.${diff}[${index}] missing cefr`);
        if (item.cefr !== DIFFICULTY_META[diff].cefr) {
          issues.push(`${item.id} cefr=${item.cefr}, expected ${DIFFICULTY_META[diff].cefr}`);
        }
      });
    });
  });

  return {
    ok: issues.length === 0,
    version: DATA_VERSION,
    sessions: missionDB.length,
    difficultyLevels: DIFFICULTY_ORDER.length,
    itemsPerLevel: 10,
    expectedTotal: 15 * 4 * 10,
    total,
    issues
  };
}

try {
  window.DIFFICULTY_META = DIFFICULTY_META;
  window.DIFFICULTY_ORDER = DIFFICULTY_ORDER;
  window.SESSION_ROUTES = SESSION_ROUTES;
  window.missionDB = missionDB;
  window.LESSON_DATA = missionDB;
  window.LESSON_SESSIONS = missionDB;
  window.lessonData = lessonData;
  window.validateMissionDB = validateMissionDB;
} catch (err) {}
