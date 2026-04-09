// /herohealth/vr-groups/groups.log.js
// Groups Logger
// PATCH v20260409-groups-log-raceaware-r1

export const GROUPS_PATCH_LOG = 'v20260409-groups-log-raceaware-r1';

const LOG_BUFFER_KEY = 'HHA_GROUPS_LAST_LOG';

export function createGroupsLogger(ctx, options = {}){
  const patch = options.patch || GROUPS_PATCH_LOG;
  const maxLogs = Number.isFinite(options.maxLogs) ? options.maxLogs : 300;

  let seq = 0;
  const logs = [];

  function event(type, detail = {}, live = {}){
    seq += 1;
    const entry = {
      event_id: `${ctx.game || 'groups'}-${Date.now()}-${seq}`,
      event_seq: seq,
      ts_ms: Date.now(),
      ts_iso: new Date().toISOString(),
      pid: ctx.pid || 'anon',
      game: ctx.game || 'groups',
      zone: ctx.zone || 'nutrition',
      mode: ctx.mode || 'solo',
      run: ctx.run || 'play',
      difficulty: ctx.diff || 'normal',
      view_mode: ctx.view || 'mobile',
      seed: ctx.seed || '',
      study_id: ctx.studyId || '',
      roomCode: ctx.roomCode || '',
      isHost: !!ctx.isHost,
      hostUid: ctx.hostUid || '',
      playerCount: Number(ctx.playerCount || 1),
      patch,
      event_type: type,
      ...live,
      ...detail
    };

    logs.push(entry);
    if (logs.length > maxLogs) logs.splice(0, logs.length - maxLogs);
    return entry;
  }

  function getLogs(){
    return logs.slice();
  }

  function flush(extra = {}){
    const payload = {
      patch,
      flushed_at_ms: Date.now(),
      flushed_at_iso: new Date().toISOString(),
      ctx,
      logs: logs.slice(),
      ...extra
    };

    try{
      localStorage.setItem(LOG_BUFFER_KEY, JSON.stringify(payload));
    }catch{}

    return payload;
  }

  function clear(){
    logs.length = 0;
    seq = 0;
  }

  return {
    event,
    getLogs,
    flush,
    clear
  };
}