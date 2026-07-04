/* UX Quest • W2 Teacher Preview v1
 * Activated only with ?qa=1&preview=1 on W2.
 * Bypasses the W1 prerequisite for local acceptance testing without changing
 * the normal student route or classroom receiver behavior.
 */
(() => {
  'use strict';

  if (!/w2-design-thinking-sprint\.html/i.test(location.pathname)) return;
  const query = new URLSearchParams(location.search || '');
  const enabled = ['1', 'true', 'yes'].includes(String(query.get('qa') || '').toLowerCase()) &&
    ['1', 'true', 'yes'].includes(String(query.get('preview') || '').toLowerCase());
  if (!enabled) return;

  const prior = Object.getOwnPropertyDescriptor(window, 'UXQMissionEngine');
  let current;

  function previewConfig(config){
    if (!config || config.id !== 'w2') return config;
    window.UXQTeacherPreview = Object.freeze({
      active: true,
      mode: 'local-acceptance',
      message: 'Teacher Preview active: W1 prerequisite is bypassed for this local W2 acceptance test.'
    });
    return Object.assign({}, config, {
      requires: null,
      requiresLabel: '',
      intro: `${String(config.intro || '')} • โหมดทดสอบอาจารย์: ข้ามเงื่อนไข W1 เฉพาะแท็บนี้ และไม่ใช้เป็นเส้นทางผู้เรียน`,
      passText: 'โหมดทดสอบอาจารย์ • ผลในแท็บนี้ใช้ตรวจ W2 เท่านั้น'
    });
  }

  Object.defineProperty(window, 'UXQMissionEngine', {
    configurable: true,
    get(){ return current || (prior?.get ? prior.get.call(window) : undefined); },
    set(engine){
      if (prior?.set) {
        prior.set.call(window, engine);
        engine = prior.get ? prior.get.call(window) : engine;
      }
      if (!engine || typeof engine.init !== 'function') { current = engine; return; }
      const init = engine.init.bind(engine);
      current = Object.freeze(Object.assign({}, engine, {
        init: (config) => init(previewConfig(config))
      }));
    }
  });
})();
