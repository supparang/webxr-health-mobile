<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Rhythm Box · VR Fitness</title>

  <!-- ชี้ฐานพาธ (ให้ตรงกับโปรเจกต์ของคุณ) -->
  <meta name="asset-base" content="/webxr-health-mobile/vr-fitness">

  <!-- A-Frame -->
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js" crossorigin="anonymous"></script>

  <link rel="stylesheet" href="/webxr-health-mobile/vr-fitness/core/themes/sport-tech.css"/>
  <style>
    .shake-scene{ animation: shake .24s linear; }
    @keyframes shake { 25%{transform:translateX(2px)} 50%{transform:translateX(-2px)} 75%{transform:translateX(2px)}}
    #hud{position:fixed;left:8px;top:8px;background:rgba(0,0,0,.35);color:#e6f7ff;padding:6px 10px;border-radius:10px;font:600 13px system-ui;z-index:10}
    #results{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);color:#e6f7ff;z-index:20}
    .btn{padding:8px 12px;border:0;border-radius:10px;background:#0e2233;color:#e6f7ff;cursor:pointer}
    .card{background:#0b1118;border:1px solid #203446;border-radius:12px;padding:14px 16px}
  </style>
</head>
<body>
  <a-scene renderer="colorManagement: true">
    <a-entity id="arena" position="0 0 0"></a-entity>

    <!-- มือ (โหมดเดสก์ท็อปจะขยับตามเมาส์) -->
    <a-entity id="leftHand"  hand-speed position="-0.45 1.2 -1"></a-entity>
    <a-entity id="rightHand" hand-speed position="0.45 1.2 -1"></a-entity>

    <!-- พื้นหลัง -->
    <a-entity position="0 1.5 -3">
      <a-plane width="6" height="3" color="#0a0f14" opacity="0.65"></a-plane>
    </a-entity>

    <!-- Lanes -->
    <a-entity id="lanes" position="0 1.2 -2.2">
      <a-box position="-1 0 0" depth="0.02" height="0.02" width="1.6" color="#193344" opacity="0.7"></a-box>
      <a-box position="0 0 0"  depth="0.02" height="0.02" width="1.6" color="#193344" opacity="0.7"></a-box>
      <a-box position="1 0 0"  depth="0.02" height="0.02" width="1.6" color="#193344" opacity="0.7"></a-box>
    </a-entity>
  </a-scene>

  <!-- HUD -->
  <div id="hud">
    <div>Score: <span id="score">0</span></div>
    <div>Combo: <span id="combo">0</span> · <span id="phaseLabel">Track A</span></div>
    <div>Time: <span id="time">0</span>s</div>
  </div>

  <!-- ผลลัพธ์ -->
  <section id="results">
    <div class="card" style="min-width:300px">
      <h3 style="margin:0 0 8px">RESULTS</h3>
      <div style="margin-bottom:8px">Diff: <b id="rDiff">NORMAL</b> · Stars: <b id="rStars">☆☆☆</b></div>
      <div>Score: <b id="rScore">0</b></div>
      <div>Max Combo: <b id="rMaxCombo">0</b></div>
      <div>Accuracy: <b id="rAcc">0%</b></div>
      <div style="margin-top:10px; display:flex; gap:8px">
        <button class="btn" id="replayBtn">Replay</button>
        <button class="btn" id="backBtn">Back to Hub</button>
      </div>
    </div>
  </section>

  <!-- ปุ่มควบคุม -->
  <div style="position:fixed;bottom:12px;left:12px;display:flex;gap:8px;z-index:9999">
    <button class="btn" id="startBtn">Start</button>
    <button class="btn" id="pauseBtn">Pause</button>
  </div>

  <!-- ดรอปดาวน์เลือกระดับความยาก -->
  <div id="diffDock" style="
    position:fixed; right:12px; bottom:12px; z-index:9999;
    display:flex; align-items:center; gap:8px;
    background:rgba(10,16,24,.75); backdrop-filter:saturate(1.1) blur(4px);
    border:1px solid rgba(255,255,255,.08); border-radius:12px;
    padding:8px 10px; color:#e6f7ff; font:600 12px system-ui;">
    <label for="diffSel" style="opacity:.9; letter-spacing:.3px;">Difficulty</label>
    <select id="diffSel" style="
      appearance:none; background:#0e2233; color:#e6f7ff;
      border:1px solid rgba(255,255,255,.12); border-radius:10px;
      padding:6px 28px 6px 10px; font:600 12px system-ui; cursor:pointer;">
      <option value="easy">Easy</option>
      <option value="normal" selected>Normal</option>
      <option value="hard">Hard</option>
      <option value="final">Final</option>
    </select>
    <span aria-hidden="true" style="margin-left:-22px; pointer-events:none;">▼</span>
  </div>

  <!-- ปุ่ม Enter VR ตรงกลางล่าง -->
  <button id="enterVRBtn" style="
    position:fixed; left:50%; transform:translateX(-50%);
    bottom:12px; z-index:9999; padding:8px 12px;
    border-radius:10px; border:0; background:#0e2233; color:#e6f7ff; cursor:pointer">Enter VR</button>

  <!-- Core (ถ้ามีใช้งาน) -->
  <script src="/webxr-health-mobile/vr-fitness/core/i18n.js" defer></script>
  <script src="/webxr-health-mobile/vr-fitness/core/audio.js" defer></script>
  <script src="/webxr-health-mobile/vr-fitness/core/engine.js" defer></script>
  <script src="/webxr-health-mobile/vr-fitness/core/ui.js" defer></script>
  <script src="/webxr-health-mobile/vr-fitness/core/leaderboard.js" defer></script>

  <!-- เกม -->
  <script src="/webxr-health-mobile/vr-fitness/games/rhythm-box/game.js" defer></script>

  <!-- Diff dropdown sync -->
  <script>
    (function(){
      const getQ = k => new URLSearchParams(location.search).get(k);
      const DIFF_KEYS = {easy:1,normal:1,hard:1,final:1};
      const cur = getQ('diff') || localStorage.getItem('rb_diff') || 'normal';
      const sel = document.getElementById('diffSel');
      sel.value = DIFF_KEYS[cur] ? cur : 'normal';
      sel.addEventListener('change', e => {
        const v = e.target.value;
        try{ localStorage.setItem('rb_diff', v); }catch(_){}
        const url = new URL(location.href);
        url.searchParams.set('diff', v);
        location.href = url.pathname + '?' + url.searchParams.toString();
      }, {passive:true});
    })();
  </script>

  <!-- SFX quick test -->
  <button id="sfxTest" style="position:fixed; left:12px; bottom:52px; z-index:9999;">🔊 Test SFX</button>
  <script>
    document.getElementById('sfxTest').addEventListener('click', ()=>{ try{ SFX?.hit?.play(); }catch(e){} });
    document.getElementById('enterVRBtn').addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(e){} });
    document.getElementById('backBtn')?.addEventListener('click', ()=>{ location.href = '/webxr-health-mobile/vr-fitness/'; });
  </script>
</body>
</html>
