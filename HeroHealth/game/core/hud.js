// === core/hud.js (HUD v1: top bar + quest chip + coach + result + countdown + fever/star/shield) ===
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
        <span id="hudMode"   style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>
        <span id="hudDiff"   style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>
        <span id="hudTime"   style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">60s</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;pointer-events:auto">
        <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span>
        <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span>
        <span id="hudShield" style="padding:4px 8px;border-radius:10px;background:#0b1c36;border:1px solid #134064">🛡️ x0</span>
        <span id="hudFever"  style="padding:4px 8px;border-radius:10px;background:#2b1036;border:1px solid #4b1a64;display:none">🔥 FEVER</span>
        <span id="hudStars"  style="padding:4px 8px;border-radius:10px;background:#1a1430;border:1px solid #2b2056">☆☆☆☆☆</span>
      </div>
    `;
    this.root.appendChild(this.top);

    // Quest chip (single active)
    this.chipsWrap = document.createElement('div');
    this.chipsWrap.id = 'questChips';
    this.chipsWrap.style.cssText = 'position:absolute;left:12px;bottom:78px;display:flex;gap:6px;max-width:90vw;pointer-events:none';
    this.root.appendChild(this.chipsWrap);

    // Coach bubble
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
        <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"></div>
        <div id="resQuests" style="display:flex;gap:6px;flex-direction:column;margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="resHome" style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>
          <button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.result);

    // Countdown overlay
    this.count = document.createElement('div');
    this.count.id = 'hudCountdown';
    this.count.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none';
    this.root.appendChild(this.count);

    // refs
    this.$mode  = this.top.querySelector('#hudMode');
    this.$diff  = this.top.querySelector('#hudDiff');
    this.$time  = this.top.querySelector('#hudTime');
    this.$score = this.top.querySelector('#hudScore');
    this.$combo = this.top.querySelector('#hudCombo');
    this.$shield= this.top.querySelector('#hudShield');
    this.$fever = this.top.querySelector('#hudFever');
    this.$stars = this.top.querySelector('#hudStars');
    this.$resTitle = this.result.querySelector('#resTitle');
    this.$resDesc  = this.result.querySelector('#resDesc');
    this.$resStats = this.result.querySelector('#resStats');
    this.$resQuests= this.result.querySelector('#resQuests');

    // external handlers
    this.onHome = null; this.onRetry = null;
    this.result.querySelector('#resHome').onclick = ()=> this.onHome?.();
    this.result.querySelector('#resRetry').onclick = ()=> this.onRetry?.();
  }

  setTop({ mode, diff, time, score, combo }) {
    if (mode  != null) this.$mode.textContent = String(mode);
    if (diff  != null) this.$diff.textContent = String(diff);
    if (time  != null) this.$time.textContent = String(time)+'s';
    if (score != null) this.$score.textContent = String(score|0);
    if (combo != null) this.$combo.textContent = String(combo|0);
  }

  setQuestChips(chips = []) {
    // single active chip
    const m = chips[0];
    const frag = document.createDocumentFragment();
    if (m){
      const pct = m.need>0 ? Math.min(100, Math.round((m.progress/m.need)*100)) : (m.done&&!m.fail?100:0);
      const d = document.createElement('div');
      d.style.cssText = 'pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
      d.innerHTML = `<span style="font-size:16px">${m.icon||'⭐'}</span>
        <span style="font:700 12.5px ui-rounded">${m.label||m.key}</span>
        <span style="font:700 12px;color:#a7f3d0;margin-left:6px">${m.progress||0}/${m.need||0}</span>
        <i style="height:6px;width:120px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">
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
    this._sayTo = setTimeout(()=>{ this.coach.style.display = 'none'; }, 1600);
  }

  setShield(n){ if(this.$shield) this.$shield.textContent = `🛡️ x${n|0}`; }
  setFever(on){ if(this.$fever) this.$fever.style.display = on?'inline-flex':'none'; }
  setStars(n){ if(!this.$stars) return; const s=Math.max(0,Math.min(5,n|0)); this.$stars.textContent='★★★★★'.slice(0,s)+'☆☆☆☆☆'.slice(s); }

  async showCountdown(n=3, { lang='TH' }={}){
    this.count.style.display='flex';
    const big = document.createElement('div');
    big.style.cssText='font:900 88px ui-rounded,system-ui;color:#fff;text-shadow:0 8px 24px #0009;animation:scale .8s ease;';
    this.count.innerHTML=''; this.count.appendChild(big);
    for (let i=n; i>=1; i--){
      big.textContent = String(i);
      await new Promise(r=>setTimeout(r, 750));
    }
    big.textContent = lang==='EN'?'GO!':'ลุย!';
    await new Promise(r=>setTimeout(r, 500));
    this.count.style.display='none';
  }

  showResult({ title='Result', desc='—', stats=[], quests=[] }) {
    this.$resTitle.textContent = title;
    this.$resDesc.textContent  = desc;

    // stats
    const sfrag = document.createDocumentFragment();
    for (const s of stats) {
      const b = document.createElement('div');
      b.style.cssText = 'padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38';
      b.textContent = s;
      sfrag.appendChild(b);
    }
    this.$resStats.innerHTML = ''; this.$resStats.appendChild(sfrag);

    // quest summary
    const qfrag = document.createDocumentFragment();
    for (const q of quests){
      const line = document.createElement('div');
      line.style.cssText='display:flex;gap:8px;align-items:center';
      line.innerHTML = `<b>${q.icon||'⭐'}</b><span>${q.label||q.key}</span>
        <span style="margin-left:auto;color:${q.done&&!q.fail?'#22c55e':'#ef4444'}">${q.progress||0}/${q.need||0}</span>`;
      qfrag.appendChild(line);
    }
    this.$resQuests.innerHTML=''; this.$resQuests.appendChild(qfrag);

    this.result.style.display = 'flex';
  }

  hideResult(){ this.result.style.display = 'none'; }
}
export default { HUD };
