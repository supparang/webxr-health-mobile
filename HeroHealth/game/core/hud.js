// === Hero Health Academy — core/hud.js (v3: HUD minimal yet complete) ===
export class HUD {
  constructor() {
    this.root    = document.getElementById('hudWrap') || this._mkHud();
    this.scoreEl = document.getElementById('score');
    this.timeEl  = document.getElementById('time');
    this.comboEl = document.getElementById('combo');
    this.questUl = document.getElementById('questChips');
    this.toastEl = document.getElementById('toast');
    this.coachEl = document.getElementById('coachHUD');
    this.coachTx = document.getElementById('coachText');
    this.targetWrap = document.getElementById('targetWrap');
    this.targetBadge= document.getElementById('targetBadge');
    this._timers = {};
    this._timeouts = new Set();
    this._installSafety();
  }

  _mkHud(){
    const d = document.createElement('div');
    d.className='hud'; d.id='hudWrap';
    document.getElementById('gameLayer')?.appendChild(d);
    d.innerHTML = `
      <span class="pill" id="targetWrap" style="display:none"><span id="targetBadge">—</span></span>
      <div id="scoreTime">
        <span class="pill">⭐ <b id="score">0</b></span>
        <span class="pill">⏱ <b id="time">45</b>s</span>
        <span class="pill">Combo <b id="combo">x0</b></span>
      </div>
      <div id="questBar"><ul id="questChips"></ul></div>
      <div class="coach" id="coachHUD"><span id="coachText">Ready?</span></div>
      <div class="toast" id="toast"></div>
      <div class="missionLine" id="missionLine"></div>`;
    return d;
  }

  _installSafety(){
    try {
      // อย่าให้ HUD บังการคลิก item
      this.root.style.pointerEvents = 'none';
      [...this.root.querySelectorAll('*')].forEach(el=>el.style.pointerEvents='none');
    } catch {}
  }

  /* Basic */
  setScore(n){ if (this.scoreEl) this.scoreEl.textContent = (n|0); }
  setTime(s){ if (this.timeEl)  this.timeEl.textContent  = (s|0); }
  setCombo(t){ if (this.comboEl) this.comboEl.textContent = String(t||'x0'); }

  /* Quests */
  setQuestChips(chips = []){
    if (!this.questUl) return;
    const html = chips.map(c => `
      <li id="q_${c.key}" class="${c.done?'done':''}" title="${c.label}">
        <i>${c.icon||'⭐'}</i>
        <span>${c.label}</span>
        <b>${c.progress|0}/${c.need|0}</b>
      </li>`).join('');
    this.questUl.innerHTML = html;
  }
  markQuestDone(id){
    const el = document.getElementById('q_'+id);
    if (el) el.classList.add('done');
    this.toast('✓ Quest!');
  }

  /* Coach & Toast */
  say(text, ms=900){
    if (!this.coachEl || !this.coachTx) return;
    this.coachTx.textContent = text;
    this.coachEl.classList.add('show'); this.coachEl.style.display='flex';
    this._later(ms, ()=>{ this.coachEl.classList.remove('show'); this.coachEl.style.display='none'; });
  }
  toast(text, ms=900){
    if (!this.toastEl) return;
    this.toastEl.textContent = text; this.toastEl.classList.add('show');
    this._later(ms, ()=> this.toastEl.classList.remove('show'));
  }
  flashDanger(){ document.body.classList.add('flash-danger'); this._later(180, ()=>document.body.classList.remove('flash-danger')); }

  /* Optional power/fever/hydration (no-op safe) */
  setFeverProgress(/*v01*/){ /* hook for future bar */ }
  setPowerTimers(/*t*/){ /* hook */ }
  showHydration(/*zone,pct*/){ /* external hydration bar component handles itself */ }

  /* Utils */
  dispose(){
    for (const t of this._timeouts) clearTimeout(t);
    this._timeouts.clear();
  }
  _later(ms, fn){ const t=setTimeout(()=>{this._timeouts.delete(t); try{fn()}catch{}}, ms|0); this._timeouts.add(t); return t; }
}
