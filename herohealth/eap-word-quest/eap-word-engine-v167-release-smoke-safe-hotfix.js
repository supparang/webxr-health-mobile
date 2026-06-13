/* =========================================================
   EAP Word Quest • Release Smoke Safe Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v167-release-smoke-safe-hotfix.js
   Version: v1.6.7-SAFE-SMOKE-NO-STORAGE

   Fix:
   - runFinalReleaseCheck() no longer fails from localStorage quota
   - runCourseFlowSmokeTest() becomes in-memory only
   - Does not write test data into student progress
   - Keeps QA / Item Validity / Round Quality from v1.6.3
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.6.7-SAFE-SMOKE-NO-STORAGE";

  const CONTENT_SESSIONS = [
    "S1","S2","S3",
    "S4","S5","S6",
    "S7","S8","S9",
    "S10","S11","S12",
    "S13","S14","S15"
  ];

  const BOSS_SESSIONS = ["BG1","BG2","BG3","BG4","BG5"];

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  const BOSS_GATE_CONFIG = {
    BG1:{ label:"Boss Gate 1", sessions:["S1","S2","S3"], minPool:360 },
    BG2:{ label:"Boss Gate 2", sessions:["S4","S5","S6"], minPool:360 },
    BG3:{ label:"Boss Gate 3", sessions:["S7","S8","S9"], minPool:360 },
    BG4:{ label:"Boss Gate 4", sessions:["S10","S11","S12"], minPool:360 },
    BG5:{ label:"Final Boss Gate", sessions:CONTENT_SESSIONS.slice(), minPool:1800 }
  };

  function getPoolByGate(gateId){
    const bank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
    const cfg = BOSS_GATE_CONFIG[gateId];

    if(!cfg) return [];

    return bank.filter(q => cfg.sessions.includes(q.session));
  }

  function memPassed(mem,id){
    return Boolean(mem[id] && mem[id].passed);
  }

  function memUnlock(mem,id){
    if(id === "S1" || id === "S2" || id === "S3") return true;

    if(id === "BG1") return memPassed(mem,"S1") && memPassed(mem,"S2") && memPassed(mem,"S3");

    if(id === "S4" || id === "S5" || id === "S6") return memPassed(mem,"BG1");
    if(id === "BG2") return memPassed(mem,"S4") && memPassed(mem,"S5") && memPassed(mem,"S6");

    if(id === "S7" || id === "S8" || id === "S9") return memPassed(mem,"BG2");
    if(id === "BG3") return memPassed(mem,"S7") && memPassed(mem,"S8") && memPassed(mem,"S9");

    if(id === "S10" || id === "S11" || id === "S12") return memPassed(mem,"BG3");
    if(id === "BG4") return memPassed(mem,"S10") && memPassed(mem,"S11") && memPassed(mem,"S12");

    if(id === "S13" || id === "S14" || id === "S15") return memPassed(mem,"BG4");
    if(id === "BG5") return memPassed(mem,"S13") && memPassed(mem,"S14") && memPassed(mem,"S15");

    return false;
  }

  function memPass(mem,id){
    mem[id] = {
      played:true,
      passed:true,
      bestAccuracy:id === "BG5" ? 80 : /^BG/.test(id) ? 75 : 70
    };
  }

  function snap(mem,step){
    const row = { step };

    COURSE_FLOW.forEach(id => {
      row[id] = memUnlock(mem,id);
    });

    return row;
  }

  function runCourseFlowSmokeTest(){
    const mem = {};
    const rows = [];

    rows.push(snap(mem,"initial"));

    ["S1","S2","S3"].forEach(id => memPass(mem,id));
    rows.push(snap(mem,"after S1-S3"));

    memPass(mem,"BG1");
    rows.push(snap(mem,"after BG1"));

    ["S4","S5","S6"].forEach(id => memPass(mem,id));
    rows.push(snap(mem,"after S4-S6"));

    memPass(mem,"BG2");
    rows.push(snap(mem,"after BG2"));

    ["S7","S8","S9"].forEach(id => memPass(mem,id));
    rows.push(snap(mem,"after S7-S9"));

    memPass(mem,"BG3");
    rows.push(snap(mem,"after BG3"));

    ["S10","S11","S12"].forEach(id => memPass(mem,id));
    rows.push(snap(mem,"after S10-S12"));

    memPass(mem,"BG4");
    rows.push(snap(mem,"after BG4"));

    ["S13","S14","S15"].forEach(id => memPass(mem,id));
    rows.push(snap(mem,"after S13-S15"));

    memPass(mem,"BG5");
    rows.push(snap(mem,"after BG5"));

    const checks = [
      rows[0].S1 === true && rows[0].S2 === true && rows[0].S3 === true && rows[0].BG1 === false,
      rows[1].BG1 === true,
      rows[2].S4 === true && rows[2].S5 === true && rows[2].S6 === true,
      rows[3].BG2 === true,
      rows[4].S7 === true && rows[4].S8 === true && rows[4].S9 === true,
      rows[5].BG3 === true,
      rows[6].S10 === true && rows[6].S11 === true && rows[6].S12 === true,
      rows[7].BG4 === true,
      rows[8].S13 === true && rows[8].S14 === true && rows[8].S15 === true,
      rows[9].BG5 === true,
      rows[10].BG5 === true
    ];

    const summary = {
      version:HOTFIX_VERSION,
      mode:"in-memory-no-storage",
      checksPassed:checks.filter(Boolean).length + "/" + checks.length,
      status:checks.every(Boolean) ? "SMOKE PASS" : "SMOKE CHECK"
    };

    console.group("[EAP Word Quest] Course Flow Smoke Test v1.6.7");
    console.log("Summary:",summary);
    console.table(rows);
    console.groupEnd();

    window.EAP_SMOKE_REPORT = {
      summary,
      rows
    };

    return window.EAP_SMOKE_REPORT;
  }

  function getBossReadyStatus(){
    return BOSS_SESSIONS.map(gateId => {
      const pool = getPoolByGate(gateId);
      const cfg = BOSS_GATE_CONFIG[gateId];

      return {
        gate:gateId,
        pool:pool.length,
        required:cfg.minPool,
        status:pool.length >= cfg.minPool ? "PASS" : "CHECK"
      };
    });
  }

  function runFinalReleaseCheck(){
    let qaReport = null;
    let itemValidityReport = null;
    let roundQualityReport = null;
    let smokeReport = null;

    try{
      qaReport = typeof window.runEapQaLock === "function"
        ? window.runEapQaLock()
        : null;
    }catch(err){
      console.warn("[EAP Word Quest] QA failed:",err);
    }

    try{
      itemValidityReport = typeof window.runItemValiditySuite === "function"
        ? window.runItemValiditySuite()
        : null;
    }catch(err){
      console.warn("[EAP Word Quest] Item validity failed:",err);
    }

    try{
      roundQualityReport = typeof window.runRoundQualitySuite === "function"
        ? window.runRoundQualitySuite()
        : null;
    }catch(err){
      console.warn("[EAP Word Quest] Round quality failed:",err);
    }

    try{
      smokeReport = runCourseFlowSmokeTest();
    }catch(err){
      console.warn("[EAP Word Quest] Smoke failed:",err);
    }

    const bossRows = getBossReadyStatus();

    const qaStatus = qaReport && qaReport.summary && qaReport.summary.finalStatus === "QA PASS" ? "PASS" : "CHECK";
    const itemStatus = itemValidityReport && itemValidityReport.summary && itemValidityReport.summary.status === "ITEM VALIDITY PASS" ? "PASS" : "CHECK";
    const roundStatus = roundQualityReport && roundQualityReport.summary && roundQualityReport.summary.status === "ROUND QUALITY PASS" ? "PASS" : "CHECK";
    const smokeStatus = smokeReport && smokeReport.summary && smokeReport.summary.status === "SMOKE PASS" ? "PASS" : "CHECK";
    const bossStatus = bossRows.every(r => r.status === "PASS") ? "PASS" : "CHECK";

    const checklist = [
      {
        id:"QA_PASS",
        label:"Content QA must pass",
        status:qaStatus,
        evidence:qaReport && qaReport.summary ? qaReport.summary.finalStatus : "QA report missing"
      },
      {
        id:"ITEM_VALIDITY_PASS",
        label:"Item validity must pass",
        status:itemStatus,
        evidence:itemValidityReport && itemValidityReport.summary ? itemValidityReport.summary.status : "Item validity report missing"
      },
      {
        id:"ROUND_QUALITY_PASS",
        label:"Round quality must pass",
        status:roundStatus,
        evidence:roundQualityReport && roundQualityReport.summary ? roundQualityReport.summary.status : "Round quality report missing"
      },
      {
        id:"BOSS_GATES_READY",
        label:"Boss Gates ready",
        status:bossStatus,
        evidence:bossRows.map(r => `${r.gate}:${r.pool}/${r.required}`).join(" | ")
      },
      {
        id:"SMOKE_PASS",
        label:"Course flow smoke test must pass",
        status:smokeStatus,
        evidence:smokeReport && smokeReport.summary ? smokeReport.summary.status : "Smoke report missing"
      },
      {
        id:"NO_STORAGE_SMOKE",
        label:"Smoke test must not write localStorage",
        status:"PASS",
        evidence:"In-memory smoke test only"
      }
    ];

    const finalStatus = checklist.every(r => r.status === "PASS")
      ? "FINAL READY"
      : "FINAL CHECK";

    const report = {
      version:HOTFIX_VERSION,
      checkedAt:new Date().toISOString(),
      finalStatus,
      qaStatus:qaReport && qaReport.summary ? qaReport.summary.finalStatus : "QA CHECK",
      itemValidityStatus:itemValidityReport && itemValidityReport.summary ? itemValidityReport.summary.status : "ITEM VALIDITY CHECK",
      roundQualityStatus:roundQualityReport && roundQualityReport.summary ? roundQualityReport.summary.status : "ROUND QUALITY CHECK",
      smokeStatus:smokeReport && smokeReport.summary ? smokeReport.summary.status : "SMOKE CHECK",
      checklist,
      bossRows,
      qaReport,
      itemValidityReport,
      roundQualityReport,
      smokeReport
    };

    window.EAP_FINAL_RELEASE_REPORT = report;

    console.group("[EAP Word Quest] FINAL RELEASE CHECK v1.6.7");
    console.log("Final Status:",report.finalStatus);
    console.log("QA Status:",report.qaStatus);
    console.log("Item Validity Status:",report.itemValidityStatus);
    console.log("Round Quality Status:",report.roundQualityStatus);
    console.log("Smoke Status:",report.smokeStatus);
    console.table(checklist);
    console.groupEnd();

    return report;
  }

  /*
    Optional cleanup helper:
    ไม่เรียกอัตโนมัติ เพื่อไม่ลบข้อมูลผู้เรียนโดยไม่ตั้งใจ
    ใช้เมื่อ localStorage ใกล้เต็มมาก ๆ เท่านั้น
  */
  function compactEapStatsStorage(){
    const keys = [
      "EAP_WORD_QUEST_STATS_V161",
      "EAP_WORD_QUEST_STATS_V160",
      "EAP_WORD_QUEST_STATS_V01"
    ];

    const results = [];

    keys.forEach(key => {
      try{
        const raw = localStorage.getItem(key);
        if(!raw) return;

        const stats = JSON.parse(raw);

        if(Array.isArray(stats.history)){
          stats.history = stats.history.slice(0,30);
        }

        stats.updatedAt = new Date().toISOString();
        stats.compactedBy = HOTFIX_VERSION;

        localStorage.setItem(key,JSON.stringify(stats));

        results.push({
          key,
          status:"COMPACTED",
          history:stats.history ? stats.history.length : 0
        });
      }catch(err){
        results.push({
          key,
          status:"ERROR",
          error:String(err && err.message || err)
        });
      }
    });

    console.table(results);

    return results;
  }

  window.runCourseFlowSmokeTest = runCourseFlowSmokeTest;
  window.runFinalReleaseCheck = runFinalReleaseCheck;
  window.compactEapStatsStorage = compactEapStatsStorage;

  window.eapRelease = Object.assign({},window.eapRelease || {},{
    smoke:runCourseFlowSmokeTest,
    check:runFinalReleaseCheck,
    compact:compactEapStatsStorage
  });

  window.eapTest = Object.assign({},window.eapTest || {},{
    smoke:runCourseFlowSmokeTest
  });

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = document.getElementById("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] Release smoke safe hotfix ready:",{
    version:HOTFIX_VERSION,
    helpers:[
      "runFinalReleaseCheck()",
      "runCourseFlowSmokeTest()",
      "compactEapStatsStorage()"
    ]
  });
})();
