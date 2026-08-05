(function () {
  "use strict";

  const VERSION = "2026-08-05-CATEGORY-PORTAL-ROUTE-V5";
  const GAME_URL = "./category-forest-v5.html?from=passport&v=20260805-category-prod5";
  const selector = '.stage-card[data-stage="category_forest"].clickable';

  function decorateCard() {
    const card = document.querySelector('.stage-card[data-stage="category_forest"]');
    if (!card || card.dataset.portalDecorated === "1") return;
    card.dataset.portalDecorated = "1";
    card.classList.add("portal-stage-card");
    const detail = card.querySelector("small");
    if (detail) detail.textContent = "Portal Mission • Seeded P1–P4 • Auto Pronounce";
    const state = card.querySelector(".stage-state");
    if (state && card.classList.contains("ready")) state.innerHTML = "พร้อมเล่น 🌲";
  }

  function openPortal(event) {
    const card = event.target && event.target.closest ? event.target.closest(selector) : null;
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = GAME_URL;
  }

  function openPortalByKeyboard(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    openPortal(event);
  }

  function autoResumeFromGame() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;
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
    .stage-card.portal-stage-card.ready{border-color:#51c991;background:linear-gradient(135deg,#f5fffa,#eef9ff)}
    .stage-card.portal-stage-card .stage-icon{background:linear-gradient(135deg,#dff9ec,#e5f4ff)}
  `;
  document.head.appendChild(style);

  document.addEventListener("click", openPortal, true);
  document.addEventListener("keydown", openPortalByKeyboard, true);
  new MutationObserver(decorateCard).observe(document.getElementById("screen") || document.body, { childList:true, subtree:true });
  decorateCard();
  window.setTimeout(autoResumeFromGame, 60);
  window.EW_CATEGORY_PORTAL_ROUTE = Object.freeze({ version: VERSION, gameUrl: GAME_URL });
}());
