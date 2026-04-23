// /english/js/lesson-attendance-client.js

const DEFAULT_LESSON_ID = "techpath-vr";
const DEFAULT_HEARTBEAT_MS = 15000;

function safeStr(v) {
  return v == null ? "" : String(v).trim();
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function makeVisitId() {
  return `PAGE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readOrCreateVisitId(storageKey = "TECHPATH_PAGE_VISIT_ID") {
  try {
    const old = localStorage.getItem(storageKey);
    if (old) return old;
    const created = makeVisitId();
    localStorage.setItem(storageKey, created);
    return created;
  } catch (_) {
    return makeVisitId();
  }
}

function getPageMode() {
  const body = document.body;
  if (!body) return "hub";
  if (body.classList.contains("summary-mode")) return "summary";
  if (body.classList.contains("mission-mode")) return "mission";
  return "hub";
}

export function initAttendanceBridge(options = {}) {
  const endpoint = safeStr(options.endpoint || window.TECHPATH_ATTENDANCE_ENDPOINT);
  const lessonId = safeStr(options.lessonId || DEFAULT_LESSON_ID);
  const getState = typeof options.getState === "function" ? options.getState : () => ({});
  const getAttendanceState =
    typeof options.getAttendanceState === "function" ? options.getAttendanceState : () => ({});
  const getIdentity =
    typeof options.getIdentity === "function"
      ? options.getIdentity
      : () => ({ studentId: "", studentName: "", classSection: "" });

  const visitId = readOrCreateVisitId(options.storageKey || "TECHPATH_PAGE_VISIT_ID");
  const startedAt = nowIso();

  let actionsCount = 0;
  let lastSentAt = 0;
  let heartbeatTimer = null;
  let pageEnterSent = false;

  function buildPayload(extra = {}) {
    const state = getState() || {};
    const attendance = getAttendanceState() || {};
    const identity = getIdentity() || {};

    const studentId = safeStr(identity.studentId || attendance.studentId);
    const studentName = safeStr(identity.studentName || attendance.studentName);
    const classSection = safeStr(identity.classSection || attendance.classSection);

    return {
      api: "attendance",
      visitId,
      studentId,
      studentName,
      classSection,
      sessionNo: safeStr(extra.sessionNo || attendance.sessionNo),
      lessonId: safeStr(extra.lessonId || lessonId),
      eventType: safeStr(extra.eventType),
      clientTs: nowIso(),
      enteredAt: safeStr(attendance.enteredAt || startedAt),
      startedAt: safeStr(attendance.startedAt),
      finishedAt: safeStr(attendance.finishedAt),
      lastActiveAt: safeStr(attendance.lastActiveAt || nowIso()),
      durationSec: safeNum(extra.durationSec ?? attendance.durationSec, 0),
      activeTimeSec: safeNum(extra.activeTimeSec ?? attendance.activeTimeSec, 0),
      actionsCount: safeNum(extra.actionsCount ?? actionsCount, 0),
      score: safeNum(extra.score ?? state.gameScore, 0),
      completed: Boolean(extra.completed),
      attendanceStatus: safeStr(extra.attendanceStatus || attendance.attendanceStatus),
      pageUrl: location.href,
      userAgent: navigator.userAgent,
      mode: safeStr(extra.mode || getPageMode()),
      missionId: safeNum(extra.missionId ?? state?.currentMission?.id, 0),
      missionType: safeStr(extra.missionType || state?.currentMission?.type),
      attemptResult: safeStr(extra.attemptResult),
      extraJson: extra.extraJson || {}
    };
  }

  async function postJson(payload, useBeacon = false) {
    if (!endpoint) {
      console.warn("[attendance] missing endpoint");
      return { ok: false, reason: "missing-endpoint" };
    }

    const json = JSON.stringify(payload);

    if (useBeacon && navigator.sendBeacon) {
      try {
        const blob = new Blob([json], { type: "text/plain;charset=UTF-8" });
        const ok = navigator.sendBeacon(endpoint, blob);
        return { ok, beacon: true };
      } catch (err) {
        console.warn("[attendance] beacon failed", err);
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: json,
        keepalive: true,
        credentials: "omit",
        cache: "no-store"
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {}

      return {
        ok: res.ok,
        status: res.status,
        data
      };
    } catch (err) {
      console.warn("[attendance] post failed", err);
      return { ok: false, error: String(err) };
    }
  }

  function bumpAction() {
    actionsCount += 1;
  }

  function attachActionCounters() {
    const inc = () => bumpAction();
    window.addEventListener("click", inc, { passive: true });
    window.addEventListener("keydown", inc);
    window.addEventListener("touchstart", inc, { passive: true });
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      const now = Date.now();
      if (now - lastSentAt < 4000) return;
      lastSentAt = now;

      const payload = buildPayload({
        eventType: "heartbeat",
        attendanceStatus: "in_progress",
        completed: false,
        mode: "mission"
      });

      postJson(payload);
    }, DEFAULT_HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  async function ping() {
    if (!endpoint) return { ok: false, reason: "missing-endpoint" };
    try {
      const url = `${endpoint}?api=attendance&ping=1&_ts=${Date.now()}`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "omit",
        cache: "no-store"
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async function pageEnter() {
    if (pageEnterSent) return;
    pageEnterSent = true;

    const payload = buildPayload({
      eventType: "page_enter",
      attendanceStatus: "entered",
      completed: false,
      mode: "hub"
    });

    lastSentAt = Date.now();
    return postJson(payload);
  }

  async function missionStart(mission) {
    const payload = buildPayload({
      eventType: "mission_start",
      sessionNo: safeStr(`S${String(safeNum(mission?.id, 0)).padStart(2, "0")}`),
      missionId: safeNum(mission?.id, 0),
      missionType: safeStr(mission?.type),
      attendanceStatus: "in_progress",
      completed: false,
      mode: "mission"
    });

    lastSentAt = Date.now();
    startHeartbeat();
    return postJson(payload);
  }

  async function missionEnd(mission, success) {
    stopHeartbeat();

    const payload = buildPayload({
      eventType: "mission_end",
      sessionNo: safeStr(`S${String(safeNum(mission?.id, 0)).padStart(2, "0")}`),
      missionId: safeNum(mission?.id, 0),
      missionType: safeStr(mission?.type),
      attendanceStatus: success ? "completed" : "failed",
      attemptResult: success ? "success" : "fail",
      completed: true,
      mode: "summary"
    });

    lastSentAt = Date.now();
    return postJson(payload);
  }

  async function summaryView(mission, success) {
    const payload = buildPayload({
      eventType: "summary_view",
      sessionNo: safeStr(`S${String(safeNum(mission?.id, 0)).padStart(2, "0")}`),
      missionId: safeNum(mission?.id, 0),
      missionType: safeStr(mission?.type),
      attendanceStatus: success ? "completed" : "failed",
      attemptResult: success ? "success" : "fail",
      completed: true,
      mode: "summary"
    });

    lastSentAt = Date.now();
    return postJson(payload);
  }

  async function returnHub() {
    stopHeartbeat();

    const payload = buildPayload({
      eventType: "hub_view",
      attendanceStatus: "tracking",
      completed: false,
      mode: "hub"
    });

    lastSentAt = Date.now();
    return postJson(payload);
  }

  function bindLifecycle() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        const payload = buildPayload({
          eventType: "page_leave",
          attendanceStatus: "left",
          completed: false,
          mode: getPageMode()
        });
        postJson(payload, true);
      }
    });

    window.addEventListener("pagehide", () => {
      const payload = buildPayload({
        eventType: "page_leave",
        attendanceStatus: "left",
        completed: false,
        mode: getPageMode()
      });
      postJson(payload, true);
    });

    window.addEventListener("beforeunload", () => {
      const payload = buildPayload({
        eventType: "page_leave",
        attendanceStatus: "left",
        completed: false,
        mode: getPageMode()
      });
      postJson(payload, true);
    });
  }

  attachActionCounters();
  bindLifecycle();

  return {
    visitId,
    ping,
    pageEnter,
    missionStart,
    missionEnd,
    summaryView,
    returnHub,
    bumpAction,
    stopHeartbeat
  };
}
