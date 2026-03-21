<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>HeroHealth • Handwash VR</title>
  <meta name="theme-color" content="#0ea5e9" />
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
  <style>
    html,body{
      margin:0;
      width:100%;
      height:100%;
      overflow:hidden;
      background:#03111d;
      font-family:"Noto Sans Thai",system-ui,-apple-system,sans-serif;
    }

    .overlay{
      position:fixed;
      inset:0;
      z-index:20;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      background:linear-gradient(180deg, rgba(3,17,29,.82), rgba(3,17,29,.68));
      backdrop-filter:blur(6px);
      -webkit-backdrop-filter:blur(6px);
    }

    .card{
      width:min(720px, 96vw);
      border-radius:24px;
      padding:20px 18px 16px;
      color:#eef8ff;
      background:
        radial-gradient(700px 240px at 50% -12%, rgba(34,211,238,.12), transparent 60%),
        linear-gradient(180deg, rgba(7,21,36,.96), rgba(4,13,24,.96));
      border:1px solid rgba(148,163,184,.18);
      box-shadow:0 24px 60px rgba(0,0,0,.36);
    }

    .badge{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 14px;
      border-radius:999px;
      font-weight:1000;
      background:rgba(56,189,248,.14);
      border:1px solid rgba(56,189,248,.22);
      color:#e0f2fe;
      margin-bottom:10px;
    }

    h1{
      margin:0 0 8px;
      font-size:clamp(1.35rem, 3vw, 2rem);
      line-height:1.1;
    }

    p{
      margin:0 0 10px;
      line-height:1.55;
      color:#b7d6ea;
    }

    .list{
      display:grid;
      gap:8px;
      margin:12px 0 14px;
    }

    .pill{
      border-radius:14px;
      padding:10px 12px;
      color:#dfefff;
      font-weight:800;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.06);
    }

    .actions{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-top:14px;
    }

    .actions button{
      min-height:48px;
      padding:0 16px;
      border:none;
      border-radius:14px;
      font:inherit;
      font-weight:1000;
      cursor:pointer;
    }

    .primary{
      color:#03263d;
      background:linear-gradient(180deg,#9ae9ff,#5ad5ff);
    }

    .success{
      color:#052e16;
      background:linear-gradient(180deg,#86efac,#22c55e);
    }

    .ghost{
      color:#eef8ff;
      background:linear-gradient(180deg, rgba(17,33,50,.92), rgba(9,18,30,.88));
      border:1px solid rgba(148,163,184,.18);
    }

    .miniHud{
      position:fixed;
      left:12px;
      top:12px;
      z-index:12;
      display:flex;
      flex-direction:column;
      gap:8px;
      width:min(320px, calc(100vw - 24px));
      pointer-events:none;
    }

    .miniCard{
      border-radius:14px;
      padding:10px 12px;
      color:#eef8ff;
      background:rgba(3,10,18,.72);
      border:1px solid rgba(148,163,184,.14);
      box-shadow:0 10px 24px rgba(0,0,0,.22);
    }

    .miniKicker{
      font-size:.76rem;
      color:#b7d6ea;
      font-weight:900;
      margin-bottom:4px;
    }

    .miniTitle{
      font-size:.95rem;
      font-weight:1000;
      line-height:1.25;
    }

    .miniSub{
      font-size:.84rem;
      color:#b7d6ea;
      margin-top:4px;
      line-height:1.35;
    }

    .miniRow{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }

    .chip{
      border-radius:999px;
      padding:6px 10px;
      font-size:.78rem;
      font-weight:1000;
      background:rgba(56,189,248,.14);
      border:1px solid rgba(56,189,248,.22);
      color:#e0f2fe;
    }

    .hidden{ display:none !important; }
  </style>
</head>
<body>
  <div id="launchOverlay" class="overlay">
    <div class="card">
      <div class="badge">🥽 Handwash VR</div>
      <h1>โหมด Cardboard / cVR</h1>
      <p>
        เวอร์ชันนี้ใช้ <strong>การจ้องค้าง</strong> เป็นหลัก
        ไม่ต้องลากละเอียดแบบมือถือ
      </p>

      <div class="list">
        <div class="pill">1) กด “เริ่มเกม”</div>
        <div class="pill">2) กด “ใส่สบู่” บนบอร์ดในฉาก</div>
        <div class="pill">3) จ้องค้างที่โซนที่ถูกต้องของ WHO step ปัจจุบัน</div>
        <div class="pill">4) ครบ 7 ขั้นแล้วกด “ล้างน้ำ” แล้ว “เช็ดมือ”</div>
      </div>

      <div class="actions">
        <button id="btnStart" class="primary">เริ่มเกม</button>
        <button id="btnBackHubTop" class="ghost">กลับ HUB</button>
      </div>
    </div>
  </div>

  <div class="miniHud">
    <div class="miniCard">
      <div class="miniKicker">โหมด VR</div>
      <div id="hudTitle" class="miniTitle">กด “ใส่สบู่” เพื่อเริ่ม</div>
      <div id="hudSub" class="miniSub">จากนั้นจ้องค้างที่โซนของขั้นปัจจุบัน</div>
    </div>
    <div class="miniCard">
      <div class="miniRow">
        <div id="hudWho" class="chip">WHO 0 / 7</div>
        <div id="hudCoverage" class="chip">Coverage 0%</div>
        <div id="hudPhase" class="chip">intro</div>
      </div>
    </div>
  </div>

  <a-scene
    renderer="colorManagement: true; physicallyCorrectLights: false"
    background="color: #03111d"
    vr-mode-ui="enabled: true"
    device-orientation-permission-ui="enabled: true">

    <a-assets></a-assets>

    <a-sky color="#061624"></a-sky>

    <a-entity light="type: ambient; color: #cdefff; intensity: 1.0"></a-entity>
    <a-entity light="type: directional; color: #ffffff; intensity: 0.8" position="1 3 2"></a-entity>

    <a-entity id="rig" position="0 1.6 0">
      <a-camera look-controls wasd-controls-enabled="false">
        <a-entity
          id="cursor"
          cursor="fuse: true; fuseTimeout: 700"
          raycaster="objects: .clickable"
          position="0 0 -1"
          geometry="primitive: ring; radiusInner: 0.008; radiusOuter: 0.014"
          material="color: #ffffff; shader: flat; opacity: 0.95">
        </a-entity>
      </a-camera>
    </a-entity>

    <!-- MAIN BOARD -->
    <a-entity id="boardRoot" position="0 1.55 -2.8">
      <a-plane width="2.7" height="1.75" color="#071627" opacity="0.96" material="shader: flat"></a-plane>
      <a-plane width="2.64" height="1.69" color="#0b1f35" opacity="0.96" position="0 0 0.002" material="shader: flat"></a-plane>

      <!-- top info -->
      <a-text id="boardTitle" value="Handwash VR" align="center" width="2.2" color="#eef8ff" position="0 0.77 0.01"></a-text>
      <a-text id="boardInstruction" value="กด “ใส่สบู่” เพื่อเริ่ม" align="center" width="2.45" color="#b7d6ea" position="0 0.64 0.01"></a-text>
      <a-text id="boardRemain" value="เหลืออีก 0" align="center" width="1.6" color="#bff5ff" position="0 0.50 0.01"></a-text>

      <!-- step list -->
      <a-text id="stepListLeft" value="" align="left" width="1.25" color="#dfefff" position="-1.24 0.26 0.01"></a-text>
      <a-text id="stepListRight" value="" align="left" width="1.25" color="#dfefff" position="0.18 0.26 0.01"></a-text>

      <!-- hand board -->
      <a-entity id="handBoard" position="0 -0.16 0.02">
        <!-- palm -->
        <a-plane width="0.56" height="0.62" color="#efc2a6" position="0 -0.12 0"></a-plane>

        <!-- fingers -->
        <a-plane width="0.13" height="0.48" color="#efc2a6" position="-0.22 0.21 0"></a-plane>
        <a-plane width="0.13" height="0.60" color="#efc2a6" position="-0.07 0.28 0"></a-plane>
        <a-plane width="0.13" height="0.62" color="#efc2a6" position="0.08 0.29 0"></a-plane>
        <a-plane width="0.13" height="0.50" color="#efc2a6" position="0.23 0.20 0"></a-plane>

        <!-- thumbs -->
        <a-circle radius="0.12" color="#e6b597" position="-0.33 -0.03 0.001"></a-circle>
        <a-circle radius="0.12" color="#e6b597" position="0.33 -0.03 0.001"></a-circle>

        <!-- wrist -->
        <a-plane width="0.20" height="0.20" color="#e2ab8c" position="0 -0.53 0"></a-plane>

        <!-- zones -->
        <a-plane id="zone-fingertips" class="clickable zone" width="0.62" height="0.12" position="0 0.58 0.01" opacity="0.15"></a-plane>
        <a-plane id="zone-betweenFingers" class="clickable zone" width="0.56" height="0.18" position="0 0.25 0.01" opacity="0.12"></a-plane>
        <a-plane id="zone-backFingers" class="clickable zone" width="0.48" height="0.12" position="0 0.08 0.01" opacity="0.12"></a-plane>

        <a-plane id="zone-backLeft" class="clickable zone" width="0.34" height="0.28" position="-0.33 0.06 0.01" opacity="0.12"></a-plane>
        <a-plane id="zone-backRight" class="clickable zone" width="0.34" height="0.28" position="0.33 0.06 0.01" opacity="0.12"></a-plane>

        <a-plane id="zone-palmLeft" class="clickable zone" width="0.34" height="0.30" position="-0.18 -0.12 0.01" opacity="0.15"></a-plane>
        <a-plane id="zone-palmRight" class="clickable zone" width="0.34" height="0.30" position="0.18 -0.12 0.01" opacity="0.15"></a-plane>

        <a-circle id="zone-thumbs" class="clickable zone" radius="0.16" position="-0.33 -0.03 0.01" opacity="0.14"></a-circle>
        <a-plane id="zone-wrists" class="clickable zone" width="0.28" height="0.14" position="0 -0.64 0.01" opacity="0.12"></a-plane>

        <!-- zone labels -->
        <a-text value="ปลายนิ้ว" align="center" width="0.7" color="#eef8ff" position="0 0.58 0.03"></a-text>
        <a-text value="ซอกนิ้ว" align="center" width="0.5" color="#eef8ff" position="0 0.25 0.03"></a-text>
        <a-text value="หลังนิ้ว" align="center" width="0.5" color="#eef8ff" position="0 0.08 0.03"></a-text>
        <a-text value="หลังมือซ้าย" align="center" width="0.6" color="#eef8ff" position="-0.33 0.06 0.03"></a-text>
        <a-text value="หลังมือขวา" align="center" width="0.6" color="#eef8ff" position="0.33 0.06 0.03"></a-text>
        <a-text value="ฝ่ามือซ้าย" align="center" width="0.6" color="#eef8ff" position="-0.18 -0.12 0.03"></a-text>
        <a-text value="ฝ่ามือขวา" align="center" width="0.6" color="#eef8ff" position="0.18 -0.12 0.03"></a-text>
        <a-text value="นิ้วโป้ง" align="center" width="0.5" color="#eef8ff" position="-0.33 -0.03 0.03"></a-text>
        <a-text value="ข้อมือ" align="center" width="0.4" color="#eef8ff" position="0 -0.64 0.03"></a-text>
      </a-entity>

      <!-- main buttons -->
      <a-entity id="actionButtons" position="0 -0.82 0.02">
        <a-plane id="btnSoap" class="clickable action-btn" width="0.52" height="0.14" color="#5ad5ff" position="-0.86 0 0"></a-plane>
        <a-text value="ใส่สบู่" align="center" width="0.9" color="#03263d" position="-0.86 0 0.02"></a-text>

        <a-plane id="btnRinse" class="clickable action-btn" width="0.52" height="0.14" color="#2b3c4b" position="-0.28 0 0"></a-plane>
        <a-text value="ล้างน้ำ" align="center" width="0.9" color="#dbeafe" position="-0.28 0 0.02"></a-text>

        <a-plane id="btnDry" class="clickable action-btn" width="0.52" height="0.14" color="#22363a" position="0.30 0 0"></a-plane>
        <a-text value="เช็ดมือ" align="center" width="0.9" color="#dbeafe" position="0.30 0 0.02"></a-text>

        <a-plane id="btnBackHub" class="clickable action-btn" width="0.52" height="0.14" color="#182432" position="0.88 0 0"></a-plane>
        <a-text value="กลับ HUB" align="center" width="0.9" color="#eef8ff" position="0.88 0 0.02"></a-text>
      </a-entity>

      <!-- summary -->
      <a-entity id="summaryPanel" visible="false" position="0 0.04 0.05">
        <a-plane width="2.3" height="1.3" color="#071627" opacity="0.98"></a-plane>
        <a-text id="summaryTitle" value="สรุปผล" align="center" width="2.0" color="#eef8ff" position="0 0.48 0.01"></a-text>
        <a-text id="summaryMain" value="" align="center" width="2.05" color="#bff5ff" position="0 0.24 0.01"></a-text>
        <a-text id="summarySub" value="" align="center" width="2.1" color="#b7d6ea" position="0 0.02 0.01"></a-text>
        <a-text id="summaryList" value="" align="left" width="1.9" color="#dfefff" position="-0.88 -0.22 0.01"></a-text>

        <a-plane id="btnReplay" class="clickable summary-btn" width="0.56" height="0.14" color="#22c55e" position="-0.58 -0.52 0.01"></a-plane>
        <a-text value="เล่นอีกครั้ง" align="center" width="0.95" color="#052e16" position="-0.58 -0.52 0.03"></a-text>

        <a-plane id="btnNext" class="clickable summary-btn" width="0.68" height="0.14" color="#5ad5ff" position="0.10 -0.52 0.01"></a-plane>
        <a-text value="ไป Germ Detective" align="center" width="1.15" color="#03263d" position="0.10 -0.52 0.03"></a-text>

        <a-plane id="btnSummaryHub" class="clickable summary-btn" width="0.54" height="0.14" color="#1b2a39" position="0.78 -0.52 0.01"></a-plane>
        <a-text value="กลับ HUB" align="center" width="0.92" color="#eef8ff" position="0.78 -0.52 0.03"></a-text>
      </a-entity>
    </a-entity>
  </a-scene>

  <script src="./handwash-vr.js?v=20260320a-vr-split"></script>
</body>
</html>