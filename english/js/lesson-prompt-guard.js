// /english/js/lesson-prompt-guard.js
// PATCH v20260426-lesson-prompt-guard-r9-1
// ✅ Keep reading/listening/speaking/writing prompt visible in center UI
// ✅ Prevent reading passage from being hidden in VR background only
// ✅ Works safely even if lesson-main.js changes DOM later

(function () {
  "use strict";

  const PATCH = "v20260426-lesson-prompt-guard-r9-1";

  const CANDIDATE_KEYS = [
    "currentMission",
    "activeMission",
    "currentQuestion",
    "TECHPATH_CURRENT_MISSION",
    "__TECHPATH_CURRENT_MISSION"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function getBodyType() {
    return document.body?.dataset?.missionType || "";
  }

  function getAFrameTextValue(id) {
    const el = $(id);
    if (!el) return "";

    try {
      const attr = el.getAttribute("value");
      if (attr) return clean(attr);
    } catch (_) {}

    try {
      const textAttr = el.getAttribute("text");
      if (textAttr && textAttr.value) return clean(textAttr.value);
    } catch (_) {}

    return "";
  }

  function findMissionObject() {
    for (const key of CANDIDATE_KEYS) {
      const obj = window[key];
      if (obj && typeof obj === "object") return obj;
    }

    if (window.TechPathLesson?.currentMission) {
      return window.TechPathLesson.currentMission;
    }

    if (window.lessonState?.currentMission) {
      return window.lessonState.currentMission;
    }

    if (window.gameState?.currentMission) {
      return window.gameState.currentMission;
    }

    if (window.state?.currentMission) {
      return window.state.currentMission;
    }

    return null;
  }

  function firstValue(obj, keys) {
    if (!obj || typeof obj !== "object") return "";

    for (const key of keys) {
      const value = obj[key];
      if (typeof value === "string" && clean(value)) return clean(value);
    }

    return "";
  }

  function getQuestionFromDom(type) {
    if (type === "reading") {
      return getAFrameTextValue("reading-question");
    }

    if (type === "listening") {
      return getAFrameTextValue("listening-prompt");
    }

    if (type === "speaking") {
      return getAFrameTextValue("speaking-prompt");
    }

    if (type === "writing") {
      return getAFrameTextValue("writing-prompt");
    }

    return "";
  }

  function buildPromptText() {
    const type = getBodyType();
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
      "prompt",
      "title"
    ]);

    const question =
      firstValue(mission, [
        "question",
        "q",
        "questionText",
        "ask"
      ]) ||
      getQuestionFromDom(type);

    if (type === "reading") {
      if (passage && question) {
        return `อ่านบทความสั้นนี้ แล้วตอบคำถาม\n\n${passage}\n\nQ: ${question}`;
      }

      if (passage) {
        return `อ่านบทความสั้นนี้ แล้วตอบคำถาม\n\n${passage}`;
      }

      if (question) {
        return question;
      }
    }

    if (type === "listening") {
      if (instruction && question) {
        return `${instruction}\n\nQ: ${question}`;
      }

      if (question && !/press play audio/i.test(question)) {
        return question;
      }

      return "กด Play Audio แล้วเลือกคำตอบ";
    }

    if (type === "speaking") {
      if (question) return `พูดประโยคนี้ให้ชัดเจน\n\n${question}`;
      return "กด Speak แล้วพูดตามโจทย์";
    }

    if (type === "writing") {
      if (question) return question;
      if (instruction) return instruction;
      return "พิมพ์คำตอบภาษาอังกฤษให้สมบูรณ์";
    }

    return question || instruction || passage || "";
  }

  function forcePromptVisible() {
    const box = $("mission-prompt-box");
    const label = $("mission-prompt-label");
    const text = $("mission-prompt-text");

    if (!box || !text) return;

    const type = getBodyType();
    const isMission = document.body.classList.contains("mission-mode");

    if (!isMission) return;

    const promptText = buildPromptText();

    if (label) {
      label.textContent =
        type === "reading" ? "READING TASK" :
        type === "listening" ? "LISTENING TASK" :
        type === "speaking" ? "SPEAKING TASK" :
        type === "writing" ? "WRITING TASK" :
        "MISSION TASK";
    }

    if (promptText) {
      text.textContent = promptText;
    }

    box.style.display = "block";
    box.classList.add("prompt-guard-active");

    // กัน panel เตี้ยเกินจนเหมือนโจทย์หาย
    if (type === "reading") {
      box.style.maxHeight = "34dvh";
      box.style.overflow = "auto";
    }
  }

  function hideBadVrReadingText() {
    // ลดความรกของ text 3D ด้านหลัง แต่ไม่ลบฉาก
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
    });
  }

  function tick() {
    forcePromptVisible();

    const type = getBodyType();
    if (type === "reading" || type === "listening") {
      hideBadVrReadingText();
    }
  }

  function boot() {
    console.log("[TechPath Prompt Guard]", PATCH);

    tick();

    const observer = new MutationObserver(() => tick());
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-mission-type", "value", "visible"]
    });

    setInterval(tick, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
