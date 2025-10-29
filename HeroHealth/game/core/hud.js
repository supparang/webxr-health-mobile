// === Hero Health Academy — core/hud.js (v2: quests v2-compatible) ===
// ใช้กับ index.html (มี #score, #time, #questBar>#questChips, #coachHUD/#coachText, #toast)

export class HUD {
  constructor(){
    this.$score = byId('score');
    this.$time  = byId('time');
    this.$chips = byId('questChips'); // <ul>
    this.$coach = byId('coachHUD');
    this.$coachText = byId('coachText');
    this.$toast = byId('toast');
    this._to = { coach:0, toast:0 };

    const hudWrap = byId('hudWrap');
    if (hudWrap) hudWrap.style.pointerEvents = 'none';
  }

  /* -------- Score/Time -------- */
  setScore(v){ if (this.$score) this.$score.textContent = String(v|0); }
  setTime(v){  if (this.$time)  this.$time.textContent  = String(v|0); }
  setCombo(/*txt*/){}
  setFeverProgress(/*pct01*/){}
  setPowerTimers(/*timers*/){}

  /* -------- Quests (รองรับสคีมาเก่า/ใหม่) -------- */
  setQuestChips(arr){
    if (!this.$chips) return;
    const list = Array.isArray(arr) ? arr : [];
    const html = list.map((q, i) => {
      const id   = q.id ?? q.key ?? ('q_'+i);
      const icon = q.icon ?? '⭐';
      const lab  = q.text ?? q.label ?? 'Quest';
      const prog = (q.prog ?? q.progress ?? 0) | 0;
      const need = (q.need ?? 0) | 0;
      const done = !!q.done;
      const fail = !!q.fail;
      const cls  = ['pill']; if (done) cls.push('ok'); if (fail && !done) cls.push('dim');

      const meterPct = need>0 ? Math.min(100, Math.max(0, (prog/need)*100)) : (done?100:0);
      const meter = need>0
        ? `<i style="display:inline-block;vertical-align:middle;height:6px;width:${meterPct}%;background:#42f9da;border-radius:999px;margin-left:8px"></i>`
        : '';

      return `<li class="${cls.join(' ')}" data-qid="${cssSel(id)}">
        <span>${icon}</span>
        <b style="margin:0 6px">${esc(lab)}</b>
        <small>${prog}${need?('/'+need):''}</small>
        ${meter}
      </li>`;
    }).join('');
    this.$chips.innerHTML = html;
  }

  markQuestDone(qid){
    if (!this.$chips) return;
    const li = this.$chips.querySelector(`[data-qid="${cssSel(qid)}"]`);
    if (li) li.classList.add('ok');
    this.toast('✓ Quest!', 900);
  }

  /* -------- Coach / Toast -------- */
  say(txt, ms=900){
    if (!this.$coach || !this.$coachText) return;
    this.$coachText.textContent = String(txt||'');
    this.$coach.classList.add('show');
    clearTimeout(this._to.coach);
    this._to.coach = setTimeout(()=> this.$coach.classList.remove('show'), ms|0);
  }
  toast(txt, ms=900){
    if (!this.$toast) return;
    this.$toast.textContent = String(txt||'');
    this.$toast.classList.add('show');
    clearTimeout(this._to.toast);
    this._to.toast = setTimeout(()=> this.$toast.classList.remove('show'), ms|0);
  }
  flashDanger(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
  }

  /* -------- Hydration stubs -------- */
  showHydration(/*zone,pct*/){}
  hideHydration(){}

  dispose(){
    try{ clearTimeout(this._to.coach); }catch{}
    try{ clearTimeout(this._to.toast); }catch{}
  }
}

/* helpers */
function byId(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function cssSel(s){ return String(s).replace(/"/g, '\\"').replace(/'/g, "\\'"); }
