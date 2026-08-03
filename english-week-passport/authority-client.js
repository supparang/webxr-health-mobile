(function () {
  "use strict";

  const cfg = window.EW_CONFIG;
  const FLOW = [
    "pre_challenge",
    "word_match",
    "category_forest",
    "sentence_city",
    "word_detective",
    "final_boss",
    "post_challenge",
    "certificate"
  ];

  const STAGE_PASS_MARKS = Object.freeze({
    word_match: 70,
    category_forest: 70,
    sentence_city: 70,
    word_detective: 70,
    final_boss: 65
  });

  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  function endpointReady() {
    return typeof cfg.webAppUrl === "string" && /^https:\/\/script\.google\.com\/macros\/s\//.test(cfg.webAppUrl);
  }
  function loadDemoDb() {
    try {
      return JSON.parse(localStorage.getItem(cfg.cacheKeys.demoDb) || "{}") || {};
    } catch (_) {
      return {};
    }
  }
  function saveDemoDb(db) {
    localStorage.setItem(cfg.cacheKeys.demoDb, JSON.stringify(db));
  }
  function emptyAuthority(profile) {
    return {
      ok: true,
      mode: endpointReady() ? "server" : "demo",
      profile,
      progress: {
        currentStage: "pre_challenge",
        unlocked: ["pre_challenge"],
        passed: [],
        bestScores: {},
        preDone: false,
        postDone: false,
        finalDone: false,
        certificateEligible: false,
        certificate: null,
        totalScore: 0,
        updatedAt: nowIso()
      }
    };
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!endpointReady()) return reject(new Error("WEB_APP_URL_MISSING"));
      const callback = `EW_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => finish(new Error("REQUEST_TIMEOUT")), cfg.requestTimeoutMs);
      function finish(error, value) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = value => finish(null, value);
      const url = new URL(cfg.webAppUrl);
      Object.entries({ ...params, callback, _ts: Date.now() }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      });
      script.onerror = () => finish(new Error("NETWORK_ERROR"));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  async function post(payload) {
    if (!endpointReady()) throw new Error("WEB_APP_URL_MISSING");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
    try {
      const response = await fetch(cfg.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "follow"
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (_) { throw new Error("INVALID_SERVER_RESPONSE"); }
      if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP_${response.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function demoEnsurePlayer(playerId, nickname) {
    const db = loadDemoDb();
    if (!db[playerId]) {
      const profile = {
        playerId,
        fullName: nickname || `Player ${playerId}`,
        nickname: nickname || `Player ${playerId}`,
        groupName: cfg.defaultGroup,
        institution: "Demo",
        active: true
      };
      db[playerId] = emptyAuthority(profile);
      saveDemoDb(db);
    }
    return db[playerId];
  }

  function demoLookup(playerId, nickname) {
    const authority = demoEnsurePlayer(playerId, nickname);
    return { ok: true, mode: "demo", profile: authority.profile };
  }

  function demoResume(playerId, nickname) {
    const authority = demoEnsurePlayer(playerId, nickname);
    return JSON.parse(JSON.stringify(authority));
  }

  function nextUnlocked(passed, preDone, postDone) {
    const unlocked = ["pre_challenge"];
    if (preDone) unlocked.push("word_match");
    if (passed.includes("word_match")) unlocked.push("category_forest");
    if (passed.includes("category_forest")) unlocked.push("sentence_city");
    if (passed.includes("sentence_city")) unlocked.push("word_detective");
    if (passed.includes("word_detective")) unlocked.push("final_boss");
    if (passed.includes("final_boss")) unlocked.push("post_challenge");
    if (postDone) unlocked.push("certificate");
    return unlocked;
  }

  function demoSubmitAssessment(payload) {
    const db = loadDemoDb();
    const record = db[payload.playerId] || demoEnsurePlayer(payload.playerId, payload.nickname);
    if (payload.assessmentType === "post" && !record.progress.passed.includes("final_boss")) {
      throw new Error("POST_NOT_UNLOCKED");
    }
    if (payload.assessmentType === "pre") record.progress.preDone = true;
    if (payload.assessmentType === "post") {
      record.progress.postDone = true;
      record.progress.certificateEligible = true;
      record.progress.certificate = record.progress.certificate || {
        certificateId: uid("EW-CERT"),
        issuedAt: nowIso(),
        awardLevel: awardLevel(record.progress.totalScore)
      };
    }
    record.progress.unlocked = nextUnlocked(record.progress.passed, record.progress.preDone, record.progress.postDone);
    record.progress.currentStage = record.progress.unlocked[record.progress.unlocked.length - 1];
    record.progress.updatedAt = nowIso();
    db[payload.playerId] = record;
    saveDemoDb(db);
    return { ok: true, receiptId: uid("assessment"), authority: record };
  }

  function demoSubmitGame(payload) {
    const db = loadDemoDb();
    const record = db[payload.playerId] || demoEnsurePlayer(payload.playerId, payload.nickname);
    if (!record.progress.unlocked.includes(payload.stageId)) throw new Error("STAGE_LOCKED");
    const accuracy = payload.total > 0 ? Math.round((payload.score / payload.total) * 100) : 0;
    const passMark = STAGE_PASS_MARKS[payload.stageId] || 70;
    const passed = accuracy >= passMark;
    record.progress.bestScores[payload.stageId] = Math.max(record.progress.bestScores[payload.stageId] || 0, accuracy);
    if (passed && !record.progress.passed.includes(payload.stageId)) record.progress.passed.push(payload.stageId);
    if (payload.stageId === "final_boss" && passed) record.progress.finalDone = true;
    record.progress.totalScore = Object.values(record.progress.bestScores).reduce((sum, value) => sum + Number(value || 0), 0);
    record.progress.unlocked = nextUnlocked(record.progress.passed, record.progress.preDone, record.progress.postDone);
    record.progress.currentStage = record.progress.unlocked[record.progress.unlocked.length - 1];
    record.progress.updatedAt = nowIso();
    db[payload.playerId] = record;
    saveDemoDb(db);
    return { ok: true, receiptId: uid("game"), passed, accuracy, passMark, authority: record };
  }

  function awardLevel(totalScore) {
    if (totalScore >= 450) return "English Week Champion";
    if (totalScore >= 400) return "Word Master";
    if (totalScore >= 325) return "Vocabulary Adventurer";
    return "English Explorer";
  }

  function demoLeaderboard(limit) {
    const db = loadDemoDb();
    const rows = Object.values(db)
      .map(record => ({
        playerId: record.profile.playerId,
        nickname: record.profile.nickname || record.profile.fullName,
        groupName: record.profile.groupName,
        totalScore: record.progress.totalScore || 0,
        completed: Boolean(record.progress.postDone)
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit || cfg.leaderboardLimit);
    return { ok: true, mode: "demo", rows };
  }

  async function profileLookup(playerId, nickname) {
    if (!endpointReady()) {
      if (!cfg.allowDemoWhenEndpointMissing) throw new Error("WEB_APP_URL_MISSING");
      return demoLookup(playerId, nickname);
    }
    return jsonp({ action: "profile_lookup", playerId });
  }

  async function resume(playerId, nickname) {
    if (!endpointReady()) return demoResume(playerId, nickname);
    return jsonp({ action: "player_resume", playerId, force: 1 });
  }

  async function submitAssessment(payload) {
    const body = { ...payload, action: "submit_assessment", appId: cfg.appId, sourceVersion: cfg.version };
    if (!endpointReady()) return demoSubmitAssessment(body);
    return post(body);
  }

  async function submitGame(payload) {
    const body = { ...payload, action: "submit_game_result", appId: cfg.appId, sourceVersion: cfg.version };
    if (!endpointReady()) return demoSubmitGame(body);
    return post(body);
  }

  async function leaderboard(limit) {
    if (!endpointReady()) return demoLeaderboard(limit);
    return jsonp({ action: "leaderboard", limit: limit || cfg.leaderboardLimit });
  }

  window.EW_AUTHORITY = Object.freeze({
    FLOW,
    STAGE_PASS_MARKS,
    endpointReady,
    profileLookup,
    resume,
    submitAssessment,
    submitGame,
    leaderboard,
    awardLevel
  });
}());
