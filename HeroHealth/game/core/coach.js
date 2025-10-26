// game/core/coach.js
// โค้ช: แสดงข้อความเชียร์แบบ queue + auto-hide + debounce
export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';
    this.queue = [];
    this.busy = false;
    this.minGap = 350;       // เว้นระยะระหว่างข้อความ
    this.showMs = 1350;      // เวลาโชว์ข้อความ
    this.elWrap = document.getElementById('coachHUD');
    this.elText = document.getElementById('coachText');
    this.lastAt = 0;
  }
  setLang(l){ this.lang = l || 'TH'; }

  say(text, {important=false, now=false} = {}) {
    if (!text) return;
    const t = Date.now();
    if (!important && (t - this.lastAt) < this.minGap) return; // กันสแปม
    this.lastAt = t;
    if (now) { this._render(text); return; }
    this.queue.push(text);
    if (!this.busy) this._drain();
  }
  _render(text){
    if (!this.elWrap || !this.elText) return;
    this.elText.textContent = text;
    this.elWrap.style.display = 'flex';
    this.elWrap.classList.remove('hide'); // เผื่อมี CSS transition
    setTimeout(()=> {
      this.elWrap.classList.add('hide');
      setTimeout(()=>{ if(this.elWrap) this.elWrap.style.display='none'; }, 250);
      this.busy = false;
    }, this.showMs);
  }
  async _drain(){
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length){
      const msg = this.queue.shift();
      this._render(msg);
      await new Promise(r=>setTimeout(r, this.showMs + this.minGap));
    }
    this.busy = false;
  }

  // ====== Convenience hooks ======
  onStart(modeKey){
    const M = this.lang==='EN'
      ? {goodjunk:'Good vs Junk',groups:'Food Groups',hydration:'Hydration',plate:'Healthy Plate'}
      : {goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'};
    const msg = this.lang==='EN'
      ? `Go! Mode: ${M[modeKey]||modeKey}`
      : `ลุย! โหมด ${M[modeKey]||modeKey}`;
    this.say(msg, {important:true, now:true});
  }
  onGood(){ this.say(this.lang==='EN'?'Nice!':'ดีมาก!'); }
  onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะสุด!'); }
  onBad(){ this.say(this.lang==='EN'?'Oops':'พลาดนะ'); }
  onCombo(x){
    if (x===5) this.say(this.lang==='EN'?'Combo x5! Keep it!':'คอมโบ x5! เยี่ยม!', {important:true});
    if (x===10) this.say(this.lang==='EN'?'Combo x10!!':'คอมโบ x10!!', {important:true});
    if (x===20) this.say(this.lang==='EN'?'COMBO GOD!':'สุดยอดคอมโบ!', {important:true});
  }
  onFever(){ this.say(this.lang==='EN'?'FEVER TIME!':'เข้าโหมด FEVER!', {important:true}); }
  onFeverEnd(){ this.say(this.lang==='EN'?'Fever ended':'เฟเวอร์จบแล้ว'); }

  // Mini-Quest hooks
  onQuestsAssigned(qs){
    const names = qs.map(q=>q.titleShort || q.title).join(' • ');
    const msg = this.lang==='EN' ? `Quests: ${names}` : `เควส: ${names}`;
    this.say(msg, {important:true});
  }
  onQuestProgress(q){ // q: {title, progress, need, remain}
    const msg = this.lang==='EN'
      ? `${q.titleShort||q.title}: ${q.progress}/${q.need}`
      : `${q.titleShort||q.title}: ${q.progress}/${q.need}`;
    this.say(msg);
  }
  onQuestComplete(q){
    const msg = this.lang==='EN'
      ? `Quest done: ${q.titleShort||q.title}!`
      : `สำเร็จ: ${q.titleShort||q.title}!`;
    this.say(msg, {important:true});
  }
  onQuestFailed(q){
    const msg = this.lang==='EN'
      ? `Time up: ${q.titleShort||q.title}`
      : `หมดเวลา: ${q.titleShort||q.title}`;
    this.say(msg);
  }

  onEnd(score, gradeInfo){
    const msg = this.lang==='EN'
      ? `Score ${score} • Nice run!`
      : `จบเกม! คะแนน ${score} • เก่งมาก!`;
    this.say(msg, {important:true, now:true});
  }
}
