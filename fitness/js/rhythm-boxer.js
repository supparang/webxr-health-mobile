<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>VR Fitness — Rhythm Boxer</title>
  <meta name="color-scheme" content="dark light"/>
  <link rel="icon" href="favicon.ico"/>
  <link rel="stylesheet" href="css/rhythm-boxer.css"/>

  <!-- ✅ HHA Planner Bridge HUD (safe, light) -->
  <style>
    #hhHud{
      position:fixed; left:10px; right:10px; top:10px; z-index:9999;
      display:flex; gap:8px; align-items:center; justify-content:space-between;
      pointer-events:none;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    }
    .hhPill{
      pointer-events:auto;
      border:1px solid rgba(255,255,255,.18);
      background:rgba(0,0,0,.55);
      color:#e8eefc;
      padding:8px 10px;
      border-radius:999px;
      font-weight:900;
      backdrop-filter: blur(6px);
      max-width: 70vw;
      overflow:hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .hhBtn{
      pointer-events:auto;
      border:1px solid rgba(255,255,255,.18);
      background:rgba(255,255,255,.08);
      color:#e8eefc;
      padding:8px 12px;
      border-radius:14px;
      font-weight:1000;
      cursor:pointer;
    }
    .hhBtn:active{ transform: translateY(1px); }
    .hhTiny{ opacity:.85; font-weight:800; }
  </style>
</head>

<body>
<!-- ✅ Overlay HUD: shows plan day/slot and provides back -->
<div id="hhHud" aria-hidden="false">
  <div class="hhPill">
    Rhythm 🥊
    <span class="hhTiny">· day <b id="hhDay">—</b> · slot <b id="hhSlot">—</b></span>
  </div>
  <button class="hhBtn" id="hhBack" type="button">⬅ กลับ</button>
</div>

<div id="rb-wrap" data-diff="normal">
  <div id="rb-flash"></div>

  <!-- ===== VIEW: MENU ===== -->
  <main id="rb-view-menu" class="rb-view">
    <header class="rb-header">
      <div class="rb-head-main">
        <span class="rb-pill">VR Fitness · Rhythm</span>
        <h1 class="rb-title">Rhythm Boxer</h1>
        <p class="rb-sub">ต่อยมือตามโน้ตให้ตรงจังหวะ · ฝึกสมาธิ + การตอบสนอง · รองรับโหมดวิจัยเก็บ CSV</p>
        <span class="rb-sub-small">Tip: เริ่ม Easy 1–2 รอบก่อน แล้วค่อย Research</span>
      </div>

      <!-- ✅ dynamic hub/back (patched by script at bottom) -->
      <a href="hub.html" class="rb-back" id="rb-back-link">← กลับ</a>
    </header>

    <section class="rb-section rb-grid-2">
      <div class="rb-research-box">
        <h2 class="rb-section-title">โหมดการเล่น</h2>

        <div class="rb-mode-toggle" role="radiogroup" aria-label="mode">
          <label class="rb-mode-btn">
            <input type="radio" name="rb-mode" value="normal" checked/>
            <span>Normal</span>
          </label>
          <label class="rb-mode-btn">
            <input type="radio" name="rb-mode" value="research"/>
            <span>Research</span>
          </label>
        </div>

        <p id="rb-mode-desc" class="rb-mode-desc">Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)</p>

        <div id="rb-research-fields" class="rb-section hidden">
          <h3 class="rb-section-subtitle">ข้อมูลสำหรับงานวิจัย</h3>

          <div class="rb-field">
            <label for="rb-participant">Participant ID</label>
            <input id="rb-participant" type="text" placeholder="เช่น P001, S05 ฯลฯ"/>
          </div>
          <div class="rb-field">
            <label for="rb-group">กลุ่ม / เงื่อนไข</label>
            <input id="rb-group" type="text" placeholder="เช่น Control, VR-High, L/R-Swap"/>
          </div>
          <div class="rb-field">
            <label for="rb-note">โน้ตเพิ่มเติม</label>
            <input id="rb-note" type="text" placeholder="เช่น รอบก่อนฝึก, หลังฝึก, เวลาเล่น ฯลฯ"/>
          </div>

          <p class="rb-hint-inline">
            Research จะบันทึก Event CSV + Session CSV (offset, side, FEVER, HP) เพื่อใช้วิเคราะห์เชิงสถิติ
          </p>
        </div>
      </div>

      <div class="rb-research-box">
        <h2 class="rb-section-title">เพลง / ระดับ</h2>
        <p id="rb-track-mode-label" class="rb-section-subtitle">โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก</p>

        <div id="rb-track-options" class="rb-section">
          <label class="rb-mode-btn" data-mode="normal">
            <input type="radio" name="rb-track" value="n1" checked/>
            <span>Warm-up Groove · ง่าย · 100 BPM</span>
          </label>
          <label class="rb-mode-btn" data-mode="normal">
            <input type="radio" name="rb-track" value="n2"/>
            <span>Focus Combo · ปกติ · 120 BPM</span>
          </label>
          <label class="rb-mode-btn" data-mode="normal">
            <input type="radio" name="rb-track" value="n3"/>
            <span>Speed Rush · ยาก · 140 BPM</span>
          </label>

          <label class="rb-mode-btn" data-mode="research">
            <input type="radio" name="rb-track" value="r1"/>
            <span>Research Track 120 · ทดลอง · 120 BPM</span>
          </label>
        </div>

        <div class="rb-hint-block">
          <p class="rb-hint-title">วิธีเล่น</p>
          <ul class="rb-hint-list">
            <li>แตะเลน (L2, L1, C, R1, R2) ให้โน้ตตรงเส้นตีด้านล่าง</li>
            <li>Perfect / Great / Good เพิ่ม FEVER; Miss ลด HP</li>
            <li>กดพลาด (blank tap) จะโดนหักเล็กน้อยเพื่อกัน “กดรัว”</li>
            <li>คีย์บอร์ด (PC): A S D J K</li>
          </ul>
        </div>

        <div class="rb-section">
          <button id="rb-btn-start" class="rb-btn rb-btn-primary">▶ เริ่มเล่น Rhythm Boxer</button>
        </div>
      </div>
    </section>
  </main>

  <!-- ===== VIEW: PLAY ===== -->
  <main id="rb-view-play" class="rb-view hidden">
    <header class="rb-play-header">
      <div>
        <h1 class="rb-title-sm">Rhythm Boxer · Play</h1>
        <p class="rb-sub-sm">แตะเลนให้ตรงจังหวะ · เส้นตีสีเหลืองอยู่ด้านล่าง · ดู FEVER / ACC / HP</p>
      </div>
      <button id="rb-btn-stop" class="rb-btn rb-btn-ghost">⏹ หยุดก่อนเวลา</button>
    </header>

    <section class="rb-research-box rb-hud">
      <div class="rb-hud-row">
        <span class="rb-chip">Mode: <b id="rb-hud-mode">Normal</b></span>
        <span class="rb-chip">Track: <b id="rb-hud-track">Warm-up Groove</b></span>
      </div>

      <div class="rb-hud-row">
        <span class="rb-chip">Score: <b id="rb-hud-score">0</b></span>
        <span class="rb-chip">Combo: <b id="rb-hud-combo">0</b></span>
        <span class="rb-chip">Acc: <b id="rb-hud-acc">0.0%</b></span>
      </div>

      <div class="rb-hud-row rb-hud-row-ai">
        <span class="rb-chip rb-chip-ai">AI Fatigue: <b id="rb-hud-ai-fatigue">0%</b></span>
        <span class="rb-chip rb-chip-ai">AI Skill: <b id="rb-hud-ai-skill">50%</b></span>
        <span class="rb-chip rb-chip-ai">Suggest: <b id="rb-hud-ai-suggest">normal</b></span>
      </div>

      <div class="rb-hud-row rb-hud-row-ai">
        <span class="rb-chip rb-chip-ai rb-chip-tip">
          <span class="rb-chip-tip-label">Coach:</span>
          <b id="rb-hud-ai-tip" class="hidden"></b>
        </span>
      </div>

      <div class="rb-hud-row">
        <span class="rb-chip">HP: <b id="rb-hud-hp">100</b></span>
        <span class="rb-chip">Shield: <b id="rb-hud-shield">0</b></span>
        <span class="rb-chip">Time: <b id="rb-hud-time">0.0</b></span>
      </div>

      <div class="rb-hud-row rb-hud-judge-row">
        <span class="rb-chip">Perfect: <b id="rb-hud-perfect">0</b></span>
        <span class="rb-chip">Great: <b id="rb-hud-great">0</b></span>
        <span class="rb-chip">Good: <b id="rb-hud-good">0</b></span>
        <span class="rb-chip">Miss: <b id="rb-hud-miss">0</b></span>
      </div>

      <div class="rb-bars">
        <div class="rb-bar-block">
          <span class="rb-bar-label">FEVER</span>
          <div class="rb-bar"><div id="rb-fever-fill" class="rb-bar-fill rb-bar-fever"></div></div>
          <span id="rb-fever-status" class="rb-bar-status">READY</span>
        </div>
        <div class="rb-bar-block">
          <span class="rb-bar-label">PROG</span>
          <div class="rb-bar"><div id="rb-progress-fill" class="rb-bar-fill rb-bar-progress"></div></div>
          <span id="rb-progress-text" class="rb-bar-status">0%</span>
        </div>
      </div>
    </section>

    <section class="rb-field-wrap">
      <div id="rb-field">
        <div id="rb-feedback" class="rb-feedback">พร้อม!</div>

        <div class="rb-lanes" id="rb-lanes">
          <div class="rb-lane" data-lane="0"><div class="rb-lane-label">L2</div></div>
          <div class="rb-lane" data-lane="1"><div class="rb-lane-label">L1</div></div>
          <div class="rb-lane" data-lane="2"><div class="rb-lane-label">C</div></div>
          <div class="rb-lane" data-lane="3"><div class="rb-lane-label">R1</div></div>
          <div class="rb-lane" data-lane="4"><div class="rb-lane-label">R2</div></div>
        </div>
      </div>

      <p class="rb-howto-inline">
        แตะเลนให้ “หัวโน้ต” ลงมาถึงเส้นตีสีเหลืองด้านล่างแล้วค่อยกด · ใช้ได้ทั้งจอสัมผัสและเมาส์
      </p>
    </section>

    <audio id="rb-audio" preload="auto"></audio>
  </main>

  <!-- ===== VIEW: RESULT ===== -->
  <main id="rb-view-result" class="rb-view hidden">
    <header class="rb-header">
      <div class="rb-head-main">
        <span class="rb-pill">Result</span>
        <h1 class="rb-title">สรุปผล · Rhythm Boxer</h1>
        <p class="rb-sub">ใช้ตารางนี้สำหรับบันทึกคะแนน / วิเคราะห์ภายหลัง</p>
      </div>
    </header>

    <section class="rb-result-grid">
      <div class="rb-result-card">
        <h2 class="rb-result-title">Overview</h2>
        <div class="rb-result-row"><span>Mode</span><b id="rb-res-mode">-</b></div>
        <div class="rb-result-row"><span>Track</span><b id="rb-res-track">-</b></div>
        <div class="rb-result-row"><span>End reason</span><b id="rb-res-endreason">-</b></div>
        <div class="rb-result-row"><span>Score</span><b id="rb-res-score">0</b></div>
        <div class="rb-result-row"><span>Max Combo</span><b id="rb-res-maxcombo">0</b></div>
        <div class="rb-result-row"><span>Hit P/G/Gd/Miss</span><b id="rb-res-detail-hit">0 / 0 / 0 / 0</b></div>
        <div class="rb-result-row"><span>Accuracy</span><b id="rb-res-acc">0.0 %</b></div>
        <div class="rb-result-row"><span>Duration</span><b id="rb-res-duration">0.0 s</b></div>
        <div class="rb-result-row"><span>Rank</span><b id="rb-res-rank">-</b></div>
      </div>

      <div class="rb-result-card">
        <h2 class="rb-result-title">Timing / Research</h2>
        <div class="rb-result-row"><span>Offset mean</span><b id="rb-res-offset-avg">-</b></div>
        <div class="rb-result-row"><span>Offset std</span><b id="rb-res-offset-std">-</b></div>
        <div class="rb-result-row"><span>Participant</span><b id="rb-res-participant">-</b></div>
      </div>
    </section>

    <p id="rb-res-quality-note" class="rb-quality-note hidden"></p>

    <section class="rb-section rb-btn-row">
      <button id="rb-btn-again" class="rb-btn rb-btn-primary">🔁 เล่นเพลงเดิมอีกครั้ง</button>
      <button id="rb-btn-back-menu" class="rb-btn">⬅ กลับหน้าเลือกโหมด</button>

      <!-- ✅ New: return to planner/hub explicitly -->
      <button id="rb-btn-return-plan" class="rb-btn rb-btn-ghost">✅ กลับตามแผน</button>
    </section>

    <section class="rb-research-box rb-section">
      <h2 class="rb-section-title-sm">ดาวน์โหลด CSV สำหรับงานวิจัย</h2>
      <p class="rb-hint-inline">Event CSV: การกดแต่ละครั้ง · Session CSV: สรุป 1 แถวต่อการเล่น 1 รอบ</p>
      <div class="rb-btn-row">
        <button id="rb-btn-dl-events" class="rb-btn rb-btn-sm">⬇ Event CSV</button>
        <button id="rb-btn-dl-sessions" class="rb-btn rb-btn-sm">⬇ Session CSV</button>
      </div>
    </section>
  </main>
</div>

<script src="js/ai-predictor.js"></script>
<script src="js/dom-renderer-rhythm.js"></script>
<script src="js/rhythm-engine.js"></script>
<script src="js/rhythm-boxer.js"></script>

<!-- ✅ HHA Planner Bridge (MUST be after main scripts so it can observe DOM safely) -->
<script>
(function(){
  function qs(k,d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
  function abs(u){ try{ return new URL(u, location.href).toString(); }catch(e){ return String(u||''); } }

  // 1) hub / planner back
  var hub = String(qs('hub','')).trim();
  var backUrl = hub ? abs(hub) : '';

  // patch menu back link
  var backLink = document.getElementById('rb-back-link');
  if(backLink){
    backLink.href = backUrl || 'hub.html';
    backLink.addEventListener('click', function(e){
      if(backUrl){
        e.preventDefault();
        location.href = backUrl;
      }
    }, {passive:false});
  }

  // 2) show plan HUD day/slot (Mon0)
  var day = qs('planDay','—');
  var slot = qs('planSlot','—');
  var elDay = document.getElementById('hhDay');
  var elSlot = document.getElementById('hhSlot');
  if(elDay) elDay.textContent = day;
  if(elSlot) elSlot.textContent = slot;

  // 3) Back button behavior (always safe)
  var btnBack = document.getElementById('hhBack');
  if(btnBack){
    btnBack.addEventListener('click', function(){
      if(backUrl) location.href = backUrl;
      else history.back();
    });
  }

  // 4) Universal end hook — rhythm-boxer.js SHOULD call this at end
  //    But we also "detect Result view" and auto-return when coming from planner seq flow.
  window.HH_END_GAME = function(reason, payload){
    reason = String(reason||'end');
    payload = payload || {};

    if(backUrl){
      try{
        var u = new URL(backUrl);
        u.searchParams.set('reason', reason);

        // optional telemetry to planner (light)
        if(payload && typeof payload === 'object'){
          if(payload.score!=null) u.searchParams.set('score', String(payload.score));
          if(payload.acc!=null) u.searchParams.set('acc', String(payload.acc));
          if(payload.miss!=null) u.searchParams.set('miss', String(payload.miss));
        }
        location.href = u.toString();
        return;
      }catch(_){}
    }
    // fallback
    alert('จบเกมแล้ว!');
  };

  // 5) Result view "Return to plan" button
  var btnReturn = document.getElementById('rb-btn-return-plan');
  if(btnReturn){
    btnReturn.addEventListener('click', function(){
      // gather some values if present
      var score = document.getElementById('rb-res-score') ? document.getElementById('rb-res-score').textContent : '';
      var acc   = document.getElementById('rb-res-acc') ? document.getElementById('rb-res-acc').textContent : '';
      var miss  = document.getElementById('rb-hud-miss') ? document.getElementById('rb-hud-miss').textContent : '';
      window.HH_END_GAME('result', { score: score, acc: acc, miss: miss });
    });
  }

  // 6) Stop button -> end early -> return
  var btnStop = document.getElementById('rb-btn-stop');
  if(btnStop){
    btnStop.addEventListener('click', function(){
      // let original stop run first (if any), then return
      setTimeout(function(){
        window.HH_END_GAME('stop');
      }, 120);
    });
  }

  // 7) Auto-return when:
  //    - hub contains seq=1 (planner auto-next flow) OR hub points to fitness-planner
  //    - and Result view becomes visible
  var autoReturn = false;
  if(backUrl){
    autoReturn = (backUrl.indexOf('seq=1')>=0) || (backUrl.indexOf('fitness-planner')>=0) || (qs('autoNext','0')==='1');
  }

  function isHidden(el){
    if(!el) return true;
    return el.classList.contains('hidden') || el.hasAttribute('hidden');
  }

  var resView = document.getElementById('rb-view-result');
  if(resView && autoReturn){
    var fired = false;
    var obs = new MutationObserver(function(){
      if(fired) return;
      if(!isHidden(resView)){
        fired = true;
        // short delay so DOM writes settle
        setTimeout(function(){
          // If user is in research and might want CSV, we only auto-return when seq flow is explicit
          var strictSeq = (backUrl.indexOf('seq=1')>=0);
          if(!strictSeq) return;

          var score = document.getElementById('rb-res-score') ? document.getElementById('rb-res-score').textContent : '';
          var acc   = document.getElementById('rb-res-acc') ? document.getElementById('rb-res-acc').textContent : '';
          var miss  = document.getElementById('rb-hud-miss') ? document.getElementById('rb-hud-miss').textContent : '';
          window.HH_END_GAME('auto', { score: score, acc: acc, miss: miss });
        }, 900);
      }
    });
    obs.observe(resView, { attributes:true, attributeFilter:['class','hidden'] });
  }
})();
</script>

</body>
</html>