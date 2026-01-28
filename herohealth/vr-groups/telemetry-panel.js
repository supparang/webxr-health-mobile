// === /herohealth/vr-groups/telemetry-panel.js ===
// GroupsVR Telemetry Panel (PACK 15.2) — PRODUCTION
// ✅ Enable by: ?telePanel=1  OR localStorage HHA_TELE_PANEL_GroupsVR=1
// ✅ Toggle shortcuts:
//    - PC: Ctrl+Alt+T
//    - Mobile: triple-tap top-left corner
// ✅ Features:
//    - Mode cycle: off|lite|full (respects research/practice forced off)
//    - Resend now
//    - Export pending JSON (download)
//    - Copy pending JSON to clipboard
//    - Clear queue
//    - Live status: pending batches/events, last send/fail, fps, adapt pressure, multipliers

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const LS_PANEL = 'HHA_TELE_PANEL_GroupsVR';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function fmtMsAgo(ms){
    if(ms == null || ms < 0) return '—';
    const s = Math.round(ms/1000);
    if(s < 60) return s + 's';
    const m = Math.round(s/60);
    return m + 'm';
  }
  function safeJson(x, fb){ try{ return JSON.stringify(x, null, 2); }catch{ return fb; } }

  function isEnabledByDefault(){
    const q = String(qs('telePanel','')||'').trim();
    if(q === '1' || q === 'true') return true;
    try{
      return (localStorage.getItem(LS_PANEL) === '1');
    }catch(_){
      return false;
    }
  }

  // ---- find telemetry API ----
  const NS = root.GroupsVR = root.GroupsVR || {};
  function getTele(){
    return NS.Telemetry || null;
  }

  // ---- UI ----
  let panel = null;
  let visible = false;
  let lastStatus = null;
  let lastDrawAt = 0;

  function ensureStyle(){
    if(DOC.getElementById('hha-tele-panel-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-tele-panel-style';
    st.textContent = `
      .hha-tele-wrap{
        position:fixed; left:10px; bottom:10px; z-index:99999;
        width:min(360px, calc(100vw - 20px));
        border-radius:18px;
        background:rgba(2,6,23,.78);
        border:1px solid rgba(148,163,184,.18);
        color:#e5e7eb; backdrop-filter: blur(10px);
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        pointer-events:auto;
      }
      .hha-tele-head{
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px 8px 12px;
      }
      .hha-tele-title{
        font-weight:700; font-size:14px; letter-spacing:.2px;
        display:flex; gap:8px; align-items:center;
      }
      .hha-tele-pill{
        font-size:12px; padding:2px 10px; border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(15,23,42,.55);
      }
      .hha-tele-body{ padding:0 12px 12px 12px; }
      .hha-tele-grid{
        display:grid; grid-template-columns: 1fr 1fr;
        gap:8px; margin:8px 0 10px 0;
      }
      .hha-tele-card{
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.40);
        border-radius:14px;
        padding:8px 10px;
        font-size:12px; line-height:1.3;
      }
      .hha-tele-row{ display:flex; justify-content:space-between; gap:10px; }
      .hha-tele-k{ color:#94a3b8; }
      .hha-tele-v{ font-weight:600; }
      .hha-tele-actions{
        display:flex; flex-wrap:wrap;
        gap:8px; margin-top:8px;
      }
      .hha-tele-btn{
        appearance:none; border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.55);
        color:#e5e7eb;
        border-radius:999px;
        padding:8px 10px;
        font-size:12px; font-weight:700;
        cursor:pointer;
      }
      .hha-tele-btn:active{ transform:scale(.98); }
      .hha-tele-mini{
        margin-top:8px;
        border-top:1px dashed rgba(148,163,184,.22);
        padding-top:8px;
        font-size:11px;
        color:#cbd5e1;
        opacity:.95;
      }
      .hha-tele-close{
        border:none; background:transparent; color:#cbd5e1;
        cursor:pointer; font-size:18px; line-height:1;
        width:28px; height:28px; border-radius:10px;
      }
      .hha-tele-close:active{ background:rgba(148,163,184,.12); }
      .hha-tele-hidden{ display:none !important; }
      .hha-tele-toast{
        position:fixed; left:50%; bottom:18px; transform:translateX(-50%);
        background:rgba(15,23,42,.92);
        border:1px solid rgba(148,163,184,.22);
        color:#e5e7eb;
        border-radius:999px;
        padding:10px 14px;
        font-size:12px; font-weight:700;
        z-index:100000;
        max-width: min(520px, calc(100vw - 24px));
        text-align:center;
        box-shadow:0 12px 40px rgba(0,0,0,.35);
      }
    `;
    DOC.head.appendChild(st);
  }

  function toast(msg){
    try{
      const t = DOC.createElement('div');
      t.className = 'hha-tele-toast';
      t.textContent = String(msg||'');
      DOC.body.appendChild(t);
      setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 1400);
    }catch(_){}
  }

  function ensurePanel(){
    ensureStyle();
    if(panel) return panel;

    panel = DOC.createElement('div');
    panel.className = 'hha-tele-wrap hha-tele-hidden';
    panel.innerHTML = `
      <div class="hha-tele-head">
        <div class="hha-tele-title">
          <span>📡 Telemetry</span>
          <span id="hhaTeleMode" class="hha-tele-pill">mode: —</span>
        </div>
        <button id="hhaTeleClose" class="hha-tele-close" title="Hide">✕</button>
      </div>

      <div class="hha-tele-body">
        <div class="hha-tele-grid">
          <div class="hha-tele-card">
            <div class="hha-tele-row"><span class="hha-tele-k">Queue</span><span id="hhaTeleQueue" class="hha-tele-v">—</span></div>
            <div class="hha-tele-row"><span class="hha-tele-k">Last send</span><span id="hhaTeleLastSend" class="hha-tele-v">—</span></div>
          </div>
          <div class="hha-tele-card">
            <div class="hha-tele-row"><span class="hha-tele-k">FPS</span><span id="hhaTeleFps" class="hha-tele-v">—</span></div>
            <div class="hha-tele-row"><span class="hha-tele-k">Result</span><span id="hhaTeleRes" class="hha-tele-v">—</span></div>
          </div>
          <div class="hha-tele-card">
            <div class="hha-tele-row"><span class="hha-tele-k">Adapt</span><span id="hhaTeleAdapt" class="hha-tele-v">—</span></div>
            <div class="hha-tele-row"><span class="hha-tele-k">Pinned</span><span id="hhaTelePinned" class="hha-tele-v">—</span></div>
          </div>
          <div class="hha-tele-card">
            <div class="hha-tele-row"><span class="hha-tele-k">Mul</span><span id="hhaTeleMul" class="hha-tele-v">—</span></div>
            <div class="hha-tele-row"><span class="hha-tele-k">Endpoint</span><span id="hhaTeleEndp" class="hha-tele-v">—</span></div>
          </div>
        </div>

        <div class="hha-tele-actions">
          <button id="hhaTeleModeBtn" class="hha-tele-btn">Cycle mode</button>
          <button id="hhaTeleResend" class="hha-tele-btn">Resend now</button>
          <button id="hhaTeleExport" class="hha-tele-btn">Download JSON</button>
          <button id="hhaTeleCopy" class="hha-tele-btn">Copy JSON</button>
          <button id="hhaTeleClear" class="hha-tele-btn">Clear queue</button>
        </div>

        <div class="hha-tele-mini">
          Toggle: <b>Ctrl+Alt+T</b> (PC) • Triple-tap top-left (Mobile) • or <b>?telePanel=1</b><br/>
          Note: research/practice forces <b>OFF</b> (by design).
        </div>
      </div>
    `;

    DOC.body.appendChild(panel);

    // wires
    const $ = (id)=>DOC.getElementById(id);

    $('hhaTeleClose').addEventListener('click', ()=> setVisible(false), { passive:true });

    $('hhaTeleModeBtn').addEventListener('click', ()=>{
      const tele = getTele();
      if(!tele){ toast('Telemetry API not found'); return; }
      const cur = String(tele.getMode ? tele.getMode() : 'lite');
      let next = 'lite';
      if(cur === 'off') next = 'lite';
      else if(cur === 'lite') next = 'full';
      else next = 'off';
      try{ tele.setMode(next); toast('mode → ' + next); }catch(_){ toast('setMode failed'); }
    }, { passive:true });

    $('hhaTeleResend').addEventListener('click', async ()=>{
      const tele = getTele();
      if(!tele){ toast('Telemetry API not found'); return; }
      try{
        const r = await tele.resendNow();
        toast(r && r.ok ? `resend ok (sent ${r.sent||0})` : 'resend attempted');
      }catch(_){
        toast('resend failed');
      }
    }, { passive:true });

    $('hhaTeleExport').addEventListener('click', ()=>{
      const tele = getTele();
      if(!tele){ toast('Telemetry API not found'); return; }
      try{
        const json = tele.exportPending();
        const blob = new Blob([json], { type:'application/json' });
        const a = DOC.createElement('a');
        const ts = new Date();
        const name = `GroupsVR_telemetry_pending_${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}.json`;
        a.href = URL.createObjectURL(blob);
        a.download = name;
        DOC.body.appendChild(a);
        a.click();
        setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){} }, 1200);
        toast('downloaded pending JSON');
      }catch(_){
        toast('export failed');
      }
    }, { passive:true });

    $('hhaTeleCopy').addEventListener('click', async ()=>{
      const tele = getTele();
      if(!tele){ toast('Telemetry API not found'); return; }
      try{
        const json = tele.exportPending();
        if (navigator && navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(json);
          toast('copied JSON to clipboard');
        } else {
          toast('clipboard not available');
        }
      }catch(_){
        toast('copy failed');
      }
    }, { passive:true });

    $('hhaTeleClear').addEventListener('click', ()=>{
      const tele = getTele();
      if(!tele){ toast('Telemetry API not found'); return; }
      try{
        tele.clearQueue();
        toast('queue cleared');
      }catch(_){
        toast('clear failed');
      }
    }, { passive:true });

    return panel;
  }

  function setVisible(on){
    ensurePanel();
    visible = !!on;

    if(visible) panel.classList.remove('hha-tele-hidden');
    else panel.classList.add('hha-tele-hidden');

    try{
      localStorage.setItem(LS_PANEL, visible ? '1' : '0');
    }catch(_){}

    if(visible) drawStatus(true);
  }

  function drawStatus(force){
    if(!panel || (!visible && !force)) return;

    const t = nowMs();
    if(!force && (t - lastDrawAt) < 200) return;
    lastDrawAt = t;

    const tele = getTele();
    const st = lastStatus || (tele && tele.getLastStatus ? tele.getLastStatus() : null);

    const $ = (id)=>DOC.getElementById(id);
    const mode = (tele && tele.getMode) ? tele.getMode() : (st ? st.mode : '—');

    $('hhaTeleMode').textContent = 'mode: ' + String(mode||'—');

    if(!st){
      $('hhaTeleQueue').textContent = '—';
      $('hhaTeleLastSend').textContent = '—';
      $('hhaTeleFps').textContent = '—';
      $('hhaTeleRes').textContent = '—';
      $('hhaTeleAdapt').textContent = '—';
      $('hhaTelePinned').textContent = '—';
      $('hhaTeleMul').textContent = '—';
      $('hhaTeleEndp').textContent = '—';
      return;
    }

    $('hhaTeleQueue').textContent = `${st.pendingBatches|0}b / ${st.pendingEvents|0}e`;
    $('hhaTeleLastSend').textContent = fmtMsAgo(st.lastSentMsAgo);
    $('hhaTeleFps').textContent = String(st.fpsAvg ?? '—');
    $('hhaTeleRes').textContent = String(st.lastSendResult ?? '—');

    $('hhaTeleAdapt').textContent = (st.adaptEnabled ? `p${st.adaptPressure}` : 'off');
    $('hhaTelePinned').textContent = st.pinned ? 'yes' : 'no';
    $('hhaTeleMul').textContent = `thr×${st.thrMul} sam×${st.samMul} fl×${st.flushMul}`;
    $('hhaTeleEndp').textContent = st.endpoint ? 'yes' : 'no';
  }

  // ---- status events ----
  root.addEventListener('groups:telemetry_status', (ev)=>{
    lastStatus = ev.detail || null;
    if(visible) drawStatus(false);
  }, { passive:true });

  // ---- toggles ----
  function installToggles(){
    // PC: Ctrl+Alt+T
    DOC.addEventListener('keydown', (e)=>{
      const k = String(e.key||'').toLowerCase();
      if (k === 't' && e.ctrlKey && e.altKey){
        e.preventDefault();
        setVisible(!visible);
      }
    }, { capture:true });

    // Mobile: triple tap top-left corner
    let taps = 0;
    let lastTapAt = 0;
    DOC.addEventListener('pointerdown', (e)=>{
      const x = Number(e.clientX||0);
      const y = Number(e.clientY||0);
      const W = root.innerWidth||360;
      const H = root.innerHeight||640;

      // top-left hot zone
      const inZone = (x >= 0 && x <= Math.min(90, W*0.22) && y >= 0 && y <= Math.min(90, H*0.18));
      if(!inZone) { taps = 0; return; }

      const t = nowMs();
      if (t - lastTapAt > 520) taps = 0;
      lastTapAt = t;
      taps++;

      if(taps >= 3){
        taps = 0;
        setVisible(!visible);
        toast(visible ? 'Telemetry panel ON' : 'Telemetry panel OFF');
      }
    }, { passive:true });
  }

  // ---- boot ----
  function boot(){
    installToggles();

    if(isEnabledByDefault()){
      setVisible(true);
      toast('Telemetry panel ON');
    }
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);