export class Coach {
  constructor(opts={}) {
    this.lang = opts.lang || 'TH';
    this.minGap = 1200; // ช่วงห่างระหว่างคำพูด
    this._last = 0;
  }

  _sayRaw(text) {
    const now = performance.now();
    if (now - this._last < this.minGap) return;
    this._last = now;
    const box = document.getElementById('coachHUD');
    const textBox = document.getElementById('coachText');
    if (!box || !textBox) return;
    textBox.innerHTML = text;
    box.style.display = 'block';
    clearTimeout(this._t);
    this._t = setTimeout(() => box.style.display = 'none', 2500);
  }

  say(th, en) {
    if (this.lang === 'TH') this._sayRaw(th);
    else if (this.lang === 'EN') this._sayRaw(en);
    else this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`);
  }

  // 📣 ก่อนเริ่มเกม
  onStart(mode) {
    const lines = {
      goodjunk:['โฟกัสดี หลีกขยะ!','Focus on healthy items! Avoid junk!'],
      groups:['มองให้ตรงหมวดอาหาร','Match the correct food group!'],
      hydration:['รักษาสมดุลน้ำ 45–65%','Keep hydration between 45–65%!'],
      plate:['เติมจานให้ครบ 5 หมู่','Fill the healthy plate completely!']
    };
    const t = lines[mode] || ['เริ่มกันเลย!','Let’s go!'];
    this.say(t[0], t[1]);
  }

  // 📈 ระหว่างเล่น
  onGood(){ this.say('ยอดเยี่ยม!','Great!'); }
  onBad(mode){
    const m = {
      goodjunk:['ของขยะ ระวัง!','Junk! Be careful!'],
      groups:['ผิดหมวดแล้ว!','Wrong category!'],
      hydration:['น้ำน้อย/มากเกินไป!','Hydration off-balance!'],
      plate:['เกินโควตาแล้ว!','Over quota!']
    };
    const t = m[mode] || ['ระวังนะ!','Careful!'];
    this.say(t[0], t[1]);
  }

  // ⭐ เมื่อจบเกม
  onEnd(score, grade) {
    this.say(`สรุปคะแนน ${score} | เกรด ${grade}`,
             `Final Score ${score} | Grade ${grade}`);
  }
}
