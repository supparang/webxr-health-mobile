:root{
  color-scheme: dark;
  --rb-bg: #020617;
  --rb-card: rgba(15,23,42,0.96);
  --rb-border: #1f2937;
  --rb-accent: #38bdf8;
  --rb-accent-soft: rgba(56,189,248,0.25);
  --rb-accent-2: #a855f7;
  --rb-text: #e5e7eb;
  --rb-text-soft: #9ca3af;
  --rb-danger: #f97373;
  --rb-good: #4ade80;
  --rb-warn: #fb923c;
  --rb-fever: #facc15;
  --rb-rank-sss: #fbbf24;
  --rb-rank-ss: #f97316;
  --rb-rank-s: #22c55e;
}
*,
*::before,
*::after{
  box-sizing:border-box;
}
body{
  margin:0;
  min-height:100vh;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif;
  background:
    radial-gradient(circle at top left, rgba(56,189,248,0.16), transparent 55%),
    radial-gradient(circle at bottom right, rgba(168,85,247,0.18), transparent 55%),
    var(--rb-bg);
  color:var(--rb-text);
}

/* Layout */
.rb-wrap{
  max-width:1024px;
  margin:16px auto 32px;
  padding:0 12px 24px;
}
.rb-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:12px;
  margin-bottom:16px;
}
.rb-header-main h1{
  margin:0 0 4px;
  font-size:1.6rem;
}
.rb-header-main p{
  margin:0;
  font-size:.9rem;
  color:var(--rb-text-soft);
}
.rb-header-badge span{
  display:inline-flex;
  align-items:center;
  padding:4px 10px;
  border-radius:999px;
  border:1px solid var(--rb-border);
  background:rgba(15,23,42,.8);
  font-size:.75rem;
  color:var(--rb-text-soft);
}

/* Cards / views */
.rb-view{
  margin-top:4px;
}
.rb-card{
  background:var(--rb-card);
  border-radius:18px;
  border:1px solid var(--rb-border);
  padding:16px 16px 14px;
  box-shadow:0 20px 35px rgba(15,23,42,.75);
}
.rb-card h2{
  margin:0 0 8px;
  font-size:1.2rem;
}
.rb-card h3{
  margin:10px 0 6px;
  font-size:1rem;
}
.rb-sub{
  margin:0 0 10px;
  font-size:.85rem;
  color:var(--rb-text-soft);
}
.rb-grid-2{
  display:grid;
  grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);
  gap:14px;
}
@media(max-width:800px){
  .rb-grid-2{
    grid-template-columns:1fr;
  }
}

/* Labels & inputs */
.rb-label{
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-bottom:8px;
  font-size:.85rem;
}
.rb-input,
.rb-select{
  background:#020617;
  border-radius:9px;
  border:1px solid #111827;
  padding:6px 9px;
  color:var(--rb-text);
  font-size:.85rem;
}
.rb-input:focus,
.rb-select:focus{
  outline:1px solid var(--rb-accent);
  border-color:var(--rb-accent);
}
textarea.rb-input{
  resize:vertical;
}

/* Buttons */
.rb-btn{
  border-radius:999px;
  border:1px solid #1f2937;
  padding:6px 14px;
  background:#020617;
  color:var(--rb-text);
  font-size:.85rem;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  transition:background .16s,transform .06s,box-shadow .16s,border-color .16s;
}
.rb-btn-primary{
  background:linear-gradient(135deg,#38bdf8,#a855f7);
  border-color:transparent;
  box-shadow:0 14px 25px rgba(56,189,248,.35);
}
.rb-btn-primary:hover{
  box-shadow:0 18px 35px rgba(56,189,248,.45);
  transform:translateY(-1px);
}
.rb-btn-ghost{
  background:rgba(15,23,42,.9);
}
.rb-btn-sm{
  padding:4px 10px;
  font-size:.8rem;
}
.rb-btn-lg{
  width:100%;
  margin-top:10px;
  padding:10px 16px;
  font-size:.95rem;
}

/* Radios */
.rb-mode-row{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-bottom:6px;
}
.rb-radio{
  display:flex;
  padding:6px 8px;
  border-radius:10px;
  border:1px solid #111827;
  background:rgba(15,23,42,.9);
  gap:8px;
  align-items:flex-start;
}
.rb-radio input{
  margin-top:4px;
}
.rb-radio span{
  font-size:.9rem;
  font-weight:600;
}
.rb-radio small{
  display:block;
  font-size:.75rem;
  color:var(--rb-text-soft);
}

/* Hint & divider */
.rb-hint{
  margin:4px 0 0;
  font-size:.8rem;
  color:var(--rb-text-soft);
}
.rb-divider{
  border:none;
  border-top:1px solid #111827;
  margin:10px 0 10px;
}

/* HUD */
.rb-hud{
  margin-bottom:12px;
}
.rb-hud-top{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  align-items:center;
  margin-bottom:10px;
}
.rb-hud-block{
  min-width:86px;
}
.rb-hud-label{
  font-size:.7rem;
  color:var(--rb-text-soft);
}
.rb-hud-value{
  font-size:.95rem;
  font-weight:600;
}
.rb-hud-track{
  flex:1;
  min-width:140px;
}
.rb-hud-bottom{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  align-items:center;
}
.rb-hit-stats{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  font-size:.8rem;
}
.rb-hit-stats span{
  color:var(--rb-text-soft);
}
.rb-hit-stats strong{
  color:var(--rb-text);
}

/* Fever bar */
.rb-fever-wrap{
  flex:1;
  min-width:160px;
}
.rb-fever-label{
  font-size:.75rem;
  display:flex;
  justify-content:space-between;
  margin-bottom:2px;
  color:var(--rb-text-soft);
}
#rb-fever-status.on{
  color:var(--rb-fever);
  font-weight:600;
}
.rb-fever-bar{
  position:relative;
  width:100%;
  height:8px;
  border-radius:999px;
  background:#020617;
  overflow:hidden;
  border:1px solid #111827;
}
.rb-fever-fill{
  position:absolute;
  left:0;
  top:0;
  bottom:0;
  width:0%;
  transform-origin:left center;
  background:linear-gradient(90deg,#fbbf24,#f97316,#fb7185);
  transition:transform .12s linear;
}

/* Progress */
.rb-progress-wrap{
  display:flex;
  align-items:center;
  gap:6px;
  min-width:90px;
}
.rb-progress-bar{
  flex:1;
  height:8px;
  border-radius:999px;
  background:#020617;
  border:1px solid #111827;
  overflow:hidden;
}
.rb-progress-fill{
  height:100%;
  width:0%;
  background:linear-gradient(90deg,#22c55e,#a3e635);
  transition:width .12s linear;
}
.rb-progress-text{
  font-size:.75rem;
  color:var(--rb-text-soft);
}

/* Field (lanes) */
.rb-field-card{
  margin-top:10px;
}
.rb-field-header{
  margin-bottom:10px;
}
.rb-lanes{
  position:relative;
  display:grid;
  grid-template-columns:repeat(5, minmax(0,1fr));
  gap:4px;
  height:380px;
  border-radius:16px;
  padding:8px 6px 4px;
  background:
    linear-gradient(to bottom,rgba(15,23,42,0.9),rgba(15,23,42,0.95)),
    radial-gradient(circle at top,rgba(56,189,248,0.22),transparent 55%);
  border:1px solid #0f172a;
  overflow:hidden;
}
@media(max-height:720px){
  .rb-lanes{
    height:320px;
  }
}
.rb-lane{
  position:relative;
  border-radius:12px;
  border:1px solid rgba(31,41,55,0.8);
  background:linear-gradient(to bottom,rgba(15,23,42,0.7),rgba(15,23,42,0.98));
  overflow:hidden;
  cursor:pointer;
  touch-action:manipulation;
}
.rb-lane-label{
  position:absolute;
  top:4px;
  left:50%;
  transform:translateX(-50%);
  font-size:.7rem;
  color:var(--rb-text-soft);
  opacity:.9;
}
.rb-hit-line{
  position:absolute;
  left:0;
  right:0;
  bottom:36px;
  height:3px;
  border-radius:999px;
  background:linear-gradient(90deg,rgba(148,163,184,0.1),rgba(148,163,184,0.9),rgba(148,163,184,0.1));
}

/* Notes */
.rb-note{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  bottom:100%;
  width:54px;
  height:54px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.8rem;
  background:radial-gradient(circle at 30% 20%,rgba(248,250,252,.9),rgba(148,163,184,.4));
  box-shadow:0 12px 24px rgba(15,23,42,.95);
  transition:bottom .045s linear;
}
.rb-note-hit{
  animation:rb-note-hit .2s ease-out;
}
.rb-note-miss{
  opacity:.25;
}
@keyframes rb-note-hit{
  0%{transform:translateX(-50%) scale(1);}
  100%{transform:translateX(-50%) scale(.9);}
}

/* Score popup */
.rb-score-popup{
  position:absolute;
  bottom:70px;
  left:50%;
  transform:translateX(-50%);
  padding:2px 8px;
  border-radius:999px;
  border:1px solid #111827;
  font-size:.7rem;
  background:rgba(15,23,42,.95);
  opacity:0;
  animation:rb-score-popup 0.6s ease-out forwards;
}
.rb-score-perfect{
  color:var(--rb-good);
  border-color:rgba(74,222,128,0.6);
}
.rb-score-great{
  color:#4ade80;
}
.rb-score-good{
  color:#e5e7eb;
}
.rb-score-miss{
  color:var(--rb-danger);
}
@keyframes rb-score-popup{
  0%{opacity:0; transform:translateX(-50%) translateY(8px);}
  20%{opacity:1; transform:translateX(-50%) translateY(0);}
  100%{opacity:0; transform:translateX(-50%) translateY(-8px);}
}

/* Feedback text */
.rb-feedback{
  font-size:.85rem;
  color:var(--rb-text-soft);
}
.rb-feedback.good{
  color:var(--rb-good);
}
.rb-feedback.miss{
  color:var(--rb-danger);
}
.rb-feedback.warn{
  color:var(--rb-warn);
}

/* Result view */
.rb-result-card h2{
  margin-bottom:10px;
}
.rb-result-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
  font-size:.85rem;
}
.rb-result-col p{
  margin:2px 0;
}
.rb-result-actions{
  margin-top:12px;
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}
.rb-rank{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:40px;
  padding:2px 10px;
  border-radius:999px;
  border:1px solid #1f2937;
  background:#020617;
}
.rb-quality-note{
  margin-top:4px;
  font-size:.8rem;
  color:var(--rb-warn);
}

/* Overlay */
.rb-overlay{
  position:fixed;
  inset:0;
  background:rgba(15,23,42,0.8);
  z-index:40;
  display:flex;
  align-items:center;
  justify-content:center;
}
.rb-overlay-box{
  max-width:360px;
  width:90%;
  background:var(--rb-card);
  border-radius:18px;
  border:1px solid var(--rb-border);
  padding:16px;
  text-align:center;
  box-shadow:0 22px 45px rgba(0,0,0,.8);
}
.rb-overlay-box h2{
  margin:0 0 8px;
}
.rb-overlay-box p{
  margin:0 0 12px;
  font-size:.9rem;
}

/* Utils */
.hidden{
  display:none !important;
}
