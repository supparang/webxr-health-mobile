<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Balance Hold — VR Fitness (DOM)</title>

  <!--
    ถ้ามีไฟล์ CSS แยก ให้ใช้:
    <link rel="stylesheet" href="./css/balance-hold.css" />
    และแปะ CSS patch (แพ็ก M) ต่อท้ายไฟล์นั้น
  -->

  <style>
    :root{
      color-scheme: dark;
      --bg:#050814;
      --panel: rgba(2,6,23,.72);
      --panel2: rgba(15,23,42,.72);
      --line: rgba(148,163,184,.18);
      --txt: rgba(241,245,249,.96);
      --mut: rgba(148,163,184,.96);
      --good: rgba(16,185,129,.95);
      --warn: rgba(251,191,36,.95);
      --bad: rgba(248,113,113,.95);
      --blue: rgba(59,130,246,.95);
      --sab: env(safe-area-inset-bottom, 0px);
      --sat: env(safe-area-inset-top, 0px);
    }

    *{ box-sizing:border-box; }
    html,body{ height:100%; margin:0; }
    body{
      font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
      background:
        radial-gradient(1000px 700px at 10% 0%, rgba(59,130,246,.18), transparent 55%),
        radial-gradient(900px 700px at 95% 15%, rgba(16,185,129,.12), transparent 55%),
        var(--bg);
      color: var(--txt);
      overflow-x:hidden;
    }

    .hidden{ display:none !important; }

    .app{
      width:min(1000px, 100%);
      margin:0 auto;
      padding: calc(10px + var(--sat)) 10px calc(12px + var(--sab));
    }

    .card{
      background: linear-gradient(180deg, rgba(15,23,42,.76), rgba(2,6,23,.68));
      border:1px solid var(--line);
      border-radius:16px;
      padding:12px;
      box-shadow: 0 8px 30px rgba(2,6,23,.24);
    }

    .title{
      margin:0;
      font-size:1.1rem;
      font-weight:800;
      letter-spacing:.2px;
    }
    .sub{
      margin:.25rem 0 0 0;
      color:var(--mut);
      line-height:1.35;
      font-size:.92rem;
    }

    .stack{ display:grid; gap:10px; }
    .grid-2{
      display:grid;
      grid-template-columns: 1fr;
      gap:10px;
    }
    @media (min-width: 760px){
      .grid-2{ grid-template-columns: 1fr 1fr; }
    }

    .field-row{
      display:grid;
      grid-template-columns: 110px 1fr;
      gap:8px;
      align-items:center;
      margin-top:8px;
    }
    .field-row label{
      color:var(--mut);
      font-size:.9rem;
    }
    .field-row input,
    .field-row select{
      width:100%;
      border-radius:10px;
      border:1px solid var(--line);
      background: rgba(2,6,23,.65);
      color:var(--txt);
      padding:9px 10px;
      font: inherit;
      min-height:40px;
    }

    .btn{
      appearance:none;
      border:1px solid rgba(148,163,184,.28);
      background: rgba(15,23,42,.72);
      color: rgba(241,245,249,.96);
      padding: 8px 12px;
      border-radius: 10px;
      cursor: pointer;
      font: inherit;
      line-height: 1.15;
      transition: transform .08s ease, background .15s ease, border-color .15s ease, opacity .15s ease;
    }
    .btn:hover{ background: rgba(30,41,59,.84); border-color: rgba(148,163,184,.42); }
    .btn:active, .btn.is-pressing{ transform: translateY(1px) scale(.99); }
    .btn-primary{
      background: rgba(37,99,235,.88);
      border-color: rgba(96,165,250,.65);
    }
    .btn-primary:hover{ background: rgba(37,99,235,.98); }
    .btn-danger{
      background: rgba(127,29,29,.78);
      border-color: rgba(248,113,113,.45);
    }

    .actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:10px;
    }

    /* --- PLAY VIEW --- */
    .play-shell{
      display:grid;
      gap:10px;
    }

    .hud{
      border-radius:14px;
      border:1px solid var(--line);
      background: rgba(2,6,23,.52);
      padding:10px;
    }
    .hud-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }
    .hud-chip, .hud-pill{
      background: rgba(15,23,42,.7);
      border:1px solid rgba(148,163,184,.16);
      border-radius:999px;
      padding:6px 10px;
      font-size:.88rem;
      color:var(--txt);
      line-height:1.1;
    }
    .hud-chip b, .hud-pill b{ color:#fff; font-weight:800; }

    .hud-row-extra{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:8px;
    }

    .hud-stability-bar{
      position: relative;
      height: 10px;
      margin-top: 10px;
      border-radius: 999px;
      background: rgba(148,163,184,.14);
      border:1px solid rgba(148,163,184,.12);
      overflow: hidden;
    }
    .hud-stability-fill{
      position:absolute;
      left:0; top:0; bottom:0;
      width:0%;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(34,197,94,.85), rgba(59,130,246,.85));
      transition: width .2s linear;
    }
    .hud-center-pulse{
      position:absolute;
      left:50%; top:50%;
      width:12px; height:12px;
      border-radius:999px;
      transform: translate(-50%,-50%);
      background: rgba(248,250,252,.75);
      box-shadow: 0 0 0 0 rgba(255,255,255,.16);
      opacity:.85;
    }
    .hud-center-pulse.good{
      background: rgba(16,185,129,.92);
      box-shadow: 0 0 0 4px rgba(16,185,129,.14);
    }

    .coach-wrap{
      display:grid;
      gap:8px;
      justify-items:center;
    }
    #coachLabel{
      color: var(--mut);
      text-align:center;
      font-size:.9rem;
      line-height:1.3;
      margin:0;
    }
    #coachBubble{
      max-width: min(94vw, 760px);
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,.16);
      background: rgba(2,6,23,.72);
      color: rgba(241,245,249,.97);
      padding: 10px 12px;
      line-height: 1.35;
      box-shadow: 0 8px 28px rgba(2,6,23,.22);
      text-align:center;
    }

    #playArea{
      position:relative;
      min-height: 360px;
      border-radius:18px;
      border:1px solid var(--line);
      background:
        radial-gradient(600px 240px at 50% 0%, rgba(59,130,246,.10), transparent 70%),
        linear-gradient(180deg, rgba(15,23,42,.58), rgba(2,6,23,.72));
      overflow:hidden;
      touch-action:none;
      user-select:none;
    }

    /* play area center guide */
    #playArea::before{
      content:'';
      position:absolute;
      left:50%; top:0; bottom:0;
      width:2px;
      transform:translateX(-50%);
      background: linear-gradient(180deg, transparent, rgba(148,163,184,.18), transparent);
      pointer-events:none;
      z-index:0;
    }

    #platform-wrap{
      position:absolute;
      left:50%;
      bottom:72px;
      width:min(80vw, 520px);
      height:120px;
      transform:translateX(-50%);
      display:grid;
      place-items:center;
      z-index:2;
    }
    #platform{
      width:100%;
      height:22px;
      border-radius:999px;
      background: linear-gradient(180deg, rgba(203,213,225,.95), rgba(148,163,184,.92));
      border:1px solid rgba(255,255,255,.22);
      box-shadow: 0 6px 20px rgba(2,6,23,.28);
      transform-origin:center center;
      transition: transform .05s linear;
      position:relative;
    }
    #platform::before{
      content:'';
      position:absolute;
      left:50%;
      top:50%;
      width:22px;height:22px;
      transform:translate(-50%,-50%);
      border-radius:999px;
      background: rgba(2,6,23,.85);
      border:2px solid rgba(241,245,249,.9);
      box-shadow: 0 0 0 3px rgba(59,130,246,.14);
    }

    #indicator{
      position:absolute;
      left:50%;
      bottom:92px;
      width:34px;
      height:34px;
      border-radius:999px;
      transform: translateX(0) translateY(-18px);
      background: radial-gradient(circle at 35% 30%, #fff, rgba(59,130,246,.95) 45%, rgba(29,78,216,.95));
      border:1px solid rgba(255,255,255,.28);
      box-shadow: 0 10px 20px rgba(2,6,23,.28);
      z-index:3;
      pointer-events:none;
    }

    /* safe-zone visual hint */
    .safe-zone{
      position:absolute;
      left:50%;
      bottom:52px;
      width:min(80vw, 520px);
      height:10px;
      transform:translateX(-50%);
      border-radius:999px;
      background: rgba(148,163,184,.08);
      border:1px dashed rgba(148,163,184,.12);
      overflow:hidden;
      z-index:1;
      pointer-events:none;
    }
    .safe-zone-inner{
      position:absolute;
      left:50%;
      top:0; bottom:0;
      width:40%;
      transform:translateX(-50%);
      border-radius:999px;
      background: rgba(16,185,129,.18);
      border-left:1px solid rgba(16,185,129,.22);
      border-right:1px solid rgba(16,185,129,.22);
    }

    #obstacle-layer{
      position:absolute;
      inset:0;
      z-index:4;
      pointer-events:none;
    }
    .obstacle{
      position:absolute;
      top:18px;
      transform: translateX(-50%);
      font-size: 30px;
      line-height:1;
      filter: drop-shadow(0 4px 8px rgba(2,6,23,.35));
      animation: obstacleDrop 1.2s linear forwards;
      will-change: transform, top, opacity;
      opacity:.98;
    }
    .obstacle.avoid{
      animation: obstacleFadeGood .45s ease-out forwards;
    }
    .obstacle.hit{
      animation: obstacleFadeBad .48s ease-out forwards;
    }
    .obstacle.telegraph{
      filter: drop-shadow(0 0 10px rgba(255,255,255,.25));
      animation: obstacleTelegraph .28s ease-out 1, obstacleDrop 1.2s linear forwards;
    }

    @keyframes obstacleDrop{
      0%   { top:18px; opacity:1; transform: translateX(-50%) scale(.9); }
      80%  { opacity:1; }
      100% { top:68%; opacity:1; transform: translateX(-50%) scale(1); }
    }
    @keyframes obstacleFadeGood{
      0%   { opacity:1; transform: translateX(-50%) scale(1); }
      100% { opacity:0; transform: translateX(-50%) scale(1.25) rotate(-12deg); }
    }
    @keyframes obstacleFadeBad{
      0%   { opacity:1; transform: translateX(-50%) scale(1); }
      100% { opacity:0; transform: translateX(-50%) scale(1.35) rotate(12deg); }
    }
    @keyframes obstacleTelegraph{
      0%{ opacity:.75; transform: translateX(-50%) scale(.82); }
      100%{ opacity:1; transform: translateX(-50%) scale(1); }
    }

    .play-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:center;
      margin-top: 10px;
    }

    /* floating FX */
    .fx-float{
      position:absolute;
      z-index:30;
      transform: translate(-50%,-50%);
      pointer-events:none;
      font-weight:800;
      font-size:.95rem;
      text-shadow: 0 1px 0 rgba(2,6,23,.5);
      animation: fxFloatUp .72s ease-out forwards;
    }
    .fx-float.good{ color: rgba(52,211,153,.98); }
    .fx-float.bad{ color: rgba(248,113,113,.98); }
    .fx-float.gold{ color: rgba(251,191,36,.98); }
    @keyframes fxFloatUp{
      0%   { opacity:0; transform: translate(-50%,-40%) scale(.92); }
      12%  { opacity:1; }
      100% { opacity:0; transform: translate(-50%,-110%) scale(1.06); }
    }

    .shake-hit{ animation: shakeHit .22s linear; }
    @keyframes shakeHit{
      0%{ transform: translateX(0); }
      20%{ transform: translateX(-3px); }
      40%{ transform: translateX(3px); }
      60%{ transform: translateX(-2px); }
      80%{ transform: translateX(2px); }
      100%{ transform: translateX(0); }
    }

    /* --- cVR preview overlay --- */
    .cvr-overlay{
      position:absolute;
      inset:0;
      z-index:8;
      pointer-events:none;
    }
    .cvr-overlay.hidden{ display:none; }
    .cvr-crosshair{
      position:absolute;
      left:50%;
      top:50%;
      width:20px;height:20px;
      transform: translate(-50%,-50%);
      border-radius:999px;
      border:2px solid rgba(255,255,255,.9);
      box-shadow: 0 0 0 2px rgba(2,6,23,.45), 0 0 14px rgba(255,255,255,.2);
      opacity:.95;
    }
    .cvr-crosshair::before,.cvr-crosshair::after{
      content:'';
      position:absolute;
      background: rgba(255,255,255,.9);
    }
    .cvr-crosshair::before{
      width:2px;height:28px; left:50%; top:50%; transform:translate(-50%,-50%);
    }
    .cvr-crosshair::after{
      width:28px;height:2px; left:50%; top:50%; transform:translate(-50%,-50%);
    }
    .cvr-controls{
      position:absolute;
      left:50%;
      bottom: calc(10px + var(--sab));
      transform: translateX(-50%);
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:center;
      pointer-events:auto;
      background: rgba(2,6,23,.45);
      border:1px solid rgba(255,255,255,.08);
      border-radius: 12px;
      padding: 8px;
      backdrop-filter: blur(3px);
      width:min(96%, 760px);
    }

    /* --- RESULT --- */
    .result-grid{
      display:grid;
      grid-template-columns: 1fr;
      gap:10px;
    }
    @media (min-width: 860px){
      .result-grid{
        grid-template-columns: 1.1fr .9fr;
      }
    }

    .result-table{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:8px;
    }
    .kv{
      border-radius:12px;
      border:1px solid var(--line);
      background: rgba(2,6,23,.48);
      padding:10px;
    }
    .kv .k{
      color:var(--mut);
      font-size:.82rem;
      margin-bottom:4px;
    }
    .kv .v{
      font-weight:700;
      color:#fff;
      line-height:1.2;
      word-break: break-word;
    }

    .result-hero{
      margin-top: 0;
      padding: 12px;
      border-radius: 16px;
      border:1px solid rgba(148,163,184,.16);
      background: linear-gradient(180deg, rgba(15,23,42,.72), rgba(2,6,23,.62));
      display:grid;
      gap:12px;
    }
    .result-hero-left{
      display:flex;
      gap:12px;
      align-items:flex-start;
    }
    .result-hero-text h3{
      margin:0 0 4px 0;
      font-size:1.05rem;
    }
    .result-hero-text p{
      margin:0;
      color: rgba(203,213,225,.95);
    }
    .hero-insight{
      margin-top:6px !important;
      line-height: 1.35;
      color: rgba(226,232,240,.96);
    }
    .result-hero-right{
      display:grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap:8px;
    }
    @media (min-width:760px){
      .result-hero{
        grid-template-columns: 1.1fr 1fr;
        align-items:start;
      }
      .result-hero-right{
        grid-template-columns: repeat(3, minmax(0,1fr));
      }
    }

    .stat-card{
      border-radius: 12px;
      border:1px solid rgba(148,163,184,.14);
      background: rgba(2,6,23,.48);
      padding: 10px;
    }
    .stat-card .label{
      font-size: .78rem;
      color: rgba(148,163,184,.96);
      margin-bottom: 4px;
    }
    .stat-card .value{
      font-size: 1rem;
      font-weight: 700;
      color: rgba(248,250,252,.98);
      line-height: 1.2;
      word-break: break-word;
    }
    .stat-card .value.text-sm{
      font-size: .84rem;
      font-weight: 600;
      line-height: 1.3;
    }

    .rank-badge{
      width:64px; height:64px; min-width:64px;
      border-radius:16px;
      display:grid; place-items:center;
      font-weight:900; font-size:1.5rem;
      color:#fff;
      border:1px solid rgba(255,255,255,.18);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
      background: rgba(71,85,105,.65);
    }
    .rank-badge.rank-S{ background: linear-gradient(135deg, rgba(245,158,11,.95), rgba(251,191,36,.92)); }
    .rank-badge.rank-A{ background: linear-gradient(135deg, rgba(16,185,129,.9), rgba(52,211,153,.88)); }
    .rank-badge.rank-B{ background: linear-gradient(135deg, rgba(59,130,246,.9), rgba(96,165,250,.86)); }
    .rank-badge.rank-C{ background: linear-gradient(135deg, rgba(139,92,246,.9), rgba(167,139,250,.86)); }
    .rank-badge.rank-D{ background: linear-gradient(135deg, rgba(100,116,139,.88), rgba(148,163,184,.82)); }

    .rank-pop{ animation: rankPop .45s cubic-bezier(.2,.85,.2,1.15); }
    @keyframes rankPop{
      0%{ transform: scale(.75) rotate(-10deg); opacity:.25; }
      100%{ transform: scale(1) rotate(0); opacity:1; }
    }
    .count-pop{ animation: countPop .25s ease-out; }
    @keyframes countPop{
      0%{ transform: scale(.96); }
      60%{ transform: scale(1.06); }
      100%{ transform: scale(1); }
    }

    .section-title{
      margin-top: 10px;
      margin-bottom: 6px;
      color: rgba(226,232,240,.95);
      font-weight: 700;
    }
    .mini-badge-wrap{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:8px;
    }
    .mini-badge{
      border-radius:999px;
      padding:6px 10px;
      border:1px solid rgba(148,163,184,.16);
      background: rgba(15,23,42,.66);
      color: rgba(241,245,249,.96);
      font-size:.84rem;
      line-height:1.1;
    }
    .mini-badge.good{
      background: rgba(6,95,70,.55);
      border-color: rgba(16,185,129,.24);
    }
    .mini-badge.warn{
      background: rgba(120,53,15,.48);
      border-color: rgba(251,191,36,.24);
    }

    .result-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top: 12px;
    }

    /* --- overlay --- */
    .overlay{
      position: fixed;
      inset:0;
      z-index: 100;
      background: rgba(2,6,23,.62);
      backdrop-filter: blur(4px);
      display:grid;
      place-items:center;
      padding: 12px;
    }
    .overlay-card{
      position: relative;
      width: min(720px, 96vw);
      border-radius: 16px;
      border:1px solid rgba(148,163,184,.18);
      background: linear-gradient(180deg, rgba(15,23,42,.95), rgba(2,6,23,.93));
      color: rgba(248,250,252,.98);
      padding: 14px;
      box-shadow: 0 18px 60px rgba(2,6,23,.4);
    }
    .overlay-card h3{ margin:0 0 8px 0; }
    .overlay-card ol{
      margin: 0 0 10px 18px;
      padding:0;
      line-height: 1.4;
    }
    .overlay-card li{ margin-bottom:4px; }

    .overlay-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
      margin-top: 12px;
    }
    .checkline{
      display:flex;
      align-items:center;
      gap:8px;
      color: rgba(226,232,240,.96);
      font-size: .9rem;
    }

    .icon-btn{
      appearance:none;
      border:1px solid rgba(148,163,184,.2);
      width:34px; height:34px;
      border-radius:999px;
      background: rgba(15,23,42,.65);
      color:#fff; cursor:pointer;
    }
    .end-card{ padding-top:16px; }
    .end-close{ position:absolute; top:10px; right:10px; }
    .end-rank-wrap{ display:flex; align-items:center; gap:12px; }
    .end-score{ font-size:1.05rem; color: rgba(226,232,240,.98); }

    /* mobile */
    @media (max-width: 640px){
      .field-row{ grid-template-columns: 1fr; }
      .rank-badge{
        width:56px; height:56px; min-width:56px;
        font-size:1.25rem;
        border-radius:14px;
      }
      .result-hero-right{
        grid-template-columns: repeat(2, minmax(0,1fr));
      }
      .overlay-actions{ justify-content:stretch; }
      .overlay-actions .btn{ flex:1 1 140px; }
      #platform-wrap{
        width:min(92vw, 520px);
        bottom:84px;
      }
      .safe-zone{
        width:min(92vw, 520px);
        bottom:58px;
      }
    }

    /* view mode helpers */
    body.view-mobile #playArea{ min-height: 420px; }
    body.view-cvr #playArea{ min-height: 460px; }
    body.view-cvr .cvr-overlay{ display:block; }

    /* reduced motion */
    .reduced-motion .rank-pop,
    .reduced-motion .count-pop,
    .reduced-motion .shake-hit,
    .reduced-motion .fx-float,
    .reduced-motion .obstacle.telegraph{
      animation:none !important;
    }
    .reduced-motion .hud-stability-fill,
    .reduced-motion .btn{
      transition:none !important;
    }
  </style>
</head>
<body>
  <div class="app">

    <!-- =========================
         VIEW: MENU
         ========================= -->
    <section id="view-menu" class="stack">
      <div class="card">
        <h1 class="title">⚖️ Balance Hold — Platform Stability</h1>
        <p class="sub">
          เกมฝึกทรงตัวแบบ DOM-based: คุมแท่นให้สมดุล พร้อมหลบแรงรบกวน (gust / bomb)
          เพื่อเก็บ Stability, Score, Combo และ Rank
        </p>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2 class="title" style="font-size:1rem;">ตั้งค่าเกม</h2>

          <div class="field-row">
            <label for="difficulty">Difficulty</label>
            <select id="difficulty">
              <option value="easy">Easy</option>
              <option value="normal" selected>Normal</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div class="field-row">
            <label for="sessionDuration">Duration (sec)</label>
            <select id="sessionDuration">
              <option value="30">30</option>
              <option value="45">45</option>
              <option value="60" selected>60</option>
              <option value="90">90</option>
              <option value="120">120</option>
            </select>
          </div>

          <div class="field-row">
            <label for="viewMode">View</label>
            <select id="viewMode">
              <option value="pc" selected>PC</option>
              <option value="mobile">Mobile</option>
              <option value="cvr">Cardboard (cVR Preview)</option>
            </select>
          </div>

          <div class="actions">
            <button class="btn btn-primary" data-action="start-normal">▶ Start Play</button>
            <button class="btn" data-action="goto-research">🧪 Research Mode</button>
          </div>
        </div>

        <div class="card">
          <h2 class="title" style="font-size:1rem;">วิธีเล่นสั้น ๆ</h2>
          <ul class="sub" style="margin:.4rem 0 0 1rem; padding:0;">
            <li>กด/ลากในพื้นที่เล่นเพื่อคุมแท่นซ้าย–ขวา</li>
            <li>ให้ตัวชี้อยู่ใกล้กึ่งกลาง = Stability สูงขึ้น</li>
            <li>ช่วง obstacle impact ถ้าอยู่ใน safe zone = Avoid ✅</li>
            <li>ใกล้กึ่งกลางมากเป็นพิเศษ = Perfect ✨ + โบนัส</li>
            <li>โดนชน = Hit ❌ เสียคะแนนและคอมโบ</li>
          </ul>

          <div class="actions">
            <button class="btn" data-action="export-sessions-csv">⬇ Sessions CSV</button>
            <button class="btn" data-action="export-events-csv">⬇ Events CSV</button>
            <button class="btn" data-action="export-release-debug">🧪 Export Debug</button>
          </div>
        </div>
      </div>
    </section>

    <!-- =========================
         VIEW: RESEARCH
         ========================= -->
    <section id="view-research" class="stack hidden">
      <div class="card">
        <h2 class="title">🧪 Research Mode</h2>
        <p class="sub">
          สำหรับเก็บข้อมูลผู้เข้าร่วม (player/group/phase) และดาวน์โหลด CSV ท้ายรอบอัตโนมัติ
          เมื่อจบเกมในโหมด Research
        </p>
      </div>

      <div class="card">
        <div class="field-row">
          <label for="researchId">Player ID</label>
          <input id="researchId" type="text" placeholder="เช่น P001" />
        </div>

        <div class="field-row">
          <label for="researchGroup">Group</label>
          <input id="researchGroup" type="text" placeholder="เช่น A / control / exp" />
        </div>

        <div class="field-row">
          <label for="researchPhase">Phase</label>
          <input id="researchPhase" type="text" placeholder="เช่น pre / post / wk2" />
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-action="start-research">▶ Start Research</button>
          <button class="btn" data-action="back-menu">← Back Menu</button>
        </div>
      </div>
    </section>

    <!-- =========================
         VIEW: PLAY
         ========================= -->
    <section id="view-play" class="stack hidden">
      <div class="play-shell">
        <!-- HUD -->
        <div class="hud">
          <div class="hud-row">
            <div class="hud-chip">Mode: <b id="hud-mode">Play</b></div>
            <div class="hud-chip">Diff: <b id="hud-diff">normal</b></div>
            <div class="hud-chip">Dur: <b id="hud-dur">60</b>s</div>
            <div class="hud-chip">Stability: <b id="hud-stability">0%</b></div>
            <div class="hud-chip">Avoid/Total: <b id="hud-obstacles">0 / 0</b></div>
            <div class="hud-chip">Time: <b id="hud-time">60.0</b></div>
          </div>

          <!-- Extra HUD (A-K optional hooks) -->
          <div class="hud-row hud-row-extra">
            <div class="hud-pill">Status: <b id="hud-status">Ready</b></div>
            <div class="hud-pill">Phase: <b id="hud-phase">-</b></div>
            <div class="hud-pill">Score: <b id="hud-score">0</b></div>
            <div class="hud-pill">Combo: <b id="hud-combo">0</b></div>
          </div>

          <div class="hud-stability-bar" aria-hidden="true">
            <div id="stabilityFill" class="hud-stability-fill"></div>
            <div id="centerPulse" class="hud-center-pulse"></div>
          </div>
        </div>

        <div class="coach-wrap">
          <p id="coachLabel">จับ/แตะแล้วเลื่อนไปซ้าย–ขวาเพื่อรักษาสมดุล / Drag left–right to balance</p>
          <div id="coachBubble" class="hidden">พร้อมทรงตัวแล้วนะ ✨</div>
        </div>

        <!-- PLAY AREA -->
        <div id="playArea" aria-label="Balance play area">
          <div class="safe-zone" aria-hidden="true">
            <div class="safe-zone-inner"></div>
          </div>

          <div id="platform-wrap">
            <div id="platform"></div>
          </div>

          <div id="indicator" aria-hidden="true"></div>
          <div id="obstacle-layer" aria-hidden="true"></div>

          <!-- cVR preview overlay -->
          <div id="cvrOverlay" class="cvr-overlay hidden" aria-hidden="true">
            <div class="cvr-crosshair" id="cvrCrosshair" aria-hidden="true"></div>

            <div class="cvr-controls">
              <button class="btn" data-action="cvr-recenter">🎯 Recenter</button>
              <button class="btn" data-action="cvr-calibrate-left">◀ Cal-</button>
              <button class="btn" data-action="cvr-calibrate-right">Cal+ ▶</button>
              <button class="btn" data-action="cvr-toggle-strict">
                cVR Strict: <span id="cvrStrictLabel">OFF</span>
              </button>
            </div>
          </div>
        </div>

        <div class="play-actions">
          <button class="btn" data-action="pause">⏸ Pause</button>
          <button class="btn hidden" data-action="resume">▶ Resume</button>
          <button class="btn btn-danger" data-action="stop">⏹ Stop</button>
        </div>
      </div>
    </section>

    <!-- =========================
         VIEW: RESULT
         ========================= -->
    <section id="view-result" class="stack hidden">
      <div class="card">
        <h2 class="title">📊 Result Summary</h2>
        <p class="sub">สรุปผลการทรงตัว + หลบ obstacle + score/combo/rank + insight</p>
      </div>

      <!-- Hero result (A-K) -->
      <section class="result-hero">
        <div class="result-hero-left">
          <div id="rankBadge" class="rank-badge rank-D">D</div>
          <div class="result-hero-text">
            <h3>Balance Hold Result</h3>
            <p id="resultHeroSub">-</p>
            <p id="heroInsight" class="hero-insight">-</p>
          </div>
        </div>

        <div class="result-hero-right">
          <div class="stat-card">
            <div class="label">Score</div>
            <div class="value" id="res-score">0</div>
          </div>
          <div class="stat-card">
            <div class="label">Rank</div>
            <div class="value" id="res-rank">D</div>
          </div>
          <div class="stat-card">
            <div class="label">Perfect</div>
            <div class="value" id="res-perfect">0</div>
          </div>
          <div class="stat-card">
            <div class="label">Max Combo</div>
            <div class="value" id="res-maxCombo">0</div>
          </div>
          <div class="stat-card">
            <div class="label">AI Tip</div>
            <div class="value text-sm" id="res-aiTip">-</div>
          </div>
          <div class="stat-card">
            <div class="label">Daily</div>
            <div class="value" id="res-daily">-</div>
          </div>
        </div>
      </section>

      <div id="heroBadges" class="mini-badge-wrap"></div>
      <div class="section-title">Next Missions</div>
      <div id="heroMissionChips" class="mini-badge-wrap"></div>

      <div class="result-grid">
        <!-- base result fields (original JS refs) -->
        <div class="card">
          <h3 class="title" style="font-size:1rem;">Core Metrics</h3>

          <div class="result-table" style="margin-top:10px;">
            <div class="kv"><div class="k">Mode</div><div class="v" id="res-mode">-</div></div>
            <div class="kv"><div class="k">Difficulty</div><div class="v" id="res-diff">-</div></div>

            <div class="kv"><div class="k">Duration (s)</div><div class="v" id="res-dur">-</div></div>
            <div class="kv"><div class="k">End</div><div class="v" id="res-end">-</div></div>

            <div class="kv"><div class="k">Stability</div><div class="v" id="res-stability">-</div></div>
            <div class="kv"><div class="k">Avoid Rate</div><div class="v" id="res-avoidRate">-</div></div>

            <div class="kv"><div class="k">Mean Tilt</div><div class="v" id="res-meanTilt">-</div></div>
            <div class="kv"><div class="k">RMS Tilt</div><div class="v" id="res-rmsTilt">-</div></div>

            <div class="kv"><div class="k">Avoid</div><div class="v" id="res-avoid">-</div></div>
            <div class="kv"><div class="k">Hit</div><div class="v" id="res-hit">-</div></div>

            <div class="kv"><div class="k">Fatigue Index</div><div class="v" id="res-fatigue">-</div></div>
            <div class="kv"><div class="k">Samples</div><div class="v" id="res-samples">-</div></div>
          </div>
        </div>

        <div class="card">
          <h3 class="title" style="font-size:1rem;">Actions</h3>
          <p class="sub">เล่นใหม่ / กลับ HUB / Export logs จาก localStorage</p>

          <div class="result-actions">
            <!-- รองรับทั้ง data-action="play-again" และ result-play-again -->
            <button class="btn btn-primary" data-action="result-play-again">🔁 Play Again</button>
            <button class="btn" data-action="play-again">↩ Menu</button>
            <button class="btn" data-action="result-back-hub">🏠 Back HUB</button>

            <button class="btn" data-action="export-sessions-csv">⬇ Sessions CSV</button>
            <button class="btn" data-action="export-events-csv">⬇ Events CSV</button>
            <button class="btn" data-action="export-release-debug">🧪 Export Debug</button>
          </div>
        </div>
      </div>
    </section>

  </div><!-- /.app -->

  <!-- =========================
       TUTORIAL OVERLAY (A-K optional)
       ========================= -->
  <div id="tutorialOverlay" class="overlay hidden" aria-hidden="true">
    <div class="overlay-card tutorial-card">
      <h3>วิธีเล่น Balance Hold</h3>
      <ol>
        <li>กด/ลากซ้าย–ขวาเพื่อคุมแท่นให้สมดุล</li>
        <li>พยายามให้ตัวชี้อยู่ใกล้กึ่งกลาง (safe zone) ให้มากที่สุด</li>
        <li>เมื่อ obstacle กำลัง impact ให้คุมอยู่ใน safe zone เพื่อ <b>Avoid</b></li>
        <li>ถ้าคุมใกล้กึ่งกลางมากเป็นพิเศษจะได้ <b>Perfect</b> + bonus</li>
        <li>โหมด cVR ใช้ Recenter / Calibrate / Strict ได้ (preview)</li>
      </ol>

      <label class="checkline">
        <input type="checkbox" id="tutorialDontShowAgain" />
        ไม่ต้องแสดงอีก / Don’t show again
      </label>

      <div class="overlay-actions">
        <button class="btn" data-action="tutorial-skip">Skip</button>
        <button class="btn btn-primary" data-action="tutorial-start">Start</button>
      </div>
    </div>
  </div>

  <!-- =========================
       END MODAL (A-K optional)
       ========================= -->
  <div id="endModal" class="overlay hidden" aria-hidden="true">
    <div class="overlay-card end-card">
      <button class="icon-btn end-close" data-action="close-end-modal" aria-label="Close">✕</button>

      <div class="end-rank-wrap">
        <div id="endModalRank" class="rank-badge rank-D">D</div>
        <div class="end-score">Score: <b id="endModalScore">0</b></div>
      </div>

      <p id="endModalInsight" class="hero-insight">-</p>

      <div class="overlay-actions">
        <button class="btn" data-action="end-retry">🔁 Retry</button>
        <button class="btn" data-action="end-next-mission">🎯 Next Mission</button>
        <button class="btn btn-primary" data-action="end-back-hub">🏠 Back HUB</button>
      </div>
    </div>
  </div>

  <!-- JS -->
  <script src="./js/balance-hold.js"></script>
</body>
</html>