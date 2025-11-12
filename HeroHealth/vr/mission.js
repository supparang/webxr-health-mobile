// === /HeroHealth/vr/mission.js (2025-11-12 ROBUST) ===
// Mission/Quest deck with safe normalization + progress helpers

function uid() { return 'q' + Math.random().toString(36).slice(2,9); }

// --- normalize any goal/quest item into a safe shape ---
function normalizeItem(item, fallbackLabel='Quest'){
  // allow string shorthand
  if (typeof item === 'string') {
    return {
      id: uid(),
      label: item,
      level: 'normal',
      target: 1,
      check: () => false,
      prog : () => 0
    };
  }
  // clone object
  const q = { ...(item||{}) };
  if (!q.id)    q.id = uid();
  if (!q.label) q.label = fallbackLabel;
  if (!q.level) q.level = 'normal';
  if (!Number.isFinite(q.target)) q.target = 1;

  // guard functions
  if (typeof q.check !== 'function') q.check = () => false;
  if (typeof q.prog  !== 'function') q.prog  = () => 0;

  return q;
}

export class MissionDeck {
  constructor(opts = {}){
    const { pool = [], goalPool = [], miniPool = [] } = opts;

    // allow old param "pool" to be used as miniPool
    this.goalPool = (goalPool.length? goalPool : []).map(it => normalizeItem(it, 'Goal'));
    this.miniPool = (miniPool.length? miniPool : (pool||[])).map(it => normalizeItem(it, 'Mini Quest'));

    this.currentGoals = [];   // active main goals (array of items)
    this.currentMini  = [];   // 3 active mini quests

    this.stats = {
      score: 0,
      combo: 0,
      comboMax: 0,
      goodCount: 0,
      junkMiss: 0,
      tick: 0,       // seconds passed
    };
  }

  // ---------- sampling helpers ----------
  _sampleDistinct(src, n){
    const arr = src.slice();
    for (let i=arr.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  // ---------- draw / refresh ----------
  drawGoals(n=5){
    if (!this.goalPool.length){ this.currentGoals = []; return this.currentGoals; }
    this.currentGoals = this._sampleDistinct(this.goalPool, n).map(it => normalizeItem(it,'Goal'));
    return this.currentGoals;
  }

  draw3(){
    if (!this.miniPool.length){ this.currentMini = []; return this.currentMini; }
    this.currentMini = this._sampleDistinct(this.miniPool, 3).map(it => normalizeItem(it,'Mini Quest'));
    return this.currentMini;
  }

  // ---------- progress views ----------
  getProgress(kind='mini'){
    const list = kind === 'goals' ? this.currentGoals : this.currentMini;
    return list.map(q => {
      const prog   = Number(q.prog(this.stats)) || 0;
      const target = Number.isFinite(q.target) ? q.target : 1;
      const done   = !!q.check(this.stats);
      return { id:q.id, label:q.label, level:q.level, prog, target, done };
    });
  }

  getCurrent(){ return (this.currentMini && this.currentMini[0]) || null; }
  isCleared(kind='mini'){
    const list = kind === 'goals' ? this.currentGoals : this.currentMini;
    return list.length>0 && list.every(q => !!q.check(this.stats));
  }

  // ---------- stat updates (call from modes) ----------
  updateScore(n){ this.stats.score = n|0; }
  updateCombo(n){
    this.stats.combo = n|0;
    if (this.stats.combo > this.stats.comboMax) this.stats.comboMax = this.stats.combo;
  }
  onGood(){ this.stats.goodCount++; }
  onJunk(){ this.stats.junkMiss++; this.stats.combo = 0; }

  // call every second
  second(){
    this.stats.tick++;
  }
}

export default { MissionDeck };
