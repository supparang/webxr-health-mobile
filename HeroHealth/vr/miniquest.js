// === vr/miniquest.js — Single-line Mini Quest (show one-by-one) ===
export class MiniQuest {
  constructor(hud={}, audio={}){
    this.hud = hud;
    this.audio = audio;
    this.quests = [];
    this.idx = 0;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps = [];
    this.feverCount = 0;
    this._goal = 40;
  }

  start(goal=40){
    this._goal = goal;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps.length = 0;
    this.feverCount = 0;

    const pool = [
      { id:'F1',  label:'เปิดโหมด Fever 1 ครั้ง',     type:'fever', target:1,  prog:0 },
      { id:'G10', label:'เก็บของดี 10 ชิ้น',          type:'good',  target:10, prog:0 },
      { id:'B5',  label:'เก็บของดี 5 ชิ้นใน 10 วิ',   type:'burst', target:5,  prog:0 },
      { id:'C5',  label:'ทำคอมโบ x5',                 type:'combo', target:5,  prog:0 },
      { id:'NJ15',label:'ไม่โดนของขยะ 15 วินาที',     type:'nojunk',target:15, prog:0 },
      { id:'S300',label:'ทำคะแนนถึง 300 คะแนน',       type:'score', target:300,prog:0 },
      { id:'ST8', label:'ทำสตรีคติดกัน 8 ชิ้น',       type:'streak',target:8,  prog:0 },
      { id:'MGOAL',label:'ผ่านภารกิจหลักของรอบนี้',  type:'mission',target:1, prog:0 }
    ];
    // สุ่ม 3 และเรียงเป็นคิว
    const picks = [];
    while (picks.length<3 && pool.length){
      const i = Math.floor(Math.random()*pool.length);
      picks.push(pool.splice(i,1)[0]);
    }
    this.quests = picks;
    this.idx = 0;
    this._render();
  }

  second(){
    this.elapsed++;
    // update rolling “no junk”
    const q=this._cur();
    if(q && q.type==='nojunk'){
      const seconds=Math.max(0, this.elapsed - this.lastJunkAt);
      q.prog = Math.min(q.target, Math.max(q.prog, seconds));
      this._render();
    }
    // clear >10s for burst
    const cutoff=this.elapsed-10;
    this.goodTimestamps = this.goodTimestamps.filter(t=>t>cutoff);
  }

  good({score=0, combo=1, streak=0, missionGood=0}){
    this.goodTimestamps.push(this.elapsed);
    const q=this._cur(); if(!q) return;

    if(q.type==='good')   q.prog=Math.min(q.target, Math.max(q.prog, missionGood));
    if(q.type==='combo')  q.prog=Math.min(q.target, Math.max(q.prog, combo));
    if(q.type==='streak') q.prog=Math.min(q.target, Math.max(q.prog, streak));
    if(q.type==='score')  q.prog=Math.min(q.target, Math.max(q.prog, score));
    if(q.type==='burst')  q.prog=Math.min(q.target, Math.max(q.prog, this.goodTimestamps.length));
    if(q.type==='mission' && missionGood>=this._goal) q.prog=1;

    this._advanceIfDone();
    this._render();
  }

  junk(){
    this.lastJunkAt=this.elapsed;
    this._render();
  }

  fever(){
    const q=this._cur();
    if(q && q.type==='fever'){ q.prog=Math.min(q.target, (q.prog||0)+1); }
    this._advanceIfDone(); this._render();
  }

  mission(missionGood){
    const q=this._cur();
    if(q && q.type==='mission' && missionGood>=this._goal){ q.prog=1; }
    this._advanceIfDone(); this._render();
  }

  // helpers
  _cur(){ return this.quests[this.idx]; }
  _advanceIfDone(){
    const q=this._cur(); if(!q) return;
    const tgt=q.type==='mission'?1:q.target;
    if((q.prog||0) >= tgt) this.idx = Math.min(this.quests.length-1, this.idx+1);
  }

  _render(){
    const el=this.hud?.tQmain;
    if(!el) return;
    const q=this._cur();
    if(!q){ el.setAttribute('troika-text','value: เควสครบแล้ว!'); return; }
    const tgt=q.type==='mission'?1:q.target;
    const mark=(q.prog>=tgt)?'✅':'⬜';
    el.setAttribute('troika-text', `value: Mini Quest (${this.idx+1}/3)  ${mark} ${q.label} (${Math.min(q.prog||0,tgt)}/${tgt})`);
  }
}

try{ window.__MINIQUEST_OK = true; }catch{}
