// game/core/hud.js
// Hero Health Academy — HUD (visibility, layering & click-through fixed + quests & power timers)

export class HUD {
  constructor () {
    // ---- Cache DOM ----
    this.$wrap       = document.getElementById('hudWrap') || this._ensureWrap();
    this.$score      = document.getElementById('score');
    this.$combo      = document.getElementById('combo');
    this.$time       = document.getElementById('time');
    this.$feverBar   = document.getElementById('feverBar');

    this.$powerBar   = document.getElementById('powerBar');

    this.$quests     = document.getElementById('questChips');

    this.$targetWrap = document.getElementById('targetWrap');
    this.$target     = document.getElementById('targetBadge');

    this.$plate      = document.getElementById('plateTracker');
    this.$platePills = document.getElementById('platePills') || (this.$plate && this.$plate.querySelector('#platePills'));

    this.$hydroWrap  = document.getElementById('hydroWrap');
    // รองรับทั้ง #hydroBar (ตาม index ล่าสุด) และ .hydroBar (ตาม CSS)
    this.$hydroBarEl = document.getElementById('hydroBar') || document.getElementById('hydroBarEl') || document.querySelector('.hydroBar');
    // เข็มอาจมี id="hydroNeedle" หรือเป็น .needle ภายใน hydroBar
    this.$hydroNeedle= document.getElementById('hydroNeedle') || (this.$hydroWrap && this.$hydroWrap.querySelector('.needle'));

    this.$coachHUD   = document.getElementById('coachHUD');
    this.$coachText  = document.getElementById('coachText');

    this.$toast      = document.getElementById('toast') || this._ensureToast();

    // ARIA ช่วยการเข้าถึง
    try {
      this.$toast.setAttribute('role','status');
      this.$toast.setAttribute('aria-live','polite');
      if (this.$coachHUD) {
        this.$coachHUD.setAttribute('role','status');
        this.$coachHUD.setAttribute('aria-live','polite');
      }
    } catch {}

    // timers ภายใน
    this._coachT = 0;
    this._toastT = 0;

    this._applyLayerFixes();
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
  hideHydration(){ if (this.$hydroWrap) this.$hydroWrap.style.display = 'none'; }

  /* ================= Target badge (groups / others) ================= */
  showTarget(){
    if (this.$targetWrap){
      this.$targetWrap.style.display='inline-flex';
      // pulse สั้น ๆ ให้สะดุดตา (CSS มี .pulse / .glow รองรับ)
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

  // groupKey: 'fruit' | 'veggies' | ... หรือชื่อไทย/อังกฤษตรง ๆ
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
  /** pills: [{key:'fruit', label:'ผลไม้', ok:true, pct:0..100}] */
  setPlatePills(pills=[]){
    if (!this.$plate || !this.$platePills) return;
    this.$plate.style.display = 'block';
    this.$platePills.innerHTML = '';
    pills.forEach(p=>{
      const row = document.createElement('div');
      row.className = 'pill' + (p.ok ? ' ok':'');
      row.innerHTML = `
        <b>${p.label ?? p.key ?? ''}</b>
        <span>${Math.min(100, Math.max(0, p.pct|0))}%</span>
        <i style="width:${Math.min(100, Math.max(0, p.pct|0))}%"></i>
      `;
      if (p.warn) row.classList.add('warn');
      this.$platePills.appendChild(row);
    });
  }

  /* ================= Power-ups (x2/freeze/sweep) =================
     timers: { x2:number, freeze:number, sweep:number } in seconds (0..10)
  ================================================================= */
  setPowerTimers(timers){
    const wrap = this.$powerBar; if (!wrap) return;
    ['x2','freeze','sweep'].forEach(k=>{
      const segWrap = wrap.querySelector(`.pseg[data-k="${k}"]`);
      if(!segWrap) return;
      let seg = segWrap.querySelector('i');
      if(!seg){
        seg = document.createElement('i'); // fallback ตามสไตล์เดิม
        segWrap.appendChild(seg);
      }
      const v = Math.max(0, Math.min(10, Number(timers?.[k]||0)));
      let fill = seg.querySelector('.barfill');
      if(!fill){
        fill = document.createElement('b');
        fill.className = 'barfill';
        Object.assign(fill.style, {
          position:'absolute', left:'0', top:'0', bottom:'0', borderRadius:'999px', width:'0%'
        });
        seg.appendChild(fill);
      }
      fill.style.width = (v*10) + '%';
      fill.style.background = (k==='x2')
        ? 'linear-gradient(90deg,#ffd54a,#ff8a00)'
        : (k==='freeze'
          ? 'linear-gradient(90deg,#66e0ff,#4fc3f7)'
          : 'linear-gradient(90deg,#9effa8,#7fffd4)');
      segWrap.style.position = 'relative';
      segWrap.style.overflow = 'hidden';
    });
  }

  /* ================= Mini-Quest chips =================
     list: [{ key, name, icon, need, progress, remain, done, fail }]
     สอดคล้อง CSS: .questChip / .qLabel / .qProg / .qBar > i
  ====================================================== */
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
          <span class="qLabel">${q.icon||'⭐'} ${q.name||q.key||''}</span>
          <span class="qProg">${prog|0}/${need|0}</span>
        </div>
        <div class="qBar"><i style="width:${pct}%"></i></div>
      `;

      if (q.done && !q.fail) chip.classList.add('done');
      if (q.fail) chip.style.borderColor = '#ff9b9b';

      this.$quests.appendChild(chip);
    });
  }

  /* ================= Coach speech / Toast ================= */
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
    // restart transition
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
  flashDanger(){
    document.body.classList.add('flash-danger');
    setTimeout(()=> document.body.classList.remove('flash-danger'), 180);
  }
  dimPenalty(){
    document.body.classList.add('dim-penalty');
    setTimeout(()=> document.body.classList.remove('dim-penalty'), 350);
  }

  /* ================= Internals ================= */
  _applyLayerFixes(){
    // HUD ลอยบน ไม่กันคลิก (ยกเว้น power bar)
    if (this.$wrap){
      Object.assign(this.$wrap.style, {
        position:'fixed', top:'56px', left:'0', right:'0',
        display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
        zIndex:'95', pointerEvents:'none', visibility:'visible', opacity:'1'
      });
    }
    if (this.$powerBar){ this.$powerBar.style.pointerEvents = 'auto'; }
    if (this.$coachHUD){
      Object.assign(this.$coachHUD.style, { zIndex:'96', pointerEvents:'none', display:'flex' });
    }
    // กัน canvas ไม่บังคลิก
    const canv = document.getElementById('c');
    if (canv){ canv.style.pointerEvents = 'none'; canv.style.zIndex = '0'; }
  }

  _forceShow(){
    if (this.$wrap){
      this.$wrap.style.visibility = 'visible';
      this.$wrap.style.opacity = '1';
      const cards = this.$wrap.querySelectorAll?.('.cardlike');
      cards?.forEach(c => { c.style.display = 'inline-flex'; });
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
