// === core/progression.js ===
// เก็บสถิติขั้นต่ำฝั่ง client
const KEY = 'hha_progress';

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch{return {}} }
function save(v){ try{ localStorage.setItem(KEY, JSON.stringify(v||{})); }catch{} }

let _p = load();

export const Progress = {
  init(){ _p = load(); },
  beginRun(mode, diff, lang){ _p.last = { mode, diff, lang, started: Date.now() }; save(_p); },
  endRun({ score, bestCombo }) {
    _p.totalRuns = (_p.totalRuns|0) + 1;
    _p.best = _p.best || {};
    _p.best.score = Math.max(_p.best.score|0, score|0);
    _p.best.combo = Math.max(_p.best.combo|0, bestCombo|0);
    save(_p);
  },
  emit(){},
  getStatSnapshot(){ return Object.assign({}, _p.best||{}, { totalRuns:_p.totalRuns|0 }); },
  profile(){ return _p; }
};
