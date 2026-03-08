export function createGateLogger(ctx){
  const events = [];

  function push(type, data={}){
    const row = {
      ts: new Date().toISOString(),
      type,
      game: ctx.game,
      cat: ctx.cat,
      mode: ctx.mode,
      pid: ctx.pid,
      run: ctx.run,
      diff: ctx.diff,
      ...data
    };
    events.push(row);
    try{
      window.dispatchEvent(new CustomEvent('hha:gate-log', { detail: row }));
    }catch(_){}
    console.log('[HHA_GATE]', row);
  }

  function flush(result=null){
    const payload = {
      ctx,
      result,
      events
    };
    try{
      localStorage.setItem('HHA_GATE_LAST', JSON.stringify(payload));
    }catch(_){}
    return payload;
  }

  return { push, flush, events };
}
