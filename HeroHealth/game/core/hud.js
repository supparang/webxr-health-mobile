// === Hero Health Academy — core/hud.js (quests-ready minimal) ===
export class HUD {
  constructor(){
    this._scoreEl = document.getElementById('score');
    this._timeEl  = document.getElementById('time');
    this._comboEl = null; // ถ้ามี element แยก ให้ bind เพิ่มได้
    this._toastEl = document.getElementById('toast');
    this._coachEl = document.getElementById('coachHUD');
    this._coachTx = document.getElementById('coachText');
    this._questUl = document.getElementById('questChips');
    this._targetWrap = document.getElementById('targetWrap');
  }

  /* === Score/Time/Combo === */
  setScore(n){ if (this._scoreEl) this._scoreEl.textContent = String(n|0); }
  setTime(s){ if (this._timeEl)  this._timeEl.textContent  = String(s|0); }
  setCombo(t){ /* ถ้ามี element แสดงคอมโบ ให้เติมที่นี่; หรือแสดงเป็น toast */ }

  /* === Power/Hydration/Effects (เรียกจาก main/game modes) === */
  setFeverProgress(p01){ /* ถ้าทำแถบไว้ ค่อยอัปเดตความกว้าง */ }
  setPowerTimers(timers){ /* ถ้ามี UI power bar ให้แสดงค่า timers.x2/freeze/shield ฯลฯ */ }
  showHydration(zone, pct){
    // ถ้ามี UI hydration bar ในหน้า hub ให้สลับสี/ตำแหน่งเข็มตรงนี้
  }
  flashDanger(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
  }
  dimPenalty(){
    // เอฟเฟกต์เบาลงตอนพลาดซ้ำ ๆ (ทางเลือก)
  }

  /* === Coach/Toast === */
  say(text, ms=900){
    if (!this._coachEl || !this._coachTx) return;
    this._coachTx.textContent = text;
    this._coachEl.classList.add('show');
    clearTimeout(this._coachT);
    this._coachT = setTimeout(()=>this._coachEl.classList.remove('show'), ms);
  }
  toast(text, ms=900){
    const el = this._toastEl; if (!el) return;
    el.textContent = text; el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(()=>el.classList.remove('show'), ms);
  }
  dispose(){
    clearTimeout(this._coachT); clearTimeout(this._toastT);
  }

  /* === Quests HUD === */
  setQuestChips(list){
    if (!this._questUl) return;
    // list: [{key,id,icon,need,progress,done,fail,label,remain}]
    this._questUl.innerHTML = (list||[]).map(q=>{
      const pct = Math.min(100, Math.round(((q.progress|0)/(q.need||1))*100));
      return `<li data-q="${q.key}" class="${q.done?'done':''} ${q.fail?'fail':''}">
        <i>${q.icon||'⭐'}</i>
        <span>${escapeHtml(q.label||'')}</span>
        <span>${q.progress|0}/${q.need|0}</span>
        <span class="bar"><b style="width:${pct}%"></b></span>
      </li>`;
    }).join('');
  }
  markQuestDone(qid){
    const li = this._questUl?.querySelector(`[data-q="${CSS.escape(qid)}"]`);
    if (li) li.classList.add('done');
  }

  /* === Target HUD (สำหรับโหมด groups/plate) === */
  setTargetLabel(txt){ 
    const w=this._targetWrap, b=document.getElementById('targetBadge');
    if (b) b.textContent = txt||'—';
    if (w && txt) w.style.display = 'inline-flex';
  }
}

/* helpers */
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
