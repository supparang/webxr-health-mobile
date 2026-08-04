const params = new URLSearchParams(location.search);
const mode = String(params.get("authority") || "sheet").toLowerCase();
const enabled = mode === "firebase" || mode === "dual";

// Recovery build: never block Passport rendering, never reload, and never patch timers.
// Firebase migration remains paused until the isolated launcher test passes.
if (enabled) {
  document.documentElement.dataset.hhAuthority = mode;
  window.HH_AUTHORITY_MODE = mode;
  window.HH_DISABLE_SHEET_RESUME = mode === "firebase";

  const releaseOverlay = () => {
    document.querySelectorAll("#hh-sheet-login-status").forEach((node) => node.remove());
    document.documentElement.dataset.hhLoginBusy = "0";
    document.body.style.overflow = "";
  };

  const showRecoveryBadge = () => {
    releaseOverlay();
    if (document.getElementById("hh-firebase-authority-badge")) return;
    const node = document.createElement("div");
    node.id = "hh-firebase-authority-badge";
    node.textContent = "Firebase recovery mode • Passport พร้อมใช้งาน";
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
      boxShadow: "0 8px 24px rgba(15,23,42,.14)"
    });
    document.body.appendChild(node);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showRecoveryBadge, { once: true });
  } else {
    showRecoveryBadge();
  }
}
