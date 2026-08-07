(function () {
  "use strict";

  const VERSION = "2026-08-07-FIRESTORE-DIRECT-UI-V1";
  const authority = window.EW_AUTHORITY;
  let scheduled = false;

  function runtime() {
    return authority?.getRuntimeStatus?.() || { mode: "unknown", endpointReady: false };
  }

  function bannerText(status) {
    if (status.mode === "firebase") return { text: "● เชื่อมต่อ Cloud Firestore แล้ว", ok: true };
    if (status.mode === "error") return { text: "⚠ Firebase ยังไม่พร้อม • ตรวจ Authentication / Firestore Rules", ok: false };
    if (status.endpointReady) return { text: "◌ กำลังเชื่อมต่อ Cloud Firestore…", ok: false };
    return { text: "⚠ Firebase Web SDK / Web App config ยังไม่พร้อม", ok: false };
  }

  function setTextIfChanged(element, text) {
    if (!element || element.textContent === text) return false;
    element.textContent = text;
    return true;
  }

  function setClassIfChanged(element, name, enabled) {
    if (!element || element.classList.contains(name) === Boolean(enabled)) return false;
    element.classList.toggle(name, Boolean(enabled));
    return true;
  }

  function patchNow() {
    scheduled = false;
    const status = runtime();
    const banner = document.querySelector(".status-banner");
    if (banner) {
      const value = bannerText(status);
      setTextIfChanged(banner, value.text);
      setClassIfChanged(banner, "ok", value.ok);
    }

    document.querySelectorAll(".note").forEach(note => {
      const current = note.textContent || "";
      if (/Google Sheet|Web App URL|Cloud Authority/.test(current)) {
        setTextIfChanged(note, "ข้อมูลจริงอ่านและบันทึกใน Firebase Cloud Firestore; localStorage ใช้เฉพาะ cache/recovery");
      }
    });
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(patchNow);
  }

  window.addEventListener("ew-authority-status", schedulePatch);
  new MutationObserver(schedulePatch).observe(document.getElementById("screen") || document.body, {
    childList: true,
    subtree: true
  });

  patchNow();
  authority?.health?.().then(schedulePatch).catch(schedulePatch);
  window.EW_FIREBASE_UI_PATCH = Object.freeze({ version: VERSION });
}());
