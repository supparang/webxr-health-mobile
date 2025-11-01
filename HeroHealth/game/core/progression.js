// === core/progression.js ===
// โปรไฟล์/สถิติง่ายๆ เก็บใน localStorage
const KEY = 'hha_profile_v1';

function load(){
  try{ const raw = localStorage.getItem(KEY); if(!raw) return {}; return JSON.parse(raw)||{}; }catch{ return {}; }
}
function save(o){
  try{ localStorage.setItem(KEY, JSON.stringify(o||{})); }catch{}
}

export const Progress = {
  init(){ const p = load(); if (!p.stats) p.stats = {}; save(p); },
  beginRun(mode, diff, lang){ /* reserved */ },
  endRun({ score=0, bestCombo=0 } = {}){
    const p = load();
    p.stats = p.stats || {};
    p.stats.best = Math.max(p.stats.best||0, score|0);
    p.stats.bestCombo = Math.max(p.stats.bestCombo||0, bestCombo|0);
    save(p);
  },
  emit(){},
  getStatSnapshot(){ const p = load(); return p.stats || {}; },
  profile(){ return load(); }
};
export default Progress;
