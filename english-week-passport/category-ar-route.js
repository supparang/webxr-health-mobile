(function () {
  "use strict";

  const AR_URL = "./category-ar.html?v=20260803-category3";
  const selector = '.stage-card[data-stage="category_forest"].clickable';

  function decorateCard() {
    const card = document.querySelector('.stage-card[data-stage="category_forest"]');
    if (!card || card.dataset.arDecorated === "1") return;
    card.dataset.arDecorated = "1";
    card.classList.add("ar-stage-card");
    const detail = card.querySelector("small");
    if (detail && !detail.textContent.includes("AR")) detail.textContent += " • AR Camera/Fallback";
    const state = card.querySelector(".stage-state");
    if (state && card.classList.contains("ready")) state.innerHTML = "AR พร้อมเล่น 📷";
  }

  function openAr(event) {
    const card = event.target && event.target.closest ? event.target.closest(selector) : null;
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = AR_URL;
  }

  function openArByKeyboard(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    openAr(event);
  }

  function autoResumeFromAr() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;
    let identity = null;
    try {
      identity = JSON.parse(localStorage.getItem(window.EW_CONFIG.cacheKeys.identity) || "null");
    } catch (_) {}
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
    .stage-card.ar-stage-card.ready{border-color:#51c991;background:linear-gradient(135deg,#f5fffa,#eef9ff)}
    .stage-card.ar-stage-card .stage-icon{background:linear-gradient(135deg,#dff9ec,#e5f4ff)}
  `;
  document.head.appendChild(style);

  document.addEventListener("click", openAr, true);
  document.addEventListener("keydown", openArByKeyboard, true);
  new MutationObserver(decorateCard).observe(document.getElementById("screen") || document.body, { childList:true, subtree:true });
  decorateCard();
  window.setTimeout(autoResumeFromAr, 60);
}());
