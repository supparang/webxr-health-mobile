export class Coach {
  constructor(){ this.hero='zane'; this.el=document.getElementById('coachHUD'); this.tx=document.getElementById('coachText'); this.timer=null; }
  setHero(h){ this.hero=h; }
  say(msg, ms=1200){ if(!this.el) return; this.tx.textContent=msg; this.el.style.display='block'; this.el.style.opacity='1'; this.el.style.transform='translateX(-50%) translateY(0)'; clearTimeout(this.timer); this.timer=setTimeout(()=>{ this.el.style.transition='all .4s ease'; this.el.style.opacity='0'; this.el.style.transform='translateX(-50%) translateY(-8px)'; }, ms); }
  onStart(){ this.say(this.hero==='zane'? 'โหมดฝึกพร้อม ลุยกันเลย!':'พร้อมนะ เร็วและแม่นคือหัวใจ!'); }
  onCombo(v){ if(v===3) this.say('Combo x3! ดีมาก!'); if(v===5) this.say('สุดยอด! คอมโบสูงแล้ว!'); }
  onFever(){ this.say('FEVER MODE! ใช้พลังให้คุ้ม!'); }
  onEnd(){ this.say('เยี่ยม! พัฒนาได้อีกขั้นแล้ว'); }
}