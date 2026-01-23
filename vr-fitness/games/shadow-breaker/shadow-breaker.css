/* === vr-fitness/games/shadow-breaker/shadow-breaker.css ===
Shadow Breaker — Production CSS
✅ Safe top zone (HUD + Boss bar)
✅ Targets never blocked by HUD (HUD pointer-events:none)
✅ Feedback animations (perfect/good/miss/fever)
✅ Fever glow
✅ Mobile/VR friendly tap size
✅ End overlay (result)
*/

:root{
  color-scheme: dark;

  --bg:#020617;
  --panel:rgba(2,6,23,.76);
  --panel2:rgba(15,23,42,.70);
  --stroke:rgba(148,163,184,.18);
  --stroke2:rgba(148,163,184,.28);
  --text:#e5e7eb;
  --muted:#94a3b8;

  --accent:#22c55e;
  --cyan:#22d3ee;
  --violet:#a78bfa;
  --warn:#f59e0b;
  --bad:#ef4444;

  --radius:18px;
  --radius2:22px;
  --pill:999px;

  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);

  /* IMPORTANT: top safe zone to keep targets away from HUD + boss bar */
  --safe-top: calc(var(--sat) + 118px);

  /* z-index layers */
  --z-game: 10;
  --z-hud: 50;
  --z-boss: 60;
  --z-feedback: 80;
  --z-overlay: 100;

  /* tap size */
  --tap: 44px;
}

*{ box-sizing:border-box; }
html,body{ height:100%; }

body{
  margin:0;
  min-height:100vh;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
  background:
    radial-gradient(circle at top left,rgba(56,189,248,.18),transparent 55%),
    radial-gradient(circle at bottom right,rgba(34,197,94,.20),transparent 55%),
    var(--bg);
  color:var(--text);
}

/* page container */
.page{
  max-width:960px;
  margin:0 auto;
  padding: calc(var(--sat) + 12px) calc(var(--sar) + 10px) calc(var(--sab) + 24px) calc(var(--sal) + 10px);
}

/* ---------- Card ---------- */
.card{
  border-radius:var(--radius);
  border:1px solid rgba(148,163,184,.55);
  background:
    radial-gradient(circle at top left,rgba(56,189,248,.12),transparent 55%),
    rgba(15,23,42,.96);
  box-shadow:0 20px 55px rgba(15,23,42,.90);
  padding:14px 14px 12px;
  margin-bottom:10px;
}

/* header (research) */
.card-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  margin-bottom:8px;
}
.card-header .title{ display:flex; gap:8px; }
.card-header .icon{
  width:30px;height:30px;border-radius:999px;
  background:rgba(56,189,248,.18);
  display:flex;align-items:center;justify-content:center;
  font-size:18px;
}
.card-header h1{ margin:0; font-size:.98rem; }
.card-header p{ margin:2px 0 0; font-size:.70rem; color:#9ca3af; }

/* lang toggle */
.lang-toggle{ display:flex; gap:4px; }
.lang-btn{
  padding:4px 9px;
  border-radius:var(--pill);
  border:1px solid #1f2937;
  background:#020617;
  color:var(--text);
  font-size:.70rem;
  cursor:pointer;
  min-width:40px;
}
.lang-btn.active{
  background:#38bdf8;
  color:#0b1120;
  border-color:#38bdf8;
  font-weight:800;
}

/* research form grid */
.research-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px 10px;
  margin-top:4px;
}
.research-grid label{
  display:flex;
  flex-direction:column;
  gap:2px;
  font-size:.72rem;
}
.research-grid span{ color:#94a3b8; }
.research-grid input,
.research-grid select{
  border-radius:var(--pill);
  border:1px solid #1e293b;
  padding:7px 10px;
  font-size:.80rem;
  background:rgba(15,23,42,.96);
  color:var(--text);
  outline:none;
}
.research-grid input::placeholder{ color:#64748b; }

.hint{ margin-top:4px; font-size:.70rem; color:#6b7280; }
.hint.small{ font-size:.65rem; }

/* ---------- Game card ---------- */
.game-card{ padding-top:12px; }

/* HUD */
.hud{
  position: sticky;
  top: calc(var(--sat) + 10px);
  z-index: var(--z-hud);

  background:rgba(15,23,42,.95);
  border:1px solid rgba(148,163,184,.45);
  border-radius:14px;
  padding:6px 8px;

  display:flex;
  flex-wrap:wrap;
  gap:6px;
  justify-content:space-between;
  align-items:center;
  font-size:.80rem;

  /* IMPORTANT: don't block targets */
  pointer-events:none;
}
.hud-block{
  min-width:72px;
  padding:4px 8px;
  border-radius:10px;
  border:1px solid #1e293b;
  background:radial-gradient(circle at top,rgba(15,23,42,.96),rgba(15,23,42,.90));
  text-align:center;
  pointer-events:none;
}
.hud-block .label{ display:block; font-size:.62rem; color:#9ca3af; }
.hud-block .value{ font-size:.90rem; font-weight:900; }

.start-row{
  margin:8px 0 4px;
  display:flex;
  justify-content:center;
}
.btn{
  border:none;
  border-radius:var(--pill);
  padding:8px 16px;
  font-size:.85rem;
  font-weight:900;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
}
.btn-main{
  background:linear-gradient(135deg,#facc15,#f97316);
  color:#020617;
  box-shadow:0 14px 30px rgba(248,181,0,.55);
}
.btn-secondary{
  background:rgba(15,23,42,1);
  border:1px solid rgba(148,163,184,.70);
  color:var(--text);
}
.btn-full{ width:100%; }

.goal-text{ margin:0 2px 6px; }

/* ---------- Game panel ---------- */
.game-panel{
  position:relative;
  border-radius:16px;
  border:1px solid rgba(148,163,184,.45);
  background:#020617;
  overflow:hidden;
  min-height:360px;
}

/* main play area */
#gameArea{
  position:absolute;
  inset:0;
  overflow:hidden;
  isolation:isolate;

  /* keep targets away from top HUD zone */
  padding-top: var(--safe-top);
}

/* subtle vignette */
#gameArea::before{
  content:"";
  position:absolute;
  inset:-2px;
  pointer-events:none;
  background:
    radial-gradient(900px 600px at 50% 35%, transparent 0%, rgba(2,6,23,.55) 70%),
    radial-gradient(1200px 900px at 50% 120%, rgba(2,6,23,.85), rgba(2,6,23,1));
  opacity:.90;
  z-index:0;
}

/* ---------- Targets ---------- */
.sb-target{
  position:absolute;
  z-index: var(--z-game);
  user-select:none;
  -webkit-tap-highlight-color: transparent;

  min-width: var(--tap);
  min-height: var(--tap);

  border-radius:999px;
  display:flex;
  justify-content:center;
  align-items:center;

  font-size:2rem;
  color:#e5f2ff;

  border: 1px solid rgba(255,255,255,.14);
  box-shadow:
    0 14px 40px rgba(0,0,0,.35),
    0 0 0 2px rgba(34,211,238,.06) inset;

  cursor:pointer;
  transition: transform .12s ease-out, opacity .12s ease-out;
  transform: translateZ(0);
  will-change: transform, opacity;

  /* glow */
  filter: drop-shadow(0 0 14px rgba(34,211,238,.12));
}
.sb-target:active{ transform: scale(.96); }

@media (hover:hover){
  .sb-target:hover{ filter: drop-shadow(0 0 20px rgba(34,211,238,.20)); }
}

/* boss final (optional class) */
.sb-target.boss-final{
  width:min(190px,42vw) !important;
  height:min(190px,42vw) !important;
  font-size:min(4.2rem,12vw);
  box-shadow:0 0 40px rgba(250,204,21,.80),0 0 0 3px rgba(248,250,252,.90);
  background:radial-gradient(circle at 30% 20%,#fde68a,#f97316,#7c2d12);
}

/* Fever glow */
#gameArea.fever{
  box-shadow:0 0 40px rgba(250,204,21,.70);
  outline:2px solid rgba(250,204,21,.50);
}
#gameArea.fever .sb-target{
  filter: drop-shadow(0 0 18px rgba(250,204,21,.20));
  box-shadow:
    0 16px 50px rgba(0,0,0,.42),
    0 0 0 2px rgba(250,204,21,.10) inset;
}

/* ---------- Coach + controls ---------- */
.coach{
  margin:8px 2px 4px;
  font-size:.85rem;
  color:#cbd5f5;
}
.controls{
  margin-top:6px;
  border-radius:12px;
  border:1px dashed rgba(148,163,184,.40);
  padding:8px 10px;
  background:rgba(15,23,42,.70);
}
.controls h2{ margin:0 0 4px; font-size:.90rem; }
.controls ul{ margin:0 0 4px 16px; padding:0; font-size:.78rem; }
.controls li{ margin-bottom:2px; }

/* ---------- Boss HUD (created by JS) ---------- */
.boss-barbox{
  position:absolute;
  top: calc(var(--sat) + 6px);
  left: calc(var(--sal) + 10px);

  padding:6px 10px;
  border-radius:12px;
  border:1px solid rgba(250,204,21,.25);
  background:rgba(15,23,42,.82);

  font-size:.75rem;
  display:flex;
  align-items:center;
  gap:10px;

  z-index: var(--z-boss);

  /* IMPORTANT: never block targets */
  pointer-events:none;
}
.boss-face{
  width:34px;height:34px;
  border-radius:12px;
  display:flex;align-items:center;justify-content:center;
  background: radial-gradient(circle at 30% 20%, rgba(250,204,21,.35), rgba(234,88,12,.25));
  border:1px solid rgba(250,204,21,.22);
  font-size:1.2rem;
}
.boss-name{
  font-weight:900;
  letter-spacing:.2px;
  margin-bottom:4px;
  color:#fde68a;
}
.boss-bar{
  width:140px;
  height:8px;
  background:rgba(148,163,184,.12);
  border:1px solid rgba(148,163,184,.20);
  border-radius:var(--pill);
  overflow:hidden;
}
.boss-bar-fill{
  width:100%;height:100%;
  background: linear-gradient(90deg, rgba(250,204,21,.85), rgba(234,88,12,.85));
  transform-origin:left center;
}

/* ---------- Feedback (center) ---------- */
.feedback{
  position:absolute;
  left:50%; top:50%;
  transform:translate(-50%,-50%);
  z-index: var(--z-feedback);

  padding:10px 16px;
  border-radius:var(--pill);
  font-weight:1000;
  letter-spacing:.4px;
  font-size: clamp(18px, 2.4vw, 28px);

  background: rgba(2,6,23,.55);
  border: 1px solid rgba(148,163,184,.18);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 70px rgba(0,0,0,.55);

  pointer-events:none;
  opacity:0;
  display:none;
}
.feedback.show{
  display:block;
  animation: sbPop .42s ease-out forwards;
}
@keyframes sbPop{
  0%{ opacity:0; transform: translate(-50%,-56%) scale(.84); }
  60%{ opacity:1; transform: translate(-50%,-50%) scale(1.05); }
  100%{ opacity:1; transform: translate(-50%,-50%) scale(1); }
}

/* mapped variants (JS sets className = 'feedback ' + type) */
.feedback.perfect,
.feedback.feedback-perfect{ border-color: rgba(34,197,94,.28); color:#4ade80; box-shadow: 0 18px 70px rgba(34,197,94,.12); }
.feedback.good,
.feedback.feedback-good{ border-color: rgba(34,211,238,.28); color:#38bdf8; box-shadow: 0 18px 70px rgba(34,211,238,.12); }
.feedback.miss,
.feedback.feedback-miss{ border-color: rgba(239,68,68,.28);  color:#f97373; box-shadow: 0 18px 70px rgba(239,68,68,.10); }
.feedback.fever,
.feedback.feedback-fever{
  border-color: rgba(250,204,21,.30);
  color:#facc15;
  box-shadow: 0 20px 90px rgba(250,204,21,.14);
  animation: sbFever .80s ease-out forwards;
}
@keyframes sbFever{
  0%{ opacity:0; transform: translate(-50%,-58%) scale(.80); filter: blur(.3px); }
  40%{ opacity:1; transform: translate(-50%,-50%) scale(1.10); filter: blur(0); }
  100%{ opacity:1; transform: translate(-50%,-50%) scale(1.00); }
}

/* ---------- Result overlay ---------- */
.hidden{ display:none !important; }

.overlay{
  position:fixed;
  inset:0;
  z-index: var(--z-overlay);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: calc(var(--sat) + 18px) calc(var(--sar) + 18px) calc(var(--sab) + 18px) calc(var(--sal) + 18px);

  background: rgba(2,6,23,.68);
  backdrop-filter: blur(10px);
}
.overlay-box{
  width:min(620px, 92vw);
  background: rgba(2,6,23,.88);
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 28px;
  box-shadow: 0 22px 90px rgba(0,0,0,.55);
  padding: 18px 16px;
}
.overlay-box h2{
  margin:0 0 10px;
  font-size:1.05rem;
}

.result-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:6px 10px;
  font-size:.80rem;
}
.result-grid .label{
  display:block;
  font-size:.70rem;
  color:#9ca3af;
}
.result-grid .value{
  display:block;
  font-size:.95rem;
  font-weight:1000;
}
.overlay-actions{
  margin-top:10px;
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

hr{
  border:none;
  height:1px;
  background: rgba(148,163,184,.18);
  margin:10px 0;
}

/* ---------- Play-only focus (JS adds .play-only) ---------- */
body.play-only .research-card{ display:none; }
body.play-only .controls{ display:none; }
body.play-only .page{ max-width:780px; }
body.play-only .game-panel{ min-height:calc(100vh - 220px); }

/* ---------- Play mode only (hide research + csv) ---------- */
body.mode-play .research-card{ display:none; }
body.mode-play #metaPDPA{ display:none; }
body.mode-play #downloadCsvBtn{ display:none; }

/* ---------- Responsive ---------- */
@media (max-width:720px){
  .research-grid{ grid-template-columns:1fr; }
  .hud{ flex-direction:column; align-items:flex-start; position:sticky; }
  .game-panel{ min-height:320px; }
}

/* ---------- Reduce motion ---------- */
@media (prefers-reduced-motion: reduce){
  .feedback.show{
    animation:none !important;
    opacity:1 !important;
    transform: translate(-50%,-50%) scale(1) !important;
  }
  .sb-target{ transition:none !important; }
}