// === core/hud.js — HUD v2.1 (Result visible + buttons style + coach bubble) ===
export class HUD {
  constructor () {
    this.root = document.getElementById('hud');
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3000;';
      document.body.appendChild(this.root);
    }
    // inject minimal button style so Result buttons are clickable/visible
    this._inject(`
      .chip{padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto}
      .bar{display:inline-block;height:10px;width:140px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden}
      .bar>b{display:block;height:100%;width:0%;background:#22d3ee}
      .hha-btn{padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer;pointer-events:auto}
      .hha-btn:hover{filter:brightness(1.08)}
    `);

    // TOP
    this.top = document.createElement('div');
    this.top.style.cssText = 'position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
    this.top.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center">
        <span id="hudMode"   class="chip">—</span>
        <span id="hudDiff"   class="chip">—</span>
        <span id="hudTime"   class="chip" style="min-width:64px;text-align:center">60s</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="chip">Score: <b id="hudScore">0</b></span>
        <span class="chip">Combo: <b id="hudCombo">0</b></span>
        <span id="hudFever" class="chip" style="display:none;color:#60a5ff">⚡ FEVER</span>
        <span id="hudStars" class="chip">☆☆☆☆☆</span>
      </div>`;
    this.root.appendChild(this.top);

    // MINI-QUEST
    this.quest = document.createElement('div');
    this.quest.style.cssText = 'position:absolute;left:12px;bottom:82px;display:flex;gap:10px;align-items:center;pointer-events:none';
    this.quest.innerHTML = `
      <span id="qIcon" style="font-size:18px">🎯</span>
      <span id="qText" class="chip">—</span>
      <span class="bar"><b id="qBar"></b></span>
      <span id="qProg" class="chip">0/0</span>`;
    this.root.appendChild(this.quest);

    // COACH (มุมขวาล่าง)
    this.coach = document.createElement('div');
    this.coach.id = 'coachBox';
    this.coach.style.cssText = 'position:absolute;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none';
    this.root.appendChild(this.coach);

    // RESULT (overlay สูงกว่าเมนู)
    this.result = document.createElement('div');
    this.result.id = 'resultModal';
    this.result.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);pointer-events:auto;z-index:4000';
    this.result.innerHTML = `
      <div style="width:min(560px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
        <h3 style="margin:0 0 6px;font:900 20px ui-rounded" id="resTitle">Result</h3>
        <p id="resDesc" style="margin:0 0 10px;color:#cfe7ff">—</p>
        <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="resHome"  class="hha-btn">🏠 Home</button>
          <button id="resRetry" class="hha-btn">↻ Retry</button>
        </div>
      </div>`;
    document.body.appendChild(this.result); // แปะที่ body ตรงๆ กันซ้อนทับ

    // refs
    this.$mode  = this.top.querySelector('#hudMode');
    this.$diff  = this.top.querySelector('#hudDiff');
    this.$time  = this.top.querySelector('#hudTime');
    this.$score = this.top.querySelector('#hudScore');
    this.$combo = this.top.querySelector('#hudCombo');
    this.$fever = this.top.querySelector('#hudFever');
    this.$stars = this.top.querySelector('#hudStars');
    this.$qIcon = this.quest.querySelector('#qIcon');
    this.$qText = this.quest.querySelector('#qText');
    this.$qBar  = this.quest.querySelector('#qBar');
    this.$qProg = this.quest.querySelector('#qProg');
    this.$resTitle = this.result.querySelector('#resTitle');
    this.$resDesc  = this.result.querySelector('#resDesc');
    this.$resStats = this.result.querySelector('#resStats');

    // handlers
    this.onHome = null; this.onRetry = null;
    this.result.querySelector('#resHome').onclick = ()=> this.onHome?.();
    this.result.querySelector('#resRetry').onclick = ()=> this.onRetry?.();

    // fever frame FX
    this.feverFx = document.createElement('div');
    this.feverFx.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3500;display:none;box-shadow:inset 0 0 0 6px #6ea8ff88, inset 0 0 40px 12px #7c4dff44';
    document.body.appendChild(this.feverFx);
  }

  _inject(css){ const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s); }

  setTop({ mode, diff, time, score, combo }) {
    if (mode  != null) this.$mode.textContent = String(mode);
    if (diff  != null) this.$diff.textContent = String(diff);
    if (time  != null) this.$time.textContent = String(time)+'s';
    if (score != null) this.$score.textContent = String(score|0);
    if (combo != null) this.$combo.textContent = String(combo|0);
  }
  setFever(on){ this.$fever.style.display = on ? 'inline-flex':'none'; this.feverFx.style.display = on ? 'block':'none'; }
  setStars(n=0){ const k=Math.max(0,Math.min(5,n|0)); this.$stars.textContent = '★★★★★'.slice(0,k).padEnd(5,'☆'); }
  setQuest({icon='🎯', text='—', have=0, need=0}) {
    this.$qIcon.textContent = icon; this.$qText.textContent = text; this.$qProg.textContent = `${have|0}/${need|0}`;
    const pct = need>0 ? Math.min(100,Math.round((have/need)*100)) : 0; this.$qBar.style.width = pct+'%';
  }
  say(t=''){ if(!t){ this.coach.style.display='none'; return; } this.coach.textContent=t; this.coach.style.display='block'; clearTimeout(this._sayTo); this._sayTo=setTimeout(()=>{ this.coach.style.display='none'; }, 1600); }
  flashMiss(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 140); }
  popScore(txt,x,y){ const el=document.createElement('div'); el.textContent=txt;
    el.style.cssText='position:fixed;left:'+ (x|0)+'px;top:'+(y|0)+'px;transform:translate(-50%,-50%);font:900 18px ui-rounded;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:3600;opacity:1;transition:all .7s ease-out';
    document.body.appendChild(el); requestAnimationFrame(()=>{ el.style.top=(y-40)+'px'; el.style.opacity='0'; }); setTimeout(()=>{ try{el.remove();}catch{} }, 720);
  }
  showResult({ title='Result', desc='—', stats=[] }){
    this.$resTitle.textContent=title; this.$resDesc.textContent=desc;
    const frag=document.createDocumentFragment();
    for(const s of stats){ const b=document.createElement('div'); b.className='chip'; b.textContent=s; frag.appendChild(b); }
    this.$resStats.innerHTML=''; this.$resStats.appendChild(frag);
    this.result.style.display='flex';
  }
  hideResult(){ this.result.style.display='none'; }
}
export default { HUD };
