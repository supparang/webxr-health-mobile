// === core/hud.js (Guaranteed HUD mount) ===
export class HUD {
  constructor () {
    // root
    this.root = document.getElementById('hud');
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10020;';
      document.body.appendChild(this.root);
    }

    // inject minimal styles for readability
    if (!document.getElementById('hud-inline-style')) {
      const st = document.createElement('style');
      st.id = 'hud-inline-style';
      st.textContent = `
        .hud-b{padding:4px 8px;border-radius:10px;border:1px solid #134064;background:#0b1c36;color:#e6f2ff}
        #resultModal{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:10030}
      `;
      document.head.appendChild(st);
    }

    // top bar
    this.top = document.createElement('div');
    this.top.style.cssText = 'position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
    this.top.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center">
        <span id="hudMode"  class="hud-b">—</span>
        <span id="hudDiff"  class="hud-b">—</span>
        <span id="hudTime"  class="hud-b" style="min-width:64px;text-align:center">0s</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="hud-b">Score: <b id="hudScore">0</b></span>
        <span class="hud-b">Combo: <b id="hudCombo">0</b></span>
        <span class="hud-b" style="padding:0">
          <i style="display:block;width:160px;height:12px;border-radius:10px;overflow:hidden;background:#051226;border:1px solid #134064">
            <b id="feverFill" style="display:block;height:100%;width:0%"></b>
          </i>
        </span>
      </div>
    `;
    this.root.appendChild(this.top);

    this.$mode   = this.top.querySelector('#hudMode');
    this.$diff   = this.top.querySelector('#hudDiff');
    this.$time   = this.top.querySelector('#hudTime');
    this.$score  = this.top.querySelector('#hudScore');
    this.$combo  = this.top.querySelector('#hudCombo');
    this.$fever  = this.top.querySelector('#feverFill');

    // quest chip (แสดงทีละภารกิจ)
    this.chipsWrap = document.createElement('div');
    this.chipsWrap.id = 'questChips';
    this.chipsWrap.style.cssText = 'position:absolute;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:90vw;pointer-events:none;z-index:10025';
    this.root.appendChild(this.chipsWrap);

    // coach bubble
    this.coach = document.createElement('div');
    this.coach.id = 'coachBox';
    this.coach.style.cssText = 'position:absolute;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:10025';
    this.root.appendChild(this.coach);

    // result modal
    this.result = document.createElement('div');
    this.result.id = 'resultModal';
    this.result.innerHTML = `
      <div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
        <h3 style="margin:0 0 6px;font:900 20px ui-rounded" id="resTitle">Result</h3>
        <p id="resDesc" style="margin:0 0 10px;color:#cfe7ff">—</p>
        <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="resHome"  class="hud-b" style="cursor:pointer">🏠 Home</button>
          <button id="resRetry" class="hud-b" style="cursor:pointer">↻ Retry</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.result);
    this.$resTitle = this.result.querySelector('#resTitle');
    this.$resDesc  = this.result.querySelector('#resDesc');
    this.$resStats = this.result.querySelector('#resStats');

    this.onHome = null;
    this.onRetry = null;
    this.result.querySelector('#resHome').onclick  = ()=> this.onHome?.();
    this.result.querySelector('#resRetry').onclick = ()=> this.onRetry?.();
  }

  setTop({ mode, diff, time, score, combo, feverPct, feverOn }) {
    if (mode  != null) this.$mode.textContent = String(mode);
    if (diff  != null) this.$diff.textContent = String(diff);
    if (time  != null) this.$time.textContent = String(time)+'s';
    if (score != null) this.$score.textContent = String(score|0);
    if (combo != null) this.$combo.textContent = String(combo|0);
    if (feverPct != null) {
      this.$fever.style.width = Math.max(0, Math.min(100, feverPct|0)) + '%';
      this.$fever.style.background = feverOn ? '#fb923c' : '#22d3ee';
      this.$fever.style.boxShadow  = feverOn ? '0 0 16px 6px rgba(255,120,0,.5) inset' : 'none';
    }
  }

  setQuestChips(chips = []) {
    const frag = document.createDocumentFragment();
    for (const m of chips) {
      const d = document.createElement('div');
      d.style.cssText = 'pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
      const pct = m.need>0 ? Math.min(100, Math.round((m.progress/m.need)*100)) : (m.done&&!m.fail?100:0);
      d.innerHTML = `<span style="font-size:16px">${m.icon||'⭐'}</span>
        <span style="font:700 12.5px ui-rounded">${m.label||m.key}</span>
        <span style="font:700 12px;color:#a7f3d0;margin-left:6px">${m.progress||0}/${m.need||0}</span>
        <i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">
          <b style="display:block;height:100%;width:${pct}%;background:${m.done? (m.fail?'#ef4444':'#22c55e'):'#22d3ee'}"></b>
        </i>`;
      frag.appendChild(d);
    }
    this.chipsWrap.innerHTML = '';
    this.chipsWrap.appendChild(frag);
  }

  say(text = '') {
    if (!text) { this.coach.style.display = 'none'; return; }
    this.coach.textContent = text;
    this.coach.style.display = 'block';
    clearTimeout(this._sayTo);
    this._sayTo = setTimeout(()=>{ this.coach.style.display = 'none'; }, 1500);
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
export default { HUD };
