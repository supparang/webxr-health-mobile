// /herohealth/vr-groups/groups.log.js
// Groups Solo Logger
// PATCH v20260405-groups-log-r1

export const GROUPS_PATCH_LOG = 'v20260405-groups-log-r1';

const STORAGE_KEY = 'HHA_GROUPS_LAST_LOG';

export function createGroupsLogger(ctx = {}, options = {}){
  const patch = options.patch || GROUPS_PATCH_LOG;
  const maxLogs = Math.max(50, Number(options.maxLogs || 300));

  const state = {
    events: [],
    sessionStartedAt: Date.now()
  };

  function event(type, detail = {}, runtime = {}){
    const payload = {
      ts: Date.now(),
      type: String(type || 'unknown'),
      patch,
      pid: ctx.pid || 'anon',
      name: ctx.name || '',
      game: ctx.game || 'groups',
      gameId: ctx.gameId || 'groups',
      mode: ctx.mode || 'solo',
      zone: ctx.zone || 'nutrition',
      run: ctx.run || 'play',
      diff: ctx.diff || 'normal',
      view: ctx.view || 'mobile',
      seed: ctx.seed || '',
      detail: safeClone(detail),
      runtime: safeClone(runtime)
    };

    state.events.push(payload);

    if (state.events.length > maxLogs){
      state.events.splice(0, state.events.length - maxLogs);
    }

    return payload;
  }

  function flush(extra = {}){
    const payload = {
      patch,
      ts: Date.now(),
      sessionStartedAt: state.sessionStartedAt,
      sessionEndedAt: Date.now(),
      ctx: {
        pid: ctx.pid || 'anon',
        name: ctx.name || '',
        studyId: ctx.studyId || '',
        diff: ctx.diff || 'normal',
        run: ctx.run || 'play',
        view: ctx.view || 'mobile',
        mode: ctx.mode || 'solo',
        game: ctx.game || 'groups',
        gameId: ctx.gameId || 'groups',
        zone: ctx.zone || 'nutrition',
        seed: ctx.seed || ''
      },
      events: state.events.slice(),
      extra: safeClone(extra)
    };

    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }catch{}

    return payload;
  }

  return {
    event,
    flush
  };
}

function safeClone(v){
  try{
    return JSON.parse(JSON.stringify(v ?? {}));
  }catch{
    return {};
  }
}
