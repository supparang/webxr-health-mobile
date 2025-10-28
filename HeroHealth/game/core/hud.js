// game/core/hud.js
// Hero Health Academy — HUD (visibility & click-through fixed)

export class HUD {
  constructor () {
    // cache องค์ประกอบหลัก
    this.$wrap       = document.getElementById('hudWrap');
    this.$score      = document.getElementById('score');
    this.$combo      = document.getElementById('combo');
    this.$time       = document.getElementById('time');
    this.$feverBar   = document.getElementById('feverBar');
    this.$powerBar   = document.getElementById('powerBar');
    this.$quests     = document.getElementById('questChips');
    this.$targetWrap = document.getElementById('targetWrap');
    this.$target     = document.getElementById('targetBadge');
    this.$plate      = document.getElementById('plateTracker');
    this.$hydroWrap  = document.getElementById('hydroWrap');
    this.$hydroBarEl = document.getElementById('hydroBarEl') || document.querySelector('.hydroBar');
    this.$hydroNeedle= document.getElementById('hydroNeedle') || (this.$hydroWrap && this.$hydroWrap.querySelector('.needle'));
    this.$coachHUD   = document.getElementById('coachHUD');
    this.$coachText  = document.getElementById('coachText');
    this.$toast      = document.getElementById('toast');

    this._applyLayerFixes();
  }

  // ===== Base setters =====
  setScore(v){ if(this.$score) this.$score.textContent = v|0; this._forceShow(); }
  setCombo(text){ if(this.$combo) this.$combo.textContent = String(text); this._forceShow(); }
  setTime(v){ if(this.$time) this.$time.textContent = v|0; this._forceShow(); }
  setFeverProgress(p01){
    if(!this.$feverBar) return;
    const p = Math.max(0, Math.min(1, Number(p01)||0));
    this.$feverBar.style.width = (p*100) + '%';
  }

  // ===== Hydration =====
  showHydration(zone, needlePct){
    if(this.$hydroWrap) this.$hydroWrap.style.display = 'block';
    if(this.$hydroBarEl && zone){
      this.$hydroBarEl.setAttribute('data-zone', String(zone).toUpperCase());
    }
    if(this.$hydroNeedle && typeof needlePct === 'number'){
      const pct = Math.max(0, Math.min(100, needlePct));
      this.$hydroNeedle.style.left = pct + '%';
    }
    this._forceShow();
  }
  hideHydration(){ if(this.$hydroWrap) this.$hydroWrap.style.display = 'none'; }

  // ===== Target badge (groups / อื่น ๆ) =====
  showTarget(){ if(this.$targetWrap){ this.$targetWrap.style.display='inline-flex'; } }
  hideTarget(){ if(this.$targetWrap){ this.$targetWrap.style.display='none'; } }
  setTargetBadge(text){ if(this.$target){ this.$target.textContent = text; this.showTarget(); } }

  // ใช้ได้ทั้ง key อย่าง 'fruit' หรือชื่อไทย/อังกฤษตรง ๆ
  setTarget(groupKey, have, need){
    if(!this.$target) return;
    const mapTH = { veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม' };
    const key = (mapTH[groupKey] || groupKey || '—');
    if (typeof have==='number' && typeof need==='number'){
      this.$target.textContent = `${key} • ${have|0}/${need|0}`;
    } else {
      this.$target.textContent = String(key);
    }
    this.showTarget();
  }

  // ===== Plate tracker =====
  hidePills(){ if(this.$plate) this.$plate.style.display='none'; }
  showPills(){ if(this.$plate) this.$plate.style.display='block'; }

  // ===== Power-ups (x2/freeze/sweep) =====
  // timers: { x2:number, freeze:number, sweep:number } in seconds (0..10)
  setPowerTimers(timers){
    const wrap = this.$powerBar; if(!wrap) return;
    ['x2','freeze','sweep'].forEach(k=>{
      const seg = wrap.querySelector(`.pseg[data-k="${k}"] i`);
      if(!seg) return;
      const v = Math.max(0, Math.min(10, (timers?.[k]||0)));
      // ไม่ทำลายโครงสร้างเดิมของปุ่ม แค่ใส่ barfill ชั้นใน
      let fill = seg.querySelector('.barfill');
      if(!fill){
        fill = document.createElement('b');
        fill.className = 'barfill';
        fill.style.position = 'absolute';
        fill.style.left = '0'; fill.style.top = '0'; fill.style.bottom = '0';
        fill.style.borderRadius = '999px';
        seg.appendChild(fill);
      }
      fill.style.width = (v*10) + '%';
      fill.style.background = (k==='x2')
        ? 'linear-gradient(90deg,#ffd54a,#ff8a00)'
        : (k==='freeze'
          ? 'linear-gradient(90deg,#66e0ff,#4fc3f7)'
          : 'linear-gradient(90deg,#9effa8,#7fffd4)');
      seg.style.position = 'relative';
      seg.style.overflow = 'hidden';
    });
  }

  // ===== Mini-Quest chips =====
  // list: [{key, icon, need, progress, remain, done, fail}]
  setQuestChips(list){
    if(!this.$quests) return;
    this.$quests.innerHTML = '';
    (list||[]).forEach(q=>{
      const progPct = q.need>0 ? Math.min(100, Math.round((q.progress/q.need)*100)) : 0;
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';
      chip.innerHTML = `
        <span>${q.icon||'⭐'}</span>
        <span>${(q.progress|0)}/${(q.need|0)}</span>
        <div class="bar" style="width:80px;height:6px;border-radius:999px;overflow:hidden;border:1px solid #1c2a4d;background:#0e1730;">
          <div style="width:${progPct}%;height:100%;background:${q.done && !q.fail ? 'linear-gradient(90deg,#41f1a3,#a3ffcf)':'linear-gradient(90deg,#7da7ff,#43e3ff)'}"></div>
        </div>
        <span>⏱ ${Math.max(0, q.remain|0)}s</span>
      `;
      if(q.done && !q.fail) chip.style.borderColor = '#7fffd4';
      if(q.fail) chip.style.borderColor = '#ff9b9b';
      this.$quests.appendChild(chip);
    });
  }

  // ===== Coach speech / Toast =====
  say(text, ms=1500){
    if(!this.$coachText || !this.$coachHUD) return;
    this.$coachText.textContent = text;
    this.$coachHUD.style.display = 'flex';
    this.$coachHUD.style.pointerEvents = 'none';
    clearTimeout(this._coachT);
    this._coachT = setTimeout(()=>{ this.$coachHUD.style.display = 'none'; }, ms);
    this._forceShow();
  }

  toast(text, ms=1200){
    if(!this.$toast) return;
    this.$toast.textContent = text;
    this.$toast.style.display = 'block';
    this.$toast.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(()=>{
      this.$toast.classList.remove('show');
      this.$toast.style.display = 'none';
    }, ms);
  }

  // ===== Screen feedback =====
  flashDanger(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
  }
  dimPenalty(){
    document.body.classList.add('dim-penalty');
    setTimeout(()=>document.body.classList.remove('dim-penalty'), 350);
  }

  // ===== Internal: make sure HUD never gets hidden or blocks clicks =====
  _applyLayerFixes(){
    // HUD วางสูง แตะคลิกทะลุ (ยกเว้น power bar)
    if(this.$wrap){
      this.$wrap.style.position = 'fixed';
      this.$wrap.style.top = '56px';
      this.$wrap.style.left = '0';
      this.$wrap.style.right = '0';
      this.$wrap.style.display = 'flex';
      this.$wrap.style.flexDirection = 'column';
      this.$wrap.style.alignItems = 'center';
      this.$wrap.style.gap = '6px';
      this.$wrap.style.zIndex = '95';
      this.$wrap.style.pointerEvents = 'none';
      this.$wrap.style.visibility = 'visible';
      this.$wrap.style.opacity = '1';
    }
    if(this.$powerBar){
      this.$powerBar.style.pointerEvents = 'auto';
    }
    if(this.$coachHUD){
      this.$coachHUD.style.zIndex = '96';
      this.$coachHUD.style.pointerEvents = 'none';
      this.$coachHUD.style.display = 'flex';
    }
    // กัน canvas/scene ไม่บังคลิก
    const canv = document.getElementById('c');
    if (canv){ canv.style.pointerEvents = 'none'; canv.style.zIndex = '0'; }
  }

  _forceShow(){
    // บังคับให้กลุ่มหลักไม่โดน display:none โดยสไตล์อื่น
    if(this.$wrap){
      this.$wrap.style.visibility = 'visible';
      this.$wrap.style.opacity = '1';
    }
    // ทำให้แถบคะแนน/เวลาโผล่ชัด
    const cards = this.$wrap && this.$wrap.querySelectorAll('.cardlike');
    cards && cards.forEach(c=>{ c.style.display = 'inline-flex'; });
  }
}
