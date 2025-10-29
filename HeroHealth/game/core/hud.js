// === Hero Health Academy — core/hud.js (2025-10-30, quests+safe overlay) ===
export class HUD {
  constructor() {
    this.$score = document.getElementById('score');
    this.$time  = document.getElementById('time');
    this.$toast = document.getElementById('toast');
    this.$coach = document.getElementById('coachHUD');
    this.$coachText = document.getElementById('coachText');

    // Quest bar host
    this.$qbar  = document.getElementById('questBar');
    this.$qwrap = document.getElementById('questChips');

    // ป้องกันการบังคลิก: HUD ทั้งหมด pointer-events:none ยกเว้นปุ่มที่จำเป็น
    const hudWrap = document.getElementById('hudWrap');
    if (hudWrap) hudWrap.style.pointerEvents = 'none';
    if (this.$qbar)  this.$qbar.style.pointerEvents  = 'none';
    if (this.$qwrap) this.$qwrap.style.pointerEvents = 'none';
  }

  dispose() {
    clearTimeout(this._t1); clearTimeout(this._t2);
    this._t1 = this._t2 = null;
  }

  setScore(v){ if (this.$score) this.$score.textContent = String(v|0); }
  setTime(v){  if (this.$time)  this.$time.textContent  = String(v|0); }

  setCombo(text){
    // โชว์คอมโบถ้าต้องการเพิ่ม สามารถวางไว้ใน pill เดียวกับคะแนนได้
    // ตัวอย่าง: เพิ่ม title attribute
    if (this.$score) this.$score.title = `Combo ${text||''}`;
  }

  // FEVER & Power (optional plumbing)
  setFeverProgress(p01){ /* ถ้าต้องการโชว์แถบ สามารถเติมทีหลัง */ }
  setPowerTimers(obj){ /* hook ให้ HUD แปลค่าถ้าทำแถบพลังงาน */ }

  say(text, ms=900){
    if (!this.$coachText || !this.$coach) return;
    this.$coachText.textContent = text;
    this.$coach.style.display = 'flex';
    clearTimeout(this._t1);
    this._t1 = setTimeout(()=>{ this.$coach.style.display='none'; }, ms);
  }

  toast(text, ms=900){
    if (!this.$toast) return;
    this.$toast.textContent = text;
    this.$toast.classList.add('show');
    clearTimeout(this._t2);
    this._t2 = setTimeout(()=> this.$toast.classList.remove('show'), ms);
  }

  flashDanger(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
  }

  // ---------- Quests HUD ----------
  setQuestChips(chips=[]) {
    if (!this.$qwrap) return;
    // สร้างสไตล์เล็ก ๆ รอบเดียว
    if (!document.getElementById('qchipStyle')) {
      const css = document.createElement('style');
      css.id = 'qchipStyle';
      css.textContent = `
        #questBar{position:absolute;left:50%;top:38px;transform:translateX(-50%);width:min(980px,96vw);z-index:95}
        #questChips{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
        .qchip{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;
               background:#0e1b30e6;border:1px solid #19304e;color:#eaf6ff;font:800 12px ui-rounded;
               box-shadow:0 6px 16px rgba(0,0,0,.25)}
        .qchip i{font-style:normal}
        .qchip b{font:900 12px ui-rounded}
        .qchip small{opacity:.8}
        .qchip.done{background:#0f2a25;border-color:#2dd4bf80}
        .qchip.fail{opacity:.55;filter:grayscale(0.2)}
      `;
      document.head.appendChild(css);
    }
    const html = chips.map(c=>{
      const prog = Math.min(c.progress|0, c.need|0);
      return `<li class="qchip ${c.done?'done':''} ${c.fail?'fail':''}" data-q="${c.key}">
        <i>${c.icon||'⭐'}</i>
        <b>${c.label||c.key}</b>
        <small>${prog}/${c.need|0}</small>
      </li>`;
    }).join('');
    this.$qwrap.innerHTML = html;
  }

  markQuestDone(qid){
    const el = this.$qwrap?.querySelector?.(`[data-q="${CSS.escape(qid)}"]`);
    if (el) el.classList.add('done');
    this.toast('✓ Quest!', 900);
  }

  // Hydration helpers (called by hydration.js)
  showHydration(zone, pct){
    // สามารถวาดบน #hydroWrap (สร้างโดยโหมด hydration) แล้วปล่อย HUD ทำแค่ชุดข้อความ
    const z = String(zone||'').toUpperCase();
    if (z==='HIGH')      this.say('💧 High', 600);
    else if (z==='LOW')  this.say('💧 Low', 600);
  }

  hideHydration(){ /* noop */ }
}
