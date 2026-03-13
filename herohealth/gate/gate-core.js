<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>HeroHealth — Hydration Launcher</title>
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="./favicon.ico" />
  <style>
    :root{
      --bg1:#020617; --bg2:#0b1226;
      --panel:rgba(2,6,23,.72);
      --stroke:rgba(148,163,184,.18);
      --text:#e5e7eb; --muted:#94a3b8;
      --blue:#3b82f6; --cyan:#22d3ee; --good:#22c55e;
      --sat: env(safe-area-inset-top, 0px);
      --sab: env(safe-area-inset-bottom, 0px);
      --sal: env(safe-area-inset-left, 0px);
      --sar: env(safe-area-inset-right, 0px);
    }
    *{ box-sizing:border-box; }
    html,body{
      margin:0;
      min-height:100%;
      background:
        radial-gradient(1200px 800px at 50% -10%, rgba(34,211,238,.15), transparent 60%),
        radial-gradient(1000px 700px at 0% 0%, rgba(59,130,246,.12), transparent 55%),
        linear-gradient(180deg, var(--bg1), var(--bg2));
      color:var(--text);
      font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;
    }
    .wrap{
      max-width:860px;
      margin:0 auto;
      padding:
        calc(16px + var(--sat))
        calc(16px + var(--sar))
        calc(22px + var(--sab))
        calc(16px + var(--sal));
    }
    .card{
      border:1px solid var(--stroke);
      background:var(--panel);
      backdrop-filter:blur(12px);
      border-radius:24px;
      box-shadow:0 24px 80px rgba(0,0,0,.35);
      padding:18px;
    }
    .hero{
      display:grid;
      grid-template-columns: 1.2fr .8fr;
      gap:14px;
      align-items:stretch;
    }
    @media (max-width: 820px){
      .hero{ grid-template-columns:1fr; }
    }
    .title{
      font-size:clamp(28px, 5vw, 42px);
      line-height:1;
      font-weight:1100;
      margin:0 0 8px 0;
    }
    .sub{
      color:var(--muted);
      font-weight:900;
      line-height:1.55;
      font-size:14px;
    }
    .panel{
      border:1px solid rgba(148,163,184,.16);
      background:rgba(15,23,42,.46);
      border-radius:20px;
      padding:14px;
    }
    .grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      margin-top:12px;
    }
    @media (max-width: 640px){
      .grid{ grid-template-columns:1fr; }
    }
    label{
      display:block;
      font-size:12px;
      color:var(--muted);
      font-weight:1000;
      margin-bottom:6px;
    }
    select,input{
      width:100%;
      min-height:46px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.70);
      color:var(--text);
      padding:10px 12px;
      font:inherit;
      font-weight:900;
    }
    .chips{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:12px;
    }
    .chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 10px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.34);
      font-size:12px;
      font-weight:1000;
      color:var(--muted);
    }
    .actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:16px;
    }
    .btn{
      cursor:pointer;
      min-height:48px;
      border-radius:16px;
      border:1px solid rgba(148,163,184,.20);
      background:rgba(148,163,184,.10);
      color:var(--text);
      padding:12px 14px;
      font-weight:1100;
      font:inherit;
    }
    .btn.primary{ background:rgba(34,211,238,.18); border-color:rgba(34,211,238,.28); }
    .btn.good{ background:rgba(34,197,94,.16); border-color:rgba(34,197,94,.26); }
    .hint{
      margin-top:12px;
      color:var(--muted);
      font-size:12px;
      font-weight:900;
      line-height:1.5;
    }
    .bigIcon{
      display:grid;
      place-items:center;
      min-height:220px;
      border-radius:22px;
      border:1px solid rgba(148,163,184,.16);
      background:
        radial-gradient(700px 280px at 50% 0%, rgba(34,211,238,.14), transparent 60%),
        rgba(15,23,42,.46);
      font-size:84px;
    }
    .mini{
      margin-top:12px;
      font-size:13px;
      font-weight:900;
      color:var(--muted);
      line-height:1.55;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card hero">
      <div>
        <h1 class="title">💧 Hydration VR</h1>
        <div class="sub">
          เก็บน้ำ • หลบของไม่ดี • ใช้โล่กันฟ้าผ่า • ผ่าน Storm → Boss → Final
        </div>

        <div class="grid">
          <div class="panel">
            <label for="pid">PID</label>
            <input id="pid" type="text" value="anon" />

            <label for="view" style="margin-top:10px;">View</label>
            <select id="view">
              <option value="mobile">Mobile</option>
              <option value="pc">PC</option>
              <option value="cvr">Cardboard / cVR</option>
            </select>
          </div>

          <div class="panel">
            <label for="diff">Difficulty</label>
            <select id="diff">
              <option value="easy">Easy</option>
              <option value="normal" selected>Normal</option>
              <option value="hard">Hard</option>
            </select>

            <label for="time" style="margin-top:10px;">Time (sec)</label>
            <select id="time">
              <option value="60">60</option>
              <option value="80" selected>80</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div class="chips">
          <span class="chip">🌩️ Storm Boss</span>
          <span class="chip">🛡️ Shield + Safe Zone</span>
          <span class="chip">🔥 Fever</span>
          <span class="chip">⭐ Missions</span>
        </div>

        <div class="actions">
          <button class="btn primary" id="btnStartFlow" type="button">▶ Start Flow</button>
          <button class="btn" id="btnDirectRun" type="button">🎮 Run ตรง</button>
          <button class="btn" id="btnRecoveryRun" type="button">🩹 Recovery Run</button>
          <button class="btn good" id="btnBackHub" type="button">🏠 Back HUB</button>
        </div>

        <div class="hint">
          ถ้าวันนี้ทำ warmup ไปแล้ว ระบบจะข้าม warmup ให้อัตโนมัติ
        </div>
      </div>

      <div>
        <div class="bigIcon">💧⚡</div>
        <div class="mini" id="ctxPreview">—</div>
      </div>
    </div>
  </div>

  <script>
    const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
    const HYD_LAUNCH_PREFS_KEY = 'HYD_LAUNCH_PREFS';

    function normView(v){
      v = String(v || 'mobile').toLowerCase();
      return ['mobile','pc','cvr'].includes(v) ? v : 'mobile';
    }
    function normDiff(v){
      v = String(v || 'normal').toLowerCase();
      return ['easy','normal','hard'].includes(v) ? v : 'normal';
    }
    function normTime(v){
      v = Number(v);
      if(!Number.isFinite(v)) return 80;
      return Math.max(20, Math.min(300, Math.round(v)));
    }
    function ensureSeed(v){
      return String(v || ((Date.now() ^ (Math.random()*1e9))|0));
    }

    function hhDayKey(){
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function gateDoneKey(kind, cat, game, pid){
      return `HHA_${String(kind).toUpperCase()}_DONE:${cat}:${game}:${pid}:${hhDayKey()}`;
    }

    function isGateDone(kind, cat, game, pid){
      try{
        return localStorage.getItem(gateDoneKey(kind, cat, game, pid)) === '1';
      }catch(e){
        return false;
      }
    }

    const pidEl   = document.getElementById('pid');
    const viewEl  = document.getElementById('view');
    const diffEl  = document.getElementById('diff');
    const timeEl  = document.getElementById('time');
    const ctxPrev = document.getElementById('ctxPreview');

    function savePrefs(){
      try{
        localStorage.setItem(HYD_LAUNCH_PREFS_KEY, JSON.stringify({
          pid: String(pidEl.value || 'anon').trim() || 'anon',
          view: String(viewEl.value || 'mobile'),
          diff: String(diffEl.value || 'normal'),
          time: String(timeEl.value || '80')
        }));
      }catch(e){}
    }
    function loadPrefs(){
      try{
        const raw = localStorage.getItem(HYD_LAUNCH_PREFS_KEY);
        if(!raw) return;
        const j = JSON.parse(raw);
        if(j.pid) pidEl.value = j.pid;
        if(j.view) viewEl.value = j.view;
        if(j.diff) diffEl.value = j.diff;
        if(j.time) timeEl.value = j.time;
      }catch(e){}
    }

    const pidQ   = String(qs('pid','anon')).trim() || 'anon';
    const viewQ  = normView(qs('view','mobile'));
    const diffQ  = normDiff(qs('diff','normal'));
    const timeQ  = String(normTime(qs('time','80')));
    const runQ   = String(qs('run','play')).toLowerCase();
    const hubQ   = String(qs('hub','./hub.html'));
    const zoneQ  = String(qs('zone','nutrition'));
    const catQ   = String(qs('cat','nutrition'));

    pidEl.value = pidQ;
    viewEl.value = viewQ;
    diffEl.value = diffQ;
    if(['60','80','100'].includes(timeQ)) timeEl.value = timeQ;

    loadPrefs();

    function buildRunUrl(){
      const u = new URL('./hydration-vr/hydration-vr.html', location.href);
      const seed = ensureSeed(qs('seed', ''));

      u.searchParams.set('pid', String(pidEl.value || 'anon').trim() || 'anon');
      u.searchParams.set('view', normView(viewEl.value || 'mobile'));
      u.searchParams.set('run', runQ || 'play');
      u.searchParams.set('diff', normDiff(diffEl.value || 'normal'));
      u.searchParams.set('time', String(normTime(timeEl.value || '80')));
      u.searchParams.set('seed', seed);
      u.searchParams.set('hub', hubQ || './hub.html');
      u.searchParams.set('zone', zoneQ || 'nutrition');
      u.searchParams.set('cat', catQ || 'nutrition');
      u.searchParams.set('cooldown', '1');

      [
        'studyId','phase','conditionGroup','api','debug','ai','log',
        'schoolCode','classRoom'
      ].forEach(k=>{
        const v = qs(k,'');
        if(v) u.searchParams.set(k, v);
      });

      return u.toString();
    }

    function buildWarmupUrl(){
      const next = buildRunUrl();
      const gate = new URL('./warmup-gate.html', location.href);

      gate.searchParams.set('gatePhase', 'warmup');
      gate.searchParams.set('zone', zoneQ || 'nutrition');
      gate.searchParams.set('cat', catQ || 'nutrition');
      gate.searchParams.set('game', 'hydration');
      gate.searchParams.set('theme', 'hydration');
      gate.searchParams.set('pid', String(pidEl.value || 'anon').trim() || 'anon');
      gate.searchParams.set('view', normView(viewEl.value || 'mobile'));
      gate.searchParams.set('run', runQ || 'play');
      gate.searchParams.set('diff', normDiff(diffEl.value || 'normal'));
      gate.searchParams.set('time', String(normTime(timeEl.value || '80')));
      gate.searchParams.set('seed', ensureSeed(qs('seed', '')));
      gate.searchParams.set('hub', hubQ || './hub.html');
      gate.searchParams.set('next', next);

      [
        'studyId','phase','conditionGroup','api','debug','ai','log',
        'schoolCode','classRoom'
      ].forEach(k=>{
        const v = qs(k,'');
        if(v) gate.searchParams.set(k, v);
      });

      return gate.toString();
    }

    function refreshPreview(){
      ctxPrev.textContent =
        `PID=${pidEl.value || 'anon'} • view=${viewEl.value} • diff=${diffEl.value} • time=${timeEl.value}s • run=${runQ}`;
    }

    refreshPreview();
    [pidEl, viewEl, diffEl, timeEl].forEach(el=> el.addEventListener('input', refreshPreview));
    [viewEl, diffEl, timeEl].forEach(el=> el.addEventListener('change', refreshPreview));

    document.getElementById('btnStartFlow').onclick = ()=>{
      savePrefs();

      const pid = String(pidEl.value || 'anon').trim() || 'anon';
      const cat = String(catQ || 'nutrition');
      const game = 'hydration';

      const warmupDone = isGateDone('warmup', cat, game, pid);

      if (warmupDone) {
        const runUrl = new URL(buildRunUrl());
        runUrl.searchParams.set('gate', '1');
        runUrl.searchParams.set('warmupSkipped', '1');
        location.href = runUrl.toString();
        return;
      }

      location.href = buildWarmupUrl();
    };

    document.getElementById('btnDirectRun').onclick = ()=>{
      savePrefs();
      location.href = buildRunUrl();
    };

    document.getElementById('btnRecoveryRun').onclick = ()=>{
      savePrefs();
      const u = new URL(buildRunUrl());
      u.searchParams.set('debug', '1');
      u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
      u.searchParams.set('gate', '1');
      u.searchParams.set('warmupSkipped', '1');
      location.href = u.toString();
    };

    document.getElementById('btnBackHub').onclick = ()=>{
      location.href = hubQ || './hub.html';
    };
  </script>
</body>
</html>
