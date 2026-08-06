(function () {
  "use strict";

  const authority = window.EW_AUTHORITY;

  function runtime() {
    return authority?.getRuntimeStatus?.() || { mode: "unknown", endpointReady: false };
  }

  function bannerText(status) {
    if (status.mode === "firebase") return { text: "● เชื่อมต่อ Firebase Authority แล้ว", ok: true };
    if (status.mode === "demo-fallback") return { text: "⚠ Firebase ยังไม่พร้อม • ใช้ Local QA fallback ชั่วคราว", ok: false };
    if (status.mode === "error") return { text: "⚠ Firebase Authority ยังไม่ตอบสนอง • ยังไม่ใช่ Production", ok: false };
    if (status.endpointReady) return { text: "◌ กำลังตรวจสอบ Firebase Authority…", ok: false };
    return { text: "ยังไม่ได้กำหนด Firebase Authority endpoint", ok: false };
  }

  function patch() {
    const status = runtime();
    const banner = document.querySelector(".status-banner");
    if (banner) {
      const value = bannerText(status);
      banner.textContent = value.text;
      banner.classList.toggle("ok", value.ok);
    }
    document.querySelectorAll(".note").forEach(note => {
      if (/Google Sheet|Web App URL/.test(note.textContent || "")) {
        note.textContent = "ข้อมูลความก้าวหน้าในระบบจริงอ่านจาก Firebase Cloud Authority ทุกครั้ง ไม่ใช้สถานะในเครื่องเป็นหลัก";
      }
    });
  }

  window.addEventListener("ew-authority-status", patch);
  new MutationObserver(patch).observe(document.getElementById("screen") || document.body, {
    childList: true,
    subtree: true
  });
  patch();

  authority?.health?.().catch(() => patch());
}());
