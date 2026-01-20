import { boot } from './hygiene.safe.js';

(function(){
  const DOC = document;
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; }
  }

  const cfg = {
    game: 'hygiene-handwash',
    mode: 'survival',
    view: (qs('view','pc')||'pc').toLowerCase(),
    runMode: (qs('run','play')||'play').toLowerCase(), // play|research|practice
    diff: (qs('diff','normal')||'normal').toLowerCase(),
    timeTarget: Math.max(30, Math.min(180, Number(qs('time','70')) || 70)),
    seed: Number(qs('seed', String(Date.now()))) || Date.now(),
    studyId: qs('studyId',''),
    phase: qs('phase',''),
    conditionGroup: qs('conditionGroup',''),
    hub: qs('hub','../hub.html'),
    style: qs('style','mix'),
    logEndpoint: qs('log',''),
    studentId: qs('studentId',''),
    playIndex: qs('playIndex','')
  };

  // research/practice: deterministic + adaptive OFF
  if (cfg.runMode === 'research' || cfg.runMode === 'practice'){
    if (!qs('seed', null)) cfg.seed = 123456;
  }

  // autoPractice only for cVR play mode
  cfg.autoPractice = (cfg.runMode === 'play' && cfg.view === 'cvr');

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ()=>boot(cfg), { once:true });
  } else {
    boot(cfg);
  }
})();