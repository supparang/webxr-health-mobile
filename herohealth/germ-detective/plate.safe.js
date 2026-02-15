// plate.safe.js
// HHA-style plate shim — emits hha:features_1s, hha:labels, hha:start, hha:end
// Exposes: init(cfg), start(), end(reason), logEvent(name,payload), emitFeatures()
// Safe: non-throwing if PlateLogger missing; deterministic seed for study mode.

export default (function PlateSafeModule(){
  const STATE = {
    cfg: { runMode:'play', diff:'normal', seed:0, durationPlannedSec:240 },
    running:false,
    ended:false,
    timeLeft:0,
    tStartIso:null,
    score:0,
    evidenceCount:0,
    ticks:0,
    rng: Math.random,
    mlBuf: { hits:0, misses:0 },
    featureTimer:null
  };

  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function seededRng(seed){
    let t = (Number(seed)||0) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function safeDispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }catch(e){
      console.warn('[PlateSafe] dispatch err', e);
    }
  }

  function init(cfg = {}){
    STATE.cfg.runMode = String(cfg.runMode || cfg.run || 'play');
    STATE.cfg.diff = String(cfg.diff || 'normal');
    STATE.cfg.seed = (cfg.seed !== undefined && cfg.seed !== '') ? Number(cfg.seed) : (STATE.cfg.runMode === 'study' ? 13579 : Math.floor(Math.random()*1e9));
    STATE.cfg.durationPlannedSec = Number(cfg.time || cfg.durationPlannedSec || cfg.timeSec || STATE.cfg.durationPlannedSec) || 240;
    STATE.timeLeft = STATE.cfg.durationPlannedSec;
    STATE.tStartIso = null;
    STATE.ended = false;
    STATE.running = false;
    STATE.evidenceCount = 0;
    STATE.ticks = 0;
    STATE.score = 0;
    STATE.mlBuf = { hits:0, misses:0 };

    const runMode = String(STATE.cfg.runMode).toLowerCase();
    STATE.rng = (runMode === 'study' || runMode === 'research') ? seededRng(STATE.cfg.seed) : Math.random;

    safeDispatch('hha:init', { game:'germ', cfg:STATE.cfg });
    return STATE.cfg;
  }

  function start(){
    if(STATE.running) return;
    STATE.running = true;
    STATE.ended = false;
    STATE.tStartIso = new Date().toISOString();
    STATE.ticks = 0;
    safeDispatch('hha:start', {
      projectTag:'HHA',
      game:'germ',
      runMode: STATE.cfg.runMode,
      diff: STATE.cfg.diff,
      seed: STATE.cfg.seed,
      timePlannedSec: STATE.cfg.durationPlannedSec,
      startTimeIso: STATE.tStartIso
    });
    // features emitter every 1s
    emitFeatures(); // immediate
    STATE.featureTimer = setInterval(()=> {
      try { emitFeatures(); } catch(e){ /* swallow */ }
    }, 1000);
  }

  function end(reason='end'){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;
    if(STATE.featureTimer){ clearInterval(STATE.featureTimer); STATE.featureTimer = null; }
    const accPct = computeAccuracyPct();
    const grade = computeGrade(STATE.score, accPct);
    const summary = {
      timestampIso: new Date().toISOString(),
      game:'germ',
      runMode: STATE.cfg.runMode,
      diff: STATE.cfg.diff,
      seed: STATE.cfg.seed,
      timePlannedSec: STATE.cfg.durationPlannedSec,
      durationPlayedSec: (STATE.cfg.durationPlannedSec - STATE.timeLeft)|0,
      scoreFinal: STATE.score|0,
      evidenceCount: STATE.evidenceCount|0,
      accuracyPct: accPct,
      grade,
      reason
    };
    safeDispatch('hha:end', summary);
    emitLabels('end', {
      reason,
      grade,
      accPct: summary.accuracyPct,
      evidenceCount: summary.evidenceCount,
      scoreFinal: summary.scoreFinal
    });
  }

  function computeAccuracyPct(){
    const hits = STATE.mlBuf.hits || 0;
    const misses = STATE.mlBuf.misses || 0;
    const total = hits + misses;
    if(total === 0) return 100;
    return Math.round((hits / total) * 1000) / 10;
  }

  function computeGrade(score, accPct){
    score = Number(score)||0; accPct = Number(accPct)||0;
    if(score >= 2200 && accPct >= 88) return 'S';
    if(score >= 1700 && accPct >= 82) return 'A';
    if(score >= 1200 && accPct >= 75) return 'B';
    if(score >= 700  && accPct >= 68) return 'C';
    return 'D';
  }

  function emitFeatures(){
    if(!STATE.running) return;
    STATE.ticks++;
    STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
    const feat = {
      game:'germ',
      tPlayedSec: (STATE.cfg.durationPlannedSec - STATE.timeLeft)|0,
      timeLeftSec: STATE.timeLeft|0,
      scoreNow: STATE.score|0,
      evidenceCount: STATE.evidenceCount|0,
      ticks: STATE.ticks,
      rngSeed: STATE.cfg.seed
    };
    safeDispatch('hha:features_1s', feat);
    // also allow direct hook for logger
    try{ if(window.PlateLogger && typeof window.PlateLogger.logEvent === 'function') window.PlateLogger.logEvent('hha:features_1s', feat); }catch{}
    // auto end when time left 0
    if(STATE.timeLeft <= 0) end('timeup');
  }

  function emitLabels(type, data = {}){
    safeDispatch('hha:labels', Object.assign({ game:'germ', runMode: STATE.cfg.runMode, diff: STATE.cfg.diff, seed: STATE.cfg.seed, type }, data));
    try{ if(window.PlateLogger && typeof window.PlateLogger.logEvent === 'function') window.PlateLogger.logEvent('hha:labels', Object.assign({ type }, data)); }catch{}
  }

  function logEvent(name, payload = {}){
    // common events: hotspot_revealed, sample_collected, photo_taken, tool_change, evidence_added
    try{
      if(name === 'evidence_added') STATE.evidenceCount++;
      if(name === 'hotspot_hit') STATE.mlBuf.hits++;
      if(name === 'hotspot_miss') STATE.mlBuf.misses++;
      // score heuristics
      if(name === 'hotspot_revealed') STATE.score += 100;
      if(name === 'sample_collected') STATE.score += 80;
      if(name === 'photo_taken') STATE.score += 10;

      safeDispatch('hha:event', { name, payload });
      try{ if(window.PlateLogger && typeof window.PlateLogger.logEvent === 'function') window.PlateLogger.logEvent(name, payload); }catch{}
    }catch(e){ /* swallow */ }
  }

  // small API
  return {
    init,
    start,
    end,
    logEvent,
    emitFeatures,
    getState: ()=> ({ ...STATE })
  };
})();
