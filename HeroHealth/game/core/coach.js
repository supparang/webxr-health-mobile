
export class Coach{
  constructor(opts={}){ this.lang=opts.lang||'TH'; this.minGap=1200; this._last=0; }
  _sayRaw(t){ const now=performance.now(); if(now-this._last<this.minGap) return; this._last=now;
    const box=document.getElementById('coachHUD'); const text=document.getElementById('coachText'); if(!box||!text) return;
    text.innerHTML=t; box.style.display='block'; clearTimeout(this._t); this._t=setTimeout(()=>box.style.display='none',2000);
  }
  say(th,en){ if(this.lang==='TH') this._sayRaw(th); else if(this.lang==='EN') this._sayRaw(en); else this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`); }
  onStart(mode){ const m={goodjunk:['โฟกัสดี หลีกขยะ!','Focus good, dodge junk!'],groups:['มอง 🎯 ให้ตรงหมวด','Match the group!'],hydration:['คุม 45–65%','Keep 45–65%'],plate:['เติมโควตาให้ครบ','Fill the quotas']}; const t=m[mode]||['ลุย!','Let’s go!']; this.say(t[0],t[1]); }
  onGood(){ this.say('ดีมาก!','Nice!'); }
  onBad(mode){ const m={goodjunk:['ขยะ! ระวัง','Junk! Careful'],groups:['ผิดหมวด','Wrong group'],hydration:['สมดุลเพี้ยน','Off balance'],plate:['เกินโควตา','Over quota']}; const t=m[mode]||['ระวัง','Careful']; this.say(t[0],t[1]); }
  onEnd(score, grade){ this.say(`สรุป: ${score} | เกรด ${grade}`, `Summary: ${score} | Grade ${grade}`); }
}
