// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (1-row per session on hha:end)
// - Uses sendBeacon first (best for pagehide), fallback fetch keepalive
// - Endpoint configurable via ?log=SCRIPT_URL or window.HHA_LOG_ENDPOINT

(function (ROOT) {
  'use strict';

  const DOC = ROOT.document;

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function num(v, def = 0) {
    v = Number(v);
    return Number.isFinite(v) ? v : def;
  }
  function str(v, def = '') {
    return (v == null) ? def : String(v);
  }
  function isoNow() { return new Date().toISOString(); }

  // -------- Endpoint --------
  const ENDPOINT =
    qs('log', null) ||
    ROOT.HHA_LOG_ENDPOINT ||
    null;

  // If you want a global default, you can uncomment + set your Apps Script:
  // const ENDPOINT = qs('log', null) || ROOT.HHA_LOG_ENDPOINT || 'https://script.google.com/macros/s/XXXX/exec';

  if (!ENDPOINT) {
    // No endpoint configured; logger stays silent.
    // console.warn('[HHA-Logger] No ENDPOINT. Use ?log=... or window.HHA_LOG_ENDPOINT');
  }

  // -------- Student profile (optional) --------
  // You can pass these via query params, or store in localStorage under HHA_STUDENT_PROFILE.
  function loadProfile() {
    let p = {};
    try {
      const raw = localStorage.getItem('HHA_STUDENT_PROFILE');
      if (raw) p = JSON.parse(raw) || {};
    } catch (_) {}

    // Query params override local profile
    const q = (k) => qs(k, null);

    return {
      studentKey: q('studentKey') ?? p.studentKey ?? null,
      schoolCode: q('schoolCode') ?? p.schoolCode ?? null,
      schoolName: q('schoolName') ?? p.schoolName ?? null,
      classRoom: q('classRoom') ?? p.classRoom ?? null,
      studentNo: q('studentNo') ?? p.studentNo ?? null,
      nickName: q('nickName') ?? p.nickName ?? null,
      gender: q('gender') ?? p.gender ?? null,
      age: q('age') ?? p.age ?? null,
      gradeLevel: q('grade') ?? q('gradeLevel') ?? p.gradeLevel ?? null,
      heightCm: q('heightCm') ?? p.heightCm ?? null,
      weightKg: q('weightKg') ?? p.weightKg ?? null,
      bmi: q('bmi') ?? p.bmi ?? null,
      bmiGroup: q('bmiGroup') ?? p.bmiGroup ?? null,
      vrExperience: q('vrExperience') ?? p.vrExperience ?? null,
      gameFrequency: q('gameFrequency') ?? p.gameFrequency ?? null,
      handedness: q('handedness') ?? p.handedness ?? null,
      visionIssue: q('visionIssue') ?? p.visionIssue ?? null,
      healthDetail: q('healthDetail') ?? p.healthDetail ?? null,
      consentParent: q('consentParent') ?? p.consentParent ?? null,
    };
  }

  // -------- Device --------
  function detectDevice() {
    const v = str(qs('view', ''), '').toLowerCase();
    if (v) return v; // pc/mobile/vr/cvr from your launcher
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('oculus') || ua.includes('quest') || ua.includes('vive')) return 'vr';
    if (ua.includes('mobile')) return 'mobile';
    return 'pc';
  }

  // -------- Build 1 row matching your sheet header --------
  // Header you posted (partial):
  // timestampIso projectTag runMode studyId phase conditionGroup sessionOrder blockLabel siteCode schoolYear semester
  // sessionId gameMode diff durationPlannedSec durationPlayedSec scoreFinal comboMax misses goalsCleared goalsTotal
  // miniCleared miniTotal nTargetGoodSpawned nTargetJunkSpawned nTargetStarSpawned nTargetDiamondSpawned nTargetShieldSpawned
  // nHitGood nHitJunk nHitJunkGuard nExpireGood accuracyGoodPct junkErrorPct avgRtGoodMs medianRtGoodMs fastHitRatePct
  // device gameVersion reason startTimeIso endTimeIso studentKey schoolCode schoolName classRoom studentNo nickName gender age gradeLevel
  // heightCm weightKg bmi bmiGroup vrExperience gameFrequency handedness visionIssue healthDetail consentParent

  function buildRowFromSummary(summary) {
    const prof = loadProfile();

    // Best-effort parse additional meta from URL
    const runMode = str(summary.runMode ?? qs('run', 'play'), 'play');
    const diff = str(summary.diff ?? qs('diff', 'normal'), 'normal');

    // Some projects call it "gameMode" or "challenge"
    const gameMode = str(summary.gameMode ?? qs('gameMode', qs('challenge', '')), '');

    // Compute extra metrics
    const nHitGood = num(summary.nHitGood, 0);
    const nHitJunk = num(summary.nHitJunk, 0);
    const nHitJunkGuard = num(summary.nHitJunkGuard, 0);
    const nExpireGood = num(summary.nExpireGood, 0);

    const denomGood = (nHitGood + nExpireGood);
    const accuracyGoodPct = Number.isFinite(summary.accuracyGoodPct)
      ? num(summary.accuracyGoodPct, 0)
      : (denomGood > 0 ? (nHitGood / denomGood) * 100 : 0);

    // junkErrorPct: proportion of junk hits among all hits (good+junk), guard can be tracked separately
    const denomHit = (nHitGood + nHitJunk);
    const junkErrorPct = denomHit > 0 ? (nHitJunk / denomHit) * 100 : 0;

    // RT metrics: if your engine later emits, keep placeholders for now
    const avgRtGoodMs = num(summary.avgRtGoodMs, 0);
    const medianRtGoodMs = num(summary.medianRtGoodMs, 0);
    const fastHitRatePct = num(summary.fastHitRatePct, 0);

    // Diamonds not used in GoodJunk boot engine now
    const nTargetDiamondSpawned = num(summary.nTargetDiamondSpawned, 0);

    const row = {
      // ---- required session meta ----
      timestampIso: isoNow(),
      projectTag: str(summary.projectTag, 'GoodJunkVR'),
      runMode,
      studyId: summary.studyId ?? qs('study', qs('studyId', null)),
      phase: summary.phase ?? qs('phase', null),
      conditionGroup: summary.conditionGroup ?? qs('cond', qs('conditionGroup', null)),
      sessionOrder: summary.sessionOrder ?? qs('sessionOrder', null),
      blockLabel: summary.blockLabel ?? qs('blockLabel', null),
      siteCode: summary.siteCode ?? qs('siteCode', null),
      schoolYear: summary.schoolYear ?? qs('schoolYear', null),
      semester: summary.semester ?? qs('semester', null),

      sessionId: summary.sessionId ?? qs('sessionId', null) ?? summary.seed ?? null, // fallback
      gameMode,
      diff,

      durationPlannedSec: num(summary.durationPlannedSec, num(qs('time', 0), 0)),
      durationPlayedSec: num(summary.durationPlayedSec, 0),

      // ---- outcome ----
      scoreFinal: num(summary.scoreFinal, 0),
      comboMax: num(summary.comboMax, 0),
      misses: num(summary.misses, 0),

      goalsCleared: num(summary.goalsCleared, 0),
      goalsTotal: num(summary.goalsTotal, 0),
      miniCleared: num(summary.miniCleared, 0),
      miniTotal: num(summary.miniTotal, 0),

      // ---- spawn counts ----
      nTargetGoodSpawned: num(summary.nTargetGoodSpawned, 0),
      nTargetJunkSpawned: num(summary.nTargetJunkSpawned, 0),
      nTargetStarSpawned: num(summary.nTargetStarSpawned, 0),
      nTargetDiamondSpawned,
      nTargetShieldSpawned: num(summary.nTargetShieldSpawned, 0),

      // ---- hit/expire ----
      nHitGood,
      nHitJunk,
      nHitJunkGuard,
      nExpireGood,

      // ---- metrics ----
      accuracyGoodPct: Number(accuracyGoodPct.toFixed(2)),
      junkErrorPct: Number(junkErrorPct.toFixed(2)),
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,

      device: str(summary.device ?? detectDevice(), detectDevice()),
      gameVersion: str(summary.gameVersion, qs('ver', qs('v', '')) || 'unknown'),
      reason: str(summary.reason, 'time'),
      startTimeIso: summary.startTimeIso ?? null,
      endTimeIso: summary.endTimeIso ?? isoNow(),

      // ---- profile ----
      studentKey: prof.studentKey,
      schoolCode: prof.schoolCode,
      schoolName: prof.schoolName,
      classRoom: prof.classRoom,
      studentNo: prof.studentNo,
      nickName: prof.nickName,
      gender: prof.gender,
      age: prof.age,
      gradeLevel: prof.gradeLevel,
      heightCm: prof.heightCm,
      weightKg: prof.weightKg,
      bmi: prof.bmi,
      bmiGroup: prof.bmiGroup,
      vrExperience: prof.vrExperience,
      gameFrequency: prof.gameFrequency,
      handedness: prof.handedness,
      visionIssue: prof.visionIssue,
      healthDetail: prof.healthDetail,
      consentParent: prof.consentParent,
    };

    return row;
  }

  // -------- Send --------
  function sendRow(row) {
    if (!ENDPOINT) return;

    const payload = JSON.stringify(row);

    // Prefer sendBeacon (survives pagehide/navigation)
    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
        if (ok) return;
      }
    } catch (_) {}

    // Fallback fetch keepalive
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        mode: 'cors',
      }).catch(()=>{});
    } catch (_) {}
  }

  // -------- Listen only once per end --------
  let sent = false;
  ROOT.addEventListener('hha:end', (ev) => {
    try {
      if (sent) return;
      sent = true;
      const summary = ev && ev.detail ? ev.detail : {};
      const row = buildRowFromSummary(summary);

      // Persist locally too (debug)
      try { localStorage.setItem('HHA_LAST_ROW', JSON.stringify(row)); } catch (_) {}

      sendRow(row);
    } catch (_) {}
  }, { passive: true });

})(window);