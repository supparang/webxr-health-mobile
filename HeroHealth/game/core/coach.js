export class Coach {
  constructor(opts={}){this.lang=opts.lang||'TH';this.minGap=1000;this._last=0;}
  setLang(l){this.lang=l;}
  _sayRaw(t){const now=performance.now?.()??Date.now();if(now-this._last<this.minGap)return;this._last=now;
    const box=document.getElementById('coachHUD');const text=document.getElementById('coachText');
    if(!box||!text)return;text.innerHTML=t;box.style.display='block';
    clearTimeout(this._t);this._t=setTimeout(()=>box.style.display='none',1800);}
  say(th,en){if(this.lang==='TH')this._sayRaw(th);else if(this.lang==='EN')this._sayRaw(en);
    else this._sayRaw(`${th} <span style="opacity:.8">| ${en}</span>`);}
  onStart(mode){this.say('เริ่มภารกิจ!','Mission start!');}
  onCombo(x){if(x>0&&x%5===0)this.say(`คอมโบ x${x}!`,`Combo x${x}!`);}
  onFever(){this.say('FEVER! ลุยเลย!','FEVER time!');}
  onGood(){const p=[['ดีมาก!','Nice!'],['สุดยอด!','Awesome!'],['ไวมาก!','Fast!']];
    const c=p[(Math.random()*p.length)|0];this.say(c[0],c[1]);}
  onBad(){const p=[['ไม่เป็นไร ลองใหม่!','Try again!'],['เกือบแล้ว!','Almost!'],['ระวังนะ!','Careful!']];
    const c=p[(Math.random()*p.length)|0];this.say(c[0],c[1]);}
  hint(state,score){
    const miss=state.ctx.miss||0;
    if(score.combo>=8)this.say('สุดยอด! รักษาคอมโบไว้!','Keep it up!');
    else if(miss>=3)this.say('ใจเย็น โฟกัสชิ้นต่อไป','Focus next!');
    else if(state.modeKey==='hydration'){
      const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok');
      if(z==='low')this.say('เติม 💧 หน่อย','Grab some water');
      if(z==='high')this.say('น้ำเยอะไปแล้ว','Ease off water');
    }
  }
  onEnd(score,grade){this.say(`จบเกม: ${score} | เกรด ${grade}`,`End: ${score} | Grade ${grade}`);}
}
