// === vr/miniquest.js (2025-11-06 sequential mode) ===
export class MiniQuest {
  constructor(hud, audio){
    this.hud = hud || {};
    this.audio = audio || {};
    this.deck = [];        // เควสที่ถูกสุ่มมา (3 ข้อจากคลัง 10)
    this.idx = 0;          // ตัวชี้เควสปัจจุบัน
    this.elapsed = 0;      // วินาทีที่ผ่านไป
    this.lastJunkAt = 0;
    this.goodTimestamps = []; // สำหรับ burst 10s
    this._goal = 40;
  }

  // เริ่มต้นแบบ sequential: โชว์ทีละข้อ
  start(goal=40){
    this._goal = goal;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps.length = 0;

    const templates = [
      { id:'F1',   label:'เปิดโหมด Fever 1 ครั้ง',     type:'fever',   target:1,   prog:0 },
      { id:'G10',  label:'เก็บของดี 10 ชิ้น',          type:'good',    target:10,  prog:0 },
      { id:'B5',   label:'เก็บของดี 5 ชิ้นใน 10 วิ',   type:'burst',   target:5,   prog:0 }, // ภายใน 10 วินาที
      { id:'C10',  label:'ทำคอมโบ x10',                type:'combo',   target:10,  prog:0 },
      { id:'S300', label:'ทำคะแนนถึง 300 คะแนน',       type:'score',   target:300, prog:0 },
      { id:'ST8',  label:'ทำสตรีคติดกัน 8 ชิ้น',       type:'streak',  target:8,   prog:0 },
      { id:'NJ15', label:'ไม่โดนของขยะ 15 วินาที',     type:'nojunk',  target:15,  prog:0 },
      { id:'MGOAL',label:'ผ่านภารกิจหลักของรอบนี้',    type:'mission', target:1,   prog:0 },
      { id:'C5',   label:'ทำคอมโบ x5',                 type:'combo',   target:5,   prog:0 },
      { id:'G20',  label:'เก็บของดี 20 ชิ้น',          type:'good',    target:20,  prog:0 }
    ];

    // สุ่ม 3 ข้อจาก 10 (ไม่ซ้ำ)
    const pool = templates.slice();
    const picks = [];
    for(let i=0;i<3;i++){
      const k = Math.floor(Math.random()*pool.length);
      picks.push(pool.splice(k,1)[0]);
    }
    this.deck = picks;
    this.idx = 0;
    this._render();
    try{ this.audio?.coach_start?.components?.sound?.playSound(); }catch{}
  }

  // เรียกทุกวินาที
  second(){
    this.elapsed++;
    // อัปเดต no-junk เป็นค่ามากสุดในหน้าต่างปัจจุบัน
    const q = this.current();
    if(q && q.type==='nojunk'){
      q.prog = Math.min(q.target, Math.max(q.prog, Math.max(0, this.elapsed - this.lastJunkAt)));
    }
    // ตัดของเก่าที่เกิน 10 วินาที สำหรับ burst
    const cutoff = this.elapsed - 10;
    this.goodTimestamps = this.goodTimestamps.filter(t => t > cutoff);
    this._render();
  }

  // เมื่อเก็บของดี
  good({score=0, combo=1, streak=0, missionGood=0}){
    this.goodTimestamps.push(this.elapsed);
    const q = this.current();
    if(!q) return;

    if(q.type==='good'){
      q.prog = Math.min(q.target, missionGood);
    }else if(q.type==='combo'){
      q.prog = Math.min(q.target, combo);
    }else if(q.type==='streak'){
      q.prog = Math.min(q.target, streak);
    }else if(q.type==='score'){
      q.prog = Math.min(q.target, score);
    }else if(q.type==='burst'){
      // จำนวน good ภายใน 10 วิ ล่าสุด
      q.prog = Math.min(q.target, this.goodTimestamps.length);
    }else if(q.type==='mission'){
      if (missionGood >= this._goal) q.prog = 1;
    }

    this._checkAdvance();
    this._render();
    try{ this.audio?.coach_good?.components?.sound?.playSound(); }catch{}
  }

  // เมื่อโดนของขยะ
  junk(){
    this.lastJunkAt = this.elapsed;
    this._render(); // streak จะถูกส่งมาจาก caller อยู่แล้ว
    try{ this.audio?.coach_warn?.components?.sound?.playSound(); }catch{}
  }

  fever(){
    const q = this.current();
    if(q && q.type==='fever'){
      q.prog = Math.min(q.target, (q.prog||0)+1);
    }
    this._checkAdvance();
    this._render();
    try{ this.audio?.coach_fever?.components?.sound?.playSound(); }catch{}
  }

  mission(missionGood){
    const q = this.current();
    if(q && q.type==='mission' && missionGood >= this._goal){
      q.prog = 1;
    }
    this._checkAdvance();
    this._render();
  }

  // ---------- helpers ----------
  current(){ return this.deck[this.idx] || null; }

  _checkAdvance(){
    const q = this.current();
    if(!q) return;
    const tgt = (q.type==='mission') ? 1 : q.target;
    if ((q.prog||0) >= tgt){
      // เสียงผ่านเควส
      try{ this.audio?.coach_quest?.components?.sound?.playSound(); }catch{}
      this.idx = Math.min(this.deck.length, this.idx+1);
      // ถ้าจบครบ 3 ข้อ
      if(this.idx >= this.deck.length){
        try{ this.audio?.coach_clear?.components?.sound?.playSound(); }catch{}
      }
    }
  }

  _render(){
    const el = this.hud?.tQmain || this.hud?.tQ1; // รองรับ index เดิม
    const title = document.getElementById('tQTitle');
    if(!el) return;

    if(this.idx >= this.deck.length){
      el.setAttribute('value','✅ เควสครบแล้ว! เยี่ยมมาก');
      title?.setAttribute('value','Mini Quest (3/3)');
      return;
    }

    const q = this.current();
    const tgt = (q.type==='mission') ? 1 : q.target;
    const prog = Math.min(q.prog||0, tgt);
    el.setAttribute('value', `⬜ ${q.label}  (${prog}/${tgt})`);
    title?.setAttribute('value', `Mini Quest (${this.idx+1}/3)`);
  }

  // สำหรับสรุปผล/ส่งออก
  serialize(){
    return { idx:this.idx, deck:this.deck };
  }
}
try{ window.__MINIQUEST_OK = true; }catch{}
