// === /herohealth/vr-groups/ai-dataset.js ===
// PACK 18 — Dataset Collector (localStorage + Export CSV/JSON)
// ✅ enabled only when: run=play AND ai=1 AND train=1
// ✅ 1 row / 1 second (driven by ai:prediction event)
// ✅ Labels are "next-interval deltas" for previous row:
//    y_missNext (0/1), y_scoreDelta, y_comboDelta, y_accNextPct (approx), y_goodHitNext (0/1)
// ✅ Stores to localStorage: HHA_GROUPS_DATASET_V1 (max 10k rows)
// ✅ Adds export UI buttons (only when enabled)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  const LS_KEY = 'HHA_GROUPS_DATASET_V1';

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function nowIso(){ return new Date().toISOString(); }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch(_){} }, 120);
      return true;
    }catch(_){
      return false;
    }
  }

  function toCSV(rows){
    // rows: array of objects with flat keys
    const keys = Object.keys(rows[0] || {});
    const esc = (v)=>{
      const s = String(v ?? '');
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const head = keys.join(',');
    const lines = rows.map(r => keys.map(k=>esc(r[k])).join(','));
    return [head].concat(lines).join('\n');
  }

  function Dataset(){
    this.enabled = false;

    // state snapshot updated by events
    this.score = 0;
    this.combo = 0;
    this.misses = 0;
    this.accPct = 0;

    this.goodHit = 0;      // from groups.safe.js summary is not emitted; we approximate using score/combos
    this.timeLeft = 90;

    this.goalPct = 0;
    this.powerPct = 0;
    this.pressure = 0;
    this.stormOn = 0;
    this.miniOn = 0;

    // prev row buffer for labeling
    this.prev = null;
    this.prevSnap = null;

    this.rows = [];
    this.maxRows = 10000;

    // handlers
    this._onPred = null;
    this._onScore = null;
    this._onRank = null;
    this._onTime = null;
    this._onQuest = null;
    this._onProg = null;
    this._onPower = null;

    // ui
    this._ui = null;
  }

  Dataset.prototype._isEnabledByParams = function(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const ai  = String(qs('ai','0')||'0').toLowerCase();
    const tr  = String(qs('train','0')||'0').toLowerCase();
    if (run !== 'play') return false;
    const aiOn = (ai==='1' || ai==='true');
    const trOn = (tr==='1' || tr==='true');
    return aiOn && trOn;
  };

  Dataset.prototype.start = function(){
    this.enabled = this._isEnabledByParams();
    if (!this.enabled) return;

    this._load();
    this._bind();
    this._mountUI();

    // mark
    try{ DOC.body.classList.add('train-on'); }catch(_){}
  };

  Dataset.prototype.stop = function(){
    this.enabled = false;
    this._unbind();
    this._save();
    try{ DOC.body.classList.remove('train-on'); }catch(_){}
    this._unmountUI();
  };

  Dataset.prototype.clear = function(){
    this.rows = [];
    this.prev = null;
    this.prevSnap = null;
    try{ localStorage.removeItem(LS_KEY); }catch(_){}
    alert('ล้าง Dataset แล้ว ✅');
  };

  Dataset.prototype._load = function(){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      if (Array.isArray(arr)) this.rows = arr.slice(0, this.maxRows);
    }catch(_){
      this.rows = [];
    }
  };

  Dataset.prototype._save = function(){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(this.rows.slice(-this.maxRows)));
    }catch(_){}
  };

  Dataset.prototype.exportJSON = function(){
    if (!this.rows.length){ alert('ยังไม่มีข้อมูล Dataset'); return; }
    const payload = {
      schema: 'GroupsVR.Dataset.v1',
      exportedAtIso: nowIso(),
      n: this.rows.length,
      rows: this.rows
    };
    const ok = downloadText(`groupsvr-dataset-${Date.now()}.json`, JSON.stringify(payload, null, 2));
    if (!ok) alert('ดาวน์โหลดไม่สำเร็จ (ลองบน Chrome/desktop)');
  };

  Dataset.prototype.exportCSV = function(){
    if (!this.rows.length){ alert('ยังไม่มีข้อมูล Dataset'); return; }
    const csv = toCSV(this.rows);
    const ok = downloadText(`groupsvr-dataset-${Date.now()}.csv`, csv);
    if (!ok) alert('ดาวน์โหลดไม่สำเร็จ (ลองบน Chrome/desktop)');
  };

  Dataset.prototype._bind = function(){
    if (this._onPred) return;

    this._onScore = (ev)=>{
      const d = ev.detail||{};
      this.score = Number(d.score ?? this.score) | 0;
      this.combo = Number(d.combo ?? this.combo) | 0;
      this.misses= Number(d.misses ?? this.misses) | 0;
    };
    this._onRank = (ev)=>{
      const d = ev.detail||{};
      this.accPct = Number(d.accuracy ?? this.accPct) | 0;
    };
    this._onTime = (ev)=>{
      const d = ev.detail||{};
      this.timeLeft = Number(d.left ?? this.timeLeft) | 0;
    };
    this._onQuest = (ev)=>{
      const d = ev.detail||{};
      const gp = Number(d.goalPct ?? 0);
      this.goalPct = clamp(gp/100, 0, 1);
      const mLeft = Number(d.miniTimeLeftSec ?? 0) | 0;
      this.miniOn = (mLeft>0) ? 1 : 0;
    };
    this._onProg = (ev)=>{
      const d = ev.detail||{};
      if (d.kind === 'storm_on') this.stormOn = 1;
      if (d.kind === 'storm_off') this.stormOn = 0;
      if (d.kind === 'pressure') this.pressure = Number(d.level ?? this.pressure) | 0;
      // If miss event comes explicitly, you could set a flag here too
    };
    this._onPower = (ev)=>{
      const d = ev.detail||{};
      const cur = Number(d.charge ?? 0);
      const thr = Math.max(1, Number(d.threshold ?? 8));
      this.powerPct = clamp(cur / thr, 0, 1);
    };

    // 핵: each second tick comes from ai:prediction
    this._onPred = (ev)=>{
      if (!this.enabled) return;
      const d = ev.detail||{};

      const snapNow = {
        score: this.score|0,
        combo: this.combo|0,
        misses: this.misses|0,
        accPct: this.accPct|0
      };

      // label previous row using deltas between now and prev snapshot
      if (this.prev && this.prevSnap){
        const dm = (snapNow.misses - this.prevSnap.misses);
        const ds = (snapNow.score  - this.prevSnap.score);
        const dc = (snapNow.combo  - this.prevSnap.combo);

        this.prev.y_missNext = (dm > 0) ? 1 : 0;
        this.prev.y_scoreDelta = ds|0;
        this.prev.y_comboDelta = dc|0;
        this.prev.y_accNextPct = snapNow.accPct|0;

        // simple proxy: if score increased and miss didn't increase, treat as goodHitNext
        this.prev.y_goodHitNext = (ds > 0 && dm === 0) ? 1 : 0;

        // push finalized row
        this.rows.push(this.prev);
        if (this.rows.length > this.maxRows) this.rows.splice(0, this.rows.length - this.maxRows);

        // periodic save
        if ((this.rows.length % 25) === 0) this._save();
      }

      // build new row (unlabeled yet)
      const f = Array.isArray(d.features) ? d.features : [];
      const row = {
        t_iso: nowIso(),
        run: String(qs('run','play')||'play'),
        diff: String(qs('diff','normal')||'normal'),
        style: String(qs('style','mix')||'mix'),
        view: String(qs('view','mobile')||'mobile'),
        seed: String(qs('seed','')||''),

        // predictor outputs
        p_riskMiss: +clamp(d.riskMiss ?? 0, 0, 1).toFixed(4),
        p_accNextPct: Number(d.accNextPct ?? 0) | 0,
        p_recommend: +clamp(d.recommend ?? 0, -1, 1).toFixed(4),
        p_source: String(d.source||'unknown'),

        // features (fixed length 10)
        f0_acc: +clamp(f[0] ?? (this.accPct/100), 0, 1).toFixed(4),
        f1_comboNorm: +clamp(f[1] ?? clamp(this.combo/12,0,1), 0, 1).toFixed(4),
        f2_missRate: +clamp(f[2] ?? clamp(this.misses/18,0,1), 0, 1).toFixed(4),
        f3_pressure: +clamp(f[3] ?? clamp((this.pressure/3),0,1), 0, 1).toFixed(4),
        f4_stormOn: (this.stormOn?1:0),
        f5_miniOn: (this.miniOn?1:0),
        f6_timeLeftNorm: +clamp(f[6] ?? clamp(this.timeLeft/90,0,1), 0, 1).toFixed(4),
        f7_goalPct: +clamp(f[7] ?? this.goalPct, 0, 1).toFixed(4),
        f8_powerPct: +clamp(f[8] ?? this.powerPct, 0, 1).toFixed(4),
        f9_speedHint: +clamp(f[9] ?? 0.5, 0, 1).toFixed(4),

        // current snap (for offline labels too)
        s_score: snapNow.score,
        s_combo: snapNow.combo,
        s_misses: snapNow.misses,
        s_accPct: snapNow.accPct,

        // labels placeholders (filled next tick)
        y_missNext: '',
        y_scoreDelta: '',
        y_comboDelta: '',
        y_accNextPct: '',
        y_goodHitNext: ''
      };

      this.prev = row;
      this.prevSnap = snapNow;

      // update UI counter
      if (this._ui){
        const n = this.rows.length + (this.prev ? 1 : 0);
        const elN = this._ui.querySelector('[data-n]');
        if (elN) elN.textContent = String(n);
      }
    };

    root.addEventListener('hha:score', this._onScore, {passive:true});
    root.addEventListener('hha:rank', this._onRank, {passive:true});
    root.addEventListener('hha:time', this._onTime, {passive:true});
    root.addEventListener('quest:update', this._onQuest, {passive:true});
    root.addEventListener('groups:progress', this._onProg, {passive:true});
    root.addEventListener('groups:power', this._onPower, {passive:true});
    root.addEventListener('ai:prediction', this._onPred, {passive:true});

    // flush save on leave (best-effort)
    root.addEventListener('beforeunload', ()=>{ try{ this._save(); }catch(_){} }, {passive:true});
  };

  Dataset.prototype._unbind = function(){
    if (!this._onPred) return;
    root.removeEventListener('hha:score', this._onScore);
    root.removeEventListener('hha:rank', this._onRank);
    root.removeEventListener('hha:time', this._onTime);
    root.removeEventListener('quest:update', this._onQuest);
    root.removeEventListener('groups:progress', this._onProg);
    root.removeEventListener('groups:power', this._onPower);
    root.removeEventListener('ai:prediction', this._onPred);

    this._onPred = this._onScore = this._onRank = this._onTime = this._onQuest = this._onProg = this._onPower = null;
  };

  Dataset.prototype._mountUI = function(){
    if (!DOC || !DOC.body) return;
    if (this._ui) return;

    const box = DOC.createElement('div');
    box.style.cssText =
      'position:fixed;right:10px;bottom:10px;z-index:9999;'+
      'background:rgba(2,6,23,.78);border:1px solid rgba(148,163,184,.22);'+
      'border-radius:14px;padding:10px 10px;backdrop-filter:blur(8px);'+
      'box-shadow:0 14px 34px rgba(0,0,0,.45);font-family:system-ui;'+
      'color:#e5e7eb;min-width:220px;pointer-events:auto;';
    box.innerHTML = `
      <div style="font-weight:1000;display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span>🧠 Train Dataset</span>
        <span style="font-size:12px;color:#94a3b8;">rows: <b data-n>0</b></span>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button data-exp="csv" style="border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:#e5e7eb;padding:8px 10px;font-weight:900;">⬇️ CSV</button>
        <button data-exp="json" style="border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:#e5e7eb;padding:8px 10px;font-weight:900;">📦 JSON</button>
        <button data-exp="clear" style="border-radius:12px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.10);color:#fee2e2;padding:8px 10px;font-weight:900;">🧹 Clear</button>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#94a3b8;line-height:1.35;">
        เปิดด้วย <b>?ai=1&train=1</b> เท่านั้น (กันเด็กเล่นปกติไม่เห็น)
      </div>
    `;

    box.querySelector('[data-exp="csv"]').addEventListener('click', ()=>this.exportCSV());
    box.querySelector('[data-exp="json"]').addEventListener('click', ()=>this.exportJSON());
    box.querySelector('[data-exp="clear"]').addEventListener('click', ()=>this.clear());

    DOC.body.appendChild(box);
    this._ui = box;

    // set initial counter
    const elN = this._ui.querySelector('[data-n]');
    if (elN) elN.textContent = String(this.rows.length);
  };

  Dataset.prototype._unmountUI = function(){
    if (this._ui){
      try{ this._ui.remove(); }catch(_){}
      this._ui = null;
    }
  };

  // export
  NS.Dataset = new Dataset();

  // auto start when DOM ready
  function boot(){
    try{ NS.Dataset.start(); }catch(_){}
  }
  if (DOC && DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);