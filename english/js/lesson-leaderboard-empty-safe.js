// /english/js/lesson-leaderboard-empty-safe.js
// PATCH v20260426-leaderboard-empty-safe-r1
// ✅ กันหน้า lesson ค้าง Loading หลังลบ RTDB /data/vr_leaderboards เป็น null
// ✅ ทำให้ Object.keys / values / entries รองรับ null เฉพาะกรณี leaderboard ว่าง
// ✅ ไม่ลบระบบ leaderboard จริง ใช้งานจริงยังบันทึกคะแนนใหม่ได้
// ✅ กรอง record placeholder เช่น _empty / hidden
// ✅ มี fallback ปลด loading ถ้า error เกิดจาก leaderboard ว่าง

(function () {
  "use strict";

  const PATCH = "v20260426-leaderboard-empty-safe-r1";

  window.TECHPATH_LEADERBOARD_EMPTY_SAFE_PATCH = PATCH;
  window.TECHPATH_LEADERBOARD_EMPTY_SAFE = true;

  const nativeKeys = Object.keys;
  const nativeValues = Object.values;
  const nativeEntries = Object.entries;

  function isNullish(value) {
    return value === null || value === undefined;
  }

  function isLeaderboardLikeStack(stack = "") {
    const s = String(stack || "").toLowerCase();
    return (
      s.includes("leaderboard") ||
      s.includes("vr_leaderboards") ||
      s.includes("lesson-main") ||
      s.includes("lesson.js")
    );
  }

  function isLeaderboardNullError(message = "", stack = "") {
    const msg = String(message || "").toLowerCase();
    const st = String(stack || "").toLowerCase();

    const nullObjectError =
      msg.includes("cannot convert undefined or null to object") ||
      msg.includes("cannot read properties of null") ||
      msg.includes("cannot read properties of undefined") ||
      msg.includes("undefined or null");

    return nullObjectError && isLeaderboardLikeStack(st + " " + msg);
  }

  // กันโค้ดเดิมที่อาจทำ Object.entries(snapshot.val()) ตอน snapshot.val() เป็น null
  if (!Object.__techpathLeaderboardSafePatched) {
    Object.keys = function techpathSafeKeys(value) {
      if (isNullish(value)) return [];
      return nativeKeys(value);
    };

    Object.values = function techpathSafeValues(value) {
      if (isNullish(value)) return [];
      return nativeValues(value);
    };

    Object.entries = function techpathSafeEntries(value) {
      if (isNullish(value)) return [];
      return nativeEntries(value);
    };

    Object.__techpathLeaderboardSafePatched = true;
  }

  function normalizeLeaderboardData(raw) {
    const safeRaw = raw && typeof raw === "object" ? raw : {};

    return nativeEntries(safeRaw)
      .map(([id, item]) => {
        const row = item && typeof item === "object" ? item : {};
        return {
          id,
          ...row,
          name: String(row.name || row.displayName || row.playerName || "").trim(),
          score: Number(row.score || row.bestScore || 0),
          createdAt: Number(row.createdAt || row.updatedAt || row.ts || 0)
        };
      })
      .filter((row) => row.id !== "_empty")
      .filter((row) => row.hidden !== true)
      .filter((row) => row.name)
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 5);
  }

  function getEmptyLeaderboardText() {
    return "TOP 5 LEGENDS\n\nNo scores yet";
  }

  function safeSetTextAttribute(el, value) {
    if (!el || typeof el.setAttribute !== "function") return false;

    try {
      const oldText = el.getAttribute("text");

      if (oldText != null) {
        el.setAttribute("text", `value: ${value}; align: center; color: #ffffff; wrapCount: 22`);
        return true;
      }

      if (el.getAttribute("value") != null) {
        el.setAttribute("value", value);
        return true;
      }

      if ("textContent" in el) {
        el.textContent = value;
        return true;
      }
    } catch (_) {}

    return false;
  }

  function paintEmptyLeaderboard() {
    const text = getEmptyLeaderboardText();

    const selectors = [
      "#leaderboard",
      "#leaderboard-board",
      "#leaderboard-text",
      "#leaderboard-panel",
      "#vr-leaderboard",
      "#vr-leaderboard-text",
      "[id*='leaderboard' i]",
      "[id*='leader' i]",
      "[class*='leaderboard' i]",
      "[class*='leader' i]"
    ];

    let painted = 0;

    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          const existing = String(
            el.textContent ||
            el.getAttribute("value") ||
            el.getAttribute("text") ||
            ""
          ).toLowerCase();

          if (
            existing.includes("top") ||
            existing.includes("legend") ||
            existing.includes("leader") ||
            existing.includes("best mission")
          ) {
            if (safeSetTextAttribute(el, text)) painted += 1;
          }
        });
      } catch (_) {}
    });

    return painted;
  }

  function hideLoading(reason = "leaderboard-empty-safe") {
    const loading = document.getElementById("loading");
    if (!loading) return;

    try {
      loading.dataset.safeHiddenBy = reason;
      loading.style.opacity = "0";
      loading.style.pointerEvents = "none";

      setTimeout(() => {
        loading.style.display = "none";
      }, 280);
    } catch (_) {}
  }

  function showSoftNotice(message) {
    let box = document.getElementById("techpath-safe-notice");

    if (!box) {
      box = document.createElement("div");
      box.id = "techpath-safe-notice";
      box.style.cssText = [
        "position:fixed",
        "left:12px",
        "right:12px",
        "bottom:calc(12px + env(safe-area-inset-bottom,0px))",
        "z-index:99998",
        "padding:12px 14px",
        "border-radius:16px",
        "background:rgba(10,18,34,.94)",
        "border:1px solid rgba(123,237,255,.28)",
        "color:#eaf6ff",
        "font:700 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "box-shadow:0 12px 26px rgba(0,0,0,.28)",
        "text-align:center"
      ].join(";");

      document.body.appendChild(box);
    }

    box.textContent = message;

    setTimeout(() => {
      try {
        box.remove();
      } catch (_) {}
    }, 4500);
  }

  function recoverFromLeaderboardEmpty(reason = "leaderboard-empty") {
    console.warn(`[TechPath Leaderboard Safe] recover: ${reason}`);

    try {
      paintEmptyLeaderboard();
    } catch (_) {}

    setTimeout(() => {
      hideLoading(reason);
    }, 120);

    setTimeout(() => {
      const loading = document.getElementById("loading");
      const stillLoading =
        loading &&
        loading.style.display !== "none" &&
        getComputedStyle(loading).display !== "none";

      if (stillLoading) {
        showSoftNotice("Leaderboard ว่างแล้ว ระบบกำลังเปิดหน้าเรียนต่อ...");
        hideLoading("leaderboard-empty-fallback");
      }
    }, 2500);
  }

  window.TechPathLeaderboardSafe = {
    PATCH,
    normalizeLeaderboardData,
    getEmptyLeaderboardText,
    paintEmptyLeaderboard,
    recoverFromLeaderboardEmpty
  };

  window.addEventListener(
    "error",
    (event) => {
      const message = event?.message || "";
      const stack = event?.error?.stack || "";

      if (isLeaderboardNullError(message, stack)) {
        event.preventDefault();
        recoverFromLeaderboardEmpty("window-error");
        return false;
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event?.reason;
      const message = reason?.message || String(reason || "");
      const stack = reason?.stack || "";

      if (isLeaderboardNullError(message, stack)) {
        event.preventDefault();
        recoverFromLeaderboardEmpty("promise-rejection");
        return false;
      }
    },
    true
  );

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      setTimeout(() => {
        try {
          paintEmptyLeaderboard();
        } catch (_) {}
      }, 1200);

      setTimeout(() => {
        const loading = document.getElementById("loading");
        if (!loading) return;

        const visible =
          loading.style.display !== "none" &&
          getComputedStyle(loading).display !== "none" &&
          getComputedStyle(loading).opacity !== "0";

        const bodyHasMode =
          document.body.classList.contains("hub-mode") ||
          document.body.classList.contains("mission-mode") ||
          document.body.classList.contains("summary-mode");

        if (visible && bodyHasMode) {
          hideLoading("loading-left-open");
        }
      }, 6000);
    },
    { once: true }
  );

  console.log(`[TechPath Leaderboard Safe] ${PATCH} loaded`);
})();