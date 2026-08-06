(function () {
  "use strict";

  let launching = false;

  function launch(button) {
    if (launching || !button || typeof button.onclick !== "function") return false;
    launching = true;
    button.disabled = true;
    button.textContent = "กำลังเปิด AR Skyline…";
    try {
      button.onclick.call(button);
      return true;
    } catch (error) {
      console.error("Sentence City AR-only start failed", error);
      launching = false;
      button.disabled = false;
      button.textContent = "Start Skyline Mission";
      const note = document.querySelector(".mission-note");
      if (note) note.textContent = `เริ่มเกมไม่สำเร็จ: ${String(error?.message || error)}`;
      return false;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("#startBtn");
    if (!button || event.__sentenceCityRecovered) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.__sentenceCityRecovered = true;
    launch(button);
  }, true);

  document.addEventListener("pointerup", event => {
    const button = event.target?.closest?.("#startBtn");
    if (!button || launching) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    launch(button);
  }, true);

  new MutationObserver(() => {
    const button = document.getElementById("startBtn");
    if (!button || button.dataset.startRecovery) return;
    button.dataset.startRecovery = "1";
    button.style.pointerEvents = "auto";
    button.style.touchAction = "manipulation";
    button.setAttribute("aria-label", "เริ่มภารกิจ Sentence City AR-only");
  }).observe(document.getElementById("screen") || document.body, {
    childList: true,
    subtree: true
  });

  window.SENTENCE_CITY_START_RECOVERY = Object.freeze({
    version: "2026-08-06-SENTENCE-CITY-START-RECOVERY-V1",
    launch: () => launch(document.getElementById("startBtn"))
  });
}());
