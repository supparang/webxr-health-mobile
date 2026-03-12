// === /herohealth/gate/gate-logger.js ===
export function createGateLogger(base = {}) {
  const prefix = '[gate-logger]';

  function pack(type, payload = {}) {
    return {
      ts: Date.now(),
      ...base,
      type,
      ...payload
    };
  }

  return {
    log(type, payload = {}) {
      console.log(prefix, pack(type, payload));
    },
    info(type, payload = {}) {
      console.info(prefix, pack(type, payload));
    },
    warn(type, payload = {}) {
      console.warn(prefix, pack(type, payload));
    },
    error(type, payload = {}) {
      console.error(prefix, pack(type, payload));
    },
    event(type, payload = {}) {
      console.log(prefix, pack(type, payload));
    },
    async flush() {
      return true;
    }
  };
}