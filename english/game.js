const lessons = [
  {
    id: 1,
    title: "Self-Introduction in Tech",
    shortTitle: "Intro",
    scene: "Company Lobby",
    npc: "Mina, HR Officer",
    brief: "Introduce yourself as a CS or AI student and make a confident first impression on your future team.",
    objectives: [
      "Introduce your name, major, and year of study.",
      "Share one career interest in CS or AI.",
      "Use polite professional greetings."
    ],
    vocabulary: ["major", "internship", "skill", "interest", "computer science", "artificial intelligence"],
    expressions: [
      "My name is ...",
      "I am a third-year student in ...",
      "I am interested in AI and software development."
    ],
    mission: "Meet Mina in the lobby and introduce yourself before joining the team workspace.",
    challenge: {
      prompt: "Which response sounds most professional in a first-day introduction?",
      options: [
        "Hey, I do computer stuff and I guess I am here for work.",
        "My name is Narin. I am a third-year Computer Science student interested in AI.",
        "You can call me whatever. I just want to see the office."
      ],
      correctIndex: 1
    }
  },
  {
    id: 2,
    title: "Academic Background and Projects",
    shortTitle: "Projects",
    scene: "Mentor Desk",
    npc: "Alex, Team Lead",
    brief: "Explain what you have studied and describe a project from university in clear English.",
    objectives: [
      "Describe a project and your role in it.",
      "Summarize a result or challenge.",
      "Use simple past and project vocabulary."
    ],
    vocabulary: ["project", "database", "interface", "team", "responsibility", "result"],
    expressions: [
      "I worked on a project about ...",
      "I was responsible for ...",
      "The main challenge was ..."
    ],
    mission: "Tell Alex about one academic project and highlight what you contributed.",
    challenge: {
      prompt: "Choose the clearest project summary.",
      options: [
        "My project was many things, so I do not know the details.",
        "I worked on a smart attendance app, and I designed the database and login flow.",
        "It was difficult, and everyone did random tasks."
      ],
      correctIndex: 1
    }
  },
  {
    id: 3,
    title: "Tech Jobs and Roles",
    shortTitle: "Roles",
    scene: "Career Map Hall",
    npc: "Career Bot",
    brief: "Match workplace responsibilities to the right CS and AI roles.",
    objectives: [
      "Recognize common job titles in tech.",
      "Explain what each role usually does.",
      "Use role-specific vocabulary."
    ],
    vocabulary: ["developer", "data analyst", "AI engineer", "QA tester", "frontend", "backend"],
    expressions: [
      "A QA tester checks ...",
      "An AI engineer builds ...",
      "This task belongs to ..."
    ],
    mission: "Assign incoming tasks to the correct specialist in the company.",
    challenge: {
      prompt: "Who is most responsible for training and improving a machine learning model?",
      options: ["AI engineer", "Receptionist", "Graphic printer"],
      correctIndex: 0
    }
  },
  {
    id: 4,
    title: "Daily Workplace Communication",
    shortTitle: "Small Talk",
    scene: "Open Office",
    npc: "June, Software Developer",
    brief: "Practice polite requests, greetings, and quick work conversations with teammates.",
    objectives: [
      "Use professional greetings.",
      "Ask for help politely.",
      "Respond to teammates in a friendly way."
    ],
    vocabulary: ["available", "support", "update", "help", "schedule", "meeting"],
    expressions: [
      "Could you help me with ...?",
      "Are you available this afternoon?",
      "Thanks for your support."
    ],
    mission: "Talk to June and arrange a time to review your first task.",
    challenge: {
      prompt: "Which sentence is the best polite request?",
      options: [
        "Fix this for me now.",
        "Could you help me review this function after lunch?",
        "Why are you not answering me?"
      ],
      correctIndex: 1
    }
  },
  {
    id: 5,
    title: "Emails and Chat Messages",
    shortTitle: "Email",
    scene: "Digital Communication Pod",
    npc: "Inbox Assistant",
    brief: "Write professional messages that are clear, concise, and respectful.",
    objectives: [
      "Write a clear subject line.",
      "Mention deadlines and attachments correctly.",
      "Use an appropriate closing."
    ],
    vocabulary: ["subject", "deadline", "attachment", "follow-up", "regards", "confirm"],
    expressions: [
      "Please find the attached file.",
      "Could you confirm by Friday?",
      "Best regards,"
    ],
    mission: "Reply to your team lead with a short status email about your assigned task.",
    challenge: {
      prompt: "Which closing works best in a professional email?",
      options: ["See ya", "Best regards,", "Whatever"],
      correctIndex: 1
    }
  },
  {
    id: 6,
    title: "Meetings and Scheduling",
    shortTitle: "Meetings",
    scene: "Conference Room",
    npc: "Alex, Team Lead",
    brief: "Join a team meeting, propose a time, and confirm the agenda.",
    objectives: [
      "Suggest a meeting time.",
      "Confirm the agenda.",
      "Respond to schedule changes politely."
    ],
    vocabulary: ["agenda", "available", "reschedule", "calendar", "confirm", "discussion"],
    expressions: [
      "Are you available at 2 p.m.?",
      "Let us confirm the agenda.",
      "Could we reschedule the meeting?"
    ],
    mission: "Coordinate a meeting for a feature review with your team.",
    challenge: {
      prompt: "Which sentence clearly confirms a meeting?",
      options: [
        "Okay, maybe some time.",
        "The meeting is confirmed for Tuesday at 2 p.m.",
        "I think there is a meeting somewhere."
      ],
      correctIndex: 1
    }
  },
  {
    id: 7,
    title: "Explaining a System",
    shortTitle: "Systems",
    scene: "Product Demo Lab",
    npc: "Sara, Product Manager",
    brief: "Describe software features, inputs, outputs, and user benefits in simple language.",
    objectives: [
      "Explain how a system works.",
      "Describe key features and outputs.",
      "Use simple technical explanations."
    ],
    vocabulary: ["input", "output", "feature", "function", "user", "interface"],
    expressions: [
      "The system receives ...",
      "The main feature is ...",
      "The output shows ..."
    ],
    mission: "Present a simple app workflow to Sara before the product demo.",
    challenge: {
      prompt: "Which explanation is the clearest?",
      options: [
        "The app does app things when users do stuff.",
        "The system takes user input, processes it, and shows a personalized result.",
        "It is difficult to explain, but it works somehow."
      ],
      correctIndex: 1
    }
  },
  {
    id: 8,
    title: "Describing Problems and Bugs",
    shortTitle: "Bugs",
    scene: "QA Response Center",
    npc: "Mira, QA Tester",
    brief: "Report bugs accurately so the team can reproduce and solve them quickly.",
    objectives: [
      "Describe what happened.",
      "Explain how to reproduce the issue.",
      "Mention impact and urgency."
    ],
    vocabulary: ["bug", "issue", "error", "crash", "reproduce", "impact"],
    expressions: [
      "I found a bug when ...",
      "The issue happens after ...",
      "It affects the login page."
    ],
    mission: "Log a bug report for a crashing feature and brief the QA team.",
    challenge: {
      prompt: "Which sentence best helps a teammate reproduce a bug?",
      options: [
        "The app is broken.",
        "The page crashes after the user clicks Submit without filling the email field.",
        "Please check everything."
      ],
      correctIndex: 1
    }
  },
  {
    id: 9,
    title: "Team Collaboration",
    shortTitle: "Stand-up",
    scene: "Agile Circle",
    npc: "Scrum Bot",
    brief: "Join a daily stand-up and share progress, blockers, and next steps.",
    objectives: [
      "Give a progress update.",
      "Describe blockers clearly.",
      "State the next action item."
    ],
    vocabulary: ["progress", "blocked", "complete", "next step", "collaboration", "task"],
    expressions: [
      "I completed ...",
      "I am currently working on ...",
      "I am blocked by ..."
    ],
    mission: "Deliver a stand-up update to your cross-functional team.",
    challenge: {
      prompt: "Which update fits a stand-up meeting best?",
      options: [
        "I did many things, and that is all.",
        "Yesterday I fixed the login bug, today I will test the dashboard, and I am blocked by API access.",
        "Nothing to report."
      ],
      correctIndex: 1
    }
  },
  {
    id: 10,
    title: "Client Communication",
    shortTitle: "Clients",
    scene: "Client Brief Room",
    npc: "Sara, Client Representative",
    brief: "Translate technical ideas into business-friendly explanations for non-technical listeners.",
    objectives: [
      "Avoid unnecessary jargon.",
      "Explain benefits clearly.",
      "Respond politely to client questions."
    ],
    vocabulary: ["client", "requirement", "benefit", "user needs", "solution", "simple terms"],
    expressions: [
      "This feature helps users ...",
      "In simple terms, ...",
      "The benefit for your team is ..."
    ],
    mission: "Explain a recommendation system to Sara without using heavy technical jargon.",
    challenge: {
      prompt: "Which explanation suits a non-technical client?",
      options: [
        "We use cosine similarity and embeddings because transformer vectors are powerful.",
        "The system recommends items by finding patterns in user behavior.",
        "It is too technical to explain."
      ],
      correctIndex: 1
    }
  },
  {
    id: 11,
    title: "Data and AI Communication",
    shortTitle: "AI Report",
    scene: "AI Lab",
    npc: "Ken, AI Engineer",
    brief: "Present a dataset, model, result, and ethical consideration in a professional way.",
    objectives: [
      "Describe a dataset and training process.",
      "Report a result such as accuracy.",
      "Mention ethical concerns such as bias."
    ],
    vocabulary: ["dataset", "training", "accuracy", "bias", "model", "evaluation"],
    expressions: [
      "The model was trained on ...",
      "The accuracy reached ...",
      "We should consider bias in ..."
    ],
    mission: "Brief Ken on the outcome of an AI experiment and highlight one ethical risk.",
    challenge: {
      prompt: "Which statement is most suitable in an AI report?",
      options: [
        "The model is amazing and perfect.",
        "The model reached 91 percent accuracy, but we still need to check for bias in the dataset.",
        "AI solved everything."
      ],
      correctIndex: 1
    }
  },
  {
    id: 12,
    title: "CV and Portfolio Language",
    shortTitle: "Portfolio",
    scene: "Career Studio",
    npc: "Career Bot",
    brief: "Strengthen your CV and portfolio with concise action-oriented language.",
    objectives: [
      "Write achievement-focused descriptions.",
      "Use strong action verbs.",
      "Present responsibilities clearly."
    ],
    vocabulary: ["achievement", "portfolio", "responsibility", "developed", "improved", "implemented"],
    expressions: [
      "I developed ...",
      "I improved ...",
      "I was responsible for ..."
    ],
    mission: "Rewrite a weak portfolio description into a stronger, career-ready statement.",
    challenge: {
      prompt: "Which line is best for a CV?",
      options: [
        "Did some coding in a class project.",
        "Developed a web-based attendance system using Python and SQL for 120 student records.",
        "Tried a few tools."
      ],
      correctIndex: 1
    }
  },
  {
    id: 13,
    title: "Job Interview Simulation",
    shortTitle: "Interview",
    scene: "Interview Chamber",
    npc: "Interviewer Bot",
    brief: "Prepare for interview questions and answer with confidence, relevance, and professionalism.",
    objectives: [
      "Introduce yourself clearly.",
      "Explain why you want the role.",
      "Give examples from study or projects."
    ],
    vocabulary: ["strength", "weakness", "experience", "motivation", "teamwork", "goal"],
    expressions: [
      "One of my strengths is ...",
      "I want this role because ...",
      "I learned that ..."
    ],
    mission: "Respond to an interview question about your strengths and career goals.",
    challenge: {
      prompt: "Which answer is strongest in an interview?",
      options: [
        "I just need any job.",
        "My strength is problem-solving, and I enjoy building useful tools with AI and software.",
        "I do not really know why I am here."
      ],
      correctIndex: 1
    }
  },
  {
    id: 14,
    title: "Project Pitch and Demo",
    shortTitle: "Pitch",
    scene: "Demo Day Stage",
    npc: "Innovation Panel",
    brief: "Pitch a project with a clear objective, method, result, and limitation.",
    objectives: [
      "Present a project structure clearly.",
      "Explain the main value of the solution.",
      "Acknowledge one limitation professionally."
    ],
    vocabulary: ["objective", "method", "result", "limitation", "impact", "demo"],
    expressions: [
      "The objective of this project is ...",
      "Our method uses ...",
      "One limitation is ..."
    ],
    mission: "Pitch your capstone prototype to the panel in a short demo presentation.",
    challenge: {
      prompt: "Which structure works best for a project pitch?",
      options: [
        "Objective, method, result, limitation",
        "Random details and then a joke",
        "Only technical code without purpose"
      ],
      correctIndex: 0
    }
  },
  {
    id: 15,
    title: "Capstone Career Mission",
    shortTitle: "Capstone",
    scene: "Innovation Command Deck",
    npc: "Executive Board",
    brief: "Combine all communication skills in one integrated professional mission from client brief to final presentation.",
    objectives: [
      "Handle a client brief and internal meeting.",
      "Report a problem and propose a solution.",
      "Present the final outcome professionally."
    ],
    vocabulary: ["brief", "proposal", "milestone", "delivery", "presentation", "solution"],
    expressions: [
      "Based on the client brief ...",
      "Our next milestone is ...",
      "Here is our final recommendation."
    ],
    mission: "Receive requirements, align with the team, resolve a technical issue, and deliver the final presentation.",
    challenge: {
      prompt: "Which response shows full professional readiness?",
      options: [
        "We will just do something and hope it works.",
        "Based on the client brief, our team will deliver a prototype, report risks, and present the final recommendation on Friday.",
        "I think the team can decide without me."
      ],
      correctIndex: 1
    }
  }
];

const state = {
  score: 0,
  completedLessons: new Set(),
  currentLessonId: 1
};

const cameraPoints = {
  hub: "0 1.6 8"
};

lessons.forEach((lesson) => {
  const angle = ((lesson.id - 1) / lessons.length) * Math.PI * 2;
  const radius = 20;
  const x = Math.cos(angle) * radius;
  const z = -12 + Math.sin(angle) * radius;
  cameraPoints[`lesson-${lesson.id}`] = `${x.toFixed(2)} 1.6 ${(z + 5).toFixed(2)}`;
});

const completedValue = document.getElementById("completedValue");
const scoreValue = document.getElementById("scoreValue");
const rankValue = document.getElementById("rankValue");
const progressFill = document.getElementById("progressFill");
const messageBox = document.getElementById("messageBox");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const homeButton = document.getElementById("homeButton");
const nextButton = document.getElementById("nextButton");
const summaryButton = document.getElementById("summaryButton");
const closeSummaryButton = document.getElementById("closeSummaryButton");
const summarySheet = document.getElementById("summarySheet");
const rig = document.getElementById("rig");
const lessonPortals = document.getElementById("lessonPortals");

const lessonTag = document.getElementById("lessonTag");
const lessonTitle = document.getElementById("lessonTitle");
const lessonStatus = document.getElementById("lessonStatus");
const lessonScene = document.getElementById("lessonScene");
const lessonBrief = document.getElementById("lessonBrief");
const objectiveList = document.getElementById("objectiveList");
const vocabList = document.getElementById("vocabList");
const expressionList = document.getElementById("expressionList");
const missionText = document.getElementById("missionText");
const challengePrompt = document.getElementById("challengePrompt");
const answerList = document.getElementById("answerList");

const summaryIntro = document.getElementById("summaryIntro");
const summaryScore = document.getElementById("summaryScore");
const summaryCompleted = document.getElementById("summaryCompleted");
const summaryRank = document.getElementById("summaryRank");
const summarySkills = document.getElementById("summarySkills");
const summaryNextSteps = document.getElementById("summaryNextSteps");

function getLessonById(lessonId) {
  return lessons.find((lesson) => lesson.id === lessonId) || lessons[0];
}

function getRank() {
  const completed = state.completedLessons.size;
  if (completed >= 15) return "Junior Professional";
  if (completed >= 12) return "Interview Ready";
  if (completed >= 8) return "Team Communicator";
  if (completed >= 4) return "Active Intern";
  return "Intern";
}

function isLessonUnlocked(lessonId) {
  return lessonId === 1 || state.completedLessons.has(lessonId - 1);
}

function setMessage(text) {
  messageBox.textContent = text;
}

function moveTo(pointKey) {
  rig.setAttribute("position", cameraPoints[pointKey] || cameraPoints.hub);
}

function updateHud() {
  const completed = state.completedLessons.size;
  completedValue.textContent = `${completed} / 15`;
  scoreValue.textContent = String(state.score);
  rankValue.textContent = getRank();
  progressFill.style.width = `${(completed / lessons.length) * 100}%`;
}

function renderSummary() {
  const completed = state.completedLessons.size;
  const practicedSkills = [
    "Professional self-introduction",
    "Project explanation",
    "Meetings and scheduling",
    "Bug reporting",
    "Client-friendly communication",
    "AI result presentation",
    "Interview and project pitch"
  ];
  const nextSteps = [
    "Repeat unfinished missions and compare scores.",
    "Use each mission as a class speaking prompt.",
    "Add voice recording or teacher rubric for live assessment.",
    "Use lesson 15 as the final VR performance task."
  ];

  summaryIntro.textContent = completed === lessons.length
    ? "You cleared all 15 missions and completed the full career communication pathway."
    : "This prototype is ready for classroom walkthroughs, replay, and progressive lesson delivery.";
  summaryScore.textContent = String(state.score);
  summaryCompleted.textContent = `${completed} / 15`;
  summaryRank.textContent = getRank();
  summarySkills.innerHTML = practicedSkills.map((item) => `<li>${item}</li>`).join("");
  summaryNextSteps.innerHTML = nextSteps.map((item) => `<li>${item}</li>`).join("");
}

function openSummary() {
  renderSummary();
  summarySheet.classList.remove("hidden");
}

function closeSummary() {
  summarySheet.classList.add("hidden");
}

function refreshPortalStates() {
  lessons.forEach((lesson) => {
    const portal = document.querySelector(`[data-lesson-id="${lesson.id}"]`);
    if (!portal) return;

    const frame = portal.querySelector(".portal-frame");
    const glow = portal.querySelector(".portal-glow");
    const badge = portal.querySelector(".portal-badge");
    const unlocked = isLessonUnlocked(lesson.id);
    const completed = state.completedLessons.has(lesson.id);

    if (completed) {
      frame.setAttribute("color", "#3dd9b8");
      glow.setAttribute("color", "#3dd9b8");
      badge.setAttribute("value", "Cleared");
      badge.setAttribute("color", "#3dd9b8");
      return;
    }

    if (unlocked) {
      frame.setAttribute("color", "#f4b942");
      glow.setAttribute("color", "#f4b942");
      badge.setAttribute("value", "Ready");
      badge.setAttribute("color", "#f4b942");
      return;
    }

    frame.setAttribute("color", "#44566f");
    glow.setAttribute("color", "#44566f");
    badge.setAttribute("value", "Locked");
    badge.setAttribute("color", "#8aa0b8");
  });
}

function renderLesson(lessonId) {
  const lesson = getLessonById(lessonId);
  state.currentLessonId = lesson.id;

  const unlocked = isLessonUnlocked(lesson.id);
  const completed = state.completedLessons.has(lesson.id);

  lessonTag.textContent = `Lesson ${lesson.id}`;
  lessonTitle.textContent = lesson.title;
  lessonScene.textContent = `Scene: ${lesson.scene} | NPC: ${lesson.npc}`;
  lessonBrief.textContent = lesson.brief;
  objectiveList.innerHTML = lesson.objectives.map((item) => `<li>${item}</li>`).join("");
  vocabList.innerHTML = lesson.vocabulary.map((word) => `<span class="chip">${word}</span>`).join("");
  expressionList.innerHTML = lesson.expressions.map((item) => `<li>${item}</li>`).join("");
  missionText.textContent = lesson.mission;
  challengePrompt.textContent = lesson.challenge.prompt;

  if (!unlocked) {
    lessonStatus.textContent = "Locked";
    answerList.innerHTML = '<button class="answer-button disabled" disabled>Complete the previous lesson to unlock this mission.</button>';
    setMessage(`Lesson ${lesson.id} is still locked. Complete Lesson ${lesson.id - 1} first.`);
  } else if (completed) {
    lessonStatus.textContent = "Completed";
    answerList.innerHTML = lesson.challenge.options
      .map((option, index) => `<button class="answer-button completed" data-option-index="${index}">${option}</button>`)
      .join("");
    setMessage(`Lesson ${lesson.id} already cleared. You can revisit it or move to the next mission.`);
  } else {
    lessonStatus.textContent = "Ready";
    answerList.innerHTML = lesson.challenge.options
      .map((option, index) => `<button class="answer-button" data-option-index="${index}">${option}</button>`)
      .join("");
    setMessage(`Lesson ${lesson.id}: ${lesson.title}. Read the briefing and clear the challenge checkpoint.`);
  }

  moveTo(`lesson-${lesson.id}`);
}

function completeLesson(lesson) {
  if (state.completedLessons.has(lesson.id)) {
    setMessage(`Lesson ${lesson.id} was already completed.`);
    return;
  }

  state.completedLessons.add(lesson.id);
  state.score += 100;
  updateHud();
  refreshPortalStates();
  renderLesson(lesson.id);

  if (lesson.id === lessons.length) {
    setMessage("Capstone complete. The full 15-lesson VR career pathway is now finished.");
    openSummary();
    return;
  }

  setMessage(`Mission clear. Lesson ${lesson.id + 1} is now unlocked.`);
}

function handleAnswer(event) {
  const button = event.target.closest(".answer-button");
  if (!button || button.classList.contains("disabled")) {
    return;
  }

  const lesson = getLessonById(state.currentLessonId);
  if (!isLessonUnlocked(lesson.id)) {
    return;
  }

  if (state.completedLessons.has(lesson.id)) {
    setMessage(`Lesson ${lesson.id} is already completed. Use Next Lesson to continue.`);
    return;
  }

  const selectedIndex = Number(button.dataset.optionIndex);
  if (selectedIndex === lesson.challenge.correctIndex) {
    button.classList.add("correct");
    completeLesson(lesson);
    return;
  }

  button.classList.add("wrong");
  setMessage("ยังไม่ผ่าน checkpoint นี้ ลองเลือกคาตอบที่ชัดเจนและเป็นมืออาชีพมากขึ้น");
}

function moveToHub() {
  moveTo("hub");
  setMessage("Career Hub พร้อมแล้ว เลือก lesson ที่ต้องการจาก portal รอบวงแหวน");
}

function goToNextLesson() {
  const nextUnlocked = lessons.find((lesson) => isLessonUnlocked(lesson.id) && !state.completedLessons.has(lesson.id));
  if (nextUnlocked) {
    renderLesson(nextUnlocked.id);
    return;
  }

  if (state.completedLessons.size === lessons.length) {
    openSummary();
    return;
  }

  renderLesson(state.currentLessonId);
}

function createPortal(lesson) {
  const angle = ((lesson.id - 1) / lessons.length) * Math.PI * 2;
  const radius = 20;
  const x = Math.cos(angle) * radius;
  const z = -12 + Math.sin(angle) * radius;
  const hue = 190 + lesson.id * 7;
  const frameColor = `hsl(${hue} 85% 58%)`;
  const label = `L${lesson.id}\\n${lesson.shortTitle}`;

  const portal = document.createElement("a-entity");
  portal.setAttribute("position", `${x.toFixed(2)} 0 ${z.toFixed(2)}`);
  portal.setAttribute("data-lesson-id", String(lesson.id));
  portal.classList.add("clickable");

  const base = document.createElement("a-cylinder");
  base.setAttribute("color", "#132338");
  base.setAttribute("radius", "1.8");
  base.setAttribute("height", "0.25");
  base.setAttribute("position", "0 0.12 0");

  const frame = document.createElement("a-box");
  frame.setAttribute("class", "portal-frame");
  frame.setAttribute("color", frameColor);
  frame.setAttribute("depth", "0.45");
  frame.setAttribute("height", "3.6");
  frame.setAttribute("width", "2.7");
  frame.setAttribute("position", "0 1.9 0");

  const glow = document.createElement("a-torus");
  glow.setAttribute("class", "portal-glow");
  glow.setAttribute("color", frameColor);
  glow.setAttribute("radius", "1.7");
  glow.setAttribute("radius-tubular", "0.07");
  glow.setAttribute("rotation", "90 0 0");
  glow.setAttribute("position", "0 2 0.28");

  const titleText = document.createElement("a-text");
  titleText.setAttribute("value", label);
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#f5f7ff");
  titleText.setAttribute("width", "6");
  titleText.setAttribute("position", "0 2.05 0.3");

  const badge = document.createElement("a-text");
  badge.setAttribute("class", "portal-badge");
  badge.setAttribute("value", "Ready");
  badge.setAttribute("align", "center");
  badge.setAttribute("color", "#f4b942");
  badge.setAttribute("width", "5");
  badge.setAttribute("position", "0 0.7 0.3");

  portal.appendChild(base);
  portal.appendChild(frame);
  portal.appendChild(glow);
  portal.appendChild(titleText);
  portal.appendChild(badge);
  portal.addEventListener("click", () => {
    if (!isLessonUnlocked(lesson.id)) {
      setMessage(`Lesson ${lesson.id} is locked. Complete Lesson ${lesson.id - 1} first.`);
      return;
    }
    renderLesson(lesson.id);
  });

  lessonPortals.appendChild(portal);
}

function initPortals() {
  lessons.forEach(createPortal);
  refreshPortalStates();
}

startButton.addEventListener("click", () => {
  overlay.classList.add("hidden");
  updateHud();
  initPortals();
  renderLesson(1);
});

homeButton.addEventListener("click", moveToHub);
nextButton.addEventListener("click", goToNextLesson);
summaryButton.addEventListener("click", openSummary);
closeSummaryButton.addEventListener("click", closeSummary);
answerList.addEventListener("click", handleAnswer);

updateHud();
moveToHub();
