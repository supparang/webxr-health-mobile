export class HUD{
  constructor(){
    this.el={
      score:document.getElementById('score'), combo:document.getElementById('combo'),
      time:document.getElementById('time'), best:document.getElementById('best'),
      mode:document.getElementById('modeName'), diff:document.getElementById('difficulty'),
      fever:document.getElementById('fever'),
      targetWrap:document.getElementById('targetWrap'), targetBadge:document.getElementById('targetBadge'),
      plateWrap:document.getElementById('plateTracker'), platePills:document.getElementById('platePills'),
    };
  }
  setMode(name){ this.el.mode.textContent=name; }
  setDiff(v){ this.el.diff.textContent=v; }
  setScore(v){ this.el.score.textContent=v; }
  setCombo(v){ this.el.combo.textContent='x'+v; }
  setTime(v){ this.el.time.textContent=v; }
  setBest(v){ this.el.best.textContent=v; }
  fever(on){ this.el.fever.style.display = on ? 'inline-block' : 'none'; }
  setTarget(txt){ this.el.targetWrap.style.display='block'; this.el.targetBadge.textContent=txt; }
  hideTarget(){ this.el.targetWrap.style.display='none'; }
  setPills(html){ this.el.plateWrap.style.display='block'; this.el.platePills.innerHTML=html; }
  hidePills(){ this.el.plateWrap.style.display='none'; }
setHydration(val, zone){
  // แสดงบาร์เฉพาะโหมด Hydration
  document.getElementById('hydroWrap').style.display = 'block';
  const bar = document.getElementById('hydroBar');
  const lab = document.getElementById('hydroLabel');
  const v = Math.max(0, Math.min(100, Math.round(val)));
  bar.style.width = v + '%';

  // สีตามโซน
  if(zone==='low'){ bar.style.background = 'linear-gradient(90deg,#f66,#fa6)'; lab.textContent = 'น้อยไป'; }
  else if(zone==='high'){ bar.style.background = 'linear-gradient(90deg,#f39,#f6f)'; lab.textContent = 'มากไป'; }
  else { bar.style.background = 'linear-gradient(90deg,#09f,#0ff)'; lab.textContent = 'พอดี'; }

  // ปรับตำแหน่งโซนเป้าหมาย (ค่าเริ่ม 45–65)
  const opt = document.getElementById('hydroOpt');
  opt.style.left = (window.HYD_OPT_MIN||45) + '%';
  opt.style.right = (100 - (window.HYD_OPT_MAX||65)) + '%';
}
hideHydration(){
  document.getElementById('hydroWrap').style.display = 'none';
}

}
