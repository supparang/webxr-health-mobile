// === core/hud.js — HUD v2 (top bar + fever bar + mission bar + coach + result) ===
export class HUD {
  constructor () {
    this.root = document.getElementById('hud');
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;';
      document.body.appendChild(this.root);
    }

    // Top bar
    this.top = document.createElement('div');
    this.top.style.cssText = 'position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
    this.top.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center">
        <span id="hudMode"   class="badge">—</span>
        <span id="hudDiff"   class="badge">—</span>
        <span id="hudTime"   class="badge" style="min-width:64px;text-align:center">60s</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge">Score: <b id="hudScore">0</b></span>
        <span class="badge">Combo: <b id="hudCombo">0</b></span>
      </div>`;
    this.root.appendChild(this.top);

    // Fever bar
    this.fever = document.createElement('div');
    this.fever.style.cssText = 'position:absolute;left:12px;right:12px;top:48px;height:12px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;pointer-events:none';
    this.fever.innerHTML = `<div id="feverFill" style="height:100%;width:0%"></div>`;
    this.root.appendChild(this.fever);
    this.$feverFill = this.fever.querySelector('#feverFill');

    // Mission bar
    this.mission = document.createElement('div');
    this.mission.style.cssText = 'position:absolute;left:12px;bottom:78px;display:flex;gap:8px;align-items:center;pointer-events:auto';
    this.mission.innerHTML = `
      <span id="msIcon" style="font-size:18px">⭐</span>
      <span id="msLabel" style="font:700 13px ui-rounded">—</span>
      <span id="msProg" style="font:700 12px;color:#a7f3d0;margin-left:6px">0/0</span>
      <i style="height:6px;width:180px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">
        <b id="msFill" style="display:block;height:100%;width:0%;background:#22d3ee"></b>
      </i>`;
    this.root.appendChild(this.mission);
    this.$msIcon  = this.mission.querySelector('#msIcon');
    this.$msLabel = this.mission.querySelector('#msLabel');
    this.$msProg  = this.mission.querySelector('#msProg');
    this.$msFill  = this.mission.querySelector('#msFill');

    // Coach balloon
    this.coach = document.createElement('div');
    this.coach.id = 'coachBox';
    this.coach.style.cssText = 'position:absolute;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none';
    this.root.appendChild(this.coach);

    // Result modal
    this.result = document.createElement('div');
    this.result.id = 'resultModal';
    this.result.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto';
    this.result.innerHTML = `
      <div style="width:min(560px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
        <h3 style="margin:0 0 6px;font:900 20px ui-rounded" id="resTitle">Result</h3>
        <p id="resDesc" style="margin:0 0 10px;color:#cfe7ff">—</p>
        <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="resHome"  class="btn">🏠 Home</button>
          <button id="resRetry" class="btn">↻ Retry</button>
        </div>
      </div>`;
    this.root.appendChild(this.result);

    // Wires
    this.$mode  = this.top.querySelector('#hudMode');
    this.$diff  = this.top.querySelector('#hudDiff');
    this.$time  = this.top.querySelector('#hudTime');
    this.$score = this.top.querySelector('#hudScore');
    this.$combo = this.top.querySelector('#hudCombo');
    this.$resTitle = this.result.querySelector('#resTitle');
    this.$resDesc  = this.result.querySelector('#resDesc');
    this.$resStats = this.result.querySelector('#resStats');

    this.onHome  = null;
    this.onRetry = null;
    this.result.querySelector('#resHome').onclick  = ()=> this.onHome?.();
    this.result.querySelector('#resRetry').onclick = ()=> this.onRetry?.();

    // style bits
    injectOnce();
  }

  setTop({ mode, diff, time, score, combo }) {
    if (mode  != null) this.$mode.textContent  = String(mode);
    if (diff  != null) this.$diff.textContent  = String(diff);
    if (time  != null) this.$time.textContent  = String(time)+'s';
    if (score != null) this.$score.textContent = String(score|0);
    if (combo != null) this.$combo.textContent = String(combo|0);
  }

  setMission({ icon='⭐', label='—', progress=0, need=0, done=false }) {
    this.$msIcon.textContent = icon;
    this.$msLabel.textContent = label;
    this.$msProg.textContent  = `${progress|0}/${need|0}`;
    const pct = need>0 ? Math.min(100, Math.round((progress/need)*100)) : (done?100:0);
    this.$msFill.style.width = pct + '%';
    this.$msFill.style.background = done ? '#22c55e' : '#22d3ee';
  }

  setFever({ active=false, value=0 }) {
    this.$feverFill.style.width = Math.max(0, Math.min(100, value|0)) + '%';
    this.$feverFill.style.background = active ? '#f59e0b' : '#22d3ee';
  }

  say(text='') {
    if (!text) { this.coach.style.display = 'none'; return; }
    this.coach.textContent = text;
    this.coach.style.display = 'block';
    clearTimeout(this._sayTo);
    this._sayTo = setTimeout(()=>{ this.coach.style.display = 'none'; }, 1600);
  }

  showResult({ title='Result', desc='—', stats=[] }) {
    this.$resTitle.textContent = title;
    this.$resDesc.textContent  = desc;
    const frag = document.createDocumentFragment();
    for (const s of stats) {
      const b = document.createElement('div');
      b.style.cssText = 'padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38';
      b.textContent = s;
      frag.appendChild(b);
    }
    this.$resStats.innerHTML = '';
    this.$resStats.appendChild(frag);
    this.result.style.display = 'flex';
  }
  hideResult(){ this.result.style.display = 'none'; }
}

function injectOnce(){
  if (document.getElementById('hud-css')) return;
  const s = document.createElement('style');
  s.id = 'hud-css';
  s.textContent = `
  .badge{background:#0f1e38;border:1px solid #16325d;border-radius:10px;padding:6px 10px;pointer-events:auto}
  .btn{padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer}
  `;
  document.head.appendChild(s);
}

export default { HUD };
