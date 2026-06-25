/* =========================================================
   CSAI2102 AI Quest
   Teacher Dashboard — S1 AR Practice Analytics
   File: /ai-quest/js/aiquest-teacher-s1-ar-analytics-v371.js
   Version: v3.7.1-s1-ar-teacher-activation

   Reads server-returned S1 AR evidence only:
   - extraJson.s1ArPractice
   - arCompleted + arScore/arCorrect/arTotal
   It never calculates or fabricates AR marks.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.1-s1-ar-teacher-activation";
  const $ = (id) => document.getElementById(id);
  let lastFingerprint = "";
  let detailObserver = null;
  let refreshTimer = 0;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));
  }

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function parse(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  }

  function field(object, keys) {
    if (!object || typeof object !== "object") return "";
    for (const key of keys) {
      if (object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
    }
    const lookup = {};
    Object.keys(object).forEach((key) => { lookup[key.toLowerCase()] = object[key]; });
    for (const key of keys) {
      const value = lookup[String(key).toLowerCase()];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function sessionKey(value) {
    const raw = String(value || "").toLowerCase().replace(/[\s_\-:]+/g, "");
    if (["s1", "m1", "session1", "mission1", "aiawakening"].includes(raw)) return "s1";
    return raw;
  }

  function isS1Attempt(attempt) {
    return sessionKey(field(attempt, ["sessionId", "missionId", "session", "mission"])) === "s1" ||
      sessionKey(field(attempt?.raw || {}, ["sessionId", "missionId", "session", "mission"])) === "s1";
  }

  function nestedObjects(value, depth = 0, seen = new Set(), output = []) {
    if (!value || depth > 6) return output;
    const object = parse(value);
    if (!object || typeof object !== "object") return output;
    if (seen.has(object)) return output;
    seen.add(object);
    output.push(object);

    if (Array.isArray(object)) {
      object.slice(0, 200).forEach((item) => nestedObjects(item, depth + 1, seen, output));
      return output;
    }

    [
      "s1ArPractice", "extraJson", "extra", "rawJson", "raw", "payload",
      "metadata", "data", "attempt", "result", "summary"
    ].forEach((key) => {
      if (object[key] !== undefined) nestedObjects(object[key], depth + 1, seen, output);
    });
    return output;
  }

  function arEvidenceFromAttempt(attempt) {
    if (!attempt || !isS1Attempt(attempt)) return null;

    const objects = nestedObjects(attempt);
    for (const object of objects) {
      const nested = parse(object.s1ArPractice);
      const candidate = nested || object.s1ArPractice || object;

      const markedCompleted =
        candidate.completed === true ||
        candidate.arCompleted === true ||
        String(candidate.completed || candidate.arCompleted || "").toLowerCase() === "true";

      const activity = String(field(candidate, ["activity", "arActivity", "title"]) || "");
      const markedAr = /s1\s*ar|ai object scanner/i.test(activity) ||
        field(candidate, ["arScore", "arCorrect", "arTotal", "arAccuracy"]) !== "";

      if (!(markedCompleted && markedAr)) continue;

      const correct = number(field(candidate, ["correct", "arCorrect", "correctCount"]));
      const total = number(field(candidate, ["total", "arTotal", "totalQuestions"]));
      const score = Math.round(number(field(candidate, ["score", "arScore", "accuracy", "arAccuracy"]),
        total > 0 ? correct * 100 / total : 0));

      return {
        studentId: String(field(attempt, ["studentId", "student_id", "id", "pid"]) ||
          field(attempt.raw || {}, ["studentId", "student_id", "id", "pid"]) || ""),
        studentName: String(field(attempt, ["studentName", "name", "displayName"]) ||
          field(attempt.raw || {}, ["studentName", "name", "displayName"]) || ""),
        score,
        correct,
        total,
        help: number(field(candidate, ["helpUsed", "arHelpUsed", "help"])),
        seconds: number(field(candidate, ["usedSec", "arUsedSec", "timeSec"])),
        input: String(field(candidate, ["inputMode", "arInputMode", "inputMethod"]) || "ไม่ระบุ"),
        completedAt: String(field(candidate, ["completedAt", "finishedAt", "submittedAt", "timestamp"]) ||
          field(attempt, ["timestamp", "submittedAt", "createdAt"]) || ""),
        raw: candidate
      };
    }
    return null;
  }

  function dashboard() {
    return window.AIQUEST_TEACHER_ONLY_DASHBOARD || null;
  }

  function records() {
    const app = dashboard();
    const attempts = Array.isArray(app?.state?.attempts) ? app.state.attempts : [];
    const students = Array.isArray(app?.state?.students) ? app.state.students : [];
    const names = new Map(students.map((student) => [
      String(student.studentId || ""), String(student.name || "")
    ]));

    const all = attempts.map((attempt) => {
      const evidence = arEvidenceFromAttempt(attempt);
      if (!evidence) return null;
      if (!evidence.studentName) evidence.studentName = names.get(evidence.studentId) || "";
      return evidence;
    }).filter(Boolean);

    const latest = new Map();
    all.forEach((item) => {
      const key = item.studentId || `unknown-${item.completedAt}-${item.score}`;
      const previous = latest.get(key);
      const previousTime = Date.parse(previous?.completedAt || "") || 0;
      const currentTime = Date.parse(item.completedAt || "") || 0;
      if (!previous || currentTime >= previousTime) latest.set(key, item);
    });

    return Array.from(latest.values()).sort((a, b) =>
      String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true })
    );
  }

  function inputLabel(value) {
    const key = String(value || "").toLowerCase();
    if (key.includes("pinch")) return "Hand pinch";
    if (key.includes("dwell")) return "Hand dwell";
    if (key.includes("hand")) return "Hand / mouse / touch";
    if (key.includes("mouse") || key.includes("touch")) return "Mouse / touch";
    return value || "ไม่ระบุ";
  }

  function timeLabel(seconds) {
    const sec = Math.max(0, Math.round(number(seconds)));
    if (!sec) return "-";
    const minutes = Math.floor(sec / 60);
    return minutes ? `${minutes}m ${sec % 60}s` : `${sec}s`;
  }

  function dateLabel(value) {
    const time = Date.parse(value || "");
    return time ? new Date(time).toLocaleString() : (value || "-");
  }

  function makeContainer() {
    let box = $("s1ArTeacherAnalyticsV371");
    if (box) return box;

    const studentsCard = $("studentsBox")?.closest(".card");
    if (!studentsCard) return null;

    box = document.createElement("section");
    box.id = "s1ArTeacherAnalyticsV371";
    box.className = "card";
    box.style.marginBottom = "14px";
    studentsCard.insertAdjacentElement("beforebegin", box);
    return box;
  }

  function renderDashboardCard() {
    const box = makeContainer();
    if (!box) return;

    const data = records();
    if (!data.length) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">S1 AR Practice</h2>
            <p class="muted" style="margin:7px 0 0">AI Object Scanner • กิจกรรมเสริม แยกจากคะแนน S1 หลัก</p>
          </div>
          <span class="pill warn">ยังไม่มี AR evidence จาก Server Summary</span>
        </div>
        <div class="loading" style="margin-top:12px">
          เล่น AR ให้จบ → กลับไปจบ S1 ปกติ → กดบันทึกผล S1 → Refresh หน้านี้<br>
          ระบบจะแสดงเฉพาะ field <code>extraJson.s1ArPractice</code> หรือ AR field ที่ Server ส่งกลับมาจริง
        </div>
      `;
      return;
    }

    const average = Math.round(data.reduce((sum, item) => sum + item.score, 0) / data.length);
    const correct = data.reduce((sum, item) => sum + item.correct, 0);
    const total = data.reduce((sum, item) => sum + item.total, 0);

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">S1 AR Practice</h2>
          <p class="muted" style="margin:7px 0 0">AI Object Scanner • หลักฐานการฝึกเสริม ไม่ถูกนำไปทับคะแนน S1</p>
        </div>
        <span class="pill good">✓ Real AR evidence ${data.length} คน</span>
      </div>

      <div class="grid cols3" style="margin-top:12px">
        <div class="metric"><span class="muted">AR completed</span><b>${data.length}</b></div>
        <div class="metric"><span class="muted">Avg AR score</span><b>${average}%</b></div>
        <div class="metric"><span class="muted">Correct / total</span><b>${correct}/${total || "-"}</b></div>
      </div>

      <div style="overflow:auto;margin-top:12px">
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
                <td><b>${esc(item.studentId || "-")}</b><br><span class="muted">${esc(item.studentName || "")}</span></td>
                <td><span class="pill ${item.score >= 85 ? "good" : "warn"}">${esc(item.score)}%</span></td>
                <td>${esc(item.correct)}/${esc(item.total || "-")}</td>
                <td>${esc(item.help)}</td>
                <td>${esc(timeLabel(item.seconds))}</td>
                <td>${esc(inputLabel(item.input))}</td>
                <td>${esc(dateLabel(item.completedAt))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function currentDetailStudentId() {
    const text = $("detailBox")?.textContent || "";
    const match = text.match(/Student\s+([^\s]+)/i);
    return match ? String(match[1]) : "";
  }

  function renderDetailCard() {
    const modal = $("detailModal");
    const detail = $("detailBox");
    if (!modal?.classList.contains("open") || !detail) return;

    $("s1ArDetailV371")?.remove();

    const id = currentDetailStudentId();
    const item = records().find((record) => String(record.studentId) === id);
    if (!item) return;

    const card = document.createElement("section");
    card.id = "s1ArDetailV371";
    card.className = "card";
    card.style.marginTop = "12px";
    card.innerHTML = `
      <h3>S1 AR Practice <span class="pill blue">Supplementary</span></h3>
      <p class="muted" style="margin-top:-3px">AI Object Scanner • ไม่ทับคะแนน S1 หลัก</p>
      <div class="grid cols3" style="margin-top:10px">
        <div class="metric"><span class="muted">AR score</span><b>${esc(item.score)}%</b></div>
        <div class="metric"><span class="muted">Correct</span><b>${esc(item.correct)}/${esc(item.total || "-")}</b></div>
        <div class="metric"><span class="muted">Help</span><b>${esc(item.help)}</b></div>
      </div>
      <p style="margin:12px 0 0"><b>Control:</b> ${esc(inputLabel(item.input))} &nbsp;•&nbsp; <b>Time:</b> ${esc(timeLabel(item.seconds))}</p>
    `;

    const progress = Array.from(detail.querySelectorAll(".card,section")).find((element) =>
      /Session Progress/i.test(element.textContent || "")
    );
    if (progress) progress.before(card);
    else detail.appendChild(card);
  }

  function fingerprint() {
    const attempts = dashboard()?.state?.attempts || [];
    return `${attempts.length}|${attempts.map((item) => JSON.stringify(item?.raw || item).slice(0, 420)).join("|")}`;
  }

  function refresh() {
    const next = fingerprint();
    if (next !== lastFingerprint || !$("s1ArTeacherAnalyticsV371")) {
      lastFingerprint = next;
      renderDashboardCard();
    }
    renderDetailCard();
  }

  function boot() {
    refresh();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, 900);

    const detail = $("detailBox");
    if (detail && !detailObserver) {
      detailObserver = new MutationObserver(() => setTimeout(renderDetailCard, 0));
      detailObserver.observe(detail, { childList: true, subtree: true });
    }
  }

  window.AIQUEST_TEACHER_S1_AR_ANALYTICS = {
    version: VERSION,
    getRecords: records,
    refresh,
    extract: arEvidenceFromAttempt
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

  console.log("[AIQuest] " + VERSION + " loaded", window.AIQUEST_TEACHER_S1_AR_ANALYTICS);
})();
