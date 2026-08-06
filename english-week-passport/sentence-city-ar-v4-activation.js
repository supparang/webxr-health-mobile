(function () {
  "use strict";

  const game = window.SENTENCE_CITY;
  const screen = document.getElementById("screen");
  if (!game || !screen) return;

  const state = game.state;

  screen.addEventListener("click", event => {
    const target = event.target?.closest?.(".word-chip");
    if (!target || event.isTrusted || target.disabled || target.classList.contains("used")) return;

    const item = state.items?.find(value => value.id === target.dataset.token);
    if (!item) return;

    state.tapCount = Number(state.tapCount || 0) + 1;
    const selectedSame = state.selected?.type === "depot" && state.selected.id === item.id;
    state.selected = selectedSame ? null : {
      type: "depot",
      id: item.id,
      label: item.label
    };

    document.querySelectorAll(".word-chip.selected").forEach(element => element.classList.remove("selected"));
    if (state.selected) target.classList.add("selected");
  }, true);

  window.SENTENCE_CITY_AR_ACTIVATION = Object.freeze({
    version: "2026-08-06-SENTENCE-CITY-AR-ACTIVATION-V1",
    mode: "untrusted-click-to-depot-selection"
  });
}());
