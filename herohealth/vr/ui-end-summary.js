// === /herohealth/vr/ui-end-summary.js ===
// HeroHealth End Summary (Pack 22) — Universal for all games
// ✅ Overlay summary + grade + key stats + reason
// ✅ Save last summary: localStorage HHA_LAST_SUMMARY
// ✅ Back to HUB button (uses ?hub=... or fallback ../hub.html)
// ✅ Flush-hardened: on end / pagehide / visibilitychange / popstate
// ✅ Emits: hha:summary:shown, hha:summary:closed, hha:backhub

(function(ROOT){
  'use strict';
  const DOC = ROOT.document;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  const KEY_LAST = 'HHA_LAST_SUMMARY';

  function safeJson(x){
    try{ return JSON.stringify(x); }catch{ return ''; }
  }
  function safeParse(s){
    try{ return JSON.parse(s); }catch{ return null; }
  }

  function defaultHub(){
    // Prefer explicit hub param; else try common paths
    return qs('hub', '../hub.html') || '../hub.html';
  }

  // -------- UI create --------
  function ensureStyle(){
    if (DOC.getElementById('hha-end-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-end-style';
    st.textContent = `
      .hha-end{
        position:fixed; inset:0; z-index:190;
        display:flex; align-items:center; justify-content:center;
        background: rgba(2,6,23,.62);
        backdrop-filter: blur(10px);
        opacity:0; pointer-events:none;
        transition: opacity 160ms ease;
      }
      .hha-end[aria-hidden="false"]{ opacity:1; pointer-events:auto; }
      .hha-end-card{
        width:min(820px, 94vw);
        background: rgba(2,6,23,.86);
        border:1px solid rgba(148,163,184,.22);
        border-radius: 24px;
        padding:18px;
        box-shadow: 0 18px 60px rgba(0,0,0,.55);
      }
      .hha-end-top{
        display:flex; gap:12px; align-items:flex-start; justify-content:space-between;
      }
      .hha-end-title{ font-size:26px; font-weight:1100; }
      .hha-end-sub{ margin-top:6px; color:rgba(148,163,184,.92); font-weight:900; font-size:13px; line-height:1.35; }
      .hha-end-grade{
        display:flex; align-items:center; justify-content:center;
        width:92px; height:92px;
        border-radius: 22px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(15,23,42,.55);
        font-size:34px; font-weight:1200;
      }
      .hha-end-grid{
        margin-top:14px;
        display:grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap:10px;
      }
      .hha-end-stat{
        background: rgba(15,23,42,.45);
        border:1px solid rgba(148,163,184,.18);
        border-radius: 18px;
        padding:12px;
      }
      .hha-end-stat .k{ color:rgba(148,163,184,.92); font-size:12px; font-weight:900; }
      .hha-end-stat .v{ margin-top:4px; font-size:22px; font-weight:1100; }
      .hha-end-actions{
        margin-top:14px;
        display:flex; gap:10px; flex-wrap:wrap;
        align-items:center; justify-content:flex-end;
      }
      .hha-btn{
        height:54px;
        padding: 0 16px;
        border-radius: 18px;
        border:1px solid rgba(148,163,184,.20);
        background: rgba(2,6,23,.70);
        color: rgba(229,231,235,.96);
        font-size:16px;
        font-weight:1100;
      }
      .hha-btn:active{ transform: translateY(1px); }
      .hha-btn.primary{
        border-color: rgba(34,197,94,.35);
        background: rgba(34,197,94,.16);
        color:#eafff3;
      }
      .hha-end-note{
        margin-top:10px;
        color:rgba(148,163,184,.90);
        font-size:12px;
        font-weight:900;
        line-height:1.35;
      }
      @media (max-width:640px){
        .hha-end-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
        .hha-end-grade{ width:80px; height:80px; font-size:30px; }
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureStyle();
    let el = DOC.getElementById('hhaEnd');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hhaEnd';
    el.className = 'hha-end';
    el.setAttribute('aria-hidden','true');

    el.innerHTML = `
      <div class="hha-end-card" role="dialog" aria-modal="true">
        <div class="hha-end-top">
          <div style="min-width:0">
            <div class="hha-end-title" id="hhaEndTitle">สรุปผล</div>
            <div class="hha-end-sub" id="hhaEndSub">—</div>
          </div>
          <div class="hha-end-grade" id="hhaEndGrade">—</div>
        </div>

        <div class="hha-end-grid" id="hhaEndGrid"></div>

        <div class="hha-end-actions">
          <button class="hha-btn" id="hhaEndClose">ปิด</button>
          <button class="hha-btn primary" id="hhaEndBack">กลับหน้า HUB</button>
        </div>

        <div class="hha-end-note" id="hhaEndNote">
          ระบบจะบันทึกผลล่าสุดไว้ในเครื่อง (HHA_LAST_SUMMARY) และส่งกลับไปหน้า HUB
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function fmt(v){
    if (v==null) return '—';
    if (typeof v === 'number'){
      if (!Number.isFinite(v)) return '—';
      if (Math.abs(v) >= 1000) return String(Math.round(v));
      // keep 1 decimal for % like 83.2
      const s = String(v);
      return s.includes('.') ? (Math.round(v*10)/10).toString() : s;
    }
    return String(v);
  }

  function buildStatGrid(summary){
    const grid = DOC.getElementById('hhaEndGrid');
    if (!grid) return;

    const s = summary || {};
    // Pick common keys across all games
    const rows = [
      ['คะแนน', s.scoreFinal ?? s.score ?? s.scoreTotal ?? null],
      ['เกรด', s.grade ?? null],
      ['เวลาเล่น (s)', s.durationPlayedSec ?? s.durationSec ?? null],

      ['Combo Max', s.comboMax ?? null],
      ['Miss', s.misses ?? s.miss ?? null],
      ['Accuracy %', s.accuracyGoodPct ?? s.accuracyPct ?? null],

      ['Goals', (s.goalsCleared!=null && s.goalsTotal!=null) ? `${s.goalsCleared}/${s.goalsTotal}` : null],
      ['Minis', (s.miniCleared!=null && s.miniTotal!=null) ? `${s.miniCleared}/${s.miniTotal}` : null],
      ['Reason', s.reason ?? null],
    ];

    grid.innerHTML = '';
    for (const [k,v] of rows){
      if (v==null || v==='') continue;
      const box = DOC.createElement('div');
      box.className = 'hha-end-stat';
      box.innerHTML = `<div class="k">${k}</div><div class="v">${fmt(v)}</div>`;
      grid.appendChild(box);
    }
  }

  function show(summary){
    const ui = ensureUI();
    const titleEl = DOC.getElementById('hhaEndTitle');
    const subEl   = DOC.getElementById('hhaEndSub');
    const gradeEl = DOC.getElementById('hhaEndGrade');

    const s = summary || {};
    const run  = s.runMode ?? s.run ?? qs('run','play');
    const diff = s.diff ?? qs('diff','normal');
    const view = s.device ?? s.view ?? qs('view','mobile');

    if(titleEl) titleEl.textContent = s.title || ((s.reason==='missLimit' || s.reason==='gameover') ? 'Game Over' : 'Completed');
    if(subEl) subEl.textContent = `เกม: ${s.projectTag || '—'} • โหมด: ${run} • ระดับ: ${diff} • อุปกรณ์: ${view}`;
    if(gradeEl) gradeEl.textContent = s.grade || '—';

    buildStatGrid(s);

    ui.setAttribute('aria-hidden','false');
    try{ ROOT.dispatchEvent(new CustomEvent('hha:summary:shown', { detail:s })); }catch(_){}
  }

  function hide(){
    const ui = ensureUI();
    ui.setAttribute('aria-hidden','true');
    try{ ROOT.dispatchEvent(new CustomEvent('hha:summary:closed', {})); }catch(_){}
  }

  function save(summary){
    try{
      const s = summary || {};
      localStorage.setItem(KEY_LAST, safeJson(s));
      return true;
    }catch(_){
      return false;
    }
  }

  function loadLast(){
    try{
      const s = localStorage.getItem(KEY_LAST);
      return safeParse(s);
    }catch(_){
      return null;
    }
  }

  // ---- flush hardened: save once with best available summary ----
  let _lastSummary = null;
  let _flushed = false;

  function flush(summary, reasonHint){
    if (_flushed) return;
    _flushed = true;

    const base = summary || _lastSummary || {};
    const s = {
      ...base,
      reason: base.reason || reasonHint || base.reason || 'unknown',
      endTimeIso: base.endTimeIso || new Date().toISOString(),
      hub: base.hub ?? qs('hub', null),
    };
    save(s);
  }

  function goHub(summary){
    const hub = (summary && summary.hub) ? summary.hub : defaultHub();
    try{ ROOT.dispatchEvent(new CustomEvent('hha:backhub', { detail:{ hub } })); }catch(_){}
    location.href = hub;
  }

  function flushAndGoHub(summary, reasonHint){
    flush(summary, reasonHint || 'backhub');
    goHub(summary);
  }

  function install(opts={}){
    ensureUI();
    // wire buttons once
    const ui = DOC.getElementById('hhaEnd');
    const btnClose = DOC.getElementById('hhaEndClose');
    const btnBack  = DOC.getElementById('hhaEndBack');

    if (btnClose && !btnClose.__hhaBound){
      btnClose.__hhaBound = true;
      btnClose.addEventListener('click', ()=> hide(), { passive:true });
    }
    if (btnBack && !btnBack.__hhaBound){
      btnBack.__hhaBound = true;
      btnBack.addEventListener('click', ()=>{
        flushAndGoHub(_lastSummary || {}, 'backhub');
      }, { passive:false });
    }

    // Listen for end event from any engine
    if (!install.__bound){
      install.__bound = true;

      ROOT.addEventListener('hha:end', (ev)=>{
        const s = ev?.detail || {};
        _lastSummary = s;
        // Always save immediately (flush-hardened)
        flush(s, s.reason || 'end');
        show(s);
      }, { passive:true });

      // If engine wants to force end with reason
      ROOT.addEventListener('hha:force-end', (ev)=>{
        const reason = ev?.detail?.reason || 'force';
        flush(_lastSummary || {}, reason);
        show({ ...(_lastSummary||{}), reason, title:'Game Over' });
      }, { passive:true });

      // pagehide/visibility harden
      ROOT.addEventListener('pagehide', ()=>{
        flush(_lastSummary || {}, 'pagehide');
      }, { passive:true });

      DOC.addEventListener('visibilitychange', ()=>{
        if (DOC.visibilityState === 'hidden'){
          flush(_lastSummary || {}, 'hidden');
        }
      }, { passive:true });

      // back button harden (if user presses back)
      ROOT.addEventListener('popstate', ()=>{
        flush(_lastSummary || {}, 'popstate');
      }, { passive:true });
    }

    // Optional: if you want to auto-show last summary when opened with ?summary=1
    if (String(qs('summary','0')) === '1'){
      const last = loadLast();
      if (last) show(last);
    }

    return {
      show, hide, save, loadLast,
      flush, flushAndGoHub
    };
  }

  ROOT.HHA_END = { install, show, hide, save, loadLast, flush, flushAndGoHub };

})(window);