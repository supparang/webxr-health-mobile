// Smart Coach (C5 fun, L3 bilingual, R4 full)
export class Coach{
  constructor(opts={}){
    this.persona = opts.persona || 'C5'; // funny
    this.lang = opts.lang || 'L3';       // TH+EN
    this.minGap = 900; // ms between bubbles
    this._last = 0;
  }
  _sayRaw(t){
    const now = performance.now();
    if(now - this._last < this.minGap) return; // throttle
    this._last = now;
    const box=document.getElementById('coachHUD');
    const text=document.getElementById('coachText');
    if(!box||!text) return;
    text.innerHTML = t;
    box.style.display='block';
    clearTimeout(this._t);
    this._t=setTimeout(()=>box.style.display='none',1500);
  }
  say(th, en){
    if(this.lang==='L3') this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`);
    else if(this.lang==='TH') this._sayRaw(th);
    else this._sayRaw(en);
  }

  // ===== Event hooks =====
  onStart(modeKey){
    const tips = {
      goodjunk: ['โฟกัสดี หลีกขยะนะ!','Focus good, dodge junk!'],
      groups:   ['มอง 🎯 ให้ตรงหมวดก่อนคลิก!','Watch the 🎯 target first!'],
      hydration:['คุม 45–65% ให้เนียน ๆ','Keep meter 45–65%'],
      plate:    ['เติมแต่พอดี พอครบได้โบนัส!','Fill quotas—win bonus!']
    };
    const t = tips[modeKey] || ['ลุยกัน!','Let’s go!'];
    this.say(t[0], t[1]);
  }
  onCombo(x){
    if(x%5===0 && x>0) this.say(`คอมโบ x${x}! สุดจัด!`,`Combo x${x}! Nice!`);
  }
  onFever(){ this.say('เข้า FEVER! ลุย!','FEVER time! Go!'); }
  onGood(){ this.say('ดีมาก!','Nice!'); }
  onBad(modeKey){
    const map = {
      goodjunk:['เฮ้ย ของขยะ!','Oops, junk!'],
      groups:['ผิดหมวดนะ ดู 🎯 ด้วย','Wrong group, check 🎯'],
      hydration:['หวานเกิน! ระวัง!','Too sugary! Careful!'],
      plate:['เกินโควตาแล้วนะ','Over quota!']
    };
    const t = map[modeKey] || ['ระวังนะ','Careful!'];
    this.say(t[0], t[1]);
  }
  onPower(kind){
    const map = {
      slow:['เวลาช้าลง','Time slowed'],
      boost:['บูสต์คะแนน!','Score boost!'],
      shield:['มีเกราะ!','Shielded!']
    };
    const t = map[kind] || ['พลังเสริม!','Power up!'];
    this.say(t[0], t[1]);
  }
  onHydrationZoneChange(zone){
    const m = {
      low:['น้ำน้อยไป เติม 💧 หน่อย','Low hydration—grab 💧'],
      ok:['สุดยอด คุมได้พอดี','Great—perfect zone'],
      high:['น้ำมากไปแล้ว เบรกก่อน','Too high—ease up']
    };
    const t = m[zone] || ['คุมมิเตอร์ดี ๆ','Watch the meter'];
    this.say(t[0], t[1]);
  }
  onEnd(finalScore, rubric, state){
    // Short analytic coaching
    const g = rubric?.grade || 'E';
    const acc = rubric?.accuracyPct ?? 0;
    const focus = {
      goodjunk:['เลี่ยงขยะเพิ่มอีกนิด','Avoid junk more'],
      groups:['ตั้งใจดู 🎯 ให้ชัด','Watch the 🎯 target'],
      hydration:['บาลานซ์ 45–65% ให้เนียน','Keep 45–65% steady'],
      plate:['อย่า overfill บ่อย','Avoid overfills']
    }[state.modeKey] || ['โฟกัสเป้าหมาย','Focus on the objective'];
    const th = `สรุป: เกรด ${g}, Accuracy ${acc}% → โฟกัส: ${focus[0]}`;
    const en = `Summary: Grade ${g}, Accuracy ${acc}% → Focus: ${focus[1]}`;
    this.say(th, en);
  }
}
