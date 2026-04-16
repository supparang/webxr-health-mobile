// lesson-ui.js

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
