const params = new URLSearchParams(location.search);
const mode = String(params.get("authority") || "sheet").toLowerCase();
const enabled = mode === "firebase" || mode === "dual";

// Recovery build: never block Passport rendering, never reload, and never patch timers.
if (enabled) {
  document.documentElement.dataset.hhAuthority = mode;
  window.HH_AUTHORITY_MODE = mode;
  window.HH_DISABLE_SHEET_RESUME = mode === "firebase";

  const releaseOverlay = () => {
    document.querySelectorAll("#hh-sheet-login-status").forEach((node) => node.remove());
    document.documentElement.dataset.hhLoginBusy = "0";
    document.documentElement.style.pointerEvents = "auto";
    document.body.style.overflow = "";
    document.body.style.pointerEvents = "auto";

    const app = document.getElementById("app");
    if (app) app.style.pointerEvents = "auto";
    document.querySelectorAll("#app button, #app a, #app input, #app select").forEach((node) => {
      node.style.pointerEvents = "auto";
    });

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    document.querySelectorAll("body *").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.id === "app" || node.id === "hh-firebase-authority-badge") return;
      if (node.closest("#app")) return;

      const style = getComputedStyle(node);
      if (style.position !== "fixed") return;
      const rect = node.getBoundingClientRect();
      const coversScreen = rect.width >= vw * 0.8 && rect.height >= vh * 0.8;
      if (!coversScreen) return;

      const signature = `${node.id} ${node.className} ${node.getAttribute("role") || ""}`.toLowerCase();
      const knownBlocker = /(overlay|loading|loader|blocker|busy|authority|guard|backdrop|sheet-login|modal)/.test(signature);
      const visuallyEmpty = Number.parseFloat(style.opacity || "1") <= 0.05 || style.backgroundColor === "rgba(0, 0, 0, 0)";

      if (knownBlocker || visuallyEmpty) {
        console.warn("[HeroHealth Firebase recovery] released blocker", node.id || node.className || node.tagName);
        node.style.pointerEvents = "none";
        if (knownBlocker) node.style.display = "none";
      }
    });
  };

  const showRecoveryBadge = () => {
    releaseOverlay();
    if (document.getElementById("hh-firebase-authority-badge")) return;
    const node = document.createElement("div");
    node.id = "hh-firebase-authority-badge";
    node.textContent = "Firebase recovery mode • Interaction restored";
    Object.assign(node.style, {
      position: "fixed",
      left: "12px",
      bottom: "12px",
      zIndex: "99999",
      padding: "8px 11px",
      borderRadius: "999px",
      font: "700 12px system-ui",
      background: "#ecfdf5",
      color: "#166534",
      border: "1px solid #bbf7d0",
      boxShadow: "0 8px 24px rgba(15,23,42,.14)",
      pointerEvents: "none"
    });
    document.body.appendChild(node);
  };

  const bootRecovery = () => {
    showRecoveryBadge();
    [100, 500, 1200, 2500].forEach((delay) => window.setTimeout(releaseOverlay, delay));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootRecovery, { once: true });
  } else {
    bootRecovery();
  }
}
