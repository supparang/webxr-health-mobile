// === /herohealth/vr/hha-log.js ===
// HHA Standard Event/Session emitter (works with your hha-cloud-logger.js)

export function makeHHAEmitter(getCtx){
  const nowIso = ()=> new Date().toISOString();
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function ctxBase(){
    const c = (typeof getCtx === 'function') ? (getCtx() || {}) : {};
    if (!c.timestampIso) c.timestampIso = nowIso();
    return c;
  }

  function emit(name, detail){
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function logEvent(eventType, data = {}, ctxOverride = {}){
    const ctx = Object.assign(ctxBase(), ctxOverride);
    emit('hha:log_event', { ctx, data: Object.assign({ eventType }, data) });
  }

  // phase: 'start' | 'end' | 'pause' | 'resume' | etc.
  function logSession(phase, patch = {}, ctxOverride = {}){
    const ctx = Object.assign(ctxBase(), ctxOverride);
    emit('hha:log_session', Object.assign({}, ctx, patch, { phase }));
  }

  function endGame(summary = {}, ctxOverride = {}){
    const ctx = Object.assign(ctxBase(), ctxOverride);
    emit('hha:end', Object.assign({}, ctx, summary, { phase:'end' }));
  }

  return { logEvent, logSession, endGame, nowMs };
}
