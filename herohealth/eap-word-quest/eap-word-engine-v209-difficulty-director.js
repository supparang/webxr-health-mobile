/* =========================================================
   EAP Word Quest • Session-Calibrated Difficulty Director
   File: /herohealth/eap-word-quest/eap-word-engine-v209-difficulty-director.js
   Version: v2.0.9-SESSION-CALIBRATED-ROUND-DIRECTOR-122

   Why this exists:
   - A learner can be strong in one Session but still be new to another.
   - Difficulty must use the current Session's latest performance first,
     not only an all-history average.

   Round design (12 questions):
   New Session       5 Warm-up + 5 Core Context + 2 Challenge
   Recovery 45–59%   6 Warm-up + 5 Core Context + 1 Challenge
   Ready 60–74%      4 Warm-up + 6 Core Context + 2 Challenge
   Strong 75–89%     3 Warm-up + 6 Core Context + 3 Challenge
   Mastery 90%+      2 Warm-up + 6 Core Context + 4 Challenge

   Boss design (18 questions):
   First attempt     7 Recall + 8 Integrated Core + 3 Challenge
   Replay / passed   5 Recall + 8 Integrated Core + 5 Challenge

   This patch preserves: target map, pass thresholds, logs, XP, gates,
   answer-position randomisation, weak-word recovery and anti-repeat state.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.0.9-SESSION-CALIBRATED-ROUND-DIRECTOR-122";
  const GROUP = "122";
  const CORE_STATE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const BOSS_SOURCES = {
    BG1:["S1","S2","S3"], BG2:["S4","S5","S6"], BG3:["S7","S8","S9"],
    BG4:["S10","S11","S12"], BG5:["S13","S14","S15"]
  };

  if (window.__EAP_WORD_V209_DIFFICULTY_DIRECTOR__) return;
  window.__EAP_WORD_V209_DIFFICULTY_DIRECTOR__ = true;

  if (typeof window.getEapCoreBankItems !== "function") {
    console.warn("[EAP Word Quest] v209 needs the Core question bank before it.");
    return;
  }

  const originalGetItems = window.getEapCoreBankItems;
  const originalPolicy = typeof window.getEapCoreAiPolicy === "function"
    ? window.getEapCoreAiPolicy
    : null;
  let pendingSessionId = "";
  let lastPlan = null;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isBoss = (id) => /^BG[1-5]$/i.test(norm(id));
  const levelRank = (level) => ({"A2":1,"A2+":2,"B1":3,"B1+":4})[norm(level)] || 2;
  const key = (value) => norm(value).toLowerCase().replace(/[’']/g, "").replace(/…/g, "");

  function hash(text) {
    let value = 2166136261;
    String(text || "").split("").forEach((ch) => {
      value ^= ch.charCodeAt(0);
      value += (value << 1) + (value << 4) + (value << 7) + (value << 8) + (value << 24);
    });
    return Math.abs(value >>> 0);
  }

  function shuffled(rows, seed) {
    return rows.slice().map((row, index) => ({
      row,
      rank: hash(`${seed}|${index}|${row.id || row.target || ""}|${Math.random()}`)
    })).sort((a,b) => a.rank - b.rank).map((entry) => entry.row);
  }

  function safeRead(keyName, fallback) {
    try {
      const raw = localStorage.getItem(keyName);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function profileId() {
    const field = document.getElementById("studentIdInput");
    const profile = safeRead(PROFILE_KEY, {}) || {};
    return norm((field && field.value) || profile.studentId || profile.id || "anon")
      .replace(/[^a-z0-9_-]/gi, "_") || "anon";
  }

  function coreState() {
    return safeRead(`${CORE_STATE_PREFIX}_${GROUP}_${profileId()}`, {}) || {};
  }

  function recordFor(sessionId) {
    const state = coreState();
    return state && state.sessions && state.sessions[sessionId]
      ? state.sessions[sessionId]
      : null;
  }

  function progressNext() {
    try {
      const progress = typeof window.getEapCoreProgress === "function"
        ? window.getEapCoreProgress()
        : null;
      return norm(progress && progress.next);
    } catch (err) {
      return "";
    }
  }

  function domSession() {
    const candidates = [
      document.body && document.body.dataset ? document.body.dataset.sessionId : "",
      document.getElementById("gameScreen")?.dataset?.sessionId || "",
      document.getElementById("gameModeText")?.textContent || ""
    ].join(" ");
    const found = candidates.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/i);
    return found ? found[1].toUpperCase() : "";
  }

  function activeSession() {
    return domSession() || pendingSessionId || progressNext() || "S1";
  }

  function planFor(sessionId = activeSession()) {
    const sid = norm(sessionId).toUpperCase() || "S1";
    const record = recordFor(sid) || {};
    const attempts = Math.max(0, Math.round(num(record.totalAttempts)));
    const last = Math.max(0, Math.min(100, Math.round(num(record.lastAccuracy, record.accuracy))));
    const best = Math.max(0, Math.min(100, Math.round(num(record.bestAccuracy, record.accuracy))));

    if (isBoss(sid)) {
      const replay = attempts > 0 || Boolean(record.passed);
      return {
        version:VERSION, sessionId:sid, isBoss:true, attempts, last, best,
        cefr:"B1",
        label: replay ? "Boss Review • B1 + Challenge" : "Boss Review • Supported B1",
        mix: replay ? { recall:5, core:8, challenge:5 } : { recall:7, core:8, challenge:3 },
        prediction: replay ? "Boss replay: maintain accuracy and target weak words" : "Boss warm-up: recall first, then integrate",
        recommendation: "ตอบจากบริบทก่อนใช้ AI Help และทบทวน Weak Words จากสาม Session ที่เกี่ยวข้อง"
      };
    }

    let plan;
    if (!attempts) {
      plan = { cefr:"A2+", label:"เริ่ม Session ใหม่ • A2+ → B1", mix:{warm:5,core:5,challenge:2}, prediction:"เริ่มจากพื้นฐาน แล้วค่อยเพิ่มโจทย์บริบท", recommendation:"อ่านบริบทก่อนเลือกคำตอบ และใช้ AI Help ได้เมื่อไม่แน่ใจ" };
    } else if (last < 45) {
      plan = { cefr:"A2", label:"Recovery • A2 สนับสนุน", mix:{warm:8,core:4,challenge:0}, prediction:"ลดความซับซ้อนชั่วคราวเพื่อสร้างความมั่นใจ", recommendation:"ทบทวนคำหลักและอ่าน feedback ทุกข้อก่อนเล่นซ้ำ" };
    } else if (last < 60) {
      plan = { cefr:"A2+", label:"Recovery • A2+ → B1", mix:{warm:6,core:5,challenge:1}, prediction:"เก็บคำหลักให้แม่นก่อนเพิ่มโจทย์ท้าทาย", recommendation:"ใช้ AI Help กับคำที่พลาด แล้วลองโจทย์บริบทอีกครั้ง" };
    } else if (last < 75) {
      plan = { cefr:"B1", label:"Ready • B1 Context", mix:{warm:4,core:6,challenge:2}, prediction:"ผ่านเกณฑ์แล้ว กำลังเสริมการใช้คำจากบริบท", recommendation:"รักษาความแม่นยำ แล้วลองโจทย์ Challenge สั้น ๆ" };
    } else if (last < 90 || attempts < 2) {
      plan = { cefr:"B1", label:"Strong • B1 + Challenge", mix:{warm:3,core:6,challenge:3}, prediction:"พร้อมท้าทายด้วยโจทย์ประยุกต์", recommendation:"ลองตอบโดยไม่ใช้ Hint ก่อน แล้วทบทวนเฉพาะ Weak Words" };
    } else {
      plan = { cefr:"B1", label:"Mastery • B1 + Challenge", mix:{warm:2,core:6,challenge:4}, prediction:"ความพร้อมสูง แต่ยังมีโจทย์ใหม่ให้คิดจากบริบท", recommendation:"เน้นความแม่นและเหตุผล ไม่รีบเดาจากคำที่คุ้นตา" };
    }

    return Object.assign({ version:VERSION, sessionId:sid, isBoss:false, attempts,last,best }, plan);
  }

  function policyForCurrentSession() {
    const base = originalPolicy ? (originalPolicy() || {}) : {};
    const plan = planFor();
    lastPlan = plan;
    return Object.assign({}, base, {
      difficulty:plan.cefr,
      prediction:plan.prediction,
      recommendation:plan.recommendation,
      sessionCalibrated:true,
      roundMix:plan.mix,
      directorVersion:VERSION
    });
  }

  function eligible(item, plan) {
    return Math.abs(levelRank(item.level) - levelRank(plan.cefr)) <= 1;
  }

  function isWarmup(item) {
    return levelRank(item.level) <= 2 && /definition|context/i.test(norm(item.type));
  }

  function isCoreContext(item) {
    return levelRank(item.level) === 3 || /repair|application/i.test(norm(item.type));
  }

  function isChallenge(item) {
    return levelRank(item.level) >= 4 || (levelRank(item.level) === 3 && /application|repair/i.test(norm(item.type)));
  }

  function take(pool, count, used, seed) {
    const selected = [];
    shuffled(pool, seed).forEach((item) => {
      if (selected.length >= count || used.has(item.id)) return;
      used.add(item.id);
      selected.push(item);
    });
    return selected;
  }

  function makeSessionRoundRows(sessionId, rows, plan) {
    const eligibleRows = rows.filter((item) => eligible(item, plan));
    const pool = eligibleRows.length >= 12 ? eligibleRows : rows.slice();
    const used = new Set();
    const warm = take(pool.filter(isWarmup), plan.mix.warm, used, `${sessionId}|warm`);
    const core = take(pool.filter(isCoreContext), plan.mix.core, used, `${sessionId}|core`);
    const challenge = take(pool.filter(isChallenge), plan.mix.challenge, used, `${sessionId}|challenge`);

    const selected = [...warm, ...core, ...challenge];
    const need = 12 - selected.length;
    if (need > 0) selected.push(...take(pool, need, used, `${sessionId}|fill`));

    // v196 picks up to 8 rows marked core and up to 4 rows marked chunk.
    // We deliberately tag the selected recipe into those two lanes, so every
    // 12-question Session has the intended warm-up/core/challenge balance.
    const marked = selected.slice(0,12).map((item, index) => Object.assign({}, item, {
      targetBand:index < 8 ? "core" : "chunk",
      originalTargetBand:item.targetBand,
      roundRole:index < warm.length ? "warmup" : index < warm.length + core.length ? "core" : "challenge",
      directorVersion:VERSION
    }));
    const chosen = new Set(marked.map((item) => item.id));
    const rest = rows.filter((item) => !chosen.has(item.id)).map((item) => Object.assign({}, item, {
      targetBand:"director-rest",
      originalTargetBand:item.targetBand,
      directorVersion:VERSION
    }));
    return [...marked, ...rest];
  }

  function bossRecoveryRows(bossId, attempt) {
    const rows = [];
    (BOSS_SOURCES[bossId] || []).forEach((sourceSessionId) => {
      const source = originalGetItems(sourceSessionId) || [];
      const recall = source.filter((item) => levelRank(item.level) <= 2 && /definition|context/i.test(norm(item.type)));
      shuffled(recall, `${bossId}|${sourceSessionId}|recovery|${attempt}`).slice(0,3).forEach((item, index) => {
        const cloneItem = clone(item);
        cloneItem.id = `${bossId}_REC_${attempt}_${sourceSessionId}_${index + 1}_${item.id}`;
        cloneItem.sessionId = bossId;
        cloneItem.sourceSessionId = sourceSessionId;
        cloneItem.type = "boss-recovery";
        cloneItem.itemType = "boss-recovery";
        cloneItem.level = "A2+";
        cloneItem.skillTag = `${bossId} • Recall warm-up`;
        cloneItem.feedback = `${item.feedback || "Correct."} ไทย: ข้อนี้เป็นการทบทวนคำหลักจาก ${sourceSessionId} ก่อนเข้าสู่โจทย์บูรณาการ`;
        cloneItem.directorVersion = VERSION;
        rows.push(cloneItem);
      });
    });
    return rows;
  }

  function makeBossRoundRows(bossId, rows, plan) {
    const attempt = Math.max(1, plan.attempts + 1);
    const recovery = bossRecoveryRows(bossId, attempt);
    const core = rows.filter((item) => levelRank(item.level) === 3);
    const challenge = rows.filter((item) => levelRank(item.level) >= 4);
    const used = new Set();
    const selected = [
      ...take(recovery, plan.mix.recall, used, `${bossId}|recall|${attempt}`),
      ...take(core, plan.mix.core, used, `${bossId}|core|${attempt}`),
      ...take(challenge, plan.mix.challenge, used, `${bossId}|challenge|${attempt}`)
    ];
    const needed = 18 - selected.length;
    if (needed > 0) selected.push(...take([...recovery, ...rows], needed, used, `${bossId}|fill|${attempt}`));
    return selected.slice(0,18).map((item) => Object.assign({}, item, { directorVersion:VERSION }));
  }

  function directedBankItems(sessionId, options) {
    const sid = norm(sessionId).toUpperCase();
    const rows = originalGetItems(sessionId, options);
    if (!sid || !rows.length) return rows;

    const active = activeSession();
    if (sid !== active) return rows;

    const plan = planFor(sid);
    lastPlan = plan;
    return plan.isBoss
      ? makeBossRoundRows(sid, rows, plan)
      : makeSessionRoundRows(sid, rows, plan);
  }

  function captureRequestedSession(event) {
    const trigger = event.target && event.target.closest ? event.target.closest("button,[data-start-session]") : null;
    if (!trigger) return;
    const direct = norm(trigger.dataset && trigger.dataset.startSession).toUpperCase();
    if (/^(BG[1-5]|S(?:1[0-5]|[1-9]))$/.test(direct)) {
      pendingSessionId = direct;
      lastPlan = planFor(direct);
      return;
    }
    if (["quickStartBtn","nextMissionBtn"].includes(trigger.id || "")) {
      const next = progressNext();
      if (/^(BG[1-5]|S(?:1[0-5]|[1-9]))$/.test(next)) {
        pendingSessionId = next;
        lastPlan = planFor(next);
      }
    }
  }

  function renderPlanBadge() {
    const game = document.getElementById("gameScreen");
    if (!game || !game.classList.contains("active")) return;
    const sid = domSession() || pendingSessionId;
    if (!sid) return;
    const plan = planFor(sid);
    lastPlan = plan;
    const d = document.getElementById("eapV195Difficulty");
    const p = document.getElementById("eapV195Prediction");
    const note = document.getElementById("eapV195Note");
    if (d) d.textContent = `ระดับรอบนี้: ${plan.label}`;
    if (p) {
      const mix = plan.isBoss
        ? `ทบทวน ${plan.mix.recall} • บูรณาการ ${plan.mix.core} • ท้าทาย ${plan.mix.challenge}`
        : `Warm-up ${plan.mix.warm} • Core ${plan.mix.core} • Challenge ${plan.mix.challenge}`;
      p.textContent = `แผนโจทย์: ${mix}`;
    }
    if (note && !note.dataset.eapV209Plan) {
      note.dataset.eapV209Plan = "true";
      note.textContent = `${note.textContent} แผนนี้ปรับตามผลของ Session นี้ ไม่ใช้คะแนนจาก Session อื่นมาทำให้โจทย์ยากเกินไป.`;
    }
  }

  // Capturing runs before v196's bubble handler starts the Session.
  document.addEventListener("click", captureRequestedSession, true);
  window.getEapCoreAiPolicy = policyForCurrentSession;
  window.getEapCoreBankItems = directedBankItems;
  [250,750,1400].forEach((delay) => setTimeout(renderPlanBadge, delay));
  setInterval(renderPlanBadge, 650);

  window.inspectEapV209Difficulty = () => ({
    version:VERSION,
    pendingSessionId,
    activeSession:activeSession(),
    plan:lastPlan || planFor(),
    policy:policyForCurrentSession(),
    enabled:true
  });

  console.info("[EAP Word Quest] v209 session-calibrated round director ready", { version:VERSION });
})();
