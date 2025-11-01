// === core/coach.js ===
export class Coach {
  constructor({ lang='TH' } = {}) {
    this.lang = (lang||'TH').toUpperCase();
    this._hud = document.getElementById('hud');
    this.say = (m)=> {
      // ใช้ HUD ถ้ามี
      const api = window.__HHA_HUD_API;
      if (api?.say) api.say(m);
    };
  }
  onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
  onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
  onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
  onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
  onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
  onQuestStart(label){ this.say((this.lang==='EN'?'Quest: ':'ภารกิจ: ')+label); }
  onQuestDone(){ this.say(this.lang==='EN'?'Quest complete!':'ภารกิจสำเร็จ!'); }
  onFever(){ this.say(this.lang==='EN'?'FEVER TIME!':'โหมดไฟลุก!'); }
  onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
}
