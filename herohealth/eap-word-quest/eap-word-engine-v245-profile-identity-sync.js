/* =========================================================
   EAP Word Quest • Profile Identity Sync
   File: /herohealth/eap-word-quest/eap-word-engine-v245-profile-identity-sync.js
   Version: v2.4.5-PROFILE-IDENTITY-SYNC-122

   Why this exists
   - Previous cloud sync sent a name only after a completed practice round.
   - When a learner changed a saved profile name (for example KK → KP),
     Sheets could still show the old historical name.

   This sends one lightweight PROFILE identity marker whenever the saved
   name/ID changes. Apps Script's existing eap_word_attempt handler updates
   eap_word_profiles without requiring a second Web App router.

   The marker is ignored by Teacher learning analytics by v246.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.5-PROFILE-IDENTITY-SYNC-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const SENT_PREFIX = "EAP_WORD_QUEST_PROFILE_IDENTITY_SENT_V245";

  if (window.__EAP_WORD_V245_PROFILE_IDENTITY_SYNC__) return;
  window.__EAP_WORD_V245_PROFILE_IDENTITY_SYNC__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function endpoint() {
    const helper = typeof window.getEapWordSheetEndpoint === "function"
      ? window.getEapWordSheetEndpoint()
      : "";
    return norm(helper || (window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint) || "");
  }

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(url);
  }

  function profileFromPage() {
    const saved = readJson(PROFILE_KEY, {}) || {};
    const studentName = norm(($("studentNameInput") && $("studentNameInput").value) || saved.studentName || saved.name || "");
    const studentId = norm(($("studentIdInput") && $("studentIdInput").value) || saved.studentId || saved.id || "");
    return { studentName, studentId, group: GROUP, section: GROUP };
  }

  function usable(profile) {
    const name = norm(profile && profile.studentName);
    const id = norm(profile && profile.studentId);
    if (!name || !id) return false;
    return !/^(anonymous|hero|student)$/i.test(name) && !/^(anon|no-id)$/i.test(id);
  }

  function markerFingerprint(profile) {
    return [
      "profile-identity-v245",
      GROUP,
      profile.studentId,
      profile.studentName.toLowerCase()
    ].join("|");
  }

  function sentKey(profile) {
    return `${SENT_PREFIX}_${GROUP}_${profile.studentId}_${profile.studentName.toLowerCase()}`
      .replace(/[^a-z0-9_|.-]/gi, "_");
  }

  function emit(result) {
    window.EAP_WORD_PROFILE_IDENTITY_SYNC_STATUS = Object.assign({
      version: VERSION,
      updatedAt: new Date().toISOString()
    }, result || {});
    window.dispatchEvent(new CustomEvent("eap-word-profile-identity-synced", {
      detail: window.EAP_WORD_PROFILE_IDENTITY_SYNC_STATUS
    }));
  }

  async function syncProfile(force) {
    const profile = profileFromPage();
    const url = endpoint();

    if (!usable(profile)) {
      const result = { ok:false, reason:"profile_incomplete", profile };
      emit(result);
      return result;
    }

    if (!validEndpoint(url)) {
      const result = { ok:false, reason:"endpoint_not_configured", profile };
      emit(result);
      return result;
    }

    const key = sentKey(profile);
    if (!force && localStorage.getItem(key) === "1") {
      const result = { ok:true, sent:false, reason:"already_synced", profile };
      emit(result);
      return result;
    }

    const now = new Date().toISOString();
    const payload = {
      action: "eap_word_attempt",
      schemaVersion: VERSION,
      clientTs: now,
      pageUrl: location.href,
      userAgent: navigator.userAgent || "",
      record: {
        source: "profile-identity-sync-v245",
        profileIdentitySync: true,
        course: "EAP",
        game: "EAP Word Quest",
        group: GROUP,
        section: GROUP,
        studentName: profile.studentName,
        studentId: profile.studentId,
        sessionId: "PROFILE",
        sessionTitle: "Profile identity sync",
        sessionType: "profile",
        correct: 0,
        total: 1,
        accuracy: 0,
        xp: 0,
        score: 0,
        maxCombo: 0,
        passed: false,
        passThreshold: 100,
        passStatus: "profile_sync",
        hintUsed: 0,
        weakWords: [],
        itemTypeWeak: [],
        levelWeak: [],
        responseTimeAvg: 0,
        attempt: 1,
        bossHp: 0,
        bossMaxHp: 0,
        isBoss: false,
        playedAt: now,
        fingerprint: markerFingerprint(profile)
      }
    };

    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      writeJson(key, "1");
      const result = { ok:true, sent:true, profile };
      emit(result);
      return result;
    } catch (err) {
      const result = { ok:false, reason:String(err && err.message || err), profile };
      emit(result);
      return result;
    }
  }

  function afterProfileSave() {
    setTimeout(() => syncProfile(false), 160);
  }

  document.addEventListener("click", (event) => {
    const target = event.target && event.target.closest ? event.target.closest("#saveProfileBtn") : null;
    if (target) afterProfileSave();
  }, true);

  // Startup resolves a profile already saved on this device such as KP / 12.
  setTimeout(() => syncProfile(false), 1100);

  window.syncEapWordQuestProfileIdentity = () => syncProfile(true);
  window.inspectEapWordQuestProfileIdentity = () => ({
    version: VERSION,
    endpointConfigured: validEndpoint(endpoint()),
    profile: profileFromPage(),
    status: window.EAP_WORD_PROFILE_IDENTITY_SYNC_STATUS || null
  });

  console.info("[EAP Word Quest] v245 profile identity sync ready", window.inspectEapWordQuestProfileIdentity());
})();
