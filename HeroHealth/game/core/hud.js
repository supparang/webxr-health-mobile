// === Hero Health Academy — core/hud.js (unified v2; power HUD + coach + quests) ===
export class HUD {
  constructor() {
    // cache DOM
    this.$score   = document.querySelector('#score');
    this.$time    = document.querySelector('#time');
    this.$combo   = document.querySelector('#combo') || null; // optional
    this.$toast   = document.querySelector('#toast');
    this.$coach   = document.querySelector('#coachHUD');
    this.$coachTx = document.querySelector('#coachText');
    this.$quests  = document.querySelector('#questChips');
    this.$mission = document.querySelector('#missionLine');
    this.$targetW = document.querySelector('#targetWrap');
    this.$targetB = document.querySelector('#targetBadge');

    // create / ensure power bar
    this.$powerBar = document.querySelector('#powerBar');
    if (!this.$powerBar) {
      const hudWrap = document.querySelector('#hudWrap') || document.querySelector('.hud');
      this.$powerBar = document.createElement('div');
      this.$powerBar.id = 'powerBar';
      this.$powerBar.className = 'pill';
      this.$powerBar.style.marginLeft = '6px';
      this.$powerBar.style.display = 'inline-flex';
      this.$powerBar.style.gap = '8px';
      this.$powerBar.style.alignItems = 'center';
      this.$powerBar.style.pointerEvents = 'none';

      // 4 segments: x2, freeze, sweep, shield
      this.$powerBar.innerHTML = `
        <span style="opacity:.8;font-weight:900">⚡</span>
        <span class="pseg" data-k="x2"     title="x2"     style="width:72px;height:10px;background:#0b1a2f;border-radius:999px;position:relative;display:inline-block;overflow:hidden"></span>
        <span class="pseg" data-k="freeze" title="freeze" style="width:72px;height:10px;background:#0b1a2f;border-radius:999px;position:relative;display:inline-block;overflow:hidden"></span>
        <span class="pseg" data-k="sweep"  title="sweep"  style="width:72px;height:10px;background:#0b1a2f;border-radius:999px;position:relative;display:inline-block;overflow:hidden"></span>
        <span class="pseg" data-k="shield" title="shield" style="width:72px;height:10px;background:#0b1a2f;border-radius:999px;position:relative;display:inline-block;overflow:hidden"></span>
      `;
      // mount after score/time pills
      const anchor = document.querySelector('#scoreTime');
      if (anchor) anchor.appendChild(this.$powerBar);
      else if (hudWrap) hudWrap.appendChild(this.$powerBar);
    }

    // runtime handles
    this._toastTid = 0;
    this._coachTid = 0;
  }

  /* ===== Basic ===== */
  setScore(n){ if (this.$score) this.$score.textContent = (n|0); }
  setTime(n){  if (this.$time)  this.$time.textContent  = (n|0); }
  setCombo(txt){ if (this.$combo) this.$combo.textContent = String(txt||''); }

  /* ===== FEVER progress (0..1); reuse mission line as slim meter if present) ===== */
  setFeverProgress(v){
    const el = this.$mission;
    if (!el) return;
    const p = Math.max(0, Math.min(1, +v||0));
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.bottom = '10px';
    el.style.width = '60%';
    el.style.height = '6px';
    el.style.borderRadius = '999px';
    el.style.background = '#0d1b30';
    el.style.overflow = 'hidden';
    if (!el._fill){
      const b = document.createElement('b');
      b.style.position = 'absolute';
      b.style.left = '0'; b.style.top = '0'; b.style.bottom = '0';
      b.style.width = '0%'; b.style.borderRadius = '999px';
      b.style.background = 'linear-gradient(90deg,#42f9da,#22c1a5)';
      el.appendChild(b); el._fill = b;
    }
    el._fill.style.width = (p*100).toFixed(1) + '%';
  }

  /* ===== Power bar timers ===== */
  setPowerTimers(timers){
    const wrap = this.$powerBar; if (!wrap) return;
    const kinds = ['x2','freeze','sweep','shield'];
    kinds.forEach(k=>{
      const segWrap = wrap.querySelector(`.pseg[data-k="${k}"]`);
      if(!segWrap) return;
      let fill = segWrap.querySelector('.barfill');
      if(!fill){
        fill = document.createElement('i');
        fill.className = 'barfill';
        Object.assign(fill.style, {
          position:'absolute', left:'0', top:'0', bottom:'0',
          borderRadius:'999px', width:'0%'
        });
        segWrap.appendChild(fill);
      }
      const v = Math.max(0, Math.min(10, Number(timers?.[k]||0)));
      fill.style.width = (v*10) + '%';
      fill.style.background =
        (k==='x2')     ? 'linear-gradient(90deg,#ffd54a,#ff8a00)' :
        (k==='freeze') ? 'linear-gradient(90deg,#66e0ff,#4fc3f7)' :
        (k==='sweep')  ? 'linear-gradient(90deg,#9effa8,#7fffd4)' :
                         'linear-gradient(90deg,#a9d6ff,#b18cff)';

      // show shield stack count as small badge
      if (k==='shield'){
        segWrap.style.position = 'relative';
        let badge = segWrap.querySelector('.shield-badge');
        const count = (timers?.shieldCount|0) || 0;
        if (count>0){
          if(!badge){
            badge = document.createElement('em');
            badge.className = 'shield-badge';
            Object.assign(badge.style,{
              position:'absolute', right:'-8px', top:'-10px',
              background:'#1b2e4b', color:'#eaf6ff', font:'700 10px ui-rounded',
              border:'1px solid #2b436d', borderRadius:'10px', padding:'2px 6px'
            });
            segWrap.appendChild(badge);
          }
          badge.textContent = '×'+count;
        } else if (badge){ badge.remove(); }
      }
    });
  }

  /* ===== Target badge (for groups/plate) ===== */
  setTarget(text){
    if (this.$targetB) this.$targetB.textContent = String(text||'—');
    if (this.$targetW) this.$targetW.style.display = 'inline-flex';
  }
  hideTarget(){ if (this.$targetW) this.$targetW.style.display = 'none'; }

  /* ===== Quests / missions ===== */
  setQuestChips(list = []){
    if (!this.$quests) return;
    const html = list.map(q=>`<li class="questChip" data-key="${q.key||''}" style="display:inline-flex;gap:6px;align-items:center;margin:0 6px 6px 0">
      <span class="pill">${escapeHtml(q.text||'Quest')}</span>
    </li>`).join('');
    this.$quests.innerHTML = html;
  }
  markQuestDone(key){
    if (!this.$quests) return;
    const el = key ? this.$quests.querySelector(`[data-key="${CSS.escape(key)}"] .pill`) : null;
    if (el){
      el.style.background = '#133b2b';
      el.style.border = '1px solid #1f8a66';
    }
  }

  /* ===== Coach/Toast ===== */
  toast(text, ms=1000){
    if(!this.$toast) return;
    clearTimeout(this._toastTid);
    this.$toast.textContent = String(text||'');
    this.$toast.classList.add('show');
    this._toastTid = setTimeout(()=> this.$toast.classList.remove('show'), ms|0);
  }
  say(text, ms=1200){
    if(!this.$coach || !this.$coachTx) return;
    clearTimeout(this._coachTid);
    this.$coachTx.textContent = String(text||'');
    this.$coach.style.display = 'flex';
    this.$coach.classList.add('show');
    this._coachTid = setTimeout(()=>{
      this.$coach.classList.remove('show');
      this.$coach.style.display = 'none';
    }, ms|0);
  }
  flashDanger(){
    const gl = document.querySelector('#gameLayer') || document.body;
    if (!gl) return;
    gl.classList.add('flash-danger');
    setTimeout(()=> gl.classList.remove('flash-danger'), 220);
  }

  /* ===== Cleanup ===== */
  dispose(){
    clearTimeout(this._toastTid);
    clearTimeout(this._coachTid);
    if (this.$toast) { this.$toast.classList.remove('show'); this.$toast.textContent=''; }
    if (this.$coach) { this.$coach.classList.remove('show'); this.$coach.style.display='none'; }
  }
}

/* ===== util ===== */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
