/* UX Quest • Late Boss Escalation v1
 * For B3, B4 and B5 only: adds two final Boss Signal decisions taken from
 * a second rotating casefile. It preserves the base mission score model.
 */
(() => {
  'use strict';
  const path = String(location.pathname || '').toLowerCase();
  const target = path.includes('b3-ux-blueprint-gauntlet') ? 'b3' :
    path.includes('b4-design-system-siege') ? 'b4' :
    path.includes('b5-ux-launch-defense') ? 'b5' : '';
  if (!target) return;

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
          if (!config || config.id !== target) return init(config);
          const stages = Array.isArray(config.stages) ? config.stages : [];
          const bossStages = stages.slice(-2);
          const boosted = Object.assign({}, config, {
            bossBank:Array.isArray(config.bank) ? config.bank : config.bossBank,
            bossStages,
            recentLimit:Math.max(5, Number(config.recentLimit || 0)),
            intro:`${String(config.intro || '')} • Boss Signal รอบสุดท้ายจะดึงคดีใหม่มาท้าทายการ transfer เหตุผลของคุณ`
          });
          window.UXQLateBossEscalation = Object.freeze({ active:true, missionId:target, bossStages });
          return init(boosted);
        }
      }));
    }
  });
})();
