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
      hydroWrap:document.getElementById('hydroWrap'),
      hydroBar:document.getElementById('hydroBar'),
      hydroLabel:document.getElementById('hydroLabel'),
      hydroOpt:document.getElementById('hydroOpt'),
    };
  }
  setMode(v){ this.el.mode.textContent=v; }
  setDiff(v){ this.el.diff.textContent=v; }
  setScore(v){ this.el.score.textContent=v; }
  setCombo(v){ this.el.combo.textContent='x'+v; }
  setTime(v){ this.el.time.textContent=v; }
  setBest(v){ this.el.best.textContent=v; }
  fever(on){ this.el.fever.style.display = on ? 'inline-block' : 'none'; }

  setTarget(txt){
    this.el.targetWrap.style.display='block';
    this.el.targetBadge.textContent=txt;
  }
  hideTarget(){ this.el.targetWrap.style.display='none'; }

  setPills(html){
    this.el.plateWrap.style.display='block';
    this.el.platePills.innerHTML=html;
  }
  hidePills(){ this.el.plateWrap.style.display='none'; }

  // ---------- Hydration Meter ----------
  setHydration(val, zone){
    if(!this.el.hydroWrap) return;
    this.el.hydroWrap.style.display='block';
    const v = Math.max(0, Math.min(100, Math.round(val)));
    this.el.hydroBar.style.width = v + '%';

    if(zone==='low'){
      this.el.hydroBar.style.background = 'linear-gradient(90deg,#f66,#fa6)';
      this.el.hydroLabel.textContent = 'น้อยไป';
    }else if(zone==='high'){
      this.el.hydroBar.style.background = 'linear-gradient(90deg,#f39,#f6f)';
      this.el.hydroLabel.textContent = 'มากไป';
    }else{
      this.el.hydroBar.style.background = 'linear-gradient(90deg,#09f,#0ff)';
      this.el.hydroLabel.textContent = 'พอดี';
    }
    if(this.el.hydroOpt){
      const min = (window.HYD_OPT_MIN ?? 45);
      const max = (window.HYD_OPT_MAX ?? 65);
      this.el.hydroOpt.style.left  = min + '%';
      this.el.hydroOpt.style.right = (100 - max) + '%';
    }
  }
  hideHydration(){
    if(this.el.hydroWrap) this.el.hydroWrap.style.display='none';
  }
}
