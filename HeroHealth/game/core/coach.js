export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';            // 'TH' | 'EN' | 'L3'
    this.minGap = opts.minGap ?? 1200;
    this.autoHideMs = opts.autoHideMs ?? 2000;
    this._last = 0;
    this._hideT = null;
  }
  setLang(lang){ this.lang = lang; }
  setGap(ms){ this.minGap = Math.max(200, ms|0); }

  _emit(html){
    const box = document.getElementById('coachHUD');
    const text = document.getElementById('coachText');
    if(!box || !text) return;
    text.innerHTML = html;
    box.style.display = 'block';
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    clearTimeout(this._hideT);
    this._hideT = setTimeout(()=>{ box.style.display='none'; }, this.autoHideMs);
  }
  _sayRaw(t){
    const now = performance.now?.() ?? Date.now();
    if(now - this._last < this.minGap) return;
    this._last = now;
    this._emit(t);
  }
  say(th, en){
    if(this.lang === 'TH') this._sayRaw(th);
    else if(this.lang === 'EN') this._sayRaw(en);
    else this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`);
  }

  onStart(mode){
    const m = {
      goodjunk:  ['โฟกัสดี หลีกขยะ!','Focus good, dodge junk!'],
      groups:    ['มอง 🎯 ให้ตรงหมวด','Match the target group!'],
      hydration: ['คุม 45–65%','Keep 45–65%'],
      plate:     ['เติมโควตาให้ครบ','Fill the quotas']
    };
    const t = m[mode] || ['ลุย!','Let’s go!'];
    this.say(t[0], t[1]);
  }

  onGood(){
    const list = [
      ['ดีมาก!','Nice!'], ['สุดยอด!','Awesome!'],
      ['เยี่ยมเลย!','Great job!'], ['ต่อเนื่องแบบนี้แหละ!','Keep it up!']
    ];
    const p = list[Math.floor(Math.random()*list.length)];
    this.say(p[0], p[1]);
  }

  onBad(mode){
    const list = [
      ['ไม่เป็นไร ลองใหม่!','No worries, try again!'],
      ['ระวังหน่อย!','Be careful!'],
      ['พลาดนิดเดียว!','Almost there!'],
      ['โฟกัสใหม่นะ!','Focus again!']
    ];
    const p = list[Math.floor(Math.random()*list.length)];
    this.say(p[0], p[1]);
  }

  onCombo(x){ if(x>0 && x%5===0) this.say(`คอมโบ x${x}!`,`Combo x${x}!`); }
  onFever(){ this.say('FEVER! ลุย!','FEVER MODE!'); }
  onPower(k){
    const m = { boost:['บูสต์คะแนน!','Score boost!'], slow:['เวลาช้าลง','Time slowed'], shield:['มีเกราะ!','Shielded!'] };
    const t = m[k] || ['พลังเสริม!','Power up!']; this.say(t[0], t[1]);
  }
  onHydrationZoneChange(z){
    const m = { low:['น้ำน้อย เติม 💧','Low—grab 💧'], ok:['คุมได้ดี','Great—steady'], high:['น้ำมาก เบรกก่อน','Too high—ease up'] };
    const t = m[z] || ['ดูมิเตอร์น้ำ','Watch hydration']; this.say(t[0], t[1]);
  }
  onEnd(score, grade, extra){
    const acc = (extra?.accuracyPct!=null) ? ` | Accuracy ${extra.accuracyPct}%` : '';
    this.say(`สรุป: ${score} | เกรด ${grade}${acc}`, `Summary: ${score} | Grade ${grade}${acc}`);
  }
}
