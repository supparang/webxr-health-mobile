// /english/js/teacher-dashboard-hotfix.js
// PATCH v20260424-teacher-dashboard-roster-r8
// ✅ Force load teacher=dashboard from Apps Script
// ✅ Smart rows: compact repeated visits by student/section/session
// ✅ S00/Lobby is entry only, not At Risk
// ✅ Student Detail panel with S01–S15 progress and attempts
// ✅ Report Pack: date range, missing report, per-student progress, export report, print/PDF
// ✅ Focus View: Overview / Report / Students / Advanced / Show All
// ✅ Roster-aware r8: loads class_roster and detects never entered students
// ✅ Does not load old teacher.js

(function () {
  "use strict";

  const PATCH = "v20260424-teacher-dashboard-roster-r8";

  const ENDPOINT =
    window.TECHPATH_ATTENDANCE_ENDPOINT ||
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  const state = {
    rawRows: [],
    rows: [],
    rosterRows: [],
    filteredRows: [],
    selectedKey: "",
    selectedRow: null,
    view: localStorage.getItem("TECHPATH_TEACHER_VIEW") || "overview",
    filters: {
      search: "",
      section: "",
      status: "",
      session: "",
      minTime: "",
      dateFrom: "",
      dateTo: ""
    },
    report: {
      targetSession: "S01",
      minSec: 60
    },
    quick: "all",
    auto: true,
    timer: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safe(value, fallback = "-") {
    const s = String(value ?? "").trim();
    return s || fallback;
  }

  function bool(value) {
    if (value === true) return true;
    const s = String(value ?? "").trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtSec(value) {
    const n = Math.max(0, Math.floor(num(value)));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;

    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("th-TH");
  }

  function localDateInputValue(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function sessionList() {
    return ["S00", ...Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`)];
  }

  function normalizeSessionNo(value) {
    const s = String(value ?? "").trim();
    if (!s || s.toLowerCase() === "lobby") return "S00";

    const m = s.match(/^S?(\d{1,2})$/i);
    if (m) return `S${String(Number(m[1])).padStart(2, "0")}`;

    return s;
  }

  function isLearningSession(sessionNo) {
    const s = normalizeSessionNo(sessionNo);
    return /^S(0[1-9]|1[0-5])$/.test(s);
  }

  function isRiskRow(r) {
    if (!isLearningSession(r.sessionNo)) return false;

    const status = String(r.attendanceStatus || "").toLowerCase();

    return (
      status === "failed" ||
      status === "left" ||
      status === "in_progress" ||
      !r.completed ||
      !r.minTimeMet
    );
  }

  function personKeyFromParts(studentId, studentName, classSection) {
    const id = String(studentId || "").trim();
    const name = String(studentName || "").trim().toLowerCase();
    const sec = String(classSection || "").trim().toLowerCase();

    if (id) return `${id}|${sec}`;
    return `${name || "unknown"}|${sec}`;
  }

  function studentKey(r) {
    const s = normalizeSessionNo(r.sessionNo);
    return `${personKeyFromParts(r.studentId, r.studentName, r.classSection)}|${s}`;
  }

  function personKey(r) {
    return personKeyFromParts(r.studentId, r.studentName, r.classSection);
  }

  function rosterPersonKey(r) {
    return personKeyFromParts(r.studentId, r.studentName, r.classSection);
  }

  function rowKey(r) {
    return studentKey(r);
  }

  function samePerson(a, b) {
    return personKey(a) === personKey(b);
  }

  function rowTimeMs(r) {
    const candidates = [
      r.lastServerTs,
      r.firstServerTs,
      r.lastActiveAt,
      r.finishedAt,
      r.startedAt,
      r.enteredAt
    ];

    for (const value of candidates) {
      if (!value) continue;
      const t = new Date(value).getTime();
      if (Number.isFinite(t)) return t;
    }

    return 0;
  }

  function inDateRange(r) {
    const t = rowTimeMs(r);
    if (!t) return true;

    if (state.filters.dateFrom) {
      const from = new Date(`${state.filters.dateFrom}T00:00:00`).getTime();
      if (Number.isFinite(from) && t < from) return false;
    }

    if (state.filters.dateTo) {
      const to = new Date(`${state.filters.dateTo}T23:59:59`).getTime();
      if (Number.isFinite(to) && t > to) return false;
    }

    return true;
  }

  function rowScoreForMerge(r) {
    let score = 0;

    if (r.completed) score += 1000000;
    if (r.minTimeMet) score += 500000;
    if (r.attendanceStatus === "completed") score += 300000;
    if (r.attendanceStatus === "in_progress") score += 100000;

    score += Math.min(99999, Number(r.score) || 0);
    score += Math.min(99999, Number(r.durationSec) || 0);
    score += Math.min(99999, Number(r.activeTimeSec) || 0);

    const t = rowTimeMs(r);
    if (Number.isFinite(t)) score += Math.floor(t / 100000000);

    return score;
  }

  function compactLatestRows(rows) {
    const map = new Map();

    rows.forEach((r) => {
      const key = studentKey(r);
      const old = map.get(key);

      if (!old) {
        map.set(key, { ...r, rawCount: 1 });
        return;
      }

      const rawCount = (old.rawCount || 1) + 1;
      const better = rowScoreForMerge(r) >= rowScoreForMerge(old) ? r : old;

      map.set(key, {
        ...better,
        rawCount
      });
    });

    return [...map.values()].sort((a, b) => {
      const sessionCmp = String(a.sessionNo || "").localeCompare(String(b.sessionNo || ""));
      if (sessionCmp !== 0) return sessionCmp;

      const sectionCmp = String(a.classSection || "").localeCompare(String(b.classSection || ""));
      if (sectionCmp !== 0) return sectionCmp;

      return String(a.studentName || "").localeCompare(String(b.studentName || ""));
    });
  }

  function riskReason(r) {
    if (!isLearningSession(r.sessionNo)) return "entry only";
    if (r.attendanceStatus === "failed") return "failed";
    if (r.attendanceStatus === "left") return "left early";
    if (r.attendanceStatus === "in_progress") return "still learning";
    if (!r.completed) return "not completed";
    if (!r.minTimeMet) return "min time fail";
    return "ok";
  }

  function matchesReportBaseFilters(r) {
    const q = state.filters.search.toLowerCase().trim();

    if (!inDateRange(r)) return false;
    if (state.filters.section && r.classSection !== state.filters.section) return false;

    if (q) {
      const hay = [r.studentId, r.studentName, r.classSection, r.sessionNo, r.attendanceStatus]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  }

  function personMatchesSearchAndSection(p) {
    const q = state.filters.search.toLowerCase().trim();

    if (state.filters.section && p.classSection !== state.filters.section) return false;

    if (q) {
      const hay = [
        p.studentId,
        p.studentName,
        p.classSection,
        p.email,
        p.group
      ].join(" ").toLowerCase();

      if (!hay.includes(q)) return false;
    }

    return true;
  }

  function knownPersonsFromRows(rows) {
    const map = new Map();

    state.rosterRows.forEach((r) => {
      const key = rosterPersonKey(r);
      if (!key || key.includes("unknown|")) return;

      const p = {
        key,
        studentId: r.studentId,
        studentName: r.studentName,
        classSection: r.classSection,
        email: r.email,
        group: r.group,
        source: "roster"
      };

      if (personMatchesSearchAndSection(p)) {
        map.set(key, p);
      }
    });

    rows.forEach((r) => {
      const key = personKey(r);
      if (!key) return;

      if (!map.has(key)) {
        const p = {
          key,
          studentId: r.studentId,
          studentName: r.studentName,
          classSection: r.classSection,
          email: "",
          group: "",
          source: "attendance"
        };

        if (personMatchesSearchAndSection(p)) {
          map.set(key, p);
        }
      }
    });

    return [...map.values()].sort((a, b) => {
      const sec = String(a.classSection || "").localeCompare(String(b.classSection || ""));
      if (sec !== 0) return sec;
      return String(a.studentName || "").localeCompare(String(b.studentName || ""));
    });
  }

  function bestRowForPersonSession(person, sessionNo) {
    const rows = state.rows.filter((r) =>
      personKey(r) === person.key &&
      normalizeSessionNo(r.sessionNo) === normalizeSessionNo(sessionNo) &&
      matchesReportBaseFilters(r)
    );

    if (!rows.length) return null;

    return rows.sort((a, b) => rowScoreForMerge(b) - rowScoreForMerge(a))[0];
  }

  function reportLearningRows() {
    return state.rows.filter((r) =>
      matchesReportBaseFilters(r) &&
      isLearningSession(r.sessionNo)
    );
  }

  function buildStudentProgressReport() {
    const rows = state.rows.filter((r) => matchesReportBaseFilters(r));
    const persons = knownPersonsFromRows(rows);

    return persons.map((p) => {
      const learningRows = state.rows.filter((r) =>
        personKey(r) === p.key &&
        matchesReportBaseFilters(r) &&
        isLearningSession(r.sessionNo)
      );

      const done = learningRows.filter((r) => r.completed).length;
      const minOk = learningRows.filter((r) => r.minTimeMet).length;
      const risk = learningRows.filter((r) => isRiskRow(r)).length;
      const best = learningRows.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);
      const totalActive = learningRows.reduce((s, r) => s + (Number(r.activeTimeSec) || 0), 0);
      const totalDuration = learningRows.reduce((s, r) => s + (Number(r.durationSec) || 0), 0);

      const sessionMap = new Map(
        learningRows.map((r) => [normalizeSessionNo(r.sessionNo), r])
      );

      const hasAnyAttendance = state.rows.some((r) =>
        personKey(r) === p.key &&
        matchesReportBaseFilters(r)
      );

      return {
        ...p,
        learningRows,
        done,
        minOk,
        risk,
        best,
        totalActive,
        totalDuration,
        sessionMap,
        hasAnyAttendance
      };
    });
  }

  function buildMissingReport() {
    const target = normalizeSessionNo(state.report.targetSession || "S01");
    const baseRows = state.rows.filter((r) => matchesReportBaseFilters(r));
    const persons = knownPersonsFromRows(baseRows);

    return persons.map((p) => {
      const personAttendanceRows = state.rows.filter((r) =>
        personKey(r) === p.key &&
        matchesReportBaseFilters(r)
      );

      const hasAnyAttendance = personAttendanceRows.length > 0;
      const r = bestRowForPersonSession(p, target);

      if (!hasAnyAttendance) {
        return {
          ...p,
          targetSession: target,
          reason: "never entered",
          durationSec: 0,
          activeTimeSec: 0,
          score: 0,
          row: null
        };
      }

      if (!r) {
        return {
          ...p,
          targetSession: target,
          reason: "not started",
          durationSec: 0,
          activeTimeSec: 0,
          score: 0,
          row: null
        };
      }

      const minSec = Math.max(0, Number(state.report.minSec) || 0);
      const activeOrDuration = Number(r.activeTimeSec) || Number(r.durationSec) || 0;

      if (!r.completed) {
        return {
          ...p,
          targetSession: target,
          reason: "not completed",
          durationSec: r.durationSec,
          activeTimeSec: r.activeTimeSec,
          score: r.score,
          row: r
        };
      }

      if (activeOrDuration < minSec) {
        return {
          ...p,
          targetSession: target,
          reason: `min time < ${minSec}s`,
          durationSec: r.durationSec,
          activeTimeSec: r.activeTimeSec,
          score: r.score,
          row: r
        };
      }

      return null;
    }).filter(Boolean);
  }

  function progressDots(sessionMap) {
    return Array.from({ length: 15 }, (_, i) => {
      const s = `S${String(i + 1).padStart(2, "0")}`;
      const r = sessionMap.get(s);

      if (!r) {
        return `<span class="progress-dot" title="${s}: no data">${String(i + 1).padStart(2, "0")}</span>`;
      }

      const cls = r.completed && r.minTimeMet
        ? "done"
        : r.completed
          ? "partial"
          : "risk";

      return `<span class="progress-dot ${cls}" title="${s}: ${escapeHtml(statusLabel(r.attendanceStatus))}">${String(i + 1).padStart(2, "0")}</span>`;
    }).join("");
  }

  function getPersonSmartRows(row) {
    if (!row) return [];
    return state.rows
      .filter((r) => samePerson(r, row))
      .sort((a, b) => normalizeSessionNo(a.sessionNo).localeCompare(normalizeSessionNo(b.sessionNo)));
  }

  function getPersonRawRows(row) {
    if (!row) return [];
    return state.rawRows
      .filter((r) => samePerson(r, row))
      .sort((a, b) => rowTimeMs(b) - rowTimeMs(a));
  }

  function statusLabel(status) {
    const s = String(status || "").toLowerCase();
    if (s === "completed") return "Completed";
    if (s === "in_progress") return "In Progress";
    if (s === "entered") return "Entered";
    if (s === "failed") return "Failed";
    if (s === "left") return "Left";
    return status || "-";
  }

  function viewHintText(view) {
    if (view === "overview") {
      return "Overview: ดูภาพรวมเร็ว ๆ สำหรับติดตามชั้นเรียน เช่น จำนวนเข้าเรียน Completed, At Risk และ Heatmap";
    }

    if (view === "report") {
      return "Report: ใช้สรุปรายงานผล เลือกช่วงวันที่ เลือก S ที่ต้องการ ตรวจคนที่ยังไม่เข้า/ยังไม่ผ่าน และ Export/Print ได้";
    }

    if (view === "students") {
      return "Students: ดูรายชื่อนักศึกษา รายด่าน รายละเอียดรายคน ประวัติ attempts และความคืบหน้า S01–S15";
    }

    if (view === "advanced") {
      return "Advanced: ดูข้อมูลเชิงลึก เช่น Section Summary, Section × S Matrix และ Heatmap แบบละเอียด";
    }

    return "Show All: แสดงทุกส่วนในหน้าเดียว เหมาะสำหรับตรวจสอบระบบหรือ export ภาพรวม";
  }

  function setEndpointPill(text, ok = true) {
    const el = $("endpoint-pill");
    if (!el) return;
    el.textContent = text;
    el.style.borderColor = ok ? "rgba(46,213,115,.35)" : "rgba(255,107,129,.45)";
    el.style.color = ok ? "#b9ffd0" : "#ffd4db";
  }

  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((r) => {
      const sessionNo = normalizeSessionNo(r.sessionNo);

      return {
        visitId: safe(r.visitId, ""),
        studentId: safe(r.studentId, ""),
        studentName: safe(r.studentName, ""),
        classSection: safe(r.classSection, ""),
        sessionNo,
        lessonId: safe(r.lessonId, "techpath-vr"),
        pageUrl: safe(r.pageUrl, ""),
        enteredAt: r.enteredAt || "",
        startedAt: r.startedAt || "",
        finishedAt: r.finishedAt || "",
        lastActiveAt: r.lastActiveAt || "",
        durationSec: num(r.durationSec),
        activeTimeSec: num(r.activeTimeSec),
        actionsCount: num(r.actionsCount),
        score: num(r.score),
        completed: bool(r.completed),
        attendanceStatus: safe(r.attendanceStatus, "entered"),
        minTimeMet: bool(r.minTimeMet),
        firstServerTs: r.firstServerTs || "",
        lastServerTs: r.lastServerTs || "",
        userAgent: safe(r.userAgent, "")
      };
    });
  }

  function normalizeRosterRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        studentId: safe(r.student_id || r.studentId || r.sid, ""),
        studentName: safe(r.display_name || r.displayName || r.studentName || r.name, ""),
        classSection: safe(r.section || r.class_section || r.classSection || r.group, ""),
        email: safe(r.email || r.mail, ""),
        group: safe(r.group || r.team || r.class_group, ""),
        status: safe(r.status || "active", "active"),
        note: safe(r.note || r.remark, ""),
        source: "roster"
      }))
      .filter((r) => {
        if (!r.studentId && !r.studentName) return false;
        const st = String(r.status || "").toLowerCase();
        return st !== "inactive" && st !== "drop" && st !== "deleted";
      });
  }

  async function fetchDashboard() {
    const url = new URL(ENDPOINT);
    url.searchParams.set("teacher", "dashboard");
    url.searchParams.set("_t", String(Date.now()));

    setEndpointPill("Endpoint: loading...", true);

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Teacher dashboard request failed");
    }

    return data;
  }

  async function fetchRosterDashboard() {
    const url = new URL(ENDPOINT);
    url.searchParams.set("api", "vocab");
    url.searchParams.set("action", "teacher_dashboard_get");
    url.searchParams.set("_t", String(Date.now()));

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Vocab roster dashboard request failed");
    }

    const roster =
      data?.data?.class_roster ||
      data?.data?.roster ||
      data?.data?.students_roster ||
      [];

    return Array.isArray(roster) ? roster : [];
  }

  function deriveSummary(rows) {
    const total = rows.length;
    const entryRows = rows.filter((r) => !isLearningSession(r.sessionNo));
    const learningRows = rows.filter((r) => isLearningSession(r.sessionNo));

    const completed = learningRows.filter((r) => r.completed).length;
    const minTimeMet = learningRows.filter((r) => r.minTimeMet).length;
    const inProgress = learningRows.filter((r) => r.attendanceStatus === "in_progress").length;
    const atRisk = learningRows.filter((r) => isRiskRow(r)).length;

    const avgDurationSec = learningRows.length
      ? Math.round(learningRows.reduce((s, r) => s + r.durationSec, 0) / learningRows.length)
      : 0;

    const avgActiveTimeSec = learningRows.length
      ? Math.round(learningRows.reduce((s, r) => s + r.activeTimeSec, 0) / learningRows.length)
      : 0;

    const avgScore = learningRows.length
      ? Math.round(learningRows.reduce((s, r) => s + r.score, 0) / learningRows.length)
      : 0;

    return {
      total,
      entryCount: entryRows.length,
      learningCount: learningRows.length,
      completed,
      minTimeMet,
      inProgress,
      atRisk,
      avgDurationSec,
      avgActiveTimeSec,
      avgScore
    };
  }

  function fillSelect(id, items, label) {
    const el = $(id);
    if (!el) return;

    const old = el.value;
    const unique = [...new Set(items.filter(Boolean))].sort();

    el.innerHTML =
      `<option value="">${escapeHtml(label)}</option>` +
      unique.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");

    if (unique.includes(old)) el.value = old;
  }

  function renderSummary(summary) {
    const root = $("summary-cards");
    if (!root) return;

    if (!summary || !summary.total) {
      root.innerHTML = `<div class="panel card"><div class="k">No data</div><div class="v">-</div></div>`;
      return;
    }

    const cards = [
      ["รายการทั้งหมด", summary.total, ""],
      ["เข้าเว็บ / Lobby", summary.entryCount, "warn"],
      ["ด่านเรียนจริง", summary.learningCount, ""],
      ["Completed", summary.completed, "ok"],
      ["Min time ผ่าน", summary.minTimeMet, "ok"],
      ["At Risk", summary.atRisk, summary.atRisk ? "bad" : "ok"],
      ["Avg Duration", fmtSec(summary.avgDurationSec), ""],
      ["Avg Score", summary.avgScore, ""]
    ];

    root.innerHTML = cards.map(([k, v, cls]) => `
      <div class="panel card ${cls}">
        <div class="k">${escapeHtml(k)}</div>
        <div class="v">${escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  function applyFilters() {
    const q = state.filters.search.toLowerCase().trim();

    state.filteredRows = state.rows.filter((r) => {
      if (!inDateRange(r)) return false;

      if (state.filters.section && r.classSection !== state.filters.section) return false;
      if (state.filters.status && r.attendanceStatus !== state.filters.status) return false;
      if (state.filters.session && r.sessionNo !== state.filters.session) return false;
      if (state.filters.minTime === "yes" && !r.minTimeMet) return false;
      if (state.filters.minTime === "no" && r.minTimeMet) return false;

      if (state.quick === "completed" && (!isLearningSession(r.sessionNo) || !r.completed)) return false;
      if (state.quick === "not_completed" && (!isLearningSession(r.sessionNo) || r.completed)) return false;
      if (state.quick === "in_progress" && (!isLearningSession(r.sessionNo) || r.attendanceStatus !== "in_progress")) return false;
      if (state.quick === "min_fail" && (!isLearningSession(r.sessionNo) || r.minTimeMet)) return false;

      if (q) {
        const hay = [r.studentId, r.studentName, r.classSection, r.sessionNo, r.attendanceStatus]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }

  function tagClass(status) {
    if (status === "completed") return "completed";
    if (status === "in_progress") return "in_progress";
    if (status === "left") return "left";
    if (status === "failed") return "left";
    return "entered";
  }

  function detailMetric(label, value, cls = "") {
    return `
      <div class="mini-card ${cls}">
        <div class="k">${escapeHtml(label)}</div>
        <div class="v">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function renderSessionTimeline(row) {
    const rows = getPersonSmartRows(row).filter((r) => isLearningSession(r.sessionNo));
    const byS = new Map(rows.map((r) => [normalizeSessionNo(r.sessionNo), r]));

    return Array.from({ length: 15 }, (_, i) => {
      const s = `S${String(i + 1).padStart(2, "0")}`;
      const r = byS.get(s);

      if (!r) {
        return `<div class="matrix-badge zero" title="${s}: no data">${s}</div>`;
      }

      const cls = r.completed && r.minTimeMet
        ? "done"
        : r.completed
          ? "warn2"
          : isRiskRow(r)
            ? "risk"
            : "zero";

      const title = `${s}: ${statusLabel(r.attendanceStatus)} • ${fmtSec(r.durationSec)} • score ${r.score}`;

      return `<div class="matrix-badge ${cls}" title="${escapeHtml(title)}">${s}</div>`;
    }).join("");
  }

  function renderAttemptList(row) {
    const attempts = getPersonRawRows(row)
      .filter((r) => normalizeSessionNo(r.sessionNo) === normalizeSessionNo(row.sessionNo))
      .slice(0, 12);

    if (!attempts.length) {
      return `<div class="detail-empty">ยังไม่มี attempt raw สำหรับด่านนี้</div>`;
    }

    return `
      <div class="session-list">
        ${attempts.map((r, idx) => `
          <div class="session-item">
            <div class="top">
              <div class="name">Attempt ${idx + 1} • ${escapeHtml(safe(r.sessionNo))}</div>
              <div class="meta">${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</div>
            </div>
            <div class="meta">
              Status: ${escapeHtml(statusLabel(r.attendanceStatus))}
              • Duration: ${escapeHtml(fmtSec(r.durationSec))}
              • Active: ${escapeHtml(fmtSec(r.activeTimeSec))}
              • Score: ${escapeHtml(r.score)}
              • Min time: ${r.minTimeMet ? "YES" : "NO"}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderStudentDetail(row) {
    const root = $("detail-body");
    if (!root) return;

    if (!row) {
      root.innerHTML = `<div class="detail-empty">เลือกแถวทางซ้ายเพื่อดูรายละเอียดผู้เรียน</div>`;
      return;
    }

    const personRows = getPersonSmartRows(row);
    const learningRows = personRows.filter((r) => isLearningSession(r.sessionNo));
    const entryRows = personRows.filter((r) => !isLearningSession(r.sessionNo));
    const rawRows = getPersonRawRows(row);

    const completed = learningRows.filter((r) => r.completed).length;
    const minOk = learningRows.filter((r) => r.minTimeMet).length;
    const risk = learningRows.filter((r) => isRiskRow(r)).length;
    const bestScore = learningRows.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);
    const totalDuration = learningRows.reduce((s, r) => s + (Number(r.durationSec) || 0), 0);
    const totalActive = learningRows.reduce((s, r) => s + (Number(r.activeTimeSec) || 0), 0);

    const selectedRisk = riskReason(row);
    const selectedIsRisk = isRiskRow(row);

    root.innerHTML = `
      <div class="kv">
        <div class="k">Student</div>
        <div>${escapeHtml(safe(row.studentName))}</div>

        <div class="k">Student ID</div>
        <div>${escapeHtml(safe(row.studentId))}</div>

        <div class="k">Section</div>
        <div>${escapeHtml(safe(row.classSection))}</div>

        <div class="k">Selected S</div>
        <div>${escapeHtml(safe(row.sessionNo))}</div>

        <div class="k">Status</div>
        <div><span class="tag ${tagClass(row.attendanceStatus)}">${escapeHtml(statusLabel(row.attendanceStatus))}</span></div>

        <div class="k">Risk</div>
        <div class="${selectedIsRisk ? "no" : "yes"}">${escapeHtml(selectedIsRisk ? selectedRisk : "OK")}</div>
      </div>

      <div class="mini-grid">
        ${detailMetric("ด่านเรียนจริง", learningRows.length)}
        ${detailMetric("Completed", completed, completed ? "ok" : "")}
        ${detailMetric("Min time ผ่าน", minOk, minOk ? "ok" : "")}
        ${detailMetric("At Risk", risk, risk ? "bad" : "ok")}
        ${detailMetric("Best Score", bestScore)}
        ${detailMetric("Total Duration", fmtSec(totalDuration))}
        ${detailMetric("Total Active", fmtSec(totalActive))}
        ${detailMetric("Raw Visits", rawRows.length)}
      </div>

      <div class="section-title">S01–S15 Progress</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${renderSessionTimeline(row)}
      </div>

      <div class="section-title">Selected Session</div>
      <div class="mini-grid">
        ${detailMetric("Session", row.sessionNo)}
        ${detailMetric("Duration", fmtSec(row.durationSec))}
        ${detailMetric("Active", fmtSec(row.activeTimeSec))}
        ${detailMetric("Score", row.score)}
        ${detailMetric("Completed", row.completed ? "YES" : "NO", row.completed ? "ok" : "bad")}
        ${detailMetric("Min Time", row.minTimeMet ? "YES" : "NO", row.minTimeMet ? "ok" : "bad")}
      </div>

      <div class="section-title">Attempts ในด่านนี้</div>
      ${renderAttemptList(row)}

      ${entryRows.length ? `
        <div class="section-title">Entry / Lobby records</div>
        <div class="event-list">
          ${entryRows.slice(0, 6).map((r) => `
            <div class="event-item">
              <div class="top">
                <div class="name">${escapeHtml(safe(r.sessionNo))}</div>
                <div class="meta">${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</div>
              </div>
              <div class="meta">${escapeHtml(statusLabel(r.attendanceStatus))} • ${escapeHtml(fmtSec(r.durationSec))}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    `;
  }

  function highlightSelectedRows() {
    document.querySelectorAll("[data-student-row-key]").forEach((tr) => {
      tr.classList.toggle("student-row-active", tr.getAttribute("data-student-row-key") === state.selectedKey);
    });

    document.querySelectorAll("[data-risk-row-key]").forEach((tr) => {
      tr.classList.toggle("student-row-active", tr.getAttribute("data-risk-row-key") === state.selectedKey);
    });
  }

  function selectDetailRow(key) {
    const row =
      state.filteredRows.find((r) => rowKey(r) === key) ||
      state.rows.find((r) => rowKey(r) === key) ||
      null;

    state.selectedKey = key || "";
    state.selectedRow = row;
    renderStudentDetail(row);
    highlightSelectedRows();
  }

  function renderTable() {
    const tbody = $("students-tbody");
    const meta = $("table-meta");
    if (!tbody || !meta) return;

    meta.textContent = `${state.filteredRows.length} rows`;

    if (!state.filteredRows.length) {
      tbody.innerHTML = `<tr><td colspan="11">ไม่พบข้อมูล</td></tr>`;
      renderStudentDetail(null);
      return;
    }

    tbody.innerHTML = state.filteredRows.map((r) => {
      const key = rowKey(r);

      return `
        <tr data-student-row-key="${escapeHtml(key)}">
          <td>${escapeHtml(safe(r.studentId))}</td>
          <td>
            ${escapeHtml(safe(r.studentName))}
            ${r.rawCount > 1 ? `<br><span style="color:#ffd166;font-size:.78rem;">${r.rawCount} visits merged</span>` : ""}
          </td>
          <td>${escapeHtml(safe(r.classSection))}</td>
          <td>${escapeHtml(safe(r.sessionNo))}</td>
          <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(statusLabel(r.attendanceStatus))}</span></td>
          <td>${escapeHtml(fmtSec(r.durationSec))}</td>
          <td>${escapeHtml(fmtSec(r.activeTimeSec))}</td>
          <td>${escapeHtml(r.score)}</td>
          <td class="${r.completed ? "yes" : "no"}">${r.completed ? "YES" : "NO"}</td>
          <td class="${r.minTimeMet ? "yes" : "no"}">${r.minTimeMet ? "YES" : "NO"}</td>
          <td>${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-student-row-key]").forEach((tr) => {
      tr.addEventListener("click", () => {
        selectDetailRow(tr.getAttribute("data-student-row-key") || "");
      });
    });

    if (state.selectedKey && state.filteredRows.some((r) => rowKey(r) === state.selectedKey)) {
      renderStudentDetail(state.filteredRows.find((r) => rowKey(r) === state.selectedKey));
    } else {
      renderStudentDetail(state.filteredRows[0]);
      state.selectedKey = rowKey(state.filteredRows[0]);
      state.selectedRow = state.filteredRows[0];
    }

    highlightSelectedRows();
  }

  function renderHeatmap() {
    const root = $("session-heatmap-grid");
    const meta = $("heatmap-meta");
    if (!root || !meta) return;

    const sessions = sessionList().map((s) => ({
      sessionNo: s,
      total: 0,
      completed: 0,
      inProgress: 0,
      minFail: 0
    }));

    const map = new Map(sessions.map((x) => [x.sessionNo, x]));

    state.filteredRows.forEach((r) => {
      const item = map.get(r.sessionNo);
      if (!item) return;
      item.total += 1;
      if (r.completed) item.completed += 1;
      if (r.attendanceStatus === "in_progress") item.inProgress += 1;
      if (!r.minTimeMet) item.minFail += 1;
    });

    const active = sessions.filter((x) => x.total > 0).length;
    meta.textContent = `${active} active sessions`;

    root.innerHTML = sessions.map((r) => {
      const lv =
        r.total <= 0 ? "lv0" :
        r.total === 1 ? "lv1" :
        r.total === 2 ? "lv2" :
        r.total <= 4 ? "lv3" :
        r.total <= 7 ? "lv4" : "lv5";

      return `
        <div class="heatmap-cell ${lv}">
          <div class="s">${escapeHtml(r.sessionNo)}</div>
          <div class="n">${escapeHtml(r.total)}</div>
          <div class="m">
            complete ${escapeHtml(r.completed)}<br>
            in progress ${escapeHtml(r.inProgress)}<br>
            min fail ${escapeHtml(r.minFail)}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderRisk() {
    const tbody = $("risk-tbody");
    const meta = $("risk-meta");
    if (!tbody || !meta) return;

    const rows = state.filteredRows.filter((r) => isRiskRow(r));

    meta.textContent = `${rows.length} rows`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">ไม่มีรายการเสี่ยง</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.slice(0, 80).map((r) => {
      const key = rowKey(r);

      return `
        <tr data-risk-row-key="${escapeHtml(key)}">
          <td>
            ${escapeHtml(safe(r.studentName))}
            <br><span style="color:#9db2c7;font-size:.82rem;">${escapeHtml(safe(r.studentId))}</span>
            <br><span style="color:#ffd166;font-size:.78rem;">${escapeHtml(riskReason(r))}</span>
          </td>
          <td>${escapeHtml(safe(r.classSection))}</td>
          <td>${escapeHtml(safe(r.sessionNo))}</td>
          <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(statusLabel(r.attendanceStatus))}</span></td>
          <td>${escapeHtml(fmtSec(r.durationSec))}</td>
          <td class="${r.minTimeMet ? "yes" : "no"}">${r.minTimeMet ? "YES" : "NO"}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-risk-row-key]").forEach((tr) => {
      tr.addEventListener("click", () => {
        selectDetailRow(tr.getAttribute("data-risk-row-key") || "");
      });
    });

    highlightSelectedRows();
  }

  function renderSectionSummary() {
    const tbody = $("section-summary-tbody");
    const meta = $("section-meta");
    if (!tbody || !meta) return;

    const map = new Map();

    state.filteredRows.forEach((r) => {
      const sec = r.classSection || "-";
      if (!map.has(sec)) {
        map.set(sec, {
          section: sec,
          total: 0,
          completed: 0,
          minTimeMet: 0,
          duration: 0,
          active: 0,
          score: 0
        });
      }

      const g = map.get(sec);
      g.total += 1;
      if (r.completed) g.completed += 1;
      if (r.minTimeMet) g.minTimeMet += 1;
      g.duration += r.durationSec;
      g.active += r.activeTimeSec;
      g.score += r.score;
    });

    const rows = [...map.values()].sort((a, b) => a.section.localeCompare(b.section));
    meta.textContent = `${rows.length} sections`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.section)}</td>
        <td>${escapeHtml(r.total)}</td>
        <td class="yes">${escapeHtml(r.completed)}</td>
        <td class="${r.minTimeMet === r.total ? "yes" : "no"}">${escapeHtml(r.minTimeMet)}</td>
        <td>${escapeHtml(fmtSec(r.total ? Math.round(r.duration / r.total) : 0))}</td>
        <td>${escapeHtml(fmtSec(r.total ? Math.round(r.active / r.total) : 0))}</td>
        <td>${escapeHtml(r.total ? Math.round(r.score / r.total) : 0)}</td>
      </tr>
    `).join("");
  }

  function renderMatrix() {
    const tbody = $("section-session-matrix-tbody");
    const meta = $("matrix-meta");
    if (!tbody || !meta) return;

    const sessions = sessionList().filter((s) => s !== "S00");
    const sections = [...new Set(state.filteredRows.map((r) => r.classSection || "-"))].sort();

    meta.textContent = `${sections.length} sections`;

    if (!sections.length) {
      tbody.innerHTML = `<tr><td colspan="19">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = sections.map((sec) => {
      const rows = state.filteredRows.filter((r) => (r.classSection || "-") === sec);
      const total = rows.length;
      const done = rows.filter((r) => r.completed).length;
      const minOk = rows.filter((r) => r.minTimeMet).length;

      const cells = sessions.map((s) => {
        const count = rows.filter((r) => r.sessionNo === s).length;
        const cls = count === 0 ? "zero" : count <= 2 ? "low" : count <= 5 ? "mid" : "high";
        return `<td class="center"><span class="matrix-badge ${cls}">${count}</span></td>`;
      }).join("");

      return `
        <tr>
          <td>${escapeHtml(sec)}</td>
          <td>${escapeHtml(total)}</td>
          <td class="yes">${escapeHtml(done)}</td>
          <td class="${minOk === total ? "yes" : "no"}">${escapeHtml(minOk)}</td>
          ${cells}
        </tr>
      `;
    }).join("");
  }

  function renderSectionChips() {
    const root = $("section-chip-row");
    if (!root) return;

    const sections = [
      ...state.rows.map((r) => r.classSection),
      ...state.rosterRows.map((r) => r.classSection)
    ];

    const unique = [...new Set(sections.filter(Boolean))].sort();

    root.innerHTML =
      `<button class="section-chip ${state.filters.section ? "" : "active"}" data-sec="" type="button">ทุก Section</button>` +
      unique.map((s) =>
        `<button class="section-chip ${state.filters.section === s ? "active" : ""}" data-sec="${escapeHtml(s)}" type="button">${escapeHtml(s)}</button>`
      ).join("");

    root.querySelectorAll("[data-sec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.filters.section = btn.getAttribute("data-sec") || "";
        const el = $("filter-section");
        if (el) el.value = state.filters.section;
        rerender();
      });
    });
  }

  function renderReportPack() {
    renderReportSummary();
    renderMissingReport();
    renderProgressReport();
  }

  function renderReportSummary() {
    const root = $("report-summary-cards");
    const meta = $("report-meta");
    if (!root || !meta) return;

    const learning = reportLearningRows();
    const progress = buildStudentProgressReport();
    const missing = buildMissingReport();

    const knownStudents = progress.length;
    const rosterStudents = state.rosterRows.filter((r) => personMatchesSearchAndSection(r)).length;
    const neverEntered = progress.filter((r) => !r.hasAnyAttendance).length;
    const completedRows = learning.filter((r) => r.completed).length;
    const minOkRows = learning.filter((r) => r.minTimeMet).length;

    const avgScore = learning.length
      ? Math.round(learning.reduce((s, r) => s + (Number(r.score) || 0), 0) / learning.length)
      : 0;

    meta.textContent =
      `Target ${state.report.targetSession} • Min ${state.report.minSec}s • roster ${state.rosterRows.length}`;

    const cards = [
      ["Roster Students", rosterStudents || knownStudents, ""],
      ["Known Students", knownStudents, ""],
      ["Never Entered", neverEntered, neverEntered ? "bad" : "ok"],
      ["Learning Rows", learning.length, ""],
      ["Completed Rows", completedRows, "ok"],
      ["Min Time OK", minOkRows, "ok"],
      ["Missing / Not OK", missing.length, missing.length ? "bad" : "ok"],
      ["Avg Score", avgScore, ""]
    ];

    root.innerHTML = cards.map(([k, v, cls]) => `
      <div class="panel card ${cls}">
        <div class="k">${escapeHtml(k)}</div>
        <div class="v">${escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  function renderMissingReport() {
    const tbody = $("missing-tbody");
    const meta = $("missing-meta");
    if (!tbody || !meta) return;

    const rows = buildMissingReport();
    meta.textContent = `${rows.length} students`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">ไม่มีรายการขาด/ไม่ผ่านสำหรับ ${escapeHtml(state.report.targetSession)}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>
          ${escapeHtml(safe(r.studentName))}
          <br><span style="color:#9db2c7;font-size:.82rem;">${escapeHtml(safe(r.studentId))}</span>
          ${r.source === "roster" ? `<br><span style="color:#7bedff;font-size:.76rem;">class_roster</span>` : ""}
        </td>
        <td>${escapeHtml(safe(r.classSection))}</td>
        <td>${escapeHtml(safe(r.targetSession))}</td>
        <td><span class="tag left">${escapeHtml(r.reason)}</span></td>
        <td>${escapeHtml(fmtSec(r.durationSec))}</td>
        <td>${escapeHtml(r.score)}</td>
      </tr>
    `).join("");
  }

  function renderProgressReport() {
    const tbody = $("progress-tbody");
    const meta = $("progress-meta");
    if (!tbody || !meta) return;

    const rows = buildStudentProgressReport();
    meta.textContent = `${rows.length} students`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">ไม่พบข้อมูลผู้เรียน</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>
          ${escapeHtml(safe(r.studentName))}
          <br><span style="color:#9db2c7;font-size:.82rem;">${escapeHtml(safe(r.studentId))}</span>
          ${!r.hasAnyAttendance ? `<br><span style="color:#ff6b81;font-size:.78rem;">never entered</span>` : ""}
          <div class="progress-mini">${progressDots(r.sessionMap)}</div>
        </td>
        <td>${escapeHtml(safe(r.classSection))}</td>
        <td class="${r.done ? "yes" : "no"}">${escapeHtml(r.done)} / 15</td>
        <td class="${r.minOk ? "yes" : "no"}">${escapeHtml(r.minOk)} / 15</td>
        <td class="${r.risk ? "no" : "yes"}">${escapeHtml(r.risk)}</td>
        <td>${escapeHtml(r.best)}</td>
      </tr>
    `).join("");
  }

  function setDisplay(el, show) {
    if (!el) return;
    el.style.display = show ? "" : "none";
  }

  function applyFocusView() {
    const view = state.view || "overview";
    const showAll = view === "all";

    const reportTools = $("report-tools");
    const reportSummaryPanel = $("report-summary-panel");
    const heatmapRows = document.querySelectorAll(".heatmap-row");
    const advancedPanels = Array.from(document.querySelectorAll(".section-panel")).filter((el) => {
      return el.id !== "report-summary-panel" && !el.classList.contains("report-panel");
    });
    const grid = document.querySelector(".grid");
    const hint = $("view-hint");

    setDisplay(reportTools, showAll || view === "report");
    setDisplay(reportSummaryPanel, showAll || view === "report" || view === "overview");

    heatmapRows.forEach((el, idx) => {
      if (idx === 0) {
        setDisplay(el, showAll || view === "report");
      }

      if (idx === 1) {
        setDisplay(el, showAll || view === "overview" || view === "advanced");
      }
    });

    advancedPanels.forEach((el) => {
      setDisplay(el, showAll || view === "advanced");
    });

    setDisplay(grid, showAll || view === "students");

    document.querySelectorAll("#view-tabs [data-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    if (hint) {
      hint.textContent = viewHintText(view);
    }

    document.body.classList.remove("teacher-view-loading");
  }

  function rerender() {
    applyFilters();

    renderSummary(deriveSummary(state.filteredRows));
    renderSectionChips();
    renderTable();
    renderHeatmap();
    renderRisk();
    renderSectionSummary();
    renderMatrix();
    renderReportPack();
    applyFocusView();

    const footer = $("footer-note");
    if (footer) {
      footer.textContent =
        `Build: ${PATCH} • Smart rows: ${state.rows.length} • Raw rows: ${state.rawRows.length} • Roster: ${state.rosterRows.length} • ${new Date().toLocaleString("th-TH")}`;
    }
  }

  async function loadDashboard() {
    try {
      const [attendanceData, rosterRows] = await Promise.all([
        fetchDashboard(),
        fetchRosterDashboard().catch((err) => {
          console.warn("[Teacher r8] roster load failed:", err);
          return [];
        })
      ]);

      state.rawRows = normalizeRows(attendanceData.rows || []);
      state.rows = compactLatestRows(state.rawRows);
      state.rosterRows = normalizeRosterRows(rosterRows);

      setEndpointPill(
        `Endpoint: OK • ${state.rows.length} students/S • raw ${state.rawRows.length} • roster ${state.rosterRows.length}`,
        true
      );

      const allSections = [
        ...state.rows.map((r) => r.classSection),
        ...state.rosterRows.map((r) => r.classSection)
      ];

      fillSelect("filter-section", allSections, "ทุก Section");
      fillSelect("filter-status", state.rows.map((r) => r.attendanceStatus), "ทุกสถานะ");
      fillSelect("filter-session", state.rows.map((r) => r.sessionNo), "ทุก S");

      rerender();
    } catch (err) {
      console.error("[Teacher Hotfix] load failed:", err);
      setEndpointPill("Endpoint: ERROR", false);

      const root = $("summary-cards");
      if (root) {
        root.innerHTML = `<div class="panel card bad"><div class="k">Load error</div><div class="v">!</div></div>`;
      }

      const footer = $("footer-note");
      if (footer) footer.textContent = `Build: ${PATCH} • ERROR: ${err.message || err}`;

      document.body.classList.remove("teacher-view-loading");
    }
  }

  function updateQuickUI() {
    document.querySelectorAll("#quick-filters [data-qf]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.qf === state.quick);
    });
  }

  function exportCsv(rows, prefix) {
    if (!rows.length) {
      alert("ไม่มีข้อมูลสำหรับ export");
      return;
    }

    const headers = [
      "visitId",
      "studentId",
      "studentName",
      "classSection",
      "sessionNo",
      "lessonId",
      "enteredAt",
      "startedAt",
      "finishedAt",
      "lastActiveAt",
      "durationSec",
      "activeTimeSec",
      "actionsCount",
      "score",
      "completed",
      "attendanceStatus",
      "minTimeMet",
      "firstServerTs",
      "lastServerTs",
      "rawCount",
      "pageUrl"
    ];

    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);

    a.href = url;
    a.download = `${prefix}-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportReportCsv() {
    const progress = buildStudentProgressReport();
    const missing = buildMissingReport();

    const headers = [
      "report_type",
      "studentId",
      "studentName",
      "classSection",
      "targetSession",
      "source",
      "doneCount",
      "minOkCount",
      "riskCount",
      "bestScore",
      "totalActiveSec",
      "totalDurationSec",
      "hasAnyAttendance",
      "missingReason"
    ];

    const rows = [
      ...progress.map((r) => [
        "progress",
        r.studentId,
        r.studentName,
        r.classSection,
        state.report.targetSession,
        r.source || "",
        r.done,
        r.minOk,
        r.risk,
        r.best,
        r.totalActive,
        r.totalDuration,
        r.hasAnyAttendance ? "yes" : "no",
        ""
      ]),
      ...missing.map((r) => [
        "missing",
        r.studentId,
        r.studentName,
        r.classSection,
        r.targetSession,
        r.source || "",
        "",
        "",
        "",
        r.score,
        r.activeTimeSec,
        r.durationSec,
        r.row ? "yes" : "no",
        r.reason
      ])
    ];

    if (!rows.length) {
      alert("ไม่มีข้อมูลสำหรับ export report");
      return;
    }

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);

    a.href = url;
    a.download = `techpath-report-${state.report.targetSession}-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    $("filter-search")?.addEventListener("input", (e) => {
      state.filters.search = e.target.value || "";
      rerender();
    });

    $("filter-section")?.addEventListener("change", (e) => {
      state.filters.section = e.target.value || "";
      rerender();
    });

    $("filter-status")?.addEventListener("change", (e) => {
      state.filters.status = e.target.value || "";
      rerender();
    });

    $("filter-session")?.addEventListener("change", (e) => {
      state.filters.session = e.target.value || "";
      rerender();
    });

    $("filter-minTime")?.addEventListener("change", (e) => {
      state.filters.minTime = e.target.value || "";
      rerender();
    });

    $("filter-date-from")?.addEventListener("change", (e) => {
      state.filters.dateFrom = e.target.value || "";
      rerender();
    });

    $("filter-date-to")?.addEventListener("change", (e) => {
      state.filters.dateTo = e.target.value || "";
      rerender();
    });

    $("report-session")?.addEventListener("change", (e) => {
      state.report.targetSession = normalizeSessionNo(e.target.value || "S01");
      rerender();
    });

    $("report-min-sec")?.addEventListener("input", (e) => {
      state.report.minSec = Math.max(0, Number(e.target.value) || 0);
      rerender();
    });

    $("btn-report-today")?.addEventListener("click", () => {
      const today = localDateInputValue(new Date());

      state.filters.dateFrom = today;
      state.filters.dateTo = today;

      if ($("filter-date-from")) $("filter-date-from").value = today;
      if ($("filter-date-to")) $("filter-date-to").value = today;

      rerender();
    });

    $("btn-report-week")?.addEventListener("click", () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);

      const from = localDateInputValue(start);
      const to = localDateInputValue(end);

      state.filters.dateFrom = from;
      state.filters.dateTo = to;

      if ($("filter-date-from")) $("filter-date-from").value = from;
      if ($("filter-date-to")) $("filter-date-to").value = to;

      rerender();
    });

    $("btn-print-report")?.addEventListener("click", () => {
      window.print();
    });

    $("btn-export-report")?.addEventListener("click", () => {
      exportReportCsv();
    });

    $("btn-refresh")?.addEventListener("click", loadDashboard);

    $("btn-auto")?.addEventListener("click", () => {
      state.auto = !state.auto;
      const btn = $("btn-auto");
      if (btn) btn.textContent = `Auto refresh: ${state.auto ? "ON" : "OFF"}`;
    });

    $("btn-export")?.addEventListener("click", () => exportCsv(state.filteredRows, "techpath-attendance"));

    $("btn-export-section")?.addEventListener("click", () => exportCsv(state.filteredRows, "techpath-section"));

    $("btn-show-unfinished")?.addEventListener("click", () => {
      state.quick = "not_completed";
      updateQuickUI();
      rerender();
    });

    $("btn-show-minfail")?.addEventListener("click", () => {
      state.quick = "min_fail";
      updateQuickUI();
      rerender();
    });

    $("btn-clear-fastfilters")?.addEventListener("click", () => {
      state.quick = "all";
      updateQuickUI();
      rerender();
    });

    document.querySelectorAll("#quick-filters [data-qf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.quick = btn.dataset.qf || "all";
        updateQuickUI();
        rerender();
      });
    });

    document.querySelectorAll("#view-tabs [data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.view = btn.dataset.view || "overview";
        localStorage.setItem("TECHPATH_TEACHER_VIEW", state.view);
        applyFocusView();
      });
    });

    $("mobile-filter-toggle")?.addEventListener("click", () => {
      document.body.classList.toggle("filters-collapsed");
      const collapsed = document.body.classList.contains("filters-collapsed");
      const btn = $("mobile-filter-toggle");
      if (btn) btn.textContent = collapsed ? "แสดง Filters" : "ซ่อน Filters";
    });
  }

  function ensurePolishCss() {
    if (document.getElementById("teacher-polish-r8-css")) return;

    const style = document.createElement("style");
    style.id = "teacher-polish-r8-css";
    style.textContent = `
      .student-row-active{
        background:rgba(123,237,255,.12)!important;
        outline:1px solid rgba(123,237,255,.35);
        outline-offset:-1px;
      }

      .detail .mini-card.ok .v{
        color:var(--ok);
      }

      .detail .mini-card.bad .v{
        color:var(--bad);
      }

      .detail .matrix-badge{
        margin:0 2px 4px 0;
        cursor:default;
      }

      .detail .matrix-badge.done{
        color:#b9ffd0;
        background:rgba(46,213,115,.13);
        border-color:rgba(46,213,115,.24);
      }

      .detail .matrix-badge.warn2{
        color:#ffeaa7;
        background:rgba(241,196,15,.12);
        border-color:rgba(241,196,15,.20);
      }

      .detail .matrix-badge.risk{
        color:#ffd4db;
        background:rgba(255,107,129,.14);
        border-color:rgba(255,107,129,.24);
      }

      @media (max-width:700px){
        .student-row-active{
          outline:2px solid rgba(123,237,255,.45);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    ensurePolishCss();
    bind();
    applyFocusView();
    loadDashboard();

    state.timer = setInterval(() => {
      if (state.auto) loadDashboard();
    }, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
