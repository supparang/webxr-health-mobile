// === Hero Health Academy — game/core/hud.js (2025-10-30, unified & safe) ===
// Minimal, robust HUD controller used by main.js + modes
// Provides: setScore, setTime, setCombo, toast, say, dispose,
//           setQuestChips, markQuestDone, setPowerTimers, setFeverProgress,
//           showHydration, flashDanger, dimPenalty

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];

function ensure(el, make){
  if (el) return el;
  const built = make();
  return built;
}

export class HUD {
  constructor(){
    // Score/Time
    this.scoreEl = $('#score');
    this.timeEl  = $('#time');

    // Combo pill (auto-create if missing)
    const scoreTime = $('#scoreTime');
    this.comboWrap = $('#comboPill');
    if (!this.comboWrap && scoreTime){
      const frag = document.createElement('span');
      frag.className = 'pill';
      frag.id = 'comboPill';
      frag.innerHTML = `🔥 <b id="combo">x0</b>`;
      scoreTime.insertBefore(frag, scoreTime.lastElementChild); // before time pill
    }
    this.comboEl = $('#combo');

    // Toast & Coach
    this.toastEl = ensure($('#toast'), ()=> {
      const el = document.createElement('div');
      el.id = 'toast'; el.className='toast'; document.body.appendChild(el);
      return el;
    });
    this.coachWrap = ensure($('#coachHUD'), ()=> {
      const w = document.createElement('div'); w.id='coachHUD'; w.className='coach'; document.body.appendChild(w); return w;
    });
    this.coachText = ensure($('#coachText'), ()=> {
      const s = document.createElement('span'); s.id='coachText'; s.textContent='Ready?'; this.coachWrap.appendChild(s); return s;
    });

    // Quest bar (chips list)
    this.questBar   = ensure($('#questBar'), ()=> {
      const d = document.createElement('div'); d.id='questBar'; document.body.appendChild(d); return d;
    });
    this.questList  = ensure($('#questChips'), ()=> {
      const ul = document.createElement('ul'); ul.id='questChips'; this.questBar.appendChild(ul); return ul;
    });

    // Mission line (quick banner)
    this.missionLine = ensure($('#missionLine'), ()=> {
      const d = document.createElement('div'); d.id='missionLine'; document.body.appendChild(d); return d;
    });

    // Runtime
    this._sayT = 0;
    this._toastT = 0;
    this._power = { x2:0, freeze:0, sweep:0, shield:0, magnet:0, boost:0 };
    this._fever01 = 0;
  }

  /* ----- Basic setters ----- */
  setScore(n){ try{ if(this.scoreEl) this.scoreEl.textContent = (n|0); }catch{} }
  setTime(n){  try{ if(this.timeEl)  this.timeEl.textContent  = (n|0); }catch{} }
  setCombo(text='x0'){ try{ if(this.comboEl) this.comboEl.textContent = String(text); }catch{} }

  /* ----- Coach speech bubble ----- */
  say(text='', ms=900){
    try{
      if (!this.coachWrap || !this.coachText) return;
      this.coachText.textContent = String(text||'');
      this.coachWrap.classList.add('show');
      this.coachWrap.style.display = 'flex';
      clearTimeout(this._sayT);
      this._sayT = setTimeout(()=>{
        this.coachWrap.classList.remove('show');
        this.coachWrap.style.display = 'none';
      }, Math.max(200, ms|0));
    }catch{}
  }

  /* ----- Toast pill ----- */
  toast(text='', ms=900){
    try{
      if (!this.toastEl) return;
      this.toastEl.textContent = String(text||'');
      this.toastEl.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(()=> this.toastEl.classList.remove('show'), Math.max(200, ms|0));
    }catch{}
  }

  /* ----- Power timers & Fever (safe no-op visuals) ----- */
  setPowerTimers(timers={}){
    // Store for potential future visual; keep silent if no UI
    this._power = { ...this._power, ...timers };
  }
  setFeverProgress(x01=0){
    this._fever01 = Math.max(0, Math.min(1, Number(x01)||0));
    // If you later add a fever bar, update it here.
  }

  /* ----- Quest chips ----- */
  setQuestChips(chips=[]){
    try{
      if (!this.questList) return;
      // Render compact chips with progress bars
      this.questList.innerHTML = chips.map(ch => {
        const pct = ch.need ? Math.min(100, Math.round((ch.progress|0) * 100 / (ch.need|0))) : 0;
        const done = ch.done ? ' done' : '';
        const fail = ch.fail ? ' fail' : '';
        const label = (ch.label || ch.key || '').toString();
        const need  = ch.need|0, prog = ch.progress|0;
        return `
          <li class="quest-chip${done}${fail}" data-qid="${ch.key}" style="list-style:none;display:inline-flex;align-items:center;gap:8px;margin:4px 6px 0 0;padding:6px 8px;border-radius:999px;background:#102038;border:1px solid #19304e;font:800 12px ui-rounded">
            <span>${ch.icon||'⭐'}</span>
            <span class="lbl" style="opacity:.9">${label}</span>
            <span class="stat" style="opacity:.85">${prog}/${need}</span>
            <i class="bar" style="position:relative;display:inline-block;width:84px;height:8px;border-radius:999px;background:#0a1a2f;overflow:hidden">
              <b style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:#2dd4bf;border-radius:999px"></b>
            </i>
          </li>`;
      }).join('');
    }catch{}
  }

  markQuestDone(qid){
    try{
      const li = this.questList?.querySelector?.(`.quest-chip[data-qid="${CSS.escape(qid)}"]`);
      if (li){ li.classList.add('done'); }
    }catch{}
  }

  /* ----- Hydration helper (optional visual) ----- */
  showHydration(zone='OK', pct=50){
    // hydration.js draws its own overlay; keep for future hooks
    // Example: update body data-attrs for CSS if desired
    try {
      document.body.dataset.hzone = String(zone||'OK');
      document.body.dataset.hpct  = String(pct|0);
    }catch{}
  }

  /* ----- Effects ----- */
  flashDanger(){
    try{
      const root = $('#gameLayer') || document.body;
      root.classList.add('flash-danger');
      setTimeout(()=> root.classList.remove('flash-danger'), 180);
    }catch{}
  }
  dimPenalty(){
    try{
      const root = $('#gameLayer') || document.body;
      root.style.filter = 'brightness(0.92)';
      setTimeout(()=> root.style.filter = '', 160);
    }catch{}
  }

  /* ----- Cleanup ----- */
  dispose(){
    try{
      clearTimeout(this._sayT);
      clearTimeout(this._toastT);
      if (this.coachWrap){ this.coachWrap.classList.remove('show'); this.coachWrap.style.display='none'; }
      if (this.toastEl){ this.toastEl.classList.remove('show'); }
    }catch{}
  }
}
