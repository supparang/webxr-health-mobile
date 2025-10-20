
export class Coach{
  constructor(opts={}){ this.lang=opts.lang||'L3'; this.minGap=900; this._last=0; }
  _sayRaw(t){ const now=performance.now(); if(now-this._last<this.minGap) return; this._last=now;
    const box=document.getElementById('coachHUD'); const text=document.getElementById('coachText'); if(!box||!text) return;
    text.innerHTML=t; box.style.display='block'; clearTimeout(this._t); this._t=setTimeout(()=>box.style.display='none',1500);
  }
  say(th,en){ if(this.lang==='TH') this._sayRaw(th); else if(this.lang==='EN') this._sayRaw(en); else this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`); }
  onStart(mode){ const m={goodjunk:['โฟกัสดี หลีกขยะ!','Focus good, dodge junk!'],groups:['มอง 🎯 ให้ตรงหมวด','Watch the 🎯 target'],hydration:['คุม 45–65%','Keep 45–65%'],plate:['เติมโควตาให้ครบ','Fill the quotas']}; const t=m[mode]||['ลุย!','Let’s go!']; this.say(t[0],t[1]); }
  onCombo(x){ if(x%5===0 && x>0) this.say(`คอมโบ x${x}!`,`Combo x${x}!`); }
  onFever(){ this.say('FEVER! ลุย!','FEVER time!'); }
  onGood(){ this.say('ดีมาก!','Nice!'); }
  onBad(mode){ const m={goodjunk:['ของขยะ! ระวัง','Junk! Careful'],groups:['ผิดหมวดนะ','Wrong group'],hydration:['หวานเกิน!','Too sugary'],plate:['เกินโควตา!','Over quota']}; const t=m[mode]||['ระวังนะ','Careful']; this.say(t[0],t[1]); }
  onPower(k){ const m={slow:['เวลาช้าลง','Time slowed'],boost:['บูสต์คะแนน!','Score boost!'],shield:['มีเกราะ!','Shielded!']}; const t=m[k]||['พลังเสริม!','Power up!']; this.say(t[0],t[1]); }
  onHydrationZoneChange(z){ const m={low:['น้ำน้อยไป เติม 💧','Low hydration—grab 💧'],ok:['คุมได้ดี','Great—steady'],high:['น้ำมากไป เบรกก่อน','Too high—ease up']}; const t=m[z]||['คุมมิเตอร์','Watch meter']; this.say(t[0],t[1]); }
  onEnd(score, rb){ const g=rb?.grade||'-', acc=rb?.accuracyPct??0; this.say(`สรุป: เกรด ${g}, Accuracy ${acc}%`,`Summary: Grade ${g}, Accuracy ${acc}%`); }
}