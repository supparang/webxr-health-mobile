:root{
      --bg1:#071122;
      --bg2:#123a7a;
      --panel:rgba(10,16,35,.86);
      --line:rgba(255,255,255,.14);
      --text:#f8fbff;
      --muted:#c7d4ff;
      --cyan:#67e8f9;
      --pink:#f472b6;
      --yellow:#fde047;
      --green:#4ade80;
      --red:#fb7185;
      --violet:#a78bfa;
      --orange:#fb923c;
    }

    *{box-sizing:border-box}

    html,body{
      margin:0;
      min-height:100%;
      overflow-x:hidden;
      overflow-y:auto;
      font-family:Inter,system-ui,Segoe UI,Roboto,sans-serif;
      background:linear-gradient(180deg,var(--bg1),var(--bg2));
      color:var(--text);
    }

    body{touch-action:manipulation}

    #app{
      position:relative;
      min-height:100dvh;
      overflow-x:hidden;
    }

    canvas{
      position:fixed;
      inset:0;
      width:100%;
      height:100%;
      display:block;
      background:linear-gradient(180deg,#75d8ff,#dbeafe 62%,#e5efff 62%,#dbeafe 100%);
    }

    .overlay{
      position:fixed;
      inset:0;
      display:flex;
      align-items:flex-start;
      justify-content:center;
      padding:20px 16px 32px;
      overflow-y:auto;
      overflow-x:hidden;
      -webkit-overflow-scrolling:touch;
      background:radial-gradient(circle at top,#18254a 0%,#0b1020 48%,#05070f 100%);
      z-index:70;
    }

    .hidden{display:none!important}

    .panel{
      width:min(96vw,760px);
      max-width:96vw;
      overflow-x:hidden;
      padding:18px;
      border-radius:24px;
      margin:12px 0 24px;
      background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.14);
      box-shadow:0 20px 80px rgba(0,0,0,.35);
      touch-action:pan-y;
    }

    .title{
      font-size:clamp(26px,7vw,40px);
      line-height:1.12;
      letter-spacing:-0.02em;
      font-weight:1000;
      margin:0;
    }

    .desc{
      margin-top:10px;
      color:#dbe7ff;
      font-size:14px;
      line-height:1.55;
    }

    .sectionTitle{
      margin-top:16px;
      margin-bottom:10px;
      font-size:15px;
      font-weight:900;
      color:#dbeafe;
    }

    .menuStack{display:grid;gap:12px}
    .bankGrid{display:grid;grid-template-columns:1fr;gap:10px}
    .modeGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .profileGrid{display:grid;grid-template-columns:1fr;gap:10px}
    .actionGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .top3Board{display:grid;grid-template-columns:1fr;gap:10px;margin-top:0}

    .option,.inputBox,.top3Card,.btn{
      min-width:0;
      width:100%;
      border-radius:20px;
    }

    .option{
      appearance:none;
      background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.12);
      padding:14px;
      text-align:left;
      color:var(--text);
      cursor:pointer;
    }

    .option:hover{transform:translateY(-2px);border-color:rgba(103,232,249,.55)}
    .option.active{outline:3px solid var(--cyan);background:rgba(103,232,249,.10)}
    .option h3{font-size:18px;line-height:1.2;margin:0 0 6px}
    .option p{margin:0;color:#cad7ff;font-size:13px;line-height:1.4}

    .inputBox{
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.14);
      padding:12px;
    }

    .inputBox label{
      display:block;
      font-size:12px;
      color:#c7d4ff;
      margin-bottom:6px;
    }

    .inputBox input{
      width:100%;
      padding:12px 14px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.08);
      color:#fff;
      font-size:16px;
      min-height:48px;
    }

    .top3Card{
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.14);
      padding:14px;
      text-align:left;
    }

    .top3Card .rank{font-size:22px;font-weight:1000}
    .top3Card .name{font-size:16px;font-weight:900;margin-top:6px}
    .top3Card .meta{font-size:12px;color:#c7d4ff;margin-top:4px}

    .btn{
      appearance:none;
      border:0;
      min-height:58px;
      font-size:17px;
      font-weight:1000;
      cursor:pointer;
      white-space:normal;
      word-break:break-word;
      line-height:1.15;
      padding:12px 14px;
      color:#06101b;
      background:linear-gradient(135deg,#67e8f9,#a78bfa);
    }

    .btn.alt{
      background:linear-gradient(135deg,#fde047,#fb7185);
      color:#311314;
    }

    .btn.ghost{
      background:linear-gradient(135deg,#dbeafe,#93c5fd);
      color:#172554;
    }

    .hud{
      position:fixed;
      left:8px;
      right:8px;
      top:8px;
      z-index:20;
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
      pointer-events:none;
    }

    .card{
      background:var(--panel);
      border:1px solid var(--line);
      border-radius:16px;
      padding:9px 10px;
      backdrop-filter:blur(8px);
      box-shadow:0 10px 32px rgba(0,0,0,.26);
    }

    .big{font-size:14px;font-weight:900}
    .sub{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.35}

    .bar{
      height:9px;
      border-radius:999px;
      background:rgba(255,255,255,.1);
      overflow:hidden;
      margin-top:8px;
    }

    .fill{
      height:100%;
      width:100%;
      background:linear-gradient(90deg,var(--green),var(--yellow),var(--red));
      transform-origin:left center;
    }

    #questionBox{
      position:fixed;
      top:116px;
      left:50%;
      transform:translateX(-50%);
      width:94vw;
      padding:14px 14px;
      border-radius:18px;
      background:rgba(17,24,39,.82);
      color:#fff;
      text-align:center;
      z-index:40;
      box-shadow:0 14px 30px rgba(0,0,0,.22);
      backdrop-filter:blur(6px);
      border:1px solid rgba(255,255,255,.10);
    }

    #questionBox .q-meta{
      font-size:12px;
      opacity:.95;
      margin-bottom:6px;
      letter-spacing:.05em;
      color:#fde047;
    }

    #questionBox .q-prompt{
      font-size:clamp(18px,5vw,28px);
      font-weight:900;
      line-height:1.22;
    }

    #feedbackBox{
      position:fixed;
      top:192px;
      left:50%;
      transform:translateX(-50%);
      min-width:220px;
      max-width:88vw;
      text-align:center;
      padding:12px 18px;
      border-radius:999px;
      background:rgba(15,23,42,.92);
      color:#fff;
      font-size:18px;
      font-weight:900;
      z-index:50;
      opacity:0;
      pointer-events:none;
      transition:opacity .18s ease, transform .18s ease;
    }

    #feedbackBox.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
    #feedbackBox.ok{background:rgba(22,163,74,.94)}
    #feedbackBox.bad{background:rgba(225,29,72,.94)}
    #feedbackBox.warn{background:rgba(180,83,9,.94)}

    .leaderboardList,.sessionList{
      list-style:none;
      padding:0;
      display:grid;
      gap:10px;
      margin-top:14px;
    }

    .leaderboardList li,.sessionList li{
      background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.1);
      border-radius:16px;
      padding:10px 12px;
    }

    table{
      width:100%;
      border-collapse:collapse;
      margin-top:12px;
    }

    th,td{
      border-bottom:1px solid rgba(255,255,255,.08);
      padding:8px;
      text-align:left;
      font-size:13px;
    }

    th{color:#93c5fd}
    .small{font-size:12px;color:#cbd5e1}
    .mono{font-family:ui-monospace,Consolas,monospace}
    .secretNote{margin-top:10px;font-size:12px;color:#fde68a}
    #endWrap{z-index:9999}

    @media (min-width:700px){
      .bankGrid{grid-template-columns:1fr 1fr 1fr}
      .profileGrid{grid-template-columns:1fr 1fr}
      .top3Board{grid-template-columns:1fr 1fr 1fr}
    }

    @media (max-width:420px){
      .option h3{font-size:16px}
      .option p{font-size:12px}
      .btn{font-size:16px}
      #questionBox{top:164px}
    }

html[data-vocab-protected="1"]{
  -webkit-touch-callout:none;
}
body:not(.allow-select), body:not(.allow-select) *:not(input):not(textarea):not(select){
  -webkit-user-select:none;
  user-select:none;
}
input,textarea,select{
  -webkit-user-select:text;
  user-select:text;
}
