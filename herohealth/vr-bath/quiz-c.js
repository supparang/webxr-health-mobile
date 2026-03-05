<!-- === /herohealth/vr-bath/quiz-c.html ===
Quiz (Bloom C) — stand-alone page that ALWAYS routes next after submit/skip
FULL v20260305-BATH-QUIZC-PAGE
-->
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>HeroHealth — Bath Quiz (C)</title>
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="../favicon.ico" />
  <style>
    :root{
      --bg:#050814; --panel:rgba(2,6,23,.78); --stroke:rgba(148,163,184,.18);
      --text:#e5e7eb; --muted:#94a3b8; --good:#22c55e; --cyan:#22d3ee;
      --r:22px;
    }
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;background:
      radial-gradient(900px 700px at 80% 10%, rgba(34,211,238,.12), transparent 55%),
      radial-gradient(1200px 800px at 20% 0%, rgba(34,197,94,.10), transparent 55%),
      var(--bg);
      color:var(--text); font-family:system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
    }
    .wrap{min-height:100%;display:grid;place-items:center;padding:18px}
    .card{
      width:min(860px,100%);
      border:1px solid var(--stroke);
      background:var(--panel);
      border-radius:var(--r);
      padding:16px;
      box-shadow:0 24px 90px rgba(0,0,0,.55);
    }
    h1{margin:0;font-size:18px;font-weight:1000}
    .sub{margin:6px 0 0 0;color:rgba(148,163,184,.95);font-size:13px;font-weight:850}
    .q{margin-top:12px;font-weight:1000}
    .opt{margin-top:10px;display:flex;flex-direction:column;gap:10px}
    label{
      display:flex;gap:10px;align-items:flex-start;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.55);
      border-radius:16px;padding:12px;font-weight:950;
    }
    input{margin-top:2px}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
    .btn{
      border-radius:16px;border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.72);color:rgba(229,231,235,.95);
      padding:10px 12px;font-weight:1000;cursor:pointer;
    }
    .btn.primary{ background: rgba(34,197,94,.18); border-color: rgba(34,197,94,.28); }
    .btn.cyan{ background: rgba(34,211,238,.14); border-color: rgba(34,211,238,.24); }
    #toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);
      padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.82);color:#e5e7eb;font-weight:950;opacity:0;pointer-events:none;
      transition:opacity .18s ease}
    #toast.show{opacity:1}
    code{color:rgba(34,197,94,.95)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>C: วิเคราะห์ (Quiz)</h1>
      <p class="sub">ตอบ 1 ข้อ แล้วไปต่อ (ถ้าหน้าอื่นเรียกให้ส่ง <code>next=...</code> จะไปตามนั้น)</p>

      <div class="q">ทำไมกินหวานก่อนนอนแล้วไม่แปรงฟัน ถึงเสี่ยงเกิดคราบ/ฟันผุ?</div>

      <div class="opt">
        <label><input type="radio" name="q1" value="A"> เพราะฟันไม่ชอบรสหวาน</label>
        <label><input type="radio" name="q1" value="B"> เพราะน้ำตาลทำให้แบคทีเรียสร้างกรด กัดฟัน เกิดคราบ</label>
        <label><input type="radio" name="q1" value="C"> เพราะตอนกลางคืนแสงน้อย</label>
      </div>

      <div class="actions">
        <button class="btn cyan" id="btnSkip" type="button">ข้าม</button>
        <button class="btn primary" id="btnSubmit" type="button">ส่งคำตอบ</button>
      </div>

      <p class="sub" style="margin-top:10px">ถ้าตอบแล้วไม่ไปไหน แปลว่าเดิมไม่มี controller — ไฟล์นี้แก้แล้ว ✅</p>
    </div>
  </div>

  <div id="toast"></div>

  <script src="./quiz-c.js"></script>
</body>
</html>