(function () {
  "use strict";

  const cfg = window.EW_CONFIG || {};
  const VERSION = "2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT";
  const CACHE_PREFIX = "ew_passport_assignment_v2::";
  const PASSPORTS = Object.freeze(["P1", "P2", "P3", "P4"]);
  const ASSESSMENTS = Object.freeze(["R1", "R2"]);
  const nativeRandom = Math.random.bind(Math);

  const clean = value => String(value == null ? "" : value).trim();

  function hash32(value) {
    const input = clean(value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function mix32(value) {
    let x = Number(value) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }

  function mulberry32(seed) {
    let state = Number(seed) >>> 0;
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
    const random = randomFn || nativeRandom;
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function identity() {
    try {
      return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity || "ew_passport_identity_v1") || "null");
    } catch (_) {
      return null;
    }
  }

  function cacheKey(playerId) {
    return `${CACHE_PREFIX}${clean(playerId)}`;
  }

  function normalizeServerAssignment(value, playerId) {
    if (!value) return null;
    const passportRotation = clean(value.passportRotation || value.passport || value.rotation);
    const assessmentRotation = clean(value.assessmentRotation || value.assessment || value.testRotation);
    if (!PASSPORTS.includes(passportRotation) || !ASSESSMENTS.includes(assessmentRotation)) return null;
    const suppliedSeed = Number(value.randomSeed);
    const randomSeed = Number.isFinite(suppliedSeed)
      ? suppliedSeed >>> 0
      : mix32(hash32(`${playerId}|${passportRotation}|${assessmentRotation}|server`));
    return Object.freeze({
      playerId:clean(playerId),
      passportRotation,
      assessmentRotation,
      preForm:clean(value.preForm) || (assessmentRotation === "R1" ? "A" : "B"),
      postForm:clean(value.postForm) || (assessmentRotation === "R1" ? "B" : "A"),
      randomSeed,
      randomSeedHex:randomSeed.toString(16).padStart(8, "0"),
      assignmentVersion:clean(value.assignmentVersion) || VERSION,
      assignmentSource:"server",
      assignedAt:clean(value.assignedAt) || new Date().toISOString(),
      assignmentLocked:true
    });
  }

  function derive(playerId) {
    const id = clean(playerId);
    if (!id) return null;
    const appId = clean(cfg.appId || "ENGLISH-WEEK-PASSPORT-2026");
    const passportHash = mix32(hash32(`${appId}|${id}|passport|${VERSION}`));
    const reversedId = Array.from(id).reverse().join("");
    const assessmentHash = mix32(hash32(`assessment|${reversedId}|${VERSION}|${appId}`));
    const passportRotation = PASSPORTS[passportHash % 4];
    const assessmentRotation = ASSESSMENTS[(assessmentHash >>> 16) % 2];
    const randomSeed = mix32(hash32(`${VERSION}|seed|${id}|${appId}`));
    return Object.freeze({
      playerId:id,
      passportRotation,
      assessmentRotation,
      preForm:assessmentRotation === "R1" ? "A" : "B",
      postForm:assessmentRotation === "R1" ? "B" : "A",
      randomSeed,
      randomSeedHex:randomSeed.toString(16).padStart(8, "0"),
      assignmentVersion:VERSION,
      assignmentSource:"deterministic-client",
      assignedAt:new Date().toISOString(),
      assignmentLocked:true
    });
  }

  function valid(value, playerId) {
    return Boolean(value && clean(value.playerId) === clean(playerId) && PASSPORTS.includes(value.passportRotation) && ASSESSMENTS.includes(value.assessmentRotation) && value.assignmentVersion === VERSION && value.assignmentLocked === true);
  }

  function persist(value) {
    if (!value?.playerId) return value;
    try { localStorage.setItem(cacheKey(value.playerId), JSON.stringify(value)); } catch (_) {}
    return value;
  }

  function getAssignment(playerId, serverValue) {
    const id = clean(playerId || identity()?.playerId);
    if (!id) return null;
    const server = normalizeServerAssignment(serverValue, id);
    if (server) return persist(server);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
      if (valid(cached, id)) return Object.freeze(cached);
    } catch (_) {}
    return persist(derive(id));
  }

  function stageSeed(stageId, suffix) {
    const assignment = getAssignment();
    return mix32(hash32(`${assignment?.randomSeed || 0}|${assignment?.passportRotation || "P0"}|${clean(stageId)}|${clean(suffix)}|${VERSION}`));
  }

  const randomFor = (stageId, suffix) => mulberry32(stageSeed(stageId, suffix));
  const order = (values, stageId, suffix) => shuffle(values, randomFor(stageId, suffix));
  const sample = (values, count, stageId, suffix) => order(values, stageId, suffix).slice(0, Math.min(Math.max(Number(count) || 0, 0), (values || []).length));

  function balancedSample(values, count, stageId, levelGetter) {
    const source = Array.from(values || []);
    const levels = ["A2", "A2+", "B1", "B1+"];
    const groups = Object.fromEntries(levels.map(level => [level, []]));
    source.forEach((item, index) => {
      const level = clean(levelGetter ? levelGetter(item, index) : item?.level) || levels[index % 4];
      (groups[level] || groups[levels[index % 4]]).push(item);
    });
    levels.forEach(level => { groups[level] = shuffle(groups[level], randomFor(stageId, `pool:${level}`)); });
    const selected = [];
    let cursor = 0;
    const limit = Math.min(Number(count) || 0, source.length);
    while (selected.length < limit) {
      const level = levels[cursor % levels.length];
      const item = groups[level].shift();
      if (item) selected.push(item);
      else {
        const fallbackLevel = levels.find(name => groups[name].length);
        if (!fallbackLevel) break;
        selected.push(groups[fallbackLevel].shift());
      }
      cursor += 1;
    }
    return shuffle(selected, randomFor(stageId, "selected-order"));
  }

  function withStageRandom(stageId, callback) {
    const previous = Math.random;
    Math.random = randomFor(stageId, "temporary");
    try { return callback(); }
    finally { Math.random = previous; }
  }

  function installStageRandom(stageId) {
    Math.random = randomFor(stageId, "runtime");
    window.addEventListener("pagehide", () => { Math.random = nativeRandom; }, {once:true});
  }

  function actualForm(type) {
    const assignment = getAssignment();
    return type === "post" ? assignment?.postForm || "B" : assignment?.preForm || "A";
  }

  function decoratePayload(payload, stageId) {
    const assignment = getAssignment(payload?.playerId);
    const stage = clean(stageId || payload?.stageId || payload?.assessmentType || "unknown");
    return {
      ...(payload || {}),
      passportRotation:assignment?.passportRotation || "P0",
      assessmentRotation:assignment?.assessmentRotation || "R0",
      randomSeed:assignment?.randomSeed || 0,
      randomSeedHex:assignment?.randomSeedHex || "00000000",
      assignmentVersion:assignment?.assignmentVersion || VERSION,
      assignmentLocked:Boolean(assignment?.assignmentLocked),
      assignedPreForm:assignment?.preForm || "A",
      assignedPostForm:assignment?.postForm || "B",
      stageSeed:stageSeed(stage, "payload"),
      stageAssignmentId:`${assignment?.playerId || "anonymous"}|${stage}|${assignment?.passportRotation || "P0"}|${VERSION}`
    };
  }

  function boundCopy(source) {
    const result = {};
    Object.keys(source || {}).forEach(key => {
      result[key] = typeof source[key] === "function" ? source[key].bind(source) : source[key];
    });
    return result;
  }

  function wrapWordBank() {
    const source = window.EW_WORD_BANK;
    if (!source || source.__rotationWrappedV2) return;
    const wrapped = {
      ...boundCopy(source),
      __rotationWrappedV2:true,
      questionsForZone(zone, count) {
        const pool = (source.items || []).filter(item => item.zone === zone).map(item => ({...item,options:[...item.options]}));
        return balancedSample(pool, Math.min(Number(count) || 10, pool.length), `zone:${zone}`).map(item => ({...item,options:order(item.options, `zone:${zone}`, `options:${item.id}`)}));
      },
      assessment(requestedForm) {
        const type = requestedForm === "B" ? "post" : "pre";
        const form = actualForm(type);
        return withStageRandom(`assessment:${type}:${form}`, () => source.assessment(form));
      },
      finalBoss(count) {
        const pool = (source.items || []).map(item => ({...item,options:[...item.options]}));
        return balancedSample(pool, Math.min(Number(count) || 20, pool.length), "final_boss").map(item => ({...item,options:order(item.options, "final_boss", `options:${item.id}`)}));
      }
    };
    window.EW_WORD_BANK = Object.freeze(wrapped);
  }

  function serverAssignment(response) {
    return response?.assignment || response?.authority?.assignment || response?.profile?.assignment || response?.authority?.profile?.assignment || null;
  }

  function wrapAuthority() {
    const source = window.EW_AUTHORITY;
    if (!source || source.__rotationWrappedV2) return;
    const wrapped = {...boundCopy(source),__rotationWrappedV2:true};
    if (typeof source.resume === "function") {
      wrapped.resume = async function (...args) {
        const response = await source.resume(...args);
        const playerId = args[0] || response?.profile?.playerId || response?.authority?.profile?.playerId;
        const assignment = getAssignment(playerId, serverAssignment(response));
        return response && typeof response === "object" ? {...response,assignment} : response;
      };
    }
    if (typeof source.submitAssessment === "function") {
      wrapped.submitAssessment = function (payload) {
        const type = payload?.assessmentType === "post" ? "post" : "pre";
        return source.submitAssessment(decoratePayload({...payload,formId:actualForm(type)}, `assessment:${type}`));
      };
    }
    if (typeof source.submitGame === "function") {
      wrapped.submitGame = payload => source.submitGame(decoratePayload(payload, payload?.stageId));
    }
    window.EW_AUTHORITY = Object.freeze(wrapped);
  }

  function badge() {
    const player = identity();
    if (!player?.playerId) return;
    const assignment = getAssignment(player.playerId);
    const host = document.querySelector(".brand-lockup > div,.adl-brand,.memory-top .title,.ar-brand,.top .title");
    if (!host || host.querySelector(".ew-rotation-badge")) return;
    const element = document.createElement("small");
    element.className = "ew-rotation-badge";
    element.textContent = `${assignment.passportRotation} • ${assignment.assessmentRotation} • A2–B1+`;
    element.title = `Pre ${assignment.preForm} → Post ${assignment.postForm} • Seed ${assignment.randomSeedHex}`;
    host.appendChild(element);
  }

  const style = document.createElement("style");
  style.textContent = ".ew-rotation-badge{display:inline-flex!important;width:max-content;margin-top:3px;padding:2px 7px;border-radius:999px;background:rgba(37,99,235,.10);color:#1d4ed8;font-size:.68rem!important;font-weight:900;letter-spacing:.02em}";
  document.head.appendChild(style);

  window.EW_ROTATION = Object.freeze({VERSION,PASSPORTS,ASSESSMENTS,hash32,mix32,mulberry32,shuffle,getAssignment,stageSeed,randomFor,order,sample,balancedSample,withStageRandom,installStageRandom,actualForm,decoratePayload});
  wrapWordBank();
  wrapAuthority();
  new MutationObserver(badge).observe(document.documentElement,{childList:true,subtree:true});
  badge();
}());