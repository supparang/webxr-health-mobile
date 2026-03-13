// === /herohealth/gate/gate-logger.js ===
export function createGateLogger(ctx = {}) {
  const items = [];

  function push(type, payload = {}) {
    const row = {
      ts: Date.now(),
      type,
      game: ctx.game || '',
      mode: ctx.mode || '',
      cat: ctx.cat || '',
      ...payload
    };
    items.push(row);
    try {
      console.log('[gate-log]', row);
    } catch {}
    return row;
  }

  function all() {
    return items.slice();
  }

  return {
    push,
    all
  };
}