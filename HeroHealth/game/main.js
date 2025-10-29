<!doctype html>
<html lang="th" data-hha-mode="groups">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Hero Health Academy — Nutrition Mini-Games</title>
  <base href="./" />

  <!-- Minimal reset + layout so DOM-spawn items can be clicked everywhere -->
  <style>
    html,body{margin:0;padding:0;height:100%;background:#0b1220;color:#eaf2ff;font-family:ui-rounded,system-ui,-apple-system,Segoe UI,Roboto,Arial;}
    #app{position:fixed;inset:0;display:flex;flex-direction:column;}
    /* Gameplay layer (click area) */
    #gameLayer{position:relative;flex:1;min-height:60vh;overflow:hidden;touch-action:manipulation;}
    #spawnHost{position:absolute;inset:0;pointer-events:none;} /* children (buttons) re-enable pointer-events */
    /* HUD wrap */
    #hudWrap{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:8px;padding:10px 12px;z-index:95;pointer-events:none;}
    #hudWrap .pill{background:#0f172a;border:1px solid #24324d;color:#dbeafe;padding:6px 10px;border-radius:12px;font-weight:800;display:inline-flex;gap:8px;align-items:center;pointer-events:auto}
    #time,#score{font-weight:900}
    #missionChips{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;max-width:min(58vw,820px);pointer-events:auto}
    .chip{display:flex;align-items:center;gap:6px;background:#0e162b;border:1px solid #203155;border-radius:999px;padding:2px 6px}
    .chip .bar{width:62px;height:6px;border-radius:999px;background:#0b1b33;overflow:hidden}
    .chip .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6ee7ff,#22d3ee)}
    .chip.done{opacity:.75;box-shadow:0 0 0 2px #22c55e40 inset}
    #targetWrap{display:none;gap:8px;background:#12203d;border:1px solid #284b8a;color:#c1e9ff;padding:6px 10px;border-radius:12px}
    #targetBadge{font-weight:900}
    /* Coach bubble */
    #coachHUD{position:absolute;top:64px;left:0;right:0;display:flex;justify-content:center;z-index:96;pointer-events:none}
    #coachHUD .bubble{pointer-events:auto;background:#0f172a;border:1px solid #203155;color:#e2f0ff;padding:8px 12px;border-radius:12px;font-weight:900;box-shadow:0 6px 24px #0006;opacity:0;transform:translateY(-6px);transition:opacity .18s,transform .18s}
    #coachHUD.show .bubble{opacity:1;transform:none}
    /* Menubar (top-right) */
    #menuBar{position:absolute;right:10px;top:10px;display:flex;gap:6px;z-index:97}
    #menuBar button{all:unset;background:#0f172a;border:1px solid #203155;color:#eaf2ff;padding:8px 10px;border-radius:10px;cursor:pointer;font-weight:800}
    /* Result modal */
    #result{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:120}
    #result .card{background:#0b1220;border:1px solid #223156;border-radius:16px;min-width:280px;max-width:92vw;padding:16px 18px;box-shadow:0 12px 40px #000a}
    #result h2{margin:0 0 10px 0}
    #result .grid{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;margin:10px 0 14px}
    #result [data-actions]{display:flex;gap:10px;justify-content:flex-end}
    #result [data-actions] button{all:unset;background:#1d2a46;border:1px solid #2b4578;color:#eaf2ff;padding:8px 12px;border-radius:10px;font-weight:900;cursor:pointer}
    /* Help modal */
    #help{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:118}
    #help .card{background:#0b1220;border:1px solid #223156;border-radius:16px;width:min(680px,92vw);padding:16px 18px;color:#eaf2ff}
    #help pre{white-space:pre-wrap;background:#0f172a;border:1px solid #203155;border-radius:12px;padding:12px 14px}
    /* Mission/Toast lightweight */
    #missionLine{position:absolute;left:50%;top:52px;transform:translateX(-50%);background:#10213d;color:#c9ecff;border:1px solid #2a4b7f;border-radius:12px;padding:6px 10px;z-index:94;display:none;pointer-events:none}
    .toast{position:fixed;left:50%;top:18%;transform:translateX(-50%);background:#0f172a;border:1px solid #203155;border-radius:12px;color:#eaf2ff;padding:6px 10px;opacity:0;transition:opacity .18s;z-index:110}
    .toast.show{opacity:1}
    /* Hydration + Plate optional shells so modes can show inside safely */
    #plateTracker{position:absolute;left:12px;bottom:12px;z-index:93;display:none}
    #platePills{display:flex;flex-direction:column;gap:4px;pointer-events:none}
    #platePills .pill{display:flex;gap:8px;align-items:center;background:#0e162b;border:1px solid #223156;color:#e2f0ff;padding:4px 8px;border-radius:10px}
    #platePills .pill i{display:block;height:6px;background:#22d3ee;border-radius:999px}
    /* Danger flash */
    .flash-danger{animation:fd .18s ease}
    @keyframes fd{from{background:#3b0b0bb3}to{background:#0b1220}}
    /* Make sure canvas (if any) never blocks UI */
    #c{position:absolute;inset:0;pointer-events:none;z-index:1}
  </style>

  <!-- Mode-specific CSS (the updated groups.css you provided) -->
  <link rel="stylesheet" href="styles/groups.css" />
</head>
<body data-mode="groups">
  <div id="app">
    <!-- ===== Top HUD ===== -->
    <div id="hudWrap" class="hud">
      <div class="pill"><span>⏱</span><span id="time">45</span>s</div>
      <div class="pill"><span>★</span><span id="score">0</span></div>
      <div id="targetWrap" class="pill"><span id="targetBadge">—</span></div>
      <div id="missionChips"></div>
    </div>

    <!-- ===== Coach bubble ===== -->
    <div id="coachHUD" class="coach"><div class="bubble"><span id="coachText">Ready</span></div></div>

    <!-- ===== Menu bar (Start/Restart/Help/Lang/Sound) ===== -->
    <div id="menuBar">
      <button id="btn_start">▶ Start</button>
      <button id="btn_restart">↻ Restart</button>
      <button id="btn_help">❓ Help</button>
      <button id="langToggle">TH/EN</button>
      <button id="soundToggle">🔊</button>
    </div>

    <!-- ===== Gameplay area ===== -->
    <div id="gameLayer">
      <!-- if you render with <canvas>, keep id=c so ui.js can disable pointer-events -->
      <canvas id="c"></canvas>
      <div id="spawnHost"></div>

      <!-- Plate tracker shell (mode: plate) -->
      <div id="plateTracker">
        <div id="platePills"></div>
      </div>

      <!-- Mission line + toast -->
      <div id="missionLine"></div>
      <div id="targetWrap" style="display:none"><span id="targetBadge"></span></div>
    </div>
  </div>

  <!-- ===== Result modal ===== -->
  <div id="result" role="dialog" aria-modal="true">
    <div class="card">
      <h2 id="h_result">ผลการเล่น / Result</h2>
      <div class="grid">
        <div>คะแนน / Score</div><div><b data-field="score">0</b></div>
        <div>ดาว / Stars</div><div><b data-field="stars">—</b></div>
        <div>เกรด / Grade</div><div><b data-field="grade">—</b></div>
      </div>
      <div data-actions>
        <button data-result="replay">↻ เล่นอีกครั้ง / Replay</button>
        <button data-result="home">⌂ กลับเมนู / Home</button>
      </div>
    </div>
  </div>

  <!-- ===== Help modal (How to Play) ===== -->
  <div id="help" role="dialog" aria-modal="true">
    <div class="card">
      <h2 id="h_help">วิธีเล่น / How to Play</h2>
      <pre id="helpBody">Loading…</pre>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
        <button id="btn_ok" style="all:unset;background:#1d2a46;border:1px solid #2b4578;color:#eaf2ff;padding:8px 12px;border-radius:10px;font-weight:900;cursor:pointer">OK</button>
      </div>
    </div>
  </div>

  <!-- ===== Audio (SFX/BGM) — ids used by SFX/core ===== -->
  <audio id="bgm-main" loop preload="auto" src="assets/audio/bgm_main.mp3"></audio>
  <audio id="sfx-good" preload="auto" src="assets/audio/sfx_good.mp3"></audio>
  <audio id="sfx-bad" preload="auto" src="assets/audio/sfx_bad.mp3"></audio>
  <audio id="sfx-perfect" preload="auto" src="assets/audio/sfx_perfect.mp3"></audio>
  <audio id="sfx-tick" preload="auto" src="assets/audio/sfx_tick.mp3"></audio>
  <audio id="sfx-powerup" preload="auto" src="assets/audio/sfx_powerup.mp3"></audio>

  <!-- ===== Boot & UI (loads game/main.js via boot; ui wires buttons/tutorial) ===== -->
  <script type="module" src="game/boot.js"></script>
  <script type="module" src="game/ui.js"></script>

  <!-- ===== Safe autostart for quick test (optional; remove if menu controls it) ===== -->
  <script>
    // When page is ready, if no external UI drives start, wire a quick start
    window.addEventListener('DOMContentLoaded', ()=>{
      // If HHA.startGame is not ready yet, ui.js will call it after help/tutorial.
      // Button "Start" uses ui.js flow; this fallback ensures body data-mode matches default.
      document.body.setAttribute('data-mode','groups');
      document.documentElement.setAttribute('data-hha-mode','groups');
    });
  </script>
</body>
</html>
