/* Load before uxq-mission-engine-v3.js on W4 only. */
(() => {
  'use strict';
  if (!/w4-user-insight-lab\.html/i.test(location.pathname)) return;
  let current;
  Object.defineProperty(window, 'UXQMissionEngine', {
    configurable: true,
    get: () => current,
    set: (engine) => {
      if (!engine || typeof engine.init !== 'function') { current = engine; return; }
      const init = engine.init.bind(engine);
      current = Object.freeze(Object.assign({}, engine, {
        init: (config) => init(Object.assign({}, config, {
          bank: [...(config.bank || []), ...(window.UXQ_W4_EXTRA_CASES || [])],
          bossBank: [...(config.bossBank || []), ...(window.UXQ_W4_EXTRA_BOSSES || [])],
          recentLimit: 18
        }))
      }));
    }
  });
})();