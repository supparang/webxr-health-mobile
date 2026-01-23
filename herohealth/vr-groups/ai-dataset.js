// === /herohealth/vr-groups/ai-dataset.js ===
// PACK 19 — Dataset Collector v1.1 (labels from groups:metrics deltas)
// ✅ enabled only when: run=play AND ai=1 AND train=1
// ✅ 1 row/sec via groups:metrics (emitted when timeLeft changes)
// ✅ Labels are "next-second deltas" for previous row (exact):
//    y_missNext, y_hitGoodNext, y_hitWrongNext, y_hitJunkNext, y_expireGoodNext
//    y_scoreDelta, y_comboDelta, y_accNextPct
// ✅ localStorage: HHA_GROUPS_DATASET_V1 (max 10k rows)

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
    }catch(_){ return false; }
  }

  function toCSV(rows){
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

    // last known metrics snapshot (cumulative)
    this.M = null;

    // latest predictor outputs (optional)
    this.P = { riskMiss:0, accNextPct:0, recommend:0, source:'none', features:[] };

    // prev row waiting for labels
    this.prevRow = null;
    this.prevM = null;

    this.rows = [];
    this.maxRows = 10000;

    this._ui = null;
    this._onMetrics = null;
    this._onPred = null;
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
    try{ DOC.body.classList.add('train-on'); }catch(_){}
  };

  Dataset.prototype._load = function(){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      if (Array.isArray(arr)) this.rows = arr.slice(0, this.maxRows);
    }catch(_){ this.rows = []; }
  };

  Dataset.prototype._save = function(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(this.rows.slice(-this.maxRows))); }catch(_){}
  };

  Dataset.prototype.clear = function(){
    this.rows = [];
    this.prevRow = null;
    this.prevM = null;
    try{ localStorage.removeItem(LS_KEY); }catch(_){}
    alert('ล้าง Dataset แล้ว ✅');
    this._updateUI();
  };

  Dataset.prototype.exportJSON = function(){
    if (!this.rows.length){ alert('ยังไม่มีข้อมูล Dataset'); return; }
    const payload = { schema:'GroupsVR.Dataset.v1.1', exportedAtIso:nowIso(), n:this.rows.length, rows:this.rows };
    const ok = downloadText(`groupsvr-dataset-${Date.now()}.json`, JSON.stringify(payload, null, 2));
    if (!ok) alert('ดาวน์โหลดไม่สำเร็จ (ลองบน Chrome/desktop)');
  };

  Dataset.prototype.exportCSV = function(){
    if (!this.rows.length){ alert('ยังไม่มีข้อมูล Dataset'); return; }
    const ok = downloadText(`groupsvr-dataset-${Date.now()}.csv`, toCSV(this.rows));
    if (!ok) alert('ดาวน์โหลดไม่สำเร็จ (ลองบน Chrome/desktop)');
  };

  Dataset.prototype._bind = function(){
    if (this._onMetrics) return;

    this._onPred = (ev)=>{
      const d = ev.detail||{};
      this.P = {
        riskMiss: +clamp(d.riskMiss ?? 0, 0, 1).toFixed(4),
        accNextPct: Number(d.accNextPct ?? 0)|0,
        recommend: +clamp(d.recommend ?? 0, -1, 1).toFixed(4),
        source: String(d.source||'unknown'),
        features: Array.isArray(d.features) ? d.features : []
      };
    };

    this._onMetrics = (ev)=>{
      if (!this.enabled) return;
      const m = ev.detail || {};
      // ignore if no time
      if (m.tLeftSec == null) return;

      // finalize previous row labels using delta(prevM -> m)
      if (this.prevRow && this.prevM){
        const dm = (Number(m.misses||0) - Number(this.prevM.misses||0));
        const dHG= (Number(m.nHitGood||0) - Number(this.prevM.nHitGood||0));
        const dHW= (Number(m.nHitWrong||0) - Number(this.prevM.nHitWrong||0));
        const dHJ= (Number(m.nHitJunk||0) - Number(this.prevM.nHitJunk||0));
        const dEG= (Number(m.nExpireGood||0) - Number(this.prevM.nExpireGood||0));

        this.prevRow.y_missNext = (dm>0)?1:0;
        this.prevRow.y_hitGoodNext = (dHG>0)?1:0;
        this.prevRow.y_hitWrongNext = (dHW>0)?1:0;
        this.prevRow.y_hitJunkNext = (dHJ>0)?1:0;
        this.prevRow.y_expireGoodNext = (dEG>0)?1:0;

        this.prevRow.y_scoreDelta = (Number(m.score||0) - Number(this.prevM.score||0))|0;
        this.prevRow.y_comboDelta = (Number(m.combo||0) - Number(this.prevM.combo||0))|0;
        this.prevRow.y_accNextPct = Number(m.accuracyGoodPct||0)|0;

        this.rows.push(this.prevRow);
        if (this.rows.length > this.maxRows) this.rows.splice(0, this.rows.length - this.maxRows);
        if ((this.rows.length % 25) === 0) this._save();
      }

      // build new row (unlabeled yet)
      const f = this.P.features || [];
      const timeLeft = Number(m.tLeftSec||0)|0;
      const accPct = Number(m.accuracyGoodPct||0)|0;

      const thr = Math.max(1, Number(m.powerThreshold||8));
      const powerPct = clamp(Number(m.powerCharge||0)/thr, 0, 1);

      const goalNeed = Math.max(1, Number(m.goalNeed||1));
      const goalPct = clamp(Number(m.goalNow||0)/goalNeed, 0, 1);

      const row = {
        t_iso: nowIso(),
        run: String(qs('run','play')||'play'),
        diff: String(qs('diff','normal')||'normal'),
        style: String(qs('style','mix')||'mix'),
        view: String(qs('view','mobile')||'mobile'),
        seed: String(qs('seed','')||''),

        // predictor outputs (optional)
        p_riskMiss: this.P.riskMiss,
        p_accNextPct: this.P.accNextPct,
        p_recommend: this.P.recommend,
        p_source: this.P.source,

        // features (10) — keep fixed vector length
        f0_acc: +clamp(f[0] ?? (accPct/100), 0, 1).toFixed(4),
        f1_comboNorm: +clamp(f[1] ?? clamp((Number(m.combo||0)/12),0,1), 0, 1).toFixed(4),
        f2_missRate: +clamp(f[2] ?? clamp((Number(m.misses||0)/18),0,1), 0, 1).toFixed(4),
        f3_pressure: +clamp(f[3] ?? clamp((Number(m.pressureLevel||0)/3),0,1), 0, 1).toFixed(4),
        f4_stormOn: (Number(m.stormOn||0)?1:0),
        f5_miniOn: (Number(m.miniOn||0)?1:0),
        f6_timeLeftNorm: +clamp(f[6] ?? clamp(timeLeft/90,0,1), 0, 1).toFixed(4),
        f7_goalPct: +clamp(f[7] ?? goalPct, 0, 1).toFixed(4),
        f8_powerPct: +clamp(f[8] ?? powerPct, 0, 1).toFixed(4),
        f9_speedHint: +clamp(f[9] ?? 0.5, 0, 1).toFixed(4),

        // snapshots (cumulative)
        s_score: Number(m.score||0)|0,
        s_combo: Number(m.combo||0)|0,
        s_misses: Number(m.misses||0)|0,
        s_accPct: accPct,
        s_hitGood: Number(m.nHitGood||0)|0,
        s_hitWrong:Number(m.nHitWrong||0)|0,
        s_hitJunk: Number(m.nHitJunk||0)|0,
        s_expireGood:Number(m.nExpireGood||0)|0,
        s_shots: Number(m.shots||0)|0,
        s_shotsMiss:Number(m.shotsMiss||0)|0,

        // labels placeholders (filled next tick)
        y_missNext:'',
        y_hitGoodNext:'',
        y_hitWrongNext:'',
        y_hitJunkNext:'',
        y_expireGoodNext:'',
        y_scoreDelta:'',
        y_comboDelta:'',
        y_accNextPct:''
      };

      this.prevRow = row;
      this.prevM = m;
      this.M = m;

      this._updateUI();
    };

    root.addEventListener('ai:prediction', this._onPred, {passive:true});
    root.addEventListener('groups:metrics', this._onMetrics, {passive:true});
    root.addEventListener('beforeunload', ()=>{ try{ this._save(); }catch(_){} }, {passive:true});
  };

  Dataset.prototype._updateUI = function(){
    if (!this._ui) return;
    const elN = this._ui.querySelector('[data-n]');
    if (elN){
      const n = this.rows.length + (this.prevRow ? 1 : 0);
      elN.textContent = String(n);
    }
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
      'color:#e5e7eb;min-width:230px;pointer-events:auto;';
    box.innerHTML = `
      <div style="font-weight:1000;display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span>🧠 Train Dataset</span>
        <span style="font-size:12px;color:#94a3b8;">rows: <b data-n>0</b></span>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button data-exp="csv"  style="border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:#e5e7eb;padding:8px 10px;font-weight:900;">⬇️ CSV</button>
        <button data-exp="json" style="border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);color:#e5e7eb;padding:8px 10px;font-weight:900;">📦 JSON</button>
        <button data-exp="clear" style="border-radius:12px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.10);color:#fee2e2;padding:8px 10px;font-weight:900;">🧹 Clear</button>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#94a3b8;line-height:1.35;">
        เปิดด้วย <b>?ai=1&train=1</b> เท่านั้น
      </div>
    `;
    box.querySelector('[data-exp="csv"]').addEventListener('click', ()=>this.exportCSV());
    box.querySelector('[data-exp="json"]').addEventListener('click', ()=>this.exportJSON());
    box.querySelector('[data-exp="clear"]').addEventListener('click', ()=>this.clear());

    DOC.body.appendChild(box);
    this._ui = box;
    this._updateUI();
  };

  // export
  NS.Dataset = new Dataset();

  function boot(){
    try{ NS.Dataset.start(); }catch(_){}
  }
  if (DOC && DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);