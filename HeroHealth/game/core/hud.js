// game/core/hud.js
// Hero Health Academy — HUD (Smart Power Timers, visibility, layering & click-through fixed + quests)

export class HUD {
  constructor () {
    // ---- Cache DOM ----
    this.$wrap       = document.getElementById('hudWrap') || this._ensureWrap();
    this.$score      = document.getElementById('score');
    this.$combo      = document.getElementById('combo');
    this.$time       = document.getElementById('time');
    this.$feverBar   = document.getElementById('feverBar');

    this.$powerBar   = document.getElementById('powerBar');
    this._ensurePowerBar();            // << NEW: สร้าง power bar + segments อัตโนมัติ
    this._ensurePowerbarStyles();      // << NEW: ฉีด CSS เฉพาะส่วน (pulse/glow/สี)

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
  hideHydration(){ if (this.$hydroWrap) this.$hydroWrap.style.display='none'; }

  /* ================= Target badge (groups / others) ================= */
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
      row.innerHTML = `
        <b>${p.label ?? p.key ?? ''}</b>
        <span>${Math.min(100, Math.max(0, p.pct|0))}%</span>
        <i style="width:${Math.min(100, Math.max(0, p.pct|0))}%"></i>
      `;
      if (p.warn) row.classList.add('warn');
      this.$platePills.appendChild(row);
    });
  }

  /* ================= Power-ups (SMART) =================
     - แสดงชื่อ/ไอคอน + เวลาถอยหลัง + glow/pulse ตอนทำงาน
     - เตือนสีส้ม/แดงเมื่อเหลือ <3s
     - สร้าง segment อัตโนมัติ ถ้าไม่มีใน DOM
  ====================================================== */
  setPowerTimers(timers){
    const wrap = this.$powerBar; if (!wrap) return;
    const DEF = {
      x2:     { icon:'⚡', name:'x2',     grad:'linear-gradient(90deg,#ffd54a,#ff8a00)' },
      freeze: { icon:'❄️',name:'Freeze', grad:'linear-gradient(90deg,#66e0ff,#4fc3f7)' },
      sweep:  { icon:'🧲',name:'Magnet', grad:'linear-gradient(90deg,#9effa8,#7fffd4)' },
    };

    ['x2','freeze','sweep'].forEach(k=>{
      const seg = wrap.querySelector(`.pseg[data-k="${k}"]`) || this._mkPseg(k, DEF[k].icon, DEF[k].name);
      const v = Math.max(0, Math.min(10, Number(timers?.[k]||0))); // seconds (cap 10)
      const fill = seg.querySelector('.barfill');
      const ttxt = seg.querySelector('.ptime');

      // width & color
      fill.style.width = (v*10) + '%';
      fill.style.background = DEF[k].grad;

      // label time
      ttxt.textContent = v > 0 ? `${v|0}s` : '';

      // active state + glow
      if (v > 0){
        seg.classList.add('active');     // pulse/glow
        seg.style.opacity = '1';
        // low-time color shift
        if (v <= 3){
          seg.classList.add('low');      // สีเตือน
        } else {
          seg.classList.remove('low');
        }
      } else {
        seg.classList.remove('active','low');
        fill.style.width = '0%';
        seg.style.opacity = '.55';
      }
    });
  }

  /* ================= Mini-Quest chips ================= */
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

  /* ---------- NEW: Power bar builder + styles ---------- */
  _ensurePowerBar(){
    if (!this.$powerBar){
      const bar = document.createElement('div');
      bar.id = 'powerBar';
      Object.assign(bar.style, {
        display:'flex', gap:'8px', alignItems:'center',
        background:'rgba(16,32,56,.72)', border:'1px solid #1a2c47b0',
        padding:'6px 8px', borderRadius:'999px'
      });
      // place under score/time row if possible
      const scoreTime = document.getElementById('scoreTime');
      if (scoreTime && scoreTime.parentNode){
        scoreTime.parentNode.insertBefore(bar, scoreTime.nextSibling);
      } else {
        this.$wrap.appendChild(bar);
      }
      this.$powerBar = bar;
    }

    // build segments if missing
    const want = [
      { k:'x2', icon:'⚡', name:'x2' },
      { k:'freeze', icon:'❄️', name:'Freeze' },
      { k:'sweep', icon:'🧲', name:'Magnet' },
    ];
    want.forEach(({k,icon,name})=>{
      if (!this.$powerBar.querySelector(`.pseg[data-k="${k}"]`)){
        this._mkPseg(k, icon, name);
      }
    });
  }

  _mkPseg(k, icon, name){
    const seg = document.createElement('div');
    seg.className = 'pseg';
    seg.dataset.k = k;
    Object.assign(seg.style, {
      display:'inline-flex', alignItems:'center', gap:'6px',
      padding:'6px 8px', borderRadius:'999px',
      border:'1px solid #19304e', background:'#0f213a',
      position:'relative', overflow:'hidden', opacity:'.55'
    });

    const ico = document.createElement('span');
    ico.className = 'picon';
    ico.textContent = icon || '✨';
    Object.assign(ico.style, { fontSize:'14px', lineHeight:'1' });

    const lbl = document.createElement('span');
    lbl.className = 'plbl';
    lbl.textContent = name || k;
    Object.assign(lbl.style, { font:'800 12px ui-rounded', opacity:.9 });

    const meter = document.createElement('i');
    meter.className = 'bar';
    Object.assign(meter.style, {
      position:'relative', height:'8px', width:'78px',
      borderRadius:'999px', background:'rgba(255,255,255,.08)',
      boxShadow:'inset 0 1px 0 rgba(255,255,255,.15), inset 0 -1px 0 rgba(0,0,0,.25)'
    });

    const fill = document.createElement('b');
    fill.className = 'barfill';
    Object.assign(fill.style, {
      position:'absolute', left:0, top:0, bottom:0, width:'0%',
      borderRadius:'999px', transition:'width .25s ease'
    });
    meter.appendChild(fill);

    const t = document.createElement('em');
    t.className = 'ptime';
    t.textContent = '';
    Object.assign(t.style, { font:'800 11px ui-rounded', opacity:.85 });

    seg.appendChild(ico);
    seg.appendChild(lbl);
    seg.appendChild(meter);
    seg.appendChild(t);

    this.$powerBar.appendChild(seg);
    return seg;
  }

  _ensurePowerbarStyles(){
    if (document.getElementById('hud-powerbar-css')) return;
    const css = document.createElement('style');
    css.id = 'hud-powerbar-css';
    css.textContent = `
      @keyframes hhaPulse { 0%{box-shadow:0 0 0 0 rgba(55,227,198,.0)} 50%{box-shadow:0 0 0 6px rgba(55,227,198,.14)} 100%{box-shadow:0 0 0 0 rgba(55,227,198,.0)} }
      #powerBar .pseg.active { animation:hhaPulse 1.2s ease-in-out infinite; border-color:#2dd4bf80; }
      #powerBar .pseg.low .bar { background:rgba(255,160,122,.18) !important; }
      #powerBar .pseg.low .barfill { filter:saturate(1.25) brightness(1.05); }
    `;
    document.head.appendChild(css);
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
