<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>VR Fitness — Shadow Breaker</title>
  <style>
    :root {
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top, rgba(56,189,248,.25), transparent 60%),
        radial-gradient(circle at bottom, rgba(34,197,94,.25), transparent 60%),
        #020617;
      color: #e5e7eb;
      padding: 16px;
    }
    .wrap {
      width: min(960px, 100%);
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 24px;
      align-items: stretch;
    }
    @media (max-width: 768px) {
      .wrap {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .panel {
      background: rgba(15,23,42,0.92);
      border-radius: 20px;
      padding: 20px 22px;
      border: 1px solid rgba(148,163,184,0.7);
      box-shadow: 0 20px 48px rgba(15,23,42,0.75);
    }
    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 0 8px;
      font-size: 22px;
    }
    .badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(37,99,235,0.2);
      border: 1px solid rgba(96,165,250,0.8);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .subtitle {
      margin: 0 0 16px;
      font-size: 14px;
      opacity: 0.85;
    }
    .story {
      display: grid;
      gap: 10px;
      margin-top: 8px;
      font-size: 14px;
    }
    .story h2 {
      margin: 0;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .story p {
      margin: 0;
      opacity: 0.9;
    }
    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      font-size: 12px;
    }
    .tag {
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.7);
      background: rgba(15,23,42,0.8);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .modes {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }
    .mode-card {
      border-radius: 16px;
      padding: 10px 12px;
      background: rgba(15,23,42,0.95);
      border: 1px solid rgba(148,163,184,0.7);
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    .mode-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }
    .mode-meta {
      opacity: 0.8;
      font-size: 12px;
    }
    .mode-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .btn-play {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #022c22;
      background: #22c55e;
      box-shadow: 0 0 0 1px #4ade80;
    }
    .btn-play:hover {
      filter: brightness(1.05);
    }
    .btn-ghost {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      border: 1px solid rgba(148,163,184,0.6);
      background: transparent;
      color: #e5e7eb;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .right-panel h2 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .right-panel ul {
      margin: 0 0 12px 18px;
      padding: 0;
      font-size: 13px;
    }
    .device-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
      font-size: 12px;
    }
    .device {
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.7);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <!-- LEFT: Story + โหมดเล่น -->
    <section class="panel">
      <div class="title">
        <span style="font-size:26px">🥊</span>
        <div>
          <div class="badge">VR Fitness • Shadow Breaker</div>
          <div style="font-size:18px;font-weight:600;margin-top:4px">
            Chapter 1: Hell Trainer
          </div>
        </div>
      </div>
      <p class="subtitle">
        ต่อยมือตามตำแหน่งเป้าที่โผล่บนจอ ฝึกความไว ความแม่น และความอึดไปพร้อม ๆ กัน
      </p>

      <div class="story">
        <h2>เนื้อเรื่องสั้น ๆ</h2>
        <p>
          คุณถูกเรียกตัวเข้าโปรแกรมฝึกของ <strong>RazorFist</strong> เทรนเนอร์โหดแห่ง VR-Fitness Arena.<br>
          ภารกิจของคุณคือ <strong>ต่อยเป้าให้ทัน</strong> โดยห้ามปล่อยให้หลุดสายตาติดต่อกันนานเกินไป 🔥
        </p>
      </div>

      <div class="tag-row">
        <span class="tag">⚡ Reflex Training</span>
        <span class="tag">💪 Upper-body Workout</span>
        <span class="tag">🧠 Focus & Reaction</span>
      </div>

      <div class="modes">
        <!-- Mode 1: Quick Play -->
        <div class="mode-card">
          <div class="mode-header">
            <span>โหมดเร็ว 60s</span>
            <span class="mode-meta">Level: EASY</span>
          </div>
          <div class="mode-meta">วอร์มร่างกายแบบสั้น ๆ เหมาะสำหรับเริ่มต้น</div>
          <div class="mode-actions">
            <a class="btn-play"
               href="./play.html?game=shadow-breaker&mode=timed&diff=easy&time=60">
              ▶ เล่นเลย
            </a>
          </div>
        </div>

        <!-- Mode 2: Standard -->
        <div class="mode-card">
          <div class="mode-header">
            <span>โหมดมาตรฐาน 90s</span>
            <span class="mode-meta">Level: NORMAL</span>
          </div>
          <div class="mode-meta">จังหวะกำลังดี มีเวลาให้ไล่ combo แบบต่อเนื่อง</div>
          <div class="mode-actions">
            <a class="btn-play"
               href="./play.html?game=shadow-breaker&mode=timed&diff=normal&time=90">
              ▶ เล่นเลย
            </a>
          </div>
        </div>

        <!-- Mode 3: Hell Trainer -->
        <div class="mode-card">
          <div class="mode-header">
            <span>Hell Trainer 120s</span>
            <span class="mode-meta">Level: HARD</span>
          </div>
          <div class="mode-meta">เป้าโผล่ถี่ขึ้น เร็วขึ้น เหมาะกับสายโหดเท่านั้น 😈</div>
          <div class="mode-actions">
            <a class="btn-play"
               href="./play.html?game=shadow-breaker&mode=timed&diff=hard&time=120">
              ▶ เล่นโหมดโหด
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- RIGHT: วิธีเล่น + อุปกรณ์ -->
    <section class="panel right-panel">
      <h2>วิธีเล่นคร่าว ๆ</h2>
      <ul>
        <li>กดปุ่ม <strong>▶ เริ่มเล่น</strong> ที่มุมล่างของหน้าจอในฉากเกม</li>
        <li>วงกลมเป้าจะโผล่ตามจุดต่าง ๆ บนจอ → รีบชี้/คลิกให้ทัน</li>
        <li>ต่อยโดน = ได้คะแนน + Combo เพิ่ม, ปล่อยให้หายไป = นับเป็น Miss</li>
        <li>เล่นให้ครบเวลาที่กำหนด แล้วดูสรุปผล Score / Hits / Miss / Combo</li>
      </ul>

      <h2>รองรับอุปกรณ์</h2>
      <div class="device-row">
        <span class="device">🖱 PC – เมาส์ + คีย์บอร์ด</span>
        <span class="device">📱 มือถือ / แท็บเล็ต – แตะหน้าจอ</span>
        <span class="device">🕶 VR Headset – ตัวชี้ / คอนโทรลเลอร์</span>
      </div>
    </section>
  </div>
</body>
</html>
