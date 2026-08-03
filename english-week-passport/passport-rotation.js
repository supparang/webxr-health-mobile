(function () {
  "use strict";

  const cfg = window.EW_CONFIG || {};
  const VERSION = "2026-08-03-PASSPORT-ROTATION-V1";
  const CACHE_PREFIX = "ew_passport_assignment_v1::";
  const PASSPORTS = Object.freeze(["P1", "P2", "P3", "P4"]);
  const ASSESSMENTS = Object.freeze(["R1", "R2"]);
  const originalMathRandom = Math.random.bind(Math);

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function hash32(value) {
    const input = text(value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function () {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, randomFn) {
    const output = Array.from(values || []);
    const random = randomFn || originalMathRandom;
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function readIdentity() {
    try {
      const key = cfg.cacheKeys?.identity || "ew_passport_identity_v1";
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  }

  function assignmentKey(playerId) {
    return `${CACHE_PREFIX}${text(playerId)}`;
  }

  function validAssignment(value, playerId) {
    return Boolean(
      value &&
      text(value.playerId) === text(playerId) &&
      PASSPORTS.includes(value.passportRotation) &&
      ASSESSMENTS.includes(value.assessmentRotation) &&
      value.assignmentVersion === VERSION &&
      value.assignmentLocked === true
    );
  }

  function deriveAssignment(playerId) {
    const id = text(playerId);
    if (!id) return null;
    const appId = text(cfg.appId || "ENGLISH-WEEK-PASSPORT-2026");
    const passportHash = hash32(`${appId}|${id}|passport|${VERSION}`);
    const assessmentHash = hash32(`${appId}|${id}|assessment|${VERSION}`);
    const passportRotation = PASSPORTS[passportHash % PASSPORTS.length];
    const assessmentRotation = ASSESSMENTS[assessmentHash % ASSESSMENTS.length];
    const randomSeed = hash32(`${appId}|${id}|seed|${VERSION}`);
    return Object.freeze({
      playerId: id,
      passportRotation,
      assessmentRotation,
      preForm: assessmentRotation === "R1" ? "A" : "B",
      postForm: assessmentRotation === "R1" ? "B" : "A",
      randomSeed,
      randomSeedHex: randomSeed.toString(16).padStart(8, "0"),
      assignmentVersion: VERSION,
      assignmentSource: "deterministic-client",
      assignedAt: new Date().toISOString(),
      assignmentLocked: true
    });
  }

  function normalizeServerAssignment(serverValue, playerId) {
    if (!serverValue) return null;
    const passportRotation = text(serverValue.passportRotation || serverValue.passport || serverValue.rotation);
    const assessmentRotation = text(serverValue.assessmentRotation || serverValue.assessment || serverValue.testRotation);
    if (!PASSPORTS.includes(passportRotation) || !ASSESSMENTS.includes(assessmentRotation)) return null;
    const seedValue = Number(serverValue.randomSeed);
    const randomSeed = Number.isFinite(seedValue)
      ? seedValue >>> 0
      : hash32(`${playerId}|${passportRotation}|${assessmentRotation}|server`);
    return Object.freeze({
      playerId: text(playerId),
      passportRotation,
      assessmentRotation,
      preForm: text(serverValue.preForm) || (assessmentRotation === "R1" ? "A" : "B"),
      postForm: text(serverValue.postForm) || (assessmentRotation === "R1" ? "B" : "A"),
      randomSeed,
      randomSeedHex: randomSeed.toString(16).padStart(8, "0"),
      assignmentVersion: text(serverValue.assignmentVersion) || VERSION,
      assignmentSource: "server",
      assignedAt: text(serverValue.assignedAt) || new Date().toISOString(),
      assignmentLocked: true
    });
  }

  function persistAssignment(assignment) {
    if (!assignment?.playerId) return assignment;
    try {
      localStorage.setItem(assignmentKey(assignment.playerId), JSON.stringify(assignment));
    } catch (_) {}
    return assignment;
  }

  function getAssignment(playerId, serverValue) {
    const id = text(playerId || readIdentity()?.playerId);
    if (!id) return null;

    const serverAssignment = normalizeServerAssignment(serverValue, id);
    if (serverAssignment) return persistAssignment(serverAssignment);

    try {
      const cached = JSON.parse(localStorage.getItem(assignmentKey(id)) || "null");
      if (validAssignment(cached, id)) return Object.freeze(cached);
    } catch (_) {}

    return persistAssignment(deriveAssignment(id));
  }

  function stageSeed(stageId, suffix) {
    const assignment = getAssignment();
    const seedBase = assignment?.randomSeed || hash32(`anonymous|${VERSION}`);
    return hash32(`${seedBase}|${assignment?.passportRotation || "P0"}|${text(stageId)}|${text(suffix)}|${VERSION}`);
  }

  function randomFor(stageId, suffix) {
    return mulberry32(stageSeed(stageId, suffix));
  }

  function order(values, stageId, suffix) {
    return shuffle(values, randomFor(stageId, suffix));
  }

  function sample(values, count, stageId, suffix) {
    const limit = Math.max(0, Math.min(Number(count) || 0, (values || []).length));
    return order(values, stageId, suffix).slice(0, limit);
  }

  function levelFromIndex(index) {
    return ["A2", "A2+", "B1", "B1+"][Math.abs(Number(index) || 0) % 4];
  }

  function balancedSample(values, count, stageId, levelGetter) {
    const source = Array.from(values || []);
    const groups = new Map([["A2", []], ["A2+", []], ["B1", []], ["B1+", []]);
    source.forEach((item, index) => {
      const level = text(levelGetter ? levelGetter(item, index) : item?.level) || levelFromIndex(index);
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push(item);
    });

    const random = randomFor(stageId, "balanced");
    groups.forEach((items, key) => groups.set(key, shuffle(items, random)));
    const result = [];
    const levels = ["A2", "A2+", "B1", "B1+"];
    let cursor = 0;
    while (result.length < Math.min(count, source.length)) {
      const level = levels[cursor % levels.length];
      const group = groups.get(level) || [];
      if (group.length) result.push(group.shift());
      else {
        const fallback = levels.map(name => groups.get(name) || []).find(list => list.length);
        if (!fallback) break;
        result.push(fallback.shift());
      }
      cursor += 1;
    }
    return shuffle(result, randomFor(stageId, "balanced-order"));
  }

  function withStageRandom(stageId, callback) {
    const previous = Math.random;
    Math.random = randomFor(stageId, "math");
    try {
      return callback();
    } finally {
      Math.random = previous;
    }
  }

  function installStageRandom(stageId) {
    const random = randomFor(stageId, "runtime");
    Math.random = random;
    window.addEventListener("pagehide", () => { Math.random = originalMathRandom; }, { once:true });
    return random;
  }

  function actualForm(assessmentType) {
    const assignment = getAssignment();
    return assessmentType === "post" ? assignment?.postForm || "B" : assignment?.preForm || "A";
  }

  function decoratePayload(payload, stageId) {
    const assignment = getAssignment(payload?.playerId);
    const stage = text(stageId || payload?.stageId || payload?.assessmentType || "unknown");
    return {
      ...(payload || {}),
      passportRotation: assignment?.passportRotation || "P0",
      assessmentRotation: assignment?.assessmentRotation || "R0",
      randomSeed: assignment?.randomSeed || 0,
      randomSeedHex: assignment?.randomSeedHex || "00000000",
      assignmentVersion: assignment?.assignmentVersion || VERSION,
      assignmentLocked: Boolean(assignment?.assignmentLocked),
      assignedPreForm: assignment?.preForm || "A",
      assignedPostForm: assignment?.postForm || "B",
      stageSeed: stageSeed(stage, "payload"),
      stageAssignmentId: `${assignment?.playerId || "anonymous"}|${stage}|${assignment?.passportRotation || "P0"}|${VERSION}`
    };
  }

  function bindObjectFunctions(source) {
    const output = {};
    Object.keys(source || {}).forEach(key => {
      const value = source[key];
      output[key] = typeof value === "function" ? value.bind(source) : value;
    });
    return output;
  }

  function wrapWordBank() {
    const source = window.EW_WORD_BANK;
    if (!source || source.__rotationWrapped) return;
    const base = bindObjectFunctions(source);

    const wrapped = {
      ...base,
      __rotationWrapped: true,
      questionsForZone(zone, count) {
        const pool = (source.items || []).filter(item => item.zone === zone).map(item => ({ ...item, options:[...item.options] }));
        const selected = balancedSample(pool, Math.min(Number(count) || 10, pool.length), `zone:${zone}`);
        return selected.map(item => ({
          ...item,
          options: order(item.options, `zone:${zone}`, `options:${item.id}`)
        }));
      },
      assessment(requestedForm) {
        const type = requestedForm === "B" ? "post" : "pre";
        const form = actualForm(type);
        return withStageRandom(`assessment:${type}:${form}`, () => source.assessment(form));
      },
      finalBoss(count) {
        const pool = (source.items || []).map(item => ({ ...item, options:[...item.options] }));
        const selected = balancedSample(pool, Math.min(Number(count) || 20, pool.length), "final_boss");
        return selected.map(item => ({
          ...item,
          options: order(item.options, "final_boss", `options:${item.id}`)
        }));
      }
    };
    window.EW_WORD_BANK = Object.freeze(wrapped);
  }

  function findServerAssignment(response) {
    return response?.assignment || response?.authority?.assignment || response?.profile?.assignment || response?.authority?.profile?.assignment || null;
  }

  function wrapAuthority() {
    const source = window.EW_AUTHORITY;
    if (!source || source.__rotationWrapped) return;
    const base = bindObjectFunctions(source);
    const wrapped = { ...base, __rotationWrapped:true };

    if (typeof source.resume === "function") {
      wrapped.resume = async function (...args) {
        const response = await source.resume(...args);
        const playerId = args[0] || response?.profile?.playerId || response?.authority?.profile?.playerId;
        const assignment = getAssignment(playerId, findServerAssignment(response));
        return response && typeof response === "object" ? { ...response, assignment } : response;
      };
    }

    if (typeof source.submitAssessment === "function") {
      wrapped.submitAssessment = function (payload) {
        const type = payload?.assessmentType === "post" ? "post" : "pre";
        const decorated = decoratePayload({
          ...(payload || {}),
          formId: actualForm(type)
        }, `assessment:${type}`);
        return source.submitAssessment(decorated);
      };
    }

    if (typeof source.submitGame === "function") {
      wrapped.submitGame = function (payload) {
        return source.submitGame(decoratePayload(payload, payload?.stageId));
      };
    }

    window.EW_AUTHORITY = Object.freeze(wrapped);
  }

  function renderBadge() {
    const identity = readIdentity();
    if (!identity?.playerId) return;
    const assignment = getAssignment(identity.playerId);
    const host = document.querySelector(".brand-lockup > div, .adl-brand, .memory-top .title, .ar-brand, .top .title");
    if (!host || host.querySelector(".ew-rotation-badge")) return;
    const badge = document.createElement("small");
    badge.className = "ew-rotation-badge";
    badge.textContent = `${assignment.passportRotation} • ${assignment.assessmentRotation} • A2–B1+`;
    badge.title = `Pre ${assignment.preForm} → Post ${assignment.postForm} • Seed ${assignment.randomSeedHex}`;
    host.appendChild(badge);
  }

  const style = document.createElement("style");
  style.textContent = ".ew-rotation-badge{display:inline-flex!important;width:max-content;margin-top:3px;padding:2px 7px;border-radius:999px;background:rgba(37,99,235,.10);color:#1d4ed8;font-size:.68rem!important;font-weight:900;letter-spacing:.02em}";
  document.head.appendChild(style);

  window.EW_ROTATION = Object.freeze({
    VERSION,
    PASSPORTS,
    ASSESSMENTS,
    hash32,
    mulberry32,
    shuffle,
    getAssignment,
    stageSeed,
    randomFor,
    order,
    sample,
    balancedSample,
    withStageRandom,
    installStageRandom,
    actualForm,
    decoratePayload
  });

  wrapWordBank();
  wrapAuthority();
  new MutationObserver(renderBadge).observe(document.documentElement, { childList:true, subtree:true });
  renderBadge();
}());