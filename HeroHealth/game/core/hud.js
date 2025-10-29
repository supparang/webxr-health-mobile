// === Hero Health Academy — core/hud.js (2025-10-29 stable) ===
// ครอบคลุม HUD ทุกส่วนใน index.html และเพิ่ม export coach ให้ main.js เรียกได้

export class HUD {
  constructor() {
    // ---- Cache DOM Elements ----
    this.$score        = document.getElementById('score');
    this.$time         = document.getElementById('time');
    this.$toast        = document.getElementById('toast');
    this.$coach        = document.getElementById('coachHUD');
    this.$coachText    = document.getElementById('coachText');
    this.$targetWrap   = document.getElementById('targetWrap');
    this.$targetBadge  = document.getElementById('targetBadge');
    this.$questChips   = document.getElementById('questChips');
    this.$missionLine  = document.getElementById('missionLine');
    this._tos = { toast:0, say:0 };
  }

  /* ---------- Basic HUD ---------- */
  setScore(n){ if(this.$score) this.$score.textContent = n|0; }
  setTime(n){  if(this.$time)  this.$time.textContent  = n|0; }

  setCombo(text){
    if(!text) return;
    this.toast(`Combo ${text}`, 420);
  }

  /* ---------- Target / Quest ---------- */
  setTarget(txt){
    if(!this.$targetWrap || !this.$targetBadge) return;
    this.$targetBadge.textContent = txt || '—';
    this.$targetWrap.style.display = txt ? 'inline-flex' : 'none';
  }

  setQuestChips(labels=[]){
    if(!this.$questChips) return;
    this.$questChips.innerHTML = '';
    (labels||[]).forEach((t)=>{
      const li=document.createElement('li');
      li.className='pill';
      li.textContent=t;
      this.$questChips.appendChild(li);
    });
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

  /* ---------- Hydration HUD hooks (ปล่อยไว้ให้ hydration.js ใช้) ---------- */
  showHydration(zone='OK',pct=50){ /* handled in hydration.js */ }
  hideHydration(){ /* noop */ }

  /* ---------- Utility ---------- */
  dispose(){
    clearTimeout(this._tos.toast); clearTimeout(this._tos.say);
    try{ if(this.$coach) this.$coach.style.display='none'; }catch{}
    try{ if(this.$toast) this.$toast.classList.remove('show'); }catch{}
  }

  _ensureToast(){
    const el=document.createElement('div');
    el.id='toast'; el.className='toast';
    document.body.appendChild(el);
    this.$toast=el;
    return el;
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
      pointer-events:none;opacity:1;
      transition:transform .7s,opacity .7s`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-110%)'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch{} },ms|0);
  }
};

/* ---------- Coach hooks (ใหม่ เพื่อแก้ import error) ---------- */
export const coach = {
  onStart(){ /* เรียกเมื่อเริ่มเกม */ },
  onGood(){ /* เรียกเมื่อกดถูก */ },
  onBad(){  /* เรียกเมื่อกดผิด */ }
};
