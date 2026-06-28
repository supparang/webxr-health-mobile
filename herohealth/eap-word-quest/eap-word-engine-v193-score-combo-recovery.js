/* =========================================================
   EAP Word Quest • Score, Combo & Recovery Reward Patch
   File: /herohealth/eap-word-quest/eap-word-engine-v193-score-combo-recovery.js
   Version: v1.9.3-CORE-SCORE-COMBO-RECOVERY-122

   Requires:
   - eap-word-engine-v192-core-bank-controller.js
   - eap-word-engine-v190-core-ai.js (recommended)

   Fixes:
   - Awards XP even when a learner does not yet pass a Session.
   - Preserves score/XP and combo in the logger and the v172 summary overlay.
   - Adds pass, improvement, no-hint, recovery, and boss bonuses.
   - Adds a readable reward breakdown and Weak-Word recovery cue.
   - Does NOT change pass thresholds or unlock rules.
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.3-CORE-SCORE-COMBO-RECOVERY-122";
  const GROUP = "122";
  const LEDGER_KEY = "EAP_WORD_QUEST_CORE_V193_REWARD_LEDGER";
  const V192_STATE_KEY = "EAP_WORD_QUEST_CORE_V192_STATE";

  if (window.__EAP_WORD_V193_SCORE_COMBO__) {
    console.info("[EAP Word Quest] v193 score/combo patch already loaded");
    return;
  }
  window.__EAP_WORD_V193_SCORE_COMBO__ = true;

  function $(id) { return document.getElementById(id); }

  function norm(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("[EAP Word Quest] v193 cannot write local reward state", err);
      return false;
    }
  }

  function profileKey(payload) {
    const studentId = norm(payload && payload.studentId) || "anon";
    return `${GROUP}|${studentId}`;
  }

  function sessionKey(payload) {
    return `${profileKey(payload)}|${norm(payload && payload.sessionId) || "S1"}`;
  }

  function getHints() {
    try {
      if (typeof window.getEapCoreAiState === "function") {
        const ai = window.getEapCoreAiState();
        return Math.max(0, num(ai && ai.metrics && ai.metrics.hints));
      }
    } catch (err) {}
    return 0;
  }

  function readV192Session(payload) {
    const state = safeRead(V192_STATE_KEY, {}) || {};
    const session = state.sessions && state.sessions[norm(payload && payload.sessionId)];
    return session || {};
  }

  function rewardPolicy(payload) {
    const correct = Math.max(0, num(payload && payload.correct));
    const total = Math.max(1, num(payload && payload.total, 1));
    const accuracy = clamp(Math.round(num(payload && payload.accuracy, (correct / total) * 100)), 0, 100);
    const passed = Boolean(payload && payload.passed);
    const mode = norm(payload && payload.mode).toLowerCase();
    const sessionId = norm(payload && payload.sessionId);
    const isBoss = Boolean(payload && payload.isBoss) || /^BG[1-5]$/.test(sessionId);
    const hints = Math.max(num(payload && (payload.hintUsed || payload.hintsUsed)), getHints());
    const rawCombo = Math.max(0, num(payload && payload.maxCombo));
    const maxCombo = correct > 0 ? Math.max(1, rawCombo) : 0;
    const avgResponse = Math.max(0, num(payload && payload.responseTimeAvg));

    const ledger = safeRead(LEDGER_KEY, {}) || {};
    const previous = ledger[sessionKey(payload)] || {};
    const previousBest = num(previous.bestAccuracy, -1);

    // Every correct answer is worth something. A learner who is still practising
    // must see progress, not a zero-reward screen.
    const correctXp = correct * 60;
    const comboBonus = maxCombo >= 2 ? Math.min(90, (maxCombo - 1) * 15 + (maxCombo >= 4 ? 20 : 0)) : 0;
    const speedBonus = avgResponse > 0 && avgResponse <= 6
      ? correct * 10
      : avgResponse > 0 && avgResponse <= 12
        ? correct * 5
        : 0;
    const noHintBonus = passed && hints === 0 ? 30 : 0;
    const passBonus = passed ? (isBoss ? 220 : 140) : 0;
    const recoveryBonus = passed && mode === "weak" ? 75 : 0;
    const perfectBonus = accuracy === 100 ? (isBoss ? 160 : 100) : 0;
    const improvementBonus = previousBest >= 0 && accuracy > previousBest
      ? Math.min(120, (accuracy - previousBest) * 3)
      : 0;

    const computedXp = correctXp + comboBonus + speedBonus + noHintBonus + passBonus + recoveryBonus + perfectBonus + improvementBonus;
    const originalScore = Math.max(0, num(payload && (payload.score || payload.xp)));
    const xp = Math.max(computedXp, originalScore);

    return {
      version: VERSION,
      correct,
      total,
      accuracy,
      hints,
      maxCombo,
      originalScore,
      correctXp,
      comboBonus,
      speedBonus,
      noHintBonus,
      passBonus,
      recoveryBonus,
      perfectBonus,
      improvementBonus,
      computedXp,
      xp,
      previousBest
    };
  }

  function enrichPayload(payload, shouldPersist = true) {
    if (!payload || typeof payload !== "object") return payload;

    const already = payload.rewardVersion === VERSION && payload.rewardBreakdown;
    if (already) return payload;

    const reward = rewardPolicy(payload);
    const enriched = Object.assign({}, payload, {
      xp: reward.xp,
      score: reward.xp,
      maxCombo: reward.maxCombo,
      hintUsed: Math.max(num(payload.hintUsed), reward.hints),
      hintsUsed: Math.max(num(payload.hintsUsed), reward.hints),
      rewardVersion: VERSION,
      rewardBreakdown: reward,
      xpBase: reward.correctXp,
      comboBonus: reward.comboBonus,
      speedBonus: reward.speedBonus,
      noHintBonus: reward.noHintBonus,
      passBonus: reward.passBonus,
      recoveryBonus: reward.recoveryBonus,
      perfectBonus: reward.perfectBonus,
      improvementBonus: reward.improvementBonus
    });

    if (shouldPersist) {
      const ledger = safeRead(LEDGER_KEY, {}) || {};
      const key = sessionKey(enriched);
      const previous = ledger[key] || {};
      ledger[key] = {
        bestAccuracy: Math.max(num(previous.bestAccuracy, 0), reward.accuracy),
        totalXp: num(previous.totalXp) + reward.xp,
        attempts: num(previous.attempts) + 1,
        lastXp: reward.xp,
        lastAccuracy: reward.accuracy,
        lastAt: new Date().toISOString()
      };
      safeWrite(LEDGER_KEY, ledger);
      syncV192State(enriched);
    }

    return enriched;
  }

  function syncV192State(enriched) {
    const sessionId = norm(enriched && enriched.sessionId);
    if (!sessionId) return;

    const state = safeRead(V192_STATE_KEY, {}) || {};
    state.sessions = state.sessions || {};
    const session = state.sessions[sessionId];

    if (session) {
      session.lastScore = enriched.score;
      session.bestScore = Math.max(num(session.bestScore), num(enriched.score));
      session.lastResult = enriched;
    }

    if (Array.isArray(state.runs)) {
      const hit = state.runs.find(row =>
        norm(row && row.sessionId) === sessionId &&
        norm(row && row.endedAt) === norm(enriched.endedAt)
      );
      if (hit) Object.assign(hit, enriched);
    }

    safeWrite(V192_STATE_KEY, state);
  }

  function labelValue(root, label) {
    if (!root) return null;
    const nodes = Array.from(root.querySelectorAll(".stat,.mini,.eap172-stat,.eap172-stat-card,.summary-stat,div"));
    const wanted = norm(label).toLowerCase();
    for (const node of nodes) {
      const span = node.querySelector && node.querySelector("span,small,.label");
      const b = node.querySelector && node.querySelector("b,strong,.value");
      if (!span || !b) continue;
      if (norm(span.textContent).toLowerCase() === wanted) return b;
    }
    return null;
  }

  function injectStyle() {
    if ($("eapV193Style")) return;
    const style = document.createElement("style");
    style.id = "eapV193Style";
    style.textContent = `
      #eapV193RewardBox{
        border:1px solid #bbf7d0;
        background:linear-gradient(135deg,#ecfdf5,#eff6ff);
        color:#14532d;
        border-radius:18px;
        padding:14px 16px;
        margin:14px 0;
        font-weight:850;
        line-height:1.5;
      }
      #eapV193RewardBox .eap193-title{font-size:16px;font-weight:1000;color:#166534;margin-bottom:6px}
      #eapV193RewardBox .eap193-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #eapV193RewardBox .eap193-chip{
        display:inline-flex;align-items:center;border:1px solid #bbf7d0;background:#fff;
        border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#166534;
      }
      #eapV193RewardBox .eap193-recovery{margin-top:8px;color:#1e3a8a}
      .eap193-score-live{color:#047857!important}
    `;
    document.head.appendChild(style);
  }

  function activeResult() {
    const state = window.EAP_V172_SUMMARY_STATE;
    if (state && state.result) return state.result;
    if (window.EAP_V192_LAST_RESULT) return window.EAP_V192_LAST_RESULT;
    return null;
  }

  function renderRewardBox(result) {
    if (!result) return;
    const payload = enrichPayload(result, false);
    const reward = payload.rewardBreakdown || rewardPolicy(payload);
    const root =
      document.querySelector("#eapV172SummaryOverlay .eap172-card") ||
      document.querySelector("#eapV172SummaryOverlay") ||
      document.querySelector("#summaryScreen .summary-card");

    if (!root) return;

    const xpEl = labelValue(root, "XP") || labelValue(root, "Score");
    const comboEl = labelValue(root, "Max Combo") || labelValue(root, "Combo");
    if (xpEl) {
      xpEl.textContent = String(payload.xp);
      xpEl.classList.add("eap193-score-live");
    }
    if (comboEl) comboEl.textContent = String(payload.maxCombo);

    let box = $("eapV193RewardBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV193RewardBox";
      const actions = root.querySelector(".summary-actions,.eap172-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const chips = [
      `Base +${reward.correctXp}`,
      reward.comboBonus ? `Combo +${reward.comboBonus}` : "Combo +0",
      reward.speedBonus ? `Speed +${reward.speedBonus}` : "Speed +0",
      reward.passBonus ? `Pass +${reward.passBonus}` : "Practice reward active",
      reward.improvementBonus ? `Improved +${reward.improvementBonus}` : "Keep building"
    ];

    const recovery = payload.passed
      ? "Great work. Your next replay can target a higher difficulty or Weak Words mode."
      : `Recovery Mission: replay ${norm(payload.sessionId) || "this Session"} with AI Help and focus on ${Array.isArray(payload.weakWords) && payload.weakWords.length ? payload.weakWords.slice(0,3).join(", ") : "the missed targets"}.`;

    box.innerHTML = `
      <div class="eap193-title">🎯 XP earned this round: ${payload.xp}</div>
      <div>Every correct answer earns XP, even before the pass threshold is reached.</div>
      <div class="eap193-row">${chips.map(chip => `<span class="eap193-chip">${chip}</span>`).join("")}</div>
      <div class="eap193-recovery">${recovery}</div>
    `;
  }

  function updateLiveScore() {
    const game = $("gameScreen");
    if (!game || !game.classList.contains("active")) return;
    const root = $("gameStats");
    if (!root) return;

    const correctNode = labelValue(root, "Correct");
    const comboNode = labelValue(root, "Combo");
    const scoreNode = labelValue(root, "Score");
    if (!correctNode || !scoreNode) return;

    const correct = Math.max(0, num(norm(correctNode.textContent).match(/\d+/)?.[0]));
    const combo = Math.max(0, num(comboNode && norm(comboNode.textContent).match(/\d+/)?.[0]));
    const maxCombo = correct > 0 ? Math.max(1, combo) : 0;
    const preview = correct * 60 + (maxCombo >= 2 ? Math.min(90, (maxCombo - 1) * 15) : 0);

    if (preview > 0) {
      scoreNode.textContent = String(preview);
      scoreNode.classList.add("eap193-score-live");
    }
  }

  function wrapLogger() {
    if (typeof window.logEapWordQuestResult !== "function") return;
    if (window.logEapWordQuestResult.__eapV193Wrapped) return;

    const original = window.logEapWordQuestResult;
    const wrapped = function(payload) {
      const enriched = enrichPayload(payload, true);
      window.EAP_V193_LAST_REWARD = enriched.rewardBreakdown;
      return original.call(this, enriched);
    };
    wrapped.__eapV193Wrapped = true;
    wrapped.__eapV193Original = original;
    window.logEapWordQuestResult = wrapped;
    console.info("[EAP Word Quest] v193 logger reward bridge ready");
  }

  function wrapSummaryState(name) {
    let value;
    try { value = window[name]; } catch (err) { value = undefined; }
    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    if (descriptor && descriptor.get && descriptor.get.__eapV193Getter) return;

    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: Object.assign(function() { return value; }, { __eapV193Getter: true }),
        set(next) {
          if (name === "EAP_V172_SUMMARY_STATE" && next && next.result) {
            next = Object.assign({}, next, { result: enrichPayload(next.result, false) });
            setTimeout(() => renderRewardBox(next.result), 0);
            setTimeout(() => renderRewardBox(next.result), 100);
            setTimeout(() => renderRewardBox(next.result), 350);
          }
          if (name === "EAP_V192_LAST_RESULT" && next) {
            next = enrichPayload(next, false);
          }
          value = next;
        }
      });
      if (value) window[name] = value;
    } catch (err) {
      console.warn("[EAP Word Quest] v193 could not wrap", name, err);
    }
  }

  function inspect() {
    const result = activeResult();
    const preview = result ? enrichPayload(result, false) : null;
    const ledger = safeRead(LEDGER_KEY, {}) || {};
    return {
      version: VERSION,
      activeResult: preview,
      ledger,
      policy: {
        correctXp: "60 XP per correct answer",
        comboBonus: "up to 90 XP",
        passBonus: "140 XP session / 220 XP boss",
        recoveryBonus: "75 XP for passing Weak Words mode"
      }
    };
  }

  function boot() {
    injectStyle();
    wrapLogger();
    wrapSummaryState("EAP_V192_LAST_RESULT");
    wrapSummaryState("EAP_V172_SUMMARY_STATE");

    const observer = new MutationObserver(() => {
      updateLiveScore();
      const result = activeResult();
      if (result) renderRewardBox(result);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    [0, 150, 500, 1000].forEach(delay => setTimeout(() => {
      wrapLogger();
      updateLiveScore();
      const result = activeResult();
      if (result) renderRewardBox(result);
    }, delay));

    setInterval(() => {
      wrapLogger();
      updateLiveScore();
      const result = activeResult();
      if (result) renderRewardBox(result);
    }, 750);

    console.info("[EAP Word Quest] v193 score + combo + recovery reward ready", inspect());
  }

  window.getEapV193RewardPreview = () => {
    const result = activeResult();
    return result ? enrichPayload(result, false) : null;
  };
  window.inspectEapV193 = inspect;
  window.EAP_WORD_V193_VERSION = VERSION;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
