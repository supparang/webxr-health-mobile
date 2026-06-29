/* EAP Word Quest v210 stable summary patch */
(() => {
  "use strict";
  if (window.__EAP_WORD_V210_MOBILE_SUMMARY__) return;
  window.__EAP_WORD_V210_MOBILE_SUMMARY__ = true;
  const $ = id => document.getElementById(id);
  const compact = () => {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return;
    const labels = { Accuracy:"ความแม่นยำ", Correct:"ตอบถูก", "Max Combo":"คอมโบสูงสุด", Status:"สถานะ" };
    screen.querySelectorAll("#summaryStats span").forEach(node => {
      const raw = node.dataset.eapV210Raw || node.textContent.trim();
      if (!node.dataset.eapV210Raw) node.dataset.eapV210Raw = raw;
      if (labels[raw] && node.textContent !== labels[raw]) node.textContent = labels[raw];
    });
  };
  document.addEventListener("click", () => setTimeout(compact,120), true);
  window.addEventListener("eap-core-run-finished", () => setTimeout(compact,160));
  setTimeout(compact,500);
  window.inspectEapV210 = () => ({ version:"v210-stable", active:Boolean($("summaryScreen")?.classList.contains("active")) });
})();
