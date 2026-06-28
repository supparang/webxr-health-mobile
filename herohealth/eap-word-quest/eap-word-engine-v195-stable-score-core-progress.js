/* =========================================================
   EAP Word Quest • Stable Summary Reward + Arc Path Guide
   File: /herohealth/eap-word-quest/eap-word-engine-v195-stable-score-core-progress.js
   Runtime Version: v2.0.2-SUMMARY-REWARD-ARC-PATH-THAI-122

   Purpose:
   - Keep the Core controller as the only source of real score/progress.
   - Render XP / combo from the Core run result.
   - Hide internal answer-target tags before a learner responds.
   - Explain Arc progress and the next required Session in Thai.
========================================================= */

(() => {
  "use strict";

  const VERSION = "v2.0.2-SUMMARY-REWARD-ARC-PATH-THAI-122";
  const BOSS_IDS = new Set(["BG1","BG2","BG3","BG4","BG5"]);
  const ARCS = [
    { id:"ARC1", title:"Foundation Arc", sessions:["S1","S2","S3"], boss:"BG1" },
    { id:"ARC2", title:"Evidence Arc", sessions:["S4","S5","S6"], boss:"BG2" },
    { id:"ARC3", title:"Academic Writing Arc", sessions:["S7","S8","S9"], boss:"BG3" },
    { id:"ARC4", title:"Professional Academic Communication", sessions:["S10","S11","S12"], boss:"BG4" },
    { id:"ARC5", title:"Global Academic Communication", sessions:["S13","S14","S15"], boss:"BG5" }
  ];

  if (window.__EAP_WORD_V202_SUMMARY_PATH__) {
    console.info("[EAP Word Quest] v202 summary path guide already loaded");
    return;
  }
  window.__EAP_WORD_V202_SUMMARY_PATH__ = true;

  const $ = id => document.getElementById(id);

  function norm(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    if (BOSS_IDS.has(norm(sessionId))) return 70;
    return 60;
  }

  function setLoggerMarkers() {
    const logger = window.logEapWordQuestResult;
    if (typeof logger !== "function") return false;
    logger.__eapV190Wrapped = true;
    logger.__eapV195Wrapped = true;
    logger.__eapV193Wrapped = true;
    logger.__eapV194Wrapped = true;
    logger.__eapV202Marked = true;
    return true;
  }

  function sourceResult() {
    return window.EAP_V196_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      (window.EAP_V172_SUMMARY_STATE && window.EAP_V172_SUMMARY_STATE.result) ||
      window.EAP_V202_LAST_RESULT ||
      null;
  }

  function normalizeReward(input) {
    const source = input && typeof input === "object" ? input : {};
    const correct = Math.max(0, num(source.correct));
    const total = Math.max(1, num(source.total, 1));
    const accuracy = clamp(Math.round(num(source.accuracy, (correct / total) * 100)), 0, 100);
    const sessionId = norm(source.sessionId) || "S1";
    const passed = Boolean(source.passed || accuracy >= threshold(sessionId));
    const maxCombo = correct > 0 ? Math.max(1, num(source.maxCombo)) : 0;
    const controllerScore = Math.max(0, num(source.score), num(source.xp));
    const base = Math.max(controllerScore, correct * 60);
    const comboBonus = maxCombo >= 2 ? Math.min(90, (maxCombo - 1) * 15 + (maxCombo >= 4 ? 20 : 0)) : 0;
    const passBonus = passed ? (BOSS_IDS.has(sessionId) ? 220 : 140) : 0;
    const noHintBonus = passed && Math.max(num(source.hintUsed), num(source.hintsUsed)) === 0 ? 30 : 0;
    const perfectBonus = accuracy === 100 ? (BOSS_IDS.has(sessionId) ? 160 : 100) : 0;
    const xp = controllerScore > 0 ? controllerScore : base + comboBonus + passBonus + noHintBonus + perfectBonus;

    return Object.assign({}, source, {
      correct,
      total,
      accuracy,
      sessionId,
      passed,
      maxCombo,
      score: xp,
      xp,
      rewardVersion: VERSION,
      rewardBreakdown: {
        base,
        comboBonus: controllerScore > 0 ? 0 : comboBonus,
        passBonus: controllerScore > 0 ? 0 : passBonus,
        noHintBonus: controllerScore > 0 ? 0 : noHintBonus,
        perfectBonus: controllerScore > 0 ? 0 : perfectBonus,
        xp
      }
    });
  }

  function visibleSummaryRoot() {
    const screen = $("summaryScreen");
    if (screen && screen.classList.contains("active")) {
      return screen.querySelector(".summary-card") || screen;
    }
    return null;
  }

  function setSummaryStat(root, label, value) {
    if (!root) return;
    const wanted = norm(label).toLowerCase();
    const cards = Array.from(root.querySelectorAll(".summary-stat,.stat,.mini"));
    for (const card of cards) {
      if (!norm(card.textContent).toLowerCase().includes(wanted)) continue;
      const valueNode = card.querySelector("b,strong,.value");
      if (valueNode) valueNode.textContent = String(value);
    }
  }

  function injectStyle() {
    if ($("eapV202Style")) return;
    const style = document.createElement("style");
    style.id = "eapV202Style";
    style.textContent = `
      #eapV202RewardBox,#eapV202PathBox{
        margin:12px 0;border-radius:16px;padding:12px 14px;line-height:1.5;font-weight:850;
      }
      #eapV202RewardBox{border:1px solid #bbf7d0;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d}
      #eapV202PathBox{border:1px solid #c7d2fe;background:#f8faff;color:#312e81}
      #eapV202RewardBox b{color:#166534} #eapV202PathBox b{color:#3730a3}
      .eap202-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      .eap202-chip{display:inline-flex;align-items:center;border:1px solid #c7d2fe;background:#fff;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#3730a3}
      .eap202-chip.good{border-color:#bbf7d0;color:#166534}
    `;
    document.head.appendChild(style);
  }

  function sessionTitle(sessionId) {
    if (BOSS_IDS.has(sessionId) && typeof window.getEapCoreBoss === "function") {
      const boss = window.getEapCoreBoss(sessionId);
      if (boss && boss.title) return boss.title;
    }
    if (typeof window.getEapCoreSession === "function") {
      const session = window.getEapCoreSession(sessionId);
      if (session && session.title) return session.title;
    }
    return sessionId;
  }

  function currentCoreState() {
    try {
      const snapshot = typeof window.inspectEapV196 === "function" ? window.inspectEapV196() : null;
      return snapshot && snapshot.sessions ? snapshot.sessions : {};
    } catch (err) {
      return {};
    }
  }

  function isPassedInState(state, sessionId) {
    return Boolean(state && state[sessionId] && state[sessionId].passed);
  }

  function pathSnapshot() {
    const state = currentCoreState();
    const progress = typeof window.getEapCoreProgress === "function"
      ? window.getEapCoreProgress()
      : { passed:0, total:20, percent:0, next:"S1" };
    const arc = ARCS.find(item => {
      const completeSessions = item.sessions.every(id => isPassedInState(state,id));
      return !completeSessions || !isPassedInState(state,item.boss);
    }) || ARCS[ARCS.length - 1];
    const passedSessions = arc.sessions.filter(id => isPassedInState(state,id));
    const pendingSessions = arc.sessions.filter(id => !isPassedInState(state,id));
    const bossPassed = isPassedInState(state,arc.boss);
    return { state, progress, arc, passedSessions, pendingSessions, bossPassed };
  }

  function renderPathSummary(root, result) {
    if (!root) return;
    const info = pathSnapshot();
    const next = info.progress.next || "DONE";
    const nextTitle = next === "DONE" ? "ครบทุกภารกิจแล้ว" : sessionTitle(next);
    const missing = info.pendingSessions.map(id => `${id} · ${sessionTitle(id)}`);
    const arcLine = info.bossPassed
      ? `${info.arc.title} ผ่าน Vocabulary Boss แล้ว` 
      : `Arc นี้ผ่านแล้ว ${info.passedSessions.length}/${info.arc.sessions.length} Session`;
    const unlockLine = info.bossPassed
      ? "ระบบจะเปิด Arc ถัดไปอัตโนมัติ"
      : missing.length
        ? `ต้องผ่าน ${missing.join(" และ ")} เพื่อปลดล็อก ${info.arc.boss} · ${sessionTitle(info.arc.boss)}`
        : `ผ่าน Session ครบแล้ว เหลือ ${info.arc.boss} · ${sessionTitle(info.arc.boss)} เพื่อปลดล็อก Arc ถัดไป`;

    let box = $("eapV195SummaryBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV195SummaryBox";
      box.className = "eap192-summary-box";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }
    box.id = "eapV202PathBox";
    box.className = "eap192-summary-box";
    box.innerHTML = `
      <b>เส้นทาง Vocabulary Arc</b><br>
      ${arcLine} • ความก้าวหน้ารวม ${info.progress.passed}/${info.progress.total} (${info.progress.percent}%)<br>
      ${unlockLine}
      <div class="eap202-row">
        <span class="eap202-chip good">ผ่านแล้ว: ${result.sessionId}</span>
        <span class="eap202-chip">ภารกิจที่ควรทำต่อ: ${next === "DONE" ? "ครบแล้ว" : `${next} · ${nextTitle}`}</span>
      </div>`;

    const nextButton = $("nextMissionBtn");
    if (nextButton) {
      nextButton.textContent = next === "DONE" ? "สรุปผลการเรียน" : `ไปทำ ${next} ต่อ`;
      nextButton.title = next === "DONE" ? "ครบทุก Vocabulary Mission แล้ว" : `${next} · ${nextTitle}`;
    }
  }

  function renderRewardSummary() {
    const root = visibleSummaryRoot();
    const raw = sourceResult();
    if (!root || !raw) return;

    const result = normalizeReward(raw);
    window.EAP_V202_LAST_RESULT = result;
    if (window.EAP_V196_LAST_RESULT) Object.assign(window.EAP_V196_LAST_RESULT, result);
    if (window.EAP_V195_LAST_RESULT) Object.assign(window.EAP_V195_LAST_RESULT, result);

    setSummaryStat(root, "XP", result.xp);
    setSummaryStat(root, "Score", result.xp);
    setSummaryStat(root, "Max Combo", result.maxCombo);
    setSummaryStat(root, "Combo", result.maxCombo);

    const title = $("summaryTitle");
    const subtitle = $("summarySubtitle");
    if (title) title.textContent = result.passed ? `${result.sessionId} ผ่านแล้ว!` : `${result.sessionId} ฝึกเพิ่มอีกนิด`;
    if (subtitle) subtitle.textContent = `${sessionTitle(result.sessionId)} • ${result.accuracy}% • เกณฑ์ผ่าน ${threshold(result.sessionId)}%`;

    let box = $("eapV202RewardBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV202RewardBox";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const needed = Math.ceil(result.total * threshold(result.sessionId) / 100);
    const outcome = result.passed
      ? `ผ่านเกณฑ์ ${threshold(result.sessionId)}% แล้ว พร้อมสะสมความก้าวหน้าใน Arc ต่อไป`
      : `ยังต้องตอบถูกอย่างน้อย ${needed}/${result.total} ข้อเพื่อผ่าน ลองใช้ AI Help และทบทวน Weak Words ก่อนเล่นซ้ำ`;

    box.innerHTML = `
      <b>🎯 XP รอบนี้: ${result.xp}</b><br>
      ได้ ${result.correct}/${result.total} ข้อ • Accuracy ${result.accuracy}% • ${outcome}
      <div class="eap202-row">
        <span class="eap202-chip good">Base ${Math.max(result.correct * 60, result.rewardBreakdown.base || 0)}</span>
        <span class="eap202-chip good">Max Combo ${result.maxCombo}</span>
        <span class="eap202-chip good">Pass ${result.passed ? "✓" : "–"}</span>
      </div>`;

    renderPathSummary(root, result);
  }

  function hideAnswerLeak() {
    const tagBox = $("questionTags");
    if (!tagBox) return;
    Array.from(tagBox.querySelectorAll("span")).forEach(tag => {
      if (/^Target\s*:/i.test(norm(tag.textContent))) {
        tag.textContent = "Mission target";
        tag.title = "คำศัพท์เป้าหมายจะเฉลยผ่าน feedback หลังตอบ";
      }
    });
  }

  function tick() {
    setLoggerMarkers();
    hideAnswerLeak();
    renderRewardSummary();
  }

  window.addEventListener("eap-core-run-finished", event => {
    if (event && event.detail) {
      window.EAP_V202_LAST_RESULT = normalizeReward(event.detail);
      Object.assign(event.detail, window.EAP_V202_LAST_RESULT);
    }
    [0,80,250,600,1100].forEach(delay => setTimeout(tick, delay));
  });

  document.addEventListener("click", event => {
    const watched = event.target && event.target.closest
      ? event.target.closest("#choicesEl .eap192-choice,#nextBtn,#replayBtn,#nextMissionBtn")
      : null;
    if (watched) [40,180,500].forEach(delay => setTimeout(tick, delay));
  }, true);

  injectStyle();
  [0,100,350,800,1500].forEach(delay => setTimeout(tick, delay));
  setInterval(tick, 1000);

  window.inspectEapV202 = () => {
    const result = sourceResult();
    const logger = window.logEapWordQuestResult;
    const path = pathSnapshot();
    return {
      version: VERSION,
      result: result ? normalizeReward(result) : null,
      loggerMarked: Boolean(logger && logger.__eapV190Wrapped && logger.__eapV195Wrapped),
      summaryVisible: Boolean(visibleSummaryRoot()),
      targetHidden: !Array.from(document.querySelectorAll("#questionTags span")).some(tag => /^Target\s*:/i.test(norm(tag.textContent))),
      nextMission: path.progress.next,
      activeArc: path.arc.id
    };
  };

  console.info("[EAP Word Quest] v202 Thai summary path guide ready", {
    version: VERSION,
    loggerMarked: setLoggerMarkers()
  });
})();
