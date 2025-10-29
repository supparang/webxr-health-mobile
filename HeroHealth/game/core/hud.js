// === Hero Health Academy — core/hud.js (r4 minimal, HUD-safe) ===
export class HUD {
  constructor(){
    this.$score = document.getElementById('score');
    this.$time  = document.getElementById('time');
    this.$toast = document.getElementById('toast');
    this.$coach = document.getElementById('coachHUD');
    this.$coachText = document.getElementById('coachText');
    this.$questUL = document.getElementById('questChips');
    this.$targetWrap = document.getElementById('targetWrap');
    this.$targetBadge= document.getElementById('targetBadge');
    this._timeouts = [];
  }
  _later(fn, ms){ const t=setTimeout(fn,ms); this._timeouts.push(t); return t; }
  dispose(){ try{ this._timeouts.forEach(clearTimeout); }catch{} this._timeouts.length=0; }

  /* Score/Time/Combo */
  setScore(v){ if(this.$score) this.$score.textContent = String(v|0); }
  setTime(v){  if(this.$time)  this.$time.textContent  = String(v|0); }
  setCombo(txt){ /* optional: could show elsewhere; keep quiet */ }

  /* Coach + Toast */
  say(text, ms=900){
    if(!this.$coach || !this.$coachText) return;
    this.$coachText.textContent = text;
    this.$coach.style.display = 'flex';
    this._later(()=>{ this.$coach.style.display='none'; }, ms);
  }
  toast(text, ms=900){
    if(!this.$toast) return;
    this.$toast.textContent = text;
    this.$toast.classList.add('show');
    this._later(()=>this.$toast.classList.remove('show'), ms);
  }
  flashDanger(){
    document.body.classList.add('flash-danger');
    this._later(()=>document.body.classList.remove('flash-danger'), 180);
  }

  /* Target badge (for groups/plate) */
  setTargetBadge(txt){ if(this.$targetWrap && this.$targetBadge){ this.$targetWrap.style.display='inline-flex'; this.$targetBadge.textContent = txt; } }

  /* Quests HUD */
  setQuestChips(chips){
    if(!this.$questUL) return;
    this.$questUL.innerHTML = (chips||[]).map(c=>{
      const dim = c.done || c.fail ? ' dim' : '';
      const ok  = c.done ? ' ok' : '';
      return `<li class="pill${ok}${dim}" data-q="${c.key}">
        <span>${c.icon||'⭐'}</span>
        <span>${c.label||''}</span>
        <b>${(c.progress|0)}/${(c.need|0)}</b>
      </li>`;
    }).join('');
  }
  markQuestDone(qid){
    try{
      const el = this.$questUL?.querySelector?.(`[data-q="${qid}"]`);
      if(el){ el.classList.add('ok'); }
    }catch{}
  }

  /* Power/Fever (optional visual no-op safe) */
  setPowerTimers(/*t*/){ /* no-op minimal */ }
  setFeverProgress(/*p01*/){ /* no-op minimal */ }

  /* Hydration helpers (optional visual) */
  showHydration(zone, pct){
    // If you want a simple badge, reflect on target badge
    if(this.$targetWrap && this.$targetBadge){
      this.$targetWrap.style.display = 'inline-flex';
      this.$targetBadge.textContent = `💧 ${pct|0}% ${zone||''}`;
    }
  }
  hideHydration(){
    if(this.$targetWrap) this.$targetWrap.style.display='none';
  }
}
