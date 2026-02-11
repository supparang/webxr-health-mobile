<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>Fitness — Teacher Dashboard</title>
  <meta name="color-scheme" content="dark light"/>
  <link rel="stylesheet" href="hub.css"/>
  <style>
    :root{
      --bg:#020617;
      --panel:rgba(2,6,23,.55);
      --stroke:rgba(148,163,184,.18);
      --text:#e5e7eb;
      --muted:#94a3b8;
      --good:rgba(34,197,94,.25);
      --bad:rgba(239,68,68,.18);
      --r:18px;
    }
    body{ background:var(--bg); color:var(--text); margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; }
    .td-wrap{ max-width:1100px; margin:0 auto; padding:14px; }
    .td-top{
      display:flex; flex-wrap:wrap; gap:10px; align-items:center;
      padding:12px; border:1px solid var(--stroke); background:var(--panel); border-radius:var(--r);
    }
    .td-title{ font-weight:1000; font-size:16px; }
    .td-sub{ color:var(--muted); font-weight:900; font-size:12px; }
    .td-actions{ display:flex; flex-wrap:wrap; gap:8px; margin-left:auto; }
    .td-btn{
      border:1px solid var(--stroke); background:rgba(2,6,23,.45); color:var(--text);
      border-radius:14px; padding:9px 12px; font-weight:1000; font-size:12px;
    }
    .td-btn-primary{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.30); }
    .td-btn-warn{ background:rgba(239,68,68,.12); border-color:rgba(239,68,68,.26); }

    .td-filters{
      margin-top:10px;
      display:grid;
      grid-template-columns: repeat(6, minmax(0,1fr));
      gap:8px;
    }
    .td-inp{
      border:1px solid var(--stroke);
      background:rgba(2,6,23,.45);
      color:var(--text);
      border-radius:14px;
      padding:10px;
      font-weight:1000;
      font-size:12px;
      width:100%;
      outline:none;
    }
    .td-inp:focus{ border-color:rgba(34,197,94,.35); }

    .td-filter-adv{
      margin-top:10px;
      padding:12px;
      border:1px solid var(--stroke);
      background:var(--panel);
      border-radius:var(--r);
      display:grid;
      grid-template-columns: repeat(6, minmax(0,1fr));
      gap:8px;
      align-items:center;
    }
    .td-chip{
      display:inline-flex; gap:8px; align-items:center;
      padding:8px 10px;
      border:1px solid var(--stroke);
      background:rgba(2,6,23,.45);
      border-radius:14px;
      font-weight:1000;
      font-size:12px;
      white-space:nowrap;
    }
    .td-chip input{ width:16px; height:16px; }
    .td-note{ grid-column: 1 / -1; color:var(--muted); font-weight:900; font-size:12px; }

    .td-table{
      margin-top:12px;
      border:1px solid var(--stroke);
      background:var(--panel);
      border-radius:var(--r);
      overflow:hidden;
    }
    table{ width:100%; border-collapse:collapse; }
    th,td{ padding:10px; border-bottom:1px solid var(--stroke); font-size:12px; }
    th{ text-align:left; color:var(--muted); font-weight:1000; }
    tr:hover td{ background:rgba(148,163,184,.06); }
    .pill{
      display:inline-flex; gap:6px; align-items:center;
      border:1px solid var(--stroke);
      background:rgba(10,16,36,.55);
      border-radius:999px;
      padding:4px 8px;
      font-weight:1000; font-size:12px;
      white-space:nowrap;
    }
    .ok{ background:var(--good); }
    .warn{ background:var(--bad); }
    .td-msg{ margin-top:10px; color:var(--muted); font-weight:900; font-size:12px; }

    @media (max-width: 920px){
      .td-filters{ grid-template-columns: repeat(2, minmax(0,1fr)); }
      .td-filter-adv{ grid-template-columns: repeat(2, minmax(0,1fr)); }
      th:nth-child(7), td:nth-child(7),
      th:nth-child(8), td:nth-child(8){ display:none; }
    }
  </style>
</head>
<body>
  <div class="td-wrap">
    <div class="td-top">
      <div>
        <div class="td-title">👩‍🏫 Teacher Dashboard — Fitness (local)</div>
        <div class="td-sub">Filter export + Archive & Clear (Summary + Events)</div>
      </div>
      <div class="td-actions">
        <button class="td-btn" id="td-refresh">รีเฟรช</button>

        <button class="td-btn td-btn-primary" id="td-copy-sum">คัดลอก Summary CSV</button>
        <button class="td-btn td-btn-primary" id="td-dl-sum">ดาวน์โหลด Summary CSV</button>

        <button class="td-btn" id="td-copy-evt">คัดลอก Events CSV</button>
        <button class="td-btn td-btn-primary" id="td-dl-evt">ดาวน์โหลด Events CSV</button>

        <button class="td-btn td-btn-warn" id="td-archive-clear">Archive & Clear</button>
        <a class="td-btn" href="hub.html">กลับ Hub</a>
      </div>
    </div>

    <!-- Basic filters (summary table) -->
    <div class="td-filters">
      <input class="td-inp" id="f-pid" placeholder="ค้นหา PID (เช่น P001)" />
      <select class="td-inp" id="f-game">
        <option value="">เกม: ทั้งหมด</option>
        <option value="shadow">Shadow</option>
        <option value="rhythm">Rhythm</option>
        <option value="jumpduck">JumpDuck</option>
        <option value="balance">Balance</option>
      </select>
      <select class="td-inp" id="f-phase">
        <option value="">Phase: ทั้งหมด</option>
        <option value="pre">pre</option>
        <option value="post">post</option>
        <option value="mid">mid</option>
      </select>
      <select class="td-inp" id="f-group">
        <option value="">Group: ทั้งหมด</option>
        <option value="A">A</option><option value="B">B</option>
        <option value="C">C</option><option value="D">D</option>
      </select>
      <select class="td-inp" id="f-sort">
        <option value="ts_desc">เรียง: ล่าสุดก่อน</option>
        <option value="pid_asc">PID A→Z</option>
        <option value="score_desc">คะแนนมาก→น้อย</option>
        <option value="ms_desc">เวลามาก→น้อย</option>
      </select>
      <input class="td-inp" id="f-limit" inputmode="numeric" placeholder="จำกัดแถว (เช่น 200)" />
    </div>

    <!-- Advanced export filters (applies to BOTH summary+events export) -->
    <div class="td-filter-adv">
      <input class="td-inp" id="x-study" placeholder="Export filter: studyId (เช่น FIT01)" />
      <input class="td-inp" id="x-from" placeholder="ตั้งแต่ (YYYY-MM-DD)" />
      <input class="td-inp" id="x-to" placeholder="ถึง (YYYY-MM-DD)" />
      <label class="td-chip">
        <input id="x-today" type="checkbox"/>
        <span>เฉพาะวันนี้</span>
      </label>
      <label class="td-chip">
        <input id="x-onlyfiltered" type="checkbox" checked/>
        <span>Export เฉพาะที่กรอง</span>
      </label>
      <button class="td-btn" id="x-clear" type="button">ล้างตัวกรอง export</button>

      <div class="td-note">
        • ตัวกรอง export จะใช้กับไฟล์ที่ export ทั้ง Summary และ Events (เวลา/Study)  
        • ถ้าติ๊ก “Export เฉพาะที่กรอง” → จะใช้ PID/Game/Phase/Group จากด้านบนด้วย
      </div>
    </div>

    <div class="td-table">
      <table>
        <thead>
          <tr>
            <th>เวลา</th>
            <th>PID</th>
            <th>Study</th>
            <th>Phase</th>
            <th>Group</th>
            <th>Game</th>
            <th>Score</th>
            <th>Pass/Total</th>
            <th>Streak</th>
            <th>Duration</th>
            <th>Seed</th>
          </tr>
        </thead>
        <tbody id="td-body"></tbody>
      </table>
    </div>

    <div class="td-msg" id="td-msg"></div>
  </div>

  <script src="../herohealth/vr/hha-research-pack.js"></script>
  <script src="teacher-dashboard.js"></script>
</body>
</html>