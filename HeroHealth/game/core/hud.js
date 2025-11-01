// === core/hud.js (HUD v2: top bar + chips + mission + fever + stars + result) ===
export class HUD {
  constructor () {
    this.root = document.getElementById('hud');
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;';
      document.body.appendChild(this.root);
    }
    // top bar
    this.top = document.createElement('div');
    this.top.style.cssText = 'position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
    this.top.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center">
        <span id="hudMode"   class="hud-pill">—</span>
        <span id="hudDiff"   class="hud-pill">—</span>
        <span id="hudTime"   class="hud-pill" style="min-width:64px;text-align:center">—</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="hud-pill">Score: <b id="hudScore">0</b></span>
        <span class="hud-pill" style="color:#fde68a">Combo: <b id="hudCombo">0</b></span>
        <span id="hudStars" class="hud-pill" title="Stars">⭐⭐⭐⭐⭐</span>
      </div>`;
    this.root.appendChild(this.top);
    // pill style
    const css = document.createElement('style');
    css.textContent = `.hud-pill{padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto}`;
    document.head.appendChild(css);

    // fever banner
    this.fever = document.createElement('div');
    this.fever.style.cssText = 'position:absolute;left:50%;top:54px;transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:#c026d3;color:#fff;font:900 16px ui-rounded;display:none;pointer-events:none;box-shadow:0 8px 22px rgba(192,38,211,.35)';
    this.fever.textContent = 'FEVER!';
    this.root.appendChild(this.fever);

    // stage progress (mission timeline)
    this.stage = document.createElement('div');
    this.stage.style.cssText = 'position:absolute;left:12px;right:12px;top:46px;height:8px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;pointer-events:none';
    this.stage.innerHTML = `<b id="stageFill" style="display:block;height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#14b8a6)"></b>`;
    this.root.appendChild(this.stage);
    this.$stageFill = this.stage.querySelector('#stageFill');

    // quest chips
    this.chipsWrap = document.createElement('div');
    this.chipsWrap.id = 'questChips';
    this.chipsWrap.style.cssText = 'position:absolute;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:90vw;pointer-events:none';
    this.root.appendChild(this.chipsWrap);

    // mission popup
    this.mission = document.createElement('div');
    this.mission.style.cssText = 'position:absolute;left:50%;bottom:100px;transform:translateX(-50%);background:#0e1930;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:14px;padding:10px 12px;box-shadow:0 12px 28px rgba(0,0,0,.45);display:none;pointer-events:auto;max-width:92vw';
    this.mission.innerHTML = `<div id="msTitle" style="font:900 16px ui-rounded;margin-bottom:4px">Mission</div>
      <div id="msLine" style="display:flex;gap:8px;align-items:center">
        <span id="msIcon" style="font-size:18px">⭐</span>
        <span id="msText">—</span>
        <i style="height:6px;width:160px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;margin-left:8px">
          <b id="msBar" style="display:block;height:100%;width:0%;background:#22d3ee"></b>
        </i>
      </div>`;
    this.root.appendChild(this.mission);
    this.$msIcon = this.mission.querySelector('#msIcon');
    this.$msText = this.mission.querySelector('#msText');
    this.$msBar  = this.mission.querySelector('#msBar');

    // coach bubble (if not present)
    this.coach = document.getElementById('coachBox');
    if(!this.coach){
      this.coach = document.createElement('div');
      this.coach.id = 'coachBox';
      this.coach.style.cssText = 'position:absolute;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none';
      this.root.appendChild(this.coach);
    }

    // result modal
    this.result = document.createElement('div');
    this.result.id = 'resultModal';
    this.result.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto';
    this.result.innerHTML = `
      <div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
        <h3 style="margin:0 0 6px;font:900 20px ui-rounded" id="resTitle">Result</h3>
        <p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff">—</p>
        <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
        <div id="resStars" style="font-size:22px;margin:8px 0">★★★★★</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="resHome" style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>
          <button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>
        </div>
      </div>`;
    this.root.appendChild(this.result);
    this.$mode  = this.top.querySelector('#hudMode');
    this.$diff  = this.top.querySelector('#hudDiff');
    this.$time  = this.top.querySelector('#hudTime');
    this.$score = this.top.querySelector('#hudScore');
    this.$combo = this.top.querySelector('#hudCombo');
    this.$stars = this.top.querySelector('#hudStars');
    this.$resTitle = this.result.querySelector('#resTitle');
    this.$resDesc  = this.result.querySelector('#resDesc');
    this.$resStats = this.result.querySelector('#resStats');
    this.$resStars = this.result.querySelector('#resStars');

    this.onHome = null; this.onRetry = null;
    this.result.querySelector('#resHome').onclick  = ()=> this.onHome?.();
    this.result.querySelector('#resRetry').onclick = ()=> this.onRetry?.();
  }

  setTop({ mode, diff, time, score, combo, stars }) {
    if (mode  != null) this.$mode.textContent  = String(mode);
    if (diff  != null) this.$diff.textContent  = String(diff);
    if (time  != null) this.$time.textContent  = String(time)+'s';
    if (score != null) this.$score.textContent = String(score|0);
    if (combo != null) this.$combo.textContent = String(combo|0);
    if (stars != null) this.$stars.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(stars);
  }

  setStageProgress(pct=0){ this.$stageFill.style.width = Math.max(0, Math.min(100, pct)) + '%'; }

  setQuestChips(chips = []) {
    const frag = document.createDocumentFragment();
    for (const m of chips) {
      const d = document.createElement('div');
      d.style.cssText = 'pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
      const pct = m.need>0 ? Math.min(100, Math.round((m.progress/m.need)*100)) : (m.done&&!m.fail?100:0);
      d.innerHTML = `<span style="font-size:16px">${m.icon||'⭐'}</span>
        <span style="font:700 12.5px ui-rounded">${m.label||m.key}</span>
        <span style="font:700 12px;color:${m.fail?'#fecaca':'#a7f3d0'};margin-left:6px">${m.progress||0}/${m.need||0}</span>
        <i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">
          <b style="display:block;height:100%;width:${pct}%;background:${m.done? (m.fail?'#ef4444':'#22c55e'):'#22d3ee'}"></b>
        </i>`;
      frag.appendChild(d);
    }
    this.chipsWrap.innerHTML = '';
    this.chipsWrap.appendChild(frag);
  }

  showMission({icon='⭐', text='—', progress=0, need=1}) {
    this.$msIcon.textContent = icon;
    this.$msText.textContent = text;
    this.$msBar.style.width  = Math.min(100, Math.round( (progress/Math.max(1,need))*100)) + '%';
    this.mission.style.display = 'block';
  }
  updateMissionProgress(progress, need){
    this.$msBar.style.width  = Math.min(100, Math.round( (progress/Math.max(1,need))*100)) + '%';
  }
  hideMission(){ this.mission.style.display = 'none'; }

  fever(on=true){ this.fever.style.display = on ? 'block' : 'none'; }

  say(text = '') {
    if (!text) { this.coach.style.display = 'none'; return; }
    this.coach.textContent = text;
    this.coach.style.display = 'block';
    clearTimeout(this._sayTo);
    this._sayTo = setTimeout(()=>{ this.coach.style.display = 'none'; }, 1400);
  }

  showResult({ title='Result', desc='—', stats=[], stars=0 }) {
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
    this.$resStars.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(stars);
    this.result.style.display = 'flex';
  }
  hideResult(){ this.result.style.display = 'none'; }
}
export default { HUD };
