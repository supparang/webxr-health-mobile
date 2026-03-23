// === /goodjunk-intervention/research/flow-bridge.js ===
// Cross-page flow bridge for GoodJunk Intervention
// PATCH v20260323a-GJI-FLOW-BRIDGE

const GJI_CTX_KEY = 'GJI_CTX';
const FLOW_STATUS_PREFIX = 'GJI_FLOW_STATUS__';
const FLOW_HISTORY_PREFIX = 'GJI_FLOW_HISTORY__';
const FLOW_COMPLETION_PREFIX = 'GJI_FLOW_COMPLETION__';
const FLOW_HEARTBEAT_MS = 1500;

function safeParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePid(rawPid) {
  const v = String(rawPid || '').trim().replace(/[.#$[\]/]/g, '-');
  return v || 'anon';
}

function readStoredCtx() {
  return safeParse(localStorage.getItem(GJI_CTX_KEY), {}) || {};
}

export function mergeFlowCtxFromSources(queryCtx = {}) {
  const qs = Object.fromEntries(new URLSearchParams(location.search).entries());
  const stored = readStoredCtx();

  const merged = {
    ...stored,
    ...qs,
    ...queryCtx
  };

  merged.pid = normalizePid(
    merged.pid ||
    merged.studentKey ||
    ''
  );

  merged.studentKey = merged.studentKey || merged.pid || '';
  merged.name = merged.name || merged.nickName || merged.studentKey || merged.pid || '';
  merged.nickName = merged.nickName || merged.name || '';
  merged.studyId = merged.studyId || '';
  merged.sessionId = merged.sessionId || merged.session || '';
  merged.session = merged.session || merged.sessionId || '';
  merged.conditionGroup = merged.conditionGroup || merged.condition || '';
  merged.condition = merged.condition || merged.conditionGroup || '';
  merged.classRoom = merged.classRoom || merged.classroom || '';
  merged.classroom = merged.classroom || merged.classRoom || '';
  merged.schoolName = merged.schoolName || merged.school || '';
  merged.school = merged.school || merged.schoolName || '';
  merged.group = merged.group || merged.classRoom || merged.classroom || merged.conditionGroup || '';
  merged.role = String(merged.role || 'student').toLowerCase();
  merged.phase = String(merged.phase || '').toLowerCase();
  merged.run = merged.run || 'play';
  merged.mode = merged.mode || merged.run || 'play';
  merged.lang = merged.lang || 'th';
  merged.hub = merged.hub || '../../hub.html';
  merged.gameId = merged.gameId || 'goodjunk';

  return merged;
}

export function appendFlowParams(url, ctx = {}) {
  const u = new URL(url, location.href);
  const map = {
    pid: ctx.pid,
    name: ctx.name,
    studentKey: ctx.studentKey,
    nickName: ctx.nickName,
    studyId: ctx.studyId,
    group: ctx.group,
    condition: ctx.condition,
    conditionGroup: ctx.conditionGroup,
    session: ctx.session,
    sessionId: ctx.sessionId,
    lang: ctx.lang,
    mode: ctx.mode,
    diff: ctx.diff,
    view: ctx.view,
    time: ctx.time,
    run: ctx.run,
    hub: ctx.hub,
    classRoom: ctx.classRoom,
    classroom: ctx.classroom,
    schoolName: ctx.schoolName,
    school: ctx.school,
    gameId: ctx.gameId,
    phase: ctx.phase,
    role: ctx.role,
    autonext: ctx.autonext,
    autodelay: ctx.autodelay,
    bulk: ctx.bulk,
    flowStatusKey: ctx.flowStatusKey
  };

  Object.entries(map).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '') {
      u.searchParams.set(k, String(v));
    }
  });

  return u.toString();
}

function buildScope(ctx) {
  return [
    ctx.studyId || 'nostudy',
    ctx.sessionId || ctx.session || 'nosession',
    ctx.pid || 'nopid'
  ].join('__');
}

function buildKeys(ctx) {
  const scope = buildScope(ctx);
  return {
    scope,
    statusKey: `${FLOW_STATUS_PREFIX}${scope}`,
    historyKey: `${FLOW_HISTORY_PREFIX}${scope}`,
    completionKey: `${FLOW_COMPLETION_PREFIX}${scope}`
  };
}

function buildRemoteRoots(ctx) {
  return {
    statusRoot: [
      'hha-intervention',
      'goodjunk',
      'flow-status',
      ctx.studyId || 'nostudy',
      ctx.sessionId || ctx.session || 'nosession',
      ctx.pid || 'nopid'
    ].join('/'),
    eventsRoot: [
      'hha-intervention',
      'goodjunk',
      'flow-events',
      ctx.studyId || 'nostudy',
      ctx.sessionId || ctx.session || 'nosession',
      ctx.pid || 'nopid'
    ].join('/')
  };
}

function getServerTimestampValue() {
  try {
    return window.HHA_FIREBASE?.database?.ServerValue?.TIMESTAMP ?? Date.now();
  } catch {
    return Date.now();
  }
}

function waitForFirebaseReady(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (window.HHA_FIREBASE_READY && window.HHA_FIREBASE_DB) {
      resolve(true);
      return;
    }

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(!!ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    window.addEventListener('hha:firebase_ready', (ev) => {
      clearTimeout(timer);
      finish(!!ev?.detail?.ok && !!window.HHA_FIREBASE_DB);
    }, { once: true });
  });
}

function buildBasePayload(state, extra = {}) {
  const ctx = state.ctx;
  const flowStep = extra.flowStep || state.flowStep || 'loading';

  return {
    version: '20260323a-gji-cross-page-flow',
    updatedAt: nowIso(),
    updatedAtMs: Date.now(),

    pageId: state.pageId,
    pagePath: location.pathname,
    pageSearch: location.search,
    pageTitle: document.title || '',

    studyId: ctx.studyId || '',
    sessionId: ctx.sessionId || ctx.session || '',
    session: ctx.session || ctx.sessionId || '',
    pid: ctx.pid || '',
    studentKey: ctx.studentKey || ctx.pid || '',
    name: ctx.name || '',
    nickName: ctx.nickName || ctx.name || '',

    role: ctx.role || 'student',
    phase: ctx.phase || '',
    run: ctx.run || 'play',
    mode: ctx.mode || ctx.run || 'play',
    diff: ctx.diff || '',
    view: ctx.view || '',

    group: ctx.group || '',
    condition: ctx.condition || '',
    conditionGroup: ctx.conditionGroup || '',
    classRoom: ctx.classRoom || '',
    classroom: ctx.classroom || '',
    schoolName: ctx.schoolName || '',
    school: ctx.school || '',

    flowStep,
    nextKey: extra.nextKey || '',
    nextLabel: extra.nextLabel || '',
    nextPath: extra.nextPath || '',

    visible: document.visibilityState === 'visible',
    completed: !!extra.completed,
    completionReason: extra.completionReason || '',

    score: Number(extra.score || 0),
    miss: Number(extra.miss || 0),
    accuracyPct: Number(extra.accuracyPct || 0),

    heartbeat: !!extra.heartbeat,
    heartbeatAt: extra.heartbeatAt || '',
    heartbeatAtMs: Number(extra.heartbeatAtMs || 0),

    redirectTrigger: extra.redirectTrigger || '',
    redirectTarget: extra.redirectTarget || '',

    ...extra
  };
}

export function initFlowBridge({
  pageId,
  queryCtx = {},
  defaultStep = 'loading',
  staticFields = {}
} = {}) {
  const ctx = mergeFlowCtxFromSources(queryCtx);
  const keys = buildKeys(ctx);
  const remote = buildRemoteRoots(ctx);

  const state = {
    pageId: pageId || 'unknown-page',
    ctx,
    keys,
    remote,
    flowStep: defaultStep,
    staticFields,
    localTimer: 0,
    remoteTimer: 0,
    remoteReady: false,
    remoteStatusRef: null,
    remoteEventsRef: null,
    lastRemoteSig: '',
    stopped: false
  };

  function saveCtx() {
    try {
      localStorage.setItem(GJI_CTX_KEY, JSON.stringify({
        ...readStoredCtx(),
        ...ctx,
        flowStatusKey: keys.statusKey,
        flowHistoryKey: keys.historyKey,
        flowCompletionKey: keys.completionKey
      }));
    } catch {}
  }

  function persistLocal(payload, completion = false) {
    try {
      localStorage.setItem(keys.statusKey, JSON.stringify(payload));
    } catch {}

    try {
      const hist = safeParse(localStorage.getItem(keys.historyKey), []);
      const next = Array.isArray(hist) ? hist : [];
      next.unshift(payload);
      localStorage.setItem(keys.historyKey, JSON.stringify(next.slice(0, 100)));
    } catch {}

    if (completion) {
      try {
        localStorage.setItem(keys.completionKey, JSON.stringify(payload));
      } catch {}
    }
  }

  function remoteSig(payload) {
    return JSON.stringify({
      pageId: payload.pageId,
      flowStep: payload.flowStep,
      nextKey: payload.nextKey,
      nextLabel: payload.nextLabel,
      nextPath: payload.nextPath,
      completed: payload.completed,
      completionReason: payload.completionReason,
      redirectTrigger: payload.redirectTrigger,
      redirectTarget: payload.redirectTarget,
      score: payload.score,
      miss: payload.miss,
      accuracyPct: payload.accuracyPct,
      visible: payload.visible
    });
  }

  async function ensureRemote() {
    if (state.remoteReady && state.remoteStatusRef && state.remoteEventsRef) return true;

    const ok = await waitForFirebaseReady(12000);
    if (!ok || !window.HHA_FIREBASE_DB) return false;

    try {
      state.remoteStatusRef = window.HHA_FIREBASE_DB.ref(remote.statusRoot);
      state.remoteEventsRef = window.HHA_FIREBASE_DB.ref(remote.eventsRoot);
      state.remoteReady = true;
      return true;
    } catch (err) {
      console.warn('[flow-bridge] ensureRemote failed:', err);
      state.remoteReady = false;
      state.remoteStatusRef = null;
      state.remoteEventsRef = null;
      return false;
    }
  }

  async function syncRemote(payload, force = false) {
    const ok = await ensureRemote();
    if (!ok || !state.remoteStatusRef) return false;

    const merged = {
      ...payload,
      remoteUpdatedAt: Date.now(),
      remoteServerAt: getServerTimestampValue(),
      origin: location.origin,
      href: location.href
    };

    const sig = remoteSig(merged);
    if (!force && sig === state.lastRemoteSig) return true;

    try {
      await state.remoteStatusRef.update(merged);
      state.lastRemoteSig = sig;
      return true;
    } catch (err) {
      console.warn('[flow-bridge] syncRemote failed:', err);
      return false;
    }
  }

  async function pushRemoteEvent(type, extra = {}) {
    const ok = await ensureRemote();
    if (!ok || !state.remoteEventsRef) return false;

    try {
      await state.remoteEventsRef.push({
        type,
        at: nowIso(),
        atMs: Date.now(),
        serverAt: getServerTimestampValue(),
        pageId: state.pageId,
        studyId: ctx.studyId || '',
        sessionId: ctx.sessionId || ctx.session || '',
        pid: ctx.pid || '',
        name: ctx.name || '',
        role: ctx.role || 'student',
        phase: ctx.phase || '',
        ...extra
      });
      return true;
    } catch (err) {
      console.warn('[flow-bridge] pushRemoteEvent failed:', err);
      return false;
    }
  }

  async function setupOnDisconnect() {
    const ok = await ensureRemote();
    if (!ok || !state.remoteStatusRef) return;

    try {
      await state.remoteStatusRef.onDisconnect().update({
        visible: false,
        disconnected: true,
        disconnectReason: 'page-unload',
        disconnectedAt: nowIso(),
        disconnectedAtMs: Date.now(),
        remoteServerAt: getServerTimestampValue(),
        remoteUpdatedAt: Date.now()
      });
    } catch (err) {
      console.warn('[flow-bridge] setupOnDisconnect failed:', err);
    }
  }

  function persist(extra = {}, completion = false, forceRemote = false) {
    const payload = buildBasePayload(state, {
      ...state.staticFields,
      ...extra
    });

    persistLocal(payload, completion);

    try {
      window.dispatchEvent(new CustomEvent('gji:flow-status', { detail: payload }));
    } catch {}

    syncRemote(payload, forceRemote).catch(() => {});
    return payload;
  }

  function setStep(step, extra = {}) {
    state.flowStep = step || state.flowStep;
    return persist({ flowStep: state.flowStep, ...extra });
  }

  function complete(reason = 'done', extra = {}) {
    state.flowStep = 'done';
    const payload = persist({
      flowStep: 'done',
      completed: true,
      completedAt: nowIso(),
      completedAtMs: Date.now(),
      completionReason: reason,
      ...extra
    }, true, true);

    pushRemoteEvent('flow-complete', {
      completionReason: reason,
      nextPath: extra.nextPath || '',
      nextLabel: extra.nextLabel || ''
    }).catch(() => {});

    return payload;
  }

  function noteRedirect(trigger = 'manual', target = '', extra = {}) {
    return setStep('redirecting', {
      redirectTrigger: trigger,
      redirectTarget: target,
      redirectStartedAt: nowIso(),
      ...extra
    });
  }

  function stop() {
    state.stopped = true;

    if (state.localTimer) {
      clearInterval(state.localTimer);
      state.localTimer = 0;
    }

    if (state.remoteTimer) {
      clearInterval(state.remoteTimer);
      state.remoteTimer = 0;
    }
  }

  async function start() {
    saveCtx();
    persist({
      flowStep: defaultStep,
      pageReady: true,
      pageReadyAt: nowIso()
    }, false, true);

    pushRemoteEvent('page-ready', {
      defaultStep
    }).catch(() => {});

    state.localTimer = setInterval(() => {
      if (state.stopped) return;
      persist({
        flowStep: state.flowStep,
        heartbeat: true,
        heartbeatAt: nowIso(),
        heartbeatAtMs: Date.now()
      });
    }, FLOW_HEARTBEAT_MS);

    const ok = await ensureRemote();
    if (ok) {
      await setupOnDisconnect();

      state.remoteTimer = setInterval(() => {
        if (state.stopped) return;
        syncRemote(buildBasePayload(state, {
          heartbeat: true,
          heartbeatAt: nowIso(),
          heartbeatAtMs: Date.now()
        }), true).catch(() => {});
      }, FLOW_HEARTBEAT_MS);
    }
  }

  window.addEventListener('visibilitychange', () => {
    persist({
      flowStep: state.flowStep,
      visible: document.visibilityState === 'visible',
      visibilityChangedAt: nowIso()
    });
  });

  window.addEventListener('beforeunload', () => {
    try {
      stop();
      persist({
        flowStep: state.flowStep,
        unloading: true,
        unloadingAt: nowIso(),
        visible: false
      }, false, true);
    } catch {}
  });

  return {
    ctx,
    keys,
    start,
    stop,
    persist,
    setStep,
    complete,
    noteRedirect,
    pushEvent: pushRemoteEvent,
    buildUrl: (url, extraCtx = {}) => appendFlowParams(url, { ...ctx, ...extraCtx }),
    getSnapshot: () => safeParse(localStorage.getItem(keys.statusKey), null)
  };
}