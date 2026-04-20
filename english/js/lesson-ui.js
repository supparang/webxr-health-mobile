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

function applyStyle(el, styles = {}) {
  if (!el) return;
  Object.entries(styles).forEach(([k, v]) => {
    el.style[k] = v;
  });
}

export function $(id) {
  return document.getElementById(id);
}

export function setValueAttr(idOrEl, value) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.setAttribute("value", value);
}

export function setText(idOrEl, value) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = value;
}

export function setHtml(idOrEl, html) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.innerHTML = html;
}

export function setColor(idOrEl, color) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.style.color = color;
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

export function showMany(list = [], display = "block") {
  list.forEach(item => show(item, display));
}

export function hideMany(list = []) {
  list.forEach(item => hide(item));
}

export function setVisible(idOrEl, visible) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.setAttribute("visible", visible ? "true" : "false");
}

export function setVisibleMany(list = [], visible = false) {
  list.forEach(item => setVisible(item, visible));
}

export function addClass(idOrEl, className) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.classList.add(className);
}

export function removeClass(idOrEl, className) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.classList.remove(className);
}

export function toggleClass(idOrEl, className, force) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  if (typeof force === "boolean") el.classList.toggle(className, force);
  else el.classList.toggle(className);
}

export function pulseClass(idOrEl, className, ms = 450) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  clearTimeout(el._pulseTimer);
  el._pulseTimer = setTimeout(() => el.classList.remove(className), ms);
}

export function setButtonDisabled(idOrEl, disabled = true) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.disabled = disabled;
}

export function setInputValue(idOrEl, value = "") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.value = value;
}

export function getInputValue(idOrEl) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  return el ? el.value : "";
}

export function setHudMode(mode = "hub") {
  const ui = $("ui-container");
  if (ui) {
    ui.classList.remove("hub-mode", "mission-mode", "summary-mode");
    if (mode === "mission") ui.classList.add("mission-mode");
    else if (mode === "summary") ui.classList.add("summary-mode");
    else ui.classList.add("hub-mode");
  }

  document.body.classList.remove("hub-mode", "mission-mode", "summary-mode");
  if (mode === "mission") document.body.classList.add("mission-mode");
  else if (mode === "summary") document.body.classList.add("summary-mode");
  else document.body.classList.add("hub-mode");
}

export function setFeedback(text, color = "#ffffff") {
  setText("feedback", text || "");
  setColor("feedback", color);
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
  setText("ui-title", title || "");
  setText("ui-desc", desc || "");
  if (color) setColor("ui-title", color);
}

export function setHubVisible(visible = true) {
  setVisible("hub-scene", visible);
}

export function setSummaryVisible(showIt = true) {
  if (showIt) show("summary-panel");
  else hide("summary-panel");
}

export function setSummaryContent(title, titleColor, lines = []) {
  setText("summary-title", title || "");
  setColor("summary-title", titleColor || "#ffffff");
  setText("summary-body", Array.isArray(lines) ? lines.join("\n") : String(lines || ""));
  setSummaryVisible(true);
}

export function setGameOverVisible(showIt = true) {
  if (showIt) show("game-over-ui");
  else hide("game-over-ui");
}

export function setTimerText(totalSec) {
  const timerEl = $("timer");
  if (!timerEl) return;
  const safe = Math.max(0, Number(totalSec || 0));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  timerEl.innerText = `${mins}:${secs}`;
  timerEl.style.color = safe <= 10 ? "#ff0000" : "#ff4757";
}

export function showTimer(showIt = true) {
  if (showIt) show("timer");
  else hide("timer");
}

export function setMissionScene(type) {
  setVisible("mission-speaking-scene", type === "speaking");
  setVisible("mission-reading-scene", type === "reading");
  setVisible("mission-listening-scene", type === "listening");
  setVisible("mission-writing-scene", type === "writing");
}

export function hideAllMissionScenes() {
  setVisibleMany([
    "mission-speaking-scene",
    "mission-reading-scene",
    "mission-listening-scene",
    "mission-writing-scene"
  ], false);
}

export function hideAllMissionControlsUI() {
  hideAllMissionScenes();
  hideMany([
    "btn-speak",
    "btn-play-audio",
    "write-input",
    "btn-submit-write",
    "choice-buttons",
    "btn-next",
    "btn-return"
  ]);
  showTimer(false);
  setButtonDisabled("btn-speak", false);
}

export function setSpeakingPrompt(title, exactPhrase) {
  setValueAttr("speaking-prompt", `MISSION: ${title}\nSay: "${String(exactPhrase || "").toUpperCase()}"`);
}

export function setWritingPrompt(prompt) {
  setValueAttr("writing-prompt", prompt || "");
}

export function setReadingQuestion(question) {
  setValueAttr("reading-question", `SYSTEM ALERT:\n\n${question || ""}`);
}

export function setChoiceLabelsFor(type, choices = []) {
  const prefix = type === "listening" ? "listening" : "reading";

  const a = choices[0] || "A";
  const b = choices[1] || "B";
  const c = choices[2] || "C";

  setValueAttr(`${prefix}-choice-a`, a);
  setValueAttr(`${prefix}-choice-b`, b);
  setValueAttr(`${prefix}-choice-c`, c);

  const mobileA = document.getElementById("choice-btn-a");
  const mobileB = document.getElementById("choice-btn-b");
  const mobileC = document.getElementById("choice-btn-c");

  if (mobileA) mobileA.textContent = a;
  if (mobileB) mobileB.textContent = b;
  if (mobileC) mobileC.textContent = c;
}

export function showMissionControlByType(type) {
  hideMany(["btn-speak", "btn-play-audio", "btn-submit-write"]);
  if (type === "speaking") show("btn-speak", "inline-block");
  else if (type === "listening") show("btn-play-audio", "inline-block");
  else if (type === "writing") show("btn-submit-write", "inline-block");
}

export function showChoiceButtons(showIt = true) {
  if (showIt) show("choice-buttons", "flex");
  else hide("choice-buttons");
}

export function resetWritingInput() {
  setInputValue("write-input", "");
}

export function setScoreHUD(score, hp, comboCount = 0) {
  setText("score-display", String(score ?? 0));
  setText("hp-display", `${hp ?? 0}%`);

  const comboEl = $("combo-display");
  if (!comboEl) return;

  if (comboCount >= 2) {
    comboEl.style.display = "inline";
    comboEl.innerText = comboCount >= 5
      ? `(🔥 x${comboCount} PERFECT!)`
      : `(x${comboCount} COMBO!)`;
  } else {
    comboEl.style.display = "none";
    comboEl.innerText = "";
  }
}

export function setBossHUD({ show = false, hp = 0, maxHp = 0, sub = "" } = {}) {
  const wrap = $("boss-phase-ui");
  const fill = $("boss-bar-fill");
  const hpText = $("boss-hp-text");
  const subEl = $("boss-phase-sub");

  if (!wrap || !fill || !hpText || !subEl) return;

  wrap.style.display = show ? "block" : "none";
  if (!show) return;

  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  hpText.innerText = `BOSS HP: ${hp} / ${maxHp}`;
  subEl.innerText = sub || "";
}

export function setMissionTypeTag(text, success = true) {
  const tag = $("mission-type-tag");
  if (!tag) return;
  tag.textContent = text || "";
  tag.style.color = success ? "#2ed573" : "#ff6b81";
  tag.style.borderColor = success
    ? "rgba(46,213,115,0.35)"
    : "rgba(255,107,129,0.35)";
  pulseClass(tag, "show", 940);
}

export function setMissionPrompt(text = "", label = "PROMPT") {
  const box = $("mission-prompt-box");
  const labelEl = $("mission-prompt-label");
  const textEl = $("mission-prompt-text");

  if (labelEl) labelEl.textContent = label || "PROMPT";
  if (textEl) textEl.textContent = text || "";

  if (text && box) box.style.display = "block";
}

export function clearMissionPrompt() {
  const textEl = $("mission-prompt-text");
  if (textEl) textEl.textContent = "";
}

export function expandMissionHeader() {
  const title = $("ui-title");
  const desc = $("ui-desc");
  applyStyle(title, {
    opacity: "1",
    transform: "none",
    fontSize: "",
    margin: ""
  });
  applyStyle(desc, {
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
    applyStyle(title, {
      opacity: "0.94",
      transform: "translateY(-2px)",
      fontSize: "1.05rem",
      margin: "0 0 2px 0"
    });
    applyStyle(desc, {
      opacity: "0.75",
      transform: "translateY(-2px)",
      fontSize: "0.78rem",
      margin: "0"
    });
  }, ms);
}

export function expandMissionStats() {
  const stats = $("hud-stats");
  applyStyle(stats, {
    opacity: "1",
    transform: "none"
  });
}

export function scheduleMissionStatsCollapse(ms = 1100) {
  clearUiTimer("missionStats");
  _uiTimers.missionStats = setTimeout(() => {
    const stats = $("hud-stats");
    applyStyle(stats, {
      opacity: "0.96",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandMissionPromptChrome() {
  const box = $("mission-prompt-box");
  applyStyle(box, {
    opacity: "1",
    transform: "none",
    padding: ""
  });
}

export function scheduleMissionPromptChromeCollapse(ms = 1100) {
  clearUiTimer("missionPromptChrome");
  _uiTimers.missionPromptChrome = setTimeout(() => {
    const box = $("mission-prompt-box");
    applyStyle(box, {
      opacity: "0.96",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandBossChrome() {
  const boss = $("boss-phase-ui");
  applyStyle(boss, {
    opacity: "1",
    transform: "none"
  });
}

export function scheduleBossChromeCollapse(ms = 1200) {
  clearUiTimer("bossChrome");
  _uiTimers.bossChrome = setTimeout(() => {
    const boss = $("boss-phase-ui");
    applyStyle(boss, {
      opacity: "0.96",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandMissionTopChips() {
  const row = $("hud-top-row");
  applyStyle(row, {
    opacity: "1",
    transform: "none"
  });
}

export function scheduleMissionTopChipsCollapse(ms = 1100) {
  clearUiTimer("missionTopChips");
  _uiTimers.missionTopChips = setTimeout(() => {
    const row = $("hud-top-row");
    applyStyle(row, {
      opacity: "0.92",
      transform: "translateY(-1px)"
    });
  }, ms);
}

export function expandMissionTitleUltraMini() {
  const title = $("ui-title");
  applyStyle(title, {
    letterSpacing: "",
    fontSize: ""
  });
}

export function scheduleMissionTitleUltraMini(ms = 1000) {
  clearUiTimer("missionTitleUltraMini");
  _uiTimers.missionTitleUltraMini = setTimeout(() => {
    const title = $("ui-title");
    applyStyle(title, {
      letterSpacing: "0.02em",
      fontSize: "1rem"
    });
  }, ms);
}

export function expandMissionTimer() {
  const timer = $("timer");
  applyStyle(timer, {
    opacity: "1",
    transform: "none",
    fontSize: ""
  });
}

export function scheduleMissionTimerCompact(ms = 1000) {
  clearUiTimer("missionTimerCompact");
  _uiTimers.missionTimerCompact = setTimeout(() => {
    const timer = $("timer");
    applyStyle(timer, {
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
  applyStyle(feedback, {
    opacity: "1",
    transform: "none",
    fontSize: ""
  });
}

export function scheduleMissionHudTextCompact(ms = 1000) {
  clearUiTimer("missionHudTextCompact");
  _uiTimers.missionHudTextCompact = setTimeout(() => {
    const feedback = $("feedback");
    applyStyle(feedback, {
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
    applyStyle(box, {
      transform: "none",
      maxHeight: "",
      overflow: ""
    });
  } else {
    box.dataset.focusExpanded = "1";
    applyStyle(box, {
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
  applyStyle(box, {
    transform: "none",
    maxHeight: "",
    overflow: ""
  });
}