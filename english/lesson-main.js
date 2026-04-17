// lesson-main.js
// FULL SESSION FLOW PATCH
// ใช้ร่วมกับ:
// - ./lesson-data.js
// - ./lesson-runtime.js

import { missionDB } from "./lesson-data.js";
import {
  getSessionMeta,
  buildSessionRun,
  evaluateMissionAnswer,
  summarizeSessionResult,
  saveSessionProgress,
  loadProgress,
  isSessionUnlocked,
  normalizeEnglish
} from "./lesson-runtime.js";

/* =========================================================
 * STATE
 * ========================================================= */

const state = {
  initialized: false,
  score: 0,
  currentSessionId: 1,
  currentRun: [],
  currentStepIndex: 0,
  currentResults: [],
  currentSeed: "",
  currentMode: "normal",
  aiState: {
    pressure: 0,
    support: 0
  },
  currentTranscript: "",
  speakingActive: false
};

const TOTAL_SESSIONS = missionDB.length;

/* =========================================================
 * CAMERA / MAP
 * ========================================================= */

const cameraPoints = {
  hub: "0 1.6 8"
};

missionDB.forEach((mission) => {
  const angle = ((mission.id - 1) / TOTAL_SESSIONS) * Math.PI * 2;
  const radius = 20;
  const x = Math.cos(angle) * radius;
  const z = -12 + Math.sin(angle) * radius;
  cameraPoints[`session-${mission.id}`] = `${x.toFixed(2)} 1.6 ${(z + 5).toFixed(2)}`;
});

/* =========================================================
 * DOM
 * ========================================================= */

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

/* =========================================================
 * SPEECH / AUDIO
 * ========================================================= */

const SpeechRecognitionClass =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

let activeRecognition = null;

function speakText(text) {
  if (!("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = "en-US";
    utter.rate = 0.92;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn("speechSynthesis error", err);
  }
}

function stopSpeechCapture() {
  try {
    if (activeRecognition) {
      activeRecognition.onend = null;
      activeRecognition.stop();
      activeRecognition = null;
    }
  } catch (err) {
    console.warn("stopSpeechCapture error", err);
  }
  state.speakingActive = false;
}

function startSpeechCapture(onUpdate, onDone) {
  if (!SpeechRecognitionClass) return false;

  stopSpeechCapture();

  try {
    const rec = new SpeechRecognitionClass();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    state.currentTranscript = "";
    state.speakingActive = true;

    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      state.currentTranscript = text.trim();
      if (typeof onUpdate === "function") onUpdate(state.currentTranscript);
    };

    rec.onerror = (event) => {
      console.warn("speech recognition error", event?.error);
      state.speakingActive = false;
      if (typeof onDone === "function") onDone(state.currentTranscript || "");
    };

    rec.onend = () => {
      state.speakingActive = false;
      activeRecognition = null;
      if (typeof onDone === "function") onDone(state.currentTranscript || "");
    };

    activeRecognition = rec;
    rec.start();
    return true;
  } catch (err) {
    console.warn("startSpeechCapture error", err);
    state.speakingActive = false;
    return false;
  }
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function setMessage(text) {
  if (messageBox) messageBox.textContent = text;
}

function moveTo(pointKey) {
  if (!rig) return;
  rig.setAttribute("position", cameraPoints[pointKey] || cameraPoints.hub);
}

function getProgress() {
  return loadProgress();
}

function getPassedCount() {
  const progress = getProgress();
  return Object.values(progress).filter((item) => item?.passed).length;
}

function getTotalStars() {
  const progress = getProgress();
  return Object.values(progress).reduce((sum, item) => sum + (item?.bestStars || 0), 0);
}

function computeScoreFromProgress() {
  const progress = getProgress();
  return Object.values(progress).reduce((sum, item) => {
    const correctPart = Number(item?.bestCorrect || 0) * 10;
    const starPart = Number(item?.bestStars || 0) * 50;
    return sum + correctPart + starPart;
  }, 0);
}

function getRank() {
  const completed = getPassedCount();
  if (completed >= 15) return "Junior Professional";
  if (completed >= 12) return "Interview Ready";
  if (completed >= 8) return "Team Communicator";
  if (completed >= 4) return "Active Intern";
  return "Intern";
}

function getShortTitle(meta) {
  if (!meta?.title) return "Session";
  const parts = meta.title.split(":");
  return (parts[1] || meta.title).trim();
}

function stageLabel(stage) {
  if (stage === "warmup") return "Warm-up";
  if (stage === "boss") return "Boss";
  return "Main";
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function capitalize(str) {
  const s = String(str || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getCurrentItem() {
  return state.currentRun[state.currentStepIndex] || null;
}

function getNextUnlockedSessionId() {
  for (let id = 1; id <= TOTAL_SESSIONS; id++) {
    if (isSessionUnlocked(id)) {
      const progress = getProgress();
      if (!progress[id]?.passed) return id;
    }
  }
  return TOTAL_SESSIONS;
}

/* =========================================================
 * HUD / SUMMARY
 * ========================================================= */

function updateHud() {
  const completed = getPassedCount();
  state.score = computeScoreFromProgress();

  if (completedValue) completedValue.textContent = `${completed} / ${TOTAL_SESSIONS}`;
  if (scoreValue) scoreValue.textContent = String(state.score);
  if (rankValue) rankValue.textContent = getRank();
  if (progressFill) progressFill.style.width = `${(completed / TOTAL_SESSIONS) * 100}%`;
}

function renderSummary() {
  const progress = getProgress();
  const completed = getPassedCount();
  const totalStars = getTotalStars();
  const allCleared = completed === TOTAL_SESSIONS;

  if (summaryIntro) {
    summaryIntro.textContent = allCleared
      ? "You cleared all 15 sessions and completed the full A2 career English pathway."
      : "Keep going. Clear each session, earn stars, and unlock the next mission.";
  }

  if (summaryScore) summaryScore.textContent = String(computeScoreFromProgress());
  if (summaryCompleted) summaryCompleted.textContent = `${completed} / ${TOTAL_SESSIONS}`;
  if (summaryRank) summaryRank.textContent = `${getRank()} • ${totalStars} stars`;

  const sessionLines = [];
  for (let id = 1; id <= TOTAL_SESSIONS; id++) {
    const meta = getSessionMeta(id);
    const p = progress[id];
    if (!p) {
      sessionLines.push(`<li>S${id} • ${escapeHtml(getShortTitle(meta))} — not played yet</li>`);
      continue;
    }
    const stars = "★".repeat(p.bestStars || 0) || "—";
    const status = p.passed ? "cleared" : "practice";
    sessionLines.push(
      `<li>S${id} • ${escapeHtml(getShortTitle(meta))} — ${status} • ${p.bestCorrect || 0}/15 • ${stars}</li>`
    );
  }

  if (summarySkills) {
    summarySkills.innerHTML = sessionLines.join("");
  }

  const tips = [
    completed < TOTAL_SESSIONS
      ? `Go to S${Math.min(completed + 1, TOTAL_SESSIONS)} next.`
      : "Replay the sessions where you still have fewer than 3 stars.",
    "Use speaking sessions to practice pronunciation aloud.",
    "Use writing sessions to improve short professional English answers.",
    "Use reading and listening sessions for quick accuracy training."
  ];

  if (summaryNextSteps) {
    summaryNextSteps.innerHTML = tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  }
}

function openSummary() {
  renderSummary();
  if (summarySheet) summarySheet.classList.remove("hidden");
}

function closeSummary() {
  if (summarySheet) summarySheet.classList.add("hidden");
}

/* =========================================================
 * PORTALS
 * ========================================================= */

function refreshPortalStates() {
  const progress = getProgress();

  missionDB.forEach((mission) => {
    const portal = document.querySelector(`[data-session-id="${mission.id}"]`);
    if (!portal) return;

    const frame = portal.querySelector(".portal-frame");
    const glow = portal.querySelector(".portal-glow");
    const badge = portal.querySelector(".portal-badge");

    const unlocked = isSessionUnlocked(mission.id);
    const passed = !!progress[mission.id]?.passed;
    const stars = progress[mission.id]?.bestStars || 0;

    if (passed) {
      frame?.setAttribute("color", "#3dd9b8");
      glow?.setAttribute("color", "#3dd9b8");
      badge?.setAttribute("value", `Cleared ${"★".repeat(stars) || ""}`.trim());
      badge?.setAttribute("color", "#3dd9b8");
      return;
    }

    if (unlocked) {
      frame?.setAttribute("color", "#f4b942");
      glow?.setAttribute("color", "#f4b942");
      badge?.setAttribute("value", "Ready");
      badge?.setAttribute("color", "#f4b942");
      return;
    }

    frame?.setAttribute("color", "#44566f");
    glow?.setAttribute("color", "#44566f");
    badge?.setAttribute("value", "Locked");
    badge?.setAttribute("color", "#8aa0b8");
  });
}

function createPortal(mission) {
  const meta = getSessionMeta(mission.id);
  const angle = ((mission.id - 1) / TOTAL_SESSIONS) * Math.PI * 2;
  const radius = 20;
  const x = Math.cos(angle) * radius;
  const z = -12 + Math.sin(angle) * radius;
  const hue = 190 + mission.id * 7;
  const frameColor = `hsl(${hue} 85% 58%)`;
  const label = `S${mission.id}\\n${getShortTitle(meta)}`;

  const portal = document.createElement("a-entity");
  portal.setAttribute("position", `${x.toFixed(2)} 0 ${z.toFixed(2)}`);
  portal.setAttribute("data-session-id", String(mission.id));
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
    if (!isSessionUnlocked(mission.id)) {
      setMessage(`S${mission.id} is locked. Clear S${mission.id - 1} first.`);
      return;
    }
    renderSessionOverview(mission.id);
  });

  lessonPortals?.appendChild(portal);
}

function initPortals() {
  if (!lessonPortals || state.initialized) return;
  missionDB.forEach(createPortal);
  refreshPortalStates();
  state.initialized = true;
}

/* =========================================================
 * OVERVIEW
 * ========================================================= */

function renderSessionOverview(sessionId) {
  const meta = getSessionMeta(sessionId);
  const progress = getProgress()[sessionId];
  const unlocked = isSessionUnlocked(sessionId);

  if (!meta) return;

  state.currentSessionId = sessionId;

  if (lessonTag) lessonTag.textContent = `S${meta.id} • ${capitalize(meta.type)}`;
  if (lessonTitle) lessonTitle.textContent = meta.title;
  if (lessonScene) lessonScene.textContent = `Scene: ${meta.scene} | NPC: ${meta.npc}`;
  if (lessonBrief) lessonBrief.textContent = meta.brief;
  if (objectiveList) {
    objectiveList.innerHTML = meta.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }
  if (vocabList) {
    vocabList.innerHTML = meta.vocabulary.map((word) => `<span class="chip">${escapeHtml(word)}</span>`).join("");
  }
  if (expressionList) {
    expressionList.innerHTML = meta.expressions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  if (!unlocked) {
    if (lessonStatus) lessonStatus.textContent = "Locked";
    if (missionText) missionText.textContent = "Clear the previous session first.";
    if (challengePrompt) challengePrompt.textContent = "This session is not unlocked yet.";
    if (answerList) {
      answerList.innerHTML = `
        <button class="answer-button disabled" disabled>
          Complete the previous session to unlock this one.
        </button>
      `;
    }
    setMessage(`S${sessionId} is locked. Clear S${sessionId - 1} first.`);
    moveTo(`session-${sessionId}`);
    return;
  }

  const bestCorrect = progress?.bestCorrect || 0;
  const bestStars = progress?.bestStars || 0;
  const passed = !!progress?.passed;

  if (lessonStatus) {
    lessonStatus.textContent = passed
      ? `Completed • ${bestCorrect}/15 • ${"★".repeat(bestStars) || ""}`.trim()
      : "Ready";
  }

  if (missionText) {
    missionText.textContent = "Flow: Warm-up (5) → Main (5) → Boss (5). Pass rule: at least 10 correct and 3 boss correct.";
  }

  if (challengePrompt) {
    challengePrompt.textContent = `Type: ${capitalize(meta.type)} • Start session when you are ready.`;
  }

  if (answerList) {
    answerList.innerHTML = `
      <div class="session-overview-actions">
        <button id="playSessionBtn" class="answer-button">${passed ? "Replay Session" : "Start Session"}</button>
        <button id="previewModeBtn" class="answer-button">Mode: ${escapeHtml(state.currentMode)}</button>
      </div>
      <div class="session-overview-note">
        <p>${passed ? "You can replay this session to improve your score and stars." : "Clear this session to unlock the next one."}</p>
      </div>
    `;

    const playBtn = document.getElementById("playSessionBtn");
    const previewModeBtn = document.getElementById("previewModeBtn");

    playBtn?.addEventListener("click", () => startSession(sessionId));

    previewModeBtn?.addEventListener("click", () => {
      state.currentMode =
        state.currentMode === "easy"
          ? "normal"
          : state.currentMode === "normal"
            ? "hard"
            : "easy";
      renderSessionOverview(sessionId);
    });
  }

  setMessage(`S${sessionId}: ${meta.title}. Ready to start.`);
  moveTo(`session-${sessionId}`);
}

/* =========================================================
 * SESSION PLAY
 * ========================================================= */

function startSession(sessionId) {
  if (!isSessionUnlocked(sessionId)) {
    setMessage(`S${sessionId} is locked.`);
    return;
  }

  stopSpeechCapture();

  state.currentSessionId = sessionId;
  state.currentStepIndex = 0;
  state.currentResults = [];
  state.currentTranscript = "";
  state.currentSeed = `S${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  state.currentRun = buildSessionRun(
    sessionId,
    state.currentMode,
    state.aiState,
    state.currentSeed
  );

  if (!state.currentRun.length) {
    setMessage("No items found for this session.");
    return;
  }

  renderCurrentStep();
}

function renderCurrentStep() {
  stopSpeechCapture();

  const meta = getSessionMeta(state.currentSessionId);
  const item = getCurrentItem();

  if (!meta || !item) {
    finishSession();
    return;
  }

  const step = state.currentStepIndex + 1;
  const total = state.currentRun.length;

  if (lessonTag) {
    lessonTag.textContent = `S${meta.id} • ${capitalize(meta.type)} • ${stageLabel(item._stage)}`;
  }
  if (lessonTitle) lessonTitle.textContent = meta.title;
  if (lessonStatus) {
    lessonStatus.textContent = `In Progress • ${step}/${total} • ${item._difficulty}`;
  }
  if (lessonScene) lessonScene.textContent = `Scene: ${meta.scene} | NPC: ${meta.npc}`;
  if (lessonBrief) lessonBrief.textContent = meta.brief;

  if (objectiveList) {
    objectiveList.innerHTML = meta.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }
  if (vocabList) {
    vocabList.innerHTML = meta.vocabulary.map((word) => `<span class="chip">${escapeHtml(word)}</span>`).join("");
  }
  if (expressionList) {
    expressionList.innerHTML = meta.expressions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  if (missionText) {
    missionText.textContent = `${stageLabel(item._stage)} • Item ${step} of ${total} • Difficulty: ${item._difficulty}`;
  }

  if (challengePrompt) {
    if (item.type) {
      challengePrompt.textContent = item.desc || "Complete this task.";
    } else if (item.question) {
      challengePrompt.textContent = item.question;
    } else if (item.audioText) {
      challengePrompt.textContent = "Listen and choose the best answer.";
    } else if (item.prompt) {
      challengePrompt.textContent = item.prompt;
    } else {
      challengePrompt.textContent = item.desc || "Complete this task.";
    }
  }

  if (!answerList) return;

  if (meta.type === "reading") {
    renderChoiceTask(item, "reading");
  } else if (meta.type === "listening") {
    renderListeningTask(item);
  } else if (meta.type === "writing") {
    renderWritingTask(item);
  } else if (meta.type === "speaking") {
    renderSpeakingTask(item);
  } else {
    answerList.innerHTML = `<button class="answer-button disabled" disabled>Unsupported session type</button>`;
  }

  moveTo(`session-${state.currentSessionId}`);
}

function renderChoiceTask(item, mode) {
  if (!answerList) return;

  const promptText = item.question || item.desc || "Choose the best answer.";

  answerList.innerHTML = `
    <div class="choice-task-wrap">
      <div class="question-card">
        <p class="question-desc">${escapeHtml(item.desc || "")}</p>
        <p class="question-main">${escapeHtml(promptText)}</p>
      </div>
      <div class="choice-list">
        ${(item.choices || [])
          .map((choice) => {
            const letter = String(choice).trim().charAt(0).toUpperCase();
            return `<button class="answer-button choice-btn" data-choice-letter="${escapeHtml(letter)}" data-choice-text="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`;
          })
          .join("")}
      </div>
    </div>
  `;

  answerList.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pickedLetter = btn.dataset.choiceLetter || "";
      submitCurrentAnswer(pickedLetter);
    });
  });

  setMessage(mode === "reading" ? "Read and choose the best answer." : "Choose the best answer.");
}

function renderListeningTask(item) {
  if (!answerList) return;

  answerList.innerHTML = `
    <div class="listening-task-wrap">
      <div class="listening-controls">
        <button id="playAudioBtn" class="answer-button">▶ Play Audio</button>
        <button id="replayAudioBtn" class="answer-button">⟳ Replay</button>
      </div>
      <div class="choice-list">
        ${(item.choices || [])
          .map((choice) => {
            const letter = String(choice).trim().charAt(0).toUpperCase();
            return `<button class="answer-button choice-btn" data-choice-letter="${escapeHtml(letter)}">${escapeHtml(choice)}</button>`;
          })
          .join("")}
      </div>
    </div>
  `;

  document.getElementById("playAudioBtn")?.addEventListener("click", () => {
    speakText(item.audioText || "");
  });

  document.getElementById("replayAudioBtn")?.addEventListener("click", () => {
    speakText(item.audioText || "");
  });

  answerList.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pickedLetter = btn.dataset.choiceLetter || "";
      submitCurrentAnswer(pickedLetter);
    });
  });

  speakText(item.audioText || "");
  setMessage("Listen carefully, then choose the best answer.");
}

function renderWritingTask(item) {
  if (!answerList) return;

  answerList.innerHTML = `
    <div class="writing-task-wrap">
      <div class="writing-prompt-card">
        <pre class="writing-prompt">${escapeHtml(item.prompt || item.desc || "")}</pre>
      </div>
      <textarea id="writingInput" class="writing-input" rows="4" placeholder="Type your answer here"></textarea>
      <div class="writing-actions">
        <button id="submitWritingBtn" class="answer-button">Submit</button>
      </div>
    </div>
  `;

  document.getElementById("submitWritingBtn")?.addEventListener("click", () => {
    const input = document.getElementById("writingInput")?.value || "";
    submitCurrentAnswer(input);
  });

  setMessage("Type your answer using simple English.");
}

function renderSpeakingTask(item) {
  if (!answerList) return;

  answerList.innerHTML = `
    <div class="speaking-task-wrap">
      <div class="speaking-model-card">
        <p class="speaking-desc">${escapeHtml(item.desc || "Speak clearly.")}</p>
        <p class="speaking-model"><strong>Model:</strong> ${escapeHtml(item.exactPhrase || "")}</p>
      </div>

      <div class="speaking-actions">
        <button id="playModelBtn" class="answer-button">▶ Hear Model</button>
        <button id="startMicBtn" class="answer-button">🎤 Start Mic</button>
        <button id="stopMicBtn" class="answer-button">■ Stop Mic</button>
      </div>

      <div class="speaking-transcript-wrap">
        <label for="speakingInput">Transcript / Manual input</label>
        <textarea id="speakingInput" class="writing-input" rows="3" placeholder="Your speech transcript will appear here, or type manually"></textarea>
      </div>

      <div class="speaking-actions">
        <button id="submitSpeakingBtn" class="answer-button">Submit</button>
      </div>

      <div id="speechSupportNote" class="speaking-note"></div>
    </div>
  `;

  const speakingInput = document.getElementById("speakingInput");
  const speechSupportNote = document.getElementById("speechSupportNote");

  document.getElementById("playModelBtn")?.addEventListener("click", () => {
    speakText(item.exactPhrase || "");
  });

  document.getElementById("startMicBtn")?.addEventListener("click", () => {
    if (!SpeechRecognitionClass) {
      if (speechSupportNote) {
        speechSupportNote.textContent = "Speech recognition is not supported here. You can type the sentence manually.";
      }
      return;
    }

    if (speechSupportNote) {
      speechSupportNote.textContent = "Listening... speak clearly in English.";
    }

    const started = startSpeechCapture(
      (text) => {
        if (speakingInput) speakingInput.value = text;
      },
      (finalText) => {
        if (speakingInput) speakingInput.value = finalText || speakingInput.value;
        if (speechSupportNote) speechSupportNote.textContent = "Speech capture finished.";
      }
    );

    if (!started && speechSupportNote) {
      speechSupportNote.textContent = "Could not start microphone. You can type the sentence manually.";
    }
  });

  document.getElementById("stopMicBtn")?.addEventListener("click", () => {
    stopSpeechCapture();
    if (speechSupportNote) speechSupportNote.textContent = "Speech capture stopped.";
  });

  document.getElementById("submitSpeakingBtn")?.addEventListener("click", () => {
    const input = speakingInput?.value || state.currentTranscript || "";
    submitCurrentAnswer(input);
  });

  setMessage("Say the sentence clearly, or type it if needed.");
}

function submitCurrentAnswer(userInput) {
  stopSpeechCapture();

  const item = getCurrentItem();
  if (!item) return;

  const strictness = item._difficulty || "normal";
  const result = evaluateMissionAnswer(item, userInput, strictness);

  const enrichedResult = {
    ...result,
    _sessionId: state.currentSessionId,
    _step: item._step,
    _stage: item._stage,
    _difficulty: item._difficulty,
    _input: userInput
  };

  state.currentResults.push(enrichedResult);

  renderStepFeedback(item, enrichedResult);
}

function renderStepFeedback(item, result) {
  if (!answerList) return;

  let extra = "";

  if (item.answer && !result.ok) {
    extra += `<p><strong>Best answer:</strong> ${escapeHtml(item.answer)}</p>`;
  }

  if (item.exactPhrase) {
    extra += `<p><strong>Model phrase:</strong> ${escapeHtml(item.exactPhrase)}</p>`;
    if (typeof result.ratio === "number") {
      extra += `<p><strong>Match:</strong> ${Math.round(result.ratio * 100)}%</p>`;
    }
  }

  if (item.keywords) {
    extra += `
      <p><strong>Expected keywords:</strong> ${escapeHtml(item.keywords.join(", "))}</p>
      <p><strong>Matched:</strong> ${escapeHtml(String(result.matched || 0))} / ${escapeHtml(String(result.minMatch || 0))}</p>
    `;
  }

  answerList.innerHTML = `
    <div class="feedback-card ${result.ok ? "correct" : "wrong"}">
      <h3>${result.ok ? "Correct" : "Try to improve"}</h3>
      <p>${escapeHtml(result.feedback || "")}</p>
      ${extra}
      <div class="feedback-actions">
        <button id="nextStepBtn" class="answer-button">
          ${state.currentStepIndex >= state.currentRun.length - 1 ? "Finish Session" : "Next Item"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("nextStepBtn")?.addEventListener("click", () => {
    goToNextStep();
  });

  setMessage(result.ok ? "Good job." : "Keep going. Focus on the model answer and try the next item.");
}

function goToNextStep() {
  state.currentStepIndex += 1;
  if (state.currentStepIndex >= state.currentRun.length) {
    finishSession();
    return;
  }
  renderCurrentStep();
}

function finishSession() {
  stopSpeechCapture();

  const summary = summarizeSessionResult(state.currentSessionId, state.currentResults);
  saveSessionProgress(state.currentSessionId, summary);
  updateHud();
  refreshPortalStates();
  updateAdaptiveState(summary);

  renderSessionResultPanel(summary);

  if (summary.passed) {
    setMessage(`Session clear. S${Math.min(state.currentSessionId + 1, TOTAL_SESSIONS)} is now available.`);
  } else {
    setMessage("Session finished. Replay to improve your score and pass.");
  }
}

function updateAdaptiveState(summary) {
  const ratio = summary.total ? summary.correct / summary.total : 0;

  if (ratio < 0.55) {
    state.aiState.support = Math.min(3, state.aiState.support + 1);
    state.aiState.pressure = Math.max(0, state.aiState.pressure - 1);
  } else if (ratio >= 0.85) {
    state.aiState.pressure = Math.min(3, state.aiState.pressure + 1);
    state.aiState.support = Math.max(0, state.aiState.support - 1);
  } else {
    state.aiState.support = Math.max(0, state.aiState.support - 1);
    state.aiState.pressure = Math.max(0, state.aiState.pressure - 1);
  }
}

function renderSessionResultPanel(summary) {
  const allCleared = getPassedCount() === TOTAL_SESSIONS;
  const nextId = Math.min(state.currentSessionId + 1, TOTAL_SESSIONS);
  const canGoNext = state.currentSessionId < TOTAL_SESSIONS && isSessionUnlocked(nextId);

  if (!lessonStatus) return;

  lessonStatus.textContent = `Finished • ${summary.correct}/15 • ${"★".repeat(summary.stars) || "—"}`;
  if (missionText) {
    missionText.textContent = `Result: ${summary.rank} • Boss correct: ${summary.bossCorrect}/5`;
  }
  if (challengePrompt) {
    challengePrompt.textContent = summary.passed
      ? "Session passed. Great work."
      : "Session not passed yet. Practice and try again.";
  }

  if (!answerList) return;

  answerList.innerHTML = `
    <div class="session-result-card">
      <h3>${escapeHtml(summary.title)}</h3>
      <p><strong>Correct:</strong> ${summary.correct}/${summary.total}</p>
      <p><strong>Boss correct:</strong> ${summary.bossCorrect}/5</p>
      <p><strong>Status:</strong> ${summary.passed ? "Passed" : "Retry"}</p>
      <p><strong>Stars:</strong> ${"★".repeat(summary.stars) || "—"}</p>
      <p><strong>Advice:</strong> ${escapeHtml(summary.nextAdvice)}</p>

      <div class="session-result-actions">
        <button id="retrySessionBtn" class="answer-button">Replay Session</button>
        ${canGoNext ? `<button id="nextSessionBtn" class="answer-button">Next Session</button>` : ""}
        <button id="backHubBtn" class="answer-button">Back to Hub</button>
        <button id="openSummaryFromResultBtn" class="answer-button">Open Summary</button>
      </div>
    </div>
  `;

  document.getElementById("retrySessionBtn")?.addEventListener("click", () => {
    startSession(state.currentSessionId);
  });

  document.getElementById("nextSessionBtn")?.addEventListener("click", () => {
    renderSessionOverview(nextId);
  });

  document.getElementById("backHubBtn")?.addEventListener("click", () => {
    moveToHub();
    renderSessionOverview(state.currentSessionId);
  });

  document.getElementById("openSummaryFromResultBtn")?.addEventListener("click", () => {
    openSummary();
  });

  if (allCleared && summary.passed) {
    openSummary();
  }
}

/* =========================================================
 * NAVIGATION
 * ========================================================= */

function moveToHub() {
  stopSpeechCapture();
  moveTo("hub");
  setMessage("Career Hub is ready. Choose a session from the portal ring.");
}

function goToNextSessionOverview() {
  const nextId = getNextUnlockedSessionId();
  renderSessionOverview(nextId);
}

/* =========================================================
 * STARTUP
 * ========================================================= */

function boot() {
  updateHud();
  initPortals();
  moveToHub();

  const nextId = getNextUnlockedSessionId();
  renderSessionOverview(nextId);
}

startButton?.addEventListener("click", () => {
  overlay?.classList.add("hidden");
  boot();
});

homeButton?.addEventListener("click", () => {
  moveToHub();
});

nextButton?.addEventListener("click", () => {
  goToNextSessionOverview();
});

summaryButton?.addEventListener("click", () => {
  openSummary();
});

closeSummaryButton?.addEventListener("click", () => {
  closeSummary();
});

/* =========================================================
 * FIRST LOAD
 * ========================================================= */

updateHud();
moveToHub();