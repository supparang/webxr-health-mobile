// vr/miniquest.js — Mini Quest system (10 quests, random 3 per game)
export class MiniQuest {
  constructor(hud, audio){
    this.hud = hud || {};
    this.audio = audio || {};
    this.quests = [];
    this.done = 0;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps = []; // sliding window in seconds
    this.feverCount = 0;
    this._goal = 40;
    this._shownClearCheer = false;
  }

  // pick 3 distinct quests for this round
  start(goal=40){
    this._goal = goal;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps.length = 0;
    this.feverCount = 0;
    this._shownClearCheer = false;

    const templates = [
      { id:'G10',  label:'เก็บของดี 10 ชิ้น',          type:'good',   target:10,  prog:0 },
      { id:'G20',  label:'เก็บของดี 20 ชิ้น',          type:'good',   target:20,  prog:0 },
      { id:'C5',   label:'ทำคอมโบ x5',                 type:'combo',  target:5,   prog:0 },
      { id:'C10',  label:'ทำคอมโบ x10',                type:'combo',  target:10,  prog:0 },
      { id:'F1',   label:'เปิดโหมด Fever 1 ครั้ง',     type:'fever',  target:1,   prog:0 },
      { id:'ST8',  label:'ทำสตรีคติดกัน 8 ชิ้น',       type:'streak', target:8,   prog:0 },
      { id:'S300', label:'ทำคะแนนถึง 300 คะแนน',       type:'score',  target:300, prog:0 },
      { id:'NJ15', label:'ไม่โดนของขยะ 15 วินาที',     type:'nojunk', target:15,  prog:0 }, // rolling seconds
      { id:'B5',   label:'เก็บของดี 5 ชิ้นใน 10 วิ',   type:'burst',  target:5,   prog:0 }, // window 10s
      { id:'MGOAL',label:'ผ่านภารกิจหลักของรอบนี้',    type:'mission',target:1,   prog:0 }
    ];
    // random 3 unique
    const picks = [];
    while (picks.length < 3 && templates.length){
      const i = Math.floor(Math.random()*templates.length);
      picks.push(templates.splice(i,1)[0]);
    }
    this.quests = picks;
    this.done = 0;
    this._render();
    try{ this.audio?.coach_start?.components?.sound?.playSound(); }catch{}
  }

  second(){
    this.elapsed++;
    // update "no junk for 15s"
    this._updateNoJunk();
    // clean old good timestamps >10s for burst tracking
    const cutoff = this.elapsed - 10;
    this.goodTimestamps = this.goodTimestamps.filter(t => t > cutoff);
    this._render();
  }

  good({score=0, combo=1, streak=0, missionGood=0}){
    this.goodTimestamps.push(this.elapsed);
    for (const q of this.quests){
      if (q.type==='good'){
        q.prog = Math.min(q.target, Math.max(q.prog, missionGood)); // total good equals missionGood
      }
      if (q.type==='combo'){
        q.prog = Math.min(q.target, Math.max(q.prog, combo));
      }
      if (q.type==='streak'){
        q.prog = Math.min(q.target, Math.max(q.prog, streak));
      }
      if (q.type==='score'){
        q.prog = Math.min(q.target, Math.max(q.prog, score));
      }
      if (q.type==='burst'){
        // count goods within last 10 seconds
        const c = this.goodTimestamps.length;
        q.prog = Math.min(q.target, Math.max(q.prog, c));
      }
      if (q.type==='mission'){
        if (missionGood >= this._goal) { q.prog = 1; }
      }
    }
    this._checkComplete();
    this._render();
    try{ this.audio?.coach_good?.components?.sound?.playSound(); }catch{}
  }

  junk(){
    this.lastJunkAt = this.elapsed;
    // reset streak-typed quest progress only visually; actual streak is supplied by caller
    this._render();
    try{ this.audio?.coach_warn?.components?.sound?.playSound(); }catch{}
  }

  fever(){
    this.feverCount++;
    for (const q of this.quests){
      if (q.type==='fever'){
        q.prog = Math.min(q.target, this.feverCount);
      }
    }
    this._checkComplete();
    this._render();
    try{ this.audio?.coach_fever?.components?.sound?.playSound(); }catch{}
  }

  mission(missionGood){
    for (const q of this.quests){
      if (q.type==='mission' && missionGood >= this._goal){
        q.prog = 1;
      }
    }
    this._checkComplete();
    this._render();
  }

  _updateNoJunk(){
    for (const q of this.quests){
      if (q.type==='nojunk'){
        const seconds = Math.max(0, this.elapsed - this.lastJunkAt);
        q.prog = Math.min(q.target, Math.max(q.prog, seconds));
      }
    }
  }

  _checkComplete(){
    let newlyCleared = 0;
    for (const q of this.quests){
      if (!q._done && ((q.type==='mission') ? (q.prog>=1) : (q.prog>=q.target)) ){
        q._done = true;
        newlyCleared++;
        try{ this.audio?.coach_quest?.components?.sound?.playSound(); }catch{}
      }
    }
    if (newlyCleared>0) this._render();
  }

  // render to HUD: tQ1,tQ2,tQ3
  _render(){
    const els = [this.hud.tQ1, this.hud.tQ2, this.hud.tQ3];
    for (let i=0;i<3;i++){
      const q = this.quests[i];
      if (!els[i]) continue;
      if (!q){ els[i].setAttribute('value',''); continue; }
      const mark = q._done ? '✅' : '⬜';
      const tgt = q.type==='mission' ? 1 : q.target;
      const showProg = (q.type!=='mission');
      const prog = showProg ? ` (${Math.min(q.prog,tgt)}/${tgt})` : '';
      els[i].setAttribute('value', `${mark} ${q.label}${prog}`);
    }
    // if all quests done → cheer (once)
    if (!this._shownClearCheer && this.quests.length && this.quests.every(q=> q._done)){
      try{ this.audio?.coach_clear?.components?.sound?.playSound(); }catch{}
      this._shownClearCheer = true;
    }
  }
}


try{ window.__MINIQUEST_OK = true; }catch(e){}
