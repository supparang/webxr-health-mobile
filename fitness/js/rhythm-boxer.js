<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <title>Rhythm Boxer — Neon Dojo</title>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="color-scheme" content="light dark"/>
  <link rel="icon" href="./favicon.ico"/>

  <style>
    :root{
      color-scheme: dark;
      --bg:#020617;
      --card:rgba(15,23,42,0.96);
      --text:#e5e7eb;
      --accent:#38bdf8;
      --accent2:#22c55e;
      --danger:#f97316;
    }
    *{box-sizing:border-box;}
    body{
      margin:0;
      min-height:100vh;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:
        radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 55%),
        radial-gradient(circle at bottom right, rgba(16,185,129,0.22), transparent 60%),
        var(--bg);
      color:var(--text);
      display:flex;
      justify-content:center;
      padding:18px 12px 28px;
    }
    .wrap{
      width:100%;
      max-width:960px;
    }
    h1{
      margin:0 0 6px;
      font-size:1.7rem;
      display:flex;
      align-items:center;
      gap:8px;
    }
    h1 span.icon{font-size:1.9rem;}
    .subtitle{
      color:#9ca3af;
      font-size:.92rem;
      margin-bottom:10px;
    }
    .card{
      background:var(--card);
      border-radius:18px;
      padding:18px 18px 20px;
      border:1px solid rgba(148,163,184,0.45);
      box-shadow:0 16px 40px rgba(0,0,0,0.6);
      margin-bottom:14px;
    }
    .top-row{
      display:flex;
      justify-content:space-between;
      gap:8px;
      align-items:flex-start;
    }
    .btn-small{
      border-radius:999px;
      border:1px solid rgba(148,163,184,0.8);
      padding:6px 10px;
      font-size:.8rem;
      background:rgba(15,23,42,0.95);
      color:var(--text);
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      gap:4px;
      cursor:pointer;
    }
    .btn-small:hover{
      box-shadow:0 8px 18px rgba(15,23,42,0.9);
      transform:translateY(-1px);
    }
    .pill{
      display:inline-flex;
      align-items:center;
      gap:5px;
      border-radius:999px;
      border:1px solid rgba(56,189,248,0.7);
      padding:3px 9px;
      font-size:.74rem;
      margin-top:4px;
      background:rgba(8,47,73,0.8);
      color:#bae6fd;
    }
    .pill-dot{
      width:8px;height:8px;border-radius:50%;background:#22c55e;
    }
    .hidden{display:none !important;}

    label{
      display:block;
      font-size:.82rem;
      margin-bottom:3px;
      color:#9ca3af;
    }
    select{
      width:100%;
      border-radius:10px;
      border:1px solid rgba(148,163,184,0.7);
      background:rgba(15,23,42,0.95);
      color:var(--text);
      font:inherit;
      padding:7px 9px;
    }
    .row{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-top:10px;
    }
    .col{flex:1 1 220px;}
    .help{
      font-size:.78rem;
      color:#9ca3af;
      margin-top:3px;
    }
    .btn-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:12px;
    }
    button{
      border-radius:999px;
      border:1px solid rgba(148,163,184,0.7);
      padding:8px 14px;
      font:inherit;
      cursor:pointer;
      background:rgba(15,23,42,0.96);
      color:var(--text);
      display:inline-flex;
      align-items:center;
      gap:6px;
      transition:background .15s, transform .12s, box-shadow .12s;
    }
    button.primary{
      border-color:var(--accent2);
      background:linear-gradient(135deg,#22c55e,#a3e635);
      color:#022c22;
      box-shadow:0 12px 30px rgba(22,163,74,0.7);
    }
    button:hover{
      transform:translateY(-1px);
      box-shadow:0 10px 24px rgba(15,23,42,0.9);
    }
    button:active{
      transform:translateY(0);
      box-shadow:none;
    }

    .play-top{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:8px;
      font-size:.85rem;
      margin-bottom:8px;
    }
    .tags{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
    }
    .tag{
      border-radius:999px;
      border:1px solid rgba(148,163,184,0.6);
      padding:3px 8px;
      background:rgba(15,23,42,0.92);
    }
    .timer{
      font-weight:600;
      letter-spacing:.05em;
    }

    .play-area{
      position:relative;
      width:100%;
      aspect-ratio:16/9;
      border-radius:18px;
      border:1px solid rgba(148,163,184,0.7);
      overflow:hidden;
      background:
        radial-gradient(circle at top,rgba(56,189,248,0.28),transparent 60%),
        radial-gradient(circle at bottom,rgba(34,197,94,0.32),transparent 65%),
        #020617;
      box-shadow:0 0 28px rgba(56,189,248,0.25);
      transition:box-shadow .18s ease-out, transform .18s ease-out, background .18s ease-out;
    }
    .play-area.hot{
      box-shadow:
        0 0 30px rgba(56,189,248,0.6),
        0 0 50px rgba(251,191,36,0.7);
      transform:translateY(-1px);
      background:
        radial-gradient(circle at top,rgba(251,191,36,0.45),transparent 60%),
        radial-gradient(circle at bottom,rgba(249,115,22,0.45),transparent 60%),
        #020617;
    }
    .play-area.shake{
      animation:rb-shake .18s ease-out;
    }
    @keyframes rb-shake{
      0%{transform:translate(0,0);}
      25%{transform:translate(3px,-2px);}
      50%{transform:translate(-3px,2px);}
      75%{transform:translate(2px,-1px);}
      100%{transform:translate(0,0);}
    }

    .pad-grid{
      position:absolute;
      inset:0;
      display:grid;
      grid-template-columns:repeat(4,1fr);
      align-items:flex-end;
      padding:14px 14px 18px;
      gap:10px;
      pointer-events:auto;
    }
    .pad{
      position:relative;
      height:72%;
      border-radius:14px;
      border:1px solid rgba(148,163,184,0.4);
      background:linear-gradient(180deg,rgba(15,23,42,0.4),rgba(15,23,42,0.9));
      overflow:hidden;
      cursor:pointer;
      box-shadow:0 8px 20px rgba(15,23,42,0.9);
      transition:transform .08s ease-out, box-shadow .12s ease-out, border-color .1s;
    }
    .pad::before{
      content:'';
      position:absolute;
      inset:0;
      background:radial-gradient(circle at 50% 20%,rgba(56,189,248,0.18),transparent 65%);
      opacity:0;
      transition:opacity .12s;
    }
    .pad-label{
      position:absolute;
      top:6px;left:10px;
      font-size:.7rem;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#9ca3af;
    }
    .pad-emoji{
      position:absolute;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:1.8rem;
      filter:drop-shadow(0 4px 10px rgba(0,0,0,0.85));
      opacity:.55;
      transition:opacity .12s, transform .12s;
    }
    .pad-active{
      border-color:rgba(56,189,248,0.9);
      transform:translateY(-2px);
      box-shadow:
        0 0 18px rgba(56,189,248,0.8),
        0 12px 28px rgba(15,23,42,0.95);
    }
    .pad-active::before{opacity:1;}
    .pad-active .pad-emoji{
      opacity:1;
      transform:translateY(-4px) scale(1.05);
    }
    .pad-hit{
      animation:pad-hit .16s ease-out;
    }
    @keyframes pad-hit{
      0%{transform:translateY(-2px) scale(1);}
      50%{transform:translateY(-6px) scale(1.06);}
      100%{transform:translateY(-2px) scale(1);}
    }

    .judge-label{
      position:absolute;
      top:16px;
      left:50%;
      transform:translateX(-50%);
      padding:4px 10px;
      border-radius:999px;
      border:1px solid rgba(248,250,252,0.85);
      background:rgba(15,23,42,0.95);
      font-size:.82rem;
      letter-spacing:.08em;
      text-transform:uppercase;
      display:flex;
      align-items:center;
      gap:6px;
      opacity:0;
      pointer-events:none;
      transition:opacity .1s, transform .1s;
    }
    .judge-label.show{
      opacity:1;
      transform:translateX(-50%) translateY(2px);
    }

    .judge-perfect{
      border-color:rgba(250,204,21,0.95);
      box-shadow:0 0 20px rgba(250,204,21,0.9);
      color:#facc15;
    }
    .judge-good{
      border-color:rgba(34,197,94,0.9);
      box-shadow:0 0 16px rgba(34,197,94,0.8);
      color:#bbf7d0;
    }
    .judge-late{
      border-color:rgba(59,130,246,0.9);
      box-shadow:0 0 14px rgba(59,130,246,0.8);
      color:#bfdbfe;
    }
    .judge-miss,.judge-wrong{
      border-color:rgba(248,113,113,0.9);
      box-shadow:0 0 14px rgba(248,113,113,0.85);
      color:#fecaca;
    }

    .fever-wrap{
      margin-top:8px;
      display:flex;
      align-items:center;
      gap:8px;
      font-size:.78rem;
    }
    .fever-label{
      font-weight:600;
      letter-spacing:.12em;
      color:#facc15;
    }
    .fever-bar{
      flex:1;
      height:8px;
      border-radius:999px;
      background:rgba(15,23,42,0.95);
      border:1px solid rgba(234,179,8,0.5);
      overflow:hidden;
    }
    .fever-fill{
      height:100%;
      width:0%;
      border-radius:999px;
      background:linear-gradient(90deg,#22c55e,#facc15,#f97316);
      box-shadow:0 0 14px rgba(250,204,21,0.7);
      transition:width .16s ease-out;
    }
    .fever-status{
      min-width:70px;
      text-align:center;
      border-radius:999px;
      border:1px solid rgba(234,179,8,0.7);
      padding:2px 8px;
      background:rgba(15,23,42,0.96);
      color:#eab308;
    }
    .fever-status.active{
      background:linear-gradient(135deg,#f97316,#facc15);
      color:#022c22;
      box-shadow:0 0 18px rgba(248,250,252,0.7);
    }

    .coach-bubble{
      margin-top:10px;
      display:flex;
      align-items:flex-start;
      gap:8px;
      max-width:520px;
      padding:8px 10px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,0.6);
      background:rgba(15,23,42,0.95);
      font-size:.8rem;
      opacity:0;
      transform:translateY(4px);
      pointer-events:none;
      transition:opacity .18s ease-out, transform .18s ease-out;
    }
    .coach-bubble.visible{
      opacity:1;
      transform:translateY(0);
      pointer-events:auto;
    }
    .coach-avatar{
      width:28px;height:28px;
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(15,118,110,0.9);
      box-shadow:0 0 10px rgba(34,197,94,0.7);
    }
    .coach-body{flex:1;}
    .coach-role{
      font-size:.72rem;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:#a5b4fc;
      margin-bottom:2px;
    }
    .coach-text{
      font-size:.8rem;
      color:#e5e7eb;
    }

    .banner{
      margin-top:8px;
      font-size:.8rem;
      color:#9ca3af;
    }

    @media(max-width:640px){
      .card{padding:14px 12px 18px;}
      h1{font-size:1.45rem;}
      .play-area{border-radius:14px;}
    }

    #result table{
      width:100%;
      border-collapse:collapse;
      margin-top:6px;
      font-size:.84rem;
    }
    #result th,#result td{
      text-align:left;
      padding:5px 6px;
      border-bottom:1px solid rgba(148,163,184,0.45);
    }
    #result td.label{
      color:#9ca3af;
      width:42%;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <!-- MENU -->
    <section class="card" id="menu">
      <div class="top-row">
        <div>
          <h1><span class="icon">🥁</span>Rhythm Boxer — Neon Dojo</h1>
          <div class="subtitle">
            ตีตามจังหวะบนแผ่นเป้า 4 ทิศ แบบ Punch Pad Rhythm วัดความแม่นจังหวะ + ความล้า + tempo drift
          </div>
          <div class="pill">
            <span class="pill-dot"></span>
            <span>DOM Engine • Multi-pad • FEVER • Research CSV • Neon cyber dojo</span>
          </div>
        </div>
        <div>
          <a href="./index.html" class="btn-small">⬅ กลับ Fitness Hub</a>
        </div>
      </div>

      <div class="row" style="margin-top:12px;">
        <div class="col">
          <label for="difficulty">ระดับความยาก</label>
          <select id="difficulty">
            <option value="easy">ง่าย — ~100 BPM, หน้าต่างกว้าง</option>
            <option value="normal" selected>ปกติ — ~130 BPM</option>
            <option value="hard">ยาก — ~160 BPM, หน้าต่างแคบ</option>
          </select>
          <div class="help">ระดับยาก: จังหวะถี่ขึ้น หน้าต่าง Perfect/Good แคบลง</div>
        </div>
        <div class="col">
          <label for="tempoMode">รูปแบบจังหวะ (Tempo Mode)</label>
          <select id="tempoMode">
            <option value="fixed" selected>Fixed BPM — คงที่ตลอดเกม</option>
            <option value="ramp">Increasing BPM — เร็วขึ้นเรื่อย ๆ</option>
            <option value="random">Random BPM — แกว่งสุ่มรอบ base tempo</option>
          </select>
          <div class="help">ใช้วัด tempo drift + inter-beat error ตามโหมดที่เลือก</div>
        </div>
      </div>

      <div class="btn-row">
        <button class="primary" data-start="normal">
          🎮 เริ่มเล่นปกติ
        </button>
        <button data-start="research">
          📊 โหมดวิจัย (บันทึก CSV)
        </button>
        <button data-start="calib">
          🧪 Calibration 30s (ตั้งหน้าต่าง Perfect/Good/Late)
        </button>
      </div>
    </section>

    <!-- PLAY -->
    <section class="card hidden" id="play">
      <div class="play-top">
        <div class="tags">
          <div class="tag">Mode: <span id="stat-mode">-</span></div>
          <div class="tag">Diff: <span id="stat-diff">-</span></div>
          <div class="tag">Tempo: <span id="stat-tempo">-</span> BPM</div>
          <div class="tag">Score: <span id="stat-score">0</span></div>
          <div class="tag">Combo: <span id="stat-combo">0</span></div>
          <div class="tag">Miss: <span id="stat-miss">0</span></div>
        </div>
        <div class="timer">⏱ <span id="stat-time">60.0</span>s</div>
      </div>

      <div class="play-area" id="playArea">
        <div class="pad-grid" id="padGrid">
          <div class="pad" data-pad="0">
            <div class="pad-label">LEFT</div>
            <div class="pad-emoji">🥊</div>
          </div>
          <div class="pad" data-pad="1">
            <div class="pad-label">MID-L</div>
            <div class="pad-emoji">⚡</div>
          </div>
          <div class="pad" data-pad="2">
            <div class="pad-label">MID-R</div>
            <div class="pad-emoji">⭐</div>
          </div>
          <div class="pad" data-pad="3">
            <div class="pad-label">RIGHT</div>
            <div class="pad-emoji">🎯</div>
          </div>
        </div>
        <div class="judge-label" id="judgeLabel">PERFECT</div>
      </div>

      <div class="fever-wrap">
        <div class="fever-label">FEVER</div>
        <div class="fever-bar">
          <div class="fever-fill" id="feverFill"></div>
        </div>
        <div class="fever-status" id="feverStatus">FEVER</div>
      </div>

      <div id="coachBubble" class="coach-bubble">
        <div id="coachAvatar" class="coach-avatar">🥊</div>
        <div class="coach-body">
          <div id="coachRole" class="coach-role">Rhythm Coach</div>
          <div id="coachText" class="coach-text">
            พร้อมลุยจังหวะแล้ว! ดูแผ่นที่สว่างแล้วตีตามเลย 🎵
          </div>
        </div>
      </div>

      <div class="banner">
        <strong>วิธีเล่น:</strong>
        ทุก beat จะมีแผ่นที่สว่างขึ้น ให้แตะ/ชกแผ่นนั้นให้ตรงจังหวะ (Perfect / Good / Late)
        ถ้าแตะผิดแผ่นหรือไม่ทันจะนับ miss และ spatial error — สะสม combo เติมเกจ FEVER เพื่อคะแนนคูณ ✨
      </div>

      <div class="btn-row" style="margin-top:10px;">
        <button data-stop>⏹ หยุดก่อนเวลา</button>
        <button onclick="location.href='./index.html'">⬅ กลับ Hub</button>
      </div>
    </section>

    <!-- RESULT -->
    <section class="card hidden" id="result">
      <div class="top-row">
        <div>
          <h1><span class="icon">📈</span>สรุปผล Rhythm Boxer</h1>
          <div class="subtitle">
            ค่า reaction, tempo drift, fatigue, consistency และ spatial accuracy จะถูกบันทึกลง CSV ด้วย
          </div>
        </div>
        <div>
          <a href="./index.html" class="btn-small">⬅ กลับ Hub</a>
        </div>
      </div>

      <table>
        <tbody>
          <tr><td class="label">โหมด</td><td id="res-mode">-</td></tr>
          <tr><td class="label">ระดับความยาก</td><td id="res-diff">-</td></tr>
          <tr><td class="label">Tempo Mode</td><td id="res-tempo-mode">-</td></tr>
          <tr><td class="label">BPM ตั้งต้น</td><td id="res-bpm">-</td></tr>
          <tr><td class="label">เหตุจบเกม</td><td id="res-endreason">-</td></tr>

          <tr><td class="label">คะแนนรวม</td><td id="res-score">0</td></tr>
          <tr><td class="label">คอมโบสูงสุด</td><td id="res-maxcombo">0</td></tr>
          <tr><td class="label">จำนวน miss</td><td id="res-miss">0</td></tr>
          <tr><td class="label">จำนวน hit ทั้งหมด</td><td id="res-totalhits">0</td></tr>
          <tr><td class="label">จำนวน Perfect</td><td id="res-perfect">0</td></tr>
          <tr><td class="label">จำนวน Good</td><td id="res-good">0</td></tr>
          <tr><td class="label">จำนวน Late</td><td id="res-late">0</td></tr>
          <tr><td class="label">Accuracy (hit/beat)</td><td id="res-accuracy">-</td></tr>

          <tr><td class="label">Reaction time เฉลี่ย</td><td id="res-rt-mean">-</td></tr>
          <tr><td class="label">Reaction time SD (σ RT)</td><td id="res-rt-sd">-</td></tr>
          <tr><td class="label">Inter-Beat error เฉลี่ย (|ΔIBI|)</td><td id="res-ibi-err">-</td></tr>
          <tr><td class="label">Tempo drift</td><td id="res-tempo-drift">-</td></tr>
          <tr><td class="label">Fatigue index</td><td id="res-fatigue">-</td></tr>

          <tr><td class="label">Spatial accuracy</td><td id="res-spatial">-</td></tr>
          <tr><td class="label">จำนวน hit ถูกแผ่น</td><td id="res-spatial-correct">-</td></tr>
          <tr><td class="label">จำนวน hit ผิดแผ่น/จังหวะ</td><td id="res-spatial-wrong">-</td></tr>
        </tbody>
      </table>

      <div class="btn-row" style="margin-top:12px;">
        <button class="primary" data-download>⬇ ดาวน์โหลด CSV รอบนี้</button>
        <button data-retry>▶ เล่นอีกครั้ง</button>
        <button onclick="location.href='./index.html'">⬅ กลับ Hub</button>
      </div>
    </section>
  </div>

  <script type="module" src="./js/rhythm-boxer.js"></script>
</body>
</html>