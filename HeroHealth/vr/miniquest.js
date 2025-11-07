// === miniquest.js — simple HUD binder (2025-11-07) ===
export class MiniQuest{
  constructor(bind, coach){
    this.bind = bind || {};
    this.coach = coach || {};
    this.goodCount = 0;
    this.junkCount = 0;
    this.seconds = 0;
    this.goal = 0;
  }
  _text(s){
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:s}})); }catch(e){}
  }
  start(goal){ this.goal = goal||0; this._text('กำลังเริ่ม • เป้าหมาย '+this.goal); }
  good(){ this.goodCount++; this._text('กดถูก: '+this.goodCount+' / เป้าหมาย '+this.goal); }
  junk(){ this.junkCount++; this._text('พลาด: '+this.junkCount+' ครั้ง'); }
  mission(n){ this._text('เควสคืบหน้า: '+(n||this.goodCount)+' / '+this.goal); }
  second(){ this.seconds++; }
  fever(){ this._text('FEVER! • เร่งทำคะแนน'); }
}
export default { MiniQuest };