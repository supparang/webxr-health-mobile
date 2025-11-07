// ui/hud.js
export class HUD{
  constructor(){
    this.el={
      score:document.getElementById('score'),
      combo:document.getElementById('combo'),
      time:document.getElementById('time'),
      best:document.getElementById('best'),
      mode:document.getElementById('modeName'),
      diff:document.getElementById('difficulty'),
      fever:document.getElementById('fever'),
      targetWrap:document.getElementById('targetWrap'),
      targetBadge:document.getElementById('targetBadge'),
      plateWrap:document.getElementById('plateTracker'),
      platePills:document.getElementById('platePills'),
      menu:document.getElementById('menuBar'),
      help:document.getElementById('help'),
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
}
