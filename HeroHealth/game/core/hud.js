// === HUD (score/time/combo + quests + simple coach + FX popText) ===
export class HUD{
  constructor(){
    this.scoreEl = document.getElementById('score');
    this.timeEl  = document.getElementById('time');
    this.comboEl = null; // rendered inside toast/coach if needed
    this.questHost = document.getElementById('questChips');
    this.toastEl = document.getElementById('toast');
    this.coachBox = document.getElementById('coachHUD');
    this.coachText = document.getElementById('coachText');
  }
  dispose(){ /* clear any timeouts if you kept some */ }
  setScore(v){ if(this.scoreEl) this.scoreEl.textContent = v|0; }
  setTime(v){  if(this.timeEl)  this.timeEl.textContent  = v|0; }
  setCombo(txt){ /* optional small combo: show in toast briefly */ }
  flashDanger(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160); }
  toast(text, ms=900){
    if(!this.toastEl){ const el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); this.toastEl=el; }
    this.toastEl.textContent = text; this.toastEl.classList.add('show'); setTimeout(()=>this.toastEl.classList.remove('show'), ms);
  }
  say(text, ms=900){
    if (!this.coachBox || !this.coachText) return;
    this.coachText.textContent = text;
    this.coachBox.classList.add('show');
    setTimeout(()=> this.coachBox.classList.remove('show'), ms);
  }
  setFeverProgress(){ /* visual optional */ }
  setPowerTimers(){ /* power HUD optional */ }

  // ==== Quests chips ====
  setQuestChips(list=[]){
    if(!this.questHost) return;
    const html = list.map(q=>`<li class="pill" data-q="${q.key}">${q.icon} <b>${q.label||''}</b> <span>${q.progress}/${q.need}</span></li>`).join('');
    this.questHost.innerHTML = html;
  }
  markQuestDone(qid){
    const el = this.questHost?.querySelector?.(`.pill[data-q="${qid}"]`);
    if (el){ el.classList.add('ok'); }
  }

  // FX helper used by modes
  popText(text, {x,y,ms=700}={}){
    const el=document.createElement('div');
    el.style.position='fixed'; el.style.left=x+'px'; el.style.top=y+'px';
    el.style.transform='translate(-50%,-50%)'; el.style.font='900 14px ui-rounded';
    el.style.color='#eaf6ff'; el.style.textShadow='0 2px 8px #000a'; el.style.pointerEvents='none';
    el.textContent=text; document.body.appendChild(el);
    const t0=performance.now(); (function tick(){
      const k=Math.min(1,(performance.now()-t0)/ms); el.style.opacity=String(1-k); el.style.transform=`translate(-50%,-50%) translateY(${-24*k}px)`; if(k<1) requestAnimationFrame(tick); else el.remove();
    })();
  }
}
export const coach = HUD; // back-compat
