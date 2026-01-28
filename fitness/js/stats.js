<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>VR Fitness — Stats</title>
  <meta name="color-scheme" content="dark light" />
  <link rel="icon" href="./favicon.ico" />
  <style>
    :root{
      color-scheme: dark;
      --bg:#020617;
      --card:rgba(15,23,42,.92);
      --border:rgba(148,163,184,.25);
      --text:#e5e7eb;
      --muted:#9ca3af;
      --accent:#38bdf8;
      --accent2:#a855f7;
      --radius:18px;
    }
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text)}
    .wrap{max-width:1000px;margin:0 auto;padding:14px 12px 28px;display:flex;flex-direction:column;gap:12px}
    header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    h1{margin:0;font-size:1.25rem}
    .sub{margin:4px 0 0;color:var(--muted);font-size:.86rem}
    a{color:var(--accent);text-decoration:none}
    a:hover{text-decoration:underline}
    .card{border:1px solid var(--border);background:var(--card);border-radius:var(--radius);padding:12px}
    .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
    .btn{
      border-radius:999px;border:1px solid var(--border);
      background:rgba(2,6,23,.35);color:var(--text);
      padding:7px 12px;font-size:.88rem;cursor:pointer
    }
    .btn.primary{
      border:0;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      color:#020617;font-weight:700
    }
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.14);font-size:.86rem;text-align:left;vertical-align:top}
    th{color:rgba(229,231,235,.9);font-size:.82rem}
    td.muted{color:var(--muted)}
    .tag{display:inline-flex;gap:6px;align-items:center;padding:2px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.22);color:var(--muted);font-size:.76rem}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>📊 VR Fitness — สรุปผลล่าสุด</h1>
        <p class="sub">ดึงจาก localStorage (เล่นแล้วจะมีข้อมูล) • <a href="./hub.html">กลับ Hub</a></p>
      </div>
      <div class="tag">Shadow Breaker • Offline</div>
    </header>

    <section class="card">
      <div class="toolbar">
        <div class="muted">ดู 200 รายการล่าสุด</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="btn-download" class="btn primary">⬇ ดาวน์โหลด CSV</button>
          <button id="btn-clear" class="btn">ล้างข้อมูล</button>
        </div>
      </div>
      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>เกม</th>
              <th>Score</th>
              <th>Accuracy</th>
              <th>Grade</th>
              <th>Bosses</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </section>
  </div>

  <script type="module" src="./js/stats-page.js"></script>
</body>
</html>