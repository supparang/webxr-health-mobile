/* UX Quest • Elite Replay v1
 * Once a learner has earned 3 stars in a regular campaign mission, replay
 * expands from two casefiles to all three. It is an optional difficulty lift,
 * not a new pass requirement.
 */
(() => {
  'use strict';
  const path = String(location.pathname || '').toLowerCase();
  const regular = /(w3-cognitive-load-escape|w4-user-insight-lab|w5-concept-forge|w6-flow-rescue|w7-wireframe-heist|w9-design-system-vault|w10-responsive-rescue|w11-contrast-cipher|w12-component-command|w13-prototype-pulse|w14-validation-lab)\.html/.test(path);
  if (!regular) return;

  const prior = Object.getOwnPropertyDescriptor(window, 'UXQMissionEngine');
  let current;
  Object.defineProperty(window, 'UXQMissionEngine', {
    configurable:true,
    get(){ return current || (prior?.get ? prior.get.call(window) : undefined); },
    set(engine){
      if (prior?.set) {
        prior.set.call(window, engine);
        engine = prior.get ? prior.get.call(window) : engine;
      }
      if (!engine || typeof engine.init !== 'function') { current = engine; return; }
      const init = engine.init.bind(engine);
      current = Object.freeze(Object.assign({}, engine, {
        init:(config) => {
          const bestStars = Number(window.UXQProgress?.get?.().missions?.[config?.id]?.bestStars || 0);
          const totalCases = Array.isArray(config?.bank) ? config.bank.length : 0;
          if (!config || bestStars < 3 || totalCases < 3) return init(config);
          const expanded = Object.assign({}, config, {
            caseCount:totalCases,
            duration:'18–26 นาที • Elite Replay',
            intro:`${String(config.intro || '')} • Elite Replay: คุณได้ 3★ แล้ว รอบนี้ต้องรับมือทุก casefile เพื่อพิสูจน์ว่าไม่ได้จำคดีเดียว`,
            format:`${totalCases} casefiles • Expanded replay route • Reason Check ทุกการตัดสินใจ`
          });
          window.UXQEliteReplay = Object.freeze({ active:true, missionId:config.id, caseCount:totalCases });
          return init(expanded);
        }
      }));
    }
  });
})();
