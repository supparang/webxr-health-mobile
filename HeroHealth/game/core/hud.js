// game/core/hud.js
// Hero Health Academy — HUD (visibility toggle for Hub/Game + power/quests/hydration)

export class HUD {
  constructor () {
    // ---- Cache DOM ----
    this.$wrap       = document.getElementById('hudWrap') || this._ensureWrap();
    this.$score      = document.getElementById('score');
    this.$combo      = document.getElementById('combo');
    this.$time       = document.getElementById('time');
    this.$feverBar   = document.getElementById('feverBar');

    // Power bar (auto-fallback if missing)
    this.$powerBar   = document.getElementById('powerBar') || this._ensurePowerBar();

    this.$quests     = document.getElementById('questChips');

    this.$targetWrap = document.getElementById('targetWrap');
    this.$target     = document.getElementById('targetBadge');

    this.$plate      = document.getElementById('plateTracker');
    this.$platePills = document.getElementById('platePills') || (this.$plate && this.$plate.querySelector('#platePills'));

    this.$hydroWrap  = document.getElementById('hydroWrap');
    this.$hydroBarEl = document.getElementById('hydroBar') || document.getElementById('hydroBarEl') || document.querySelector('.hydroBar');
    this.$hydroNeedle= document.getElementById('hydroNeedle') || (this.$hydroWrap && this.$hydroWrap.querySelector('.needle'));

    this.$coachHUD   = document.getElementById('coachHUD');
    this.$coachText  = document.getElementById('coachText');

    this.$toast      = document.getElementById('toast') || this._ensureToast();

    // ARIA
    try {
      this.$toast.setAttribute('role','status');
      this.$toast.setAttribute('aria-live','polite');
      if (this.$coachHUD) {
        this.$coachHUD.setAttribute('role','status');
        this.$coachHUD.setAttribute('aria-live','polite');
      }
    } catch {}

    // timers
    this._coachT = 0;
    this._toastT = 0;

    this._applyLayerFixes();

    // 👇 ซ่อน HUD เริ่มต้น (อยู่หน้า Hub)
    try { this.$wrap && (this.$wrap.style.display = 'none'); } catch {}
  }

  /* ================= Visibility (Hub/Game) ================= */
  showGameHUD(on = true){
    if (!this.$wrap) return;
    this.$wrap.style.display = on ? 'block' : 'none';
  }

  /* ================= Base setters ================= */
  setScore(v){ if (this.$score) this.$score.textContent = (v|0); this._forceShow(); }
  setCombo(text){ if (this.$combo) this.$combo.textContent = String(text); this._forceShow(); }
  setTime(v){ if (this.$time) this.$time.textContent = (v|0); this._forceShow(); }
  setFeverProgress(p01){
    if (!this.$feverBar) return;
    const p = Math.max(0, Math.min(1, Number(p01)||0));
    this.$feverBar.style.width = (p * 100) + '%';
  }
  setModeLabel(text){
    const el = document.getElementById('modeLabel');
    if (el) el.textContent = String(text ?? '');
  }

  /* ================= Hydration ================= */
  showHydration(zone, needlePct){
    if (this.$hydroWrap) this.$hydroWrap.style.display = 'block';
    if (this.$hydroBarEl && zone){
      this.$hydroBarEl.setAttribute('data-zone', String(zone).toUpperCase());
    }
    if (this.$hydroNeedle && typeof needlePct === 'number'){
      const pct = Math.max(0, Math.min(100, needlePct));
      this.$hydroNeedle.style.left = pct + '%';
    }
    this._forceShow();
  }
  hideHydration(){ if (this.$hydroWrap) this.$hydroWrap.style.display='none'; }

  /* ================= Target badge ================= */
  showTarget(){
    if (this.$targetWrap){
      this.$targetWrap.style.display='inline-flex';
      this.$targetWrap.classList.remove('pulse');
      // force reflow
      // eslint-disable-next-line no-unused-expressions
      this.$targetWrap.offsetHeight;
      this.$targetWrap.classList.add('pulse','glow');
      setTimeout(()=> this.$targetWrap?.classList.remove('glow'), 800);
    }
  }
  hideTarget(){ if (this.$targetWrap) this.$targetWrap.style.display='none'; }
  setTargetBadge(text){ if (this.$target){ this.$target.textContent = text; this.showTarget(); } }

  setTarget(groupKey, have, need){
    if (!this.$target) return;
    const mapTH = { veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม' };
    const key = (mapTH[String(groupKey)] || groupKey || '—');
    if (Number.isFinite(have) && Number.isFinite(need)){
      this.$target.textContent = `${key} • ${have|0}/${need|0}`;
    } else {
      this.$target.textContent = String(key);
    }
    this.showTarget();
  }

  /* ================= Plate tracker ================= */
  hidePills(){ if (this.$plate) this.$plate.style.display='none'; }
  showPills(){ if (this.$plate) this.$plate.style.display='block'; }
  setPlatePills(pills=[]){
    if (!this.$plate || !this.$platePills) return;
    this.$plate.style.display = 'block';
    this.$platePills.innerHTML = '';
    pills.forEach(p=>{
      const row = document.createElement('div');
      row.className = 'pill' + (p.ok ? ' ok':'');

      const pct = Math.min(100, Math.max(0, p.pct|0));
      row.innerHTML = `
        <b>${p.label ?? p.key ?? ''}</b>
        <span>${pct}%</span>
        <i style="width:${pct}%"></i>
      `;
      if (p.warn) row.classList.add('warn');
      this.$platePills.appendChild(row);
    });
  }

  /* ================= Power-ups (x2/freeze/sweep/magnet/shield) ================= */
  setPowerTimers(timers){
    const wrap = this.$powerBar; if (!wrap) return;
    const KEYS = ['x2','freeze','sweep','shield']; // magnet maps to sweep
    KEYS.forEach(k=>{
      const segWrap = wrap.querySelector(`.pseg[data-k="${k}"]`);
      if(!segWrap) return;
      let seg = segWrap.querySelector('i');
      if(!seg){
        seg = document.createElement('i'); // progress rail
        seg.style.position='relative';
        seg.style.display='block';
        seg.style.height='8px';
        seg.style.borderRadius='999px';
        seg.style.background='#0c1726';
        segWrap.appendChild(seg);
      }
      let fill = seg.querySelector('.barfill');
      if(!fill){
        fill = document.createElement('b');
        fill.className = 'barfill';
        Object.assign(fill.style, {
          position:'absolute', left:'0', top:'0', bottom:'0', borderRadius:'999px', width:'0%'
        });
        seg.appendChild(fill);
      }
      const v = Math.max(0, Math.min(10, Number(timers?.[k]||0)));
      fill.style.width = (v*10) + '%';
      fill.style.background =
        (k==='x2')    ? 'linear-gradient(90deg,#ffd54a,#ff8a00)'
        : (k==='freeze') ? 'linear-gradient(90deg,#66e0ff,#4fc3f7)'
        : (k==='shield') ? 'linear-gradient(90deg,#c5b3ff,#8ad1ff)' // 💙-💜 glow
        :                   'linear-gradient(90deg,#9effa8,#7fffd4)'; // sweep/magnet
      segWrap.style.position = 'relative';
      segWrap.style.overflow = 'hidden';
    });
  }

  /* ================= Quests ================= */
  setQuestChips(list){
    if (!this.$quests) return;
    this.$quests.innerHTML = '';
    (list || []).forEach(q=>{
      const need = Number(q.need)||0;
      const prog = Number(q.progress)||0;
      const pct  = need>0 ? Math.min(100, Math.round((prog*100)/need)) : 0;

      const chip = document.createElement('div');
      chip.className = 'questChip';
      chip.innerHTML = `
        <div class="qRow" style="display:flex;justify-content:space-between;align-items:center;">
          <span class="qLabel">${q.icon||'⭐'} ${q.name||q.label||q.key||''}</span>
          <span class="qProg">${prog|0}/${need|0}</span>
        </div>
        <div class="qBar"><i style="width:${pct}%"></i></div>
      `;
      if (q.done && !q.fail) chip.classList.add('done');
      if (q.fail) chip.style.borderColor = '#ff9b9b';
      this.$quests.appendChild(chip);
    });
  }

  /* ================= Coach / Toast ================= */
  say(text, ms=1500){
    if (!this.$coachText || !this.$coachHUD) return;
    this.$coachText.textContent = String(text ?? '');
    this.$coachHUD.style.display = 'flex';
    this.$coachHUD.style.pointerEvents = 'none';
    clearTimeout(this._coachT);
    this._coachT = setTimeout(()=>{ if (this.$coachHUD) this.$coachHUD.style.display = 'none'; }, ms);
    this._forceShow();
  }
  toast(text, ms=1200){
    if (!this.$toast) return;
    this.$toast.textContent = String(text ?? '');
    this.$toast.style.display = 'block';
    this.$toast.classList.remove('show');
    // eslint-disable-next-line no-unused-expressions
    this.$toast.offsetHeight;
    this.$toast.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(()=>{
      this.$toast?.classList.remove('show');
      if (this.$toast) this.$toast.style.display = 'none';
    }, ms);
  }

  /* ================= Screen feedback ================= */
  flashDanger(){ document.body.classList.add('flash-danger'); setTimeout(()=> document.body.classList.remove('flash-danger'), 180); }
  dimPenalty(){ document.body.classList.add('dim-penalty'); setTimeout(()=> document.body.classList.remove('dim-penalty'), 350); }

  /* ================= Internals ================= */
  _applyLayerFixes(){
    if (this.$wrap){
      Object.assign(this.$wrap.style, {
        position:'fixed', top:'56px', left:'0', right:'0',
        display:'none', // hidden by default for Hub
        zIndex:'95', pointerEvents:'none', visibility:'visible', opacity:'1'
      });
    }
    if (this.$powerBar){ this.$powerBar.style.pointerEvents = 'auto'; this.$powerBar.style.userSelect='none'; }
    if (this.$coachHUD){ Object.assign(this.$coachHUD.style, { zIndex:'96', pointerEvents:'none', display:'none' }); }
    const canv = document.getElementById('c');
    if (canv){ canv.style.pointerEvents = 'none'; canv.style.zIndex = '0'; }
  }

  _forceShow(){
    if (this.$wrap){
      if (this.$wrap.style.display === 'none') return; // keep hidden on Hub
      this.$wrap.style.visibility = 'visible';
      this.$wrap.style.opacity = '1';
    }
  }

  _ensureToast(){
    const t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.style.display = 'none';
    document.body.appendChild(t);
    return t;
  }

  _ensureWrap(){
    const el = document.createElement('section');
    el.id = 'hudWrap';
    document.body.appendChild(el);
    return el;
  }

  _ensurePowerBar(){
    const host = document.getElementById('hudWrap') || this._ensureWrap();
    const bar = document.createElement('div');
    bar.id = 'powerBar';
    bar.style.cssText = 'display:flex;gap:12px;justify-content:center;align-items:center;margin:6px auto 0;padding:6px 10px;pointer-events:auto';
    bar.innerHTML = `
      <div class="pseg" data-k="x2"     style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid #19304e;background:#102038;">
        <span>⚡ x2</span><i></i>
      </div>
      <div class="pseg" data-k="freeze" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid #19304e;background:#102038;">
        <span>❄️ Freeze</span><i></i>
      </div>
      <div class="pseg" data-k="sweep"  style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid #19304e;background:#102038;">
        <span>🧲 Magnet</span><i></i>
      </div>
      <div class="pseg" data-k="shield" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid #19304e;background:#102038;">
        <span>🛡 Shield</span><i></i>
      </div>
    `;
    host.appendChild(bar);
    return bar;
  }

  /* ================= Lifecycle ================= */
  dispose(){
    clearTimeout(this._coachT);
    clearTimeout(this._toastT);
    this._coachT = 0; this._toastT = 0;
    if (this.$toast){
      try { this.$toast.classList.remove('show'); this.$toast.style.display='none'; } catch {}
    }
  }
}
