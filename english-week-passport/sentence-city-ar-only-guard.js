(function () {
  "use strict";

  const BLOCKED_SELECTOR = ".word-chip,.sentence-slot,#checkBtn,#hintBtn,#speakTask";

  function isBlockedTarget(target) {
    return Boolean(target?.closest?.(BLOCKED_SELECTOR));
  }

  ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click"].forEach(type => {
    document.addEventListener(type, event => {
      if (!event.isTrusted || !isBlockedTarget(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const guide = document.getElementById("sentenceArGuide");
      if (guide) {
        guide.innerHTML = "โหมด AR-only <small>ใช้มือชี้และจีบนิ้วเพื่อเลือกคำ วางคำ และกดตรวจประโยค</small>";
      }
    }, true);
  });

  function patchUi() {
    document.documentElement.classList.add("sentence-ar-only");
    document.querySelectorAll("#sentenceArTouch").forEach(element => element.remove());

    const intro = document.querySelector(".intro");
    if (intro && !intro.dataset.arOnly) {
      intro.dataset.arOnly = "1";
      const heading = intro.querySelector("h2");
      if (heading) heading.textContent = "Skyline Builder • AR-only Hand Control";
      intro.querySelectorAll(".feature").forEach(feature => {
        if (/Touch|fallback/i.test(feature.textContent || "")) feature.remove();
      });
    }

    const instruction = document.getElementById("instruction");
    if (instruction && !document.getElementById("sentenceArPanel")) {
      instruction.textContent = "เตรียม AR Hand Mode • ทุกภารกิจควบคุมด้วยการชี้และจีบนิ้ว";
    }
  }

  new MutationObserver(patchUi).observe(document.getElementById("screen") || document.body, {
    childList: true,
    subtree: true
  });

  window.SENTENCE_CITY_AR_ONLY = Object.freeze({
    version: "2026-08-06-SENTENCE-CITY-AR-ONLY-GUARD-V1",
    mode: "ar-only",
    blockedSelector: BLOCKED_SELECTOR
  });

  patchUi();
}());
