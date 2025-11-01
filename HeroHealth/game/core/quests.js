// === core/quests.js (Single-at-a-time; 10 presets; TH/EN; progress chip) ===
export class Quests {
  constructor({ lang='TH', hud=null, coach=null, single=true, total=10 } = {}){
    this.lang = String(lang).toUpperCase();
    this.hud = hud; this.coach = coach;
    this.single = !!single;
    this.totalNeed = total|0 || 10;
    this.active = null;
    this.done = [];
    this.pool = this._makePool();
    this.hitGood = 0;
    this.hitPerfect = 0;
    this.getStar = 0;
    this.feverSec = 0;
    this.noMissStreak = 0;
    this.timerAnchor = performance.now();
  }
  setCoach(c){ this.coach = c; }
  bindToMain({ hud, coach }){ if(hud) this.hud=hud; if(coach) this.coach=coach; return { refresh:()=>this._refresh() }; }

  _txt(key, vars={}){
    const T = {
      TH: {
        goodN: (n)=>`แตะของดี ${n} ชิ้น`,
        perfectN: (n)=>`Perfect ${n} ครั้ง`,
        starN: (n)=>`เก็บ ⭐ ${n} ดวง`,
        feverN: (n)=>`เปิด FEVER ${n} วินาที`,
        noMissN: (n)=>`เล่นโดยไม่พลาด ${n} ครั้ง`, 
        comboN: (n)=>`ทำคอมโบต่อเนื่อง ${n} ครั้ง`,
        scoreN: (n)=>`ทำคะแนนรวมให้ถึง ${n} คะแนน`,
        shieldN: (n)=>`สะสม 🛡️ ${n} อัน`,
        goldenN: (n)=>`เก็บ 🌟 ${n} ดวง`,
        junkAvoidN: (n)=>`เลี่ยงของไม่ดี ${n} ครั้ง`,
      },
      EN: {
        goodN: (n)=>`Tap GOOD ${n}`,
        perfectN: (n)=>`PERFECT x${n}`,
        starN: (n)=>`Collect ⭐ x${n}`,
        feverN: (n)=>`FEVER ${n}s`,
        noMissN: (n)=>`No-miss ${n} times`,
        comboN: (n)=>`Combo streak x${n}`,
        scoreN: (n)=>`Reach score ${n}`,
        shieldN: (n)=>`Collect 🛡️ x${n}`,
        goldenN: (n)=>`Grab 🌟 x${n}`,
        junkAvoidN:(n)=>`Avoid JUNK x${n}`,
      }
    }[this.lang] || {};
    return (T[key]||(()=>key))(vars.n);
  }

  _makePool(){
    const r = (a,b)=> (a + Math.floor(Math.random()*(b-a+1)));
    return [
      { key:'good',     icon:'🥦', need:r(6,10),   type:'good' },
      { key:'perfect',  icon:'💥', need:r(3,6),    type:'perfect' },
      { key:'star',     icon:'⭐', need:r(2,4),    type:'star' },
      { key:'fever',    icon:'🔥', need:r(6,12),   type:'feverSec' },
      { key:'nomiss',   icon:'🟦', need:r(4,7),    type:'noMiss' },
      { key:'combo',    icon:'⚡', need:r(8,12),   type:'combo' },
      { key:'score',    icon:'🏆', need:r(800,1400), type:'score' },
      { key:'shield',   icon:'🛡️', need:r(1,2),   type:'shield' },
      { key:'golden',   icon:'🌟', need:r(2,4),    type:'golden' },
      { key:'avoid',    icon:'🚫', need:r(4,8),    type:'avoidJunk' },
    ];
  }

  _labelFor(q){
    const map = {
      good:      'goodN',
      perfect:   'perfectN',
      star:      'starN',
      feverSec:  'feverN',
      noMiss:    'noMissN',
      combo:     'comboN',
      score:     'scoreN',
      shield:    'shieldN',
      golden:    'goldenN',
      avoidJunk: 'junkAvoidN'
    };
    return this._txt(map[q.type]||q.type, { n:q.need });
  }

  beginRun(mode, diff, lang, time){
    this.lang = String(lang||this.lang).toUpperCase();
    this.done = [];
    this.hitGood = this.hitPerfect = this.getStar = this.feverSec = this.noMissStreak = 0;
    this.timerAnchor = performance.now();
    this._nextQuest();
  }

  _nextQuest(){
    if (this.done.length >= this.totalNeed) { this.active = null; this._refresh(); return; }
    // pick a quest not yet used too many times
    const idx = Math.floor(Math.random()*this.pool.length);
    const base = {...this.pool[idx]};
    base.progress = 0; base.done=false; base.fail=false;
    base.label = this._labelFor(base);
    this.active = base;
    this._refresh();
  }

  _refresh(){
    if (!this.hud) return;
    const chips = this.active ? [{ key:this.active.key, icon:this.active.icon, label:`${this.done.length+1}/${this.totalNeed} • ${this.active.label}`, need:this.active.need, progress:this.active.progress, done:this.active.done, fail:this.active.fail }] : [];
    this.hud.setQuestChips(chips);
  }

  event(kind, payload){
    if (!this.active) return;
    const q = this.active;
    if (kind==='hit'){
      if (payload?.result==='good') { if (q.type==='good' || q.type==='score') q.progress++; }
      if (payload?.result==='perfect'){ if (q.type==='perfect' || q.type==='score') q.progress++; }
      if (q.type==='combo'){ q.progress = Math.max(q.progress, (payload?.comboNow|0)); }
    }
    if (kind==='power' && payload?.k==='shield'){
      if (q.type==='shield') q.progress++;
    }
    if (kind==='golden'){ if (q.type==='golden') q.progress++; }
    if (kind==='avoid'){ if (q.type==='avoidJunk') q.progress++; }
    if (kind==='miss'){
      this.noMissStreak = 0;
    }

    // score type: update by score at tick() instead
    if (q.type!=='score') this._checkDone();
    this._refresh();
  }

  tick({ score }={}){
    // count FEVER seconds by “real time” between ticks (assumes main calls per second)
    if (this.active?.type==='feverSec'){
      // main already reduces second; add 1s when FEVER on via HUD visible flag
      const feverOn = document.getElementById('hudFever')?.style.display !== 'none';
      if (feverOn) { this.active.progress = (this.active.progress|0) + 1; this._checkDone(); }
    }
    if (this.active?.type==='score'){
      this.active.progress = Math.max(this.active.progress|0, score|0);
      this._checkDone();
    }
    // continuous quest: no-miss
    if (this.active?.type==='noMiss'){
      this.noMissStreak++;
      this.active.progress = this.noMissStreak;
      this._checkDone();
    }
    this._refresh();
  }

  _checkDone(){
    const q = this.active; if (!q) return;
    const ok = (q.progress|0) >= (q.need|0);
    if (ok){
      q.done = true;
      this.done.push(q);
      this.coach?.onQuestDone?.();
      this.active = null;
      this._refresh();
      // schedule next
      setTimeout(()=>this._nextQuest(), 400);
    }
  }

  endRun({ score }={}){
    // finalize
    const out = [...this.done];
    if (this.active){ out.push({...this.active}); }
    return out;
  }

  getSummary(){
    const arr = [...this.done];
    if (this.active) arr.push({...this.active});
    return arr.map(q=>({ key:q.key, icon:q.icon, label:q.label, progress:q.progress|0, need:q.need|0, done:!!q.done, fail:!!q.fail }));
  }

  getActive(){ return this.active; }
}
export default { Quests };
