/* === /herohealth/vr-groups/groups.safe.js ===
GroupsBoot (PRODUCTION)
- binds layer
- starts engine
- wires quest director
- wires progress events
*/

(function(root){
  'use strict';
  const DOC = document;

  const Boot = (root.GroupsBoot = root.GroupsBoot || {});
  let started = false;
  let quest = null;

  function $(id){ return DOC.getElementById(id); }
  function safeEngine(){
    return (root.GroupsVR && root.GroupsVR.GameEngine) ? root.GroupsVR.GameEngine : null;
  }

  function bindRefs(eng){
    const layer = $('fg-layer');
    if (layer && eng.setLayerEl) eng.setLayerEl(layer);
  }

  function wireQuest(runMode, cfg){
    const maker = root.GroupsVR && root.GroupsVR.createGroupsQuest;
    if (!maker) return;

    try{ quest && quest.stop && quest.stop('restart'); }catch{}
    quest = maker({
      runMode,
      diff: cfg.diff,
      style: cfg.style,
      seed: cfg.seed || cfg.seedFromUrl || String(Date.now())
    });

    quest.start();

    // forward engine progress -> quest
    root.addEventListener('groups:progress', quest.onProgress, { passive:true });

    // ensure initial bars update
    try{ quest.pushUpdate && quest.pushUpdate(); }catch{}
  }

  Boot.start = function(runMode, cfg){
    if (started) return;
    cfg = cfg || {};
    const eng = safeEngine();
    if (!eng || typeof eng.start !== 'function'){
      // wait a bit
      let tries = 0;
      const it = setInterval(()=>{
        tries++;
        const e2 = safeEngine();
        if (e2 && typeof e2.start === 'function'){
          clearInterval(it);
          Boot.start(runMode, cfg);
        }
        if (tries > 120) clearInterval(it);
      }, 120);
      return;
    }

    bindRefs(eng);
    started = true;

    const diff = String(cfg.diff || 'normal').toLowerCase();
    const style= String(cfg.style || 'mix').toLowerCase();
    const time = Number(cfg.time || 90);
    const seed = String(cfg.seed || '').trim();

    // start quest
    wireQuest(runMode, { diff, style, seed, seedFromUrl: cfg.seedFromUrl });

    // start engine
    eng.start(diff, { runMode, style, time, seed });

    // flush hardened: on stop
    root.addEventListener('hha:stop', ()=>{
      try{ root.HHACloudLogger?.flush?.(); }catch{}
    }, { once:false });
  };

  Boot.stop = function(reason){
    const eng = safeEngine();
    try{ eng && eng.stop && eng.stop(reason || 'stop'); }catch{}
    try{ quest && quest.stop && quest.stop(reason || 'stop'); }catch{}
    started = false;
    try{ root.HHACloudLogger?.flush?.(); }catch{}
  };

})(typeof window !== 'undefined' ? window : globalThis);