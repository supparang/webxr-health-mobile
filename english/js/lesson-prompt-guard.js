// /english/js/lesson-prompt-guard.js
// TechPath Lesson Ultimate r9.2 — Prompt Guard + AI Guide UI
// PATCH v20260426-lesson-prompt-guard-ai-r9-2
// ✅ Keep prompt / passage / question visible in center UI
// ✅ Fix reading passage hidden in VR background
// ✅ Fix listening choices not active after Play Audio
// ✅ Add AI Guide panel for listening / speaking / reading / writing
// ✅ Works safely with lesson-main.js, lesson-ai.js, lesson-data.js

(function () {
  "use strict";

  const PATCH = "v20260426-lesson-prompt-guard-ai-r9-2";

  const MISSION_KEYS = [
    "currentMission",
    "activeMission",
    "currentQuestion",
    "TECHPATH_CURRENT_MISSION",
    "__TECHPATH_CURRENT_MISSION",
    "__currentMission",
    "__activeMission"
  ];

  const TYPE_SET = new Set(["listening", "speaking", "reading", "writing"]);

  let lastPromptText = "";
  let lastMissionType = "";
  let lastChoiceSignature = "";
  let audioPlayedOnce = false;

  function $(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function multiline(value) {
    return String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getMissionType() {
    const bodyType = clean(document.body?.dataset?.missionType || "").toLowerCase();
    if (TYPE_SET.has(bodyType)) return bodyType;

    const mission = findMissionObject();
    const t = clean(mission?.type || mission?.skill || mission?.missionType || "").toLowerCase();
    if (TYPE_SET.has(t)) return t;

    if (isVisible("mission-reading-scene")) return "reading";
    if (isVisible("mission-listening-scene")) return "listening";
    if (isVisible("mission-speaking-scene")) return "speaking";
    if (isVisible("mission-writing-scene")) return "writing";

    return "";
  }

  function isVisible(id) {
    const el = $(id);
    if (!el) return false;

    try {
      const v = el.getAttribute("visible");
      return v === true || v === "true";
    } catch (_) {
      return false;
    }
  }

  function getAFrameTextValue(id) {
    const el = $(id);
    if (!el) return "";

    try {
      const v = el.getAttribute("value");
      if (clean(v)) return multiline(v);
    } catch (_) {}

    try {
      const t = el.getAttribute("text");
      if (t && typeof t === "object" && clean(t.value)) return multiline(t.value);
      if (typeof t === "string" && clean(t)) return multiline(t);
    } catch (_) {}

    return "";
  }

  function findMissionObject() {
    for (const key of MISSION_KEYS) {
      const obj = window[key];
      if (obj && typeof obj === "object") return obj;
    }

    const nested = [
      window.TechPathLesson?.currentMission,
      window.TechPathLesson?.activeMission,
      window.lessonState?.currentMission,
      window.lessonState?.activeMission,
      window.gameState?.currentMission,
      window.gameState?.activeMission,
      window.state?.currentMission,
      window.state?.activeMission,
      window.TechPathState?.currentMission
    ];

    for (const obj of nested) {
      if (obj && typeof obj === "object") return obj;
    }

    return null;
  }

  function firstValue(obj, keys) {
    if (!obj || typeof obj !== "object") return "";

    for (const key of keys) {
      const value = obj[key];

      if (typeof value === "string" && clean(value)) return multiline(value);

      if (Array.isArray(value)) {
        const joined = value.filter(Boolean).join("\n");
        if (clean(joined)) return multiline(joined);
      }
    }

    return "";
  }

  function getMissionChoices(mission) {
    const raw =
      mission?.choices ||
      mission?.options ||
      mission?.answers ||
      mission?.choiceList ||
      [];

    if (!Array.isArray(raw)) return [];

    return raw
      .map((x) => clean(x))
      .filter(Boolean)
      .slice(0, 3);
  }

  function normalizeChoiceLabel(value, fallbackLetter) {
    const s = clean(value);
    if (!s) return fallbackLetter;

    const stripped = s.replace(/^[ABC][.)]\s*/i, "").trim();
    return stripped || s || fallbackLetter;
  }

  function choiceSignature(choices) {
    return choices.map((x) => clean(x).toLowerCase()).join("|");
  }

  function getDomQuestion(type) {
    if (type === "reading") return getAFrameTextValue("reading-question");
    if (type === "listening") return getAFrameTextValue("listening-prompt");
    if (type === "speaking") return getAFrameTextValue("speaking-prompt");
    if (type === "writing") return getAFrameTextValue("writing-prompt");
    return "";
  }

  function getLevelLabel(mission) {
    const level =
      mission?.cefr ||
      mission?.level ||
      mission?.difficulty ||
      window.TECHPATH_SELECTED_LEVEL ||
      window.TECHPATH_SELECTED_DIFFICULTY ||
      document.body?.dataset?.techpathLevel ||
      "";

    const s = clean(level).toLowerCase();

    if (s === "easy" || s === "a2") return "A2";
    if (s === "normal" || s === "a2+") return "A2+";
    if (s === "hard" || s === "b1") return "B1";
    if (s === "challenge" || s === "b1+") return "B1+";

    return clean(level) || "A2-B1+";
  }

  function buildPromptText() {
    const type = getMissionType();
    const mission = findMissionObject();

    const passage = firstValue(mission, [
      "passage",
      "paragraph",
      "context",
      "reading",
      "readingText",
      "text",
      "body",
      "dialogue",
      "scenario"
    ]);

    const instruction = firstValue(mission, [
      "instruction",
      "task",
      "title",
      "promptTitle"
    ]);

    const prompt = firstValue(mission, [
      "prompt",
      "questionPrompt",
      "mainPrompt"
    ]);

    const question =
      firstValue(mission, [
        "question",
        "q",
        "questionText",
        "ask"
      ]) ||
      getDomQuestion(type);

    const starter = firstValue(mission, [
      "starter",
      "sentenceStarter",
      "sampleStart"
    ]);

    if (type === "reading") {
      if (passage && question) {
        return `อ่านบทความสั้นนี้ แล้วตอบคำถาม\n\n${passage}\n\nQ: ${question}`;
      }

      if (prompt && question && prompt !== question) {
        return `อ่านโจทย์ แล้วตอบคำถาม\n\n${prompt}\n\nQ: ${question}`;
      }

      if (passage) return `อ่านบทความสั้นนี้ แล้วตอบคำถาม\n\n${passage}`;
      if (question) return question;
    }

    if (type === "listening") {
      if (prompt && question && !/press play audio/i.test(question)) {
        return `${prompt}\n\nQ: ${question}`;
      }

      if (question && !/press play audio/i.test(question)) {
        return question;
      }

      return "กด Play Audio เพื่อฟังประโยค แล้วเลือกคำตอบที่ตรงที่สุด";
    }

    if (type === "speaking") {
      const speakText = question || prompt || firstValue(mission, ["exactPhrase", "audioText", "transcript"]);
      if (speakText) return `พูดประโยคนี้ให้ชัดเจน\n\n${speakText}`;
      return "กด Speak แล้วพูดตามโจทย์ให้ชัดเจน";
    }

    if (type === "writing") {
      if (starter && question) return `${question}\n\n${starter}`;
      if (question) return question;
      if (prompt) return prompt;
      if (starter) return starter;
      return "พิมพ์คำตอบภาษาอังกฤษให้สมบูรณ์";
    }

    return question || prompt || instruction || passage || "";
  }

  function labelForType(type) {
    const mission = findMissionObject();
    const level = getLevelLabel(mission);

    if (type === "reading") return `READING TASK • ${level}`;
    if (type === "listening") return `LISTENING TASK • ${level}`;
    if (type === "speaking") return `SPEAKING TASK • ${level}`;
    if (type === "writing") return `WRITING TASK • ${level}`;

    return `MISSION TASK • ${level}`;
  }

  function buildAiGuideText() {
    const type = getMissionType();
    const mission = findMissionObject();

    const explicit =
      firstValue(mission, ["aiGuide", "hint", "guide", "aiHint"]) ||
      clean(window.TechPathAI?.aiDirector?.lastCoachTip || "");

    if (explicit) return explicit;

    if (type === "reading") {
      return "AI Guide: อ่านเพื่อจับ main idea ก่อน อย่าเพิ่งแปลทุกคำ แล้วค่อยดูตัวเลือก A/B/C";
    }

    if (type === "listening") {
      return audioPlayedOnce
        ? "AI Guide: ฟัง keyword เช่น topic, action, problem, next step แล้วเลือกคำตอบ"
        : "AI Guide: กด Play Audio ก่อน แล้วฟังว่าผู้พูดพูดเรื่องอะไรเป็นหลัก";
    }

    if (type === "speaking") {
      return "AI Guide: พูดช้าลงนิดหนึ่ง เน้น keyword และเว้นจังหวะหลังแต่ละวลี";
    }

    if (type === "writing") {
      return "AI Guide: เขียนเป็นประโยคสมบูรณ์ ใส่ keyword และเพิ่มเหตุผลหรือ next step อย่างน้อย 1 จุด";
    }

    return "AI Guide: จับ keyword และเป้าหมายของโจทย์ก่อนตอบ";
  }

  function ensureAiGuideBox() {
    let box = $("ai-guide-box");
    if (box) return box;

    const promptBox = $("mission-prompt-box");
    box = document.createElement("div");
    box.id = "ai-guide-box";
    box.innerHTML = `
      <div id="ai-guide-title">AI GUIDE</div>
      <div id="ai-guide-text">AI กำลังเตรียมคำแนะนำ...</div>
    `;

    if (promptBox && promptBox.parentNode) {
      promptBox.parentNode.insertBefore(box, promptBox.nextSibling);
    } else {
      document.body.appendChild(box);
    }

    return box;
  }

  function renderAiGuide() {
    const isMission = document.body.classList.contains("mission-mode");
    const box = ensureAiGuideBox();

    if (!box) return;

    if (!isMission) {
      box.style.display = "none";
      return;
    }

    const title = $("ai-guide-title");
    const text = $("ai-guide-text");
    const type = getMissionType();

    if (title) title.textContent = `AI GUIDE • ${type ? type.toUpperCase() : "MISSION"}`;
    if (text) text.textContent = buildAiGuideText();

    box.style.display = "block";
  }

  function forcePromptVisible() {
    const isMission = document.body.classList.contains("mission-mode");
    const box = $("mission-prompt-box");
    const label = $("mission-prompt-label");
    const text = $("mission-prompt-text");

    if (!isMission || !box || !text) return;

    const type = getMissionType();
    const promptText = buildPromptText();

    if (label) label.textContent = labelForType(type);

    if (promptText) {
      text.textContent = promptText;
      lastPromptText = promptText;
    } else if (lastPromptText) {
      text.textContent = lastPromptText;
    }

    box.style.display = "block";
    box.classList.add("prompt-guard-active");

    if (type === "reading") {
      box.style.maxHeight = "34dvh";
      box.style.overflow = "auto";
    } else {
      box.style.maxHeight = "";
      box.style.overflow = "";
    }

    lastMissionType = type;
  }

  function setChoiceButton(letter, label) {
    const lower = letter.toLowerCase();
    const btn = $(`choice-btn-${lower}`);

    if (!btn) return;

    const labelEl = btn.querySelector("[data-choice-label]") || btn.querySelector(".choice-label");
    const text = normalizeChoiceLabel(label, letter);

    if (labelEl) {
      labelEl.textContent = text;
    } else {
      btn.textContent = `${letter}. ${text}`;
    }

    btn.disabled = false;
    btn.removeAttribute("disabled");
    btn.setAttribute("aria-disabled", "false");
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";
  }

  function getChoicesFromVrDom(type) {
    const prefix = type === "listening" ? "listening" : "reading";

    return ["a", "b", "c"]
      .map((x) => getAFrameTextValue(`${prefix}-choice-${x}`))
      .filter(Boolean);
  }

  function fallbackChoices(type) {
    if (type === "listening") {
      return [
        "A. The speaker talks about a tech task.",
        "B. The speaker talks about a holiday.",
        "C. The speaker orders food."
      ];
    }

    if (type === "reading") {
      return [
        "A. A simple technology learning task",
        "B. A travel story",
        "C. A food menu"
      ];
    }

    return [];
  }

  function forceChoicesVisible() {
    const type = getMissionType();
    const isChoiceMission = type === "reading" || type === "listening";
    const box = $("choice-buttons");

    if (!box || !document.body.classList.contains("mission-mode")) return;

    if (!isChoiceMission) {
      return;
    }

    const mission = findMissionObject();
    let choices = getMissionChoices(mission);

    if (!choices.length) {
      choices = getChoicesFromVrDom(type);
    }

    if (!choices.length) {
      choices = fallbackChoices(type);
    }

    choices = choices.slice(0, 3);

    while (choices.length < 3) {
      choices.push(`${String.fromCharCode(65 + choices.length)}. Another possible answer`);
    }

    const sig = choiceSignature(choices);

    if (sig !== lastChoiceSignature) {
      setChoiceButton("A", choices[0]);
      setChoiceButton("B", choices[1]);
      setChoiceButton("C", choices[2]);
      lastChoiceSignature = sig;
    } else {
      ["A", "B", "C"].forEach((letter) => {
        const btn = $(`choice-btn-${letter.toLowerCase()}`);
        if (!btn) return;
        btn.disabled = false;
        btn.removeAttribute("disabled");
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
      });
    }

    box.style.display = "grid";
  }

  function hideBadVrText() {
    const type = getMissionType();

    if (type !== "reading" && type !== "listening") return;

    const ids = [
      "reading-question",
      "reading-choice-a",
      "reading-choice-b",
      "reading-choice-c",
      "listening-choice-a",
      "listening-choice-b",
      "listening-choice-c"
    ];

    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;

      try {
        el.setAttribute("visible", "false");
      } catch (_) {}

      try {
        el.setAttribute("scale", "0.001 0.001 0.001");
      } catch (_) {}
    });
  }

  function patchPlayAudio() {
    if (typeof window.playAudio !== "function") return;
    if (window.playAudio.__promptGuardPatched) return;

    const original = window.playAudio;

    const wrapped = function (...args) {
      audioPlayedOnce = true;

      const result = original.apply(this, args);

      setTimeout(() => {
        forcePromptVisible();
        forceChoicesVisible();
        renderAiGuide();

        const status = $("feedback");
        if (status && getMissionType() === "listening") {
          status.textContent = "ฟังแล้วเลือกคำตอบ A / B / C ได้เลย";
          status.style.color = "#7bedff";
        }
      }, 120);

      return result;
    };

    wrapped.__promptGuardPatched = true;
    wrapped.__original = original;

    window.playAudio = wrapped;
  }

  function patchMissionSetters() {
    const names = [
      "loadMission",
      "startMission",
      "playMission",
      "renderMission",
      "showMission",
      "nextMission",
      "playNextMission"
    ];

    names.forEach((name) => {
      const fn = window[name];

      if (typeof fn !== "function" || fn.__promptGuardPatched) return;

      const wrapped = function (...args) {
        audioPlayedOnce = false;

        const result = fn.apply(this, args);

        setTimeout(tick, 60);
        setTimeout(tick, 250);
        setTimeout(tick, 700);

        return result;
      };

      wrapped.__promptGuardPatched = true;
      wrapped.__original = fn;

      window[name] = wrapped;
    });
  }

  function injectCss() {
    if ($("lesson-prompt-guard-r9-css")) return;

    const style = document.createElement("style");
    style.id = "lesson-prompt-guard-r9-css";
    style.textContent = `
      #mission-prompt-box.prompt-guard-active{
        border-color:rgba(123,237,255,.32) !important;
        background:rgba(10,18,34,.96) !important;
      }

      #mission-prompt-text{
        white-space:pre-wrap !important;
        overflow-wrap:anywhere !important;
        word-break:normal !important;
      }

      #ai-guide-box{
        display:none;
        margin:8px 0 10px;
        padding:10px 12px;
        border-radius:16px;
        border:1px solid rgba(46,213,115,.22);
        background:rgba(46,213,115,.08);
        color:#eafff1;
        box-shadow:0 8px 20px rgba(0,0,0,.18);
      }

      #ai-guide-title{
        color:#7bedff;
        font-size:.78rem;
        font-weight:950;
        margin-bottom:5px;
        letter-spacing:.03em;
      }

      #ai-guide-text{
        color:#eafff1;
        font-size:.92rem;
        line-height:1.45;
        font-weight:750;
      }

      body.mission-mode[data-mission-type="reading"] #mission-prompt-box{
        max-height:34dvh !important;
        overflow:auto !important;
      }

      body.mission-mode[data-mission-type="reading"] #mission-prompt-text{
        font-size:.96rem !important;
        line-height:1.45 !important;
      }

      body.mission-mode[data-mission-type="listening"] #choice-buttons,
      body.mission-mode[data-mission-type="reading"] #choice-buttons{
        display:grid !important;
      }

      body.mission-mode[data-mission-type="listening"] #choice-buttons .choice-btn,
      body.mission-mode[data-mission-type="reading"] #choice-buttons .choice-btn{
        pointer-events:auto !important;
        opacity:1 !important;
      }

      @media (max-width:700px){
        body.mission-mode #ai-guide-box{
          position:fixed !important;
          left:10px !important;
          right:10px !important;
          top:calc(env(safe-area-inset-top, 0px) + 270px) !important;
          z-index:87 !important;
          margin:0 !important;
          padding:9px 10px !important;
          max-height:72px !important;
          overflow:auto !important;
        }

        body.mission-mode[data-mission-type="reading"] #mission-prompt-box{
          top:calc(env(safe-area-inset-top, 0px) + 104px) !important;
          max-height:30dvh !important;
        }

        body.mission-mode[data-mission-type="reading"] #mission-prompt-text{
          font-size:.9rem !important;
          line-height:1.38 !important;
        }

        #ai-guide-text{
          font-size:.82rem !important;
          line-height:1.34 !important;
        }
      }

      @media (max-height:720px) and (max-width:700px){
        body.mission-mode #ai-guide-box{
          display:none !important;
        }

        body.mission-mode[data-mission-type="reading"] #mission-prompt-box{
          max-height:28dvh !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function exposeCurrentMissionForDebug() {
    const mission = findMissionObject();
    if (mission && typeof mission === "object") {
      window.__TECHPATH_PROMPT_GUARD_MISSION = mission;
    }
  }

  function tick() {
    injectCss();
    patchPlayAudio();
    patchMissionSetters();

    exposeCurrentMissionForDebug();
    forcePromptVisible();
    forceChoicesVisible();
    hideBadVrText();
    renderAiGuide();
  }

  function boot() {
    console.log("[TechPath Prompt Guard]", PATCH);

    injectCss();
    ensureAiGuideBox();
    tick();

    const observer = new MutationObserver(() => {
      tick();
    });

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-mission-type", "value", "visible", "disabled"]
    });

    window.addEventListener("techpath:ai-coach-tip", (ev) => {
      const tip = ev?.detail?.tip;
      const text = $("ai-guide-text");
      if (text && clean(tip)) {
        text.textContent = tip;
      }

      const box = ensureAiGuideBox();
      if (box && document.body.classList.contains("mission-mode")) {
        box.style.display = "block";
      }
    });

    window.addEventListener("techpath:ai-mission-loaded", () => {
      audioPlayedOnce = false;
      setTimeout(tick, 80);
      setTimeout(tick, 300);
    });

    window.addEventListener("techpath:level-change", () => {
      setTimeout(tick, 80);
    });

    setInterval(tick, 650);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
