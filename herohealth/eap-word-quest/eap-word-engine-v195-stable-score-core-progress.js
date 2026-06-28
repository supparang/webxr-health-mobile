/* =========================================================
   EAP Word Quest • Stable Score + Strict Core Progress
   File: /herohealth/eap-word-quest/eap-word-engine-v195-stable-score-core-progress.js
   Version: v1.9.5-STABLE-SCORE-STRICT-CORE-PROGRESS-122

   Why this patch exists:
   - Earlier AI and score patches could wrap the logger on recurring timers.
   - Those wrappers could wrap each other repeatedly, causing heavy CPU use,
     frozen answer buttons, and repeated "logger bridge ready" console lines.

   This patch:
   - Uses one safe logger bridge only.
   - Prevents the Core AI bridge from re-wrapping the final logger.
   - Does NOT use a MutationObserver.
   - Keeps XP / combo / pass / recovery rewards stable.
   - Updates summary reward UI without creating a render loop.

   Important:
   - Do not load v183 / v190 / v192 / v193 / v194 with this file.
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.5-STABLE-SCORE-STRICT-CORE-PROGRESS-122";
  const GROUP = "122";
  const LEDGER_KEY = "EAP_WORD_QUEST_CORE_V195_REWARD_LEDGER";

  if (window.__EAP_WORD_V195_STABILITY__) {
    console.info("[EAP Word Quest] v195 stability patch already loaded");
    return;
  }
  window.__EAP_WORD_V195_STABILITY__ = true;

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
      console.warn("[EAP Word Quest] v195 cannot save reward ledger", err);
      return false;
    }
  }

  function isBoss(sessionId) {
    return /^BG[1-5]$/.test(norm(sessionId));
  }

  function rewardRunKey(payload) {
    return [
      GROUP,
      norm(payload && payload.studentId) || "anon",
      norm(payload && payload.sessionId) || "S1",
      norm(payload && (payload.endedAt || payload.playedAt || payload.startedAt)) || "run"
    ].join("|");
  }

  function getHintCount(payload) {
    const fromPayload = Math.max(
      num(payload && payload.hintUsed),
      num(payload && payload.hintsUsed)
    );

    if (fromPayload > 0) return fromPayload;

    try {
      if (typeof window.getEapCoreAiState === "function") {
        const ai = window.getEapCoreAiState();
        return Math.max(0, num(ai && ai.metrics && ai.metrics.hints));
      }
    } catch (err) {}

    return 0;
  }

  function enrichReward(payload, persist) {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.rewardVersion === VERSION && payload.rewardBreakdown) return payload;

    const correct = Math.max(0, num(payload.correct));
    const total = Math.max(1, num(payload.total, 1));
    const accuracy = clamp(
      Math.round(num(payload.accuracy, (correct / total) * 100)),
      0,
      100
    );
    const passed = Boolean(payload.passed);
    const sessionId = norm(payload.sessionId) || "S1";
    const hints = getHintCount(payload);
    const rawCombo = Math.max(0, num(payload.maxCombo));
    const maxCombo = correct > 0 ? Math.max(1, rawCombo) : 0;
    const mode = norm(payload.mode).toLowerCase();
    const responseTime = Math.max(0, num(payload.responseTimeAvg));

    const baseScoreFromController = Math.max(0, num(payload.score), num(payload.xp));
    const correctFloorXp = correct * 60;
    const scoreFloor = Math.max(baseScoreFromController, correctFloorXp);
    const comboBonus = maxCombo >= 2
      ? Math.min(90, (maxCombo - 1) * 15 + (maxCombo >= 4 ? 20 : 0))
      : 0;
    const speedBonus = responseTime > 0 && responseTime <= 6
      ? correct * 10
      : responseTime > 0 && responseTime <= 12
        ? correct * 5
        : 0;
    const passBonus = passed ? (isBoss(sessionId) ? 220 : 140) : 0;
    const noHintBonus = passed && hints === 0 ? 30 : 0;
    const recoveryBonus = passed && mode === "weak" ? 75 : 0;
    const perfectBonus = accuracy === 100 ? (isBoss(sessionId) ? 160 : 100) : 0;

    const ledger = safeRead(LEDGER_KEY, { sessions: {}, runs: {} }) || { sessions: {}, runs: {} };
    ledger.sessions = ledger.sessions || {};
    ledger.runs = ledger.runs || {};

    const sessionLedgerKey = `${GROUP}|${norm(payload.studentId) || "anon"}|${sessionId}`;
    const previousBest = num(ledger.sessions[sessionLedgerKey] && ledger.sessions[sessionLedgerKey].bestAccuracy, -1);
    const improvementBonus = previousBest >= 0 && accuracy > previousBest
      ? Math.min(120, (accuracy - previousBest) * 3)
      : 0;

    const xp = scoreFloor + comboBonus + speedBonus + passBonus + noHintBonus + recoveryBonus + perfectBonus + improvementBonus;

    const enriched = Object.assign({}, payload, {
      score: xp,
      xp,
      maxCombo,
      hintUsed: Math.max(num(payload.hintUsed), hints),
      hintsUsed: Math.max(num(payload.hintsUsed), hints),
      rewardVersion: VERSION,
      rewardBreakdown: {
        version: VERSION,
        correct,
        total,
        accuracy,
        hints,
        baseScoreFromController,
        correctFloorXp,
        comboBonus,
        speedBonus,
        passBonus,
        noHintBonus,
        recoveryBonus,
        perfectBonus,
        improvementBonus,
        xpBase: scoreFloor,
        xp,
        maxCombo
      },
      xpBase: scoreFloor,
      comboBonus,
      speedBonus,
      passBonus,
      noHintBonus,
      recoveryBonus,
      perfectBonus,
      improvementBonus
    });

    if (persist) {
      const runKey = rewardRunKey(enriched);
      if (!ledger.runs[runKey]) {
        ledger.runs[runKey] = {
          sessionId,
          xp,
          accuracy,
          at: new Date().toISOString()
        };

        const old = ledger.sessions[sessionLedgerKey] || {};
        ledger.sessions[sessionLedgerKey] = {
          bestAccuracy: Math.max(num(old.bestAccuracy, 0), accuracy),
          totalXp: num(old.totalXp) + xp,
          attempts: num(old.attempts) + 1,
          lastXp: xp,
          lastAccuracy: accuracy,
          lastAt: new Date().toISOString()
        };
        safeWrite(LEDGER_KEY, ledger);
      }
    }

    return enriched;
  }

  function installSingleLoggerBridge() {
    const current = window.logEapWordQuestResult;
    if (typeof current !== "function") return false;
    if (current.__eapV195Wrapped) return true;

    const bridge = function(payload) {
      const enriched = enrichReward(payload, true);
      return current.call(this, enriched);
    };

    /*
      v190 checks this marker every 650 ms. Giving the final bridge the same
      marker prevents it from continuously wrapping the bridge again.
    */
    bridge.__eapV195Wrapped = true;
    bridge.__eapV194Wrapped = true;
    bridge.__eapV190Wrapped = true;
    bridge.__eapV193Wrapped = true;
    bridge.__eapV194Original = current;

    window.logEapWordQuestResult = bridge;
    console.info("[EAP Word Quest] v195 single logger bridge ready");
    return true;
  }

  function statNode(root, label) {
    if (!root) return null;
    const wanted = norm(label).toLowerCase();
    const cards = Array.from(root.querySelectorAll(".mini,.stat,.eap172-stat,.summary-stat"));
    for (const card of cards) {
      const caption = card.querySelector("span,small,.label");
      const value = card.querySelector("b,strong,.value");
      if (!caption || !value) continue;
      if (norm(caption.textContent).toLowerCase() === wanted) return value;
    }
    return null;
  }

  function readStat(root, label) {
    const node = statNode(root, label);
    const match = node && norm(node.textContent).match(/-?\d+/);
    return match ? num(match[0]) : 0;
  }

  function updateLiveScoreSafely() {
    const game = $("gameScreen");
    const stats = $("gameStats");
    if (!game || !stats || !game.classList.contains("active")) return;

    const correct = readStat(stats, "Correct");
    const combo = readStat(stats, "Combo");
    const scoreNode = statNode(stats, "Score");
    if (!scoreNode || correct <= 0) return;

    const minimum = correct * 60 + (combo >= 2 ? Math.min(90, (combo - 1) * 15) : 0);
    const current = readStat(stats, "Score");
    if (minimum > current) scoreNode.textContent = String(minimum);
  }

  function injectStyle() {
    if ($("eapV194Style")) return;
    const style = document.createElement("style");
    style.id = "eapV194Style";
    style.textContent = `
      #eapV194RewardBox{
        border:1px solid #bbf7d0;
        background:linear-gradient(135deg,#ecfdf5,#eff6ff);
        color:#14532d;
        border-radius:18px;
        padding:14px 16px;
        margin:14px 0;
        font-weight:850;
        line-height:1.5;
      }
      #eapV194RewardBox .eap194-title{font-size:16px;font-weight:1000;color:#166534;margin-bottom:6px}
      #eapV194RewardBox .eap194-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #eapV194RewardBox .eap194-chip{
        display:inline-flex;align-items:center;border:1px solid #bbf7d0;background:#fff;
        border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#166534;
      }
      #eapV194RewardBox .eap194-recovery{margin-top:8px;color:#1e3a8a}
    `;
    document.head.appendChild(style);
  }

  function currentSummaryResult() {
    if (window.EAP_V195_LAST_RESULT) return window.EAP_V195_LAST_RESULT;
    if (window.EAP_V192_LAST_RESULT) return window.EAP_V192_LAST_RESULT;
    const v172 = window.EAP_V172_SUMMARY_STATE;
    return v172 && v172.result ? v172.result : null;
  }

  function strictCoreProgress(){
    if (typeof window.getEapCoreProgress === "function") return window.getEapCoreProgress();
    return { passed:0,total:20,percent:0,next:"S1",coreOnly:true };
  }

  function renderStrictCoreProgress(root){
    if (!root) return;
    const old = root.querySelector("#eapV183ProgressBox");
    if (old) old.remove();
    let box = $("eapV195CoreProgressBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV195CoreProgressBox";
      box.style.cssText = "border:1px solid #c7d2fe;background:#eef2ff;color:#312e81;border-radius:16px;padding:12px 14px;margin:12px 0;font-weight:900;line-height:1.45";
      const before = root.querySelector(".summary-actions,.eap172-actions");
      if (before) before.insertAdjacentElement("beforebegin",box);
      else root.appendChild(box);
    }
    const p = strictCoreProgress();
    box.textContent = `Core Progress: ${p.passed}/${p.total} passed • ${p.percent}% • Next: ${p.next}`;
  }

  let renderedSummaryKey = "";

  function renderSummaryRewardSafely() {
    const source = currentSummaryResult();
    if (!source) return;

    const root =
      document.querySelector("#eapV172SummaryOverlay .eap172-card") ||
      document.querySelector("#eapV172SummaryOverlay") ||
      document.querySelector("#summaryScreen .summary-card");
    if (!root) return;

    renderStrictCoreProgress(root);

    const key = rewardRunKey(source);
    if (key === renderedSummaryKey && $("eapV194RewardBox")) return;

    const result = enrichReward(source, false);
    Object.assign(source, result);

    const xpNode = statNode(root, "XP") || statNode(root, "Score");
    const comboNode = statNode(root, "Max Combo") || statNode(root, "Combo");
    if (xpNode) xpNode.textContent = String(result.xp);
    if (comboNode) comboNode.textContent = String(result.maxCombo);

    let box = $("eapV194RewardBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV194RewardBox";
      const actions = root.querySelector(".summary-actions,.eap172-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const r = result.rewardBreakdown;
    const recovery = result.passed
      ? "Great work. Replay at a higher difficulty or use Weak Words mode for extra mastery."
      : `Recovery Mission: replay ${norm(result.sessionId) || "this Session"} with AI Help and focus on ${Array.isArray(result.weakWords) && result.weakWords.length ? result.weakWords.slice(0,3).join(", ") : "the missed targets"}.`;

    box.innerHTML = `
      <div class="eap194-title">🎯 XP earned this round: ${result.xp}</div>
      <div>Every correct answer earns progress, even before the pass threshold is reached.</div>
      <div class="eap194-row">
        <span class="eap194-chip">Base ${r.xpBase}</span>
        <span class="eap194-chip">Combo +${r.comboBonus}</span>
        <span class="eap194-chip">Pass +${r.passBonus}</span>
        <span class="eap194-chip">Hints ${r.hints}</span>
      </div>
      <div class="eap194-recovery">${recovery}</div>
    `;

    renderedSummaryKey = key;
  }

  function inspect() {
    const logger = window.logEapWordQuestResult;
    return {
      version: VERSION,
      loggerBridgeInstalled: Boolean(logger && logger.__eapV195Wrapped),
      v190RewrapBlocked: Boolean(logger && logger.__eapV190Wrapped),
      oldV193Loaded: Boolean(window.__EAP_WORD_V193_SCORE_COMBO__),
      latestReward: currentSummaryResult() ? enrichReward(currentSummaryResult(), false).rewardBreakdown : null
    };
  }

  function tick() {
    installSingleLoggerBridge();
    updateLiveScoreSafely();
    renderSummaryRewardSafely();
  }

  function boot() {
    injectStyle();
    tick();
    [150, 600, 1200].forEach(delay => setTimeout(tick, delay));
    window.addEventListener("eap-core-run-finished", () => {
      [80, 350, 900].forEach(delay => setTimeout(tick,delay));
    });
    document.addEventListener("click", event => {
      const hit = event.target && event.target.closest ? event.target.closest("#choicesEl .eap192-choice") : null;
      if (hit) setTimeout(updateLiveScoreSafely,60);
    }, true);
    console.info("[EAP Word Quest] v195 stable score + strict core progress ready", inspect());
  }

  window.inspectEapV194 = inspect;
  window.inspectEapV195 = inspect;
  window.getEapV194RewardPreview = () => {
    const result = currentSummaryResult();
    return result ? enrichReward(result, false) : null;
  };
  window.EAP_WORD_V195_VERSION = VERSION;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
