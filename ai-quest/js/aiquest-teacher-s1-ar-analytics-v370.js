/* =========================================================
   CSAI2102 AI Quest
   Teacher Dashboard — S1 AR Practice Analytics
   File: /ai-quest/js/aiquest-teacher-s1-ar-analytics-v370.js
   Version: v3.7.0-s1-ar-teacher-dashboard

   Reads only real AR evidence returned by the server:
   - top-level arCompleted / arScore / arCorrect / arTotal
   - extraJson.s1ArPractice
   - rawJson / nested JSON fallbacks

   It never invents scores and never mixes AR with S1 main grade.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.0-s1-ar-teacher-dashboard";
  const $ = (id) => document.getElementById(id);
  let lastFingerprint = "";
  let observer = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function first(obj, keys) {
    if (!obj || typeof obj !== "object") return "";
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
    }
    const lookup = {};
    Object.keys(obj).forEach((key) => { lookup[key.toLowerCase()] = obj[key]; });
    for (const key of keys) {
      const value = lookup[String(key).toLowerCase()];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function parse(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  }

  function collectObjects(value, depth = 0, out = []) {
    if (!value || depth > 5) return out;
    const object = parse(value);

    if (Array.isArray(object)) {
      object.slice(0, 220).forEach((item) => collectObjects(item, depth + 1, out));
      return out;
    }

    if (object && typeof object === "object") {
      out.push(object);
      [
        "extraJson", "extra", "rawJson", "raw", "payload",
        "summary", "attempt", "data", "result", "metadata"
      ].forEach((key) => {
        if (object[key] !== undefined) collectObjects(object[key], depth + 1, out);
      });
    }
    return out;
  }

  function sessionKey(value) {
    const raw = String(value || "").toLowerCase().replace(/[\s_\-:]+/g, "");
    if (["s1", "m1", "session1", "mission1", "aiawakening"].includes(raw)) return "s1";
    return raw;
  }

  function extractArRecord(attempt) {
    const objects = collectObjects(attempt);
    let selected = null;
    let source = null;

    for (const object of objects) {
      const nested = parse(object.s1ArPractice);
      const ar = nested || object.s1ArPractice || object;

      const hasCompleted = ar.arCompleted === true || ar.completed === true ||
        String(ar.arCompleted || ar.completed || "").toLowerCase() === "true";
      const hasScore = first(ar, ["arScore", "score", "arAccuracy", "accuracy"]) !== "";
      const isS1 = sessionKey(first(object, ["sessionId", "missionId", "session", "mission"])) === "s1" ||
        sessionKey(first(attempt || {}, ["sessionId", "missionId", "session", "mission"])) === "s1";

      if (isS1 && (hasCompleted || (hasScore && (nested || object.arCompleted !== undefined || object.arScore !== undefined)))) {
        selected = ar;
        source = object;
        break;
      }
    }

    if (!selected) return null;

    const score = Math.round(num(first(selected, ["arScore", "score", "arAccuracy", "accuracy"])));
    const correct = num(first(selected, ["arCorrect", "correct", "correctCount"]));
    const total = num(first(selected, ["arTotal", "total", "totalQuestions"]));
    const input = String(first(selected, ["arInputMode", "inputMode", "inputMethod"]) || "unknown");
    const timestamp = first(selected, ["completedAt", "finishedAt", "submittedAt", "timestamp"]) ||
      first(source || {}, ["submittedAt", "timestamp", "createdAt", "updatedAt"]) ||
      first(attempt || {}, ["timestamp", "submittedAt", "createdAt", "updatedAt"]);

    return {
      studentId: String(first(attempt || {}, ["studentId", "student_id", "id", "pid"]) ||
        first(source || {}, ["studentId", "student_id", "id", "pid"]) || ""),
      name: String(first(attempt || {}, ["studentName", "name", "displayName"]) ||
        first(source || {}, ["studentName", "name", "displayName"]) || ""),
      score,
      correct,
      total,
      helpUsed: num(first(selected, ["arHelpUsed", "helpUsed", "help"])),
      usedSec: num(first(selected, ["arUsedSec", "usedSec", "timeSec"])),
      input,
      timestamp: String(timestamp || ""),
      raw: selected
    };
  }

  function dashboard() {
    return window.AIQUEST_TEACHER_ONLY_DASHBOARD || null;
  }

  function rows() {
    const app = dashboard();
    if (!app?.state) return [];
    const attempts = Array.isArray(app.state.attempts) ? app.state.attempts : [];
    const students = Array.isArray(app.state.students) ? app.state.students : [];
    const nameById = new Map(students.map((student) => [String(student.studentId || ""), student.name || ""]));

    const found = attempts.map((attempt) => {
      const source = attempt?.raw || attempt;
      const record = extractArRecord(source);
      if (!record) return null;
      if (!record.studentId) record.studentId = String(attempt?.studentId || "");
      if (!record.name) record.name = attempt?.name || nameById.get(record.studentId) || "";
      return record;
    }).filter(Boolean);

    // Keep the latest AR record for each learner.
    const latest = new Map();
    found.forEach((record) => {
      const key = record.studentId || `unknown-${record.timestamp}-${record.score}`;
      const current = latest.get(key);
      const currentTime = Date.parse(current?.timestamp || "") || 0;
      const nextTime = Date.parse(record.timestamp || "") || 0;
      if (!current || nextTime >= currentTime) latest.set(key, record);
    });

    return Array.from(latest.values()).sort((a, b) =>
      String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true })
    );
  }

  function titleCaseInput(mode) {
    const map = {
      "hand_or_mouse_touch": "Hand / Mouse / Touch",
      "hand_pinch": "Hand pinch",
      "hand_dwell": "Hand dwell",
      "mouse_touch": "Mouse / Touch",
      "unknown": "ไม่ระบุ"
    };
    return map[mode] || mode.replace(/_/g, " ");
  }

  function formatTime(seconds) {
    const sec = Math.max(0, Math.round(num(seconds)));
    if (!sec) return "-";
    const min = Math.floor(sec / 60);
    return min ? `${min}m ${sec % 60}s` : `${sec}s`;
  }

  function latestText(value) {
    const time = Date.parse(value || "");
    return time ? new Date(time).toLocaleString() : (value || "-");
  }

  function getContainer() {
    let box = $("s1ArTeacherAnalyticsV370");
    if (box) return box;

    const overview = $("overview");
    if (!overview) return null;

    box = document.createElement("section");
    box.id = "s1ArTeacherAnalyticsV370";
    box.className = "card";
    box.style.marginTop = "14px";
    overview.insertAdjacentElement("afterend", box);
    return box;
  }

  function renderCard() {
    const box = getContainer();
    if (!box) return;

    const data = rows();
    const count = data.length;
    const average = count ? Math.round(data.reduce((sum, item) => sum + item.score, 0) / count) : 0;
    const totalCorrect = data.reduce((sum, item) => sum + item.correct, 0);
    const totalItems = data.reduce((sum, item) => sum + item.total, 0);
    const rate = totalItems ? Math.round(totalCorrect / totalItems * 100) : 0;
    const modes = Array.from(new Set(data.map((item) => titleCaseInput(item.input))));

    if (!count) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">S1 AR Practice</h2>
            <p class="muted" style="margin:7px 0 0">กิจกรรมเสริม: AI Object Scanner • แยกจากคะแนน S1 หลัก</p>
          </div>
          <span class="pill warn">ยังไม่มี AR data จาก Server Summary</span>
        </div>
        <div class="loading" style="margin-top:12px">
          หลังผู้เรียนเล่น AR แล้วทำ S1 ปกติจนกดบันทึก ผล AR จะมาแสดงที่นี่จาก
          <code>extraJson.s1ArPractice</code> หรือ field AR ของ attempt จริง
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">S1 AR Practice</h2>
          <p class="muted" style="margin:7px 0 0">
            AI Object Scanner • เป็นหลักฐานกิจกรรมเสริม ไม่รวมทับคะแนน S1 หลัก
          </p>
        </div>
        <span class="pill good">✓ Real AR evidence ${count} คน</span>
      </div>

      <div class="grid cols3" style="margin-top:12px">
        <div class="metric"><span class="muted">AR completed</span><b>${count}</b></div>
        <div class="metric"><span class="muted">Avg AR score</span><b>${average}%</b></div>
        <div class="metric"><span class="muted">Correct / total</span><b>${totalCorrect}/${totalItems || "-"}</b><div class="muted" style="font-size:12px;margin-top:3px">${rate ? `${rate}%` : "ยังไม่มี total"}</div></div>
      </div>

      <div style="margin:12px 0">${modes.map((mode) => `<span class="pill blue">${esc(mode)}</span>`).join("")}</div>

      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>Student</th><th>AR score</th><th>Correct</th><th>Help</th>
              <th>Time</th><th>Input</th><th>Completed</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((item) => `
              <tr>
                <td><b>${esc(item.studentId || "-")}</b><br><span class="muted">${esc(item.name || "")}</span></td>
                <td><span class="pill ${item.score >= 85 ? "good" : "warn"}">${esc(item.score)}%</span></td>
                <td>${esc(item.correct)}/${esc(item.total || "-")}</td>
                <td>${esc(item.helpUsed)}</td>
                <td>${esc(formatTime(item.usedSec))}</td>
                <td>${esc(titleCaseInput(item.input))}</td>
                <td>${esc(latestText(item.timestamp))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function selectedStudentId() {
    const detail = $("detailBox");
    const text = detail?.textContent || "";
    const data = rows();
    const match = data.find((item) => item.studentId && new RegExp(`\\b${String(item.studentId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
    return match?.studentId || "";
  }

  function renderDetailCard() {
    const modal = $("detailModal");
    const detail = $("detailBox");
    if (!modal?.classList.contains("open") || !detail) return;

    const old = $("s1ArDetailV370");
    if (old) old.remove();

    const id = selectedStudentId();
    const item = rows().find((row) => String(row.studentId) === String(id));
    if (!item) return;

    const box = document.createElement("section");
    box.id = "s1ArDetailV370";
    box.className = "card";
    box.style.marginTop = "12px";
    box.innerHTML = `
      <h3>S1 AR Practice <span class="pill blue">Supplementary</span></h3>
      <p class="muted" style="margin-top:-4px">AI Object Scanner • ไม่ถูกนำไปทับคะแนน S1 หลัก</p>
      <div class="grid cols3" style="margin-top:10px">
        <div class="metric"><span class="muted">AR score</span><b>${esc(item.score)}%</b></div>
        <div class="metric"><span class="muted">Correct</span><b>${esc(item.correct)}/${esc(item.total || "-")}</b></div>
        <div class="metric"><span class="muted">Help</span><b>${esc(item.helpUsed)}</b></div>
      </div>
      <p style="margin:12px 0 0"><b>Control:</b> ${esc(titleCaseInput(item.input))} &nbsp;•&nbsp; <b>Time:</b> ${esc(formatTime(item.usedSec))}</p>
    `;

    const anchor = Array.from(detail.querySelectorAll("section, .card")).find((element) =>
      /Session Progress/i.test(element.textContent || "")
    );
    if (anchor) anchor.before(box);
    else detail.appendChild(box);
  }

  function fingerprint() {
    const app = dashboard();
    const attempts = app?.state?.attempts || [];
    return `${attempts.length}|${attempts.map((a) => JSON.stringify(a?.raw || a).slice(0, 320)).join("~")}`;
  }

  function refresh() {
    const next = fingerprint();
    if (next !== lastFingerprint) {
      lastFingerprint = next;
      renderCard();
    } else if (!$("s1ArTeacherAnalyticsV370")) {
      renderCard();
    }
    renderDetailCard();
  }

  function boot() {
    refresh();
    setInterval(refresh, 900);

    const detail = $("detailBox");
    if (detail && !observer) {
      observer = new MutationObserver(() => setTimeout(renderDetailCard, 0));
      observer.observe(detail, { childList: true, subtree: true });
    }
  }

  window.AIQUEST_TEACHER_S1_AR_ANALYTICS = {
    version: VERSION,
    getRows: rows,
    extractArRecord,
    refresh,
    renderCard
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

  console.log("[AIQuest] " + VERSION + " loaded", window.AIQUEST_TEACHER_S1_AR_ANALYTICS);
})();
