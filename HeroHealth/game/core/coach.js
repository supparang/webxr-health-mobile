// === core/coach.js ===
function $(s){ return document.querySelector(s); }

export class Coach {
  constructor(opts = {}) {
    this.lang = String((opts.lang || localStorage.getItem('hha_lang') || 'TH')).toUpperCase();
    this.ensureHUD();
  }
  ensureHUD() {
    this.box = document.getElementById('coachBox');
    if (!this.box) {
      this.box = document.createElement('div');
      this.box.id = 'coachBox';
      this.box.style.cssText =
        'position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
      document.body.appendChild(this.box);
    }
  }
  say(text = '') {
    if (!text) { this.box.style.display = 'none'; return; }
    this.box.textContent = text;
    this.box.style.display = 'block';
    clearTimeout(this._to);
    this._to = setTimeout(()=>{ this.box.style.display = 'none'; }, 1600);
  }

  onStart(){ this.say(this.lang === 'EN' ? 'Ready? Go!' : 'พร้อมไหม? ลุย!'); }
  onGood(){ this.say(this.lang === 'EN' ? '+Nice!' : '+ดีมาก!'); }
  onPerfect(){ this.say(this.lang === 'EN' ? 'PERFECT!' : 'เป๊ะเว่อร์!'); }
  onBad(){ this.say(this.lang === 'EN' ? 'Watch out!' : 'ระวัง!'); }
  onTimeLow(){ this.say(this.lang === 'EN' ? '10s left—push!' : 'เหลือ 10 วิ สุดแรง!'); }
  onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
}
