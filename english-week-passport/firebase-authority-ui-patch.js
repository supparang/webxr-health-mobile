(function () {
  "use strict";

  const VERSION = "2026-08-18-FIRESTORE-DIRECT-UI-V3-PRESERVE-ERRORS";
  let scheduled = false;

  function authority() {
    return window.EW_AUTHORITY || null;
  }

  function runtime() {
    try {
      return authority()?.getRuntimeStatus?.() || { mode: "unknown", endpointReady: false };
    } catch (_) {
      return { mode: "unknown", endpointReady: false };
    }
  }

  function bannerText(status) {
    if (status.mode === "firebase") return { text: "● เชื่อมต่อ Cloud Firestore แล้ว", ok: true };
    if (status.mode === "error") {
      const detail = String(status.lastError || "").trim();
      return {
        text: detail ? `⚠ Firebase error: ${detail}` : "⚠ Firebase ยังไม่พร้อม",
        ok: false
      };
    }
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

  function patchAssessmentCompletionLabels() {
    ["pre_challenge", "post_challenge"].forEach(stageId => {
      const card = document.querySelector(`.stage-card[data-stage="${stageId}"]`);
      if (!card || !card.classList.contains("passed")) return;
      const state = card.querySelector(".stage-state");
      setTextIfChanged(state, "ทำครบแล้ว ✓");
    });
  }

  function patchNow() {
    scheduled = false;
    const status = runtime();

    // IMPORTANT: the application writes the real submit exception into
    // .status-banner.error. Never replace that message with a generic
    // connection banner; otherwise production debugging becomes blind.
    const banners = document.querySelectorAll(".status-banner");
    banners.forEach(banner => {
      if (banner.classList.contains("error")) {
        const current = String(banner.textContent || "").trim();
        const generic = current === "⚠ Firebase ยังไม่พร้อม • ตรวจ Authentication / Firestore Rules";
        if (generic && status.lastError) {
          setTextIfChanged(banner, `Firebase error: ${String(status.lastError)}`);
        }
        return;
      }
      const value = bannerText(status);
      setTextIfChanged(banner, value.text);
      setClassIfChanged(banner, "ok", value.ok);
    });

    document.querySelectorAll(".note").forEach(note => {
      const current = note.textContent || "";
      if (/Google Sheet|Web App URL|Cloud Authority/.test(current)) {
        setTextIfChanged(note, "ข้อมูลจริงอ่านและบันทึกใน Firebase Cloud Firestore; localStorage ใช้เฉพาะ cache/recovery");
      }
    });

    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) setTextIfChanged(refreshBtn, "↻ โหลดสถานะจาก Firestore");

    patchAssessmentCompletionLabels();
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
  authority()?.health?.().then(schedulePatch).catch(schedulePatch);
  window.EW_FIREBASE_UI_PATCH = Object.freeze({ version: VERSION, preservesErrorBanner: true });
}());
