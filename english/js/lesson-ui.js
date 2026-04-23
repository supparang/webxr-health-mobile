// /english/js/lesson-ui.js

const uiTimers = {
  feedback: null,
  missionHeader: null,
  missionStats: null,
  missionPromptChrome: null,
  bossChrome: null,
  missionTopChips: null,
  missionTitleUltraMini: null,
  missionTimerCompact: null,
  missionHudTextCompact: null
};

function clearUiTimer(key) {
  if (uiTimers[key]) {
    clearTimeout(uiTimers[key]);
    uiTimers[key] = null;
  }
}

function scheduleUiClass(key, fn, delay = 0) {
  clearUiTimer(key);
  uiTimers[key] = setTimeout(() => {
    uiTimers[key] = null;
    fn();
  }, Math.max(0, Number(delay) || 0));
}

function getUi() {
  return document.getElementById("ui-container");
}

function setDisplay(el, display = "block") {
  if (!el) return;
  if ("style" in el) el.style.display = display;
}

function isAFrameEl(el) {
  return !!(
    el &&
    typeof el.setAttribute === "function" &&
    el.tagName &&
    el.tagName.toLowerCase().startsWith("a-")
  );
}

function applyVisible(el, visible) {
  if (!el) return;
  if (isAFrameEl(el)) {
    el.setAttribute("visible", visible ? "true" : "false");
  }
}

function textLikeSet(el, value) {
  if (!el) return;
  if (typeof el.setAttribute === "function" && isAFrameEl(el)) {
    el.setAttribute("value", String(value ?? ""));
  } else {
    el.textContent = String(value ?? "");
  }
}

function firstEl(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function choiceButton(letter) {
  const upper = String(letter || "").toUpperCase();
  return firstEl(
    `choice-btn-${upper.toLowerCase()}`,
    `choice-btn-${upper}`,
    `btn-choice-${upper.toLowerCase()}`,
    `btn-choice-${upper}`,
    `choice-${upper.toLowerCase()}`,
    `choice-${upper}`
  );
}

function stripChoicePrefix(text = "") {
  return String(text || "")
    .replace(/^[A-Ca-c]\s*[\.\)\]:：-]?\s*/, "")
    .trim();
}

function setCollapsedClass(className, collapsed) {
  const ui = getUi();
  if (!ui) return;
  ui.classList.toggle(className, !!collapsed);
}

export function $(id) {
  return document.getElementById(id);
}

export function setText(idOrEl, value) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = String(value ?? "");
}

export function show(idOrEl, display = "block") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  setDisplay(el, display);
  applyVisible(el, true);
}

export function hide(idOrEl) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  setDisplay(el, "none");
  applyVisible(el, false);
}

export function setHudMode(mode) {
  const ui = getUi();
  if (!ui) return;

  ui.classList.remove("hub-mode", "mission-mode", "summary-mode");
  if (mode === "mission") ui.classList.add("mission-mode");
  else if (mode === "summary") ui.classList.add("summary-mode");
  else ui.classList.add("hub-mode");
}

export function setFeedback(text = "", color = "#ffffff") {
  const el = $("feedback");
  if (!el) return;
  el.textContent = String(text || "");
  el.style.color = color || "#ffffff";
}

export function setTitleBlock(title = "", desc = "", color = "#00e5ff") {
  const titleEl = $("ui-title");
  const descEl = $("ui-desc");

  if (titleEl) {
    titleEl.textContent = String(title || "");
    titleEl.style.color = color || "#00e5ff";
  }
  if (descEl) {
    descEl.textContent = String(desc || "");
  }
}

export function setHubVisible(visible) {
  const hub = $("hub-scene");
  if (!hub) return;
  hub.setAttribute("visible", visible ? "true" : "false");
}

export function showTimer(visible = true) {
  const el = $("timer");
  if (!el) return;
  if (visible) show(el, "block");
  else hide(el);
}

export function setTimerText(value) {
  const el = $("timer");
  if (!el) return;

  if (typeof value === "number" && Number.isFinite(value)) {
    const safe = Math.max(0, value);
    const mins = String(Math.floor(safe / 60)).padStart(2, "0");
    const secs = String(safe % 60).padStart(2, "0");
    el.textContent = `${mins}:${secs}`;
  } else {
    el.textContent = String(value ?? "");
  }
}

export function setMissionScene(type) {
  const speaking = $("mission-speaking-scene");
  const reading = $("mission-reading-scene");
  const listening = $("mission-listening-scene");
  const writing = $("mission-writing-scene");

  [speaking, reading, listening, writing].forEach((el) => {
    if (el) el.setAttribute("visible", "false");
  });

  if (type === "speaking" && speaking) speaking.setAttribute("visible", "true");
  if (type === "reading" && reading) reading.setAttribute("visible", "true");
  if (type === "listening" && listening) listening.setAttribute("visible", "true");
  if (type === "writing" && writing) writing.setAttribute("visible", "true");
}

export function hideAllMissionControlsUI() {
  hide("btn-speak");
  hide("btn-play-audio");
  hide("btn-submit-write");
  hide("write-input");
  hide("choice-buttons");

  ["A", "B", "C"].forEach((letter) => {
    hide(choiceButton(letter));
  });

  ["mission-speaking-scene", "mission-reading-scene", "mission-listening-scene", "mission-writing-scene"]
    .forEach((id) => {
      const el = $(id);
      if (el) el.setAttribute("visible", "false");
    });
}

export function setSpeakingPrompt(title = "", exactPhrase = "") {
  const el = firstEl("speaking-prompt", "mission-speaking-prompt");
  const msg = title
    ? `MISSION: ${title}\nSay: "${String(exactPhrase || "").toUpperCase()}"`
    : `Say: "${String(exactPhrase || "").toUpperCase()}"`;
  textLikeSet(el, msg);
}

export function setWritingPrompt(prompt = "") {
  const el = firstEl("writing-prompt", "mission-writing-prompt");
  textLikeSet(el, prompt);
}

export function setReadingQuestion(question = "") {
  const el = firstEl("reading-question", "question-text", "mission-reading-question");
  textLikeSet(el, question);
}

export function setChoiceLabelsFor(type, choices = []) {
  const list = Array.isArray(choices) ? choices : [];

  ["A", "B", "C"].forEach((letter, index) => {
    const raw = String(list[index] || "");
    const clean = stripChoicePrefix(raw);
    const fullLabel = `${letter}. ${clean || "..."}`;

    const btn = choiceButton(letter);
    if (btn) {
      const labelEl =
        btn.querySelector?.(".choice-label") ||
        btn.querySelector?.("[data-choice-label]") ||
        btn;

      if ("value" in labelEl && labelEl.tagName && labelEl.tagName.toLowerCase() === "input") {
        labelEl.value = clean || "...";
      } else {
        labelEl.textContent = clean || "...";
      }

      btn.dataset.choiceType = String(type || "");
      btn.dataset.choiceLetter = letter;
      btn.dataset.choiceFullLabel = fullLabel;
    }

    const sceneTextId =
      type === "reading"
        ? `reading-choice-${letter.toLowerCase()}`
        : type === "listening"
          ? `listening-choice-${letter.toLowerCase()}`
          : "";

    const sceneTextEl = sceneTextId ? $(sceneTextId) : null;
    if (sceneTextEl) {
      textLikeSet(sceneTextEl, fullLabel);
    }
  });
}

export function showMissionControlByType(type) {
  hideAllMissionControlsUI();

  if (type === "speaking") {
    setMissionScene("speaking");
    show("btn-speak", "inline-block");
    return;
  }

  if (type === "reading") {
    setMissionScene("reading");
    showChoiceButtons(true);
    return;
  }

  if (type === "listening") {
    setMissionScene("listening");
    show("btn-play-audio", "inline-block");
    showChoiceButtons(true);
    return;
  }

  if (type === "writing") {
    setMissionScene("writing");
    show("write-input", "inline-block");
    show("btn-submit-write", "inline-block");
  }
}

export function showChoiceButtons(visible = true) {
  const wrap = $("choice-buttons");
  if (wrap) {
    if (visible) show(wrap, "grid");
    else hide(wrap);
  }

  ["A", "B", "C"].forEach((letter) => {
    const btn = choiceButton(letter);
    if (!btn) return;
    if (visible) show(btn, "block");
    else hide(btn);
  });
}

export function resetWritingInput() {
  const input = $("write-input");
  if (!input) return;
  input.value = "";
}

export function setScoreHUD(score = 0, hp = 100) {
  const scoreEl = $("score-display");
  const hpEl = $("hp-display");
  const hpWrap = $("hud-hp-wrap");
  const scoreWrap = $("hud-score-wrap");
  const ui = getUi();

  if (scoreEl) scoreEl.textContent = String(Math.max(0, Number(score) || 0));
  if (hpEl) hpEl.textContent = `${Math.max(0, Number(hp) || 0)}%`;

  if (scoreWrap) {
    scoreWrap.classList.remove("hud-stat-warning", "hud-stat-critical");
  }

  if (hpWrap) {
    hpWrap.classList.remove("hud-stat-warning", "hud-stat-critical");

    if (hp <= 35) hpWrap.classList.add("hud-stat-critical");
    else if (hp <= 60) hpWrap.classList.add("hud-stat-warning");
  }

  if (ui) {
    ui.classList.remove("mission-hp-warning", "mission-hp-critical");
    if (hp <= 35) ui.classList.add("mission-hp-critical");
    else if (hp <= 60) ui.classList.add("mission-hp-warning");
  }
}

export function setMissionPrompt(text = "", label = "MISSION") {
  const box = $("mission-prompt-box");
  const labelEl = $("mission-prompt-label");
  const textEl = $("mission-prompt-text");

  if (labelEl) labelEl.textContent = String(label || "MISSION");
  if (textEl) textEl.textContent = String(text || "");

  if (box) show(box, "block");
}

export function clearMissionPrompt() {
  const box = $("mission-prompt-box");
  const labelEl = $("mission-prompt-label");
  const textEl = $("mission-prompt-text");

  if (labelEl) labelEl.textContent = "";
  if (textEl) textEl.textContent = "";
  if (box) hide(box);
}

export function cancelFeedbackClear() {
  clearUiTimer("feedback");
}

export function scheduleFeedbackClear(delay = 1000) {
  scheduleUiClass("feedback", () => {
    setFeedback("", "#ffffff");
  }, delay);
}

export function expandMissionHeader() {
  setCollapsedClass("mission-header-collapsed", false);
}

export function scheduleMissionHeaderCollapse(delay = 1000) {
  scheduleUiClass("missionHeader", () => {
    setCollapsedClass("mission-header-collapsed", true);
  }, delay);
}

export function expandMissionStats() {
  setCollapsedClass("mission-stats-collapsed", false);
}

export function scheduleMissionStatsCollapse(delay = 1000) {
  scheduleUiClass("missionStats", () => {
    setCollapsedClass("mission-stats-collapsed", true);
  }, delay);
}

export function expandMissionPromptChrome() {
  setCollapsedClass("mission-prompt-collapsed", false);
}

export function scheduleMissionPromptChromeCollapse(delay = 1000) {
  scheduleUiClass("missionPromptChrome", () => {
    setCollapsedClass("mission-prompt-collapsed", true);
  }, delay);
}

export function expandBossChrome() {
  setCollapsedClass("boss-chrome-collapsed", false);
}

export function scheduleBossChromeCollapse(delay = 1000) {
  scheduleUiClass("bossChrome", () => {
    setCollapsedClass("boss-chrome-collapsed", true);
  }, delay);
}

export function expandMissionTopChips() {
  setCollapsedClass("mission-topchips-collapsed", false);
}

export function scheduleMissionTopChipsCollapse(delay = 1000) {
  scheduleUiClass("missionTopChips", () => {
    setCollapsedClass("mission-topchips-collapsed", true);
  }, delay);
}

export function expandMissionTitleUltraMini() {
  setCollapsedClass("mission-title-ultramini", false);
}

export function scheduleMissionTitleUltraMini(delay = 1000) {
  scheduleUiClass("missionTitleUltraMini", () => {
    setCollapsedClass("mission-title-ultramini", true);
  }, delay);
}

export function expandMissionTimer() {
  setCollapsedClass("mission-timer-compact", false);
}

export function scheduleMissionTimerCompact(delay = 1000) {
  scheduleUiClass("missionTimerCompact", () => {
    setCollapsedClass("mission-timer-compact", true);
  }, delay);
}

export function setMissionTimerAlert(on = true) {
  const ui = getUi();
  if (!ui) return;
  ui.classList.toggle("mission-timer-alert", !!on);
}

export function expandMissionHudTextCompact() {
  setCollapsedClass("mission-hudtext-compact", false);
}

export function scheduleMissionHudTextCompact(delay = 1000) {
  scheduleUiClass("missionHudTextCompact", () => {
    setCollapsedClass("mission-hudtext-compact", true);
  }, delay);
}

export function togglePromptFocusExpanded() {
  const box = $("mission-prompt-box");
  if (!box) return;
  box.classList.toggle("prompt-focus-expanded");
}

export function resetPromptFocusExpanded() {
  const box = $("mission-prompt-box");
  if (!box) return;
  box.classList.remove("prompt-focus-expanded");
}