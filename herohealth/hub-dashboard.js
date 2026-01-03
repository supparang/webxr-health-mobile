// === /herohealth/hub-dashboard.js ===
// Dashboard: reads localStorage
// - HHA_LAST_SUMMARY (latest session summary)
// - HHA_HYDRATION_EVENTS_LAST (latest events buffer)  <-- from Hydration D-pack flush fallback

(function(){
  const $ = (sel)=>document.querySelector(sel);

  function loadJSON(key){
    try{
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    }catch(_){ return null; }
  }

  function pct(n, d){
    n = Number(n||0); d = Math.max(1, Number(d||0));
    return (100*n/d);
  }

  function median(arr){
    arr = (arr||[]).map(Number).filter(x=>isFinite(x)).sort((a,b)=>a-b);
    if (!arr.length) return 0;
    const m = (arr.length-1)/2;
    return (arr.length%2) ? arr[m|0] : (arr[m|0] + arr[(m|0)+1])/2;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // simple sparkline from numbers
  function spark(values){
    values = (values||[]).map(Number).filter(x=>isFinite(x));
    if (values.length < 2) return '';
    const w = 120, h = 24;
    const min = Math.min(...values), max = Math.max(...values);
    const den = Math.max(1e-6, max-min);
    const pts = values.map((v,i)=>{
      const x = (i/(values.length-1))*w;
      const y = h - ((v-min)/den)*h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" stroke-width="2" points="${pts}"></polyline>
    </svg>`;
  }

  function render(){
    const host = $('#hhDash');
    if (!host) return;

    const sum = loadJSON('HHA_LAST_SUMMARY') || loadJSON('hha_last_summary');
    const evWrap = loadJSON('HHA_HYDRATION_EVENTS_LAST'); // {meta, events}
    const events = (evWrap && Array.isArray(evWrap.events)) ? evWrap.events : [];

    // If not hydration last, still show generic
    const isHyd = sum && String(sum.gameMode||sum.game_mode||'').toLowerCase() === 'hydration';

    // ---- compute behavior metrics from events ----
    const shotEv = events.filter(e=>e.type==='shot');
    const lockPxSeries = shotEv.map(e=>e.lockPx).filter(x=>isFinite(x));
    const lockPxMed = median(lockPxSeries);

    const hitEv = events.filter(e=>e.type==='hit' && e.kind==='good');
    const rtSeries = hitEv.map(e=>e.rtMs).filter(x=>isFinite(x));
    const rtMed = median(rtSeries);

    const badHitEv = events.filter(e=>e.type==='bad_hit');
    const blockEv  = events.filter(e=>e.type==='block');
    const perfectEv= events.filter(e=>e.type==='perfect_block');

    const stormEnter = events.filter(e=>e.type==='storm_enter').length;
    const miniPass  = events.filter(e=>e.type==='mini_pass').length;
    const bossClear = events.filter(e=>e.type==='boss_clear').length;

    // Panic index: miss spikes ~ bad_hit + missed shots + expire (if recorded)
    const expireGood = events.filter(e=>e.type==='expire' && e.kind==='good').length;
    const missShots  = shotEv.filter(e=>e.hit===false).length;
    const panic = clamp((badHitEv.length*1.0 + missShots*0.45 + expireGood*0.65), 0, 999);

    // Shield strategy: blocks per storm
    const blocks = blockEv.length;
    const blocksPerStorm = stormEnter ? (blocks / stormEnter) : 0;

    const acc = sum ? Number(sum.accuracyGoodPct||0) : 0;
    const grade = sum ? String(sum.grade||'-') : '-';

    // ---- UI ----
    host.innerHTML = `
      <style>
        #hhDash{margin:14px 0 8px 0}
        .hhd-wrap{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          border-radius:18px;
          padding:14px;
          color:#e5e7eb;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        }
        .hhd-top{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between}
        .hhd-title{font-weight:900;font-size:16px}
        .hhd-sub{opacity:.8;font-size:12px;margin-top:2px}
        .hhd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
        .hhd-card{
          border:1px solid rgba(148,163,184,.16);
          background:rgba(15,23,42,.55);
          border-radius:16px;
          padding:12px;
        }
        .hhd-k{opacity:.8;font-size:12px}
        .hhd-v{font-weight:900;font-size:18px;margin-top:4px;display:flex;gap:10px;align-items:center}
        .hhd-mini{opacity:.85;font-size:12px;margin-top:6px;line-height:1.35}
        .hhd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        .hhd-btn{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          color:#e5e7eb;
          border-radius:999px;
          padding:8px 10px;
          font-weight:800;
          cursor:pointer;
        }
        .hhd-btn:active{transform:translateY(1px)}
        .hhd-note{opacity:.85;font-size:12px;margin-top:10px}
      </style>

      <div class="hhd-wrap">
        <div class="hhd-top">
          <div>
            <div class="hhd-title">📊 HeroHealth Dashboard (ล่าสุด)</div>
            <div class="hhd-sub">
              ${sum ? `Game: <b>${sum.gameMode||'-'}</b> • Diff: <b>${sum.diff||'-'}</b> • Mode: <b>${sum.runMode||sum.runMode||'-'}</b> • Seed: <b>${sum.seed||'-'}</b>` : 'ยังไม่มีผลล่าสุด (เล่นสักรอบก่อน)'}
            </div>
          </div>
          <div class="hhd-row">
            <button class="hhd-btn" id="btnDashCopySum">📋 Copy Summary</button>
            <button class="hhd-btn" id="btnDashCopyEv">📋 Copy Events</button>
            <button class="hhd-btn" id="btnDashClear">🧹 Clear Local</button>
          </div>
        </div>

        <div class="hhd-grid">
          <div class="hhd-card">
            <div class="hhd-k">🎯 Accuracy / Grade</div>
            <div class="hhd-v">${sum ? `${acc.toFixed(1)}% • ${grade}` : '-'}</div>
            <div class="hhd-mini">ComboMax: <b>${sum ? (sum.comboMax|0) : '-'}</b> • Miss: <b>${sum ? (sum.misses|0) : '-'}</b></div>
          </div>

          <div class="hhd-card">
            <div class="hhd-k">⏱️ Median RT (spawn→hit)</div>
            <div class="hhd-v">${rtMed ? `${rtMed.toFixed(0)} ms` : (sum ? `${Number(sum.medianRtGoodMs||0).toFixed(0)} ms` : '-')}</div>
            <div class="hhd-mini">Avg RT: <b>${sum ? Number(sum.avgRtGoodMs||0).toFixed(0) : '-'}</b> ms</div>
          </div>

          <div class="hhd-card">
            <div class="hhd-k">🎯 cVR Aim Assist (lockPx)</div>
            <div class="hhd-v">${lockPxSeries.length ? `${lockPxMed.toFixed(0)} px` : '-'}</div>
            <div class="hhd-mini">${lockPxSeries.length ? `Trend: ${spark(lockPxSeries.slice(-18))}` : 'ต้องเล่นโหมด cVR เพื่อเก็บค่า lockPx'}</div>
          </div>

          <div class="hhd-card">
            <div class="hhd-k">🔥 Panic Index</div>
            <div class="hhd-v">${panic.toFixed(1)}</div>
            <div class="hhd-mini">bad_hit: <b>${badHitEv.length}</b> • missShots: <b>${missShots}</b> • expireGood: <b>${expireGood}</b></div>
          </div>

          <div class="hhd-card">
            <div class="hhd-k">🌀 Storm / Mini</div>
            <div class="hhd-v">${miniPass}/${stormEnter || 0}</div>
            <div class="hhd-mini">Perfect Block: <b>${perfectEv.length}</b> • Blocks/storm: <b>${blocksPerStorm.toFixed(2)}</b></div>
          </div>

          <div class="hhd-card">
            <div class="hhd-k">🌩️ Boss</div>
            <div class="hhd-v">${bossClear}</div>
            <div class="hhd-mini">Blocks: <b>${blocks}</b> • Perfect: <b>${perfectEv.length}</b></div>
          </div>
        </div>

        <div class="hhd-note">
          ✅ ถ้าตั้ง <code>&log=.../exec</code> จะส่งขึ้นชีทอัตโนมัติ (Sessions + Events) •
          ถ้าเน็ตหลุด เกมจะเซฟไว้ใน LocalStorage แล้วค่อย flush รอบหน้า
        </div>
      </div>
    `;

    // Buttons
    $('#btnDashCopySum')?.addEventListener('click', async ()=>{
      try{
        const raw = localStorage.getItem('HHA_LAST_SUMMARY') || localStorage.getItem('hha_last_summary') || '';
        if (!raw) return;
        await navigator.clipboard.writeText(raw);
      }catch(_){}
    });

    $('#btnDashCopyEv')?.addEventListener('click', async ()=>{
      try{
        const raw = localStorage.getItem('HHA_HYDRATION_EVENTS_LAST') || '';
        if (!raw) return;
        await navigator.clipboard.writeText(raw);
      }catch(_){}
    });

    $('#btnDashClear')?.addEventListener('click', ()=>{
      try{
        localStorage.removeItem('HHA_HYDRATION_EVENTS_LAST');
        // ไม่ลบ summary เผื่ออยากเก็บ (แต่คุณจะลบด้วยก็ได้)
        // localStorage.removeItem('HHA_LAST_SUMMARY');
        render();
      }catch(_){}
    });
  }

  // re-render on focus
  window.addEventListener('focus', render);
  render();
})();