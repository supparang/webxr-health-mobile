// ./game/core/coach.js
export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';       // 'TH' | 'EN' | 'L3'(แสดงคู่)
    this.minGap = opts.minGap ?? 1200;   // มิลลิวินาที ระยะห่างข้อความ
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
    clearTimeout(this._hideT);
    this._hideT = setTimeout(()=>{ box.style.display='none'; }, this.autoHideMs);
  }

  _sayRaw(t){
    const now = performance.now();
    if(now - this._last < this.minGap) return;
    this._last = now;
    this._emit(t);
  }

  say(th, en){
    if(this.lang === 'TH') this._sayRaw(th);
    else if(this.lang === 'EN') this._sayRaw(en);
    else this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`);
  }

  // ============ Hooks ที่เกมเรียก ============

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

  onGood(){ this.say('ดีมาก!','Nice!'); }

  onBad(mode){
    const m = {
      goodjunk:  ['ขยะ! ระวัง','Junk! Careful'],
      groups:    ['ผิดหมวด','Wrong group'],
      hydration: ['สมดุลเพี้ยน','Off balance'],
      plate:     ['เกินโควตา','Over quota']
    };
    const t = m[mode] || ['ระวัง','Careful'];
    this.say(t[0], t[1]);
  }

  onCombo(x){
    if(x>0 && x%5===0){
      this.say(`คอมโบ x${x}!`, `Combo x${x}!`);
    }
  }

  onFever(){
    this.say('FEVER! ลุย!','FEVER time!');
  }

  onPower(k){
    const m = {
      boost: ['บูสต์คะแนน!','Score boost!'],
      slow:  ['เวลาช้าลง','Time slowed'],
      shield:['มีเกราะ!','Shielded!'],
      timep: ['เวลาเพิ่ม!','Time up!'],
      timen: ['เวลาโดนลด!','Time down!']
    };
    const t = m[k] || ['พลังเสริม!','Power up!'];
    this.say(t[0], t[1]);
  }

  // z: 'low' | 'ok' | 'high'
  onHydrationZoneChange(z){
    const m = {
      low:  ['น้ำน้อยไป เติม 💧','Low hydration—grab 💧'],
      ok:   ['คุมได้ดี','Great—steady'],
      high: ['น้ำมากไป เบรกก่อน','Too high—ease up']
    };
    const t = m[z] || ['ดูมิเตอร์น้ำ','Watch hydration'];
    this.say(t[0], t[1]);
  }

  // สามารถส่ง accuracy/สถิติเพิ่มเติมได้
  onEnd(score, grade, extra){
    const acc = (extra?.accuracyPct!=null) ? ` | Accuracy ${extra.accuracyPct}%` : '';
    this.say(`สรุป: ${score} | เกรด ${grade}${acc}`, `Summary: ${score} | Grade ${grade}${acc}`);
  }
}
