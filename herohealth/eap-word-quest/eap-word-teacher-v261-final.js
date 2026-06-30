/* =========================================================
   EAP Word Quest • Teacher Dashboard Final
   File: /herohealth/eap-word-quest/eap-word-teacher-v261-final.js
   Version: v2.6.1-TEACHER-DASHBOARD-FINAL-122
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.1-TEACHER-DASHBOARD-FINAL-122";
  const GROUP = "122";
  const FLOW = [
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];
  const ARC = [
    { name:"Arc 1 • Foundation", sessions:["S1","S2","S3","BG1"] },
    { name:"Arc 2 • Evidence", sessions:["S4","S5","S6","BG2"] },
    { name:"Arc 3 • Academic Writing", sessions:["S7","S8","S9","BG3"] },
    { name:"Arc 4 • Professional Communication", sessions:["S10","S11","S12","BG4"] },
    { name:"Arc 5 • Global Communication", sessions:["S13","S14","S15","BG5"] }
  ];

  if (window.__EAP_WORD_TEACHER_V261__) return;
  window.__EAP_WORD_TEACHER_V261__ = true;

  const state = {
    mode: "cloud",
    logs: [],
    report: null,
    server: null,
    selected: "",
    error: "",
    loadedAt: ""
  };

  const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const number = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const yes = (v) => v === true || v === 1 || String(v).toLowerCase() === "true";
  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const $ = (id) => document.getElementById(id);
  const isFlow = (id) => FLOW.includes(norm(id).toUpperCase());
  const time = (v) => {
    const t = new Date(v || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const formatDate = (v) => {
    if (!v) return "–";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("th-TH", { timeZone:"Asia/Bangkok", dateStyle:"short", timeStyle:"short" });
  };
  const threshold = (id) => id === "BG5" ? 75 : /^BG/.test(id) ? 70 : 60;

  function array(value) {
    if (Array.isArray(value)) return value.map(norm).filter(Boolean);
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(norm).filter(Boolean);
    } catch (err) {}
    return value.split(/[|,;]/).map(norm).filter(Boolean);
  }

  function endpoint() {
    const saved = (() => {
      try {
        return localStorage.getItem("EAP_WORD_TEACHER_ENDPOINT") ||
          localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || "";
      } catch (err) {
        return "";
      }
    })();
    const config = window.EAP_WORD_SHEET_CONFIG || {};
    return norm(saved || config.endpoint || "");
  }

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(norm(url));
  }

  function statusClass(status) {
    const s = norm(status).toLowerCase();
    if (s.includes("risk")) return "risk";
    if (s.includes("review")) return "review";
    if (s.includes("mastery") || s.includes("strong") || s.includes("ready")) return "good";
    return "info";
  }

  function canonical(input) {
    const row = input && typeof input === "object" ? input : {};
    const sessionId = norm(row.sessionId || row.session).toUpperCase();
    const type = norm(row.sessionType).toLowerCase();
    const source = norm(row.source).toLowerCase();
    if (!isFlow(sessionId) || type === "profile" || source.includes("profile-identity-sync")) return null;

    const studentId = norm(row.studentId || row.id || "anon");
    const studentName = norm(row.studentName || row.name || "Anonymous");
    const correct = Math.max(0, Math.round(number(row.correct)));
    const total = Math.max(1, Math.round(number(row.total || row.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(number(row.accuracy, correct / total * 100))));
    const passThreshold = Math.round(number(row.passThreshold, threshold(sessionId)));
    const playedAt = norm(row.playedAt || row.clientTs || row.serverTs || new Date().toISOString());

    return {
      fingerprint: norm(row.fingerprint),
      attemptId: norm(row.attemptId),
      source: norm(row.source || "student"),
      group: GROUP,
      section: GROUP,
      studentId,
      studentName,
      studentKey: `${GROUP}|${studentId}`,
      sessionId,
      sessionTitle: norm(row.sessionTitle || sessionId),
      correct,
      total,
      accuracy,
      passed: yes(row.passed) || accuracy >= passThreshold,
      passThreshold,
      xp: Math.max(0, Math.round(number(row.xp, row.score))),
      score: Math.max(0, Math.round(number(row.score, row.xp))),
      maxCombo: Math.max(0, Math.round(number(row.maxCombo))),
      aiDifficulty: norm(row.aiDifficulty),
      aiPrediction: norm(row.aiPrediction),
      hintUsed: Math.max(0, Math.round(number(row.hintUsed))),
      weakWords: array(row.weakWords),
      responseTimeAvg: Math.max(0, number(row.responseTimeAvg)),
      playedAt
    };
  }

  function uniqueLogs(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).map(canonical).filter(Boolean).forEach((row) => {
      const key = row.fingerprint || [row.studentKey,row.sessionId,row.correct,row.total,row.accuracy,row.playedAt.slice(0,19)].join("|");
      const old = map.get(key);
      if (!old || time(row.playedAt) >= time(old.playedAt)) map.set(key, row);
    });
    return Array.from(map.values()).sort((a,b) => time(b.playedAt) - time(a.playedAt));
  }

  function average(values) {
    const list = values.map(Number).filter(Number.isFinite);
    return list.length ? Math.round(list.reduce((sum,v) => sum + v, 0) / list.length) : 0;
  }

  function best(records) {
    return records.slice().sort((a,b) => {
      if (a.passed !== b.passed) return a.passed ? -1 : 1;
      if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
      return time(b.playedAt) - time(a.playedAt);
    })[0] || null;
  }

  function latest(records) {
    return records.slice().sort((a,b) => time(b.playedAt) - time(a.playedAt))[0] || null;
  }

  function countWords(records) {
    const words = new Map();
    records.forEach((row) => row.weakWords.forEach((word) => {
      const label = norm(word);
      const key = label.toLowerCase();
      if (!key) return;
      const old = words.get(key) || { word:label, count:0 };
      old.count += 1;
      words.set(key, old);
    }));
    return Array.from(words.values()).sort((a,b) => b.count - a.count || a.word.localeCompare(b.word));
  }

  function risk(student) {
    if (student.passedSessions === FLOW.length) {
      if (student.averageAccuracy >= 90) return "Mastery";
      if (student.averageAccuracy >= 75) return "Strong";
      return "Ready";
    }
    if (student.playedSessions >= 3 && student.averageAccuracy < 60) return "At Risk";
    if (student.weakWords.length >= 5) return "Needs Review";
    if (student.averageAccuracy >= 75) return "Strong";
    return "Ready";
  }

  function buildReport(rows) {
    const logs = uniqueLogs(rows);
    const groups = new Map();
    logs.forEach((row) => {
      const list = groups.get(row.studentKey) || [];
      list.push(row);
      groups.set(row.studentKey, list);
    });

    const students = Array.from(groups.entries()).map(([studentKey, records]) => {
      const history = records.slice().sort((a,b) => time(b.playedAt) - time(a.playedAt));
      const bySession = {};
      const latestBySession = {};
      FLOW.forEach((sessionId) => {
        const list = history.filter((row) => row.sessionId === sessionId);
        if (list.length) {
          bySession[sessionId] = best(list);
          latestBySession[sessionId] = latest(list);
        }
      });
      const sessionBest = FLOW.map((id) => bySession[id]).filter(Boolean);
      const passedSessions = sessionBest.filter((row) => row.passed).length;
      const weakWords = countWords(history).slice(0,10).map((row) => row.word);
      const current = latest(history);
      const student = {
        studentKey,
        studentId: current.studentId,
        studentName: current.studentName,
        records: history,
        bySession,
        latestBySession,
        playedSessions: sessionBest.length,
        passedSessions,
        progressPercent: Math.round(passedSessions / FLOW.length * 100),
        averageAccuracy: average(sessionBest.map((row) => row.accuracy)),
        bestAccuracy: sessionBest.length ? Math.max(...sessionBest.map((row) => row.accuracy)) : 0,
        totalAttempts: history.length,
        totalXp: history.reduce((sum,row) => sum + row.xp, 0),
        weakWords,
        lastSession: current.sessionId,
        lastPlayed: current.playedAt,
        lastPrediction: current.aiPrediction || "–"
      };
      student.status = risk(student);
      student.nextMission = FLOW.find((id) => !student.bySession[id] || !student.bySession[id].passed) || "DONE";
      student.pathGap = FLOW.find((id,index) => (!student.bySession[id] || !student.bySession[id].passed) && FLOW.slice(index + 1).some((later) => student.bySession[later] && student.bySession[later].passed)) || "";
      student.arcProgress = ARC.map((arc) => {
        const list = arc.sessions.map((id) => student.bySession[id]).filter(Boolean);
        const passed = list.filter((row) => row.passed).length;
        return { name:arc.name, passed, total:arc.sessions.length, accuracy:average(list.map((row) => row.accuracy)) };
      });
      return student;
    });

    const sessionOverview = FLOW.map((sessionId) => {
      const sessionRows = logs.filter((row) => row.sessionId === sessionId);
      const byStudent = new Map();
      sessionRows.forEach((row) => {
        const list = byStudent.get(row.studentKey) || [];
        list.push(row);
        byStudent.set(row.studentKey, list);
      });
      const bestRows = Array.from(byStudent.values()).map(best).filter(Boolean);
      return {
        sessionId,
        playedStudents: bestRows.length,
        passedStudents: bestRows.filter((row) => row.passed).length,
        averageAccuracy: average(bestRows.map((row) => row.accuracy)),
        attempts: sessionRows.length,
        weakWords: countWords(sessionRows).slice(0,5)
      };
    });

    const hardest = sessionOverview.filter((row) => row.playedStudents > 0).sort((a,b) => a.averageAccuracy - b.averageAccuracy)[0];
    return {
      logs,
      students,
      sessionOverview,
      weakWords: countWords(logs).slice(0,25),
      overview: {
        studentsPlayed: students.length,
        totalAttempts: logs.length,
        averageAccuracy: average(students.map((student) => student.averageAccuracy)),
        readyCount: students.filter((student) => ["Ready","Strong","Mastery"].includes(student.status)).length,
        atRisk: students.filter((student) => student.status === "At Risk").length,
        needsReview: students.filter((student) => student.status === "Needs Review").length,
        complete: students.filter((student) => student.passedSessions === FLOW.length).length,
        hardestSession: hardest ? hardest.sessionId : "–"
      }
    };
  }

  function page() {
    document.title = "EAP Word Quest • Teacher Dashboard";
    const style = document.createElement("style");
    style.textContent = `
      :root{--bg:#f6f8ff;--ink:#12203a;--muted:#64748b;--line:#dbe4f0;--brand:#4f46e5;--good:#047857;--warn:#c2410c;--bad:#b91c1c}*{box-sizing:border-box}body{margin:0;padding:24px;background:radial-gradient(circle at 0 0,rgba(79,70,229,.16),transparent 34rem),#f6f8ff;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.shell{width:min(1440px,100%);margin:auto}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.eyebrow{margin:0 0 6px;color:#3730a3;font-size:12px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}h1{margin:0;font-size:clamp(29px,4vw,46px);letter-spacing:-.04em}.subtitle{margin:10px 0 0;max-width:850px;color:var(--muted);font-weight:650;line-height:1.55}.card{background:#fff;border:1px solid var(--line);border-radius:21px;padding:19px;margin-bottom:17px;box-shadow:0 15px 42px rgba(15,23,42,.09)}.card h2,.card h3{margin:0}.card p{color:var(--muted);font-weight:650;line-height:1.5}.notice{border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:17px;padding:13px 15px;font-weight:850;line-height:1.5;margin-bottom:17px}.notice.error{border-color:#fecaca;background:#fef2f2;color:var(--bad)}.toolbar{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:12px}.btn,input,select{min-height:43px;border-radius:13px;font:inherit;font-weight:800}.btn{border:0;background:var(--brand);color:#fff;padding:10px 14px;cursor:pointer}.btn.secondary{background:#fff;border:1px solid var(--line);color:var(--ink)}.btn.good{background:var(--good)}input,select{border:1px solid var(--line);padding:10px 12px;color:var(--ink);background:#fff}.endpoint{display:grid;grid-template-columns:minmax(260px,1fr) auto auto;gap:9px}.pills{display:flex;gap:8px;flex-wrap:wrap}.pill,.tag,.word{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:999px;padding:6px 10px;background:#fff;font-size:12px;font-weight:900}.pill.good,.tag.good{color:var(--good);background:#ecfdf5;border-color:#bbf7d0}.tag.risk{color:var(--bad);background:#fef2f2;border-color:#fecaca}.tag.review,.word{color:var(--warn);background:#fff7ed;border-color:#fed7aa}.tag.info{color:#3730a3;background:#eef2ff;border-color:#c7d2fe}.overview{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:9px}.stat{border:1px solid var(--line);border-radius:16px;padding:14px;background:linear-gradient(#fff,#f8fafc)}.stat b{display:block;font-size:26px;line-height:1.1;margin-bottom:6px}.stat span{color:var(--muted);font-size:12px;font-weight:850}.layout{display:grid;grid-template-columns:minmax(650px,1.2fr) minmax(390px,.8fr);gap:17px}.table{overflow:auto;border:1px solid var(--line);border-radius:16px}.table table{width:100%;border-collapse:collapse;min-width:780px;font-size:13px}.table th,.table td{border-bottom:1px solid #edf2f7;padding:10px 12px;text-align:left;vertical-align:top}.table th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569}.student{cursor:pointer}.student:hover td,.student.selected td{background:#eef2ff}.bar{height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:5px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#4f46e5,#10b981)}.detail{border:1px solid var(--line);border-radius:16px;padding:14px}.metrics,.words{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.muted{color:var(--muted)}details{margin-top:13px}summary{cursor:pointer;font-weight:950;color:#3730a3}.split{display:grid;grid-template-columns:1fr 1fr;gap:17px}.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#10203a;color:#fff;border-radius:999px;padding:12px 16px;font-weight:850}.hide{display:none!important}@media print{body{padding:0;background:#fff}.no-print,.notice,.connection{display:none!important}.card{box-shadow:none}}@media(max-width:1100px){.overview{grid-template-columns:repeat(4,minmax(0,1fr))}.layout,.split{grid-template-columns:1fr}}@media(max-width:700px){body{padding:13px}.top{flex-direction:column}.endpoint{grid-template-columns:1fr}.overview{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{display:grid;grid-template-columns:1fr}.toolbar>*{width:100%}}
    `;
    document.head.appendChild(style);

    document.body.innerHTML = `
      <main class="shell">
        <header class="top"><div><p class="eyebrow">Teacher Dashboard • Group 122</p><h1>EAP Word Quest</h1><p class="subtitle">ติดตามความก้าวหน้าคำศัพท์รายบุคคลจากทุก attempt แยกผลล่าสุด ผลดีที่สุด คำศัพท์ที่ยังอ่อน และหลักฐานการเรียนรู้ตลอด 20 ภารกิจ</p></div><div class="pills"><span class="pill good">Group 122</span><span id="source" class="pill">Preparing Cloud</span></div></header>
        <section id="notice" class="notice">กำลังเชื่อม Google Sheets…</section>
        <section class="card connection no-print"><h2>Google Sheets Connection</h2><p>ระบบจะโหลดข้อมูลรวมอัตโนมัติ และใช้ URL นี้ร่วมกับหน้า Student</p><div class="endpoint"><input id="endpoint" type="url" placeholder="Apps Script Web App /exec URL"><button id="save" class="btn secondary" type="button">บันทึก URL</button><button id="refresh" class="btn good" type="button">Refresh Google Sheets</button></div><p id="server" class="muted"></p></section>
        <section class="card"><h2>Group 122 Overview</h2><div id="overview" class="overview" style="margin-top:13px"></div><div class="toolbar no-print"><button id="local" class="btn secondary" type="button">ดูข้อมูลเครื่องนี้</button><label class="btn secondary">Import CSV<input id="csv" type="file" accept=".csv,text/csv" hidden></label><button id="logsCsv" class="btn secondary" type="button">Export Attempt History CSV</button><button id="studentsCsv" class="btn secondary" type="button">Export Student Summary CSV</button><button id="print" class="btn secondary" type="button">Print / Save PDF</button><input id="search" type="search" placeholder="ค้นหา Name / ID / Weak Words"><select id="filter"><option value="ALL">ทุกสถานะ</option><option>At Risk</option><option>Needs Review</option><option>Ready</option><option>Strong</option><option>Mastery</option></select></div></section>
        <section class="layout"><section class="card"><h2>Student List</h2><p>คลิกชื่อนักศึกษาเพื่อดูหลักฐานรายบุคคล</p><div class="table"><table><thead><tr><th>Name</th><th>ID</th><th>Progress</th><th>Avg</th><th>Attempts</th><th>Status</th><th>Last</th></tr></thead><tbody id="students"></tbody></table></div></section><section class="card"><h2>Individual Evidence</h2><p>ใช้สำหรับติดตาม ให้ feedback และวางแผนสอนซ้ำ</p><div id="detail"></div></section></section>
        <section class="card"><h2>Session Overview</h2><p>ค้นหา session และคำศัพท์ที่ควรทบทวนในชั้นเรียน</p><div class="table"><table><thead><tr><th>Session</th><th>Played Students</th><th>Passed</th><th>Average Best Accuracy</th><th>Attempts</th><th>Top Weak Words</th></tr></thead><tbody id="sessions"></tbody></table></div></section>
        <section class="split"><section class="card"><h2>Top Weak Words</h2><div id="weak" class="words"></div></section><section class="card"><h2>Teacher Action</h2><div id="action" class="detail"></div></section></section>
      </main><div id="toast" class="toast hide"></div>
    `;
  }

  function toast(text) {
    const node = $("toast");
    node.textContent = text;
    node.classList.remove("hide");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.add("hide"), 2700);
  }

  function jsonp(url, params, timeout = 15000) {
    return new Promise((resolve,reject) => {
      const callback = `eapWordTeacher${Date.now()}${Math.floor(Math.random() * 10000)}`;
      const script = document.createElement("script");
      const query = new URLSearchParams(Object.assign({}, params, { callback, _:Date.now() }));
      let settled = false;
      const close = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (err) {}
        script.remove();
        fn(value);
      };
      const timer = setTimeout(() => close(reject, new Error("Apps Script ไม่ตอบกลับภายในเวลาที่กำหนด")), timeout);
      window[callback] = (value) => close(resolve, value);
      script.onerror = () => close(reject, new Error("โหลด Apps Script ไม่สำเร็จ"));
      script.src = `${url}${url.includes("?") ? "&" : "?"}${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  function render() {
    state.report = buildReport(state.logs);
    const report = state.report;
    const overview = report.overview;
    const source = $("source");
    const notice = $("notice");
    const server = $("server");

    source.textContent = state.mode === "cloud" ? "Google Sheets • History" : "Local / CSV";
    source.className = `pill ${state.mode === "cloud" ? "good" : ""}`;

    if (state.error) {
      notice.className = "notice error";
      notice.innerHTML = `<b>ยังอ่าน Google Sheets ไม่สำเร็จ:</b> ${esc(state.error)}<br><span class="muted">ตรวจ URL /exec และการ Deploy ของ Apps Script</span>`;
    } else if (state.mode === "cloud") {
      notice.className = "notice";
      notice.innerHTML = `<b>Google Sheets Mode:</b> โหลด ${report.logs.length} learning attempts จาก Group 122 • ล่าสุด ${esc(formatDate(state.loadedAt))}`;
    } else {
      notice.className = "notice";
      notice.textContent = "Local / CSV Mode: ข้อมูลนี้ไม่ได้แทนข้อมูลรวมของทั้งห้อง";
    }

    const serverBits = [];
    if (state.server && state.server.version) serverBits.push(`Server ${state.server.version}`);
    if (state.server && Number.isFinite(Number(state.server.attemptCount))) serverBits.push(`${state.server.attemptCount} attempts`);
    if (state.server && Number.isFinite(Number(state.server.studentCount))) serverBits.push(`${state.server.studentCount} students`);
    server.textContent = serverBits.length ? serverBits.join(" • ") : "กำลังรอข้อมูลจาก Apps Script";
    $("endpoint").value = endpoint();

    const stats = [
      [overview.studentsPlayed, "Students Played"],
      [overview.totalAttempts, "Attempt History"],
      [`${overview.averageAccuracy}%`, "Average Best Accuracy"],
      [overview.readyCount, "Ready / Strong / Mastery"],
      [overview.atRisk, "At Risk"],
      [overview.needsReview, "Needs Review"],
      [overview.complete, "Complete 20/20"],
      [overview.hardestSession, "Hardest Session"]
    ];
    $("overview").innerHTML = stats.map(([value,label]) => `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join("");

    renderStudents();
    $("sessions").innerHTML = report.sessionOverview.map((row) => `<tr><td><b>${esc(row.sessionId)}</b></td><td>${row.playedStudents}</td><td>${row.passedStudents}</td><td>${row.averageAccuracy}%</td><td>${row.attempts}</td><td>${row.weakWords.length ? row.weakWords.map((word) => `<span class="word">${esc(word.word)} ×${word.count}</span>`).join(" ") : "–"}</td></tr>`).join("");
    $("weak").innerHTML = report.weakWords.length ? report.weakWords.map((word) => `<span class="word">${esc(word.word)} ×${word.count}</span>`).join("") : '<span class="tag good">ยังไม่มี Weak Words รวม</span>';

    const words = report.weakWords.slice(0,6).map((word) => word.word).join(", ");
    const alert = overview.atRisk
      ? `มีนักศึกษา ${overview.atRisk} คนอยู่ในสถานะ At Risk ควรให้ฝึก Weak Words พร้อม AI Help ก่อนขยับระดับ`
      : "ยังไม่พบนักศึกษาที่เข้าเกณฑ์ At Risk จากข้อมูลล่าสุด";
    $("action").innerHTML = `<p><b>ภาพรวม:</b> ${esc(alert)}</p>${overview.hardestSession !== "–" ? `<p><b>Hardest Session:</b> ${esc(overview.hardestSession)} — ทบทวนบริบทและ distractor ของ session นี้ก่อนให้ replay</p>` : ""}${words ? `<p><b>Suggested review words:</b> ${esc(words)}</p>` : ""}<p class="muted">ข้อมูลนี้ใช้เพื่อสนับสนุนการตัดสินใจของครู ไม่ใช้แทนการประเมินการพูดหรือการให้คะแนนโดยครู</p>`;

    window.EAP_WORD_TEACHER_DASHBOARD_STATE = { version:VERSION, mode:state.mode, report, server:state.server, loadedAt:state.loadedAt, error:state.error };
  }

  function filteredStudents() {
    const query = norm($("search").value).toLowerCase();
    const filter = $("filter").value;
    const order = { "At Risk":0, "Needs Review":1, "Ready":2, "Strong":3, "Mastery":4 };
    return state.report.students.filter((student) => {
      if (filter !== "ALL" && student.status !== filter) return false;
      const text = [student.studentName,student.studentId,student.status,...student.weakWords].join(" ").toLowerCase();
      return !query || text.includes(query);
    }).sort((a,b) => order[a.status] - order[b.status] || a.studentId.localeCompare(b.studentId));
  }

  function renderStudents() {
    const rows = filteredStudents();
    if (!state.selected && rows.length) state.selected = rows[0].studentKey;
    if (rows.length && !rows.some((row) => row.studentKey === state.selected)) state.selected = rows[0].studentKey;
    $("students").innerHTML = rows.length ? rows.map((student) => `<tr class="student ${student.studentKey === state.selected ? "selected" : ""}" data-key="${esc(student.studentKey)}"><td><b>${esc(student.studentName)}</b></td><td>${esc(student.studentId)}</td><td>${student.passedSessions}/20<div class="bar"><i style="width:${student.progressPercent}%"></i></div></td><td>${student.averageAccuracy}%<br><small class="muted">Best ${student.bestAccuracy}%</small></td><td>${student.totalAttempts}</td><td><span class="tag ${statusClass(student.status)}">${esc(student.status)}</span></td><td>${esc(student.lastSession)}<br><small class="muted">${esc(formatDate(student.lastPlayed))}</small></td></tr>`).join("") : '<tr><td colspan="7" class="muted">ยังไม่มี learning attempt จาก Group 122</td></tr>';
    renderDetail();
  }

  function renderDetail() {
    const student = state.report.students.find((row) => row.studentKey === state.selected);
    if (!student) {
      $("detail").innerHTML = '<p class="muted">ยังไม่มีข้อมูลรายบุคคล</p>';
      return;
    }

    const action = student.passedSessions === FLOW.length
      ? "ครบเส้นทางคำศัพท์แล้ว พร้อมใช้เป็น Portfolio Evidence"
      : student.pathGap
        ? `ตรวจเส้นทาง ${student.pathGap}: พบการผ่านภารกิจถัดไปก่อนภารกิจก่อนหน้า`
        : `ให้ทำ ${student.nextMission} ต่อ หรือฝึก Weak Words พร้อม AI Help`;

    const arcs = student.arcProgress.map((arc) => `<p><b>${esc(arc.name)}</b> • ${arc.passed}/${arc.total} passed • Avg ${arc.accuracy}%<div class="bar"><i style="width:${Math.round(arc.passed / arc.total * 100)}%"></i></div></p>`).join("");
    const sessionRows = FLOW.map((id) => {
      const attempts = student.records.filter((row) => row.sessionId === id);
      const bestRow = student.bySession[id];
      const latestRow = student.latestBySession[id];
      return `<tr><td><b>${id}</b></td><td>${attempts.length}</td><td>${bestRow ? `${bestRow.accuracy}% ${bestRow.passed ? "✓" : ""}` : "–"}</td><td>${latestRow ? `${latestRow.accuracy}% • ${esc(formatDate(latestRow.playedAt))}` : "–"}</td></tr>`;
    }).join("");
    const historyRows = student.records.map((row) => `<tr><td>${esc(formatDate(row.playedAt))}</td><td><b>${esc(row.sessionId)}</b></td><td>${row.correct}/${row.total}</td><td>${row.accuracy}%</td><td>${row.passed ? "Passed" : "Practice"}</td><td>${esc(row.aiDifficulty || "–")}</td><td>${row.hintUsed}</td><td>${row.weakWords.length ? esc(row.weakWords.join(", ")) : "–"}</td></tr>`).join("");
    const words = student.weakWords.length ? student.weakWords.map((word) => `<span class="word">${esc(word)}</span>`).join("") : '<span class="tag good">No repeated weak words</span>';

    $("detail").innerHTML = `<h3>${esc(student.studentName)} <small class="muted">(${esc(student.studentId)})</small></h3><div class="metrics"><span class="tag ${statusClass(student.status)}">${esc(student.status)}</span><span class="tag info">Progress ${student.passedSessions}/20</span><span class="tag info">Avg ${student.averageAccuracy}%</span><span class="tag info">Attempts ${student.totalAttempts}</span></div><p><b>Last activity:</b> ${esc(student.lastSession)} • ${esc(formatDate(student.lastPlayed))}<br><b>AI Prediction:</b> ${esc(student.lastPrediction)}<br><b>Teacher action:</b> ${esc(action)}</p><h3>Weak Words</h3><div class="words">${words}</div><h3 style="margin-top:14px">Arc Progress</h3>${arcs}<details><summary>Session evidence: best vs latest</summary><div class="table"><table><thead><tr><th>Session</th><th>Attempts</th><th>Best</th><th>Latest</th></tr></thead><tbody>${sessionRows}</tbody></table></div></details><details><summary>Attempt history ทั้งหมด (${student.records.length} records)</summary><div class="table"><table><thead><tr><th>Played</th><th>Session</th><th>Correct</th><th>Accuracy</th><th>Outcome</th><th>AI Level</th><th>Help</th><th>Weak Words</th></tr></thead><tbody>${historyRows}</tbody></table></div></details>`;
  }

  function setBusy(on) {
    const button = $("refresh");
    button.disabled = on;
    button.textContent = on ? "กำลังโหลด…" : "Refresh Google Sheets";
  }

  async function loadCloud(showToast) {
    const url = endpoint();
    if (!validEndpoint(url)) {
      state.mode = "local";
      state.error = "ยังไม่มี Google Apps Script Web App URL ที่ถูกต้อง";
      render();
      if (showToast) toast("ยังไม่มี /exec URL");
      return;
    }

    setBusy(true);
    try {
      const data = await jsonp(url, { action:"eap_word_teacher", section:GROUP });
      if (!data || !data.ok) throw new Error((data && data.error) || "Apps Script ส่งข้อมูลไม่สมบูรณ์");
      state.logs = uniqueLogs(data.logs || []);
      state.server = data.server || null;
      state.mode = "cloud";
      state.error = "";
      state.loadedAt = data.generatedAt || new Date().toISOString();
      render();
      if (showToast) toast(`โหลด ${state.logs.length} attempts จาก Google Sheets แล้ว`);
    } catch (err) {
      state.error = String(err && err.message || err);
      render();
      if (showToast) toast("ยังอ่าน Google Sheets ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function localView() {
    const rows = typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : [];
    state.logs = uniqueLogs(rows);
    state.server = null;
    state.mode = "local";
    state.error = "";
    state.loadedAt = new Date().toISOString();
    render();
    toast(`แสดงข้อมูลในเครื่อง ${state.logs.length} attempts`);
  }

  function saveEndpoint() {
    const url = norm($("endpoint").value);
    if (!validEndpoint(url)) {
      toast("กรุณาวาง Google Apps Script URL ที่ลงท้ายด้วย /exec");
      return;
    }
    try {
      localStorage.setItem("EAP_WORD_TEACHER_ENDPOINT", url);
      localStorage.setItem("EAP_WORD_SHEET_ENDPOINT", url);
    } catch (err) {}
    window.EAP_WORD_SHEET_CONFIG = Object.assign({}, window.EAP_WORD_SHEET_CONFIG || {}, { endpoint:url, group:GROUP });
    state.error = "";
    loadCloud(true);
  }

  function parseCsv(text) {
    const rows = [], row = [];
    let cell = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i], next = text[i + 1];
      if (c === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (c === ',' && !quoted) { row.push(cell); cell = ""; continue; }
      if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => norm(value))) rows.push(row.slice());
        row.length = 0; cell = ""; continue;
      }
      cell += c;
    }
    row.push(cell);
    if (row.some((value) => norm(value))) rows.push(row);
    return rows;
  }

  function importCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) { toast("CSV ไม่มีข้อมูล"); return; }
    const headers = rows[0].map(norm);
    const records = rows.slice(1).map((values) => {
      const record = {};
      headers.forEach((header,index) => { record[header] = values[index] || ""; });
      return record;
    });
    state.logs = uniqueLogs(records);
    state.server = null;
    state.mode = "csv";
    state.error = "";
    state.loadedAt = new Date().toISOString();
    render();
    toast(`Import ${state.logs.length} attempts แล้ว`);
  }

  function exportCsv(name, rows) {
    if (!rows.length) { toast("ไม่มีข้อมูลสำหรับ export"); return; }
    const fields = Object.keys(rows[0]);
    const quote = (value) => `"${String(Array.isArray(value) ? value.join("|") : value == null ? "" : value).replace(/"/g, '""')}"`;
    const csv = [fields.join(","), ...rows.map((row) => fields.map((field) => quote(row[field])).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 400);
  }

  function bind() {
    $("save").onclick = saveEndpoint;
    $("refresh").onclick = () => loadCloud(true);
    $("local").onclick = localView;
    $("print").onclick = () => window.print();
    $("search").oninput = renderStudents;
    $("filter").onchange = renderStudents;
    $("students").onclick = (event) => {
      const row = event.target.closest(".student");
      if (!row) return;
      state.selected = row.dataset.key;
      renderStudents();
    };
    $("csv").onchange = async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) importCsv(await file.text());
      event.target.value = "";
    };
    $("logsCsv").onclick = () => exportCsv("eap-word-quest-group122-attempt-history.csv", state.report.logs.map((row) => ({ playedAt:row.playedAt, studentName:row.studentName, studentId:row.studentId, sessionId:row.sessionId, correct:row.correct, total:row.total, accuracy:row.accuracy, passed:row.passed, xp:row.xp, aiDifficulty:row.aiDifficulty, aiPrediction:row.aiPrediction, hintUsed:row.hintUsed, weakWords:row.weakWords, source:row.source, fingerprint:row.fingerprint })));
    $("studentsCsv").onclick = () => exportCsv("eap-word-quest-group122-student-summary.csv", state.report.students.map((row) => ({ studentName:row.studentName, studentId:row.studentId, passedSessions:row.passedSessions, playedSessions:row.playedSessions, progressPercent:row.progressPercent, averageAccuracy:row.averageAccuracy, bestAccuracy:row.bestAccuracy, totalAttempts:row.totalAttempts, totalXp:row.totalXp, status:row.status, lastSession:row.lastSession, lastPlayed:row.lastPlayed, aiPrediction:row.lastPrediction, weakWords:row.weakWords })));
  }

  function start() {
    if (!document.body) { setTimeout(start, 20); return; }
    page();
    bind();
    render();
    setTimeout(() => loadCloud(false), 160);
  }

  start();
})();
