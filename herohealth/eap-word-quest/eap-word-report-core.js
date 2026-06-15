/* =========================================================
   EAP Word Quest • Report Core
   File: /herohealth/eap-word-quest/eap-word-report-core.js
   Version: v1.8.2-TEACHER-REPORT-CORE

   Role:
   - Build Student + Teacher reports from learning logs
   - Group 122
   - LocalStorage/CSV first
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.2-TEACHER-REPORT-CORE";

  if(window.__EAP_WORD_QUEST_REPORT_CORE__){
    console.info("[EAP Word Quest] report core already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_REPORT_CORE__ = true;

  const GROUP = "122";

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  const ARCS = {
    ARC1:{ title:"Arc 1 • Project Foundation", sessions:["S1","S2","S3","BG1"] },
    ARC2:{ title:"Arc 2 • Academic Teamwork & Careers", sessions:["S4","S5","S6","BG2"] },
    ARC3:{ title:"Arc 3 • Academic Communication", sessions:["S7","S8","S9","BG3"] },
    ARC4:{ title:"Arc 4 • Technical Academic Writing", sessions:["S10","S11","S12","BG4"] },
    ARC5:{ title:"Arc 5 • Academic Output & Presentation", sessions:["S13","S14","S15","BG5"] }
  };

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function number(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function avg(values){
    const arr = values.map(Number).filter(Number.isFinite);
    if(!arr.length) return 0;
    return Math.round(arr.reduce((a,b)=>a+b,0) / arr.length);
  }

  function latestOf(records){
    return records.slice().sort((a,b) => new Date(b.playedAt) - new Date(a.playedAt))[0] || null;
  }

  function bestOf(records){
    return records.slice().sort((a,b) => {
      if(number(b.accuracy) !== number(a.accuracy)){
        return number(b.accuracy) - number(a.accuracy);
      }
      return new Date(b.playedAt) - new Date(a.playedAt);
    })[0] || null;
  }

  function statusFromAccuracy(acc){
    if(acc >= 90) return "Vocabulary Mastery";
    if(acc >= 75) return "Vocabulary Strong";
    if(acc >= 60) return "Vocabulary Ready";
    return "Keep Practicing";
  }

  function riskFromStudent(summary){
    if(!summary.playedSessions) return "Not Started";
    if(summary.averageAccuracy < 60) return "At Risk";
    if(summary.weakWords.length >= 5) return "Needs Review";
    if(summary.averageAccuracy >= 90) return "Mastery";
    if(summary.averageAccuracy >= 75) return "Strong";
    return "Ready";
  }

  function groupBy(arr, keyFn){
    return arr.reduce((acc,item) => {
      const key = keyFn(item);
      if(!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },{});
  }

  function countWords(records, field){
    const counts = {};

    records.forEach(r => {
      const arr = Array.isArray(r[field]) ? r[field] : [];
      arr.forEach(w => {
        const key = norm(w).toLowerCase();
        if(!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([word,count]) => ({ word, count }))
      .sort((a,b) => b.count - a.count);
  }

  function unique(arr){
    return Array.from(new Set(arr.map(norm).filter(Boolean)));
  }

  function studentSessionBestMap(records){
    const map = {};

    records.forEach(r => {
      const key = `${r.studentKey || r.studentId}|${r.sessionId}`;
      if(!map[key] || number(r.accuracy) > number(map[key].accuracy)){
        map[key] = r;
      }
    });

    return map;
  }

  function buildStudentSummaries(logs){
    const byStudent = groupBy(logs, r => r.studentKey || `${r.group}|${r.studentId}|${r.studentName}`);

    return Object.entries(byStudent).map(([studentKey,records]) => {
      const latest = latestOf(records);
      const bestMap = studentSessionBestMap(records);

      const bestSessions = COURSE_FLOW
        .map(sessionId => bestMap[`${studentKey}|${sessionId}`])
        .filter(Boolean);

      const passedSessions = bestSessions.filter(r => r.passed).length;
      const playedSessions = bestSessions.length;
      const averageAccuracy = avg(bestSessions.map(r => r.accuracy));
      const totalXp = records.reduce((sum,r) => sum + number(r.xp),0);
      const weakWords = countWords(records,"weakWords").slice(0,10).map(x => x.word);

      const summary = {
        studentKey,
        group:GROUP,
        studentName:latest ? latest.studentName : "",
        studentId:latest ? latest.studentId : "",
        records,
        latest,
        playedSessions,
        passedSessions,
        progressText:`${passedSessions}/20`,
        progressPercent:Math.round((passedSessions / 20) * 100),
        averageAccuracy,
        bestAccuracy:bestSessions.length ? Math.max(...bestSessions.map(r => number(r.accuracy))) : 0,
        totalXp,
        weakWords,
        lastPlayed:latest ? latest.playedAt : "",
        lastSession:latest ? latest.sessionId : "",
        lastPrediction:latest ? latest.aiPrediction : "Not Started",
        status:""
      };

      summary.status = riskFromStudent(summary);

      return summary;
    }).sort((a,b) => {
      if(a.status === "At Risk" && b.status !== "At Risk") return -1;
      if(a.status !== "At Risk" && b.status === "At Risk") return 1;
      return norm(a.studentId).localeCompare(norm(b.studentId));
    });
  }

  function buildArcProgress(studentSummary){
    const bestBySession = {};

    studentSummary.records.forEach(r => {
      const old = bestBySession[r.sessionId];
      if(!old || number(r.accuracy) > number(old.accuracy)){
        bestBySession[r.sessionId] = r;
      }
    });

    const arcProgress = {};

    Object.entries(ARCS).forEach(([arcId,arc]) => {
      const records = arc.sessions.map(id => bestBySession[id]).filter(Boolean);
      const passed = records.filter(r => r.passed).length;
      const played = records.length;
      const acc = avg(records.map(r => r.accuracy));

      let status = "Not Started";
      if(played > 0) status = "In Progress";
      if(passed === arc.sessions.length) status = acc >= 90 ? "Mastery" : acc >= 75 ? "Strong" : "Ready";
      if(played > 0 && acc < 60) status = "At Risk";

      arcProgress[arcId] = {
        arcId,
        title:arc.title,
        played,
        passed,
        total:arc.sessions.length,
        averageAccuracy:acc,
        status,
        sessions:arc.sessions.map(id => {
          const r = bestBySession[id];
          return {
            sessionId:id,
            played:Boolean(r),
            passed:Boolean(r && r.passed),
            accuracy:r ? r.accuracy : 0,
            status:r ? statusFromAccuracy(r.accuracy) : "Not Started"
          };
        })
      };
    });

    return arcProgress;
  }

  function buildSessionOverview(logs){
    const bySession = groupBy(logs, r => r.sessionId);

    return COURSE_FLOW.map(sessionId => {
      const records = bySession[sessionId] || [];
      const byStudent = groupBy(records, r => r.studentKey || `${r.studentId}|${r.studentName}`);
      const bestRecords = Object.values(byStudent).map(bestOf).filter(Boolean);

      return {
        sessionId,
        playedStudents:bestRecords.length,
        passedStudents:bestRecords.filter(r => r.passed).length,
        averageAccuracy:avg(bestRecords.map(r => r.accuracy)),
        attempts:records.length,
        weakWords:countWords(records,"weakWords").slice(0,8)
      };
    });
  }

  function buildTeacherReport(inputLogs){
    const logs = Array.isArray(inputLogs)
      ? inputLogs
      : (typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : []);

    const clean = logs.filter(r => String(r.group || r.section || GROUP) === GROUP);
    const students = buildStudentSummaries(clean);

    students.forEach(s => {
      s.arcProgress = buildArcProgress(s);
    });

    const sessionOverview = buildSessionOverview(clean);
    const weakWords = countWords(clean,"weakWords").slice(0,20);
    const itemTypeWeak = countWords(clean,"itemTypeWeak").slice(0,10);
    const levelWeak = countWords(clean,"levelWeak").slice(0,10);

    const hardestSession = sessionOverview
      .filter(s => s.playedStudents > 0)
      .sort((a,b) => a.averageAccuracy - b.averageAccuracy)[0] || null;

    const overview = {
      version:VERSION,
      group:GROUP,
      totalLogs:clean.length,
      studentsPlayed:students.length,
      averageAccuracy:avg(students.map(s => s.averageAccuracy)),
      vocabularyReady:students.filter(s => ["Ready","Strong","Mastery"].includes(s.status)).length,
      atRisk:students.filter(s => s.status === "At Risk").length,
      needsReview:students.filter(s => s.status === "Needs Review").length,
      totalAttempts:clean.length,
      hardestSession:hardestSession ? hardestSession.sessionId : "",
      topWeakWords:weakWords.slice(0,8)
    };

    return {
      version:VERSION,
      group:GROUP,
      generatedAt:new Date().toISOString(),
      overview,
      students,
      sessionOverview,
      weakWords,
      itemTypeWeak,
      levelWeak,
      logs:clean
    };
  }

  function csvEscape(v){
    const s = String(v == null ? "" : v);
    return `"${s.replace(/"/g,'""')}"`;
  }

  function studentReportCsv(report){
    const fields = [
      "group",
      "studentName",
      "studentId",
      "playedSessions",
      "passedSessions",
      "progressText",
      "progressPercent",
      "averageAccuracy",
      "bestAccuracy",
      "totalXp",
      "status",
      "lastSession",
      "lastPrediction",
      "weakWords",
      "lastPlayed"
    ];

    const rows = report.students.map(s => fields.map(f => {
      const value = f === "weakWords" ? s.weakWords.join("|") : s[f];
      return csvEscape(value);
    }).join(","));

    return [fields.join(","), ...rows].join("\n");
  }

  function downloadCsv(filename,csv){
    const blob = new Blob(["\uFEFF" + csv],{
      type:"text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    },300);
  }

  function downloadTeacherStudentCsv(){
    const report = buildTeacherReport();
    const csv = studentReportCsv(report);
    const date = new Date().toISOString().slice(0,10);

    downloadCsv(`eap-word-quest-group122-student-report-${date}.csv`,csv);

    return {
      count:report.students.length,
      filename:`eap-word-quest-group122-student-report-${date}.csv`
    };
  }

  function buildStudentOwnReport(studentId){
    const report = buildTeacherReport();
    const id = norm(studentId);

    if(!id){
      const logs = typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : [];
      const latest = latestOf(logs);
      if(!latest) return null;
      studentId = latest.studentId;
    }

    return report.students.find(s => norm(s.studentId) === norm(studentId)) || null;
  }

  window.EAP_WORD_REPORT_VERSION = VERSION;
  window.EAP_ARCS = ARCS;
  window.EAP_COURSE_FLOW = COURSE_FLOW;

  window.buildEapTeacherReport = buildTeacherReport;
  window.buildEapStudentOwnReport = buildStudentOwnReport;
  window.downloadEapTeacherStudentCsv = downloadTeacherStudentCsv;
  window.eapStudentReportCsv = studentReportCsv;

  console.info("[EAP Word Quest] report core ready:",{
    version:VERSION,
    group:GROUP,
    helpers:[
      "buildEapTeacherReport()",
      "buildEapStudentOwnReport(studentId)",
      "downloadEapTeacherStudentCsv()"
    ]
  });
})();
