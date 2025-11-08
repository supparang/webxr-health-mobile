// === vr/coach.js (simple event-driven coach, throttled) ===
export class Coach {
  constructor(opts={}) {
    this.coolMs = opts.coolMs || 1400;     // กันสแปม
    this.lastAt = 0;
    this.comboMarks = new Set();
  }
  say(txt){
    const t = Date.now();
    if (t - this.lastAt < this.coolMs) return;
    this.lastAt = t;
    try{ window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:txt}})); }catch{}
  }
  onStart(mode){ this.say('ไปลุยโหมด ' + (mode||'') + ' กัน!'); }
  onQuest(q){ this.say('ภารกิจ: ' + q); }
  onQuestDone(){ this.say('สุดยอด! ผ่านเควสต์นี้แล้ว!'); }
  onFeverStart(){ this.say('FEVER มาแล้ว! เก็บแต้มรัวๆ!'); }
  onPowerup(t){
    if(t==='star') this.say('ได้ ⭐ Star! แต้มพุ่ง!');
    else if(t==='diamond') this.say('ได้ 💎 Diamond! คอมโบพุ่ง!');
    else if(t==='shield') this.say('ได้ 🛡️ Shield! กันพลาดชั่วคราว!');
  }
  onMiss(n){ if(n%3===0) this.say('ค่อยๆ ตั้งสตินะ ลองเล็งให้แม่นขึ้น'); }
  onCombo(c){
    const marks=[5,10,15,20,30];
    for(const m of marks){
      if(c>=m && !this.comboMarks.has(m)){
        this.comboMarks.add(m);
        this.say('คอมโบ x'+c+' สวยมาก! รักษาจังหวะไว้!');
        break;
      }
    }
  }
  onTime(t){
    if(t===30) this.say('เหลือ 30 วิ! เร่งมือ!');
    if(t===10) this.say('10 วิสุดท้าย! โกยแต้ม!');
  }
}
export default Coach;
