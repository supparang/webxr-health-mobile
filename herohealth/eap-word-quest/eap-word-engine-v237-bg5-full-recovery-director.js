/* =========================================================
   EAP Word Quest • BG5 Full Recovery Director
   File: /herohealth/eap-word-quest/eap-word-engine-v237-bg5-full-recovery-director.js
   Version: v2.3.7-BG5-FULL-RECOVERY-DIRECTOR-122

   Root fix for BG5 shrinking to 18 / 14 questions:
   v209's Boss recipe was written for 18 questions and therefore returned an
   18-item BG5 pool before the Core controller could request its fixed 24.

   This final-Boss-only director reads the verified Core bank directly and
   builds a fresh 24-question BG5 round on every request:
   - First attempt:  8 recall + 10 integrated core + 6 challenge
   - Recovery run:  10 recall +  9 integrated core + 5 challenge

   It changes no prompt text, choices, scoring, thresholds, logs, gates, or
   teacher data. It only prevents a fixed 24-question Final Boss from being
   shortened by a pre-selection recipe.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.7-BG5-FULL-RECOVERY-DIRECTOR-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const CORE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const SOURCES = ["S13","S14","S15"];

  if (window.__EAP_WORD_V237_BG5_FULL_RECOVERY__) return;
  window.__EAP_WORD_V237_BG5_FULL_RECOVERY__ = true;

  if (!window.EAP_CORE_QUESTION_BANK || !window.EAP_CORE_QUESTION_BANK.bySession || typeof window.getEapCoreBankItems !== "function") {
    console.warn("[EAP Word Quest] v237 needs the Core question bank before it.");
    return;
  }

  const delegatedGetItems = window.getEapCoreBankItems;
  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const rank = (level) => ({ "A2":1, "A2+":2, "B1":3, "B1+":4 })[norm(level)] || 2;
  let serial = 0;

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (err) { return Object.assign({}, value); }
  }

  function shuffled(rows, seed) {
    const keyed = rows.slice().map((row, index) => ({
      row,
      value: `${seed}|${index}|${norm(row && row.id)}|${Math.random()}`
    }));
    keyed.sort((a,b) => a.value.localeCompare(b.value));
    return keyed.map((entry) => entry.row);
  }

  function profileId() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {};
      const input = $("studentIdInput");
      return norm((input && input.value) || saved.studentId || saved.id || "no-id").replace(/[^a-z0-9_-]/gi,"_") || "no-id";
    } catch (err) {
      return "no-id";
    }
  }

  function bg5Record() {
    try {
      const key = `${CORE_PREFIX}_${GROUP}_${profileId()}`;
      const state = JSON.parse(localStorage.getItem(key) || "{}") || {};
      return state.sessions && state.sessions.BG5 ? state.sessions.BG5 : {};
    } catch (err) {
      return {};
    }
  }

  function isRecovery() {
    const record = bg5Record();
    return Math.max(0, Number(record.totalAttempts) || 0) > 0;
  }

  function take(rows, count, used, seed) {
    const chosen = [];
    shuffled(rows, seed).forEach((row) => {
      if (!row || chosen.length >= count) return;
      const id = norm(row.id);
      if (!id || used.has(id)) return;
      used.add(id);
      chosen.push(row);
    });
    return chosen;
  }

  function sourceRecallItems(token) {
    const all = [];
    SOURCES.forEach((sourceId) => {
      const rows = Array.isArray(window.EAP_CORE_QUESTION_BANK.bySession[sourceId])
        ? window.EAP_CORE_QUESTION_BANK.bySession[sourceId]
        : [];
      rows
        .filter((item) => rank(item.level) <= 2 && /definition|context/i.test(norm(item.type)))
        .forEach((item, index) => {
          const next = clone(item);
          next.id = `BG5_V237_RECALL_${token}_${sourceId}_${index + 1}_${norm(item.id)}`;
          next.sessionId = "BG5";
          next.sourceSessionId = sourceId;
          next.type = "boss-recall";
          next.itemType = "boss-recall";
          next.level = "B1";
          next.targetBand = "core";
          next.roundRole = "recall";
          next.skillTag = "BG5 • Final recall";
          all.push(next);
        });
    });
    return all;
  }

  function integratedBossItems(token) {
    const rows = Array.isArray(window.EAP_CORE_QUESTION_BANK.bySession.BG5)
      ? window.EAP_CORE_QUESTION_BANK.bySession.BG5
      : [];
    return rows.map((item, index) => {
      const next = clone(item);
      next.id = `BG5_V237_INTEGRATED_${token}_${index + 1}_${norm(item.id)}`;
      next.sessionId = "BG5";
      next.level = "B1";
      next.targetBand = "core";
      next.skillTag = "BG5 • Human Override Summit";
      return next;
    });
  }

  function buildBg5Round() {
    serial += 1;
    const token = `${Date.now().toString(36)}-${serial.toString(36)}`;
    const recovery = isRecovery();
    const recipe = recovery
      ? { recall:10, core:9, challenge:5, label:"Recovery" }
      : { recall:8, core:10, challenge:6, label:"First attempt" };

    const recall = sourceRecallItems(token);
    const integrated = integratedBossItems(token);
    const corePool = integrated.filter((item) => {
      const source = String(item.id || "");
      return !/BOSS_[^_]+_0?(?:3|6)(?:_|$)/.test(source);
    });
    const challengePool = integrated.filter((item) => !corePool.includes(item));
    const used = new Set();
    const selected = [
      ...take(recall, recipe.recall, used, `BG5|${token}|recall`),
      ...take(corePool, recipe.core, used, `BG5|${token}|core`),
      ...take(challengePool, recipe.challenge, used, `BG5|${token}|challenge`)
    ];

    if (selected.length < 24) {
      selected.push(...take([...recall, ...integrated], 24 - selected.length, used, `BG5|${token}|fill`));
    }

    return shuffled(selected.slice(0,24), `BG5|${token}|round`).map((item, index) => Object.assign({}, item, {
      level:"B1",
      targetBand:"core",
      roundRole:item.roundRole || (index < recipe.recall ? "recall" : index < recipe.recall + recipe.core ? "core" : "challenge"),
      bg5DirectorVersion:VERSION,
      bg5Recipe:recipe.label
    }));
  }

  window.getEapCoreBankItems = function bg5FullRecoveryItems(sessionId, options) {
    const sid = norm(sessionId).toUpperCase();
    if (sid !== "BG5") return delegatedGetItems(sessionId, options);
    return buildBg5Round();
  };

  window.inspectEapV237Bg5 = () => {
    const rows = window.getEapCoreBankItems("BG5") || [];
    const roles = rows.reduce((out, row) => {
      const key = row.roundRole || "other";
      out[key] = (out[key] || 0) + 1;
      return out;
    }, {});
    return {
      version:VERSION,
      recovery:isRecovery(),
      expected:24,
      actual:rows.length,
      uniqueIds:new Set(rows.map((row)=>row.id)).size,
      roles
    };
  };

  console.info("[EAP Word Quest] v237 BG5 full recovery director ready", window.inspectEapV237Bg5());
})();
