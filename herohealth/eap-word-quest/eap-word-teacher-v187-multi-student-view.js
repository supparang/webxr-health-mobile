/* =========================================================
   EAP Word Quest • Teacher Multi-Student View
   File: /herohealth/eap-word-quest/eap-word-teacher-v187-multi-student-view.js
   Version: v1.8.7-MULTI-STUDENT-TEACHER-VIEW

   Role:
   - Merge students by Student ID as primary key
   - Support multiple CSV imports
   - Add Multi-Student Monitor
   - Show Not Complete / At Risk / Mastery groups
   - Keep local + CSV workflow only
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.7-MULTI-STUDENT-TEACHER-VIEW";
  const GROUP = "122";

  if(window.__EAP_TEACHER_V187_MULTI_STUDENT__){
    console.info("[EAP Word Quest] v187 multi-student already loaded");
    return;
  }

  window.__EAP_TEACHER_V187_MULTI_STUDENT__ = true;

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function cssEscape(v){
    if(window.CSS && typeof window.CSS.escape === "function"){
      return window.CSS.escape(v);
    }
    return String(v).replace(/["\\]/g,"\\$&");
  }

  function fmtDate(v){
    if(!v) return "-";
    try{
      const d = new Date(v);
      if(Number.isNaN(d.getTime())) return v;
      return d.toLocaleString("th-TH",{
        dateStyle:"short",
        timeStyle:"short"
      });
    }catch(err){
      return v;
    }
  }

  function statusClass(status){
    const s = norm(status).toLowerCase();

    if(s.includes("risk")) return "risk";
    if(s.includes("review")) return "review";
    if(s.includes("mastery")) return "mastery";
    if(s.includes("strong")) return "strong";
    if(s.includes("ready")) return "ready";

    return "";
  }

  function studentIdKey(r){
    const id = norm(r.studentId || r.id || "anon");
    return `${GROUP}|${id}`;
  }

  function latestRecord(records){
    return records.slice().sort((a,b) => {
      return new Date(b.playedAt || b.at || b.updatedAt || 0) -
             new Date(a.playedAt || a.at || a.updatedAt || 0);
    })[0] || null;
  }

  function canonicalName(records){
    const latest = latestRecord(records);
    const latestName = latest ? norm(latest.studentName || latest.name) : "";

    if(latestName && latestName.toLowerCase() !== "anonymous"){
      return latestName;
    }

    const found = records.find(r => {
      const name = norm(r.studentName || r.name);
      return name && name.toLowerCase() !== "anonymous";
    });

    return found ? norm(found.studentName || found.name) : "Anonymous";
  }

  function normalizeLogsByStudentId(logs){
    const raw = Array.isArray(logs) ? logs.slice() : [];
    const byId = {};

    raw.forEach(r => {
      const key = studentIdKey(r);
      if(!byId[key]) byId[key] = [];
      byId[key].push(r);
    });

    const out = [];

    Object.entries(byId).forEach(([key,records]) => {
      const id = key.split("|")[1] || "anon";
      const name = canonicalName(records);
      const studentKey = `${GROUP}|${id}|${name}`;

      records.forEach(r => {
        const copy = Object.assign({},r);

        copy.group = GROUP;
        copy.section = GROUP;
        copy.studentId = id;
        copy.studentName = name;
        copy.studentKey = studentKey;

        out.push(copy);
      });
    });

    return out;
  }

  function wrapReportCore(){
    if(typeof window.buildEapTeacherReport !== "function") return;
    if(window.buildEapTeacherReport.__eap187Wrapped) return;

    const original = window.buildEapTeacherReport;

    const wrapped = function(inputLogs){
      const sourceLogs = Array.isArray(inputLogs)
        ? inputLogs
        : (typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : []);

      const normalizedLogs = normalizeLogsByStudentId(sourceLogs);
      const report = original.call(this,normalizedLogs);

      augmentReport(report);

      return report;
    };

    wrapped.__eap187Wrapped = true;
    wrapped.__eap187Original = original;

    window.buildEapTeacherReport = wrapped;
  }

  function passedSet(student){
    const set = new Set();

    (student.records || []).forEach(r => {
      if(r && r.sessionId && r.passed){
        set.add(r.sessionId);
      }
    });

    return set;
  }

  function missingSessions(student){
    const passed = passedSet(student);
    return COURSE_FLOW.filter(id => !passed.has(id));
  }

  function nextMissing(student){
    const missing = missingSessions(student);
    return missing[0] || "DONE";
  }

  function detectPathGap(student){
    const passed = passedSet(student);

    for(let i = 0; i < COURSE_FLOW.length; i++){
      const id = COURSE_FLOW[i];

      if(passed.has(id)) continue;

      const laterPassed = COURSE_FLOW.slice(i + 1).some(nextId => passed.has(nextId));

      if(laterPassed){
        return id;
      }
    }

    return "";
  }

  function studentAction(student){
    const missing = missingSessions(student);
    const gap = detectPathGap(student);

    if(gap){
      return `ตรวจ log / recover ${gap}`;
    }

    if(student.status === "At Risk"){
      return "ให้ฝึก Weak Words + AI Help";
    }

    if(missing.length){
      return `ให้ทำ ${missing[0]}`;
    }

    return "ครบแล้ว / พร้อม Main Mission";
  }

  function augmentReport(report){
    if(!report || !Array.isArray(report.students)) return report;

    report.students.forEach(s => {
      s.missingSessions = missingSessions(s);
      s.nextMission = nextMissing(s);
      s.pathGap = detectPathGap(s);
      s.teacherAction = studentAction(s);
      s.isComplete = Number(s.passedSessions || 0) >= COURSE_FLOW.length;
    });

    report.multiStudent = {
      version:VERSION,
      totalStudents:report.students.length,
      complete:report.students.filter(s => s.isComplete).length,
      notComplete:report.students.filter(s => !s.isComplete).length,
      atRisk:report.students.filter(s => s.status === "At Risk").length,
      needsReview:report.students.filter(s => s.status === "Needs Review").length,
      mastery:report.students.filter(s => s.status === "Mastery").length,
      pathGap:report.students.filter(s => s.pathGap).length
    };

    if(report.overview){
      report.overview.studentsPlayed = report.students.length;
      report.overview.completeStudents = report.multiStudent.complete;
      report.overview.notCompleteStudents = report.multiStudent.notComplete;
      report.overview.pathGapStudents = report.multiStudent.pathGap;
    }

    return report;
  }

  function injectStyle(){
    if($("eapTeacherV187Style")) return;

    const style = document.createElement("style");
    style.id = "eapTeacherV187Style";
    style.textContent = `
      .eap187-panel{
        background:rgba(255,255,255,.94);
        border:1px solid #dbe4f0;
        border-radius:24px;
        box-shadow:0 20px 60px rgba(15,23,42,.10);
        padding:20px;
        margin-bottom:18px;
      }

      .eap187-head{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:flex-start;
        margin-bottom:14px;
      }

      .eap187-head h2{
        margin:0;
      }

      .eap187-head p{
        margin:6px 0 0;
        color:#64748b;
        font-weight:700;
      }

      .eap187-summary{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:10px;
        margin-bottom:12px;
      }

      .eap187-stat{
        border:1px solid #e2e8f0;
        background:linear-gradient(180deg,#fff,#f8fafc);
        border-radius:16px;
        padding:14px;
      }

      .eap187-stat b{
        display:block;
        font-size:24px;
        margin-bottom:4px;
      }

      .eap187-stat span{
        color:#64748b;
        font-size:12px;
        font-weight:900;
      }

      .eap187-filter-row{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin:10px 0 14px;
      }

      .eap187-filter-btn{
        border:1px solid #dbe4f0;
        background:#fff;
        color:#334155;
        border-radius:999px;
        padding:8px 12px;
        font-weight:900;
        cursor:pointer;
      }

      .eap187-filter-btn.active{
        background:#5b5cf6;
        color:#fff;
        border-color:#5b5cf6;
      }

      .eap187-table-wrap{
        overflow:auto;
        border:1px solid #e2e8f0;
        border-radius:18px;
        background:#fff;
      }

      .eap187-table{
        width:100%;
        min-width:900px;
        border-collapse:separate;
        border-spacing:0;
      }

      .eap187-table th,
      .eap187-table td{
        padding:11px 12px;
        border-bottom:1px solid #edf2f7;
        text-align:left;
        vertical-align:top;
      }

      .eap187-table th{
        background:#f8fafc;
        color:#475569;
        font-size:12px;
        letter-spacing:.04em;
        text-transform:uppercase;
        font-weight:950;
      }

      .eap187-row{
        cursor:pointer;
      }

      .eap187-row:hover td{
        background:#fafcff;
      }

      .eap187-missing{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
      }

      .eap187-mini{
        display:inline-flex;
        border:1px solid #e2e8f0;
        border-radius:999px;
        padding:3px 7px;
        font-size:11px;
        font-weight:900;
        color:#475569;
        background:#fff;
      }

      .eap187-mini.warn{
        border-color:#fed7aa;
        background:#fff7ed;
        color:#c2410c;
      }

      .eap187-mini.good{
        border-color:#bbf7d0;
        background:#ecfdf5;
        color:#047857;
      }

      .eap187-mobile-list{
        display:none;
      }

      .eap187-card{
        border:1px solid #e2e8f0;
        background:#fff;
        border-radius:18px;
        padding:14px;
        margin-bottom:10px;
      }

      .eap187-card h3{
        margin:0 0 6px;
      }

      .eap187-card p{
        margin:6px 0;
      }

      .eap187-card-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin:10px 0;
      }

      .eap187-card-stat{
        border:1px solid #e2e8f0;
        border-radius:14px;
        background:#f8fafc;
        padding:10px;
      }

      .eap187-card-stat b{
        display:block;
        font-size:18px;
      }

      .eap187-card-stat span{
        color:#64748b;
        font-size:11px;
        font-weight:900;
      }

      @media(max-width:760px){
        .eap187-panel{
          padding:14px;
          border-radius:18px;
        }

        .eap187-head{
          display:block;
        }

        .eap187-summary{
          grid-template-columns:1fr 1fr;
        }

        .eap187-table-wrap{
          display:none;
        }

        .eap187-mobile-list{
          display:block;
        }
      }

      @media(max-width:420px){
        .eap187-summary,
        .eap187-card-grid{
          grid-template-columns:1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureMultiPanel(){
    if($("eap187MultiPanel")) return;

    const studentSection = $("studentBody")
      ? $("studentBody").closest(".grid-2")
      : null;

    const panel = document.createElement("section");
    panel.id = "eap187MultiPanel";
    panel.className = "eap187-panel";
    panel.innerHTML = `
      <div class="eap187-head">
        <div>
          <h2>Multi-Student Monitor</h2>
          <p>ดูหลายคนพร้อมกัน แยกกลุ่ม Complete / Not Complete / At Risk / Mastery โดยใช้ Student ID เป็นตัวหลัก</p>
        </div>
        <button class="btn secondary" id="eap187ImportMultiBtn" type="button">Import Multiple CSV</button>
        <input id="eap187ImportMultiInput" type="file" accept=".csv,text/csv" multiple hidden>
      </div>

      <div id="eap187Summary" class="eap187-summary"></div>

      <div class="eap187-filter-row">
        <button class="eap187-filter-btn active" data-filter="ALL" type="button">All</button>
        <button class="eap187-filter-btn" data-filter="NOT_COMPLETE" type="button">Not Complete</button>
        <button class="eap187-filter-btn" data-filter="AT_RISK" type="button">At Risk</button>
        <button class="eap187-filter-btn" data-filter="MASTERY" type="button">Mastery</button>
        <button class="eap187-filter-btn" data-filter="PATH_GAP" type="button">Path Gap</button>
      </div>

      <div class="eap187-table-wrap">
        <table class="eap187-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Progress</th>
              <th>Avg</th>
              <th>Status</th>
              <th>Missing</th>
              <th>Teacher Action</th>
              <th>Last</th>
            </tr>
          </thead>
          <tbody id="eap187Body"></tbody>
        </table>
      </div>

      <div id="eap187MobileList" class="eap187-mobile-list"></div>
    `;

    if(studentSection){
      studentSection.insertAdjacentElement("beforebegin",panel);
    }else{
      document.querySelector(".shell").appendChild(panel);
    }

    $("eap187ImportMultiBtn").addEventListener("click",() => {
      $("eap187ImportMultiInput").click();
    });

    $("eap187ImportMultiInput").addEventListener("change",async e => {
      const files = Array.from(e.target.files || []);

      if(!files.length) return;

      let imported = 0;

      for(const file of files){
        const text = await file.text();

        if(typeof window.importEapTeacherCsvText === "function"){
          window.importEapTeacherCsvText(text);
          imported++;
        }
      }

      e.target.value = "";

      setTimeout(() => {
        if(typeof window.renderEapTeacherPage === "function"){
          window.renderEapTeacherPage();
        }
        renderMultiPanel();
        alert(`Imported ${imported} CSV file(s)`);
      },400);
    });

    panel.querySelectorAll(".eap187-filter-btn").forEach(btn => {
      btn.addEventListener("click",() => {
        panel.querySelectorAll(".eap187-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderMultiPanel();
      });
    });
  }

  function activeFilter(){
    const active = document.querySelector(".eap187-filter-btn.active");
    return active ? active.dataset.filter : "ALL";
  }

  function filterStudents(students){
    const filter = activeFilter();

    if(filter === "NOT_COMPLETE"){
      return students.filter(s => !s.isComplete);
    }

    if(filter === "AT_RISK"){
      return students.filter(s => s.status === "At Risk");
    }

    if(filter === "MASTERY"){
      return students.filter(s => s.status === "Mastery");
    }

    if(filter === "PATH_GAP"){
      return students.filter(s => s.pathGap);
    }

    return students;
  }

  function renderMissing(student){
    const missing = student.missingSessions || [];

    if(!missing.length){
      return `<span class="eap187-mini good">Complete</span>`;
    }

    return `
      <div class="eap187-missing">
        ${missing.slice(0,8).map(id => `<span class="eap187-mini warn">${escapeHtml(id)}</span>`).join("")}
        ${missing.length > 8 ? `<span class="eap187-mini warn">+${missing.length - 8}</span>` : ""}
      </div>
    `;
  }

  function renderMultiPanel(){
    ensureMultiPanel();

    const report = typeof window.buildEapTeacherReport === "function"
      ? window.buildEapTeacherReport()
      : window.EAP_TEACHER_PAGE_REPORT;

    if(!report){
      return;
    }

    augmentReport(report);
    window.EAP_TEACHER_PAGE_REPORT = report;

    const m = report.multiStudent || {};
    const students = filterStudents(report.students || []);

    $("eap187Summary").innerHTML = `
      <div class="eap187-stat"><b>${escapeHtml(m.totalStudents || 0)}</b><span>Students</span></div>
      <div class="eap187-stat"><b>${escapeHtml(m.complete || 0)}</b><span>Complete 20/20</span></div>
      <div class="eap187-stat"><b>${escapeHtml(m.notComplete || 0)}</b><span>Not Complete</span></div>
      <div class="eap187-stat"><b>${escapeHtml(m.atRisk || 0)}</b><span>At Risk</span></div>
      <div class="eap187-stat"><b>${escapeHtml(m.pathGap || 0)}</b><span>Path Gap</span></div>
    `;

    $("eap187Body").innerHTML = students.length
      ? students.map(s => `
        <tr class="eap187-row" data-key="${escapeHtml(s.studentKey)}">
          <td><b>${escapeHtml(s.studentName || "-")}</b></td>
          <td>${escapeHtml(s.studentId || "-")}</td>
          <td>${escapeHtml(s.progressText || "0/20")} • ${escapeHtml(s.progressPercent || 0)}%</td>
          <td>${escapeHtml(s.averageAccuracy || 0)}%</td>
          <td><span class="tag ${statusClass(s.status)}">${escapeHtml(s.status || "-")}</span></td>
          <td>${renderMissing(s)}</td>
          <td>${escapeHtml(s.teacherAction || "-")}</td>
          <td>${escapeHtml(s.lastSession || "-")}<br><small>${escapeHtml(fmtDate(s.lastPlayed))}</small></td>
        </tr>
      `).join("")
      : `<tr><td colspan="8">ไม่มีนักศึกษาในกลุ่มนี้</td></tr>`;

    $("eap187MobileList").innerHTML = students.length
      ? students.map(s => `
        <div class="eap187-card" data-key="${escapeHtml(s.studentKey)}">
          <h3>${escapeHtml(s.studentName || "-")} <small>(${escapeHtml(s.studentId || "-")})</small></h3>
          <p><span class="tag ${statusClass(s.status)}">${escapeHtml(s.status || "-")}</span></p>
          <div class="eap187-card-grid">
            <div class="eap187-card-stat"><b>${escapeHtml(s.progressText || "0/20")}</b><span>Progress</span></div>
            <div class="eap187-card-stat"><b>${escapeHtml(s.averageAccuracy || 0)}%</b><span>Average</span></div>
            <div class="eap187-card-stat"><b>${escapeHtml(s.bestAccuracy || 0)}%</b><span>Best</span></div>
            <div class="eap187-card-stat"><b>${escapeHtml(s.totalXp || 0)}</b><span>XP</span></div>
          </div>
          <p><b>Missing:</b> ${renderMissing(s)}</p>
          <p><b>Action:</b> ${escapeHtml(s.teacherAction || "-")}</p>
        </div>
      `).join("")
      : `<div class="eap187-card">ไม่มีนักศึกษาในกลุ่มนี้</div>`;

    document.querySelectorAll(".eap187-row,.eap187-card").forEach(row => {
      row.addEventListener("click",() => {
        const key = row.dataset.key;
        const oldRow = document.querySelector('.student-row[data-key="' + cssEscape(key) + '"]');

        if(oldRow){
          oldRow.click();
          const detail = $("studentDetail");
          if(detail){
            detail.scrollIntoView({behavior:"smooth",block:"start"});
          }
        }
      });
    });

    console.info("[EAP Word Quest] v187 multi-student rendered:",{
      version:VERSION,
      students:students.length,
      filter:activeFilter()
    });
  }

  function patchOverviewCards(){
    const report = window.EAP_TEACHER_PAGE_REPORT;
    if(!report || !report.multiStudent) return;

    const grid = $("overviewGrid");
    if(!grid || $("eap187ExtraOverview")) return;

    const extra = document.createElement("div");
    extra.id = "eap187ExtraOverview";
    extra.className = "stat good";
    extra.innerHTML = `
      <b>${escapeHtml(report.multiStudent.complete || 0)}/${escapeHtml(report.multiStudent.totalStudents || 0)}</b>
      <span>Completed Students</span>
    `;

    grid.appendChild(extra);
  }

  function patchAll(){
    wrapReportCore();
    injectStyle();
    ensureMultiPanel();

    if(typeof window.renderEapTeacherPage === "function"){
      /*
        ปล่อยให้ render หลักสร้าง report ก่อน
      */
    }

    renderMultiPanel();
    patchOverviewCards();

    window.EAP_TEACHER_V187_STATE = {
      version:VERSION,
      patchedAt:new Date().toISOString()
    };
  }

  const oldRender = window.renderEapTeacherPage;
  if(typeof oldRender === "function" && !oldRender.__eap187Wrapped){
    const wrapped = function(){
      wrapReportCore();
      const result = oldRender.apply(this,arguments);
      setTimeout(renderMultiPanel,80);
      setTimeout(renderMultiPanel,300);
      setTimeout(patchOverviewCards,350);
      return result;
    };

    wrapped.__eap187Wrapped = true;
    window.renderEapTeacherPage = wrapped;
  }

  [0,150,400,900,1500].forEach(ms => setTimeout(patchAll,ms));

  window.patchEapTeacherV187 = patchAll;
  window.renderEapMultiStudentMonitor = renderMultiPanel;
  window.normalizeEapLogsByStudentId = normalizeLogsByStudentId;

  console.info("[EAP Word Quest] v187 multi-student teacher view ready:",{
    version:VERSION,
    helpers:[
      "patchEapTeacherV187()",
      "renderEapMultiStudentMonitor()",
      "normalizeEapLogsByStudentId(logs)"
    ]
  });
})();
