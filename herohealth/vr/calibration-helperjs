// === /herohealth/vr/calibration-helper.js ===
// HeroHealth — Calibration + Recenter Helper (Cardboard/cVR friendly)
// - Stores a small offset (dx,dy) applied to "centerPoint" aiming.
// - Provides UI overlay: Calibrate + Recenter + Reset
// - Deterministic storage key per gameMode (default "herohealth")

(function(root){
  'use strict';
  const DOC = root.document;

  const Cal = {
    keyBase: 'HHA_CAL_',
    state: { dx:0, dy:0 }, // px
    enabled: true
  };

  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; }
  }

  function gameKey(){
    return String(qs('gameMode', qs('game','hydration')) || 'herohealth').toLowerCase();
  }

  function storageKey(){
    return Cal.keyBase + gameKey();
  }

  function load(){
    try{
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const obj = JSON.parse(raw);
      Cal.state.dx = Number(obj.dx)||0;
      Cal.state.dy = Number(obj.dy)||0;
    }catch(_){}
  }

  function save(){
    try{
      localStorage.setItem(storageKey(), JSON.stringify({ dx: Cal.state.dx, dy: Cal.state.dy }));
    }catch(_){}
  }

  function set(dx,dy){
    Cal.state.dx = clamp(dx, -120, 120);
    Cal.state.dy = clamp(dy, -120, 120);
    save();
    emit('hha:recenter', { dx:Cal.state.dx, dy:Cal.state.dy, game:gameKey() });
  }

  function recenter(){
    // "recenter" = set offset to 0 (or keep, if you want to "freeze current")
    set(0,0);
  }

  function reset(){
    try{ localStorage.removeItem(storageKey()); }catch(_){}
    Cal.state.dx=0; Cal.state.dy=0;
    emit('hha:recenter', { dx:0, dy:0, reset:true, game:gameKey() });
  }

  function get(){
    return { dx: Cal.state.dx, dy: Cal.state.dy };
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------- UI ----------
  function ensureStyles(){
    if (DOC.getElementById('hha-cal-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-cal-style';
    st.textContent = `
      .hha-cal-backdrop{
        position:fixed; inset:0; z-index:150;
        background:rgba(2,6,23,.78);
        backdrop-filter: blur(10px);
        display:flex; align-items:center; justify-content:center;
        padding: calc(14px + env(safe-area-inset-top,0px))
                 calc(14px + env(safe-area-inset-right,0px))
                 calc(14px + env(safe-area-inset-bottom,0px))
                 calc(14px + env(safe-area-inset-left,0px));
      }
      .hha-cal-card{
        width:min(920px, 100%);
        border-radius:22px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.72);
        box-shadow: 0 24px 90px rgba(0,0,0,.55);
        padding:16px;
        color:#e5e7eb;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      .hha-cal-top{
        display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
      }
      .hha-cal-title{
        margin:0; font-size:16px; font-weight:900; letter-spacing:.2px;
      }
      .hha-cal-sub{
        margin:6px 0 0 0;
        font-size:12px; line-height:1.35;
        color:rgba(148,163,184,.95);
        white-space:pre-line;
      }
      .hha-cal-grid{
        margin-top:14px;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:12px;
      }
      .hha-cal-pane{
        border-radius:18px;
        border:1px solid rgba(148,163,184,.16);
        background:rgba(15,23,42,.55);
        padding:12px;
      }
      .hha-cal-aim{
        position:relative;
        width:100%;
        aspect-ratio: 16/10;
        border-radius:16px;
        border:1px solid rgba(148,163,184,.18);
        overflow:hidden;
        background:
          radial-gradient(circle at 50% 50%, rgba(34,211,238,.10), transparent 55%),
          radial-gradient(circle at 10% 15%, rgba(34,197,94,.08), transparent 55%),
          rgba(2,6,23,.55);
      }
      .hha-cal-center{
        position:absolute;
        left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:22px; height:22px;
        border-radius:999px;
        border:2px solid rgba(229,231,235,.85);
        box-shadow: 0 10px 30px rgba(0,0,0,.55);
      }
      .hha-cal-dot{
        position:absolute;
        left:50%; top:50%;
        transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px)));
        width:8px; height:8px;
        border-radius:999px;
        background:rgba(34,211,238,.95);
        box-shadow: 0 12px 30px rgba(0,0,0,.55);
      }
      .hha-cal-cross{
        position:absolute; inset:0;
        background:
          linear-gradient(to right, transparent 49.7%, rgba(148,163,184,.28) 50%, transparent 50.3%),
          linear-gradient(to bottom, transparent 49.7%, rgba(148,163,184,.28) 50%, transparent 50.3%);
        opacity:.8;
        pointer-events:none;
      }
      .hha-cal-controls{
        display:flex; flex-wrap:wrap; gap:10px;
        margin-top:10px;
      }
      .hha-btn{
        appearance:none; border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.62);
        color:#e5e7eb;
        padding:10px 12px;
        border-radius:14px;
        font-weight:900; font-size:13px;
        cursor:pointer; user-select:none;
      }
      .hha-btn.primary{ border-color: rgba(34,197,94,.26); background: rgba(34,197,94,.16); }
      .hha-btn.cyan{ border-color: rgba(34,211,238,.26); background: rgba(34,211,238,.12); }
      .hha-btn.warn{ border-color: rgba(245,158,11,.26); background: rgba(245,158,11,.14); }
      .hha-cal-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; }
      .hha-cal-row label{ font-size:12px; color:rgba(148,163,184,.95); }
      .hha-cal-row input[type="range"]{ width:100%; }
      .hha-cal-val{ font-weight:900; min-width:64px; text-align:right; }
      .hha-cal-hint{
        margin-top:10px;
        font-size:12px; line-height:1.35;
        color:rgba(229,231,235,.88);
        white-space:pre-line;
      }
    `;
    DOC.head.appendChild(st);
  }

  function openUI(){
    ensureStyles();
    closeUI(); // ensure single

    DOC.body.classList.add('ui-overlay');

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-cal-backdrop';
    wrap.id = 'hha-cal-ui';
    wrap.innerHTML = `
      <div class="hha-cal-card">
        <div class="hha-cal-top">
          <div>
            <h3 class="hha-cal-title">🎛️ Calibration / Recenter (Cardboard & cVR)</h3>
            <div class="hha-cal-sub">จูนจุดเล็งให้อยู่ “กลางสายตา”
• ถ้าเป้ารู้สึกเบี้ยว/หลุดกลาง: ปรับ Offset
• cVR: ยิงจาก crosshair กลางจอ → Offset ช่วยให้ตรงขึ้น
• Cardboard: ช่วยแก้อาการจอกึ่งกลางไม่พอดี</div>
          </div>
          <button class="hha-btn" id="hhaCalClose">✖ Close</button>
        </div>

        <div class="hha-cal-grid">
          <div class="hha-cal-pane">
            <div class="hha-cal-aim" id="hhaCalAim">
              <div class="hha-cal-cross"></div>
              <div class="hha-cal-center"></div>
              <div class="hha-cal-dot" id="hhaCalDot"></div>
            </div>

            <div class="hha-cal-row">
              <label>Offset X</label>
              <div class="hha-cal-val"><span id="hhaCalDx">0</span>px</div>
            </div>
            <input type="range" min="-80" max="80" step="1" id="hhaCalDxRange" />

            <div class="hha-cal-row">
              <label>Offset Y</label>
              <div class="hha-cal-val"><span id="hhaCalDy">0</span>px</div>
            </div>
            <input type="range" min="-80" max="80" step="1" id="hhaCalDyRange" />

            <div class="hha-cal-controls">
              <button class="hha-btn cyan" id="hhaCalRecenter">🎯 Recenter (0,0)</button>
              <button class="hha-btn warn" id="hhaCalReset">🧹 Reset Saved</button>
            </div>
          </div>

          <div class="hha-cal-pane">
            <div class="hha-cal-hint">
วิธีทำให้เร็ว (แนะนำเด็กทำเอง):
1) ใส่ Cardboard → มอง “จุดฟ้า” ให้ตรงกลางวง
2) ถ้าจุดฟ้าไปซ้าย → ปรับ X ไปขวา (เพิ่มค่า)
3) ถ้าจุดฟ้าไปบน → ปรับ Y ลง (ลดค่า)
4) เสร็จแล้ว Close แล้วเล่นต่อ

ทิป:
• ถ้าคนละเครื่อง: ค่า Offset จะต่างกันเล็กน้อย
• ถ้ากด Fullscreen แล้วภาพเบี้ยว: เปิด Calibration อีกครั้งและจูนใหม่
            </div>

            <div class="hha-cal-controls">
              <button class="hha-btn primary" id="hhaCalSaveClose">✅ Save & Close</button>
              <button class="hha-btn" id="hhaCalClose2">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;
    DOC.body.appendChild(wrap);

    const dot = DOC.getElementById('hhaCalDot');
    const dxR = DOC.getElementById('hhaCalDxRange');
    const dyR = DOC.getElementById('hhaCalDyRange');
    const dxT = DOC.getElementById('hhaCalDx');
    const dyT = DOC.getElementById('hhaCalDy');

    const cur = get();
    dxR.value = String(cur.dx|0);
    dyR.value = String(cur.dy|0);

    function render(){
      const dx = Number(dxR.value)||0;
      const dy = Number(dyR.value)||0;
      dxT.textContent = String(dx);
      dyT.textContent = String(dy);
      if (dot){
        dot.style.setProperty('--dx', dx+'px');
        dot.style.setProperty('--dy', dy+'px');
      }
      set(dx,dy);
    }

    dxR.addEventListener('input', render);
    dyR.addEventListener('input', render);

    DOC.getElementById('hhaCalRecenter')?.addEventListener('click', ()=>{
      dxR.value='0'; dyR.value='0'; render();
    });
    DOC.getElementById('hhaCalReset')?.addEventListener('click', ()=>{
      reset();
      dxR.value='0'; dyR.value='0';
      // do NOT call render() here (reset already emits)
      if (dot){ dot.style.setProperty('--dx','0px'); dot.style.setProperty('--dy','0px'); }
      dxT.textContent='0'; dyT.textContent='0';
    });

    const close = ()=>{
      closeUI();
      // if game is running, remove overlay
      try{ DOC.body.classList.remove('ui-overlay'); }catch(_){}
    };

    DOC.getElementById('hhaCalClose')?.addEventListener('click', close);
    DOC.getElementById('hhaCalClose2')?.addEventListener('click', close);
    DOC.getElementById('hhaCalSaveClose')?.addEventListener('click', close);

    // initial dot
    render();
  }

  function closeUI(){
    const el = DOC.getElementById('hha-cal-ui');
    if (el) try{ el.remove(); }catch(_){}
  }

  // public API
  load();
  root.HHA_Calibration = { get, set, recenter, reset, openUI, closeUI, storageKey };

})(typeof window !== 'undefined' ? window : globalThis);