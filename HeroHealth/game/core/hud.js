// === Hero Health Academy — core/hud.js (2025-10-29, quests detail ready) ===

export class HUD {
  constructor() {
    // Base DOM
    this.$score       = document.getElementById('score');
    this.$time        = document.getElementById('time');
    this.$toast       = document.getElementById('toast');
    this.$coach       = document.getElementById('coachHUD');
    this.$coachText   = document.getElementById('coachText');
    this.$targetWrap  = document.getElementById('targetWrap');
    this.$targetBadge = document.getElementById('targetBadge');
    this.$missionLine = document.getElementById('missionLine');

    // Quests area
    this.$questBar   = document.getElementById('questBar') || this._ensureQuestBar();
    this.$questChips = document.getElementById('questChips') || this._ensureQuestUL();

    // Fever / Power (optional UI hooks)
    this.$feverBar = this._ensureFeverBar();
    this.$powerBar = this._ensurePowerBar();

    this._tos = { toast:0, say:0 };
    this._questIdx = new Map(); // qid -> li
  }

  /* ---------- Basic HUD ---------- */
  setScore(n){ if(this.$score) this.$score.textContent = n|0; }
  setTime(n){  if(this.$time)  this.$time.textContent  = n|0; }

  setCombo(text){
    if(!text) return;
    this.toast(`Combo ${text}`, 420);
  }

  /* ---------- Target ---------- */
  setTarget(txt){
    if(!this.$targetWrap || !this.$targetBadge) return;
    this.$targetBadge.textContent = txt || '—';
    this.$targetWrap.style.display = txt ? 'inline-flex' : 'none';
  }

  /* ---------- Quests (detailed chips) ---------- */
  setQuestChips(chips = []) {
    if (!this.$questChips) return;

    // ถ้ารูปแบบเป็นสตริงล้วน ให้แปลงเป็นโครงสร้างง่าย ๆ
    const items = Array.isArray(chips) ? chips : [];
    const norm = items.map((c, i) => {
      if (typeof c === 'string') return { key: 'q_'+i, icon:'⭐', label:c, need:1, progress:0, done:false, fail:false, remain:0 };
      return {
        key: c.key || c.id || ('q_'+i),
        icon: c.icon || '⭐',
        label: c.label || '—',
        need: (c.need|0) || 0,
        progress: (c.progress|0) || (c.prog|0) || 0,
        done: !!c.done,
        fail: !!c.fail,
        remain: (c.remain|0) || 0
      };
    });

    // build/patch DOM
    // เก็บแผนที่ไอเท็มเดิมไว้เพื่อ reuse li ลด reflow
    const alive = new Set();
    for (const q of norm) {
      let li = this._questIdx.get(q.key);
      if (!li) {
        li = this._makeQuestChip(q);
        this.$questChips.appendChild(li);
        this._questIdx.set(q.key, li);
      }
      this._updateQuestChip(li, q);
      alive.add(q.key);
    }
    // ลบของที่ไม่อยู่แล้ว
    for (const [qid, li] of this._questIdx.entries()) {
      if (!alive.has(qid)) {
        try { li.remove(); } catch {}
        this._questIdx.delete(qid);
      }
    }
  }

  markQuestDone(qid){
    const li = this._questIdx.get(qid);
    if (!li) return;
    li.dataset.state = 'done';
    // pulse effect
    li.style.animation = 'questPulse .6s ease';
    setTimeout(()=>{ li.style.animation='none'; }, 650);
  }

  _makeQuestChip(q){
    const li = document.createElement('li');
    li.className = 'pill quest';
    li.style.cssText = `
      display:inline-flex; align-items:center; gap:8px;
      padding:6px 10px; margin:0 6px 6px 0; pointer-events:none;
      background:#102038e0; border:1px solid #1a2c47b0; border-radius:999px;
      font:800 12px ui-rounded; color:#eaf6ff;
    `;
    li.innerHTML = `
      <span class="qicon" style="font-size:14px">${q.icon||'⭐'}</span>
      <span class="qlabel" style="max-width:46vw; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${q.label||'—'}</span>
      <span class="qstat" style="opacity:.9"></span>
      <span class="qtime" style="opacity:.7"></span>
      <span class="qbadge" hidden style="background:#1b423b;color:#c8fff8;border:1px solid #2dd4bf80;padding:2px 6px;border-radius:999px;font:900 10px ui-rounded">DONE</span>
      <div class="qbar" style="position:relative;width:120px;height:6px;border-radius:999px;background:#0b1728;border:1px solid #143052">
        <i class="qfill" style="position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:999px;background:linear-gradient(90deg,#42f9da,#22c1a5)"></i>
      </div>
    `;
    return li;
  }
  _updateQuestChip(li, q){
    li.dataset.state = q.done ? 'done' : (q.fail ? 'fail' : 'run');

    const pct = (q.need>0) ? Math.max(0, Math.min(100, Math.round((q.progress/q.need)*100))) : 0;
    const fill = li.querySelector('.qfill');
    const stat = li.querySelector('.qstat');
    const lab  = li.querySelector('.qlabel');
    const icn  = li.querySelector('.qicon');
    const tme  = li.querySelector('.qtime');
    const bdg  = li.querySelector('.qbadge');

    if (lab) lab.textContent = q.label || '—';
    if (icn) icn.textContent = q.icon || '⭐';
    if (stat) stat.textContent = (q.need>0) ? `(${q.progress|0}/${q.need|0})` : '';
    if (tme)  tme.textContent  = q.remain ? `· ${q.remain|0}s` : '';
    if (fill) fill.style.width = pct + '%';

    if (q.done) {
      li.style.opacity = '1';
      if (bdg) bdg.hidden = false;
      li.style.borderColor = '#2dd4bf80';
    } else if (q.fail) {
      if (bdg) { bdg.hidden = false; bdg.textContent = 'X'; bdg.style.background='#3b1020'; bdg.style.color='#ffdfe9'; }
      li.style.opacity = '.65';
      li.style.borderColor = '#43223a';
    } else {
      if (bdg) bdg.hidden = true;
      li.style.opacity = '1';
      li.style.borderColor = '#1a2c47b0';
    }
  }

  /* ---------- Toast / Coach ---------- */
  toast(text, ms=900){
    const el=this.$toast||this._ensureToast();
    el.textContent=String(text||'');
    el.classList.add('show');
    clearTimeout(this._tos.toast);
    this._tos.toast=setTimeout(()=>{ try{el.classList.remove('show');}catch{} },ms|0);
  }

  say(text, ms=900){
    if(!this.$coach||!this.$coachText) return;
    this.$coachText.textContent=String(text||'');
    this.$coach.style.display='flex';
    clearTimeout(this._tos.say);
    this._tos.say=setTimeout(()=>{ try{this.$coach.style.display='none';}catch{} },ms|0);
  }

  /* ---------- Effects / Feedback ---------- */
  flashDanger(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'),180);
  }
  dimPenalty(){ this.flashDanger(); }

  /* ---------- Hydration HUD hooks (left as integration points) ---------- */
  showHydration(/*zone,pct*/){ /* hydration.js จัดการ DOM เฉพาะเอง */ }
  hideHydration(){}

  /* ---------- Fever / Power timers (used by main.js) ---------- */
  setFeverProgress(p01){
    // สร้างเส้นบาง ๆ ใต้ HUD ถ้ายังไม่มี
    if (!this.$feverBar) this.$feverBar = this._ensureFeverBar();
    const w = Math.max(0, Math.min(100, Math.round((+p01||0)*100)));
    this.$feverFill.style.width = w + '%';
  }

  setPowerTimers(timers = {}) {
    // แสดงเป็นจุด ๆ 4 ตัว (x2 / freeze / sweep / shield)
    if (!this.$powerBar) this.$powerBar = this._ensurePowerBar();
    const keys = ['x2','freeze','sweep','shield'];
    keys.forEach(k=>{
      const dot = this.$powerDots[k];
      const v   = timers[k] || 0;
      dot.style.opacity = v>0 ? '1' : '.25';
      dot.title = v>0 ? `${k}: ${Math.ceil(v)}s` : k;
    });
  }

  /* ---------- Utility ---------- */
  dispose(){
    clearTimeout(this._tos.toast); clearTimeout(this._tos.say);
    try{ if(this.$coach) this.$coach.style.display='none'; }catch{}
    try{ if(this.$toast) this.$toast.classList.remove('show'); }catch{}
  }

  _ensureToast(){
    const el=document.createElement('div');
    el.id='toast'; el.className='toast';
    el.style.pointerEvents='none';
    document.body.appendChild(el);
    this.$toast=el;
    return el;
  }

  _ensureQuestBar(){
    const bar = document.createElement('div');
    bar.id = 'questBar';
    bar.style.cssText = 'position:absolute;left:50%;top:-8px;transform:translateX(-50%);width:min(980px,96vw);';
    document.body.appendChild(bar);
    return bar;
  }
  _ensureQuestUL(){
    const ul = document.createElement('ul');
    ul.id = 'questChips';
    ul.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;';
    (this.$questBar||document.body).appendChild(ul);
    return ul;
  }

  _ensureFeverBar(){
    const host = document.getElementById('hudWrap') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'feverLine';
    wrap.style.cssText = 'position:absolute;left:50%;top:48px;transform:translateX(-50%);width:min(980px,96vw);height:6px;border-radius:999px;background:#0b1728;border:1px solid #143052;pointer-events:none';
    const fill = document.createElement('i');
    fill.style.cssText = 'display:block;height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#ffd54a,#ff9f43)';
    wrap.appendChild(fill);
    host.appendChild(wrap);
    this.$feverFill = fill;
    return wrap;
  }

  _ensurePowerBar(){
    const host = document.getElementById('hudWrap') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'powerDots';
    wrap.style.cssText = 'position:absolute;right:12px;top:28px;display:flex;gap:6px;pointer-events:none';
    const mk = (id)=>{ const d=document.createElement('i'); d.id='pow_'+id; d.style.cssText='width:10px;height:10px;border-radius:50%;background:#42f9da;opacity:.25;border:1px solid #1a2c47'; return d; };
    const dots = { x2: mk('x2'), freeze: mk('freeze'), sweep: mk('sweep'), shield: mk('shield') };
    Object.values(dots).forEach(d=>wrap.appendChild(d));
    host.appendChild(wrap);
    this.$powerDots = dots;
    return wrap;
  }
}

/* ---------- Floating text FX ---------- */
export const fx = {
  popText(text,{x=0,y=0,ms=720}={}){
    const el=document.createElement('div');
    el.textContent=text;
    el.style.cssText=`
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      font:900 14px ui-rounded;color:#eaf6ff;text-shadow:0 2px 10px #000a;
      background:#102038cc;border:1px solid #1a2c47;
      padding:6px 10px;border-radius:10px;z-index:120;
      pointer-events:none;opacity:1;transition:transform .7s,opacity .7s`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-110%)'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch{} },ms|0);
  }
};

/* ---------- Coach hooks (เพื่อความเข้ากันได้กับ main.js) ---------- */
export const coach = { onStart(){}, onGood(){}, onBad(){} };

/* ---------- Keyframes (pulse) ---------- */
try {
  const style = document.createElement('style');
  style.textContent = `
  @keyframes questPulse { 0%{transform:scale(1)} 50%{transform:scale(1.06)} 100%{transform:scale(1)} }`;
  document.head.appendChild(style);
} catch {}
