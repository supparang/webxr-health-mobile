// ScoreSystem D — EXP + Rank + session stats, backward compatible add/bad/reset
export class ScoreSystem{
  constructor(opts={}){
    this.opts = {
      getMultiplier: null,
      onCombo: null,
      onBad: null,
      onUpdate: null,
      onLevelUp: null,
      onRankUp: null,
      baseExpPerPoint: 0.5,
      expCurve: level => 50 + Math.floor(Math.pow(level, 1.25) * 25),
      rankTable: [
        { id:'Bronze',  at:0    },
        { id:'Silver',  at:500  },
        { id:'Gold',    at:1500 },
        { id:'Platinum',at:3500 },
        { id:'Diamond', at:7000 },
        { id:'Master',  at:12000},
        { id:'Grand',   at:20000},
      ],
      minAddStep: -50,
      maxAddStep: +200,
      storageKey: 'hha_profile_v1',
      ...opts
    };
    this.reset();
    this.profile = this._loadProfile() || this._makeDefaultProfile();
    this._recalcRank();
    this._emitUpdate();
  }
  reset(){
    this.score=0; this.combo=0; this.bestCombo=0;
    this.hits=0; this.misses=0;
    this.longestPerfectChain=0; this._currentPerfectChain=0;
  }
  add(v, meta=null){
    if (typeof v !== 'number' || !isFinite(v)) return this.score;
    v = Math.max(this.opts.minAddStep, Math.min(this.opts.maxAddStep, v));
    const mul = (typeof this.opts.getMultiplier === 'function') ? (this.opts.getMultiplier()||1) : 1;
    const delta = Math.round(v * mul);
    this.score += delta;
    if (delta > 0){
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.hits++; this._currentPerfectChain++;
      this.longestPerfectChain = Math.max(this.longestPerfectChain, this._currentPerfectChain);
      const expGain = Math.max(1, Math.round(delta * (this.opts.baseExpPerPoint||0.5)));
      this._grantExp(expGain);
      if (typeof this.opts.onCombo === 'function') this.opts.onCombo(this.combo);
    }
    if (delta < 0){ this.bad(meta?.reason || 'neg'); }
    this._emitUpdate();
    return this.score;
  }
  bad(reason='bad'){
    if (this.combo>0 && typeof this.opts.onBad==='function') this.opts.onBad(reason);
    this.combo=0; this.misses++; this._currentPerfectChain=0;
    this._emitUpdate();
  }
  finalizeRun(ctx={}){
    this.profile.totalScore += Math.max(0, this.score);
    this.profile.bestComboEver = Math.max(this.profile.bestComboEver, this.bestCombo);
    this.profile.runs += 1;
    this.profile.recent.push({
      t: Date.now(),
      score: this.score, bestCombo: this.bestCombo,
      hits: this.hits, misses:this.misses, chain:this.longestPerfectChain,
      mode: ctx.mode || '-', diff: ctx.diff || '-'
    });
    this.profile.recent = this.profile.recent.slice(-40);
    this._recalcRank(); this._saveProfile(); this._emitUpdate();
  }
  getProfile(){
    const nextExp = this._nextExp();
    return {
      level:this.profile.level, exp:this.profile.exp, nextExp,
      expPct: Math.min(100, Math.round(this.profile.exp/Math.max(1,nextExp)*100)),
      rank:this.profile.rank, totalScore:this.profile.totalScore,
      runs:this.profile.runs, bestComboEver:this.profile.bestComboEver,
      recent:[...this.profile.recent]
    };
  }
  _grantExp(exp){
    this.profile.exp += exp;
    let leveled=false;
    while (this.profile.exp >= this._nextExp()){
      this.profile.exp -= this._nextExp();
      this.profile.level++; leveled=true;
    }
    if (leveled && typeof this.opts.onLevelUp==='function'){
      this.opts.onLevelUp({level:this.profile.level, exp:this.profile.exp, nextExp:this._nextExp()});
    }
    this._saveProfile();
  }
  _nextExp(){ const fn=this.opts.expCurve||((lvl)=>50+lvl*25); return Math.max(10, Math.floor(fn(this.profile.level))); }
  _recalcRank(){
    const prev=this.profile.rank;
    const table=this.opts.rankTable||[]; let current=table[0]?.id||'Bronze';
    for (const t of table){ if (this.profile.totalScore >= (t.at||0)) current = t.id; }
    this.profile.rank = current;
    if (prev!==current && typeof this.opts.onRankUp==='function'){ this.opts.onRankUp({rank:current}); }
  }
  _makeDefaultProfile(){ return { level:1, exp:0, rank:'Bronze', totalScore:0, runs:0, bestComboEver:0, recent:[] }; }
  _loadProfile(){ try{ return JSON.parse(localStorage.getItem(this.opts.storageKey)||'null'); }catch{return null;}
  }
  _saveProfile(){ try{ localStorage.setItem(this.opts.storageKey, JSON.stringify(this.profile)); }catch{} }
  _emitUpdate(){ if (typeof this.opts.onUpdate==='function') this.opts.onUpdate(this.snapshot()); }
  snapshot(){ return { score:this.score, combo:this.combo, bestCombo:this.bestCombo, hits:this.hits, misses:this.misses,
    longestPerfectChain:this.longestPerfectChain, level:this.profile.level, exp:this.profile.exp, nextExp:this._nextExp(),
    rank:this.profile.rank, totalScore:this.profile.totalScore, runs:this.profile.runs }; }
}
