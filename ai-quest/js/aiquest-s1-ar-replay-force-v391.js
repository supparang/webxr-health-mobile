/* AI Quest S1 AR Replay Force Patch
   File: /ai-quest/js/aiquest-s1-ar-replay-force-v391.js
   Purpose:
   - S1 AR remains an optional supplementary practice.
   - Completed learners can always enter S1 AR again.
   - Uses capture-phase click handling to prevent old handlers from cancelling replay.
*/
(() => {
  "use strict";

  const q = new URLSearchParams(location.search);
  const session = String(q.get("session") || "").toLowerCase();
  const ar = String(q.get("ar") || "").toLowerCase();
  const isNormalS1 = (session === "s1" || session === "m1") && !ar;

  if (!isNormalS1) return;

  const isS1ArButton = (button) => {
    if (!button) return false;
    const text = String(button.textContent || "").replace(/\s+/g, " ").trim();
    const card = button.closest("section, article, div");
    const cardText = String(card?.textContent || "").replace(/\s+/g, " ").trim();

    return (
      /^(เริ่ม AR Practice|ฝึก AR อีกครั้ง)$/i.test(text) &&
      /S1 AR Practice:\s*AI Object Scanner/i.test(cardText)
    );
  };

  const launch = () => {
    location.assign("./index.html?session=s1&ar=hand&from=s1&replay=1&v=20260627-s1replay391");
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button, a");
    if (!isS1ArButton(button)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    launch();
  }, true);

  console.log("[AIQuest S1 AR] replay launcher armed v391");
})();
