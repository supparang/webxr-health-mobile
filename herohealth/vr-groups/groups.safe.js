/* === /herohealth/vr-groups/groups.safe.js ===
GroupsBoot — PRODUCTION (HARDENED)
- window.GroupsBoot.start(runMode, {diff,time,seed})
- window.GroupsBoot.stop(reason)
- Autostart: only when ?autostart=1 AND ?run=play|research
- Robust: supports engine instance OR constructor at:
  GroupsVR.engine | GroupsVR.Engine | GroupsVR.GameEngine | window.GameEngine
*/

(function () {
  'use strict';
  const ROOT = window;
  const DOC  = document;

  const Boot = (ROOT.GroupsBoot = ROOT.GroupsBoot || {});
  let started = false;

  const $ = (id) => DOC.getElementById(id);

  function log(...a){ try{ console.log('[GroupsBoot]', ...a); }catch{} }
  function warn(...a){ try{ console.warn('[GroupsBoot]', ...a); }catch{} }
  function err (...a){ try{ console.error('[GroupsBoot]', ...a); }catch{} }

  function parseParams() {
    let sp;
    try { sp = new URLSearchParams(location.search); }
    catch { sp = new URLSearchParams(''); }

    const diff = String(sp.get('diff') || 'normal').toLowerCase();
    const run  = String(sp.get('run') || sp.get('mode') || '').toLowerCase();
    const time = parseInt(sp.get('time') || '90', 10);
    const seed = String(sp.get('seed') || '').trim();
    const autostart = String(sp.get('autostart') || '0');

    return {
      diff: (['easy','normal','hard'].includes(diff) ? diff : 'normal'),
      run:  (run === 'research' ? 'research' : (run === 'play' ? 'play' : '')),
      time: (Number.isFinite(time) ? Math.max(20, Math.min(600, time|0)) : 90),
      seed,
      autostart
    };
  }

  function bindRefs(eng) {
    const layer = $('fg-layer');
    const cam = DOC.querySelector('#cam');

    if (layer && typeof eng.setLayerEl === 'function') eng.setLayerEl(layer);
    if (cam   && typeof eng.setCameraEl === 'function') eng.setCameraEl(cam);

    // เผื่อ engine ใช้ชื่ออื่น
    if (layer && typeof eng.setLayer === 'function') eng.setLayer(layer);
    if (cam   && typeof eng.setCamera === 'function') eng.setCamera(cam);
  }

  // ------------------ ENGINE RESOLUTION (robust) ------------------
  function getNS(){
    return (ROOT.GroupsVR = ROOT.GroupsVR || {});
  }

  function looksLikeEngine(obj){
    return !!(obj && (typeof obj.start === 'function' || typeof obj.boot === 'function'));
  }

  function looksLikeCtor(fn){
    return typeof fn === 'function';
  }

  function makeEngineFromCtor(Ctor){
    const NS = getNS();
    const layer = $('fg-layer') || DOC.querySelector('.fg-layer');

    // บาง engine ต้องการ layer ใน ctor บางตัวไม่ต้อง
    try{
      const inst = layer ? new Ctor({ layer }) : new Ctor();
      NS.engine = inst;
      return inst;
    }catch(e1){
      try{
        const inst = new Ctor();
        NS.engine = inst;
        // ผูก layer ทีหลังถ้ามีเมธอด
        try{ if (layer && typeof inst.setLayerEl === 'function') inst.setLayerEl(layer); }catch{}
        return inst;
      }catch(e2){
        throw e2;
      }
    }
  }

  function safeEngine() {
    const NS = getNS();

    // 1) มี instance อยู่แล้ว?
    if (looksLikeEngine(NS.engine)) return NS.engine;
    if (looksLikeEngine(NS.Engine)) return NS.Engine;
    if (looksLikeEngine(NS.GameEngine)) return NS.GameEngine; // เผื่อเขาเซ็ตเป็น instance
    if (looksLikeEngine(ROOT.GroupsEngine)) return ROOT.GroupsEngine;

    // 2) มี ctor ไหม? (GameEngine class/function)
    const ctor =
      (looksLikeCtor(NS.GameEngine) ? NS.GameEngine : null) ||
      (looksLikeCtor(ROOT.GameEngine) ? ROOT.GameEngine : null) ||
      (looksLikeCtor(NS.Engine) ? NS.Engine : null);

    if (ctor){
      try{
        const inst = makeEngineFromCtor(ctor);
        return looksLikeEngine(inst) ? inst : null;
      }catch(e){
        err('Cannot construct engine from ctor:', e);
        return null;
      }
    }

    // 3) หาไม่เจอจริง ๆ
    return null;
  }

  function waitEngineReady(timeoutMs=8000) {
    const t0 = (ROOT.performance && performance.now) ? performance.now() : Date.now();
    return new Promise((resolve, reject)=>{
      (function tick(){
        const eng = safeEngine();
        if (eng) return resolve(eng);

        const t = (ROOT.performance && performance.now) ? performance.now() : Date.now();
        if ((t - t0) > timeoutMs){
          const NS = getNS();
          reject(new Error(
            'GameEngine not ready (timeout). ' +
            'Found keys: ' + JSON.stringify({
              hasGroupsVR: !!ROOT.GroupsVR,
              hasNS_GameEngine: !!NS.GameEngine,
              hasNS_engine: !!NS.engine,
              hasWin_GameEngine: !!ROOT.GameEngine
            })
          ));
          return;
        }
        setTimeout(tick, 80);
      })();
    });
  }

  // ------------------ PUBLIC API ------------------
  Boot.start = async function (mode, opts = {}) {
    if (started) return;

    const runMode = String(mode || opts.runMode || 'play').toLowerCase() === 'research' ? 'research' : 'play';
    const diff = String(opts.diff || 'normal').toLowerCase();
    const time = Number.isFinite(opts.time) ? (opts.time|0) : (parseInt(opts.time || '90', 10) || 90);
    const seed = String(opts.seed || '').trim();

    let eng;
    try{
      eng = await waitEngineReady(8000);
    }catch(e){
      warn('GameEngine not ready', e);
      return;
    }

    bindRefs(eng);

    // ตั้งเวลา (เผื่อหลายชื่อ)
    try{
      if (typeof eng.setTimeLeft === 'function') eng.setTimeLeft(time);
      else if (typeof eng.setTime === 'function') eng.setTime(time);
    }catch{}

    started = true;
    ROOT.__FG_STARTED__ = true;

    try {
      // บาง engine ใช้ start(diff,{runMode,seed}) บางตัว start(runMode,{diff,time,seed})
      if (typeof eng.start === 'function'){
        // พยายามแบบเดิมคุณก่อน
        try{
          eng.start(diff, { runMode, seed });
        }catch{
          // fallback signature
          eng.start(runMode, { diff, time, seed });
        }
      } else if (typeof eng.boot === 'function'){
        eng.boot(runMode, { diff, time, seed });
      } else {
        throw new Error('Engine has no start/boot function');
      }
      log('started', { runMode, diff, time, seed });
    } catch (e) {
      err('start failed', e);
      started = false;
      ROOT.__FG_STARTED__ = false;
    }
  };

  Boot.stop = function (reason) {
    const eng = safeEngine();
    try { eng && eng.stop && eng.stop(reason || 'boot_stop'); } catch {}
    started = false;
    ROOT.__FG_STARTED__ = false;
  };

  // allow global stop event
  function onStop() { Boot.stop('hha_stop'); }
  ROOT.addEventListener('hha:stop', onStop);

  // autostart (ONLY if autostart=1)
  (function autostart() {
    const p = parseParams();
    if (p.autostart !== '1') return;
    if (!p.run) return;

    let tries = 0;
    const it = setInterval(async () => {
      tries++;
      const eng = safeEngine();
      if (eng) {
        clearInterval(it);
        Boot.start(p.run, { diff: p.diff, time: p.time, seed: p.seed });
      }
      if (tries > 120) clearInterval(it);
    }, 120);
  })();
})();
