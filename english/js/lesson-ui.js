// /english/js/lesson-ui.js
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
  if (!ui) return;
  ui.classList.remove("hub-mode", "mission-mode", "summary-mode");
  if (mode === "mission") ui.classList.add("mission-mode");
  else if (mode === "summary") ui.classList.add("summary-mode");
  else ui.classList.add("hub-mode");
}

export function setFeedback(text, color = "#ffffff") {
  setText("feedback", text || "");
  setColor("feedback", color);
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
  const ui = $("ui-container");
  const hpText = $("hp-display")?.textContent || "";
  if (!timerEl) return;

  const safe = Math.max(0, Number(totalSec || 0));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  const timeText = `${mins}:${secs}`;

  if (ui?.classList.contains("mission-mode") && ui.classList.contains("mission-hp-critical") && hpText) {
    timerEl.innerText = `⏱ ${timeText} • 💔 ${hpText}`;
    timerEl.style.color = "#ffd6db";
    return;
  }

  if (ui?.classList.contains("mission-mode") && ui.classList.contains("mission-hp-warning") && hpText) {
    timerEl.innerText = `⏱ ${timeText} • ❤️ ${hpText}`;
    timerEl.style.color = "#ffe08a";
    return;
  }

  timerEl.innerText = timeText;
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
  setValueAttr("speaking-prompt", `MISSION: ${title}\nSay: \"${String(exactPhrase || "").toUpperCase()}\"`);
}

export function setWritingPrompt(prompt) {
  setValueAttr("writing-prompt", prompt || "");
}

export function setReadingQuestion(question) {
  setValueAttr("reading-question", `SYSTEM ALERT:\n\n${question || ""}`);
}

export function setChoiceLabelsFor(type, choices = []) {
  const prefix = type === "listening" ? "listening" : "reading";
  setValueAttr(`${prefix}-choice-a`, choices[0] || "");
  setValueAttr(`${prefix}-choice-b`, choices[1] || "");
  setValueAttr(`${prefix}-choice-c`, choices[2] || "");
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

export function setScoreHUD(score, hp) {
  setText("score-display", String(score ?? 0));
  setText("hp-display", `${hp ?? 0}%`);

  const hpWrap = $("hud-hp-wrap");
  const hpIcon = hpWrap ? hpWrap.querySelector(".hud-stat-icon") : null;
  const ui = $("ui-container");

  if (!hpWrap || !hpIcon || !ui) return;

  hpWrap.classList.remove("hud-stat-warning", "hud-stat-critical");
  ui.classList.remove("mission-hp-warning", "mission-hp-critical");

  const safeHp = Number(hp ?? 0);

  if (safeHp <= 15) {
    hpWrap.classList.add("hud-stat-critical");
    ui.classList.add("mission-hp-critical");
    hpIcon.textContent = "💔";
  } else if (safeHp <= 35) {
    hpWrap.classList.add("hud-stat-warning");
    ui.classList.add("mission-hp-warning");
    hpIcon.textContent = "❤️";
  } else {
    hpIcon.textContent = "❤️";
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
  if (!box || !labelEl || !textEl) return;

  labelEl.textContent = label;
  textEl.textContent = text || "";
  box.style.display = text ? "block" : "none";
}

export function clearMissionPrompt() {
  const box = $("mission-prompt-box");
  const textEl = $("mission-prompt-text");
  if (textEl) textEl.textContent = "";
  if (box) box.style.display = "none";
}

let feedbackClearTimer = null;
export function scheduleFeedbackClear(ms = 1200) {
  clearTimeout(feedbackClearTimer);
  feedbackClearTimer = setTimeout(() => {
    const ui = $("ui-container");
    const feedback = $("feedback");
    if (!ui || !feedback) return;
    if (ui.classList.contains("mission-mode")) feedback.textContent = "";
  }, ms);
}

export function cancelFeedbackClear() {
  clearTimeout(feedbackClearTimer);
}

let missionHeaderTimer = null;
export function scheduleMissionHeaderCollapse(ms = 1100) {
  clearTimeout(missionHeaderTimer);
  missionHeaderTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-header-collapsed");
  }, ms);
}

export function expandMissionHeader() {
  clearTimeout(missionHeaderTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-header-collapsed");
}

let missionStatsTimer = null;
export function scheduleMissionStatsCollapse(ms = 1200) {
  clearTimeout(missionStatsTimer);
  missionStatsTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-stats-collapsed");
  }, ms);
}

export function expandMissionStats(autoCollapseMs = 0) {
  clearTimeout(missionStatsTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-stats-collapsed");
  if (ui.classList.contains("mission-mode") && autoCollapseMs > 0) {
    scheduleMissionStatsCollapse(autoCollapseMs);
  }
}

let missionPromptTimer = null;
export function scheduleMissionPromptChromeCollapse(ms = 1200) {
  clearTimeout(missionPromptTimer);
  missionPromptTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-prompt-collapsed");
  }, ms);
}

export function expandMissionPromptChrome() {
  clearTimeout(missionPromptTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-prompt-collapsed");
}

let bossChromeTimer = null;
export function scheduleBossChromeCollapse(ms = 1300) {
  clearTimeout(bossChromeTimer);
  bossChromeTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("boss-chrome-collapsed");
  }, ms);
}

export function expandBossChrome() {
  clearTimeout(bossChromeTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("boss-chrome-collapsed");
}

let topChipsTimer = null;
export function scheduleMissionTopChipsCollapse(ms = 1000) {
  clearTimeout(topChipsTimer);
  topChipsTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-topchips-collapsed");
  }, ms);
}

export function expandMissionTopChips() {
  clearTimeout(topChipsTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-topchips-collapsed");
}

let missionTitleMiniTimer = null;
export function scheduleMissionTitleUltraMini(ms = 1350) {
  clearTimeout(missionTitleMiniTimer);
  missionTitleMiniTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-title-ultramini");
  }, ms);
}

export function expandMissionTitleUltraMini() {
  clearTimeout(missionTitleMiniTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-title-ultramini");
}

let missionTimerChromeTimer = null;
export function scheduleMissionTimerCompact(ms = 1200) {
  clearTimeout(missionTimerChromeTimer);
  missionTimerChromeTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-timer-compact");
  }, ms);
}

export function expandMissionTimer(autoCompactMs = 0) {
  clearTimeout(missionTimerChromeTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-timer-compact");
  if (ui.classList.contains("mission-mode") && autoCompactMs > 0) {
    scheduleMissionTimerCompact(autoCompactMs);
  }
}

export function setMissionTimerAlert(on = false) {
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.toggle("mission-timer-alert", !!on);
}

let missionHudTextTimer = null;
export function scheduleMissionHudTextCompact(ms = 1250) {
  clearTimeout(missionHudTextTimer);
  missionHudTextTimer = setTimeout(() => {
    const ui = $("ui-container");
    if (!ui) return;
    if (ui.classList.contains("mission-mode")) ui.classList.add("mission-hudtext-compact");
  }, ms);
}

export function expandMissionHudTextCompact(autoCompactMs = 0) {
  clearTimeout(missionHudTextTimer);
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("mission-hudtext-compact");
  if (ui.classList.contains("mission-mode") && autoCompactMs > 0) {
    scheduleMissionHudTextCompact(autoCompactMs);
  }
}

let promptFocusExpanded = false;
export function setPromptFocusExpanded(expanded = false) {
  promptFocusExpanded = !!expanded;
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.toggle("mission-prompt-focus-expanded", promptFocusExpanded);
}

export function togglePromptFocusExpanded() {
  setPromptFocusExpanded(!promptFocusExpanded);
}

export function resetPromptFocusExpanded() {
  setPromptFocusExpanded(false);
}
