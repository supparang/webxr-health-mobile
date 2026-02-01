/* === /fitness/css/rhythm-boxer.css ===
   Rhythm Boxer — Full CSS (Menu / Play / Result + FX + AI HUD)
   ✅ Dark/Neon card UI
   ✅ Responsive grid (PC/Mobile)
   ✅ Lane field + timing line
   ✅ Feedback + flash + particles (rb-frag) + score text (rb-score-fx)
   ✅ AI chips + coach tip
*/

:root{
  --bg0:#020617;
  --bg1:#0b1220;
  --panel: rgba(15, 23, 42, .55);
  --panel2: rgba(2, 6, 23, .70);
  --stroke: rgba(148, 163, 184, .18);
  --stroke2: rgba(148, 163, 184, .28);

  --text:#e5e7eb;
  --muted:#94a3b8;

  --accent:#22c55e;
  --violet:#8b5cf6;
  --cyan:#22d3ee;
  --pink:#fb7185;
  --warn:#f59e0b;
  --danger:#ef4444;

  --radius: 22px;
  --radius2: 16px;

  --shadow: 0 18px 60px rgba(0,0,0,.35);
  --shadow2: 0 10px 34px rgba(0,0,0,.25);

  --pad: 18px;
  --pad2: 14px;

  --chipBg: rgba(2,6,23,.42);
  --chipStroke: rgba(148,163,184,.18);

  --tap: rgba(255,255,255,.08);
  --tap2: rgba(255,255,255,.12);

  --laneH: 148px;          /* height of play field */
  --laneGap: 10px;
  --timingY: calc(var(--laneH) - 42px); /* match renderer's y hint */
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
  color: var(--text);
  background:
    radial-gradient(1200px 800px at 20% 10%, rgba(34,211,238,.18), transparent 55%),
    radial-gradient(1100px 700px at 78% 15%, rgba(139,92,246,.18), transparent 55%),
    radial-gradient(900px 700px at 40% 90%, rgba(34,197,94,.10), transparent 60%),
    linear-gradient(180deg, var(--bg0), var(--bg1));
  overflow-x:hidden;
}

/* general */
.hidden{ display:none !important; }
.rb-view{
  width: min(1180px, calc(100% - 26px));
  margin: 18px auto 44px;
}

/* wrapper */
#rb-wrap{
  min-height: 100vh;
  padding-bottom: 30px;
  position: relative;
}

/* flash overlay */
#rb-flash{
  position: fixed;
  inset: 0;
  pointer-events:none;
  z-index: 999;
  opacity:0;
  background: radial-gradient(800px 600px at 50% 40%, rgba(239,68,68,.28), rgba(0,0,0,0) 65%);
  transition: opacity .18s ease;
}
#rb-flash.active{ opacity:1; }

/* header */
.rb-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 16px;
  margin: 10px 0 18px;
}
.rb-head-main{
  min-width: 0;
}
.rb-pill{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border:1px solid var(--stroke);
  background: rgba(2,6,23,.42);
  color: var(--muted);
  font-size: 12px;
  letter-spacing: .2px;
}
.rb-title{
  margin: 10px 0 6px;
  font-size: 44px;
  line-height: 1.04;
  letter-spacing: .2px;
}
.rb-sub{
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}
.rb-sub-small{
  display:inline-block;
  color: rgba(229,231,235,.85);
  font-size: 12px;
  opacity:.9;
}
.rb-back{
  white-space:nowrap;
  text-decoration:none;
  color: var(--text);
  padding: 10px 14px;
  border-radius: 999px;
  border:1px solid var(--stroke);
  background: rgba(2,6,23,.42);
  box-shadow: var(--shadow2);
}
.rb-back:active{ transform: translateY(1px); }

/* sections & cards */
.rb-section{ margin-top: 14px; }
.rb-section-title{
  margin: 0 0 12px;
  font-size: 18px;
  letter-spacing: .2px;
}
.rb-section-subtitle{
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 13px;
}
.rb-section-title-sm{
  margin:0 0 8px;
  font-size: 16px;
}
.rb-section-subtitle,
.rb-hint-inline{ line-height:1.45; }

.rb-grid-2{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px){
  .rb-grid-2{ grid-template-columns: 1fr; }
  .rb-title{ font-size: 36px; }
}

/* card */
.rb-research-box{
  border-radius: var(--radius);
  border: 1px solid var(--stroke);
  background: linear-gradient(180deg, rgba(15,23,42,.60), rgba(2,6,23,.48));
  box-shadow: var(--shadow);
  padding: var(--pad);
  position: relative;
  overflow: hidden;
}
.rb-research-box:before{
  content:"";
  position:absolute;
  inset:-2px;
  background: radial-gradient(700px 260px at 10% 5%, rgba(34,211,238,.08), transparent 60%),
              radial-gradient(700px 260px at 90% 10%, rgba(139,92,246,.08), transparent 60%);
  pointer-events:none;
}

/* toggle */
.rb-mode-toggle{
  display:flex;
  gap: 10px;
  padding: 8px;
  border-radius: 999px;
  border:1px solid var(--stroke);
  background: rgba(2,6,23,.45);
  width: fit-content;
}
.rb-mode-btn{
  display:flex;
  align-items:center;
  gap: 10px;
  cursor:pointer;
  user-select:none;
  border-radius: 999px;
  padding: 10px 14px;
  border:1px solid rgba(148,163,184,.12);
  background: rgba(255,255,255,.04);
  transition: transform .06s ease, background .12s ease, border-color .12s ease;
}
.rb-mode-btn input{
  position:absolute;
  opacity:0;
  pointer-events:none;
}
.rb-mode-btn span{
  font-size: 14px;
  color: rgba(229,231,235,.92);
}
.rb-mode-btn:active{ transform: translateY(1px); }

.rb-mode-desc{
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 13px;
}

/* radio selected visuals */
.rb-mode-btn:has(input:checked){
  border-color: rgba(139,92,246,.55);
  background: linear-gradient(90deg, rgba(34,211,238,.18), rgba(139,92,246,.18));
  box-shadow: 0 0 0 3px rgba(139,92,246,.14);
}
#rb-track-options .rb-mode-btn{
  width: 100%;
  justify-content: flex-start;
  margin: 8px 0;
  border-radius: 16px;
  padding: 12px 14px;
}
#rb-track-options .rb-mode-btn:has(input:checked){
  border-color: rgba(34,211,238,.55);
  background: linear-gradient(90deg, rgba(34,211,238,.16), rgba(139,92,246,.16));
  box-shadow: 0 0 0 3px rgba(34,211,238,.12);
}

/* form fields */
.rb-field{
  display:grid;
  gap: 6px;
  margin-top: 12px;
}
.rb-field label{
  font-size: 12px;
  color: rgba(229,231,235,.86);
}
.rb-field input{
  width: 100%;
  border-radius: 14px;
  border:1px solid var(--stroke);
  background: rgba(2,6,23,.55);
  color: var(--text);
  padding: 12px 12px;
  outline:none;
}
.rb-field input:focus{
  border-color: rgba(34,211,238,.55);
  box-shadow: 0 0 0 3px rgba(34,211,238,.14);
}

.rb-hint-inline{
  margin: 12px 0 0;
  font-size: 12px;
  color: rgba(148,163,184,.95);
}

/* hint block */
.rb-hint-block{
  margin-top: 10px;
  border-radius: 16px;
  border:1px dashed rgba(148,163,184,.28);
  background: rgba(2,6,23,.35);
  padding: 12px 12px;
}
.rb-hint-title{
  margin:0 0 8px;
  font-weight: 700;
  font-size: 13px;
  color: rgba(229,231,235,.95);
}
.rb-hint-list{
  margin:0;
  padding-left: 18px;
  color: rgba(229,231,235,.86);
  font-size: 12.5px;
  line-height: 1.5;
}
.rb-hint-list li{ margin: 4px 0; }

/* buttons */
.rb-btn{
  appearance:none;
  border:1px solid var(--stroke);
  background: rgba(2,6,23,.48);
  color: var(--text);
  padding: 12px 14px;
  border-radius: 16px;
  cursor:pointer;
  font-weight: 650;
  letter-spacing:.2px;
  transition: transform .06s ease, background .12s ease, border-color .12s ease;
}
.rb-btn:hover{
  background: rgba(255,255,255,.05);
  border-color: rgba(148,163,184,.30);
}
.rb-btn:active{ transform: translateY(1px); }

.rb-btn-primary{
  border-color: rgba(139,92,246,.55);
  background: linear-gradient(90deg, rgba(34,211,238,.18), rgba(139,92,246,.24));
  box-shadow: 0 0 0 3px rgba(139,92,246,.12);
}
.rb-btn-primary:hover{
  border-color: rgba(34,211,238,.55);
  box-shadow: 0 0 0 3px rgba(34,211,238,.12);
}
.rb-btn-ghost{
  border-radius: 999px;
  padding: 10px 14px;
}
.rb-btn-sm{
  padding: 10px 12px;
  border-radius: 14px;
}

.rb-btn-row{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items:center;
}

/* ===== PLAY VIEW ===== */
.rb-play-header{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 14px;
  margin: 8px 0 14px;
}
.rb-title-sm{
  margin:0;
  font-size: 22px;
}
.rb-sub-sm{
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

/* HUD chips */
.rb-hud{
  padding: 14px 14px 12px;
}
.rb-hud-row{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items:center;
  margin: 8px 0;
}
.rb-chip{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: var(--chipBg);
  border:1px solid var(--chipStroke);
  font-size: 12px;
  color: rgba(229,231,235,.92);
}
.rb-chip b{
  font-weight: 800;
  letter-spacing:.2px;
}

/* AI chips */
.rb-hud-row-ai{
  gap: 10px;
  flex-wrap: wrap;
}
.rb-chip-ai{
  border: 1px solid rgba(99,102,241,.35);
  background: rgba(99,102,241,.12);
}
.rb-chip-tip{
  width: 100%;
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
}
.rb-chip-tip-label{
  opacity: .75;
  font-weight: 700;
}
#rb-hud-ai-tip.hidden{
  display: none !important;
}

/* judge row */
.rb-hud-judge-row .rb-chip{
  background: rgba(2,6,23,.36);
}

/* bars */
.rb-bars{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
}
@media (max-width: 720px){
  .rb-bars{ grid-template-columns: 1fr; }
}
.rb-bar-block{
  border-radius: 16px;
  border:1px solid var(--stroke);
  background: rgba(2,6,23,.34);
  padding: 10px 12px;
  display:flex;
  align-items:center;
  gap: 10px;
}
.rb-bar-label{
  width: 64px;
  font-size: 12px;
  color: rgba(229,231,235,.86);
  font-weight: 750;
}
.rb-bar{
  flex: 1;
  height: 12px;
  border-radius: 999px;
  overflow:hidden;
  background: rgba(148,163,184,.14);
  border:1px solid rgba(148,163,184,.14);
}
.rb-bar-fill{
  height: 100%;
  width: 0%;
  border-radius: 999px;
  transition: width .12s linear;
}
.rb-bar-fever{
  background: linear-gradient(90deg, rgba(34,197,94,.65), rgba(34,211,238,.75), rgba(139,92,246,.75));
}
.rb-bar-progress{
  background: linear-gradient(90deg, rgba(34,211,238,.75), rgba(139,92,246,.75));
}
.rb-bar-status{
  width: 64px;
  text-align:right;
  font-size: 12px;
  color: rgba(229,231,235,.86);
  font-weight: 750;
}

/* field */
.rb-field-wrap{
  margin-top: 14px;
}
#rb-field{
  position: relative;
  height: calc(var(--laneH) + 34px);
  border-radius: var(--radius);
  border:1px solid var(--stroke);
  background:
    radial-gradient(700px 300px at 50% 0%, rgba(34,211,238,.12), transparent 70%),
    linear-gradient(180deg, rgba(2,6,23,.58), rgba(2,6,23,.36));
  overflow:hidden;
  box-shadow: var(--shadow);
}

/* timing line (visual aid) */
#rb-field:after{
  content:"";
  position:absolute;
  left: 14px;
  right: 14px;
  top: var(--timingY);
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(34,211,238,.0), rgba(34,211,238,.55), rgba(139,92,246,.55), rgba(139,92,246,.0));
  opacity: .85;
  pointer-events:none;
}

/* feedback */
.rb-feedback{
  position:absolute;
  left: 12px;
  top: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  border:1px solid rgba(148,163,184,.22);
  background: rgba(2,6,23,.48);
  color: rgba(229,231,235,.92);
  font-weight: 800;
  letter-spacing: .3px;
  z-index: 10;
  user-select:none;
}
.rb-feedback.perfect{ border-color: rgba(34,197,94,.55); box-shadow: 0 0 0 3px rgba(34,197,94,.12); }
.rb-feedback.great{   border-color: rgba(34,211,238,.55); box-shadow: 0 0 0 3px rgba(34,211,238,.12); }
.rb-feedback.good{    border-color: rgba(139,92,246,.55); box-shadow: 0 0 0 3px rgba(139,92,246,.12); }
.rb-feedback.miss{    border-color: rgba(239,68,68,.55); box-shadow: 0 0 0 3px rgba(239,68,68,.12); }

/* lanes */
.rb-lanes{
  position:absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  height: var(--laneH);
  display:grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--laneGap);
  z-index: 2;
}
.rb-lane{
  position: relative;
  border-radius: var(--radius2);
  border: 1px solid rgba(148,163,184,.22);
  background: rgba(2,6,23,.22);
  overflow:hidden;
  user-select:none;
  touch-action: manipulation;
}
.rb-lane:before{
  content:"";
  position:absolute;
  inset: 0;
  background: radial-gradient(240px 180px at 50% 10%, rgba(255,255,255,.06), transparent 65%);
  pointer-events:none;
}
.rb-lane:hover{ border-color: rgba(148,163,184,.32); }
.rb-lane:active{ background: rgba(255,255,255,.06); }

.rb-lane-label{
  position:absolute;
  left: 10px;
  bottom: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,.22);
  background: rgba(2,6,23,.44);
  color: rgba(229,231,235,.92);
  font-weight: 900;
  letter-spacing: .4px;
  font-size: 12px;
  z-index: 2;
}

/* howto inline */
.rb-howto-inline{
  margin: 10px 6px 0;
  color: rgba(148,163,184,.95);
  font-size: 12px;
}

/* ===== RESULT VIEW ===== */
.rb-result-grid{
  display:grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 16px;
  margin-top: 12px;
}
@media (max-width: 900px){
  .rb-result-grid{ grid-template-columns: 1fr; }
}

.rb-result-card{
  border-radius: var(--radius);
  border: 1px solid var(--stroke);
  background: linear-gradient(180deg, rgba(15,23,42,.60), rgba(2,6,23,.48));
  box-shadow: var(--shadow);
  padding: var(--pad);
}
.rb-result-title{
  margin: 0 0 10px;
  font-size: 18px;
}
.rb-result-row{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(148,163,184,.18);
}
.rb-result-row:last-child{ border-bottom:none; }
.rb-result-row span{
  color: rgba(148,163,184,.95);
  font-size: 13px;
}
.rb-result-row b{
  font-weight: 900;
  letter-spacing:.2px;
}

.rb-quality-note{
  margin: 12px 0 0;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(245,158,11,.35);
  background: rgba(245,158,11,.10);
  color: rgba(229,231,235,.95);
  font-size: 13px;
  line-height: 1.45;
}

/* ===== FX ELEMENTS (dom-renderer-rhythm.js) ===== */
/* score text pop */
.rb-score-fx{
  position: fixed;
  transform: translate(-50%, -50%);
  z-index: 1200;
  font-weight: 950;
  letter-spacing:.2px;
  font-size: 18px;
  opacity: 0;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.35));
  pointer-events:none;
}
.rb-score-fx.is-live{
  animation: rbScorePop 420ms ease-out forwards;
}
.rb-score-perfect{ color: rgba(34,197,94,1); }
.rb-score-great{   color: rgba(34,211,238,1); }
.rb-score-good{    color: rgba(139,92,246,1); }
.rb-score-miss{    color: rgba(239,68,68,1); }

@keyframes rbScorePop{
  0%   { opacity:0; transform: translate(-50%,-50%) translateY(6px) scale(.95); }
  15%  { opacity:1; }
  100% { opacity:0; transform: translate(-50%,-50%) translateY(-24px) scale(1.05); }
}

/* fragments */
.rb-frag{
  position: fixed;
  transform: translate(-50%, -50%);
  z-index: 1100;
  border-radius: 999px;
  pointer-events:none;
  opacity: .95;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.35));
  animation: rbFrag var(--life, 520ms) ease-out forwards;
}
.rb-frag-perfect{ background: rgba(34,197,94,.95); }
.rb-frag-great{   background: rgba(34,211,238,.95); }
.rb-frag-good{    background: rgba(139,92,246,.95); }
.rb-frag-miss{    background: rgba(239,68,68,.95); border-radius: 8px; }

@keyframes rbFrag{
  0%{
    opacity: 0;
    transform: translate(-50%, -50%) translate(0px,0px) scale(.8);
  }
  12%{
    opacity: .95;
    transform: translate(-50%, -50%) translate(0px,0px) scale(1.05);
  }
  100%{
    opacity: 0;
    transform: translate(-50%, -50%) translate(var(--dx,0px), var(--dy,0px)) scale(.7);
  }
}

/* small accessibility */
@media (prefers-reduced-motion: reduce){
  *{ transition: none !important; animation: none !important; }
}