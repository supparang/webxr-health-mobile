// /english/js/lesson-4level-bridge.js
// TechPath Lesson Ultimate r9.2 — 4-Level Runtime Bridge
// PATCH v20260426-lesson-4level-bridge-r9-2
// ✅ Adds 4 levels: easy / normal / hard / challenge
// ✅ Adds Challenge UI without replacing lesson-main.js
// ✅ Syncs selected level to URL/localStorage/window/body dataset
// ✅ Adds A2-B1+ level labels
// ✅ Adds Challenge VR button to existing difficulty board
// ✅ Keeps AI Director / Question badge aware of Challenge
// ✅ Safe wrapper around existing window.setDifficulty()

(function () {
  "use strict";

  const PATCH = "v20260426-lesson-4level-bridge-r9-2";

  const LEVELS = ["easy", "normal", "hard", "challenge"];

  const LEVEL_META = {
    easy: {
      label: "EASY",
      cefr: "A2",
      short: "A2",
      color: "#2ed573",
      bg: "rgba(46,213,115,.14)",
      border: "rgba(46,213,115,.34)",
      note: "A2 • basic"
    },
    normal: {
      label: "NORMAL",
      cefr: "A2+",
      short: "A2+",
      color: "#f1c40f",
      bg: "rgba(241,196,15,.14)",
      border: "rgba(241,196,15,.34)",
      note: "A2+ • clear"
    },
    hard: {
      label: "HARD",
      cefr: "B1",
      short: "B1",
      color: "#ff6b81",
      bg: "rgba(255,107,129,.14)",
      border: "rgba(255,107,129,.34)",
      note: "B1 • real task"
    },
    challenge: {
      label: "CHALLENGE",
      cefr: "B1+",
      short: "B1+",
      color: "#b197fc",
      bg: "rgba(177,151,252,.16)",
      border: "rgba(177,151,252,.40)",
      note: "B1+ • boss skill"
    }
  };

  const STORE_KEY = "TECHPATH_SELECTED_LEVEL";

  function $(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalizeLevel(value) {
    const raw = clean(value).toLowerCase();

    if (raw === "easy" || raw === "a2") return "easy";
    if (raw === "normal" || raw === "medium" || raw === "a2+") return "normal";
    if (raw === "hard" || raw === "b1") return "hard";
    if (raw === "challenge" || raw === "challenging" || raw === "b1+" || raw === "expert") return "challenge";

    return "normal";
  }

  function getQueryLevel() {
    const q = new URLSearchParams(location.search);
    return (
      q.get("level") ||
      q.get("diff") ||
      q.get("difficulty") ||
      q.get("cefr") ||
      ""
    );
  }

  function safeLocalGet(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function selectedLevel() {
    return normalizeLevel(
      window.TECHPATH_SELECTED_LEVEL ||
      getQueryLevel() ||
      safeLocalGet(STORE_KEY) ||
      "normal"
    );
  }

  function updateUrlLevel(level) {
    try {
      const url = new URL(location.href);
      url.searchParams.set("level", level);
      url.searchParams.set("diff", level);
      history.replaceState(null, "", url.toString());
    } catch (_) {}
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function setAFrameOpacity(id, opacity) {
    const el = $(id);
    if (!el) return;

    try {
      el.setAttribute("material", "opacity", String(opacity));
    } catch (_) {}

    try {
      el.setAttribute("opacity", String(opacity));
    } catch (_) {}
  }

  function getMeta(level) {
    return LEVEL_META[normalizeLevel(level)] || LEVEL_META.normal;
  }

  function updateLevelBadges(level) {
    const safe = normalizeLevel(level);
    const meta = getMeta(safe);

    document.body.dataset.techpathLevel = safe;
    document.documentElement.dataset.techpathLevel = safe;

    const badge = $("question-diff-badge");
    if (badge) {
      badge.textContent = `Q: ${meta.label} • ${meta.cefr}`;
      badge.style.borderColor = meta.color;
      badge.style.color = meta.color;
      badge.style.background = meta.bg;
    }

    const directorState = $("ai-director-state");
    if (directorState) {
      const old = clean(directorState.textContent);
      if (!old || /^STEADY|^AI|^LEVEL|^CHALLENGE|^EASY|^NORMAL|^HARD/i.test(old)) {
        directorState.textContent = `${meta.label} • ${meta.cefr}`;
      }
    }

    const directorSub = $("ai-director-sub");
    if (directorSub) {
      directorSub.textContent =
        safe === "challenge"
          ? "AI จะเพิ่มความท้าทายแบบ B1+ แต่ยังช่วยเมื่อเริ่มพลาด"
          : `AI Difficulty: ${meta.note}`;
    }

    const chip = $("techpath-level-chip");
    if (chip) {
      chip.textContent = `${meta.label} • ${meta.cefr}`;
      chip.style.borderColor = meta.border;
      chip.style.background = meta.bg;
      chip.style.color = meta.color;
    }

    document.querySelectorAll("[data-techpath-level]").forEach((btn) => {
      const on = btn.getAttribute("data-techpath-level") === safe;
      btn.classList.toggle("active", on);

      const m = getMeta(btn.getAttribute("data-techpath-level"));
      btn.style.borderColor = on ? m.border : "rgba(255,255,255,.10)";
      btn.style.background = on ? m.bg : "rgba(255,255,255,.045)";
      btn.style.color = on ? m.color : "#eaf6ff";
    });

    setAFrameOpacity("diff-easy-box", safe === "easy" ? 1 : 0.52);
    setAFrameOpacity("diff-normal-box", safe === "normal" ? 1 : 0.52);
    setAFrameOpacity("diff-hard-box", safe === "hard" ? 1 : 0.52);
    setAFrameOpacity("diff-challenge-box", safe === "challenge" ? 1 : 0.52);
  }

  function setLevel(level, options = {}) {
    const safe = normalizeLevel(level);

    window.TECHPATH_SELECTED_LEVEL = safe;
    window.TECHPATH_SELECTED_DIFFICULTY = safe;

    safeLocalSet(STORE_KEY, safe);
    updateUrlLevel(safe);
    updateLevelBadges(safe);

    window.dispatchEvent(new CustomEvent("techpath:level-change", {
      detail: {
        patch: PATCH,
        level: safe,
        meta: getMeta(safe),
        source: options.source || "bridge"
      }
    }));

    if (!options.silent) {
      const feedback = $("feedback");
      if (feedback) {
        feedback.textContent = `AI Difficulty: ${getMeta(safe).label} • ${getMeta(safe).cefr}`;
        feedback.style.color = getMeta(safe).color;
        setTimeout(() => {
          if (feedback.textContent.includes("AI Difficulty")) feedback.textContent = "";
        }, 1200);
      }
    }

    return safe;
  }

  function injectCss() {
    if ($("techpath-4level-bridge-css")) return;

    const style = document.createElement("style");
    style.id = "techpath-4level-bridge-css";
    style.textContent = `
      #techpath-level-panel{
        margin:10px 0;
        padding:10px 12px;
        border-radius:16px;
        border:1px solid rgba(123,237,255,.18);
        background:rgba(10,18,34,.78);
        box-shadow:0 8px 20px rgba(0,0,0,.16);
      }

      #techpath-level-title{
        color:#7bedff;
        font-weight:950;
        font-size:.84rem;
        margin-bottom:8px;
        letter-spacing:.03em;
      }

      #techpath-level-row{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }

      .techpath-level-btn{
        min-height:48px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(255,255,255,.045);
        color:#eaf6ff;
        font:inherit;
        cursor:pointer;
        padding:6px 8px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:2px;
        font-weight:950;
        touch-action:manipulation;
      }

      .techpath-level-btn small{
        font-size:.72rem;
        font-weight:800;
        opacity:.9;
      }

      .techpath-level-btn.active{
        box-shadow:0 0 0 1px rgba(255,255,255,.06) inset, 0 10px 22px rgba(0,0,0,.18);
      }

      #techpath-level-chip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:30px;
        padding:0 10px;
        border-radius:999px;
        border:1px solid rgba(123,237,255,.22);
        background:rgba(123,237,255,.08);
        color:#7bedff;
        font-size:.78rem;
        font-weight:950;
      }

      @media (max-width:700px){
        #techpath-level-panel{
          margin:6px 0 8px;
          padding:9px 10px;
        }

        #techpath-level-row{
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:7px;
        }

        .techpath-level-btn{
          min-height:44px;
          border-radius:13px;
          font-size:.88rem;
        }

        .techpath-level-btn small{
          font-size:.68rem;
        }

        body.mission-mode #techpath-level-panel,
        body.summary-mode #techpath-level-panel{
          display:none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function injectDomLevelPanel() {
    if ($("techpath-level-panel")) return;

    const panel = document.createElement("div");
    panel.id = "techpath-level-panel";
    panel.innerHTML = `
      <div id="techpath-level-title">
        AI DIFFICULTY • A2-B1+
        <span id="techpath-level-chip">NORMAL • A2+</span>
      </div>

      <div id="techpath-level-row">
        <button class="techpath-level-btn" type="button" data-techpath-level="easy">
          EASY <small>A2</small>
        </button>
        <button class="techpath-level-btn" type="button" data-techpath-level="normal">
          NORMAL <small>A2+</small>
        </button>
        <button class="techpath-level-btn" type="button" data-techpath-level="hard">
          HARD <small>B1</small>
        </button>
        <button class="techpath-level-btn" type="button" data-techpath-level="challenge">
          CHALLENGE <small>B1+</small>
        </button>
      </div>
    `;

    const anchor =
      $("ai-director-board") ||
      $("profile-panel") ||
      $("hub-stats-board") ||
      $("attendance-panel");

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    } else {
      document.body.appendChild(panel);
    }

    panel.querySelectorAll("[data-techpath-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = btn.getAttribute("data-techpath-level") || "normal";
        callSetDifficulty(level, "dom-panel");
      });
    });
  }

  function injectVrChallengeButton() {
    if ($("diff-challenge-box")) return;

    const hardBox = $("diff-hard-box");
    const hardEntity = hardBox ? hardBox.parentElement : null;
    const board = hardEntity ? hardEntity.parentElement : null;

    if (!board || !hardEntity) return;

    const challenge = document.createElement("a-entity");
    challenge.id = "diff-challenge-entity";
    challenge.setAttribute("position", "2.88 -0.08 0.02");
    challenge.setAttribute("class", "clickable");
    challenge.setAttribute("onclick", "setDifficulty('challenge')");

    challenge.innerHTML = `
      <a-box id="diff-challenge-box"
        width="1.34"
        height="0.42"
        depth="0.10"
        color="#b197fc"
        material="opacity: 0.52">
      </a-box>
      <a-text value="B1+"
        align="center"
        position="0 0.09 0.06"
        color="#13091f"
        scale="0.34 0.34 0.34">
      </a-text>
      <a-text value="CHALLENGE"
        align="center"
        position="0 -0.08 0.06"
        color="#13091f"
        scale="0.30 0.30 0.30">
      </a-text>
    `;

    board.appendChild(challenge);

    const titleText = Array.from(board.querySelectorAll("a-text"))
      .find((el) => clean(el.getAttribute("value")).toUpperCase() === "DIFFICULTY");

    if (titleText) {
      titleText.setAttribute("value", "DIFFICULTY A2-B1+");
      titleText.setAttribute("scale", "0.46 0.46 0.46");
    }

    const panel = board.querySelector("a-plane");
    if (panel) {
      panel.setAttribute("width", "6.05");
    }

    const frame = board.querySelector("a-box");
    if (frame && frame.id !== "diff-easy-box" && frame.id !== "diff-normal-box" && frame.id !== "diff-hard-box") {
      frame.setAttribute("width", "6.16");
    }
  }

  function patchSetDifficulty() {
    const original = window.setDifficulty;

    if (typeof original !== "function") return false;
    if (original.__techpath4LevelPatched) return true;

    const wrapped = function (level) {
      const safe = normalizeLevel(level);

      let result;

      try {
        result = original.call(this, safe);
      } catch (err) {
        console.warn("[TechPath 4Level] original setDifficulty failed:", err);
      }

      setLevel(safe, {
        source: "setDifficulty-wrapper",
        silent: true
      });

      return result;
    };

    wrapped.__techpath4LevelPatched = true;
    wrapped.__originalSetDifficulty = original;

    window.setDifficulty = wrapped;

    return true;
  }

  function callSetDifficulty(level, source) {
    const safe = normalizeLevel(level);

    if (typeof window.setDifficulty === "function") {
      try {
        window.setDifficulty(safe);
      } catch (err) {
        console.warn("[TechPath 4Level] setDifficulty call failed:", err);
        setLevel(safe, { source });
      }
    } else {
      setLevel(safe, { source });
    }
  }

  function patchLauncherFunctions() {
    const names = [
      "loadMission",
      "startMission",
      "playMission",
      "openMission",
      "selectSession",
      "startSession",
      "launchSession"
    ];

    names.forEach((name) => {
      const fn = window[name];

      if (typeof fn !== "function" || fn.__techpath4LevelLauncherPatched) return;

      const wrapped = function (...args) {
        setLevel(selectedLevel(), {
          source: `${name}-before`,
          silent: true
        });

        return fn.apply(this, args);
      };

      wrapped.__techpath4LevelLauncherPatched = true;
      wrapped.__original = fn;
      window[name] = wrapped;
    });
  }

  function exposeApi() {
    window.TechPathLevels = {
      patch: PATCH,
      levels: LEVELS.slice(),
      meta: { ...LEVEL_META },
      normalizeLevel,
      getSelectedLevel: selectedLevel,
      setLevel: (level) => callSetDifficulty(level, "api"),
      refresh: refresh
    };
  }

  function patchMissionObjectForPromptGuard() {
    const candidates = [
      "currentMission",
      "activeMission",
      "currentQuestion",
      "TECHPATH_CURRENT_MISSION",
      "__TECHPATH_CURRENT_MISSION"
    ];

    const level = selectedLevel();
    const meta = getMeta(level);

    candidates.forEach((key) => {
      const mission = window[key];
      if (!mission || typeof mission !== "object") return;

      mission.level = mission.level || level;
      mission.difficulty = mission.difficulty || level;
      mission._selectedDifficulty = mission._selectedDifficulty || level;
      mission.cefr = mission.cefr || meta.cefr;
    });
  }

  function inferMissionLevelFromDom() {
    const badge = $("question-diff-badge");
    const text = clean(badge?.textContent || "").toLowerCase();

    if (text.includes("challenge") || text.includes("b1+")) return "challenge";
    if (text.includes("hard") || text.includes("b1")) return "hard";
    if (text.includes("easy") || text.includes("a2 ")) return "easy";
    if (text.includes("normal") || text.includes("a2+")) return "normal";

    return "";
  }

  function keepBadgeSynced() {
    const domLevel = inferMissionLevelFromDom();
    const current = selectedLevel();

    if (domLevel && domLevel !== current && domLevel !== "normal") {
      setLevel(domLevel, {
        source: "badge-infer",
        silent: true
      });
      return;
    }

    updateLevelBadges(current);
  }

  function enhanceDataStats() {
    const data = window.TechPathLessonData;
    if (!data || data.__fourLevelEnhanced) return;

    data.__fourLevelEnhanced = true;

    if (typeof data.getMissionStats === "function") {
      try {
        const stats = data.getMissionStats();
        console.log("[TechPath 4Level] Mission stats:", stats);
      } catch (_) {}
    }
  }

  function refresh() {
    injectCss();
    injectDomLevelPanel();
    injectVrChallengeButton();
    patchSetDifficulty();
    patchLauncherFunctions();
    exposeApi();
    enhanceDataStats();
    patchMissionObjectForPromptGuard();
    keepBadgeSynced();
  }

  function boot() {
    console.log("[TechPath 4Level Bridge]", PATCH);

    refresh();

    const initial = selectedLevel();
    setLevel(initial, {
      source: "boot",
      silent: true
    });

    const tryPatch = setInterval(refresh, 600);
    setTimeout(() => clearInterval(tryPatch), 20000);

    const observer = new MutationObserver(() => {
      refresh();
    });

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-mission-type", "value", "visible"]
    });

    window.addEventListener("techpath:identity-ready", () => {
      setTimeout(refresh, 100);
    });

    window.addEventListener("techpath:level-change", () => {
      setTimeout(keepBadgeSynced, 80);
    });

    setInterval(() => {
      patchLauncherFunctions();
      patchMissionObjectForPromptGuard();
      keepBadgeSynced();
    }, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
