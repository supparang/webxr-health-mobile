// /english/js/lesson-attendance-sheet.js
// PATCH v20260423-sheet-r1
// ✅ ส่ง attendance_session เข้า Google Apps Script / Google Sheet
// ✅ ไม่ต้องแก้ lesson-main.js เพิ่ม
// ✅ hook กับ loadMission / answer / speak / audio / next / return
// ✅ ส่ง page_enter / start / pulse / finish / leave

(function () {
  "use strict";

  const PATCH = "v20260423-sheet-r1";
  const LESSON_ID = "techpath-vr";
  const MIN_ACTIVE_SEC = 30;
  const PULSE_EVERY_SEC = 10;

  const qs = new URLSearchParams(location.search);

  const visitId =
    sessionStorage.getItem("TECHPATH_VISIT_ID") ||
    `PAGE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  sessionStorage.setItem("TECHPATH_VISIT_ID", visitId);

  const state = {
    enteredAt: new Date().toISOString(),
    startedAt: "",
    finishedAt: "",
    lastActiveAt: new Date().toISOString(),
    sessionNo: "S00",
    status: "tracking",
    durationSec: 0,
    activeTimeSec: 0,
    actionsCount: 0,
    score: 0,
    completed: false,
    currentMissionId: "",
    lastSendAt: 0,
    lastFinishKey: "",
    hookReady: false
  };

  let pulseTimer = null;
  let hookTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function text(id) {
    return String($(id)?.textContent || "").trim();
  }

  function getEndpoint() {
    return String(window.TECHPATH_ATTENDANCE_ENDPOINT || "").trim();
  }

  function firstValue(...values) {
    for (const v of values) {
      const s = String(v || "").trim();
      if (s) return s;
    }
    return "";
  }

  function readIdentity() {
    const studentId = firstValue(
      qs.get("studentId"),
      qs.get("sid"),
      qs.get("id"),
      qs.get("student_id"),
      text("attendance-student-id") !== "-" ? text("attendance-student-id") : "",
      localStorage.getItem("TECHPATH_STUDENT_ID"),
      localStorage.getItem("studentId")
    );

    const studentName = firstValue(
      qs.get("studentName"),
      qs.get("name"),
      qs.get("student_name"),
      text("attendance-student-name") !== "-" ? text("attendance-student-name") : "",
      text("attendance-summary-name") !== "-" ? text("attendance-summary-name") : "",
      localStorage.getItem("TECHPATH_STUDENT_NAME"),
      localStorage.getItem("studentName")
    );

    const classSection = firstValue(
      qs.get("classSection"),
      qs.get("section"),
      qs.get("sec"),
      qs.get("class_section"),
      text("attendance-class-section") !== "-" ? text("attendance-class-section") : "",
      localStorage.getItem("TECHPATH_CLASS_SECTION"),
      localStorage.getItem("classSection")
    );

    return { studentId, studentName, classSection };
  }

  function parseClockToSec(value) {
    const s = String(value || "").trim();
    const m = s.match(/^(\d+):(\d{1,2})$/);
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function readSessionNo() {
    return firstValue(
      text("attendance-session-no") !== "-" ? text("attendance-session-no") : "",
      text("attendance-summary-s") !== "-" ? text("attendance-summary-s") : "",
      state.sessionNo,
      "S00"
    );
  }

  function readScore() {
    const raw = firstValue(
      text("score-display"),
      text("hud-score"),
      String(state.score || 0)
    );
    const num = Number(String(raw).replace(/[^\d.-]/g, ""));
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  }

  function readDurationSec() {
    const fromDom = parseClockToSec(text("attendance-duration"));
    return Math.max(fromDom, state.durationSec || 0);
  }

  function readActiveTimeSec() {
    const fromDom = parseClockToSec(text("attendance-active-time"));
    return Math.max(fromDom, state.activeTimeSec || 0);
  }

  function inferStatus() {
    const summaryStatus = text("attendance-summary-status");
    const panelStatus = text("attendance-status");
    const combined = `${summaryStatus} ${panelStatus}`.toLowerCase();

    if (combined.includes("completed") || combined.includes("เสร็จ")) return "completed";
    if (combined.includes("failed") || combined.includes("ไม่สำเร็จ")) return "failed";
    if (combined.includes("กำลังเรียน") || combined.includes("in_progress")) return "in_progress";
    if (document.body.classList.contains("summary-mode")) {
      return state.completed ? "completed" : state.status || "completed";
    }
    return state.status || "tracking";
  }

  function buildPayload(eventName, overrides = {}) {
    const now = new Date().toISOString();
    const identity = readIdentity();

    state.lastActiveAt = now;
    state.sessionNo = readSessionNo();
    state.score = readScore();

    const durationSec = readDurationSec();
    const activeTimeSec = readActiveTimeSec();
    const attendanceStatus = overrides.attendanceStatus || inferStatus();
    const completed =
      typeof overrides.completed === "boolean"
        ? overrides.completed
        : attendanceStatus === "completed";

    return {
      action: "attendance_session",
      event: eventName || "pulse",

      visitId,
      studentId: identity.studentId,
      studentName: identity.studentName,
      classSection: identity.classSection,

      sessionNo: state.sessionNo || "S00",
      lessonId: LESSON_ID,
      pageUrl: location.href,

      enteredAt: state.enteredAt,
      startedAt: state.startedAt || "",
      finishedAt: state.finishedAt || "",
      lastActiveAt: state.lastActiveAt,

      durationSec,
      activeTimeSec,
      actionsCount: state.actionsCount,
      score: state.score,

      completed,
      attendanceStatus,
      minTimeMet: activeTimeSec >= MIN_ACTIVE_SEC,

      firstServerTs: "",
      lastServerTs: "",
      userAgent: navigator.userAgent || "",

      build: window.TECHPATH_BUILD || "",
      patch: window.TECHPATH_ATTENDANCE_PATCH || PATCH,
      clientPatch: PATCH,

      ...overrides
    };
  }

  function sendAttendance(eventName = "pulse", overrides = {}, force = false) {
    const endpoint = getEndpoint();

    if (!endpoint) {
      console.warn("[TechPath Attendance] missing endpoint");
      return;
    }

    const nowMs = Date.now();
    if (!force && nowMs - state.lastSendAt < 2500) return;
    state.lastSendAt = nowMs;

    const payload = buildPayload(eventName, overrides);
    const body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(
          endpoint,
          new Blob([body], { type: "text/plain;charset=utf-8" })
        );

        if (ok) {
          console.log("[TechPath Attendance] beacon:", eventName, payload);
          return;
        }
      }

      fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body
      })
        .then(() => {
          console.log("[TechPath Attendance] sent:", eventName, payload);
        })
        .catch((err) => {
          console.warn("[TechPath Attendance] failed:", err, payload);
        });
    } catch (err) {
      console.warn("[TechPath Attendance] exception:", err, payload);
    }
  }

  function markAction(eventName = "action") {
    state.actionsCount += 1;
    state.lastActiveAt = new Date().toISOString();
    sendAttendance(eventName);
  }

  function startPulse() {
    stopPulse();

    pulseTimer = setInterval(() => {
      state.durationSec += 1;

      if (!document.hidden) {
        state.activeTimeSec += 1;
      }

      if (state.activeTimeSec > 0 && state.activeTimeSec % PULSE_EVERY_SEC === 0) {
        sendAttendance("pulse");
      }
    }, 1000);
  }

  function stopPulse() {
    if (pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  function startMission(missionId) {
    const now = new Date().toISOString();
    const num = Number(missionId) || 0;

    state.currentMissionId = num || "";
    state.sessionNo = num ? `S${String(num).padStart(2, "0")}` : readSessionNo();
    state.status = "in_progress";
    state.completed = false;
    state.startedAt = now;
    state.finishedAt = "";
    state.durationSec = 0;
    state.activeTimeSec = 0;
    state.actionsCount = 0;
    state.lastActiveAt = now;

    startPulse();

    setTimeout(() => {
      state.sessionNo = readSessionNo() || state.sessionNo;
      sendAttendance("start", {
        attendanceStatus: "in_progress",
        completed: false
      }, true);
    }, 120);
  }

  function finishMission(eventName = "finish", completed = true, reason = "") {
    const now = new Date().toISOString();

    state.sessionNo = readSessionNo() || state.sessionNo;
    state.status = completed ? "completed" : "failed";
    state.completed = !!completed;
    state.finishedAt = now;
    state.lastActiveAt = now;
    state.score = readScore();

    const finishKey = `${state.sessionNo}|${state.status}|${state.score}|${state.finishedAt.slice(0, 16)}`;
    if (finishKey === state.lastFinishKey) return;
    state.lastFinishKey = finishKey;

    stopPulse();

    sendAttendance(eventName, {
      completed: !!completed,
      attendanceStatus: state.status,
      reason: reason || ""
    }, true);
  }

  function maybeFinishFromSummary(reason = "summary_detected") {
    if (!document.body.classList.contains("summary-mode")) return;

    const status = inferStatus();
    const completed = status !== "failed";

    finishMission(completed ? "finish" : "fail", completed, reason);
  }

  function wrapFunction(name, before, after) {
    const original = window[name];

    if (typeof original !== "function") return false;
    if (original.__attendanceWrapped) return true;

    const wrapped = function (...args) {
      try {
        if (before) before(args);
      } catch (err) {
        console.warn(`[TechPath Attendance] before ${name} failed`, err);
      }

      const result = original.apply(this, args);

      try {
        if (after) after(args, result);
      } catch (err) {
        console.warn(`[TechPath Attendance] after ${name} failed`, err);
      }

      return result;
    };

    wrapped.__attendanceWrapped = true;
    window[name] = wrapped;
    return true;
  }

  function installHooks() {
    const okLoad = wrapFunction(
      "loadMission",
      (args) => {
        startMission(args[0]);
      },
      () => {}
    );

    wrapFunction(
      "checkChoiceAnswer",
      () => {
        markAction("choice_answer");
      },
      () => {
        setTimeout(() => maybeFinishFromSummary("choice_result"), 450);
      }
    );

    wrapFunction(
      "checkWritingAnswer",
      () => {
        markAction("writing_submit");
      },
      () => {
        setTimeout(() => maybeFinishFromSummary("writing_result"), 450);
      }
    );

    wrapFunction(
      "playAudio",
      () => {
        markAction("play_audio");
      },
      () => {}
    );

    wrapFunction(
      "startRecognition",
      () => {
        markAction("speak_start");
      },
      () => {
        setTimeout(() => maybeFinishFromSummary("speaking_result"), 900);
      }
    );

    wrapFunction(
      "playNextMission",
      () => {
        maybeFinishFromSummary("next_before");
      },
      () => {}
    );

    wrapFunction(
      "returnToHub",
      () => {
        if (state.status === "in_progress") {
          finishMission("leave_mission", false, "return_to_hub");
        }
      },
      () => {
        state.sessionNo = "S00";
        state.status = "tracking";
        state.completed = false;
        state.startedAt = "";
        state.finishedAt = "";
        state.durationSec = 0;
        state.activeTimeSec = 0;
        sendAttendance("lobby", {
          sessionNo: "S00",
          attendanceStatus: "tracking",
          completed: false
        }, true);
      }
    );

    if (okLoad) {
      state.hookReady = true;
      console.log("[TechPath Attendance] hooks ready");
      return true;
    }

    return false;
  }

  function installDomActivityHooks() {
    ["click", "keydown", "pointerdown", "touchstart"].forEach((type) => {
      document.addEventListener(
        type,
        () => {
          state.lastActiveAt = new Date().toISOString();
        },
        { passive: true, capture: true }
      );
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        sendAttendance("hidden", {}, true);
      } else {
        sendAttendance("visible", {}, true);
      }
    });

    window.addEventListener("pagehide", () => {
      if (state.status === "in_progress") {
        sendAttendance("pagehide", {
          attendanceStatus: "in_progress",
          completed: false
        }, true);
      } else {
        sendAttendance("pagehide", {}, true);
      }
    });

    window.addEventListener("beforeunload", () => {
      sendAttendance("beforeunload", {}, true);
    });
  }

  function observeSummaryMode() {
    const observer = new MutationObserver(() => {
      setTimeout(() => maybeFinishFromSummary("mutation_summary"), 150);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });

    const summaryPanel = $("summary-panel");
    if (summaryPanel) {
      observer.observe(summaryPanel, {
        attributes: true,
        attributeFilter: ["class", "style"]
      });
    }
  }

  function bootAttendanceSheetPatch() {
    console.log("[TechPath Attendance] boot", PATCH, getEndpoint());

    state.sessionNo = readSessionNo();
    state.score = readScore();

    installDomActivityHooks();
    observeSummaryMode();

    sendAttendance("page_enter", {
      attendanceStatus: "tracking",
      completed: false
    }, true);

    let tries = 0;
    hookTimer = setInterval(() => {
      tries += 1;

      if (installHooks()) {
        clearInterval(hookTimer);
        hookTimer = null;
        return;
      }

      if (tries >= 80) {
        clearInterval(hookTimer);
        hookTimer = null;
        console.warn("[TechPath Attendance] hooks not ready after retry");
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAttendanceSheetPatch, { once: true });
  } else {
    bootAttendanceSheetPatch();
  }
})();