// /english/js/lesson-ui.js

const _uiTimers = {
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
  if (_uiTimers[key]) {
    clearTimeout(_uiTimers[key]);
    _uiTimers[key] = null;
  }
}

function setStyles(el, styles = {}) {
  if (!el) return;
  Object.entries(styles).forEach(([k, v]) => {
    el.style[k] = v;
  });
}

export function $(id) {
  return document.getElementById(id);
}

export function setText(idOrEl, value) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = value ?? "";
}

export function show(idOrEl, display = "block") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.style.display = display;
}

export function hide(idOrEl) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.style.display = "none";
}

export function setHudMode(mode = "hub") {
  const ui = $("ui-container");
  if (ui) {
    ui.classList.remove("hub-mode", "mission-mode", "summary-mode");
    ui.classList.add(`${mode}-mode`);
  }

  document.body.classList.remove("hub-mode", "mission-mode", "summary-mode");
  document.body.classList.add(`${mode}-mode`);
}

export function setFeedback(text, color = "#ffffff") {
  const el = $("feedback");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = color;
}

export function scheduleFeedbackClear(ms = 900) {
  clearUiTimer("feedback");
  _uiTimers.feedback = setTimeout(() => {
    setFeedback("", "#ffffff");
  }, ms);
}

export function cancelFeedbackClear() {
  clearUiTimer("feedback");
}

export function setTitleBlock(title, desc = "", color = null) {
  const titleEl = $("ui-title");
  const descEl = $("ui-desc");
  if (titleEl) {
    titleEl.textContent = title || "";
    if (color) titleEl.style.color = color;
  }
  if (descEl) descEl.textContent = desc || "";
}

export function setHubVisible(visible = true) {
  const hub = $("hub-scene");
  if (!hub) return;
  hub.setAttribute("visible", visible ? "true" : "false");
}

export function showTimer(showIt = true) {
  const el = $("timer");
  if (!el) return;
  el.style.display = showIt ? "block" : "none";
}

export function setTimerText(totalSec) {
  const el = $("timer");
  if (!el) return;
  const safe = Math.max(0, Number(totalSec || 0));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  el.textContent = `${mins}:${secs}`;
  el.style.color = safe <= 10 ? "#ff4757" : "#ffeaa7";
}

export function setMissionScene(type) {
  const ids = [
    "mission-speaking-scene",
    "mission-reading-scene",
    "mission-listening-scene",
    "mission-writing-scene"
  ];
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.setAttribute("visible", "false");
  });

  const targetId =
    type === "speaking" ? "mission-speaking-scene" :
    type === "reading" ? "mission-reading-scene" :
    type === "listening" ? "mission-listening-scene" :
    type === "writing" ? "mission-writing-scene" :
    "";

  if (targetId) {
    const el = $(targetId);
    if (el) el.setAttribute("visible", "true");
  }
}

export function hideAllMissionControlsUI() {
  [
    "btn-speak",
    "btn-play-audio",
    "write-input",
    "btn-submit-write",
    "choice-buttons",
    "btn-next",
    "btn-return"
  ].forEach(hide);

  [
    "mission-speaking-scene",
    "mission-reading-scene",
    "mission-listening-scene",
    "mission-writing-scene"
  ].forEach((id) => {
    const el = $(id);
    if (el) el.setAttribute("visible", "false");
  });

  showTimer(false);
}

export function setSpeakingPrompt(title, exactPhrase) {
  const el = $("speaking-prompt");
  if (!el) return;
  el.setAttribute("value", `MISSION: ${title}\nSay: "${String(exactPhrase || "").toUpperCase()}"`);
}

export function setWritingPrompt(prompt) {
  const el = $("writing-prompt");
  if (!el) return;
  el.setAttribute("value", prompt || "");
}

export function setReadingQuestion(question) {
  const el = $("reading-question");
  if (!el) return;
  el.setAttribute("value", `SYSTEM ALERT:\n\n${question || ""}`);
}

export function setChoiceLabelsFor(type, choices = []) {
  const prefix = type === "listening" ? "listening" : "reading";

  const a = choices[0] || "A";
  const b = choices[1] || "B";
  const c = choices[2] || "C";

  const a3d = $(`${prefix}-choice-a`);
  const b3d = $(`${prefix}-choice-b`);
  const c3d = $(`${prefix}-choice-c`);

  if (a3d) a3d.setAttribute("value", a);
  if (b3d) b3d.setAttribute("value", b);
  if (c3d) c3d.setAttribute("value", c);

  const mobileA = $("choice-btn-a");
  const mobileB = $("choice-btn-b");
  const mobileC = $("choice-btn-c");

  if (mobileA) mobileA.textContent = a;
  if (mobileB) mobileB.textContent = b;
  if (mobileC) mobileC.textContent = c;
}

export function showMissionControlByType(type) {
  hide("btn-speak");
  hide("btn-play-audio");
  hide("btn-submit-write");

  if (type === "speaking") show("btn-speak", "inline-block");
  else if (type === "listening") show("btn-play-audio", "inline-block");
  else if (type === "writing") show("btn-submit-write", "inline-block");
}

export function showChoiceButtons(showIt = true) {
  const el = $("choice-buttons");
  if (!el) return;
  el.style.display = showIt ? "flex" : "none";
}

export function resetWritingInput() {
  const el = $("write-input");
  if (!el) return;
  el.value = "";
}

export function setScoreHUD(score, hp, comboCount = 0) {
  const scoreEl = $("score-display");
  const hpEl = $("hp-display");
  const comboEl = $("combo-display");

  if (scoreEl) scoreEl.textContent = String(score ?? 0);
  if (hpEl) hpEl.textContent = `${hp ?? 0}%`;

  if (comboEl) {
    if (comboCount >= 2) {
      comboEl.style.display = "inline";
      comboEl.textContent = comboCount >= 5
        ? `(🔥 x${comboCount} PERFECT!)`
        : `(x${comboCount} COMBO!)`;
    } else {
      comboEl.style.display = "none";
      comboEl.textContent = "";
    }
  }
}

export function setMissionPrompt(text = "", label = "PROMPT") {
  const box = $("mission-prompt-box");
  const labelEl = $("mission-prompt-label");
  const textEl = $("mission-prompt-text");

  if (labelEl) labelEl.textContent = label || "PROMPT";
  if (textEl) textEl.textContent = text || "";

  if (box) box.style.display = text ? "block" : "none";
}

export function clearMissionPrompt() {
  const textEl = $("mission-prompt-text");
  if (textEl) textEl.textContent = "";
}

export function expandMissionHeader() {
  const title = $("ui-title");
  const desc = $("ui-desc");
  setStyles(title, {
    opacity: "1",
    transform: "none",
    fontSize: "",
    margin: ""
  });
  setStyles(desc, {
    opacity: "1",
    transform: "none",
    fontSize: "",
    margin: ""
  });
}

export function scheduleMissionHeaderCollapse(ms = 1000) {
  clearUiTimer("missionHeader");
  _uiTimers.missionHeader = setTimeout(() => {
    const title = $("ui-title");
    const desc = $("ui-desc");
    setStyles(title, {
      opacity: "0.94",
      transform: "translateY(-2px)",
      fontSize: "1.05rem",
      margin: "0 0 2px 0"
    });
    setStyles(desc, {
      opacity: "0.75",
      transform: "translateY(-2px)",
      fontSize: "0.78rem",
      margin: "0"
    });
  }, ms);
}

export function expandMissionStats() {
  const stats = $("hud-stats");
  setStyles(stats, {
    opacity: "1",
    transform: "none"
  });
}

export function scheduleMissionStatsCollapse(ms = 1100) {
  clearUiTimer("missionStats");
  _uiTimers.missionStats = setTimeout(() => {
    const stats = $("hud-stats");
    setStyles(stats, {
      opacity: "0.96",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandMissionPromptChrome() {
  const box = $("mission-prompt-box");
  setStyles(box, {
    opacity: "1",
    transform: "none",
    padding: ""
  });
}

export function scheduleMissionPromptChromeCollapse(ms = 1100) {
  clearUiTimer("missionPromptChrome");
  _uiTimers.missionPromptChrome = setTimeout(() => {
    const box = $("mission-prompt-box");
    setStyles(box, {
      opacity: "0.96",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandBossChrome() {
  const boss = $("boss-phase-ui");
  setStyles(boss, {
    opacity: "1",
    transform: "none"
  });
}

export function scheduleBossChromeCollapse(ms = 1200) {
  clearUiTimer("bossChrome");
  _uiTimers.bossChrome = setTimeout(() => {
    const boss = $("boss-phase-ui");
    setStyles(boss, {
      opacity: "0.96",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandMissionTopChips() {
  const row = $("hud-top-row");
  setStyles(row, {
    opacity: "1",
    transform: "none"
  });
}

export function scheduleMissionTopChipsCollapse(ms = 1100) {
  clearUiTimer("missionTopChips");
  _uiTimers.missionTopChips = setTimeout(() => {
    const row = $("hud-top-row");
    setStyles(row, {
      opacity: "0.92",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandMissionTitleUltraMini() {
  const title = $("ui-title");
  setStyles(title, {
    letterSpacing: "",
    fontSize: ""
  });
}

export function scheduleMissionTitleUltraMini(ms = 1000) {
  clearUiTimer("missionTitleUltraMini");
  _uiTimers.missionTitleUltraMini = setTimeout(() => {
    const title = $("ui-title");
    setStyles(title, {
      letterSpacing: "0.02em",
      fontSize: "1rem"
    });
  }, ms);
}

export function expandMissionTimer() {
  const timer = $("timer");
  setStyles(timer, {
    opacity: "1",
    transform: "none",
    fontSize: ""
  });
}

export function scheduleMissionTimerCompact(ms = 1000) {
  clearUiTimer("missionTimerCompact");
  _uiTimers.missionTimerCompact = setTimeout(() => {
    const timer = $("timer");
    setStyles(timer, {
      opacity: "0.98",
      transform: "translateY(-1px)",
      fontSize: "1rem"
    });
  }, ms);
}

export function setMissionTimerAlert(on = false) {
  const timer = $("timer");
  if (!timer) return;
  timer.style.textShadow = on ? "0 0 12px rgba(255,0,0,.45)" : "";
  timer.style.filter = on ? "saturate(1.15)" : "";
}

export function expandMissionHudTextCompact() {
  const feedback = $("feedback");
  setStyles(feedback, {
    opacity: "1",
    transform: "none",
    fontSize: ""
  });
}

export function scheduleMissionHudTextCompact(ms = 1000) {
  clearUiTimer("missionHudTextCompact");
  _uiTimers.missionHudTextCompact = setTimeout(() => {
    const feedback = $("feedback");
    setStyles(feedback, {
      opacity: "0.95",
      transform: "translateY(-1px)",
      fontSize: "0.95rem"
    });
  }, ms);
}

export function togglePromptFocusExpanded() {
  const box = $("mission-prompt-box");
  if (!box) return;
  const expanded = box.dataset.focusExpanded === "1";

  if (expanded) {
    box.dataset.focusExpanded = "0";
    setStyles(box, {
      transform: "none",
      maxHeight: "",
      overflow: ""
    });
  } else {
    box.dataset.focusExpanded = "1";
    setStyles(box, {
      transform: "scale(1.01)",
      maxHeight: "42dvh",
      overflow: "auto"
    });
  }
}

export function resetPromptFocusExpanded() {
  const box = $("mission-prompt-box");
  if (!box) return;
  box.dataset.focusExpanded = "0";
  setStyles(box, {
    transform: "none",
    maxHeight: "",
    overflow: ""
  });
}