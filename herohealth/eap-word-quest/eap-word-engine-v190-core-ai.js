/* =========================================================
   EAP Word Quest • Core-Aligned Local AI
   File: /herohealth/eap-word-quest/eap-word-engine-v190-core-ai.js
   Version: v1.9.0-CORE-ALIGNED-LOCAL-AI-122

   Requires:
   - eap-core-vocabulary-map-v189.js
   - eap-word-logger.js

   This file provides:
   1. AI Help (3 scaffolded levels; never gives a direct answer)
   2. AI Difficulty (A2 / A2+ / B1 / B1+ recommendation)
   3. AI Prediction (ready / review / at risk)
   4. AI Feedback Coach (explain the learning focus after an answer)
   5. AI Weak Word Coach (collect recovery targets)
   6. AI Challenge Director (anti-repeat policy signal)
   7. AI Boss Director (focus weak targets from the correct 3-session pool)
   8. AI Teacher Insight data helper

   Important:
   - It does NOT change the question bank by itself.
   - v191 must replace the old item bank with Core-aligned items before
     "safe distractor removal" is enabled.
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.0-CORE-ALIGNED-LOCAL-AI-122";
  const GROUP = "122";
  const MAX_HINTS_PER_ITEM = 3;
  const NO_REPEAT_WINDOW = 5;
  const STORAGE = {
    state: "EAP_CORE_AI_STATE_V190",
    weak: "EAP_CORE_AI_WEAK_V190",
    recent: "EAP_CORE_AI_RECENT_V190"
  };

  if (window.__EAP_CORE_AI_V190__) {
    console.info("[EAP Word Quest] Core AI v190 already loaded.");
    return;
  }
  window.__EAP_CORE_AI_V190__ = true;

  const SESSION_COACH = {
    S1: {
      lens: "goal → action → progress",
      clue: "Look for language that states an academic aim, the action to take, or the result to achieve."
    },
    S2: {
      lens: "campus notice → context clue",
      clue: "Use nearby words in the notice to decide whether the item is about a schedule, rule, submission, or attendance."
    },
    S3: {
      lens: "topic → main idea → supporting detail",
      clue: "Ask which option tells the whole message, not only one example or a small detail."
    },
    S4: {
      lens: "relationship between ideas",
      clue: "Check whether the second idea gives a cause, contrast, result, example, or sequence."
    },
    S5: {
      lens: "claim → evidence → source quality",
      clue: "A claim needs support. Evidence is information that helps prove or check the claim."
    },
    S6: {
      lens: "main point → own words",
      clue: "Keep the main message, remove minor detail, and avoid copying the source wording."
    },
    S7: {
      lens: "audience → formal tone",
      clue: "Choose the wording that is polite, clear, and suitable for an academic reader."
    },
    S8: {
      lens: "topic sentence → support → closing",
      clue: "A strong paragraph has one central point, relevant support, and a sentence that brings the idea together."
    },
    S9: {
      lens: "problem → evidence → solution → impact",
      clue: "The best solution matches the problem and is supported by a reason or evidence."
    },
    S10: {
      lens: "data → cautious claim",
      clue: "Describe what the graph or table shows. Do not claim more than the data can support."
    },
    S11: {
      lens: "purpose → polite request → closing",
      clue: "A clear academic email tells the reader why you are writing and asks politely."
    },
    S12: {
      lens: "source → paraphrase → responsible use",
      clue: "Give credit to sources, use your own words when paraphrasing, and disclose responsible AI use."
    },
    S13: {
      lens: "speaker → main point → useful detail",
      clue: "Listen for the speaker's main message first, then record only the detail that supports it."
    },
    S14: {
      lens: "opening → signpost → evidence → closing",
      clue: "A presentation guides the audience with a clear order and supporting evidence."
    },
    S15: {
      lens: "issue → cause → evidence → solution → next step",
      clue: "A strong solution brief connects the problem, evidence, recommendation, expected impact, and reflection."
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function norm(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function lower(value) {
    return norm(value)
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/…/g, "")
      .replace(/[^\p{L}\p{N}+/\s.-]/gu, "");
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeJsonRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function safeJsonWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function isGameActive() {
    const game = $("gameScreen");
    return Boolean(game && game.classList.contains("active"));
  }

  function textOf(id) {
    const el = $(id);
    return el ? norm(el.textContent) : "";
  }

  function getSessionId() {
    const candidates = [
      document.body && document.body.dataset ? document.body.dataset.sessionId : "",
      $("gameScreen") && $("gameScreen").dataset ? $("gameScreen").dataset.sessionId : "",
      textOf("gameModeText"),
      textOf("gameTitle"),
      textOf("questionTags"),
      textOf("progressText")
    ];

    const joined = candidates.join(" ");
    const match = joined.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/i);
    return match ? match[1].toUpperCase() : "";
  }

  function isBoss(sessionId) {
    return /^BG[1-5]$/i.test(sessionId);
  }

  function getSessionMap(sessionId) {
    if (!window.EAP_CORE_VOCAB_MAP) return null;
    if (isBoss(sessionId) && typeof window.getEapCoreBoss === "function") {
      return window.getEapCoreBoss(sessionId);
    }
    return typeof window.getEapCoreSession === "function"
      ? window.getEapCoreSession(sessionId)
      : null;
  }

  function getTargets(sessionId) {
    if (!window.EAP_CORE_VOCAB_MAP) return [];

    if (isBoss(sessionId) && typeof window.getEapCoreBossTargets === "function") {
      return window.getEapCoreBossTargets(sessionId, { unique: true }) || [];
    }

    if (typeof window.getEapCoreSessionTargets === "function") {
      return window.getEapCoreSessionTargets(sessionId, { unique: true }) || [];
    }

    return [];
  }

  function getChoiceButtons() {
    const root = $("choicesEl");
    if (!root) return [];
    return Array.from(root.querySelectorAll("button,.choice,[role='button']"));
  }

  function getChoiceTexts() {
    return getChoiceButtons()
      .map(button => norm(button.textContent))
      .filter(Boolean);
  }

  function fingerprint() {
    const sessionId = getSessionId();
    const prompt = textOf("promptText");
    const choices = getChoiceTexts().join(" | ");
    return `${sessionId}::${prompt}::${choices}`;
  }

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value += (value << 1) + (value << 4) + (value << 7) + (value << 8) + (value << 24);
    }
    return Math.abs(value >>> 0);
  }

  function splitAlternatives(term) {
    return norm(term)
      .replace(/…/g, "")
      .split("/")
      .map(part => norm(part))
      .filter(Boolean);
  }

  function containsTerm(haystack, term) {
    const h = lower(haystack);
    const alternatives = splitAlternatives(term);

    return alternatives.some(part => {
      const needle = lower(part);
      return needle && h.includes(needle);
    });
  }

  function targetScore(target, prompt, choicesText) {
    const all = `${prompt} ${choicesText}`;
    const term = norm(target.term);
    const direct = containsTerm(all, term) ? 100 : 0;

    if (direct) return direct;

    const words = lower(term)
      .split(/\s+/)
      .filter(word => word.length >= 4);

    const hits = words.filter(word => lower(all).includes(word)).length;
    return hits * 10;
  }

  function currentTarget(sessionId = getSessionId()) {
    const targets = getTargets(sessionId);
    if (!targets.length) return null;

    const prompt = textOf("promptText");
    const choicesText = getChoiceTexts().join(" ");
    const scored = targets
      .map(target => ({ target, score: targetScore(target, prompt, choicesText) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 20) {
      return scored[0].target;
    }

    const priority = targets.filter(target => target.band === "core" || target.band === "chunk");
    const pool = priority.length ? priority : targets;
    return pool[hash(fingerprint()) % pool.length];
  }

  function questionType() {
    const tags = lower(textOf("questionTags"));
    const prompt = lower(textOf("promptText"));

    if (tags.includes("context") || prompt.includes("___") || prompt.includes("blank")) return "Context Gap";
    if (tags.includes("contrast")) return "Contrast";
    if (tags.includes("repair")) return "Repair";
    if (tags.includes("boss")) return "Boss Application";
    if (tags.includes("definition")) return "Definition";
    if (tags.includes("sentence")) return "Academic Sentence";
    return "Vocabulary Choice";
  }

  function readMetrics() {
    const state = safeJsonRead(STORAGE.state, {});
    return {
      answers: num(state.answers),
      correct: num(state.correct),
      wrong: num(state.wrong),
      hints: num(state.hints),
      streak: num(state.streak),
      maxStreak: num(state.maxStreak),
      responseTimes: Array.isArray(state.responseTimes) ? state.responseTimes.slice(-20) : [],
      answeredKeys: Array.isArray(state.answeredKeys) ? state.answeredKeys.slice(-80) : [],
      startedAt: state.startedAt || new Date().toISOString()
    };
  }

  function writeMetrics(next) {
    const safe = Object.assign({}, next, {
      version: VERSION,
      group: GROUP,
      updatedAt: new Date().toISOString()
    });
    safeJsonWrite(STORAGE.state, safe);
    window.EAP_CORE_AI_STATE = safe;
    return safe;
  }

  function accuracy(metrics = readMetrics()) {
    return metrics.answers ? Math.round((metrics.correct / metrics.answers) * 100) : 0;
  }

  function averageResponseSeconds(metrics = readMetrics()) {
    if (!metrics.responseTimes.length) return 0;
    return metrics.responseTimes.reduce((sum, value) => sum + num(value), 0) / metrics.responseTimes.length;
  }

  function difficulty(metrics = readMetrics()) {
    const acc = accuracy(metrics);
    const avgTime = averageResponseSeconds(metrics);
    const hintRate = metrics.answers ? metrics.hints / metrics.answers : 0;

    if (metrics.answers < 3) return "A2+";
    if (acc >= 90 && metrics.streak >= 4 && hintRate <= 0.35 && (avgTime === 0 || avgTime <= 12)) return "B1+";
    if (acc >= 75 && hintRate <= 1.2) return "B1";
    if (acc >= 60) return "A2+";
    return "A2";
  }

  function prediction(metrics = readMetrics()) {
    const acc = accuracy(metrics);
    const hintRate = metrics.answers ? metrics.hints / metrics.answers : 0;

    if (metrics.answers < 3) return "Collecting evidence";
    if (acc >= 90 && hintRate <= 0.35) return "Ready for Challenge Mode";
    if (acc >= 75) return "Ready for Main Mission";
    if (acc >= 60) return "Ready, but review recommended";
    return "At Risk — replay with AI Help";
  }

  function recommendation(metrics = readMetrics()) {
    const acc = accuracy(metrics);
    if (metrics.answers < 3) return "Answer a few more items so AI can calibrate the next difficulty.";
    if (acc >= 90 && metrics.hints === 0) return "Try No-Hint Challenge for B1+ application tasks.";
    if (acc >= 75) return "Continue to the Main Mission, then replay only weak targets.";
    if (acc >= 60) return "Review feedback and replay this Session with context questions.";
    return "Use AI Help, review weak targets, then replay before the Boss Gate.";
  }

  function readWeakStore() {
    const raw = safeJsonRead(STORAGE.weak, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function weakKey() {
    const profileName = norm($("studentNameInput") ? $("studentNameInput").value : "");
    const profileId = norm($("studentIdInput") ? $("studentIdInput").value : "");
    return `${GROUP}|${profileId || "anon"}|${profileName || "student"}`;
  }

  function recordWeakTarget(target, sessionId) {
    if (!target) return;

    const store = readWeakStore();
    const key = weakKey();
    const rows = Array.isArray(store[key]) ? store[key] : [];
    const term = norm(target.term);
    const found = rows.find(row => norm(row.term).toLowerCase() === term.toLowerCase() && row.sessionId === sessionId);

    if (found) {
      found.count = num(found.count) + 1;
      found.lastAt = new Date().toISOString();
    } else {
      rows.push({
        term,
        sessionId,
        band: target.band,
        count: 1,
        lastAt: new Date().toISOString()
      });
    }

    store[key] = rows
      .sort((a, b) => num(b.count) - num(a.count) || new Date(b.lastAt) - new Date(a.lastAt))
      .slice(0, 60);

    safeJsonWrite(STORAGE.weak, store);
  }

  function getWeakTargets(sessionId = "ALL", limit = 8) {
    const rows = readWeakStore()[weakKey()] || [];
    const allowed = isBoss(sessionId)
      ? new Set((getSessionMap(sessionId) || {}).sourceSessions || [])
      : null;

    return rows
      .filter(row => sessionId === "ALL" || (allowed ? allowed.has(row.sessionId) : row.sessionId === sessionId))
      .sort((a, b) => num(b.count) - num(a.count) || new Date(b.lastAt) - new Date(a.lastAt))
      .slice(0, limit);
  }

  function readRecent() {
    const value = safeJsonRead(STORAGE.recent, []);
    return Array.isArray(value) ? value : [];
  }

  function recordRecent(sessionId, key) {
    const current = readRecent();
    const next = [
      { sessionId, key, at: new Date().toISOString() },
      ...current.filter(row => row.key !== key)
    ].slice(0, 30);

    safeJsonWrite(STORAGE.recent, next);
    return next;
  }

  function antiRepeatPolicy(sessionId = getSessionId()) {
    const recent = readRecent()
      .filter(row => row.sessionId === sessionId)
      .slice(0, NO_REPEAT_WINDOW)
      .map(row => row.key);

    return {
      noRepeatWindow: NO_REPEAT_WINDOW,
      avoidFingerprints: recent,
      preferBands: difficulty() === "B1+" ? ["chunk", "stretch", "core"] :
        difficulty() === "B1" ? ["core", "chunk", "spiral"] :
        ["core", "spiral", "chunk"],
      weakTargets: getWeakTargets(sessionId, 5).map(row => row.term)
    };
  }

  function injectStyle() {
    if ($("eapV190CoreAiStyle")) return;

    const style = document.createElement("style");
    style.id = "eapV190CoreAiStyle";
    style.textContent = `
      #eapV190Panel {
        margin: 12px 0;
        border: 1px solid #c7d2fe;
        border-radius: 18px;
        padding: 13px 14px;
        background: linear-gradient(135deg,#eef2ff,#ecfeff);
        color: #1e293b;
      }
      #eapV190Panel .eap190-row {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        align-items:center;
        margin-bottom:8px;
      }
      #eapV190Panel .eap190-chip {
        display:inline-flex;
        align-items:center;
        border:1px solid #dbeafe;
        border-radius:999px;
        padding:5px 9px;
        background:#fff;
        font-size:12px;
        font-weight:900;
        color:#334155;
      }
      #eapV190Panel .eap190-chip.ai {
        border-color:#fed7aa;
        background:#fff7ed;
        color:#9a3412;
      }
      #eapV190Panel .eap190-chip.good {
        border-color:#bbf7d0;
        background:#ecfdf5;
        color:#047857;
      }
      #eapV190HintBox {
        display:none;
        margin-top:8px;
        padding:11px 12px;
        border:1px dashed #a5b4fc;
        border-radius:14px;
        background:rgba(255,255,255,.76);
        color:#312e81;
        font-weight:800;
        line-height:1.45;
      }
      #eapV190HintBox.active { display:block; }
      #eapV190Panel .eap190-note {
        color:#475569;
        line-height:1.45;
        font-size:13px;
        font-weight:750;
      }
      #eapV190Summary {
        margin-top:12px;
        border:1px solid #fed7aa;
        border-radius:16px;
        padding:12px 14px;
        background:#fff7ed;
        color:#9a3412;
        line-height:1.5;
        font-weight:850;
      }
      .eap190-safe-eliminated {
        opacity:.45 !important;
        filter:grayscale(.7);
        pointer-events:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if ($("eapV190Panel")) return $("eapV190Panel");

    const panel = document.createElement("div");
    panel.id = "eapV190Panel";
    panel.innerHTML = `
      <div class="eap190-row">
        <span class="eap190-chip ai" id="eapV190Difficulty">AI Difficulty: A2+</span>
        <span class="eap190-chip good" id="eapV190Prediction">AI Prediction: Collecting evidence</span>
        <span class="eap190-chip" id="eapV190Hints">AI Help: 0</span>
      </div>
      <div id="eapV190Note" class="eap190-note"></div>
      <div id="eapV190HintBox"></div>
    `;

    const actions = document.querySelector(".game-actions");
    const gameStats = $("gameStats");
    if (actions) {
      actions.insertAdjacentElement("beforebegin", panel);
    } else if (gameStats) {
      gameStats.insertAdjacentElement("afterend", panel);
    }

    return panel;
  }

  function renderPanel() {
    if (!isGameActive()) return;
    if (!window.EAP_CORE_VOCAB_MAP) return;

    injectStyle();
    ensurePanel();

    const metrics = readMetrics();
    const sessionId = getSessionId();
    const session = getSessionMap(sessionId);
    const target = currentTarget(sessionId);
    const d = $("eapV190Difficulty");
    const p = $("eapV190Prediction");
    const h = $("eapV190Hints");
    const note = $("eapV190Note");

    if (d) d.textContent = `AI Difficulty: ${difficulty(metrics)}`;
    if (p) p.textContent = `AI Prediction: ${prediction(metrics)}`;
    if (h) h.textContent = `AI Help: ${metrics.hints}`;

    if (note) {
      const title = session && session.title ? `${sessionId} · ${session.title}` : "Current Session";
      const focus = session && session.skillFocus ? session.skillFocus : "use the target vocabulary in context";
      const term = target ? ` Current target: “${target.term}”.` : "";
      note.textContent = `${title}: ${focus}.${term}`;
    }

    updateHelpButton();
  }

  function getQuestionHints(key) {
    const state = safeJsonRead(STORAGE.state, {});
    const hintsByQuestion = state.hintsByQuestion && typeof state.hintsByQuestion === "object"
      ? state.hintsByQuestion
      : {};
    return num(hintsByQuestion[key]);
  }

  function setQuestionHints(key, count) {
    const metrics = readMetrics();
    const current = safeJsonRead(STORAGE.state, {});
    const hintsByQuestion = Object.assign({}, current.hintsByQuestion || {});
    hintsByQuestion[key] = count;
    writeMetrics(Object.assign({}, metrics, current, { hintsByQuestion }));
  }

  function updateHelpButton() {
    const button = $("aiHelpBtn");
    if (!button || !isGameActive()) return;

    const count = getQuestionHints(fingerprint());
    const left = Math.max(0, MAX_HINTS_PER_ITEM - count);
    button.disabled = left <= 0;
    button.textContent = left > 0 ? `AI Help · ${left}` : "AI Help used";
    button.title = "AI Help gives a scaffold, not the direct answer.";
  }

  function exactCorrectButton() {
    const choices = getChoiceButtons();

    return choices.find(button => {
      const data = button.dataset || {};
      return [
        data.correct,
        data.isCorrect,
        data.answerCorrect,
        button.getAttribute("data-correct"),
        button.getAttribute("aria-correct")
      ].some(value => String(value).toLowerCase() === "true");
    }) || null;
  }

  function findSafeDistractor(sessionId) {
    if (window.EAP_CORE_BANK_ALIGNED !== true) return null;

    const sessionTerms = new Set(getTargets(sessionId).map(target => lower(target.term)));
    const currentSessionOrder = (window.EAP_CORE_VOCAB_MAP && window.EAP_CORE_VOCAB_MAP.sessionOrder) || [];
    const currentIndex = currentSessionOrder.indexOf(sessionId);

    return getChoiceButtons().find(button => {
      if (button === exactCorrectButton()) return false;
      const option = norm(button.textContent);
      const mapped = typeof window.findEapCoreTarget === "function"
        ? window.findEapCoreTarget(option, "ALL")
        : null;
      if (!mapped) return false;
      if (sessionTerms.has(lower(mapped.term))) return false;
      const itemIndex = currentSessionOrder.indexOf(mapped.sessionId);
      return itemIndex > currentIndex;
    }) || null;
  }

  function buildHint(level, sessionId) {
    const session = getSessionMap(sessionId);
    const coach = SESSION_COACH[sessionId] || {
      lens: "meaning → context → appropriate use",
      clue: "Read the sentence, then choose the option that fits the academic context."
    };
    const target = currentTarget(sessionId);

    if (level === 1) {
      return `Hint 1 · Focus on ${coach.lens}. ${coach.clue}`;
    }

    if (level === 2) {
      if (target) {
        const band =
          target.band === "chunk" ? "a useful academic chunk" :
          target.band === "stretch" ? "a B1+ stretch target" :
          target.band === "spiral" ? "a revisited target" :
          "a core target";
        return `Hint 2 · “${target.term}” is ${band} for this Session. Check whether the option fits ${session && session.mission ? session.mission : "the mission"} rather than only matching one familiar word.`;
      }
      return `Hint 2 · Compare the purpose of the sentence with every option. Choose the one that performs the needed academic function.`;
    }

    const distractor = findSafeDistractor(sessionId);
    if (distractor) {
      distractor.classList.add("eap190-safe-eliminated");
      distractor.setAttribute("aria-disabled", "true");
      return `Hint 3 · One clearly out-of-session distractor has been removed. Now compare the remaining options with the task focus.`;
    }

    return `Hint 3 · Use a contrast check: remove any option that belongs to a different task type, such as a data term in an email task or a tone term in a signal-word task.`;
  }

  function showHint() {
    if (!isGameActive() || !window.EAP_CORE_VOCAB_MAP) return;

    const key = fingerprint();
    const used = getQuestionHints(key);
    if (used >= MAX_HINTS_PER_ITEM) {
      updateHelpButton();
      return;
    }

    const nextLevel = used + 1;
    const metrics = readMetrics();
    setQuestionHints(key, nextLevel);

    const latest = readMetrics();
    writeMetrics(Object.assign({}, latest, {
      hints: num(latest.hints) + 1
    }));

    const box = $("eapV190HintBox");
    if (box) {
      box.textContent = buildHint(nextLevel, getSessionId());
      box.classList.add("active");
    }

    renderPanel();
  }

  function feedbackState() {
    const box = $("feedbackBox");
    if (!box || box.hidden) return "";
    const title = lower(textOf("feedbackTitle"));
    const body = lower(textOf("feedbackText"));
    const all = `${title} ${body}`;

    if (/(correct|ถูกต้อง|ยอดเยี่ยม|great job|well done)/i.test(all)) return "correct";
    if (/(wrong|incorrect|ไม่ถูก|ลองใหม่|not correct)/i.test(all)) return "wrong";
    return "";
  }

  function appendCoachFeedback(result, sessionId, target) {
    const box = $("feedbackBox");
    if (!box || box.hidden) return;
    if ($("eapV190Feedback")) return;

    const coach = SESSION_COACH[sessionId] || {};
    const line = document.createElement("p");
    line.id = "eapV190Feedback";
    line.style.marginTop = "10px";
    line.style.fontWeight = "800";
    line.style.lineHeight = "1.45";

    if (result === "correct") {
      line.textContent = `AI Feedback Coach: Correct. You used ${target ? `“${target.term}”` : "the target"} in the ${sessionId} learning focus: ${coach.lens || "academic context"}.`;
    } else {
      line.textContent = `AI Feedback Coach: Recheck ${coach.lens || "the academic context"}. ${coach.clue || "Use the sentence purpose before choosing."}`;
    }

    box.appendChild(line);
  }

  function recordAnswer(result, questionKey) {
    const existing = readMetrics();
    if (existing.answeredKeys.includes(questionKey)) return;

    const sessionId = getSessionId();
    const target = currentTarget(sessionId);
    const started = window.__EAP_CORE_AI_ITEM_STARTED_AT__ || Date.now();
    const seconds = clamp(Math.round((Date.now() - started) / 1000), 1, 120);

    const next = Object.assign({}, existing, {
      answers: num(existing.answers) + 1,
      correct: num(existing.correct) + (result === "correct" ? 1 : 0),
      wrong: num(existing.wrong) + (result === "wrong" ? 1 : 0),
      streak: result === "correct" ? num(existing.streak) + 1 : 0,
      maxStreak: result === "correct"
        ? Math.max(num(existing.maxStreak), num(existing.streak) + 1)
        : num(existing.maxStreak),
      responseTimes: [...(existing.responseTimes || []), seconds].slice(-20),
      answeredKeys: [...(existing.answeredKeys || []), questionKey].slice(-80)
    });

    writeMetrics(next);
    recordRecent(sessionId, questionKey);

    if (result === "wrong") {
      recordWeakTarget(target, sessionId);
    }

    appendCoachFeedback(result, sessionId, target);
    renderPanel();

    window.EAP_CORE_AI_EVENT = {
      version: VERSION,
      sessionId,
      target: target ? target.term : "",
      result,
      responseSeconds: seconds,
      difficulty: difficulty(next),
      prediction: prediction(next),
      at: new Date().toISOString()
    };
  }

  function watchForFeedback(questionKey, tries = 0) {
    const state = feedbackState();
    if (state) {
      recordAnswer(state, questionKey);
      return;
    }

    if (tries < 10) {
      setTimeout(() => watchForFeedback(questionKey, tries + 1), 130);
    }
  }

  function newQuestionDetected() {
    const key = fingerprint();
    if (!key || key === window.__EAP_CORE_AI_LAST_KEY__) return;

    window.__EAP_CORE_AI_LAST_KEY__ = key;
    window.__EAP_CORE_AI_ITEM_STARTED_AT__ = Date.now();

    const feedback = $("feedbackBox");
    const oldCoach = $("eapV190Feedback");
    if (oldCoach) oldCoach.remove();
    if (feedback && feedback.hidden) {
      const box = $("eapV190HintBox");
      if (box) {
        box.textContent = "";
        box.classList.remove("active");
      }
    }

    renderPanel();
  }

  function nextPolicy() {
    const metrics = readMetrics();
    const sessionId = getSessionId();

    return {
      version: VERSION,
      group: GROUP,
      sessionId,
      difficulty: difficulty(metrics),
      prediction: prediction(metrics),
      recommendation: recommendation(metrics),
      antiRepeat: antiRepeatPolicy(sessionId),
      weakTargets: getWeakTargets(sessionId, 8),
      bossFocus: isBoss(sessionId) ? bossFocus(sessionId) : null
    };
  }

  function bossFocus(bossId) {
    const boss = getSessionMap(bossId);
    const sources = boss && Array.isArray(boss.sourceSessions) ? boss.sourceSessions : [];
    const weak = getWeakTargets(bossId, 8);

    return {
      bossId,
      sourceSessions: sources,
      weakTargets: weak,
      strategy: weak.length
        ? `Prioritise new contexts for: ${weak.map(row => row.term).join(", ")}`
        : "Use a balanced pool across all three source Sessions."
    };
  }

  function appendSummary() {
    const root =
      document.querySelector("#summaryScreen .summary-card") ||
      document.querySelector("#eapV172SummaryOverlay .eap172-card") ||
      document.querySelector("#eapV172SummaryOverlay");

    if (!root || root.hidden) return;

    let box = $("eapV190Summary");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV190Summary";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const metrics = readMetrics();
    const weak = getWeakTargets("ALL", 5).map(row => row.term);
    box.innerHTML = `
      <b>Core AI Learning</b><br>
      Difficulty: ${difficulty(metrics)} • Prediction: ${prediction(metrics)}<br>
      Recommendation: ${recommendation(metrics)}${weak.length ? `<br>Weak targets to revisit: ${weak.join(", ")}` : ""}
    `;
  }

  function mergeUnique(values) {
    const seen = new Set();
    return values
      .map(norm)
      .filter(Boolean)
      .filter(value => {
        const k = lower(value);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  function wrapLogger() {
    if (typeof window.logEapWordQuestResult !== "function") return;
    if (window.logEapWordQuestResult.__eapV190Wrapped) return;

    const original = window.logEapWordQuestResult;

    const wrapped = function(payload) {
      const metrics = readMetrics();
      const sessionId = norm(payload && payload.sessionId) || getSessionId();
      const weak = getWeakTargets(sessionId === "ALL" ? "ALL" : sessionId, 8).map(row => row.term);
      const currentWeak = Array.isArray(payload && payload.weakWords) ? payload.weakWords : [];
      const currentItemWeak = Array.isArray(payload && payload.itemTypeWeak) ? payload.itemTypeWeak : [];
      const currentLevelWeak = Array.isArray(payload && payload.levelWeak) ? payload.levelWeak : [];

      const enriched = Object.assign({}, payload || {}, {
        group: norm(payload && payload.group) || GROUP,
        section: norm(payload && payload.section) || GROUP,
        hintUsed: Math.max(num(payload && payload.hintUsed), num(metrics.hints)),
        hintsUsed: Math.max(num(payload && payload.hintsUsed), num(metrics.hints)),
        aiDifficulty: difficulty(metrics),
        aiPrediction: prediction(metrics),
        localAiVersion: VERSION,
        weakWords: mergeUnique([...currentWeak, ...weak]),
        itemTypeWeak: mergeUnique([...currentItemWeak, ...(metrics.wrong ? [questionType()] : [])]),
        levelWeak: mergeUnique([...currentLevelWeak, ...(accuracy(metrics) < 60 ? ["A2"] : accuracy(metrics) < 75 ? ["A2+–B1"] : [])])
      });

      return original.call(this, enriched);
    };

    wrapped.__eapV190Wrapped = true;
    wrapped.__eapV190Original = original;
    window.logEapWordQuestResult = wrapped;
    console.info("[EAP Word Quest] Core AI logger bridge ready.");
  }

  function buildTeacherInsight(logs) {
    const source = Array.isArray(logs)
      ? logs
      : (typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : []);

    const students = new Map();

    source.forEach(row => {
      const id = norm(row.studentId) || "anon";
      const name = norm(row.studentName) || "Anonymous";
      const key = `${GROUP}|${id}`;

      if (!students.has(key)) {
        students.set(key, {
          studentId: id,
          studentName: name,
          attempts: 0,
          hintUsed: 0,
          atRiskAttempts: 0,
          weakWords: {}
        });
      }

      const current = students.get(key);
      current.attempts += 1;
      current.hintUsed += num(row.hintUsed || row.hintsUsed);
      if (lower(row.aiPrediction).includes("at risk")) current.atRiskAttempts += 1;

      (Array.isArray(row.weakWords) ? row.weakWords : []).forEach(word => {
        const normalized = norm(word);
        if (!normalized) return;
        current.weakWords[normalized] = num(current.weakWords[normalized]) + 1;
      });
    });

    const rows = Array.from(students.values()).map(student => ({
      studentId: student.studentId,
      studentName: student.studentName,
      attempts: student.attempts,
      hintUsed: student.hintUsed,
      atRiskAttempts: student.atRiskAttempts,
      topWeakWords: Object.entries(student.weakWords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }))
    }));

    return {
      version: VERSION,
      group: GROUP,
      students: rows,
      highHintStudents: rows.filter(row => row.hintUsed >= 8),
      atRiskStudents: rows.filter(row => row.atRiskAttempts > 0)
    };
  }

  function installEvents() {
    document.addEventListener("click", event => {
      const help = event.target && event.target.closest ? event.target.closest("#aiHelpBtn") : null;
      if (help) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showHint();
        return;
      }

      const choice = event.target && event.target.closest
        ? event.target.closest("#choicesEl button,#choicesEl .choice,#choicesEl [role='button']")
        : null;

      if (choice && isGameActive()) {
        const key = fingerprint();
        setTimeout(() => watchForFeedback(key), 70);
      }
    }, true);
  }

  function tick() {
    if (!window.EAP_CORE_VOCAB_MAP) return;
    wrapLogger();

    if (isGameActive()) {
      injectStyle();
      newQuestionDetected();
      renderPanel();
    }

    appendSummary();
  }

  window.getEapCoreAiState = () => {
    const metrics = readMetrics();
    return {
      version: VERSION,
      metrics,
      accuracy: accuracy(metrics),
      difficulty: difficulty(metrics),
      prediction: prediction(metrics),
      recommendation: recommendation(metrics),
      nextPolicy: nextPolicy()
    };
  };

  window.getEapCoreAiPolicy = nextPolicy;
  window.getEapBossAiFocus = bossFocus;
  window.getEapCoreWeakTargets = getWeakTargets;
  window.buildEapCoreAiInsight = buildTeacherInsight;
  window.showEapCoreAiHint = showHint;
  window.EAP_CORE_AI_VERSION = VERSION;

  installEvents();
  [0, 150, 500, 1000].forEach(delay => setTimeout(tick, delay));
  setInterval(tick, 650);

  console.info("[EAP Word Quest] Core-aligned Local AI ready.", {
    version: VERSION,
    requires: "eap-core-vocabulary-map-v189.js",
    helpers: [
      "getEapCoreAiState()",
      "getEapCoreAiPolicy()",
      "getEapBossAiFocus('BG1')",
      "getEapCoreWeakTargets('S5')",
      "buildEapCoreAiInsight()"
    ]
  });
})();
