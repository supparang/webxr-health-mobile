// === /herohealth/gate/gate-logger.js ===
// PATCH v20260313b-GATE-LOGGER-PUSH-FIX

export function createGateLogger(ctx = {}) {
  const rows = [];

  function push(type, payload = {}) {
    const row = {
      ts: Date.now(),
      type: String(type || 'event'),
      phase: ctx.phase || ctx.mode || '',
      mode: ctx.mode || ctx.phase || '',
      cat: ctx.cat || '',
      game: ctx.game || '',
      pid: ctx.pid || 'anon',
      run: ctx.run || 'play',
      ...payload
    };
    rows.push(row);
    try { console.log('[gate-log]', row); } catch {}
    return row;
  }

  function list() {
    return rows.slice();
  }

  function flush() {
    return rows.slice();
  }

  return {
    push,
    list,
    flush
  };
}