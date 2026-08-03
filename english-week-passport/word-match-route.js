(function () {
  "use strict";

  const MEMORY_URL = "./word-match-memory.html?v=20260803-memory3";
  const selector = '.stage-card[data-stage="word_match"].clickable';

  function decorateCard() {
    const card = document.querySelector('.stage-card[data-stage="word_match"]');
    if (!card || card.dataset.memoryDecorated === "1") return;
    card.dataset.memoryDecorated = "1";
    card.classList.add("memory-stage-card");
    const detail = card.querySelector("small");
    if (detail) detail.textContent = "Tilt Snap + Dwell • A2–B1+ • Rotated Set";
    const state = card.querySelector(".stage-state");
    if (state && card.classList.contains("ready")) state.innerHTML = "Tilt Snap พร้อมเล่น 🧩";
  }

  function openMemory(event) {
    const card = event.target && event.target.closest ? event.target.closest(selector) : null;
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = MEMORY_URL;
  }

  function openMemoryByKeyboard(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    openMemory(event);
  }

  function autoResumeFromMemory() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "memory") return;
    let identity = null;
    try { identity = JSON.parse(localStorage.getItem(window.EW_CONFIG.cacheKeys.identity) || "null"); }
    catch (_) {}
    if (!identity?.playerId) return;
    const form = document.getElementById("loginForm");
    const playerInput = document.getElementById("playerId");
    if (!form || !playerInput) return;
    playerInput.value = identity.playerId;
    const nicknameInput = document.getElementById("nickname");
    if (nicknameInput) nicknameInput.value = identity.nickname || identity.fullName || "";
    params.delete("resume");
    const cleanQuery = params.toString();
    history.replaceState(null, "", `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`);
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { bubbles:true, cancelable:true }));
  }

  const style = document.createElement("style");
  style.textContent = `
    .stage-card.memory-stage-card.ready{border-color:#ffbd2e;background:linear-gradient(135deg,#fffdf2,#eef8ff)}
    .stage-card.memory-stage-card .stage-icon{background:linear-gradient(135deg,#fff3c9,#e9f5ff);position:relative}
    .stage-card.passed.memory-stage-card .stage-icon::after{content:" SNAP";font-size:.42rem;font-weight:900;color:#8a6200;position:absolute;margin-top:48px}
  `;
  document.head.appendChild(style);

  document.addEventListener("click", openMemory, true);
  document.addEventListener("keydown", openMemoryByKeyboard, true);
  new MutationObserver(decorateCard).observe(document.getElementById("screen") || document.body, { childList:true, subtree:true });
  decorateCard();
  window.setTimeout(autoResumeFromMemory, 70);
}());
